import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, View, Text, ActivityIndicator, Alert, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { AVATARS, type AvatarGender } from '@/constants/avatars';
import { Avatar } from '@/components/common/Avatar';
import { AppLottie } from '@/components/common/AppLottie';
import { lottie } from '@/constants/lottie';
import { selection as hapticSelection, success as hapticSuccess } from '@/utils/haptics';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentAvatarId?: string | null;
  onSelected?: (avatarId: string) => void;
};

/**
 * Avatar seçim sheet'i — 12 bitmoji-tarzı avatardan biri seçilir.
 * Cinsiyet gruplarına ayrılmış (6 erkek + 6 kız), her grup 3×2 grid.
 * Seçim: hapticSelection + yumuşak pulse (Reanimated).
 * Kaydet: hapticSuccess + 1.2 sn Lottie celebrate overlay → kapanır.
 */
export function AvatarPickerSheet({ visible, onClose, currentAvatarId, onSelected }: Props) {
  const [picked, setPicked] = useState<string | null>(currentAvatarId ?? null);
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groups = useMemo(
    () => ({
      male: AVATARS.filter((a) => a.gender === 'male'),
      female: AVATARS.filter((a) => a.gender === 'female'),
    }),
    [],
  );

  useEffect(() => {
    if (visible) {
      setPicked(currentAvatarId ?? null);
      setCelebrating(false);
    }
    return () => {
      if (celebrateTimer.current) {
        clearTimeout(celebrateTimer.current);
        celebrateTimer.current = null;
      }
    };
  }, [visible, currentAvatarId]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user || !picked) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { avatarId: picked });
      hapticSuccess();
      setSaving(false);
      setCelebrating(true);
      celebrateTimer.current = setTimeout(() => {
        setCelebrating(false);
        onSelected?.(picked);
        onClose();
      }, 1200);
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/50">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mt-auto rounded-t-3xl bg-bg-base px-5 pb-8 pt-3"
          style={{ maxHeight: '85%' }}
        >
          <View className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-soft" />
          <View className="flex-row items-center">
            <Text className="flex-1 text-base font-semibold text-text-primary">
              Avatarını Seç
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
            >
              <X color="#94A3B8" size={14} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16 }}>
            <GroupTitle>Erkek</GroupTitle>
            <Grid
              avatars={groups.male}
              pickedId={picked}
              onPick={(id) => {
                hapticSelection();
                setPicked(id);
              }}
            />

            <View className="h-5" />

            <GroupTitle>Kız</GroupTitle>
            <Grid
              avatars={groups.female}
              pickedId={picked}
              onPick={(id) => {
                hapticSelection();
                setPicked(id);
              }}
            />
          </ScrollView>

          <Pressable
            onPress={handleSave}
            disabled={saving || !picked || celebrating}
            className={`mt-4 flex-row items-center justify-center rounded-xl bg-accent py-3.5 active:opacity-80 ${
              saving || !picked || celebrating ? 'opacity-60' : ''
            }`}
          >
            {saving ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="text-sm font-bold text-white">Kaydet</Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>

      {/* Kaydetme sonrası Lottie kutlama overlay */}
      {celebrating ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppLottie
            source={lottie.celebrate}
            loop={false}
            autoPlay
            style={{ width: 220, height: 220 }}
          />
        </View>
      ) : null}
    </Modal>
  );
}

function GroupTitle({ children }: { children: string }) {
  return (
    <Text className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">
      {children}
    </Text>
  );
}

type GridProps = {
  avatars: { id: string; label: string; gender: AvatarGender }[];
  pickedId: string | null;
  onPick: (id: string) => void;
};

function Grid({ avatars, pickedId, onPick }: GridProps) {
  return (
    <View className="flex-row flex-wrap" style={{ rowGap: 14 }}>
      {avatars.map((a) => (
        <AvatarCell
          key={a.id}
          id={a.id}
          label={a.label}
          isPicked={pickedId === a.id}
          onPress={() => onPick(a.id)}
        />
      ))}
    </View>
  );
}

type CellProps = {
  id: string;
  label: string;
  isPicked: boolean;
  onPress: () => void;
};

function AvatarCell({ id, label, isPicked, onPress }: CellProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isPicked) {
      scale.value = withRepeat(withTiming(1.06, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(scale);
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [isPicked, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} className="items-center" style={{ width: '33.33%' }}>
      <Animated.View style={animStyle}>
        <Avatar avatarId={id} size={80} ring={isPicked} ringWidth={3} />
      </Animated.View>
      <Text
        className={`mt-2 text-[11px] font-semibold ${
          isPicked ? 'text-accent-fg' : 'text-text-muted'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

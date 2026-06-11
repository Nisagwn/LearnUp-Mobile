import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pencil, Mail, Check, X, Sparkles } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';
import { Avatar } from '@/components/common/Avatar';
import { gradients } from '@/constants/theme';

type LevelData = {
  level: number;
  name: string;
  emoji: string;
};

type Props = {
  name: string;
  role: string;
  email?: string | null;
  avatarId?: string | null;
  avatarUrl: string | null;
  uploading?: boolean;
  onChangeAvatar: () => void;
  onSaveName: (name: string) => Promise<void>;
  levelData: LevelData;
  levelProgress: number; // 0..100
  toNext: number; // bir sonraki seviyeye kalan doğru sayısı
  /** Deterministik fallback için kullanıcı uid'i. */
  uid?: string | null;
};

export function ProfileHero({
  name,
  role,
  email,
  avatarId,
  avatarUrl,
  onChangeAvatar,
  onSaveName,
  levelData,
  levelProgress,
  toNext,
  uid,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  // Sparkles düzenle indikatörü için hafif sallanma — kullanıcı tıklanabilir
  // olduğunu fark etsin.
  const sparkleScale = useSharedValue(1);
  useEffect(() => {
    sparkleScale.value = withRepeat(
      withSequence(withTiming(1.12, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false,
    );
  }, [sparkleScale]);
  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale.value }],
  }));

  const startEdit = () => {
    setDraft(name);
    setEditing(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSaveName(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="overflow-hidden rounded-3xl">
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24 }}
        className="p-6"
      >
        <View className="items-center">
          <Pressable onPress={onChangeAvatar} className="active:opacity-80">
            <Avatar
              avatarId={avatarId}
              photoURL={avatarUrl}
              size={132}
              ring
              ringWidth={4}
              fallbackSeed={uid ?? null}
            />
            <Animated.View
              style={sparkleStyle}
              className="absolute -bottom-1 -right-1 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-accent"
            >
              <Sparkles color="white" size={16} />
            </Animated.View>
          </Pressable>

          {editing ? (
            <View className="mt-4 w-full flex-row items-center gap-2">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                maxLength={50}
                placeholderTextColor="rgba(255,255,255,0.6)"
                className="flex-1 rounded-xl border border-white/40 bg-white/15 px-3 py-2 text-base text-white"
              />
              <Pressable
                onPress={() => setEditing(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/20 active:opacity-70"
              >
                <X color="white" size={18} />
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="h-10 w-10 items-center justify-center rounded-full bg-white active:opacity-80"
              >
                {saving ? (
                  <ActivityIndicator color="#16A34A" size="small" />
                ) : (
                  <Check color="#16A34A" size={18} />
                )}
              </Pressable>
            </View>
          ) : (
            <View className="mt-4 flex-row items-center">
              <Text className="text-xl font-bold text-white">{name}</Text>
              <Pressable onPress={startEdit} hitSlop={8} className="ml-2 p-1 active:opacity-60">
                <Pencil color="white" size={14} />
              </Pressable>
            </View>
          )}

          <Text className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/80">
            {role}
          </Text>
          {email ? (
            <View className="mt-2 flex-row items-center">
              <Mail color="rgba(255,255,255,0.7)" size={12} />
              <Text className="ml-1 text-xs text-white/75">{email}</Text>
            </View>
          ) : null}
        </View>

        {/* Seviye rozeti + ilerleme */}
        <View className="mt-5 rounded-2xl bg-white/15 p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Text style={{ fontSize: 22 }}>{levelData.emoji}</Text>
              <View className="ml-2">
                <Text className="text-[10px] uppercase tracking-wide text-white/70">
                  Seviye {levelData.level}
                </Text>
                <Text className="text-sm font-bold text-white">{levelData.name}</Text>
              </View>
            </View>
            <Text className="text-[11px] font-medium text-white/80">
              {toNext > 0 ? `Sonraki seviyeye ${toNext} doğru` : 'En üst seviye'}
            </Text>
          </View>
          <View className="mt-2.5">
            <AnimatedProgressBar
              value={Math.min(1, Math.max(0, levelProgress / 100))}
              height={6}
              fillColor="#FFFFFF"
              trackClassName="bg-white/20"
            />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

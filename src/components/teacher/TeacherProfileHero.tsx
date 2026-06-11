import { useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GraduationCap,
  Mail,
  Calendar,
  Pencil,
  Check,
  X,
  Sparkles,
  ChevronDown,
} from 'lucide-react-native';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { Avatar } from '@/components/common/Avatar';
import { gradients } from '@/constants/theme';

type Props = {
  avatarId: string | null;
  photoURL: string | null;
  displayName: string;
  email: string | null;
  branch: string | null;
  createdAtMs: number;
  onChangeAvatar: () => void;
  onNameSaved: (newName: string) => void;
  onChangeBranch?: () => void;
};

function formatMemberSince(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
}

export function TeacherProfileHero({
  avatarId,
  photoURL,
  displayName,
  email,
  branch,
  createdAtMs,
  onChangeAvatar,
  onNameSaved,
  onChangeBranch,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      Alert.alert('Geçersiz isim', 'Ad 2 ile 50 karakter arasında olmalı.');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { name: trimmed });
      await updateProfile(user, { displayName: trimmed });
      onNameSaved(trimmed);
      setEditing(false);
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, padding: 20 }}
    >
      <View style={{ alignItems: 'center' }}>
        <Pressable onPress={onChangeAvatar} className="active:opacity-80">
          <View
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <Avatar avatarId={avatarId} photoURL={photoURL} size={88} />
          </View>
          <View
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              height: 30,
              width: 30,
              borderRadius: 15,
              backgroundColor: '#FBBF24',
              borderWidth: 2,
              borderColor: 'white',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles color="white" size={14} />
          </View>
        </Pressable>

        {editing ? (
          <View className="mt-4 w-full flex-row items-center gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoFocus
              maxLength={50}
              placeholderTextColor="rgba(255,255,255,0.6)"
              className="flex-1 rounded-xl bg-white/20 px-3 py-2 text-base text-white"
            />
            <Pressable
              onPress={() => {
                setEditing(false);
                setDraft(displayName);
              }}
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
            <Text className="text-2xl font-bold text-white">{displayName}</Text>
            <Pressable
              onPress={() => {
                setDraft(displayName);
                setEditing(true);
              }}
              hitSlop={8}
              className="ml-2 p-1 active:opacity-60"
            >
              <Pencil color="rgba(255,255,255,0.85)" size={14} />
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={onChangeBranch}
          disabled={!onChangeBranch}
          className="mt-2 flex-row items-center rounded-full bg-white/20 px-3 py-1 active:opacity-70"
        >
          <GraduationCap color="white" size={12} />
          <Text className="ml-1.5 text-xs font-bold uppercase tracking-wide text-white">
            Öğretmen{branch ? ` · ${branch}` : ''}
          </Text>
          {onChangeBranch ? <ChevronDown color="white" size={12} style={{ marginLeft: 4 }} /> : null}
        </Pressable>
        {!branch && onChangeBranch ? (
          <Text className="mt-1 text-[10px] text-white/85">Branşını seçmek için dokun</Text>
        ) : null}

        <View className="mt-3 w-full" style={{ gap: 4 }}>
          {email ? (
            <View className="flex-row items-center justify-center">
              <Mail color="rgba(255,255,255,0.85)" size={12} />
              <Text className="ml-1.5 text-xs text-white/85">{email}</Text>
            </View>
          ) : null}
          {createdAtMs ? (
            <View className="flex-row items-center justify-center">
              <Calendar color="rgba(255,255,255,0.85)" size={12} />
              <Text className="ml-1.5 text-xs text-white/85">
                Üyelik: {formatMemberSince(createdAtMs)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
}

import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { X, Sparkles } from 'lucide-react-native';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { Avatar } from '@/components/common/Avatar';
import { AvatarPickerSheet } from '@/components/settings/AvatarPickerSheet';

const GRADE_OPTIONS = ['9', '10', '11', '12'] as const;

export type ProfilePatch = {
  name?: string;
  grade?: string;
  branch?: string;
  avatarId?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  role: 'student' | 'teacher';
  initialName: string;
  initialPhoto?: string | null;
  initialAvatarId?: string | null;
  initialGrade?: string | null;
  initialBranch?: string | null;
  onSaved?: (patch: ProfilePatch) => void;
};

export function EditProfileSheet({
  visible,
  onClose,
  role,
  initialName,
  initialPhoto,
  initialAvatarId,
  initialGrade,
  initialBranch,
  onSaved,
}: Props) {
  const [name, setName] = useState(initialName);
  const [grade, setGrade] = useState<string | null>(initialGrade ?? null);
  const [branch, setBranch] = useState(initialBranch ?? '');
  const [avatarId, setAvatarId] = useState<string | null>(initialAvatarId ?? null);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setGrade(initialGrade ?? null);
      setBranch(initialBranch ?? '');
      setAvatarId(initialAvatarId ?? null);
      setSaving(false);
    }
  }, [visible, initialName, initialGrade, initialBranch, initialAvatarId]);

  const handleSave = async () => {
    const user = auth.currentUser;
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      Alert.alert('Geçersiz isim', 'Ad 2 ile 50 karakter arasında olmalı.');
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const patch: ProfilePatch = { name: trimmed };
      if (role === 'student' && grade) patch.grade = grade;
      if (role === 'teacher') patch.branch = branch.trim();
      await updateDoc(doc(db, 'users', user.uid), patch as Record<string, unknown>);
      await updateProfile(user, { displayName: trimmed });
      onSaved?.(patch);
      onClose();
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/50">
        <Pressable onPress={(e) => e.stopPropagation()} className="mt-auto rounded-t-3xl bg-bg-base">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="px-5 pb-8 pt-3">
              <View className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-soft" />
              <View className="flex-row items-center">
                <Text className="flex-1 text-base font-semibold text-text-primary">
                  Profili Düzenle
                </Text>
                <Pressable onPress={onClose} hitSlop={10} className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70">
                  <X color="#94A3B8" size={14} />
                </Pressable>
              </View>

              <View className="mt-4 items-center">
                <Pressable onPress={() => setAvatarSheetOpen(true)} className="active:opacity-80">
                  <Avatar avatarId={avatarId} photoURL={initialPhoto} size={80} />
                  <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full border-2 border-bg-base bg-accent">
                    <Sparkles color="white" size={12} />
                  </View>
                </Pressable>
              </View>

              <Text className="mb-1 mt-5 text-xs font-medium text-text-secondary">Ad</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={50}
                placeholder="Adın"
                placeholderTextColor="#94A3B8"
                className="rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
              />

              {role === 'student' ? (
                <>
                  <Text className="mb-1 mt-4 text-xs font-medium text-text-secondary">Sınıf</Text>
                  <View className="flex-row gap-2">
                    {GRADE_OPTIONS.map((g) => (
                      <Pressable
                        key={g}
                        onPress={() => setGrade(g)}
                        className={`flex-1 items-center rounded-xl border py-2 ${
                          grade === g ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                        }`}
                      >
                        <Text className={`text-sm font-semibold ${grade === g ? 'text-accent-fg' : 'text-text-muted'}`}>
                          {g}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Text className="mb-1 mt-4 text-xs font-medium text-text-secondary">Branş / Ders</Text>
                  <TextInput
                    value={branch}
                    onChangeText={setBranch}
                    maxLength={40}
                    placeholder="Örn. Matematik"
                    placeholderTextColor="#94A3B8"
                    className="rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
                  />
                </>
              )}

              <Pressable
                onPress={handleSave}
                disabled={saving}
                className={`mt-5 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
                  saving ? 'opacity-60' : ''
                }`}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-sm font-bold text-white">Kaydet</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>

      <AvatarPickerSheet
        visible={avatarSheetOpen}
        currentAvatarId={avatarId}
        onClose={() => setAvatarSheetOpen(false)}
        onSelected={(id) => {
          setAvatarId(id);
          onSaved?.({ avatarId: id });
        }}
      />
    </Modal>
  );
}

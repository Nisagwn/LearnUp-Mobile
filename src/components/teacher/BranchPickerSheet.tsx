import { useState } from 'react';
import { Modal, Pressable, View, Text, ActivityIndicator, Alert } from 'react-native';
import { GraduationCap, X, Check } from 'lucide-react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { TEACHER_BRANCHES, type TeacherBranch } from '@/constants/teacherBranches';

type Props = {
  visible: boolean;
  currentBranch: string | null;
  onClose: () => void;
  /** Yeni branş Firestore'a yazıldıktan sonra çağrılır. */
  onSaved: (branch: TeacherBranch) => void;
};

export function BranchPickerSheet({ visible, currentBranch, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<TeacherBranch | null>(
    (currentBranch as TeacherBranch | null) ?? null,
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !selected) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), { branch: selected });
      onSaved(selected);
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
          <View className="px-5 pb-8 pt-3">
            <View className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-soft" />
            <View className="flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
                <GraduationCap color="#15803D" size={18} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-text-primary">Branş Seç</Text>
                <Text className="text-xs text-text-muted">Hangi dersi veriyorsun?</Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
              >
                <X color="#475569" size={14} />
              </Pressable>
            </View>

            <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
              {TEACHER_BRANCHES.map((b) => {
                const active = selected === b;
                return (
                  <Pressable
                    key={b}
                    onPress={() => setSelected(b)}
                    className={`rounded-full border px-4 py-2.5 active:opacity-80 ${
                      active ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        active ? 'text-accent-fg' : 'text-text-secondary'
                      }`}
                    >
                      {b}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={handleSave}
              disabled={saving || !selected || selected === currentBranch}
              className={`mt-5 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
                saving || !selected || selected === currentBranch ? 'opacity-60' : ''
              }`}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Check color="white" size={16} />
              )}
              <Text className="ml-1.5 text-sm font-bold text-white">
                {selected && selected !== currentBranch ? `${selected} olarak kaydet` : 'Kaydet'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Check, X, FolderPlus } from 'lucide-react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void> | void;
};

export function CreateFolderSheet({ visible, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setSaving(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onCreate(trimmed);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/50">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mt-auto rounded-t-3xl bg-bg-base"
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="px-5 pb-6 pt-3">
              <View className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-soft" />
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
                  <FolderPlus color="#4F46E5" size={18} />
                </View>
                <Text className="ml-3 flex-1 text-base font-semibold text-text-primary">
                  Yeni klasör
                </Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
                >
                  <X color="#475569" size={14} />
                </Pressable>
              </View>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Örn. TYT Tekrar, Sınav Öncesi..."
                placeholderTextColor="#94A3B8"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                maxLength={60}
                className="mt-4 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
              />
              <View className="mt-4 flex-row" style={{ gap: 8 }}>
                <Pressable
                  onPress={onClose}
                  className="flex-1 items-center justify-center rounded-xl border border-border-soft py-3 active:opacity-80"
                >
                  <Text className="text-sm font-semibold text-text-secondary">İptal</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit}
                  disabled={!name.trim() || saving}
                  className={`flex-1 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
                    !name.trim() || saving ? 'opacity-50' : ''
                  }`}
                >
                  <Check color="white" size={14} />
                  <Text className="ml-1.5 text-sm font-bold text-white">
                    {saving ? 'Oluşturuluyor...' : 'Oluştur'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

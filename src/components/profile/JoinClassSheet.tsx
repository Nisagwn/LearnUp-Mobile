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
import { School, X, Check } from 'lucide-react-native';
import { auth } from '@/services/firebase';
import { joinClassByCode } from '@/services/classApi';

type Props = {
  visible: boolean;
  onClose: () => void;
  onJoined: (teacherName: string) => void;
};

export function JoinClassSheet({ visible, onClose, onJoined }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCode('');
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  const handleJoin = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { teacherName } = await joinClassByCode(code, uid);
      onJoined(teacherName);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
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
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
                  <School color="#4F46E5" size={18} />
                </View>
                <Text className="ml-3 flex-1 text-base font-semibold text-text-primary">
                  Sınıfa katıl
                </Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
                >
                  <X color="#475569" size={14} />
                </Pressable>
              </View>

              <Text className="mt-4 text-xs text-text-muted">
                Öğretmeninin paylaştığı 6 haneli sınıf kodunu gir.
              </Text>

              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ÖRN. K7M2QX"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={8}
                returnKeyType="done"
                onSubmitEditing={handleJoin}
                className="mt-3 rounded-xl border border-border-soft bg-bg-surface px-4 py-3 text-center text-xl font-bold tracking-[4px] text-text-primary"
              />

              {error ? (
                <Text className="mt-2 text-xs font-medium text-danger">{error}</Text>
              ) : null}

              <Pressable
                onPress={handleJoin}
                disabled={loading || code.trim().length < 4}
                className={`mt-4 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
                  loading || code.trim().length < 4 ? 'opacity-50' : ''
                }`}
              >
                <Check color="white" size={16} />
                <Text className="ml-1.5 text-sm font-bold text-white">
                  {loading ? 'Katılınıyor...' : 'Sınıfa Katıl'}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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
import { X, KeyRound } from 'lucide-react-native';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { auth } from '@/services/firebase';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ChangePasswordSheet({ visible, onClose }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setBusy(false);
      setError(null);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      setError('Hesap bilgisi bulunamadı.');
      return;
    }
    if (next.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalı.');
      return;
    }
    if (next !== confirm) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      onClose();
      Alert.alert('Başarılı', 'Şifren güncellendi.');
    } catch (err) {
      const msg = (err as Error).message.replace('Firebase:', '').trim();
      setError(
        msg.includes('wrong-password') || msg.includes('invalid-credential')
          ? 'Mevcut şifre yanlış.'
          : msg,
      );
    } finally {
      setBusy(false);
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
                  <KeyRound color="#6366F1" size={18} />
                </View>
                <Text className="ml-3 flex-1 text-base font-semibold text-text-primary">
                  Şifre Değiştir
                </Text>
                <Pressable onPress={onClose} hitSlop={10} className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70">
                  <X color="#94A3B8" size={14} />
                </Pressable>
              </View>

              <View className="mt-4 gap-3">
                <TextInput
                  value={current}
                  onChangeText={setCurrent}
                  placeholder="Mevcut şifre"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  className="rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
                />
                <TextInput
                  value={next}
                  onChangeText={setNext}
                  placeholder="Yeni şifre (en az 6 karakter)"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  className="rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
                />
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Yeni şifre (tekrar)"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  className="rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
                />
              </View>

              {error ? <Text className="mt-2 text-xs text-danger">{error}</Text> : null}

              <Pressable
                onPress={handleSubmit}
                disabled={busy}
                className={`mt-4 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
                  busy ? 'opacity-60' : ''
                }`}
              >
                {busy ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-sm font-bold text-white">Güncelle</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

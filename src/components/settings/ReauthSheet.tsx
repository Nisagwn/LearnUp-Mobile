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
} from 'react-native';
import { X, ShieldCheck } from 'lucide-react-native';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@/services/firebase';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirmed: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

export function ReauthSheet({
  visible,
  onClose,
  onConfirmed,
  title = 'Kimliğini doğrula',
  description = 'Devam etmek için şifreni gir.',
  confirmLabel = 'Onayla',
  destructive,
}: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setBusy(false);
      setError(null);
    }
  }, [visible]);

  const handleConfirm = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      setError('Hesap bilgisi bulunamadı.');
      return;
    }
    if (!password) {
      setError('Şifre gerekli.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      await onConfirmed();
      onClose();
    } catch (err) {
      const msg = (err as Error).message.replace('Firebase:', '').trim();
      setError(msg.includes('wrong-password') || msg.includes('invalid-credential') ? 'Şifre yanlış.' : msg);
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
                <View className={`h-10 w-10 items-center justify-center rounded-2xl ${destructive ? 'bg-danger-soft' : 'bg-accent-soft'}`}>
                  <ShieldCheck color={destructive ? '#DC2626' : '#6366F1'} size={18} />
                </View>
                <Text className="ml-3 flex-1 text-base font-semibold text-text-primary">{title}</Text>
                <Pressable onPress={onClose} hitSlop={10} className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70">
                  <X color="#94A3B8" size={14} />
                </Pressable>
              </View>
              <Text className="mt-2 text-sm text-text-muted">{description}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Şifren"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                autoFocus
                className="mt-4 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
              />
              {error ? <Text className="mt-2 text-xs text-danger">{error}</Text> : null}
              <Pressable
                onPress={handleConfirm}
                disabled={busy}
                className={`mt-4 flex-row items-center justify-center rounded-xl py-3 active:opacity-80 ${
                  destructive ? 'bg-danger' : 'bg-accent'
                } ${busy ? 'opacity-60' : ''}`}
              >
                {busy ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-sm font-bold text-white">{confirmLabel}</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

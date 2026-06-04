import { useState } from 'react';
import { Modal, Pressable, View, Text, ActivityIndicator } from 'react-native';
import { Snowflake, X } from 'lucide-react-native';
import { consumeStreakFreeze } from '@/services/gamificationApi';

type Props = {
  visible: boolean;
  freezesAvailable: number;
  onClose: () => void;
  onUsed?: () => void;
};

export function StreakFreezeSheet({ visible, freezesAvailable, onClose, onUsed }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUse = freezesAvailable > 0;

  const handleUse = async () => {
    if (loading || !canUse) return;
    setLoading(true);
    setError(null);
    try {
      await consumeStreakFreeze();
      onUsed?.();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/40">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mt-auto rounded-t-3xl bg-bg-base px-5 pb-8 pt-4"
        >
          <View className="mb-2 self-center h-1 w-12 rounded-full bg-bg-elevated" />
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View
                className="h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: '#DBEAFE' }}
              >
                <Snowflake color="#0EA5E9" size={20} />
              </View>
              <View className="ml-3">
                <Text className="text-base font-bold text-text-primary">Serini Dondur</Text>
                <Text className="text-xs text-text-muted">
                  {freezesAvailable} dondurma hakkın var
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} className="active:opacity-60">
              <X color="#94A3B8" size={20} />
            </Pressable>
          </View>

          <Text className="mt-5 text-sm text-text-secondary">
            Bugün soru çözmesen bile serin bozulmaz. Bu hak bir defaya mahsus kullanılır.
          </Text>

          {error ? (
            <Text className="mt-3 text-xs text-danger">{error}</Text>
          ) : null}

          <Pressable
            onPress={handleUse}
            disabled={!canUse || loading}
            className={`mt-6 items-center rounded-2xl py-3.5 active:opacity-80 ${
              canUse ? 'bg-accent' : 'bg-bg-elevated'
            }`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text
                className={`text-sm font-semibold ${
                  canUse ? 'text-white' : 'text-text-muted'
                }`}
              >
                {canUse ? 'Bugünkü serini dondur' : 'Dondurma hakkın kalmadı'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={onClose}
            className="mt-2 items-center rounded-2xl py-3.5 active:opacity-70"
          >
            <Text className="text-sm font-medium text-text-muted">Vazgeç</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

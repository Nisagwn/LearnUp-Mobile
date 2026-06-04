import { Modal, Pressable, View, Text } from 'react-native';
import { X, Lock } from 'lucide-react-native';
import { getBadgeById } from '@/utils/badges';

type Props = {
  visible: boolean;
  badgeId: string | null;
  unlockedAt?: string | number | { toMillis?: () => number } | null;
  onClose: () => void;
};

function formatDate(value: Props['unlockedAt']): string | null {
  if (!value) return null;
  let ms: number = 0;
  if (typeof value === 'number') ms = value;
  else if (typeof value === 'string') {
    const t = Date.parse(value);
    ms = Number.isNaN(t) ? 0 : t;
  } else if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    try {
      ms = (value as { toMillis: () => number }).toMillis();
    } catch {
      return null;
    }
  }
  if (!ms) return null;
  return new Date(ms).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function BadgeDetailModal({ visible, badgeId, unlockedAt, onClose }: Props) {
  const badge = badgeId ? getBadgeById(badgeId) : null;
  const locked = !unlockedAt;
  const dateStr = formatDate(unlockedAt);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 items-center justify-center bg-black/50 px-6">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-3xl bg-bg-base p-6"
        >
          <View className="flex-row justify-end">
            <Pressable onPress={onClose} hitSlop={10} className="active:opacity-60">
              <X color="#94A3B8" size={20} />
            </Pressable>
          </View>

          {badge ? (
            <>
              <View className="items-center">
                <View
                  className="h-24 w-24 items-center justify-center rounded-3xl"
                  style={{
                    backgroundColor: locked ? '#F1F5F9' : `${badge.color}1A`,
                    borderWidth: 2,
                    borderColor: locked ? '#E2E8F0' : `${badge.color}55`,
                  }}
                >
                  <Text style={{ fontSize: 52, opacity: locked ? 0.4 : 1 }}>{badge.emoji}</Text>
                </View>
                <Text className="mt-4 text-center text-xl font-bold text-text-primary">
                  {badge.name}
                </Text>
                <Text className="mt-1 text-center text-sm text-text-secondary">{badge.desc}</Text>
              </View>

              <View className="mt-5 rounded-2xl bg-bg-surface p-4">
                {locked ? (
                  <View className="flex-row items-center justify-center">
                    <Lock color="#94A3B8" size={14} />
                    <Text className="ml-2 text-xs text-text-muted">Henüz kazanılmadı</Text>
                  </View>
                ) : (
                  <Text className="text-center text-xs text-text-muted">
                    Kazanılma: {dateStr ?? 'tarih bilinmiyor'}
                  </Text>
                )}
              </View>
            </>
          ) : (
            <Text className="text-center text-sm text-text-muted">Rozet bulunamadı.</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import { View, Text } from 'react-native';
import { XCircle } from 'lucide-react-native';
import { MathRenderer } from '@/components/quiz/MathRenderer';
import type { RecentMistake } from '@/services/studentAnalyticsApi';

type Props = {
  items: RecentMistake[];
  emptyText?: string;
};

function relativeTime(tsMs: number): string {
  if (!tsMs) return '';
  const diff = Date.now() - tsMs;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return 'az önce';
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} hafta önce`;
  return new Date(tsMs).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function StudentRecentMistakes({ items, emptyText }: Props) {
  if (items.length === 0) {
    return (
      <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
        <Text className="text-sm text-text-muted">
          {emptyText ?? 'Görüntülenecek yanlış soru bulunmuyor.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {items.map((m) => (
        <View key={m.id} className="rounded-2xl border border-border-soft bg-bg-surface p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <XCircle color="#DC2626" size={12} />
              <Text className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent-fg">
                {m.subject}
                {m.subTopic ? ` · ${m.subTopic}` : ''}
              </Text>
            </View>
            <Text className="text-[10px] text-text-muted">{relativeTime(m.tsMs)}</Text>
          </View>
          <View className="mt-2">
            <MathRenderer content={m.question} fontSize={13} color="#0F172A" />
          </View>
        </View>
      ))}
    </View>
  );
}

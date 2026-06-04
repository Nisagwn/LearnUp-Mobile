import { View, Text } from 'react-native';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';
import type { SubjectAccuracy } from '@/services/studentAnalyticsApi';

type Props = {
  items: SubjectAccuracy[];
  emptyText?: string;
};

function colorFor(accuracy: number): string {
  if (accuracy >= 80) return '#16A34A';
  if (accuracy >= 50) return '#D97706';
  return '#DC2626';
}

export function StudentSubjectBreakdown({ items, emptyText }: Props) {
  if (items.length === 0) {
    return (
      <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
        <Text className="text-sm text-text-muted">
          {emptyText ?? 'Bu öğrenci için ders kırılımı henüz oluşmadı.'}
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4" style={{ gap: 12 }}>
      {items.map((it) => {
        const color = colorFor(it.accuracy);
        return (
          <View key={it.key}>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-sm font-medium text-text-primary" numberOfLines={1}>
                {it.label}
              </Text>
              <Text className="ml-2 text-xs font-bold" style={{ color }}>
                %{it.accuracy}
              </Text>
            </View>
            <View className="mt-1.5">
              <AnimatedProgressBar value={it.accuracy / 100} height={6} fillColor={color} />
            </View>
            <Text className="mt-1 text-[10px] text-text-muted">
              {it.correct} doğru · {it.wrong} yanlış · {it.total} toplam
            </Text>
          </View>
        );
      })}
    </View>
  );
}

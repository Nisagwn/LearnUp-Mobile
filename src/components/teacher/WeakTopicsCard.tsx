import { View, Text } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';

type Props = {
  topics: { subTopic: string; wrongCount: number }[];
};

export function WeakTopicsCard({ topics }: Props) {
  if (topics.length === 0) {
    return (
      <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
        <Text className="text-sm text-text-muted">
          Sınıfın zayıf konu verisi henüz oluşmadı — öğrenciler quiz çözdükçe burada görünecek.
        </Text>
      </View>
    );
  }

  const max = Math.max(...topics.map((t) => t.wrongCount), 1);

  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4" style={{ gap: 12 }}>
      {topics.map((t) => (
        <View key={t.subTopic}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center">
              <AlertTriangle color="#DC2626" size={13} />
              <Text className="ml-1.5 flex-1 text-sm font-medium text-text-primary" numberOfLines={1}>
                {t.subTopic}
              </Text>
            </View>
            <Text className="ml-2 text-xs font-bold text-danger">{t.wrongCount} yanlış</Text>
          </View>
          <View className="mt-1.5">
            <AnimatedProgressBar value={t.wrongCount / max} height={5} fillColor="#DC2626" />
          </View>
        </View>
      ))}
    </View>
  );
}

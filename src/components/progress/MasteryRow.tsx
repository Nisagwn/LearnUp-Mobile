import { Pressable, View, Text } from 'react-native';
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react-native';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';

type Trend = 'up' | 'down' | 'flat';

type Props = {
  subject: string;
  score: number; // 0..100
  trend?: Trend;
  weakSubTopic?: string;
  avgSeconds?: number;
  onPress?: () => void;
  dim?: boolean;
};

function masteryColor(score: number): string {
  if (score >= 80) return '#16A34A';
  if (score >= 50) return '#F59E0B';
  return '#FB923C';
}

function TrendBadge({ trend }: { trend?: Trend }) {
  if (trend === 'up') {
    return (
      <View className="flex-row items-center rounded-full bg-success-soft px-2 py-0.5">
        <TrendingUp color="#16A34A" size={12} />
        <Text className="ml-1 text-[10px] font-semibold text-success">Yükseliş</Text>
      </View>
    );
  }
  if (trend === 'down') {
    return (
      <View className="flex-row items-center rounded-full bg-danger-soft px-2 py-0.5">
        <TrendingDown color="#DC2626" size={12} />
        <Text className="ml-1 text-[10px] font-semibold text-danger">Düşüş</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center rounded-full bg-bg-elevated px-2 py-0.5">
      <Minus color="#94A3B8" size={12} />
      <Text className="ml-1 text-[10px] font-semibold text-text-muted">Sabit</Text>
    </View>
  );
}

export function MasteryRow({ subject, score, trend, weakSubTopic, avgSeconds, onPress, dim }: Props) {
  const color = masteryColor(score);

  return (
    <Pressable
      onPress={onPress}
      className={`rounded-2xl border border-border-soft bg-bg-surface p-4 active:bg-bg-elevated ${
        dim ? 'opacity-50' : ''
      }`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-sm font-semibold text-text-primary" numberOfLines={1}>
          {subject}
        </Text>
        <TrendBadge trend={trend} />
        <Text className="ml-2 text-sm font-bold" style={{ color }}>
          %{score}
        </Text>
        <ChevronRight color="#94A3B8" size={16} />
      </View>

      <View className="mt-3">
        <AnimatedProgressBar value={score / 100} fillColor={color} height={6} />
      </View>

      <View className="mt-2 flex-row items-center gap-2">
        {weakSubTopic ? (
          <View className="rounded-full bg-bg-elevated px-2 py-0.5">
            <Text className="text-[10px] text-text-muted" numberOfLines={1}>
              Zayıf: {weakSubTopic}
            </Text>
          </View>
        ) : null}
        {avgSeconds && avgSeconds > 0 ? (
          <Text className="text-[10px] text-text-muted">~{avgSeconds} sn/soru</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

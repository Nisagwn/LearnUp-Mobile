import { Pressable, View, Text } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';

export type SubTopicStat = {
  subTopic: string;
  accuracy: number; // 0..100
  solved: number;
  dueCount?: number;
};

type Props = {
  items: SubTopicStat[];
  onItemPress?: (subTopic: string) => void;
};

function color(accuracy: number): string {
  if (accuracy >= 80) return '#16A34A';
  if (accuracy >= 50) return '#F59E0B';
  return '#F472B6';
}

export function SubTopicMasteryList({ items, onItemPress }: Props) {
  if (items.length === 0) {
    return (
      <Text className="text-xs text-text-muted">
        Bu ders için henüz alt konu verisi yok.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {items.map((item) => (
        <Pressable
          key={item.subTopic}
          onPress={() => onItemPress?.(item.subTopic)}
          className="rounded-xl border border-border-soft bg-bg-base p-3 active:bg-bg-elevated"
        >
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-sm font-medium text-text-primary" numberOfLines={1}>
              {item.subTopic}
            </Text>
            {item.dueCount && item.dueCount > 0 ? (
              <View className="mr-2 rounded-full bg-warning-soft px-2 py-0.5">
                <Text className="text-[10px] font-semibold text-warning">
                  {item.dueCount} tekrar
                </Text>
              </View>
            ) : null}
            <Text className="text-sm font-bold" style={{ color: color(item.accuracy) }}>
              %{item.accuracy}
            </Text>
            <ChevronRight color="#94A3B8" size={16} />
          </View>
          <View className="mt-2">
            <AnimatedProgressBar value={item.accuracy / 100} fillColor={color(item.accuracy)} height={5} />
          </View>
          <Text className="mt-1 text-[10px] text-text-muted">{item.solved} soru çözüldü</Text>
        </Pressable>
      ))}
    </View>
  );
}

import { Pressable, View, Text } from 'react-native';
import { Trophy, ChevronRight } from 'lucide-react-native';

type Props = {
  rank: number | null;
  total: number | null;
  loading?: boolean;
  onPress?: () => void;
};

function ordinal(n: number): string {
  return `${n}.`;
}

export function ClassRankRow({ rank, total, loading, onPress }: Props) {
  if (loading) {
    return (
      <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
        <Text className="text-xs text-text-muted">Sıralama yükleniyor…</Text>
      </View>
    );
  }
  if (!rank || !total) return null;

  const isTop = rank <= 3;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-2xl border border-border-soft bg-bg-surface p-4 active:bg-bg-elevated"
    >
      <View className="flex-row items-center">
        <View
          className="h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: isTop ? '#FEF3C7' : '#DCFCE7' }}
        >
          <Trophy color={isTop ? '#D97706' : '#16A34A'} size={18} />
        </View>
        <View className="ml-3">
          <Text className="text-xs text-text-muted">Sınıf Sıralaması</Text>
          <Text className="text-sm font-semibold text-text-primary">
            {ordinal(rank)} <Text className="text-text-muted">/ {total}</Text>
          </Text>
        </View>
      </View>
      <ChevronRight color="#94A3B8" size={18} />
    </Pressable>
  );
}

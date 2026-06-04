import { useMemo } from 'react';
import { Pressable, View, Text } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { SectionHeader } from '@/components/common/SectionHeader';

type Day = {
  name?: string;
  date?: string;
  Doğru?: number;
  Yanlış?: number;
  Boş?: number;
};

type Props = {
  data: Day[];
  onPress?: () => void;
};

const COLORS = {
  correct: '#16A34A',
  wrong: '#DC2626',
  empty: '#CBD5E1',
};

export function WeeklyChart({ data, onPress }: Props) {
  const { stackData, totalSolved, maxValue } = useMemo(() => {
    let total = 0;
    let max = 4;
    const stacks = data.map((d) => {
      const c = d['Doğru'] ?? 0;
      const w = d['Yanlış'] ?? 0;
      const s = d['Boş'] ?? 0;
      const sum = c + w + s;
      total += sum;
      if (sum > max) max = sum;
      return {
        label: d.name ?? '',
        stacks: [
          { value: c, color: COLORS.correct },
          { value: w, color: COLORS.wrong },
          { value: s, color: COLORS.empty },
        ],
      };
    });
    const rounded = Math.max(4, Math.ceil(max / 4) * 4);
    return { stackData: stacks, totalSolved: total, maxValue: rounded };
  }, [data]);

  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <SectionHeader
        title="Bu Hafta"
        actionLabel={onPress ? 'Detay' : undefined}
        onActionPress={onPress}
      />
      <View className="mt-3 rounded-2xl border border-border-soft bg-bg-surface p-4">
        {totalSolved === 0 ? (
          <View className="items-center py-8">
            <Text className="text-sm text-text-muted">Bu hafta henüz soru çözmedin</Text>
            <Text className="mt-1 text-xs text-text-muted">
              İlk soruyla grafik canlanacak
            </Text>
          </View>
        ) : (
          <>
            <View className="flex-row items-center">
              <Text className="text-2xl font-bold text-text-primary">{totalSolved}</Text>
              <Text className="ml-2 text-xs text-text-muted">son 7 günde çözüldü</Text>
            </View>
            <View className="mt-3">
              <BarChart
                stackData={stackData}
                width={280}
                height={120}
                barWidth={22}
                spacing={14}
                initialSpacing={6}
                endSpacing={6}
                noOfSections={4}
                maxValue={maxValue}
                hideRules
                hideYAxisText
                xAxisColor="#E2E8F0"
                yAxisColor="transparent"
                xAxisLabelTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                disableScroll
              />
            </View>
            <View className="mt-3 flex-row gap-4">
              <Legend color={COLORS.correct} label="Doğru" />
              <Legend color={COLORS.wrong} label="Yanlış" />
              <Legend color={COLORS.empty} label="Boş" />
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center">
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text className="ml-1.5 text-xs text-text-muted">{label}</Text>
    </View>
  );
}

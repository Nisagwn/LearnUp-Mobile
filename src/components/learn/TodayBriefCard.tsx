import { View, Text } from 'react-native';
import { Check, Clock, Target, Zap } from 'lucide-react-native';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';

type Props = {
  solvedToday: number;
  correctToday: number;
  timeSpentTodayMs: number;
  dailyTarget?: number;
};

function formatDuration(ms: number): string {
  if (!ms || ms < 1000) return '0 dk';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '<1 dk';
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours} sa ${rem} dk` : `${hours} sa`;
}

export function TodayBriefCard({
  solvedToday,
  correctToday,
  timeSpentTodayMs,
  dailyTarget,
}: Props) {
  const accuracy = solvedToday > 0 ? Math.round((correctToday / solvedToday) * 100) : 0;
  const hasTarget = typeof dailyTarget === 'number' && dailyTarget > 0;
  const targetRatio = hasTarget ? Math.min(1, solvedToday / dailyTarget) : 0;
  const remaining = hasTarget ? Math.max(0, dailyTarget - solvedToday) : 0;

  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs uppercase tracking-wide text-text-muted">Bugün</Text>
        {hasTarget ? (
          <View className="flex-row items-center rounded-full bg-accent-soft px-2 py-0.5">
            <Target color="#15803D" size={11} />
            <Text className="ml-1 text-[10px] font-semibold text-accent-fg">
              {remaining > 0 ? `${remaining} soru kaldı` : 'Hedef tamam!'}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-3 flex-row items-stretch">
        <View className="flex-1 items-start">
          <View className="flex-row items-center">
            <Zap color="#16A34A" size={12} />
            <Text className="ml-1 text-[10px] font-medium text-text-muted">Çözülen</Text>
          </View>
          <Text className="mt-1 text-lg font-bold text-text-primary">{solvedToday}</Text>
        </View>
        <View className="mx-2 w-px bg-border-soft" />
        <View className="flex-1 items-start">
          <View className="flex-row items-center">
            <Check color="#16A34A" size={12} />
            <Text className="ml-1 text-[10px] font-medium text-text-muted">Doğru oranı</Text>
          </View>
          <Text className="mt-1 text-lg font-bold text-text-primary">
            {solvedToday > 0 ? `%${accuracy}` : '—'}
          </Text>
        </View>
        <View className="mx-2 w-px bg-border-soft" />
        <View className="flex-1 items-start">
          <View className="flex-row items-center">
            <Clock color="#D97706" size={12} />
            <Text className="ml-1 text-[10px] font-medium text-text-muted">Süre</Text>
          </View>
          <Text className="mt-1 text-lg font-bold text-text-primary">
            {formatDuration(timeSpentTodayMs)}
          </Text>
        </View>
      </View>

      {hasTarget ? (
        <View className="mt-3">
          <AnimatedProgressBar value={targetRatio} height={5} fillColor="#16A34A" />
        </View>
      ) : null}
    </View>
  );
}

import { Pressable, View, Text } from 'react-native';
import { PlayCircle, ChevronRight, Check, X } from 'lucide-react-native';

type Props = {
  subject: string;
  lastSolvedAtMs: number;
  subTopic?: string | null;
  correctCount?: number;
  wrongCount?: number;
  onPress?: () => void;
};

function relativeTime(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  if (diff < 0) return 'az önce';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

export function ContinueLearningCard({
  subject,
  lastSolvedAtMs,
  subTopic,
  correctCount,
  wrongCount,
  onPress,
}: Props) {
  const showStats =
    (typeof correctCount === 'number' && correctCount > 0) ||
    (typeof wrongCount === 'number' && wrongCount > 0);

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-accent/30 bg-accent-soft p-4 active:opacity-90"
    >
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent">
          <PlayCircle color="white" size={20} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-xs text-text-muted">Kaldığın yer · {relativeTime(lastSolvedAtMs)}</Text>
          <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
            {subject}
            {subTopic ? ` — ${subTopic}` : ''}
          </Text>
        </View>
        <ChevronRight color="#15803D" size={18} />
      </View>

      {showStats ? (
        <View className="mt-3 flex-row items-center" style={{ gap: 8 }}>
          {typeof correctCount === 'number' && correctCount > 0 ? (
            <View className="flex-row items-center rounded-full bg-success-soft px-2 py-0.5">
              <Check color="#16A34A" size={11} />
              <Text className="ml-1 text-[10px] font-semibold text-success">
                {correctCount} doğru
              </Text>
            </View>
          ) : null}
          {typeof wrongCount === 'number' && wrongCount > 0 ? (
            <View className="flex-row items-center rounded-full bg-danger-soft px-2 py-0.5">
              <X color="#DC2626" size={11} />
              <Text className="ml-1 text-[10px] font-semibold text-danger">
                {wrongCount} yanlış
              </Text>
            </View>
          ) : null}
          <Text className="text-[10px] text-text-muted">son seansta</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

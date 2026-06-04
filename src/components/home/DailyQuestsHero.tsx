import { useEffect, useMemo, useState } from 'react';
import { Pressable, View, Text, ActivityIndicator } from 'react-native';
import { Target, Check, Gift } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { claimQuestReward } from '@/services/gamificationApi';

type Quest = {
  id: string;
  templateId?: string;
  type?: string;
  emoji?: string;
  title?: string;
  subject?: string | null;
  target: number;
  progress: number;
  rewardXP: number;
  claimed?: boolean;
};

type Props = {
  quests: Quest[];
  onPress?: () => void;
  onClaimed?: () => void;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function DailyQuestsHero({ quests, onPress, onClaimed }: Props) {
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const total = quests.length;
    const claimed = quests.filter((q) => q.claimed).length;
    const completable = quests.filter((q) => q.progress >= q.target && !q.claimed).length;
    return { total, claimed, completable };
  }, [quests]);

  if (!quests.length) return null;

  const handleClaim = async (quest: Quest) => {
    if (claimingId) return;
    setClaimingId(quest.id);
    try {
      await claimQuestReward(quest.id);
      onClaimed?.();
    } catch {
      // sessiz başarısızlık — kullanıcı tekrar deneyebilir
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-3xl border border-accent/30 bg-accent-soft p-4 active:opacity-90"
    >
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent">
          <Target color="white" size={20} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-xs text-text-muted">Günlük Görevler</Text>
          <Text className="text-sm font-semibold text-text-primary">
            {summary.claimed === summary.total
              ? 'Hepsi tamamlandı 🎉'
              : `${summary.claimed}/${summary.total} tamamlandı${
                  summary.completable > 0 ? ` · ${summary.completable} ödül seni bekliyor` : ''
                }`}
          </Text>
        </View>
      </View>

      <View className="mt-3 gap-2">
        {quests.map((q) => (
          <QuestRow
            key={q.id}
            quest={q}
            claiming={claimingId === q.id}
            onClaim={() => handleClaim(q)}
          />
        ))}
      </View>
    </Pressable>
  );
}

function QuestRow({
  quest,
  claiming,
  onClaim,
}: {
  quest: Quest;
  claiming: boolean;
  onClaim: () => void;
}) {
  const ratio = clamp01(quest.progress / Math.max(1, quest.target));
  const done = quest.progress >= quest.target;
  const wasDone = useSharedValue(done);
  const checkScale = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    if (done && wasDone.value === false) {
      checkScale.value = withSequence(
        withSpring(1.2, { damping: 6 }),
        withSpring(1, { damping: 10 }),
      );
    } else if (!done) {
      checkScale.value = withTiming(0, { duration: 150 });
    }
    wasDone.value = done;
  }, [done, checkScale, wasDone]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  return (
    <View
      className="rounded-2xl bg-white/80 p-3"
      style={{ borderWidth: 1, borderColor: done ? '#86EFAC' : '#E0E7FF' }}
    >
      <View className="flex-row items-center">
        <Text style={{ fontSize: 18 }}>{quest.emoji ?? '✨'}</Text>
        <Text
          className="ml-2 flex-1 text-sm font-medium text-text-primary"
          numberOfLines={1}
        >
          {quest.title ?? 'Görev'}
        </Text>
        <Text className="text-xs font-semibold text-text-muted">
          {quest.progress}/{quest.target}
        </Text>
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
        <View
          className={done ? 'h-full bg-success' : 'h-full bg-accent'}
          style={{ width: `${ratio * 100}%` }}
        />
      </View>
      {done ? (
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-success">+{quest.rewardXP} XP</Text>
          {quest.claimed ? (
            <View className="flex-row items-center">
              <Animated.View style={checkStyle}>
                <Check color="#16A34A" size={14} />
              </Animated.View>
              <Text className="ml-1 text-xs text-success">Alındı</Text>
            </View>
          ) : (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onClaim();
              }}
              disabled={claiming}
              className="flex-row items-center rounded-full bg-success px-3 py-1 active:opacity-80"
              hitSlop={6}
            >
              {claiming ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Gift color="white" size={12} />
                  <Text className="ml-1 text-xs font-semibold text-white">Ödülü Al</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

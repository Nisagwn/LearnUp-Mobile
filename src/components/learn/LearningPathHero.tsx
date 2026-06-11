import { Pressable, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Target, ChevronRight, Shuffle, Clock, Sparkles } from 'lucide-react-native';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';

type Props = {
  subject: string | null;
  progress?: number;
  target?: number;
  source: 'dailyQuest' | 'weakTopic' | 'general';
  subTopic?: string | null;
  estimatedMinutes?: number;
  onContinue?: () => void;
  onShuffle?: () => void;
};

export function LearningPathHero({
  subject,
  progress = 0,
  target = 0,
  source,
  subTopic,
  estimatedMinutes,
  onContinue,
  onShuffle,
}: Props) {
  const showProgress = source === 'dailyQuest' && target > 0;
  const ratio = target > 0 ? Math.min(1, progress / target) : 0;

  const title = (() => {
    if (!subject) return 'Bugün hangi konuya başlamak istersin?';
    if (source === 'dailyQuest') return `Bugünkü hedef: ${subject}`;
    if (source === 'weakTopic') return `Zayıf alanın: ${subject}`;
    return `${subject} ile devam et`;
  })();

  const subtitle = (() => {
    if (!subject) return 'Aşağıdaki derslerden birini seç';
    if (source === 'dailyQuest') return `${progress}/${target} tamamlandı`;
    if (source === 'weakTopic') return 'Bu konuya odaklan, mastery yükselsin';
    return 'Bir tur quiz çöz';
  })();

  return (
    <View className="overflow-hidden rounded-3xl">
      <LinearGradient
        colors={['#16A34A', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24 }}
        className="p-5"
      >
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <Target color="white" size={24} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-xs uppercase tracking-wide text-white/80">Öğrenme yolun</Text>
            <Text className="text-base font-semibold text-white" numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>

        {showProgress ? (
          <View className="mt-4">
            <AnimatedProgressBar
              value={ratio}
              height={8}
              fillColor="#FFFFFF"
              trackClassName="bg-white/20"
            />
            <Text className="mt-1.5 text-xs text-white/85">{subtitle}</Text>
          </View>
        ) : (
          <Text className="mt-3 text-xs text-white/85">{subtitle}</Text>
        )}

        {subTopic || (estimatedMinutes && estimatedMinutes > 0) ? (
          <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 6 }}>
            {subTopic ? (
              <View className="flex-row items-center rounded-full bg-white/15 px-2.5 py-1">
                <Sparkles color="white" size={11} />
                <Text className="ml-1 text-[11px] font-semibold text-white" numberOfLines={1}>
                  {subTopic}
                </Text>
              </View>
            ) : null}
            {estimatedMinutes && estimatedMinutes > 0 ? (
              <View className="flex-row items-center rounded-full bg-white/15 px-2.5 py-1">
                <Clock color="white" size={11} />
                <Text className="ml-1 text-[11px] font-semibold text-white">
                  ~{estimatedMinutes} dk
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {subject && (onContinue || onShuffle) ? (
          <View className="mt-4 flex-row gap-2">
            {onContinue ? (
              <Pressable
                onPress={onContinue}
                className="flex-1 flex-row items-center justify-center rounded-xl bg-white py-2.5 active:opacity-80"
              >
                <Text className="text-xs font-bold text-accent-fg">Devam Et</Text>
                <ChevronRight color="#15803D" size={14} />
              </Pressable>
            ) : null}
            {onShuffle ? (
              <Pressable
                onPress={onShuffle}
                className="flex-row items-center justify-center rounded-xl border border-white/40 px-3.5 py-2.5 active:opacity-80"
              >
                <Shuffle color="white" size={14} />
                <Text className="ml-1.5 text-xs font-semibold text-white">Karıştır</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

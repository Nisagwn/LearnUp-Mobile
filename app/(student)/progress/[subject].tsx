import { useContext, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { ChevronLeft, TrendingUp, TrendingDown, Minus, Clock, Play } from 'lucide-react-native';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { categorize, type SRSCard } from '@/utils/srs';
import { subjectLabelTR } from '@/utils/subjects';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';
import { SectionHeader } from '@/components/common/SectionHeader';
import { SubTopicMasteryList, type SubTopicStat } from '@/components/progress/SubTopicMasteryList';

type LogEntry = {
  subject?: string;
  category?: string;
  sub_topic?: string;
  isCorrect?: boolean;
  isSkipped?: boolean;
  skipped?: boolean;
  timestamp?: { toDate?: () => Date } | Date | string | number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function logDate(ts: LogEntry['timestamp']): Date {
  if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate();
  }
  if (ts instanceof Date) return ts;
  return new Date(ts as string | number);
}

function masteryColor(score: number): string {
  if (score >= 80) return '#16A34A';
  if (score >= 50) return '#F59E0B';
  return '#F472B6';
}

export default function SubjectDetailScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ subject: string }>();
  const subject = decodeURIComponent(
    Array.isArray(params.subject) ? params.subject[0] : params.subject ?? '',
  );
  const lower = subject.toLowerCase();
  const subjectLabel = subjectLabelTR(subject);

  const ctx = useContext(UserStatsContext);
  const masteryScores: Record<string, { solved_count?: number; score?: number }> =
    ctx?.masteryScores ?? {};
  const subjectTrends: Record<string, 'up' | 'down' | 'flat'> = ctx?.subjectTrends ?? {};
  const avgSecondsPerSubject: Record<string, number> = ctx?.avgSecondsPerSubject ?? {};
  const srsCards: SRSCard[] = ctx?.srsCards ?? [];
  const answersLog: LogEntry[] = ctx?.answersLog ?? [];

  // Ders büyük/küçük harf varyantlarını birleştirerek ustalık puanını bul.
  const mastery = useMemo(() => {
    let solved = 0;
    let scoreSum = 0;
    Object.entries(masteryScores).forEach(([key, m]) => {
      if (key.trim().toLowerCase() !== lower) return;
      const s = m.solved_count ?? 0;
      solved += s;
      scoreSum += (m.score ?? 0) * s;
    });
    return { solved_count: solved, score: solved > 0 ? Math.round(scoreSum / solved) : 0 };
  }, [masteryScores, lower]);
  const score = mastery.score;
  const trend = subjectTrends[lower];
  const avgSeconds = avgSecondsPerSubject[lower];

  const subjectLogs = useMemo(
    () => answersLog.filter((a) => (a.subject || a.category || 'Genel').toLowerCase() === lower),
    [answersLog, lower],
  );

  // 14 günlük günlük başarı serisi (% doğru). Veri olmayan günler 0.
  const trendSeries = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days: { value: number; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(today.getTime() - i * DAY_MS);
      const correct = subjectLogs.filter((a) => {
        const d = logDate(a.timestamp);
        return (
          d.getFullYear() === day.getFullYear() &&
          d.getMonth() === day.getMonth() &&
          d.getDate() === day.getDate()
        );
      });
      const total = correct.length;
      const c = correct.filter((a) => a.isCorrect === true).length;
      days.push({
        value: total > 0 ? Math.round((c / total) * 100) : 0,
        label: i % 3 === 0 ? `${day.getDate()}` : '',
      });
    }
    return days;
  }, [subjectLogs]);

  // Alt konu kırılımı — doğruluk ve çözüm sayısı + SRS tekrar sayısı.
  const subTopics = useMemo<SubTopicStat[]>(() => {
    const map = new Map<string, { solved: number; correct: number }>();
    subjectLogs.forEach((a) => {
      const st = a.sub_topic || subject || 'Genel';
      const cur = map.get(st) ?? { solved: 0, correct: 0 };
      cur.solved += 1;
      if (a.isCorrect === true) cur.correct += 1;
      map.set(st, cur);
    });

    const now = Date.now();
    const dueBySubTopic = new Map<string, number>();
    srsCards
      .filter((c) => c.subject.toLowerCase() === lower)
      .forEach((c) => {
        const cat = categorize(c, now);
        if (cat !== 'new' && cat !== 'review') return;
        const st = c.sub_topic || subject;
        dueBySubTopic.set(st, (dueBySubTopic.get(st) ?? 0) + 1);
      });

    return Array.from(map.entries())
      .map(([subTopic, v]) => ({
        subTopic,
        solved: v.solved,
        accuracy: v.solved > 0 ? Math.round((v.correct / v.solved) * 100) : 0,
        dueCount: dueBySubTopic.get(subTopic) ?? 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [subjectLogs, srsCards, lower, subject]);

  const hasData = subjectLogs.length > 0;
  const chartWidth = Math.max(width - 80, 280);
  const color = masteryColor(score);

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="flex-row items-center px-5 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="mr-3 active:opacity-60">
          <ChevronLeft color="#0F172A" size={26} />
        </Pressable>
        <Text className="flex-1 text-2xl font-bold text-text-primary" numberOfLines={1}>
          {subjectLabel}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="mt-6 px-5">
          <View className="rounded-2xl border border-border-soft bg-bg-surface p-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-text-muted">Genel Ustalık</Text>
              <View className="flex-row items-center">
                {trend === 'up' ? (
                  <TrendingUp color="#16A34A" size={16} />
                ) : trend === 'down' ? (
                  <TrendingDown color="#DC2626" size={16} />
                ) : (
                  <Minus color="#94A3B8" size={16} />
                )}
              </View>
            </View>
            <Text className="mt-1 text-4xl font-bold" style={{ color }}>
              %{score}
            </Text>
            <View className="mt-3">
              <AnimatedProgressBar value={score / 100} fillColor={color} height={8} />
            </View>
            <View className="mt-3 flex-row items-center gap-4">
              <Text className="text-xs text-text-muted">{mastery.solved_count ?? 0} soru çözüldü</Text>
              {avgSeconds && avgSeconds > 0 ? (
                <View className="flex-row items-center">
                  <Clock color="#94A3B8" size={12} />
                  <Text className="ml-1 text-xs text-text-muted">~{avgSeconds} sn/soru</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {hasData ? (
          <View className="mt-8 px-5">
            <SectionHeader title="Son 14 gün başarı %" />
            <View className="mt-3 rounded-2xl border border-border-soft bg-bg-surface p-4">
              <LineChart
                data={trendSeries}
                width={chartWidth}
                height={160}
                color="#6366F1"
                thickness={2}
                dataPointsColor="#6366F1"
                yAxisTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                yAxisColor="#E2E8F0"
                xAxisColor="#E2E8F0"
                rulesColor="#F1F5F9"
                maxValue={100}
                noOfSections={4}
              />
            </View>
          </View>
        ) : null}

        <View className="mt-8 px-5">
          <SectionHeader title="Alt Konular" />
          <View className="mt-3">
            <SubTopicMasteryList items={subTopics} />
          </View>
        </View>

        <View className="mt-8 px-5">
          <Pressable
            onPress={() => router.push(`/(student)/quiz/${lower}` as never)}
            className="flex-row items-center justify-center rounded-2xl bg-accent py-4 active:opacity-90"
          >
            <Play color="white" size={18} />
            <Text className="ml-2 text-base font-semibold text-white">Bu dersi çalış</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { Flame, Target, TrendingUp, CheckCircle2, BarChart3, Play } from 'lucide-react-native';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { ProgressBackground } from '@/components/progress/ProgressBackground';
import { buildStudyPlan, type StudyTask } from '@/utils/studyPlan';
import { pickTopForRetake } from '@/services/srsApi';
import { ChatFAB } from '@/components/common/ChatFAB';
import { SectionHeader } from '@/components/common/SectionHeader';
import { StatTile } from '@/components/common/StatTile';
import { EmptyState } from '@/components/common/EmptyState';
import { lottie } from '@/constants/lottie';
import { SegmentedTabs } from '@/components/common/SegmentedTabs';
import { LeagueCard } from '@/components/home/LeagueCard';
import { BadgeStrip } from '@/components/home/BadgeStrip';
import { ClassRankRow } from '@/components/home/ClassRankRow';
import { StudyPlanCard } from '@/components/progress/StudyPlanCard';
import { MasteryRow } from '@/components/progress/MasteryRow';
import { ConsistencyHeatmap } from '@/components/progress/ConsistencyHeatmap';
import { resolveSubject } from '@/utils/subjects';
import { getStudentJoinedClasses, getTeacherInfo } from '@/services/classApi';

const PERF_TABS = [
  { id: 'weekly', label: 'Haftalık' },
  { id: 'monthly', label: 'Aylık' },
] as const;

function startRetake(router: ReturnType<typeof useRouter>, cards: ReturnType<typeof pickTopForRetake>) {
  const payload = cards
    .filter((c) => c.snapshot && c.snapshot.question && c.snapshot.choices.length > 0)
    .map((c) => ({
      question: c.snapshot!.question,
      choices: c.snapshot!.choices,
      answer: c.snapshot!.answer,
      subject: c.subject,
    }));
  if (payload.length === 0) return false;
  const encoded = encodeURIComponent(JSON.stringify(payload));
  router.push(`/(student)/quiz/retake?payload=${encoded}` as never);
  return true;
}

export default function ProgressScreen() {
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const ctx = useContext(UserStatsContext);

  const stats = ctx?.stats;
  const masteryScores: Record<string, { solved_count?: number; score?: number }> =
    ctx?.masteryScores ?? {};
  const subjectTrends: Record<string, 'up' | 'down' | 'flat'> = ctx?.subjectTrends ?? {};
  const weakSubTopicBySubject: Record<string, { subTopic: string; wrongCount: number }> =
    ctx?.weakSubTopicBySubject ?? {};
  const avgSecondsPerSubject: Record<string, number> = ctx?.avgSecondsPerSubject ?? {};
  const srsCards = ctx?.srsCards ?? [];
  const dailyActivity = ctx?.dailyActivity ?? [];
  const weeklyData = ctx?.weeklyData ?? [];
  const monthlyData = ctx?.monthlyData ?? [];
  const gamification = ctx?.gamification;
  const userProfile = ctx?.userProfile;
  const loading = ctx?.loading ?? false;
  const currentUser = ctx?.currentUser;
  const loadClassRanking = ctx?.loadClassRanking;

  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');

  // ── Sınıf sıralaması: katıldığın sınıflar arasından seç (aktif sınıfı DEĞİŞTİRMEDEN) ──
  const joinedClasses = useMemo(
    () => getStudentJoinedClasses(userProfile),
    [userProfile],
  );
  const primaryTeacherId: string | null = userProfile?.teacherId ?? null;
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const activeTeacherId = selectedTeacherId ?? primaryTeacherId;
  const [branchMap, setBranchMap] = useState<Record<string, string | null>>({});
  const [selectedRanking, setSelectedRanking] = useState<
    { rank: number | null; total: number | null; loading?: boolean } | null
  >(null);

  // Öğretmen branşlarını çöz ("Matematik sınıfı" etiketi için)
  useEffect(() => {
    const missing = joinedClasses.filter((c) => !(c.teacherId in branchMap));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(
          async (c) =>
            [c.teacherId, (await getTeacherInfo(c.teacherId))?.branch ?? null] as const,
        ),
      );
      if (cancelled) return;
      setBranchMap((prev) => {
        const next = { ...prev };
        for (const [id, b] of entries) next[id] = b;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [joinedClasses, branchMap]);

  // Seçili sınıfın sıralamasını izole yükle (paylaşılan/ana sayfa sıralamasını bozmadan)
  useEffect(() => {
    if (!activeTeacherId || !currentUser?.uid || !loadClassRanking) {
      setSelectedRanking(null);
      return;
    }
    let cancelled = false;
    setSelectedRanking((prev) => ({
      rank: prev?.rank ?? null,
      total: prev?.total ?? null,
      loading: true,
    }));
    (async () => {
      const r = await loadClassRanking(currentUser.uid, activeTeacherId, { setShared: false });
      if (!cancelled) setSelectedRanking(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTeacherId, currentUser?.uid, loadClassRanking]);

  const classLabel = (c: { teacherId: string; teacherName: string }) => {
    const branch = branchMap[c.teacherId];
    const base =
      (branch && branch.trim()) ||
      (c.teacherName && c.teacherName !== 'Öğretmen' ? c.teacherName : null) ||
      'Sınıf';
    return `${base} sınıfı`;
  };

  const tasks = useMemo(
    () =>
      buildStudyPlan({
        srsCards,
        masteryScores,
        subjectTrends,
        weakSubTopicBySubject,
        avgSecondsPerSubject,
        nowMs: Date.now(),
      }),
    [srsCards, masteryScores, subjectTrends, weakSubTopicBySubject, avgSecondsPerSubject],
  );

  // Dersleri Türkçe kanonik ada indirip birleştir: "Mathematics" + "math" +
  // "Matematik" → tek "Matematik" satırı. Müfredat dersi olmayan özel AI
  // konuları (örn. "logaritma türevleri") Ders Ustalığı listesine alınmaz.
  const masteryRows = useMemo(() => {
    const merged: Record<
      string,
      { subject: string; routeSubject: string; solved_count: number; scoreSum: number }
    > = {};
    Object.entries(masteryScores).forEach(([subject, m]) => {
      const resolved = resolveSubject(subject);
      if (!resolved.canonical) return; // müfredat dışı (özel AI konusu) → listeye alma
      const solved = m.solved_count ?? 0;
      if (!merged[resolved.key]) {
        // routeSubject: navigasyon/veri eşleşmesi orijinal (İngilizce) adla yapılır;
        // görünen etiket Türkçe (resolved.label).
        merged[resolved.key] = {
          subject: resolved.label,
          routeSubject: subject,
          solved_count: 0,
          scoreSum: 0,
        };
      }
      merged[resolved.key].solved_count += solved;
      merged[resolved.key].scoreSum += (m.score ?? 0) * solved;
    });
    return Object.entries(merged)
      .map(([key, m]) => ({
        key,
        subject: m.subject,
        routeSubject: m.routeSubject,
        solved_count: m.solved_count,
        score: m.solved_count > 0 ? Math.round(m.scoreSum / m.solved_count) : 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, [masteryScores]);

  // Trend / zayıf alt-konu / ortalama süre haritaları ham ders adıyla (örn.
  // "mathematics") anahtarlı; kanonik anahtara (örn. "matematik") indir ki
  // MasteryRow lookup'ları eşleşsin.
  const trendsByKey = useMemo(() => {
    const out: Record<string, 'up' | 'down' | 'flat'> = {};
    Object.entries(subjectTrends).forEach(([s, v]) => {
      const r = resolveSubject(s);
      if (r.canonical) out[r.key] = v as 'up' | 'down' | 'flat';
    });
    return out;
  }, [subjectTrends]);

  const weakByKey = useMemo(() => {
    const out: Record<string, { subTopic: string; wrongCount: number }> = {};
    Object.entries(weakSubTopicBySubject).forEach(([s, v]) => {
      const r = resolveSubject(s);
      if (!r.canonical || !v) return;
      const cur = out[r.key];
      if (!cur || (v.wrongCount ?? 0) > cur.wrongCount) out[r.key] = v;
    });
    return out;
  }, [weakSubTopicBySubject]);

  const avgSecByKey = useMemo(() => {
    const out: Record<string, number> = {};
    Object.entries(avgSecondsPerSubject).forEach(([s, v]) => {
      const r = resolveSubject(s);
      if (r.canonical && typeof v === 'number') out[r.key] = v;
    });
    return out;
  }, [avgSecondsPerSubject]);

  const weeklyChart = useMemo(
    () =>
      weeklyData.flatMap((d: { name?: string; ['Doğru']?: number; ['Yanlış']?: number }) => [
        { value: d['Doğru'] ?? 0, label: d.name ?? '', frontColor: '#16A34A', spacing: 2 },
        { value: d['Yanlış'] ?? 0, frontColor: '#DC2626', spacing: 12 },
      ]),
    [weeklyData],
  );

  const monthlyChart = useMemo(
    () => monthlyData.map((d: { name?: string; value?: number }) => ({ value: d.value ?? 0, label: d.name ?? '' })),
    [monthlyData],
  );

  const handleTaskPress = (task: StudyTask) => {
    if (task.kind === 'start') {
      router.push('/(student)/quiz/random' as never);
      return;
    }
    if (task.kind === 'srs') {
      const top = pickTopForRetake(srsCards, Date.now(), 10);
      if (top.length > 0 && startRetake(router, top)) return;
      // snapshot yoksa derse düş
    }
    // Navigasyon ham ders adıyla (routeSubject) yapılır — Firestore `category`
    // eşleşmesi birebir; görünen ad Türkçe kanonik (task.subject) olsa da route ham kalır.
    const route = (task.routeSubject || task.subject).toLowerCase();
    router.push(`/(student)/quiz/${route}` as never);
  };

  const openSubject = (subject: string) =>
    router.push(`/(student)/progress/${encodeURIComponent(subject)}` as never);

  const chartWidth = Math.max(width - 80, 280);
  const isEmpty = !loading && (stats?.totalSolved ?? 0) === 0;

  return (
    <SafeAreaView className="flex-1 bg-bg-surface" edges={['top']}>
      <ProgressBackground width={width} height={height} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Animated.View entering={FadeInUp.duration(350)} className="px-5 pt-2">
          <Text className="text-3xl font-bold text-text-primary">İlerleme</Text>
          <Text className="mt-1 text-sm text-text-muted">
            Nerede güçlüsün, sırada ne çalışmalısın
          </Text>
        </Animated.View>

        {loading ? (
          <View className="mt-24 items-center">
            <ActivityIndicator color="#6366F1" />
          </View>
        ) : isEmpty ? (
          <View className="mt-8 px-5">
            <EmptyState
              lottieSource={lottie.empty}
              icon={BarChart3}
              title="İlk quizinle başla"
              subtitle="Birkaç soru çöz; ustalık, plan ve grafiklerin burada canlanacak."
            />
            <Pressable
              onPress={() => router.push('/(student)/quiz/random' as never)}
              className="mt-4 flex-row items-center justify-center rounded-2xl bg-accent py-4 active:opacity-90"
            >
              <Play color="white" size={18} />
              <Text className="ml-2 text-base font-semibold text-white">Quize başla</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Animated.View
              entering={FadeInUp.delay(60).duration(350)}
              className="mt-6 px-5"
            >
              <View className="flex-row gap-3">
                <StatTile icon={Flame} label="Seri" value={`${stats?.streakDays ?? 0} gün`} iconColor="#F97316" />
                <StatTile icon={Target} label="Başarı" value={`%${stats?.successRate ?? 0}`} iconColor="#16A34A" />
              </View>
              <View className="mt-3 flex-row gap-3">
                <StatTile icon={TrendingUp} label="Net" value={stats?.net ?? 0} iconColor="#6366F1" />
                <StatTile icon={CheckCircle2} label="Bugün" value={stats?.todaySolved ?? 0} iconColor="#0EA5E9" />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(120).duration(350)} className="mt-8 px-5">
              <SectionHeader title="Bugünkü Plan" />
              <View className="mt-3">
                <StudyPlanCard tasks={tasks} onTaskPress={handleTaskPress} />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(200).duration(350)} className="mt-8 px-5">
              <ConsistencyHeatmap data={dailyActivity} />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(240).duration(350)} className="mt-8 px-5">
              <SectionHeader title="Performans" />
              <View className="mt-3">
                <SegmentedTabs tabs={PERF_TABS} active={view} onChange={setView} />
              </View>
              <View className="mt-3">
                <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
                  {view === 'weekly' ? (
                    <>
                      <Text className="text-sm font-semibold text-text-secondary">Son 7 gün</Text>
                      <View className="mt-2 flex-row gap-3">
                        <View className="flex-row items-center">
                          <View className="h-2 w-2 rounded-full bg-success" />
                          <Text className="ml-1 text-[10px] text-text-muted">Doğru</Text>
                        </View>
                        <View className="flex-row items-center">
                          <View className="h-2 w-2 rounded-full bg-danger" />
                          <Text className="ml-1 text-[10px] text-text-muted">Yanlış</Text>
                        </View>
                      </View>
                      <View className="mt-3">
                        <BarChart
                          data={weeklyChart}
                          width={chartWidth}
                          height={180}
                          barWidth={12}
                          spacing={4}
                          initialSpacing={8}
                          noOfSections={4}
                          yAxisTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                          xAxisLabelTextStyle={{ color: '#94A3B8', fontSize: 10 }}
                          yAxisColor="#E2E8F0"
                          xAxisColor="#E2E8F0"
                          rulesColor="#F1F5F9"
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text className="text-sm font-semibold text-text-secondary">Son 6 ay başarı %</Text>
                      <View className="mt-3">
                        <LineChart
                          data={monthlyChart}
                          width={chartWidth}
                          height={180}
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
                    </>
                  )}
                </View>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(280).duration(350)} className="mt-8 px-5">
              <LeagueCard
                tier={gamification?.league?.tier}
                weeklyXP={gamification?.league?.weeklyXP}
                onPress={() => router.push('/(student)/league' as never)}
              />
            </Animated.View>

            {joinedClasses.length > 0 ? (
              <Animated.View entering={FadeInUp.delay(320).duration(350)} className="mt-6 px-5">
                <SectionHeader title="Sınıf Sıralaması" />

                {joinedClasses.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mt-2"
                    contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                  >
                    {joinedClasses.map((c) => {
                      const active = activeTeacherId === c.teacherId;
                      return (
                        <Pressable
                          key={c.teacherId}
                          onPress={() => setSelectedTeacherId(c.teacherId)}
                          className={`rounded-full border px-3 py-1.5 ${
                            active
                              ? 'border-accent bg-accent-soft'
                              : 'border-border-soft bg-bg-surface'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              active ? 'text-accent-fg' : 'text-text-muted'
                            }`}
                          >
                            {classLabel(c)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text className="mt-1 text-xs text-text-muted">
                    {classLabel(joinedClasses[0])}
                  </Text>
                )}

                <View className="mt-3">
                  {selectedRanking?.rank != null && selectedRanking?.total != null ? (
                    <ClassRankRow
                      rank={selectedRanking.rank}
                      total={selectedRanking.total}
                      loading={selectedRanking.loading}
                      onPress={() => router.push('/(student)/league' as never)}
                    />
                  ) : (
                    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
                      <Text className="text-xs text-text-muted">
                        {selectedRanking?.loading
                          ? 'Sıralama hesaplanıyor…'
                          : 'Bu sınıfta henüz sıralama yok.'}
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInUp.delay(360).duration(350)} className="mt-8 px-5">
              <BadgeStrip
                unlocked={userProfile?.unlockedBadges}
                onSeeAll={() => router.push('/(student)/badges' as never)}
                onBadgePress={() => router.push('/(student)/badges' as never)}
              />
            </Animated.View>

            {masteryRows.length > 0 ? (
              <Animated.View entering={FadeInUp.delay(400).duration(350)} className="mt-8 px-5">
                <SectionHeader title="Ders Ustalığı" />
                <View className="mt-3 gap-2">
                  {masteryRows.map((row) => (
                    <MasteryRow
                      key={row.key}
                      subject={row.subject}
                      score={row.score ?? 0}
                      trend={trendsByKey[row.key]}
                      weakSubTopic={weakByKey[row.key]?.subTopic}
                      avgSeconds={avgSecByKey[row.key]}
                      dim={(row.solved_count ?? 0) < 3}
                      onPress={() => openSubject(row.routeSubject)}
                    />
                  ))}
                </View>
              </Animated.View>
            ) : null}
          </>
        )}
      </ScrollView>
      <ChatFAB />
    </SafeAreaView>
  );
}

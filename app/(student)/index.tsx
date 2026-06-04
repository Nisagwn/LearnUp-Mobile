import { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  Flame,
  Trophy,
  Target,
  TrendingUp,
  ChevronRight,
  Sparkles,
  Zap,
  PlayCircle,
  Calendar,
  Lightbulb,
  Percent,
  Sigma,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { ChatFAB } from '@/components/common/ChatFAB';
import { StatTile } from '@/components/common/StatTile';
import { SkeletonStat } from '@/components/common/Skeleton';
import { SectionHeader } from '@/components/common/SectionHeader';
import { Card } from '@/components/common/Card';
import { gradients } from '@/constants/theme';
import { AIQuizSettingsSheet, Difficulty } from '@/components/common/AIQuizSettingsSheet';
import { generateQuiz } from '@/services/aiService';
import { buildAIQuizPath } from '@/utils/quizRoute';
import { getLevelInfo } from '@/utils/levelSystem';
import { StreakHeroCard } from '@/components/home/StreakHeroCard';
import { DailyQuestsHero } from '@/components/home/DailyQuestsHero';
import { WeeklyChart } from '@/components/home/WeeklyChart';
import { LeagueCard } from '@/components/home/LeagueCard';
import { ClassRankRow } from '@/components/home/ClassRankRow';
import { BadgeStrip } from '@/components/home/BadgeStrip';
import { BadgeDetailModal } from '@/components/home/BadgeDetailModal';
import { StreakFreezeSheet } from '@/components/home/StreakFreezeSheet';
import { AnnouncementCard } from '@/components/home/AnnouncementCard';

interface MasterySubject {
  solved_count?: number;
  score?: number;
  xp_gained?: number;
}

interface Assignment {
  id: string;
  title?: string;
  subject?: string;
  dueDate?: { toDate?: () => Date } | string;
}

function formatShortDue(due: Assignment['dueDate']): string | null {
  if (!due) return null;
  try {
    const date = typeof due === 'string' ? new Date(due) : due.toDate?.();
    if (!date) return null;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  } catch {
    return null;
  }
}

export default function Home() {
  const router = useRouter();
  const ctx = useContext(UserStatsContext);
  const profile = ctx?.userProfile;
  const stats = ctx?.stats;
  const loading = ctx?.loading;
  const gamification = ctx?.gamification;
  const weeklyData = ctx?.weeklyData ?? [];
  const classRanking = ctx?.classRanking;
  const rawMastery = ctx?.masteryScores;
  const masteryScores = useMemo<Record<string, MasterySubject>>(
    () => rawMastery ?? {},
    [rawMastery],
  );
  // Seviye, profil ekranıyla AYNI kaynaktan (doğru cevap tabanlı isimli seviye)
  // hesaplanır — iki ekran arasında tutarlılık için.
  const levelInfo = useMemo(
    () => getLevelInfo(stats?.correctAnswers ?? 0) as { levelData: { level: number } },
    [stats?.correctAnswers],
  );
  const teacherId: string | undefined = ctx?.userProfile?.teacherId;
  const unlockedBadges = (profile?.unlockedBadges ?? {}) as Record<
    string,
    string | number | { toMillis?: () => number } | undefined
  >;

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [lastSubject, setLastSubject] = useState<string | null>(null);
  const [upcomingAssignments, setUpcomingAssignments] = useState<Assignment[]>([]);
  const [freezeSheetOpen, setFreezeSheetOpen] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

  const displayName = profile?.name || profile?.email?.split('@')[0] || 'Öğrenci';
  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(
      collection(db, 'user_logs'),
      where('studentId', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(1),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const first = snap.docs[0]?.data() as { subject?: string } | undefined;
        if (first?.subject) setLastSubject(first.subject);
      },
      () => {},
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!teacherId) return;
    // Toplam aktif ödev sayısını hero kart için doğru göstermek üzere 50'ye
    // çıkarıldı; "Yaklaşan Ödevler" bölümü .slice(0,3) ile sınırlı kalır.
    const q = query(collection(db, 'assignments'), where('teacherId', '==', teacherId), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Assignment[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as Assignment));
        setUpcomingAssignments(arr);
      },
      () => {},
    );
    return unsub;
  }, [teacherId]);

  const weakestSubject = useMemo(() => {
    const entries = Object.entries(masteryScores).filter(
      ([, m]) => (m.solved_count ?? 0) >= 3,
    );
    if (entries.length === 0) return null;
    entries.sort((a, b) => (a[1].score ?? 0) - (b[1].score ?? 0));
    const [subject, data] = entries[0]!;
    return { subject, score: data.score ?? 0 };
  }, [masteryScores]);

  const dailyQuests = gamification?.dailyQuests?.quests ?? [];
  const streakDays = stats?.streakDays ?? 0;
  const streakLongest = gamification?.streak?.longest ?? 0;
  const freezesAvailable = gamification?.streak?.freezesAvailable ?? 0;
  const leagueTier = gamification?.league?.tier;
  const leagueWeeklyXP = gamification?.league?.weeklyXP ?? 0;
  const selectedBadgeUnlockedAt = selectedBadgeId ? unlockedBadges[selectedBadgeId] : undefined;

  const handleAIQuizConfirm = async (
    count: number,
    difficulty: Difficulty,
    customPrompt?: string,
  ) => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const finalTopic = customPrompt?.trim() || 'genel';
      const questions = await generateQuiz(finalTopic, count, difficulty);
      setAiSheetOpen(false);
      router.push(
        buildAIQuizPath({
          questions,
          subject: finalTopic,
          count,
          difficulty,
        }) as never,
      );
    } catch (err) {
      Alert.alert('AI Quiz', `Soru üretilemedi: ${(err as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Animated.View entering={FadeInUp.duration(350)} className="px-5 pt-2">
          <Text className="text-sm text-text-muted">{greeting},</Text>
          <Text className="mt-1 text-3xl font-bold text-text-primary">{displayName}</Text>
        </Animated.View>

        {/* Streak Hero */}
        <Animated.View entering={FadeInUp.delay(40).duration(350)} className="mt-5 px-5">
          <StreakHeroCard
            streakDays={streakDays}
            longest={streakLongest}
            freezesAvailable={freezesAvailable}
            loading={loading}
            onPress={() => router.push('/(student)/profile')}
            onFreezePress={() => setFreezeSheetOpen(true)}
          />
        </Animated.View>

        {/* Öğretmen Duyuruları */}
        {ctx?.userProfile?.teacherId ? (
          <Animated.View entering={FadeInUp.delay(55).duration(350)} className="mt-5 px-5">
            <AnnouncementCard teacherId={ctx.userProfile.teacherId} />
          </Animated.View>
        ) : null}

        {/* Günlük Görevler Hero */}
        {dailyQuests.length > 0 ? (
          <Animated.View entering={FadeInUp.delay(70).duration(350)} className="mt-3 px-5">
            <DailyQuestsHero
              quests={dailyQuests}
              onPress={() => router.push('/(student)/daily-quests' as never)}
            />
          </Animated.View>
        ) : null}

        {/* Ödevler Hero — her zaman görünür, açık ödev sayısını öne çıkarır */}
        <Animated.View entering={FadeInUp.delay(85).duration(350)} className="mt-3 px-5">
          <Pressable
            onPress={() => router.push('/(student)/assignments' as never)}
            className="flex-row items-center rounded-2xl border border-accent/30 bg-accent-soft p-4 active:opacity-90"
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-accent">
              <ClipboardList color="white" size={20} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-text-primary">Ödevlerim</Text>
              <Text className="text-xs text-text-muted">
                {upcomingAssignments.length > 0
                  ? `${upcomingAssignments.length}${upcomingAssignments.length >= 50 ? '+' : ''} aktif ödev`
                  : 'Şimdilik açık ödev yok'}
              </Text>
            </View>
            <ChevronRight color="#4F46E5" size={18} />
          </Pressable>
        </Animated.View>

        {/* 2x3 Stat Grid */}
        <Animated.View entering={FadeInUp.delay(100).duration(350)} className="mt-5 px-5">
          {loading ? (
            <>
              <View className="flex-row gap-3">
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
              </View>
              <View className="mt-3 flex-row gap-3">
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
              </View>
            </>
          ) : (
            <>
              <View className="flex-row gap-3">
                <StatTile icon={TrendingUp} label="Toplam XP" value={stats?.totalXP ?? 0} iconColor="#6366F1" />
                <StatTile icon={Trophy} label="Seviye" value={levelInfo.levelData.level} iconColor="#D97706" />
                <StatTile
                  icon={Percent}
                  label="Doğruluk"
                  value={stats?.successRate ?? 0}
                  prefix="%"
                  iconColor="#16A34A"
                />
              </View>
              <View className="mt-3 flex-row gap-3">
                <StatTile icon={Sigma} label="Net" value={stats?.net ?? 0} iconColor="#0EA5E9" />
                <StatTile icon={Target} label="Bugün" value={stats?.todaySolved ?? 0} iconColor="#F97316" />
                <StatTile icon={CheckCircle2} label="Toplam" value={stats?.totalSolved ?? 0} iconColor="#8B5CF6" />
              </View>
            </>
          )}
        </Animated.View>

        {/* Haftalık Chart */}
        <Animated.View entering={FadeInUp.delay(130).duration(350)} className="mt-6 px-5">
          <WeeklyChart
            data={weeklyData}
            onPress={() => router.push('/(student)/progress' as never)}
          />
        </Animated.View>

        {/* Devam Et + Günün Önerisi */}
        {lastSubject ? (
          <Animated.View entering={FadeInUp.delay(150).duration(350)} className="mt-5 px-5">
            <Card
              onPress={() => router.push(`/(student)/quiz/${lastSubject}` as never)}
              className="border-accent/30 bg-accent-soft"
            >
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent">
                  <PlayCircle color="white" size={20} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-text-muted">Kaldığın yerden</Text>
                  <Text className="text-sm font-semibold text-text-primary">
                    {lastSubject} quiz&apos;ine devam et
                  </Text>
                </View>
                <ChevronRight color="#4F46E5" size={18} />
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {weakestSubject ? (
          <Animated.View entering={FadeInUp.delay(165).duration(350)} className="mt-3 px-5">
            <Card
              onPress={() => router.push(`/(student)/quiz/${weakestSubject.subject}` as never)}
            >
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-warning-soft">
                  <Lightbulb color="#D97706" size={20} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-xs text-text-muted">Günün Önerisi</Text>
                  <Text className="text-sm font-semibold text-text-primary">
                    {weakestSubject.subject} (%{weakestSubject.score}) üzerine çalış
                  </Text>
                </View>
                <ChevronRight color="#94A3B8" size={18} />
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {/* Hızlı Başlat */}
        <Animated.View entering={FadeInUp.delay(180).duration(350)} className="mt-7 px-5">
          <SectionHeader title="Hızlı Başlat" />
          <View className="mt-3 gap-3">
            <Card
              onPress={() => router.push('/(student)/quiz/random')}
              variant="gradient"
              gradientColors={gradients.ocean}
            >
              <View className="flex-row items-center">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/25">
                  <Zap color="white" size={22} />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-base font-bold text-white">Rastgele Quiz</Text>
                  <Text className="mt-0.5 text-xs text-white/85">
                    5 karışık soruyla hemen başla
                  </Text>
                </View>
                <ChevronRight color="white" size={20} />
              </View>
            </Card>

            <Card
              onPress={() => setAiSheetOpen(true)}
              variant="gradient"
              gradientColors={gradients.grape}
            >
              <View className="flex-row items-center">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/25">
                  <Sparkles color="white" size={22} />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-base font-bold text-white">AI Soru Üret</Text>
                  <Text className="mt-0.5 text-xs text-white/85">
                    Sayı ve zorluk seç, yapay zekâ sorular hazırlasın
                  </Text>
                </View>
                <ChevronRight color="white" size={20} />
              </View>
            </Card>
          </View>
        </Animated.View>

        {/* Haftalık Lig */}
        {leagueTier ? (
          <Animated.View entering={FadeInUp.delay(200).duration(350)} className="mt-6 px-5">
            <LeagueCard
              tier={leagueTier}
              weeklyXP={leagueWeeklyXP}
              onPress={() => router.push('/(student)/league' as never)}
            />
          </Animated.View>
        ) : null}

        {/* Sınıf Sıralaması */}
        {classRanking?.rank && classRanking?.total ? (
          <Animated.View entering={FadeInUp.delay(215).duration(350)} className="mt-3 px-5">
            <ClassRankRow
              rank={classRanking.rank}
              total={classRanking.total}
              onPress={() => router.push('/(student)/progress' as never)}
            />
          </Animated.View>
        ) : null}

        {/* Rozet Şeridi */}
        <Animated.View entering={FadeInUp.delay(230).duration(350)} className="mt-6 px-5">
          <BadgeStrip
            unlocked={unlockedBadges}
            onBadgePress={(id) => setSelectedBadgeId(id)}
            onSeeAll={() => router.push('/(student)/badges' as never)}
          />
        </Animated.View>

        {/* Yaklaşan Ödevler */}
        {upcomingAssignments.length > 0 ? (
          <Animated.View entering={FadeInUp.delay(250).duration(350)} className="mt-6 px-5">
            <SectionHeader
              title="Yaklaşan Ödevler"
              actionLabel="Tümü"
              onActionPress={() => router.push('/(student)/assignments' as never)}
            />
            <View className="mt-3 gap-2">
              {upcomingAssignments.slice(0, 3).map((a) => {
                const due = formatShortDue(a.dueDate);
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => router.push(`/(student)/assignments/${a.id}` as never)}
                    className="flex-row items-center justify-between rounded-2xl border border-border-soft bg-bg-surface p-4 active:bg-bg-elevated"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-medium text-text-primary" numberOfLines={1}>
                        {a.title ?? 'Başlıksız'}
                      </Text>
                      {due ? (
                        <View className="mt-1 flex-row items-center">
                          <Calendar color="#94A3B8" size={11} />
                          <Text className="ml-1 text-xs text-text-muted">{due}</Text>
                        </View>
                      ) : null}
                    </View>
                    <ChevronRight color="#94A3B8" size={18} />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        {/* Keşfet */}
        <Animated.View entering={FadeInUp.delay(270).duration(350)} className="mt-6 px-5">
          <SectionHeader
            title="Keşfet"
            actionLabel="Tüm Dersler"
            onActionPress={() => router.push('/(student)/learn' as never)}
          />
          <View className="mt-3 gap-2">
            <Pressable
              onPress={() => router.push('/(student)/progress' as never)}
              className="flex-row items-center justify-between rounded-2xl border border-border-soft bg-bg-surface p-4 active:bg-bg-elevated"
            >
              <View className="flex-row items-center">
                <TrendingUp color="#6366F1" size={18} />
                <Text className="ml-3 text-sm font-medium text-text-primary">İlerlemeni Gör</Text>
              </View>
              <ChevronRight color="#94A3B8" size={18} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(student)/profile' as never)}
              className="flex-row items-center justify-between rounded-2xl border border-border-soft bg-bg-surface p-4 active:bg-bg-elevated"
            >
              <View className="flex-row items-center">
                <Flame color="#6366F1" size={18} />
                <Text className="ml-3 text-sm font-medium text-text-primary">Profil ve Ayarlar</Text>
              </View>
              <ChevronRight color="#94A3B8" size={18} />
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      <ChatFAB />

      <AIQuizSettingsSheet
        visible={aiSheetOpen}
        loading={aiLoading}
        onClose={() => setAiSheetOpen(false)}
        onConfirm={handleAIQuizConfirm}
      />

      <StreakFreezeSheet
        visible={freezeSheetOpen}
        freezesAvailable={freezesAvailable}
        onClose={() => setFreezeSheetOpen(false)}
      />

      <BadgeDetailModal
        visible={!!selectedBadgeId}
        badgeId={selectedBadgeId}
        unlockedAt={selectedBadgeUnlockedAt}
        onClose={() => setSelectedBadgeId(null)}
      />
    </SafeAreaView>
  );
}

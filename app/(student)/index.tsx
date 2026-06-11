import { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeBackground } from '@/components/home/HomeBackground';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ChevronRight,
  Sparkles,
  Zap,
  Calendar,
  ClipboardList,
} from 'lucide-react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { ChatFAB } from '@/components/common/ChatFAB';
import { SectionHeader } from '@/components/common/SectionHeader';
import { Card } from '@/components/common/Card';
import { gradients } from '@/constants/theme';
import { AIQuizSettingsSheet, Difficulty } from '@/components/common/AIQuizSettingsSheet';
import { generateQuiz } from '@/services/aiService';
import { buildAIQuizPath } from '@/utils/quizRoute';
import { StreakHeroCard } from '@/components/home/StreakHeroCard';
import { DailyQuestsHero } from '@/components/home/DailyQuestsHero';
import { WeeklyChart } from '@/components/home/WeeklyChart';
import { StreakFreezeSheet } from '@/components/home/StreakFreezeSheet';
import { AnnouncementCard } from '@/components/home/AnnouncementCard';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { NotificationSheet } from '@/components/notifications/NotificationSheet';
import { subscribeUnreadCount } from '@/services/notificationsApi';

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
  const { width, height } = useWindowDimensions();
  const ctx = useContext(UserStatsContext);
  const profile = ctx?.userProfile;
  const stats = ctx?.stats;
  const gamification = ctx?.gamification;
  const weeklyData = ctx?.weeklyData ?? [];
  const teacherIds: string[] = useMemo(() => {
    const raw = ctx?.userProfile;
    if (Array.isArray(raw?.teacherIds)) {
      return (raw.teacherIds as unknown[]).filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      );
    }
    if (typeof raw?.teacherId === 'string' && raw.teacherId) return [raw.teacherId];
    return [];
  }, [ctx?.userProfile?.teacherIds, ctx?.userProfile?.teacherId]);

  const teacherNamesMap: Record<string, string> = useMemo(() => {
    const raw = ctx?.userProfile;
    const map: Record<string, string> = {};
    if (raw?.teacherNames && typeof raw.teacherNames === 'object' && !Array.isArray(raw.teacherNames)) {
      for (const [k, v] of Object.entries(raw.teacherNames as Record<string, unknown>)) {
        if (typeof v === 'string' && v.trim().length > 0) map[k] = v;
      }
    }
    if (typeof raw?.teacherId === 'string' && raw.teacherId && typeof raw?.teacherName === 'string') {
      if (!map[raw.teacherId] && raw.teacherName.trim().length > 0) {
        map[raw.teacherId] = raw.teacherName;
      }
    }
    return map;
  }, [ctx?.userProfile?.teacherNames, ctx?.userProfile?.teacherId, ctx?.userProfile?.teacherName]);
  const unlockedBadges = (profile?.unlockedBadges ?? {}) as Record<
    string,
    string | number | { toMillis?: () => number } | undefined
  >;

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [upcomingAssignments, setUpcomingAssignments] = useState<Assignment[]>([]);
  const [freezeSheetOpen, setFreezeSheetOpen] = useState(false);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const studentUid = auth.currentUser?.uid ?? null;

  useEffect(() => {
    if (!studentUid) return;
    const unsub = subscribeUnreadCount(studentUid, setUnreadCount);
    return () => {
      if (unsub) unsub();
    };
  }, [studentUid]);

  // Selamlama animasyonu — wave emoji sürekli el sallasın
  const waveRot = useSharedValue(0);
  useEffect(() => {
    waveRot.value = withRepeat(
      withSequence(
        withTiming(20, { duration: 280 }),
        withTiming(-10, { duration: 240 }),
        withTiming(20, { duration: 220 }),
        withTiming(0, { duration: 280 }),
        withTiming(0, { duration: 2200 }),
      ),
      -1,
      false,
    );
  }, [waveRot]);
  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${waveRot.value}deg` }],
  }));

  const displayName = profile?.name || profile?.email?.split('@')[0] || 'Öğrenci';
  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  const teacherIdsKey = teacherIds.join(',');
  useEffect(() => {
    if (teacherIds.length === 0) {
      setUpcomingAssignments([]);
      return;
    }
    // Toplam aktif ödev sayısını hero kart için doğru göstermek üzere 50'ye
    // çıkarıldı; "Yaklaşan Ödevler" bölümü .slice(0,3) ile sınırlı kalır.
    // Multi-class destek: `in` operatörü max 30 değer kabul eder.
    const safeIds = teacherIds.slice(0, 30);
    const q =
      safeIds.length === 1
        ? query(collection(db, 'assignments'), where('teacherId', '==', safeIds[0]), limit(50))
        : query(collection(db, 'assignments'), where('teacherId', 'in', safeIds), limit(50));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherIdsKey]);

  const dailyQuests = gamification?.dailyQuests?.quests ?? [];
  const streakDays = stats?.streakDays ?? 0;
  const streakLongest = gamification?.streak?.longest ?? 0;
  const freezesAvailable = gamification?.streak?.freezesAvailable ?? 0;

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
    <SafeAreaView className="flex-1 bg-bg-surface" edges={['top']}>
      <HomeBackground width={width} height={height} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Gradient Selamlama Hero — sallayan el + isim */}
        <Animated.View entering={FadeInDown.duration(420)} className="mt-2 px-5">
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 24,
              padding: 18,
              shadowColor: '#6366F1',
              shadowOpacity: 0.35,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            <View className="flex-row items-center">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-sm font-medium text-white/85">{greeting}</Text>
                  <Animated.Text style={[waveStyle, { marginLeft: 6, fontSize: 18 }]}>
                    👋
                  </Animated.Text>
                </View>
                <Text
                  className="mt-1 text-2xl font-bold text-white"
                  numberOfLines={1}
                  style={{
                    textShadowColor: 'rgba(0,0,0,0.25)',
                    textShadowRadius: 4,
                  }}
                >
                  {displayName}
                </Text>
                <Text className="mt-1 text-xs text-white/80">
                  Bugün harika bir gün — devam edelim.
                </Text>
              </View>
              <View style={{ marginLeft: 12 }}>
                <NotificationBell
                  unreadCount={unreadCount}
                  onPress={() => setNotifSheetOpen(true)}
                  light
                />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Streak Hero */}
        <Animated.View entering={FadeInLeft.delay(80).duration(420)} className="mt-4 px-5">
          <StreakHeroCard
            streakDays={streakDays}
            longest={streakLongest}
            freezesAvailable={freezesAvailable}
            loading={ctx?.loading}
            onPress={() => router.push('/(student)/profile')}
            onFreezePress={() => setFreezeSheetOpen(true)}
          />
        </Animated.View>

        {/* Öğretmen Duyuruları */}
        {teacherIds.length > 0 ? (
          <Animated.View entering={FadeInRight.delay(120).duration(420)} className="mt-4 px-5">
            <AnnouncementCard teacherIds={teacherIds} teacherNames={teacherNamesMap} />
          </Animated.View>
        ) : null}

        {/* Günlük Görevler Hero */}
        {dailyQuests.length > 0 ? (
          <Animated.View entering={FadeInLeft.delay(160).duration(420)} className="mt-3 px-5">
            <DailyQuestsHero
              quests={dailyQuests}
              onPress={() => router.push('/(student)/daily-quests' as never)}
            />
          </Animated.View>
        ) : null}

        {/* Ödevler Hero — her zaman görünür, açık ödev sayısını öne çıkarır */}
        <Animated.View entering={FadeInRight.delay(200).duration(420)} className="mt-3 px-5">
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

        {/* Haftalık Chart */}
        <Animated.View entering={FadeInUp.delay(240).duration(420)} className="mt-6 px-5">
          <WeeklyChart
            data={weeklyData}
            onPress={() => router.push('/(student)/progress' as never)}
          />
        </Animated.View>

        {/* Hızlı Başlat */}
        <Animated.View entering={FadeInUp.delay(380).duration(450)} className="mt-7 px-5">
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

        {/* Yaklaşan Ödevler */}
        {upcomingAssignments.length > 0 ? (
          <Animated.View entering={FadeInUp.delay(440).duration(420)} className="mt-6 px-5">
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

      <NotificationSheet
        visible={notifSheetOpen}
        uid={studentUid}
        onClose={() => setNotifSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

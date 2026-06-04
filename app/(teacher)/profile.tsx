import { useContext, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Settings } from 'lucide-react-native';
import { auth } from '@/services/firebase';
import { AvatarPickerSheet } from '@/components/settings/AvatarPickerSheet';
import { AccountSummaryCard } from '@/components/profile/AccountSummaryCard';
import { SectionHeader } from '@/components/common/SectionHeader';
import { TeacherProfileHero } from '@/components/teacher/TeacherProfileHero';
import { TeacherImpactCard } from '@/components/teacher/TeacherImpactCard';
import { TeacherBioCard } from '@/components/teacher/TeacherBioCard';
import { TeacherQuickLinks } from '@/components/teacher/TeacherQuickLinks';
import { BranchPickerSheet } from '@/components/teacher/BranchPickerSheet';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { fetchClassAnalytics, type ClassAnalytics } from '@/services/teacherAnalyticsApi';
import {
  fetchTeacherLifetimeStats,
  type TeacherLifetimeStats,
} from '@/services/teacherProfileApi';

function tsToMs(t: unknown): number {
  if (!t) return 0;
  const maybe = t as { toMillis?: () => number; toDate?: () => Date };
  if (typeof maybe.toMillis === 'function') return maybe.toMillis();
  if (typeof maybe.toDate === 'function') return maybe.toDate().getTime();
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return t;
  return 0;
}

function formatMemberSinceShort(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
}

export default function TeacherProfile() {
  const router = useRouter();
  const user = auth.currentUser;
  const ctx = useContext(UserStatsContext);
  const profile = ctx?.userProfile as
    | {
        name?: string;
        email?: string;
        branch?: string;
        avatarId?: string;
        bio?: string;
        school?: string;
        createdAt?: unknown;
      }
    | null;

  const [avatarId, setAvatarId] = useState<string | null>(profile?.avatarId ?? null);
  const [displayName, setDisplayName] = useState<string>(
    user?.displayName ?? profile?.name ?? user?.email?.split('@')[0] ?? 'Öğretmen',
  );
  const [bio, setBio] = useState<string>(profile?.bio ?? '');
  const [school, setSchool] = useState<string>(profile?.school ?? '');
  const [branchLocal, setBranchLocal] = useState<string | null>(profile?.branch ?? null);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [branchSheetOpen, setBranchSheetOpen] = useState(false);

  const [classStats, setClassStats] = useState<ClassAnalytics | null>(null);
  const [lifetime, setLifetime] = useState<TeacherLifetimeStats>({
    questionsCreated: 0,
    assignmentsCreated: 0,
    announcementsCreated: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLifetime, setLoadingLifetime] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const createdAtMs = tsToMs(profile?.createdAt);
  const memberSince = formatMemberSinceShort(createdAtMs);

  // Context değiştikçe (login sonrası) yerel state'i senkronla
  useEffect(() => {
    if (profile?.avatarId !== undefined) setAvatarId(profile.avatarId ?? null);
    if (profile?.bio !== undefined) setBio(profile.bio ?? '');
    if (profile?.school !== undefined) setSchool(profile.school ?? '');
    if (profile?.branch !== undefined) setBranchLocal(profile.branch ?? null);
    if (profile?.name) setDisplayName(profile.name);
  }, [profile?.avatarId, profile?.bio, profile?.school, profile?.branch, profile?.name]);

  const loadStats = useCallback(async (uid: string) => {
    setLoadingStats(true);
    try {
      const data = await fetchClassAnalytics(uid);
      setClassStats(data);
    } catch (err) {
      console.warn('fetchClassAnalytics:', (err as Error).message);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadLifetime = useCallback(async (uid: string) => {
    setLoadingLifetime(true);
    try {
      const data = await fetchTeacherLifetimeStats(uid);
      setLifetime(data);
    } catch (err) {
      console.warn('fetchTeacherLifetimeStats:', (err as Error).message);
    } finally {
      setLoadingLifetime(false);
    }
  }, []);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    void loadStats(uid);
    void loadLifetime(uid);
  }, [user?.uid, loadStats, loadLifetime]);

  const onRefresh = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) return;
    setRefreshing(true);
    try {
      await Promise.all([loadStats(uid), loadLifetime(uid)]);
    } finally {
      setRefreshing(false);
    }
  }, [user?.uid, loadStats, loadLifetime]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-bg-base"
    >
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        >
          <Animated.View
            entering={FadeInUp.duration(350)}
            className="flex-row items-center justify-between px-5 pt-2"
          >
            <Text className="text-3xl font-bold text-text-primary">Profil</Text>
            <Pressable
              onPress={() => router.push('/(teacher)/settings' as never)}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-bg-surface active:opacity-70"
            >
              <Settings color="#94A3B8" size={20} />
            </Pressable>
          </Animated.View>

          {/* 1. Hero */}
          <Animated.View entering={FadeInUp.delay(60).duration(350)} className="mt-5 px-5">
            <TeacherProfileHero
              avatarId={avatarId}
              photoURL={user?.photoURL ?? null}
              displayName={displayName}
              email={user?.email ?? null}
              branch={branchLocal}
              createdAtMs={createdAtMs}
              onChangeAvatar={() => setAvatarSheetOpen(true)}
              onChangeBranch={() => setBranchSheetOpen(true)}
              onNameSaved={(n) => setDisplayName(n)}
            />
          </Animated.View>

          {/* 2. Hesap Özeti */}
          <Animated.View entering={FadeInUp.delay(120).duration(350)} className="mt-6 px-5">
            <SectionHeader title="Sınıf Özeti" />
            <View className="mt-3">
              <AccountSummaryCard
                memberSince={memberSince}
                totalSolved={classStats?.studentCount ?? 0}
                successRate={classStats?.classAverage ?? 0}
                net={classStats?.activeStudents ?? 0}
              />
            </View>
            <View className="mt-1 px-1">
              <Text className="text-[10px] text-text-muted">
                Soldan sağa: üyelik, sınıftaki öğrenci, sınıf ortalaması, son 7 gün aktif öğrenci.
                {loadingStats ? ' Yükleniyor…' : ''}
              </Text>
            </View>
          </Animated.View>

          {/* 3. Öğretmenlik Etkisi */}
          <Animated.View entering={FadeInUp.delay(180).duration(350)} className="mt-6 px-5">
            <SectionHeader title="Öğretmenlik Etkisi" />
            <View className="mt-3">
              <TeacherImpactCard
                questionsCreated={lifetime.questionsCreated}
                assignmentsCreated={lifetime.assignmentsCreated}
                announcementsCreated={lifetime.announcementsCreated}
                loading={loadingLifetime}
              />
            </View>
          </Animated.View>

          {/* 4. Bio + Okul */}
          <Animated.View entering={FadeInUp.delay(240).duration(350)} className="mt-6 px-5">
            <TeacherBioCard
              bio={bio}
              school={school}
              onSaved={({ bio: b, school: s }) => {
                setBio(b);
                setSchool(s);
              }}
            />
          </Animated.View>

          {/* 5. Hızlı Erişim */}
          <Animated.View entering={FadeInUp.delay(300).duration(350)} className="mt-6 px-5">
            <SectionHeader title="Hızlı Erişim" />
            <View className="mt-3">
              <TeacherQuickLinks />
            </View>
          </Animated.View>
        </ScrollView>

        <AvatarPickerSheet
          visible={avatarSheetOpen}
          currentAvatarId={avatarId}
          onClose={() => setAvatarSheetOpen(false)}
          onSelected={(id) => setAvatarId(id)}
        />

        <BranchPickerSheet
          visible={branchSheetOpen}
          currentBranch={branchLocal}
          onClose={() => setBranchSheetOpen(false)}
          onSaved={(b) => setBranchLocal(b)}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

import { useContext, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  StickyNote,
  ClipboardList,
  Trophy,
  Flame,
  TrendingUp,
  Settings,
  ChevronRight,
  GraduationCap,
  Award,
} from 'lucide-react-native';

const GRADE_OPTIONS = ['9', '10', '11', '12'] as const;
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { AvatarPickerSheet } from '@/components/settings/AvatarPickerSheet';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { getLevelInfo } from '@/utils/levelSystem';
import useBadges from '@/hooks/useBadges';
import { StatTile } from '@/components/common/StatTile';
import { SectionHeader } from '@/components/common/SectionHeader';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { AccountSummaryCard } from '@/components/profile/AccountSummaryCard';
import { ClassMembershipCard } from '@/components/profile/ClassMembershipCard';
import { JoinClassSheet } from '@/components/profile/JoinClassSheet';
import { leaveClass } from '@/services/classApi';
import { LeagueCard } from '@/components/home/LeagueCard';
import { ClassRankRow } from '@/components/home/ClassRankRow';
import { BadgeStrip } from '@/components/home/BadgeStrip';

export default function Profile() {
  const router = useRouter();
  const user = auth.currentUser;
  const ctx = useContext(UserStatsContext);
  const profile = ctx?.userProfile;
  const stats = ctx?.stats;
  const gamification = ctx?.gamification;
  const classRanking = ctx?.classRanking;
  const masteryScores: Record<string, { score?: number; solved_count?: number }> =
    ctx?.masteryScores ?? {};

  const topMastery = Object.entries(masteryScores)
    .filter(([, m]) => (m.solved_count ?? 0) >= 1)
    .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0))
    .slice(0, 3);

  const levelInfo = useMemo(
    () =>
      getLevelInfo(stats?.correctAnswers ?? 0) as {
        levelData: { level: number; name: string; emoji: string };
        index: number;
        progress: number;
        toNext: number;
      },
    [stats?.correctAnswers],
  );

  const memberSince = useMemo(() => {
    const iso = user?.metadata?.creationTime;
    let date: Date | null = null;
    if (iso) date = new Date(iso);
    else {
      const created = profile?.createdAt as { toDate?: () => Date } | undefined;
      if (created?.toDate) date = created.toDate();
    }
    if (!date || Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(date);
  }, [user, profile]);

  const [avatar] = useState<string | null>(
    profile?.photoURL ?? user?.photoURL ?? null,
  );
  const [avatarId, setAvatarId] = useState<string | null>(
    (profile?.avatarId as string | undefined) ?? null,
  );
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState(false);
  const [savingGrade, setSavingGrade] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const currentGrade: string | null = (profile?.grade as string | undefined) ?? null;
  const teacherId = (profile?.teacherId as string | undefined) ?? null;
  const teacherName = (profile?.teacherName as string | undefined) ?? null;

  const handleLeaveClass = () => {
    if (!user) return;
    Alert.alert('Sınıftan ayrıl', 'Bu sınıftan ayrılmak istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Ayrıl',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveClass(user.uid);
          } catch (err) {
            Alert.alert('Hata', (err as Error).message);
          }
        },
      },
    ]);
  };

  const handleSaveGrade = async (g: string) => {
    if (!user) return;
    setSavingGrade(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { grade: g });
      setEditingGrade(false);
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setSavingGrade(false);
    }
  };

  const fallbackName =
    profile?.name ?? user?.displayName ?? user?.email?.split('@')[0] ?? 'Kullanıcı';
  const displayName = fallbackName;
  const role = profile?.role === 'teacher' ? 'Öğretmen' : 'Öğrenci';

  const handleSaveName = async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      Alert.alert('Geçersiz isim', 'Ad 2 ile 50 karakter arasında olmalı.');
      throw new Error('invalid name');
    }
    if (!user) throw new Error('no user');
    await updateDoc(doc(db, 'users', user.uid), { name: trimmed });
    await updateProfile(user, { displayName: trimmed });
  };

  const handleChangeAvatar = () => setAvatarSheetOpen(true);

  const hasLeague = !!gamification?.league?.tier;
  const hasRank = !!(classRanking?.rank && classRanking?.total);
  const showCompetition = hasLeague || hasRank || !!classRanking?.loading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-bg-base"
    >
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          <Animated.View
            entering={FadeInUp.duration(350)}
            className="flex-row items-center justify-between px-5 pt-2"
          >
            <Text className="text-3xl font-bold text-text-primary">Profil</Text>
            <Pressable
              onPress={() => router.push('/(student)/settings' as never)}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-bg-surface active:opacity-70"
            >
              <Settings color="#94A3B8" size={20} />
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(60).duration(350)} className="mt-6 px-5">
            <ProfileHero
              name={displayName}
              role={role}
              email={user?.email}
              avatarId={avatarId}
              avatarUrl={avatar}
              onChangeAvatar={handleChangeAvatar}
              onSaveName={handleSaveName}
              levelData={levelInfo.levelData}
              levelProgress={levelInfo.progress}
              toNext={levelInfo.toNext}
              uid={user?.uid ?? null}
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(100).duration(350)} className="mt-4 px-5">
            <AccountSummaryCard
              memberSince={memberSince}
              totalSolved={stats?.totalSolved ?? 0}
              successRate={stats?.successRate ?? 0}
              net={stats?.net ?? 0}
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(120).duration(350)} className="mt-4 flex-row gap-3 px-5">
            <StatTile icon={TrendingUp} label="XP" value={stats?.totalXP ?? 0} iconColor="#6366F1" />
            <StatTile
              icon={Trophy}
              label="Seviye"
              value={levelInfo.levelData.level}
              iconColor="#D97706"
            />
            <StatTile icon={Flame} label="Seri" value={stats?.streakDays ?? 0} iconColor="#F97316" />
          </Animated.View>

          {showCompetition ? (
            <Animated.View entering={FadeInUp.delay(140).duration(350)} className="mt-6 px-5">
              <SectionHeader title="Rekabet" />
              <View className="mt-3 gap-2">
                {hasLeague ? (
                  <LeagueCard
                    tier={gamification?.league?.tier}
                    weeklyXP={gamification?.league?.weeklyXP ?? 0}
                    onPress={() => router.push('/(student)/league' as never)}
                  />
                ) : null}
                {hasRank || classRanking?.loading ? (
                  <ClassRankRow
                    rank={classRanking?.rank ?? null}
                    total={classRanking?.total ?? null}
                    loading={classRanking?.loading}
                    onPress={() => router.push('/(student)/progress' as never)}
                  />
                ) : null}
              </View>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInUp.delay(150).duration(350)} className="mt-6 px-5">
            <BadgeStrip
              unlocked={profile?.unlockedBadges}
              onSeeAll={() => router.push('/(student)/badges' as never)}
            />
          </Animated.View>

          {topMastery.length > 0 ? (
            <Animated.View entering={FadeInUp.delay(165).duration(350)} className="mt-6 px-5">
              <SectionHeader title="Ders Performansım" />
              <View className="mt-3 gap-2">
                {topMastery.map(([subject, data]) => {
                  const score = data.score ?? 0;
                  return (
                    <View
                      key={subject}
                      className="rounded-2xl border border-border-soft bg-bg-surface p-3"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-semibold text-text-primary">{subject}</Text>
                        <Text className="text-sm font-bold text-accent-fg">%{score}</Text>
                      </View>
                      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                        <View
                          className="h-full bg-accent"
                          style={{ width: `${Math.min(100, score)}%` }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}

          {profile?.role !== 'teacher' && (
            <Animated.View entering={FadeInUp.delay(168).duration(350)} className="mt-6 px-5">
              <SectionHeader title="Sınıfım" />
              <View className="mt-3">
                <ClassMembershipCard
                  teacherId={teacherId}
                  teacherName={teacherName}
                  classRank={classRanking?.rank ?? null}
                  classTotal={classRanking?.total ?? null}
                  onJoinPress={() => setJoinOpen(true)}
                  onLeave={handleLeaveClass}
                />
              </View>
            </Animated.View>
          )}

          {profile?.role !== 'teacher' && (
            <Animated.View entering={FadeInUp.delay(172).duration(350)} className="mt-4 px-5">
              <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
                      <GraduationCap color="#6366F1" size={18} />
                    </View>
                    <View className="ml-3">
                      <Text className="text-sm font-medium text-text-primary">Sınıf</Text>
                      <Text className="text-xs text-text-muted">
                        {currentGrade ? `${currentGrade}. sınıf` : 'Henüz seçilmedi'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setEditingGrade((v) => !v)}
                    hitSlop={8}
                    className="rounded-full bg-accent-soft px-3 py-1.5 active:opacity-70"
                  >
                    <Text className="text-xs font-semibold text-accent-fg">
                      {editingGrade ? 'Kapat' : 'Düzenle'}
                    </Text>
                  </Pressable>
                </View>
                {editingGrade && (
                  <View className="mt-3 flex-row gap-2">
                    {GRADE_OPTIONS.map((g) => (
                      <Pressable
                        key={g}
                        onPress={() => handleSaveGrade(g)}
                        disabled={savingGrade}
                        className={`flex-1 items-center rounded-xl border py-2 ${
                          currentGrade === g
                            ? 'border-accent bg-accent-soft'
                            : 'border-border-soft bg-bg-base'
                        } ${savingGrade ? 'opacity-50' : ''}`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            currentGrade === g ? 'text-accent-fg' : 'text-text-muted'
                          }`}
                        >
                          {g}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInUp.delay(180).duration(350)} className="mt-6 gap-2 px-5">
            <QuickLink
              icon={Award}
              label="Rozetlerim"
              onPress={() => router.push('/(student)/badges' as never)}
            />
            <QuickLink
              icon={StickyNote}
              label="Notlarım"
              onPress={() => router.push('/(student)/notes')}
            />
            <QuickLink
              icon={ClipboardList}
              label="Ödevlerim"
              onPress={() => router.push('/(student)/assignments')}
            />
          </Animated.View>
        </ScrollView>

        <JoinClassSheet
          visible={joinOpen}
          onClose={() => setJoinOpen(false)}
          onJoined={(name) => Alert.alert('Katıldın 🎉', `${name} adlı öğretmenin sınıfına katıldın.`)}
        />

        <AvatarPickerSheet
          visible={avatarSheetOpen}
          currentAvatarId={avatarId}
          onClose={() => setAvatarSheetOpen(false)}
          onSelected={(id) => setAvatarId(id)}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function QuickLink({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Award;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-2xl border border-border-soft bg-bg-surface p-4 active:bg-bg-elevated"
    >
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
          <Icon color="#6366F1" size={18} />
        </View>
        <Text className="ml-3 text-sm font-medium text-text-primary">{label}</Text>
      </View>
      <ChevronRight color="#94A3B8" size={18} />
    </Pressable>
  );
}

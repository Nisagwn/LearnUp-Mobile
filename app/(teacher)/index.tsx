import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Share, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { SectionHeader } from '@/components/common/SectionHeader';
import { WeeklyChart } from '@/components/home/WeeklyChart';
import { TeacherHero } from '@/components/teacher/TeacherHero';
import { ActionInboxCard } from '@/components/teacher/ActionInboxCard';
import {
  ActiveAssignmentsCard,
  type ActiveAssignmentSummary,
} from '@/components/teacher/ActiveAssignmentsCard';
import { ClassAnalyticsCard } from '@/components/teacher/ClassAnalyticsCard';
import { StudentsAtRiskCard } from '@/components/teacher/StudentsAtRiskCard';
import { WeakTopicsCard } from '@/components/teacher/WeakTopicsCard';
import { RecentActivityCard } from '@/components/teacher/RecentActivityCard';
import { QuickActionGrid } from '@/components/teacher/QuickActionGrid';
import { fetchClassAnalytics, type ClassAnalytics } from '@/services/teacherAnalyticsApi';
import { ensureTeacherClassCode } from '@/services/classApi';
import {
  subscribeTeacherInbox,
  emptyInbox,
  type TeacherInbox,
} from '@/services/teacherInboxApi';
import {
  fetchStudentsAtRisk,
  type StudentRisk,
} from '@/services/studentAnalyticsApi';
import {
  fetchRecentActivity,
  type ActivityEvent,
} from '@/services/teacherActivityApi';
import {
  subscribeTeacherAssignments,
  deleteAssignment,
  type TeacherAssignment,
} from '@/services/assignmentsApi';

const MAX_ACTIVE_ASSIGNMENTS = 3;

export default function TeacherDashboard() {
  const router = useRouter();
  const ctx = useContext(UserStatsContext);
  const profile = ctx?.userProfile;
  const teacher = auth.currentUser;
  const name = profile?.name ?? teacher?.displayName ?? 'Öğretmen';
  const branch = (profile?.branch as string | undefined) ?? null;

  const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [classCode, setClassCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(true);
  const [inbox, setInbox] = useState<TeacherInbox>(emptyInbox);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [atRisk, setAtRisk] = useState<StudentRisk[] | null>(null);
  const [atRiskLoading, setAtRiskLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityEvent[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [activeSummaries, setActiveSummaries] = useState<ActiveAssignmentSummary[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [submissionRate, setSubmissionRate] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const uid = teacher?.uid ?? null;

  // ── 1) Analitik + sınıf kodu (one-shot) ─────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    if (!uid) {
      setAnalyticsLoading(false);
      return;
    }
    setAnalyticsLoading(true);
    try {
      const data = await fetchClassAnalytics(uid);
      setAnalytics(data);
    } catch (err) {
      console.warn('class analytics:', (err as Error).message);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (!uid) {
      setCodeLoading(false);
      return;
    }
    ensureTeacherClassCode(uid)
      .then(setClassCode)
      .catch(() => setClassCode(null))
      .finally(() => setCodeLoading(false));
  }, [uid]);

  // ── 2) Aksiyon Inbox (real-time) ────────────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setInboxLoading(false);
      return;
    }
    setInboxLoading(true);
    const unsubs = subscribeTeacherInbox(uid, (data) => {
      setInbox(data);
      setInboxLoading(false);
    });
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  // ── 3) Aktif ödevler (real-time) + öğrenci sayısı + submission count ───
  useEffect(() => {
    if (!uid) {
      setAssignmentsLoading(false);
      return;
    }
    const unsub = subscribeTeacherAssignments(uid, (items) => {
      setAssignments(items);
      setAssignmentsLoading(false);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [uid]);

  // Aktif (süresi geçmemiş) ödev özetlerini hesapla — count'lar paralel
  useEffect(() => {
    if (!uid || assignments.length === 0) {
      setActiveSummaries([]);
      return;
    }
    const studentCount = analytics?.studentCount ?? 0;
    const now = Date.now();
    const active = assignments
      .filter((a) => !a.dueDateMs || a.dueDateMs > now)
      .slice(0, MAX_ACTIVE_ASSIGNMENTS);

    let cancelled = false;
    (async () => {
      const summaries = await Promise.all(
        active.map(async (a) => {
          let submittedCount = 0;
          let pendingReview = 0;
          try {
            const allQ = query(
              collection(db, 'assignment_submissions'),
              where('assignmentId', '==', a.id),
            );
            const pendQ = query(
              collection(db, 'assignment_submissions'),
              where('assignmentId', '==', a.id),
              where('status', '==', 'submitted'),
            );
            const [allRes, pendRes] = await Promise.all([
              getCountFromServer(allQ),
              getCountFromServer(pendQ),
            ]);
            submittedCount = allRes.data().count;
            pendingReview = pendRes.data().count;
          } catch (err) {
            console.warn('count submissions:', (err as Error).message);
          }
          return {
            ...a,
            submittedCount,
            pendingReview,
            studentCount,
          } satisfies ActiveAssignmentSummary;
        }),
      );
      if (!cancelled) setActiveSummaries(summaries);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, assignments, analytics?.studentCount]);

  // ── 4) Teslim oranı (son 30 gün) ────────────────────────────────────────
  useEffect(() => {
    if (!uid || !analytics) {
      setSubmissionRate(null);
      return;
    }
    const studentCount = analytics.studentCount;
    if (studentCount === 0 || assignments.length === 0) {
      setSubmissionRate(0);
      return;
    }
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - THIRTY_DAYS;
    const recent = assignments.filter((a) => a.createdAtMs >= cutoff).slice(0, 20);
    if (recent.length === 0) {
      setSubmissionRate(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const counts = await Promise.all(
        recent.map(async (a) => {
          try {
            const snap = await getCountFromServer(
              query(collection(db, 'assignment_submissions'), where('assignmentId', '==', a.id)),
            );
            return snap.data().count;
          } catch {
            return 0;
          }
        }),
      );
      if (cancelled) return;
      const expected = recent.length * studentCount;
      const got = counts.reduce((s, c) => s + Math.min(c, studentCount), 0);
      setSubmissionRate(expected > 0 ? Math.round((got / expected) * 100) : 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, analytics, assignments]);

  // ── 5) Risk öğrencileri (one-shot) ──────────────────────────────────────
  const loadAtRisk = useCallback(async () => {
    if (!uid) {
      setAtRiskLoading(false);
      return;
    }
    setAtRiskLoading(true);
    try {
      const data = await fetchStudentsAtRisk(uid, 3);
      setAtRisk(data);
    } catch (err) {
      console.warn('students at risk:', (err as Error).message);
      setAtRisk([]);
    } finally {
      setAtRiskLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadAtRisk();
  }, [loadAtRisk]);

  // ── 6) Son aktivite (one-shot + 30s refetch) ────────────────────────────
  const loadActivity = useCallback(async () => {
    if (!uid) {
      setActivityLoading(false);
      return;
    }
    setActivityLoading(true);
    try {
      const data = await fetchRecentActivity(uid, 5);
      setActivity(data);
    } catch (err) {
      console.warn('recent activity:', (err as Error).message);
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadActivity();
    const t = setInterval(loadActivity, 30_000);
    return () => clearInterval(t);
  }, [loadActivity]);

  // ── Pull-to-refresh ─────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadAnalytics(), loadAtRisk(), loadActivity()]);
    setRefreshing(false);
  }, [loadAnalytics, loadAtRisk, loadActivity]);

  // ── Aksiyonlar ──────────────────────────────────────────────────────────
  const handleShareCode = async () => {
    if (!classCode) return;
    try {
      await Share.share({
        message: `LearnUp sınıfıma katıl! Sınıf kodum: ${classCode}\n\nProfil → Sınıfım → Sınıfa Katıl'dan bu kodu gir.`,
      });
    } catch {
      /* iptal */
    }
  };

  const inboxValue = useMemo(() => inbox, [inbox]);

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366F1" />
        }
      >
        <Animated.View entering={FadeInUp.duration(350)} className="px-5 pt-2">
          <TeacherHero
            name={name}
            branch={branch}
            classCode={classCode}
            codeLoading={codeLoading}
            onShareCode={handleShareCode}
          />
        </Animated.View>

        {/* Aksiyon Merkezi — neyi seninle yapmam gerekiyor */}
        <Animated.View entering={FadeInUp.delay(30).duration(350)} className="mt-5 px-5">
          <SectionHeader title="Aksiyon Merkezi" />
          <View className="mt-3">
            <ActionInboxCard
              inbox={inboxLoading ? null : inboxValue}
              loading={inboxLoading}
              onOpenSubmissions={() => router.push('/(teacher)/assignments' as never)}
              onOpenPendingQuestions={() => router.push('/(teacher)/questions' as never)}
              onOpenAssignments={() => router.push('/(teacher)/assignments' as never)}
              onOpenStudents={() => router.push('/(teacher)/classes' as never)}
            />
          </View>
        </Animated.View>

        {/* Aktif Ödevler — ön plana çıkmış first-class bölüm */}
        <Animated.View entering={FadeInUp.delay(60).duration(350)} className="mt-6 px-5">
          <ActiveAssignmentsCard
            items={activeSummaries}
            loading={assignmentsLoading}
            onCreate={() => router.push('/(teacher)/assignments/create' as never)}
            onOpenAll={() => router.push('/(teacher)/assignments' as never)}
            onOpenAssignment={(id) =>
              router.push(`/(teacher)/assignments/${id}/submissions` as never)
            }
            onDeleteAssignment={deleteAssignment}
          />
        </Animated.View>

        {/* Anahtar Metrikler */}
        <Animated.View entering={FadeInUp.delay(90).duration(350)} className="mt-6 px-5">
          <SectionHeader title="Sınıf Analitiği" />
          <View className="mt-3">
            {analyticsLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color="#6366F1" />
              </View>
            ) : (
              <ClassAnalyticsCard
                studentCount={analytics?.studentCount ?? 0}
                activeStudents={analytics?.activeStudents ?? 0}
                classAverage={analytics?.classAverage ?? 0}
                totalSolved={analytics?.totalSolved ?? 0}
                submissionRate={submissionRate}
              />
            )}
          </View>
        </Animated.View>

        {/* Haftalık Aktivite */}
        {!analyticsLoading ? (
          <Animated.View entering={FadeInUp.delay(120).duration(350)} className="mt-6 px-5">
            <WeeklyChart data={analytics?.weeklyActivity ?? []} />
          </Animated.View>
        ) : null}

        {/* Dikkat Gereken Öğrenciler */}
        <Animated.View entering={FadeInUp.delay(150).duration(350)} className="mt-6 px-5">
          <SectionHeader title="Dikkat Gereken Öğrenciler" />
          <View className="mt-3">
            <StudentsAtRiskCard
              items={atRisk}
              loading={atRiskLoading}
              onOpenStudent={(sid) => router.push(`/(teacher)/classes/${sid}` as never)}
            />
          </View>
        </Animated.View>

        {/* Sınıfın Zayıf Konuları */}
        {!analyticsLoading ? (
          <Animated.View entering={FadeInUp.delay(180).duration(350)} className="mt-6 px-5">
            <SectionHeader title="Sınıfın En Zayıf Konuları" />
            <View className="mt-3">
              <WeakTopicsCard topics={analytics?.weakTopics ?? []} />
            </View>
          </Animated.View>
        ) : null}

        {/* Son Aktivite */}
        <Animated.View entering={FadeInUp.delay(210).duration(350)} className="mt-6 px-5">
          <SectionHeader title="Son Aktivite" />
          <View className="mt-3">
            <RecentActivityCard
              events={activity}
              loading={activityLoading}
              onEventPress={(link) => router.push(link as never)}
            />
          </View>
        </Animated.View>

        {/* Hızlı Aksiyon */}
        <Animated.View entering={FadeInUp.delay(240).duration(350)} className="mt-6 px-5">
          <SectionHeader title="Hızlı Aksiyon" />
          <View className="mt-3">
            <QuickActionGrid
              onGenerateQuestion={() => router.push('/(teacher)/questions' as never)}
              onCreateAssignment={() => router.push('/(teacher)/assignments/create' as never)}
              onCreateAnnouncement={() => router.push('/(teacher)/announcements' as never)}
              onOpenStudents={() => router.push('/(teacher)/classes' as never)}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

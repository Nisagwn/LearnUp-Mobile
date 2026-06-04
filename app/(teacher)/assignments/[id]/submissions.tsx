import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, ClipboardCheck, CheckCircle2, Clock } from 'lucide-react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { getAssignment, type TeacherAssignment } from '@/services/assignmentsApi';
import {
  subscribeAssignmentSubmissions,
  type Submission,
} from '@/services/assignmentSubmissionsApi';

interface StudentBrief {
  id: string;
  name: string;
}

function relativeDate(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return 'az önce';
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export default function AssignmentSubmissions() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [studentMap, setStudentMap] = useState<Record<string, StudentBrief>>({});
  const [loading, setLoading] = useState(true);
  const [classStudents, setClassStudents] = useState<number>(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const a = await getAssignment(id);
        if (cancelled) return;
        setAssignment(a);
      } catch (err) {
        if (!cancelled) console.warn('assignment fetch:', (err as Error).message);
      }
    })();

    const unsub = subscribeAssignmentSubmissions(id, (arr) => {
      setSubmissions(arr);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [id]);

  // Öğretmenin sınıfındaki öğrenci isimlerini submissions'ın studentId'lerinden çek
  useEffect(() => {
    if (submissions.length === 0) return;
    const ids = Array.from(new Set(submissions.map((s) => s.studentId))).filter(
      (sid) => !!sid && !studentMap[sid],
    );
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        // in clause max 10
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
        const next: Record<string, StudentBrief> = {};
        for (const chunk of chunks) {
          const snap = await getDocs(
            query(collection(db, 'users'), where('__name__', 'in', chunk)),
          );
          snap.forEach((d) => {
            const data = d.data() as { name?: string; fullName?: string; email?: string };
            next[d.id] = {
              id: d.id,
              name: data.name || data.fullName || data.email?.split('@')[0] || 'Öğrenci',
            };
          });
        }
        if (!cancelled) setStudentMap((prev) => ({ ...prev, ...next }));
      } catch (err) {
        if (!cancelled) console.warn('student names:', (err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submissions, studentMap]);

  // Sınıf öğrenci sayısını teacher'a göre çek (assignment.teacherId yoksa, submission teacherId'sinden)
  useEffect(() => {
    const teacherId = submissions[0]?.teacherId;
    if (!teacherId) return;
    let cancelled = false;
    (async () => {
      const snap = await getDocs(
        query(
          collection(db, 'users'),
          where('teacherId', '==', teacherId),
          where('role', '==', 'student'),
        ),
      );
      if (!cancelled) setClassStudents(snap.size);
    })();
    return () => {
      cancelled = true;
    };
  }, [submissions]);

  const submittedCount = submissions.length;
  const reviewedCount = submissions.filter((s) => s.status === 'reviewed').length;
  const maxScore = assignment?.maxScore ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="flex-row items-center px-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-2 active:opacity-60">
          <ChevronLeft color="#475569" size={22} />
        </Pressable>
        <Text className="ml-1 text-lg font-bold text-text-primary" numberOfLines={1}>
          Teslimler
        </Text>
      </View>

      <View className="px-5 pt-1">
        <Text className="text-2xl font-bold text-text-primary" numberOfLines={1}>
          {assignment?.title || 'Ödev'}
        </Text>
        <View className="mt-2 flex-row items-center">
          <ClipboardCheck color="#4F46E5" size={14} />
          <Text className="ml-1.5 text-xs text-text-muted">
            {submittedCount}
            {classStudents > 0 ? ` / ${classStudents}` : ''} teslim ·{' '}
            {reviewedCount} incelendi
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 8 }}
          ListEmptyComponent={
            <EmptyState
              icon={ClipboardCheck}
              title="Henüz teslim yok"
              subtitle="Öğrencilerin gönderimleri burada görünecek."
            />
          }
          renderItem={({ item }) => {
            const student = studentMap[item.studentId];
            const isReviewed = item.status === 'reviewed';
            const scoreDisplay = `${item.score}/${maxScore || item.answers.length}`;
            return (
              <Card
                onPress={() =>
                  router.push(
                    `/(teacher)/assignments/${id}/review/${item.id}` as never,
                  )
                }
              >
                <View className="flex-row items-center">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                      {student?.name || 'Öğrenci'}
                    </Text>
                    <View className="mt-1 flex-row items-center" style={{ gap: 8 }}>
                      <View className="flex-row items-center">
                        {isReviewed ? (
                          <CheckCircle2 color="#16A34A" size={11} />
                        ) : (
                          <Clock color="#D97706" size={11} />
                        )}
                        <Text
                          className={`ml-1 text-[11px] font-semibold ${
                            isReviewed ? 'text-success' : 'text-warning'
                          }`}
                        >
                          {isReviewed ? 'İncelendi' : 'Bekliyor'}
                        </Text>
                      </View>
                      <Text className="text-[11px] text-text-muted">
                        {relativeDate(item.submittedAtMs)}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-lg font-bold text-text-primary">{scoreDisplay}</Text>
                    <ChevronRight color="#94A3B8" size={16} />
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

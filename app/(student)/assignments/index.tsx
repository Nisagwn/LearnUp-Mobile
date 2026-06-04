import { useContext, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import {
  ClipboardList,
  ChevronRight,
  Calendar,
  ChevronLeft,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { lottie } from '@/constants/lottie';

interface Assignment {
  id: string;
  title?: string;
  description?: string;
  subject?: string;
  dueDate?: { toDate?: () => Date } | string;
  teacherId?: string;
  questionIds?: string[];
}

interface SubmissionBrief {
  assignmentId: string;
  status: 'submitted' | 'reviewed';
  score?: number;
}

function formatDue(due: Assignment['dueDate']): string | null {
  if (!due) return null;
  try {
    const date = typeof due === 'string' ? new Date(due) : due.toDate?.();
    if (!date) return null;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  } catch {
    return null;
  }
}

export default function AssignmentsList() {
  const router = useRouter();
  const safeBack = useSafeBack('/(student)/profile');
  const ctx = useContext(UserStatsContext);
  const teacherId: string | undefined = ctx?.userProfile?.teacherId;
  const [items, setItems] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, SubmissionBrief>>({});
  const [loading, setLoading] = useState(true);

  // Ödevler
  useEffect(() => {
    if (!teacherId) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'assignments'), where('teacherId', '==', teacherId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Assignment[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as Assignment));
        setItems(arr);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [teacherId]);

  // Submission durumları
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'assignment_submissions'), where('studentId', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, SubmissionBrief> = {};
      snap.forEach((d) => {
        const data = d.data() as { assignmentId?: string; status?: string; score?: number };
        if (typeof data.assignmentId === 'string') {
          map[data.assignmentId] = {
            assignmentId: data.assignmentId,
            status: data.status === 'reviewed' ? 'reviewed' : 'submitted',
            score: typeof data.score === 'number' ? data.score : undefined,
          };
        }
      });
      setSubmissions(map);
    });
    return unsub;
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="px-3 pt-2">
        <Pressable onPress={safeBack} className="self-start p-2 active:opacity-60">
          <ChevronLeft color="#475569" size={22} />
        </Pressable>
      </View>
      <View className="px-5 pt-2">
        <Text className="text-3xl font-bold text-text-primary">Ödevlerim</Text>
        <Text className="mt-1 text-sm text-text-muted">{items.length} ödev</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 8 }}
          ListEmptyComponent={
            <EmptyState
              lottieSource={lottie.empty}
              icon={ClipboardList}
              title={teacherId ? 'Henüz ödev yok' : 'Bir sınıfa katılmadın'}
              subtitle={teacherId ? 'Öğretmenin ödev gönderince burada görünecek' : undefined}
            />
          }
          renderItem={({ item }) => {
            const due = formatDue(item.dueDate);
            const sub = submissions[item.id];
            return (
              <Card onPress={() => router.push(`/(student)/assignments/${item.id}` as never)}>
                <View className="flex-row items-center">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
                      {item.title ?? 'Başlıksız'}
                    </Text>
                    <View className="mt-1 flex-row items-center" style={{ gap: 8 }}>
                      {item.subject ? (
                        <Text className="text-[10px] uppercase tracking-wide text-accent-fg">
                          {item.subject}
                        </Text>
                      ) : null}
                      {sub ? (
                        <View className="flex-row items-center">
                          {sub.status === 'reviewed' ? (
                            <CheckCircle2 color="#16A34A" size={11} />
                          ) : (
                            <Clock color="#D97706" size={11} />
                          )}
                          <Text
                            className={`ml-1 text-[10px] font-semibold ${
                              sub.status === 'reviewed' ? 'text-success' : 'text-warning'
                            }`}
                          >
                            {sub.status === 'reviewed'
                              ? typeof sub.score === 'number'
                                ? `İncelendi · ${sub.score} puan`
                                : 'İncelendi'
                              : 'Gönderildi'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {due ? (
                      <View className="mt-2 flex-row items-center">
                        <Calendar color="#94A3B8" size={11} />
                        <Text className="ml-1 text-xs text-text-muted">{due}</Text>
                      </View>
                    ) : null}
                  </View>
                  <ChevronRight color="#94A3B8" size={20} />
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

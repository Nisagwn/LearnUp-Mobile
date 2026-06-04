import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  ChevronLeft,
  Trophy,
  Target,
  Flame,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Sparkles,
  Clock,
  Trash2,
} from 'lucide-react-native';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Card } from '@/components/common/Card';
import { StatTile } from '@/components/common/StatTile';
import { SectionHeader } from '@/components/common/SectionHeader';
import { WeeklyChart } from '@/components/home/WeeklyChart';
import { WeakTopicsCard } from '@/components/teacher/WeakTopicsCard';
import { StudentSubjectBreakdown } from '@/components/teacher/StudentSubjectBreakdown';
import { StudentRecentMistakes } from '@/components/teacher/StudentRecentMistakes';
import { TargetedAssignSheet } from '@/components/teacher/TargetedAssignSheet';
import { fetchStudentAnalytics, type StudentAnalytics } from '@/services/studentAnalyticsApi';
import {
  subscribeStudentTargetedAssignments,
  deleteTargetedAssignment,
  type TargetedAssignment,
} from '@/services/targetedAssignmentsApi';

interface StudentDoc {
  name?: string;
  fullName?: string;
  email?: string;
  grade?: string;
  gamification?: { xp?: number; streak?: { count?: number }; league?: { tier?: string } };
}

export default function StudentDetail() {
  const safeBack = useSafeBack('/(teacher)/classes');
  const { id } = useLocalSearchParams<{ id: string }>();
  const [student, setStudent] = useState<StudentDoc | null>(null);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetedHistory, setTargetedHistory] = useState<TargetedAssignment[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // Öğrenci profil çek — analitik hatadan bağımsız
      try {
        const userSnap = await getDoc(doc(db, 'users', id));
        if (cancelled) return;
        if (userSnap.exists()) setStudent(userSnap.data() as StudentDoc);
      } catch (err) {
        console.warn('student doc:', (err as Error).message);
      }
      // Analitik ayrı — patlasa bile öğrenci görünür
      try {
        const anal = await fetchStudentAnalytics(id);
        if (cancelled) return;
        setAnalytics(anal);
      } catch (err) {
        console.warn('student analytics:', (err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Hedefli atama geçmişi
  useEffect(() => {
    if (!id) return;
    const unsub = subscribeStudentTargetedAssignments(id, setTargetedHistory);
    return () => {
      if (unsub) unsub();
    };
  }, [id]);

  const name = student?.name ?? student?.fullName ?? student?.email?.split('@')[0] ?? 'Öğrenci';
  const grade = student?.grade;
  const xp = student?.gamification?.xp ?? 0;
  const streak = student?.gamification?.streak?.count ?? 0;
  const tier = student?.gamification?.league?.tier ?? 'bronze';

  const totalSolved = analytics?.totalSolved ?? 0;
  const totalCorrect = analytics?.totalCorrect ?? 0;
  const totalWrong = analytics?.totalWrong ?? 0;
  const successRate = analytics?.successRate ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <Pressable
        onPress={safeBack}
        className="ml-3 mt-2 flex-row items-center self-start p-2 active:opacity-60"
      >
        <ChevronLeft color="#475569" size={20} />
        <Text className="ml-1 text-sm text-text-secondary">Geri</Text>
      </Pressable>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : !student ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-text-muted">Öğrenci bulunamadı</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <Text className="mt-2 text-2xl font-bold text-text-primary">{name}</Text>
          {student.email ? (
            <Text className="mt-1 text-sm text-text-muted">{student.email}</Text>
          ) : null}
          {grade ? (
            <View className="mt-2 self-start rounded-full bg-accent-soft px-2.5 py-1">
              <Text className="text-[11px] font-semibold text-accent-fg">{grade}. sınıf</Text>
            </View>
          ) : null}

          {/* Gamification + başarı stat'ları */}
          <View className="mt-6" style={{ gap: 12 }}>
            <View className="flex-row" style={{ gap: 12 }}>
              <StatTile icon={TrendingUp} label="XP" value={xp} iconColor="#6366F1" />
              <StatTile icon={Flame} label="Gün seri" value={streak} iconColor="#F97316" />
            </View>
            <View className="flex-row" style={{ gap: 12 }}>
              <View className="flex-1 rounded-2xl border border-border-soft bg-bg-surface p-4">
                <Trophy color="#D97706" size={20} />
                <Text className="mt-2 text-base font-bold capitalize text-text-primary">
                  {tier}
                </Text>
                <Text className="text-xs text-text-muted">Lig</Text>
              </View>
              <StatTile icon={Target} label="Başarı" value={`%${successRate}`} iconColor="#16A34A" />
            </View>
            <View className="flex-row" style={{ gap: 12 }}>
              <StatTile
                icon={CheckCircle2}
                label="Doğru (30g)"
                value={totalCorrect}
                iconColor="#16A34A"
              />
              <StatTile
                icon={XCircle}
                label="Yanlış (30g)"
                value={totalWrong}
                iconColor="#DC2626"
              />
            </View>
          </View>

          {/* Hedefli atama CTA — istatistikler hemen altında, kolay erişim */}
          <View className="mt-6">
            <Pressable
              onPress={() => setSheetOpen(true)}
              className="flex-row items-center rounded-2xl border border-accent/30 bg-accent-soft p-4 active:opacity-90"
            >
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-accent">
                <Sparkles color="white" size={20} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-text-primary">
                  Bu öğrenciye soru ata
                </Text>
                <Text className="text-xs text-text-muted">
                  Zayıf alt-konulara özel mini soru seti (AI veya havuz)
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Haftalık aktivite */}
          <View className="mt-8">
            <SectionHeader title="Haftalık Aktivite" />
            <View className="mt-3">
              <WeeklyChart data={analytics?.weeklyActivity ?? []} />
            </View>
          </View>

          {/* Ders kırılımı */}
          <View className="mt-8">
            <SectionHeader title="Ders Kırılımı" />
            <View className="mt-3">
              <StudentSubjectBreakdown
                items={analytics?.subjectBreakdown ?? []}
                emptyText={
                  totalSolved === 0
                    ? 'Öğrenci henüz soru çözmemiş.'
                    : 'Bu dönem için ders kırılımı yok.'
                }
              />
            </View>
          </View>

          {/* Zayıf konular */}
          <View className="mt-8">
            <SectionHeader title="En Zayıf Konular" />
            <View className="mt-3">
              <WeakTopicsCard topics={analytics?.weakTopics ?? []} />
            </View>
          </View>

          {/* Son yanlışlar */}
          <View className="mt-8">
            <SectionHeader title="Son Yanlışlar" />
            <View className="mt-3">
              <StudentRecentMistakes
                items={analytics?.recentMistakes ?? []}
                emptyText={
                  totalSolved === 0
                    ? 'Öğrenci henüz soru çözmemiş.'
                    : 'Görüntülenecek yanlış soru bulunmuyor (eski kartlar metinsiz olabilir).'
                }
              />
            </View>
          </View>

          {/* Geçmiş hedefli atamalar */}
          {targetedHistory.length > 0 ? (
            <View className="mt-8">
              <SectionHeader title="Verilen Setler" />
              <View className="mt-3" style={{ gap: 8 }}>
                {targetedHistory.map((t) => {
                  const isDone = t.status === 'completed';
                  const dateLabel = new Date(t.createdAtMs).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                  });
                  const askDelete = () => {
                    Alert.alert(
                      'Seti sil',
                      `${t.subject} setini silmek istiyor musun? Öğrenciden de kalkar.`,
                      [
                        { text: 'Vazgeç', style: 'cancel' },
                        {
                          text: 'Sil',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await deleteTargetedAssignment(t.id);
                            } catch (err) {
                              Alert.alert('Hata', (err as Error).message);
                            }
                          },
                        },
                      ],
                    );
                  };
                  return (
                    <Card key={t.id}>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text
                            className="text-sm font-semibold text-text-primary"
                            numberOfLines={1}
                          >
                            {t.subject}
                            {t.focusSubTopics.length > 0
                              ? ` · ${t.focusSubTopics.slice(0, 2).join(', ')}`
                              : ''}
                          </Text>
                          <View className="mt-1 flex-row items-center" style={{ gap: 8 }}>
                            <Text className="text-[10px] text-text-muted">
                              {t.questionIds.length} soru · {t.difficulty} · {dateLabel}
                            </Text>
                            <View className="flex-row items-center">
                              {isDone ? (
                                <CheckCircle2 color="#16A34A" size={11} />
                              ) : (
                                <Clock color="#D97706" size={11} />
                              )}
                              <Text
                                className={`ml-1 text-[10px] font-semibold ${
                                  isDone ? 'text-success' : 'text-warning'
                                }`}
                              >
                                {isDone
                                  ? `Bitti · ${t.score}/${t.questionIds.length}`
                                  : 'Aktif'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Pressable
                          onPress={askDelete}
                          hitSlop={8}
                          className="ml-2 p-1 active:opacity-60"
                        >
                          <Trash2 color="#DC2626" size={14} />
                        </Pressable>
                      </View>
                      {t.rationale ? (
                        <Text className="mt-2 text-[11px] italic text-text-muted">
                          {t.rationale}
                        </Text>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      <TargetedAssignSheet
        visible={sheetOpen}
        studentId={id ?? ''}
        studentName={name}
        defaultSubject={analytics?.subjectBreakdown[0]?.label}
        suggestedSubTopics={(analytics?.weakTopics ?? []).map((w) => w.subTopic).slice(0, 5)}
        onClose={() => setSheetOpen(false)}
        onCreated={() => {
          setSheetOpen(false);
          Alert.alert('Set Hazır', 'Soru seti öğrenciye gönderildi ve bildirim atıldı.');
        }}
      />
    </SafeAreaView>
  );
}

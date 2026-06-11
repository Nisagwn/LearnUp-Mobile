import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import Animated, { FadeIn } from 'react-native-reanimated';
import { db } from '@/services/firebase';
import {
  ChevronLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react-native';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Card } from '@/components/common/Card';
import { PressableScale } from '@/components/common/PressableScale';
import { MathRenderer } from '@/components/quiz/MathRenderer';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getAssignment, type TeacherAssignment } from '@/services/assignmentsApi';
import {
  getMySubmission,
  submitAssignment,
  type Submission,
} from '@/services/assignmentSubmissionsApi';

interface QuestionItem {
  id: string;
  question: string;
  options: string[];
}

interface RawQuestion {
  question?: string;
  question_text?: string;
  text?: string;
  options?: unknown;
  choices?: unknown;
}

function formatDue(ms: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AssignmentDetail() {
  const safeBack = useSafeBack('/(student)/assignments');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useThemeColors();

  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [a, sub] = await Promise.all([getAssignment(id), getMySubmission(id)]);
        if (cancelled) return;
        setAssignment(a);
        setSubmission(sub);

        if (a?.questionIds && a.questionIds.length > 0) {
          const arr: QuestionItem[] = [];
          await Promise.all(
            a.questionIds.map(async (qid) => {
              try {
                const qsnap = await getDoc(doc(db, 'questions', qid));
                if (!qsnap.exists()) return;
                const raw = qsnap.data() as RawQuestion;
                const options = Array.isArray(raw.options)
                  ? (raw.options as unknown[]).filter((c): c is string => typeof c === 'string')
                  : Array.isArray(raw.choices)
                    ? (raw.choices as unknown[]).filter((c): c is string => typeof c === 'string')
                    : [];
                arr.push({
                  id: qid,
                  question: raw.text || raw.question_text || raw.question || '',
                  options,
                });
              } catch {
                /* ignore */
              }
            }),
          );
          const ordered = a.questionIds
            .map((qid) => arr.find((q) => q.id === qid))
            .filter((q): q is QuestionItem => !!q);
          if (!cancelled) setQuestions(ordered);
        }
      } catch (err) {
        if (!cancelled) console.warn('assignment fetch:', (err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const alreadySubmitted = !!submission;
  const isQuiz = assignment?.submissionType === 'quiz' && questions.length > 0;
  const maxScore = assignment?.maxScore || questions.length || 0;
  const answeredCount = useMemo(
    () => questions.filter((q) => q.id in selectedMap).length,
    [questions, selectedMap],
  );

  const doSubmit = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const answers = questions.map((q) => ({
        questionId: q.id,
        selectedIndex: q.id in selectedMap ? selectedMap[q.id]! : -1,
      }));
      const result = await submitAssignment({ assignmentId: id, answers });
      Alert.alert(
        'Gönderildi',
        `${result.autoScore}/${result.maxScore} doğru. Öğretmen değerlendirmesi sonrası nihai puanın belli olacak.`,
        [{ text: 'Tamam', onPress: () => safeBack() }],
      );
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!id || submitting) return;
    const unanswered = questions.filter((q) => !(q.id in selectedMap));
    if (unanswered.length > 0) {
      Alert.alert(
        'Eksik cevap',
        `${unanswered.length} soruya cevap vermedin. Yine de göndermek istiyor musun?`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Gönder', onPress: doSubmit },
        ],
      );
      return;
    }
    doSubmit();
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!assignment) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-text-muted">Ödev bulunamadı</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Üst başlık (her durumda)
  const Header = (
    <Pressable
      onPress={safeBack}
      className="ml-3 mt-2 flex-row items-center self-start p-2 active:opacity-60"
    >
      <ChevronLeft color={colors.textSecondary} size={20} />
      <Text className="ml-1 text-sm text-text-secondary">Geri</Text>
    </Pressable>
  );

  // Quiz değil → bilgi + (varsa) sonuç
  if (!isQuiz) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        {Header}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <Text className="mt-2 text-2xl font-bold text-text-primary">{assignment.title}</Text>
          {assignment.subject ? (
            <Text className="mt-2 text-xs uppercase tracking-wide text-accent-fg">
              {assignment.subject}
            </Text>
          ) : null}
          {assignment.dueDateMs ? (
            <View className="mt-3 flex-row items-center">
              <Calendar color={colors.textMuted} size={14} />
              <Text className="ml-1 text-xs text-text-muted">
                Bitiş: {formatDue(assignment.dueDateMs)}
              </Text>
            </View>
          ) : null}
          {assignment.description ? (
            <View className="mt-5">
              <Card>
                <Text className="text-base leading-6 text-text-primary">
                  {assignment.description}
                </Text>
              </Card>
            </View>
          ) : null}
          {alreadySubmitted ? <SubmittedBanner submission={submission} maxScore={maxScore} /> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const q = questions[current]!;
  const submittedAns = submission?.answers.find((a) => a.questionId === q.id);
  const lockedSel = alreadySubmitted && submittedAns ? submittedAns.selectedIndex : null;
  const currentSel =
    lockedSel !== null ? lockedSel : q.id in selectedMap ? selectedMap[q.id]! : -1;
  const isLast = current === questions.length - 1;
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      {Header}

      {/* Başlık + ilerleme */}
      <View className="px-5 pt-1">
        <Text className="text-lg font-bold text-text-primary" numberOfLines={1}>
          {assignment.title}
        </Text>
        <View className="mt-2 flex-row items-center">
          <View className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
            <View
              className="h-2 rounded-full bg-accent"
              style={{ width: `${progress}%` }}
            />
          </View>
          <Text className="ml-3 text-xs font-semibold text-text-secondary">
            {current + 1}/{questions.length}
          </Text>
        </View>
        {!alreadySubmitted ? (
          <Text className="mt-1 text-[11px] text-text-muted">
            {answeredCount}/{questions.length} işaretlendi
          </Text>
        ) : null}
      </View>

      {alreadySubmitted ? (
        <View className="px-5 pt-2">
          <SubmittedBanner submission={submission} maxScore={maxScore} compact />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 }}
      >
        <Animated.View key={q.id} entering={FadeIn.duration(220)}>
          <Card variant="elevated">
            <Text className="text-xs font-semibold uppercase tracking-wide text-accent-fg">
              Soru {current + 1}
            </Text>
            <View className="mt-2">
              <MathRenderer content={q.question} fontSize={16} color={colors.textPrimary} />
            </View>
          </Card>

          <View className="mt-3" style={{ gap: 8 }}>
            {q.options.map((opt, i) => {
              const isSel = currentSel === i;
              // Gönderildi → seçilen şıkkı doğru/yanlış renklендir
              let stateClass = 'border-border-soft bg-bg-surface';
              if (isSel) {
                if (alreadySubmitted && submittedAns) {
                  stateClass = submittedAns.isCorrect
                    ? 'border-success bg-success-soft'
                    : 'border-danger bg-danger-soft';
                } else {
                  stateClass = 'border-accent bg-accent-soft';
                }
              }
              return (
                <PressableScale
                  key={i}
                  disabled={alreadySubmitted}
                  haptic={!alreadySubmitted}
                  onPress={() => setSelectedMap((prev) => ({ ...prev, [q.id]: i }))}
                  className={`flex-row items-center rounded-2xl border px-3 py-3 ${stateClass}`}
                >
                  <View
                    className={`mr-3 h-8 w-8 items-center justify-center rounded-full border ${
                      isSel ? 'border-accent bg-accent' : 'border-border-soft bg-bg-base'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${isSel ? 'text-white' : 'text-text-muted'}`}
                    >
                      {String.fromCharCode(65 + i)}
                    </Text>
                  </View>
                  <Text className="flex-1 text-sm text-text-primary">{opt}</Text>
                  {isSel && alreadySubmitted && submittedAns ? (
                    submittedAns.isCorrect ? (
                      <CheckCircle2 color={colors.success} size={18} />
                    ) : (
                      <XCircle color={colors.danger} size={18} />
                    )
                  ) : null}
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Alt gezinme çubuğu */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border-soft bg-bg-base px-5 pb-8 pt-3">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Pressable
            onPress={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className={`h-12 w-12 items-center justify-center rounded-2xl border border-border-soft ${
              current === 0 ? 'opacity-40' : 'active:bg-bg-elevated'
            }`}
          >
            <ArrowLeft color={colors.textSecondary} size={20} />
          </Pressable>

          {isLast ? (
            alreadySubmitted ? (
              <Pressable
                onPress={() => safeBack()}
                className="h-12 flex-1 items-center justify-center rounded-2xl bg-accent active:opacity-80"
              >
                <Text className="text-base font-bold text-white">Bitir</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSubmit}
                disabled={submitting}
                className={`h-12 flex-1 flex-row items-center justify-center rounded-2xl ${
                  submitting ? 'bg-bg-elevated' : 'bg-accent'
                } active:opacity-80`}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Send color="white" size={16} />
                    <Text className="ml-2 text-base font-bold text-white">Cevapları Gönder</Text>
                  </>
                )}
              </Pressable>
            )
          ) : (
            <Pressable
              onPress={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
              className="h-12 flex-1 flex-row items-center justify-center rounded-2xl bg-accent active:opacity-80"
            >
              <Text className="mr-1.5 text-base font-bold text-white">İleri</Text>
              <ArrowRight color="white" size={18} />
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function SubmittedBanner({
  submission,
  maxScore,
  compact,
}: {
  submission: Submission | null;
  maxScore: number;
  compact?: boolean;
}) {
  const { colors } = useThemeColors();
  if (!submission) return null;
  const reviewed = submission.status === 'reviewed';
  return (
    <View
      className={`rounded-2xl border border-success/30 bg-success-soft ${compact ? 'p-3' : 'mt-5 p-4'}`}
    >
      <View className="flex-row items-center">
        {reviewed ? (
          <CheckCircle2 color={colors.success} size={16} />
        ) : (
          <Clock color={colors.warning} size={16} />
        )}
        <Text className="ml-2 text-sm font-semibold text-text-primary">
          {reviewed
            ? `Değerlendirildi · ${submission.score}/${maxScore}`
            : `Gönderildi · Otomatik: ${submission.autoScore}/${maxScore}`}
        </Text>
      </View>
      {submission.feedback ? (
        <View className="mt-3 flex-row items-start">
          <MessageSquare color={colors.textSecondary} size={14} />
          <Text className="ml-2 flex-1 text-sm leading-5 text-text-primary">
            {submission.feedback}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

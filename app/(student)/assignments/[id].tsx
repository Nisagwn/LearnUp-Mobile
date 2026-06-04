import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  MessageSquare,
} from 'lucide-react-native';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Card } from '@/components/common/Card';
import { MathRenderer } from '@/components/quiz/MathRenderer';
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

  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [a, sub] = await Promise.all([getAssignment(id), getMySubmission(id)]);
        if (cancelled) return;
        setAssignment(a);
        setSubmission(sub);

        // Soruları paralel çek (eğer questionIds varsa)
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
          // questionIds sırasını koru
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

  const handleSubmit = async () => {
    if (!id || submitting) return;
    // Tüm sorulara cevap verildi mi kontrol
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
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

  const isQuiz = assignment.submissionType === 'quiz' && questions.length > 0;
  const alreadySubmitted = !!submission;
  const maxScore = assignment.maxScore || questions.length || 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <Pressable
          onPress={safeBack}
          className="ml-3 mt-2 flex-row items-center self-start p-2 active:opacity-60"
        >
          <ChevronLeft color="#475569" size={20} />
          <Text className="ml-1 text-sm text-text-secondary">Geri</Text>
        </Pressable>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}>
          <Text className="mt-2 text-2xl font-bold text-text-primary">{assignment.title}</Text>
          {assignment.subject ? (
            <Text className="mt-2 text-xs uppercase tracking-wide text-accent-fg">
              {assignment.subject}
            </Text>
          ) : null}
          {assignment.dueDateMs ? (
            <View className="mt-3 flex-row items-center">
              <Calendar color="#94A3B8" size={14} />
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

          {/* Submission durumu */}
          {alreadySubmitted ? (
            <View className="mt-5 rounded-2xl border border-success/30 bg-success-soft p-4">
              <View className="flex-row items-center">
                {submission.status === 'reviewed' ? (
                  <CheckCircle2 color="#16A34A" size={16} />
                ) : (
                  <Clock color="#D97706" size={16} />
                )}
                <Text className="ml-2 text-sm font-semibold text-text-primary">
                  {submission.status === 'reviewed'
                    ? `Değerlendirildi · ${submission.score}/${maxScore}`
                    : `Gönderildi · Otomatik: ${submission.autoScore}/${maxScore}`}
                </Text>
              </View>
              {submission.feedback ? (
                <View className="mt-3 flex-row items-start">
                  <MessageSquare color="#475569" size={14} />
                  <Text className="ml-2 flex-1 text-sm leading-5 text-text-primary">
                    {submission.feedback}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Sorular */}
          {isQuiz ? (
            <View className="mt-6">
              <Text className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Sorular ({questions.length})
              </Text>
              <View className="mt-2" style={{ gap: 10 }}>
                {questions.map((q, idx) => {
                  const submittedAns = submission?.answers.find((a) => a.questionId === q.id);
                  const lockedSelection =
                    alreadySubmitted && submittedAns ? submittedAns.selectedIndex : null;
                  const currentSel =
                    lockedSelection !== null
                      ? lockedSelection
                      : q.id in selectedMap
                        ? selectedMap[q.id]!
                        : -1;
                  return (
                    <Card key={q.id}>
                      <Text className="text-xs font-semibold text-text-muted">
                        Soru {idx + 1}
                      </Text>
                      <View className="mt-2">
                        <MathRenderer content={q.question} fontSize={14} color="#0F172A" />
                      </View>
                      <View className="mt-3" style={{ gap: 6 }}>
                        {q.options.map((opt, i) => {
                          const isSel = currentSel === i;
                          return (
                            <Pressable
                              key={i}
                              disabled={alreadySubmitted}
                              onPress={() =>
                                setSelectedMap((prev) => ({ ...prev, [q.id]: i }))
                              }
                              className={`flex-row items-center rounded-xl border px-3 py-2.5 ${
                                isSel
                                  ? 'border-accent bg-accent-soft'
                                  : 'border-border-soft bg-bg-surface'
                              } ${alreadySubmitted ? 'opacity-80' : ''}`}
                            >
                              <View
                                className={`mr-2.5 h-7 w-7 items-center justify-center rounded-full border ${
                                  isSel
                                    ? 'border-accent bg-accent'
                                    : 'border-border-soft bg-bg-base'
                                }`}
                              >
                                <Text
                                  className={`text-[11px] font-bold ${
                                    isSel ? 'text-white' : 'text-text-muted'
                                  }`}
                                >
                                  {String.fromCharCode(65 + i)}
                                </Text>
                              </View>
                              <Text className="flex-1 text-sm text-text-primary">{opt}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </Card>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Gönder CTA — sadece quiz ödev + henüz gönderilmediyse */}
        {isQuiz && !alreadySubmitted ? (
          <View className="absolute bottom-0 left-0 right-0 border-t border-border-soft bg-bg-base px-5 pb-8 pt-3">
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              className={`flex-row items-center justify-center rounded-xl py-4 active:opacity-80 ${
                submitting ? 'bg-bg-elevated' : 'bg-accent'
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Send color="white" size={16} />
                  <Text className="ml-2 text-base font-semibold text-white">Cevapları Gönder</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

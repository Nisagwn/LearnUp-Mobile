import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, CheckCircle2, XCircle, Save, MinusCircle } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { Card } from '@/components/common/Card';
import { MathRenderer } from '@/components/quiz/MathRenderer';
import {
  getSubmission,
  reviewSubmission,
  type Submission,
  type SubmissionAnswer,
} from '@/services/assignmentSubmissionsApi';
import { getAssignment, type TeacherAssignment } from '@/services/assignmentsApi';

interface QuestionDetail {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

interface RawQuestion {
  question?: string;
  question_text?: string;
  text?: string;
  options?: unknown;
  choices?: unknown;
  correctIndex?: number;
  answer?: number;
  correctAnswer?: string;
  correct_answer?: string;
}

function resolveCorrectIndex(d: RawQuestion, options: string[]): number {
  if (typeof d.correctIndex === 'number' && d.correctIndex >= 0 && d.correctIndex < options.length) {
    return d.correctIndex;
  }
  if (typeof d.answer === 'number' && d.answer >= 0 && d.answer < options.length) return d.answer;
  const raw = d.correctAnswer || d.correct_answer;
  if (typeof raw === 'string') {
    const exact = options.findIndex((o) => o.trim() === raw.trim());
    if (exact >= 0) return exact;
    if (raw.length <= 3) {
      const letter = raw.toUpperCase().charAt(0);
      const idx = letter.charCodeAt(0) - 65;
      if (idx >= 0 && idx < options.length) return idx;
    }
  }
  return -1;
}

export default function ReviewSubmission() {
  const router = useRouter();
  const { id: assignmentId, submissionId } = useLocalSearchParams<{
    id: string;
    submissionId: string;
  }>();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [assignment, setAssignment] = useState<TeacherAssignment | null>(null);
  const [questions, setQuestions] = useState<Record<string, QuestionDetail>>({});
  const [studentName, setStudentName] = useState<string>('Öğrenci');
  const [feedback, setFeedback] = useState('');
  const [scoreText, setScoreText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!submissionId || !assignmentId) return;
    let cancelled = false;
    (async () => {
      try {
        const [s, a] = await Promise.all([
          getSubmission(submissionId),
          getAssignment(assignmentId),
        ]);
        if (cancelled) return;
        setSubmission(s);
        setAssignment(a);
        if (s) {
          setFeedback(s.feedback);
          setScoreText(String(s.score));
          // Öğrenci adı
          try {
            const stuSnap = await getDoc(doc(db, 'users', s.studentId));
            if (stuSnap.exists()) {
              const data = stuSnap.data() as { name?: string; fullName?: string; email?: string };
              setStudentName(
                data.name || data.fullName || data.email?.split('@')[0] || 'Öğrenci',
              );
            }
          } catch {
            /* ignore */
          }
          // Soruları paralel çek
          const qIds = s.answers.map((a) => a.questionId);
          const qMap: Record<string, QuestionDetail> = {};
          await Promise.all(
            qIds.map(async (qid) => {
              try {
                const qsnap = await getDoc(doc(db, 'questions', qid));
                if (!qsnap.exists()) return;
                const raw = qsnap.data() as RawQuestion;
                const options = Array.isArray(raw.options)
                  ? (raw.options as unknown[]).filter((c): c is string => typeof c === 'string')
                  : Array.isArray(raw.choices)
                    ? (raw.choices as unknown[]).filter((c): c is string => typeof c === 'string')
                    : [];
                qMap[qid] = {
                  id: qid,
                  question: raw.text || raw.question_text || raw.question || '',
                  options,
                  correctIndex: resolveCorrectIndex(raw, options),
                };
              } catch {
                /* ignore */
              }
            }),
          );
          if (!cancelled) setQuestions(qMap);
        }
      } catch (err) {
        if (!cancelled) console.warn('review fetch:', (err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submissionId, assignmentId]);

  const handleSave = async () => {
    if (!submissionId || !submission) return;
    const trimmed = feedback.trim();
    const parsedScore = scoreText ? parseInt(scoreText, 10) : NaN;
    const maxScore = assignment?.maxScore ?? submission.answers.length;
    if (scoreText && (Number.isNaN(parsedScore) || parsedScore < 0 || parsedScore > maxScore)) {
      Alert.alert('Geçersiz puan', `Puan 0 ile ${maxScore} arasında olmalı.`);
      return;
    }
    setSaving(true);
    try {
      await reviewSubmission(submissionId, {
        feedback: trimmed,
        score: Number.isNaN(parsedScore) ? undefined : parsedScore,
      });
      Alert.alert('Kaydedildi', 'Değerlendirme öğrenciye iletildi.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setSaving(false);
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

  if (!submission) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-text-muted">Gönderim bulunamadı.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxScore = assignment?.maxScore ?? submission.answers.length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <View className="flex-row items-center px-3 pt-2">
          <Pressable onPress={() => router.back()} className="p-2 active:opacity-60">
            <ChevronLeft color="#475569" size={22} />
          </Pressable>
          <Text className="ml-1 text-lg font-bold text-text-primary" numberOfLines={1}>
            Değerlendirme
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <Text className="text-2xl font-bold text-text-primary">{studentName}</Text>
          <Text className="mt-1 text-sm text-text-muted">{assignment?.title ?? 'Ödev'}</Text>

          {/* Otomatik skor + manuel düzeltme */}
          <View className="mt-5 rounded-2xl border border-border-soft bg-bg-surface p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Otomatik puan
              </Text>
              <Text className="text-2xl font-bold text-text-primary">
                {submission.autoScore}/{maxScore}
              </Text>
            </View>
            <View className="mt-3">
              <Text className="text-xs font-semibold text-text-secondary">Final puan</Text>
              <TextInput
                value={scoreText}
                onChangeText={(v) => setScoreText(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder={String(submission.autoScore)}
                placeholderTextColor="#94A3B8"
                className="mt-1 rounded-xl border border-border-soft bg-bg-base px-3 py-2 text-sm text-text-primary"
              />
              <Text className="mt-1 text-[10px] text-text-muted">
                Boş bırakırsan otomatik puan kullanılır (0-{maxScore}).
              </Text>
            </View>
          </View>

          {/* Feedback */}
          <View className="mt-4">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Geri Bildirim
            </Text>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Öğrenciye not yaz (isteğe bağlı)"
              placeholderTextColor="#94A3B8"
              multiline
              className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-3 text-sm text-text-primary"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </View>

          {/* Cevaplar */}
          <Text className="mt-6 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Cevaplar
          </Text>
          <View className="mt-2" style={{ gap: 8 }}>
            {submission.answers.map((ans, i) => (
              <AnswerCard
                key={ans.questionId}
                index={i + 1}
                answer={ans}
                question={questions[ans.questionId]}
              />
            ))}
          </View>
        </ScrollView>

        {/* CTA */}
        <View className="absolute bottom-0 left-0 right-0 border-t border-border-soft bg-bg-base px-5 pb-8 pt-3">
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className={`flex-row items-center justify-center rounded-xl py-3.5 active:opacity-80 ${
              saving ? 'bg-bg-elevated' : 'bg-accent'
            }`}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Save color="white" size={16} />
                <Text className="ml-2 text-base font-semibold text-white">
                  Değerlendirmeyi Kaydet
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function AnswerCard({
  index,
  answer,
  question,
}: {
  index: number;
  answer: SubmissionAnswer;
  question: QuestionDetail | undefined;
}) {
  const isCorrect = answer.isCorrect;
  const wasEmpty = answer.selectedIndex < 0;
  const StatusIcon = wasEmpty ? MinusCircle : isCorrect ? CheckCircle2 : XCircle;
  const statusColor = wasEmpty ? '#94A3B8' : isCorrect ? '#16A34A' : '#DC2626';
  const statusLabel = wasEmpty ? 'Boş' : isCorrect ? 'Doğru' : 'Yanlış';

  // Question text — fallback'e snapshot
  const text = question?.question || answer.questionTextSnapshot || 'Soru metni yok';
  const options = question?.options ?? [];
  const correctIndex = question?.correctIndex ?? -1;

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-text-muted">Soru {index}</Text>
        <View className="flex-row items-center">
          <StatusIcon color={statusColor} size={12} />
          <Text className="ml-1 text-[11px] font-semibold" style={{ color: statusColor }}>
            {statusLabel}
          </Text>
        </View>
      </View>
      <View className="mt-2">
        <MathRenderer content={text} fontSize={13} color="#0F172A" />
      </View>
      {options.length > 0 ? (
        <View className="mt-3" style={{ gap: 6 }}>
          {options.map((opt, i) => {
            const isStudentPick = answer.selectedIndex === i;
            const isAnsCorrect = i === correctIndex;
            let color = '#475569';
            let bg = '#F8FAFC';
            if (isAnsCorrect) {
              color = '#16A34A';
              bg = '#DCFCE7';
            } else if (isStudentPick) {
              color = '#DC2626';
              bg = '#FEE2E2';
            }
            return (
              <View
                key={i}
                className="flex-row items-center rounded-lg px-2.5 py-1.5"
                style={{ backgroundColor: bg }}
              >
                <Text className="mr-2 text-[10px] font-bold" style={{ color }}>
                  {String.fromCharCode(65 + i)}
                </Text>
                <Text className="flex-1 text-xs" style={{ color }} numberOfLines={2}>
                  {opt}
                </Text>
                {isStudentPick ? (
                  <Text className="ml-2 text-[10px] font-semibold" style={{ color }}>
                    {isAnsCorrect ? '· Öğrenci ✓' : '· Öğrenci ✗'}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

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
import { ChevronLeft, Send, CheckCircle2, Sparkles } from 'lucide-react-native';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Card } from '@/components/common/Card';
import { MathRenderer } from '@/components/quiz/MathRenderer';
import {
  getTargetedAssignment,
  submitTargetedAssignment,
  type TargetedAssignment,
} from '@/services/targetedAssignmentsApi';

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

export default function TargetedAssignmentScreen() {
  const safeBack = useSafeBack('/(student)');
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<TargetedAssignment | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const ta = await getTargetedAssignment(id);
        if (cancelled) return;
        setData(ta);
        if (ta && ta.questionIds.length > 0) {
          const arr: QuestionItem[] = [];
          await Promise.all(
            ta.questionIds.map(async (qid) => {
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
          const ordered = ta.questionIds
            .map((qid) => arr.find((q) => q.id === qid))
            .filter((q): q is QuestionItem => !!q);
          if (!cancelled) setQuestions(ordered);
        }
      } catch (err) {
        if (!cancelled) console.warn('targeted fetch:', (err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const doSubmit = async () => {
    if (!id || !data) return;
    setSubmitting(true);
    try {
      const answers = questions.map((q) => ({
        questionId: q.id,
        selectedIndex: q.id in selectedMap ? selectedMap[q.id]! : -1,
      }));
      const r = await submitTargetedAssignment({ targetedAssignmentId: id, answers });
      Alert.alert('Tamamlandı', `${r.autoScore}/${r.maxScore} doğru.`, [
        { text: 'Tamam', onPress: () => safeBack() },
      ]);
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const unanswered = questions.filter((q) => !(q.id in selectedMap));
    if (unanswered.length > 0) {
      Alert.alert(
        'Eksik cevap',
        `${unanswered.length} soruya cevap vermedin. Yine de gönder?`,
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
          <ActivityIndicator color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-text-muted">Soru seti bulunamadı.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isDone = data.status === 'completed';
  const maxScore = data.questionIds.length;

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
          <View className="mt-2 flex-row items-center">
            <Sparkles color="#4F46E5" size={18} />
            <Text className="ml-2 text-2xl font-bold text-text-primary">Sana Özel Set</Text>
          </View>
          <Text className="mt-1 text-sm text-text-muted">
            {data.subject}
            {data.focusSubTopics.length > 0
              ? ` · ${data.focusSubTopics.slice(0, 3).join(', ')}`
              : ''}
          </Text>
          <Text className="mt-1 text-xs text-text-muted">
            {maxScore} soru · {data.difficulty}
          </Text>

          {isDone ? (
            <View className="mt-4 rounded-2xl border border-success/30 bg-success-soft p-4">
              <View className="flex-row items-center">
                <CheckCircle2 color="#16A34A" size={16} />
                <Text className="ml-2 text-sm font-semibold text-text-primary">
                  Tamamlandı · {data.score}/{maxScore}
                </Text>
              </View>
            </View>
          ) : null}

          <View className="mt-6" style={{ gap: 10 }}>
            {questions.map((q, idx) => {
              const lockedAns = data.answers.find((a) => a.questionId === q.id);
              const currentSel =
                isDone && lockedAns
                  ? lockedAns.selectedIndex
                  : q.id in selectedMap
                    ? selectedMap[q.id]!
                    : -1;
              return (
                <Card key={q.id}>
                  <Text className="text-xs font-semibold text-text-muted">Soru {idx + 1}</Text>
                  <View className="mt-2">
                    <MathRenderer content={q.question} fontSize={14} color="#0F172A" />
                  </View>
                  <View className="mt-3" style={{ gap: 6 }}>
                    {q.options.map((opt, i) => {
                      const isSel = currentSel === i;
                      return (
                        <Pressable
                          key={i}
                          disabled={isDone}
                          onPress={() =>
                            setSelectedMap((prev) => ({ ...prev, [q.id]: i }))
                          }
                          className={`flex-row items-center rounded-xl border px-3 py-2.5 ${
                            isSel
                              ? 'border-accent bg-accent-soft'
                              : 'border-border-soft bg-bg-surface'
                          } ${isDone ? 'opacity-80' : ''}`}
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
        </ScrollView>

        {!isDone ? (
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

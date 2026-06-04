import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Sparkles, Check, Wand2 } from 'lucide-react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { generateQuiz, type GeneratedQuestion } from '@/services/aiService';
import type { Difficulty } from '@/types/quiz';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (count: number) => void;
};

const GRADES = ['9', '10', '11', '12'] as const;
const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Kolay' },
  { id: 'medium', label: 'Orta' },
  { id: 'hard', label: 'Zor' },
];
const COUNTS = [3, 5, 10] as const;

type Phase = 'form' | 'generating' | 'preview' | 'saving';

export function GenerateQuestionsSheet({ visible, onClose, onSaved }: Props) {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState<string>('10');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [count, setCount] = useState<number>(5);
  const [phase, setPhase] = useState<Phase>('form');
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSubject('');
      setTopic('');
      setGrade('10');
      setDifficulty('medium');
      setCount(5);
      setPhase('form');
      setQuestions([]);
      setError(null);
    }
  }, [visible]);

  const handleGenerate = async () => {
    const topicText = topic.trim() || subject.trim();
    if (!topicText) {
      setError('Lütfen ders veya konu gir.');
      return;
    }
    setError(null);
    setPhase('generating');
    try {
      const result = await generateQuiz(topicText, count, difficulty);
      if (result.length === 0) {
        setError('Soru üretilemedi, farklı bir konu dene.');
        setPhase('form');
        return;
      }
      setQuestions(result);
      setPhase('preview');
    } catch (err) {
      setError((err as Error).message);
      setPhase('form');
    }
  };

  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || questions.length === 0) return;
    setPhase('saving');
    try {
      const subj = subject.trim() || topic.trim();
      const seed = topic.trim() || subj;
      await Promise.all(
        questions.map((q) =>
          addDoc(collection(db, 'questions'), {
            teacherId: uid,
            verified: true,
            is_ai_generated: true,
            subject: subj,
            category: subj,
            topic: seed,
            sub_topic: seed,
            grade,
            difficulty,
            question_text: q.question,
            text: q.question,
            options: q.choices,
            correct_answer: q.choices[q.answer],
            correctAnswer: q.choices[q.answer],
            explanation: q.hint ?? '',
            random_seed: Math.floor(Math.random() * 1000000),
            createdAt: serverTimestamp(),
          }),
        ),
      );
      onSaved(questions.length);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setPhase('preview');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/50">
        <Pressable onPress={(e) => e.stopPropagation()} className="mt-auto rounded-t-3xl bg-bg-base">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="px-5 pb-8 pt-3">
              <View className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-soft" />
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
                  <Sparkles color="#4F46E5" size={18} />
                </View>
                <Text className="ml-3 flex-1 text-base font-semibold text-text-primary">
                  AI ile Soru Üret
                </Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
                >
                  <X color="#475569" size={14} />
                </Pressable>
              </View>

              {phase === 'form' || phase === 'generating' ? (
                <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                  <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Ders
                  </Text>
                  <TextInput
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="Örn. Matematik"
                    placeholderTextColor="#94A3B8"
                    className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
                  />

                  <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Konu (opsiyonel)
                  </Text>
                  <TextInput
                    value={topic}
                    onChangeText={setTopic}
                    placeholder="Örn. Türev — boş bırakırsan dersten karışık"
                    placeholderTextColor="#94A3B8"
                    className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
                  />

                  <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Sınıf
                  </Text>
                  <View className="mt-1.5 flex-row" style={{ gap: 8 }}>
                    {GRADES.map((g) => (
                      <Pressable
                        key={g}
                        onPress={() => setGrade(g)}
                        className={`flex-1 items-center rounded-xl border py-2 ${
                          grade === g ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                        }`}
                      >
                        <Text className={`text-sm font-semibold ${grade === g ? 'text-accent-fg' : 'text-text-muted'}`}>
                          {g}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Zorluk
                  </Text>
                  <View className="mt-1.5 flex-row" style={{ gap: 8 }}>
                    {DIFFICULTIES.map((d) => (
                      <Pressable
                        key={d.id}
                        onPress={() => setDifficulty(d.id)}
                        className={`flex-1 items-center rounded-xl border py-2 ${
                          difficulty === d.id ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                        }`}
                      >
                        <Text className={`text-sm font-semibold ${difficulty === d.id ? 'text-accent-fg' : 'text-text-muted'}`}>
                          {d.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Soru sayısı
                  </Text>
                  <View className="mt-1.5 flex-row" style={{ gap: 8 }}>
                    {COUNTS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setCount(c)}
                        className={`flex-1 items-center rounded-xl border py-2 ${
                          count === c ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                        }`}
                      >
                        <Text className={`text-sm font-semibold ${count === c ? 'text-accent-fg' : 'text-text-muted'}`}>
                          {c}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {error ? <Text className="mt-3 text-xs font-medium text-danger">{error}</Text> : null}

                  <Pressable
                    onPress={handleGenerate}
                    disabled={phase === 'generating'}
                    className={`mt-5 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
                      phase === 'generating' ? 'opacity-60' : ''
                    }`}
                  >
                    {phase === 'generating' ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Wand2 color="white" size={16} />
                    )}
                    <Text className="ml-1.5 text-sm font-bold text-white">
                      {phase === 'generating' ? 'Üretiliyor...' : 'Soru Üret'}
                    </Text>
                  </Pressable>
                </ScrollView>
              ) : (
                <View>
                  <Text className="mt-3 text-xs text-text-muted">
                    {questions.length} soru üretildi. İncele ve havuzuna ekle.
                  </Text>
                  <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false} className="mt-2">
                    {questions.map((q, qi) => (
                      <View
                        key={qi}
                        className="mt-2 rounded-2xl border border-border-soft bg-bg-surface p-3"
                      >
                        <Text className="text-sm font-medium text-text-primary">
                          {qi + 1}. {q.question}
                        </Text>
                        <View className="mt-2" style={{ gap: 4 }}>
                          {q.choices.map((c, ci) => {
                            const correct = ci === q.answer;
                            return (
                              <View
                                key={ci}
                                className={`flex-row items-center rounded-lg px-2.5 py-1.5 ${
                                  correct ? 'bg-success-soft' : 'bg-bg-elevated'
                                }`}
                              >
                                {correct ? <Check color="#16A34A" size={12} /> : null}
                                <Text
                                  className={`${correct ? 'ml-1.5 font-semibold text-success' : 'text-text-secondary'} text-xs`}
                                >
                                  {c}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  {error ? <Text className="mt-2 text-xs font-medium text-danger">{error}</Text> : null}

                  <View className="mt-4 flex-row" style={{ gap: 8 }}>
                    <Pressable
                      onPress={() => setPhase('form')}
                      className="flex-1 items-center justify-center rounded-xl border border-border-soft py-3 active:opacity-80"
                    >
                      <Text className="text-sm font-semibold text-text-secondary">Yeniden Üret</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleSave}
                      disabled={phase === 'saving'}
                      className={`flex-1 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
                        phase === 'saving' ? 'opacity-60' : ''
                      }`}
                    >
                      {phase === 'saving' ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Check color="white" size={16} />
                      )}
                      <Text className="ml-1.5 text-sm font-bold text-white">
                        Havuza Ekle ({questions.length})
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

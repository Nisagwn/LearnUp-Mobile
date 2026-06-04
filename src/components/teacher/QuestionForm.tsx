import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Check, Eye, Plus, Trash2 } from 'lucide-react-native';
import { MathRenderer } from '@/components/quiz/MathRenderer';
import type { Difficulty } from '@/types/quiz';
import type { ManualQuestionInput } from '@/services/teacherQuestionsApi';

const GRADES = ['9', '10', '11', '12'] as const;
const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Kolay' },
  { id: 'medium', label: 'Orta' },
  { id: 'hard', label: 'Zor' },
];

export interface QuestionFormProps {
  initial?: Partial<ManualQuestionInput>;
  submitLabel?: string;
  loading?: boolean;
  onSubmit: (data: ManualQuestionInput) => Promise<void> | void;
}

export function QuestionForm({
  initial,
  submitLabel = 'Kaydet',
  loading = false,
  onSubmit,
}: QuestionFormProps) {
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [subTopic, setSubTopic] = useState(initial?.sub_topic ?? '');
  const [grade, setGrade] = useState<string>(initial?.grade ?? '10');
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'medium');
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [choices, setChoices] = useState<string[]>(
    initial?.choices && initial.choices.length >= 2 ? [...initial.choices] : ['', '', '', ''],
  );
  const [correctIndex, setCorrectIndex] = useState<number>(initial?.correctIndex ?? 0);
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [previewQ, setPreviewQ] = useState(false);

  const setChoice = (i: number, value: string) =>
    setChoices((arr) => arr.map((c, idx) => (idx === i ? value : c)));

  const addChoice = () => {
    if (choices.length >= 5) return;
    setChoices((arr) => [...arr, '']);
  };

  const removeChoice = (i: number) => {
    if (choices.length <= 2) return;
    setChoices((arr) => arr.filter((_, idx) => idx !== i));
    if (correctIndex === i) setCorrectIndex(0);
    else if (correctIndex > i) setCorrectIndex(correctIndex - 1);
  };

  const handleSubmit = async () => {
    const payload: ManualQuestionInput = {
      subject: subject.trim(),
      topic: topic.trim() || undefined,
      sub_topic: subTopic.trim() || undefined,
      grade,
      difficulty,
      question: question.trim(),
      choices: choices.map((c) => c.trim()),
      correctIndex,
      explanation: explanation.trim() || undefined,
    };
    try {
      await onSubmit(payload);
    } catch (err) {
      Alert.alert('Kaydedilemedi', (err as Error).message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Ders */}
        <Text className="text-sm font-semibold text-text-primary">Ders</Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="Örn: Matematik"
          placeholderTextColor="#94A3B8"
          className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-3 text-sm text-text-primary"
        />

        {/* Sınıf */}
        <Text className="mt-4 text-sm font-semibold text-text-primary">Sınıf</Text>
        <View className="mt-1.5 flex-row gap-2">
          {GRADES.map((g) => {
            const active = g === grade;
            return (
              <Pressable
                key={g}
                onPress={() => setGrade(g)}
                className={`flex-1 items-center rounded-xl border py-2.5 ${
                  active ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${active ? 'text-accent-fg' : 'text-text-muted'}`}
                >
                  {g}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Zorluk */}
        <Text className="mt-4 text-sm font-semibold text-text-primary">Zorluk</Text>
        <View className="mt-1.5 flex-row gap-2">
          {DIFFICULTIES.map((d) => {
            const active = d.id === difficulty;
            return (
              <Pressable
                key={d.id}
                onPress={() => setDifficulty(d.id)}
                className={`flex-1 items-center rounded-xl border py-2.5 ${
                  active ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${active ? 'text-accent-fg' : 'text-text-muted'}`}
                >
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Konu / alt konu */}
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text-primary">Konu</Text>
            <TextInput
              value={topic}
              onChangeText={setTopic}
              placeholder="Örn: Türev"
              placeholderTextColor="#94A3B8"
              className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-3 text-sm text-text-primary"
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-text-primary">Alt Konu</Text>
            <TextInput
              value={subTopic}
              onChangeText={setSubTopic}
              placeholder="Örn: Zincir Kuralı"
              placeholderTextColor="#94A3B8"
              className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-3 text-sm text-text-primary"
            />
          </View>
        </View>

        {/* Soru metni */}
        <View className="mt-5 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-text-primary">Soru</Text>
          <Pressable
            onPress={() => setPreviewQ((v) => !v)}
            className="flex-row items-center rounded-full bg-bg-elevated px-2.5 py-1 active:opacity-80"
          >
            <Eye color="#475569" size={12} />
            <Text className="ml-1 text-[11px] font-semibold text-text-secondary">
              {previewQ ? 'Düzenle' : 'Önizle'}
            </Text>
          </Pressable>
        </View>
        {previewQ ? (
          <View className="mt-1.5 min-h-[100px] rounded-xl border border-border-soft bg-bg-base p-3">
            {question.trim() ? (
              <MathRenderer content={question} fontSize={14} color="#0F172A" />
            ) : (
              <Text className="text-xs text-text-muted">Önizlemek için soru yaz</Text>
            )}
          </View>
        ) : (
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="LaTeX kullanabilirsin: $f(x) = x^2$"
            placeholderTextColor="#94A3B8"
            multiline
            className="mt-1.5 min-h-[100px] rounded-xl border border-border-soft bg-bg-surface px-3.5 py-3 text-sm text-text-primary"
            style={{ textAlignVertical: 'top' }}
          />
        )}

        {/* Şıklar */}
        <View className="mt-5 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-text-primary">Şıklar</Text>
          {choices.length < 5 ? (
            <Pressable
              onPress={addChoice}
              className="flex-row items-center rounded-full bg-bg-elevated px-2.5 py-1 active:opacity-80"
            >
              <Plus color="#4F46E5" size={12} />
              <Text className="ml-1 text-[11px] font-semibold text-accent-fg">Şık Ekle</Text>
            </Pressable>
          ) : null}
        </View>
        <View className="mt-2 gap-2">
          {choices.map((c, i) => {
            const isCorrect = i === correctIndex;
            return (
              <View
                key={i}
                className={`flex-row items-center rounded-xl border px-3 py-2 ${
                  isCorrect ? 'border-success bg-success-soft' : 'border-border-soft bg-bg-surface'
                }`}
              >
                <Pressable
                  onPress={() => setCorrectIndex(i)}
                  hitSlop={6}
                  className={`h-7 w-7 items-center justify-center rounded-full border ${
                    isCorrect ? 'border-success bg-success' : 'border-border-soft bg-bg-base'
                  }`}
                >
                  {isCorrect ? (
                    <Check color="white" size={14} />
                  ) : (
                    <Text className="text-[10px] font-bold text-text-muted">
                      {String.fromCharCode(65 + i)}
                    </Text>
                  )}
                </Pressable>
                <TextInput
                  value={c}
                  onChangeText={(v) => setChoice(i, v)}
                  placeholder={`Şık ${String.fromCharCode(65 + i)}`}
                  placeholderTextColor="#94A3B8"
                  className="ml-2 flex-1 text-sm text-text-primary"
                />
                {choices.length > 2 ? (
                  <Pressable onPress={() => removeChoice(i)} hitSlop={6} className="p-1">
                    <Trash2 color="#DC2626" size={14} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
        <Text className="mt-1 text-[10px] text-text-muted">
          Doğru cevap için soldaki harfe dokun.
        </Text>

        {/* Açıklama */}
        <Text className="mt-5 text-sm font-semibold text-text-primary">Çözüm Açıklaması</Text>
        <Text className="text-[10px] text-text-muted">İsteğe bağlı — öğrenciye gösterilebilir.</Text>
        <TextInput
          value={explanation}
          onChangeText={setExplanation}
          placeholder="Kısa çözüm açıklaması"
          placeholderTextColor="#94A3B8"
          multiline
          className="mt-1.5 min-h-[60px] rounded-xl border border-border-soft bg-bg-surface px-3.5 py-3 text-sm text-text-primary"
          style={{ textAlignVertical: 'top' }}
        />
      </ScrollView>

      {/* CTA */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-border-soft bg-bg-base px-5 pb-8 pt-3">
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className={`items-center rounded-xl py-4 active:opacity-80 ${
            loading ? 'bg-bg-elevated' : 'bg-accent'
          }`}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-white">{submitLabel}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

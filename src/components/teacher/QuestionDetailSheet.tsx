import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { X, CheckCircle2, Sparkles } from 'lucide-react-native';
import { MathRenderer } from '@/components/quiz/MathRenderer';
import {
  getQuestionText,
  getOptions,
  resolveCorrectIndex,
  type QuestionShape,
} from '@/utils/questionShape';

export interface QuestionDetail extends QuestionShape {
  id: string;
  explanation?: string;
  subject?: string;
  category?: string;
  topic?: string;
  sub_topic?: string;
  grade?: string;
  difficulty?: string;
  is_ai_generated?: boolean;
  verified?: boolean;
}

type Props = {
  visible: boolean;
  question: QuestionDetail | null;
  onClose: () => void;
};

function getText(d: QuestionDetail): string {
  return getQuestionText(d) || 'Soru metni yok';
}

export function QuestionDetailSheet({ visible, question, onClose }: Props) {
  if (!question) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <Pressable className="flex-1 bg-black/50" onPress={onClose} />
      </Modal>
    );
  }

  const text = getText(question);
  const options = getOptions(question);
  const correctIdx = resolveCorrectIndex(question, options);
  const isAI = question.is_ai_generated === true;
  const subject = question.subject ?? question.category ?? 'Genel';

  const metaParts = [subject];
  if (question.difficulty) metaParts.push(question.difficulty);
  if (question.grade) metaParts.push(`${question.grade}. sınıf`);
  if (question.topic) metaParts.push(question.topic);
  if (question.sub_topic) metaParts.push(question.sub_topic);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mt-auto rounded-t-3xl bg-bg-base"
          style={{ maxHeight: '92%' }}
        >
          <View className="self-center mt-2 mb-1 h-1 w-10 rounded-full bg-bg-elevated" />
          <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
            <View className="flex-1 flex-row items-center">
              <Text className="text-base font-bold text-text-primary">Soru Detayı</Text>
              {isAI ? (
                <View className="ml-2 flex-row items-center rounded-full bg-accent-soft px-2 py-0.5">
                  <Sparkles color="#16A34A" size={10} />
                  <Text className="ml-1 text-[10px] font-semibold text-accent-fg">AI</Text>
                </View>
              ) : null}
              {question.verified === false ? (
                <View className="ml-1.5 rounded-full bg-warning-soft px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-warning">Onay bekliyor</Text>
                </View>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-8 w-8 items-center justify-center rounded-full active:bg-bg-elevated"
            >
              <X color="#94A3B8" size={18} />
            </Pressable>
          </View>

          <View className="h-px bg-border-soft" />

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <Text className="text-[10px] uppercase tracking-wide text-accent-fg">
              {metaParts.join(' · ')}
            </Text>

            <View className="mt-3 rounded-2xl border border-border-soft bg-bg-surface p-4">
              <MathRenderer content={text} fontSize={15} color="#0F172A" />
            </View>

            {options.length > 0 ? (
              <View className="mt-5" style={{ gap: 8 }}>
                <Text className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Seçenekler
                </Text>
                {options.map((opt, i) => {
                  const isCorrect = i === correctIdx;
                  return (
                    <View
                      key={i}
                      className={`flex-row items-start rounded-xl border p-3 ${
                        isCorrect
                          ? 'border-success bg-success-soft'
                          : 'border-border-soft bg-bg-surface'
                      }`}
                    >
                      <View
                        className={`mr-3 h-7 w-7 items-center justify-center rounded-full ${
                          isCorrect ? 'bg-success' : 'bg-bg-elevated'
                        }`}
                      >
                        <Text
                          className={`text-[11px] font-bold ${
                            isCorrect ? 'text-white' : 'text-text-muted'
                          }`}
                        >
                          {String.fromCharCode(65 + i)}
                        </Text>
                      </View>
                      <View className="flex-1 pt-0.5">
                        <MathRenderer content={opt} fontSize={13} color="#0F172A" />
                      </View>
                      {isCorrect ? (
                        <CheckCircle2 color="#16A34A" size={16} style={{ marginLeft: 6, marginTop: 4 }} />
                      ) : null}
                    </View>
                  );
                })}
                {correctIdx < 0 ? (
                  <Text className="mt-1 text-[11px] italic text-warning">
                    Doğru cevap işaretlenmemiş — soruyu düzenleyip cevabı ayarla.
                  </Text>
                ) : null}
              </View>
            ) : (
              <View className="mt-5 rounded-xl border border-warning/30 bg-warning-soft p-3">
                <Text className="text-xs text-text-secondary">
                  Bu sorunun seçenekleri yok — eski formatta kaydedilmiş olabilir.
                </Text>
              </View>
            )}

            {question.explanation ? (
              <View className="mt-5">
                <Text className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Açıklama
                </Text>
                <View className="mt-2 rounded-xl border border-border-soft bg-bg-surface p-3.5">
                  <MathRenderer content={question.explanation} fontSize={13} color="#475569" />
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

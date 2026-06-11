import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { Lightbulb, MessageCircle, ChevronRight, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { generateDynamicHint } from '@/services/aiService';
import { MathRenderer } from '@/components/quiz/MathRenderer';

type Props = {
  visible: boolean;
  subject: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  initialHint?: string | null;
  explanation?: string | null;
  grade?: string;
  onClose: () => void;
  onContinue: () => void;
  onFinishRound?: () => void;
};

export function WrongAnswerCoachSheet({
  visible,
  subject,
  questionText,
  options,
  correctIndex,
  initialHint,
  explanation,
  grade,
  onClose,
  onContinue,
  onFinishRound,
}: Props) {
  const router = useRouter();
  const [hint, setHint] = useState<string>('');
  const [hintLoading, setHintLoading] = useState(false);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (initialHint) {
      setHint(initialHint);
      return;
    }
    if (fetchedFor.current === questionText) return;
    fetchedFor.current = questionText;
    setHintLoading(true);
    setHint('');
    generateDynamicHint({ subject, grade, questionText, options })
      .then((h) => setHint(h))
      .catch((err: Error) => setHint(`⚠ İpucu alınamadı: ${err.message}`))
      .finally(() => setHintLoading(false));
  }, [visible, questionText, initialHint, subject, grade, options]);

  const handleAskCoach = () => {
    const ctx = JSON.stringify({ subject, questionText, options, grade });
    onClose();
    router.push(`/chatbot?ctx=${encodeURIComponent(ctx)}` as never);
  };

  const correctAnswerText = options[correctIndex];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/40">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mt-auto rounded-t-3xl bg-bg-base px-5 pb-8 pt-4"
          style={{ maxHeight: '85%' }}
        >
          <View className="mb-2 self-center h-1 w-12 rounded-full bg-bg-elevated" />

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View
                className="h-10 w-10 items-center justify-center rounded-2xl"
                style={{ backgroundColor: '#FEF3C7' }}
              >
                <Lightbulb color="#D97706" size={20} />
              </View>
              <View className="ml-3">
                <Text className="text-base font-bold text-text-primary">İpucu Zamanı</Text>
                <Text className="text-xs text-text-muted">
                  Hata yapmak öğrenmenin bir parçası
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} className="active:opacity-60">
              <X color="#94A3B8" size={20} />
            </Pressable>
          </View>

          <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
            <View className="rounded-2xl border border-warning/30 bg-warning-soft/40 p-3">
              {hintLoading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="#D97706" size="small" />
                  <Text className="ml-2 text-xs text-text-muted">İpucu hazırlanıyor…</Text>
                </View>
              ) : (
                <Text className="text-sm leading-5 text-text-secondary">{hint}</Text>
              )}
            </View>

            {/* Doğru cevap her zaman görünür — buton kaldırıldı */}
            <View className="mt-3 rounded-2xl border border-success/40 bg-success-soft/40 p-4">
              <View className="flex-row items-center">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-success">
                  <Text className="text-xs font-bold text-white">✓</Text>
                </View>
                <Text className="ml-2 text-xs font-semibold uppercase tracking-wide text-success">
                  Doğru Cevap
                </Text>
              </View>
              <View className="mt-2.5">
                <MathRenderer
                  content={correctAnswerText ?? '—'}
                  fontSize={15}
                  color="#0F172A"
                />
              </View>
              {explanation ? (
                <>
                  <Text className="mt-3 text-xs font-semibold uppercase text-text-muted">
                    Açıklama
                  </Text>
                  <Text className="mt-1.5 text-sm leading-5 text-text-secondary">
                    {explanation}
                  </Text>
                </>
              ) : null}
            </View>

            <Pressable
              onPress={handleAskCoach}
              className="mt-3 flex-row items-center justify-center rounded-2xl bg-bg-surface border border-accent/40 py-3 active:opacity-80"
            >
              <MessageCircle color="#16A34A" size={16} />
              <Text className="ml-2 text-sm font-semibold text-accent-fg">Koça sor</Text>
            </Pressable>
          </ScrollView>

          <View className="mt-4 gap-2">
            <Pressable
              onPress={() => {
                onClose();
                onContinue();
              }}
              className="flex-row items-center justify-center rounded-2xl bg-accent py-3.5 active:opacity-80"
            >
              <Text className="mr-1 text-base font-semibold text-white">Devam Et</Text>
              <ChevronRight color="white" size={18} />
            </Pressable>
            {onFinishRound ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onFinishRound();
                }}
                className="items-center rounded-2xl py-3 active:opacity-70"
              >
                <Text className="text-xs font-medium text-text-muted">
                  Bu turu burada bitir
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { AppLottie } from '@/components/common/AppLottie';
import { lottie } from '@/constants/lottie';
import type { GenerateQuizModeKind } from '@/types/quiz';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type AIStyle = GenerateQuizModeKind;

const DIFFICULTIES: readonly { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Kolay' },
  { id: 'medium', label: 'Orta' },
  { id: 'hard', label: 'Zor' },
];

const COUNTS: readonly number[] = [5, 10];

const STYLES: readonly { id: AIStyle; label: string; hint: string }[] = [
  { id: 'STRICT_CURRICULUM', label: 'Müfredata sadık', hint: 'MEB/YKS sınırları içinde' },
  { id: 'ANALYZE_AND_DERIVE', label: 'Örnek sorulardan türet', hint: 'Onaylı havuz örnekleri ile' },
  { id: 'CREATIVE_FREE', label: 'Yaratıcı', hint: 'Özgün, güncel bağlamlı' },
];

type Props = {
  visible: boolean;
  topic?: string;
  loading?: boolean;
  /** ANALYZE_AND_DERIVE chip'inin etkin olup olmayacağı — havuzda örnek var mı? */
  derivationAvailable?: boolean;
  onClose: () => void;
  onConfirm: (
    count: number,
    difficulty: Difficulty,
    customPrompt: string | undefined,
    style: AIStyle,
  ) => void;
};

export function AIQuizSettingsSheet({
  visible,
  topic,
  loading,
  derivationAvailable = false,
  onClose,
  onConfirm,
}: Props) {
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [style, setStyle] = useState<AIStyle>('STRICT_CURRICULUM');

  useEffect(() => {
    if (!visible) {
      setCustomPrompt('');
      setStyle('STRICT_CURRICULUM');
    }
  }, [visible]);

  // ANALYZE_AND_DERIVE seçili iken örnek yoksa otomatik STRICT'a düş
  useEffect(() => {
    if (style === 'ANALYZE_AND_DERIVE' && !derivationAvailable) {
      setStyle('STRICT_CURRICULUM');
    }
  }, [style, derivationAvailable]);

  const trimmed = customPrompt.trim();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable onPress={onClose} className="flex-1 bg-black/50">
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="mt-auto rounded-t-3xl bg-bg-base"
            style={{ maxHeight: '88%' }}
          >
            {/* Drag handle */}
            <View className="self-center mt-2 mb-1 h-1 w-10 rounded-full bg-bg-elevated" />

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
              <View className="flex-row items-center flex-1">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent-soft">
                  <Sparkles color="#6366F1" size={18} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-bold text-text-primary">AI Soru Üret</Text>
                  {topic ? (
                    <Text className="text-xs text-text-muted" numberOfLines={1}>
                      {topic}
                    </Text>
                  ) : null}
                </View>
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

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}
            >
              {/* Konu / komut */}
              <View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-text-primary">Konu detayı</Text>
                  <Text className="text-[10px] text-text-muted">isteğe bağlı</Text>
                </View>
                <TextInput
                  value={customPrompt}
                  onChangeText={setCustomPrompt}
                  placeholder={
                    topic
                      ? `Boş bırak → ${topic}'tan karışık sorular`
                      : 'Boş bırak → varsayılan konu'
                  }
                  placeholderTextColor="#94A3B8"
                  maxLength={200}
                  className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
                  style={{ minHeight: 44 }}
                  returnKeyType="done"
                  blurOnSubmit
                />
                <Text className="mt-1 text-[10px] text-text-muted">
                  Örn: &quot;Mitoz bölünmenin evreleri&quot; · &quot;Logaritma türevleri&quot;
                </Text>
              </View>

              {/* Soru sayısı */}
              <View className="mt-5">
                <Text className="text-sm font-semibold text-text-primary">Soru sayısı</Text>
                <View className="mt-1.5 flex-row gap-2">
                  {COUNTS.map((c) => {
                    const active = c === count;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setCount(c)}
                        className={`flex-1 items-center rounded-xl border py-3 ${
                          active
                            ? 'border-accent bg-accent-soft'
                            : 'border-border-soft bg-bg-surface'
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            active ? 'text-accent-fg' : 'text-text-secondary'
                          }`}
                        >
                          {c}
                        </Text>
                        <Text
                          className={`text-[10px] ${
                            active ? 'text-accent-fg/80' : 'text-text-muted'
                          }`}
                        >
                          soru
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Zorluk */}
              <View className="mt-5">
                <Text className="text-sm font-semibold text-text-primary">Zorluk</Text>
                <View className="mt-1.5 flex-row gap-2">
                  {DIFFICULTIES.map((d) => {
                    const active = d.id === difficulty;
                    return (
                      <Pressable
                        key={d.id}
                        onPress={() => setDifficulty(d.id)}
                        className={`flex-1 items-center rounded-xl border py-2.5 ${
                          active
                            ? 'border-accent bg-accent-soft'
                            : 'border-border-soft bg-bg-surface'
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            active ? 'text-accent-fg' : 'text-text-secondary'
                          }`}
                        >
                          {d.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Stil — 3-modlu AI motoru */}
              <View className="mt-5">
                <Text className="text-sm font-semibold text-text-primary">Stil</Text>
                <View className="mt-1.5 gap-2">
                  {STYLES.map((s) => {
                    const active = s.id === style;
                    const disabled = s.id === 'ANALYZE_AND_DERIVE' && !derivationAvailable;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => !disabled && setStyle(s.id)}
                        disabled={disabled}
                        className={`rounded-xl border px-3 py-2.5 ${
                          active
                            ? 'border-accent bg-accent-soft'
                            : 'border-border-soft bg-bg-surface'
                        } ${disabled ? 'opacity-40' : ''}`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            active ? 'text-accent-fg' : 'text-text-secondary'
                          }`}
                        >
                          {s.label}
                        </Text>
                        <Text
                          className={`text-[11px] ${
                            active ? 'text-accent-fg/80' : 'text-text-muted'
                          }`}
                        >
                          {disabled ? 'Bu ders için onaylı örnek yok' : s.hint}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* CTA */}
            <View className="border-t border-border-soft px-5 pb-8 pt-4">
              <Pressable
                onPress={() => onConfirm(count, difficulty, trimmed || undefined, style)}
                disabled={loading}
                className="flex-row items-center justify-center rounded-2xl bg-accent py-3.5 active:opacity-80"
              >
                {loading ? (
                  <>
                    <AppLottie source={lottie.aiMagic} autoPlay loop style={{ width: 28, height: 28 }} />
                    <Text className="ml-2 text-base font-semibold text-white">Üretiliyor…</Text>
                  </>
                ) : (
                  <>
                    <Sparkles color="white" size={16} />
                    <Text className="ml-2 text-base font-semibold text-white">Üret</Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

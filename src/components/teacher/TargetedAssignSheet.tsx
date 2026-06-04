import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Sparkles, Database } from 'lucide-react-native';
import type { Difficulty } from '@/types/quiz';
import {
  createTargetedAssignment,
  type TargetedSource,
} from '@/services/targetedAssignmentsApi';

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Kolay' },
  { id: 'medium', label: 'Orta' },
  { id: 'hard', label: 'Zor' },
];

const COUNTS = [3, 5, 10] as const;

type Props = {
  visible: boolean;
  studentId: string;
  studentName: string;
  /** Subject seçimi için varsayılan. Boşsa free input gerekir. */
  defaultSubject?: string;
  /** Zayıf alt-konu önerileri (analitikten). Chip'ler buradan gelir. */
  suggestedSubTopics?: string[];
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function TargetedAssignSheet({
  visible,
  studentId,
  studentName,
  defaultSubject,
  suggestedSubTopics,
  onClose,
  onCreated,
}: Props) {
  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [selectedSubTopics, setSelectedSubTopics] = useState<Set<string>>(new Set());
  const [customSubTopic, setCustomSubTopic] = useState('');
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [source, setSource] = useState<TargetedSource>('ai');
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setSubject(defaultSubject ?? '');
      setSelectedSubTopics(new Set());
      setCustomSubTopic('');
      setCount(5);
      setDifficulty('medium');
      setSource('ai');
      setRationale('');
    }
  }, [visible, defaultSubject]);

  const toggleTopic = (t: string) => {
    setSelectedSubTopics((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const addCustomTopic = () => {
    const t = customSubTopic.trim();
    if (!t) return;
    toggleTopic(t);
    setCustomSubTopic('');
  };

  const handleCreate = async () => {
    if (!subject.trim()) {
      Alert.alert('Eksik', 'Ders adı gerekli.');
      return;
    }
    const subTopicsArr = Array.from(selectedSubTopics);
    setBusy(true);
    try {
      const result = await createTargetedAssignment({
        studentId,
        subject: subject.trim(),
        focusSubTopics: subTopicsArr,
        count,
        difficulty,
        source,
        rationale: rationale.trim() || undefined,
      });
      onCreated(result.id);
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable className="flex-1 bg-black/50" onPress={onClose}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="mt-auto rounded-t-3xl bg-bg-base"
            style={{ maxHeight: '90%' }}
          >
            <View className="self-center mt-2 mb-1 h-1 w-10 rounded-full bg-bg-elevated" />
            <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
              <View className="flex-1">
                <Text className="text-base font-bold text-text-primary">
                  Soru Ata · {studentName}
                </Text>
                <Text className="text-xs text-text-muted">Bu öğrenciye özel mini-set hazırla</Text>
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
              contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Ders */}
              <Text className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Ders
              </Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Örn: Matematik"
                placeholderTextColor="#94A3B8"
                className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
              />

              {/* Zayıf alt-konu önerileri */}
              {suggestedSubTopics && suggestedSubTopics.length > 0 ? (
                <>
                  <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Odak Alt-Konular (öneri)
                  </Text>
                  <View className="mt-1.5 flex-row flex-wrap" style={{ gap: 6 }}>
                    {suggestedSubTopics.map((t) => {
                      const sel = selectedSubTopics.has(t);
                      return (
                        <Pressable
                          key={t}
                          onPress={() => toggleTopic(t)}
                          className={`rounded-full border px-3 py-1.5 ${
                            sel
                              ? 'border-accent bg-accent-soft'
                              : 'border-border-soft bg-bg-surface'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              sel ? 'text-accent-fg' : 'text-text-muted'
                            }`}
                          >
                            {t}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {/* Manuel alt-konu */}
              <View className="mt-3 flex-row items-center" style={{ gap: 8 }}>
                <TextInput
                  value={customSubTopic}
                  onChangeText={setCustomSubTopic}
                  placeholder="Alt konu ekle (opsiyonel)"
                  placeholderTextColor="#94A3B8"
                  className="flex-1 rounded-xl border border-border-soft bg-bg-surface px-3 py-2 text-xs text-text-primary"
                  onSubmitEditing={addCustomTopic}
                />
                <Pressable
                  onPress={addCustomTopic}
                  disabled={!customSubTopic.trim()}
                  className={`rounded-full px-3 py-2 ${
                    customSubTopic.trim() ? 'bg-accent' : 'bg-bg-elevated'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      customSubTopic.trim() ? 'text-white' : 'text-text-muted'
                    }`}
                  >
                    Ekle
                  </Text>
                </Pressable>
              </View>
              {selectedSubTopics.size > 0 ? (
                <Text className="mt-1.5 text-[10px] text-text-muted">
                  {selectedSubTopics.size} alt konu seçili
                </Text>
              ) : null}

              {/* Soru sayısı */}
              <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Soru Sayısı
              </Text>
              <View className="mt-1.5 flex-row" style={{ gap: 8 }}>
                {COUNTS.map((c) => {
                  const active = c === count;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCount(c)}
                      className={`flex-1 items-center rounded-xl border py-2.5 ${
                        active
                          ? 'border-accent bg-accent-soft'
                          : 'border-border-soft bg-bg-surface'
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          active ? 'text-accent-fg' : 'text-text-muted'
                        }`}
                      >
                        {c} soru
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Zorluk */}
              <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Zorluk
              </Text>
              <View className="mt-1.5 flex-row" style={{ gap: 8 }}>
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
                          active ? 'text-accent-fg' : 'text-text-muted'
                        }`}
                      >
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Kaynak (AI / Havuz) */}
              <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Kaynak
              </Text>
              <View className="mt-1.5 gap-2">
                <Pressable
                  onPress={() => setSource('ai')}
                  className={`flex-row items-center rounded-xl border px-3.5 py-3 ${
                    source === 'ai'
                      ? 'border-accent bg-accent-soft'
                      : 'border-border-soft bg-bg-surface'
                  }`}
                >
                  <Sparkles color="#4F46E5" size={16} />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-semibold text-text-primary">AI ile üret</Text>
                    <Text className="text-[11px] text-text-muted">
                      Onaylı havuzdaki örneklerden türetilir (ANALYZE_AND_DERIVE)
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => setSource('pool')}
                  className={`flex-row items-center rounded-xl border px-3.5 py-3 ${
                    source === 'pool'
                      ? 'border-accent bg-accent-soft'
                      : 'border-border-soft bg-bg-surface'
                  }`}
                >
                  <Database color="#0891B2" size={16} />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-semibold text-text-primary">Havuzdan seç</Text>
                    <Text className="text-[11px] text-text-muted">
                      Mevcut onaylı havuzdan rastgele soru
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* Açıklama */}
              <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Not (öğrenciye görünmez)
              </Text>
              <TextInput
                value={rationale}
                onChangeText={setRationale}
                placeholder="Neden bu set? — kendine not"
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={300}
                className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
                style={{ minHeight: 60, textAlignVertical: 'top' }}
              />
            </ScrollView>

            <View className="border-t border-border-soft px-5 pb-8 pt-3">
              <Pressable
                onPress={handleCreate}
                disabled={busy || !subject.trim()}
                className={`flex-row items-center justify-center rounded-xl py-3.5 active:opacity-80 ${
                  busy || !subject.trim() ? 'bg-bg-elevated' : 'bg-accent'
                }`}
              >
                {busy ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Sparkles color="white" size={16} />
                    <Text className="ml-2 text-base font-semibold text-white">
                      Sete Başla (
                      {source === 'ai' ? 'AI üretim' : 'Havuzdan seçim'})
                    </Text>
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

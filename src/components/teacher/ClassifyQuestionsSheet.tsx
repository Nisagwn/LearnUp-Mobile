import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Sparkles, X, Tag, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react-native';
import {
  proposeClassifications,
  applyClassifications,
  countUntaggedQuestions,
  type ClassifyProposal,
} from '@/services/questionClassifierApi';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Sheet kapanırken kaç soru etiketlendi bilgisini parent'a ilet. */
  onFinished?: (totalApplied: number) => void;
};

type Phase = 'idle' | 'proposing' | 'review' | 'applying' | 'done' | 'error';

export function ClassifyQuestionsSheet({ visible, onClose, onFinished }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [initialUntagged, setInitialUntagged] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [proposals, setProposals] = useState<ClassifyProposal[]>([]);
  const [totalApplied, setTotalApplied] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPhase('idle');
    setProposals([]);
    setTotalApplied(0);
    setError(null);
    setInitialUntagged(null);
    setRemaining(null);
    countUntaggedQuestions()
      .then((count) => {
        setInitialUntagged(count);
        setRemaining(count);
      })
      .catch((err) => {
        console.warn('countUntagged:', err);
        setInitialUntagged(0);
        setRemaining(0);
      });
  }, [visible]);

  const handleClose = () => {
    if (totalApplied > 0) onFinished?.(totalApplied);
    onClose();
  };

  // 1) AI önerileri getir (yazma yok)
  const fetchProposals = async () => {
    setPhase('proposing');
    setError(null);
    try {
      const result = await proposeClassifications();
      if (result.proposals.length === 0) {
        setPhase('done');
        setRemaining(0);
      } else {
        setProposals(result.proposals);
        setPhase('review');
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  };

  // 2) Onaylanan (düzenlenmiş) etiketleri yaz
  const applyApproved = async () => {
    const items = proposals
      .map((p) => ({ id: p.id, topic: p.topic.trim(), sub_topic: p.sub_topic.trim() }))
      .filter((p) => p.topic && p.sub_topic);
    if (items.length === 0) return;
    setPhase('applying');
    setError(null);
    try {
      const result = await applyClassifications(items);
      setTotalApplied((t) => t + result.applied);
      setRemaining(result.remainingEstimate);
      setProposals([]);
      setPhase(result.remainingEstimate === 0 ? 'done' : 'idle');
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  };

  const editProposal = (id: string, field: 'topic' | 'sub_topic', value: string) =>
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const removeProposal = (id: string) =>
    setProposals((prev) => prev.filter((p) => p.id !== id));

  const approvableCount = proposals.filter(
    (p) => p.topic.trim() && p.sub_topic.trim(),
  ).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable onPress={handleClose} className="flex-1 bg-black/50">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mt-auto rounded-t-3xl bg-bg-base"
          style={{ maxHeight: '90%' }}
        >
          <View className="px-5 pb-8 pt-3">
            <View className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-soft" />
            <View className="flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
                <Tag color="#15803D" size={18} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-text-primary">
                  AI ile Konu Etiketleme
                </Text>
                <Text className="text-xs text-text-muted">
                  AI önerir · sen onaylarsın · sonra etiketlenir
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                hitSlop={10}
                className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
              >
                <X color="#475569" size={14} />
              </Pressable>
            </View>

            {/* Özet kutusu */}
            <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-border-soft bg-bg-surface p-4">
              {initialUntagged === null ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="#16A34A" size="small" />
                  <Text className="ml-2 text-xs text-text-muted">Etiketsiz sorular taranıyor…</Text>
                </View>
              ) : (
                <>
                  <View>
                    <Text className="text-xs text-text-muted">Etiketsiz soru</Text>
                    <Text className="text-2xl font-bold text-text-primary">
                      {remaining ?? initialUntagged}
                    </Text>
                  </View>
                  {totalApplied > 0 ? (
                    <View className="items-end">
                      <Text className="text-xs text-text-muted">Bu oturumda etiketlenen</Text>
                      <Text className="text-2xl font-bold text-success">{totalApplied}</Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>

            {/* İnceleme listesi — AI önerileri (düzenlenebilir) */}
            {phase === 'review' && proposals.length > 0 ? (
              <View className="mt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Öneriler ({proposals.length})
                  </Text>
                  <Text className="text-[10px] text-text-muted">
                    Düzenleyebilir veya çıkarabilirsin
                  </Text>
                </View>
                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  <View className="mt-2" style={{ gap: 8 }}>
                    {proposals.map((p) => (
                      <View
                        key={p.id}
                        className="rounded-2xl border border-border-soft bg-bg-surface p-3"
                      >
                        <View className="flex-row items-start">
                          <Text
                            className="flex-1 text-[11px] leading-4 text-text-secondary"
                            numberOfLines={2}
                          >
                            {p.question}
                          </Text>
                          <Pressable
                            onPress={() => removeProposal(p.id)}
                            hitSlop={8}
                            className="ml-2 active:opacity-60"
                          >
                            <Trash2 color="#DC2626" size={15} />
                          </Pressable>
                        </View>
                        <View className="mt-2 flex-row" style={{ gap: 8 }}>
                          <View className="flex-1">
                            <Text className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                              Konu
                            </Text>
                            <TextInput
                              value={p.topic}
                              onChangeText={(v) => editProposal(p.id, 'topic', v)}
                              placeholder="Konu"
                              placeholderTextColor="#94A3B8"
                              className="rounded-lg border border-border-soft bg-bg-base px-2.5 py-1.5 text-xs text-text-primary"
                            />
                          </View>
                          <View className="flex-1">
                            <Text className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                              Alt konu
                            </Text>
                            <TextInput
                              value={p.sub_topic}
                              onChangeText={(v) => editProposal(p.id, 'sub_topic', v)}
                              placeholder="Alt konu"
                              placeholderTextColor="#94A3B8"
                              className="rounded-lg border border-border-soft bg-bg-base px-2.5 py-1.5 text-xs text-text-primary"
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}

            {error ? (
              <View className="mt-3 flex-row items-center rounded-xl bg-danger-soft p-3">
                <AlertCircle color="#DC2626" size={14} />
                <Text className="ml-2 flex-1 text-xs font-medium text-danger">{error}</Text>
              </View>
            ) : null}

            {/* CTA */}
            <View className="mt-5">
              {phase === 'done' || (remaining === 0 && phase !== 'review') ? (
                <View className="flex-row items-center justify-center rounded-xl bg-success-soft py-3">
                  <CheckCircle2 color="#16A34A" size={16} />
                  <Text className="ml-1.5 text-sm font-bold text-success">
                    Tüm sorular etiketlendi
                  </Text>
                </View>
              ) : phase === 'review' ? (
                <Pressable
                  onPress={applyApproved}
                  disabled={approvableCount === 0}
                  className={`flex-row items-center justify-center rounded-xl bg-success py-3 active:opacity-80 ${
                    approvableCount === 0 ? 'opacity-60' : ''
                  }`}
                >
                  <CheckCircle2 color="white" size={16} />
                  <Text className="ml-1.5 text-sm font-bold text-white">
                    Onayla & Etiketle ({approvableCount})
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={fetchProposals}
                  disabled={
                    phase === 'proposing' ||
                    phase === 'applying' ||
                    initialUntagged === null ||
                    (remaining ?? 0) === 0
                  }
                  className={`flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
                    phase === 'proposing' ||
                    phase === 'applying' ||
                    initialUntagged === null ||
                    (remaining ?? 0) === 0
                      ? 'opacity-60'
                      : ''
                  }`}
                >
                  {phase === 'proposing' || phase === 'applying' ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Sparkles color="white" size={16} />
                  )}
                  <Text className="ml-1.5 text-sm font-bold text-white">
                    {phase === 'proposing'
                      ? 'AI önerileri hazırlıyor…'
                      : phase === 'applying'
                        ? 'Etiketleniyor…'
                        : totalApplied > 0
                          ? 'Sonraki grubu getir'
                          : 'AI Önerilerini Getir'}
                  </Text>
                </Pressable>
              )}

              {phase === 'review' ? (
                <Pressable
                  onPress={fetchProposals}
                  className="mt-2 items-center py-2 active:opacity-70"
                >
                  <Text className="text-xs font-semibold text-text-muted">
                    Bu grubu atla, yeniden öner
                  </Text>
                </Pressable>
              ) : phase !== 'proposing' &&
                phase !== 'applying' &&
                initialUntagged !== null &&
                (remaining ?? 0) > 0 ? (
                <Text className="mt-2 text-center text-[10px] text-text-muted">
                  Her grup ~30 soru — önce öneriler gelir, onayınca yazılır
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

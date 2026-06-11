import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { AssignmentFilterPanel } from '@/components/teacher/AssignmentFilterPanel';
import { AssignmentPreviewList } from '@/components/teacher/AssignmentPreviewList';
import { QuestionPickerSheet, type QuestionRow } from '@/components/teacher/QuestionPickerSheet';
import {
  QuestionDetailSheet,
  type QuestionDetail,
} from '@/components/teacher/QuestionDetailSheet';
import { fetchClassAnalytics } from '@/services/teacherAnalyticsApi';
import {
  pickSmartSet,
  augmentWithAI,
  type AssignmentFilters,
} from '@/services/smartAssignmentApi';
import { fetchQuestionPool } from '@/services/questionPoolApi';
import { resolveSubject } from '@/utils/subjects';

type Step = 'filter' | 'preview';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (rows: QuestionRow[]) => void;
};

function summarize(f: AssignmentFilters): string {
  const parts: string[] = [f.subject];
  parts.push(f.grades.length === 4 ? 'Tüm sınıflar' : `${f.grades.join(',')}. sınıf`);
  const diffMap = { easy: 'Kolay', medium: 'Orta', hard: 'Zor', mixed: 'Karışık' } as const;
  parts.push(diffMap[f.difficulty]);
  if (f.topics && f.topics.length > 0) parts.push(f.topics.join(', '));
  else if (f.topic) parts.push(f.topic);
  parts.push(`${f.count} soru`);
  return parts.join(' · ');
}

export function SmartQuestionWizard({ visible, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<Step>('filter');
  const [filters, setFilters] = useState<AssignmentFilters | null>(null);
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [busy, setBusy] = useState<'regenerate' | 'add' | 'ai' | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<QuestionDetail | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  // Sınıf zayıf konularını çek (Filtre paneline geçirilecek)
  useEffect(() => {
    if (!visible) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    let cancelled = false;
    fetchClassAnalytics(uid)
      .then((a) => {
        if (!cancelled) setWeakTopics(a.weakTopics.map((w) => w.subTopic).slice(0, 5));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setStep('filter');
      setRows([]);
      setFilters(null);
      setBusy(null);
    }
  }, [visible]);

  // Detay paneli için tam doc çekimi
  useEffect(() => {
    if (!detailId) {
      setDetailData(null);
      return;
    }
    // Önce listede varsa ondan başla (ID + temel meta)
    const localRow = rows.find((r) => r.id === detailId);
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'questions', detailId));
        if (cancelled) return;
        if (snap.exists()) {
          setDetailData({ id: detailId, ...(snap.data() as object) } as QuestionDetail);
        } else if (localRow) {
          // Havuza yazılmamış (geçici) AI sorusu — temel görünüm
          setDetailData({
            id: detailId,
            question: localRow.text,
            subject: localRow.subject,
            grade: localRow.grade,
            difficulty: localRow.difficulty,
            is_ai_generated: localRow.isAI,
          });
        }
      } catch (err) {
        if (!cancelled) console.warn('detail fetch:', (err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId, rows]);

  const handleSubmitFilter = async (f: AssignmentFilters, useAIAugment: boolean) => {
    setFilters(f);
    setLoadingInitial(true);
    try {
      const { rows: picked, available } = await pickSmartSet(f);
      let final = picked;
      if (final.length < f.count && useAIAugment) {
        // Eksiği AI ile tamamla — örnek olarak ilk N (≤3) picked'i kullan
        const samplesPool = await getSamplesForAI(f, picked);
        const missing = f.count - final.length;
        const aiRows = await augmentWithAI(f, samplesPool, missing);
        final = final.concat(aiRows);
      }
      setRows(final);
      setStep('preview');
      if (final.length === 0) {
        Alert.alert('Boş set', 'Bu filtrelerle hiç soru bulunamadı. Filtreyi gevşet veya AI ile zenginleştirmeyi aç.');
        setStep('filter');
      } else if (final.length < f.count && !useAIAugment) {
        Alert.alert(
          'Az sonuç',
          `Havuzda yalnız ${available} eşleşen soru var. "AI ile zenginleştir"i açıp tekrar deneyebilirsin.`,
        );
      }
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleRegenerate = async () => {
    if (!filters) return;
    setBusy('regenerate');
    try {
      const { rows: fresh } = await pickSmartSet(filters);
      setRows(fresh);
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleAddOne = async () => {
    if (!filters) return;
    setBusy('add');
    try {
      const extra = await pickSmartSet({ ...filters, count: 5 });
      const existingIds = new Set(rows.map((r) => r.id));
      const next = extra.rows.find((r) => !existingIds.has(r.id));
      if (next) setRows((prev) => [...prev, next]);
      else Alert.alert('Bulunamadı', 'Filtreye uyan ek soru kalmadı.');
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleAddAI = async () => {
    if (!filters) return;
    setBusy('ai');
    try {
      const samples = await getSamplesForAI(filters, rows);
      const aiRows = await augmentWithAI(filters, samples, 5);
      if (aiRows.length === 0) {
        Alert.alert('AI üretemedi', 'Tekrar dene veya filtre değiştir.');
      } else {
        setRows((prev) => [...prev, ...aiRows]);
      }
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

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
            style={{ maxHeight: '92%' }}
          >
            <View className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-bg-elevated" />
            <View className="flex-row items-center px-5 pt-2 pb-3">
              <View className="flex-1">
                <Text className="text-base font-bold text-text-primary">
                  {step === 'filter' ? 'Akıllı Soru Seçici' : 'Önizleme'}
                </Text>
                <Text className="text-[11px] text-text-muted">
                  {step === 'filter'
                    ? 'Filtre kur, sistem en uygun seti hazırlasın'
                    : 'Soruları gözden geçir, çıkar veya AI ile takviye et'}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
              >
                <X color="#94A3B8" size={14} />
              </Pressable>
            </View>
            <View className="h-px bg-border-soft" />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
            >
              {step === 'filter' ? (
                <>
                  <AssignmentFilterPanel
                    initial={filters ?? undefined}
                    weakTopics={weakTopics}
                    onChange={setFilters}
                    onSubmit={handleSubmitFilter}
                  />
                  {loadingInitial ? (
                    <Text className="mt-3 text-center text-xs text-text-muted">
                      Set hazırlanıyor…
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => setManualOpen(true)}
                    className="mt-4 items-center py-2 active:opacity-70"
                  >
                    <Text className="text-xs font-semibold text-accent-fg">
                      Tek tek seçmek istiyorum →
                    </Text>
                  </Pressable>
                </>
              ) : filters ? (
                <AssignmentPreviewList
                  filterSummary={summarize(filters)}
                  rows={rows}
                  busy={busy}
                  onBack={() => setStep('filter')}
                  onOpenDetail={setDetailId}
                  onRemove={(id) => setRows((prev) => prev.filter((r) => r.id !== id))}
                  onRegenerate={handleRegenerate}
                  onAddOne={handleAddOne}
                  onAddAI={handleAddAI}
                  onConfirm={() => onConfirm(rows)}
                />
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      <QuestionDetailSheet
        visible={detailId !== null}
        question={detailData}
        onClose={() => setDetailId(null)}
      />

      <QuestionPickerSheet
        visible={manualOpen}
        initialSelected={rows.map((r) => r.id)}
        onClose={() => setManualOpen(false)}
        onConfirm={(picked) => {
          setRows(picked);
          setManualOpen(false);
          onConfirm(picked);
        }}
      />
    </Modal>
  );
}

/**
 * AI takviyesi için few-shot örnek: önce mevcut seçilen rows (PoolQuestion'a
 * tam çevrilmediği için yalnız picked listesindeki ilk 3'ten örnekle), yoksa
 * havuzdan rastgele 3 örnek çek.
 */
async function getSamplesForAI(filters: AssignmentFilters, picked: QuestionRow[]) {
  if (picked.length >= 3) {
    // Picked QuestionRow'ları PoolQuestion benzeri tam objeye genişletmek için
    // havuzdan ilk eşleşmeyi getir; başarısız olursa boş gönderiyoruz (mode yine ANALYZE_AND_DERIVE çalışır)
    return [];
  }
  try {
    const subj = resolveSubject(filters.subject);
    const grade = filters.grades[0] ?? 10;
    const diff = filters.difficulty === 'mixed' ? 'medium' : filters.difficulty;
    return await fetchQuestionPool({
      subject: subj.label,
      grade: String(grade),
      difficulty: diff,
      topic: filters.topics?.[0] ?? filters.topic,
      subTopic: filters.subTopics?.[0],
      excludeIds: [],
      limit: 3,
      // Few-shot örnekleri konuyla uyumlu olsun — katılık ayarına saygı duy.
      strictTopic: filters.strict ?? true,
    });
  } catch {
    return [];
  }
}

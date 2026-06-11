import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import {
  Sparkles,
  Target,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react-native';
import {
  countMatchingQuestions,
  type AssignmentFilters,
  type MixedDifficulty,
} from '@/services/smartAssignmentApi';
import { getCurriculumTree, type CurriculumUnit } from '@/constants/curriculum';

const SUBJECTS = [
  'Matematik',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Türk Dili ve Edebiyatı',
  'Tarih',
  'Coğrafya',
  'Felsefe',
  'İngilizce',
];

const GRADES = [9, 10, 11, 12];

const DIFFICULTIES: { id: MixedDifficulty; label: string }[] = [
  { id: 'easy', label: 'Kolay' },
  { id: 'medium', label: 'Orta' },
  { id: 'hard', label: 'Zor' },
  { id: 'mixed', label: 'Karışık' },
];

const COUNTS = [3, 5, 10, 15, 20] as const;

type Props = {
  initial?: Partial<AssignmentFilters>;
  weakTopics: string[]; // sınıf zayıf alt-konuları (analytics)
  onChange: (filters: AssignmentFilters) => void;
  onSubmit: (filters: AssignmentFilters, useAIAugment: boolean) => void;
};

export function AssignmentFilterPanel({ initial, weakTopics, onChange, onSubmit }: Props) {
  const [subject, setSubject] = useState(initial?.subject ?? SUBJECTS[0]!);
  const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
  const [grades, setGrades] = useState<number[]>(initial?.grades ?? [11]);
  const [difficulty, setDifficulty] = useState<MixedDifficulty>(initial?.difficulty ?? 'medium');
  // Seçim: üst konular (tüm ünite) + alt konular (granül)
  const [selectedTopics, setSelectedTopics] = useState<string[]>(
    initial?.topics ?? (initial?.topic ? [initial.topic] : []),
  );
  const [selectedSubTopics, setSelectedSubTopics] = useState<string[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [count, setCount] = useState<number>(initial?.count ?? 10);
  const [weakMode, setWeakMode] = useState(false);
  const [aiAugment, setAiAugment] = useState(false);
  const [strict, setStrict] = useState(initial?.strict ?? true);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  // Müfredat ağacı (konu → alt konular) + öğretmenin eklediği özel konular
  const units: CurriculumUnit[] = useMemo(() => {
    const base = getCurriculumTree(subject, grades);
    const seen = new Set(base.map((u) => u.topic));
    const extra = customTopics
      .filter((t) => !seen.has(t))
      .map((t) => ({ topic: t, subTopics: [] as string[] }));
    return [...base, ...extra];
  }, [subject, grades, customTopics]);

  // Ders değişince seçimleri sıfırla (farklı dersin konuları geçersiz)
  useEffect(() => {
    setSelectedTopics([]);
    setSelectedSubTopics([]);
    setCustomTopics([]);
    setExpandedUnits(new Set());
  }, [subject]);

  const toggleTopic = (t: string) =>
    setSelectedTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const toggleSubTopic = (s: string) =>
    setSelectedSubTopics((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const toggleExpand = (t: string) =>
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const clearTopics = () => {
    setSelectedTopics([]);
    setSelectedSubTopics([]);
  };

  const addCustomTopic = () => {
    const v = customInput.trim();
    if (!v) return;
    if (!units.some((u) => u.topic === v)) setCustomTopics((prev) => [...prev, v]);
    setSelectedTopics((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setCustomInput('');
  };

  const selectedCount = selectedTopics.length + selectedSubTopics.length;

  const combinedSubTopics = useMemo(() => {
    const all = [...selectedSubTopics, ...(weakMode ? weakTopics : [])];
    return Array.from(new Set(all));
  }, [selectedSubTopics, weakMode, weakTopics]);

  const filters: AssignmentFilters = {
    subject,
    grades,
    difficulty,
    topics: selectedTopics.length > 0 ? selectedTopics : undefined,
    subTopics: combinedSubTopics.length > 0 ? combinedSubTopics : undefined,
    count,
    strict,
  };

  // Filtre değişince üst component'e bildir + canlı sayım (debounce 400ms)
  useEffect(() => {
    onChange(filters);
    let cancelled = false;
    const t = setTimeout(async () => {
      setCounting(true);
      try {
        const n = await countMatchingQuestions(filters);
        if (!cancelled) setMatchCount(n);
      } catch {
        if (!cancelled) setMatchCount(null);
      } finally {
        if (!cancelled) setCounting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    subject,
    grades.join(','),
    difficulty,
    selectedTopics.join('|'),
    selectedSubTopics.join('|'),
    weakMode,
    count,
    strict,
    weakTopics.join(','),
  ]);

  const toggleGrade = (g: number) => {
    setGrades((prev) => {
      if (prev.includes(g)) {
        const next = prev.filter((x) => x !== g);
        return next.length === 0 ? [g] : next; // en az 1 seçili kalsın
      }
      return [...prev, g].sort((a, b) => a - b);
    });
  };

  const canSubmit = matchCount !== null && (matchCount > 0 || aiAugment);

  return (
    <View>
      {/* Ders */}
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Ders</Text>
      <Pressable
        onPress={() => setSubjectMenuOpen((v) => !v)}
        className="mt-1.5 flex-row items-center justify-between rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5"
      >
        <Text className="text-sm text-text-primary">{subject}</Text>
        <ChevronDown color="#94A3B8" size={16} />
      </Pressable>
      {subjectMenuOpen ? (
        <View className="mt-1 rounded-xl border border-border-soft bg-bg-surface">
          {SUBJECTS.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setSubject(s);
                setSubjectMenuOpen(false);
              }}
              className={`px-3.5 py-2.5 active:bg-bg-elevated ${s === subject ? 'bg-accent-soft' : ''}`}
            >
              <Text
                className={`text-sm ${
                  s === subject ? 'font-semibold text-accent-fg' : 'text-text-primary'
                }`}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Sınıf */}
      <Text className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        Sınıf
      </Text>
      <View className="mt-1.5 flex-row" style={{ gap: 8 }}>
        {GRADES.map((g) => {
          const active = grades.includes(g);
          return (
            <Pressable
              key={g}
              onPress={() => toggleGrade(g)}
              className={`flex-1 items-center rounded-xl border py-2 ${
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
      <Text className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        Zorluk
      </Text>
      <View className="mt-1.5 flex-row" style={{ gap: 6 }}>
        {DIFFICULTIES.map((d) => {
          const active = d.id === difficulty;
          return (
            <Pressable
              key={d.id}
              onPress={() => setDifficulty(d.id)}
              className={`flex-1 items-center rounded-xl border py-2 ${
                active ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${active ? 'text-accent-fg' : 'text-text-muted'}`}
              >
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Konu — müfredat paneli (konu → alt konu) */}
      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Konu{' '}
          <Text className="text-text-muted">
            {selectedCount > 0 ? `(${selectedCount} seçili)` : '(opsiyonel)'}
          </Text>
        </Text>
        {selectedCount > 0 ? (
          <Pressable onPress={clearTopics} hitSlop={6} className="active:opacity-60">
            <Text className="text-[11px] font-semibold text-accent-fg">Temizle</Text>
          </Pressable>
        ) : null}
      </View>

      {units.length > 0 ? (
        <View className="mt-1.5 overflow-hidden rounded-xl border border-border-soft">
          {units.map((u, i) => {
            const topicActive = selectedTopics.includes(u.topic);
            const isOpen = expandedUnits.has(u.topic);
            const hasSub = u.subTopics.length > 0;
            const subSelectedCount = u.subTopics.filter((s) => selectedSubTopics.includes(s)).length;
            return (
              <View key={u.topic} className={i > 0 ? 'border-t border-border-soft' : ''}>
                {/* Ünite satırı */}
                <View
                  className={`flex-row items-center ${topicActive ? 'bg-accent-soft' : 'bg-bg-surface'}`}
                >
                  {/* Tüm üniteyi seç */}
                  <Pressable
                    onPress={() => toggleTopic(u.topic)}
                    hitSlop={6}
                    className="flex-row items-center py-2.5 pl-3 pr-2 active:opacity-70"
                  >
                    <View
                      className={`h-5 w-5 items-center justify-center rounded-md border ${
                        topicActive ? 'border-accent bg-accent' : 'border-border-soft bg-bg-base'
                      }`}
                    >
                      {topicActive ? <Check color="white" size={13} /> : null}
                    </View>
                  </Pressable>
                  {/* Konu adı — tıklayınca alt konuları aç/kapa */}
                  <Pressable
                    onPress={() => (hasSub ? toggleExpand(u.topic) : toggleTopic(u.topic))}
                    className="flex-1 flex-row items-center justify-between py-2.5 pr-3 active:opacity-70"
                  >
                    <View className="flex-1 pr-2">
                      <Text
                        className={`text-sm font-semibold ${
                          topicActive ? 'text-accent-fg' : 'text-text-primary'
                        }`}
                      >
                        {u.topic}
                      </Text>
                      {hasSub ? (
                        <Text className="text-[10px] text-text-muted">
                          {subSelectedCount > 0
                            ? `${subSelectedCount}/${u.subTopics.length} alt konu seçili`
                            : `${u.subTopics.length} alt konu`}
                        </Text>
                      ) : null}
                    </View>
                    {hasSub ? (
                      isOpen ? (
                        <ChevronUp color="#94A3B8" size={16} />
                      ) : (
                        <ChevronDown color="#94A3B8" size={16} />
                      )
                    ) : null}
                  </Pressable>
                </View>

                {/* Alt konular */}
                {isOpen && hasSub ? (
                  <View className="bg-bg-base px-3 pb-3 pt-1">
                    {topicActive ? (
                      <Text className="mb-1.5 text-[10px] italic text-text-muted">
                        Tüm ünite seçili — istersen tek tek alt konu da ekleyebilirsin.
                      </Text>
                    ) : null}
                    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                      {u.subTopics.map((s) => {
                        const active = selectedSubTopics.includes(s);
                        return (
                          <Pressable
                            key={s}
                            onPress={() => toggleSubTopic(s)}
                            className={`flex-row items-center rounded-full border px-2.5 py-1 active:opacity-80 ${
                              active ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                            }`}
                          >
                            {active ? <Check color="#15803D" size={11} /> : null}
                            <Text
                              className={`text-[11px] font-semibold ${
                                active ? 'ml-1 text-accent-fg' : 'text-text-secondary'
                              }`}
                            >
                              {s}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Text className="mt-1.5 text-xs text-text-muted">
          Bu ders/sınıf için müfredat tanımlı değil — aşağıdan manuel ekleyebilirsin.
        </Text>
      )}

      {/* Manuel konu ekle */}
      <View className="mt-2 flex-row items-center" style={{ gap: 8 }}>
        <TextInput
          value={customInput}
          onChangeText={setCustomInput}
          onSubmitEditing={addCustomTopic}
          placeholder="Manuel konu ekle…"
          placeholderTextColor="#94A3B8"
          returnKeyType="done"
          className="flex-1 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2 text-sm text-text-primary"
        />
        <Pressable
          onPress={addCustomTopic}
          disabled={!customInput.trim()}
          className={`h-10 w-10 items-center justify-center rounded-xl ${
            customInput.trim() ? 'bg-accent' : 'bg-bg-elevated'
          }`}
        >
          <Plus color={customInput.trim() ? 'white' : '#94A3B8'} size={18} />
        </Pressable>
      </View>

      {/* Katılık (strict) ayarı */}
      <Pressable
        onPress={() => setStrict((v) => !v)}
        className={`mt-3 flex-row items-center rounded-xl border p-3 ${
          strict ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
        }`}
      >
        {strict ? (
          <ShieldCheck color="#15803D" size={16} />
        ) : (
          <ShieldOff color="#94A3B8" size={16} />
        )}
        <View className="ml-2.5 flex-1">
          <Text className="text-sm font-semibold text-text-primary">
            {strict ? 'Yalnızca seçili konulardan' : 'Gerekirse yakın konulardan da'}
          </Text>
          <Text className="text-[11px] text-text-muted">
            {strict
              ? 'Sorular yalnız seçtiğin konu/alt konulardan gelir (önerilen)'
              : 'Havuz yetersizse aynı dersin yakın konularından da soru eklenir'}
          </Text>
        </View>
      </Pressable>

      {/* Soru Sayısı */}
      <Text className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        Soru Sayısı
      </Text>
      <View className="mt-1.5 flex-row" style={{ gap: 6 }}>
        {COUNTS.map((c) => {
          const active = c === count;
          return (
            <Pressable
              key={c}
              onPress={() => setCount(c)}
              className={`flex-1 items-center rounded-xl border py-2 ${
                active ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${active ? 'text-accent-fg' : 'text-text-muted'}`}
              >
                {c}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Akıllı modlar */}
      <View className="mt-5" style={{ gap: 8 }}>
        <Pressable
          onPress={() => setWeakMode((v) => !v)}
          disabled={weakTopics.length === 0}
          className={`flex-row items-center rounded-xl border p-3 ${
            weakMode ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
          } ${weakTopics.length === 0 ? 'opacity-50' : ''}`}
        >
          <Target color={weakMode ? '#15803D' : '#94A3B8'} size={16} />
          <View className="ml-2.5 flex-1">
            <Text className="text-sm font-semibold text-text-primary">
              Sınıfımın zayıf konularına odaklan
            </Text>
            <Text className="text-[11px] text-text-muted">
              {weakTopics.length > 0
                ? `${weakTopics.length} alt-konu: ${weakTopics.slice(0, 3).join(', ')}`
                : 'Henüz veri yok — yeterli quiz çözüldüğünde aktif olur'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setAiAugment((v) => !v)}
          className={`flex-row items-center rounded-xl border p-3 ${
            aiAugment ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
          }`}
        >
          <Sparkles color={aiAugment ? '#15803D' : '#94A3B8'} size={16} />
          <View className="ml-2.5 flex-1">
            <Text className="text-sm font-semibold text-text-primary">AI ile zenginleştir</Text>
            <Text className="text-[11px] text-text-muted">
              Havuz yetersizse eksik soruları AI türetir (onay için sana gelir)
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Canlı sayaç */}
      <View className="mt-4 flex-row items-center justify-center rounded-xl border border-border-soft bg-bg-surface p-3">
        {counting ? (
          <ActivityIndicator color="#16A34A" size="small" />
        ) : matchCount === null ? (
          <Text className="text-xs text-text-muted">Sayım yapılıyor…</Text>
        ) : matchCount === 0 ? (
          <Text className="text-xs text-warning">
            Bu kriterlere uyan soru bulunamadı — AI ile zenginleştirmeyi aç
          </Text>
        ) : (
          <Text className="text-xs text-text-secondary">
            Bu kriterlere uyan <Text className="font-bold text-text-primary">{matchCount}</Text> soru
            var
          </Text>
        )}
      </View>

      <Pressable
        onPress={() => onSubmit(filters, aiAugment)}
        disabled={!canSubmit}
        className={`mt-4 items-center rounded-xl py-3.5 active:opacity-80 ${
          canSubmit ? 'bg-accent' : 'bg-bg-elevated'
        }`}
      >
        <Text className={`text-sm font-bold ${canSubmit ? 'text-white' : 'text-text-muted'}`}>
          Bu Seti Hazırla
        </Text>
      </Pressable>
    </View>
  );
}

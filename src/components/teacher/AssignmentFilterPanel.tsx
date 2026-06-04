import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Sparkles, Target, ChevronDown } from 'lucide-react-native';
import {
  countMatchingQuestions,
  type AssignmentFilters,
  type MixedDifficulty,
} from '@/services/smartAssignmentApi';

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
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [count, setCount] = useState<number>(initial?.count ?? 10);
  const [weakMode, setWeakMode] = useState(false);
  const [aiAugment, setAiAugment] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  const filters: AssignmentFilters = {
    subject,
    grades,
    difficulty,
    topic: topic.trim() || undefined,
    subTopics: weakMode ? weakTopics : undefined,
    count,
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
  }, [subject, grades.join(','), difficulty, topic, weakMode, count, weakTopics.join(',')]);

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
              className={`px-3.5 py-2.5 active:bg-bg-elevated ${
                s === subject ? 'bg-accent-soft' : ''
              }`}
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
                className={`text-sm font-semibold ${
                  active ? 'text-accent-fg' : 'text-text-muted'
                }`}
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
                className={`text-xs font-semibold ${
                  active ? 'text-accent-fg' : 'text-text-muted'
                }`}
              >
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Konu (opsiyonel) */}
      <Text className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        Konu <Text className="text-text-muted">(opsiyonel)</Text>
      </Text>
      <TextInput
        value={topic}
        onChangeText={setTopic}
        placeholder="Örn. Türev, İntegral"
        placeholderTextColor="#94A3B8"
        className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
      />

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
                className={`text-sm font-semibold ${
                  active ? 'text-accent-fg' : 'text-text-muted'
                }`}
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
            weakMode
              ? 'border-accent bg-accent-soft'
              : 'border-border-soft bg-bg-surface'
          } ${weakTopics.length === 0 ? 'opacity-50' : ''}`}
        >
          <Target color={weakMode ? '#4F46E5' : '#94A3B8'} size={16} />
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
            aiAugment
              ? 'border-accent bg-accent-soft'
              : 'border-border-soft bg-bg-surface'
          }`}
        >
          <Sparkles color={aiAugment ? '#4F46E5' : '#94A3B8'} size={16} />
          <View className="ml-2.5 flex-1">
            <Text className="text-sm font-semibold text-text-primary">
              AI ile zenginleştir
            </Text>
            <Text className="text-[11px] text-text-muted">
              Havuz yetersizse eksik soruları AI türetir (onay kuyruğuna yazılır)
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Canlı sayaç */}
      <View className="mt-4 flex-row items-center justify-center rounded-xl border border-border-soft bg-bg-surface p-3">
        {counting ? (
          <ActivityIndicator color="#6366F1" size="small" />
        ) : matchCount === null ? (
          <Text className="text-xs text-text-muted">Sayım yapılıyor…</Text>
        ) : matchCount === 0 ? (
          <Text className="text-xs text-warning">
            Bu kriterlere uyan soru bulunamadı — AI ile zenginleştirmeyi aç
          </Text>
        ) : (
          <Text className="text-xs text-text-secondary">
            Bu kriterlere uyan <Text className="font-bold text-text-primary">{matchCount}</Text>{' '}
            soru var
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
        <Text
          className={`text-sm font-bold ${canSubmit ? 'text-white' : 'text-text-muted'}`}
        >
          Bu Seti Hazırla
        </Text>
      </Pressable>
    </View>
  );
}

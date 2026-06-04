import {
  collection,
  query,
  where,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  fetchQuestionPool,
  persistAIQuestions,
  toSample,
  type PoolQuestion,
} from '@/services/questionPoolApi';
import { generateQuiz } from '@/services/aiService';
import { resolveSubject } from '@/utils/subjects';
import { shuffle } from '@/utils/shuffle';
import type { Difficulty } from '@/types/quiz';
import type { QuestionRow } from '@/components/teacher/QuestionPickerSheet';

export type MixedDifficulty = Difficulty | 'mixed';

export interface AssignmentFilters {
  /** Ham veya kanonik ders adı. */
  subject: string;
  /** Birden fazla sınıf hedeflenebilir; boş array → tüm sınıflar (9-12). */
  grades: number[];
  difficulty: MixedDifficulty;
  topic?: string;
  /** Sınıf zayıf-konuları modu için. Boş ise filtreye eklenmez. */
  subTopics?: string[];
  /** Hedef seçim sayısı. */
  count: number;
}

const ALL_GRADES = [9, 10, 11, 12];
const ALL_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

function expandGrades(grades: number[]): number[] {
  if (!Array.isArray(grades) || grades.length === 0) return ALL_GRADES;
  return grades.filter((g) => ALL_GRADES.includes(g));
}

function expandDifficulties(d: MixedDifficulty): Difficulty[] {
  return d === 'mixed' ? ALL_DIFFICULTIES : [d];
}

function poolToRow(p: PoolQuestion, isAI = false): QuestionRow {
  return {
    id: p.id,
    text: p.question,
    subject: p.subject,
    grade: p.grade,
    difficulty: p.difficulty,
    isAI,
  };
}

/**
 * Verilen filtreye uyan onaylı soru sayısını canlı sayar — kullanıcı filtreyi
 * değiştirirken "Bu kriterlere X soru uyuyor" göstergesi için.
 * Maliyet: getCountFromServer (single page read).
 */
export async function countMatchingQuestions(f: AssignmentFilters): Promise<number> {
  const subj = resolveSubject(f.subject);
  const grades = expandGrades(f.grades);
  const diffs = expandDifficulties(f.difficulty);
  // Sub-topic listesi boşsa boş slot — döngü bir kez döner
  const subTopicList: (string | undefined)[] =
    f.subTopics && f.subTopics.length > 0 ? f.subTopics : [undefined];

  let total = 0;
  for (const g of grades) {
    for (const d of diffs) {
      for (const st of subTopicList) {
        const constraints = [
          where('category', '==', subj.label),
          where('grade', '==', String(g)),
          where('verified', '==', true),
          where('difficulty', '==', d),
        ];
        if (f.topic) constraints.push(where('topic', '==', f.topic));
        if (st) constraints.push(where('sub_topic', '==', st));
        try {
          // eslint-disable-next-line no-await-in-loop
          const snap = await getCountFromServer(query(collection(db, 'questions'), ...constraints));
          total += snap.data().count;
        } catch (err) {
          console.warn('[countMatchingQuestions] count failed:', (err as Error).message);
        }
      }
    }
  }
  return total;
}

/**
 * Filtreye uyan havuzdan rastgele N soru çeker. `fetchQuestionPool`'u her
 * (grade × difficulty × subTopic) kombinasyonu için çağırır, sonuçları
 * birleştirip karıştırıp limit'e kırpar. Verilmesi gereken sayı ile havuz
 * arasındaki açık `available` olarak döner (AI augment kararı için).
 */
export async function pickSmartSet(f: AssignmentFilters): Promise<{
  rows: QuestionRow[];
  available: number;
}> {
  const subj = resolveSubject(f.subject);
  const grades = expandGrades(f.grades);
  const diffs = expandDifficulties(f.difficulty);
  const subTopicList: (string | undefined)[] =
    f.subTopics && f.subTopics.length > 0 ? f.subTopics : [undefined];

  // Her kombinasyon için over-fetch ile çek
  const perCombo = Math.max(2, Math.ceil(f.count / (grades.length * diffs.length * subTopicList.length)) + 1);

  const collected: PoolQuestion[] = [];
  const seen = new Set<string>();

  for (const g of grades) {
    for (const d of diffs) {
      for (const st of subTopicList) {
        // eslint-disable-next-line no-await-in-loop
        const tier = await fetchQuestionPool({
          subject: subj.label,
          grade: String(g),
          difficulty: d,
          topic: f.topic,
          subTopic: st,
          excludeIds: [],
          limit: perCombo,
        });
        for (const q of tier) {
          if (!seen.has(q.id)) {
            seen.add(q.id);
            collected.push(q);
          }
        }
      }
    }
  }

  const shuffled = shuffle(collected);
  return {
    rows: shuffled.slice(0, f.count).map((p) => poolToRow(p, false)),
    available: collected.length,
  };
}

/**
 * Mevcut seçili soruları few-shot örneği olarak ANALYZE_AND_DERIVE moduna
 * gönderir, N yeni AI sorusu üretir, havuza `verified:false` olarak kaydeder
 * ve `QuestionRow[]` döndürür. Üretim başarısız olursa boş döner.
 */
export async function augmentWithAI(
  filters: AssignmentFilters,
  samples: PoolQuestion[],
  countToAdd: number,
): Promise<QuestionRow[]> {
  if (countToAdd < 1) return [];
  const subj = resolveSubject(filters.subject);
  const grade = expandGrades(filters.grades)[0] ?? 10;
  const difficulty: Difficulty =
    filters.difficulty === 'mixed' ? 'medium' : filters.difficulty;

  const sampleQuestions = samples.slice(0, 5).map(toSample);

  let generated;
  try {
    generated = await generateQuiz({
      kind: 'ANALYZE_AND_DERIVE',
      subject: subj.label,
      topic: filters.topic ?? filters.subTopics?.[0],
      grade: String(grade),
      count: Math.max(1, Math.min(10, countToAdd)),
      difficulty,
      sampleQuestions,
    });
  } catch (err) {
    console.warn('[augmentWithAI] generate failed:', (err as Error).message);
    return [];
  }

  // Havuza yaz (best-effort; verified:false)
  const { savedIds } = await persistAIQuestions(generated, {
    subject: subj.label,
    grade: String(grade),
    difficulty,
    topic: filters.topic,
    subTopic: filters.subTopics?.[0],
  });

  // savedIds Cloud Function'dan dönerse onları kullan; yoksa client-side geçici id
  return generated.map((q, i) => {
    const id = savedIds[i] ?? `ai-${Date.now()}-${i}`;
    return {
      id,
      text: q.question,
      subject: subj.label,
      grade: String(grade),
      difficulty,
      isAI: true,
    } satisfies QuestionRow;
  });
}

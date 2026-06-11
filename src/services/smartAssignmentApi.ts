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
  /** Tekil konu (geriye dönük). Çoklu seçim için `topics` kullanılır. */
  topic?: string;
  /** Müfredattan seçilen konular (çoklu). Soru havuzunda `topic` ile eşleşir. */
  topics?: string[];
  /** Sınıf zayıf-konuları modu için. Boş ise filtreye eklenmez. */
  subTopics?: string[];
  /** Hedef seçim sayısı. */
  count: number;
  /**
   * true (varsayılan): yalnızca seçili konu/alt-konudan soru çek; havuz/AI konu
   * dışına çıkmaz. false: havuz yetersizse yakın konulardan da soru gelebilir
   * (fetchQuestionPool tier-3 fallback'i devreye girer).
   */
  strict?: boolean;
}

/** Tek bir konu/alt-konu filtre birimi. */
type TopicFilter = { topic?: string; subTopic?: string };

/**
 * Seçili üst konuları ve alt konuları **birleşim (union)** olarak tek listeye
 * indirger: her üst konu → {topic}, her alt konu → {subTopic}. İkisi de yoksa
 * tek boş filtre [{}]. Böylece konu ve alt-konu seçimleri çapraz-çarpım yerine
 * "şu konulardan VEYA şu alt konulardan" şeklinde davranır.
 */
function resolveTopicFilters(f: AssignmentFilters): TopicFilter[] {
  const out: TopicFilter[] = [];
  const topics = f.topics && f.topics.length > 0 ? f.topics : f.topic ? [f.topic] : [];
  for (const t of topics) out.push({ topic: t });
  for (const s of f.subTopics ?? []) out.push({ subTopic: s });
  return out.length > 0 ? out : [{}];
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
    options: p.choices,
    answer: p.answer,
    explanation: p.explanation,
    verified: true, // havuz yalnız verified:true çeker
    topic: p.topic,
    subTopic: p.sub_topic,
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
  const topicFilters = resolveTopicFilters(f);

  let total = 0;
  for (const g of grades) {
    for (const d of diffs) {
      for (const tf of topicFilters) {
        const constraints = [
          where('category', '==', subj.label),
          where('grade', '==', String(g)),
          where('verified', '==', true),
          where('difficulty', '==', d),
        ];
        if (tf.topic) constraints.push(where('topic', '==', tf.topic));
        if (tf.subTopic) constraints.push(where('sub_topic', '==', tf.subTopic));
        try {
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
  const topicFilters = resolveTopicFilters(f);

  // Her kombinasyon için over-fetch ile çek
  const combos = grades.length * diffs.length * topicFilters.length;
  const perCombo = Math.max(2, Math.ceil(f.count / combos) + 1);

  const collected: PoolQuestion[] = [];
  const seen = new Set<string>();

  for (const g of grades) {
    for (const d of diffs) {
      for (const tf of topicFilters) {
        const tier = await fetchQuestionPool({
          subject: subj.label,
          grade: String(g),
          difficulty: d,
          topic: tf.topic,
          subTopic: tf.subTopic,
          excludeIds: [],
          limit: perCombo,
          // Katılık ayarı: strict (varsayılan) iken konu-dışı soru gelmesin;
          // kapalıyken havuz yetersizse yakın konulardan da çekilir.
          strictTopic: f.strict ?? true,
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

  // Çoklu konu seçildiyse AI prompt'una hepsini ver (virgüllü); tekli/zayıf-konu
  // fallback'i korunur.
  const aiTopic =
    (filters.topics && filters.topics.length > 0
      ? filters.topics.join(', ')
      : filters.topic) ?? filters.subTopics?.[0];

  let generated;
  try {
    generated = await generateQuiz({
      kind: 'ANALYZE_AND_DERIVE',
      subject: subj.label,
      topic: aiTopic,
      grade: String(grade),
      count: Math.max(1, Math.min(10, countToAdd)),
      difficulty,
      sampleQuestions,
    }, { quality: true });
  } catch (err) {
    console.warn('[augmentWithAI] generate failed:', (err as Error).message);
    return [];
  }

  // Havuza yaz (best-effort; verified:false)
  const { savedIds } = await persistAIQuestions(generated, {
    subject: subj.label,
    grade: String(grade),
    difficulty,
    topic: filters.topics?.[0] ?? filters.topic,
    subTopic: filters.subTopics?.[0],
  });

  // Yalnız gerçek doc id'si olan (havuza yazılmış) soruları döndür — geçici id'li
  // sorular öğrenciye ulaşamaz, ödeve eklenmemeli.
  const aiTopicSingle = filters.topics?.[0] ?? filters.topic;
  return generated
    .map((q, i): QuestionRow | null => {
      const id = savedIds[i];
      if (!id) return null;
      return {
        id,
        text: q.question,
        subject: subj.label,
        grade: String(grade),
        difficulty,
        isAI: true,
        options: q.choices,
        answer: q.answer,
        explanation: q.hint,
        verified: false, // öğretmen onayı bekler
        topic: aiTopicSingle,
        subTopic: filters.subTopics?.[0],
      };
    })
    .filter((r): r is QuestionRow => r !== null);
}

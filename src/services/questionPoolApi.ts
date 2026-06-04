import {
  collection,
  query,
  where,
  orderBy,
  startAt,
  limit as firestoreLimit,
  getDocs,
  QueryConstraint,
  DocumentData,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { shuffle } from '@/utils/shuffle';
import type { Difficulty, GenerateQuizMode } from '@/types/quiz';
import type { GeneratedQuestion } from '@/services/aiService';
import { BACKEND_BASE } from '@/constants/config';

const SAVE_URL = `${BACKEND_BASE}/saveAIQuestions`;

export interface PoolQuestion {
  id: string;
  subject: string;
  question: string;
  choices: string[];
  answer: number;
  difficulty?: string;
  grade?: string;
  topic?: string;
  sub_topic?: string;
  explanation?: string;
}

export interface PoolFetchParams {
  subject: string;
  grade: string;
  difficulty: Difficulty;
  topic?: string;
  subTopic?: string;
  excludeIds: string[];
  limit: number;
}

interface QuestionDocShape {
  category?: string;
  subject?: string;
  topic?: string;
  sub_topic?: string;
  difficulty?: string;
  grade?: string;
  text?: string;
  question_text?: string;
  question?: string;
  options?: unknown;
  choices?: unknown;
  correctAnswer?: string;
  correct_answer?: string;
  answer?: number | string;
  explanation?: string;
  verified?: boolean;
  random_seed?: number;
}

function normalizeDoc(id: string, raw: QuestionDocShape): PoolQuestion | null {
  const question = raw.text || raw.question_text || raw.question || '';
  if (!question) return null;

  let choices: string[] = [];
  if (Array.isArray(raw.options)) {
    choices = raw.options.filter((c): c is string => typeof c === 'string');
  } else if (Array.isArray(raw.choices)) {
    choices = raw.choices.filter((c): c is string => typeof c === 'string');
  } else if (raw.options && typeof raw.options === 'object') {
    choices = Object.values(raw.options).filter((c): c is string => typeof c === 'string');
  }
  if (choices.length < 2) return null;

  let answerIdx: number | null = null;
  const ansRaw = raw.correctAnswer ?? raw.correct_answer ?? raw.answer;
  if (typeof ansRaw === 'number' && Number.isInteger(ansRaw) && ansRaw >= 0 && ansRaw < choices.length) {
    answerIdx = ansRaw;
  } else if (typeof ansRaw === 'string') {
    const trimmed = ansRaw.trim();
    const exact = choices.findIndex((c) => c.trim() === trimmed);
    if (exact >= 0) answerIdx = exact;
    if (answerIdx === null && trimmed.length <= 3) {
      const letter = trimmed.toUpperCase().charAt(0);
      const idx = letter.charCodeAt(0) - 65;
      if (idx >= 0 && idx < choices.length) answerIdx = idx;
    }
  }
  if (answerIdx === null) return null;

  return {
    id,
    subject: raw.category || raw.subject || 'Genel',
    question,
    choices,
    answer: answerIdx,
    difficulty: raw.difficulty,
    grade: raw.grade,
    topic: raw.topic,
    sub_topic: raw.sub_topic,
    explanation: raw.explanation,
  };
}

async function runTier(
  base: QueryConstraint[],
  randomSeed: number,
  limit: number,
): Promise<PoolQuestion[]> {
  try {
    const q1 = query(
      collection(db, 'questions'),
      ...base,
      orderBy('random_seed'),
      startAt(randomSeed),
      firestoreLimit(limit),
    );
    const snap = await getDocs(q1);
    const out: PoolQuestion[] = [];
    snap.forEach((d) => {
      const n = normalizeDoc(d.id, d.data() as QuestionDocShape);
      if (n) out.push(n);
    });
    if (out.length >= limit) return out;
    // İkinci tur — başa sar (0'dan başla), aynı sonuçları toplama
    const q2 = query(
      collection(db, 'questions'),
      ...base,
      orderBy('random_seed'),
      firestoreLimit(limit - out.length),
    );
    const snap2 = await getDocs(q2);
    const seen = new Set(out.map((p) => p.id));
    snap2.forEach((d) => {
      if (seen.has(d.id)) return;
      const n = normalizeDoc(d.id, d.data() as QuestionDocShape);
      if (n) out.push(n);
    });
    return out;
  } catch (err) {
    // Composite index eksikse veya başka bir Firestore hatası varsa boş dön
    console.warn('[questionPoolApi] tier query failed:', (err as Error).message);
    return [];
  }
}

/**
 * Firestore 'questions' havuzundan, öğretmen onaylı soruları çeker.
 * 3-kademeli fallback: sub_topic → topic → sadece kategori+sınıf+zorluk.
 * Random pencere: random_seed alanı üzerinden rastgele başlangıç.
 */
export async function fetchQuestionPool(p: PoolFetchParams): Promise<PoolQuestion[]> {
  const excludeSet = new Set(p.excludeIds);
  const overFetch = Math.max(p.limit * 2, 10);
  const randomSeed = Math.floor(Math.random() * 1_000_000);

  const baseFilters: QueryConstraint[] = [
    where('category', '==', p.subject),
    where('grade', '==', p.grade),
    where('verified', '==', true),
    where('difficulty', '==', p.difficulty),
  ];

  // 1) sub_topic eşleşmeli
  let collected: PoolQuestion[] = [];
  if (p.subTopic) {
    collected = await runTier(
      [...baseFilters, where('sub_topic', '==', p.subTopic)],
      randomSeed,
      overFetch,
    );
  }

  // 2) topic eşleşmeli
  if (collected.length < p.limit && p.topic) {
    const next = await runTier(
      [...baseFilters, where('topic', '==', p.topic)],
      randomSeed,
      overFetch,
    );
    const seen = new Set(collected.map((c) => c.id));
    for (const q of next) {
      if (!seen.has(q.id)) collected.push(q);
      if (collected.length >= overFetch) break;
    }
  }

  // 3) Sadece kategori+sınıf+zorluk
  if (collected.length < p.limit) {
    const fallback = await runTier(baseFilters, randomSeed, overFetch);
    const seen = new Set(collected.map((c) => c.id));
    for (const q of fallback) {
      if (!seen.has(q.id)) collected.push(q);
      if (collected.length >= overFetch) break;
    }
  }

  // excludeIds süz, karıştır, limit'e kırp
  const filtered = collected.filter((q) => !excludeSet.has(q.id));
  return shuffle(filtered).slice(0, p.limit);
}

/**
 * Verified=true onaylı havuzdan örnek soru çeker — ANALYZE_AND_DERIVE modunun
 * few-shot input'unu hazırlamak için.
 */
export async function fetchSampleQuestions(params: {
  subject: string;
  grade: string;
  topic?: string;
  limit?: number;
}): Promise<PoolQuestion[]> {
  const limit = params.limit ?? 5;
  try {
    const constraints: QueryConstraint[] = [
      where('category', '==', params.subject),
      where('grade', '==', params.grade),
      where('verified', '==', true),
    ];
    if (params.topic) constraints.push(where('topic', '==', params.topic));

    const randomSeed = Math.floor(Math.random() * 1_000_000);
    const q = query(
      collection(db, 'questions'),
      ...constraints,
      orderBy('random_seed'),
      startAt(randomSeed),
      firestoreLimit(limit * 2),
    );
    const snap = await getDocs(q);
    const out: PoolQuestion[] = [];
    snap.forEach((d) => {
      const n = normalizeDoc(d.id, d.data() as QuestionDocShape);
      if (n) out.push(n);
    });
    return shuffle(out).slice(0, limit);
  } catch (err) {
    console.warn('[questionPoolApi] fetchSampleQuestions failed:', (err as Error).message);
    return [];
  }
}

export interface PersistAIQuestionsMeta {
  subject: string;
  grade: string;
  difficulty: Difficulty;
  topic?: string;
  subTopic?: string;
}

/**
 * AI üretimli soruları 'questions' koleksiyonuna verified:false ile yazar.
 * Cloud Function (saveAIQuestions) üzerinden Admin SDK ile yazılır — client
 * Firestore yazma kuralı kapalı kalır.
 * Best-effort: hata yutulur, sadece warn loglanır.
 */
export async function persistAIQuestions(
  questions: GeneratedQuestion[],
  meta: PersistAIQuestionsMeta,
): Promise<{ savedIds: string[] }> {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken().catch(() => null) : null;

    const payload = {
      questions: questions.map((q) => ({
        question_text: q.question,
        options: q.choices,
        correct_answer: q.choices[q.answer],
        explanation: q.hint || '',
      })),
      subject: meta.subject,
      topic: meta.topic || '',
      sub_topic: meta.subTopic || '',
      grade: meta.grade,
      difficulty: meta.difficulty,
      userId: user?.uid || null,
    };

    const res = await fetch(SAVE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn('[persistAIQuestions] non-OK:', res.status);
      return { savedIds: [] };
    }

    const data = (await res.json().catch(() => ({}))) as { savedIds?: string[] };
    return { savedIds: Array.isArray(data.savedIds) ? data.savedIds : [] };
  } catch (err) {
    console.warn('[persistAIQuestions] failed:', (err as Error).message);
    return { savedIds: [] };
  }
}

/**
 * Helper — PoolQuestion'dan AI prompt'una embed edilecek ExistingQuestionSample.
 */
export function toSample(q: PoolQuestion): import('@/types/quiz').ExistingQuestionSample {
  return {
    question: q.question,
    choices: q.choices,
    correctIndex: q.answer,
    explanation: q.explanation,
  };
}

// Re-export for ergonomic use
export type { GenerateQuizMode };

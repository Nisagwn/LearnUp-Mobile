import questionsRaw from '@/data/questions.json';
import { generateQuiz } from '@/services/aiService';
import {
  fetchQuestionPool,
  fetchSampleQuestions,
  persistAIQuestions,
  toSample,
} from '@/services/questionPoolApi';
import { shuffle } from '@/utils/shuffle';
import type { Difficulty, GenerateQuizMode } from '@/types/quiz';

export type QuizMode = 'subject' | 'random' | 'ai' | 'retake';
export type { Difficulty };
export type GenerateQuizModeKind = GenerateQuizMode['kind'];

export interface QueueQuestion {
  id: string;
  subject: string;
  question: string;
  choices: string[];
  answer: number;
  difficulty?: string;
  grade?: string;
  source: 'local' | 'ai' | 'payload' | 'firestore';
}

interface RawLocal {
  subject?: string;
  question?: string;
  choices?: string[];
  answer?: number;
  metadata?: { difficulty?: string; grade?: string };
}

interface RawPayload {
  subject?: string;
  question: string;
  choices: string[];
  answer: number;
}

const LOCAL_POOL: RawLocal[] = questionsRaw as RawLocal[];
const REFILL_THRESHOLD = 2;
const AI_BATCH_SIZE = 5;
const POOL_FETCH_SIZE = 20;

function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function makeId(subject: string, question: string, source: string): string {
  return `${subject.toLowerCase()}-${source}-${hashStr(question).slice(0, 8)}`;
}

function normalizeLocal(raw: RawLocal): QueueQuestion | null {
  if (!raw.subject || !raw.question || !Array.isArray(raw.choices) || typeof raw.answer !== 'number') {
    return null;
  }
  return {
    id: makeId(raw.subject, raw.question, 'local'),
    subject: raw.subject,
    question: raw.question,
    choices: raw.choices,
    answer: raw.answer,
    difficulty: raw.metadata?.difficulty,
    grade: raw.metadata?.grade,
    source: 'local',
  };
}

function normalizePayload(raw: RawPayload, fallbackSubject: string): QueueQuestion {
  const subject = raw.subject ?? fallbackSubject;
  return {
    id: makeId(subject, raw.question, 'payload'),
    subject,
    question: raw.question,
    choices: raw.choices,
    answer: raw.answer,
    source: 'payload',
  };
}

export interface QueueOptions {
  mode: QuizMode;
  topic: string;
  initialPayload?: string;
  difficulty?: Difficulty;
  /** AI/retake modunda payload sorularına atanacak fallback subject etiketi. */
  subject?: string;
  /** Öğrencinin sınıfı (9/10/11/12). Firestore-first havuz filtresi için zorunlu. */
  grade?: string;
  /** AI refill ve quiz başlangıcı için stil. Default STRICT_CURRICULUM. */
  aiMode?: GenerateQuizModeKind;
}

export class QuestionQueue {
  private queue: QueueQuestion[] = [];
  private solvedIds = new Set<string>();
  private refilling = false;
  private exhausted = false;
  private seeded = false;
  private seeding: Promise<void> | null = null;

  constructor(private readonly opts: QueueOptions) {
    // Senkron tohumlama (payload modları) — async tohum next()'te tetiklenir
    this.seedSync();
  }

  private seedSync(): void {
    const { mode, initialPayload } = this.opts;
    if (initialPayload && (mode === 'ai' || mode === 'retake')) {
      try {
        const parsed = JSON.parse(decodeURIComponent(initialPayload)) as RawPayload[];
        const fallbackSubject =
          this.opts.subject || (mode === 'retake' ? 'Tekrar' : 'AI');
        this.queue.push(...parsed.map((p) => normalizePayload(p, fallbackSubject)));
        this.seeded = true;
      } catch {
        this.seeded = true;
      }
    }
  }

  private async seedAsync(): Promise<void> {
    if (this.seeded) return;
    if (this.seeding) return this.seeding;
    this.seeding = this.doSeedAsync();
    try {
      await this.seeding;
    } finally {
      this.seeded = true;
      this.seeding = null;
    }
  }

  private async doSeedAsync(): Promise<void> {
    const { mode, topic, grade, difficulty } = this.opts;

    // subject ve random modları → Firestore-first
    if (mode === 'subject' || mode === 'random') {
      const subject = mode === 'subject' ? topic : 'Genel';
      const safeGrade = grade || '10';
      const safeDifficulty = difficulty ?? 'medium';

      const pool = await fetchQuestionPool({
        subject,
        grade: safeGrade,
        difficulty: safeDifficulty,
        topic: mode === 'subject' ? topic : undefined,
        excludeIds: Array.from(this.solvedIds),
        limit: POOL_FETCH_SIZE,
      }).catch(() => [] as Awaited<ReturnType<typeof fetchQuestionPool>>);

      if (pool.length > 0) {
        this.queue.push(
          ...pool.map((p) => ({
            id: p.id,
            subject: p.subject,
            question: p.question,
            choices: p.choices,
            answer: p.answer,
            difficulty: p.difficulty,
            grade: p.grade,
            source: 'firestore' as const,
          })),
        );
        return;
      }

      // Firestore boş/erişilmez → lokal JSON yedek
      if (mode === 'random') {
        this.queue.push(
          ...shuffle(LOCAL_POOL.map(normalizeLocal).filter((q): q is QueueQuestion => !!q)),
        );
      } else {
        const lower = topic.toLowerCase();
        this.queue.push(
          ...shuffle(
            LOCAL_POOL.filter((q) => (q.subject || '').toLowerCase() === lower)
              .map(normalizeLocal)
              .filter((q): q is QueueQuestion => !!q),
          ),
        );
      }
    }
  }

  private async refillFromAI(): Promise<void> {
    if (this.refilling) return;
    this.refilling = true;
    try {
      const { mode, topic, grade, difficulty, aiMode } = this.opts;
      const subject = mode === 'subject' || mode === 'ai' ? topic : 'Genel';
      const safeSubject = subject === 'ai' || subject === 'random' ? 'Genel' : subject;
      const safeGrade = grade || '10';
      const safeDifficulty: Difficulty = difficulty ?? 'medium';
      const kind: GenerateQuizModeKind = aiMode ?? 'STRICT_CURRICULUM';

      // ANALYZE_AND_DERIVE için örnek çek
      let modeArg: GenerateQuizMode;
      if (kind === 'ANALYZE_AND_DERIVE') {
        const samples = await fetchSampleQuestions({
          subject: safeSubject,
          grade: safeGrade,
          topic: mode === 'subject' ? topic : undefined,
          limit: 5,
        });
        modeArg = {
          kind: 'ANALYZE_AND_DERIVE',
          subject: safeSubject,
          topic: mode === 'subject' ? topic : undefined,
          grade: safeGrade,
          count: AI_BATCH_SIZE,
          difficulty: safeDifficulty,
          sampleQuestions: samples.map(toSample),
        };
      } else if (kind === 'CREATIVE_FREE') {
        modeArg = {
          kind: 'CREATIVE_FREE',
          subject: safeSubject,
          topic: mode === 'subject' ? topic : undefined,
          grade: safeGrade,
          count: AI_BATCH_SIZE,
          difficulty: safeDifficulty,
        };
      } else {
        modeArg = {
          kind: 'STRICT_CURRICULUM',
          subject: safeSubject,
          topic: mode === 'subject' ? topic : undefined,
          grade: safeGrade,
          count: AI_BATCH_SIZE,
          difficulty: safeDifficulty,
        };
      }

      const fresh = await generateQuiz(modeArg);

      // Best-effort: havuza yaz (verified:false) — öğretmen sonra onaylar
      persistAIQuestions(fresh, {
        subject: safeSubject,
        grade: safeGrade,
        difficulty: safeDifficulty,
        topic: mode === 'subject' ? topic : undefined,
      }).catch(() => {
        /* ignore */
      });

      const enriched: QueueQuestion[] = fresh.map((q) => ({
        id: makeId(safeSubject, q.question, 'ai'),
        subject: safeSubject,
        question: q.question,
        choices: q.choices,
        answer: q.answer,
        grade: safeGrade,
        difficulty: safeDifficulty,
        source: 'ai',
      }));
      this.queue.push(...enriched.filter((q) => !this.solvedIds.has(q.id)));
    } catch {
      /* AI refill başarısız — queue boş kalabilir */
    } finally {
      this.refilling = false;
    }
  }

  async next(): Promise<QueueQuestion | null> {
    if (!this.seeded && !this.opts.initialPayload) {
      await this.seedAsync();
    }

    while (this.queue.length > 0 && this.solvedIds.has(this.queue[0]!.id)) {
      this.queue.shift();
    }

    if (this.queue.length <= REFILL_THRESHOLD && this.canRefill()) {
      await this.refillFromAI();
    }

    if (this.queue.length === 0) {
      if (this.opts.mode === 'retake') {
        this.exhausted = true;
        return null;
      }
      if (this.canRefill()) {
        await this.refillFromAI();
      }
      if (this.queue.length === 0) {
        this.exhausted = true;
        return null;
      }
    }

    const q = this.queue.shift()!;
    this.solvedIds.add(q.id);
    return q;
  }

  private canRefill(): boolean {
    // Retake yalnız payload üzerinde çalışır.
    // AI modu sabit uzunluklu — kullanıcı tam sayıda soru istedi.
    // Subject ve random modlarında otomatik refill var.
    return this.opts.mode === 'subject' || this.opts.mode === 'random';
  }

  markSolved(id: string): void {
    this.solvedIds.add(id);
  }

  isExhausted(): boolean {
    return this.exhausted;
  }

  remainingInQueue(): number {
    return this.queue.length;
  }
}

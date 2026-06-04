import type { GeneratedQuestion } from '@/services/aiService';
import type { GenerateQuizModeKind } from '@/types/quiz';

export type Difficulty = 'easy' | 'medium' | 'hard';

interface BuildAIQuizPathArgs {
  questions: GeneratedQuestion[];
  subject: string;
  count: number;
  difficulty: Difficulty;
  mode?: 'duel' | 'focus' | 'mock';
  /** AI stil — refill için aiMode olarak aktarılır. */
  aiMode?: GenerateQuizModeKind;
  /** Öğrencinin sınıfı (9/10/11/12). */
  grade?: string;
}

/**
 * AI üretilmiş sorularla /(student)/quiz/ai route'una gidiş URL'i oluşturur.
 * subject, count, difficulty parametreleri quiz ekranının "Yeni Tur Başlat"
 * tıklandığında AYNI ayarlarla yeni soru üretebilmesi için saklanır.
 */
export function buildAIQuizPath({
  questions,
  subject,
  count,
  difficulty,
  mode,
  aiMode,
  grade,
}: BuildAIQuizPathArgs): string {
  const payload = encodeURIComponent(JSON.stringify(questions));
  const params = new URLSearchParams();
  params.set('payload', payload);
  if (subject) params.set('subject', subject);
  params.set('count', String(count));
  params.set('difficulty', difficulty);
  if (mode) params.set('mode', mode);
  if (aiMode) params.set('aiMode', aiMode);
  if (grade) params.set('grade', grade);
  return `/(student)/quiz/ai?${params.toString()}`;
}

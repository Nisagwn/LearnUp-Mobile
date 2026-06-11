/**
 * Soru dokümanlarının değişken alan adlarını (question/question_text/text,
 * options/choices, correct_answer/answer/correctIndex/'A'-'E') tek bir tutarlı
 * şekle indirger. Hem QuestionDetailSheet hem QuestionReviewCard paylaşır —
 * doğru-cevap çözümleme mantığı tek yerde kalsın.
 */
export interface QuestionShape {
  question?: string;
  question_text?: string;
  text?: string;
  options?: unknown;
  choices?: unknown;
  correct_answer?: unknown; // number | string | letter
  correctIndex?: number;
  answer?: unknown;
}

/** Soru metnini değişken alan adlarından çıkarır (yoksa boş string). */
export function getQuestionText(d: QuestionShape): string {
  return d.text || d.question_text || d.question || '';
}

/** options/choices'ten string seçenek dizisi çıkarır. */
export function getOptions(d: QuestionShape): string[] {
  const arr = Array.isArray(d.options)
    ? d.options
    : Array.isArray(d.choices)
      ? d.choices
      : [];
  return (arr as unknown[]).filter((x): x is string => typeof x === 'string');
}

/**
 * correct_answer / answer / correctIndex / 'A'-'E' harfi / tam metin —
 * hepsini seçenek index'ine indirger. Çözülemezse -1.
 */
export function resolveCorrectIndex(d: QuestionShape, options: string[]): number {
  if (typeof d.correctIndex === 'number') return d.correctIndex;
  const candidates: unknown[] = [d.correct_answer, d.answer];
  for (const v of candidates) {
    if (typeof v === 'number' && v >= 0 && v < options.length) return v;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      // Harf: A,B,C,D,E
      if (/^[A-Ea-e]$/.test(trimmed)) {
        return trimmed.toUpperCase().charCodeAt(0) - 65;
      }
      // Sayısal string
      const n = Number(trimmed);
      if (!Number.isNaN(n) && n >= 0 && n < options.length) return n;
      // Tam metinle eşleşme
      const idx = options.findIndex((o) => o === trimmed);
      if (idx >= 0) return idx;
    }
  }
  return -1;
}

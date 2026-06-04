// Client-side SRS yardımcıları. Yazma Cloud Function'da yapılır (firestore.rules
// 'srs_cards' subkoleksiyonuna yazmayı yasaklar). Bu modül yalnızca okuma
// tarafında kategori ve interval mantığını tutarlı kullanmak için.

export type SRSBox = 0 | 1 | 2 | 3 | 4;
export type SRSCategory = 'new' | 'review' | 'learned';

export interface SRSCard {
  id: string;
  questionId: string;
  subject: string;
  sub_topic: string;
  box: SRSBox;
  nextReviewAtMs: number;
  lastReviewedAtMs: number;
  consecutiveCorrect: number;
  totalAttempts: number;
  totalCorrect: number;
  snapshot?: {
    question: string;
    choices: string[];
    answer: number;
  };
}

export const BOX_INTERVALS_MS: Record<SRSBox, number> = {
  0: 0,
  1: 60 * 60 * 1000,
  2: 24 * 60 * 60 * 1000,
  3: 3 * 24 * 60 * 60 * 1000,
  4: 7 * 24 * 60 * 60 * 1000,
};

export const LEARNED_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Bir SRS kartının şu anki kategorisini döndürür.
 * • new: box=0 (henüz öğrenilmedi veya en son yanlış)
 * • review: box 1-3 ve nextReviewAt geçmişte
 * • learned: box=4 VEYA review olmayan (review zamanı henüz gelmemiş) kartlar
 *
 * UI üç sekmeli yapı için bu kategori bazlı bölünmeye dayanır.
 */
export function categorize(card: Pick<SRSCard, 'box' | 'nextReviewAtMs'>, nowMs: number): SRSCategory {
  if (card.box <= 0) return 'new';
  if (card.box >= 4) return 'learned';
  return card.nextReviewAtMs <= nowMs ? 'review' : 'learned';
}

/** Kalan tekrar süresini insanca formatlar (örn. "23 dk", "2 sa", "yarın"). */
export function relativeReviewLabel(nextReviewAtMs: number, nowMs: number): string {
  const diff = nextReviewAtMs - nowMs;
  if (diff <= 0) return 'şimdi';
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${Math.max(1, min)} dk sonra`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa sonra`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yarın';
  return `${day} gün sonra`;
}

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit as fbLimit,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { categorize, type SRSBox, type SRSCard, type SRSCategory } from '@/utils/srs';

type RawCard = {
  questionId?: string;
  subject?: string;
  sub_topic?: string;
  box?: number;
  nextReviewAt?: Timestamp;
  lastReviewedAt?: Timestamp;
  consecutiveCorrect?: number;
  totalAttempts?: number;
  totalCorrect?: number;
  snapshot?: { question?: string; choices?: string[]; answer?: number };
};

function tsMs(t: Timestamp | undefined): number {
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

function normalizeBox(b: number | undefined): SRSBox {
  const n = Number(b ?? 0);
  if (n <= 0) return 0;
  if (n >= 4) return 4;
  return Math.min(3, Math.max(1, Math.floor(n))) as SRSBox;
}

function normalize(id: string, raw: RawCard): SRSCard {
  return {
    id,
    questionId: String(raw.questionId ?? id),
    subject: String(raw.subject ?? 'Genel'),
    sub_topic: String(raw.sub_topic ?? raw.subject ?? 'Genel'),
    box: normalizeBox(raw.box),
    nextReviewAtMs: tsMs(raw.nextReviewAt),
    lastReviewedAtMs: tsMs(raw.lastReviewedAt),
    consecutiveCorrect: Number(raw.consecutiveCorrect ?? 0),
    totalAttempts: Number(raw.totalAttempts ?? 0),
    totalCorrect: Number(raw.totalCorrect ?? 0),
    snapshot:
      raw.snapshot && typeof raw.snapshot === 'object'
        ? {
            question: String(raw.snapshot.question ?? ''),
            choices: Array.isArray(raw.snapshot.choices) ? raw.snapshot.choices.map(String) : [],
            answer: Number(raw.snapshot.answer ?? 0),
          }
        : undefined,
  };
}

/**
 * Tüm SRS kartlarını real-time dinler. `Wrongs` tab açıldığında bir kez bağlanır,
 * her snapshot'ta tüm kartları döndürür. Maliyet endişesi için maksimum 500 kart
 * çekilir (lastReviewedAt desc) — pratikte bir öğrencinin SRS kartı 100'leri
 * aşmaz.
 */
export function subscribeSRSCards(onChange: (cards: SRSCard[]) => void): Unsubscribe | null {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const col = collection(db, 'users', uid, 'srs_cards');
  const q = query(col, orderBy('lastReviewedAt', 'desc'), fbLimit(500));
  return onSnapshot(
    q,
    (snap) => {
      const arr: SRSCard[] = [];
      snap.forEach((d) => {
        const card = normalize(d.id, d.data() as RawCard);
        // Snapshot'sız kartları UI akışlarına dahil etme: retake payload
        // kurulamadığı için "Yetersiz veri" alert'i atıyordu. Backfill
        // scripti (scripts/backfill_srs_snapshots.cjs) ya da kullanıcının
        // soruyu yeniden çözmesi ile snapshot kazandıklarında geri görünür.
        if (card.snapshot && card.snapshot.question && card.snapshot.choices.length > 0) {
          arr.push(card);
        }
      });
      onChange(arr);
    },
    (err) => {
      console.warn('SRS kartları dinlenemedi:', err.message ?? err);
      onChange([]);
    },
  );
}

/**
 * Kartları kategoriye göre gruplar. Saf fonksiyon (zaman enjekte edilir).
 */
export function groupByCategory(cards: SRSCard[], nowMs: number): Record<SRSCategory, SRSCard[]> {
  const buckets: Record<SRSCategory, SRSCard[]> = { new: [], review: [], learned: [] };
  cards.forEach((c) => {
    buckets[categorize(c, nowMs)].push(c);
  });
  return buckets;
}

/**
 * Kartları alt konuya göre gruplar (accordion için). Aynı kategori içinde
 * en yüksek baskı (en eski lastReviewedAt) ilk gelir.
 */
export function groupBySubTopic(cards: SRSCard[]): { subTopic: string; subject: string; cards: SRSCard[] }[] {
  const map = new Map<string, { subject: string; cards: SRSCard[] }>();
  cards.forEach((c) => {
    const key = c.sub_topic || c.subject || 'Genel';
    const cur = map.get(key);
    if (cur) {
      cur.cards.push(c);
    } else {
      map.set(key, { subject: c.subject, cards: [c] });
    }
  });
  return Array.from(map.entries())
    .map(([subTopic, v]) => ({ subTopic, subject: v.subject, cards: v.cards }))
    .sort((a, b) => b.cards.length - a.cards.length);
}

/**
 * "En kritik N'i çöz" için: önce kategori önceliği (review > new), sonra
 * nextReviewAt asc (en eski due ilk), son olarak lastReviewedAt asc.
 * Snapshot'u olmayan kartlar retake payload'u oluşturulamayacağı için
 * filtrelenir.
 */
export function pickTopForRetake(
  cards: SRSCard[],
  nowMs: number,
  limit = 10,
): SRSCard[] {
  const withSnapshot = cards.filter((c) => c.snapshot && c.snapshot.question && c.snapshot.choices.length > 0);
  const scored = withSnapshot
    .map((c) => {
      const cat = categorize(c, nowMs);
      const catScore = cat === 'review' ? 0 : cat === 'new' ? 1 : 2;
      return { c, catScore };
    })
    .filter((x) => x.catScore < 2) // 'learned' kartları toplu çözmeye dahil etme
    .sort((a, b) => {
      if (a.catScore !== b.catScore) return a.catScore - b.catScore;
      if (a.c.nextReviewAtMs !== b.c.nextReviewAtMs) return a.c.nextReviewAtMs - b.c.nextReviewAtMs;
      return a.c.lastReviewedAtMs - b.c.lastReviewedAtMs;
    });
  return scored.slice(0, limit).map((x) => x.c);
}

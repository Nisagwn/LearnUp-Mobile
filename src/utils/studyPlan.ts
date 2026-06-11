// "Bugünkü Plan" öneri motoru — saf fonksiyon (Firebase/React importu yok).
// Üç sinyali harmanlar: SRS aciliyeti, düşük ustalık, yükseliş momentumu.
// İlerleme ekranı ve ders detayında kullanılır; test edilebilir kalması için
// zaman (nowMs) dışarıdan enjekte edilir.

import { categorize, type SRSCard } from '@/utils/srs';
import { resolveSubject } from '@/utils/subjects';

export type StudyTaskKind = 'srs' | 'weak' | 'momentum' | 'start';

export type StudyTask = {
  kind: StudyTaskKind;
  subject: string; // görüntülenen ders adı — Türkçe kanonik (örn. "Matematik")
  routeSubject: string; // navigasyon/veri eşleşmesi için ham ders adı (örn. "mathematics")
  subTopic?: string;
  title: string;
  reason: string;
  estimatedMin: number;
  score: number;
};

type Trend = 'up' | 'down' | 'flat';

export type StudyPlanInput = {
  srsCards: SRSCard[];
  masteryScores: Record<string, { solved_count?: number; score?: number }>;
  subjectTrends: Record<string, Trend>;
  weakSubTopicBySubject: Record<string, { subTopic: string; wrongCount: number }>;
  avgSecondsPerSubject: Record<string, number>;
  nowMs: number;
};

const QUESTIONS_PER_TASK = 10;
const DEFAULT_SEC_PER_Q = 45;
const MIN_SOLVED_FOR_SIGNAL = 3; // az veri = gürültü, öneri motoruna sokma
const DAY_MS = 24 * 60 * 60 * 1000;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function estimatedMinutes(subjectLower: string, avgSec: Record<string, number>): number {
  const sec = avgSec[subjectLower] && avgSec[subjectLower] > 0 ? avgSec[subjectLower] : DEFAULT_SEC_PER_Q;
  return Math.max(1, Math.round((sec * QUESTIONS_PER_TASK) / 60));
}

// nextReviewAt'i geçmiş (review) veya henüz öğrenilmemiş (new) kartlar "due".
// Yalnız müfredat dersleri plana girer; özel AI konuları / "Genel" elenir, böylece
// plan alakasız yerden soru çekmez. Kanonik anahtarda birleştirilir ("math" + "Matematik").
function buildSrsCandidates(input: StudyPlanInput): StudyTask[] {
  const { srsCards, avgSecondsPerSubject, nowMs } = input;
  const byKey = new Map<
    string,
    { label: string; routeSubject: string; count: number; maxOverdueDays: number }
  >();
  srsCards.forEach((c) => {
    const cat = categorize(c, nowMs);
    if (cat !== 'new' && cat !== 'review') return;
    const raw = c.subject || '';
    const resolved = resolveSubject(raw);
    if (!resolved.canonical) return; // müfredat dışı (özel AI konusu / Genel) → plana alma
    const overdueDays =
      cat === 'review' && c.nextReviewAtMs > 0 ? Math.max(0, (nowMs - c.nextReviewAtMs) / DAY_MS) : 7;
    const cur =
      byKey.get(resolved.key) ??
      { label: resolved.label, routeSubject: raw, count: 0, maxOverdueDays: 0 };
    cur.count += 1;
    cur.maxOverdueDays = Math.max(cur.maxOverdueDays, overdueDays);
    byKey.set(resolved.key, cur);
  });

  return Array.from(byKey.values()).map(({ label, routeSubject, count, maxOverdueDays }) => {
    const urgency = clamp01(0.6 * clamp01(count / 8) + 0.4 * clamp01(maxOverdueDays / 7));
    return {
      kind: 'srs' as const,
      subject: label,
      routeSubject,
      title: `${label} — tekrar zamanı`,
      reason: `${count} kart tekrarı bekliyor`,
      estimatedMin: estimatedMinutes(routeSubject.toLowerCase(), avgSecondsPerSubject),
      score: 0.5 * urgency,
    };
  });
}

function buildMasteryCandidates(input: StudyPlanInput): StudyTask[] {
  const { masteryScores, subjectTrends, weakSubTopicBySubject, avgSecondsPerSubject } = input;
  const tasks: StudyTask[] = [];

  Object.entries(masteryScores).forEach(([subject, m]) => {
    const solved = m.solved_count ?? 0;
    if (solved < MIN_SOLVED_FOR_SIGNAL) return;
    const resolved = resolveSubject(subject);
    if (!resolved.canonical) return; // müfredat dışı (özel AI konusu) → plana alma
    const label = resolved.label;
    const score = m.score ?? 0;
    const lower = subject.toLowerCase();
    const estMin = estimatedMinutes(lower, avgSecondsPerSubject);
    const weak = weakSubTopicBySubject[lower];

    if (score < 100) {
      tasks.push({
        kind: 'weak',
        subject: label,
        routeSubject: subject,
        subTopic: weak?.subTopic,
        title: `${label} — eksik kapat`,
        reason: weak?.subTopic
          ? `En çok "${weak.subTopic}" konusunda zorlanıyorsun`
          : `Ustalık %${score}`,
        estimatedMin: estMin,
        score: 0.3 * ((100 - score) / 100),
      });
    }

    if (subjectTrends[lower] === 'up') {
      tasks.push({
        kind: 'momentum',
        subject: label,
        routeSubject: subject,
        title: `${label} — yükselişini sürdür`,
        reason: 'Son haftalarda yükselişte, pekiştir',
        estimatedMin: estMin,
        score: 0.2,
      });
    }
  });

  return tasks;
}

/**
 * En değerli 3 görevi döndürür. Dengeli plan için önce her türden (srs/weak/
 * momentum) en iyi adayı, farklı derslerden seçer; boş kalan slotları kalan
 * adaylardan skora göre doldurur. Hiç sinyal yoksa tek "başla" görevi döner.
 */
export function buildStudyPlan(input: StudyPlanInput): StudyTask[] {
  const candidates = [...buildSrsCandidates(input), ...buildMasteryCandidates(input)].sort(
    (a, b) => b.score - a.score,
  );

  if (candidates.length === 0) {
    return [
      {
        kind: 'start',
        subject: '',
        routeSubject: '',
        title: 'İlk quizinle başla',
        reason: 'Birkaç soru çöz, planın kişiselleşsin',
        estimatedMin: 5,
        score: 0,
      },
    ];
  }

  const picked: StudyTask[] = [];
  const usedSubjects = new Set<string>();
  const usedKinds = new Set<StudyTaskKind>();

  // 1. tur: tür çeşitliliği — her kinds'tan en iyi, farklı derslerden
  for (const task of candidates) {
    if (picked.length >= 3) break;
    if (usedKinds.has(task.kind) || usedSubjects.has(task.subject)) continue;
    picked.push(task);
    usedKinds.add(task.kind);
    usedSubjects.add(task.subject);
  }

  // 2. tur: kalan slotları skora göre doldur (ders tekrarına izin verme)
  for (const task of candidates) {
    if (picked.length >= 3) break;
    if (usedSubjects.has(task.subject)) continue;
    picked.push(task);
    usedSubjects.add(task.subject);
  }

  return picked.slice(0, 3);
}

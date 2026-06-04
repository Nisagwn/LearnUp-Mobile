// Smart Feed — "Önerilenler" tab'ı için saf, deterministik öncelikli kart akışı.
// Tüm girdileri UserStatsContext sağlar; ekstra Firestore round-trip yok.

export type FeedItem =
  | {
      type: 'today_goal';
      id: string;
      subject: string;
      progress: number;
      target: number;
      priority: number;
    }
  | {
      type: 'review_due';
      id: string;
      count: number;
      priority: number;
    }
  | {
      type: 'continue';
      id: string;
      subject: string;
      subTopic?: string;
      lastSolvedAtMs: number;
      priority: number;
    }
  | {
      type: 'streak_at_risk';
      id: string;
      currentStreak: number;
      priority: number;
    }
  | {
      type: 'streak_milestone';
      id: string;
      nextDay: 7 | 30 | 100;
      currentStreak: number;
      priority: number;
    }
  | {
      type: 'weak_topic';
      id: string;
      subject: string;
      subTopic: string;
      wrongCount: number;
      priority: number;
    }
  | {
      type: 'new_subject';
      id: string;
      subject: string;
      priority: number;
    }
  | {
      type: 'mock_exam';
      id: string;
      subject: string;
      priority: number;
    };

export type FeedItemType = FeedItem['type'];

export interface FeedInputs {
  /** "biology" → { score, solved_count } */
  masteryScores: Record<string, { score?: number; solved_count?: number }>;
  /** "biology" → ms timestamp */
  lastSolvedBySubject: Record<string, number>;
  /** "biology" → { subTopic, wrongCount } */
  weakSubTopicBySubject: Record<string, { subTopic: string; wrongCount: number }>;
  /** All known subjects (lowercase key → question count) */
  subjectsCatalog: { key: string; count: number }[];
  /** Gamification slice: streak + dailyQuests */
  gamification: {
    streak?: { count?: number; lastActiveDate?: string };
    dailyQuests?: {
      quests?: { type?: string; subject?: string; progress?: number; target?: number }[];
    };
  } | null;
  /** Kaç SRS kartı şu an due — review/yeni durumda */
  srsDueCount: number;
  /** Son mock sınav tarihi (ms) — yoksa 0 */
  lastMockExamAtMs?: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function isoDay(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * UserStatsContext girdilerinden ve şimdiki zamandan deterministik bir
 * öncelik sıralı feed üretir. Saf fonksiyon — `now` enjekte edilir.
 *
 * dismissedIds: AsyncStorage'da 24sa boyunca dismiss edilmiş itemId'ler.
 */
export function buildLearnFeed(inputs: FeedInputs, now: number, dismissedIds: string[] = []): FeedItem[] {
  const items: FeedItem[] = [];
  const dismissed = new Set(dismissedIds);
  const today = isoDay(now);

  // 1) today_goal — dailyQuests'te subject_solve aktifse
  const subjectQuest = inputs.gamification?.dailyQuests?.quests?.find(
    (q) => q?.type === 'subject_solve' && q?.subject,
  );
  if (subjectQuest && subjectQuest.subject) {
    const progress = subjectQuest.progress ?? 0;
    const target = subjectQuest.target ?? 0;
    if (target > 0 && progress < target) {
      items.push({
        type: 'today_goal',
        id: `today_goal:${subjectQuest.subject}`,
        subject: subjectQuest.subject,
        progress,
        target,
        priority: 100,
      });
    }
  }

  // 2) review_due — SRS kartları bekliyor
  if (inputs.srsDueCount > 0) {
    items.push({
      type: 'review_due',
      id: 'review_due',
      count: inputs.srsDueCount,
      priority: 95 * Math.min(1, inputs.srsDueCount / 10),
    });
  }

  // 3) continue — son aktivite < 24sa
  const lastEntries = Object.entries(inputs.lastSolvedBySubject).sort((a, b) => b[1] - a[1]);
  if (lastEntries.length > 0) {
    const [lastSubject, lastMs] = lastEntries[0]!;
    const ago = now - lastMs;
    if (ago < 24 * HOUR_MS) {
      const weak = inputs.weakSubTopicBySubject[lastSubject.toLowerCase()];
      items.push({
        type: 'continue',
        id: `continue:${lastSubject}`,
        subject: lastSubject,
        subTopic: weak?.subTopic,
        lastSolvedAtMs: lastMs,
        priority: 90,
      });
    }
  }

  // 4) streak_at_risk — streak var ve bugün hiç aktivite yok ve saat geç (>=18)
  const streak = inputs.gamification?.streak;
  const lastActiveDate = streak?.lastActiveDate ?? null;
  const currentStreak = streak?.count ?? 0;
  if (currentStreak > 0 && lastActiveDate !== today) {
    const hour = new Date(now).getHours();
    if (hour >= 18) {
      items.push({
        type: 'streak_at_risk',
        id: 'streak_at_risk',
        currentStreak,
        priority: 85,
      });
    }
  }

  // 5) streak_milestone — yarın 7/30/100. gün olacak ve bugün aktifse
  if (currentStreak > 0 && lastActiveDate === today) {
    const nextDayCount = currentStreak + 1;
    if (nextDayCount === 7 || nextDayCount === 30 || nextDayCount === 100) {
      items.push({
        type: 'streak_milestone',
        id: `streak_milestone:${nextDayCount}`,
        nextDay: nextDayCount,
        currentStreak,
        priority: 75,
      });
    }
  }

  // 6) weak_topic — en yüksek wrongCount (>= 3 olan) — en kritik 1 tane
  let topWeak: { subject: string; subTopic: string; wrongCount: number } | null = null;
  Object.entries(inputs.weakSubTopicBySubject).forEach(([subjKey, v]) => {
    if (v.wrongCount >= 3 && (!topWeak || v.wrongCount > topWeak.wrongCount)) {
      topWeak = { subject: subjKey, subTopic: v.subTopic, wrongCount: v.wrongCount };
    }
  });
  if (topWeak) {
    const tw = topWeak as { subject: string; subTopic: string; wrongCount: number };
    items.push({
      type: 'weak_topic',
      id: `weak_topic:${tw.subject}:${tw.subTopic}`,
      subject: tw.subject,
      subTopic: tw.subTopic,
      wrongCount: tw.wrongCount,
      priority: 70,
    });
  }

  // 7) new_subject — hiç dokunulmamış ilk subject (en büyük havuza sahip)
  const untouched = inputs.subjectsCatalog
    .filter((s) => {
      const m = inputs.masteryScores[s.key];
      return !m || (m.solved_count ?? 0) === 0;
    })
    .sort((a, b) => b.count - a.count);
  if (untouched.length > 0) {
    items.push({
      type: 'new_subject',
      id: `new_subject:${untouched[0]!.key}`,
      subject: untouched[0]!.key,
      priority: 50,
    });
  }

  // 8) mock_exam — son mock'tan > 7 gün veya hiç yapılmamış, ve en az 1 subject mastery >= 0 var
  const sinceMock = inputs.lastMockExamAtMs ? now - inputs.lastMockExamAtMs : Infinity;
  const hasMasteredSubject = Object.values(inputs.masteryScores).some(
    (m) => (m.solved_count ?? 0) >= 10,
  );
  if (sinceMock > 7 * DAY_MS && hasMasteredSubject) {
    // En çok çözülen subject mock için adaydır
    const top = Object.entries(inputs.masteryScores)
      .sort((a, b) => (b[1].solved_count ?? 0) - (a[1].solved_count ?? 0))[0];
    if (top) {
      items.push({
        type: 'mock_exam',
        id: `mock_exam:${top[0]}`,
        subject: top[0],
        priority: 40,
      });
    }
  }

  return items
    .filter((i) => !dismissed.has(i.id))
    .sort((a, b) => b.priority - a.priority);
}

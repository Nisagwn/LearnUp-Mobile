import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { resolveSubject } from '@/utils/subjects';

export interface StudentRisk {
  studentId: string;
  name: string;
  email?: string;
  successRate: number; // 0-100
  totalAnswered: number;
  wrongCount: number;
}

export type WeeklyDay = { name: string; date: string; Doğru: number; Yanlış: number; Boş: number };

export interface SubjectAccuracy {
  /** Türkçe görünür etiket. */
  label: string;
  /** Birleştirme anahtarı (kanonik). */
  key: string;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number; // 0-100
}

export interface RecentMistake {
  id: string;
  question: string;
  subject: string; // Türkçe görünür
  subTopic?: string;
  tsMs: number;
}

export interface StudentAnalytics {
  totalSolved: number; // son 30 gün
  totalCorrect: number;
  totalWrong: number;
  successRate: number; // 0-100
  weakTopics: { subTopic: string; wrongCount: number }[]; // en kötü 5
  weeklyActivity: WeeklyDay[]; // son 7 gün
  subjectBreakdown: SubjectAccuracy[]; // tüm dersler, total desc
  recentMistakes: RecentMistake[]; // son 10 yanlış (snapshot taşıyan SRS kartlarından)
}

type RawLog = {
  isCorrect?: boolean;
  isSkipped?: boolean;
  skipped?: boolean;
  sub_topic?: string;
  subject?: string;
  timestamp?: Timestamp;
};

type RawSRSCard = {
  subject?: string;
  sub_topic?: string;
  lastReviewedAt?: Timestamp;
  consecutiveCorrect?: number;
  snapshot?: { question?: string; choices?: string[]; answer?: number };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function isoDay(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Saf agregasyon — log'lardan istatistik üretir. Test edilebilir.
 * teacherAnalyticsApi.aggregateClassAnalytics ile birebir aynı window'lar
 * (son 7 gün haftalık, son 30 gün toplam) kullanılır.
 */
export function aggregateStudentAnalytics(
  logs: { isCorrect: boolean; isSkipped: boolean; subTopic: string; subject: string; tsMs: number }[],
  recentMistakes: RecentMistake[],
  now: number,
): Omit<StudentAnalytics, 'recentMistakes'> & { recentMistakes: RecentMistake[] } {
  const sevenDaysAgo = now - 7 * DAY_MS;
  const thirtyDaysAgo = now - 30 * DAY_MS;

  let totalSolved = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  const weakCounter = new Map<string, number>();
  const bySubject = new Map<string, { key: string; label: string; total: number; correct: number; wrong: number }>();

  const dayBuckets: Record<string, { c: number; w: number; s: number }> = {};
  const days: { iso: string; name: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    const iso = isoDay(d.getTime());
    days.push({ iso, name: DAY_NAMES[d.getDay()]! });
    dayBuckets[iso] = { c: 0, w: 0, s: 0 };
  }

  logs.forEach((l) => {
    if (l.tsMs < thirtyDaysAgo) return;
    totalSolved++;
    const isCorrect = l.isCorrect === true;
    const isSkipped = l.isSkipped === true;
    if (isCorrect) totalCorrect++;
    else if (!isSkipped) totalWrong++;

    // Ders kırılımı — kanonik anahtara indir (Mathematics + Matematik = Matematik)
    const resolved = resolveSubject(l.subject || 'Genel');
    const entry = bySubject.get(resolved.key) ?? {
      key: resolved.key,
      label: resolved.label,
      total: 0,
      correct: 0,
      wrong: 0,
    };
    entry.total++;
    if (isCorrect) entry.correct++;
    else if (!isSkipped) entry.wrong++;
    bySubject.set(resolved.key, entry);

    if (!isCorrect && !isSkipped) {
      const key = l.subTopic || 'Genel';
      weakCounter.set(key, (weakCounter.get(key) ?? 0) + 1);
    }

    const iso = isoDay(l.tsMs);
    const bucket = dayBuckets[iso];
    if (bucket) {
      if (isCorrect) bucket.c++;
      else if (isSkipped) bucket.s++;
      else bucket.w++;
    }
  });

  const successRate =
    totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;

  const weakTopics = Array.from(weakCounter.entries())
    .map(([subTopic, wrongCount]) => ({ subTopic, wrongCount }))
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 5);

  const weeklyActivity: WeeklyDay[] = days.map(({ iso, name }) => {
    const b = dayBuckets[iso]!;
    return { name, date: iso, Doğru: b.c, Yanlış: b.w, Boş: b.s };
  });

  const subjectBreakdown: SubjectAccuracy[] = Array.from(bySubject.values())
    .map((e) => ({
      label: e.label,
      key: e.key,
      total: e.total,
      correct: e.correct,
      wrong: e.wrong,
      accuracy: e.correct + e.wrong > 0 ? Math.round((e.correct / (e.correct + e.wrong)) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalSolved,
    totalCorrect,
    totalWrong,
    successRate,
    weakTopics,
    weeklyActivity,
    subjectBreakdown,
    recentMistakes,
  };
}

/**
 * Belirli öğrencinin tüm analitiğini çeker. user_logs (son 2000) + srs_cards
 * (snapshot taşıyan, son aktivite desc, kısmi yanlış geçmişi için).
 */
export async function fetchStudentAnalytics(studentId: string): Promise<StudentAnalytics> {
  if (!studentId) {
    return {
      totalSolved: 0,
      totalCorrect: 0,
      totalWrong: 0,
      successRate: 0,
      weakTopics: [],
      weeklyActivity: [],
      subjectBreakdown: [],
      recentMistakes: [],
    };
  }

  // Composite index (studentId, timestamp DESC) gerekli — eklendi.
  // Index henüz "Building" durumda olursa orderBy'sız fallback dene.
  let logsSnap;
  try {
    logsSnap = await getDocs(
      query(
        collection(db, 'user_logs'),
        where('studentId', '==', studentId),
        orderBy('timestamp', 'desc'),
        fbLimit(2000),
      ),
    );
  } catch (err) {
    console.warn('[studentAnalytics] index pending, falling back:', (err as Error).message);
    logsSnap = await getDocs(
      query(collection(db, 'user_logs'), where('studentId', '==', studentId), fbLimit(2000)),
    );
  }

  const srsSnap = await getDocs(
    query(
      collection(db, 'users', studentId, 'srs_cards'),
      orderBy('lastReviewedAt', 'desc'),
      fbLimit(50),
    ),
  );

  const logs = logsSnap.docs.map((d) => {
    const raw = d.data() as RawLog;
    const ts = raw.timestamp;
    return {
      isCorrect: raw.isCorrect === true,
      isSkipped: raw.isSkipped === true || raw.skipped === true,
      subTopic: String(raw.sub_topic ?? raw.subject ?? 'Genel'),
      subject: String(raw.subject ?? 'Genel'),
      tsMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0,
    };
  });

  // Son yanlış kartlar — snapshot'ı olan + en az 1 yanlış (consecutiveCorrect=0)
  const recentMistakes: RecentMistake[] = [];
  srsSnap.forEach((d) => {
    const raw = d.data() as RawSRSCard;
    const snap = raw.snapshot;
    if (!snap || !snap.question) return;
    if ((raw.consecutiveCorrect ?? 0) > 0) return; // doğru çözmüş, hata değil
    const ts = raw.lastReviewedAt;
    recentMistakes.push({
      id: d.id,
      question: String(snap.question).slice(0, 240),
      subject: resolveSubject(raw.subject || 'Genel').label,
      subTopic: raw.sub_topic ? String(raw.sub_topic) : undefined,
      tsMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0,
    });
  });
  // Sırala: en yeni → eski; ilk 10
  recentMistakes.sort((a, b) => b.tsMs - a.tsMs);
  const top10 = recentMistakes.slice(0, 10);

  return aggregateStudentAnalytics(logs, top10, Date.now());
}

const DAY_MS_RISK = 24 * 60 * 60 * 1000;

/**
 * Dikkat gereken öğrencileri bulur — son 30 gün içinde en az `minAnswered`
 * soruyu cevaplamış öğrencilerden, en düşük success rate'e sahip ilk N.
 *
 * Sample bias engellemek için minAnswered eşiği şart (default 10).
 * Chunked `in` (30'arlı) ile büyük sınıflarda da çalışır.
 */
export async function fetchStudentsAtRisk(
  teacherUid: string,
  limit: number = 3,
  minAnswered: number = 10,
): Promise<StudentRisk[]> {
  if (!teacherUid) return [];

  const studentsSnap = await getDocs(
    query(
      collection(db, 'users'),
      where('teacherId', '==', teacherUid),
      where('role', '==', 'student'),
    ),
  );

  if (studentsSnap.empty) return [];

  const studentMeta = new Map<string, { name: string; email?: string }>();
  const studentIds: string[] = [];
  studentsSnap.forEach((d) => {
    const data = d.data() || {};
    const name =
      (data.name as string) ||
      (data.fullName as string) ||
      (data.email as string)?.split('@')[0] ||
      'Öğrenci';
    studentMeta.set(d.id, { name, email: data.email });
    studentIds.push(d.id);
  });

  const cutoffMs = Date.now() - 30 * DAY_MS_RISK;
  const counters = new Map<string, { total: number; correct: number; wrong: number }>();

  for (let i = 0; i < studentIds.length; i += 30) {
    const chunk = studentIds.slice(i, i + 30);
    let snap;
    try {
      // eslint-disable-next-line no-await-in-loop
      snap = await getDocs(
        query(
          collection(db, 'user_logs'),
          where('studentId', 'in', chunk),
          orderBy('timestamp', 'desc'),
          fbLimit(3000),
        ),
      );
    } catch {
      // composite index hazır değilse orderBy'sız fallback
      // eslint-disable-next-line no-await-in-loop
      snap = await getDocs(
        query(
          collection(db, 'user_logs'),
          where('studentId', 'in', chunk),
          fbLimit(3000),
        ),
      );
    }
    snap.forEach((d) => {
      const x = d.data() as RawLog;
      const ts = x.timestamp;
      const tsMs = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0;
      if (tsMs < cutoffMs) return;
      const sid = (x as { studentId?: string }).studentId;
      if (!sid) return;
      const entry = counters.get(sid) ?? { total: 0, correct: 0, wrong: 0 };
      entry.total += 1;
      const isCorrect = x.isCorrect === true;
      const isSkipped = x.isSkipped === true || x.skipped === true;
      if (isCorrect) entry.correct += 1;
      else if (!isSkipped) entry.wrong += 1;
      counters.set(sid, entry);
    });
  }

  const risks: StudentRisk[] = [];
  counters.forEach((c, sid) => {
    if (c.total < minAnswered) return;
    const meta = studentMeta.get(sid);
    if (!meta) return;
    const denom = c.correct + c.wrong;
    const rate = denom > 0 ? Math.round((c.correct / denom) * 100) : 0;
    risks.push({
      studentId: sid,
      name: meta.name,
      email: meta.email,
      successRate: rate,
      totalAnswered: c.total,
      wrongCount: c.wrong,
    });
  });

  risks.sort((a, b) => a.successRate - b.successRate || b.wrongCount - a.wrongCount);
  return risks.slice(0, limit);
}

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

export type WeeklyDay = { name: string; date: string; Doğru: number; Yanlış: number; Boş: number };

export interface ClassAnalytics {
  studentCount: number;
  activeStudents: number; // son 7 günde en az 1 log atan benzersiz öğrenci
  totalSolved: number; // son 30 gün
  classAverage: number; // doğru / (doğru+yanlış) * 100
  weakTopics: { subTopic: string; wrongCount: number }[]; // en kötü 5
  weeklyActivity: WeeklyDay[]; // son 7 gün
}

type RawLog = {
  studentId?: string;
  isCorrect?: boolean;
  isSkipped?: boolean;
  skipped?: boolean;
  sub_topic?: string;
  subject?: string;
  timestamp?: Timestamp;
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
 * Saf agregasyon — test edilebilir. logs ms-epoch'lı timestamp taşımalı (tsMs).
 */
export function aggregateClassAnalytics(
  logs: { studentId: string; isCorrect: boolean; isSkipped: boolean; subTopic: string; tsMs: number }[],
  studentCount: number,
  now: number,
): ClassAnalytics {
  const sevenDaysAgo = now - 7 * DAY_MS;
  const thirtyDaysAgo = now - 30 * DAY_MS;

  let totalSolved = 0;
  let correct = 0;
  let wrong = 0;
  const activeSet = new Set<string>();
  const weakCounter = new Map<string, number>();

  // Son 7 gün günlük kovalar
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
    if (isCorrect) correct++;
    else if (!isSkipped) wrong++;

    if (l.tsMs >= sevenDaysAgo) activeSet.add(l.studentId);

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

  const classAverage = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;

  const weakTopics = Array.from(weakCounter.entries())
    .map(([subTopic, wrongCount]) => ({ subTopic, wrongCount }))
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 5);

  const weeklyActivity: WeeklyDay[] = days.map(({ iso, name }) => {
    const b = dayBuckets[iso]!;
    return { name, date: iso, Doğru: b.c, Yanlış: b.w, Boş: b.s };
  });

  return {
    studentCount,
    activeStudents: activeSet.size,
    totalSolved,
    classAverage,
    weakTopics,
    weeklyActivity,
  };
}

function mapRawLog(d: { data: () => RawLog }) {
  const raw = d.data();
  const ts = raw.timestamp;
  return {
    studentId: String(raw.studentId ?? ''),
    isCorrect: raw.isCorrect === true,
    isSkipped: raw.isSkipped === true || raw.skipped === true,
    subTopic: String(raw.sub_topic ?? raw.subject ?? 'Genel'),
    tsMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0,
  };
}

/**
 * Öğretmenin sınıf analitiğini çeker. Önce teacherId-bazlı sorgu; eski log'larda
 * teacherId yoksa, sınıftaki öğrenci id'leri üzerinden (`in` chunks of 30)
 * fallback yapar. `mock` değil — gerçek user_logs verisi.
 */
export async function fetchClassAnalytics(teacherUid: string): Promise<ClassAnalytics> {
  // Composite index (teacherId, timestamp DESC) henüz "Building" / deploy
  // edilmemiş olabilir — orderBy'sız fallback ile sayfa hala dolar.
  const teacherLogsQuery = async () => {
    try {
      return await getDocs(
        query(
          collection(db, 'user_logs'),
          where('teacherId', '==', teacherUid),
          orderBy('timestamp', 'desc'),
          fbLimit(3000),
        ),
      );
    } catch (err) {
      console.warn('[classAnalytics] orderBy index pending:', (err as Error).message);
      return await getDocs(
        query(collection(db, 'user_logs'), where('teacherId', '==', teacherUid), fbLimit(3000)),
      );
    }
  };

  const [logsByTeacherSnap, studentsSnap] = await Promise.all([
    teacherLogsQuery(),
    getDocs(
      query(collection(db, 'users'), where('teacherId', '==', teacherUid), where('role', '==', 'student')),
    ),
  ]);

  let logs = logsByTeacherSnap.docs.map(mapRawLog);
  const studentIds = studentsSnap.docs.map((d) => d.id);

  // Eski log'larda teacherId boş kalmış olabilir — studentId list üzerinden
  // chunk'lı (in max 30) ek sorgu ile tamamla.
  if (logs.length === 0 && studentIds.length > 0) {
    const seen = new Set<string>();
    const extra: ReturnType<typeof mapRawLog>[] = [];
    for (let i = 0; i < studentIds.length; i += 30) {
      const chunk = studentIds.slice(i, i + 30);
      // eslint-disable-next-line no-await-in-loop
      let snap;
      try {
        snap = await getDocs(
          query(
            collection(db, 'user_logs'),
            where('studentId', 'in', chunk),
            orderBy('timestamp', 'desc'),
            fbLimit(1000),
          ),
        );
      } catch {
        // eslint-disable-next-line no-await-in-loop
        snap = await getDocs(
          query(collection(db, 'user_logs'), where('studentId', 'in', chunk), fbLimit(1000)),
        );
      }
      snap.forEach((d) => {
        if (seen.has(d.id)) return;
        seen.add(d.id);
        extra.push(mapRawLog(d));
      });
    }
    logs = extra;
  }

  return aggregateClassAnalytics(logs, studentsSnap.size, Date.now());
}

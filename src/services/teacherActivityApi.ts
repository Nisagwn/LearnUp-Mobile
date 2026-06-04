import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  Timestamp,
  orderBy,
  limit as fbLimit,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

export type ActivityType =
  | 'submission'
  | 'targeted_done'
  | 'new_student'
  | 'assignment_created'
  | 'announcement_created';

export interface ActivityEvent {
  id: string; // type:docId — DRY anahtar
  type: ActivityType;
  tsMs: number;
  actorName: string;
  message: string;
  deepLink: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function tsToMs(t: Timestamp | null | undefined): number {
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

async function resolveStudentName(uid: string, cache: Map<string, string>): Promise<string> {
  if (!uid) return 'Öğrenci';
  const hit = cache.get(uid);
  if (hit) return hit;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      cache.set(uid, 'Öğrenci');
      return 'Öğrenci';
    }
    const d = snap.data() || {};
    const name =
      (d.name as string) ||
      (d.fullName as string) ||
      (d.email as string)?.split('@')[0] ||
      'Öğrenci';
    cache.set(uid, name);
    return name;
  } catch {
    cache.set(uid, 'Öğrenci');
    return 'Öğrenci';
  }
}

async function fetchAssignmentTitle(
  id: string,
  cache: Map<string, string>,
): Promise<string> {
  if (!id) return 'ödev';
  const hit = cache.get(id);
  if (hit) return hit;
  try {
    const snap = await getDoc(doc(db, 'assignments', id));
    if (!snap.exists()) {
      cache.set(id, 'ödev');
      return 'ödev';
    }
    const title = String((snap.data() || {}).title || 'ödev').slice(0, 60);
    cache.set(id, title);
    return title;
  } catch {
    cache.set(id, 'ödev');
    return 'ödev';
  }
}

/**
 * 5 farklı koleksiyondan son aktiviteleri çekip merge eder. Real-time gerekmez
 * (Panel yenilenince refetch ile yeterli — pull-to-refresh + 30s interval).
 *
 * Maliyet odaklı: her koleksiyon için limit=N (default 5), client-side merged
 * sort by tsMs desc, top N return.
 */
export async function fetchRecentActivity(
  teacherUid: string,
  limit: number = 5,
): Promise<ActivityEvent[]> {
  if (!teacherUid) return [];

  const since = Timestamp.fromMillis(Date.now() - 14 * DAY_MS);
  const events: ActivityEvent[] = [];
  const studentCache = new Map<string, string>();
  const assignmentCache = new Map<string, string>();

  // 1) Submission'lar
  try {
    const snap = await getDocs(
      query(
        collection(db, 'assignment_submissions'),
        where('teacherId', '==', teacherUid),
        orderBy('submittedAt', 'desc'),
        fbLimit(limit),
      ),
    );
    for (const d of snap.docs) {
      const x = d.data() || {};
      const tsMs = tsToMs(x.submittedAt);
      if (!tsMs) continue;
      const studentName = await resolveStudentName(String(x.studentId || ''), studentCache);
      const assignTitle = await fetchAssignmentTitle(
        String(x.assignmentId || ''),
        assignmentCache,
      );
      events.push({
        id: `submission:${d.id}`,
        type: 'submission',
        tsMs,
        actorName: studentName,
        message: `${studentName} "${assignTitle}" ödevini gönderdi`,
        deepLink: `/(teacher)/assignments/${x.assignmentId}/submissions`,
      });
    }
  } catch {
    /* ignore */
  }

  // 2) Tamamlanan hedefli setler
  try {
    const snap = await getDocs(
      query(
        collection(db, 'targeted_assignments'),
        where('teacherId', '==', teacherUid),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc'),
        fbLimit(limit),
      ),
    );
    for (const d of snap.docs) {
      const x = d.data() || {};
      const tsMs = tsToMs(x.completedAt);
      if (!tsMs) continue;
      const studentName = await resolveStudentName(String(x.studentId || ''), studentCache);
      const score = typeof x.score === 'number' ? x.score : x.autoScore || 0;
      const max = Array.isArray(x.questionIds) ? x.questionIds.length : 0;
      events.push({
        id: `targeted_done:${d.id}`,
        type: 'targeted_done',
        tsMs,
        actorName: studentName,
        message: `${studentName} hedefli setini bitirdi · ${score}/${max}`,
        deepLink: `/(teacher)/classes/${x.studentId}`,
      });
    }
  } catch {
    /* ignore — index henüz hazır olmayabilir */
  }

  // 3) Yeni öğrenciler (son 14 gün)
  try {
    const snap = await getDocs(
      query(
        collection(db, 'users'),
        where('teacherId', '==', teacherUid),
        where('role', '==', 'student'),
      ),
    );
    snap.forEach((d) => {
      const x = d.data() || {};
      const tsMs = tsToMs(x.createdAt);
      if (!tsMs || tsMs < since.toMillis()) return;
      const studentName =
        (x.name as string) ||
        (x.fullName as string) ||
        (x.email as string)?.split('@')[0] ||
        'Yeni öğrenci';
      studentCache.set(d.id, studentName);
      events.push({
        id: `new_student:${d.id}`,
        type: 'new_student',
        tsMs,
        actorName: studentName,
        message: `Yeni öğrenci katıldı: ${studentName}`,
        deepLink: `/(teacher)/classes/${d.id}`,
      });
    });
  } catch {
    /* ignore */
  }

  // 4) Yeni ödevler
  try {
    const snap = await getDocs(
      query(
        collection(db, 'assignments'),
        where('teacherId', '==', teacherUid),
        orderBy('createdAt', 'desc'),
        fbLimit(limit),
      ),
    );
    snap.forEach((d) => {
      const x = d.data() || {};
      const tsMs = tsToMs(x.createdAt);
      if (!tsMs) return;
      const title = String(x.title || 'ödev').slice(0, 60);
      assignmentCache.set(d.id, title);
      events.push({
        id: `assignment_created:${d.id}`,
        type: 'assignment_created',
        tsMs,
        actorName: 'Sen',
        message: `"${title}" ödevini yayınladın`,
        deepLink: `/(teacher)/assignments/${d.id}/submissions`,
      });
    });
  } catch {
    /* ignore */
  }

  // 5) Yeni duyurular
  try {
    const snap = await getDocs(
      query(
        collection(db, 'announcements'),
        where('teacherId', '==', teacherUid),
        orderBy('createdAt', 'desc'),
        fbLimit(limit),
      ),
    );
    snap.forEach((d) => {
      const x = d.data() || {};
      const tsMs = tsToMs(x.createdAt);
      if (!tsMs) return;
      const title = String(x.title || 'Duyuru').slice(0, 60);
      events.push({
        id: `announcement_created:${d.id}`,
        type: 'announcement_created',
        tsMs,
        actorName: 'Sen',
        message: `"${title}" duyurusunu yayınladın`,
        deepLink: '/(teacher)/announcements',
      });
    });
  } catch {
    /* ignore */
  }

  events.sort((a, b) => b.tsMs - a.tsMs);
  return events.slice(0, limit);
}

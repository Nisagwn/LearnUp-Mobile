import {
  collection,
  doc,
  getCountFromServer,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

export type TeacherLifetimeStats = {
  questionsCreated: number;
  assignmentsCreated: number;
  announcementsCreated: number;
};

/**
 * Öğretmenin üretim toplamlarını çeker (lifetime).
 * 3 paralel `getCountFromServer` sorgusu — her biri 1 read tüketir.
 */
export async function fetchTeacherLifetimeStats(
  teacherUid: string,
): Promise<TeacherLifetimeStats> {
  if (!teacherUid) {
    return { questionsCreated: 0, assignmentsCreated: 0, announcementsCreated: 0 };
  }
  const safeCount = async (coll: string): Promise<number> => {
    try {
      const snap = await getCountFromServer(
        query(collection(db, coll), where('teacherId', '==', teacherUid)),
      );
      return snap.data().count ?? 0;
    } catch (err) {
      console.warn(`[teacherLifetime] ${coll} count failed:`, (err as Error).message);
      return 0;
    }
  };

  const [q, a, n] = await Promise.all([
    safeCount('questions'),
    safeCount('assignments'),
    safeCount('announcements'),
  ]);
  return { questionsCreated: q, assignmentsCreated: a, announcementsCreated: n };
}

/** Bio + school güncellemesi — sanitize edilir, max uzunlukla kırpılır. */
export async function updateTeacherBio(
  teacherUid: string,
  data: { bio: string; school: string },
): Promise<void> {
  if (!teacherUid) return;
  const clean = (s: string, max: number) =>
    s.trim().replace(/[<>]/g, '').slice(0, max);
  await updateDoc(doc(db, 'users', teacherUid), {
    bio: clean(data.bio, 200),
    school: clean(data.school, 80),
  });
}

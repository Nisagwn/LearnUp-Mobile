import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

export type Announcement = {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  content: string;
  createdAtMs: number;
};

type RawAnnouncement = {
  teacherId?: string;
  teacherName?: string;
  title?: string;
  content?: string;
  createdAt?: Timestamp;
};

function tsMs(t: Timestamp | undefined): number {
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

function normalize(id: string, x: RawAnnouncement): Announcement {
  return {
    id,
    teacherId: String(x.teacherId ?? ''),
    teacherName: String(x.teacherName ?? 'Öğretmen'),
    title: String(x.title ?? ''),
    content: String(x.content ?? ''),
    createdAtMs: tsMs(x.createdAt),
  };
}

export async function createAnnouncement(
  teacherUid: string,
  teacherName: string,
  data: { title: string; content: string },
): Promise<void> {
  await addDoc(collection(db, 'announcements'), {
    teacherId: teacherUid,
    teacherName: teacherName.trim() || 'Öğretmen',
    title: data.title.trim(),
    content: data.content.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, 'announcements', id));
}

/** Öğretmen kendi duyurularını dinler. */
export function subscribeTeacherAnnouncements(
  teacherId: string,
  onChange: (items: Announcement[]) => void,
): Unsubscribe | null {
  if (!teacherId) return null;
  const q = query(collection(db, 'announcements'), where('teacherId', '==', teacherId));
  return onSnapshot(
    q,
    (snap) => {
      const arr: Announcement[] = [];
      snap.forEach((d) => arr.push(normalize(d.id, d.data() as RawAnnouncement)));
      arr.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onChange(arr);
    },
    (err) => {
      console.warn('teacher announcements listener:', err.message);
      onChange([]);
    },
  );
}

/**
 * Öğrenci, bağlı olduğu öğretmen(ler)in duyurularını dinler.
 * Tek bir teacherId veya birden fazla teacherIds dizisi kabul eder.
 * Firestore `in` operatörü max 30 değer destekler — fazlası slice'lanır.
 */
export function subscribeStudentAnnouncements(
  teacherIdOrIds: string | string[],
  onChange: (items: Announcement[]) => void,
): Unsubscribe | null {
  const ids = (Array.isArray(teacherIdOrIds) ? teacherIdOrIds : [teacherIdOrIds]).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  if (ids.length === 0) {
    onChange([]);
    return null;
  }
  const safeIds = ids.slice(0, 30);
  const q =
    safeIds.length === 1
      ? query(collection(db, 'announcements'), where('teacherId', '==', safeIds[0]))
      : query(collection(db, 'announcements'), where('teacherId', 'in', safeIds));
  return onSnapshot(
    q,
    (snap) => {
      const arr: Announcement[] = [];
      snap.forEach((d) => arr.push(normalize(d.id, d.data() as RawAnnouncement)));
      arr.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onChange(arr);
    },
    (err) => {
      console.warn('student announcements listener:', err.message);
      onChange([]);
    },
  );
}

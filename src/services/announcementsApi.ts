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
  title: string;
  content: string;
  createdAtMs: number;
};

type RawAnnouncement = {
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
    title: String(x.title ?? ''),
    content: String(x.content ?? ''),
    createdAtMs: tsMs(x.createdAt),
  };
}

export async function createAnnouncement(
  teacherUid: string,
  data: { title: string; content: string },
): Promise<void> {
  await addDoc(collection(db, 'announcements'), {
    teacherId: teacherUid,
    title: data.title.trim(),
    content: data.content.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, 'announcements', id));
}

function subscribe(
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
      console.warn('announcements listener:', err.message);
      onChange([]);
    },
  );
}

/** Öğretmen kendi duyurularını dinler. */
export const subscribeTeacherAnnouncements = subscribe;

/** Öğrenci, bağlı olduğu öğretmenin duyurularını dinler (aynı sorgu). */
export const subscribeStudentAnnouncements = subscribe;

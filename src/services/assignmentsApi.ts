import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

export type SubmissionType = 'quiz' | 'free';

export type TeacherAssignment = {
  id: string;
  title: string;
  description: string;
  subject: string;
  dueDateMs: number | null;
  createdAtMs: number;
  questionIds: string[];
  maxScore: number;
  submissionType: SubmissionType;
};

type RawAssignment = {
  title?: string;
  description?: string;
  subject?: string;
  dueDate?: Timestamp | null;
  createdAt?: Timestamp;
  questionIds?: string[];
  maxScore?: number;
  submissionType?: SubmissionType;
};

function tsMs(t: Timestamp | null | undefined): number {
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

function normalizeAssignment(id: string, raw: RawAssignment): TeacherAssignment {
  const questionIds = Array.isArray(raw.questionIds)
    ? raw.questionIds.filter((q): q is string => typeof q === 'string')
    : [];
  return {
    id,
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    subject: String(raw.subject ?? ''),
    dueDateMs: raw.dueDate ? tsMs(raw.dueDate) : null,
    createdAtMs: tsMs(raw.createdAt),
    questionIds,
    maxScore: typeof raw.maxScore === 'number' ? raw.maxScore : Math.max(1, questionIds.length),
    submissionType: raw.submissionType === 'free' ? 'free' : 'quiz',
  };
}

export interface CreateAssignmentInput {
  title: string;
  description: string;
  subject: string;
  dueDate: Date | null;
  questionIds?: string[];
  maxScore?: number;
  submissionType?: SubmissionType;
}

export async function createAssignment(
  teacherUid: string,
  data: CreateAssignmentInput,
): Promise<string> {
  const questionIds = (data.questionIds ?? []).filter(Boolean);
  const submissionType: SubmissionType = data.submissionType ?? (questionIds.length > 0 ? 'quiz' : 'free');
  const maxScore =
    typeof data.maxScore === 'number' && data.maxScore > 0
      ? data.maxScore
      : Math.max(1, questionIds.length);
  const ref = await addDoc(collection(db, 'assignments'), {
    teacherId: teacherUid,
    title: data.title.trim(),
    description: data.description.trim(),
    subject: data.subject.trim(),
    dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
    questionIds,
    maxScore,
    submissionType,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Tek bir ödevin tüm alanlarını çek (öğrenci/öğretmen detay ekranı için).
 */
export async function getAssignment(id: string): Promise<TeacherAssignment | null> {
  const snap = await getDoc(doc(db, 'assignments', id));
  if (!snap.exists()) return null;
  return normalizeAssignment(snap.id, snap.data() as RawAssignment);
}

export async function deleteAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'assignments', id));
}

export function subscribeTeacherAssignments(
  teacherUid: string,
  onChange: (items: TeacherAssignment[]) => void,
): Unsubscribe | null {
  if (!teacherUid) return null;
  const q = query(collection(db, 'assignments'), where('teacherId', '==', teacherUid));
  return onSnapshot(
    q,
    (snap) => {
      const arr: TeacherAssignment[] = [];
      snap.forEach((d) => {
        arr.push(normalizeAssignment(d.id, d.data() as RawAssignment));
      });
      arr.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onChange(arr);
    },
    (err) => {
      console.warn('assignments listener:', err.message);
      onChange([]);
    },
  );
}

/**
 * Öğrencinin bağlı olduğu öğretmen(ler)in ödevlerini dinler.
 * Tek bir teacherId ya da teacherIds dizisi kabul eder. Multi-class destekli.
 * Firestore `in` max 30 değer destekler — fazlası slice'lanır.
 */
export function subscribeStudentAssignments(
  teacherIdOrIds: string | string[],
  onChange: (items: TeacherAssignment[]) => void,
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
      ? query(collection(db, 'assignments'), where('teacherId', '==', safeIds[0]))
      : query(collection(db, 'assignments'), where('teacherId', 'in', safeIds));
  return onSnapshot(
    q,
    (snap) => {
      const arr: TeacherAssignment[] = [];
      snap.forEach((d) => {
        arr.push(normalizeAssignment(d.id, d.data() as RawAssignment));
      });
      arr.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onChange(arr);
    },
    (err) => {
      console.warn('student assignments listener:', err.message);
      onChange([]);
    },
  );
}

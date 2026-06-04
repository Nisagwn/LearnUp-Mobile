import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { BACKEND_BASE } from '@/constants/config';

export type SubmissionStatus = 'submitted' | 'reviewed';

export interface SubmissionAnswer {
  questionId: string;
  selectedIndex: number; // -1 = boş
  isCorrect: boolean;
  /** Soru havuzdan silinse bile metin kalsın diye snapshot. */
  questionTextSnapshot?: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  teacherId: string;
  answers: SubmissionAnswer[];
  autoScore: number; // 0..maxScore (cloud function set eder)
  score: number; // öğretmenin override edebileceği final puan (default = autoScore)
  feedback: string;
  status: SubmissionStatus;
  submittedAtMs: number;
  reviewedAtMs: number;
}

interface RawSubmission {
  assignmentId?: string;
  studentId?: string;
  teacherId?: string;
  answers?: unknown;
  autoScore?: number;
  score?: number;
  feedback?: string;
  status?: SubmissionStatus;
  submittedAt?: Timestamp;
  reviewedAt?: Timestamp;
}

function tsMs(t: Timestamp | null | undefined): number {
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

function normalize(id: string, raw: RawSubmission): Submission {
  const answers = Array.isArray(raw.answers)
    ? (raw.answers as unknown[]).filter((a): a is SubmissionAnswer => {
        if (!a || typeof a !== 'object') return false;
        const x = a as { questionId?: unknown };
        return typeof x.questionId === 'string';
      })
    : [];
  return {
    id,
    assignmentId: String(raw.assignmentId ?? ''),
    studentId: String(raw.studentId ?? ''),
    teacherId: String(raw.teacherId ?? ''),
    answers,
    autoScore: typeof raw.autoScore === 'number' ? raw.autoScore : 0,
    score: typeof raw.score === 'number' ? raw.score : typeof raw.autoScore === 'number' ? raw.autoScore : 0,
    feedback: typeof raw.feedback === 'string' ? raw.feedback : '',
    status: raw.status === 'reviewed' ? 'reviewed' : 'submitted',
    submittedAtMs: tsMs(raw.submittedAt),
    reviewedAtMs: tsMs(raw.reviewedAt),
  };
}

/**
 * Öğrencinin belirli bir ödeve gönderdiği submission (tek tane, idempotent).
 * Yoksa null döner.
 */
export async function getMySubmission(assignmentId: string): Promise<Submission | null> {
  const uid = auth.currentUser?.uid;
  if (!uid || !assignmentId) return null;
  const snap = await getDocs(
    query(
      collection(db, 'assignment_submissions'),
      where('studentId', '==', uid),
      where('assignmentId', '==', assignmentId),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return normalize(d.id, d.data() as RawSubmission);
}

/**
 * Öğretmenin bir ödevdeki tüm submission'larını dinler.
 */
export function subscribeAssignmentSubmissions(
  assignmentId: string,
  onChange: (items: Submission[]) => void,
): Unsubscribe | null {
  if (!assignmentId) return null;
  return onSnapshot(
    query(
      collection(db, 'assignment_submissions'),
      where('assignmentId', '==', assignmentId),
    ),
    (snap) => {
      const arr: Submission[] = [];
      snap.forEach((d) => arr.push(normalize(d.id, d.data() as RawSubmission)));
      arr.sort((a, b) => b.submittedAtMs - a.submittedAtMs);
      onChange(arr);
    },
    (err) => {
      console.warn('submissions listener:', err.message);
      onChange([]);
    },
  );
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const snap = await getDoc(doc(db, 'assignment_submissions', id));
  if (!snap.exists()) return null;
  return normalize(snap.id, snap.data() as RawSubmission);
}

/**
 * Öğretmen tarafı — feedback ve isteğe bağlı manuel skor güncellemesi + reviewed
 * status'ü yazar. Sahiplik rules üzerinde zorlanır (teacherId == auth.uid).
 */
export async function reviewSubmission(
  id: string,
  patch: { feedback?: string; score?: number },
): Promise<void> {
  const update: Record<string, unknown> = {
    status: 'reviewed',
    reviewedAt: serverTimestamp(),
  };
  if (typeof patch.feedback === 'string') update.feedback = patch.feedback;
  if (typeof patch.score === 'number' && patch.score >= 0) update.score = patch.score;
  await updateDoc(doc(db, 'assignment_submissions', id), update);
}

const SUBMIT_URL = `${BACKEND_BASE}/submitAssignment`;

/**
 * Öğrenci submission gönderir. Cloud Function otomatik puanı hesaplar ve
 * tekrar gönderim engellenir (unique guard: studentId+assignmentId).
 */
export async function submitAssignment(input: {
  assignmentId: string;
  answers: { questionId: string; selectedIndex: number }[];
}): Promise<{ submissionId: string; autoScore: number; maxScore: number }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Oturum bulunamadı');
  const token = await user.getIdToken().catch(() => null);
  const res = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      userId: user.uid,
      assignmentId: input.assignmentId,
      answers: input.answers,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Gönderim başarısız (${res.status})`);
  }
  return (await res.json()) as { submissionId: string; autoScore: number; maxScore: number };
}

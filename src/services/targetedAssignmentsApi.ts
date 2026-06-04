import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { BACKEND_BASE } from '@/constants/config';
import type { Difficulty } from '@/types/quiz';

export async function deleteTargetedAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'targeted_assignments', id));
}

export type TargetedStatus = 'active' | 'completed';
export type TargetedSource = 'ai' | 'pool';

export interface TargetedAssignment {
  id: string;
  teacherId: string;
  studentId: string;
  subject: string;
  focusSubTopics: string[];
  questionIds: string[];
  rationale: string;
  source: TargetedSource;
  difficulty: Difficulty;
  status: TargetedStatus;
  autoScore: number;
  score: number;
  createdAtMs: number;
  completedAtMs: number;
  answers: {
    questionId: string;
    selectedIndex: number;
    isCorrect: boolean;
    questionTextSnapshot?: string;
  }[];
}

interface RawTargeted {
  teacherId?: string;
  studentId?: string;
  subject?: string;
  focusSubTopics?: unknown;
  questionIds?: unknown;
  rationale?: string;
  source?: TargetedSource;
  difficulty?: Difficulty;
  status?: TargetedStatus;
  autoScore?: number;
  score?: number;
  createdAt?: Timestamp;
  completedAt?: Timestamp;
  answers?: unknown;
}

function tsMs(t: Timestamp | null | undefined): number {
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

function normalize(id: string, raw: RawTargeted): TargetedAssignment {
  const focusSubTopics = Array.isArray(raw.focusSubTopics)
    ? (raw.focusSubTopics as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  const questionIds = Array.isArray(raw.questionIds)
    ? (raw.questionIds as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  const answers = Array.isArray(raw.answers)
    ? (raw.answers as unknown[]).filter((a): a is TargetedAssignment['answers'][number] => {
        if (!a || typeof a !== 'object') return false;
        const x = a as { questionId?: unknown };
        return typeof x.questionId === 'string';
      })
    : [];
  return {
    id,
    teacherId: String(raw.teacherId ?? ''),
    studentId: String(raw.studentId ?? ''),
    subject: String(raw.subject ?? 'Genel'),
    focusSubTopics,
    questionIds,
    rationale: typeof raw.rationale === 'string' ? raw.rationale : '',
    source: raw.source === 'pool' ? 'pool' : 'ai',
    difficulty: (raw.difficulty as Difficulty) || 'medium',
    status: raw.status === 'completed' ? 'completed' : 'active',
    autoScore: typeof raw.autoScore === 'number' ? raw.autoScore : 0,
    score: typeof raw.score === 'number' ? raw.score : 0,
    createdAtMs: tsMs(raw.createdAt),
    completedAtMs: tsMs(raw.completedAt),
    answers,
  };
}

/**
 * Belirli öğrencinin tüm hedefli atamaları (öğretmen panel detay sayfası için).
 */
export function subscribeStudentTargetedAssignments(
  studentId: string,
  onChange: (items: TargetedAssignment[]) => void,
): Unsubscribe | null {
  if (!studentId) return null;
  return onSnapshot(
    query(collection(db, 'targeted_assignments'), where('studentId', '==', studentId)),
    (snap) => {
      const arr: TargetedAssignment[] = [];
      snap.forEach((d) => arr.push(normalize(d.id, d.data() as RawTargeted)));
      arr.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onChange(arr);
    },
    (err) => {
      console.warn('targeted listener:', err.message);
      onChange([]);
    },
  );
}

/**
 * Aktif olarak öğrenciye verilmiş (kendisi açar) hedefli atamalar.
 */
export function subscribeMyTargetedAssignments(
  onChange: (items: TargetedAssignment[]) => void,
): Unsubscribe | null {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  return onSnapshot(
    query(collection(db, 'targeted_assignments'), where('studentId', '==', uid)),
    (snap) => {
      const arr: TargetedAssignment[] = [];
      snap.forEach((d) => arr.push(normalize(d.id, d.data() as RawTargeted)));
      arr.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onChange(arr);
    },
    (err) => {
      console.warn('my targeted listener:', err.message);
      onChange([]);
    },
  );
}

export async function getTargetedAssignment(id: string): Promise<TargetedAssignment | null> {
  const snap = await getDoc(doc(db, 'targeted_assignments', id));
  if (!snap.exists()) return null;
  return normalize(snap.id, snap.data() as RawTargeted);
}

const GEN_URL = `${BACKEND_BASE}/generateTargetedSet`;
const SUBMIT_URL = `${BACKEND_BASE}/submitTargetedAssignment`;

export interface CreateTargetedInput {
  studentId: string;
  subject: string;
  focusSubTopics: string[];
  count: number;
  difficulty: Difficulty;
  source: TargetedSource;
  rationale?: string;
}

/**
 * Öğretmen — hedefli soru seti oluşturur. AI modunda backend ANALYZE_AND_DERIVE
 * ile üretir + havuza yazar; pool modunda mevcut onaylı havuzdan rastgele seçer.
 */
export async function createTargetedAssignment(
  input: CreateTargetedInput,
): Promise<{ id: string; questionIds: string[] }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Oturum bulunamadı');
  const token = await user.getIdToken().catch(() => null);
  const res = await fetch(GEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...input, userId: user.uid }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Üretim başarısız (${res.status})`);
  }
  return (await res.json()) as { id: string; questionIds: string[] };
}

/**
 * Öğrenci — hedefli atamayı çözüp gönderir.
 */
export async function submitTargetedAssignment(input: {
  targetedAssignmentId: string;
  answers: { questionId: string; selectedIndex: number }[];
}): Promise<{ autoScore: number; maxScore: number }> {
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
      targetedAssignmentId: input.targetedAssignmentId,
      answers: input.answers,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Gönderim başarısız (${res.status})`);
  }
  return (await res.json()) as { autoScore: number; maxScore: number };
}

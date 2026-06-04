import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

export interface TeacherInbox {
  /** Öğretmen onayı/incelemesi bekleyen submission sayısı. */
  pendingSubmissions: number;
  /** verified:false durumdaki AI üretimli soru sayısı. */
  pendingAIQuestions: number;
  /** Son 7 günde tamamlanan hedefli set sayısı. */
  completedTargetedSets: number;
  /** 24 saat içinde dueDate'i gelecek, hala aktif ödev sayısı. */
  upcomingDeadlines: number;
}

export const emptyInbox: TeacherInbox = {
  pendingSubmissions: 0,
  pendingAIQuestions: 0,
  completedTargetedSets: 0,
  upcomingDeadlines: 0,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 4 koleksiyona aynı anda listener bağlar; her değişimde aggregate inbox state'i
 * günceller. `onChange` her listener tetiklendiğinde son tam state'i alır.
 *
 * Dönüş: ayrı ayrı temizlenecek `Unsubscribe[]`. Panel useEffect tek tek çağırır.
 */
export function subscribeTeacherInbox(
  teacherUid: string,
  onChange: (data: TeacherInbox) => void,
): Unsubscribe[] {
  if (!teacherUid) return [];

  const state: TeacherInbox = { ...emptyInbox };
  const emit = () => onChange({ ...state });

  const unsubs: Unsubscribe[] = [];

  // Bekleyen submission'lar (status=submitted)
  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'assignment_submissions'),
        where('teacherId', '==', teacherUid),
        where('status', '==', 'submitted'),
      ),
      (snap) => {
        state.pendingSubmissions = snap.size;
        emit();
      },
      () => {
        state.pendingSubmissions = 0;
        emit();
      },
    ),
  );

  // Onay bekleyen AI soruları (genel sorgu — herhangi bir öğretmen onay verebilir)
  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'questions'),
        where('is_ai_generated', '==', true),
        where('verified', '==', false),
      ),
      (snap) => {
        state.pendingAIQuestions = snap.size;
        emit();
      },
      () => {
        state.pendingAIQuestions = 0;
        emit();
      },
    ),
  );

  // Son 7 günde tamamlanan hedefli setler
  const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * DAY_MS);
  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'targeted_assignments'),
        where('teacherId', '==', teacherUid),
        where('status', '==', 'completed'),
        where('completedAt', '>=', sevenDaysAgo),
      ),
      (snap) => {
        state.completedTargetedSets = snap.size;
        emit();
      },
      () => {
        // Index henüz hazır değilse veya hata varsa sessizce 0 bırak
        state.completedTargetedSets = 0;
        emit();
      },
    ),
  );

  // Yaklaşan deadline'lar — composite index olmadan client-side filtre
  unsubs.push(
    onSnapshot(
      query(collection(db, 'assignments'), where('teacherId', '==', teacherUid)),
      (snap) => {
        const now = Date.now();
        const horizon = now + DAY_MS;
        let count = 0;
        snap.forEach((d) => {
          const due = d.data().dueDate;
          if (due && typeof due.toMillis === 'function') {
            const dueMs = due.toMillis();
            if (dueMs > now && dueMs <= horizon) count += 1;
          }
        });
        state.upcomingDeadlines = count;
        emit();
      },
      () => {
        state.upcomingDeadlines = 0;
        emit();
      },
    ),
  );

  return unsubs;
}

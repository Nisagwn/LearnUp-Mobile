import {
  collection,
  doc,
  updateDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

export type NotificationTone = 'accent' | 'success' | 'warning' | 'danger';

export type NotificationType =
  | 'streak_risk'
  | 'streak_milestone'
  | 'daily_quest_reminder'
  | 'league_rollover'
  | 'league_tier_change'
  | 'badge_earned'
  | 'level_up'
  | 'srs_mastery'
  | 'srs_due'
  | 'assignment'
  | 'assignment_due'
  | 'assignment_feedback'
  | 'announcement'
  | 'submission_received'
  | 'test'
  | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Lucide ikon adı (string) — UI map'le component'e çevirir. */
  icon: string;
  tone: NotificationTone;
  deepLink: string | null;
  data: Record<string, unknown>;
  /** Okunduysa epoch ms; okunmadıysa null. */
  readAtMs: number | null;
  /** Oluşma zamanı epoch ms. */
  createdAtMs: number;
}

interface RawNotification {
  type?: string;
  title?: string;
  body?: string;
  icon?: string;
  tone?: string;
  deepLink?: string | null;
  data?: Record<string, unknown>;
  readAt?: Timestamp | null;
  createdAt?: Timestamp;
}

const VALID_TONES: NotificationTone[] = ['accent', 'success', 'warning', 'danger'];

function normalizeTone(raw: unknown): NotificationTone {
  return typeof raw === 'string' && (VALID_TONES as string[]).includes(raw)
    ? (raw as NotificationTone)
    : 'accent';
}

function tsMs(t: Timestamp | null | undefined): number {
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

function normalize(id: string, raw: RawNotification): AppNotification {
  return {
    id,
    type: (typeof raw.type === 'string' ? (raw.type as NotificationType) : 'info'),
    title: typeof raw.title === 'string' ? raw.title : '',
    body: typeof raw.body === 'string' ? raw.body : '',
    icon: typeof raw.icon === 'string' && raw.icon ? raw.icon : 'Bell',
    tone: normalizeTone(raw.tone),
    deepLink: typeof raw.deepLink === 'string' ? raw.deepLink : null,
    data: raw.data && typeof raw.data === 'object' ? raw.data : {},
    readAtMs: tsMs(raw.readAt) || null,
    createdAtMs: tsMs(raw.createdAt),
  };
}

/**
 * Kullanıcının son 50 bildirimini real-time dinler. Yenisi geldikçe üstten ekler.
 */
export function subscribeNotifications(
  uid: string,
  onChange: (items: AppNotification[]) => void,
): Unsubscribe | null {
  if (!uid) return null;
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => {
      const arr: AppNotification[] = [];
      snap.forEach((d) => arr.push(normalize(d.id, d.data() as RawNotification)));
      onChange(arr);
    },
    (err) => {
      console.warn('[notifications] subscribe:', err.message);
      onChange([]);
    },
  );
}

/**
 * Sadece okunmamış sayısını dinler — bell badge için hafif sorgu.
 */
export function subscribeUnreadCount(
  uid: string,
  onChange: (n: number) => void,
): Unsubscribe | null {
  if (!uid) return null;
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    where('readAt', '==', null),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.size),
    (err) => {
      console.warn('[notifications] unread:', err.message);
      onChange(0);
    },
  );
}

export async function markRead(uid: string, id: string): Promise<void> {
  if (!uid || !id) return;
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', id), {
      readAt: Timestamp.now(),
    });
  } catch (err) {
    console.warn('[notifications] markRead:', (err as Error).message);
  }
}

/**
 * Görünür tüm okunmamış bildirimleri batch ile readAt='now' yapar.
 * `items` listesi son snapshot'tan gelir; sahibe ait güvenli.
 */
export async function markAllRead(
  uid: string,
  items: AppNotification[],
): Promise<void> {
  if (!uid) return;
  const unread = items.filter((n) => !n.readAtMs);
  if (unread.length === 0) return;
  const now = Timestamp.now();
  const batch = writeBatch(db);
  unread.forEach((n) => {
    batch.update(doc(db, 'users', uid, 'notifications', n.id), { readAt: now });
  });
  try {
    await batch.commit();
  } catch (err) {
    console.warn('[notifications] markAllRead:', (err as Error).message);
  }
}

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

export type BookmarkDoc = {
  id: string;
  studentId: string;
  questionText: string;
  subject: string;
  choices: string[];
  answer: number;
  folderId: string | null; // null = root, 'auto:subject', custom UUID
  tags: string[];
  note: string;
  reviewCount: number;
  lastReviewedAtMs: number;
  createdAtMs: number;
};

export type BookmarkFolder = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  itemCount: number;
  createdAtMs: number;
};

type RawBookmark = {
  studentId?: string;
  questionText?: string;
  subject?: string;
  choices?: string[];
  answer?: number;
  folderId?: string | null;
  tags?: string[];
  note?: string;
  reviewCount?: number;
  lastReviewedAt?: Timestamp;
  createdAt?: Timestamp;
};

type RawFolder = {
  name?: string;
  color?: string | null;
  icon?: string | null;
  itemCount?: number;
  createdAt?: Timestamp;
};

function tsMs(t: Timestamp | undefined): number {
  return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
}

function normalizeBookmark(id: string, raw: RawBookmark): BookmarkDoc {
  return {
    id,
    studentId: String(raw.studentId ?? ''),
    questionText: String(raw.questionText ?? ''),
    subject: String(raw.subject ?? 'Genel'),
    choices: Array.isArray(raw.choices) ? raw.choices.map(String) : [],
    answer: Number(raw.answer ?? 0),
    folderId: raw.folderId === undefined || raw.folderId === null ? null : String(raw.folderId),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    note: String(raw.note ?? ''),
    reviewCount: Number(raw.reviewCount ?? 0),
    lastReviewedAtMs: tsMs(raw.lastReviewedAt),
    createdAtMs: tsMs(raw.createdAt),
  };
}

function normalizeFolder(id: string, raw: RawFolder): BookmarkFolder {
  return {
    id,
    name: String(raw.name ?? 'Klasör'),
    color: raw.color ?? null,
    icon: raw.icon ?? null,
    itemCount: Number(raw.itemCount ?? 0),
    createdAtMs: tsMs(raw.createdAt),
  };
}

/**
 * Tüm bookmark'ları real-time dinler.
 */
export function subscribeBookmarks(
  onChange: (bookmarks: BookmarkDoc[]) => void,
): Unsubscribe | null {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const q = query(collection(db, 'bookmarks'), where('studentId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const arr: BookmarkDoc[] = [];
      snap.forEach((d) => arr.push(normalizeBookmark(d.id, d.data() as RawBookmark)));
      arr.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onChange(arr);
    },
    (err) => {
      console.warn('Bookmarks listener error:', err.message ?? err);
      onChange([]);
    },
  );
}

/**
 * Custom klasörleri real-time dinler. Otomatik (auto:subject) klasörler
 * client'ta türetilir, bu sorguya dahil değildir.
 */
export function subscribeBookmarkFolders(
  onChange: (folders: BookmarkFolder[]) => void,
): Unsubscribe | null {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const col = collection(db, 'users', uid, 'bookmark_folders');
  return onSnapshot(
    col,
    (snap) => {
      const arr: BookmarkFolder[] = [];
      snap.forEach((d) => arr.push(normalizeFolder(d.id, d.data() as RawFolder)));
      arr.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onChange(arr);
    },
    (err) => {
      console.warn('Folders listener error:', err.message ?? err);
      onChange([]);
    },
  );
}

// ─── Klasör CRUD ────────────────────────────────────────────────────────────

export async function createFolder(name: string, color?: string, icon?: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Giriş yapılmamış');
  const ref = await addDoc(collection(db, 'users', uid, 'bookmark_folders'), {
    name: name.trim().slice(0, 60),
    color: color ?? null,
    icon: icon ?? null,
    itemCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Giriş yapılmamış');
  await updateDoc(doc(db, 'users', uid, 'bookmark_folders', folderId), {
    name: name.trim().slice(0, 60),
  });
}

/**
 * Custom klasörü sil. İçindeki bookmark'ların folderId'sini null'a (root) düşür.
 */
export async function deleteFolder(folderId: string, bookmarksInFolder: BookmarkDoc[]): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Giriş yapılmamış');
  const batch = writeBatch(db);
  bookmarksInFolder.forEach((b) => {
    if (b.folderId === folderId) {
      batch.update(doc(db, 'bookmarks', b.id), { folderId: null });
    }
  });
  batch.delete(doc(db, 'users', uid, 'bookmark_folders', folderId));
  await batch.commit();
}

// ─── Bookmark patch ─────────────────────────────────────────────────────────

export async function moveToFolder(bookmarkId: string, folderId: string | null): Promise<void> {
  await updateDoc(doc(db, 'bookmarks', bookmarkId), { folderId });
}

export async function setBookmarkTags(bookmarkId: string, tags: string[]): Promise<void> {
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).slice(0, 12);
  await updateDoc(doc(db, 'bookmarks', bookmarkId), { tags: clean });
}

export async function setBookmarkNote(bookmarkId: string, note: string): Promise<void> {
  await updateDoc(doc(db, 'bookmarks', bookmarkId), { note: note.slice(0, 500) });
}

/**
 * Toplu güncelleme — Edit sheet'in tek bir kaydet aksiyonu için.
 * Yalnız tanımlı alanlar gönderilir; firestore.rules update kuralı bu alan
 * setine zaten izin veriyor.
 */
export async function updateBookmarkOrganization(
  bookmarkId: string,
  patch: { folderId?: string | null; tags?: string[]; note?: string },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if ('folderId' in patch) update.folderId = patch.folderId;
  if ('tags' in patch && Array.isArray(patch.tags)) {
    update.tags = Array.from(new Set(patch.tags.map((t) => t.trim()).filter(Boolean))).slice(0, 12);
  }
  if ('note' in patch && typeof patch.note === 'string') {
    update.note = patch.note.slice(0, 500);
  }
  if (Object.keys(update).length === 0) return;
  await updateDoc(doc(db, 'bookmarks', bookmarkId), update);
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  await deleteDoc(doc(db, 'bookmarks', bookmarkId));
}

// ─── Bulk ───────────────────────────────────────────────────────────────────

export async function bulkMove(bookmarkIds: string[], folderId: string | null): Promise<void> {
  if (bookmarkIds.length === 0) return;
  const batch = writeBatch(db);
  bookmarkIds.forEach((id) => {
    batch.update(doc(db, 'bookmarks', id), { folderId });
  });
  await batch.commit();
}

export async function bulkDelete(bookmarkIds: string[]): Promise<void> {
  if (bookmarkIds.length === 0) return;
  const batch = writeBatch(db);
  bookmarkIds.forEach((id) => {
    batch.delete(doc(db, 'bookmarks', id));
  });
  await batch.commit();
}

// ─── Search ─────────────────────────────────────────────────────────────────

/**
 * Client-side substring eşleşmesi: questionText, note, tags üzerinde.
 * 100'lerce bookmark'a kadar performanslı; ileride Algolia/Typesense gerekebilir.
 */
export function searchBookmarks(bookmarks: BookmarkDoc[], queryStr: string): BookmarkDoc[] {
  const q = queryStr.trim().toLowerCase();
  if (!q) return bookmarks;
  return bookmarks.filter((b) => {
    if (b.questionText.toLowerCase().includes(q)) return true;
    if (b.note.toLowerCase().includes(q)) return true;
    if (b.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  });
}

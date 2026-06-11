import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

// Karışması kolay karakterler (I, O, 0, 1) çıkarıldı.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

async function codeExists(code: string): Promise<boolean> {
  const q = query(collection(db, 'users'), where('classCode', '==', code), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

/** Çakışmayan yeni bir sınıf kodu üretir (8 deneme, sonra zaman ekli fallback). */
export async function generateUniqueClassCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    // eslint-disable-next-line no-await-in-loop
    if (!(await codeExists(code))) return code;
  }
  return randomCode().slice(0, 5) + String(Math.floor(Math.random() * 10));
}

/** Öğretmenin sınıf kodu yoksa üretir; varsa mevcut kodu döner. */
export async function ensureTeacherClassCode(teacherUid: string): Promise<string> {
  const ref = doc(db, 'users', teacherUid);
  const snap = await getDoc(ref);
  const existing = snap.data()?.classCode as string | undefined;
  if (existing) return existing;
  const code = await generateUniqueClassCode();
  await updateDoc(ref, { classCode: code });
  return code;
}

/** Yeni bir sınıf kodu üretip öğretmen dökümanına yazar (eski kod geçersizleşir). */
export async function regenerateClassCode(teacherUid: string): Promise<string> {
  const code = await generateUniqueClassCode();
  await updateDoc(doc(db, 'users', teacherUid), { classCode: code });
  return code;
}

export type JoinResult = { teacherId: string; teacherName: string };
export type JoinedClass = { teacherId: string; teacherName: string };

/**
 * Öğrencinin profil dokümanından "katıldığı sınıflar" listesini normalize eder.
 * Eski `teacherId`/`teacherName` (single) ve yeni `teacherIds`/`teacherNames` (multi)
 * şemalarını ikisini de destekler.
 */
export function getStudentJoinedClasses(
  profile:
    | {
        teacherIds?: unknown;
        teacherId?: unknown;
        teacherNames?: unknown;
        teacherName?: unknown;
      }
    | null
    | undefined,
): JoinedClass[] {
  if (!profile) return [];
  const ids: string[] = Array.isArray(profile.teacherIds)
    ? (profile.teacherIds as unknown[]).filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      )
    : typeof profile.teacherId === 'string' && profile.teacherId
      ? [profile.teacherId]
      : [];
  const namesRaw = profile.teacherNames;
  const names: Record<string, string> =
    namesRaw && typeof namesRaw === 'object' && !Array.isArray(namesRaw)
      ? (namesRaw as Record<string, string>)
      : typeof profile.teacherId === 'string' &&
          profile.teacherId &&
          typeof profile.teacherName === 'string'
        ? { [profile.teacherId]: profile.teacherName }
        : {};
  return ids.map((id) => ({ teacherId: id, teacherName: names[id] ?? 'Öğretmen' }));
}

/**
 * Öğrenci kodu girer → eşleşen öğretmeni bulur, kendi `teacherIds` listesine ekler.
 * İlk sınıf primary olur (`teacherId`/`teacherName` legacy alanlar primary'i tutar).
 */
export async function joinClassByCode(code: string, studentUid: string): Promise<JoinResult> {
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 4) throw new Error('Kod en az 4 karakter olmalı.');

  const q = query(collection(db, 'users'), where('classCode', '==', normalized), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Bu koda sahip bir sınıf bulunamadı.');

  const teacherDoc = snap.docs[0]!;
  const teacherId = teacherDoc.id;
  if (teacherId === studentUid) throw new Error('Kendi kodunu kullanamazsın.');

  const data = teacherDoc.data();
  if (data.role !== 'teacher') throw new Error('Bu kod bir öğretmene ait değil.');

  const teacherName = (data.name as string) || (data.fullName as string) || 'Öğretmen';

  // Öğrencinin mevcut katılımları
  const studentRef = doc(db, 'users', studentUid);
  const studentSnap = await getDoc(studentRef);
  const studentData = (studentSnap.data() ?? {}) as {
    teacherIds?: unknown;
    teacherId?: unknown;
    teacherNames?: unknown;
    teacherName?: unknown;
  };

  const existing = getStudentJoinedClasses(studentData);
  if (existing.some((c) => c.teacherId === teacherId)) {
    throw new Error('Bu sınıfa zaten katıldın.');
  }

  const newList = [...existing, { teacherId, teacherName }];
  const newIds = newList.map((c) => c.teacherId);
  const newNames: Record<string, string> = {};
  for (const c of newList) newNames[c.teacherId] = c.teacherName;

  // Primary: var olan ilk sınıf korunur; ilk katılımsa bu sınıf primary olur
  const primary = newList[0]!;

  await updateDoc(studentRef, {
    teacherIds: newIds,
    teacherNames: newNames,
    teacherId: primary.teacherId,
    teacherName: primary.teacherName,
  });
  return { teacherId, teacherName };
}

/**
 * Belirli bir sınıftan ayrıl. Primary sınıf ayrılırsa kalan ilk sınıf primary olur,
 * hiç sınıf kalmazsa primary alanlar null'a çekilir.
 */
export async function leaveSpecificClass(
  studentUid: string,
  teacherIdToLeave: string,
): Promise<void> {
  const studentRef = doc(db, 'users', studentUid);
  const snap = await getDoc(studentRef);
  const studentData = (snap.data() ?? {}) as {
    teacherIds?: unknown;
    teacherId?: unknown;
    teacherNames?: unknown;
    teacherName?: unknown;
  };

  const existing = getStudentJoinedClasses(studentData);
  const remaining = existing.filter((c) => c.teacherId !== teacherIdToLeave);

  const newIds = remaining.map((c) => c.teacherId);
  const newNames: Record<string, string> = {};
  for (const c of remaining) newNames[c.teacherId] = c.teacherName;

  const primary = remaining[0] ?? null;

  await updateDoc(studentRef, {
    teacherIds: newIds,
    teacherNames: newNames,
    teacherId: primary ? primary.teacherId : null,
    teacherName: primary ? primary.teacherName : null,
  });
}

/** Öğrenci tüm sınıflardan ayrılır (geriye dönük uyumluluk için kalıyor). */
export async function leaveClass(studentUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', studentUid), {
    teacherId: null,
    teacherName: null,
    teacherIds: [],
    teacherNames: {},
  });
}

/** Öğretmen adını teacherId'den canlı çeker (denormalize teacherName bayatsa). */
export async function getTeacherName(teacherId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', teacherId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return (d.name as string) || (d.fullName as string) || 'Öğretmen';
  } catch {
    return null;
  }
}

export type TeacherInfo = { name: string; branch: string | null };

/** Öğretmenin ad + branş bilgisini Firestore'dan çeker. */
export async function getTeacherInfo(teacherId: string): Promise<TeacherInfo | null> {
  try {
    const snap = await getDoc(doc(db, 'users', teacherId));
    if (!snap.exists()) return null;
    const d = snap.data();
    const name = (d.name as string) || (d.fullName as string) || 'Öğretmen';
    const branch = typeof d.branch === 'string' && d.branch.trim().length > 0 ? d.branch : null;
    return { name, branch };
  } catch {
    return null;
  }
}

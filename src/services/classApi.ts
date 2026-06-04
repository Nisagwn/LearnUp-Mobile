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

/** Öğrenci kodu girer → eşleşen öğretmeni bulur, kendi teacherId'sini yazar. */
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
  await updateDoc(doc(db, 'users', studentUid), { teacherId, teacherName });
  return { teacherId, teacherName };
}

/** Öğrenci sınıftan ayrılır. */
export async function leaveClass(studentUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', studentUid), { teacherId: null, teacherName: null });
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

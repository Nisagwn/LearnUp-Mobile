/**
 * Öğretmen branş listesi — quiz sayfasındaki ders listesi (`SUBJECT_META`) ile uyumlu.
 * Signup + profil düzenleme için tek doğruluk kaynağı.
 */
export const TEACHER_BRANCHES = [
  'Matematik',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Edebiyat',
  'Tarih',
  'Coğrafya',
  'Felsefe',
  'Din Kültürü',
] as const;

export type TeacherBranch = (typeof TEACHER_BRANCHES)[number];

export function isValidBranch(value: unknown): value is TeacherBranch {
  return typeof value === 'string' && (TEACHER_BRANCHES as readonly string[]).includes(value);
}

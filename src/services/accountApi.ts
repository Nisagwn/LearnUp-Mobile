import { auth } from '@/services/firebase';
import { BACKEND_BASE } from '@/constants/config';

/**
 * Hesabı kalıcı olarak siler (Firestore verisi + alt koleksiyonlar + Auth hesabı).
 * Backend yalnızca doğrulanmış ID token'dan gelen uid'i siler — body'ye güvenmez.
 * Çağrıdan önce yeniden-doğrulama (recent login) yapılmış olmalı.
 */
export async function deleteAccount(): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Oturum bulunamadı, lütfen tekrar giriş yap.');
  const url = `${BACKEND_BASE.replace(/\/$/, '')}/deleteAccount`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Hesap silinemedi (${res.status})`);
  }
}

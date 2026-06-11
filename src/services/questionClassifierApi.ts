import { auth } from '@/services/firebase';
import { BACKEND_BASE } from '@/constants/config';

const CLASSIFY_URL = `${BACKEND_BASE.replace(/\/$/, '')}/classifyQuestions`;

/** AI'nın önerdiği (henüz yazılmamış) tek etiket önerisi. */
export type ClassifyProposal = {
  id: string;
  question: string;
  subject: string;
  grade: string;
  topic: string;
  sub_topic: string;
};

export type ProposeResult = {
  proposals: ClassifyProposal[];
  processed: number;
  failed: number;
  done: boolean;
};

export type ApplyResult = {
  applied: number;
  remainingEstimate: number;
  done: boolean;
};

/** Ortak POST yardımcısı — Bearer auth + hata mesajı çözümleme. */
async function postClassify<T>(payload: object): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Oturum bulunamadı.');
  const idToken = await user.getIdToken();

  const res = await fetch(CLASSIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = `Sınıflandırma hatası (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

/**
 * Bir batch (max 30 etiketsiz soru) sınıflandırır ama HAVUZA YAZMAZ —
 * öğretmenin inceleyip onaylaması için öneri listesi döner.
 */
export async function proposeClassifications(): Promise<ProposeResult> {
  return postClassify<ProposeResult>({ mode: 'preview' });
}

/**
 * Öğretmenin onayladığı (ve gerekirse düzenlediği) etiketleri havuza yazar.
 */
export async function applyClassifications(
  items: { id: string; topic: string; sub_topic: string }[],
): Promise<ApplyResult> {
  return postClassify<ApplyResult>({ mode: 'apply', items });
}

/**
 * Havuzdaki gerçek etiketsiz soru sayısı. Backend `mode:'count'` ile döner —
 * KRİTİK: `topic` alanı HİÇ olmayan ("undefined") dokümanlar Firestore'da
 * `where('topic','==','')` ile yakalanamaz; bu yüzden sayım sunucuda koleksiyon
 * taranarak yapılır (topic yok / boş / 'genel' hepsi sayılır).
 */
export async function countUntaggedQuestions(): Promise<number> {
  const r = await postClassify<{ untagged: number }>({ mode: 'count' });
  return r.untagged ?? 0;
}

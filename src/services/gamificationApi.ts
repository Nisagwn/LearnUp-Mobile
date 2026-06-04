import { auth } from '@/services/firebase';
import { BACKEND_BASE } from '@/constants/config';

async function postJson<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${BACKEND_BASE.replace(/\/$/, '')}/${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* token alınamadı — userId gövdeye düşer */
  }
  const payload = { userId: auth.currentUser?.uid, ...body };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `İstek başarısız (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface AnswerPayload {
  questionId: string;
  subject: string;
  isCorrect: boolean;
  timeSpentMs?: number;
  selectedIndex?: number;
  [key: string]: unknown;
}

export const recordAnswer = (answer: AnswerPayload) => postJson('recordAnswer', answer);
export const ensureDailyState = () => postJson('ensureDailyState', {});
export const claimQuestReward = (questId: string) => postJson('claimQuestReward', { questId });
export const consumeStreakFreeze = () =>
  postJson<{
    success: boolean;
    streak: { count: number; longest: number; freezesAvailable: number; lastActiveDate: string };
  }>('useStreakFreeze', {});

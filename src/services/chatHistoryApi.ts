import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { ChatMessage } from '@/services/aiService';

export type ChatSummary = {
  id: string;
  topic: string;
  lastMessageAt: number;
  messageCount: number;
};

export type RawStoredMessage = {
  id?: number;
  sender?: 'user' | 'bot';
  text?: string;
  time?: string | number;
};

function tsToMs(t: unknown): number {
  if (!t) return 0;
  if (typeof t === 'number') return t;
  const maybe = t as { toMillis?: () => number };
  return typeof maybe.toMillis === 'function' ? maybe.toMillis() : 0;
}

/** Kullanıcının tüm sohbetlerini son aktiviteye göre dinler. */
export function subscribeUserChats(
  uid: string,
  onChange: (items: ChatSummary[]) => void,
): Unsubscribe | null {
  if (!uid) return null;
  const q = query(collection(db, `users/${uid}/chats`), orderBy('lastMessageAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const arr: ChatSummary[] = [];
      snap.forEach((d) => {
        const data = d.data() as {
          topic?: string;
          lastMessageAt?: Timestamp;
          messages?: RawStoredMessage[];
        };
        arr.push({
          id: d.id,
          topic: String(data.topic ?? 'Sohbet'),
          lastMessageAt: tsToMs(data.lastMessageAt),
          messageCount: Array.isArray(data.messages) ? data.messages.length : 0,
        });
      });
      onChange(arr);
    },
    (err) => {
      console.warn('chat history listener:', err.message);
      onChange([]);
    },
  );
}

/** Var olan bir sohbeti yükle — mesajları normalize ederek döner. */
export async function loadChat(
  uid: string,
  chatId: string,
): Promise<{ topic: string; messages: ChatMessage[] } | null> {
  if (!uid || !chatId) return null;
  const snap = await getDoc(doc(db, `users/${uid}/chats`, chatId));
  if (!snap.exists()) return null;
  const data = snap.data() as { topic?: string; messages?: RawStoredMessage[] };
  const messages: ChatMessage[] = (data.messages ?? []).map((m, i) => ({
    id: typeof m.id === 'number' ? m.id : i,
    sender: m.sender === 'user' ? 'user' : 'bot',
    text: String(m.text ?? ''),
    time:
      typeof m.time === 'string'
        ? m.time
        : typeof m.time === 'number'
          ? new Date(m.time).toISOString()
          : new Date().toISOString(),
  }));
  return { topic: String(data.topic ?? 'Sohbet'), messages };
}

export async function deleteChat(uid: string, chatId: string): Promise<void> {
  if (!uid || !chatId) return;
  await deleteDoc(doc(db, `users/${uid}/chats`, chatId));
}

export async function renameChat(uid: string, chatId: string, topic: string): Promise<void> {
  if (!uid || !chatId) return;
  const clean = topic.trim().slice(0, 60) || 'Sohbet';
  await updateDoc(doc(db, `users/${uid}/chats`, chatId), { topic: clean });
}

/** Kullanıcının ilk mesajından kısa bir başlık türetir (40 karakter, tek satır). */
export function deriveChatTopic(firstUserMessage: string): string {
  const cleaned = firstUserMessage.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Sohbet';
  if (cleaned.length <= 40) return cleaned;
  return cleaned.slice(0, 40).trim() + '…';
}

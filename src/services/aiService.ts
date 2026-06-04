import { auth, db } from '@/services/firebase';
import {
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  increment,
  collection,
  setDoc,
} from 'firebase/firestore';
import type { Difficulty, GenerateQuizMode } from '@/types/quiz';
import { BACKEND_BASE } from '@/constants/config';

const API_URL = `${BACKEND_BASE}/getAIResponse`;
const GENERATE_URL = `${BACKEND_BASE}/generateQuestions`;

// Re-export discriminated union from canonical type module
export type { GenerateQuizMode, Difficulty } from '@/types/quiz';

export interface ChatMessage {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  time: Date | string;
}

export interface QuizContext {
  subject?: string;
  grade?: string | number;
  questionText?: string;
  options?: string[];
}

interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_HISTORY: HistoryEntry[] = [
  {
    role: 'user',
    content: 'Sen kimsin ve nasıl yardım edeceksin?',
  },
  {
    role: 'assistant',
    content:
      'Ben LearnUp AI Asistan! Türk lise öğrencilerine matematik, fizik, kimya, biyoloji, edebiyat, tarih, coğrafya ve felsefe konularında Türkçe yardım ediyorum. Adım adım açıklar, örnekler veririm. Nasıl yardımcı olabilirim?',
  },
];

function buildContextualMessage(userMessage: string, quizContext: QuizContext | null): string {
  if (!quizContext) return userMessage;
  const { subject, questionText } = quizContext;
  return `[BAĞLAM: Ders - ${subject || 'Genel'}. Aktif Soru: ${questionText || ''}]
Kurallar: Öğrenciye cevabı asla söyleme, ipucu vererek yönlendir.
Öğrencinin sorusu: ${userMessage}`;
}

export interface GeneratedQuestion {
  question: string;
  choices: string[];
  answer: number;
  hint?: string;
}

// JSON dizisini AI yanıtından çıkarmaya çalışır.
// Çoklu strateji: fenced block > tüm "[{...}]" adayları > truncate kurtarma > tüm metni parse.
function extractJSONArray(raw: string): unknown[] | null {
  // 1) ```json fenced block (varsa)
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    const tried = tryParseAndClean(fenced[1].trim());
    if (Array.isArray(tried)) return tried;
  }

  // 2) Tüm "[{" başlangıçlarını sırayla dene — [QUIZ:..] gibi sahte bracket'ları atla
  const candidates = collectBracketCandidates(raw);
  for (const c of candidates) {
    const tried = tryParseAndClean(c);
    if (Array.isArray(tried) && tried.length > 0) return tried;
  }

  // 3) Truncate kurtarma: yanıt yarıda kesilmiş olabilir.
  // En son tamamlanmış "}," veya "}\n]" kadarını alıp manuel kapat.
  const truncated = tryRecoverTruncated(raw);
  if (truncated) {
    const tried = tryParseAndClean(truncated);
    if (Array.isArray(tried) && tried.length > 0) return tried;
  }

  // 4) Son şans: tüm yanıtı parse et
  const tried4 = tryParseAndClean(raw);
  if (Array.isArray(tried4)) return tried4;
  return null;
}

// "[{..." ile başlayan dengeli her bracket bloğunu bul (string-aware).
function collectBracketCandidates(raw: string): string[] {
  const out: string[] = [];
  for (let start = 0; start < raw.length; start++) {
    if (raw[start] !== '[') continue;
    // Bir sonraki non-whitespace '{' olmalı — yoksa atla ([QUIZ:..] gibi)
    let j = start + 1;
    while (j < raw.length && /\s/.test(raw[j]!)) j++;
    if (raw[j] !== '{') continue;
    // Dengeli ']' bul
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          out.push(raw.slice(start, i + 1));
          start = i; // bu blokun ötesinden devam
          break;
        }
      }
    }
  }
  return out;
}

// Yanıt yarıda kesildiyse, son tamamlanmış "}" sonrası kırpıp diziyi kapat.
function tryRecoverTruncated(raw: string): string | null {
  const startIdx = raw.indexOf('[{');
  if (startIdx === -1) return null;
  // Son "}" konumunu bul (kesilmiş kısmı at)
  const lastCloseBrace = raw.lastIndexOf('}');
  if (lastCloseBrace === -1 || lastCloseBrace < startIdx) return null;
  let fragment = raw.slice(startIdx, lastCloseBrace + 1);
  // Trailing virgülleri at, sonra ']' ekle
  fragment = fragment.replace(/,\s*$/, '');
  return fragment + ']';
}

function tryParseAndClean(s: string): unknown {
  const direct = safeJsonParse(s);
  if (direct !== null) return direct;
  const cleaned = s
    .replace(/,(\s*[\]}])/g, '$1')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ ]/g, ' '); // non-breaking space
  return safeJsonParse(cleaned);
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Tek bir soru itemini geçerli bir GeneratedQuestion'a normalize eder; uymuyorsa null döner.
function normalizeQuestionItem(item: unknown): GeneratedQuestion | null {
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  const question = typeof obj.question === 'string' ? obj.question : null;
  if (!question) return null;

  const choicesRaw = obj.choices ?? obj.options;
  if (!Array.isArray(choicesRaw)) return null;
  const choices = choicesRaw.filter((c) => typeof c === 'string') as string[];
  if (choices.length < 2 || choices.length > 5) return null;

  // Cevap birden fazla format gelebilir: sayı (0-3), harf ("A"-"D"), tam metin
  let answerIdx: number | null = null;
  const ansRaw = obj.answer ?? obj.correctAnswer ?? obj.correct_answer ?? obj.correctIndex;
  if (typeof ansRaw === 'number' && Number.isInteger(ansRaw) && ansRaw >= 0 && ansRaw < choices.length) {
    answerIdx = ansRaw;
  } else if (typeof ansRaw === 'string') {
    const trimmed = ansRaw.trim();
    const letter = trimmed.toUpperCase().charAt(0);
    if (trimmed.length <= 3 && letter >= 'A' && letter <= 'E') {
      const idx = letter.charCodeAt(0) - 65;
      if (idx >= 0 && idx < choices.length) answerIdx = idx;
    }
    if (answerIdx === null) {
      const match = choices.findIndex((c) => c.trim() === trimmed);
      if (match >= 0) answerIdx = match;
    }
  }
  if (answerIdx === null) return null;

  // Şu an UI 4 şık varsayıyor; 4 değilse 4'e tamamla/sınırla
  let finalChoices = choices;
  let finalAnswer = answerIdx;
  if (finalChoices.length > 4) {
    finalChoices = finalChoices.slice(0, 4);
    if (finalAnswer >= 4) return null; // doğru cevap kırpıldı, sorunlu
  }
  if (finalChoices.length < 4) {
    // 4'e tamamla — bilinmeyen distractor'lar
    const fillers = ['Diğer', 'Belirsiz', 'Yukarıdakilerden hiçbiri', 'Tümü'];
    let fi = 0;
    while (finalChoices.length < 4 && fi < fillers.length) {
      if (!finalChoices.includes(fillers[fi]!)) finalChoices = [...finalChoices, fillers[fi]!];
      fi++;
    }
    if (finalChoices.length < 4) return null;
  }

  const hint = typeof obj.hint === 'string' ? obj.hint : undefined;
  return { question, choices: finalChoices, answer: finalAnswer, hint };
}

// Server-side parseTaggedQuestions çıktısının client karşılığı
interface ServerTaggedQuestion {
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

function fromTagged(q: ServerTaggedQuestion, hintFallback?: string): GeneratedQuestion | null {
  if (!q?.question_text || !Array.isArray(q.options) || q.options.length !== 4) return null;
  if (new Set(q.options).size !== 4) return null;
  const idx = q.options.findIndex((o) => o === q.correct_answer);
  if (idx < 0) return null;
  return {
    question: q.question_text,
    choices: q.options,
    answer: idx,
    hint: typeof q.explanation === 'string' && q.explanation ? q.explanation : hintFallback,
  };
}

interface GeneratePayload {
  mode: GenerateQuizMode['kind'];
  subject: string;
  topic?: string;
  grade: string;
  count: number;
  difficulty: Difficulty;
  sampleQuestions?: Array<{
    question: string;
    choices: string[];
    correctIndex: number;
    explanation?: string;
  }>;
  userId?: string | null;
}

async function callGenerateEndpoint(payload: GeneratePayload): Promise<GeneratedQuestion[]> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken().catch(() => null) : null;

  const res = await fetch(GENERATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...payload, userId: user?.uid || null }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as { success?: boolean; questions?: ServerTaggedQuestion[] };
  if (!data?.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('AI hiçbir geçerli soru üretmedi — farklı bir konu/mod deneyin');
  }

  const valid: GeneratedQuestion[] = [];
  for (const q of data.questions) {
    const norm = fromTagged(q);
    if (norm) valid.push(norm);
  }
  if (valid.length === 0) throw new Error('AI yanıtı çözümlenemedi — lütfen tekrar deneyin');
  return valid.slice(0, payload.count);
}

/**
 * 3-modlu AI soru üretici.
 * Cloud Function `generateQuestions` üzerinden çağrılır; LaTeX-safe satır-etiketli
 * format kullanılır (parseTaggedQuestions). Client'ta artık JSON prompt yok.
 *
 * Overload 1 (yeni): GenerateQuizMode discriminated union — mode-aware
 * Overload 2 (deprecated): (topic, count, difficulty) — geriye dönük uyumluluk,
 *   STRICT_CURRICULUM'a maplenir; grade için '10' fallback'i kullanılır.
 */
export async function generateQuiz(mode: GenerateQuizMode): Promise<GeneratedQuestion[]>;
export async function generateQuiz(
  topic: string,
  count?: number,
  difficulty?: Difficulty,
): Promise<GeneratedQuestion[]>;
export async function generateQuiz(
  arg1: GenerateQuizMode | string,
  arg2?: number,
  arg3?: Difficulty,
): Promise<GeneratedQuestion[]> {
  // Eski imza — deprecated wrapper
  if (typeof arg1 === 'string') {
    const topic = arg1;
    const count = arg2 ?? 5;
    const difficulty: Difficulty = arg3 ?? 'medium';
    const safeCount = Math.max(1, Math.min(20, Math.floor(count)));
    return callGenerateEndpoint({
      mode: 'STRICT_CURRICULUM',
      subject: topic,
      topic,
      grade: '10',
      count: safeCount,
      difficulty,
    });
  }

  // Yeni discriminated union
  const m = arg1;
  const safeCount = Math.max(1, Math.min(20, Math.floor(m.count)));
  const payload: GeneratePayload = {
    mode: m.kind,
    subject: m.subject,
    topic: m.topic,
    grade: m.grade,
    count: safeCount,
    difficulty: m.difficulty,
  };
  if (m.kind === 'ANALYZE_AND_DERIVE') {
    payload.sampleQuestions = m.sampleQuestions.slice(0, 5).map((s) => ({
      question: String(s.question || '').slice(0, 600),
      choices: Array.isArray(s.choices) ? s.choices.slice(0, 4).map((c) => String(c).slice(0, 200)) : [],
      correctIndex: Number.isInteger(s.correctIndex) ? s.correctIndex : 0,
      explanation: s.explanation ? String(s.explanation).slice(0, 300) : undefined,
    }));
  }
  return callGenerateEndpoint(payload);
}

export async function generateDynamicHint(quizContext: QuizContext): Promise<string> {
  const { subject, grade, questionText, options } = quizContext;
  const optionsText =
    options && options.length > 0
      ? options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')
      : '';
  const hintPrompt = `[SİSTEM BAĞLAMI — ÖĞRENCİYE BU METNİ GÖSTERME]
Öğrenci: Türk lise, ${grade || '10'}. sınıf — ${subject || 'Genel'} dersi.
[BAĞLAM SONU]

Aşağıdaki soru için öğrenciye CEVABI VERMEDEn, sadece doğru cevabı bulmalarına yardımcı olacak 1-2 cümlelik kısa ve net bir ipucu yaz. İpucu Türkçe olsun, anlaşılır olsun, doğrudan cevabı içermesin.

Soru: ${questionText}
${optionsText ? `Seçenekler:\n${optionsText}` : ''}

Sadece ipucunu yaz, başka bir şey ekleme.`;

  const tempSession = new ChatSession();
  return tempSession.sendMessage(hintPrompt);
}

export async function saveMessageToFirestore(
  uid: string,
  chatId: string | null,
  userMsg: ChatMessage,
  botMsg: ChatMessage,
  topic: string = 'Genel Sohbet',
): Promise<string | null> {
  if (!uid) return null;

  let finalChatId = chatId;
  const chatsCollectionRef = collection(db, `users/${uid}/chats`);

  if (!finalChatId) {
    const newChatDoc = doc(chatsCollectionRef);
    finalChatId = newChatDoc.id;
    await setDoc(newChatDoc, {
      messages: [],
      lastMessageAt: serverTimestamp(),
      topic,
    });
  }

  const chatDocRef = doc(db, `users/${uid}/chats`, finalChatId);

  await updateDoc(chatDocRef, {
    messages: arrayUnion(
      {
        id: userMsg.id,
        sender: userMsg.sender,
        text: userMsg.text,
        time: userMsg.time instanceof Date ? userMsg.time.toISOString() : userMsg.time,
      },
      {
        id: botMsg.id,
        sender: botMsg.sender,
        text: botMsg.text,
        time: botMsg.time instanceof Date ? botMsg.time.toISOString() : botMsg.time,
      },
    ),
    lastMessageAt: serverTimestamp(),
  });

  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    'stats.totalChatMessages': increment(1),
  }).catch((err) => console.warn('Could not increment totalChatMessages:', err));

  return finalChatId;
}

interface QueueItem {
  userMessage: string;
  quizContext: QuizContext | null;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}

export class ChatSession {
  history: HistoryEntry[];
  uid: string | null;
  chatId: string | null;
  topic: string | null;
  onChatIdAssigned: ((id: string) => void) | null = null;
  private _queue: QueueItem[] = [];
  private _inFlight = false;

  constructor(initialHistory: HistoryEntry[] = [], uid: string | null = null, chatId: string | null = null) {
    this.history = [...SYSTEM_HISTORY, ...initialHistory];
    this.uid = uid || auth.currentUser?.uid || null;
    this.chatId = chatId;
    this.topic = null;
  }

  async sendMessage(userMessage: string, quizContext: QuizContext | null = null): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this._queue.push({ userMessage, quizContext, resolve, reject });
      if (!this._inFlight) void this._processQueue();
    });
  }

  private async _processQueue(): Promise<void> {
    if (this._inFlight) return;
    this._inFlight = true;

    while (this._queue.length > 0) {
      const item = this._queue.shift()!;
      const { userMessage, quizContext, resolve, reject } = item;
      try {
        const finalMessage = buildContextualMessage(userMessage, quizContext);
        const slicedHistory = this.history.slice(-5);

        const startTime = Date.now();
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: slicedHistory,
            userMessage: finalMessage,
          }),
        });

        if (!response.ok) {
          let errBody: { error?: string } = {};
          try {
            errBody = (await response.json()) as { error?: string };
          } catch {
            errBody = {};
          }
          const status = response.status;
          const errMsg = errBody?.error || response.statusText;

          if (status === 429) {
            resolve('⏳ Şu an API limitleri dolu, 10 saniye sonra tekrar deneyin.');
            continue;
          }
          throw new Error(`[${status}] ${errMsg}`);
        }

        const data = (await response.json()) as { reply?: string };
        const replyText = data.reply || '(Boş yanıt)';

        const userMsgObj: ChatMessage = {
          id: Date.now() - 1000,
          sender: 'user',
          text: userMessage,
          time: new Date(),
        };
        const botMsgObj: ChatMessage = {
          id: Date.now(),
          sender: 'bot',
          text: replyText,
          time: new Date(),
        };

        this.history.push({ role: 'user', content: userMessage });
        this.history.push({ role: 'assistant', content: replyText });

        if (this.uid) {
          const fallbackTopic = quizContext
            ? `Quiz Koçu · ${quizContext.subject ?? 'genel'}`
            : 'Genel Sohbet';
          const topic = this.topic || fallbackTopic;
          const wasNewChat = !this.chatId;
          saveMessageToFirestore(this.uid, this.chatId, userMsgObj, botMsgObj, topic)
            .then((newId) => {
              if (newId && newId !== this.chatId) {
                this.chatId = newId;
                if (wasNewChat && this.onChatIdAssigned) this.onChatIdAssigned(newId);
              }
            })
            .catch((err) => console.error('Error saving chat message to Firestore:', err));
        }

        const duration = Date.now() - startTime;
        const minDuration = 450;
        if (duration < minDuration) {
          await new Promise((r) => setTimeout(r, minDuration - duration));
        }

        resolve(replyText);
      } catch (error) {
        console.error('Backend Proxy Çağrı Hatası:', error);
        reject(error);
      }
    }

    this._inFlight = false;
  }
}

export function createChatSession(
  history: HistoryEntry[] = [],
  uid: string | null = null,
  chatId: string | null = null,
): ChatSession {
  return new ChatSession(history, uid, chatId);
}

export async function sendMessage(
  chatSession: ChatSession,
  userMessage: string,
  quizContext: QuizContext | null = null,
): Promise<string> {
  return chatSession.sendMessage(userMessage, quizContext);
}

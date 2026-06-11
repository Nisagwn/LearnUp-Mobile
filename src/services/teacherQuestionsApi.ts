import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import type { Difficulty } from '@/types/quiz';

export interface ManualQuestionInput {
  subject: string;
  topic?: string;
  sub_topic?: string;
  grade: string; // '9' | '10' | '11' | '12'
  difficulty: Difficulty;
  question: string; // metin (LaTeX'li olabilir)
  choices: string[]; // 2-5 şık, MVP'de 4
  correctIndex: number; // 0..choices.length-1
  explanation?: string;
}

export interface ManualQuestionDoc {
  id: string;
  subject: string;
  topic?: string;
  sub_topic?: string;
  grade?: string;
  difficulty?: Difficulty;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
}

/**
 * Manuel soru için Firestore doc payload'ı hazırla.
 * Alan ikiziyle uyumlu: hem yeni (`question_text`/`options`/`correct_answer`)
 * hem eski okuyucular (`text`/`choices`/`correctAnswer`/`answer`) için.
 * Pattern persistAIQuestions ile eşleşir; ek olarak teacherId/verified set edilir.
 */
function toFirestorePayload(input: ManualQuestionInput, teacherId: string) {
  const correctAnswerText = input.choices[input.correctIndex];
  return {
    teacherId,
    category: input.subject,
    subject: input.subject,
    topic: input.topic ?? '',
    sub_topic: input.sub_topic ?? input.topic ?? '',
    difficulty: input.difficulty,
    grade: input.grade,
    // Metin alan ikizleri — eski/yeni okuyucular için
    text: input.question,
    question_text: input.question,
    // Şıklar
    options: input.choices,
    choices: input.choices,
    // Doğru cevap — hem metin hem index
    correctAnswer: correctAnswerText,
    correct_answer: correctAnswerText,
    correctIndex: input.correctIndex,
    answer: input.correctIndex,
    explanation: input.explanation ?? '',
    is_ai_generated: false,
    isAI: false,
    verified: true,
    random_seed: Math.floor(Math.random() * 1_000_000),
    createdAt: serverTimestamp(),
  } as const;
}

/**
 * Manuel soru oluştur. Öğretmen kendi adına yazar; verified:true olarak girer
 * (kendi sorusu, AI değil). Firestore rules teacherId == auth.uid sahipliğine
 * göre create'e izin verir; ek endpoint gerekmez.
 */
export async function createManualQuestion(input: ManualQuestionInput): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Oturum bulunamadı');
  validateInput(input);
  const ref = doc(collection(db, 'questions'));
  await setDoc(ref, toFirestorePayload(input, uid));
  return ref.id;
}

/**
 * Mevcut manuel soruyu güncelle. Sahiplik rules üzerinde zorlanır.
 */
export async function updateManualQuestion(
  id: string,
  input: ManualQuestionInput,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Oturum bulunamadı');
  validateInput(input);
  const payload = toFirestorePayload(input, uid);
  // createdAt'ı override etme — güncellemede sadece içerik değişir
  const { createdAt: _omit, ...patch } = payload;
  void _omit;
  await updateDoc(doc(db, 'questions', id), patch);
}

export async function deleteManualQuestion(id: string): Promise<void> {
  await deleteDoc(doc(db, 'questions', id));
}

/**
 * Düzenleme ekranı için mevcut dokümanı normalize edip getir.
 * Yeni/eski alan adlarını tek bir tip altında birleştirir.
 */
export async function getManualQuestion(id: string): Promise<ManualQuestionDoc | null> {
  const snap = await getDoc(doc(db, 'questions', id));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;

  const question =
    (typeof data.text === 'string' && data.text) ||
    (typeof data.question_text === 'string' && data.question_text) ||
    (typeof data.question === 'string' && data.question) ||
    '';

  let choices: string[] = [];
  if (Array.isArray(data.options)) {
    choices = (data.options as unknown[]).filter((c): c is string => typeof c === 'string');
  } else if (Array.isArray(data.choices)) {
    choices = (data.choices as unknown[]).filter((c): c is string => typeof c === 'string');
  }

  let correctIndex = 0;
  const rawAns = data.correctIndex ?? data.answer ?? data.correct_answer ?? data.correctAnswer;
  if (typeof rawAns === 'number' && Number.isInteger(rawAns) && rawAns >= 0 && rawAns < choices.length) {
    correctIndex = rawAns;
  } else if (typeof rawAns === 'string') {
    const exact = choices.findIndex((c) => c.trim() === rawAns.trim());
    if (exact >= 0) correctIndex = exact;
    else if (rawAns.length <= 3) {
      const letter = rawAns.toUpperCase().charAt(0);
      const idx = letter.charCodeAt(0) - 65;
      if (idx >= 0 && idx < choices.length) correctIndex = idx;
    }
  }

  return {
    id: snap.id,
    subject: (data.category as string) || (data.subject as string) || 'Genel',
    topic: typeof data.topic === 'string' ? data.topic : undefined,
    sub_topic: typeof data.sub_topic === 'string' ? data.sub_topic : undefined,
    grade: typeof data.grade === 'string' ? data.grade : undefined,
    difficulty: (data.difficulty as Difficulty) || 'medium',
    question,
    choices,
    correctIndex,
    explanation: typeof data.explanation === 'string' ? data.explanation : undefined,
  };
}

function validateInput(input: ManualQuestionInput): void {
  if (!input.subject || !input.subject.trim()) throw new Error('Ders boş olamaz');
  if (!input.topic || !input.topic.trim()) {
    throw new Error('Konu zorunlu — etiketsiz soru havuza eklenemez');
  }
  if (!input.grade || !['9', '10', '11', '12'].includes(input.grade)) {
    throw new Error('Geçerli bir sınıf seç (9/10/11/12)');
  }
  if (!input.question || !input.question.trim()) throw new Error('Soru metni boş olamaz');
  if (!Array.isArray(input.choices) || input.choices.length < 2 || input.choices.length > 5) {
    throw new Error('2-5 arası şık girmelisin');
  }
  if (input.choices.some((c) => !c.trim())) throw new Error('Boş şık olamaz');
  if (new Set(input.choices.map((c) => c.trim())).size !== input.choices.length) {
    throw new Error('Şıklar birbirinden farklı olmalı');
  }
  if (
    !Number.isInteger(input.correctIndex) ||
    input.correctIndex < 0 ||
    input.correctIndex >= input.choices.length
  ) {
    throw new Error('Doğru cevap seçilmedi');
  }
}

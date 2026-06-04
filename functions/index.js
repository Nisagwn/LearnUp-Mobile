const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const Groq = require("groq-sdk");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// ─── RATE LIMIT: Kullanıcı başına 2 saniyelik bekleme ────────────────────────
const lastCallMap = new Map();
const RATE_LIMIT_MS = 2000;

function isRateLimited(key) {
  const now = Date.now();
  const last = lastCallMap.get(key) || 0;
  if (now - last < RATE_LIMIT_MS) return true;
  lastCallMap.set(key, now);
  return false;
}

// ─── AI ÇIKTI AYRIŞTIRICI ────────────────────────────────────────────────────
// AI'nin satır-etiketli ([SORU]/[A]..[D]/[DOGRU]/[ACIKLAMA]) çıktısını ayrıştırır.
// JSON kullanılmaz; LaTeX ters-bölüleri ($\frac, \Delta) olduğu gibi korunur.
// "Tek doğru cevap" güvencesi: yalnızca 4 FARKLI şıkkı ve geçerli tek doğru
// cevabı olan sorular döndürülür; belirsiz/eksik sorular elenir.
function parseTaggedQuestions(text) {
  const tagMap = { SORU: 'q', A: 'a', B: 'b', C: 'c', D: 'd', DOGRU: 'correct', ACIKLAMA: 'exp' };
  const blocks = [];
  let cur = null;
  let lastKey = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*\[\s*(SORU|A|B|C|D|DOGRU|ACIKLAMA)\b[^\]]*\]\s*(.*)$/i);
    if (m) {
      const key = tagMap[m[1].toUpperCase()];
      if (key === 'q') {
        if (cur && cur.q) blocks.push(cur);
        cur = { q: '', a: '', b: '', c: '', d: '', correct: '', exp: '' };
      }
      if (cur) { cur[key] = m[2].trim(); lastKey = key; }
    } else if (cur && lastKey && line.trim()) {
      // Satır kaymış devam metni — son alana ekle
      cur[lastKey] += ' ' + line.trim();
    }
  }
  if (cur && cur.q) blocks.push(cur);

  const letterIdx = { A: 0, B: 1, C: 2, D: 3 };
  return blocks
    .map((c) => {
      const options = [c.a, c.b, c.c, c.d].map((o) => (o || '').trim());
      if (!c.q.trim() || options.some((o) => !o)) return null;
      // Tek doğru cevap güvencesi: 4 şık birbirinden farklı olmalı
      if (new Set(options).size !== 4) return null;
      const idx = letterIdx[(c.correct || '').trim().toUpperCase().charAt(0)];
      if (idx == null) return null;
      return {
        question_text: c.q.trim(),
        options,
        correct_answer: options[idx],
        explanation: (c.exp || '').trim(),
      };
    })
    .filter(Boolean);
}

/**
 * getAIResponse — Chatbot mesajlarını işler (Eski adıyla getGeminiResponse).
 * Model: llama-3.1-8b-instant
 */
exports.getAIResponse = onRequest(
  { maxInstances: 10, cors: true, secrets: ["GROQ_API_KEY"] },
  (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    cors(req, res, async () => {
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(204).send("");
      }

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }

      try {
        const { history, userMessage } = req.body;

        if (!userMessage) {
          return res.status(400).json({ error: "userMessage eksik." });
        }

        // Rate limit kontrolü
        const rateLimitKey = (req.body && req.body.userId) || req.ip || "anonymous";
        if (isRateLimited(rateLimitKey)) {
          logger.warn(`[RATE_LIMIT] ${rateLimitKey} çok hızlı istek gönderdi.`);
          return res.status(429).json({
            error: "Çok hızlı istek. 2 saniye bekleyin.",
            retryAfterMs: RATE_LIMIT_MS,
          });
        }

        // API anahtarını al
        let apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          logger.error("GROQ_API_KEY bulunamadı!");
          return res.status(500).json({ error: "Sunucu yapılandırma hatası (GROQ_API_KEY eksik)." });
        }

        logger.info(`[GROQ] llama-3.1-8b-instant | key: ${apiKey.substring(0, 8)}...`);

        const groq = new Groq({ apiKey });

        const messages = [
          {
            role: "system",
            content: "Sen LearnUp platformunun asistanısın. Lise müfredatına hakimsin ve öğrencilere Türkçe, destekleyici ve kısa cevaplar verirsin. " +
              "Kullanıcıya somut bir eylem önerirken (örn. bir konudan quiz başlat veya başka bir konuya geç) " +
              "şu etiket formatlarını kullan; uygulama bunları otomatik olarak tıklanabilir butona çevirir: " +
              "[QUIZ:konu:soru_sayısı] (örn. [QUIZ:türev:5]) veya [KONU:başlık] (örn. [KONU:Limit]). " +
              "Etiketler cümle akışı içine doğal şekilde yerleştir, gereksiz yere fazla kullanma."
          }
        ];

        if (history && Array.isArray(history)) {
          const recentHistory = history.slice(-4);
          recentHistory.forEach(item => {
            const role = item.role === "model" || item.role === "assistant" ? "assistant" : "user";
            const content = (item.parts && item.parts[0] && item.parts[0].text) || item.content || item.text || "";
            if (content) {
              messages.push({ role, content });
            }
          });
        }

        messages.push({ role: "user", content: userMessage });

        const chatCompletion = await groq.chat.completions.create({
          messages: messages,
          model: "llama-3.1-8b-instant",
          temperature: 0.5,
          max_tokens: 4096,
        });

        const replyText = chatCompletion.choices[0]?.message?.content || "Cevap üretilemedi.";

        logger.info("[GROQ] Başarılı yanıt.");
        return res.status(200).json({ reply: replyText });

      } catch (fnError) {
        logger.error("[GROQ] Hata:", fnError.message || fnError);
        
        const debugInfo = {
          attemptedModel: "llama-3.1-8b-instant",
          errorMessage: fnError.message || null,
          errorStatus: fnError.status || fnError.code || null,
        };

        return res.status(500).json({ 
          error: fnError.message || "Sunucu hatası.", 
          debug: debugInfo 
        });
      }
    });
  }
);

/**
 * submitAnswer — Soru çözüm sonuçlarını kaydeder ve bir sonraki adaptif soruyu belirler.
 * Final Hibrit Veri Şeması (quiz_sessions ve last_30_ids) ile çalışır.
 */
exports.submitAnswer = onRequest(
  { maxInstances: 10, cors: true, secrets: ["GROQ_API_KEY"] },
  (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    cors(req, res, async () => {
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(204).send("");
      }

      if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

      let userId = null;

      try {
        const {
          subject: reqSubject,
          topic: reqTopic,
          sub_topic: reqSubTopic,
          isCorrect,
          givenAnswer,
          duration,
          questionId,
          questionText = null,
          grade: reqGrade = null
        } = req.body;

        // Parametre normalizasyonu
        const subject = reqSubject || reqTopic || "Matematik";
        const topic = reqTopic || subject;
        const sub_topic = reqSubTopic || req.body.concept_tag || req.body.conceptTag || "Genel";
        const durationValue = Number(duration) || 15;

        // Token doğrulama
        const authHeader = (req.get('Authorization') || req.get('authorization') || '').toString();
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const idToken = authHeader.split(' ')[1];
          try {
            const decoded = await admin.auth().verifyIdToken(idToken);
            userId = decoded.uid;
            logger.info(`Verified ID token for uid=${userId}`);
          } catch (err) {
            logger.warn(`Failed to verify ID token: ${err.message || err}`);
          }
        }

        if (!userId && req.body && req.body.userId) {
          userId = req.body.userId;
        }

        if (!userId) {
          return res.status(400).json({ error: "Eksik parametre: userId gerekli." });
        }

        // ─── QUIZ SESSION: Son 30 soru ID listesi yükle ───
        const sessionRef = db.collection('quiz_sessions').doc(userId);
        const sessionDoc = await sessionRef.get();
        let sessionData = sessionDoc.exists ? sessionDoc.data() : { user_id: userId, current_difficulty: 2, last_30_ids: [] };
        let last30Ids = sessionData.last_30_ids || [];

        // Kullanıcıyı yükle
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : {};

        // Mevcut zorluk seviyesi (1, 2, 3)
        const difficultyNum = Number(req.body.difficulty) || (userData.level_data?.current_level) || 2;

        let xpDelta = 0;
        if (isCorrect !== null && isCorrect !== undefined) {
          if (isCorrect) {
            if (difficultyNum === 1) xpDelta = 2;
            else if (difficultyNum === 2) xpDelta = 5;
            else if (difficultyNum === 3) xpDelta = 10;
          } else {
            xpDelta = -3;
          }
        }

        // 1. Mastery Scores Map güncelleme
        const subjectKey = subject.toLowerCase().trim();
        const masteryScores = userData.mastery_scores || {};
        const subjectMastery = masteryScores[subjectKey] || { score: 0, solved_count: 0, avg_speed: 0 };

        const priorScore = typeof subjectMastery.score === 'number' ? subjectMastery.score : 0;
        const newScore = Math.max(0, Math.min(100, priorScore + xpDelta));
        const newSolvedCount = (subjectMastery.solved_count || 0) + (isCorrect !== null ? 1 : 0);
        const newAvgSpeed = subjectMastery.solved_count === 0 
          ? durationValue 
          : Math.round((((subjectMastery.avg_speed || 0) * subjectMastery.solved_count) + durationValue) / newSolvedCount);

        masteryScores[subjectKey] = {
          score: newScore,
          solved_count: newSolvedCount,
          avg_speed: newAvgSpeed
        };

        // 2. Learning Profile (streak ve weak topics) güncelleme
        const learningProfile = userData.learning_profile || { weak_topics: [], streak: 0 };
        let newStreak = learningProfile.streak || 0;
        let weakTopics = learningProfile.weak_topics || [];

        if (isCorrect !== null && isCorrect !== undefined) {
          if (isCorrect) {
            newStreak += 1;
          } else {
            newStreak = 0;
            if (sub_topic) weakTopics = Array.from(new Set([...weakTopics, sub_topic]));
          }
        }

        const updatedLearningProfile = {
          weak_topics: weakTopics,
          streak: newStreak
        };

        // 3. Level Data güncelleme (Her 100 toplam puan dolduğunda level atlanır)
        const totalMasterySum = Object.values(masteryScores).reduce((sum, item) => sum + (item.score || 0), 0);
        const overallLevel = Math.floor(totalMasterySum / 100) + 1;
        
        const getLevelTitle = (lvl) => {
          if (lvl <= 1) return "Çırak";
          if (lvl === 2) return "Gezgin";
          if (lvl === 3) return "Kaşif";
          return "Üstat";
        };

        const updatedLevelData = {
          current_level: overallLevel,
          title: getLevelTitle(overallLevel)
        };

        // Son 30 soru ID listesini güncelle
        if (questionId) {
          last30Ids = Array.from(new Set([...last30Ids, questionId]));
          if (last30Ids.length > 30) last30Ids.shift();
        }

        const apiKey = process.env.GROQ_API_KEY;
        const groq = apiKey ? new Groq({ apiKey }) : null;

        // ─── PEDAGOJİK İPUCU (Hata Durumunda) ───
        let pedagogicalHint = null;
        if (isCorrect === false && questionText && groq) {
          try {
            const hintPrompt = `Öğrenci şu soruyu yanlış cevapladı:
Soru: ${questionText}
Seçtiği Yanlış Cevap: ${givenAnswer || "Belirtilmedi"}

Lütfen öğrenciyi motive edecek ve bu hatasındaki konsept eksiğini anlamasını sağlayacak tam 2 cümlelik pedagojik bir ipucu (hint / çözüm tüyosu) üret.`;
            
            const hintCompletion = await groq.chat.completions.create({
              messages: [{ role: "user", content: hintPrompt }],
              model: "llama-3.1-8b-instant",
              temperature: 0.6,
              max_tokens: 150
            });
            pedagogicalHint = (hintCompletion.choices[0]?.message?.content || "").trim();
          } catch (err) {
            logger.error("Pedagogical hint generation failed:", err);
          }
        }

        // Veritabanı dökümanını kaydet (users koleksiyonunda artık büyük diziler tutulmuyor!)
        if (isCorrect !== null && isCorrect !== undefined) {
          // NOT: users.stats (correctAnswers/totalSolved) artik yalnizca frontend
          // tarafindan atomik increment ile yaziliyor. Burada tekrar yazilirsa
          // ayni cevap iki kez sayilir.
          await userRef.set({
            mastery_scores: masteryScores,
            learning_profile: updatedLearningProfile,
            level_data: updatedLevelData,
            // Geriye dönük uyumluluk
            mastery: Object.keys(masteryScores).reduce((acc, k) => ({ ...acc, [k]: masteryScores[k].score }), {}),
          }, { merge: true });

          // ─── user_answers Koleksiyonuna Analitik Kaydı ───
          await db.collection('user_answers').add({
            user_id: userId,
            question_id: questionId || null,
            is_correct: isCorrect,
            given_answer: givenAnswer || null,
            duration: durationValue,
            sub_topic: sub_topic || null,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

          // ─── Kullanıcı özet (stats_summary) güncellemesi — cache amaçlı ───
          try {
            const nowDate = new Date();
            const monthKey = `${nowDate.getFullYear()}-${nowDate.getMonth()}`; // 0-based month index
            const dayIso = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).toISOString().slice(0,10);

            const summaryUpdates = {};
            summaryUpdates['stats_summary.totalSolved'] = admin.firestore.FieldValue.increment(1);
            if (isCorrect === true) summaryUpdates['stats_summary.correctAnswers'] = admin.firestore.FieldValue.increment(1);
            else if (isCorrect === false) summaryUpdates['stats_summary.wrongAnswers'] = admin.firestore.FieldValue.increment(1);
            else summaryUpdates['stats_summary.skippedAnswers'] = admin.firestore.FieldValue.increment(1);

            // Monthly / weekly buckets
            summaryUpdates[`stats_summary.monthly.${monthKey}.total`] = admin.firestore.FieldValue.increment(1);
            if (isCorrect === true) summaryUpdates[`stats_summary.monthly.${monthKey}.correct`] = admin.firestore.FieldValue.increment(1);

            summaryUpdates[`stats_summary.weekly.${dayIso}.total`] = admin.firestore.FieldValue.increment(1);
            if (isCorrect === true) summaryUpdates[`stats_summary.weekly.${dayIso}.correct`] = admin.firestore.FieldValue.increment(1);
            if (isCorrect === false) summaryUpdates[`stats_summary.weekly.${dayIso}.wrong`] = admin.firestore.FieldValue.increment(1);
            if (isCorrect === null || isCorrect === undefined) summaryUpdates[`stats_summary.weekly.${dayIso}.skipped`] = admin.firestore.FieldValue.increment(1);

            // Subject-level quick aggregations
            const subjKey = subjectKey || subject.toLowerCase().trim();
            if (subjKey) {
              summaryUpdates[`stats_summary.subjects.${subjKey}.total`] = admin.firestore.FieldValue.increment(1);
              if (isCorrect === true) summaryUpdates[`stats_summary.subjects.${subjKey}.correct`] = admin.firestore.FieldValue.increment(1);
            }

            await userRef.set(summaryUpdates, { merge: true });
          } catch (summaryErr) {
            logger.warn('stats_summary güncellemesi başarısız:', summaryErr.message || summaryErr);
          }

          // ─── quiz_sessions Koleksiyonu Güncelleme (7 gün TTL) ───
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await sessionRef.set({
            user_id: userId,
            current_difficulty: Number(userData.level_data?.current_level) || 2,
            last_30_ids: last30Ids,
            expires_at: admin.firestore.Timestamp.fromDate(expiresAt)
          }, { merge: true });
        }

        // Sonraki sorunun zorluğunu belirleme (3 doğruda zorluğu artır, yanlışta düşür)
        let nextDifficultyNum = difficultyNum;
        if (isCorrect) {
          if (newStreak >= 3) {
            nextDifficultyNum = Math.min(3, difficultyNum + 1);
          }
        } else if (isCorrect === false) {
          nextDifficultyNum = Math.max(1, difficultyNum - 1);
        }

        let newQuestion = null;

        // 1. ADIM: sub_topic eşleşmeli çözülmemiş soru ara
        if (sub_topic) {
          // Seed sorulari 'category' alaniyla kaydediliyor (bkz. dbSeeder.js).
          const subSnapshot = await db.collection('questions')
            .where('category', '==', subject)
            .where('sub_topic', '==', sub_topic)
            .limit(10)
            .get();
          if (!subSnapshot.empty) {
            const list = subSnapshot.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(q => !last30Ids.includes(q.id));
            if (list.length > 0) {
              newQuestion = list[Math.floor(Math.random() * list.length)];
              logger.info(`Alt başlık eşleşmeli soru seçildi: ${newQuestion.id}`);
            }
          }
        }

        // 2. ADIM: Konu ve zorluğa göre soru ara
        if (!newQuestion) {
          // difficulty filtresi kaldirildi: seed sorularinda difficulty string
          // ('medium'), nextDifficultyNum ise sayisal -> hicbir zaman eslesmiyordu.
          const mainSnapshot = await db.collection('questions')
            .where('category', '==', subject)
            .where('topic', '==', topic)
            .limit(10)
            .get();
          if (!mainSnapshot.empty) {
            const list = mainSnapshot.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(q => !last30Ids.includes(q.id));
            if (list.length > 0) {
              newQuestion = list[Math.floor(Math.random() * list.length)];
              logger.info(`Konu ve zorluk eşleşmeli soru seçildi: ${newQuestion.id}`);
            }
          }
        }

        // 3. ADIM: Ders bazlı genel havuzdan soru ara
        if (!newQuestion) {
          const generalSnapshot = await db.collection('questions')
            .where('category', '==', subject)
            .limit(10)
            .get();
          if (!generalSnapshot.empty) {
            const list = generalSnapshot.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(q => !last30Ids.includes(q.id));
            if (list.length > 0) {
              newQuestion = list[Math.floor(Math.random() * list.length)];
              logger.info(`Ders genel havuzundan soru seçildi: ${newQuestion.id}`);
            }
          }
        }

        // 4. ADIM: Soru bulunamadıysa Groq ile üret ve veritabanına kaydet
        // (JSON yerine satır-etiketli format — LaTeX ters-bölüleri bozulmaz)
        if (!newQuestion && groq) {
          const prompt = `Lise müfredatına uygun, TÜRKÇE, ${subject} dersi, ${topic} konusu, ${sub_topic || topic} alt başlığına ait, ${nextDifficultyNum} zorluk seviyesinde (1=Kolay, 2=Orta, 3=Zor) YENİ BİR çoktan seçmeli soru üret.
4 şık birbirinden FARKLI olmalı ve sorunun YALNIZCA TEK bir doğru cevabı bulunmalı. Formülleri LaTeX olarak $...$ arasında yaz.

AYNEN şu formatta ver, başka hiçbir metin ekleme:
[SORU] soru metni
[A] birinci şık
[B] ikinci şık
[C] üçüncü şık
[D] dördüncü şık
[DOGRU] doğru şıkkın harfi (A, B, C veya D)
[ACIKLAMA] kısa çözüm açıklaması`;

          try {
            logger.info(`[GROQ] Generating new question for ${subject} - ${topic}`);
            const chatCompletion = await groq.chat.completions.create({
              messages: [
                { role: "system", content: "Sen LearnUp asistanısın. Lise müfredatına hakimsin ve istenen çıktı formatına harfiyen uyarsın." },
                { role: "user", content: prompt }
              ],
              model: "llama-3.1-8b-instant",
              temperature: 0.3,
              max_tokens: 700,
            });

            const generatedText = chatCompletion.choices[0]?.message?.content || "";
            // 4 farklı şık + tek doğru cevap garantili sorular
            const list = parseTaggedQuestions(generatedText);

            if (list.length > 0) {
              const g = list[0];
              const difficultyStr = nextDifficultyNum === 1 ? 'easy' : (nextDifficultyNum === 3 ? 'hard' : 'medium');
              // grade: request'ten gelir; yoksa kullanıcı profilinden, o da yoksa '10'
              const fallbackGrade = userData?.grade ? String(userData.grade) : '10';
              const gradeForDoc = reqGrade ? String(reqGrade) : fallbackGrade;
              const docToSave = {
                category: subject,
                subject: subject,
                topic: topic,
                sub_topic: sub_topic || topic,
                difficulty: difficultyStr,
                text: g.question_text,
                question_text: g.question_text,
                options: g.options,
                correctAnswer: g.correct_answer,
                correct_answer: g.correct_answer,
                explanation: g.explanation,
                grade: gradeForDoc,
                is_ai_generated: true,
                isAI: true,
                verified: false,
                random_seed: Math.floor(Math.random() * 1000000),
                createdAt: Date.now()
              };

              const savedDoc = await db.collection('questions').add(docToSave);
              newQuestion = { id: savedDoc.id, ...docToSave };
              logger.info(`Yeni soru üretildi ve havuza eklendi. ID: ${savedDoc.id}`);
            }
          } catch (genErr) {
            logger.error("Groq soru üretimi başarısız oldu:", genErr);
          }
        }

        // Geriye dönük uyumluluk dönüşümü
        if (newQuestion) {
          newQuestion.text = newQuestion.text || newQuestion.question_text || '';
          newQuestion.options = Array.isArray(newQuestion.options)
            ? newQuestion.options
            : Object.values(newQuestion.options || {});
          newQuestion.correctAnswer = newQuestion.correctAnswer || newQuestion.correct_answer || null;
          // difficulty yalnizca sayisalsa string'e cevrilir; seed sorularinin
          // string difficulty'si ('hard' vb.) korunur.
          if (typeof newQuestion.difficulty === 'number') {
            newQuestion.difficulty = newQuestion.difficulty === 1 ? 'easy' : (newQuestion.difficulty === 3 ? 'hard' : 'medium');
          }
          newQuestion.category = newQuestion.category || newQuestion.subject;
        }

        return res.status(200).json({ 
          success: true,
          stats: {
            currentLevel: nextDifficultyNum,
            correctStreak: newStreak,
            wrongStreak: isCorrect === false ? 1 : 0
          }, 
          nextQuestion: newQuestion,
          pedagogicalHint: pedagogicalHint,
          mastery: {
            topic,
            value: newScore,
            levelUp: overallLevel > (userData.level_data?.current_level || 1),
            levelName: getLevelTitle(overallLevel)
          }
        });

      } catch (error) {
        logger.error("submitAnswer Error:", error);
        return res.status(500).json({ error: error.message || "Bilinmeyen bir hata oluştu." });
      }
    });
  }
);

// ─── 3-MODLU PROMPT MOTORU ───────────────────────────────────────────────────
// Tek bir mode parametresi ile sistem promptu, user promptu, sıcaklık ve
// max_tokens dinamik olarak değişir. Her zaman aynı satır-etiketli çıktı
// kontratı zorunlu kılınır (parseTaggedQuestions bağımlılığı).
const OUTPUT_CONTRACT = `Her soruyu AYNEN aşağıdaki formatta ver. Her etiket ayrı bir satırda olsun; numara, başlık veya ek açıklama YAZMA. Sorular arasına bir boş satır koy:

[SORU] soru metni
[A] birinci şık
[B] ikinci şık
[C] üçüncü şık
[D] dördüncü şık
[DOGRU] doğru şıkkın harfi (A, B, C veya D)
[ACIKLAMA] kısa çözüm açıklaması`;

function buildModePromptConfig({ mode, subject, topic, grade, count, difficulty, sampleQuestions }) {
  const gradeStr = grade ? String(grade) : "10";
  const diffStr = difficulty || "orta";
  const topicStr = (topic && topic.trim()) || "genel";
  const subjStr = subject || "Genel";

  if (mode === "ANALYZE_AND_DERIVE") {
    // sampleQuestions: cap 5, her item ≤600 char
    const samples = Array.isArray(sampleQuestions) ? sampleQuestions.slice(0, 5) : [];
    const samplesBlock = samples.map((s, i) => {
      const letters = ["A", "B", "C", "D"];
      const choices = Array.isArray(s.choices) ? s.choices.slice(0, 4) : [];
      const correctIdx = Number.isInteger(s.correctIndex) ? s.correctIndex : 0;
      const correctLetter = letters[Math.max(0, Math.min(3, correctIdx))];
      const lines = [
        `[ÖRNEK ${i + 1}]`,
        `[SORU] ${String(s.question || "").slice(0, 600)}`,
        `[A] ${String(choices[0] || "").slice(0, 200)}`,
        `[B] ${String(choices[1] || "").slice(0, 200)}`,
        `[C] ${String(choices[2] || "").slice(0, 200)}`,
        `[D] ${String(choices[3] || "").slice(0, 200)}`,
        `[DOGRU] ${correctLetter}`,
      ];
      if (s.explanation) lines.push(`[ACIKLAMA] ${String(s.explanation).slice(0, 300)}`);
      return lines.join("\n");
    }).join("\n\n");

    return {
      system: "Sen LearnUp asistanısın. Aşağıdaki örnek sorular yüksek kaliteli, müfredata uygun şablonlardır. Bu örneklerin DERİNLİĞİNİ, üslubunu ve yapısını analiz et; aynı ruhta YENİ sorular üret. Örnekleri taklit etme, türet. İstenen çıktı formatına harfiyen uy.",
      user: `Aşağıdaki örnek soruları analiz et:\n\n${samplesBlock || "(örnek yok — kendi yüksek standardını uygula)"}\n\nŞimdi ${gradeStr}. sınıf ${subjStr} dersi, "${topicStr}" konusunda, ${diffStr} zorlukta ${count} adet YENİ ve özgün çoktan seçmeli soru üret. Matematik/fizik formüllerini LaTeX olarak $...$ arasında yaz.\n\n${OUTPUT_CONTRACT}`,
      temperature: 0.5,
      max_tokens: 2500,
    };
  }

  if (mode === "CREATIVE_FREE") {
    return {
      system: `Sen LearnUp asistanısın. ${gradeStr}. sınıf ${subjStr} bilgisi temelli, ÖZGÜN ve YARATICI çoktan seçmeli sorular üret. Güncel bağlamlar, disiplinlerarası bağlantılar, gerçek hayat örnekleri ve hikâye-tabanlı kurgular kullan. Format 4 şıklı MCQ kalır, müfredat dışına saparsan bile öğretici olsun.`,
      user: `${gradeStr}. sınıf ${subjStr} dersi, "${topicStr}" konusunda, ${diffStr} zorlukta ${count} adet özgün ve yaratıcı çoktan seçmeli soru üret. Matematik/fizik formüllerini LaTeX olarak $...$ arasında yaz.\n\n${OUTPUT_CONTRACT}`,
      temperature: 0.85,
      max_tokens: 2500,
    };
  }

  // STRICT_CURRICULUM (default)
  return {
    system: `Sen LearnUp asistanısın. MEB ${gradeStr}. sınıf ${subjStr} müfredatı sınırları DIŞINA ÇIKMA. YKS hedef düzeyinde, kazanım uyumlu sorular üret. İstenen çıktı formatına harfiyen uy.`,
    user: `Lise ${gradeStr}. sınıf müfredatına uygun, TÜRKÇE, ${subjStr} dersi, "${topicStr}" konusuna ait, ${diffStr} zorlukta ${count} adet çoktan seçmeli soru üret.\nHer sorunun 4 şıkkı (A, B, C, D) olmalı; şıklar birbirinden FARKLI olmalı ve sorunun YALNIZCA TEK bir doğru cevabı bulunmalı.\nMatematik/fizik formüllerini LaTeX olarak $...$ arasında yaz (örn: $f(x) = 3x^2$, $\\frac{d}{dx}$).\n\n${OUTPUT_CONTRACT}`,
    temperature: 0.3,
    max_tokens: 2048,
  };
}

/**
 * generateQuestions — 3-modlu AI soru üretici.
 *   mode: 'ANALYZE_AND_DERIVE' | 'STRICT_CURRICULUM' (default) | 'CREATIVE_FREE'
 * Stateless: Firestore'a yazmaz; üretilen sorular client tarafından saveAIQuestions
 * ile havuza yazılır (verified:false) veya öğretmen panelinde onaylanır.
 * Model: llama-3.1-8b-instant
 */
exports.generateQuestions = onRequest(
  { maxInstances: 10, cors: true, secrets: ["GROQ_API_KEY"] },
  (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    cors(req, res, async () => {
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        return res.status(204).send("");
      }
      if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

      try {
        const { subject, topic, grade, count, difficulty, mode, sampleQuestions } = req.body;
        if (!subject) {
          return res.status(400).json({ error: "subject alanı gerekli." });
        }

        const resolvedMode =
          mode === "ANALYZE_AND_DERIVE" || mode === "CREATIVE_FREE"
            ? mode
            : "STRICT_CURRICULUM";

        const rateLimitKey = (req.body && req.body.userId) || req.ip || "anonymous";
        if (isRateLimited(rateLimitKey)) {
          return res.status(429).json({ error: "Çok hızlı istek. 2 saniye bekleyin.", retryAfterMs: RATE_LIMIT_MS });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          logger.error("GROQ_API_KEY bulunamadı!");
          return res.status(500).json({ error: "Sunucu yapılandırma hatası (GROQ_API_KEY eksik)." });
        }

        const qCount = Math.min(10, Math.max(1, Number(count) || 5));
        const cfg = buildModePromptConfig({
          mode: resolvedMode,
          subject,
          topic,
          grade,
          count: qCount,
          difficulty,
          sampleQuestions,
        });

        const groq = new Groq({ apiKey });

        logger.info(`[GROQ] generateQuestions mode=${resolvedMode} subject=${subject} topic=${topic || "(genel)"} grade=${grade || "10"} count=${qCount} temp=${cfg.temperature}`);
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: cfg.system },
            { role: "user", content: cfg.user }
          ],
          model: "llama-3.1-8b-instant",
          temperature: cfg.temperature,
          max_tokens: cfg.max_tokens,
        });

        const generatedText = chatCompletion.choices[0]?.message?.content || "";
        const questions = parseTaggedQuestions(generatedText);

        if (questions.length === 0) {
          logger.error("generateQuestions ayrıştırma boş döndü. Yanıt başı:", generatedText.slice(0, 300));
          return res.status(502).json({ error: "Soru üretilemedi. Lütfen tekrar deneyin." });
        }

        logger.info(`[GROQ] ${questions.length} soru üretildi (mode=${resolvedMode}).`);
        return res.status(200).json({ success: true, mode: resolvedMode, questions });

      } catch (fnError) {
        logger.error("[GROQ] generateQuestions Hata:", fnError.message || fnError);
        return res.status(500).json({ error: fnError.message || "Sunucu hatası." });
      }
    });
  }
);

/**
 * saveAIQuestions — AI üretimli soruları 'questions' havuzuna verified:false ile yazar.
 * Client'tan direkt write yok (firestore.rules teacherId zorunlu kılıyor). Admin SDK
 * üzerinden yazıldığı için kural devre dışı kalır; verified:false ile öğretmen onayı bekler.
 * Body: { questions: [{question_text, options, correct_answer, explanation}], subject, topic, sub_topic?, grade, difficulty, userId? }
 */
exports.saveAIQuestions = onRequest(
  { maxInstances: 10, cors: true },
  (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    cors(req, res, async () => {
      if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

      try {
        const { questions, subject, topic, sub_topic, grade, difficulty, userId } = req.body;
        if (!Array.isArray(questions) || questions.length === 0) {
          return res.status(400).json({ error: "questions dizisi gerekli." });
        }
        if (!subject) return res.status(400).json({ error: "subject gerekli." });

        const rateLimitKey = userId || req.ip || "anonymous";
        if (isRateLimited(rateLimitKey)) {
          return res.status(429).json({ error: "Çok hızlı istek.", retryAfterMs: RATE_LIMIT_MS });
        }

        // Auth: token varsa userId'yi token'dan çek (güvenlik için, ama gerekli kılmıyoruz)
        let resolvedUserId = userId || null;
        const authHeader = (req.get("Authorization") || req.get("authorization") || "").toString();
        if (authHeader.startsWith("Bearer ")) {
          try {
            const decoded = await admin.auth().verifyIdToken(authHeader.split(" ")[1]);
            resolvedUserId = decoded.uid;
          } catch (_) { /* token doğrulanamadı — yine de yazmaya devam et */ }
        }

        const gradeStr = grade ? String(grade) : "10";
        const diffStr = difficulty || "medium";
        const topicStr = topic || "genel";
        const subTopicStr = sub_topic || topicStr;

        const batch = db.batch();
        const savedIds = [];

        for (const q of questions) {
          if (!q || typeof q.question_text !== "string") continue;
          if (!Array.isArray(q.options) || q.options.length !== 4) continue;
          if (new Set(q.options).size !== 4) continue;
          if (typeof q.correct_answer !== "string" || !q.options.includes(q.correct_answer)) continue;

          const ref = db.collection("questions").doc();
          const doc = {
            category: subject,
            subject: subject,
            topic: topicStr,
            sub_topic: subTopicStr,
            difficulty: diffStr,
            grade: gradeStr,
            text: q.question_text,
            question_text: q.question_text,
            options: q.options,
            correctAnswer: q.correct_answer,
            correct_answer: q.correct_answer,
            explanation: typeof q.explanation === "string" ? q.explanation : "",
            teacherId: null,
            is_ai_generated: true,
            isAI: true,
            verified: false,
            random_seed: Math.floor(Math.random() * 1000000),
            createdAt: Date.now(),
            generatedBy: resolvedUserId,
          };
          batch.set(ref, doc);
          savedIds.push(ref.id);
        }

        if (savedIds.length === 0) {
          return res.status(400).json({ error: "Geçerli soru bulunamadı (validation)." });
        }

        await batch.commit();
        logger.info(`[saveAIQuestions] ${savedIds.length} soru havuza eklendi (verified:false)`);
        return res.status(200).json({ success: true, savedIds });

      } catch (fnError) {
        logger.error("[saveAIQuestions] Hata:", fnError.message || fnError);
        return res.status(500).json({ error: fnError.message || "Sunucu hatası." });
      }
    });
  }
);

// ════════════════════════════════════════════════════════════════════════════
// OYUNLAŞTIRMA — XP · Seri · Günlük Görevler · Haftalık Lig · Rozetler
// Tek otoriter giriş: recordAnswer. Tüm gamification yazmaları sunucuda yapılır.
// ════════════════════════════════════════════════════════════════════════════
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { xpForAnswer, todayISO, getWeekId, applyStreak } = require("./lib/gamification");
const { generateDailyQuests, applyAnswerToQuests } = require("./lib/quests");
const { resolveTierWeek } = require("./lib/league");
const { evaluateBadges } = require("./lib/badges");
const { nextCardState } = require("./lib/srs");

// levelSystem.js ile aynı eşikler (doğru cevap sayısına göre seviye)
const LEVEL_THRESHOLDS = [0, 5, 15, 30, 60, 100, 150, 200];
function levelFromCorrect(correct) {
  let lvl = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if ((correct || 0) >= LEVEL_THRESHOLDS[i]) lvl = i + 1;
  }
  return lvl;
}

// İstek başlığındaki ID token'dan veya gövdedeki userId'den kullanıcıyı çözer.
async function resolveUserId(req) {
  const authHeader = (req.get("Authorization") || req.get("authorization") || "").toString();
  if (authHeader.startsWith("Bearer ")) {
    try {
      const decoded = await admin.auth().verifyIdToken(authHeader.split(" ")[1]);
      return decoded.uid;
    } catch (err) {
      logger.warn(`ID token doğrulanamadı: ${err.message || err}`);
    }
  }
  return (req.body && req.body.userId) || null;
}

function freshGamification() {
  return {
    xp: 0,
    totalSolved: 0,
    correctAnswers: 0,
    subjects: {},
    streak: { count: 0, longest: 0, lastActiveDate: null, freezesAvailable: 0, freezeUsedDates: [] },
    league: { tier: "bronze", weekId: null, weeklyXP: 0 },
    dailyQuests: { date: null, quests: [] },
  };
}

// Ham gamification alanını normalize eder; görev/lig dönemi bayatladıysa yeniler.
function ensureGamification(raw, today, weekId) {
  const base = freshGamification();
  const g = { ...base, ...(raw || {}) };
  g.streak = { ...base.streak, ...(raw && raw.streak) };
  g.league = { ...base.league, ...(raw && raw.league) };
  g.subjects = (raw && raw.subjects) || {};
  if (!g.dailyQuests || g.dailyQuests.date !== today) {
    g.dailyQuests = generateDailyQuests(today);
  }
  if (g.league.weekId !== weekId) {
    g.league = { tier: g.league.tier || "bronze", weekId, weeklyXP: 0 };
  }
  return g;
}

function displayName(userData) {
  return (
    (userData && (userData.name || userData.fullName)) ||
    (userData && userData.email ? userData.email.split("@")[0] : null) ||
    "Öğrenci"
  );
}

// Lig sıralama kaydını günceller (haftalık XP otoriter olarak g.league'den yazılır).
// Yalnızca öğrenciler için çağırın — öğretmenler ligde yer almaz.
async function writeLeagueEntry(weekId, userId, name, tier, weeklyXP) {
  await db.collection("league_entries").doc(`${weekId}__${userId}`).set(
    {
      weekId,
      uid: userId,
      name,
      tier,
      weeklyXP,
      role: "student",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

// Kullanıcı dökümanından öğrenci olup olmadığını döndürür (varsayılan: öğrenci).
function isStudent(userData) {
  return (userData && userData.role ? userData.role : "student") === "student";
}

// CORS başlıklarını ayarlayıp OPTIONS'ı yanıtlar; POST değilse 405 döner.
function gameHandler(fn) {
  return (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    cors(req, res, async () => {
      if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
      try {
        await fn(req, res);
      } catch (err) {
        logger.error("Gamification fonksiyon hatası:", err);
        return res.status(500).json({ error: err.message || "Sunucu hatası." });
      }
    });
  };
}

/**
 * recordAnswer — Her cevaptan sonra çağrılır. Tek elden: log yazar, XP/seri/görev/
 * lig ilerlemesini ve rozetleri günceller, animasyon için delta döndürür.
 */
exports.recordAnswer = onRequest(
  { maxInstances: 20, cors: true },
  gameHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId gerekli." });

    const {
      questionId = null,
      subject = "Genel",
      topic = null,
      subTopic = null,
      isCorrect = null,
      isSkipped = false,
      attemptNumber = 1,
      durationSec = 0,
    } = req.body || {};

    const today = todayISO();
    const weekId = getWeekId();
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};

    const g = ensureGamification(userData.gamification, today, weekId);

    // XP
    const xpGained = xpForAnswer({ isCorrect: isCorrect === true, isSkipped: !!isSkipped, attemptNumber });
    g.xp = (g.xp || 0) + xpGained;

    // Sayaçlar
    g.totalSolved = (g.totalSolved || 0) + 1;
    if (isCorrect === true) g.correctAnswers = (g.correctAnswers || 0) + 1;

    // Ders bazlı sayaç (rozet/ustalık için)
    const subjKey = String(subject).toLowerCase().trim();
    const sub = g.subjects[subjKey] || { solved: 0, correct: 0 };
    sub.solved += 1;
    if (isCorrect === true) sub.correct += 1;
    sub.lastSolvedAt = today;
    g.subjects[subjKey] = sub;

    // learning_profile.weak_topics evrim:
    // - Eski string[] formatından yeni {subTopic, wrongCount, lastWrongAt}[] formatına normalize et
    // - Yanlış cevap → upsert/increment; doğru cevap → decrement (0'da çıkar)
    // - Cap 20 entry (en eski lastWrongAt drop)
    const lpRaw = (userData.learning_profile && userData.learning_profile.weak_topics) || [];
    const normalized = Array.isArray(lpRaw)
      ? lpRaw
          .map((entry) => {
            if (typeof entry === "string") {
              return { subTopic: entry, wrongCount: 1, lastWrongAt: today };
            }
            if (entry && typeof entry === "object" && entry.subTopic) {
              return {
                subTopic: String(entry.subTopic),
                wrongCount: Number(entry.wrongCount || 0),
                lastWrongAt: entry.lastWrongAt || today,
              };
            }
            return null;
          })
          .filter(Boolean)
      : [];
    const subTopicKey = subTopic || topic || null;
    let weakTopics = [...normalized];
    if (subTopicKey) {
      const idx = weakTopics.findIndex(
        (e) => e.subTopic.toLowerCase() === String(subTopicKey).toLowerCase(),
      );
      if (isCorrect === false) {
        if (idx >= 0) {
          weakTopics[idx] = {
            ...weakTopics[idx],
            wrongCount: weakTopics[idx].wrongCount + 1,
            lastWrongAt: today,
          };
        } else {
          weakTopics.push({ subTopic: String(subTopicKey), wrongCount: 1, lastWrongAt: today });
        }
      } else if (isCorrect === true && idx >= 0) {
        const nextCount = Math.max(0, weakTopics[idx].wrongCount - 1);
        if (nextCount === 0) {
          weakTopics.splice(idx, 1);
        } else {
          weakTopics[idx] = { ...weakTopics[idx], wrongCount: nextCount };
        }
      }
    }
    if (weakTopics.length > 20) {
      weakTopics.sort((a, b) => (a.lastWrongAt < b.lastWrongAt ? 1 : -1));
      weakTopics = weakTopics.slice(0, 20);
    }

    // Seri (tembel değerlendirme)
    const streakResult = applyStreak(g.streak, today);
    g.streak = streakResult.streak;

    // Günlük görevler
    const questResult = applyAnswerToQuests(g.dailyQuests, {
      isCorrect: isCorrect === true,
      isSkipped: !!isSkipped,
      attemptNumber,
      subject,
    });
    g.dailyQuests = questResult.dailyQuests;

    // Lig haftalık XP
    g.league.weeklyXP = (g.league.weeklyXP || 0) + xpGained;

    // Rozet değerlendirme
    const masteryScores = {};
    Object.entries(g.subjects).forEach(([k, v]) => {
      masteryScores[k] = { score: v.solved > 0 ? Math.round((v.correct / v.solved) * 100) : 0 };
    });
    const level = levelFromCorrect(g.correctAnswers);
    const earnedBadges = evaluateBadges({
      streakDays: g.streak.count,
      totalSolved: g.totalSolved,
      correctAnswers: g.correctAnswers,
      level,
      masteryScores,
    });
    const persistedBadges = Object.keys(userData.unlockedBadges || {});
    const newBadges = earnedBadges.filter((id) => !persistedBadges.includes(id));

    // Cevap logu — UserStatsContext ve TeacherDashboard bu koleksiyonu tüketir
    await db.collection("user_logs").add({
      studentId: userId,
      teacherId: userData.teacherId || null,
      subject,
      sub_topic: subTopic || topic || "Genel",
      questionId,
      isCorrect: isCorrect === true,
      isSkipped: !!isSkipped,
      skipped: !!isSkipped,
      timeSpent: Number(durationSec) || 0,
      duration: Number(durationSec) || 0,
      attemptNumber: Number(attemptNumber) || 1,
      xp: xpGained,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ─── SRS (Spaced Repetition) — yalnızca questionId varsa ve atılmadıysa ───
    // Tab "Yanlışlarım" buradan beslenir: yanlış → box=0 (hemen tekrar),
    // doğru → box++ ve nextReviewAt ileri ötelenir.
    if (questionId && !isSkipped && (isCorrect === true || isCorrect === false)) {
      try {
        const srsRef = db.collection("users").doc(userId).collection("srs_cards").doc(String(questionId));
        const srsSnap = await srsRef.get();
        const prev = srsSnap.exists ? srsSnap.data() : null;
        const prevForCalc = prev
          ? {
              box: prev.box,
              totalAttempts: prev.totalAttempts,
              totalCorrect: prev.totalCorrect,
              consecutiveCorrect: prev.consecutiveCorrect,
            }
          : null;
        const nowMs = Date.now();
        const next = nextCardState(prevForCalc, { isCorrect: isCorrect === true, nowMs });

        const snapshot = req.body && req.body.snapshot;
        const payload = {
          questionId: String(questionId),
          subject,
          sub_topic: subTopic || topic || "Genel",
          box: next.box,
          nextReviewAt: admin.firestore.Timestamp.fromMillis(next.nextReviewAtMs),
          lastReviewedAt: admin.firestore.Timestamp.fromMillis(next.lastReviewedAtMs),
          consecutiveCorrect: next.consecutiveCorrect,
          totalAttempts: next.totalAttempts,
          totalCorrect: next.totalCorrect,
        };
        // Snapshot (question/choices/answer) yalnızca payload'da geldiyse veya
        // önceki dokümanda yoksa yazılır — önceki snapshot her zaman korunur.
        if (snapshot && typeof snapshot === "object" && (!prev || !prev.snapshot)) {
          payload.snapshot = {
            question: String(snapshot.question || ""),
            choices: Array.isArray(snapshot.choices) ? snapshot.choices.map(String) : [],
            answer: Number(snapshot.answer),
          };
        }
        await srsRef.set(payload, { merge: true });
      } catch (srsErr) {
        logger.warn(`SRS upsert başarısız (uid=${userId} qid=${questionId}): ${srsErr.message || srsErr}`);
      }
    }

    // Kullanıcı dökümanı (gamification + yeni rozetler + weak_topics)
    const updates = {
      gamification: g,
      learning_profile: {
        ...(userData.learning_profile || {}),
        weak_topics: weakTopics,
      },
    };
    const nowIso = new Date().toISOString();
    newBadges.forEach((id) => {
      updates[`unlockedBadges.${id}`] = nowIso;
    });
    await userRef.set(updates, { merge: true });

    // Lig sıralama kaydı — yalnızca öğrenciler
    if (isStudent(userData)) {
      await writeLeagueEntry(weekId, userId, displayName(userData), g.league.tier, g.league.weeklyXP);
    }

    return res.status(200).json({
      success: true,
      xpGained,
      totalXp: g.xp,
      level,
      streak: {
        count: g.streak.count,
        milestone: streakResult.milestone,
        freezeUsed: streakResult.freezeUsed,
        freezeEarned: streakResult.freezeEarned,
        freezesAvailable: g.streak.freezesAvailable,
      },
      questsCompleted: questResult.completedNow,
      dailyQuests: g.dailyQuests,
      newBadges,
      league: { tier: g.league.tier, weeklyXP: g.league.weeklyXP },
    });
  })
);

/**
 * ensureDailyState — İstemci açılışta çağırır. Bugünün görevlerini ve haftanın
 * lig kaydını yoksa oluşturur, güncel gamification durumunu döndürür.
 */
exports.ensureDailyState = onRequest(
  { maxInstances: 10, cors: true },
  gameHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId gerekli." });

    const today = todayISO();
    const weekId = getWeekId();
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};

    const g = ensureGamification(userData.gamification, today, weekId);
    await userRef.set({ gamification: g }, { merge: true });
    // Lig kaydı yalnızca öğrenciler için — öğretmenler ligde yer almaz
    if (isStudent(userData)) {
      await writeLeagueEntry(weekId, userId, displayName(userData), g.league.tier, g.league.weeklyXP);
    }

    return res.status(200).json({ success: true, gamification: g, weekId });
  })
);

/**
 * claimQuestReward — Tamamlanmış bir günlük görevin ödülünü verir.
 */
exports.claimQuestReward = onRequest(
  { maxInstances: 10, cors: true },
  gameHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId gerekli." });
    const questId = req.body && req.body.questId;
    if (!questId) return res.status(400).json({ error: "questId gerekli." });

    const today = todayISO();
    const weekId = getWeekId();
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const g = ensureGamification(userData.gamification, today, weekId);

    const quest = g.dailyQuests.quests.find((q) => q.id === questId);
    if (!quest) return res.status(404).json({ error: "Görev bulunamadı." });
    if (quest.claimed) return res.status(400).json({ error: "Ödül zaten alındı." });
    if (quest.progress < quest.target) return res.status(400).json({ error: "Görev tamamlanmadı." });

    quest.claimed = true;
    g.xp = (g.xp || 0) + quest.rewardXP;
    g.league.weeklyXP = (g.league.weeklyXP || 0) + quest.rewardXP;

    await userRef.set({ gamification: g }, { merge: true });
    if (isStudent(userData)) {
      await writeLeagueEntry(weekId, userId, displayName(userData), g.league.tier, g.league.weeklyXP);
    }

    return res.status(200).json({
      success: true,
      rewardXP: quest.rewardXP,
      totalXp: g.xp,
      league: { tier: g.league.tier, weeklyXP: g.league.weeklyXP },
    });
  })
);

/**
 * useStreakFreeze — Kullanıcının elindeki dondurma hakkı varsa bugünün serisini
 * korumak için lastActiveDate'i bugüne çeker ve freezesAvailable'ı 1 azaltır.
 * freezeUsedDates listesine bugünün tarihi eklenir (audit için).
 */
exports.useStreakFreeze = onRequest(
  { maxInstances: 10, cors: true },
  gameHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId gerekli." });

    const today = todayISO();
    const weekId = getWeekId();
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const g = ensureGamification(userData.gamification, today, weekId);

    if (!(g.streak.freezesAvailable > 0)) {
      return res.status(400).json({ error: "Dondurma hakkın kalmadı." });
    }
    if (g.streak.lastActiveDate === today) {
      return res.status(400).json({ error: "Bugün zaten aktif görünüyorsun." });
    }
    if (Array.isArray(g.streak.freezeUsedDates) && g.streak.freezeUsedDates.includes(today)) {
      return res.status(400).json({ error: "Bugün için dondurma zaten kullanıldı." });
    }

    g.streak.freezesAvailable = Math.max(0, (g.streak.freezesAvailable || 0) - 1);
    g.streak.lastActiveDate = today;
    g.streak.freezeUsedDates = [
      ...(Array.isArray(g.streak.freezeUsedDates) ? g.streak.freezeUsedDates : []),
      today,
    ];

    await userRef.set({ gamification: g }, { merge: true });

    return res.status(200).json({
      success: true,
      streak: {
        count: g.streak.count,
        longest: g.streak.longest,
        freezesAvailable: g.streak.freezesAvailable,
        lastActiveDate: g.streak.lastActiveDate,
      },
    });
  })
);

/**
 * rolloverLeague — Her Pazartesi sabahı çalışır: geçen haftanın lig gruplarını
 * sıralar, terfi/küme düşmeyi uygular ve yeni hafta kayıtlarını oluşturur.
 */
exports.rolloverLeague = onSchedule(
  { schedule: "5 0 * * 1", timeZone: "Europe/Istanbul" },
  async () => {
    const now = new Date();
    const currentWeek = getWeekId(now);
    const lastWeek = getWeekId(new Date(now.getTime() - 3 * 86400000));
    if (lastWeek === currentWeek) {
      logger.info("rolloverLeague: işlenecek tamamlanmış hafta yok.");
      return;
    }

    const snap = await db.collection("league_entries").where("weekId", "==", lastWeek).get();
    if (snap.empty) {
      logger.info(`rolloverLeague: ${lastWeek} için kayıt yok.`);
      return;
    }

    const byTier = {};
    snap.forEach((d) => {
      const e = d.data();
      const tier = e.tier || "bronze";
      (byTier[tier] = byTier[tier] || []).push(e);
    });

    const batch = db.batch();
    Object.keys(byTier).forEach((tier) => {
      const results = resolveTierWeek(byTier[tier], tier);
      results.forEach((r) => {
        const member = byTier[tier].find((e) => e.uid === r.uid);
        batch.set(
          db.collection("users").doc(r.uid),
          { gamification: { league: { tier: r.newTier, weekId: currentWeek, weeklyXP: 0 } } },
          { merge: true }
        );
        batch.set(
          db.collection("league_entries").doc(`${currentWeek}__${r.uid}`),
          {
            weekId: currentWeek,
            uid: r.uid,
            name: (member && member.name) || "Öğrenci",
            tier: r.newTier,
            weeklyXP: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
    });

    await batch.commit();
    logger.info(`rolloverLeague: ${lastWeek} → ${currentWeek} tamamlandı (${snap.size} kayıt).`);
  }
);

/**
 * cleanupLeagueEntries — Bayat lig kayıtlarını temizler:
 *   • Öğrenci olmayan (öğretmen vb.) kullanıcıların entry'leri,
 *   • Artık var olmayan kullanıcıların entry'leri.
 *
 * Tek-seferlik bakım fonksiyonu. POST ile çağırılır, auth gerektirir
 * (Bearer token). Yanıt: { scanned, deleted, missing, kept }.
 *
 * Kullanım: deploy sonrası bir kez tetikle:
 *   curl -X POST -H "Authorization: Bearer $ID_TOKEN" \
 *     https://<region>-<project>.cloudfunctions.net/cleanupLeagueEntries
 */
exports.cleanupLeagueEntries = onRequest(
  { maxInstances: 1, cors: true },
  gameHandler(async (req, res) => {
    const callerId = await resolveUserId(req);
    if (!callerId) return res.status(401).json({ error: "Yetki gerekli (Bearer token)." });

    const snap = await db.collection("league_entries").get();
    if (snap.empty) {
      return res.status(200).json({ success: true, scanned: 0, deleted: 0, missing: 0, kept: 0 });
    }

    // uid -> role cache (aynı kullanıcı birden çok haftaya ait entry'ye sahip olabilir)
    const roleCache = new Map();
    const getRole = async (uid) => {
      if (roleCache.has(uid)) return roleCache.get(uid);
      try {
        const u = await db.collection("users").doc(uid).get();
        const role = u.exists ? (u.data().role || "student") : null;
        roleCache.set(uid, role);
        return role;
      } catch {
        roleCache.set(uid, null);
        return null;
      }
    };

    let scanned = 0;
    let deleted = 0;
    let kept = 0;
    let missing = 0;
    let batch = db.batch();
    let inBatch = 0;
    const BATCH_LIMIT = 450; // Firestore 500 sınırının altında güvenli pay

    for (const docSnap of snap.docs) {
      scanned += 1;
      const e = docSnap.data();
      if (!e || !e.uid) {
        // bozuk doküman — sil
        missing += 1;
        batch.delete(docSnap.ref);
        inBatch += 1;
      } else {
        const role = await getRole(e.uid);
        if (role === null) {
          missing += 1;
          batch.delete(docSnap.ref);
          inBatch += 1;
        } else if (role !== "student") {
          deleted += 1;
          batch.delete(docSnap.ref);
          inBatch += 1;
        } else {
          kept += 1;
        }
      }

      if (inBatch >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }

    if (inBatch > 0) await batch.commit();

    logger.info(
      `cleanupLeagueEntries: caller=${callerId} scanned=${scanned} deleted=${deleted} missing=${missing} kept=${kept}`
    );
    return res.status(200).json({ success: true, scanned, deleted, missing, kept });
  })
);

/**
 * deleteAccount — KVKK: kullanıcının tüm verisini ve Auth hesabını kalıcı siler.
 * Güvenlik: yalnızca doğrulanmış ID token'dan gelen uid silinir (body.userId YOK SAYILIR).
 * İstemci, çağrıdan hemen önce yeniden-doğrulama (recent login) yapmış olmalı.
 */
exports.deleteAccount = onRequest(
  { maxInstances: 5, cors: true },
  gameHandler(async (req, res) => {
    const authHeader = (req.get("Authorization") || req.get("authorization") || "").toString();
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Yetkilendirme gerekli." });
    }
    let userId;
    try {
      const decoded = await admin.auth().verifyIdToken(authHeader.split(" ")[1]);
      userId = decoded.uid;
    } catch (err) {
      logger.warn(`deleteAccount token doğrulanamadı: ${err.message || err}`);
      return res.status(401).json({ error: "Oturum doğrulanamadı." });
    }

    const deleteByField = async (collName, field) => {
      const snap = await db.collection(collName).where(field, "==", userId).get();
      let batch = db.batch();
      let n = 0;
      for (const d of snap.docs) {
        batch.delete(d.ref);
        n += 1;
        if (n >= 450) {
          await batch.commit();
          batch = db.batch();
          n = 0;
        }
      }
      if (n > 0) await batch.commit();
      return snap.size;
    };

    // studentId ile ilişkili kişisel veriler
    for (const coll of ["user_logs", "bookmarks", "notes", "assignment_submissions", "user_answers"]) {
      await deleteByField(coll, "studentId").catch((e) =>
        logger.warn(`deleteAccount ${coll} silme hatası: ${e.message || e}`)
      );
    }
    // lig kayıtları uid alanıyla tutulur
    await deleteByField("league_entries", "uid").catch(() => {});

    // doc id = uid olan koleksiyonlar
    for (const coll of ["quiz_sessions", "rate_limits", "cooldowns", "active_ai_jobs"]) {
      await db.collection(coll).doc(userId).delete().catch(() => {});
    }

    // kullanıcı dokümanı + alt koleksiyonlar (srs_cards, devices, bookmark_folders, chats)
    await admin.firestore().recursiveDelete(db.collection("users").doc(userId));

    // Auth hesabı en sonda
    await admin.auth().deleteUser(userId).catch((e) =>
      logger.warn(`deleteAccount Auth silme hatası: ${e.message || e}`)
    );

    logger.info(`deleteAccount: ${userId} hesabı silindi.`);
    return res.status(200).json({ success: true });
  })
);

// ════════════════════════════════════════════════════════════════════════════
// Push bildirim altyapısı — Expo Push API üzerinden gönderim.
// ════════════════════════════════════════════════════════════════════════════
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

async function fetchExpoTokens(uid) {
  const snap = await db.collection("users").doc(uid).collection("devices").get();
  const tokens = [];
  snap.forEach((d) => {
    const t = d.data() && d.data().expoPushToken;
    if (t && typeof t === "string" && t.startsWith("ExponentPushToken")) tokens.push(t);
  });
  return tokens;
}

async function sendExpoPush(uid, { title, body, data }) {
  const tokens = await fetchExpoTokens(uid);
  if (tokens.length === 0) return { sent: 0 };
  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    data: data || {},
    sound: "default",
    priority: "high",
  }));
  // Expo 100'erli batch önerir
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      logger.warn(`Expo push gönderilemedi (uid=${uid}): ${err.message || err}`);
    }
  }
  return { sent: tokens.length };
}

// Kullanıcı koleksiyonunu sayfalı dolaşır, her sayfa için handler çalıştırır.
async function forEachUserPage(handler, pageSize = 500) {
  let lastDoc = null;
  let processed = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = db.collection("users").orderBy("__name__").limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      try {
        await handler(d.id, d.data() || {});
      } catch (err) {
        logger.warn(`forEachUserPage handler hata (uid=${d.id}): ${err.message || err}`);
      }
      processed += 1;
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
  return processed;
}

/**
 * pushStreakRisk — Her gün 20:00 (Istanbul) çalışır. Serisi açık olan ancak
 * bugün hiç aktivite yapmamış öğrencilere "serini koru" hatırlatması atar.
 */
exports.pushStreakRisk = onSchedule(
  { schedule: "0 20 * * *", timeZone: "Europe/Istanbul" },
  async () => {
    const today = todayISO();
    let pushed = 0;
    await forEachUserPage(async (uid, data) => {
      if (!isStudent(data)) return;
      const streak = (data.gamification && data.gamification.streak) || {};
      if ((streak.count || 0) < 1) return;
      if (streak.lastActiveDate === today) return;
      await sendExpoPush(uid, {
        title: "Serin tehlikede 🔥",
        body: `${streak.count} günlük serin sönmek üzere. Bugün 1 soru çöz, alev sürsün.`,
        data: { deepLink: "/(student)", kind: "streak_risk" },
      });
      pushed += 1;
    });
    logger.info(`pushStreakRisk: ${pushed} kullanıcıya bildirim gönderildi.`);
  }
);

/**
 * pushDailyQuestReminder — Her gün 21:00 (Istanbul) çalışır. Bugünün
 * tamamlanmamış görevi olan öğrencilere hatırlatma atar.
 */
exports.pushDailyQuestReminder = onSchedule(
  { schedule: "0 21 * * *", timeZone: "Europe/Istanbul" },
  async () => {
    const today = todayISO();
    let pushed = 0;
    await forEachUserPage(async (uid, data) => {
      if (!isStudent(data)) return;
      const dq = (data.gamification && data.gamification.dailyQuests) || {};
      if (dq.date !== today) return;
      const quests = Array.isArray(dq.quests) ? dq.quests : [];
      const incomplete = quests.filter((q) => (q.progress || 0) < (q.target || 0));
      if (incomplete.length === 0) return;
      await sendExpoPush(uid, {
        title: "Görevlerin seni bekliyor ✨",
        body: `Bugün ${incomplete.length} görev tamamlanmadı. Ödülleri kaçırma!`,
        data: { deepLink: "/(student)/daily-quests", kind: "daily_quest_reminder" },
      });
      pushed += 1;
    });
    logger.info(`pushDailyQuestReminder: ${pushed} kullanıcıya bildirim gönderildi.`);
  }
);

/**
 * pushLeagueRollover — Her Pazartesi 00:15 (rolloverLeague'den 10 dk sonra)
 * çalışır. Bir önceki haftaya katılan tüm öğrencilere yeni tier'larını bildirir.
 */
exports.pushLeagueRollover = onSchedule(
  { schedule: "15 0 * * 1", timeZone: "Europe/Istanbul" },
  async () => {
    const { TIER_META } = require("./lib/league");
    const currentWeek = getWeekId();
    const snap = await db.collection("league_entries").where("weekId", "==", currentWeek).get();
    if (snap.empty) {
      logger.info("pushLeagueRollover: kayıt yok, atlanıyor.");
      return;
    }
    let pushed = 0;
    for (const d of snap.docs) {
      const e = d.data();
      if (!e || !e.uid || !e.tier) continue;
      const meta = TIER_META[e.tier] || TIER_META.bronze;
      try {
        await sendExpoPush(e.uid, {
          title: `Yeni hafta · ${meta.label} ${meta.emoji}`,
          body: "Bu haftanın lig sıralaması başladı. XP topla, zirveye çık!",
          data: { deepLink: "/(student)/league", kind: "league_rollover" },
        });
        pushed += 1;
      } catch (err) {
        logger.warn(`pushLeagueRollover hata (uid=${e.uid}): ${err.message || err}`);
      }
    }
    logger.info(`pushLeagueRollover: ${pushed} kullanıcıya bildirim gönderildi.`);
  }
);

// ════════════════════════════════════════════════════════════════════════════
// BOOKMARK ORGANIZATION — Klasör itemCount sync trigger'ı.
// ════════════════════════════════════════════════════════════════════════════
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

// Custom klasör mü? Otomatik klasörler 'auto:' önekli ve DB'de tutulmaz.
function isCustomFolderId(folderId) {
  return typeof folderId === "string" && folderId.length > 0 && !folderId.startsWith("auto:");
}

async function incrementFolderCount(uid, folderId, delta) {
  if (!uid || !isCustomFolderId(folderId)) return;
  const ref = db
    .collection("users")
    .doc(uid)
    .collection("bookmark_folders")
    .doc(folderId);
  try {
    await ref.set(
      { itemCount: admin.firestore.FieldValue.increment(delta) },
      { merge: true },
    );
  } catch (err) {
    logger.warn(`syncFolderCounts increment hata (uid=${uid}, folder=${folderId}): ${err.message || err}`);
  }
}

/**
 * syncFolderCounts — bookmarks koleksiyonu write trigger'ı. Bir bookmark'ın
 * klasörü değişince, eski klasörün itemCount'u -1, yenisinin +1 olur.
 * Otomatik klasörler ('auto:subject') sayım dışındadır — client türetir.
 */
exports.syncFolderCounts = onDocumentWritten(
  { document: "bookmarks/{bookmarkId}" },
  async (event) => {
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;

    if (!before && after) {
      await incrementFolderCount(after.studentId, after.folderId, 1);
      return;
    }
    if (before && !after) {
      await incrementFolderCount(before.studentId, before.folderId, -1);
      return;
    }
    if (before && after && before.folderId !== after.folderId) {
      await incrementFolderCount(before.studentId, before.folderId, -1);
      await incrementFolderCount(after.studentId, after.folderId, 1);
    }
  },
);

// ════════════════════════════════════════════════════════════════════════════
// PUSH BİLDİRİMLERİ — Duyuru/Ödev tetikleyicileri + due hatırlatma
// Tüm bildirim gönderimleri lib/expoPush.js helper'ı üzerinden.
// Geçersiz token'lar otomatik temizlenir (DeviceNotRegistered).
// ════════════════════════════════════════════════════════════════════════════
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const {
  sendExpoPush: sendExpoPushMulti,
  collectStudentTokensForTeacher,
  collectUserTokens,
} = require("./lib/expoPush");

/**
 * onAssignmentCreated — yeni ödev oluştuğunda bağlı öğrencilere push.
 * Deep link: /(student)/assignments/{id}
 */
exports.onAssignmentCreated = onDocumentCreated(
  { document: "assignments/{assignmentId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};
    const teacherId = data.teacherId;
    if (!teacherId) return;

    try {
      const targets = await collectStudentTokensForTeacher(db, teacherId);
      if (targets.length === 0) {
        logger.info(`[onAssignmentCreated] no targets for teacher=${teacherId}`);
        return;
      }
      const title = "Yeni Ödev";
      const body = (data.title && String(data.title).slice(0, 120)) || "Bir ödev paylaşıldı";
      await sendExpoPushMulti(
        targets,
        {
          title,
          body,
          data: {
            type: "assignment",
            assignmentId: event.params.assignmentId,
            deepLink: `/(student)/assignments/${event.params.assignmentId}`,
          },
        },
        logger,
      );
    } catch (err) {
      logger.error("[onAssignmentCreated] hata:", err.message || err);
    }
  },
);

/**
 * onAnnouncementCreated — yeni duyuru oluştuğunda bağlı öğrencilere push.
 * Deep link: ana sayfa (duyuru kartı orada görünüyor).
 */
exports.onAnnouncementCreated = onDocumentCreated(
  { document: "announcements/{announcementId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};
    const teacherId = data.teacherId;
    if (!teacherId) return;

    try {
      const targets = await collectStudentTokensForTeacher(db, teacherId);
      if (targets.length === 0) {
        logger.info(`[onAnnouncementCreated] no targets for teacher=${teacherId}`);
        return;
      }
      const title = (data.title && String(data.title).slice(0, 80)) || "Yeni Duyuru";
      const body = (data.content && String(data.content).slice(0, 140)) || "Öğretmenin yeni bir duyurusu var";
      await sendExpoPushMulti(
        targets,
        {
          title,
          body,
          data: {
            type: "announcement",
            announcementId: event.params.announcementId,
            deepLink: "/(student)",
          },
        },
        logger,
      );
    } catch (err) {
      logger.error("[onAnnouncementCreated] hata:", err.message || err);
    }
  },
);

/**
 * assignmentDueReminder — saatte bir, due'su yaklaşan (≤24sa, geçmemiş) ödevler
 * için tek seferlik hatırlatma. Idempotency: assignments.reminderSentAt set edilir.
 * Cron: her saat başı.
 */
exports.assignmentDueReminder = onSchedule(
  { schedule: "every 60 minutes", timeZone: "Europe/Istanbul" },
  async () => {
    const now = Date.now();
    const horizonMs = now + 24 * 60 * 60 * 1000;
    const nowTs = admin.firestore.Timestamp.fromMillis(now);
    const horizonTs = admin.firestore.Timestamp.fromMillis(horizonMs);

    // dueDate > now && dueDate <= now+24h && reminderSentAt == null
    // Firestore'da OR/IS NULL yok — reminderSentAt yokluğunu client tarafında elenir.
    let snap;
    try {
      snap = await db
        .collection("assignments")
        .where("dueDate", ">", nowTs)
        .where("dueDate", "<=", horizonTs)
        .limit(200)
        .get();
    } catch (err) {
      logger.error("[assignmentDueReminder] query fail:", err.message || err);
      return;
    }
    if (snap.empty) {
      logger.info("[assignmentDueReminder] eşleşen ödev yok");
      return;
    }

    let sent = 0;
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      if (data.reminderSentAt) continue; // idempotency
      const teacherId = data.teacherId;
      if (!teacherId) continue;

      try {
        const targets = await collectStudentTokensForTeacher(db, teacherId);
        if (targets.length > 0) {
          const dueMs = data.dueDate && data.dueDate.toMillis ? data.dueDate.toMillis() : 0;
          const hoursLeft = Math.max(1, Math.round((dueMs - now) / (60 * 60 * 1000)));
          await sendExpoPushMulti(
            targets,
            {
              title: "Ödev Hatırlatma",
              body: `${(data.title || "Ödev").slice(0, 80)} — ${hoursLeft} saat içinde teslim`,
              data: {
                type: "assignment_due",
                assignmentId: doc.id,
                deepLink: `/(student)/assignments/${doc.id}`,
              },
            },
            logger,
          );
          sent++;
        }
        // Hedef olmasa bile idempotency için işaretle (tekrar tekrar uğraşma)
        await doc.ref.set(
          { reminderSentAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        );
      } catch (err) {
        logger.warn(`[assignmentDueReminder] ödev=${doc.id} hata: ${err.message || err}`);
      }
    }
    logger.info(`[assignmentDueReminder] taranan=${snap.size} bildirim_gönderilen=${sent}`);
  },
);

// ════════════════════════════════════════════════════════════════════════════
// ÖDEV SUBMISSION — Otomatik puanlama + öğretmen bildirimi
// ════════════════════════════════════════════════════════════════════════════

/**
 * questions/{id} dokümanından doğru cevabın index'ini çıkar.
 * Eski/yeni alan kombinasyonlarını destekler:
 *   correctIndex (number) > correct_answer/correctAnswer (string|letter|index)
 */
function resolveCorrectIndex(qData) {
  if (!qData) return -1;
  const options = Array.isArray(qData.options)
    ? qData.options
    : Array.isArray(qData.choices)
      ? qData.choices
      : [];
  if (options.length === 0) return -1;

  if (typeof qData.correctIndex === "number" && Number.isInteger(qData.correctIndex)) {
    if (qData.correctIndex >= 0 && qData.correctIndex < options.length) return qData.correctIndex;
  }
  if (typeof qData.answer === "number" && Number.isInteger(qData.answer)) {
    if (qData.answer >= 0 && qData.answer < options.length) return qData.answer;
  }
  const raw = qData.correctAnswer || qData.correct_answer;
  if (typeof raw === "string") {
    const exact = options.findIndex((o) => String(o).trim() === raw.trim());
    if (exact >= 0) return exact;
    if (raw.length <= 3) {
      const letter = raw.toUpperCase().charAt(0);
      const idx = letter.charCodeAt(0) - 65;
      if (idx >= 0 && idx < options.length) return idx;
    }
  }
  return -1;
}

/**
 * submitAssignment — öğrenci ödev sorularını çözüp gönderir.
 * Otomatik puan: doğru sayısı (her soru 1 puan, maxScore = soru sayısı).
 * Tekrar gönderim engeli: studentId + assignmentId unique guard.
 */
exports.submitAssignment = onRequest(
  { maxInstances: 10, cors: true },
  (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    cors(req, res, async () => {
      if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

      try {
        const userId = await resolveUserId(req);
        if (!userId) return res.status(400).json({ error: "userId gerekli." });

        const { assignmentId, answers } = req.body || {};
        if (!assignmentId || typeof assignmentId !== "string") {
          return res.status(400).json({ error: "assignmentId gerekli." });
        }
        if (!Array.isArray(answers)) {
          return res.status(400).json({ error: "answers dizisi gerekli." });
        }

        // Ödev dokümanını çek
        const assignmentSnap = await db.collection("assignments").doc(assignmentId).get();
        if (!assignmentSnap.exists) {
          return res.status(404).json({ error: "Ödev bulunamadı." });
        }
        const assignment = assignmentSnap.data() || {};
        const questionIds = Array.isArray(assignment.questionIds) ? assignment.questionIds : [];
        const teacherId = assignment.teacherId || null;
        if (questionIds.length === 0) {
          return res.status(400).json({ error: "Bu ödevin sorusu yok." });
        }

        // Unique guard — daha önce gönderilmiş mi?
        const existing = await db
          .collection("assignment_submissions")
          .where("studentId", "==", userId)
          .where("assignmentId", "==", assignmentId)
          .limit(1)
          .get();
        if (!existing.empty) {
          return res.status(409).json({ error: "Bu ödev zaten gönderilmiş." });
        }

        // Cevapları sırayla işle — questionId → index map
        const answerMap = new Map();
        answers.forEach((a) => {
          if (a && typeof a.questionId === "string" && Number.isInteger(a.selectedIndex)) {
            answerMap.set(a.questionId, a.selectedIndex);
          }
        });

        // Tüm soru dokümanlarını paralel çek (chunk 10 — Firestore getAll limit)
        const questionDocs = [];
        for (let i = 0; i < questionIds.length; i += 10) {
          const slice = questionIds.slice(i, i + 10);
          const refs = slice.map((qid) => db.collection("questions").doc(qid));
          const docs = await db.getAll(...refs);
          docs.forEach((d, idx) => {
            questionDocs.push({ id: slice[idx], snap: d });
          });
        }

        // Cevapları skorla + snapshot al
        const processedAnswers = [];
        let correct = 0;
        questionDocs.forEach(({ id: qid, snap }) => {
          const data = snap.exists ? snap.data() : null;
          const correctIdx = resolveCorrectIndex(data);
          const selectedIndex = answerMap.has(qid) ? answerMap.get(qid) : -1;
          const isCorrect = selectedIndex >= 0 && selectedIndex === correctIdx;
          if (isCorrect) correct++;
          processedAnswers.push({
            questionId: qid,
            selectedIndex,
            isCorrect,
            questionTextSnapshot: data
              ? String(data.text || data.question_text || data.question || "").slice(0, 500)
              : "",
          });
        });

        const maxScore = typeof assignment.maxScore === "number"
          ? assignment.maxScore
          : questionIds.length;
        const autoScore = correct;

        const ref = await db.collection("assignment_submissions").add({
          assignmentId,
          studentId: userId,
          teacherId,
          answers: processedAnswers,
          autoScore,
          score: autoScore, // default = autoScore; öğretmen override edebilir
          feedback: "",
          status: "submitted",
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info(
          `[submitAssignment] uid=${userId} assignment=${assignmentId} score=${autoScore}/${maxScore}`,
        );
        return res.status(200).json({
          success: true,
          submissionId: ref.id,
          autoScore,
          maxScore,
        });
      } catch (err) {
        logger.error("[submitAssignment] hata:", err.message || err);
        return res.status(500).json({ error: err.message || "Sunucu hatası" });
      }
    });
  },
);

/**
 * onSubmissionCreated — yeni submission gelince öğretmene push.
 * Sprint 2 sendExpoPush + collectUserTokens reuse.
 */
exports.onSubmissionCreated = onDocumentCreated(
  { document: "assignment_submissions/{submissionId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};
    const teacherId = data.teacherId;
    if (!teacherId) return;

    try {
      // Öğretmenin bildirim tercihini kontrol et
      const teacherSnap = await db.collection("users").doc(teacherId).get();
      const teacher = teacherSnap.exists ? teacherSnap.data() : {};
      const prefs = (teacher && teacher.teacherNotifPrefs) || {};
      if (prefs.assignmentSubmissions === false) {
        logger.info(`[onSubmissionCreated] teacher=${teacherId} ödev teslim bildirimi kapalı`);
        return;
      }

      const targets = await collectUserTokens(db, teacherId);
      if (targets.length === 0) return;

      // Öğrenci adı + ödev başlığı (best-effort)
      let studentName = "Bir öğrenci";
      try {
        const stuSnap = await db.collection("users").doc(data.studentId).get();
        if (stuSnap.exists) {
          const stu = stuSnap.data() || {};
          studentName = stu.name || stu.fullName || stu.email || studentName;
        }
      } catch (_) { /* ignore */ }
      let assignmentTitle = "ödev";
      try {
        const aSnap = await db.collection("assignments").doc(data.assignmentId).get();
        if (aSnap.exists) {
          const a = aSnap.data() || {};
          if (a.title) assignmentTitle = String(a.title).slice(0, 80);
        }
      } catch (_) { /* ignore */ }

      await sendExpoPushMulti(
        targets,
        {
          title: "Yeni Ödev Teslimi",
          body: `${studentName} "${assignmentTitle}" ödevini teslim etti`,
          data: {
            type: "submission",
            assignmentId: data.assignmentId,
            submissionId: event.params.submissionId,
            deepLink: `/(teacher)/assignments/${data.assignmentId}/submissions`,
          },
        },
        logger,
      );
    } catch (err) {
      logger.error("[onSubmissionCreated] hata:", err.message || err);
    }
  },
);

/**
 * sendTestPush — geçerli kullanıcıya bir test bildirimi gönderir.
 * Ayarlar ekranındaki "Test Bildirimi" butonu için. Token'ı kayıtlı olmalı.
 */
exports.sendTestPush = onRequest(
  { maxInstances: 5, cors: true },
  (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    cors(req, res, async () => {
      if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
      try {
        const userId = await resolveUserId(req);
        if (!userId) return res.status(400).json({ error: "userId gerekli." });

        const targets = await collectUserTokens(db, userId);
        if (targets.length === 0) {
          return res.status(404).json({ error: "Cihaz token'ı yok. Bildirimleri aç ve uygulamayı bir kez yeniden başlat." });
        }
        const result = await sendExpoPushMulti(
          targets,
          {
            title: "LearnUp Test",
            body: "Bildirimlerin çalışıyor — burdan haberin olacak.",
            data: { type: "test", deepLink: "/(student)" },
          },
          logger,
        );
        return res.status(200).json({ success: true, ...result });
      } catch (err) {
        logger.error("[sendTestPush] hata:", err.message || err);
        return res.status(500).json({ error: err.message || "Sunucu hatası" });
      }
    });
  },
);

// ════════════════════════════════════════════════════════════════════════════
// HEDEFLİ ATAMA (Targeted Assignments) — öğretmen → öğrenci özel soru seti
// AI mode: ANALYZE_AND_DERIVE — öğrencinin son yanlışlarından few-shot.
// Pool mode: mevcut onaylı havuzdan sub_topic eşleşmeli rastgele soru.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Onaylı havuzdan sub_topic/subject eşleşmeli rastgele örnek soru seç.
 * generateQuestions ANALYZE_AND_DERIVE için kullanılır.
 */
async function fetchSamplesForDerive(subject, grade, limit = 5) {
  try {
    let snap = await db
      .collection("questions")
      .where("category", "==", subject)
      .where("grade", "==", grade || "10")
      .where("verified", "==", true)
      .limit(limit * 2)
      .get();
    if (snap.empty) {
      snap = await db
        .collection("questions")
        .where("category", "==", subject)
        .where("verified", "==", true)
        .limit(limit * 2)
        .get();
    }
    const out = [];
    snap.forEach((d) => {
      const x = d.data() || {};
      const options = Array.isArray(x.options) ? x.options : Array.isArray(x.choices) ? x.choices : [];
      if (options.length < 2) return;
      const correctIdx = resolveCorrectIndex(x);
      if (correctIdx < 0) return;
      out.push({
        question: String(x.text || x.question_text || x.question || ""),
        choices: options,
        correctIndex: correctIdx,
        explanation: typeof x.explanation === "string" ? x.explanation : undefined,
      });
    });
    return out.slice(0, limit);
  } catch (err) {
    logger.warn("[fetchSamplesForDerive] hata:", err.message || err);
    return [];
  }
}

/**
 * Öğrencinin yanlış cevapladığı son N kartı SRS koleksiyonundan çeker
 * (snapshot taşıyan, consecutiveCorrect=0 — henüz düzeltememiş kartlar).
 * Hedefli atama AI üretimini öğrencinin GERÇEK zayıflıklarına yönlendirmek
 * için kullanılır. subject filtresi best-effort; çoğu kartta subject yoksa
 * limit dolana kadar genel listeden döner.
 */
async function fetchStudentWrongSamples(studentId, subject, limit = 5) {
  if (!studentId) return [];
  try {
    const snap = await db
      .collection("users")
      .doc(studentId)
      .collection("srs_cards")
      .orderBy("lastReviewedAt", "desc")
      .limit(50)
      .get();
    const matched = [];
    const others = [];
    snap.forEach((d) => {
      const x = d.data() || {};
      if ((x.consecutiveCorrect ?? 0) > 0) return;
      const s = x.snapshot;
      if (!s || !s.question || !Array.isArray(s.choices) || s.choices.length < 2) return;
      if (typeof s.answer !== "number" || s.answer < 0) return;
      const sample = {
        question: String(s.question).slice(0, 800),
        choices: s.choices,
        correctIndex: s.answer,
      };
      const subjMatches = !subject || (x.subject && String(x.subject).toLowerCase() === subject.toLowerCase());
      if (subjMatches) matched.push(sample);
      else others.push(sample);
    });
    return matched.concat(others).slice(0, limit);
  } catch (err) {
    logger.warn("[fetchStudentWrongSamples] hata:", err.message || err);
    return [];
  }
}

/**
 * Pool kaynağı için: sub_topic eşleşmeli, onaylı havuzdan rastgele N soru.
 * fetchQuestionPool ile birebir 3-kademeli fallback aynı pattern (sub_topic →
 * subject + grade). 'topic' yok varsayılıyor.
 */
async function pickPoolQuestions(subject, grade, subTopics, difficulty, count) {
  const seen = new Set();
  const out = [];
  const tryQuery = async (extraFilters) => {
    if (out.length >= count) return;
    try {
      let q = db.collection("questions")
        .where("category", "==", subject)
        .where("grade", "==", grade || "10")
        .where("verified", "==", true)
        .where("difficulty", "==", difficulty);
      extraFilters.forEach(([f, v]) => {
        q = q.where(f, "==", v);
      });
      const snap = await q.limit(count * 3).get();
      snap.forEach((d) => {
        if (out.length >= count) return;
        if (seen.has(d.id)) return;
        seen.add(d.id);
        out.push({ id: d.id, data: d.data() || {} });
      });
    } catch (err) {
      logger.warn("[pickPoolQuestions] query hata:", err.message || err);
    }
  };
  // sub_topic seçili olanlardan tek tek dene
  for (const st of (subTopics || [])) {
    if (out.length >= count) break;
    await tryQuery([["sub_topic", st]]);
  }
  // hala eksikse subject+grade+difficulty ile fallback
  if (out.length < count) await tryQuery([]);
  // Karıştır
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, count);
}

/**
 * generateTargetedSet — öğretmen hedefli soru seti oluşturur.
 * Body: { studentId, subject, focusSubTopics: string[], count: number,
 *         difficulty, source: 'ai'|'pool', rationale? }
 * AI source: ANALYZE_AND_DERIVE ile üretir → havuza yazar (verified:false) →
 *            targeted_assignments doc'una questionIds set eder.
 * Pool source: onaylı havuzdan rastgele alır → doğrudan questionIds set eder.
 */
exports.generateTargetedSet = onRequest(
  { maxInstances: 10, cors: true, secrets: ["GROQ_API_KEY"] },
  (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    cors(req, res, async () => {
      if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

      try {
        const teacherId = await resolveUserId(req);
        if (!teacherId) return res.status(400).json({ error: "userId gerekli." });

        const {
          studentId,
          subject,
          focusSubTopics,
          count,
          difficulty,
          source,
          rationale,
        } = req.body || {};

        if (!studentId || typeof studentId !== "string") {
          return res.status(400).json({ error: "studentId gerekli." });
        }
        if (!subject || typeof subject !== "string") {
          return res.status(400).json({ error: "subject gerekli." });
        }
        const subTopics = Array.isArray(focusSubTopics)
          ? focusSubTopics.filter((s) => typeof s === "string").slice(0, 5)
          : [];
        const safeCount = Math.max(1, Math.min(10, Number(count) || 5));
        const safeDifficulty = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";
        const safeSource = source === "pool" ? "pool" : "ai";

        // Sahiplik: öğrencinin teacherId == teacherId mi?
        const stuSnap = await db.collection("users").doc(studentId).get();
        if (!stuSnap.exists) return res.status(404).json({ error: "Öğrenci bulunamadı." });
        const stu = stuSnap.data() || {};
        if (stu.teacherId !== teacherId) {
          return res.status(403).json({ error: "Bu öğrenci sizin sınıfınızda değil." });
        }
        const studentGrade = stu.grade ? String(stu.grade) : "10";

        let questionIds = [];

        if (safeSource === "pool") {
          const picked = await pickPoolQuestions(subject, studentGrade, subTopics, safeDifficulty, safeCount);
          if (picked.length === 0) {
            return res.status(404).json({ error: "Havuzda eşleşen onaylı soru bulunamadı." });
          }
          questionIds = picked.map((p) => p.id);
        } else {
          // AI source — ANALYZE_AND_DERIVE
          const apiKey = process.env.GROQ_API_KEY;
          if (!apiKey) return res.status(500).json({ error: "Sunucu yapılandırma hatası." });

          // ÖNCE öğrencinin gerçek yanlışları, sonra onaylı havuzdan tamamla
          const wrongSamples = await fetchStudentWrongSamples(studentId, subject, 5);
          const needPool = Math.max(0, 5 - wrongSamples.length);
          const poolSamples = needPool > 0 ? await fetchSamplesForDerive(subject, studentGrade, needPool) : [];
          const samples = wrongSamples.concat(poolSamples);
          const focusTopic = subTopics[0] || "genel";

          logger.info(`[generateTargetedSet] örnek: ${wrongSamples.length} yanlış + ${poolSamples.length} havuz`);

          const cfg = buildModePromptConfig({
            mode: "ANALYZE_AND_DERIVE",
            subject,
            topic: focusTopic,
            grade: studentGrade,
            count: safeCount,
            difficulty: safeDifficulty,
            sampleQuestions: samples,
          });

          const groq = new Groq({ apiKey });
          logger.info(`[generateTargetedSet] AI üretim subject=${subject} subTopic=${focusTopic} count=${safeCount}`);
          const chat = await groq.chat.completions.create({
            messages: [
              { role: "system", content: cfg.system },
              { role: "user", content: cfg.user },
            ],
            model: "llama-3.1-8b-instant",
            temperature: cfg.temperature,
            max_tokens: cfg.max_tokens,
          });
          const text = chat.choices[0]?.message?.content || "";
          const parsed = parseTaggedQuestions(text);
          if (parsed.length === 0) {
            return res.status(502).json({ error: "AI soru üretemedi, tekrar dene." });
          }

          // Üretilen soruları havuza ekle (verified:false), id'leri topla
          const batch = db.batch();
          parsed.slice(0, safeCount).forEach((q) => {
            const ref = db.collection("questions").doc();
            batch.set(ref, {
              category: subject,
              subject,
              topic: focusTopic,
              sub_topic: subTopics[0] || focusTopic,
              difficulty: safeDifficulty,
              grade: studentGrade,
              text: q.question_text,
              question_text: q.question_text,
              options: q.options,
              correctAnswer: q.correct_answer,
              correct_answer: q.correct_answer,
              explanation: q.explanation || "",
              teacherId: null,
              is_ai_generated: true,
              isAI: true,
              verified: false,
              random_seed: Math.floor(Math.random() * 1000000),
              createdAt: Date.now(),
              generatedBy: teacherId,
              generatedFor: studentId,
              source: "targeted_derive",
            });
            questionIds.push(ref.id);
          });
          await batch.commit();
        }

        if (questionIds.length === 0) {
          return res.status(500).json({ error: "Soru oluşturulamadı." });
        }

        const targetedRef = await db.collection("targeted_assignments").add({
          teacherId,
          studentId,
          subject,
          focusSubTopics: subTopics,
          questionIds,
          rationale: typeof rationale === "string" ? rationale.slice(0, 300) : "",
          source: safeSource,
          difficulty: safeDifficulty,
          status: "active",
          autoScore: 0,
          score: 0,
          answers: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info(`[generateTargetedSet] oluşturuldu id=${targetedRef.id} soru=${questionIds.length}`);
        return res.status(200).json({ success: true, id: targetedRef.id, questionIds });
      } catch (err) {
        logger.error("[generateTargetedSet] hata:", err.message || err);
        return res.status(500).json({ error: err.message || "Sunucu hatası" });
      }
    });
  },
);

/**
 * submitTargetedAssignment — öğrenci hedefli atamayı çözüp gönderir.
 * Sahiplik check: studentId == auth.uid.
 * Tekrar gönderim engeli: status zaten 'completed' ise reddet.
 */
exports.submitTargetedAssignment = onRequest(
  { maxInstances: 10, cors: true },
  (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(204).send("");
    cors(req, res, async () => {
      if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

      try {
        const userId = await resolveUserId(req);
        if (!userId) return res.status(400).json({ error: "userId gerekli." });

        const { targetedAssignmentId, answers } = req.body || {};
        if (!targetedAssignmentId) return res.status(400).json({ error: "targetedAssignmentId gerekli." });
        if (!Array.isArray(answers)) return res.status(400).json({ error: "answers dizisi gerekli." });

        const ref = db.collection("targeted_assignments").doc(targetedAssignmentId);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: "Atama bulunamadı." });
        const ta = snap.data() || {};
        if (ta.studentId !== userId) return res.status(403).json({ error: "Bu atama size ait değil." });
        if (ta.status === "completed") {
          return res.status(409).json({ error: "Bu atama zaten tamamlandı." });
        }

        const questionIds = Array.isArray(ta.questionIds) ? ta.questionIds : [];
        if (questionIds.length === 0) return res.status(400).json({ error: "Bu atamada soru yok." });

        // Cevap haritası
        const answerMap = new Map();
        answers.forEach((a) => {
          if (a && typeof a.questionId === "string" && Number.isInteger(a.selectedIndex)) {
            answerMap.set(a.questionId, a.selectedIndex);
          }
        });

        // Soru dokümanlarını paralel çek (chunk 10)
        const questionDocs = [];
        for (let i = 0; i < questionIds.length; i += 10) {
          const slice = questionIds.slice(i, i + 10);
          const refs = slice.map((qid) => db.collection("questions").doc(qid));
          const docs = await db.getAll(...refs);
          docs.forEach((d, idx) => {
            questionDocs.push({ id: slice[idx], snap: d });
          });
        }

        const processed = [];
        let correct = 0;
        questionDocs.forEach(({ id: qid, snap: qsnap }) => {
          const data = qsnap.exists ? qsnap.data() : null;
          const correctIdx = resolveCorrectIndex(data);
          const selectedIndex = answerMap.has(qid) ? answerMap.get(qid) : -1;
          const isCorrect = selectedIndex >= 0 && selectedIndex === correctIdx;
          if (isCorrect) correct++;
          processed.push({
            questionId: qid,
            selectedIndex,
            isCorrect,
            questionTextSnapshot: data
              ? String(data.text || data.question_text || data.question || "").slice(0, 500)
              : "",
          });
        });

        await ref.set(
          {
            status: "completed",
            autoScore: correct,
            score: correct,
            answers: processed,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        logger.info(`[submitTargetedAssignment] uid=${userId} ta=${targetedAssignmentId} score=${correct}/${questionIds.length}`);
        return res.status(200).json({ success: true, autoScore: correct, maxScore: questionIds.length });
      } catch (err) {
        logger.error("[submitTargetedAssignment] hata:", err.message || err);
        return res.status(500).json({ error: err.message || "Sunucu hatası" });
      }
    });
  },
);

/**
 * onTargetedAssignmentCreated — yeni hedefli atama → öğrenciye push.
 */
exports.onTargetedAssignmentCreated = onDocumentCreated(
  { document: "targeted_assignments/{id}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};
    const studentId = data.studentId;
    if (!studentId) return;

    try {
      // Öğrencinin bildirim ayarına bak
      const stuSnap = await db.collection("users").doc(studentId).get();
      const stu = stuSnap.exists ? stuSnap.data() : {};
      if (stu && stu.notificationsEnabled === false) return;

      const targets = await collectUserTokens(db, studentId);
      if (targets.length === 0) return;

      const subject = String(data.subject || "Genel");
      const count = Array.isArray(data.questionIds) ? data.questionIds.length : 0;

      await sendExpoPushMulti(
        targets,
        {
          title: "Sana özel soru seti",
          body: `${subject} dersinden ${count} soru çözmen için seçildi`,
          data: {
            type: "targeted",
            targetedAssignmentId: event.params.id,
            deepLink: `/(student)/targeted/${event.params.id}`,
          },
        },
        logger,
      );
    } catch (err) {
      logger.error("[onTargetedAssignmentCreated] hata:", err.message || err);
    }
  },
);

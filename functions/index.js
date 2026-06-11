const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const Anthropic = require("@anthropic-ai/sdk");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// ─── AI SAĞLAYICI: Anthropic Claude ──────────────────────────────────────────
// Tüm AI çağrıları Claude üzerinden gider (Groq tamamen kaldırıldı). API anahtarı
// kodda değil, Secret Manager'da ANTHROPIC_API_KEY olarak tutulur. KATMANLI model:
//   QUALITY_MODEL → soru üretimi + doğrulama + hedefli set (kalite öncelikli)
//   FAST_MODEL    → sohbet, ipucu, sınıflandırma, öğrenci adaptif quiz (hız/maliyet)
// Çağrı noktaları modeli params.model ile seçer; bilinmeyen değer FAST_MODEL'e düşer.
const QUALITY_MODEL = "claude-sonnet-4-6";
const FAST_MODEL = "claude-haiku-4-5";

/**
 * Anthropic istemcisini, eski Groq/OpenAI `chat.completions.create` arayüzüyle
 * uyumlu bir sarmalayıcıya bağlar — çağrı noktaları neredeyse hiç değişmeden
 * Claude'a taşınır. `messages` içindeki `system` rolü Anthropic'in üst-seviye
 * `system` alanına ayrılır; geri kalan mesajlar user/assistant olarak gider.
 * Dönüş, eski kodun beklediği Groq yanıt şekliyle aynıdır:
 *   { choices: [{ message: { role, content } }] }
 * Not: çağrı noktası `model` alanını seçer (QUALITY_MODEL / FAST_MODEL). "claude-" ile
 * başlamayan/bilinmeyen değerler güvenli varsayılan olarak FAST_MODEL'e düşer.
 */
function makeAI(apiKey) {
  const client = new Anthropic({ apiKey });
  return {
    chat: {
      completions: {
        create: async (params) => {
          const msgs = Array.isArray(params.messages) ? params.messages : [];
          const system = msgs
            .filter((m) => m && m.role === "system")
            .map((m) => (typeof m.content === "string" ? m.content : ""))
            .join("\n\n")
            .trim();
          const conv = msgs
            .filter((m) => m && m.role !== "system")
            .map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
            }));
          if (conv.length === 0) conv.push({ role: "user", content: "" });

          const model =
            typeof params.model === "string" && params.model.startsWith("claude-")
              ? params.model
              : FAST_MODEL;
          const req = {
            model,
            max_tokens: Math.max(1, Number(params.max_tokens) || 1024),
            messages: conv,
          };
          if (system) req.system = system;
          if (params.temperature != null) req.temperature = params.temperature;

          const resp = await client.messages.create(req);
          const text = Array.isArray(resp.content)
            ? resp.content.filter((b) => b && b.type === "text").map((b) => b.text).join("")
            : "";
          return { choices: [{ message: { role: "assistant", content: text } }] };
        },
      },
    },
  };
}

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

// ─── İKİNCİ AI DOĞRULAMA GEÇİŞİ (verifyGeneratedQuestions) ────────────────────
// Üretilen soruları bağımsız bir geçişle yeniden çözüp hatalı/belirsiz/zayıf olanları
// eler ve qualityScore (1-5) ekler. QUALITY tier (öğretmen/havuz) düşük hacimli
// olduğundan kaliteyi korumak için AÇIK; doğrulama QUALITY_MODEL ile yapılır.
// Kapatmak (hız + maliyet) için false yap.
const ENABLE_AI_VERIFY = true;

// ─── AI ÇIKTI AYRIŞTIRICI ────────────────────────────────────────────────────
// AI'nin satır-etiketli ([SORU]/[A]..[D]/[DOGRU]/[ACIKLAMA]) çıktısını ayrıştırır.
// JSON kullanılmaz; LaTeX ters-bölüleri ($\frac, \Delta) olduğu gibi korunur.
// "Tek doğru cevap" güvencesi: yalnızca 4 FARKLI şıkkı ve geçerli tek doğru
// cevabı olan sorular döndürülür; belirsiz/eksik sorular elenir.
function parseTaggedQuestions(text) {
  const tagMap = { SORU: 'q', A: 'a', B: 'b', C: 'c', D: 'd', DOGRU: 'correct', ACIKLAMA: 'exp', KONU: 'topic', ALTKONU: 'subtopic' };
  const blocks = [];
  let cur = null;
  let lastKey = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*\[\s*(SORU|ALTKONU|KONU|A|B|C|D|DOGRU|ACIKLAMA)\b[^\]]*\]\s*(.*)$/i);
    if (m) {
      const key = tagMap[m[1].toUpperCase()];
      if (key === 'q') {
        if (cur && cur.q) blocks.push(cur);
        cur = { q: '', a: '', b: '', c: '', d: '', correct: '', exp: '', topic: '', subtopic: '' };
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
        topic: (c.topic || '').trim(),
        sub_topic: ((c.subtopic || c.topic) || '').trim(),
      };
    })
    .filter(Boolean);
}

/**
 * getAIResponse — Chatbot mesajlarını işler (Eski adıyla getGeminiResponse).
 * Model: FAST_MODEL (Claude Haiku)
 */
exports.getAIResponse = onRequest(
  { maxInstances: 10, cors: true, secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 300 },
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
        let apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          logger.error("ANTHROPIC_API_KEY bulunamadı!");
          return res.status(500).json({ error: "Sunucu yapılandırma hatası (ANTHROPIC_API_KEY eksik)." });
        }

        logger.info(`[AI] getAIResponse model=${FAST_MODEL} | key: ${apiKey.substring(0, 8)}...`);

        const groq = makeAI(apiKey);

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
          model: FAST_MODEL,
          temperature: 0.5,
          max_tokens: 4096,
        });

        const replyText = chatCompletion.choices[0]?.message?.content || "Cevap üretilemedi.";

        logger.info("[GROQ] Başarılı yanıt.");
        return res.status(200).json({ reply: replyText });

      } catch (fnError) {
        logger.error("[GROQ] Hata:", fnError.message || fnError);
        
        const debugInfo = {
          attemptedModel: FAST_MODEL,
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
  { maxInstances: 10, cors: true, secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 300 },
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

        const apiKey = process.env.ANTHROPIC_API_KEY;
        const groq = apiKey ? makeAI(apiKey) : null;

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
              model: FAST_MODEL,
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
              model: FAST_MODEL,
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
[ACIKLAMA] çözüm adımlarını gösteren kısa açıklama
[KONU] bu sorunun MEB müfredatındaki ÜST konusu (ör. Türev, Periyodik Sistem, Fonksiyonlar) — ASLA "genel" yazma, daima spesifik konu adı
[ALTKONU] daha dar alt başlık (uygun yoksa üst konuyla aynı yaz)`;

// Üretilen soruların sınav düzeyinde, hatasız ve derin olması için ortak kalite kuralları.
const QUALITY_DIRECTIVES = `KALİTE KURALLARI (ZORUNLU):
- ÖZ-DENETİM (EN ÖNEMLİSİ): Her soruyu YAZMADAN ÖNCE zihninde adım adım çöz ve işaretleyeceğin doğru şıkkı DOĞRULA. Emin olamadığın, birden fazla doğru cevabı olabilecek, çeldiricileri zayıf veya kökü belirsiz bir soruyu YAZMA — onun yerine daha sağlam, eksiksiz yeni bir soru kur. Çıktıda YALNIZCA bu denetimden geçen, hatasız soruları ver. İstenen sayıda SAĞLAM soru üretene kadar zayıfları kendi içinde ayıkla.
- Sınav düzeyi: YKS (TYT/AYT) ayarında, akademik ve net bir dil kullan.
- EZBER veya salt TANIM sorusu ÜRETME. Bilgiyi UYGULAMA, ANALİZ veya çok adımlı MUHAKEME gerektiren sorular sor.
- Her sorunun TEK ve tartışmasız doğru cevabı olsun; soru kökü belirsiz/eksik olmasın.
- Her ÇELDİRİCİ (yanlış şık) öğrencinin yapabileceği BELİRLİ bir yaygın hatayı temsil etsin — rastgele veya absürt şık koyma.
- "Yukarıdakilerin hepsi/hiçbiri" gibi tembel şıklardan kaçın.
- Sayısal sorularda işlemi adım adım KENDİN yap ve doğru şıkkı sonucuna göre işaretle; tutarsız sayı/birim verme.
- Yalnızca verilen konuyla ilgili, müfredat seviyesine uygun sorular üret.`;

const DIFFICULTY_RUBRIC = `ZORLUK TANIMI (istenen zorluğa harfiyen uy):
- easy: tek bir kavramın doğrudan uygulanması.
- medium: bir kavramın çok adımlı uygulanması veya küçük bir çıkarım.
- hard: EN AZ İKİ kavramı birleştiren, çok adımlı, dikkatli muhakeme gerektiren soru.`;

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
      user: `Aşağıdaki örnek soruları analiz et:\n\n${samplesBlock || "(örnek yok — kendi yüksek standardını uygula)"}\n\nŞimdi ${gradeStr}. sınıf ${subjStr} dersi, "${topicStr}" konusunda, ${diffStr} zorlukta ${count} adet YENİ ve özgün çoktan seçmeli soru üret. Matematik/fizik formüllerini LaTeX olarak $...$ arasında yaz.\n\n${QUALITY_DIRECTIVES}\n\n${DIFFICULTY_RUBRIC}\n\n${OUTPUT_CONTRACT}`,
      temperature: 0.5,
      max_tokens: 2500,
    };
  }

  if (mode === "CREATIVE_FREE") {
    return {
      system: `Sen LearnUp asistanısın. ${gradeStr}. sınıf ${subjStr} bilgisi temelli, ÖZGÜN ve YARATICI çoktan seçmeli sorular üret. Güncel bağlamlar, disiplinlerarası bağlantılar, gerçek hayat örnekleri ve hikâye-tabanlı kurgular kullan. Format 4 şıklı MCQ kalır, müfredat dışına saparsan bile öğretici olsun.`,
      user: `${gradeStr}. sınıf ${subjStr} dersi, "${topicStr}" konusunda, ${diffStr} zorlukta ${count} adet özgün ve yaratıcı çoktan seçmeli soru üret. Matematik/fizik formüllerini LaTeX olarak $...$ arasında yaz.\n\n${QUALITY_DIRECTIVES}\n\n${DIFFICULTY_RUBRIC}\n\n${OUTPUT_CONTRACT}`,
      temperature: 0.85,
      max_tokens: 2500,
    };
  }

  // STRICT_CURRICULUM (default)
  return {
    system: `Sen LearnUp asistanısın. MEB ${gradeStr}. sınıf ${subjStr} müfredatı sınırları DIŞINA ÇIKMA. YKS hedef düzeyinde, kazanım uyumlu sorular üret. İstenen çıktı formatına harfiyen uy.`,
    user: `Lise ${gradeStr}. sınıf müfredatına uygun, TÜRKÇE, ${subjStr} dersi, "${topicStr}" konusuna ait, ${diffStr} zorlukta ${count} adet çoktan seçmeli soru üret.\nHer sorunun 4 şıkkı (A, B, C, D) olmalı; şıklar birbirinden FARKLI olmalı ve sorunun YALNIZCA TEK bir doğru cevabı bulunmalı.\nMatematik/fizik formüllerini LaTeX olarak $...$ arasında yaz (örn: $f(x) = 3x^2$, $\\frac{d}{dx}$).\n\n${QUALITY_DIRECTIVES}\n\n${DIFFICULTY_RUBRIC}\n\n${OUTPUT_CONTRACT}`,
    temperature: 0.3,
    // 10 zor soru 2048 token'a sığmıyordu → yanıt kesilip ayrıştırma boş dönüyor
    // ve "Soru üretilemedi" 502'sine yol açıyordu. Bütçe artırıldı.
    max_tokens: 3500,
  };
}

/**
 * verifyGeneratedQuestions — Üretilen soruları İKİNCİ bir AI geçişiyle bağımsız
 * doğrular. Her soruyu modele yeniden çözdürür; işaretli cevapla uyuşmayan,
 * belirsiz, hatalı veya düşük kaliteli soruları ELER. Geçenlere qualityScore (1-5)
 * ekler. Tek batch çağrı (maliyet/gecikme dengesi). Çağrı hata verirse fail-open
 * (sorular ham haliyle geçer) — üretim hiç bozulmasın.
 *
 * @param {Groq} groq
 * @param {Array} questions  [{question_text, options[4], correct_answer, explanation}]
 * @param {{subject:string, grade:string}} ctx
 * @returns {Promise<Array>} kabul edilen sorular (+ qualityScore)
 */
async function verifyGeneratedQuestions(groq, questions, ctx) {
  // Bayrak kapalıysa ikinci AI geçişini atla — sorular ham haliyle döner.
  if (!ENABLE_AI_VERIFY) return questions;
  if (!groq || !Array.isArray(questions) || questions.length === 0) return questions;
  const letters = ["A", "B", "C", "D"];

  const block = questions.map((q, i) => {
    const opts = (q.options || [])
      .map((o, j) => `[${letters[j]}] ${o}`)
      .join("\n");
    return `[SORU ${i + 1}]\n${q.question_text}\n${opts}`;
  }).join("\n\n");

  const system =
    "Sen titiz bir sınav editörüsün. Her soruyu BAĞIMSIZ olarak adım adım çöz; " +
    "soru kökündeki iddialara güvenme, doğru cevabı kendin bul. Ardından soruyu değerlendir.";
  const user =
    `${ctx.grade || "10"}. sınıf ${ctx.subject || "Genel"} dersi sorularını değerlendir.\n\n` +
    `${block}\n\n` +
    `Her soru için TEK satır, AYNEN şu formatta ver (başka hiçbir metin yazma):\n` +
    `[D <numara>] dogru=<A/B/C/D> | tek=<evet/hayir> | hata=<yok/var> | kalite=<1-5>\n\n` +
    `Anlamlar — dogru: senin bağımsız çözümünle bulduğun doğru şık. ` +
    `tek: sorunun tek doğru cevabı var mı. hata: soruda/şıklarda mantık/işlem/ifade hatası var mı. ` +
    `kalite: 1=çok zayıf/ezber, 5=sınav düzeyinde, derin ve hatasız.`;

  let text = "";
  try {
    const r = await groq.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      model: QUALITY_MODEL,
      temperature: 0,
      max_tokens: 1500,
    });
    text = r.choices[0]?.message?.content || "";
  } catch (e) {
    logger.warn(`[verify] doğrulama çağrısı başarısız, fail-open: ${e.message || e}`);
    return questions;
  }

  const verdicts = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(
      /\[\s*D\s*(\d+)\s*\][^]*?dogru\s*=\s*([A-Da-d])[^]*?tek\s*=\s*(evet|hayir)[^]*?hata\s*=\s*(yok|var)[^]*?kalite\s*=\s*([1-5])/i,
    );
    if (m) {
      verdicts[Number(m[1])] = {
        dogru: m[2].toUpperCase(),
        tek: m[3].toLowerCase(),
        hata: m[4].toLowerCase(),
        kalite: Number(m[5]),
      };
    }
  }

  const kept = [];
  questions.forEach((q, i) => {
    const v = verdicts[i + 1];
    // Verdict parse edilemediyse → nötr puanla geçir (fail-open, üretimi engelleme)
    if (!v) {
      kept.push({ ...q, qualityScore: 3 });
      return;
    }
    const markedLetter = letters[(q.options || []).indexOf(q.correct_answer)];
    const passes =
      v.dogru === markedLetter && v.tek === "evet" && v.hata === "yok" && v.kalite >= 3;
    if (passes) kept.push({ ...q, qualityScore: v.kalite });
    // aksi halde ELE
  });

  logger.info(`[verify] ${questions.length} sorudan ${kept.length} tanesi doğrulamayı geçti.`);
  return kept;
}

/**
 * generateQuestions — 3-modlu AI soru üretici.
 *   mode: 'ANALYZE_AND_DERIVE' | 'STRICT_CURRICULUM' (default) | 'CREATIVE_FREE'
 * Stateless: Firestore'a yazmaz; üretilen sorular client tarafından saveAIQuestions
 * ile havuza yazılır (verified:false) veya öğretmen panelinde onaylanır.
 * Model: QUALITY_MODEL (quality=true) / FAST_MODEL (öğrenci adaptif quiz)
 */
exports.generateQuestions = onRequest(
  { maxInstances: 10, cors: true, secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 300 },
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

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          logger.error("ANTHROPIC_API_KEY bulunamadı!");
          return res.status(500).json({ error: "Sunucu yapılandırma hatası (ANTHROPIC_API_KEY eksik)." });
        }

        const qCount = Math.min(10, Math.max(1, Number(count) || 5));
        const groq = makeAI(apiKey);

        // KATMANLI ÜRETİM:
        //  quality=true  → öğretmen/havuz (düşük hacim): Sonnet + verifier + top-up.
        //  quality yok   → öğrenci adaptif quiz (yüksek hacim): Haiku, tek geçiş, doğrulama YOK.
        // Böylece pahalı stack yalnız havuza yazılıp tekrar kullanılan sorularda çalışır;
        // öğrenci canlı quiz'leri token/maliyet yakmaz.
        const quality = !!(req.body && req.body.quality === true);
        const genModel = quality ? QUALITY_MODEL : FAST_MODEL;

        logger.info(`[AI] generateQuestions mode=${resolvedMode} tier=${quality ? "QUALITY/Sonnet" : "FAST/Haiku"} model=${genModel} subject=${subject} topic=${topic || "(genel)"} grade=${grade || "10"} hedef=${qCount}`);

        // Tek tur: batchN soru üret + parse (kesik/biçimsiz çıktıya karşı 2 deneme).
        const generateBatch = async (batchN) => {
          const cfg = buildModePromptConfig({
            mode: resolvedMode, subject, topic, grade, count: batchN, difficulty, sampleQuestions,
          });
          let parsed = [];
          let lastText = "";
          for (let attempt = 0; attempt < 2; attempt++) {
            const chat = await groq.chat.completions.create({
              messages: [
                { role: "system", content: cfg.system },
                { role: "user", content: cfg.user },
              ],
              model: genModel,
              temperature: cfg.temperature,
              max_tokens: cfg.max_tokens,
            });
            lastText = chat.choices[0]?.message?.content || "";
            parsed = parseTaggedQuestions(lastText);
            if (parsed.length > 0) break;
            logger.warn(`[GROQ] ayrıştırma boş (deneme ${attempt + 1}/2)`);
          }
          return parsed;
        };

        // FAST tier (öğrenci adaptif quiz): tek geçiş, verifier/top-up YOK — token tasarrufu.
        if (!quality) {
          const batch = await generateBatch(qCount);
          if (batch.length === 0) {
            logger.error("generateQuestions (fast): ayrıştırma boş döndü.");
            return res.status(502).json({ error: "Soru üretilemedi. Lütfen tekrar deneyin." });
          }
          logger.info(`[GROQ] FAST: ${batch.length} soru döndürüldü (8b, doğrulama yok).`);
          return res.status(200).json({ success: true, mode: resolvedMode, questions: batch.slice(0, qCount) });
        }

        // QUALITY tier — TOP-UP DÖNGÜSÜ: Verifier zayıf/hatalı soruları elediği için tek tur
        // hedefin altında kalabilir. Hedef sayıya ulaşana kadar (en fazla 3 tur) eksik kadar
        // yeni tur üretilip doğrulanır; tekrarlar (aynı soru metni) elenir. Böylece
        // öğretmen tam istediği sayıda VE doğrulamadan geçmiş soru alır.
        const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
        const accepted = [];
        const seen = new Set();
        const MAX_ROUNDS = 3;
        let totalGenerated = 0;
        let lastRawBatch = [];

        for (let round = 0; round < MAX_ROUNDS && accepted.length < qCount; round++) {
          const need = qCount - accepted.length;
          const batchN = Math.min(10, need + 2); // küçük tampon (eleme payı)
          const batch = await generateBatch(batchN);
          totalGenerated += batch.length;
          if (batch.length === 0) continue;
          lastRawBatch = batch;

          const verifiedBatch = await verifyGeneratedQuestions(groq, batch, { subject, grade });
          for (const q of verifiedBatch) {
            const key = norm(q.question_text);
            if (key && !seen.has(key)) {
              seen.add(key);
              accepted.push(q);
              if (accepted.length >= qCount) break;
            }
          }
          logger.info(`[GROQ] tur ${round + 1}: ${batch.length} üretildi, ${verifiedBatch.length} geçti, kabul ${accepted.length}/${qCount}`);
        }

        // Hiç doğrulanmış soru yoksa: ham üretim varsa fail-open (502 yerine), yoksa 502.
        if (accepted.length === 0) {
          if (lastRawBatch.length > 0) {
            logger.warn("[GROQ] doğrulama hepsini eledi — fail-open ham sorular döndürülüyor.");
            return res.status(200).json({ success: true, mode: resolvedMode, questions: lastRawBatch.slice(0, qCount) });
          }
          logger.error("generateQuestions: hiç soru üretilemedi/doğrulanamadı.");
          return res.status(502).json({ error: "Soru üretilemedi. Lütfen tekrar deneyin." });
        }
        if (accepted.length < qCount) {
          logger.warn(`[GROQ] hedef ${qCount}, ${MAX_ROUNDS} turda ${accepted.length} sağlanabildi.`);
        }

        const finalQuestions = accepted.slice(0, qCount);
        logger.info(`[GROQ] toplam ${totalGenerated} üretildi, ${finalQuestions.length}/${qCount} doğrulanmış döndürüldü (mode=${resolvedMode}).`);
        return res.status(200).json({ success: true, mode: resolvedMode, questions: finalQuestions });

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
        // Etiket fallback — ASLA "genel"/boş yazma: AI soru-başına konu > istek konusu > ders adı.
        const isBlankTopic = (t) => !t || !String(t).trim() || String(t).trim().toLowerCase() === "genel";
        const reqTopic = isBlankTopic(topic) ? "" : String(topic).trim();
        const reqSubTopic = isBlankTopic(sub_topic) ? "" : String(sub_topic).trim();

        const batch = db.batch();
        const savedIds = [];

        for (const q of questions) {
          if (!q || typeof q.question_text !== "string") continue;
          if (!Array.isArray(q.options) || q.options.length !== 4) continue;
          const opts = q.options.map((o) => String(o));
          if (new Set(opts).size !== 4) continue;

          // correct_answer'ı esnek çöz: tam şık metni | harf (A-D) | index (0-3) | "1"-"4".
          // Farklı client'lar (web/mobil) farklı format gönderebildiği için tolerans.
          let correctOpt = null;
          const ca = q.correct_answer;
          if (typeof ca === "string") {
            const t = ca.trim();
            if (opts.includes(t)) correctOpt = t;
            else if (/^[A-Da-d]$/.test(t)) correctOpt = opts[t.toUpperCase().charCodeAt(0) - 65] ?? null;
            else if (/^[1-4]$/.test(t)) correctOpt = opts[Number(t) - 1] ?? null;
            else {
              const ix = opts.findIndex((o) => o.trim() === t);
              if (ix >= 0) correctOpt = opts[ix];
            }
          } else if (typeof ca === "number" && Number.isInteger(ca) && ca >= 0 && ca < 4) {
            correctOpt = opts[ca];
          }
          if (correctOpt == null) continue;

          // Konu: AI soru-başına > istek konusu > ders. ("genel"/boş asla.)
          const qTopic = !isBlankTopic(q.topic) ? String(q.topic).trim() : (reqTopic || subject);
          const qSubTopic = !isBlankTopic(q.sub_topic) ? String(q.sub_topic).trim() : (reqSubTopic || qTopic);

          const ref = db.collection("questions").doc();
          const doc = {
            category: subject,
            subject: subject,
            topic: qTopic,
            sub_topic: qSubTopic,
            difficulty: diffStr,
            grade: gradeStr,
            text: q.question_text,
            question_text: q.question_text,
            options: opts,
            correctAnswer: correctOpt,
            correct_answer: correctOpt,
            explanation: typeof q.explanation === "string" ? q.explanation : "",
            teacherId: null,
            is_ai_generated: true,
            isAI: true,
            verified: false,
            random_seed: Math.floor(Math.random() * 1000000),
            createdAt: Date.now(),
            generatedBy: resolvedUserId,
            // Verifier'ın atadığı kalite puanı (1-5). Few-shot "altın set" seçimi ve
            // düşük kaliteyi eleme için kullanılır. Client iletmezse null kalır.
            qualityScore: typeof q.qualityScore === "number" ? q.qualityScore : null,
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
// SORU HAVUZU — KONU ETİKETLEME (AI Topic Classifier)
// Var olan tüm soruları MEB müfredatı terimleriyle topic + sub_topic etiketler.
// Sadece eksik / "genel" / boş topic'lere dokunur; manuel etiketleri korur.
// ════════════════════════════════════════════════════════════════════════════

const CLASSIFIER_SYSTEM_PROMPT = `Sen Türkiye MEB lise müfredatı uzmanısın.
Sana verilen çoktan seçmeli soruyu inceleyip iki seviyeli konu sınıflandırması üreteceksin.

Kullanacağın kanonik konu havuzu (örnekler — sadece yönlendirme amaçlı, gerektiğinde benzer kanonik terim üret):
- Matematik: Fonksiyonlar, Polinomlar, Türev, İntegral, Limit ve Süreklilik, Trigonometri, Logaritma, Üstel Fonksiyonlar, Permütasyon ve Kombinasyon, Olasılık, Karmaşık Sayılar, Diziler, Analitik Geometri, Vektörler, Matrisler
- Geometri: Üçgenler, Çokgenler, Dörtgenler, Çember ve Daire, Katı Cisimler, Dönüşümler, Vektörler
- Fizik: Hareket, Kuvvet ve Hareket, Enerji, İş ve Güç, Basınç, Kaldırma Kuvveti, Isı ve Sıcaklık, Elektrik, Manyetizma, Optik, Dalgalar, Atom Fiziği, Modern Fizik, İndüksiyon
- Kimya: Atomun Yapısı, Periyodik Sistem, Kimyasal Türler Arası Etkileşimler, Kimyasal Hesaplamalar, Asit ve Bazlar, Çözeltiler, Kimyasal Denge, Kimyasal Tepkimelerde Enerji, Tepkime Hızı, Karbon Kimyası, Organik Kimya, Elektrokimya
- Biyoloji: Canlıların Ortak Özellikleri, Hücre, Hücre Bölünmeleri, Üreme, Kalıtım, Genetik, Sistemler, Sinir Sistemi, Endokrin Sistem, Sindirim, Dolaşım, Solunum, Boşaltım, Ekoloji, Bitki Biyolojisi
- Edebiyat: Şiir, Roman, Hikaye, Tiyatro, Anlatım Bozuklukları, Söz Sanatları, Anlatım Türleri, Edebi Akımlar, Halk Edebiyatı, Divan Edebiyatı, Cumhuriyet Dönemi Edebiyatı, Servet-i Fünun, Tanzimat
- Türk Dili ve Edebiyatı: aynı kategoriler (Edebiyat ile birleşik düşün)
- Tarih: İlk Türk Devletleri, İslam Tarihi, Selçuklular, Osmanlı Devleti, Kuruluş, Yükselme, Duraklama, Gerileme, Yenileşme Dönemi, Kurtuluş Savaşı, Cumhuriyet Dönemi, Atatürk İlke ve İnkılapları, Soğuk Savaş
- Coğrafya: Doğal Sistemler, Beşeri Sistemler, Mekansal Sentez Türkiye, Küresel Ortam, Çevre ve Toplum, İklim, Yer Şekilleri, Nüfus, Yerleşme, Ekonomik Faaliyetler
- Felsefe: Felsefenin Doğuşu, Bilgi Felsefesi, Bilim Felsefesi, Varlık Felsefesi, Etik, Siyaset Felsefesi, Din Felsefesi, Sanat Felsefesi, Mantık
- Din Kültürü: İnanç, İbadet, Ahlak, Hz. Muhammed'in Hayatı, İslam Düşüncesi, Kuran ve Yorumu, İslam ve Bilim

KURALLAR:
1. SADECE belirtilen formatta cevap ver, başka hiçbir şey yazma — açıklama, prefix, suffix yok.
2. KONU 1-3 kelime, ALT_KONU 1-4 kelime olsun.
3. Türkçe büyük harfle başlayan terimler kullan (örn. "Türev" değil "türev").
4. Yukarıdaki listeyi bağlayıcı değil, rehber gör — soru farklı bir kanonik konuya aitse onu kullan.
5. Bilemediğin durumlarda Ders adını KONU olarak yaz, ALT_KONU "Genel" yaz.`;

function parseClassification(raw) {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/KONU\s*:\s*(.+?)\s*[\r\n]+\s*ALT[_ ]?KONU\s*:\s*(.+?)\s*$/im);
  if (!m) return null;
  const topic = m[1].trim().replace(/[*"]/g, '').slice(0, 60);
  const subTopic = m[2].trim().replace(/[*"]/g, '').slice(0, 80);
  if (!topic || !subTopic) return null;
  return { topic, sub_topic: subTopic };
}

// Etiketsiz = topic alanı YOK (undefined) / boş ('') / 'genel'. Kritik: Firestore'da
// `where('topic','==','')` alanı HİÇ olmayan dokümanları yakalamaz; havuzdaki etiketsiz
// soruların çoğunda topic alanı hiç yazılmamış. Bu yüzden koleksiyonu documentId sırasıyla
// sayfalayıp bellekte süzeriz (havuz küçük, öğretmen-only seyrek işlem).
function isUntaggedTopic(t) {
  const s = String(t ?? '').trim().toLowerCase();
  return !s || s === 'genel';
}

async function fetchUntaggedBatch(limit) {
  const col = db.collection('questions');
  const PAGE = 300;
  const out = [];
  let last = null;
  for (let page = 0; page < 30 && out.length < limit; page++) {
    let q = col.orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      if (isUntaggedTopic(d.data().topic)) {
        out.push(d);
        if (out.length >= limit) break;
      }
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }
  return out;
}

// Tüm havuzdaki etiketsiz soru sayısı (topic alanı olmayanlar dahil). Yalnız `topic`
// alanını çekerek (.select) ucuz sayar.
async function countUntagged() {
  const col = db.collection('questions');
  const PAGE = 500;
  let count = 0;
  let last = null;
  for (let page = 0; page < 50; page++) {
    let q = col.orderBy(admin.firestore.FieldPath.documentId()).select('topic').limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    snap.docs.forEach((d) => {
      if (isUntaggedTopic(d.data().topic)) count++;
    });
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }
  return count;
}

async function classifyOne(groq, docData) {
  const text = String(docData.question_text || docData.text || docData.question || '').slice(0, 600);
  const options = Array.isArray(docData.options) ? docData.options : [];
  const correct = String(docData.correct_answer || docData.correctAnswer || '').slice(0, 200);
  const subject = String(docData.subject || docData.category || 'Genel').slice(0, 40);
  const grade = String(docData.grade || '10').slice(0, 3);

  const userPrompt = `Ders: ${subject}
Sınıf: ${grade}
Soru: ${text}
${options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('  ')}
Doğru cevap: ${correct}

Cevap formatı (kesin):
KONU: <ana konu — 1-3 kelime>
ALT_KONU: <daha dar alt başlık — 1-4 kelime>`;

  const completion = await groq.chat.completions.create({
    model: FAST_MODEL,
    temperature: 0.2,
    max_tokens: 80,
    messages: [
      { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });
  const raw = completion?.choices?.[0]?.message?.content || '';
  return parseClassification(raw);
}

exports.classifyQuestions = onRequest(
  { maxInstances: 5, cors: true, secrets: ['ANTHROPIC_API_KEY'], timeoutSeconds: 300 },
  (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).send('');

    cors(req, res, async () => {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
      try {
        // Bearer auth
        const authHeader = (req.get('Authorization') || req.get('authorization') || '').toString();
        if (!authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Bearer token gerekli.' });
        }
        let uid;
        try {
          const decoded = await admin.auth().verifyIdToken(authHeader.split(' ')[1]);
          uid = decoded.uid;
        } catch (_e) {
          return res.status(401).json({ error: 'Geçersiz token.' });
        }

        // Role check
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'teacher') {
          return res.status(403).json({ error: 'Sadece öğretmenler erişebilir.' });
        }

        // Rate limit
        if (isRateLimited(uid)) {
          return res.status(429).json({ error: 'Çok hızlı istek.', retryAfterMs: RATE_LIMIT_MS });
        }

        const BATCH_SIZE = 30;
        const mode = (req.body && req.body.mode) || 'preview';

        // ── COUNT: havuzdaki gerçek etiketsiz soru sayısı (topic alanı olmayanlar dahil) ──
        if (mode === 'count') {
          const untagged = await countUntagged();
          return res.status(200).json({ untagged });
        }

        // ── APPLY: öğretmenin onayladığı (ve gerekirse düzenlediği) etiketleri yaz ──
        if (mode === 'apply') {
          const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
          if (items.length === 0) {
            return res.status(400).json({ error: 'Uygulanacak etiket yok.' });
          }
          if (items.length > 60) {
            return res.status(400).json({ error: 'Tek seferde en fazla 60 etiket uygulanabilir.' });
          }
          const batch = db.batch();
          let applied = 0;
          for (const it of items) {
            const id = it && typeof it.id === 'string' ? it.id : null;
            const topic = String((it && it.topic) || '').trim().slice(0, 60);
            const sub_topic = String((it && it.sub_topic) || '').trim().slice(0, 80);
            if (!id || !topic || !sub_topic) continue;
            batch.update(db.collection('questions').doc(id), {
              topic,
              sub_topic,
              taggedAt: admin.firestore.FieldValue.serverTimestamp(),
              taggedBy: 'teacher-approved',
            });
            applied++;
          }
          if (applied > 0) await batch.commit();
          const remainingEstimate = await countUntagged();
          logger.info(`[classifyQuestions:apply] ${applied} etiket yazıldı, kalan=${remainingEstimate}`);
          return res.status(200).json({ applied, remainingEstimate, done: remainingEstimate === 0 });
        }

        // ── PREVIEW: sınıflandır ama YAZMA — öğretmen onayına öneri olarak gönder ──
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY tanımlı değil.' });
        const groq = makeAI(apiKey);

        const docs = await fetchUntaggedBatch(BATCH_SIZE);
        if (docs.length === 0) {
          return res.status(200).json({ proposals: [], processed: 0, failed: 0, done: true });
        }

        const results = await Promise.allSettled(
          docs.map(async (d) => {
            const data = d.data();
            const tags = await classifyOne(groq, data);
            return { id: d.id, data, tags };
          }),
        );

        const proposals = [];
        let failed = 0;
        for (const r of results) {
          if (r.status !== 'fulfilled' || !r.value.tags) {
            failed++;
            continue;
          }
          const { id, data, tags } = r.value;
          proposals.push({
            id,
            question: String(data.question_text || data.text || data.question || '').slice(0, 220),
            subject: String(data.subject || data.category || 'Genel').slice(0, 40),
            grade: String(data.grade || '').slice(0, 3),
            topic: tags.topic,
            sub_topic: tags.sub_topic,
          });
        }

        logger.info(`[classifyQuestions:preview] ${proposals.length} öneri, ${failed} başarısız`);
        return res.status(200).json({
          proposals,
          processed: docs.length,
          failed,
          done: false,
        });
      } catch (err) {
        logger.error('[classifyQuestions] Hata:', err.message || err);
        return res.status(500).json({ error: err.message || 'Sunucu hatası.' });
      }
    });
  },
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
    coins: 0,
    totalSolved: 0,
    correctAnswers: 0,
    subjects: {},
    streak: { count: 0, longest: 0, lastActiveDate: null, freezesAvailable: 0, freezeUsedDates: [] },
    league: { tier: "bronze", weekId: null, weeklyXP: 0 },
    dailyQuests: { date: null, quests: [] },
    unlockedSeeds: [],
    garden: {
      rows: 4, cols: 4, // legacy — yeni client kullanmıyor
      rainDayWeek: Math.floor(Math.random() * 7),
      cottage: { x: 60, y: 110, variant: "classic" },
    },
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
  // Garden defaults — eski hesapları geriye uyumlu yap
  if (typeof g.coins !== "number") g.coins = 0;
  // XP'den altın backfill — tek seferlik, idempotent.
  // Doğru cevap XP=10, altın=5 → coins ≈ xp/2. Eski oyuncular için bir kerelik telafi.
  if (!g.coinsBackfilledFromXp) {
    const fromXp = Math.floor((g.xp || 0) / 2);
    if (fromXp > 0 && g.coins < fromXp) g.coins = fromXp;
    g.coinsBackfilledFromXp = true;
  }
  if (!Array.isArray(g.unlockedSeeds)) g.unlockedSeeds = [];
  if (!g.garden || typeof g.garden !== "object") {
    g.garden = { rows: 4, cols: 4, rainDayWeek: Math.floor(Math.random() * 7) };
  } else {
    if (typeof g.garden.rows !== "number") g.garden.rows = 4;
    if (typeof g.garden.cols !== "number") g.garden.cols = 4;
    if (typeof g.garden.rainDayWeek !== "number") g.garden.rainDayWeek = Math.floor(Math.random() * 7);
    if (!g.garden.cottage || typeof g.garden.cottage !== "object") {
      g.garden.cottage = { x: 60, y: 110, variant: "classic" };
    } else {
      if (typeof g.garden.cottage.x !== "number") g.garden.cottage.x = 60;
      if (typeof g.garden.cottage.y !== "number") g.garden.cottage.y = 110;
      if (typeof g.garden.cottage.variant !== "string") g.garden.cottage.variant = "classic";
    }
  }
  return g;
}

// Altın hesabı — XP'nin yarısı + ilk doğru bonus + streak bonusu
function coinsForAnswer({ isCorrect, isFirstCorrectOfDay, streakDays }) {
  if (!isCorrect) return 1; // teselli
  let c = 5;
  if (isFirstCorrectOfDay) c += 10;
  if ((streakDays || 0) >= 7) c += 2;
  return c;
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

    // Altın — günün ilk doğru cevabı tespiti (streak.lastActiveDate today değilse first)
    const isFirstCorrectOfDay =
      isCorrect === true &&
      g.streak &&
      g.streak.lastActiveDate !== today;
    const coinsGained = isSkipped
      ? 0
      : coinsForAnswer({
          isCorrect: isCorrect === true,
          isFirstCorrectOfDay,
          streakDays: (g.streak && g.streak.count) || 0,
        });
    g.coins = (g.coins || 0) + coinsGained;

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
    const prevLevel = levelFromCorrect((userData.gamification && userData.gamification.correctAnswers) || 0);
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

    // Seviye + rozet altın bonusları (orman ekonomisi için)
    if (level > prevLevel) {
      g.coins += 50 * (level - prevLevel);
    }
    if (newBadges.length > 0) {
      g.coins += 20 * newBadges.length;
      // Rozet → özel tohum unlock'u (badges.js'teki unlockBadge eşleşmesi)
      // bloom_80 → golden_lotus, phoenix → anka_seed gibi (frontend marketCatalog'tan filtrelenir)
      newBadges.forEach((bId) => {
        if (!g.unlockedSeeds.includes(bId)) g.unlockedSeeds.push(bId);
      });
    }

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

    // ─── Duolingo-tarzı in-app bildirimler: badge_earned + level_up ───
    // Push gönderilmez (sayfada hemen görünür — modal/lottie zaten oynar);
    // panelde geçmiş kaydı kalsın diye Firestore'a yazılır.
    if (isStudent(userData)) {
      try {
        for (const badgeId of newBadges) {
          await writeNotification(db, userId, {
            type: "badge_earned",
            title: "Yeni rozet kazandın 🏆",
            body: `"${badgeId}" rozetini açtın — profilinden görüntüleyebilirsin.`,
            icon: "Award",
            tone: "success",
            deepLink: "/(student)/badges",
            data: { type: "badge_earned", badgeId },
          });
        }
        if (level > prevLevel) {
          await writeNotification(db, userId, {
            type: "level_up",
            title: `Seviye ${level} oldun 🚀`,
            body: "Tebrikler — bir seviye atladın. Devam et!",
            icon: "TrendingUp",
            tone: "success",
            deepLink: "/(student)/profile",
            data: { type: "level_up", level, prevLevel },
          });
        }
      } catch (notifErr) {
        logger.warn(`[recordAnswer] notify yazımı atlandı: ${notifErr.message || notifErr}`);
      }
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

    const { TIER_META: TIER_META_ROLL } = require("./lib/league");
    const tierChanges = []; // { uid, oldTier, newTier }
    const batch = db.batch();
    Object.keys(byTier).forEach((tier) => {
      const results = resolveTierWeek(byTier[tier], tier);
      results.forEach((r) => {
        const member = byTier[tier].find((e) => e.uid === r.uid);
        if (r.newTier && r.newTier !== tier) {
          tierChanges.push({ uid: r.uid, oldTier: tier, newTier: r.newTier });
        }
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

    // Tier değişen kullanıcılar için bildirim — terfi yukarı / düşüş.
    const TIER_ORDER = ["bronze", "silver", "gold", "sapphire", "ruby", "emerald", "diamond"];
    for (const change of tierChanges) {
      const newMeta = TIER_META_ROLL[change.newTier] || TIER_META_ROLL.bronze;
      const promoted =
        TIER_ORDER.indexOf(change.newTier) > TIER_ORDER.indexOf(change.oldTier);
      const title = promoted
        ? `Terfi! ${newMeta.label} ${newMeta.emoji}`
        : `Bu hafta ${newMeta.label} ${newMeta.emoji}`;
      const body = promoted
        ? `Geçen hafta yaptıkların ${newMeta.label} ligine taşıdı seni — bu seviyede de zirveye git!`
        : `Yeni hafta ${newMeta.label} liginde başlıyor. Geri dönüş için XP topla.`;
      try {
        await writeNotification(db, change.uid, {
          type: "league_tier_change",
          title,
          body,
          icon: "Trophy",
          tone: promoted ? "success" : "warning",
          deepLink: "/(student)/league",
          data: {
            type: "league_tier_change",
            oldTier: change.oldTier,
            newTier: change.newTier,
            promoted,
            deepLink: "/(student)/league",
          },
        });
      } catch (e) {
        logger.warn(`rolloverLeague tier-change notify atlandı uid=${change.uid}: ${e.message || e}`);
      }
    }

    logger.info(
      `rolloverLeague: ${lastWeek} → ${currentWeek} tamamlandı (${snap.size} kayıt, ${tierChanges.length} tier change).`,
    );
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
      const title = "Serin tehlikede 🔥";
      const body = `${streak.count} günlük serin sönmek üzere. Bugün 1 soru çöz, alev sürsün.`;
      const deepLink = "/(student)";
      await writeNotification(db, uid, {
        type: "streak_risk",
        title,
        body,
        icon: "Flame",
        tone: "danger",
        deepLink,
        data: { kind: "streak_risk", deepLink },
      });
      if (data.notificationsEnabled !== false) {
        await sendExpoPush(uid, {
          title,
          body,
          data: { deepLink, kind: "streak_risk", type: "streak_risk" },
        });
      }
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
      const title = "Görevlerin seni bekliyor ✨";
      const body = `Bugün ${incomplete.length} görev tamamlanmadı. Ödülleri kaçırma!`;
      const deepLink = "/(student)/daily-quests";
      await writeNotification(db, uid, {
        type: "daily_quest_reminder",
        title,
        body,
        icon: "Target",
        tone: "warning",
        deepLink,
        data: { kind: "daily_quest_reminder", deepLink },
      });
      if (data.notificationsEnabled !== false) {
        await sendExpoPush(uid, {
          title,
          body,
          data: { deepLink, kind: "daily_quest_reminder", type: "daily_quest_reminder" },
        });
      }
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
        const title = `Yeni hafta · ${meta.label} ${meta.emoji}`;
        const body = "Bu haftanın lig sıralaması başladı. XP topla, zirveye çık!";
        const deepLink = "/(student)/league";
        await writeNotification(db, e.uid, {
          type: "league_rollover",
          title,
          body,
          icon: "Trophy",
          tone: "accent",
          deepLink,
          data: { kind: "league_rollover", tier: e.tier, deepLink },
        });
        const userSnap = await db.collection("users").doc(e.uid).get();
        if (userSnap.exists && userSnap.data().notificationsEnabled !== false) {
          await sendExpoPush(e.uid, {
            title,
            body,
            data: { deepLink, kind: "league_rollover", type: "league_rollover" },
          });
        }
        pushed += 1;
      } catch (err) {
        logger.warn(`pushLeagueRollover hata (uid=${e.uid}): ${err.message || err}`);
      }
    }
    logger.info(`pushLeagueRollover: ${pushed} kullanıcıya bildirim gönderildi.`);
  }
);

/**
 * pushSRSDueReminder — Her gün 17:00 (Istanbul) çalışır. SRS'te tekrar zamanı
 * gelmiş (nextReviewAt <= now) ≥3 kartı olan öğrencilere hatırlatma yazar
 * (Firestore + push). srs_cards collectionGroup kullanır.
 */
exports.pushSRSDueReminder = onSchedule(
  { schedule: "0 17 * * *", timeZone: "Europe/Istanbul" },
  async () => {
    const nowTs = admin.firestore.Timestamp.now();
    let snap;
    try {
      snap = await db
        .collectionGroup("srs_cards")
        .where("nextReviewAt", "<=", nowTs)
        .limit(5000)
        .get();
    } catch (err) {
      logger.warn(`pushSRSDueReminder query fail: ${err.message || err}`);
      return;
    }
    if (snap.empty) {
      logger.info("pushSRSDueReminder: tekrar zamanı gelen kart yok");
      return;
    }
    // uid -> due card count
    const dueByUid = new Map();
    snap.forEach((d) => {
      // path: users/{uid}/srs_cards/{cardId}
      const parts = d.ref.path.split("/");
      const uidIdx = parts.indexOf("users") + 1;
      const uid = parts[uidIdx];
      if (!uid) return;
      dueByUid.set(uid, (dueByUid.get(uid) || 0) + 1);
    });

    let pushed = 0;
    for (const [uid, n] of dueByUid.entries()) {
      if (n < 3) continue;
      try {
        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) continue;
        const user = userSnap.data() || {};
        if (!isStudent(user)) continue;
        const title = "Yanlışların seni bekliyor 📚";
        const body = `${n} kartın tekrar zamanı geldi. Birkaç dakika ayır, hafızanı taze tut.`;
        const deepLink = "/(student)/learn";
        await writeNotification(db, uid, {
          type: "srs_due",
          title,
          body,
          icon: "BookOpen",
          tone: "warning",
          deepLink,
          data: { type: "srs_due", count: n, deepLink },
        });
        if (user.notificationsEnabled !== false) {
          await sendExpoPush(uid, {
            title,
            body,
            data: { deepLink, kind: "srs_due", type: "srs_due", count: n },
          });
        }
        pushed += 1;
      } catch (err) {
        logger.warn(`pushSRSDueReminder uid=${uid} hata: ${err.message || err}`);
      }
    }
    logger.info(`pushSRSDueReminder: ${pushed} öğrenciye gönderildi.`);
  }
);

/**
 * pushSRSMasteryWeekly — Her cuma 19:00 (Istanbul) çalışır. Son haftada
 * box=4'e ulaşan kart sayısı eşiği geçen öğrencilere "X yeni konuyu ustalaştın"
 * milestone bildirimi yazar.
 */
exports.pushSRSMasteryWeekly = onSchedule(
  { schedule: "0 19 * * 5", timeZone: "Europe/Istanbul" },
  async () => {
    const weekAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let snap;
    try {
      snap = await db
        .collectionGroup("srs_cards")
        .where("box", "==", 4)
        .where("lastReviewedAt", ">=", weekAgo)
        .limit(5000)
        .get();
    } catch (err) {
      logger.warn(`pushSRSMasteryWeekly query fail: ${err.message || err}`);
      return;
    }
    if (snap.empty) {
      logger.info("pushSRSMasteryWeekly: bu hafta box=4 ulaşan kart yok");
      return;
    }
    const masteredByUid = new Map();
    snap.forEach((d) => {
      const parts = d.ref.path.split("/");
      const uidIdx = parts.indexOf("users") + 1;
      const uid = parts[uidIdx];
      if (!uid) return;
      masteredByUid.set(uid, (masteredByUid.get(uid) || 0) + 1);
    });
    let pushed = 0;
    for (const [uid, n] of masteredByUid.entries()) {
      if (n < 5) continue;
      try {
        const userSnap = await db.collection("users").doc(uid).get();
        if (!userSnap.exists) continue;
        const user = userSnap.data() || {};
        if (!isStudent(user)) continue;
        const title = `${n} konuyu ustalaştın 🌟`;
        const body = "Bu hafta uzun süredir takıldığın kartları geçtin — devam et!";
        const deepLink = "/(student)/progress";
        await writeNotification(db, uid, {
          type: "srs_mastery",
          title,
          body,
          icon: "Sparkles",
          tone: "success",
          deepLink,
          data: { type: "srs_mastery", count: n, deepLink },
        });
        if (user.notificationsEnabled !== false) {
          await sendExpoPush(uid, {
            title,
            body,
            data: { deepLink, kind: "srs_mastery", type: "srs_mastery", count: n },
          });
        }
        pushed += 1;
      } catch (err) {
        logger.warn(`pushSRSMasteryWeekly uid=${uid} hata: ${err.message || err}`);
      }
    }
    logger.info(`pushSRSMasteryWeekly: ${pushed} öğrenciye gönderildi.`);
  }
);

/**
 * onSubmissionReviewed — Öğretmen submission'a feedback verince (status:
 * submitted → reviewed) öğrenciye bildirim atar. Hem in-app history hem push.
 */
const { onDocumentUpdated: onDocUpdatedReviewed } = require("firebase-functions/v2/firestore");
exports.onSubmissionReviewed = onDocUpdatedReviewed(
  { document: "assignment_submissions/{submissionId}" },
  async (event) => {
    const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
    const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
    if (!before || !after) return;
    if (before.status === "reviewed") return; // zaten daha önce reviewed
    if (after.status !== "reviewed") return; // bu trigger geçişi yakalar

    const studentId = after.studentId;
    if (!studentId) return;

    try {
      let assignmentTitle = "ödev";
      try {
        const aSnap = await db.collection("assignments").doc(after.assignmentId).get();
        if (aSnap.exists) {
          const a = aSnap.data() || {};
          if (a.title) assignmentTitle = String(a.title).slice(0, 80);
        }
      } catch (_) { /* ignore */ }

      const title = "Öğretmenden geri bildirim 📝";
      const body = `"${assignmentTitle}" ödevin incelendi — sonucunu gör.`;
      const deepLink = `/(student)/assignments/${after.assignmentId}`;
      const pushData = {
        type: "assignment_feedback",
        assignmentId: after.assignmentId,
        submissionId: event.params.submissionId,
        deepLink,
      };

      await writeNotification(db, studentId, {
        type: "assignment_feedback",
        title,
        body,
        icon: "MessageCircle",
        tone: "accent",
        deepLink,
        data: pushData,
      });

      const userSnap = await db.collection("users").doc(studentId).get();
      if (userSnap.exists && userSnap.data().notificationsEnabled === false) {
        return; // push opt-out; history yazıldı
      }
      const targets = await collectUserTokens(db, studentId);
      if (targets.length === 0) return;
      await sendExpoPushMulti(targets, { title, body, data: pushData }, logger);
    } catch (err) {
      logger.error("[onSubmissionReviewed] hata:", err.message || err);
    }
  },
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
// Her gönderim aynı anda users/{uid}/notifications koleksiyonuna da yazılır
// (in-app bildirim merkezi kalıcı geçmişi).
// ════════════════════════════════════════════════════════════════════════════
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const {
  sendExpoPush: sendExpoPushMulti,
  collectStudentTokensForTeacher,
  collectUserTokens,
} = require("./lib/expoPush");
const {
  writeNotification,
  writeNotificationMulti,
  getClassStudentUids,
} = require("./lib/notifications");

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
      const studentUids = await getClassStudentUids(db, teacherId);
      const title = "Yeni Ödev";
      const body = (data.title && String(data.title).slice(0, 120)) || "Bir ödev paylaşıldı";
      const deepLink = `/(student)/assignments/${event.params.assignmentId}`;
      const pushData = { type: "assignment", assignmentId: event.params.assignmentId, deepLink };

      // In-app history — push opt-out olanlar dahil tüm sınıf öğrencileri
      await writeNotificationMulti(db, studentUids, {
        type: "assignment",
        title,
        body,
        icon: "ClipboardList",
        tone: "accent",
        deepLink,
        data: pushData,
      });

      const targets = await collectStudentTokensForTeacher(db, teacherId);
      if (targets.length === 0) {
        logger.info(`[onAssignmentCreated] no push targets for teacher=${teacherId}`);
        return;
      }
      await sendExpoPushMulti(
        targets,
        { title, body, data: pushData },
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
      const studentUids = await getClassStudentUids(db, teacherId);
      const title = (data.title && String(data.title).slice(0, 80)) || "Yeni Duyuru";
      const body = (data.content && String(data.content).slice(0, 140)) || "Öğretmenin yeni bir duyurusu var";
      const deepLink = "/(student)";
      const pushData = {
        type: "announcement",
        announcementId: event.params.announcementId,
        deepLink,
      };

      await writeNotificationMulti(db, studentUids, {
        type: "announcement",
        title,
        body,
        icon: "Megaphone",
        tone: "accent",
        deepLink,
        data: pushData,
      });

      const targets = await collectStudentTokensForTeacher(db, teacherId);
      if (targets.length === 0) {
        logger.info(`[onAnnouncementCreated] no push targets for teacher=${teacherId}`);
        return;
      }
      await sendExpoPushMulti(
        targets,
        { title, body, data: pushData },
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
        const studentUids = await getClassStudentUids(db, teacherId);
        const dueMs = data.dueDate && data.dueDate.toMillis ? data.dueDate.toMillis() : 0;
        const hoursLeft = Math.max(1, Math.round((dueMs - now) / (60 * 60 * 1000)));
        const title = "Ödev Hatırlatma";
        const body = `${(data.title || "Ödev").slice(0, 80)} — ${hoursLeft} saat içinde teslim`;
        const deepLink = `/(student)/assignments/${doc.id}`;
        const pushData = { type: "assignment_due", assignmentId: doc.id, deepLink };

        await writeNotificationMulti(db, studentUids, {
          type: "assignment_due",
          title,
          body,
          icon: "AlertTriangle",
          tone: "warning",
          deepLink,
          data: pushData,
        });

        const targets = await collectStudentTokensForTeacher(db, teacherId);
        if (targets.length > 0) {
          await sendExpoPushMulti(targets, { title, body, data: pushData }, logger);
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

      const title = "Yeni Ödev Teslimi";
      const body = `${studentName} "${assignmentTitle}" ödevini teslim etti`;
      const deepLink = `/(teacher)/assignments/${data.assignmentId}/submissions`;
      const pushData = {
        type: "submission_received",
        assignmentId: data.assignmentId,
        submissionId: event.params.submissionId,
        deepLink,
      };

      await writeNotification(db, teacherId, {
        type: "submission_received",
        title,
        body,
        icon: "Inbox",
        tone: "accent",
        deepLink,
        data: pushData,
      });

      await sendExpoPushMulti(
        targets,
        { title, body, data: pushData },
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
        const title = "LearnUp Test";
        const body = "Bildirimlerin çalışıyor — burdan haberin olacak.";
        const deepLink = "/(student)";
        await writeNotification(db, userId, {
          type: "test",
          title,
          body,
          icon: "Bell",
          tone: "accent",
          deepLink,
          data: { type: "test", deepLink },
        });
        const result = await sendExpoPushMulti(
          targets,
          { title, body, data: { type: "test", deepLink } },
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
  { maxInstances: 10, cors: true, secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 300 },
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
          const apiKey = process.env.ANTHROPIC_API_KEY;
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

          const groq = makeAI(apiKey);
          logger.info(`[generateTargetedSet] AI üretim subject=${subject} subTopic=${focusTopic} count=${safeCount}`);
          const chat = await groq.chat.completions.create({
            messages: [
              { role: "system", content: cfg.system },
              { role: "user", content: cfg.user },
            ],
            model: QUALITY_MODEL,
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

// ════════════════════════════════════════════════════════════════════════════
// ORMAN OYUNU — Bahçe ekonomisi & lifecycle
// ════════════════════════════════════════════════════════════════════════════

const GARDEN_CATALOG = (() => {
  const SEED_PRICE = { common: 20, uncommon: 50, rare: 120, epic: 300, legendary: 800 };
  const MATURE_MULT = 5;
  const DAY = 24 * 60 * 60;
  // Client `treeAssets.ts` + `marketCatalog.ts` ile birebir aynı 8 ağaç.
  const PLANTS = [
    { type: "sogut",      rarity: "common",    grow: 8 * DAY },
    { type: "akca_agac",  rarity: "common",    grow: 7 * DAY },
    { type: "mavi_cam",   rarity: "uncommon",  grow: 9 * DAY },
    { type: "egri_agac",  rarity: "uncommon",  grow: 9 * DAY },
    { type: "dev_agac",   rarity: "rare",      grow: 11 * DAY },
    { type: "burgu",      rarity: "rare",      grow: 10 * DAY },
    { type: "isik_agaci", rarity: "epic",      grow: 12 * DAY, unlockBadge: "bloom_80" },
    { type: "parilti",    rarity: "legendary", grow: 14 * DAY, unlockBadge: "phoenix" },
  ];
  const map = {};
  PLANTS.forEach((p) => {
    map[`${p.type}_seed`] = {
      id: `${p.type}_seed`, kind: "seed", form: "seed", plantType: p.type,
      price: SEED_PRICE[p.rarity], growSec: p.grow,
      unlockBadge: p.unlockBadge || null, eternal: false,
    };
    map[`${p.type}_mature`] = {
      id: `${p.type}_mature`, kind: "tree",
      form: "mature", plantType: p.type,
      price: SEED_PRICE[p.rarity] * MATURE_MULT, growSec: 0,
      unlockBadge: p.unlockBadge || null, eternal: false,
    };
  });
  // Su item'ları kaldırıldı (mekanik yok).

  // Eski emoji dekor (geriye dönük destek için korunur)
  const legacyDecorPrices = {
    decor_fence: 15, decor_stone: 25, decor_lantern: 60,
    decor_bench: 80, decor_birdhouse: 100, decor_mushroom: 40,
  };
  Object.keys(legacyDecorPrices).forEach((d) => {
    map[d] = { id: d, kind: "decor", price: legacyDecorPrices[d], eternal: true };
  });

  // Yeni PNG dekor (mantarlar, totemler, gazebo) — `assets/garden/trees/`
  const pngDecorPrices = {
    decor_mushroom_red_lg: 150, decor_mushroom_red_md: 90, decor_mushroom_red_sm: 30,
    decor_mushroom_chanterelle_lg: 50, decor_mushroom_chanterelle_md: 35, decor_mushroom_chanterelle_sm: 20,
    decor_mushroom_beige: 25,
    decor_idol_deer: 100, decor_idol_human: 100, decor_idol_wolf: 100, decor_idol_dragon: 180,
    decor_gazebo_v1: 200, decor_gazebo_v2: 320,
  };
  Object.keys(pngDecorPrices).forEach((d) => {
    map[d] = { id: d, kind: "decor", price: pngDecorPrices[d], eternal: true };
  });

  // Özel item'lar — sadece kalıcı dekor karakterler (Ent'ler) kaldı.
  // Yağmur tılsımı ve Süper Gübre kaldırıldı (su mekaniği yok).
  map.special_ent_male         = { id: "special_ent_male",         kind: "special", price: 500, eternal: true };
  map.special_ent_female       = { id: "special_ent_female",       kind: "special", price: 500, eternal: true };
  return map;
})();

exports.purchaseGardenItem = onRequest(
  { maxInstances: 10, cors: true },
  gameHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId gerekli." });
    const { itemId } = req.body || {};
    const item = GARDEN_CATALOG[itemId];
    if (!item) return res.status(400).json({ error: "Geçersiz item." });

    const userRef = db.collection("users").doc(userId);
    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const data = userSnap.exists ? userSnap.data() : {};
      const g = data.gamification || {};
      const coins = g.coins || 0;
      if (coins < item.price) throw new Error("Yetersiz altın");

      if (item.unlockBadge) {
        const owned = data.unlockedBadges && data.unlockedBadges[item.unlockBadge];
        if (!owned) throw new Error("Bu tohum için rozet kazanman gerekli");
      }

      const invRef = userRef.collection("inventory").doc(itemId);
      const invSnap = await tx.get(invRef);
      const currentCount = invSnap.exists ? (invSnap.data().count || 0) : 0;
      const addCount = item.count || 1;
      const newCount = currentCount + addCount;

      tx.update(userRef, { "gamification.coins": coins - item.price });
      tx.set(invRef, {
        itemId,
        kind: item.kind,
        count: newCount,
        acquiredAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { coins: coins - item.price, newCount };
    });

    res.json({ success: true, itemId, ...result });
  }),
);

exports.plantSeed = onRequest(
  { maxInstances: 10, cors: true },
  gameHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId gerekli." });
    const { itemId, x, y } = req.body || {};
    const item = GARDEN_CATALOG[itemId];
    if (!item) return res.status(400).json({ error: "Geçersiz item." });
    if (typeof x !== "number" || typeof y !== "number") {
      return res.status(400).json({ error: "x/y koordinat gerekli." });
    }

    const userRef = db.collection("users").doc(userId);
    const invRef = userRef.collection("inventory").doc(itemId);
    const plantId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const plantRef = userRef.collection("garden").doc(plantId);

    await db.runTransaction(async (tx) => {
      const invSnap = await tx.get(invRef);
      if (!invSnap.exists || (invSnap.data().count || 0) < 1) {
        throw new Error("Envanterde bu item yok");
      }
      const newCount = (invSnap.data().count || 0) - 1;
      const isMature = item.form === "mature" || item.eternal;
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(plantRef, {
        plantId, itemId, x, y,
        stage: isMature ? "mature" : "seed",
        plantedAt: now, lastWateredAt: now, status: "healthy",
      });
      if (newCount === 0) tx.delete(invRef);
      else tx.update(invRef, { count: newCount });
    });

    res.json({ success: true, plantId });
  }),
);

// Plant boyut sınırları — frontend'deki clampScale ile aynı tutulmalı.
const PLANT_SCALE_MIN = 0.6;
const PLANT_SCALE_MAX = 1.8;

exports.movePlant = onRequest(
  { maxInstances: 10, cors: true },
  gameHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId gerekli." });
    const { plantId, x, y, scale } = req.body || {};
    if (!plantId) return res.status(400).json({ error: "plantId gerekli." });
    if (typeof x !== "number" || typeof y !== "number") {
      return res.status(400).json({ error: "x/y koordinat gerekli." });
    }

    const plantRef = db
      .collection("users").doc(userId)
      .collection("garden").doc(plantId);
    const snap = await plantRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Bitki bulunamadı." });

    const update = { x, y };
    // Scale opsiyonel — verilirse clamp edilip yazılır, verilmezse mevcut korunur.
    if (typeof scale === "number" && Number.isFinite(scale)) {
      update.scale = Math.max(PLANT_SCALE_MIN, Math.min(PLANT_SCALE_MAX, scale));
    }
    await plantRef.update(update);
    res.json({ success: true });
  }),
);

exports.moveCottage = onRequest(
  { maxInstances: 10, cors: true },
  gameHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId gerekli." });
    const { x, y } = req.body || {};
    if (typeof x !== "number" || typeof y !== "number") {
      return res.status(400).json({ error: "x/y koordinat gerekli." });
    }

    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      "gamification.garden.cottage.x": x,
      "gamification.garden.cottage.y": y,
    });
    res.json({ success: true });
  }),
);

// waterPlant ve revivePlant cloud function'ları kaldırıldı (su mekaniği yok).
// Eski sürüm istemcilerden gelirse 410 Gone ile düşer; mevcut istemci artık
// çağırmıyor.

exports.expandGarden = onRequest(
  { maxInstances: 10, cors: true },
  gameHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId gerekli." });
    const { dim } = req.body || {};
    if (dim !== "rows" && dim !== "cols") {
      return res.status(400).json({ error: "dim 'rows' veya 'cols' olmalı" });
    }

    const userRef = db.collection("users").doc(userId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const g = (snap.data() && snap.data().gamification) || {};
      const garden = g.garden || { rows: 4, cols: 4 };
      const current = garden[dim] || 4;
      if (current >= 8) throw new Error("Maksimum boyuta ulaşıldı");
      const cost = 100 * Math.pow(2, current - 4);
      if ((g.coins || 0) < cost) throw new Error("Yetersiz altın");

      tx.update(userRef, {
        "gamification.coins": (g.coins || 0) - cost,
        [`gamification.garden.${dim}`]: current + 1,
      });
      return {
        coins: (g.coins || 0) - cost,
        rows: dim === "rows" ? current + 1 : garden.rows,
        cols: dim === "cols" ? current + 1 : garden.cols,
      };
    });

    res.json({ success: true, ...result });
  }),
);

exports.removePlant = onRequest(
  { maxInstances: 10, cors: true },
  gameHandler(async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(400).json({ error: "userId gerekli." });
    const { plantId } = req.body || {};
    if (!plantId) return res.status(400).json({ error: "plantId gerekli." });

    const userRef = db.collection("users").doc(userId);
    const plantRef = userRef.collection("garden").doc(plantId);

    // Yeni davranış: altın refund yok; bunun yerine bitkinin item'ı **aynen**
    // envantere geri eklenir. Eski katalog dışı (legacy) item'lar silinir ama
    // envantere eklenmez (sessiz no-op).
    const out = await db.runTransaction(async (tx) => {
      const pSnap = await tx.get(plantRef);
      if (!pSnap.exists) throw new Error("Bitki bulunamadı");
      const itemId = pSnap.data().itemId;
      const item = GARDEN_CATALOG[itemId];
      if (!item) {
        // Legacy item — sadece sil
        tx.delete(plantRef);
        return { returnedItemId: null, newCount: 0 };
      }
      const invRef = userRef.collection("inventory").doc(itemId);
      const invSnap = await tx.get(invRef);
      const current = invSnap.exists ? (invSnap.data().count || 0) : 0;
      const newCount = current + 1;
      tx.set(invRef, {
        itemId,
        kind: item.kind,
        count: newCount,
        acquiredAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.delete(plantRef);
      return { returnedItemId: itemId, newCount };
    });

    res.json({ success: true, ...out });
  }),
);

// dailyGardenCheck cron'u kaldırıldı (su mekaniği yok). Tüm bitkiler kalıcı
// dekor olduğu için günlük solma/ölme/yağmur işlemi gerekmez.


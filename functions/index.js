const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ─── SABİT MODEL (v1 API) - hafif / daha ekonomik tercih
const ACTIVE_MODEL = "gemini-2.0-flash";

// ─── MODEL ADAYLARI VE MODEL SEÇİCİ YARDIMCI FONKSİYONU ──────────────────────
const MODEL_CANDIDATES = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"];

async function tryModels(genAI, models, apiCallFn) {
  let lastError = null;
  for (const modelName of models) {
    try {
      logger.info(`[GEMINI] Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await apiCallFn(model);
      if (result) {
        return result;
      }
    } catch (err) {
      logger.warn(`Failed call with model ${modelName}: ${err.message || err}`);
      lastError = err;
    }
  }
  throw lastError || new Error("All models failed to generate content.");
}

// ─── RATE LIMIT: Kullanıcı başına 2 saniyelik bekleme ────────────────────────
// Aynı userId/IP 2 saniyeden önce tekrar gelirse API'ye hiç dokunmadan engelle.
const lastCallMap = new Map();
const RATE_LIMIT_MS = 2000;

function isRateLimited(key) {
  const now = Date.now();
  const last = lastCallMap.get(key) || 0;
  if (now - last < RATE_LIMIT_MS) return true; // Çok erken
  lastCallMap.set(key, now);
  return false;
}
/**
 * getGeminiResponse — Chatbot mesajlarını işler.
 * Retry YOK: hata alınırsa anında kullanıcıya bilgi döner.
 * Model: gemini-2.0-flash
 */
exports.getGeminiResponse = onRequest(
  { maxInstances: 10, cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
      const { history, userMessage } = req.body;

      if (!userMessage) {
        return res.status(400).json({ error: "userMessage eksik." });
      }
      // the external Gemini API by passing `overrideApiKey: 'mock'` in body.
      if (req.body && req.body.overrideApiKey === 'mock') {
        logger.info('[GEMINI] mock override detected — returning canned response');
        return res.status(200).json({ reply: 'Mocked response (overrideApiKey=mock)', debug: { attemptedModel: ACTIVE_MODEL } });
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
      let apiKey = process.env.GEMINI_API_KEY;
      if (req.body && req.body.overrideApiKey) {
        apiKey = req.body.overrideApiKey;
        logger.warn("API key override (sadece local test).");
      }
      if (!apiKey) {
        logger.error("GEMINI_API_KEY bulunamadı!");
        return res.status(500).json({ error: "Sunucu yapılandırma hatası." });
      }

      logger.info(`[GEMINI] ${ACTIVE_MODEL} | key: ${apiKey.substring(0, 8)}...`);

      // GoogleGenerativeAI SDK — Varsayılan ayarlarla başlat (SDK otomatik en uygun API sürümünü seçer)
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: ACTIVE_MODEL });

      const trimmedHistory = (history && Array.isArray(history))
        ? history.slice(-4)  // Son 4 mesaj — token tasarrufu
        : [];

      // TEK DENEME — retry yok, döngü yok
      const chat = model.startChat({
        history: trimmedHistory,
        generationConfig: {
          maxOutputTokens: 1000, // Cevapların yarıda kesilmesini önler
          temperature: 0.2,
        },
      });

      const result = await chat.sendMessage(userMessage);
      const responseText = result.response.text();

      logger.info("[GEMINI] Başarılı yanıt.");
      return res.status(200).json({ reply: responseText });

    } catch (fnError) {
      logger.error("[GEMINI] Hata:", fnError.message || fnError);
      
      const debugInfo = {
        attemptedModel: ACTIVE_MODEL,
        errorMessage: fnError.message || null,
        errorStatus: fnError.status || fnError.code || null,
      };

      // Hata detayını F12 console'da görmek için HTTP 500 dönüyoruz
      return res.status(500).json({ 
        error: fnError.message || "Sunucu hatası.", 
        debug: debugInfo 
      });
    }
  }
);


exports.submitAnswer = onRequest(
  { maxInstances: 10, cors: true },
  async (req, res) => {
      if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

      let topic = null;
      let userId = null;
      let stats = undefined;

      try {
        const { topic: reqTopic, isCorrect, solvedQuestionIds = [] } = req.body;
        topic = reqTopic;

        // Prefer a verified Firebase ID token when available to prevent
        // clients from spoofing `userId` in the request body. Look for an
        // `Authorization: Bearer <idToken>` header and verify it. If
        // verification succeeds, use the decoded uid; otherwise fall back
        // to `req.body.userId` for emulator/local testing.
        // userId is declared outside try block
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
          logger.warn(`Using userId from request body (no valid token): ${userId}`);
        }

        if (!userId || !topic) {
          return res.status(400).json({ error: "Eksik parametre: userId ve topic gerekli (veya Authorization Bearer <idToken> ile doğrulanmış kullanıcı)." });
        }

        const statsRef = db.collection('users').doc(userId).collection('learningStats').doc('main');
        const statsDoc = await statsRef.get();
        
        stats = { currentLevel: 2, correctStreak: 0, wrongStreak: 0 };
        
        if (statsDoc.exists) {
          stats = statsDoc.data();
        }

        // Load user profile (to keep topicMastery) and learning stats
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.exists ? userDoc.data() : {};

        // Remember prior streak for XP bonus logic
        const priorCorrectStreak = stats.correctStreak || 0;

        // Update streak and level as before
        if (isCorrect !== null && isCorrect !== undefined) {
          if (isCorrect) {
            stats.correctStreak += 1;
            stats.wrongStreak = 0;
            if (stats.correctStreak >= 3) {
              stats.currentLevel = Math.min(3, stats.currentLevel + 1);
              stats.correctStreak = 0;
            }
          } else {
            stats.wrongStreak += 1;
            stats.correctStreak = 0;
            if (stats.wrongStreak >= 2) {
              stats.currentLevel = Math.max(1, stats.currentLevel - 1);
              stats.wrongStreak = 0;
            }
          }
          // Save updated streak/level
          await statsRef.set(stats, { merge: true });
        }

        // --- Mastery Score (topicMastery) handling ---
        const topicMasteryMap = (userData && userData.topicMastery) ? userData.topicMastery : {};
        const priorMastery = typeof topicMasteryMap[topic] === 'number' ? topicMasteryMap[topic] : 0;
        let newMastery = priorMastery;
        // masteryChanged tracked for future analytics expansion
        let levelUp = false;

        // Only modify mastery when an answer was submitted (isCorrect not null)
        if (isCorrect !== null && isCorrect !== undefined) {
          let xpDelta = 0;
          if (isCorrect) {
            xpDelta = 10;
            // If user already had a streak (3+ prior corrects), give additional bonus
            if (priorCorrectStreak >= 3) xpDelta += 15;
          } else {
            xpDelta = -5;
          }

          newMastery = Math.max(0, Math.min(100, priorMastery + xpDelta));
          // newMastery !== priorMastery indicates mastery changed

          // Determine if user leveled up (crossed a threshold)
          const band = (v) => (v <= 30 ? 1 : (v <= 70 ? 2 : 3));
          const priorBand = band(priorMastery);
          const newBand = band(newMastery);
          if (newBand > priorBand) levelUp = true;

          // Persist updated mastery map
          const updatedTopicMastery = { ...(topicMasteryMap || {}), [topic]: newMastery };
          await userRef.set({ topicMastery: updatedTopicMastery }, { merge: true });
        }

        // Use mastery-derived difficulty for selecting/generating next question (prefer newMastery)
        const masteryToDifficultyString = (v) => (v <= 30 ? 'easy' : (v <= 70 ? 'medium' : 'hard'));
        const masteryToDifficultyNum = (v) => (v <= 30 ? 1 : (v <= 70 ? 2 : 3));
        const effectiveMastery = (typeof newMastery === 'number') ? newMastery : (typeof topicMasteryMap[topic] === 'number' ? topicMasteryMap[topic] : 0);
        const difficultyString = masteryToDifficultyString(effectiveMastery);
        const difficultyNum = masteryToDifficultyNum(effectiveMastery);

        // New question selection: prefer pool question matching category & difficulty derived from mastery (limiting to first 10)
        const questionsSnapshot = await db.collection('questions')
          .where('category', '==', topic)
          .where('difficulty', '==', difficultyString)
          .limit(10)
          .get();

        let newQuestion = null;
        if (!questionsSnapshot.empty) {
          const questionsList = questionsSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(q => !solvedQuestionIds.includes(q.id));
          if (questionsList.length > 0) {
            newQuestion = questionsList[Math.floor(Math.random() * questionsList.length)];
            logger.info(`Sınıflandırılmış soru havuzundan çözülmemiş soru seçildi: ${newQuestion.id}`);
          }
        }

        if (!newQuestion) {
          // Eğer zorluk derecesine göre bulunamadıysa, aynı kategorideki HERHANGİ bir çözülmemiş soruyu getir (ilk 10 dökümandan)
          const fallbackSnapshot = await db.collection('questions')
            .where('category', '==', topic)
            .limit(10)
            .get();
          if (!fallbackSnapshot.empty) {
            const questionsList = fallbackSnapshot.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(q => !solvedQuestionIds.includes(q.id));
            if (questionsList.length > 0) {
              newQuestion = questionsList[Math.floor(Math.random() * questionsList.length)];
              logger.info(`Kategori bazlı genel havuzdan soru seçildi: ${newQuestion.id}`);
            }
          }
        }

        if (!newQuestion) {
          // Development/testing helper: allow mocking generation via request flag
          if (req.body && req.body.mockGenerate) {
            const mockText = `Mock soru: ${topic} - zorluk ${difficultyNum}`;
            const mockDoc = {
              text: mockText,
              options: ["A şıkkı", "B şıkkı", "C şıkkı", "D şıkkı"],
              correctAnswer: "A şıkkı",
              difficulty: difficultyString,
              category: topic,
              grade: (userData && userData.grade) || '10',
              isAI: true,
              isVerified: false,
              createdAt: Date.now(),
            };
            const savedDoc = await db.collection('questions').add(mockDoc);
            newQuestion = { id: savedDoc.id, ...mockDoc };
            logger.info(`Mock generated question saved. ID: ${savedDoc.id}`);
          } else {
            // Generate with Gemini using the mastery-derived numeric difficulty
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              return res.status(500).json({ error: "Gemini API Anahtarı eksik, soru üretilemedi." });
            }

            const genAI = new GoogleGenerativeAI(apiKey);

            const getTurkishTopicName = (enTopic) => {
              switch(enTopic) {
                case 'Mathematics': return 'Matematik';
                case 'Physics': return 'Fizik';
                case 'Chemistry': return 'Kimya';
                case 'Biology': return 'Biyoloji';
                case 'Turkish Language and Literature': return 'Edebiyat';
                case 'Geography': return 'Coğrafya';
                case 'Religion and Ethics': return 'Din Kültürü';
                case 'Philosophy': return 'Felsefe';
                default: return enTopic;
              }
            };
            const trTopic = getTurkishTopicName(topic);

            // Shorter prompt to reduce token usage; require compact JSON only.
            const prompt = `Öğrenci elindeki soruları bitirdi, şimdi sen bu derse uygun, TÜRKÇE ve lise müfredatına göre yeni bir soru üret: ${trTopic} (Zorluk Seviyesi: ${difficultyNum}, 1=kolay, 2=orta, 3=zor).
            
MUTLAKA ama MUTLAKA sadece şu JSON formatında cevap ver, başka hiçbir metin ekleme:
{
  "questionText": "Soru metni buraya gelecek...",
  "options": ["A seçeneği", "B seçeneği", "C seçeneği", "D seçeneği"],
  "correctAnswerIndex": 0,
  "subject": "${trTopic}"
}`;

            // Model ordering: prefer lightweight model unless caller requests heavy models (boss flag)
            const modelCandidatesForCall = (req.body && req.body.boss) ? ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"] : MODEL_CANDIDATES;

            try {
              const result = await tryModels(genAI, modelCandidatesForCall, (model) => model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 512, temperature: 0.2, responseMimeType: "application/json" }
              }), { retries: 3, baseDelay: 2000 });

              if (!result || !result.response) {
                throw new Error("Gemini returned empty response.");
              }
              const generatedText = result.response.text();
              let generatedQuestion = {};
              let isValidJSON = false;
              try {
                generatedQuestion = JSON.parse(generatedText);
                if (generatedQuestion.questionText && Array.isArray(generatedQuestion.options) && typeof generatedQuestion.correctAnswerIndex === 'number') {
                  isValidJSON = true;
                }
              } catch (_parseErr) {
                logger.warn('Generated content was not valid JSON');
              }

              if (!isValidJSON) {
                throw new Error("Invalid JSON format from Gemini");
              }

              // Normalize and persist generated question with metadata
              const docToSave = {
                text: generatedQuestion.questionText,
                options: generatedQuestion.options,
                correctAnswer: generatedQuestion.options[generatedQuestion.correctAnswerIndex] || null,
                difficulty: difficultyString,
                category: topic,
                grade: (userData && userData.grade) || '10',
                isAI: true,
                isVerified: false,
                createdAt: Date.now(),
              };

              const savedDoc = await db.collection('questions').add(docToSave);
              newQuestion = { id: savedDoc.id, ...docToSave };
              logger.info(`Yeni soru üretildi ve havuza eklendi. ID: ${savedDoc.id}`);

            } catch (genErr) {
              // Generation failed after retries — try a hard fallback: pick an existing DB question
              logger.error('Generation failed, attempting DB hard-fallback:', genErr.message || genErr);
              try {
                // 1) Try same category, any difficulty, prefer unsolved
                let fallbackSnap = await db.collection('questions')
                  .where('category', '==', topic)
                  .orderBy('createdAt', 'desc')
                  .limit(50)
                  .get();

                let candidates = [];
                if (!fallbackSnap.empty) {
                  candidates = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(q => !solvedQuestionIds.includes(q.id));
                  if (candidates.length === 0) candidates = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                }

                // 2) If still empty, pick any question in DB
                if (!candidates || candidates.length === 0) {
                  const anySnap = await db.collection('questions').limit(100).get();
                  if (!anySnap.empty) {
                    candidates = anySnap.docs.map(d => ({ id: d.id, ...d.data() }));
                  }
                }

                if (candidates && candidates.length > 0) {
                  newQuestion = candidates[Math.floor(Math.random() * candidates.length)];
                  // mark that this is a DB fallback
                  newQuestion._fallbackFrom = 'db';
                  logger.info('Hard-fallback: using existing DB question id=', newQuestion.id);
                } else {
                  logger.warn('Hard-fallback failed: no questions in DB to return');
                }

              } catch (fallbackErr) {
                logger.error('Error during DB hard-fallback attempt:', fallbackErr);
              }
            }
          }
        }

        return res.status(200).json({ 
          success: true,
          stats, 
          nextQuestion: newQuestion,
          mastery: {
            topic,
            value: (typeof newMastery === 'number') ? newMastery : (topicMasteryMap[topic] || 0),
            levelUp: levelUp,
            levelName: (typeof newMastery === 'number') ? (newMastery <= 30 ? 'Çırak' : (newMastery <= 70 ? 'Kaşif' : 'Üstat')) : null
          }
        });

      } catch (error) {
        logger.error("submitAnswer Error:", error);
        const msg2 = (error && (error.message || '')).toString().toLowerCase();
        const isFallbackError2 = error && (
          error.status === 429 ||
          error.status === 404 ||
          msg2.includes('429') ||
          msg2.includes('404') ||
          msg2.includes('quota') ||
          msg2.includes('not found')
        );
        if (isFallbackError2) {
          // If generation failed due to quota, return a graceful fallback but include
          // the current mastery value so the client UI (confetti/level-up) can still react.
          try {
            const userSnapshot = await db.collection('users').doc(userId).get();
            const currentUserData = userSnapshot.exists ? userSnapshot.data() : {};
            const currentTopicMastery = (currentUserData && currentUserData.topicMastery) ? currentUserData.topicMastery[topic] || 0 : 0;
            const levelName = currentTopicMastery <= 30 ? 'Çırak' : (currentTopicMastery <= 70 ? 'Kaşif' : 'Üstat');
            return res.status(200).json({
              success: true,
              stats: typeof stats !== 'undefined' ? stats : null,
              nextQuestion: null,
              fallback: true,
              message: "Üzgünüm, API kotası aşıldığı için soru üretilemedi. Lütfen birkaç dakika sonra tekrar deneyin.",
              mastery: {
                topic: topic,
                value: currentTopicMastery,
                levelUp: false,
                levelName
              }
            });
          } catch (_catchErr) {
            return res.status(200).json({
              success: true,
              stats: typeof stats !== 'undefined' ? stats : null,
              nextQuestion: null,
              fallback: true,
              message: "Üzgünüm, API kotası aşıldığı için soru üretilemedi. Lütfen birkaç dakika sonra tekrar deneyin."
            });
          }
        }
        return res.status(500).json({ error: error.message || "Bilinmeyen bir hata oluştu." });
      }
  }
);

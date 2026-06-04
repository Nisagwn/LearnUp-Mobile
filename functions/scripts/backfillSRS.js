/**
 * backfillSRS.js — Tek-seferlik admin scripti.
 *
 * Mevcut user_logs koleksiyonundaki son 30 günün YANLIŞ cevaplarını dolaşarak
 * `users/{uid}/srs_cards/{questionId}` subkoleksiyonunda kart oluşturur.
 *
 * Çalıştırma:
 *   1) Service account key dosyasını ortam değişkenine ata:
 *      $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccountKey.json"
 *   2) functions/ dizinine geç ve node scripts/backfillSRS.js
 *
 * Notlar:
 *   • Önceden var olan srs_cards dökümanları KORUNUR — sadece eksikler doldurulur.
 *   • snapshot (question/choices/answer) yoksa boş bırakılır; ileride quiz akışı
 *     SRS upsert'i snapshot ile besleyince doldurulacak.
 */

const admin = require("firebase-admin");
const { nextCardState } = require("../lib/srs");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function run() {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - THIRTY_DAYS_MS);

  console.log(`[backfillSRS] Son 30 günün yanlış cevapları taranıyor (≥ ${cutoff.toDate().toISOString()})...`);
  const snap = await db
    .collection("user_logs")
    .where("isCorrect", "==", false)
    .where("timestamp", ">=", cutoff)
    .get();

  console.log(`[backfillSRS] ${snap.size} yanlış kayıt bulundu.`);

  // Aynı (uid, questionId) için en güncel yanlışı baz alalım.
  const seen = new Map(); // key: `${uid}__${questionId}` → log doc data
  snap.forEach((d) => {
    const data = d.data();
    if (!data || !data.studentId || !data.questionId) return;
    const key = `${data.studentId}__${data.questionId}`;
    const cur = seen.get(key);
    const ts = (data.timestamp && data.timestamp.toMillis && data.timestamp.toMillis()) || 0;
    const curTs = (cur && cur.timestamp && cur.timestamp.toMillis && cur.timestamp.toMillis()) || 0;
    if (!cur || ts > curTs) seen.set(key, data);
  });

  console.log(`[backfillSRS] ${seen.size} benzersiz (kullanıcı, soru) çiftine kart oluşturulacak.`);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let batch = db.batch();
  let inBatch = 0;
  const BATCH_LIMIT = 400;

  for (const [, data] of seen) {
    const uid = data.studentId;
    const questionId = String(data.questionId);
    const ref = db.collection("users").doc(uid).collection("srs_cards").doc(questionId);
    try {
      const existing = await ref.get();
      if (existing.exists) {
        skipped += 1;
        continue;
      }
      const next = nextCardState(null, { isCorrect: false, nowMs: Date.now() });
      const payload = {
        questionId,
        subject: data.subject || "Genel",
        sub_topic: data.sub_topic || data.subject || "Genel",
        box: next.box,
        nextReviewAt: admin.firestore.Timestamp.fromMillis(next.nextReviewAtMs),
        lastReviewedAt: admin.firestore.Timestamp.fromMillis(next.lastReviewedAtMs),
        consecutiveCorrect: next.consecutiveCorrect,
        totalAttempts: next.totalAttempts,
        totalCorrect: next.totalCorrect,
        backfilled: true,
      };
      batch.set(ref, payload, { merge: false });
      inBatch += 1;
      created += 1;

      if (inBatch >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    } catch (err) {
      failed += 1;
      console.warn(`[backfillSRS] ${uid}/${questionId}: ${err.message || err}`);
    }
  }

  if (inBatch > 0) await batch.commit();

  console.log(`[backfillSRS] Tamamlandı. created=${created} skipped=${skipped} failed=${failed}`);
}

run().catch((err) => {
  console.error("[backfillSRS] Hata:", err);
  process.exit(1);
});

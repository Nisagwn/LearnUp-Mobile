/**
 * In-app bildirim merkezi (kalıcı geçmiş).
 *
 * Her push gönderiminde `users/{uid}/notifications` alt-koleksiyonuna da
 * paralel olarak yazılır. Kullanıcı bildirim merkezini kapatsa, uygulamayı
 * kapatsa bile geçmişi kalır — bell panelinden tekrar görür.
 *
 * Saklama şeması:
 *   { type, title, body, icon, tone, deepLink, data,
 *     readAt: null, createdAt: serverTimestamp,
 *     expiresAt: 30 gün sonra (opsiyonel TTL) }
 *
 * `notify()` push + persist'i tek çağrıda birleştirir. Push devre dışı
 * (notificationsEnabled=false) kullanıcılar bile in-app history alır —
 * push gönderilmeyen kullanıcı uid'leri de persist listesinde kalır.
 */

const admin = require("firebase-admin");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 450; // Firestore batch 500 limitin altında güvenli

function buildDoc(payload) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + THIRTY_DAYS_MS);
  return {
    type: String(payload.type || "info"),
    title: String(payload.title || ""),
    body: String(payload.body || ""),
    icon: String(payload.icon || "Bell"),
    tone: ["success", "warning", "danger", "accent"].includes(payload.tone)
      ? payload.tone
      : "accent",
    deepLink: typeof payload.deepLink === "string" ? payload.deepLink : null,
    data: payload.data && typeof payload.data === "object" ? payload.data : {},
    readAt: null,
    createdAt: now,
    expiresAt,
  };
}

/**
 * Tek kullanıcıya bildirim yaz.
 */
async function writeNotification(db, uid, payload) {
  if (!uid) return;
  try {
    await db
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .add(buildDoc(payload));
  } catch (err) {
    console.warn(`[notifications] write fail uid=${uid}: ${err.message || err}`);
  }
}

/**
 * Çoklu kullanıcıya batch write — Firestore 500-limit altında chunk'lar.
 */
async function writeNotificationMulti(db, uids, payload) {
  const unique = Array.from(new Set((uids || []).filter(Boolean)));
  if (unique.length === 0) return;
  const doc = buildDoc(payload);
  for (let i = 0; i < unique.length; i += BATCH_LIMIT) {
    const slice = unique.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    slice.forEach((uid) => {
      const ref = db.collection("users").doc(uid).collection("notifications").doc();
      batch.set(ref, doc);
    });
    try {
      await batch.commit();
    } catch (err) {
      console.warn(`[notifications] batch fail size=${slice.length}: ${err.message || err}`);
    }
  }
}

/**
 * Bir öğretmenin sınıfındaki **tüm** öğrenci uid'lerini getirir.
 * Push opt-out'tan bağımsız — in-app history için.
 */
async function getClassStudentUids(db, teacherId) {
  if (!teacherId) return [];
  const snap = await db
    .collection("users")
    .where("teacherId", "==", teacherId)
    .where("role", "==", "student")
    .get();
  const uids = [];
  snap.forEach((d) => uids.push(d.id));
  return uids;
}

module.exports = {
  writeNotification,
  writeNotificationMulti,
  getClassStudentUids,
};

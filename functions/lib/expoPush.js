/**
 * Expo Push API helper.
 *
 * - Chunk: 100 mesaj/istek (Expo limiti).
 * - Geçersiz/expired token'lar (details.error === 'DeviceNotRegistered') Firestore'dan
 *   silinir (ilgili devices/{tokenHash} doc'u).
 * - Rate-limit (429) durumunda kısa retry.
 * - SDK kullanılmaz — düz fetch ile Expo Push HTTP API'sine POST atar.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;
const RETRY_DELAY_MS = 800;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Tokens bağımsız hedefler. Her hedef:
 *   { token: 'ExponentPushToken[...]', deviceRef: FirebaseFirestore.DocumentReference|null }
 * deviceRef verildiyse, Expo "DeviceNotRegistered" döndürdüğünde o doc silinir.
 *
 * payload: { title, body, data? }
 *
 * Dönüş: { sent: number, removed: number, errors: Array<{token, reason}> }
 */
async function sendExpoPush(targets, payload, logger) {
  const log = logger || console;
  const valid = (targets || []).filter(
    (t) => t && typeof t.token === 'string' && t.token.startsWith('ExponentPushToken'),
  );
  if (valid.length === 0) {
    return { sent: 0, removed: 0, errors: [] };
  }

  const messages = valid.map((t) => ({
    to: t.token,
    sound: 'default',
    title: payload.title || '',
    body: payload.body || '',
    data: payload.data || {},
  }));

  let sent = 0;
  let removed = 0;
  const errors = [];
  const toRemove = []; // deviceRef silmek için
  let batchStart = 0; // valid[] içinde mevcut batch'in başlangıç indexi

  for (const batch of chunk(messages, CHUNK_SIZE)) {
    let res;
    let attempt = 0;
    while (attempt < 3) {
      attempt++;
      try {
        res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });
      } catch (err) {
        log.warn(`[expoPush] fetch fail attempt=${attempt}: ${err.message || err}`);
        if (attempt >= 3) break;
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      if (res.status === 429) {
        log.warn('[expoPush] 429 — retrying');
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      break;
    }
    if (!res || !res.ok) {
      log.error(`[expoPush] batch failed status=${res ? res.status : 'no-response'}`);
      batchStart += batch.length;
      continue;
    }
    let json;
    try {
      json = await res.json();
    } catch (err) {
      log.error('[expoPush] parse failed:', err.message || err);
      batchStart += batch.length;
      continue;
    }
    const tickets = Array.isArray(json && json.data) ? json.data : [];
    tickets.forEach((ticket, idx) => {
      const target = valid[batchStart + idx];
      if (!ticket || ticket.status === 'ok') {
        sent++;
        return;
      }
      const reason = (ticket.details && ticket.details.error) || ticket.message || 'unknown';
      errors.push({ token: target && target.token, reason });
      if (reason === 'DeviceNotRegistered' && target && target.deviceRef) {
        toRemove.push(target.deviceRef);
      }
    });
    batchStart += batch.length;
  }

  if (toRemove.length > 0) {
    await Promise.all(
      toRemove.map((ref) =>
        ref
          .delete()
          .then(() => {
            removed++;
          })
          .catch(() => {}),
      ),
    );
    log.info(`[expoPush] ${removed} geçersiz token silindi`);
  }

  log.info(`[expoPush] sent=${sent} errors=${errors.length} removed=${removed}`);
  return { sent, removed, errors };
}

/**
 * Belirli teacherId'ye bağlı (öğretmenin sınıfındaki) öğrencilerin tüm aktif
 * cihaz token'larını topla. notificationsEnabled === false olanlar dışlanır.
 *
 * Dönüş: [{ token, deviceRef }]
 */
async function collectStudentTokensForTeacher(db, teacherId, opts = {}) {
  const includeTeacherSelf = !!opts.includeTeacherSelf;
  const studentsSnap = await db
    .collection('users')
    .where('teacherId', '==', teacherId)
    .where('role', '==', 'student')
    .get();
  const userIds = [];
  studentsSnap.forEach((d) => {
    const u = d.data() || {};
    if (u.notificationsEnabled === false) return;
    userIds.push(d.id);
  });
  if (includeTeacherSelf) userIds.push(teacherId);
  if (userIds.length === 0) return [];

  // Devices alt-koleksiyonundan token'ları çek (paralel)
  const targets = [];
  await Promise.all(
    userIds.map(async (uid) => {
      const devSnap = await db.collection('users').doc(uid).collection('devices').get();
      devSnap.forEach((dd) => {
        const data = dd.data() || {};
        const token = data.expoPushToken;
        if (typeof token === 'string' && token) {
          targets.push({ token, deviceRef: dd.ref });
        }
      });
    }),
  );
  return targets;
}

/**
 * Tek bir kullanıcının tüm token'larını topla (test push veya kişiye özel için).
 */
async function collectUserTokens(db, uid) {
  if (!uid) return [];
  const devSnap = await db.collection('users').doc(uid).collection('devices').get();
  const out = [];
  devSnap.forEach((dd) => {
    const data = dd.data() || {};
    const token = data.expoPushToken;
    if (typeof token === 'string' && token) {
      out.push({ token, deviceRef: dd.ref });
    }
  });
  return out;
}

module.exports = {
  sendExpoPush,
  collectStudentTokensForTeacher,
  collectUserTokens,
};

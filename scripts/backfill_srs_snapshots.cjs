/**
 * Backfill — srs_cards.snapshot
 *
 * SRS kartlarının bazıları (özellikle eski kayıtlar) snapshot taşımıyor:
 *   { question, choices, answer }
 * Bu olmadan "Yanlışlarım"da kart açıldığında çözülecek metin yok →
 *   "Yetersiz veri" uyarısı çıkıyor.
 *
 * Burada her snapshot'sız kart için, kartın doc ID'si = questions/{id} ile
 * eşleşiyorsa o sorunun metnini/şıkkını/doğru cevabını snapshot'a yazıyoruz.
 * Eşleşmeyen (eski hash'li AI/local ID'li) kartlar dokunulmaz — onlar
 * yalnız yeniden çözüldüğünde recordAnswer ile snapshot kazanır.
 *
 * Kullanım (functions klasöründen):
 *   node ../scripts/backfill_srs_snapshots.cjs --dry-run
 *   node ../scripts/backfill_srs_snapshots.cjs --commit
 */

const path = require('path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..', 'functions');
const admin = require(path.join(FUNCTIONS_DIR, 'node_modules', 'firebase-admin'));
const serviceAccount = require(path.join(FUNCTIONS_DIR, 'serviceAccountKey.json'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--commit');
const BATCH_SIZE = 400;

function buildSnapshotFromQuestionDoc(qData) {
  if (!qData) return null;
  const question = qData.text || qData.question_text || qData.question || '';
  if (!question) return null;

  let choices = [];
  if (Array.isArray(qData.options)) {
    choices = qData.options.filter((c) => typeof c === 'string');
  } else if (Array.isArray(qData.choices)) {
    choices = qData.choices.filter((c) => typeof c === 'string');
  } else if (qData.options && typeof qData.options === 'object') {
    choices = Object.values(qData.options).filter((c) => typeof c === 'string');
  }
  if (choices.length < 2) return null;

  let answerIdx = null;
  const ansRaw = qData.correctAnswer ?? qData.correct_answer ?? qData.answer;
  if (typeof ansRaw === 'number' && Number.isInteger(ansRaw) && ansRaw >= 0 && ansRaw < choices.length) {
    answerIdx = ansRaw;
  } else if (typeof ansRaw === 'string') {
    const trimmed = ansRaw.trim();
    const exact = choices.findIndex((c) => c.trim() === trimmed);
    if (exact >= 0) answerIdx = exact;
    if (answerIdx === null && trimmed.length <= 3) {
      const letter = trimmed.toUpperCase().charAt(0);
      const idx = letter.charCodeAt(0) - 65;
      if (idx >= 0 && idx < choices.length) answerIdx = idx;
    }
  }
  if (answerIdx === null) return null;

  return { question, choices, answer: answerIdx };
}

async function migrate() {
  console.log(`🔍 srs_cards taranıyor... (${DRY_RUN ? 'DRY-RUN' : 'COMMIT'})\n`);

  const snap = await db.collectionGroup('srs_cards').get();
  console.log(`Toplam srs_cards: ${snap.size}`);

  const cardsNeedingSnapshot = [];
  snap.forEach((d) => {
    const data = d.data();
    if (!data.snapshot || !data.snapshot.question) {
      cardsNeedingSnapshot.push({ ref: d.ref, id: d.id });
    }
  });
  console.log(`Snapshot'sız kart: ${cardsNeedingSnapshot.length}\n`);

  if (cardsNeedingSnapshot.length === 0) {
    console.log('✅ Tüm kartlarda snapshot var.');
    process.exit(0);
  }

  // Her kart için questions/{cardId} dokümanını çek (paralel batch'ler)
  const updates = []; // { ref, patch }
  const CHUNK = 50;
  let resolvable = 0;
  let unresolvable = 0;

  for (let i = 0; i < cardsNeedingSnapshot.length; i += CHUNK) {
    const slice = cardsNeedingSnapshot.slice(i, i + CHUNK);
    const refs = slice.map((c) => db.collection('questions').doc(c.id));
    const docs = await db.getAll(...refs);
    docs.forEach((qDoc, idx) => {
      const card = slice[idx];
      if (!qDoc.exists) {
        unresolvable++;
        return;
      }
      const snapshot = buildSnapshotFromQuestionDoc(qDoc.data());
      if (!snapshot) {
        unresolvable++;
        return;
      }
      resolvable++;
      updates.push({ ref: card.ref, patch: { snapshot } });
    });
    process.stdout.write(`  ↳ Tarandı ${Math.min(i + CHUNK, cardsNeedingSnapshot.length)}/${cardsNeedingSnapshot.length}\r`);
  }
  console.log('\n');

  console.log('────────────────────────────────────────');
  console.log(`questions/{id} ile eşleşen ve kurtarılan: ${resolvable}`);
  console.log(`Eşleşmeyen (eski hash'li, kurtarılamaz)  : ${unresolvable}`);
  console.log(`Yapılacak yazma                          : ${updates.length}`);
  console.log('────────────────────────────────────────\n');

  if (DRY_RUN) {
    console.log('✋ DRY-RUN — yazma yapılmadı. Uygulamak için --commit ile çalıştır.');
    process.exit(0);
  }

  if (updates.length === 0) {
    console.log('✅ Yapılacak yazma yok.');
    process.exit(0);
  }

  console.log(`📝 ${updates.length} doküman ${BATCH_SIZE}'li batch'ler ile güncelleniyor...\n`);
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const slice = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { ref, patch } of slice) {
      batch.set(ref, patch, { merge: true });
    }
    await batch.commit();
    written += slice.length;
    console.log(`  ↳ ${written}/${updates.length} yazıldı`);
  }
  console.log(`\n✅ Tamamlandı. ${written} kart snapshot ile güncellendi.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Backfill hatası:', err);
  process.exit(1);
});

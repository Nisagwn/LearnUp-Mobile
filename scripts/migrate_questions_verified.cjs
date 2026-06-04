/**
 * Migration — `questions` koleksiyonuna `verified` alanı ekleme
 *
 * - `is_ai_generated === true`  →  `verified: false`  (öğretmen onayı bekler)
 * - Aksi (öğretmen eliyle eklenmiş yüksek kaliteli sorular)  →  `verified: true`
 * - `random_seed` eksikse rastgele bir tam sayı ile doldur
 *
 * Idempotent: `verified` alanı zaten varsa atlar.
 *
 * Kullanım (functions klasöründeki node_modules + serviceAccountKey kullanılır):
 *   cd functions
 *   node ../scripts/migrate_questions_verified.cjs --dry-run   # önce sayım
 *   node ../scripts/migrate_questions_verified.cjs --commit    # uygula
 *
 * DİKKAT: Üretim veritabanını değiştirir. Çalıştırmadan önce yedek alın.
 */

const path = require('path');

// firebase-admin ve serviceAccountKey'i functions klasöründen çöz — kök dizinin
// node_modules'una bağlı kalmadan, functions/node_modules üzerinden çalışsın.
const FUNCTIONS_DIR = path.resolve(__dirname, '..', 'functions');
const admin = require(path.join(FUNCTIONS_DIR, 'node_modules', 'firebase-admin'));
const serviceAccount = require(path.join(FUNCTIONS_DIR, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--commit');
const BATCH_SIZE = 400;

async function migrate() {
  console.log(`🔍 'questions' koleksiyonu taranıyor... (${DRY_RUN ? 'DRY-RUN' : 'COMMIT'})\n`);

  const snapshot = await db.collection('questions').get();

  if (snapshot.empty) {
    console.log('Havuz boş — yapılacak iş yok.');
    process.exit(0);
  }

  let totalScanned = 0;
  let toUpdateVerifiedTrue = 0;
  let toUpdateVerifiedFalse = 0;
  let toBackfillSeed = 0;
  let alreadyOk = 0;

  const updates = []; // { ref, patch }

  for (const doc of snapshot.docs) {
    totalScanned += 1;
    const d = doc.data();
    const patch = {};

    if (typeof d.verified !== 'boolean') {
      const isAI = d.is_ai_generated === true || d.isAI === true;
      const hasTeacher = !!d.teacherId;

      if (isAI && !hasTeacher) {
        patch.verified = false;
        toUpdateVerifiedFalse += 1;
      } else {
        // öğretmen eli değmiş soru — onaylı kabul et
        patch.verified = true;
        toUpdateVerifiedTrue += 1;
      }
    }

    if (typeof d.random_seed !== 'number') {
      patch.random_seed = Math.floor(Math.random() * 1_000_000);
      toBackfillSeed += 1;
    }

    if (Object.keys(patch).length === 0) {
      alreadyOk += 1;
      continue;
    }

    updates.push({ ref: doc.ref, patch });
  }

  console.log('────────────────────────────────────────');
  console.log(`Toplam taranan        : ${totalScanned}`);
  console.log(`verified:true atanan  : ${toUpdateVerifiedTrue}`);
  console.log(`verified:false atanan : ${toUpdateVerifiedFalse}`);
  console.log(`random_seed backfill  : ${toBackfillSeed}`);
  console.log(`Hâlihazırda tamam     : ${alreadyOk}`);
  console.log(`Yapılacak yazma       : ${updates.length}`);
  console.log('────────────────────────────────────────\n');

  if (DRY_RUN) {
    console.log('✋ DRY-RUN — hiçbir yazma yapılmadı. Uygulamak için --commit ile çalıştır.');
    process.exit(0);
  }

  if (updates.length === 0) {
    console.log('✅ Yapılacak yazma yok.');
    process.exit(0);
  }

  console.log(`📝 ${updates.length} doküman ${BATCH_SIZE}'li batch'ler halinde güncelleniyor...\n`);

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

  console.log(`\n✅ Tamamlandı. ${written} doküman güncellendi.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration hatası:', err);
  process.exit(1);
});

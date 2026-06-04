/**
 * Backfill — `user_logs` koleksiyonunda eksik `teacherId` alanı.
 *
 * Senaryo: recordAnswer öğrencinin `users/{uid}.teacherId` yoksa `null` yazıyor.
 * Öğrenci sınıfa SONRADAN katıldıysa eski log'ları teacherId:null kalıyor →
 * öğretmen sınıf analitiği (where teacherId == X) 0 sonuç dönüyor.
 *
 * Bu script:
 *  1) Tüm öğrencileri (role:student, teacherId set) çeker
 *  2) Her öğrencinin teacherId:null olan user_logs'larına teacherId yazar
 *  3) Idempotent: zaten dolu olanları atlar
 *
 * Kullanım:
 *   cd functions
 *   node ../scripts/backfill_user_logs_teacher_id.cjs --dry-run
 *   node ../scripts/backfill_user_logs_teacher_id.cjs --commit
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

(async () => {
  console.log(`🔍 Öğrenciler taranıyor... (${DRY_RUN ? 'DRY-RUN' : 'COMMIT'})\n`);

  const studentsSnap = await db
    .collection('users')
    .where('role', '==', 'student')
    .get();

  const studentToTeacher = new Map();
  studentsSnap.forEach((d) => {
    const data = d.data();
    if (typeof data.teacherId === 'string' && data.teacherId.length > 0) {
      studentToTeacher.set(d.id, data.teacherId);
    }
  });

  console.log(`Sınıfa katılmış öğrenci sayısı: ${studentToTeacher.size}\n`);

  if (studentToTeacher.size === 0) {
    console.log('Hiç öğrenci sınıfa katılmamış — yapılacak iş yok.');
    process.exit(0);
  }

  let totalScanned = 0;
  let toUpdate = 0;
  const updates = [];

  for (const [studentId, teacherId] of studentToTeacher.entries()) {
    const logsSnap = await db
      .collection('user_logs')
      .where('studentId', '==', studentId)
      .get();

    logsSnap.forEach((doc) => {
      totalScanned++;
      const d = doc.data();
      if (d.teacherId !== teacherId) {
        toUpdate++;
        updates.push({ ref: doc.ref, patch: { teacherId } });
      }
    });
  }

  console.log('────────────────────────────────────────');
  console.log(`Taranan log toplam : ${totalScanned}`);
  console.log(`Güncellenecek log  : ${toUpdate}`);
  console.log('────────────────────────────────────────\n');

  if (DRY_RUN) {
    console.log('✋ DRY-RUN — yazma yapılmadı. Uygulamak için --commit ekle.');
    process.exit(0);
  }
  if (updates.length === 0) {
    console.log('✅ Yapılacak yazma yok.');
    process.exit(0);
  }

  console.log(`📝 ${updates.length} doküman ${BATCH_SIZE}'li batch'ler halinde yazılıyor...\n`);
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const slice = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { ref, patch } of slice) batch.set(ref, patch, { merge: true });
    await batch.commit();
    written += slice.length;
    console.log(`  ↳ ${written}/${updates.length}`);
  }

  console.log(`\n✅ Tamamlandı. ${written} log güncellendi.`);
  process.exit(0);
})().catch((err) => {
  console.error('❌ Backfill hatası:', err);
  process.exit(1);
});

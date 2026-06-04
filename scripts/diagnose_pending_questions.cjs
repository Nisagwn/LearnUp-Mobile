/**
 * Tanı — `questions` koleksiyonunda onay bekleyen AI sorularının sayımı.
 *
 * Çıktı:
 *  • Toplam questions
 *  • is_ai_generated:true sayısı
 *  • Onay bekleyen (is_ai_generated:true AND verified:false) sayısı
 *  • Onaylı AI (is_ai_generated:true AND verified:true) sayısı
 *  • En son üretilmiş 5 AI sorusunun tarihi + verified durumu
 *
 * Kullanım:
 *   cd functions
 *   node ../scripts/diagnose_pending_questions.cjs
 */

const path = require('path');
const FUNCTIONS_DIR = path.resolve(__dirname, '..', 'functions');
const admin = require(path.join(FUNCTIONS_DIR, 'node_modules', 'firebase-admin'));
const serviceAccount = require(path.join(FUNCTIONS_DIR, 'serviceAccountKey.json'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('questions').get();
  let total = 0;
  let aiTotal = 0;
  let aiPending = 0;
  let aiApproved = 0;
  let manualVerified = 0;
  let manualUnverified = 0;
  const recentAI = [];

  snap.forEach((doc) => {
    total++;
    const d = doc.data();
    const isAI = d.is_ai_generated === true || d.isAI === true;
    if (isAI) {
      aiTotal++;
      if (d.verified === false) aiPending++;
      else if (d.verified === true) aiApproved++;
      recentAI.push({
        id: doc.id,
        verified: d.verified,
        createdAt: d.createdAt,
        teacherId: d.teacherId,
        subject: d.subject,
        grade: d.grade,
      });
    } else {
      if (d.verified === true) manualVerified++;
      else manualUnverified++;
    }
  });

  recentAI.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  console.log('────────────────────────────────────────');
  console.log(`Toplam soru             : ${total}`);
  console.log(`AI üretimli (toplam)    : ${aiTotal}`);
  console.log(`  └─ Onay bekleyen      : ${aiPending}`);
  console.log(`  └─ Onaylı             : ${aiApproved}`);
  console.log(`Manuel sorular          : ${total - aiTotal}`);
  console.log(`  └─ verified:true      : ${manualVerified}`);
  console.log(`  └─ verified:false/?   : ${manualUnverified}`);
  console.log('────────────────────────────────────────');
  console.log('\nSon 5 AI sorusu (en yeni → eski):');
  recentAI.slice(0, 5).forEach((q, i) => {
    const dateStr = q.createdAt ? new Date(q.createdAt).toLocaleString('tr-TR') : '?';
    console.log(
      `  ${i + 1}. ${q.id.slice(0, 8)}…  ` +
        `verified=${q.verified}  ` +
        `subject=${q.subject ?? '?'}  ` +
        `grade=${q.grade ?? '?'}  ` +
        `teacherId=${q.teacherId ?? 'null'}  ` +
        `(${dateStr})`,
    );
  });

  if (aiPending === 0) {
    console.log('\n⚠ Onay bekleyen AI sorusu yok. Olası nedenler:');
    console.log('  1) Öğrenci son zamanda quiz çözmedi (havuz yeterli → AI tetiklenmedi).');
    console.log('  2) AI üretildi ama saveAIQuestions endpoint hata verdi (best-effort, sessiz).');
    console.log('  3) Migration script eski AI sorularını verified:true yaptı (teacherId varsa).');
    console.log('\n→ Test için: öğretmen panelinden "AI Üret" sheet ile birkaç soru üret,');
    console.log('  "Onay Bekleyen" sekmesinde görünmeli.');
  }

  process.exit(0);
})().catch((err) => {
  console.error('Tanı hatası:', err);
  process.exit(1);
});

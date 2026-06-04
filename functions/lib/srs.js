// Spaced Repetition System (Leitner box) — state machine.
// Yanlış cevap → box=0 (hemen tekrar). Doğru cevap → box++, sonraki tekrar
// gelecekteki interval'a ötelenir. box>=4 → "öğrenildi" (30g sonra tekrar).

// Box → sonraki tekrar gecikmesi (milisaniye)
const BOX_INTERVALS_MS = {
  0: 0,                            // yeni / yanlış: hemen
  1: 60 * 60 * 1000,               // 1 saat
  2: 24 * 60 * 60 * 1000,          // 1 gün
  3: 3 * 24 * 60 * 60 * 1000,      // 3 gün
  4: 7 * 24 * 60 * 60 * 1000,      // 7 gün (öğrenildi havuzunda yine periyodik tazeleme)
};

const LEARNED_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Bir önceki SRS card durumu + yeni cevap → güncel card durumu.
 * Saf fonksiyon. Tüm zaman değerleri milisaniye epoch.
 *
 * @param {object|null} prev — Var olan card snapshot (yoksa null/undefined)
 * @param {object} ans — { isCorrect, nowMs }
 * @returns {object} next card state (timestamps ms olarak)
 */
function nextCardState(prev, ans) {
  const nowMs = Number(ans.nowMs) || Date.now();
  const isCorrect = ans.isCorrect === true;
  const prevBox = Number(prev && prev.box);
  const safePrevBox = Number.isFinite(prevBox) ? Math.max(0, Math.min(4, prevBox)) : 0;
  const totalAttempts = Number((prev && prev.totalAttempts) || 0) + 1;
  const totalCorrect = Number((prev && prev.totalCorrect) || 0) + (isCorrect ? 1 : 0);
  const prevConsecutive = Number((prev && prev.consecutiveCorrect) || 0);

  let box;
  let consecutiveCorrect;
  if (isCorrect) {
    box = Math.min(4, safePrevBox + 1);
    consecutiveCorrect = prevConsecutive + 1;
  } else {
    box = 0;
    consecutiveCorrect = 0;
  }

  const intervalMs = box >= 4 ? LEARNED_REFRESH_MS : BOX_INTERVALS_MS[box];
  const nextReviewAtMs = nowMs + intervalMs;

  return {
    box,
    nextReviewAtMs,
    lastReviewedAtMs: nowMs,
    consecutiveCorrect,
    totalAttempts,
    totalCorrect,
  };
}

module.exports = {
  BOX_INTERVALS_MS,
  LEARNED_REFRESH_MS,
  nextCardState,
};

// Rozet kataloğu — saf modül (React/Firebase importu yok), levelSystem.js ile aynı desende.
// Her rozetin check(snapshot) yüklemi useBadges'in kurduğu snapshot'tan değerlendirilir.
// snapshot: { streakDays, totalSolved, correctAnswers, level, masteryScores }

export const BADGE_CATALOG = [
  // Seri (streak)
  { id: 'streak_3',   group: 'streak', name: 'Isınma Turu',       desc: '3 gün üst üste çalış',  emoji: '🔥', color: '#F59E0B', check: s => (s.streakDays || 0) >= 3 },
  { id: 'streak_7',   group: 'streak', name: 'Haftalık İstikrar', desc: '7 gün üst üste çalış',  emoji: '🔥', color: '#EA580C', check: s => (s.streakDays || 0) >= 7 },
  { id: 'streak_30',  group: 'streak', name: 'Vazgeçmeyen',       desc: '30 gün üst üste çalış', emoji: '⚡', color: '#DC2626', check: s => (s.streakDays || 0) >= 30 },
  { id: 'streak_100', group: 'streak', name: 'Alev Ustası',       desc: '100 gün üst üste çalış', emoji: '☄️', color: '#B91C1C', check: s => (s.streakDays || 0) >= 100 },
  // Çözüm hacmi (volume)
  { id: 'solved_25',  group: 'volume', name: 'İlk Adımlar',      desc: '25 soru çöz',                   emoji: '✏️', color: '#06B6D4', check: s => (s.totalSolved || 0) >= 25 },
  { id: 'solved_100', group: 'volume', name: 'Çalışkan',         desc: '100 soru çöz',                  emoji: '📘', color: '#0EA5E9', check: s => (s.totalSolved || 0) >= 100 },
  { id: 'solved_500', group: 'volume', name: 'Maraton Koşucusu', desc: '500 soru çöz',                  emoji: '🏃', color: '#2563EB', check: s => (s.totalSolved || 0) >= 500 },
  // Seviye (level)
  { id: 'level_3', group: 'level', name: 'Savaşçı',  desc: '3. seviyeye ulaş', emoji: '⚔️', color: '#8B5CF6', check: s => (s.level || 1) >= 3 },
  { id: 'level_5', group: 'level', name: 'Uzman',    desc: '5. seviyeye ulaş', emoji: '🎯', color: '#7C3AED', check: s => (s.level || 1) >= 5 },
  { id: 'level_8', group: 'level', name: 'Efsane',   desc: '8. seviyeye ulaş', emoji: '✨', color: '#6D28D9', check: s => (s.level || 1) >= 8 },
  // Ustalık (mastery)
  { id: 'mastery_80',  group: 'mastery', name: 'Konu Hakimi', desc: 'Bir derste %80 ustalığa ulaş',  emoji: '🧠', color: '#10B981', check: s => Object.values(s.masteryScores || {}).some(m => (m?.score || 0) >= 80) },
  { id: 'mastery_100', group: 'mastery', name: 'Kusursuz',    desc: 'Bir derste %100 ustalığa ulaş', emoji: '👑', color: '#059669', check: s => Object.values(s.masteryScores || {}).some(m => (m?.score || 0) >= 100) },
];

export const BADGE_GROUPS = [
  { id: 'streak',  label: 'Seri' },
  { id: 'volume',  label: 'Çözüm' },
  { id: 'level',   label: 'Seviye' },
  { id: 'mastery', label: 'Ustalık' },
];

// snapshot'a göre kazanılan rozet id'lerini döndürür
export function evaluateBadges(snapshot) {
  return BADGE_CATALOG
    .filter(b => { try { return !!b.check(snapshot); } catch { return false; } })
    .map(b => b.id);
}

export function getBadgeById(id) {
  return BADGE_CATALOG.find(b => b.id === id) || null;
}

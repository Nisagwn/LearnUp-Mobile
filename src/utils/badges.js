// Rozet kataloğu — saf modül (React/Firebase importu yok).
// 7 doğa-temalı aile, 31 rozet. Tohumdan ormana, damladan okyanusa, kökten taça,
// çiçek açışından zirvenin ışığına.
//
// snapshot: { streakDays, totalSolved, correctAnswers, level, masteryScores, ageDays?, badgePercent? }
//   ageDays      → opsiyonel; userProfile.createdAt'tan türetilir
//   badgePercent → opsiyonel; ContextProvider çağırırken kazanılan rozet oranını verir
//                  (yıldız ailesinin self-referans olmaması için iki geçişli değerlendirme)
//
// Tüm renkler `src/constants/theme.ts`'teki palette/gradient referansları ile
// uyumlu sabit hex listesi — BadgeStrip / BadgeDetailModal componentleri opacity
// hesabı için renk değerine ihtiyaç duyduğundan burada literal tutuluyor.

export const BADGE_FAMILIES = [
  { id: 'seed',     label: 'Tohum',   icon: '🌰', desc: 'Köklerin derinleşmesi',        gradKey: 'success' },
  { id: 'soil',     label: 'Toprak',  icon: '💧', desc: 'Damladan okyanusa',           gradKey: 'ocean' },
  { id: 'branch',   label: 'Dal',     icon: '🌿', desc: 'Kökten taca yükseliş',         gradKey: 'mint' },
  { id: 'flower',   label: 'Çiçek',   icon: '🌸', desc: 'Konu hakimiyetiyle açılan',    gradKey: 'sunset' },
  { id: 'season',   label: 'Mevsim',  icon: '🍂', desc: 'Yıl döngüsünün izleri',        gradKey: 'league' },
  { id: 'discover', label: 'Keşif',   icon: '🦋', desc: 'Sürpriz ve özel anlar',        gradKey: 'brand' },
  { id: 'star',     label: 'Yıldız',  icon: '⭐', desc: 'Diğer rozetlerin rozeti',     gradKey: 'grape' },
];

// Her aile için kanonik gradient ucu rengi (rozet hücresi rengi)
const FAMILY_TONE = {
  seed:     '#16A34A',
  soil:     '#3B82F6',
  branch:   '#10B981',
  flower:   '#FB923C',
  season:   '#F59E0B',
  discover: '#15803D',
  star:     '#FBBF24',
};

export const BADGE_CATALOG = [
  // 🌰 Tohum Ailesi — Streak
  { id: 'seed_3',       family: 'seed',     name: 'Tohum',            desc: '3 gün üst üste çalış',           emoji: '🌰', color: '#65A30D', check: s => (s.streakDays || 0) >= 3 },
  { id: 'sprout_7',     family: 'seed',     name: 'Filiz',            desc: '7 gün üst üste çalış',           emoji: '🌱', color: '#16A34A', check: s => (s.streakDays || 0) >= 7 },
  { id: 'sapling_30',   family: 'seed',     name: 'Fidan',            desc: '30 gün üst üste çalış',          emoji: '🌲', color: '#15803D', check: s => (s.streakDays || 0) >= 30 },
  { id: 'tree_60',      family: 'seed',     name: 'Genç Ağaç',        desc: '60 gün üst üste çalış',          emoji: '🌳', color: '#166534', check: s => (s.streakDays || 0) >= 60 },
  { id: 'ancient_100',  family: 'seed',     name: 'Asırlık Çınar',    desc: '100 gün üst üste çalış',         emoji: '🌲', color: '#14532D', check: s => (s.streakDays || 0) >= 100 },

  // 💧 Toprak Ailesi — Çözüm hacmi
  { id: 'drop_25',      family: 'soil',     name: 'Çiy Damlası',      desc: '25 soru çöz',                    emoji: '💧', color: '#22D3EE', check: s => (s.totalSolved || 0) >= 25 },
  { id: 'rain_100',     family: 'soil',     name: 'Yağmur',           desc: '100 soru çöz',                   emoji: '🌧️', color: '#0EA5E9', check: s => (s.totalSolved || 0) >= 100 },
  { id: 'river_500',    family: 'soil',     name: 'Nehir',            desc: '500 soru çöz',                   emoji: '🌊', color: '#2563EB', check: s => (s.totalSolved || 0) >= 500 },
  { id: 'ocean_1000',   family: 'soil',     name: 'Okyanus',          desc: '1000 soru çöz',                  emoji: '🌊', color: '#1D4ED8', check: s => (s.totalSolved || 0) >= 1000 },

  // 🌿 Dal Ailesi — Level (correctAnswers eşikleri LEVELS array'inden)
  { id: 'root_lv2',     family: 'branch',   name: 'Köksalış',         desc: '2. seviyeye ulaş',               emoji: '🌿', color: '#34D399', check: s => (s.level || 1) >= 2 },
  { id: 'shoot_lv3',    family: 'branch',   name: 'Sürgün',           desc: '3. seviyeye ulaş (Savaşçı)',     emoji: '🌱', color: '#10B981', check: s => (s.level || 1) >= 3 },
  { id: 'branch_lv5',   family: 'branch',   name: 'Dal Atış',         desc: '5. seviyeye ulaş (Uzman)',       emoji: '🌳', color: '#059669', check: s => (s.level || 1) >= 5 },
  { id: 'crown_lv7',    family: 'branch',   name: 'Taç',              desc: '7. seviyeye ulaş (Efsane)',      emoji: '👑', color: '#047857', check: s => (s.level || 1) >= 7 },
  { id: 'glow_lv8',     family: 'branch',   name: 'Işıltı',           desc: '8. seviyeye ulaş (İlluminati)',  emoji: '✨', color: '#065F46', check: s => (s.level || 1) >= 8 },

  // 🌸 Çiçek Ailesi — Mastery
  { id: 'bloom_80',     family: 'flower',   name: 'İlk Çiçek',        desc: 'Bir konuda %80+ ustalık',        emoji: '🌸', color: '#FB923C', check: s => Object.values(s.masteryScores || {}).some(m => (m?.score || 0) >= 80) },
  { id: 'spring_3',     family: 'flower',   name: 'Bahar',            desc: '3 konuda %80+ ustalık',          emoji: '🌷', color: '#EC4899', check: s => Object.values(s.masteryScores || {}).filter(m => (m?.score || 0) >= 80).length >= 3 },
  { id: 'garden_5',     family: 'flower',   name: 'Bahçe',            desc: '5 konuda %80+ ustalık',          emoji: '🌺', color: '#DB2777', check: s => Object.values(s.masteryScores || {}).filter(m => (m?.score || 0) >= 80).length >= 5 },
  { id: 'paradise_100', family: 'flower',   name: 'Cennet',           desc: '3 konuda %100 ustalık',          emoji: '🪷', color: '#BE185D', check: s => Object.values(s.masteryScores || {}).filter(m => (m?.score || 0) >= 100).length >= 3 },

  // 🍂 Mevsim Ailesi — Uygulama yaşı (ageDays opsiyonel; yoksa skip)
  { id: 'spring_30d',   family: 'season',   name: 'İlkbahar',         desc: '30 gün boyunca öğrencimiz oldun', emoji: '🌷', color: '#FBBF24', check: s => (s.ageDays || 0) >= 30 },
  { id: 'summer_90d',   family: 'season',   name: 'Yaz',              desc: '90 gün boyunca öğrencimiz oldun', emoji: '☀️', color: '#F59E0B', check: s => (s.ageDays || 0) >= 90 },
  { id: 'autumn_180d',  family: 'season',   name: 'Sonbahar',         desc: '180 gün boyunca öğrencimiz oldun', emoji: '🍂', color: '#D97706', check: s => (s.ageDays || 0) >= 180 },
  { id: 'winter_365d',  family: 'season',   name: 'Kış',              desc: '1 yıl boyunca öğrencimiz oldun', emoji: '❄️', color: '#B45309', check: s => (s.ageDays || 0) >= 365 },

  // 🦋 Keşif Ailesi — Davranış (Phase 2 — UI'da görünür, otomatik kazanım yok)
  { id: 'early_bird',   family: 'discover', name: 'Erken Kuş',        desc: 'Sabah 06–08 arası quiz çöz',     emoji: '🐦', color: '#FB923C', check: () => false, placeholder: true },
  { id: 'night_owl',    family: 'discover', name: 'Gece Kuşu',        desc: 'Gece 23–01 arası quiz çöz',      emoji: '🦉', color: '#15803D', check: () => false, placeholder: true },
  { id: 'phoenix',      family: 'discover', name: 'Anka',             desc: 'Streak bozulduktan sonra 30 gün geri kazan', emoji: '🔥', color: '#DC2626', check: () => false, placeholder: true },
  { id: 'butterfly',    family: 'discover', name: 'Kelebek',          desc: '5 farklı dersten quiz çöz',      emoji: '🦋', color: '#15803D', check: () => false, placeholder: true },
  { id: 'bee',          family: 'discover', name: 'Arı',              desc: 'Bir günde 50+ doğru cevap',      emoji: '🐝', color: '#FBBF24', check: () => false, placeholder: true },

  // ⭐ Yıldız Ailesi — Meta (rozet koleksiyonu yüzdesi)
  { id: 'sky_50pct',    family: 'star',     name: 'Gökyüzü',          desc: 'Rozetlerin %50\'sini topla',     emoji: '🌌', color: '#84CC16', check: s => (s.badgePercent || 0) >= 50 },
  { id: 'galaxy_75pct', family: 'star',     name: 'Galaksi',          desc: 'Rozetlerin %75\'ini topla',      emoji: '🌠', color: '#15803D', check: s => (s.badgePercent || 0) >= 75 },
  { id: 'cosmos_100pct',family: 'star',     name: 'Kozmos',           desc: 'Tüm rozetleri topla',            emoji: '✨', color: '#15803D', check: s => (s.badgePercent || 0) >= 100 },
  { id: 'legend_first', family: 'star',     name: 'Efsane',           desc: 'Lv 8 (İlluminati)\'ye ulaş',     emoji: '👑', color: '#FBBF24', check: s => (s.level || 1) >= 8 },
];

// Eski 12 ID → yeni 31 katalog map'i. Eski Firestore kazanımları korunur.
export const legacyBadgeIdMap = {
  streak_3:   'seed_3',
  streak_7:   'sprout_7',
  streak_30:  'sapling_30',
  streak_100: 'ancient_100',
  solved_25:  'drop_25',
  solved_100: 'rain_100',
  solved_500: 'river_500',
  level_3:    'shoot_lv3',
  level_5:    'branch_lv5',
  level_8:    'glow_lv8',
  mastery_80:  'bloom_80',
  mastery_100: 'paradise_100',
};

/** Eski ID'leri yeniye normalize edilmiş unlock map'i. */
export function normalizeUnlockedMap(unlockedRaw) {
  if (!unlockedRaw || typeof unlockedRaw !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(unlockedRaw)) {
    const newKey = legacyBadgeIdMap[key] || key;
    if (!(newKey in out) || (value && !out[newKey])) {
      out[newKey] = value;
    }
  }
  return out;
}

// 2 geçişli değerlendirme:
//  1) Star ailesi hariç kazanımları topla
//  2) Star ailesi yüzde üzerinden ek
export function evaluateBadges(snapshot) {
  const unlocked = [];
  const nonStar = BADGE_CATALOG.filter(b => b.family !== 'star');
  for (const b of nonStar) {
    try { if (b.check(snapshot)) unlocked.push(b.id); } catch { /* ignore */ }
  }
  // Yıldız ailesi: kazanılan / toplam yüzdesi
  const total = BADGE_CATALOG.length;
  const pct = Math.round((unlocked.length / total) * 100);
  const enriched = { ...snapshot, badgePercent: pct };
  for (const b of BADGE_CATALOG.filter(x => x.family === 'star')) {
    try { if (b.check(enriched)) unlocked.push(b.id); } catch { /* ignore */ }
  }
  return unlocked;
}

export function getBadgeById(id) {
  if (!id) return null;
  const canonical = legacyBadgeIdMap[id] || id;
  return BADGE_CATALOG.find(b => b.id === canonical) || null;
}

export function getFamily(id) {
  return BADGE_FAMILIES.find(f => f.id === id) || null;
}

export function getFamilyTone(familyId) {
  return FAMILY_TONE[familyId] || '#16A34A';
}

// Geriye uyumluluk — eski kodun `BADGE_GROUPS` import'larını kırmamak için
export const BADGE_GROUPS = BADGE_FAMILIES.map(f => ({ id: f.id, label: f.label }));

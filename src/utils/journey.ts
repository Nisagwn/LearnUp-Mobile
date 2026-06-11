// Doğal Yolculuk — Harita ekranı için durak listesi üretici.
// 8 seviye anıtı + her seviye arasında 3 ara durak (2 XP barajı + 1 rozet kapısı) = 29 durak.
// Yön: alttan üste (Lv 1 alt, Lv 8 zirve).

import { LEVELS } from './levelSystem';
import { BADGE_CATALOG } from './badges';

export type StationKind = 'level' | 'badge' | 'checkpoint';

export type Station = {
  id: string;
  kind: StationKind;
  /** Duraktaki "şart" — correctAnswers cinsi eşik (level/checkpoint) ya da rozet doğal eşiği (badge). */
  threshold: number;
  /** Görünür sıra (0 = en üst zirve). */
  order: number;
  label: string;
  subLabel?: string;
  emoji: string;
  /** Tema gradient anahtarı — JourneyStation'da `gradients[gradKey]` olarak kullanılır. */
  gradKey: 'success' | 'mint' | 'ocean' | 'grape' | 'sunset' | 'league' | 'brand';
  isUnlocked: boolean;
  isCurrent: boolean;
  /** Sadece badge variant için */
  badgeId?: string;
};

type Snapshot = {
  correctAnswers: number;
  level: number;
  unlockedBadgeIds: Set<string>;
};

/**
 * Her seviye arası için 1 ara rozet seçer:
 *  Lv1→Lv2 : seed_3       (3 günlük seri)
 *  Lv2→Lv3 : drop_25      (25 soru)
 *  Lv3→Lv4 : sprout_7     (7 günlük seri)
 *  Lv4→Lv5 : rain_100     (100 soru)
 *  Lv5→Lv6 : bloom_80     (1 konu %80)
 *  Lv6→Lv7 : sapling_30   (30 günlük seri)
 *  Lv7→Lv8 : river_500    (500 soru)
 */
const BADGES_BETWEEN_LEVELS = [
  'seed_3',
  'drop_25',
  'sprout_7',
  'rain_100',
  'bloom_80',
  'sapling_30',
  'river_500',
];

/**
 * Yolu oluşturur. Reverse order: alt = Lv1 (en yüksek order), üst = Lv8 zirve (order 0).
 * order: 0 (üst) ... N-1 (alt)
 */
export function buildJourney(snapshot: Snapshot): Station[] {
  const stations: Omit<Station, 'order' | 'isUnlocked' | 'isCurrent'>[] = [];

  // İlk durak: Lv 1 (en alttaki)
  stations.push({
    id: 'level_1',
    kind: 'level',
    threshold: LEVELS[0].min,
    label: `Lv 1 · ${LEVELS[0].name}`,
    subLabel: 'Yolculuğun başlangıcı',
    emoji: LEVELS[0].emoji,
    gradKey: 'mint',
  });

  // Lv 1 → Lv 2 → ... → Lv 8 arasında ara duraklar + level milestone
  for (let i = 0; i < LEVELS.length - 1; i++) {
    const cur = LEVELS[i];
    const nxt = LEVELS[i + 1];
    const span = nxt.min - cur.min; // örn Lv1→Lv2: 5-0=5

    // 3 ara durak: k = 1, 2, 3 (4'e bölünmüş aralık)
    for (let k = 1; k <= 3; k++) {
      const t = cur.min + Math.round((span * k) / 4);
      if (k === 1) {
        stations.push({
          id: `cp_${i + 1}_a`,
          kind: 'checkpoint',
          threshold: t,
          label: `${t} doğru`,
          subLabel: 'Çiy damlası',
          emoji: '💧',
          gradKey: 'ocean',
        });
      } else if (k === 2) {
        // Rozet kapısı
        const badgeId = BADGES_BETWEEN_LEVELS[i];
        const badge = BADGE_CATALOG.find((b) => b.id === badgeId);
        stations.push({
          id: `bg_${badgeId}`,
          kind: 'badge',
          threshold: t,
          label: badge?.name || 'Rozet',
          subLabel: badge?.desc,
          emoji: badge?.emoji || '🏅',
          gradKey: 'sunset',
          badgeId,
        });
      } else {
        stations.push({
          id: `cp_${i + 1}_b`,
          kind: 'checkpoint',
          threshold: t,
          label: `${t} doğru`,
          subLabel: 'Yaprak',
          emoji: '🍃',
          gradKey: 'mint',
        });
      }
    }

    // Bir sonraki seviye anıtı
    stations.push({
      id: `level_${nxt.level}`,
      kind: 'level',
      threshold: nxt.min,
      label: `Lv ${nxt.level} · ${nxt.name}`,
      subLabel: nxt.desc,
      emoji: nxt.emoji,
      gradKey: nxt.level === LEVELS.length ? 'league' : 'success',
    });
  }

  // Mevcut konumu hesapla — kullanıcının correctAnswers'ı geçtiği duraklar unlocked,
  // hemen üstündeki ulaşılamayan ilk durak "current".
  const totalCount = stations.length;
  const correct = snapshot.correctAnswers;

  // Sıralama — alt = Lv1 (büyük order), üst = Lv8 (order 0)
  const ordered = stations.map((s, idx) => ({
    ...s,
    order: totalCount - 1 - idx, // ters: ilk eklenen (Lv1) en büyük order'a sahip → alt
  }));

  // unlocked & current — sıra natural insert sırası (Lv1 → Lv8)
  let currentIdx = -1;
  const enriched: Station[] = ordered.map((s, idx) => {
    let isUnlocked = false;
    if (s.kind === 'badge' && s.badgeId) {
      isUnlocked = snapshot.unlockedBadgeIds.has(s.badgeId);
    } else {
      isUnlocked = correct >= s.threshold;
    }
    return { ...s, isUnlocked, isCurrent: false } as Station;
  });

  // Current = en yüksek index'te isUnlocked olan + 1 (bir sonraki ulaşılamayan)
  for (let i = enriched.length - 1; i >= 0; i--) {
    if (enriched[i].isUnlocked) {
      currentIdx = Math.min(enriched.length - 1, i + 1);
      break;
    }
  }
  if (currentIdx === -1) currentIdx = 0; // hiç açılmadıysa Lv1
  if (currentIdx >= 0 && currentIdx < enriched.length) {
    enriched[currentIdx].isCurrent = true;
  }

  // Order'a göre sırala (0=zirve üstte, max=Lv1 altta) — render aşağıdan yukarıya
  enriched.sort((a, b) => a.order - b.order);

  return enriched;
}

/**
 * `unlockedMap`'i `unlockedBadgeIds` Set'ine çevirir. Eski ID'leri normalize etmez,
 * çağıran taraf `normalizeUnlockedMap` ile geçer.
 */
export function toBadgeIdSet(
  unlocked: Record<string, unknown> | undefined,
): Set<string> {
  return new Set(Object.keys(unlocked || {}));
}

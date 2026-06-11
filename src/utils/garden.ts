/**
 * Bahçe lifecycle yardımcıları — saf modül (React/Firestore importu yok).
 * Hem frontend (UI hesabı) hem ileride Cloud Function backend kullanır.
 *
 * v2: Grid (row/col) → Serbest yerleştirme (x/y).
 */

import { getItemById, type MarketItem } from '@/constants/marketCatalog';

export type PlantStage = 'seed' | 'sprout' | 'young' | 'mature';
export type PlantStatus = 'healthy' | 'wilted' | 'dead';

export type GardenPlant = {
  plantId: string;
  itemId: string;
  /** Canvas px koordinatları (0..canvasW × 0..canvasH) */
  x: number;
  y: number;
  stage: PlantStage;
  /** epoch ms */
  plantedAt: number;
  /** epoch ms */
  lastWateredAt: number;
  status: PlantStatus;
  /**
   * Görsel boyut çarpanı — kullanıcı pinch ile ayarlar.
   * Default 1.0; clamp range: [PLANT_SCALE_MIN, PLANT_SCALE_MAX].
   */
  scale?: number;
};

/** Pinch boyut sınırları — geniş aralık: gerçekten küçültülebilir + dengeli büyütme. */
export const PLANT_SCALE_MIN = 0.4;
export const PLANT_SCALE_MAX = 1.6;
export const PLANT_SCALE_DEFAULT = 1.0;

export function clampScale(s: number): number {
  if (!Number.isFinite(s)) return PLANT_SCALE_DEFAULT;
  return Math.max(PLANT_SCALE_MIN, Math.min(PLANT_SCALE_MAX, s));
}

/** Evre eşikleri — total growthSeconds'a göre oran. */
const STAGE_RATIOS = {
  sprout: 0.17,
  young: 0.5,
  mature: 1.0,
} as const;

export function computeStage(plant: GardenPlant, now: number = Date.now()): PlantStage {
  const item = getItemById(plant.itemId);
  if (!item) return plant.stage;
  if (item.form === 'mature') return 'mature';
  if (item.eternal) return 'mature';

  const growthMs = (item.growthSeconds ?? 6 * 24 * 60 * 60) * 1000;
  const elapsed = now - plant.plantedAt;
  const ratio = Math.min(1, elapsed / growthMs);

  if (ratio >= STAGE_RATIOS.mature) return 'mature';
  if (ratio >= STAGE_RATIOS.young) return 'young';
  if (ratio >= STAGE_RATIOS.sprout) return 'sprout';
  return 'seed';
}

export function nextStageETA(
  plant: GardenPlant,
  now: number = Date.now(),
): { stage: PlantStage | null; ms: number } {
  const item = getItemById(plant.itemId);
  if (!item || item.form === 'mature' || item.eternal) {
    return { stage: null, ms: 0 };
  }
  const growthMs = (item.growthSeconds ?? 6 * 24 * 60 * 60) * 1000;
  const elapsed = now - plant.plantedAt;
  const ratio = elapsed / growthMs;

  if (ratio < STAGE_RATIOS.sprout) {
    return { stage: 'sprout', ms: growthMs * STAGE_RATIOS.sprout - elapsed };
  }
  if (ratio < STAGE_RATIOS.young) {
    return { stage: 'young', ms: growthMs * STAGE_RATIOS.young - elapsed };
  }
  if (ratio < STAGE_RATIOS.mature) {
    return { stage: 'mature', ms: growthMs * STAGE_RATIOS.mature - elapsed };
  }
  return { stage: null, ms: 0 };
}

/**
 * Su mekaniği kaldırıldı — bitki durumu artık her zaman 'healthy'.
 * Fonksiyon backward-compat için tutuldu ama sabit değer döndürür.
 */
export function computeStatus(
  _plant: GardenPlant,
  _now: number = Date.now(),
): PlantStatus {
  return 'healthy';
}

// ============================
// v2: Serbest Yerleştirme (x/y)
// ============================

/** Canvas içinde min padding (kenara yapışmayı engeller). */
export const CANVAS_PADDING = 24;

/** Bir bitki/cottage'ın canvas sınırlarına yapışması. */
export function clampPosition(
  x: number,
  y: number,
  canvasW: number,
  canvasH: number,
  pad: number = CANVAS_PADDING,
): { x: number; y: number } {
  return {
    x: Math.max(pad, Math.min(canvasW - pad, x)),
    y: Math.max(pad, Math.min(canvasH - pad, y)),
  };
}

/**
 * Yeni dikim için verilen (x,y) noktası mevcut bitkilere çok yakınsa
 * spiral arama ile boş bir alternatif döndürür.
 *
 * Plant scale verilirse (büyük plant'lar yakınlık eşiğini artırır):
 * eşik = minDist × max(1, otherScale).
 */
export function findFreePosition(
  plants: Array<{ x: number; y: number; scale?: number }>,
  x: number,
  y: number,
  canvasW: number,
  canvasH: number,
  minDist: number = 38,
): { x: number; y: number } {
  const tooClose = (tx: number, ty: number) =>
    plants.some((p) => Math.hypot(p.x - tx, p.y - ty) < minDist * Math.max(1, p.scale ?? 1));

  if (!tooClose(x, y)) {
    return clampPosition(x, y, canvasW, canvasH);
  }

  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  for (const offset of [minDist, minDist * 1.6, minDist * 2.3, minDist * 3]) {
    for (const a of angles) {
      const tx = x + offset * Math.cos((a * Math.PI) / 180);
      const ty = y + offset * Math.sin((a * Math.PI) / 180);
      const clamped = clampPosition(tx, ty, canvasW, canvasH);
      if (!tooClose(clamped.x, clamped.y)) return clamped;
    }
  }
  return clampPosition(x, y, canvasW, canvasH);
}

/**
 * Legacy row/col mapping migration. Eski plant dokümanları için.
 * 60px slot varsayımı ile yaklaşık piksel konumu üretir.
 */
export function legacyRowColToXY(
  row: number,
  col: number,
  canvasW: number = 320,
  canvasH: number = 480,
): { x: number; y: number } {
  const SLOT = 60;
  const x = Math.min(canvasW - CANVAS_PADDING, col * SLOT + SLOT / 2 + CANVAS_PADDING);
  const y = Math.min(canvasH - CANVAS_PADDING, row * SLOT + SLOT / 2 + CANVAS_PADDING);
  return { x, y };
}

/**
 * Çayır arka planı için deterministik dekoratif obje dağılımı.
 * SVG render'da meadow backdrop kullanır.
 */
export type MeadowDecorType = 'stone' | 'mushroom' | 'log' | 'dandelion' | 'shadow';

export function meadowDecor(
  canvasW: number,
  canvasH: number,
  count: number = 24,
): Array<{ x: number; y: number; type: MeadowDecorType; seed: number }> {
  const items: Array<{ x: number; y: number; type: MeadowDecorType; seed: number }> = [];
  const types: MeadowDecorType[] = ['stone', 'mushroom', 'log', 'dandelion', 'shadow'];
  for (let i = 0; i < count; i++) {
    const seed = i * 137 + 11;
    const x = ((seed * 17) % Math.max(1, canvasW - CANVAS_PADDING * 2)) + CANVAS_PADDING;
    const y = ((seed * 23) % Math.max(1, canvasH - CANVAS_PADDING * 2)) + CANVAS_PADDING;
    const type = types[seed % types.length];
    items.push({ x, y, type, seed });
  }
  return items;
}

export function canPurchaseItem(
  item: MarketItem,
  context: {
    coins: number;
    level: number;
    unlockedBadgeIds: Set<string>;
  },
): { ok: boolean; reason?: string } {
  if (item.unlockBadge && !context.unlockedBadgeIds.has(item.unlockBadge)) {
    return { ok: false, reason: 'Rozet gerekli' };
  }
  if (item.unlockLevel && context.level < item.unlockLevel) {
    return { ok: false, reason: `Seviye ${item.unlockLevel} gerekli` };
  }
  if (context.coins < item.price) {
    return { ok: false, reason: 'Yetersiz altın' };
  }
  return { ok: true };
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'şimdi';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}g ${hours}s`;
  if (hours > 0) return `${hours}s ${mins}d`;
  return `${mins} dk`;
}

export function plantTooltipETA(plant: GardenPlant, now: number = Date.now()): string {
  const { ms, stage } = nextStageETA(plant, now);
  if (!stage) return 'Olgun';
  const stageName: Record<PlantStage, string> = {
    seed: 'Tohum',
    sprout: 'Filiz',
    young: 'Genç',
    mature: 'Olgun',
  };
  return `${stageName[stage]} → ${formatDuration(ms)}`;
}

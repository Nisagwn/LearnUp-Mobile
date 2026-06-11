/**
 * Orman Oyunu Market Kataloğu — sadeleştirilmiş dekorasyon ekonomisi.
 *
 * Su mekaniği KALDIRILDI. Tüm item'lar `eternal: true` — solmaz, sulama yok.
 * Sadece kullanıcı dekor ekleyip ormanını tasarlar (Hay Day farm değil, decor).
 *
 * Her ağaç tipi 2 form'da satılır:
 *   - 'seed'   → ucuz, ekildikten sonra 6-9 günde olgunlaşır (büyüme animasyonu)
 *   - 'mature' → ~5× pahalı, slot'a direkt olgun stage'de düşer (instant dekor)
 *
 * Nadirlik renkleri palette token'larıyla uyumlu:
 *   common    → success yeşil  (#16A34A)
 *   uncommon  → ocean turkuaz   (#22D3EE)
 *   rare      → grape mor        (#84CC16)
 *   epic      → sunset pembe     (#FB923C)
 *   legendary → league altın     (#FBBF24)
 *
 * NOT: Ağaç türleri ve PNG görselleri `treeAssets.ts`'te tanımlanır; bu dosya
 * o tanımları okuyup `MarketItem`'a dönüştürür. Yeni bir ağaç eklemek için
 * sadece `treeAssets.ts` düzenlenir.
 */

import { TREE_DEFINITIONS, DECOR_IMAGES } from './treeAssets';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemKind = 'seed' | 'flower' | 'tree' | 'decor' | 'special';
export type ItemForm = 'seed' | 'mature';
export type PlantCategory = 'flower' | 'tree';

export type MarketItem = {
  id: string;
  /** Mantıksal grup (UI segmented control'de kullanılır). */
  kind: ItemKind;
  /** Bitki için tohum mu olgun bitki mi (yalnızca kind=seed|flower|tree için). */
  form?: ItemForm;
  /** Plant ise bitki tipi (tohum + olgun aynı plantType paylaşır). */
  plantType?: string;
  category?: PlantCategory;
  name: string;
  emoji: string;
  description: string;
  /** Altın fiyatı. */
  price: number;
  rarity: Rarity;
  /**
   * Tohum ekildiğinde olgunlaşma süresi (saniye). Mature satın alımında
   * lifecycle göz ardı edilir (zaten olgun stage'de slot'a düşer).
   */
  growthSeconds?: number;
  /** Bu item yalnızca belirtilen rozet kazanıldıysa satın alınabilir. */
  unlockBadge?: string;
  /** Belirli seviye gerektirir (varsa). */
  unlockLevel?: number;
  /** Su gerektirmeyen ölümsüz dekor bitki/item. */
  eternal?: boolean;
};

const DAY = 24 * 60 * 60;

// =================================================================
// AĞAÇLAR — tek bitki kaynağı. Tanımlar treeAssets.ts'te (PNG kütüphanesi).
// Çiçekler tamamen kaldırıldı; orman oyununda sadece kullanıcı assetlerinden
// gelen ağaçlar satılır.
// =================================================================
const PLANT_BASES = TREE_DEFINITIONS.map((t) => ({
  plantType: t.plantType,
  category: 'tree' as const,
  name: t.name,
  emoji: t.emoji,
  rarity: t.rarity,
  growthSeconds: t.growthSeconds,
  ...(t.unlockBadge ? { unlockBadge: t.unlockBadge } : {}),
  ...(t.unlockLevel ? { unlockLevel: t.unlockLevel } : {}),
}));

/**
 * Nadirlik → temel tohum fiyatı tablosu.
 * Olgun bitki fiyatı tohum × 5 (5 günlük sabır karşılığı).
 */
const SEED_PRICE: Record<Rarity, number> = {
  common: 20,
  uncommon: 50,
  rare: 120,
  epic: 300,
  legendary: 800,
};
const MATURE_MULTIPLIER = 5;

function descSeed(name: string, growthDays: number, rarity: Rarity): string {
  const days = Math.round(growthDays);
  return `${name} tohumu — ${days} günde olgunlaşır. ${rarity === 'epic' || rarity === 'legendary' ? 'Nadir görülen bir hazine.' : 'Ormanına yumuşak başlangıç.'}`;
}
function descMature(name: string): string {
  return `Olgun ${name} — slota direkt olgun olarak düşer. Bakım gerektirmez.`;
}

// Plant item'ları üret — hepsi eternal:true (su mekaniği kaldırıldı)
const PLANT_ITEMS: MarketItem[] = PLANT_BASES.flatMap((base) => {
  const seedPrice = SEED_PRICE[base.rarity];
  const maturePrice = seedPrice * MATURE_MULTIPLIER;
  return [
    {
      id: `${base.plantType}_seed`,
      kind: 'seed',
      form: 'seed',
      plantType: base.plantType,
      category: base.category,
      name: `${base.name} Tohumu`,
      emoji: '🌱',
      description: descSeed(base.name, (base.growthSeconds ?? 6 * DAY) / DAY, base.rarity),
      price: seedPrice,
      rarity: base.rarity,
      growthSeconds: base.growthSeconds,
      eternal: true,
      ...('unlockBadge' in base && base.unlockBadge ? { unlockBadge: base.unlockBadge } : {}),
    } as MarketItem,
    {
      id: `${base.plantType}_mature`,
      kind: 'tree',
      form: 'mature',
      plantType: base.plantType,
      category: base.category,
      name: `Olgun ${base.name}`,
      emoji: base.emoji,
      description: descMature(base.name),
      price: maturePrice,
      rarity: base.rarity,
      eternal: true,
      ...('unlockBadge' in base && base.unlockBadge ? { unlockBadge: base.unlockBadge } : {}),
    } as MarketItem,
  ];
});

// =================================================================
// DEKOR (sulama gerektirmez, kalıcı)
// Eski emoji dekorları + yeni PNG dekorları (mantarlar, totemler, gazebo).
// =================================================================
const DECOR_ITEMS: MarketItem[] = [
  // ─── Yeni PNG dekorlar — assets/garden/trees/ kütüphanesinden ───
  {
    id: 'decor_mushroom_red_lg',
    kind: 'decor',
    name: 'Sinek Mantarı (Büyük)',
    emoji: '🍄',
    description: 'Beyaz benekli kırmızı büyük mantar — orman gözcüsü.',
    price: 150,
    rarity: 'epic',
    eternal: true,
  },
  {
    id: 'decor_mushroom_red_md',
    kind: 'decor',
    name: 'Sinek Mantarı (Orta)',
    emoji: '🍄',
    description: 'Beyaz benekli kırmızı mantar.',
    price: 90,
    rarity: 'rare',
    eternal: true,
  },
  {
    id: 'decor_mushroom_red_sm',
    kind: 'decor',
    name: 'Sinek Mantarı (Küçük)',
    emoji: '🍄',
    description: 'Küçük benekli kırmızı mantar.',
    price: 30,
    rarity: 'common',
    eternal: true,
  },
  {
    id: 'decor_mushroom_chanterelle_lg',
    kind: 'decor',
    name: 'Horoz Mantarı (Büyük)',
    emoji: '🟡',
    description: 'Altın sarısı büyük horoz mantarı grubu.',
    price: 50,
    rarity: 'uncommon',
    eternal: true,
  },
  {
    id: 'decor_mushroom_chanterelle_md',
    kind: 'decor',
    name: 'Horoz Mantarı (Orta)',
    emoji: '🟡',
    description: 'Sarı horoz mantarı.',
    price: 35,
    rarity: 'common',
    eternal: true,
  },
  {
    id: 'decor_mushroom_chanterelle_sm',
    kind: 'decor',
    name: 'Horoz Mantarı (Küçük)',
    emoji: '🟡',
    description: 'Küçük horoz mantarı.',
    price: 20,
    rarity: 'common',
    eternal: true,
  },
  {
    id: 'decor_mushroom_beige',
    kind: 'decor',
    name: 'Yeşilimsi Mantar',
    emoji: '🟢',
    description: 'Bej-yeşil orman mantarı.',
    price: 25,
    rarity: 'common',
    eternal: true,
  },
  {
    id: 'decor_idol_deer',
    kind: 'decor',
    name: 'Geyik Totem',
    emoji: '🦌',
    description: 'Geyik figürlü kadim ağaç totemi.',
    price: 100,
    rarity: 'rare',
    eternal: true,
  },
  {
    id: 'decor_idol_human',
    kind: 'decor',
    name: 'İnsan Totem',
    emoji: '🗿',
    description: 'İnsan figürlü ağaç totemi.',
    price: 100,
    rarity: 'rare',
    eternal: true,
  },
  {
    id: 'decor_idol_wolf',
    kind: 'decor',
    name: 'Kurt Totem',
    emoji: '🐺',
    description: 'Kurt figürlü ağaç totemi.',
    price: 100,
    rarity: 'rare',
    eternal: true,
  },
  {
    id: 'decor_idol_dragon',
    kind: 'decor',
    name: 'Ejder Totem',
    emoji: '🐉',
    description: 'Ejderha figürlü efsane totem.',
    price: 180,
    rarity: 'epic',
    eternal: true,
  },
  {
    id: 'decor_gazebo_v1',
    kind: 'decor',
    name: 'Yaşayan Gazebo I',
    emoji: '⛺',
    description: 'Canlı dallardan örülmüş gölgelik.',
    price: 200,
    rarity: 'rare',
    eternal: true,
  },
  {
    id: 'decor_gazebo_v2',
    kind: 'decor',
    name: 'Yaşayan Gazebo II',
    emoji: '⛺',
    description: 'Büyük yaşayan gazebo — orman tapınağı.',
    price: 320,
    rarity: 'epic',
    eternal: true,
  },

  // ─── Eski emoji dekorlar (geriye dönük koruma) ───
  {
    id: 'decor_fence',
    kind: 'decor',
    name: 'Tahta Çit',
    emoji: '🟫',
    description: 'Bahçeni şık bir çitle çevre.',
    price: 15,
    rarity: 'common',
    eternal: true,
  },
  {
    id: 'decor_stone',
    kind: 'decor',
    name: 'Çakıl Yol',
    emoji: '🪨',
    description: 'Bahçenin içinde yürünebilir bir patika.',
    price: 25,
    rarity: 'common',
    eternal: true,
  },
  {
    id: 'decor_lantern',
    kind: 'decor',
    name: 'Bahçe Feneri',
    emoji: '🏮',
    description: 'Geceleri yumuşak bir ışıkla bahçeni aydınlatır.',
    price: 60,
    rarity: 'uncommon',
    eternal: true,
  },
  {
    id: 'decor_bench',
    kind: 'decor',
    name: 'Ahşap Bank',
    emoji: '🪑',
    description: 'Bahçenin ortasında oturma alanı.',
    price: 80,
    rarity: 'uncommon',
    eternal: true,
  },
  {
    id: 'decor_birdhouse',
    kind: 'decor',
    name: 'Kuş Yuvası',
    emoji: '🐦',
    description: 'Bahçene misafir kuşlar çağırır.',
    price: 100,
    rarity: 'rare',
    eternal: true,
  },
  {
    id: 'decor_mushroom',
    kind: 'decor',
    name: 'Süs Mantarı',
    emoji: '🍄',
    description: 'Renkli süs mantarı — küçük masalsı detay.',
    price: 40,
    rarity: 'uncommon',
    eternal: true,
  },
];

// =================================================================
// ÖZEL ITEM'LAR — sadece kalıcı dekor karakterler kaldı (su tılsımı + gübre
// kaldırıldı çünkü su mekaniği yok).
// =================================================================
const SPECIAL_ITEMS: MarketItem[] = [
  {
    id: 'special_ent_male',
    kind: 'special',
    name: 'Erkek Orman Cini',
    emoji: '🌳',
    description: 'Ormanın kadim koruyucusu — kalıcı dekor.',
    price: 500,
    rarity: 'legendary',
    eternal: true,
  },
  {
    id: 'special_ent_female',
    kind: 'special',
    name: 'Dişi Orman Cini',
    emoji: '🌳',
    description: 'Ormanın kadim koruyucusu — kalıcı dekor.',
    price: 500,
    rarity: 'legendary',
    eternal: true,
  },
];

// =================================================================
// EXPORT
// =================================================================
export const MARKET_ITEMS: MarketItem[] = [
  ...PLANT_ITEMS,
  ...DECOR_ITEMS,
  ...SPECIAL_ITEMS,
];

/**
 * UI'da gösterilen item'lar.
 *
 * Filtreler:
 *   1. Tohum (kind='seed') gizlenir — su mekaniği yok, tohum/olgun ayrımı
 *      gereksiz karmaşa.
 *   2. PNG görseli OLMAYAN dekor gizlenir — kullanıcı ormana ekleyemediği
 *      item'ı satın almasın. Eski emoji-only dekorlar (tahta çit, fener,
 *      bank, kuş yuvası vs.) artık market'te görünmez.
 *
 * MARKET_ITEMS katalog'ta bu item'lar korunuyor → eski envanter `getItemById`
 * ile hala resolve oluyor (kırılma yok).
 */
const PNG_AVAILABLE = new Set<string>([
  ...Object.keys(DECOR_IMAGES),
  // Tüm tree definitions her zaman PNG'lidir (pickItemImage plantType ile alır)
  ...TREE_DEFINITIONS.map((t) => `${t.plantType}_mature`),
  ...TREE_DEFINITIONS.map((t) => `${t.plantType}_seed`),
]);

export const MARKET_DISPLAY_ITEMS: MarketItem[] = MARKET_ITEMS.filter((it) => {
  if (it.kind === 'seed') return false;
  // Ağaçlar plantType ile resolve eder (id'leri PNG_AVAILABLE'de),
  // dekor + özel item'ların id'si DECOR_IMAGES'te olmalı.
  return PNG_AVAILABLE.has(it.id);
});

/** Hafif filtre çipleri — yatay tek satırda 4 chip. Kategori bölümü YOK. */
export const MARKET_FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'tree', label: 'Ağaç' },
  { id: 'decor', label: 'Dekor' },
  { id: 'special', label: 'Özel' },
] as const;

export type MarketFilterId = (typeof MARKET_FILTERS)[number]['id'];

export function filterMarketItems(filter: MarketFilterId): MarketItem[] {
  if (filter === 'all') return MARKET_DISPLAY_ITEMS;
  return MARKET_DISPLAY_ITEMS.filter((it) => it.kind === filter);
}

export function getItemById(id: string): MarketItem | undefined {
  return MARKET_ITEMS.find((it) => it.id === id);
}

/** Nadirlik için renk tonları — UI consumer için. */
export const RARITY_TONE: Record<Rarity, { fg: string; soft: string; label: string }> = {
  common:    { fg: '#16A34A', soft: '#DCFCE7', label: 'Yaygın' },
  uncommon:  { fg: '#22D3EE', soft: '#CFFAFE', label: 'Sıra Dışı' },
  rare:      { fg: '#84CC16', soft: '#EDE9FE', label: 'Nadir' },
  epic:      { fg: '#FB923C', soft: '#FCE7F3', label: 'Epik' },
  legendary: { fg: '#FBBF24', soft: '#FEF3C7', label: 'Efsane' },
};

/** Aynı plant tipinin tohum + olgun varyantlarını döndürür. */
export function getPlantForms(plantType: string): { seed?: MarketItem; mature?: MarketItem } {
  return {
    seed: MARKET_ITEMS.find((it) => it.plantType === plantType && it.form === 'seed'),
    mature: MARKET_ITEMS.find((it) => it.plantType === plantType && it.form === 'mature'),
  };
}

/** Tüm bitki tiplerinin listesi (renderer için). */
export const PLANT_TYPES = PLANT_BASES.map((b) => b.plantType);

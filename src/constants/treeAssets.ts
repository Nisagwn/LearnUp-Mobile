/**
 * Orman oyunu — ağaç PNG kayıt defteri.
 *
 * Tek doğruluk kaynağı: bir ağaç türünün adı, fiyatı, nadirliği ve büyüme
 * evrelerine ait görselleri burada tanımlanır. `marketCatalog.ts` bu listeden
 * MarketItem üretir; `PlantRenderer` `pickTreeImage` ile uygun evreyi seçer.
 *
 * Varlıklar: `assets/garden/trees/` altında, kütüphanenin orijinal dosya
 * adlarıyla bırakıldı — rename gerekmez.
 *
 * Evre eşleme stratejisi:
 *   - 4 varyantı olan ağaçlar (Luminous) → seed / sprout / young / mature
 *   - 3 varyantı olanlar → sprout / young / mature (seed = sprout)
 *   - 2 varyantı olanlar → young / mature (seed/sprout = young)
 *
 * Bir evre kayıtlı değilse `pickTreeImage` üst evreye yakınsar; her ağaç en
 * azından `mature` taşımalıdır (registry doğrulaması garanti eder).
 */

import type { ImageSourcePropType } from 'react-native';
import type { PlantStage } from '@/utils/garden';
import type { Rarity } from './marketCatalog';

export type TreeStageImages = Partial<Record<PlantStage, ImageSourcePropType>>;

export interface TreeDefinition {
  plantType: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  /** Olgunlaşma süresi (saniye). */
  growthSeconds: number;
  unlockBadge?: string;
  unlockLevel?: number;
  /** Evre → PNG eşlemesi. En az `mature` zorunlu. */
  images: TreeStageImages;
}

const DAY = 24 * 60 * 60;

export const TREE_DEFINITIONS: TreeDefinition[] = [
  // ────────────── 3 evre — common ──────────────
  {
    plantType: 'sogut',
    name: 'Söğüt',
    emoji: '🌿',
    rarity: 'common',
    growthSeconds: 8 * DAY,
    images: {
      sprout: require('../../assets/garden/trees/Willow1.png'),
      young: require('../../assets/garden/trees/Willow2.png'),
      mature: require('../../assets/garden/trees/Willow3.png'),
    },
  },
  // ────────────── 2 evre — common ──────────────
  {
    plantType: 'akca_agac',
    name: 'Akça Ağaç',
    emoji: '🌳',
    rarity: 'common',
    growthSeconds: 7 * DAY,
    images: {
      young: require('../../assets/garden/trees/White_tree1.png'),
      mature: require('../../assets/garden/trees/White_tree2.png'),
    },
  },
  // ────────────── 3 evre — uncommon ──────────────
  {
    plantType: 'mavi_cam',
    name: 'Mavi Çam',
    emoji: '🌲',
    rarity: 'uncommon',
    growthSeconds: 9 * DAY,
    images: {
      sprout: require('../../assets/garden/trees/Blue-green_balls_tree1.png'),
      young: require('../../assets/garden/trees/Blue-green_balls_tree2.png'),
      mature: require('../../assets/garden/trees/Blue-green_balls_tree3.png'),
    },
  },
  {
    plantType: 'egri_agac',
    name: 'Eğri Ağaç',
    emoji: '🪵',
    rarity: 'uncommon',
    growthSeconds: 9 * DAY,
    images: {
      sprout: require('../../assets/garden/trees/Curved_tree1.png'),
      young: require('../../assets/garden/trees/Curved_tree2.png'),
      mature: require('../../assets/garden/trees/Curved_tree3.png'),
    },
  },
  // ────────────── 2 evre — rare ──────────────
  {
    plantType: 'dev_agac',
    name: 'Dev Ağaç',
    emoji: '🌳',
    rarity: 'rare',
    growthSeconds: 11 * DAY,
    images: {
      young: require('../../assets/garden/trees/Mega_tree1.png'),
      mature: require('../../assets/garden/trees/Mega_tree2.png'),
    },
  },
  // ────────────── 3 evre — rare ──────────────
  {
    plantType: 'burgu',
    name: 'Burgu Ağacı',
    emoji: '🌀',
    rarity: 'rare',
    growthSeconds: 10 * DAY,
    images: {
      sprout: require('../../assets/garden/trees/Swirling_tree1.png'),
      young: require('../../assets/garden/trees/Swirling_tree2.png'),
      mature: require('../../assets/garden/trees/Swirling_tree3.png'),
    },
  },
  // ────────────── 3 evre — epic ──────────────
  {
    plantType: 'isik_agaci',
    name: 'Işık Ağacı',
    emoji: '✨',
    rarity: 'epic',
    growthSeconds: 12 * DAY,
    unlockBadge: 'bloom_80',
    images: {
      sprout: require('../../assets/garden/trees/Light_balls_tree1.png'),
      young: require('../../assets/garden/trees/Light_balls_tree2.png'),
      mature: require('../../assets/garden/trees/Light_balls_tree3.png'),
    },
  },
  // ────────────── 4 evre — legendary ──────────────
  {
    plantType: 'parilti',
    name: 'Parıltı Ağacı',
    emoji: '🌟',
    rarity: 'legendary',
    growthSeconds: 14 * DAY,
    unlockBadge: 'phoenix',
    images: {
      seed: require('../../assets/garden/trees/Luminous_tree1.png'),
      sprout: require('../../assets/garden/trees/Luminous_tree2.png'),
      young: require('../../assets/garden/trees/Luminous_tree3.png'),
      mature: require('../../assets/garden/trees/Luminous_tree4.png'),
    },
  },
];

const TREE_INDEX: Map<string, TreeDefinition> = new Map(
  TREE_DEFINITIONS.map((t) => [t.plantType, t]),
);

export function getTreeDefinition(plantType: string): TreeDefinition | undefined {
  return TREE_INDEX.get(plantType);
}

/** PlantRenderer'ın çağırdığı fallback'li seçici. */
export function pickTreeImage(
  plantType: string,
  stage: PlantStage,
): ImageSourcePropType | null {
  const def = TREE_INDEX.get(plantType);
  if (!def) return null;
  const { images } = def;
  // Exact match
  if (images[stage]) return images[stage]!;
  // Daha büyük (sonraki) evreye yakınsa — küçük render edilince doğru görünür
  const ORDER: PlantStage[] = ['seed', 'sprout', 'young', 'mature'];
  const idx = ORDER.indexOf(stage);
  for (let i = idx + 1; i < ORDER.length; i++) {
    const s = ORDER[i]!;
    if (images[s]) return images[s]!;
  }
  // Hiçbiri yok — fallback olarak küçük evrelere düş
  for (let i = idx - 1; i >= 0; i--) {
    const s = ORDER[i]!;
    if (images[s]) return images[s]!;
  }
  return null;
}

/** Catalog tarafına bilgisel: kayıtlı ağaç plantType listesi. */
export const TREE_PLANT_TYPES: string[] = TREE_DEFINITIONS.map((t) => t.plantType);

// ════════════════════════════════════════════════════════════════════════════
// DEKOR + ÖZEL ITEM PNG'LERİ (itemId-bazlı, tek görsel)
// Ağaç dışı PNG kütüphane varlıkları — mantarlar, totemler, gazebo, Ent.
// ════════════════════════════════════════════════════════════════════════════

export const DECOR_IMAGES: Record<string, ImageSourcePropType> = {
  // Mantarlar
  decor_mushroom_red_lg:           require('../../assets/garden/trees/White-red_mushroom1.png'),
  decor_mushroom_red_md:           require('../../assets/garden/trees/White-red_mushroom2.png'),
  decor_mushroom_red_sm:           require('../../assets/garden/trees/White-red_mushroom3.png'),
  decor_mushroom_chanterelle_lg:   require('../../assets/garden/trees/Chanterelles1.png'),
  decor_mushroom_chanterelle_md:   require('../../assets/garden/trees/Chanterelles2.png'),
  decor_mushroom_chanterelle_sm:   require('../../assets/garden/trees/Chanterelles3.png'),
  decor_mushroom_beige:            require('../../assets/garden/trees/Beige_green_mushroom3.png'),
  // Totem / idol
  decor_idol_deer:                 require('../../assets/garden/trees/Tree_idol_deer.png'),
  decor_idol_dragon:               require('../../assets/garden/trees/Tree_idol_dragon.png'),
  decor_idol_human:                require('../../assets/garden/trees/Tree_idol_human.png'),
  decor_idol_wolf:                 require('../../assets/garden/trees/Tree_idol_wolf.png'),
  // Yaşayan gazebo
  decor_gazebo_v1:                 require('../../assets/garden/trees/Living_gazebo1.png'),
  decor_gazebo_v2:                 require('../../assets/garden/trees/Living_gazebo2.png'),
  // Ent — özel item (legendary dekor karakter)
  special_ent_male:                require('../../assets/garden/trees/Ent_man.png'),
  special_ent_female:              require('../../assets/garden/trees/Ent_woman.png'),
};

/**
 * Birleşik görsel seçici. Hem ağaçlar (plantType + stage) hem decor/special
 * (itemId) için tek API.
 *
 *   - `item.plantType` varsa: registry'deki ağacın stage'ine göre PNG
 *   - Yoksa: `DECOR_IMAGES[item.id]` — single görsel (eternal/mature)
 *   - İkisi de yoksa null
 */
export function pickItemImage(
  item: { plantType?: string; id?: string },
  stage: PlantStage = 'mature',
): ImageSourcePropType | null {
  if (item.plantType) {
    const treeImg = pickTreeImage(item.plantType, stage);
    if (treeImg) return treeImg;
  }
  if (item.id && DECOR_IMAGES[item.id]) return DECOR_IMAGES[item.id]!;
  return null;
}

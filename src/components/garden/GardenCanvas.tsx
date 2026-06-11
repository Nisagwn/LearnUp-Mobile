import { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useThemeColors } from '@/hooks/useThemeColors';
import { GardenPlantNode } from './GardenPlantNode';
import { GardenEmptyHint } from './GardenEmptyHint';
import type { GardenPlant } from '@/utils/garden';

const FOREST_BG = require('../../../assets/garden/forest_bg.png');

export type ScreenRect = { x: number; y: number; w: number; h: number };

type Props = {
  width: number;
  height: number;
  plants: GardenPlant[];
  editMode: boolean;
  isRainDay?: boolean;
  /** Çöp kutusu drop zone'un ekran absolute koordinatları (worklet'te okunur). */
  trashRectSv: SharedValue<ScreenRect | null>;
  onPlantTap: (plant: GardenPlant) => void;
  onPlantMove: (plantId: string, x: number, y: number) => void;
  onPlantTrash: (plantId: string) => void;
  onDragStateChange: (plantId: string | null) => void;
};

/**
 * Bahçe canvas v4 — Hay Day tarzı katmanlı render.
 *
 * Katmanlar (alttan üste):
 *  - `forest_bg.png` full-cover (gökyüzü + zemin + dağ silüetleri çizilmiş)
 *  - Yağmur modunda hafif mavi tonlu overlay
 *  - ForestShadowLayer — paylaşılan tek Skia Canvas (tüm plant shadow'ları)
 *    Her plant'a ayrı Canvas vermek 30+ plant'ta Skia GL bağlam tükenmesi
 *    yaratıp app crash'e neden oluyordu. Tek Canvas'ta hepsi çizilir.
 *  - Y-sort edilmiş plant'lar — düşük y arkada, yüksek y önde (perspektif)
 *  - Boş ormanda hint kartı
 */
export function GardenCanvas({
  width, height, plants,
  editMode, isRainDay, trashRectSv,
  onPlantTap, onPlantMove, onPlantTrash, onDragStateChange,
}: Props) {
  const { colors } = useThemeColors();

  // Y-sort: y'si küçük olan (canvas üstüne yakın) arkada, büyük olan önde.
  // Plant taşınınca y değişir → useMemo re-compute → render sırası tazelenir.
  const sortedPlants = useMemo(
    () => [...plants].sort((a, b) => a.y - b.y),
    [plants],
  );

  if (width <= 0 || height <= 0) return null;

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: colors.bgBase,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* PNG orman arka planı */}
      <Image
        source={FOREST_BG}
        style={[StyleSheet.absoluteFillObject, { width, height }]}
        resizeMode="cover"
      />

      {/* Yağmur tonu — hafif mavi-mor overlay */}
      {isRainDay ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: '#1E293B', opacity: 0.18 },
          ]}
        />
      ) : null}

      {/* Skia gölge katmanı KALDIRILDI — blur+alpha yeşil çimen üstünde
          turuncuya kayıyor gibi görünüyordu. PNG'ler şeffaf zeminde
          doğrudan duruyor; Hay Day tarzı sade görünüm. */}

      {/* Bitkiler — Y-sort'lu */}
      {sortedPlants.map((p) => (
        <GardenPlantNode
          key={p.plantId}
          plant={p}
          canvasW={width}
          canvasH={height}
          editMode={editMode}
          trashRectSv={trashRectSv}
          onTap={onPlantTap}
          onMoveCommit={onPlantMove}
          onTrash={onPlantTrash}
          onDragStateChange={onDragStateChange}
        />
      ))}

      {/* Boş orman → hint kartı */}
      {plants.length === 0 ? (
        <GardenEmptyHint width={width} height={height} />
      ) : null}
    </View>
  );
}

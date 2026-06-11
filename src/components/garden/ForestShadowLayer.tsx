import { memo } from 'react';
import { Canvas, Group, Oval, BlurMask } from '@shopify/react-native-skia';
import type { GardenPlant } from '@/utils/garden';

type Props = {
  width: number;
  height: number;
  plants: GardenPlant[];
};

const PLANT_SIZE = 60;

/**
 * Paylaşılan Skia gölge katmanı.
 *
 * Önceden her `GardenPlantNode` kendi `<Canvas>` ile drop shadow çiziyordu.
 * 30+ plant → 30+ Skia native context → GL bağlam tükenmesi → SIGSEGV →
 * uygulama ana ekrana atıyordu. Bu bileşen **tek Canvas**'ta tüm gölgeleri
 * tek pass'te çizer. Plant'lar hareket ederken bu katman re-render olur
 * (plants array referansı değişir) ama GL bağlamı tek kalır.
 *
 * `pointerEvents="none"` — touches plant node'larına geçer.
 */
function ForestShadowLayerBase({ width, height, plants }: Props) {
  if (width <= 0 || height <= 0 || plants.length === 0) return null;

  return (
    <Canvas
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
      }}
      pointerEvents="none"
    >
      <Group>
        {plants.map((p) => {
          // Her bitki için yumuşak yer gölgesi
          const rx = PLANT_SIZE * 0.32;
          const ry = PLANT_SIZE * 0.07;
          const cx = p.x;
          const cy = p.y + PLANT_SIZE * 0.36;
          return (
            <Oval
              key={p.plantId}
              x={cx - rx}
              y={cy - ry}
              width={rx * 2}
              height={ry * 2}
              color="#000000"
              opacity={0.35}
            >
              <BlurMask blur={6} style="normal" />
            </Oval>
          );
        })}
      </Group>
    </Canvas>
  );
}

export const ForestShadowLayer = memo(ForestShadowLayerBase);

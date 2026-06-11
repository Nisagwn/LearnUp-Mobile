import { View, Text, Image } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getItemById } from '@/constants/marketCatalog';
import { pickItemImage } from '@/constants/treeAssets';

type Props = {
  emoji: string | null;
  /** Ghost item id'si — varsa PNG önizlemesi çizilir, yoksa emoji'ye düşer. */
  itemId?: string | null;
  color?: string;
  /** Parmak absolute X (screen px) */
  x: SharedValue<number>;
  /** Parmak absolute Y (screen px) */
  y: SharedValue<number>;
};

const GHOST_SIZE = 72;
const IMG_SIZE = 64;

/**
 * Ekran üstünde parmak ucuna kilitlenmiş yarı saydam item önizlemesi.
 * Ağıldan long-press ile sürüklenince görünür.
 *
 * PNG varsa (ağaç/dekor) direkt görsel render edilir — Hay Day tarzı sahici
 * önizleme. PNG yoksa eski yuvarlak emoji rozetine fallback yapılır.
 */
export function DragGhost({ emoji, itemId, color, x, y }: Props) {
  const { colors, gradients } = useThemeColors();

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value - GHOST_SIZE / 2,
    top: y.value - GHOST_SIZE,
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  }));

  if (!emoji && !itemId) return null;

  // PNG'yi item id'sinden çek (ağaç ya da decor)
  const item = itemId ? getItemById(itemId) : null;
  const img = item ? pickItemImage(item, 'mature') : null;

  return (
    <Animated.View style={style} pointerEvents="none">
      {img ? (
        // PNG önizleme — sade, halka yok, opacity yok (kenar halo'su olmasın)
        <Image
          source={img}
          style={{
            width: IMG_SIZE,
            height: IMG_SIZE,
          }}
          resizeMode="contain"
        />
      ) : (
        // Fallback: emoji yuvarlak rozet
        <View
          style={{
            width: GHOST_SIZE,
            height: GHOST_SIZE,
            borderRadius: GHOST_SIZE / 2,
            backgroundColor: color || gradients.success[0],
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.textPrimary,
            shadowOpacity: 0.35,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
            borderWidth: 3,
            borderColor: colors.white,
            opacity: 0.92,
          }}
        >
          <Text style={{ fontSize: 32 }}>{emoji}</Text>
        </View>
      )}
    </Animated.View>
  );
}

import { memo, useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { FloatingLeaf } from './index';

type Props = {
  /** Yaprağın ekran üst başlangıç X konumu. */
  startX: number;
  /** Ekranın yüksekliği — düşme mesafesi. */
  screenHeight: number;
  /** Düşme süresi (saniye). */
  durationSec?: number;
  /** Başlangıç gecikmesi (saniye) — birden çok yaprak organik aksın. */
  delaySec?: number;
  /** Yan-yana sallanma genliği (px). */
  swayAmp?: number;
  size?: number;
  color?: string;
  reducedMotion?: boolean;
};

/**
 * Tek bir düşen yaprak partikül.
 * Yukarıdan aşağı translateY + yatay sin sway + rotate 360°.
 * Düşüş bitince üste teleport, sonsuz loop.
 */
function FallingLeafBase({
  startX,
  screenHeight,
  durationSec = 10,
  delaySec = 0,
  swayAmp = 24,
  size = 16,
  color,
  reducedMotion = false,
}: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    // -delaySec'lik negatif başlangıç = gecikme efekti (her loop'ta delay)
    const totalMs = durationSec * 1000;
    progress.value = withRepeat(
      withTiming(1, {
        duration: totalMs,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [progress, durationSec, reducedMotion]);

  const style = useAnimatedStyle(() => {
    const p = (progress.value + delaySec / durationSec) % 1;
    const y = p * (screenHeight + size * 2) - size;
    const x = startX + Math.sin(p * Math.PI * 4) * swayAmp;
    const rotation = p * 720;
    return {
      position: 'absolute',
      left: x,
      top: y,
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  return (
    <Animated.View style={style} pointerEvents="none">
      <FloatingLeaf size={size} color={color} />
    </Animated.View>
  );
}

export const FallingLeaf = memo(FallingLeafBase);

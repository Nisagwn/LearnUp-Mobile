import { memo, useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Oyun döngüsünün shared value'de tuttuğu gem anlık durumu. */
export type GemItem = { id: number; x: number; opacity: number };

type Props = {
  id: number;
  /** Dikey konum sabittir (spawn anında belirlenir). */
  y: number;
  /** Tüm gem'lerin canlı x + opacity'si — döngüden sürülür. */
  gemSV: SharedValue<GemItem[]>;
  size?: number;
  fill: string;
  stroke: string;
};

/**
 * Engellerin gap'inde beliren toplanabilir XP gem'i.
 * Sürekli döner; x konumu ve toplandığında fade-out `gemSV`'den sürülür →
 * kare-başına React render yok.
 */
function JumpGemBase({ id, y, gemSV, size = 16, fill, stroke }: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1500, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => {
    const arr = gemSV.value;
    let x = -999;
    let op = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        x = arr[i].x;
        op = arr[i].opacity;
        break;
      }
    }
    return {
      opacity: op,
      transform: [{ translateX: x }, { rotateY: `${rotation.value}deg` }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: -size / 2,
          top: y - size / 2,
          width: size,
          height: size,
        },
        animatedStyle,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 16 16">
        {/* Eşkenar dörtgen gem */}
        <Path d="M8 1 L15 8 L8 15 L1 8 Z" fill={fill} stroke={stroke} strokeWidth={1.2} />
        {/* Iç highlight */}
        <Path
          d="M8 3 L6 8 L8 13"
          stroke={stroke}
          strokeWidth={1}
          fill="none"
          opacity={0.7}
        />
      </Svg>
    </Animated.View>
  );
}

export const JumpGem = memo(JumpGemBase);

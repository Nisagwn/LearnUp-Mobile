import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  x: number;
  y: number;
  size?: number;
  /** Velocity'den türetilen tilt açısı (radyan). */
  tilt: number;
  /** Zıplama anında 1 değer artırılır → squash-stretch tetiklenir. */
  jumpTick: number;
};

/**
 * Giriş ekranı oyununun sevimli sarı kuş karakteri.
 * Yuvarlak gövde + gaga + büyük göz + küçük tepe tüyleri.
 */
export function JumpCharacter({ x, y, size = 34, tilt, jumpTick }: Props) {
  const scaleY = useSharedValue(1);
  const scaleX = useSharedValue(1);

  useEffect(() => {
    if (jumpTick === 0) return;
    scaleY.value = withSequence(
      withTiming(0.85, { duration: 90 }),
      withSpring(1, { damping: 6, stiffness: 320 }),
    );
    scaleX.value = withSequence(
      withTiming(1.15, { duration: 90 }),
      withSpring(1, { damping: 6, stiffness: 320 }),
    );
  }, [jumpTick, scaleX, scaleY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${tilt}rad` },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
  }));

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
      }}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            width: size,
            height: size,
            shadowColor: '#92400E',
            shadowOpacity: 0.35,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 34 34">
          {/* Tepe tüyleri */}
          <Path
            d="M14 8 Q15 4 17 7 Q19 3 21 7 Q22 4 23 8"
            stroke="#F59E0B"
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
          />
          {/* Gövde — yuvarlak sarı */}
          <Ellipse
            cx={16}
            cy={19}
            rx={13}
            ry={11}
            fill="#FCD34D"
            stroke="white"
            strokeWidth={1.4}
          />
          {/* Karın — krem */}
          <Ellipse cx={15} cy={23} rx={7.5} ry={5.5} fill="#FEF3C7" />
          {/* Kanat */}
          <Path
            d="M7 17 Q4 22 9 26 Q14 25 13 19 Q11 17 7 17 Z"
            fill="#F59E0B"
            stroke="white"
            strokeWidth={0.8}
          />
          {/* Kanat detay tüyü */}
          <Path
            d="M8 20 Q9 23 12 23"
            stroke="#FBBF24"
            strokeWidth={0.6}
            fill="none"
          />
          {/* Göz beyazı (sağ taraf, kuş sağa bakıyor) */}
          <Circle cx={22} cy={15.5} r={4} fill="white" />
          {/* Pupil */}
          <Circle cx={23} cy={16} r={2} fill="#0F172A" />
          {/* Göz parıltısı */}
          <Circle cx={23.6} cy={15.4} r={0.7} fill="white" />
          {/* Gaga — üst */}
          <Path
            d="M26 17.5 L32 18.5 L26 19.8 Z"
            fill="#F97316"
            stroke="#EA580C"
            strokeWidth={0.5}
            strokeLinejoin="round"
          />
          {/* Gaga — alt */}
          <Path
            d="M26 19.8 L31 20.5 L26 21.5 Z"
            fill="#EA580C"
            strokeLinejoin="round"
          />
          {/* Yanak (pembe blush) */}
          <Circle cx={19.5} cy={20} r={1.6} fill="#FCA5A5" opacity={0.7} />
        </Svg>
      </Animated.View>
    </View>
  );
}

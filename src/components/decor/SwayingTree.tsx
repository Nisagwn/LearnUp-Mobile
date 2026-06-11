import { memo, useEffect } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLG,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  width?: number;
  height?: number;
  variant?: 'pine' | 'oak' | 'birch';
  /** Rüzgar fazı offset (saniye) — birden çok ağaç organik salınsın diye. */
  phaseOffset?: number;
  /** Salınım yoğunluğu (derece). */
  swayDeg?: number;
  /** Ağaç opacity'si — overlay olarak kullanılırken düşük olsun. */
  opacity?: number;
  reducedMotion?: boolean;
};

/**
 * Tek bir SVG ağaç — rüzgarda hafif sallanır.
 * Quiz arka planında yan kenarda decoration olarak kullanılır.
 */
function SwayingTreeBase({
  width = 60,
  height = 220,
  variant = 'pine',
  phaseOffset = 0,
  swayDeg = 2,
  opacity = 0.4,
  reducedMotion = false,
}: Props) {
  const { gradients, colors } = useThemeColors();
  const sway = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    sway.value = withRepeat(
      withSequence(
        withTiming(swayDeg, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-swayDeg, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [sway, swayDeg, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway.value + phaseOffset * (swayDeg / 4)}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          opacity,
          transformOrigin: 'bottom center',
        } as any,
        style,
      ]}
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <SvgLG id={`tr-leaf-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradients.success[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={gradients.forest[1]} stopOpacity="1" />
          </SvgLG>
          <SvgLG id={`tr-trunk-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradients.cedar[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={gradients.cedar[1]} stopOpacity="1" />
          </SvgLG>
        </Defs>

        {variant === 'pine' ? (
          <>
            {/* Gövde */}
            <Rect
              x={width * 0.42}
              y={height * 0.7}
              width={width * 0.16}
              height={height * 0.3}
              fill={`url(#tr-trunk-${variant})`}
            />
            {/* 3 üçgen taç (üstten alta küçükten büyüğe) */}
            <Path
              d={`M ${width / 2} ${height * 0.05} L ${width * 0.18} ${height * 0.42} L ${width * 0.82} ${height * 0.42} Z`}
              fill={`url(#tr-leaf-${variant})`}
            />
            <Path
              d={`M ${width / 2} ${height * 0.22} L ${width * 0.08} ${height * 0.6} L ${width * 0.92} ${height * 0.6} Z`}
              fill={`url(#tr-leaf-${variant})`}
            />
            <Path
              d={`M ${width / 2} ${height * 0.42} L ${width * 0.02} ${height * 0.78} L ${width * 0.98} ${height * 0.78} Z`}
              fill={`url(#tr-leaf-${variant})`}
            />
          </>
        ) : variant === 'oak' ? (
          <>
            {/* Gövde */}
            <Path
              d={`M ${width * 0.45} ${height} L ${width * 0.45} ${height * 0.5} Q ${width * 0.5} ${height * 0.42} ${width * 0.55} ${height * 0.5} L ${width * 0.55} ${height}`}
              fill={`url(#tr-trunk-${variant})`}
            />
            {/* Geniş yuvarlak taç */}
            <Circle cx={width * 0.3} cy={height * 0.3} r={width * 0.32} fill={`url(#tr-leaf-${variant})`} />
            <Circle cx={width * 0.7} cy={height * 0.3} r={width * 0.32} fill={`url(#tr-leaf-${variant})`} />
            <Circle cx={width * 0.5} cy={height * 0.18} r={width * 0.36} fill={`url(#tr-leaf-${variant})`} />
            <Circle cx={width * 0.5} cy={height * 0.4} r={width * 0.28} fill={gradients.success[1]} />
          </>
        ) : (
          <>
            {/* Birch (huş): beyaz uzun gövde + zarif yapraklar */}
            <Rect
              x={width * 0.45}
              y={height * 0.05}
              width={width * 0.1}
              height={height * 0.85}
              fill={colors.white}
            />
            {/* Birch çizgileri (siyah lekeleri) */}
            <Path
              d={`M ${width * 0.45} ${height * 0.2} L ${width * 0.55} ${height * 0.2}
                  M ${width * 0.45} ${height * 0.35} L ${width * 0.55} ${height * 0.35}
                  M ${width * 0.45} ${height * 0.55} L ${width * 0.55} ${height * 0.55}
                  M ${width * 0.45} ${height * 0.75} L ${width * 0.55} ${height * 0.75}`}
              stroke={colors.textPrimary}
              strokeWidth={1.5}
              opacity={0.7}
            />
            {/* Üst yaprak kümesi */}
            <Ellipse cx={width * 0.5} cy={height * 0.1} rx={width * 0.4} ry={width * 0.32} fill={`url(#tr-leaf-${variant})`} />
            <Ellipse cx={width * 0.25} cy={height * 0.18} rx={width * 0.28} ry={width * 0.24} fill={`url(#tr-leaf-${variant})`} />
            <Ellipse cx={width * 0.75} cy={height * 0.18} rx={width * 0.28} ry={width * 0.24} fill={`url(#tr-leaf-${variant})`} />
          </>
        )}
      </Svg>
    </Animated.View>
  );
}

export const SwayingTree = memo(SwayingTreeBase);

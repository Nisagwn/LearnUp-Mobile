import { memo, useEffect } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLG,
  Path,
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
  /** Dal sol/sağ köşeye yapışır. */
  side?: 'left' | 'right';
  width?: number;
  height?: number;
  opacity?: number;
  phaseOffset?: number;
  reducedMotion?: boolean;
};

/**
 * Üst köşeden sarkıtan dal + yapraklar.
 * Rüzgarda hafif salınır (±3°). Quiz arka planında üst köşelerde dekor.
 */
function HangingBranchBase({
  side = 'left',
  width = 160,
  height = 140,
  opacity = 0.55,
  phaseOffset = 0,
  reducedMotion = false,
}: Props) {
  const { gradients } = useThemeColors();
  const sway = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    sway.value = withRepeat(
      withSequence(
        withTiming(3, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-3, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [sway, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway.value + phaseOffset * 0.5}deg` }],
  }));

  const flipX = side === 'right' ? -1 : 1;

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          opacity,
          position: 'absolute',
          top: 0,
          [side]: 0,
          transformOrigin: `${side === 'left' ? 'left' : 'right'} top`,
        } as any,
        style,
      ]}
      pointerEvents="none"
    >
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ transform: [{ scaleX: flipX }] }}
      >
        <Defs>
          <SvgLG id={`hb-leaf-${side}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradients.success[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={gradients.forest[1]} stopOpacity="1" />
          </SvgLG>
          <SvgLG id={`hb-trunk-${side}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradients.cedar[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={gradients.cedar[1]} stopOpacity="1" />
          </SvgLG>
        </Defs>

        {/* Ana dal — köşeden 45° aşağı sarkık eğri */}
        <Path
          d={`M 0 0 Q ${width * 0.35} ${height * 0.2} ${width * 0.55} ${height * 0.6}
              Q ${width * 0.7} ${height * 0.85} ${width * 0.85} ${height * 0.95}`}
          stroke={`url(#hb-trunk-${side})`}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />

        {/* Yan dallar */}
        <Path
          d={`M ${width * 0.3} ${height * 0.18} Q ${width * 0.45} ${height * 0.3} ${width * 0.5} ${height * 0.45}`}
          stroke={`url(#hb-trunk-${side})`}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={`M ${width * 0.55} ${height * 0.6} Q ${width * 0.45} ${height * 0.7} ${width * 0.35} ${height * 0.8}`}
          stroke={`url(#hb-trunk-${side})`}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />

        {/* Yaprak kümeleri */}
        <Circle cx={width * 0.5} cy={height * 0.45} r={14} fill={`url(#hb-leaf-${side})`} />
        <Circle cx={width * 0.35} cy={height * 0.8} r={12} fill={`url(#hb-leaf-${side})`} />
        <Circle cx={width * 0.6} cy={height * 0.55} r={10} fill={`url(#hb-leaf-${side})`} />
        <Circle cx={width * 0.85} cy={height * 0.92} r={11} fill={`url(#hb-leaf-${side})`} />
        <Circle cx={width * 0.7} cy={height * 0.78} r={9} fill={gradients.success[1]} />

        {/* Küçük yapraklar (detay) */}
        <Ellipse cx={width * 0.42} cy={height * 0.35} rx={4} ry={2.5} fill={gradients.mint[1]} transform={`rotate(-30 ${width * 0.42} ${height * 0.35})`} />
        <Ellipse cx={width * 0.65} cy={height * 0.65} rx={4} ry={2.5} fill={gradients.mint[1]} transform={`rotate(30 ${width * 0.65} ${height * 0.65})`} />
      </Svg>
    </Animated.View>
  );
}

export const HangingBranch = memo(HangingBranchBase);

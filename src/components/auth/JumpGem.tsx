import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  x: number;
  y: number;
  opacity: number;
  size?: number;
};

/**
 * Engellerin gap'inde beliren toplanabilir XP gem'i.
 * Sürekli döner; toplandığında dış kontrolden gelen `opacity` ile fade-out.
 */
export function JumpGem({ x, y, opacity, size = 16 }: Props) {
  const { colors } = useThemeColors();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1500, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${rotation.value}deg` }],
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
        opacity,
      }}
    >
      <Animated.View style={[animatedStyle, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox="0 0 16 16">
          {/* Eşkenar dörtgen gem */}
          <Path
            d="M8 1 L15 8 L8 15 L1 8 Z"
            fill={colors.warning}
            stroke={colors.white}
            strokeWidth={1.2}
          />
          {/* Iç highlight */}
          <Path
            d="M8 3 L6 8 L8 13"
            stroke={colors.white}
            strokeWidth={1}
            fill="none"
            opacity={0.7}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

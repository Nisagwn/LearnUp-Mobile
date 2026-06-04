import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Props = {
  value: number; // 0..1
  height?: number;
  trackClassName?: string;
  fillColor?: string;
  durationMs?: number;
};

export function AnimatedProgressBar({
  value,
  height = 6,
  trackClassName = 'bg-bg-elevated',
  fillColor = '#6366F1',
  durationMs = 700,
}: Props) {
  const clamped = Math.min(1, Math.max(0, value));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(clamped, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, durationMs, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      className={`overflow-hidden rounded-full ${trackClassName}`}
      style={{ height }}
    >
      <Animated.View
        style={[
          { height: '100%', backgroundColor: fillColor, borderRadius: 999 },
          fillStyle,
        ]}
      />
    </View>
  );
}

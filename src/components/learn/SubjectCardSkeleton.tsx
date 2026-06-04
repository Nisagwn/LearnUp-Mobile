import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Props = {
  count?: number;
};

export function SubjectCardSkeleton({ count = 3 }: Props) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View className="gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={pulseStyle}
          className="rounded-2xl border border-border-soft bg-bg-surface p-4"
        >
          <View className="flex-row items-center">
            <View className="h-11 w-11 rounded-2xl bg-bg-elevated" />
            <View className="ml-3 flex-1">
              <View className="h-4 w-32 rounded-md bg-bg-elevated" />
              <View className="mt-2 h-3 w-20 rounded-md bg-bg-elevated" />
            </View>
            <View className="h-6 w-10 rounded-md bg-bg-elevated" />
          </View>
          <View className="mt-3 h-1.5 rounded-full bg-bg-elevated" />
          <View className="mt-3 flex-row gap-2">
            <View className="h-9 flex-1 rounded-xl bg-bg-elevated" />
            <View className="h-9 flex-1 rounded-xl bg-bg-elevated" />
            <View className="h-9 flex-1 rounded-xl bg-bg-elevated" />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

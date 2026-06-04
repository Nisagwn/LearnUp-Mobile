import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';

type Props = {
  amount: number;
  topOffset?: number;
  onComplete?: () => void;
};

export function XPFlyUp({ amount, topOffset = 120, onComplete }: Props) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withDelay(600, withTiming(0, { duration: 320, easing: Easing.in(Easing.cubic) })),
    );
    scale.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.4)) });
    translateY.value = withTiming(-50, { duration: 1100, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => onComplete?.(), 1200);
    return () => clearTimeout(t);
  }, [opacity, scale, translateY, onComplete]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (amount <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: topOffset,
          alignSelf: 'center',
          zIndex: 1000,
        },
        style,
      ]}
    >
      <View
        className="flex-row items-center rounded-full px-4 py-2"
        style={{
          backgroundColor: '#6366F1',
          shadowColor: '#6366F1',
          shadowOpacity: 0.4,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Sparkles color="white" size={16} />
        <Text className="ml-1.5 text-base font-bold text-white">+{amount} XP</Text>
      </View>
    </Animated.View>
  );
}

import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import type { ReactNode } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { tapLight } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  /** Basışta küçülme oranı (0..1). Varsayılan 0.96. */
  scaleTo?: number;
  /** Basışta hafif haptik. Varsayılan true. */
  haptic?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Spring scale + hafif haptik geri bildirimli basılabilir sarmalayıcı.
 * ChatFAB'taki desenin ortaklaştırılmış hali — oyunlaştırılmış "canlı" his için
 * tüm kart/buton basışlarında kullanılır.
 */
export function PressableScale({
  children,
  scaleTo = 0.96,
  haptic = true,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 14, stiffness: 320 });
        if (haptic) tapLight();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 320 });
        onPressOut?.(e);
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

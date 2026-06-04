import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  icon: LucideIcon;
  color: string;
  focused: boolean;
  size?: number;
};

/**
 * Sekme ikonu — odaklanınca yumuşak accent "pill" zemini ve hafif scale ile
 * canlı bir vurgu kazanır.
 */
export function TabBarIcon({ icon: Icon, color, focused, size = 22 }: Props) {
  const { colors, isDark } = useThemeColors();
  const scale = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 220 });
  }, [focused, scale]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: scale.value,
    transform: [{ scale: 0.6 + scale.value * 0.4 }],
  }));

  return (
    <View className="items-center justify-center" style={{ width: 56, height: 32 }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 52,
            height: 32,
            borderRadius: 16,
            backgroundColor: isDark ? colors.accentSoft : colors.accentSoft,
          },
          pillStyle,
        ]}
      />
      <Icon color={color} size={size} />
    </View>
  );
}

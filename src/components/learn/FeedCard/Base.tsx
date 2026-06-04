import { ReactNode } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';

type Props = {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  category: string;
  title: string;
  subtitle?: string;
  primaryLabel: string;
  primaryColor?: string;
  primaryTextColor?: string;
  onPrimary: () => void;
  onDismiss: () => void;
  accent?: 'mor' | 'kirmizi' | 'turuncu' | 'yesil' | 'sari' | 'mavi';
  children?: ReactNode;
};

const SWIPE_THRESHOLD = 120;

export function FeedCardBase({
  icon: Icon,
  iconColor,
  iconBg,
  category,
  title,
  subtitle,
  primaryLabel,
  primaryColor = '#6366F1',
  primaryTextColor = '#FFFFFF',
  onPrimary,
  onDismiss,
  children,
}: Props) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const dismissed = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      translateX.value = e.translationX;
      opacity.value = 1 - Math.min(1, Math.abs(e.translationX) / 220);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD && dismissed.value === 0) {
        dismissed.value = 1;
        translateX.value = withTiming(e.translationX > 0 ? 600 : -600, { duration: 180 });
        opacity.value = withTiming(0, { duration: 180 }, () => {
          runOnJS(onDismiss)();
        });
      } else {
        translateX.value = withTiming(0, { duration: 160 });
        opacity.value = withTiming(1, { duration: 160 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.shell, animatedStyle]}>
        <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
          <View className="flex-row items-start">
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: iconBg }}
            >
              <Icon color={iconColor} size={20} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {category}
              </Text>
              <Text className="mt-0.5 text-sm font-semibold text-text-primary" numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? (
                <Text className="mt-0.5 text-xs text-text-secondary" numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onDismiss}
              hitSlop={10}
              accessibilityLabel="Kartı kapat"
              className="h-7 w-7 items-center justify-center rounded-full active:bg-bg-elevated"
            >
              <X color="#94A3B8" size={14} />
            </Pressable>
          </View>

          {children ? <View className="mt-3">{children}</View> : null}

          <Pressable
            onPress={onPrimary}
            className="mt-3 flex-row items-center justify-center rounded-xl py-2.5 active:opacity-80"
            style={{ backgroundColor: primaryColor }}
          >
            <Text className="text-xs font-bold" style={{ color: primaryTextColor }}>
              {primaryLabel}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
  },
});

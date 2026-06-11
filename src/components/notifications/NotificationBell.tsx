import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Bell } from 'lucide-react-native';

type Props = {
  unreadCount: number;
  onPress: () => void;
  /** Beyaz/şeffaf zemin üzerinde mi? (hero gradient içinde true) */
  light?: boolean;
};

/**
 * Sağ üst köşede çan ikonu — okunmamış bildirim varsa kırmızı badge gösterir
 * ve 5sn'de bir nazikçe sallanır (Duolingo "üstte birikti" sinyali).
 */
export function NotificationBell({ unreadCount, onPress, light = false }: Props) {
  const rot = useSharedValue(0);
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    if (!hasUnread) {
      cancelAnimation(rot);
      rot.value = withTiming(0, { duration: 120 });
      return;
    }
    rot.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 4000 }),
        withTiming(-12, { duration: 90 }),
        withTiming(12, { duration: 90 }),
        withTiming(-10, { duration: 90 }),
        withTiming(8, { duration: 90 }),
        withTiming(0, { duration: 120 }),
        withDelay(400, withTiming(0, { duration: 100 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(rot);
  }, [hasUnread, rot]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  const iconColor = light ? '#FFFFFF' : '#15803D';
  const containerCls = light ? 'bg-white/20' : 'bg-accent-soft';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      className={`relative h-11 w-11 items-center justify-center rounded-2xl ${containerCls} active:opacity-75`}
      accessibilityRole="button"
      accessibilityLabel={
        hasUnread ? `${unreadCount} okunmamış bildirim` : 'Bildirimler'
      }
    >
      <Animated.View style={iconStyle}>
        <Bell color={iconColor} size={20} />
      </Animated.View>
      {hasUnread ? (
        <View
          className="absolute -right-1 -top-1 min-w-[20px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5"
          style={{
            borderWidth: 2,
            borderColor: light ? 'rgba(99,102,241,0.85)' : '#FFFFFF',
          }}
        >
          <Text className="text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

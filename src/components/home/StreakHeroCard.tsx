import { useEffect } from 'react';
import { Pressable, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Snowflake } from 'lucide-react-native';
import { AppLottie } from '@/components/common/AppLottie';
import { lottie } from '@/constants/lottie';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Props = {
  streakDays: number;
  longest?: number;
  freezesAvailable?: number;
  onPress?: () => void;
  onFreezePress?: () => void;
  loading?: boolean;
};

export function StreakHeroCard({
  streakDays,
  longest = 0,
  freezesAvailable = 0,
  onPress,
  onFreezePress,
  loading = false,
}: Props) {
  const isEmpty = !loading && streakDays === 0;
  const headline = loading ? '—' : `${streakDays}`;
  const showFreezes = !loading && freezesAvailable > 0;

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isEmpty || loading) return;
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [isEmpty, loading, pulse]);
  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Pressable onPress={onPress} className="active:opacity-90">
      <LinearGradient
        colors={isEmpty ? ['#FCA5A5', '#F87171'] : ['#FB923C', '#EF4444']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="overflow-hidden rounded-3xl p-5"
        style={{ borderRadius: 24 }}
      >
        <View className="flex-row items-center">
          <Animated.View
            style={flameStyle}
            className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/20"
          >
            {isEmpty || loading ? (
              <Flame color="white" size={30} />
            ) : (
              <AppLottie source={lottie.fire} autoPlay loop style={{ width: 48, height: 48 }} />
            )}
          </Animated.View>

          <View className="ml-4 flex-1">
            {isEmpty ? (
              <>
                <Text className="text-base font-semibold text-white">Serini başlat</Text>
                <Text className="mt-0.5 text-xs text-white/80">
                  Bugün 1 soru çöz, alev yansın
                </Text>
              </>
            ) : (
              <>
                <View className="flex-row items-baseline">
                  <Text className="text-4xl font-bold text-white">{headline}</Text>
                  <Text className="ml-1.5 text-sm font-medium text-white/85">gün seri</Text>
                </View>
                {longest > 0 ? (
                  <Text className="mt-0.5 text-xs text-white/80">Rekor: {longest} gün</Text>
                ) : null}
              </>
            )}
          </View>

          {showFreezes ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onFreezePress?.();
              }}
              className="ml-2 flex-row items-center rounded-full bg-white/25 px-2.5 py-1 active:bg-white/40"
              hitSlop={8}
            >
              <Snowflake color="white" size={14} />
              <Text className="ml-1 text-xs font-semibold text-white">{freezesAvailable}</Text>
            </Pressable>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

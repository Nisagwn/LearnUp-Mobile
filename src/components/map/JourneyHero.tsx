import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Sparkles, Leaf } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';
import { getLevelInfo } from '@/utils/levelSystem';

type Props = {
  correctAnswers: number;
  totalXP: number;
};

/**
 * Yeşil gradient hero. Level emoji + isim + "sıradakine X doğru" + progress bar.
 * Sağ üstte parıldayan Sparkles, solda sallanan Leaf ikonu.
 */
export function JourneyHero({ correctAnswers, totalXP }: Props) {
  const { colors, gradients } = useThemeColors();
  type LevelInfo = {
    levelData: { level: number; name: string; emoji: string };
    progress: number;
    toNext: number;
  };
  const info = getLevelInfo(correctAnswers) as LevelInfo;
  const levelData = info.levelData;
  const progress = Math.min(1, Math.max(0, (info.progress || 0) / 100));

  // Sparkles ışıltı
  const sparkA = useSharedValue(0.3);
  const sparkB = useSharedValue(0.3);
  useEffect(() => {
    sparkA.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0.3, { duration: 900, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    sparkB.value = withDelay(
      450,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
          withTiming(0.3, { duration: 900, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [sparkA, sparkB]);

  // Leaf sallan
  const leafRot = useSharedValue(0);
  useEffect(() => {
    leafRot.value = withRepeat(
      withSequence(
        withTiming(12, { duration: 700 }),
        withTiming(-8, { duration: 700 }),
      ),
      -1,
      true,
    );
  }, [leafRot]);

  const sparkAStyle = useAnimatedStyle(() => ({
    opacity: sparkA.value,
    transform: [{ scale: 0.7 + sparkA.value * 0.5 }],
  }));
  const sparkBStyle = useAnimatedStyle(() => ({
    opacity: sparkB.value,
    transform: [{ scale: 0.7 + sparkB.value * 0.5 }],
  }));
  const leafStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leafRot.value}deg` }],
  }));

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
      <LinearGradient
        colors={[gradients.success[0], gradients.success[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 22,
          padding: 18,
          overflow: 'hidden',
        }}
      >
        {/* Dekoratif Sparkles */}
        <Animated.View
          style={[
            { position: 'absolute', right: 18, top: 14 },
            sparkAStyle,
          ]}
          pointerEvents="none"
        >
          <Sparkles size={18} color={colors.white} />
        </Animated.View>
        <Animated.View
          style={[
            { position: 'absolute', right: 46, top: 36 },
            sparkBStyle,
          ]}
          pointerEvents="none"
        >
          <Sparkles size={12} color={colors.white} />
        </Animated.View>

        {/* Üst satır: leaf + label */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Animated.View
            style={[
              {
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(255,255,255,0.24)',
                alignItems: 'center',
                justifyContent: 'center',
              },
              leafStyle,
            ]}
          >
            <Leaf size={26} color={colors.white} strokeWidth={2.4} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1,
                color: colors.white,
                opacity: 0.85,
              }}
            >
              DOĞAL YOLCULUĞUN
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '900',
                color: colors.white,
                marginTop: 1,
                lineHeight: 24,
              }}
            >
              {levelData.emoji} Lv {levelData.level} · {levelData.name}
            </Text>
          </View>
        </View>

        {/* XP + ilerleme */}
        <View style={{ marginTop: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                color: colors.white,
                fontSize: 13,
                fontWeight: '700',
                opacity: 0.95,
              }}
            >
              {totalXP.toLocaleString('tr-TR')} XP · {correctAnswers} doğru
            </Text>
            <Text
              style={{
                color: colors.white,
                fontSize: 11,
                fontWeight: '600',
                opacity: 0.85,
              }}
            >
              {info.toNext > 0
                ? `Sıradakine ${info.toNext} doğru`
                : 'Zirvedesin ✨'}
            </Text>
          </View>
          <AnimatedProgressBar
            value={progress}
            height={8}
            trackClassName="bg-white/25"
            fillColor={colors.white}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

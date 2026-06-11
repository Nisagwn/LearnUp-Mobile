import { useEffect } from 'react';
import { Pressable, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Ellipse, Defs, LinearGradient as SvgLG, Stop } from 'react-native-svg';
import { Droplet } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
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

type TreeStage = 'seed' | 'sprout' | 'young' | 'mature' | 'ancient';

function getTreeStage(days: number): TreeStage {
  if (days === 0) return 'seed';
  if (days < 7) return 'sprout';
  if (days < 30) return 'young';
  if (days < 100) return 'mature';
  return 'ancient';
}

function stageLabel(stage: TreeStage): string {
  switch (stage) {
    case 'seed': return 'Tohum';
    case 'sprout': return 'Filiz';
    case 'young': return 'Genç ağaç';
    case 'mature': return 'Olgun ağaç';
    case 'ancient': return 'Yaşlı orman';
  }
}

/**
 * Streak ağacı — gün sayısına göre 5 evre SVG render.
 * Eski "alev" metaforu yerine doğa ile uyumlu "büyüyen ağaç".
 */
function TreeSvg({ stage, size = 56 }: { stage: TreeStage; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <SvgLG id="leaf-grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#86EFAC" stopOpacity="1" />
          <Stop offset="1" stopColor="#16A34A" stopOpacity="1" />
        </SvgLG>
        <SvgLG id="trunk-grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#A16207" stopOpacity="1" />
          <Stop offset="1" stopColor="#7C2D12" stopOpacity="1" />
        </SvgLG>
        <SvgLG id="soil-grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#92400E" stopOpacity="1" />
          <Stop offset="1" stopColor="#7C2D12" stopOpacity="1" />
        </SvgLG>
      </Defs>

      {/* Toprak zemin (her evrede) */}
      <Ellipse cx="32" cy="56" rx="20" ry="3" fill="url(#soil-grad)" opacity="0.85" />

      {stage === 'seed' ? (
        <>
          {/* Tohum: küçük oval kahve */}
          <Ellipse cx="32" cy="51" rx="4" ry="3" fill="#7C2D12" />
          <Path d="M 32 48 Q 30 46 31 44" stroke="#16A34A" strokeWidth="1.5" fill="none" />
        </>
      ) : null}

      {stage === 'sprout' ? (
        <>
          {/* Filiz: sap + 2 yaprak */}
          <Path d="M 32 54 L 32 38" stroke="#15803D" strokeWidth="2" />
          <Ellipse cx="27" cy="42" rx="5" ry="3" fill="url(#leaf-grad)" transform="rotate(-30 27 42)" />
          <Ellipse cx="37" cy="40" rx="5" ry="3" fill="url(#leaf-grad)" transform="rotate(30 37 40)" />
        </>
      ) : null}

      {stage === 'young' ? (
        <>
          {/* Genç ağaç: ince gövde + 3 yaprak kümesi */}
          <Path d="M 32 54 L 32 32" stroke="url(#trunk-grad)" strokeWidth="3" strokeLinecap="round" />
          <Circle cx="24" cy="30" r="7" fill="url(#leaf-grad)" />
          <Circle cx="40" cy="30" r="7" fill="url(#leaf-grad)" />
          <Circle cx="32" cy="22" r="8" fill="url(#leaf-grad)" />
        </>
      ) : null}

      {stage === 'mature' ? (
        <>
          {/* Olgun ağaç: kalın gövde + büyük taç */}
          <Path d="M 32 54 L 32 24" stroke="url(#trunk-grad)" strokeWidth="5" strokeLinecap="round" />
          {/* Yan dallar */}
          <Path d="M 32 36 L 22 30" stroke="url(#trunk-grad)" strokeWidth="2" strokeLinecap="round" />
          <Path d="M 32 32 L 42 26" stroke="url(#trunk-grad)" strokeWidth="2" strokeLinecap="round" />
          {/* Yaprak tacı */}
          <Circle cx="20" cy="26" r="8" fill="url(#leaf-grad)" />
          <Circle cx="44" cy="22" r="8" fill="url(#leaf-grad)" />
          <Circle cx="32" cy="16" r="10" fill="url(#leaf-grad)" />
          <Circle cx="28" cy="22" r="7" fill="#22C55E" />
        </>
      ) : null}

      {stage === 'ancient' ? (
        <>
          {/* Yaşlı dev ağaç: daha kalın, daha büyük taç + meyveler */}
          <Path d="M 32 56 L 32 22" stroke="url(#trunk-grad)" strokeWidth="7" strokeLinecap="round" />
          <Path d="M 32 38 L 18 32" stroke="url(#trunk-grad)" strokeWidth="3" strokeLinecap="round" />
          <Path d="M 32 32 L 46 24" stroke="url(#trunk-grad)" strokeWidth="3" strokeLinecap="round" />
          <Path d="M 32 26 L 24 18" stroke="url(#trunk-grad)" strokeWidth="2" strokeLinecap="round" />
          {/* Büyük yaprak tacı */}
          <Circle cx="16" cy="28" r="9" fill="#15803D" />
          <Circle cx="48" cy="22" r="9" fill="#15803D" />
          <Circle cx="22" cy="16" r="8" fill="url(#leaf-grad)" />
          <Circle cx="42" cy="14" r="8" fill="url(#leaf-grad)" />
          <Circle cx="32" cy="10" r="10" fill="url(#leaf-grad)" />
          {/* Altın meyveler */}
          <Circle cx="20" cy="22" r="1.8" fill="#EAB308" />
          <Circle cx="38" cy="18" r="1.8" fill="#EAB308" />
          <Circle cx="30" cy="14" r="1.8" fill="#EAB308" />
        </>
      ) : null}
    </Svg>
  );
}

export function StreakHeroCard({
  streakDays,
  longest = 0,
  freezesAvailable = 0,
  onPress,
  onFreezePress,
  loading = false,
}: Props) {
  const { gradients } = useThemeColors();
  const stage = getTreeStage(streakDays);
  const isEmpty = !loading && streakDays === 0;
  const headline = loading ? '—' : `${streakDays}`;
  const showFreezes = !loading && freezesAvailable > 0;

  // Hafif sallanma (rüzgar)
  const sway = useSharedValue(0);
  useEffect(() => {
    if (isEmpty || loading) return;
    sway.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1.5, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [isEmpty, loading, sway]);
  const swayStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sway.value}deg` }],
  }));

  // Renkler: empty=gri toprak, dolu=orman tonu
  const heroGradient = isEmpty
    ? gradients.streakLost
    : stage === 'ancient'
      ? gradients.forest
      : stage === 'mature'
        ? gradients.success
        : gradients.mint;

  return (
    <Pressable onPress={onPress} className="active:opacity-90">
      <LinearGradient
        colors={[heroGradient[0], heroGradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="overflow-hidden rounded-3xl p-5"
        style={{ borderRadius: 24 }}
      >
        <View className="flex-row items-center">
          <Animated.View
            style={swayStyle}
            className="h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/25"
          >
            <TreeSvg stage={stage} size={58} />
          </Animated.View>

          <View className="ml-4 flex-1">
            {isEmpty ? (
              <>
                <Text className="text-base font-semibold text-white">İlk tohumu ek</Text>
                <Text className="mt-0.5 text-xs text-white/80">
                  Bugün 1 soru çöz, ağacın yeşersin
                </Text>
              </>
            ) : (
              <>
                <View className="flex-row items-baseline">
                  <Text className="text-4xl font-bold text-white">{headline}</Text>
                  <Text className="ml-1.5 text-sm font-medium text-white/85">
                    gün · {stageLabel(stage)}
                  </Text>
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
              <Droplet color="white" size={14} />
              <Text className="ml-1 text-xs font-semibold text-white">{freezesAvailable}</Text>
            </Pressable>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

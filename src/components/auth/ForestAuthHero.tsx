import { memo, useEffect } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLG,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SkylineHorizon, FloatingLeaf } from '@/components/decor';

type Props = {
  height?: number;
  title?: string;
  subtitle?: string;
};

/**
 * Auth ekranlarının üstündeki orman banner'ı — Hay Day stili.
 *
 * Katmanlar:
 *  - Çok katmanlı SVG gökyüzü gradient (mavi → mint → yeşil)
 *  - Uzakta dağ silüetleri (atmospheric depth)
 *  - Animasyonlu güneş (yavaş döner halo)
 *  - Geçen 2 bulut (sağa kayar)
 *  - Skyline forest (yakın ağaç silüetleri)
 *  - Uçan 3 yaprak (parallax)
 *  - LearnUp logo + slogan overlay
 */
function ForestAuthHeroBase({
  height = 280,
  title = 'LearnUp',
  subtitle = 'Soru çöz · Altın kazan · Ormanını büyüt',
}: Props) {
  const { colors, gradients } = useThemeColors();
  const { width } = useWindowDimensions();

  // Animasyonlar
  const cloudA = useSharedValue(-100);
  const cloudB = useSharedValue(-200);
  const sunHalo = useSharedValue(1);
  const leaf1 = useSharedValue(0);
  const leaf2 = useSharedValue(0);
  const leaf3 = useSharedValue(0);

  useEffect(() => {
    cloudA.value = withRepeat(
      withTiming(width + 80, { duration: 32000, easing: Easing.linear }),
      -1,
      false,
    );
    cloudB.value = withRepeat(
      withTiming(width + 80, { duration: 45000, easing: Easing.linear }),
      -1,
      false,
    );
    sunHalo.value = withRepeat(
      withTiming(1.18, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    leaf1.value = withRepeat(
      withTiming(1, { duration: 6500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    leaf2.value = withRepeat(
      withTiming(1, { duration: 8200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    leaf3.value = withRepeat(
      withTiming(1, { duration: 7400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [cloudA, cloudB, sunHalo, leaf1, leaf2, leaf3, width]);

  const cloudAStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: height * 0.18,
    left: cloudA.value,
  }));
  const cloudBStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: height * 0.32,
    left: cloudB.value,
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sunHalo.value }],
    opacity: 2 - sunHalo.value, // 1.0 → 0.82
  }));
  const leaf1Style = useAnimatedStyle(() => ({
    position: 'absolute',
    top: height * 0.4 + leaf1.value * 20,
    left: 30 + leaf1.value * 14,
    transform: [{ rotate: `${leaf1.value * 30}deg` }],
  }));
  const leaf2Style = useAnimatedStyle(() => ({
    position: 'absolute',
    top: height * 0.5 + leaf2.value * 22,
    right: 50 + leaf2.value * 16,
    transform: [{ rotate: `${-leaf2.value * 25}deg` }],
  }));
  const leaf3Style = useAnimatedStyle(() => ({
    position: 'absolute',
    top: height * 0.62 + leaf3.value * 14,
    left: width * 0.55 + leaf3.value * 10,
    transform: [{ rotate: `${leaf3.value * 20}deg` }],
  }));

  return (
    <View style={{ width, height, overflow: 'hidden', position: 'relative' }}>
      {/* Gökyüzü → çayır gradient */}
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <SvgLG id="hero-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradients.sky[0]} stopOpacity="1" />
            <Stop offset="0.4" stopColor={gradients.mint[0]} stopOpacity="1" />
            <Stop offset="0.7" stopColor={gradients.success[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={gradients.forest[1]} stopOpacity="1" />
          </SvgLG>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#hero-sky)" />

        {/* Uzakta dağ silüeti */}
        <Path
          d={`M 0 ${height * 0.55}
              L ${width * 0.15} ${height * 0.38}
              L ${width * 0.3} ${height * 0.5}
              L ${width * 0.5} ${height * 0.35}
              L ${width * 0.7} ${height * 0.48}
              L ${width * 0.85} ${height * 0.4}
              L ${width} ${height * 0.52}
              L ${width} ${height * 0.7}
              L 0 ${height * 0.7} Z`}
          fill={gradients.forest[0]}
          opacity={0.4}
        />
      </Svg>

      {/* Güneş + halo */}
      <View
        style={{
          position: 'absolute',
          top: height * 0.13,
          right: width * 0.18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none"
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: gradients.league[0],
              opacity: 0.35,
            },
            haloStyle,
          ]}
        />
        <Svg width={46} height={46} viewBox="0 0 46 46">
          <Defs>
            <SvgLG id="sun-grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.white} stopOpacity="1" />
              <Stop offset="0.7" stopColor={gradients.league[0]} stopOpacity="1" />
              <Stop offset="1" stopColor={gradients.league[1]} stopOpacity="1" />
            </SvgLG>
          </Defs>
          <Circle cx={23} cy={23} r={20} fill="url(#sun-grad)" />
        </Svg>
      </View>

      {/* Bulutlar */}
      <Animated.View style={cloudAStyle} pointerEvents="none">
        <Svg width={70} height={32} viewBox="0 0 70 32">
          <Ellipse cx={20} cy={20} rx={18} ry={11} fill={colors.white} opacity={0.95} />
          <Ellipse cx={36} cy={16} rx={20} ry={13} fill={colors.white} opacity={0.95} />
          <Ellipse cx={52} cy={20} rx={14} ry={10} fill={colors.white} opacity={0.95} />
        </Svg>
      </Animated.View>
      <Animated.View style={cloudBStyle} pointerEvents="none">
        <Svg width={56} height={26} viewBox="0 0 56 26">
          <Ellipse cx={16} cy={16} rx={14} ry={9} fill={colors.white} opacity={0.85} />
          <Ellipse cx={30} cy={13} rx={16} ry={10} fill={colors.white} opacity={0.85} />
          <Ellipse cx={44} cy={16} rx={11} ry={8} fill={colors.white} opacity={0.85} />
        </Svg>
      </Animated.View>

      {/* Skyline forest silüet (yakın) */}
      <SkylineHorizon width={width} height={height * 0.22} opacity={0.55} />

      {/* Uçan yapraklar */}
      <Animated.View style={leaf1Style} pointerEvents="none">
        <FloatingLeaf size={20} color={gradients.success[0]} />
      </Animated.View>
      <Animated.View style={leaf2Style} pointerEvents="none">
        <FloatingLeaf size={16} color={gradients.mint[1]} />
      </Animated.View>
      <Animated.View style={leaf3Style} pointerEvents="none">
        <FloatingLeaf size={14} color={gradients.moss[0]} />
      </Animated.View>

      {/* Logo + slogan */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 18,
          alignItems: 'center',
        }}
        pointerEvents="none"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 18,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.85)',
            shadowColor: gradients.forest[1],
            shadowOpacity: 0.3,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d="M 12 2 Q 18 6 20 12 Q 18 18 12 22 Q 6 18 4 12 Q 6 6 12 2 Z"
              fill={gradients.success[1]}
            />
            <Path
              d="M 12 4 Q 12 14 12 22"
              stroke={colors.white}
              strokeWidth="1.5"
              fill="none"
            />
          </Svg>
          <Text style={{ fontSize: 22, fontWeight: '900', color: gradients.forest[1], letterSpacing: 0.4 }}>
            {title}
          </Text>
        </View>
        <Text
          style={{
            marginTop: 6,
            fontSize: 11,
            fontWeight: '600',
            color: colors.white,
            textShadowColor: 'rgba(20,83,45,0.7)',
            textShadowRadius: 4,
            letterSpacing: 0.3,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export const ForestAuthHero = memo(ForestAuthHeroBase);

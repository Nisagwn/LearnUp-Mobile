import React, { memo, useContext, useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Avatar } from '@/components/common/Avatar';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { JourneyStation } from './JourneyStation';
import type { Station } from '@/utils/journey';

type Props = {
  stations: Station[];
  width: number;
  onStationPress: (station: Station) => void;
};

const STEP_HEIGHT = 110;
const AMPLITUDE_RATIO = 0.32;

type Pt = { x: number; y: number; station: Station };

type FloraKind = 'pine' | 'oak' | 'shrub' | 'flower' | 'mushroom' | 'rock';
type FloraItem = {
  kind: FloraKind;
  x: number;
  y: number;
  scale: number;
  /** Deterministik varyant (renk/şekil farkı için 0..3). */
  variant: number;
};

/** Quadratic Bezier üzerinde t ∈ [0,1] noktası + teğet açı. */
function bezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number; angle: number } {
  const mt = 1 - t;
  const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
  const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
  const dx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const dy = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  return { x, y, angle: Math.atan2(dy, dx) };
}

/** Yol kenarı boyunca bitki/kaya kompozisyonu + yola taş döşeme noktaları. */
function buildPathDecorations(positions: Pt[]) {
  const stones: { x: number; y: number; r: number }[] = [];
  const flora: FloraItem[] = [];

  const KINDS_LEFT: FloraKind[] = ['pine', 'oak', 'shrub', 'flower', 'mushroom', 'oak', 'pine', 'rock'];
  const KINDS_RIGHT: FloraKind[] = ['oak', 'shrub', 'pine', 'mushroom', 'flower', 'pine', 'rock', 'oak'];

  for (let i = 0; i < positions.length - 1; i++) {
    const prev = positions[i];
    const cur = positions[i + 1];
    const ctrl = { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };
    const samples = 16;
    for (let k = 1; k < samples; k++) {
      const t = k / samples;
      const pt = bezierPoint(prev, ctrl, cur, t);

      // Yol kenarı bitkileri (her 4 örnekte simetrik, kayık mesafeler)
      if (k % 4 === 1) {
        const distL = 26 + ((i + k) % 14);
        const distR = 26 + ((i + k + 3) % 16);
        const kindL = KINDS_LEFT[(i * 3 + k) % KINDS_LEFT.length];
        const kindR = KINDS_RIGHT[(i * 5 + k + 1) % KINDS_RIGHT.length];
        flora.push({
          kind: kindL,
          x: pt.x + Math.cos(pt.angle + Math.PI / 2) * distL,
          y: pt.y + Math.sin(pt.angle + Math.PI / 2) * distL,
          scale: kindL === 'pine' || kindL === 'oak' ? 1 + ((k + i) % 3) * 0.18 : 0.8 + ((k + i) % 4) * 0.12,
          variant: (i + k) % 4,
        });
        flora.push({
          kind: kindR,
          x: pt.x + Math.cos(pt.angle - Math.PI / 2) * distR,
          y: pt.y + Math.sin(pt.angle - Math.PI / 2) * distR,
          scale: kindR === 'pine' || kindR === 'oak' ? 1 + ((k + i + 1) % 3) * 0.18 : 0.8 + ((k + i + 2) % 4) * 0.12,
          variant: (i + k + 2) % 4,
        });
      }

      // Yol gövdesi üzerinde taş döşeme noktaları
      if (k % 2 === 0) {
        const offset = ((k * 7) % 6) - 3;
        stones.push({
          x: pt.x + Math.cos(pt.angle + Math.PI / 2) * offset,
          y: pt.y + Math.sin(pt.angle + Math.PI / 2) * offset,
          r: 0.9 + ((k + i) % 3) * 0.4,
        });
      }
    }
  }

  // Derinlik için flora'yı y'ye göre sırala (arka önce çizilir, ön üstte)
  flora.sort((a, b) => a.y - b.y);

  return { stones, flora };
}

function JourneyPathBase({ stations, width, onStationPress }: Props) {
  const { colors, gradients } = useThemeColors();
  const ctx = useContext(UserStatsContext);
  const avatarId =
    ((ctx?.userProfile as { avatarId?: string } | undefined)?.avatarId) ?? null;
  const photoURL =
    ((ctx?.userProfile as { photoURL?: string } | undefined)?.photoURL) ?? null;
  const uid = (ctx?.currentUser as { uid?: string } | undefined)?.uid ?? null;

  const totalHeight = stations.length * STEP_HEIGHT + 120;
  const cx = width / 2;
  const amp = width * AMPLITUDE_RATIO;

  const positions: Pt[] = useMemo(() => {
    return stations.map((s, i) => {
      const swing = ((i % 2) === 0 ? -1 : 1) * amp * 0.85;
      const jitter = ((i * 31) % 20) - 10;
      return {
        x: cx + swing + jitter,
        y: 60 + i * STEP_HEIGHT,
        station: s,
      };
    });
  }, [stations, cx, amp]);

  const decorations = useMemo(
    () => buildPathDecorations(positions),
    [positions],
  );

  // Su elementleri: 2 gölet (yolun iki yanında, deterministik indekslerde) + 1 köprü (ortada)
  const waterFeatures = useMemo(() => {
    const N = positions.length;
    if (N < 6) return { ponds: [], bridge: null };
    const pondIdx1 = Math.floor(N * 0.3);
    const pondIdx2 = Math.floor(N * 0.72);
    const bridgeIdx = Math.floor(N * 0.5);

    // Köprü: bridgeIdx ile bridgeIdx-1 arasında yolun ortasında
    const bridgePrev = positions[bridgeIdx - 1];
    const bridgeCur = positions[bridgeIdx];
    const bridge =
      bridgePrev && bridgeCur
        ? {
            x: (bridgePrev.x + bridgeCur.x) / 2,
            y: (bridgePrev.y + bridgeCur.y) / 2,
            angle: Math.atan2(
              bridgeCur.y - bridgePrev.y,
              bridgeCur.x - bridgePrev.x,
            ),
          }
        : null;

    // Gölet 1: pondIdx1, sol veya sağ — yolun kendi swing'ine bakıp ters tarafa
    const pond1Pos = positions[pondIdx1];
    const pond2Pos = positions[pondIdx2];
    const ponds: { x: number; y: number; rx: number; ry: number }[] = [];
    if (pond1Pos) {
      // Sol tarafa
      ponds.push({
        x: Math.max(50, pond1Pos.x - 95),
        y: pond1Pos.y + 30,
        rx: 48,
        ry: 22,
      });
    }
    if (pond2Pos) {
      // Sağ tarafa
      ponds.push({
        x: Math.min(width - 50, pond2Pos.x + 95),
        y: pond2Pos.y + 20,
        rx: 54,
        ry: 26,
      });
    }
    return { ponds, bridge };
  }, [positions, width]);

  // Maskot — kullanıcı avatarı
  const currentIdx = positions.findIndex((p) => p.station.isCurrent);
  const mascotY = useSharedValue(0);
  const mascotScale = useSharedValue(1);
  const haloPulse = useSharedValue(0.6);
  const sparkleRot = useSharedValue(0);
  const sparkleA = useSharedValue(0.3);
  const sparkleB = useSharedValue(0.3);

  useEffect(() => {
    // Zıplama
    mascotY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 800, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 800, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      true,
    );
    // Nefes scale
    mascotScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    // Halo nabız
    haloPulse.value = withRepeat(
      withTiming(1.3, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    // Sparkle döndürme — sürekli yavaş rotasyon
    sparkleRot.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false,
    );
    // İki yıldız fade
    sparkleA.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.3, { duration: 900 }),
      ),
      -1,
      false,
    );
    sparkleB.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [mascotY, mascotScale, haloPulse, sparkleRot, sparkleA, sparkleB]);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: mascotY.value },
      { scale: mascotScale.value },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloPulse.value }],
    opacity: 2 - haloPulse.value, // 1.4 → 0.7
  }));
  const sparkleRotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sparkleRot.value}deg` }],
  }));
  const sparkleAStyle = useAnimatedStyle(() => ({
    opacity: sparkleA.value,
    transform: [{ scale: 0.6 + sparkleA.value * 0.5 }],
  }));
  const sparkleBStyle = useAnimatedStyle(() => ({
    opacity: sparkleB.value,
    transform: [{ scale: 0.6 + sparkleB.value * 0.5 }],
  }));

  const pathD = useMemo(() => {
    if (positions.length === 0) return '';
    const parts: string[] = [`M ${positions[0].x} ${positions[0].y}`];
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const cur = positions[i];
      const midY = (prev.y + cur.y) / 2;
      parts.push(`Q ${prev.x} ${midY}, ${(prev.x + cur.x) / 2} ${midY}`);
      parts.push(`Q ${cur.x} ${midY}, ${cur.x} ${cur.y}`);
    }
    return parts.join(' ');
  }, [positions]);

  // Renk paleti (token'lardan, hardcoded yok)
  const pineDark = gradients.success[1];
  const pineLight = gradients.mint[1];
  const oakDark = gradients.mint[1];
  const oakLight = gradients.mint[0];
  const shrubColor = gradients.success[0];
  const flowerPalette = [
    gradients.sunset[0],
    gradients.league[0],
    gradients.brand[0],
    gradients.success[0],
  ];
  const mushroomCap = gradients.streak[1];
  const mushroomStem = colors.warningSoft;
  const rockColor = colors.textSecondary;

  // Lottie konum: üst peak, alt başlangıç
  const peakPos = positions[0];
  const startPos = positions[positions.length - 1];

  return (
    <View style={{ width, height: totalHeight, position: 'relative' }}>
      <Svg
        width={width}
        height={totalHeight}
        viewBox={`0 0 ${width} ${totalHeight}`}
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <Defs>
          <SvgLinearGradient id="roadBody" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.warningSoft} stopOpacity="0.95" />
            <Stop offset="1" stopColor={colors.bgElevated} stopOpacity="0.95" />
          </SvgLinearGradient>
          <SvgLinearGradient id="roadEdge" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradients.success[1]} stopOpacity="0.6" />
            <Stop offset="1" stopColor={gradients.success[1]} stopOpacity="0.4" />
          </SvgLinearGradient>
          <SvgLinearGradient id="pine" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={pineLight} stopOpacity="1" />
            <Stop offset="1" stopColor={pineDark} stopOpacity="1" />
          </SvgLinearGradient>
          <SvgLinearGradient id="oak" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={oakLight} stopOpacity="1" />
            <Stop offset="1" stopColor={oakDark} stopOpacity="1" />
          </SvgLinearGradient>
          <SvgLinearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradients.league[1]} stopOpacity="0.95" />
            <Stop offset="1" stopColor={colors.warning} stopOpacity="0.95" />
          </SvgLinearGradient>
          <SvgLinearGradient id="peakRay" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={gradients.league[0]} stopOpacity="0.85" />
            <Stop offset="1" stopColor={gradients.league[0]} stopOpacity="0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="rock" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={colors.bgElevated} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.textMuted} stopOpacity="0.85" />
          </SvgLinearGradient>
          {/* Su (gölet / deniz) */}
          <SvgLinearGradient id="water" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={gradients.ocean[0]} stopOpacity="0.85" />
            <Stop offset="1" stopColor={gradients.ocean[1]} stopOpacity="0.95" />
          </SvgLinearGradient>
          <SvgLinearGradient id="waterDeep" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={gradients.ocean[1]} stopOpacity="0.9" />
            <Stop offset="1" stopColor={colors.textPrimary} stopOpacity="0.5" />
          </SvgLinearGradient>
          {/* Köprü ahşap (wood gradient yukarıda zaten var) */}
          <SvgLinearGradient id="bridgePlank" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.warning} stopOpacity="1" />
            <Stop offset="1" stopColor={gradients.streak[0]} stopOpacity="0.9" />
          </SvgLinearGradient>
        </Defs>

        {/* === GÖLETLER (yol altında, sahnenin önemli detayı) === */}
        {waterFeatures.ponds.map((p, i) => (
          <React.Fragment key={`pond-${i}`}>
            {/* Kum kıyı şeridi (dış halka) */}
            <Ellipse
              cx={p.x}
              cy={p.y}
              rx={p.rx + 8}
              ry={p.ry + 6}
              fill={colors.warningSoft}
              opacity={0.85}
            />
            {/* Yumuşak gölge zemine */}
            <Ellipse
              cx={p.x}
              cy={p.y + 4}
              rx={p.rx + 4}
              ry={p.ry + 2}
              fill={colors.textPrimary}
              opacity={0.1}
            />
            {/* Su yüzeyi */}
            <Ellipse
              cx={p.x}
              cy={p.y}
              rx={p.rx}
              ry={p.ry}
              fill="url(#water)"
            />
            {/* Derinlik gradyanı (alt yarısı koyu) */}
            <Ellipse
              cx={p.x}
              cy={p.y + p.ry * 0.3}
              rx={p.rx * 0.85}
              ry={p.ry * 0.55}
              fill="url(#waterDeep)"
              opacity={0.4}
            />
            {/* Dalga çizgileri */}
            <Path
              d={`M ${p.x - p.rx * 0.4} ${p.y - p.ry * 0.3}
                  q ${p.rx * 0.18} ${-3} ${p.rx * 0.36} 0
                  q ${p.rx * 0.18} ${-3} ${p.rx * 0.36} 0`}
              stroke={colors.white}
              strokeWidth={1.2}
              fill="none"
              opacity={0.7}
              strokeLinecap="round"
            />
            <Path
              d={`M ${p.x - p.rx * 0.35} ${p.y + p.ry * 0.1}
                  q ${p.rx * 0.16} ${-3} ${p.rx * 0.32} 0
                  q ${p.rx * 0.16} ${-3} ${p.rx * 0.32} 0`}
              stroke={colors.white}
              strokeWidth={1}
              fill="none"
              opacity={0.55}
              strokeLinecap="round"
            />
            {/* Nilüfer yaprakları */}
            <Circle
              cx={p.x - p.rx * 0.55}
              cy={p.y + p.ry * 0.25}
              r={5}
              fill={gradients.success[0]}
              opacity={0.95}
            />
            <Path
              d={`M ${p.x - p.rx * 0.55 - 5} ${p.y + p.ry * 0.25}
                  L ${p.x - p.rx * 0.55} ${p.y + p.ry * 0.25}`}
              stroke={gradients.success[1]}
              strokeWidth={0.8}
            />
            <Circle
              cx={p.x + p.rx * 0.5}
              cy={p.y - p.ry * 0.35}
              r={4}
              fill={gradients.mint[1]}
              opacity={0.95}
            />
            {/* Nilüfer çiçeği */}
            <Circle
              cx={p.x - p.rx * 0.55}
              cy={p.y + p.ry * 0.25 - 1}
              r={1.6}
              fill={gradients.sunset[0]}
            />
            {/* Küçük balık silüeti */}
            <Path
              d={`M ${p.x + p.rx * 0.1} ${p.y + p.ry * 0.05}
                  q 4 -2 8 0
                  q -3 1 -8 0 Z
                  M ${p.x + p.rx * 0.1 + 8} ${p.y + p.ry * 0.05}
                  l 2 -2 l 0 4 z`}
              fill={colors.white}
              opacity={0.7}
            />
          </React.Fragment>
        ))}

        {/* === Yol katmanları === */}
        <Path
          d={pathD}
          stroke={colors.textPrimary}
          strokeWidth={36}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.07}
          transform={`translate(0 4)`}
        />
        <Path
          d={pathD}
          stroke="url(#roadEdge)"
          strokeWidth={32}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d={pathD}
          stroke={gradients.success[1]}
          strokeWidth={26}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.55}
        />
        <Path
          d={pathD}
          stroke="url(#roadBody)"
          strokeWidth={22}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d={pathD}
          stroke={colors.white}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.32}
          transform={`translate(0 -3)`}
        />

        {/* Taş döşeme noktaları (yol üzerinde) */}
        {decorations.stones.map((s, i) => (
          <Circle
            key={`st-${i}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={colors.textSecondary}
            opacity={0.32}
          />
        ))}

        {/* === AHŞAP KÖPRÜ (yol üzerinde) === */}
        {waterFeatures.bridge ? (
          (() => {
            const b = waterFeatures.bridge;
            const deg = (b.angle * 180) / Math.PI;
            const W = 64; // köprü boyu
            const H = 30; // köprü genişliği
            const planks = 8;
            return (
              <Path
                d={`M ${-W / 2} ${-H / 2} L ${W / 2} ${-H / 2}
                    L ${W / 2} ${H / 2} L ${-W / 2} ${H / 2} Z
                    ${Array.from({ length: planks })
                      .map((_, i) => {
                        const px = -W / 2 + (W / planks) * i + W / planks / 2;
                        return `M ${px} ${-H / 2 + 2} L ${px} ${H / 2 - 2}`;
                      })
                      .join(' ')}`}
                fill="url(#bridgePlank)"
                stroke={colors.warning}
                strokeWidth={1}
                transform={`translate(${b.x} ${b.y}) rotate(${deg})`}
              />
            );
          })()
        ) : null}

        {/* Köprü parmaklıkları (üst ve alt kalın çizgi) */}
        {waterFeatures.bridge ? (
          (() => {
            const b = waterFeatures.bridge;
            const deg = (b.angle * 180) / Math.PI;
            return (
              <>
                <Path
                  d={`M -34 -18 L 34 -18 M -34 18 L 34 18`}
                  stroke={colors.warning}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  fill="none"
                  transform={`translate(${b.x} ${b.y}) rotate(${deg})`}
                />
                {/* Parmaklık dikmeleri */}
                <Path
                  d={`M -28 -18 L -28 -22 M -14 -18 L -14 -22 M 0 -18 L 0 -22 M 14 -18 L 14 -22 M 28 -18 L 28 -22
                      M -28 18 L -28 22 M -14 18 L -14 22 M 0 18 L 0 22 M 14 18 L 14 22 M 28 18 L 28 22`}
                  stroke={colors.warning}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  fill="none"
                  transform={`translate(${b.x} ${b.y}) rotate(${deg})`}
                />
                {/* Köprü altı su izi (birkaç dalga) */}
                <Path
                  d={`M -36 0 q 6 -2 12 0 q 6 -2 12 0 q 6 -2 12 0 q 6 -2 12 0`}
                  stroke={gradients.ocean[0]}
                  strokeWidth={1.2}
                  fill="none"
                  opacity={0.55}
                  transform={`translate(${b.x} ${b.y}) rotate(${deg})`}
                />
              </>
            );
          })()
        ) : null}

        {/* Bitki/kaya kompozisyonu — y sırasıyla derinlik */}
        {decorations.flora.map((f, i) => {
          const k = `f-${i}`;
          switch (f.kind) {
            case 'pine': {
              // Çam: üç katmanlı üçgen + ince gövde
              const s = f.scale;
              return (
                <Path
                  key={k}
                  d={`M ${f.x} ${f.y - 14 * s}
                      L ${f.x - 7 * s} ${f.y - 2 * s}
                      L ${f.x - 3 * s} ${f.y - 2 * s}
                      L ${f.x - 8 * s} ${f.y + 6 * s}
                      L ${f.x - 3 * s} ${f.y + 6 * s}
                      L ${f.x - 9 * s} ${f.y + 14 * s}
                      L ${f.x + 9 * s} ${f.y + 14 * s}
                      L ${f.x + 3 * s} ${f.y + 6 * s}
                      L ${f.x + 8 * s} ${f.y + 6 * s}
                      L ${f.x + 3 * s} ${f.y - 2 * s}
                      L ${f.x + 7 * s} ${f.y - 2 * s} Z
                      M ${f.x - 1.5 * s} ${f.y + 14 * s}
                      L ${f.x - 1.5 * s} ${f.y + 18 * s}
                      L ${f.x + 1.5 * s} ${f.y + 18 * s}
                      L ${f.x + 1.5 * s} ${f.y + 14 * s} Z`}
                  fill="url(#pine)"
                  stroke={pineDark}
                  strokeWidth={0.4}
                />
              );
            }
            case 'oak': {
              // Meşe: yuvarlak yaprak topu (3 baloncuk birleşik) + gövde
              const s = f.scale;
              return (
                <Path
                  key={k}
                  d={`M ${f.x - 6 * s} ${f.y + 4 * s}
                      a 7 ${7 * s} 0 1 1 ${10 * s} ${-6 * s}
                      a 6 ${6 * s} 0 1 1 ${4 * s} ${10 * s}
                      a 7 ${7 * s} 0 1 1 ${-12 * s} ${2 * s}
                      a 6 ${6 * s} 0 1 1 ${-2 * s} ${-6 * s} Z
                      M ${f.x - 1.4 * s} ${f.y + 9 * s}
                      L ${f.x - 1.4 * s} ${f.y + 16 * s}
                      L ${f.x + 1.4 * s} ${f.y + 16 * s}
                      L ${f.x + 1.4 * s} ${f.y + 9 * s} Z`}
                  fill="url(#oak)"
                  stroke={oakDark}
                  strokeWidth={0.4}
                />
              );
            }
            case 'shrub': {
              // Çalı: yarım daire kombinasyonu
              const s = f.scale;
              return (
                <Path
                  key={k}
                  d={`M ${f.x - 7 * s} ${f.y + 4 * s}
                      a 4 ${4 * s} 0 1 1 ${5 * s} ${-3 * s}
                      a 4 ${4 * s} 0 1 1 ${5 * s} ${3 * s}
                      a 4 ${4 * s} 0 1 1 ${4 * s} ${1 * s}
                      L ${f.x + 7 * s} ${f.y + 5 * s}
                      L ${f.x - 7 * s} ${f.y + 5 * s} Z`}
                  fill={shrubColor}
                  opacity={0.92}
                  stroke={pineDark}
                  strokeWidth={0.3}
                />
              );
            }
            case 'flower': {
              // Sap + 5 yaprak + merkez
              const s = f.scale;
              const color = flowerPalette[f.variant % flowerPalette.length];
              return (
                <Path
                  key={k}
                  d={`M ${f.x} ${f.y + 6 * s}
                      L ${f.x} ${f.y - 1 * s}
                      M ${f.x} ${f.y - 4 * s}
                      m -2.4 0
                      a 2.4 2.4 0 1 0 4.8 0
                      a 2.4 2.4 0 1 0 -4.8 0
                      M ${f.x - 4 * s} ${f.y - 5 * s}
                      a 2 2 0 1 1 3 ${-2 * s}
                      M ${f.x + 4 * s} ${f.y - 5 * s}
                      a 2 2 0 1 0 -3 ${-2 * s}`}
                  fill={color}
                  stroke={color}
                  strokeWidth={0.6}
                  strokeLinecap="round"
                />
              );
            }
            case 'mushroom': {
              // Bej sap + kırmızı şapka + beyaz nokta
              const s = f.scale;
              return (
                <Path
                  key={k}
                  d={`M ${f.x - 2 * s} ${f.y + 4 * s}
                      L ${f.x - 2 * s} ${f.y}
                      L ${f.x + 2 * s} ${f.y}
                      L ${f.x + 2 * s} ${f.y + 4 * s} Z
                      M ${f.x - 5 * s} ${f.y}
                      a 5 ${4 * s} 0 1 1 ${10 * s} 0 Z`}
                  fill={mushroomCap}
                  stroke={mushroomStem}
                  strokeWidth={0.6}
                />
              );
            }
            case 'rock': {
              // Düzensiz taş
              const s = f.scale;
              return (
                <Path
                  key={k}
                  d={`M ${f.x - 6 * s} ${f.y + 3 * s}
                      L ${f.x - 4 * s} ${f.y - 3 * s}
                      L ${f.x + 2 * s} ${f.y - 4 * s}
                      L ${f.x + 6 * s} ${f.y - 1 * s}
                      L ${f.x + 5 * s} ${f.y + 3 * s} Z`}
                  fill="url(#rock)"
                  stroke={rockColor}
                  strokeWidth={0.5}
                />
              );
            }
            default:
              return null;
          }
        })}

        {/* Mantar şapka beyaz noktalar — render ikinci geçişte üst katman */}
        {decorations.flora
          .filter((f) => f.kind === 'mushroom')
          .map((f, i) => {
            const s = f.scale;
            return (
              <Circle
                key={`mdot-${i}`}
                cx={f.x - 1.4 * s}
                cy={f.y - 1.4 * s}
                r={0.8 * s}
                fill={colors.white}
                opacity={0.85}
              />
            );
          })}

        {/* Çiçek merkez parıltısı — sarı nokta */}
        {decorations.flora
          .filter((f) => f.kind === 'flower')
          .map((f, i) => (
            <Circle
              key={`fc-${i}`}
              cx={f.x}
              cy={f.y - 4 * f.scale}
              r={0.8 * f.scale}
              fill={gradients.league[0]}
            />
          ))}

        {/* Durakların altında oval gölge platform — level için */}
        {positions.map((p, i) => {
          if (p.station.kind !== 'level') return null;
          return (
            <Ellipse
              key={`shadow-${i}`}
              cx={p.x}
              cy={p.y + 44}
              rx={42}
              ry={6}
              fill={colors.textPrimary}
              opacity={0.18}
            />
          );
        })}

        {/* BAŞLANGIÇ ahşap tabela */}
        {startPos ? (
          <>
            <Path
              d={`M ${startPos.x - 4} ${startPos.y + 56}
                  L ${startPos.x - 4} ${startPos.y + 84}
                  L ${startPos.x + 4} ${startPos.y + 84}
                  L ${startPos.x + 4} ${startPos.y + 56} Z`}
              fill="url(#wood)"
            />
            <Path
              d={`M ${startPos.x - 36} ${startPos.y + 58}
                  L ${startPos.x + 36} ${startPos.y + 58}
                  L ${startPos.x + 36} ${startPos.y + 74}
                  L ${startPos.x + 30} ${startPos.y + 78}
                  L ${startPos.x - 36} ${startPos.y + 78} Z`}
              fill="url(#wood)"
              stroke={colors.bgBase}
              strokeWidth={1.2}
            />
          </>
        ) : null}

        {/* ZİRVE altın ışın huzmesi */}
        {peakPos ? (
          <>
            <Path
              d={`M ${peakPos.x} ${peakPos.y - 50}
                  L ${peakPos.x - 28} 0
                  L ${peakPos.x - 8} 0 Z`}
              fill="url(#peakRay)"
              opacity={0.7}
            />
            <Path
              d={`M ${peakPos.x} ${peakPos.y - 50}
                  L ${peakPos.x + 28} 0
                  L ${peakPos.x + 8} 0 Z`}
              fill="url(#peakRay)"
              opacity={0.7}
            />
            <Path
              d={`M ${peakPos.x} ${peakPos.y - 50}
                  L ${peakPos.x - 50} 4
                  L ${peakPos.x - 32} 0 Z`}
              fill="url(#peakRay)"
              opacity={0.4}
            />
            <Path
              d={`M ${peakPos.x} ${peakPos.y - 50}
                  L ${peakPos.x + 50} 4
                  L ${peakPos.x + 32} 0 Z`}
              fill="url(#peakRay)"
              opacity={0.4}
            />
          </>
        ) : null}
      </Svg>

      {/* BAŞLANGIÇ yazısı */}
      {startPos ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: startPos.x - 44,
            top: startPos.y + 60,
            width: 88,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '900',
              color: colors.white,
              letterSpacing: 0.8,
            }}
          >
            BAŞLANGIÇ
          </Text>
        </View>
      ) : null}

      {/* ZİRVE etiketi */}
      {peakPos ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: peakPos.x - 60,
            top: 6,
            width: 120,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '900',
              color: gradients.league[1],
              letterSpacing: 1.2,
            }}
          >
            ✦ ZİRVE ✦
          </Text>
        </View>
      ) : null}

      {/* Duraklar */}
      {positions.map(({ x, y, station }) => {
        const haloEst =
          station.kind === 'level' ? 96 : station.kind === 'badge' ? 80 : 60;
        return (
          <View
            key={station.id}
            style={{
              position: 'absolute',
              left: x - haloEst / 2,
              top: y - haloEst / 2,
              width: haloEst,
              alignItems: 'center',
            }}
          >
            <JourneyStation station={station} onPress={onStationPress} />
          </View>
        );
      })}

      {/* Maskot — kullanıcı avatarı, current durağın üstünde */}
      {currentIdx >= 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: positions[currentIdx].x - 32,
            top: positions[currentIdx].y - 72,
            width: 64,
            height: 64,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Nabız atan dış halo */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: gradients.league[0],
                opacity: 0.4,
              },
              haloStyle,
            ]}
          />
          {/* Dönen parıltı yıldız çemberi */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: 80,
                height: 80,
                alignItems: 'center',
                justifyContent: 'center',
              },
              sparkleRotStyle,
            ]}
          >
            <Animated.View
              style={[
                { position: 'absolute', top: -2, left: 36 },
                sparkleAStyle,
              ]}
            >
              <Sparkles size={14} color={gradients.league[0]} />
            </Animated.View>
            <Animated.View
              style={[
                { position: 'absolute', bottom: -2, right: 36 },
                sparkleBStyle,
              ]}
            >
              <Sparkles size={12} color={gradients.league[0]} />
            </Animated.View>
          </Animated.View>

          {/* "BURADASIN" damla işareti — avatarın üstünde */}
          <View
            style={{
              position: 'absolute',
              top: -22,
              backgroundColor: colors.bgBase,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: gradients.league[1],
              shadowColor: gradients.league[1],
              shadowOpacity: 0.4,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '900',
                color: gradients.league[1],
                letterSpacing: 0.5,
              }}
            >
              SEN
            </Text>
          </View>

          {/* Zıplayan + nefes alan avatar */}
          <Animated.View style={mascotStyle}>
            <Avatar
              avatarId={avatarId}
              photoURL={photoURL}
              fallbackSeed={uid}
              size={56}
              ring
              ringWidth={3}
            />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

export const JourneyPath = memo(JourneyPathBase);

export function getCurrentStationY(stations: Station[]): number {
  const idx = stations.findIndex((s) => s.isCurrent);
  if (idx < 0) return 0;
  return 60 + idx * STEP_HEIGHT;
}

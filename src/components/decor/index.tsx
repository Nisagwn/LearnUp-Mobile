/**
 * Doğa dekoratif SVG component'leri — orman/bahçe temasının küçük dokunuşları.
 *
 * Her component küçük (<100 LOC), token-uyumlu (useThemeColors), opsiyonel size/color.
 * Hero arka planları, kart köşeleri, empty state'ler, divider'lar için kullanılır.
 */

import { memo } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLG,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { useThemeColors } from '@/hooks/useThemeColors';

type DecorBase = { size?: number; opacity?: number };

/**
 * Kart köşesine yapışan dekoratif yaprak.
 * Sağ üst (default) veya placement prop ile diğer köşeler.
 */
export const LeafCorner = memo(function LeafCorner({
  size = 56,
  placement = 'top-right',
  opacity = 0.45,
}: DecorBase & { placement?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' }) {
  const { gradients } = useThemeColors();
  const rotate = {
    'top-right': 0,
    'top-left': 90,
    'bottom-right': 270,
    'bottom-left': 180,
  }[placement];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ position: 'absolute', top: 0, right: 0, transform: [{ rotate: `${rotate}deg` }] }}
      pointerEvents="none"
    >
      <Defs>
        <SvgLG id="lc-grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={gradients.success[0]} stopOpacity={opacity} />
          <Stop offset="1" stopColor={gradients.forest[1]} stopOpacity={opacity * 0.7} />
        </SvgLG>
      </Defs>
      {/* Yaprak ana şekli */}
      <Path
        d="M 64 0 Q 50 8 38 18 Q 24 32 10 50 Q 32 48 50 36 Q 60 24 64 0 Z"
        fill="url(#lc-grad)"
      />
      {/* Yaprak damarı */}
      <Path
        d="M 60 4 Q 40 24 16 48"
        stroke={gradients.forest[1]}
        strokeWidth="1"
        fill="none"
        opacity={opacity}
      />
    </Svg>
  );
});

/**
 * Dal motifi divider — yatay bir ayraç gibi davranır.
 * İki yandan kavisli iki yaprak içerir.
 */
export const BranchDivider = memo(function BranchDivider({
  width = 220,
  opacity = 0.5,
}: { width?: number; opacity?: number }) {
  const { gradients, colors } = useThemeColors();
  return (
    <Svg width={width} height={20} viewBox={`0 0 ${width} 20`}>
      {/* Dal */}
      <Path
        d={`M 0 10 Q ${width / 4} 8 ${width / 2} 10 Q ${(width * 3) / 4} 12 ${width} 10`}
        stroke={colors.warning}
        strokeWidth="1.5"
        fill="none"
        opacity={opacity}
      />
      {/* Sol yaprak */}
      <Ellipse
        cx={width / 3}
        cy={6}
        rx={5}
        ry={2.5}
        fill={gradients.success[0]}
        opacity={opacity}
        transform={`rotate(-30 ${width / 3} 6)`}
      />
      {/* Sağ yaprak */}
      <Ellipse
        cx={(width * 2) / 3}
        cy={14}
        rx={5}
        ry={2.5}
        fill={gradients.success[1]}
        opacity={opacity}
        transform={`rotate(30 ${(width * 2) / 3} 14)`}
      />
    </Svg>
  );
});

/**
 * Yosun deseni — repeating pattern arka planı.
 * Hero kartları içinde subtle background olarak kullanılır.
 */
export const MossPattern = memo(function MossPattern({
  width = 300,
  height = 120,
  opacity = 0.18,
}: { width?: number; height?: number; opacity?: number }) {
  const { colors, gradients } = useThemeColors();
  const dots: Array<{ x: number; y: number; r: number; c: string }> = [];
  const palette = [gradients.success[0], gradients.moss[0], colors.warningSoft];
  for (let i = 0; i < 40; i++) {
    const seed = i * 137 + 11;
    dots.push({
      x: (seed * 17) % width,
      y: (seed * 23) % height,
      r: 1.5 + (seed % 3),
      c: palette[seed % palette.length],
    });
  }
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', left: 0, top: 0 }}
      pointerEvents="none"
    >
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity={opacity} />
      ))}
    </Svg>
  );
});

/**
 * Meşe palamudu rozeti — küçük decoration badge.
 */
export const AcornBadge = memo(function AcornBadge({ size = 18 }: { size?: number }) {
  const { gradients, colors } = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Üst başlık (şapka) */}
      <Path
        d="M 4 9 Q 12 4 20 9 Q 20 11 12 11 Q 4 11 4 9 Z"
        fill={gradients.cedar[1]}
      />
      {/* Doku */}
      <Path
        d="M 6 8 L 18 8 M 6 10 L 18 10"
        stroke={gradients.cedar[0]}
        strokeWidth="0.5"
        opacity="0.5"
      />
      {/* Alt gövde */}
      <Path
        d="M 5 11 Q 5 20 12 22 Q 19 20 19 11 Z"
        fill={gradients.earth[0]}
      />
      {/* Highlight */}
      <Ellipse cx={9} cy={14} rx={1.5} ry={2.5} fill={colors.warningSoft} opacity={0.6} />
    </Svg>
  );
});

/**
 * Mantar nokta — liste bullet'larda kullanılır.
 */
export const MushroomDot = memo(function MushroomDot({ size = 12 }: { size?: number }) {
  const { gradients, colors } = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {/* Sap */}
      <Rect x={6} y={8} width={4} height={5} rx={1} fill={colors.warningSoft} />
      {/* Şapka */}
      <Ellipse cx={8} cy={7} rx={7} ry={4} fill={gradients.sunset[1]} />
      {/* Noktalar */}
      <Circle cx={5} cy={6} r={1} fill={colors.white} opacity={0.85} />
      <Circle cx={10} cy={7} r={0.8} fill={colors.white} opacity={0.85} />
    </Svg>
  );
});

/**
 * Eğreltiotu — ekran kenarında dekoratif yan element.
 */
export const FernSide = memo(function FernSide({
  height = 120,
  side = 'right',
  opacity = 0.35,
}: { height?: number; side?: 'left' | 'right'; opacity?: number }) {
  const { gradients } = useThemeColors();
  const w = height * 0.4;
  const flip = side === 'left' ? -1 : 1;
  return (
    <Svg
      width={w}
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      style={{
        position: 'absolute',
        [side]: 0,
        top: 0,
        transform: [{ scaleX: flip }],
      }}
      pointerEvents="none"
    >
      {/* Ana sap */}
      <Path
        d={`M ${w * 0.5} ${height} Q ${w * 0.3} ${height / 2} ${w * 0.5} 0`}
        stroke={gradients.moss[0]}
        strokeWidth="1.5"
        fill="none"
        opacity={opacity * 1.5}
      />
      {/* Yaprakcıklar (her iki yöne) */}
      {Array.from({ length: 10 }).map((_, i) => {
        const t = i / 10;
        const y = height * (1 - t);
        const xCenter = w * 0.5 + (Math.sin(t * Math.PI) * w * 0.15);
        const leafLen = (1 - t) * w * 0.4 + 4;
        return (
          <Ellipse
            key={i}
            cx={xCenter + leafLen / 2}
            cy={y}
            rx={leafLen / 2}
            ry={2.5}
            fill={gradients.success[1]}
            opacity={opacity}
          />
        );
      })}
    </Svg>
  );
});

/**
 * Skyline horizon — hero'ların altında bulanık ağaç silüeti.
 */
export const SkylineHorizon = memo(function SkylineHorizon({
  width = 360,
  height = 40,
  opacity = 0.4,
}: { width?: number; height?: number; opacity?: number }) {
  const { gradients } = useThemeColors();
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', left: 0, bottom: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <SvgLG id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={gradients.forest[1]} stopOpacity="0" />
          <Stop offset="1" stopColor={gradients.forest[1]} stopOpacity={opacity} />
        </SvgLG>
      </Defs>
      {/* Düzensiz ağaç silüetleri */}
      <Path
        d={`M 0 ${height} L 0 ${height * 0.6}
            L ${width * 0.08} ${height * 0.4}
            L ${width * 0.16} ${height * 0.55}
            L ${width * 0.24} ${height * 0.35}
            L ${width * 0.32} ${height * 0.5}
            L ${width * 0.42} ${height * 0.3}
            L ${width * 0.5} ${height * 0.45}
            L ${width * 0.6} ${height * 0.25}
            L ${width * 0.68} ${height * 0.42}
            L ${width * 0.76} ${height * 0.32}
            L ${width * 0.84} ${height * 0.5}
            L ${width * 0.92} ${height * 0.38}
            L ${width} ${height * 0.55}
            L ${width} ${height} Z`}
        fill="url(#sky-grad)"
      />
    </Svg>
  );
});

/**
 * Uçan yaprak partikülleri — animasyon eklemek isteyenlere temel SVG.
 * Sadece statik yapraklar (animasyon parent'ta yapılır).
 */
export const FloatingLeaf = memo(function FloatingLeaf({
  size = 14,
  color,
}: { size?: number; color?: string }) {
  const { gradients } = useThemeColors();
  const fill = color || gradients.success[0];
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M 8 0 Q 14 4 14 10 Q 10 16 6 14 Q 0 10 4 4 Q 6 1 8 0 Z" fill={fill} />
      <Path d="M 8 2 Q 6 8 6 14" stroke={gradients.forest[1]} strokeWidth="0.5" fill="none" />
    </Svg>
  );
});

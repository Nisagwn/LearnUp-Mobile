import { memo } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  width: number;
  height: number;
};

/**
 * Tam ekran doğa arka planı: üst gökyüzü gradyanı + bulutlar, alt çim/orman
 * silüetleri (3 katmanlı), dağılmış pastel çiçek ve yapraklar.
 * Tüm renkler theme token'larından — hardcoded hex yok.
 */
function NatureBackdropBase({ width, height }: Props) {
  const { colors, gradients } = useThemeColors();

  // Deterministik dağılım — Math.random YOK (re-render'da kaymasın)
  const flowers = Array.from({ length: 42 }).map((_, i) => {
    const rx = (i * 73) % width;
    const ry = 80 + ((i * 137) % (height - 160));
    const sz = 2 + (i % 3);
    const palette = [
      gradients.sunset[0],
      gradients.league[0],
      gradients.brand[0],
      gradients.mint[0],
      gradients.ocean[0],
    ];
    return { rx, ry, sz, color: palette[i % palette.length] };
  });

  const leaves = Array.from({ length: 18 }).map((_, i) => {
    const rx = (i * 197) % width;
    const ry = 60 + ((i * 257) % (height - 120));
    const rot = (i * 47) % 360;
    return { rx, ry, rot };
  });

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width, height }}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          {/* Gökyüzü: turkuaz → mint → bgBase yumuşak geçiş */}
          <SvgLinearGradient id="sky" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={gradients.ocean[0]} stopOpacity="0.22" />
            <Stop offset="0.35" stopColor={gradients.mint[0]} stopOpacity="0.28" />
            <Stop offset="1" stopColor={colors.bgBase} stopOpacity="1" />
          </SvgLinearGradient>
          {/* Çim: açık → koyu yeşil */}
          <SvgLinearGradient id="grass" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={gradients.mint[0]} stopOpacity="0.05" />
            <Stop offset="1" stopColor={gradients.success[1]} stopOpacity="0.22" />
          </SvgLinearGradient>
          {/* Deniz (en altta panoramik kıyı) */}
          <SvgLinearGradient id="seaWater" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={gradients.ocean[0]} stopOpacity="0.75" />
            <Stop offset="1" stopColor={gradients.ocean[1]} stopOpacity="0.9" />
          </SvgLinearGradient>
          <SvgLinearGradient id="sand" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={colors.warningSoft} stopOpacity="0.95" />
            <Stop offset="1" stopColor={colors.warning} stopOpacity="0.7" />
          </SvgLinearGradient>
        </Defs>

        {/* Üst gökyüzü zemini */}
        <Path d={`M0 0 H${width} V${height * 0.55} H0 Z`} fill="url(#sky)" />
        {/* Çim zemini */}
        <Path
          d={`M0 ${height * 0.4} H${width} V${height} H0 Z`}
          fill="url(#grass)"
        />

        {/* Bulutlar — üstte yumuşak */}
        <Ellipse cx={width * 0.18} cy={60} rx={36} ry={11} fill={colors.white} opacity={0.7} />
        <Ellipse cx={width * 0.22} cy={56} rx={24} ry={9} fill={colors.white} opacity={0.7} />
        <Ellipse cx={width * 0.72} cy={120} rx={42} ry={12} fill={colors.white} opacity={0.6} />
        <Ellipse cx={width * 0.78} cy={116} rx={26} ry={9} fill={colors.white} opacity={0.6} />

        {/* Arka orman silüeti — uzak, soluk yeşil tepeler */}
        <Path
          d={`M0 ${height * 0.55}
              Q${width * 0.15} ${height * 0.48} ${width * 0.32} ${height * 0.55}
              Q${width * 0.5} ${height * 0.5} ${width * 0.7} ${height * 0.55}
              Q${width * 0.85} ${height * 0.5} ${width} ${height * 0.55}
              V${height} H0 Z`}
          fill={gradients.mint[1]}
          opacity={0.18}
        />

        {/* Yapraklar — dağılmış, opaca */}
        {leaves.map((l, i) => (
          <Path
            key={`leaf-${i}`}
            d={`M${l.rx} ${l.ry} q4 -6 10 0 q-4 6 -10 0 z`}
            fill={i % 2 === 0 ? gradients.success[0] : gradients.mint[1]}
            opacity={0.32}
            transform={`rotate(${l.rot} ${l.rx + 5} ${l.ry})`}
          />
        ))}

        {/* Pastel çiçek noktaları */}
        {flowers.map((f, i) => (
          <Circle
            key={`flower-${i}`}
            cx={f.rx}
            cy={f.ry}
            r={f.sz}
            fill={f.color}
            opacity={0.4}
          />
        ))}

        {/* === DENİZ — en altta panoramik kıyı === */}
        {/* Kum şeridi (dalgalı kıyı çizgisi) */}
        <Path
          d={`M 0 ${height - 110}
              Q ${width * 0.1} ${height - 102} ${width * 0.22} ${height - 108}
              Q ${width * 0.38} ${height - 116} ${width * 0.52} ${height - 106}
              Q ${width * 0.68} ${height - 100} ${width * 0.82} ${height - 110}
              Q ${width * 0.92} ${height - 116} ${width} ${height - 108}
              L ${width} ${height - 80} L 0 ${height - 80} Z`}
          fill="url(#sand)"
          opacity={0.85}
        />
        {/* Deniz su yüzeyi */}
        <Path
          d={`M 0 ${height - 82}
              L ${width} ${height - 82}
              L ${width} ${height} L 0 ${height} Z`}
          fill="url(#seaWater)"
        />
        {/* Dalga köpük çizgileri */}
        {Array.from({ length: 6 }).map((_, i) => {
          const wy = height - 70 + i * 11;
          const offset = (i * 27) % 60;
          return (
            <Path
              key={`wave-${i}`}
              d={`M ${-offset} ${wy}
                  q 10 -3 20 0
                  q 10 3 20 0
                  q 10 -3 20 0
                  q 10 3 20 0
                  q 10 -3 20 0
                  q 10 3 20 0
                  q 10 -3 20 0
                  q 10 3 20 0
                  q 10 -3 20 0
                  q 10 3 20 0
                  q 10 -3 20 0`}
              stroke={colors.white}
              strokeWidth={1.2}
              fill="none"
              opacity={0.45 - i * 0.05}
              strokeLinecap="round"
            />
          );
        })}
        {/* Uzakta küçük yelkenli ada silüeti */}
        <Path
          d={`M ${width * 0.75} ${height - 88}
              L ${width * 0.78} ${height - 110}
              L ${width * 0.82} ${height - 88} Z`}
          fill={colors.bgElevated}
          opacity={0.6}
        />
        {/* Ada üzerinde palmiye */}
        <Path
          d={`M ${width * 0.78} ${height - 108}
              L ${width * 0.78} ${height - 116}
              M ${width * 0.78} ${height - 116}
              q -5 -2 -8 0
              M ${width * 0.78} ${height - 116}
              q 5 -2 8 0
              M ${width * 0.78} ${height - 116}
              q -3 -4 -2 -6`}
          stroke={gradients.success[1]}
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
        />
        {/* Birkaç yelkenli silüet */}
        <Path
          d={`M ${width * 0.15} ${height - 56}
              L ${width * 0.15} ${height - 70}
              L ${width * 0.2} ${height - 56} Z
              M ${width * 0.12} ${height - 56}
              L ${width * 0.22} ${height - 56}
              L ${width * 0.21} ${height - 52}
              L ${width * 0.13} ${height - 52} Z`}
          fill={colors.white}
          opacity={0.85}
        />
        <Path
          d={`M ${width * 0.55} ${height - 38}
              L ${width * 0.55} ${height - 48}
              L ${width * 0.58} ${height - 38} Z`}
          fill={colors.white}
          opacity={0.7}
        />
      </Svg>
    </View>
  );
}

export const NatureBackdrop = memo(NatureBackdropBase);

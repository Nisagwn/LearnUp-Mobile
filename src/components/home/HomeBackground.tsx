import { memo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLG,
  Rect,
  Stop,
} from 'react-native-svg';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  width: number;
  height: number;
};

// Kullanıcının yüklediği ana sayfa arka plan PNG'si.
// Dosyayı şuraya bırak: assets/home/home_bg.png
const HOME_BG = require('../../../assets/home/home_bg.png');

/**
 * Ana sayfa arka plan sahnesi — kullanıcının PNG'sini full-cover gösterir.
 *
 *  • Üstte hafif beyaz fade → header text okunabilirliği için
 *  • Altta hafif orman gradient → tab bar üstüne yumuşak geçiş
 *  • Animasyon yok — sade, dikkat dağıtmaz
 */
function HomeBackgroundBase({ width, height }: Props) {
  const { gradients } = useThemeColors();
  if (width <= 0 || height <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        overflow: 'hidden',
      }}
    >
      {/* PNG arka planı — full screen cover */}
      <Image
        source={HOME_BG}
        style={[StyleSheet.absoluteFillObject, { width, height }]}
        resizeMode="cover"
      />

      {/* GENEL beyaz tint — PNG çok parlaksa solgunlaştırır + text okunabilirliği */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: 'rgba(255,255,255,0.45)' },
        ]}
      />

      {/* Üst beyaz fade — header/bell text okunsun */}
      <Svg
        width={width}
        height={Math.min(140, height * 0.18)}
        viewBox={`0 0 ${width} ${Math.min(140, height * 0.18)}`}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <Defs>
          <SvgLG id="hb-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLG>
        </Defs>
        <Rect x={0} y={0} width={width} height={Math.min(140, height * 0.18)} fill="url(#hb-top)" />
      </Svg>

      {/* Alt yumuşak gradient — tab bar üstüne yumuşak geçiş */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: Math.min(160, height * 0.22),
        }}
      >
        <Svg width={width} height={Math.min(160, height * 0.22)}>
          <Defs>
            <SvgLG id="hb-bottom" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.18" />
              <Stop offset="1" stopColor={gradients.forest[1]} stopOpacity="0.28" />
            </SvgLG>
          </Defs>
          <Rect x={0} y={0} width={width} height={Math.min(160, height * 0.22)} fill="url(#hb-bottom)" />
        </Svg>
      </View>
    </View>
  );
}

export const HomeBackground = memo(HomeBackgroundBase);

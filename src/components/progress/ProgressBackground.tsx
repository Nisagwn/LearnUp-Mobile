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

// Kullanıcının yüklediği ilerleme sayfası arka plan PNG'si.
// Dosyayı şuraya bırak: assets/progress/progress_bg.png
const PROGRESS_BG = require('../../../assets/progress/progress_bg.png');

/**
 * İlerleme sayfası arka plan sahnesi — kullanıcının PNG'sini gösterir.
 *  • Genel beyaz tint (PNG soluklaştırma)
 *  • Üst beyaz fade (header text okunsun)
 *  • Alt yumuşak orman gradient
 *  • Animasyon yok
 */
function ProgressBackgroundBase({ width, height }: Props) {
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
        source={PROGRESS_BG}
        style={[StyleSheet.absoluteFillObject, { width, height }]}
        resizeMode="cover"
      />

      {/* GENEL beyaz tint — PNG'yi soluklaştırır + text okunabilirliği */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: 'rgba(255,255,255,0.45)' },
        ]}
      />

      {/* Üst beyaz fade */}
      <Svg
        width={width}
        height={Math.min(140, height * 0.18)}
        viewBox={`0 0 ${width} ${Math.min(140, height * 0.18)}`}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <Defs>
          <SvgLG id="pb-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLG>
        </Defs>
        <Rect x={0} y={0} width={width} height={Math.min(140, height * 0.18)} fill="url(#pb-top)" />
      </Svg>

      {/* Alt yumuşak gradient */}
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
            <SvgLG id="pb-bottom" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.18" />
              <Stop offset="1" stopColor={gradients.forest[1]} stopOpacity="0.28" />
            </SvgLG>
          </Defs>
          <Rect x={0} y={0} width={width} height={Math.min(160, height * 0.22)} fill="url(#pb-bottom)" />
        </Svg>
      </View>
    </View>
  );
}

export const ProgressBackground = memo(ProgressBackgroundBase);

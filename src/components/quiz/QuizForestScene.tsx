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

// Kullanıcının yüklediği arka plan PNG'si.
// Dosyayı şuraya bırak: assets/quiz/quiz_bg.png
const QUIZ_BG = require('../../../assets/quiz/quiz_bg.png');

/**
 * Quiz arka plan sahnesi — kullanıcının yüklediği PNG'yi full-cover gösterir.
 *
 *  • Üst kısımda yumuşak beyaz fade (header'daki Soru #N, Turu Bitir text'leri
 *    PNG ne olursa olsun okunabilir kalsın).
 *  • Alt kısımda yumuşak yeşil-orman fade (Cevapla butonu için yumuşak zemin).
 *  • Animasyon YOK — sade ve dikkat dağıtmaz.
 */
function QuizForestSceneBase({ width, height }: Props) {
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
      {/* Kullanıcının PNG arka planı — full screen cover */}
      <Image
        source={QUIZ_BG}
        style={[StyleSheet.absoluteFillObject, { width, height }]}
        resizeMode="cover"
      />

      {/* GENEL beyaz tint — PNG çok parlak/canlıysa solgunlaştırır.
          %42 opacity beyaz overlay → PNG yarı şeffaf görünür, text okunur. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: 'rgba(255,255,255,0.42)' },
        ]}
      />

      {/* Üst beyaz fade — header text güvenli okunur */}
      <Svg
        width={width}
        height={Math.min(160, height * 0.2)}
        viewBox={`0 0 ${width} ${Math.min(160, height * 0.2)}`}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <Defs>
          <SvgLG id="qfs-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLG>
        </Defs>
        <Rect x={0} y={0} width={width} height={Math.min(160, height * 0.2)} fill="url(#qfs-top)" />
      </Svg>

      {/* Alt yumuşak gradient — Cevapla butonu için */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: Math.min(180, height * 0.28),
        }}
      >
        <Svg width={width} height={Math.min(180, height * 0.28)}>
          <Defs>
            <SvgLG id="qfs-bottom" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.2" />
              <Stop offset="1" stopColor={gradients.forest[1]} stopOpacity="0.3" />
            </SvgLG>
          </Defs>
          <Rect x={0} y={0} width={width} height={Math.min(180, height * 0.28)} fill="url(#qfs-bottom)" />
        </Svg>
      </View>
    </View>
  );
}

export const QuizForestScene = memo(QuizForestSceneBase);

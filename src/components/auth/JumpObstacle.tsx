import { View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  x: number;
  gapY: number;
  containerHeight: number;
  gap: number;
  width?: number;
  /** Gövde rengi (varsayılan accent). Pastel temalar için override edilebilir. */
  bodyColor?: string;
  /** Kapak başlığı rengi (varsayılan accentFg). */
  capColor?: string;
};

const CAP_H = 12;

/**
 * Tek bir engel çifti (üst + alt boru). "Kitap rafı" / "ağaç" estetiğinde.
 */
export function JumpObstacle({
  x,
  gapY,
  containerHeight,
  gap,
  width = 46,
  bodyColor,
  capColor,
}: Props) {
  const { colors } = useThemeColors();
  const body = bodyColor ?? colors.accent;
  const cap = capColor ?? colors.accentFg;
  const topHeight = gapY - gap / 2;
  const bottomY = gapY + gap / 2;
  const bottomHeight = containerHeight - bottomY;

  const bodyStyle = {
    backgroundColor: body,
    borderColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1.5,
  };

  const capStyle = {
    backgroundColor: cap,
    borderColor: 'rgba(255,255,255,0.55)',
  };

  return (
    <View pointerEvents="none">
      {/* Üst engel */}
      {topHeight > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: x,
            top: 0,
            width,
            height: topHeight,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            overflow: 'hidden',
          }}
        >
          <View style={{ flex: 1, ...bodyStyle, borderTopWidth: 0 }} />
          {/* Beyaz pastel overlay */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          />
          {/* Alt kapak başlığı */}
          <View
            style={{
              position: 'absolute',
              left: -2,
              right: -2,
              bottom: 0,
              height: CAP_H,
              borderRadius: 6,
              borderWidth: 1.5,
              ...capStyle,
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 4,
                right: 4,
                top: 2,
                height: 2,
                borderRadius: 1,
                backgroundColor: 'rgba(255,255,255,0.7)',
              }}
            />
          </View>
        </View>
      ) : null}

      {/* Alt engel */}
      {bottomHeight > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: x,
            top: bottomY,
            width,
            height: bottomHeight,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            overflow: 'hidden',
          }}
        >
          <View style={{ flex: 1, ...bodyStyle, borderBottomWidth: 0 }} />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          />
          {/* Üst kapak başlığı */}
          <View
            style={{
              position: 'absolute',
              left: -2,
              right: -2,
              top: 0,
              height: CAP_H,
              borderRadius: 6,
              borderWidth: 1.5,
              ...capStyle,
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 4,
                right: 4,
                bottom: 2,
                height: 2,
                borderRadius: 1,
                backgroundColor: 'rgba(255,255,255,0.7)',
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

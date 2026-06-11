import { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/** Oyun döngüsünün shared value'de tuttuğu engel anlık durumu. */
export type ObsItem = { id: number; x: number; gapY: number };

type Props = {
  id: number;
  gapY: number;
  /** Tüm engellerin canlı x konumları — döngüden sürülür. */
  obsSV: SharedValue<ObsItem[]>;
  containerHeight: number;
  gap: number;
  width?: number;
  /** Gövde rengi. */
  bodyColor: string;
  /** Kapak başlığı rengi. */
  capColor: string;
};

const CAP_H = 12;

/**
 * Tek bir engel çifti (üst + alt boru). Yatay hareket `obsSV`'den
 * `useAnimatedStyle` ile sürülür → React re-render olmadan UI thread'inde kayar.
 */
function JumpObstacleBase({
  id,
  gapY,
  obsSV,
  containerHeight,
  gap,
  width = 46,
  bodyColor,
  capColor,
}: Props) {
  const topHeight = gapY - gap / 2;
  const bottomY = gapY + gap / 2;
  const bottomHeight = containerHeight - bottomY;

  const slideStyle = useAnimatedStyle(() => {
    const arr = obsSV.value;
    let x = -999;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        x = arr[i].x;
        break;
      }
    }
    return { transform: [{ translateX: x }] };
  });

  const bodyStyle = {
    backgroundColor: bodyColor,
    borderColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1.5,
  };
  const capStyle = {
    backgroundColor: capColor,
    borderColor: 'rgba(255,255,255,0.55)',
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, top: 0, width, height: containerHeight },
        slideStyle,
      ]}
    >
      {/* Üst engel */}
      {topHeight > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
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
            left: 0,
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
    </Animated.View>
  );
}

export const JumpObstacle = memo(JumpObstacleBase);

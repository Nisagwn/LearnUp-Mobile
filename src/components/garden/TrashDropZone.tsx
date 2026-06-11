import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  /** Edit mode aktif mi (görünürlük). */
  visible: boolean;
  /** Bitki şu an çöp kutusunun üzerine sürükleniyor mu — büyütme + koyu renk. */
  active: boolean;
  /** Sol kenardan offset (px). */
  leftOffset: number;
  /** Alt kenardan offset (px) — tab bar + safe area dahil. */
  bottomOffset: number;
  /** Daire boyutu. */
  size: number;
};

/**
 * Edit mode'da sol-alt köşede sabit kırmızı çöp kutusu. Hit-test koordinatları
 * parent tarafından deterministik hesaplanır (bu bileşen sadece görsel +
 * idle pulse animasyonu).
 *
 * `pointerEvents="none"` — drag gesture'ları engellemez; drop sırasında parmak
 * bu daireye geldiğinde GardenPlantNode worklet'i hit-test yapıp `onTrash`
 * çağırır.
 */
export function TrashDropZone({
  visible, active, leftOffset, bottomOffset, size,
}: Props) {
  const { colors } = useThemeColors();
  const pulse = useSharedValue(1);
  const hover = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(pulse);
      pulse.value = 1;
      hover.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [visible, pulse, hover]);

  useEffect(() => {
    hover.value = withTiming(active ? 1 : 0, { duration: 140 });
  }, [active, hover]);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value * (1 + hover.value * 0.22) }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    backgroundColor: hover.value > 0.5 ? '#B91C1C' : '#DC2626',
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: leftOffset,
          bottom: bottomOffset,
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        },
        wrapperStyle,
      ]}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: colors.white,
          },
          innerStyle,
        ]}
      >
        <Trash2 size={28} color={colors.white} strokeWidth={2.6} />
      </Animated.View>
      <View
        style={{
          position: 'absolute',
          bottom: -22,
          alignSelf: 'center',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.7)',
        }}
      >
        <Text
          style={{
            fontSize: 9,
            fontWeight: '900',
            color: colors.white,
            letterSpacing: 0.6,
          }}
        >
          {active ? 'BIRAK' : 'AĞILA AT'}
        </Text>
      </View>
    </Animated.View>
  );
}

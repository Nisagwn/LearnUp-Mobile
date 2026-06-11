import { View, Text } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { ArrowDown, Sparkles } from 'lucide-react-native';

type Props = {
  width: number;
  height: number;
};

/**
 * Boş orman → ilk kez gelen kullanıcıya yönlendirme kartı.
 * Sağ alttaki FAB'lara doğru bakan ok ile market/ağıl akışını işaret eder.
 * Plant eklenince fade-out olur (FadeOut + parent conditional render).
 */
export function GardenEmptyHint({ width, height }: Props) {
  // Ok hafifçe yukarı-aşağı zıplar (focal point)
  const bounce = useSharedValue(0);
  useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [bounce]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(400).delay(200)}
      exiting={FadeOut.duration(300)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: height * 0.32,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          maxWidth: width * 0.78,
          paddingVertical: 18,
          paddingHorizontal: 22,
          borderRadius: 22,
          backgroundColor: 'rgba(255,255,255,0.92)',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
          borderWidth: 1.5,
          borderColor: 'rgba(34,197,94,0.35)',
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#DCFCE7',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}
        >
          <Sparkles size={24} color="#16A34A" />
        </View>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '900',
            color: '#0F172A',
            textAlign: 'center',
          }}
        >
          Ormanın boş 🌱
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: '#475569',
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 17,
          }}
        >
          Sağ alttaki markete tıkla → tohum veya{'\n'}
          dekor al → ağıldan sürükleyip yerleştir
        </Text>
      </View>

      {/* Sağ alta bakan zıplayan ok */}
      <Animated.View
        style={[
          {
            marginTop: 24,
            alignItems: 'flex-end',
            paddingRight: width * 0.18,
            alignSelf: 'stretch',
          },
          arrowStyle,
        ]}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: '#22C55E',
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate: '-25deg' }],
            shadowColor: '#16A34A',
            shadowOpacity: 0.4,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
          }}
        >
          <ArrowDown size={22} color="#FFFFFF" strokeWidth={2.8} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

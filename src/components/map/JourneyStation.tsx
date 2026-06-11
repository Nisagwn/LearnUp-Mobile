import { memo, useEffect } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Lock } from 'lucide-react-native';
import { PressableScale } from '@/components/common/PressableScale';
import { useThemeColors } from '@/hooks/useThemeColors';
import { shadows } from '@/constants/theme';
import type { Station } from '@/utils/journey';

type Props = {
  station: Station;
  onPress: (station: Station) => void;
};

/**
 * Tek durak — 3 variant:
 *  • level: büyük taş anıt (76 px) + emoji + halo glow
 *  • badge: yaprak şekli + rozet emoji (60 px) + kilit varsa Lock ikonu
 *  • checkpoint: mini çiçek dairesi (40 px) + emoji
 *
 * isUnlocked → tam renk, isCurrent → nabız atan halo.
 */
function JourneyStationBase({ station, onPress }: Props) {
  const { colors, gradients } = useThemeColors();

  const breath = useSharedValue(1);
  useEffect(() => {
    if (!station.isCurrent) return;
    breath.value = withRepeat(
      withTiming(1.22, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [station.isCurrent, breath]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
    opacity: station.isCurrent ? 2 - breath.value : 0,
  }));

  const grad = gradients[station.gradKey];

  // Variant boyutları
  const size = station.kind === 'level' ? 76 : station.kind === 'badge' ? 60 : 40;
  const halo = size + 20;

  const dim = !station.isUnlocked && !station.isCurrent;

  return (
    <PressableScale onPress={() => onPress(station)} scaleTo={0.94}>
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: halo,
            height: halo,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Aktif nabız halo */}
          {station.isCurrent ? (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: halo,
                  height: halo,
                  borderRadius: halo / 2,
                  overflow: 'hidden',
                },
                breathStyle,
              ]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={grad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, opacity: 0.6 }}
              />
            </Animated.View>
          ) : null}

          {/* Statik dış halo — kazanılanlarda tam renk, kilitli soluk */}
          <View
            style={{
              position: 'absolute',
              width: size + 8,
              height: size + 8,
              borderRadius: (size + 8) / 2,
              overflow: 'hidden',
              opacity: dim ? 0.35 : 1,
            }}
          >
            <LinearGradient
              colors={dim ? [colors.borderSoft, colors.bgElevated] as const : grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, opacity: dim ? 1 : 0.45 }}
            />
          </View>

          {/* Merkez disk */}
          {station.kind === 'level' ? (
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: dim ? colors.bgElevated : colors.bgBase,
                borderWidth: 3,
                borderColor: dim ? colors.borderSoft : grad[1],
                alignItems: 'center',
                justifyContent: 'center',
                ...shadows.sm,
              }}
            >
              {/* İç altın ring — taş anıt çerçevesi */}
              {!dim ? (
                <View
                  style={{
                    position: 'absolute',
                    width: size - 12,
                    height: size - 12,
                    borderRadius: (size - 12) / 2,
                    borderWidth: 1.5,
                    borderColor: gradients.league[0],
                    opacity: 0.55,
                  }}
                  pointerEvents="none"
                />
              ) : null}
              <Text style={{ fontSize: 34, opacity: dim ? 0.45 : 1 }}>
                {station.emoji}
              </Text>
              {/* Sol-üst parıltı highlight (kazanılan duraklarda) */}
              {!dim ? (
                <View
                  style={{
                    position: 'absolute',
                    left: size * 0.18,
                    top: size * 0.18,
                    width: size * 0.18,
                    height: size * 0.1,
                    borderRadius: size * 0.1,
                    backgroundColor: colors.white,
                    opacity: 0.55,
                    transform: [{ rotate: '-30deg' }],
                  }}
                  pointerEvents="none"
                />
              ) : null}
            </View>
          ) : station.kind === 'badge' ? (
            // Yaprak şekli — kenarları yumuşak oval, hafif eğri
            <View
              style={{
                width: size,
                height: size,
                borderTopLeftRadius: size * 0.6,
                borderBottomRightRadius: size * 0.6,
                borderTopRightRadius: size * 0.25,
                borderBottomLeftRadius: size * 0.25,
                backgroundColor: dim ? colors.bgElevated : colors.bgBase,
                borderWidth: 2.5,
                borderColor: dim ? colors.borderSoft : grad[1],
                alignItems: 'center',
                justifyContent: 'center',
                ...shadows.sm,
              }}
            >
              <Text style={{ fontSize: 26, opacity: dim ? 0.4 : 1 }}>
                {station.emoji}
              </Text>
              {dim ? (
                <View
                  style={{
                    position: 'absolute',
                    right: -4,
                    bottom: -4,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: colors.bgBase,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: colors.borderSoft,
                  }}
                >
                  <Lock size={11} color={colors.textMuted} strokeWidth={2.6} />
                </View>
              ) : null}
            </View>
          ) : (
            // checkpoint — mini çiçek
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: dim ? colors.bgElevated : colors.bgBase,
                borderWidth: 2,
                borderColor: dim ? colors.borderSoft : grad[0],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 18, opacity: dim ? 0.4 : 1 }}>
                {station.emoji}
              </Text>
            </View>
          )}

          {/* Tamamlandı tiki — sağ üst (sadece level/badge için) */}
          {station.isUnlocked && !station.isCurrent && station.kind !== 'checkpoint' ? (
            <View
              style={{
                position: 'absolute',
                right: 2,
                top: 2,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: gradients.success[1],
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.bgBase,
              }}
            >
              <Text
                style={{
                  color: colors.white,
                  fontSize: 11,
                  fontWeight: '900',
                  lineHeight: 12,
                }}
              >
                ✓
              </Text>
            </View>
          ) : null}
        </View>

        {/* Etiket */}
        <Text
          numberOfLines={1}
          style={{
            marginTop: 4,
            fontSize: station.kind === 'level' ? 12 : 10,
            fontWeight: station.kind === 'level' ? '800' : '600',
            color: dim ? colors.textMuted : colors.textPrimary,
            maxWidth: halo + 40,
            textAlign: 'center',
          }}
        >
          {station.label}
        </Text>
      </View>
    </PressableScale>
  );
}

export const JourneyStation = memo(JourneyStationBase);

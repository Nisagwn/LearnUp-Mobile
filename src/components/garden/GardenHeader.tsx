import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CloudRain, Droplet, Pencil, Check } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  coins: number;
  waterCount: number;
  rainDay: number;
  editMode: boolean;
  onToggleEdit: () => void;
};

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function nextRainLabel(rainDayWeek: number): { label: string; today: boolean } {
  const today = new Date().getDay();
  const diff = (rainDayWeek - today + 7) % 7;
  if (diff === 0) return { label: 'BUGÜN', today: true };
  if (diff === 1) return { label: 'Yarın', today: false };
  return { label: DAY_NAMES[rainDayWeek], today: false };
}

/**
 * Bahçe üst bar — altın · su · yağmur (BUGÜN pulse) + Edit toggle chip.
 */
export function GardenHeader({ coins, waterCount, rainDay, editMode, onToggleEdit }: Props) {
  const { colors, gradients } = useThemeColors();
  const rain = nextRainLabel(rainDay);

  const rainPulse = useSharedValue(0.9);
  useEffect(() => {
    if (!rain.today) return;
    rainPulse.value = withRepeat(
      withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [rain.today, rainPulse]);
  const rainStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rain.today ? rainPulse.value : 1 }],
  }));

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4 }}>
      <LinearGradient
        colors={[gradients.mint[0], gradients.success[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 18, padding: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Altın */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.32)',
            }}
          >
            <Text style={{ fontSize: 14 }}>🪙</Text>
            <Text style={{ fontSize: 13, fontWeight: '900', color: colors.white }}>
              {coins.toLocaleString('tr-TR')}
            </Text>
          </View>
          {/* Su */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.32)',
            }}
          >
            <Droplet size={13} color={gradients.ocean[1]} />
            <Text style={{ fontSize: 13, fontWeight: '900', color: colors.white }}>
              {waterCount}
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          {/* Yağmur */}
          <Animated.View
            style={[
              {
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                backgroundColor: rain.today ? gradients.ocean[1] : 'rgba(0,0,0,0.22)',
              },
              rainStyle,
            ]}
          >
            <CloudRain size={13} color={colors.white} />
            <Text
              style={{
                fontSize: 11, fontWeight: '900', color: colors.white,
                letterSpacing: rain.today ? 0.6 : 0,
              }}
            >
              {rain.label}
            </Text>
          </Animated.View>

          {/* Edit Toggle */}
          <Pressable
            onPress={onToggleEdit}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
              backgroundColor: editMode ? gradients.brand[1] : 'rgba(255,255,255,0.32)',
            }}
          >
            {editMode ? (
              <>
                <Check size={13} color={colors.white} strokeWidth={2.6} />
                <Text style={{ fontSize: 11, fontWeight: '900', color: colors.white, letterSpacing: 0.4 }}>
                  BİTTİ
                </Text>
              </>
            ) : (
              <>
                <Pencil size={13} color={colors.white} strokeWidth={2.4} />
                <Text style={{ fontSize: 11, fontWeight: '900', color: colors.white }}>
                  DÜZENLE
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

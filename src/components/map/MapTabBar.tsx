import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Compass, TreePine } from 'lucide-react-native';

export type MapTab = 'road' | 'forest';

type Props = {
  active: MapTab;
  onChange: (tab: MapTab) => void;
};

const TABS: { id: MapTab; label: string }[] = [
  { id: 'road', label: 'Yol' },
  { id: 'forest', label: 'Orman' },
];

/**
 * Kompakt floating pill — ekranın tepesinde yüzer, layout alanı tüketmez.
 * Aktif sekme yarı şeffaf beyaz ile vurgulanır, indikatör spring ile kayar.
 * Cam efekti (rgba beyaz + ince border) — orman canvas'ı arkadan görünür.
 */
export function MapTabBar({ active, onChange }: Props) {
  const indicator = useSharedValue(active === 'road' ? 0 : 1);

  useEffect(() => {
    indicator.value = withSpring(active === 'road' ? 0 : 1, {
      damping: 16,
      stiffness: 220,
    });
  }, [active, indicator]);

  const pillStyle = useAnimatedStyle(() => ({
    left: `${indicator.value * 50}%`,
  }));

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(15,23,42,0.32)',
        borderRadius: 999,
        padding: 3,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.45)',
        position: 'relative',
        overflow: 'hidden',
        width: 148,
        alignSelf: 'center',
      }}
    >
      {/* Hareketli pill (yarı şeffaf beyaz) */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 3,
            bottom: 3,
            width: '50%',
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.92)',
          },
          pillStyle,
        ]}
        pointerEvents="none"
      />
      {TABS.map((t) => {
        const isActive = active === t.id;
        const Icon = t.id === 'road' ? Compass : TreePine;
        const fg = isActive ? '#0F172A' : '#FFFFFF';
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 5,
              gap: 4,
            }}
            hitSlop={6}
          >
            <Icon size={12} color={fg} strokeWidth={2.6} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '900',
                letterSpacing: 0.2,
                color: fg,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

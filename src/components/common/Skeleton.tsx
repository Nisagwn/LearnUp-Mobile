import { View, type DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createShimmerPlaceholder } from 'react-native-shimmer-placeholder';
import { useThemeColors } from '@/hooks/useThemeColors';

const ShimmerPlaceholder = createShimmerPlaceholder(LinearGradient);

function useShimmerColors(): [string, string, string] {
  const { isDark } = useThemeColors();
  return isDark
    ? ['#1E293B', '#334155', '#1E293B']
    : ['#E9EEF5', '#F4F7FB', '#E9EEF5'];
}

type LineProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
};

/** Tek satır shimmer placeholder. */
export function SkeletonLine({ width = '100%', height = 14, radius = 8, style }: LineProps) {
  const colors = useShimmerColors();
  return (
    <ShimmerPlaceholder
      shimmerColors={colors}
      width={undefined}
      height={height}
      style={[{ width, borderRadius: radius }, style]}
    />
  );
}

/** Kart iskeleti — başlık + birkaç satır. */
export function SkeletonCard({ lines = 3, height }: { lines?: number; height?: number }) {
  const { colors } = useThemeColors();
  return (
    <View
      style={{
        borderRadius: 18,
        backgroundColor: colors.bgSurface,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        padding: 16,
        height,
        gap: 10,
      }}
    >
      <SkeletonLine width="55%" height={16} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? '70%' : '100%'} height={12} />
      ))}
    </View>
  );
}

/** Stat kutusu iskeleti — StatTile boyutuyla uyumlu. */
export function SkeletonStat() {
  const { colors } = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
        backgroundColor: colors.bgSurface,
        borderWidth: 1,
        borderColor: colors.borderSoft,
        padding: 14,
        gap: 8,
      }}
    >
      <SkeletonLine width={22} height={22} radius={8} />
      <SkeletonLine width="60%" height={20} />
      <SkeletonLine width="80%" height={10} />
    </View>
  );
}

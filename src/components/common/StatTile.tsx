import { View, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AnimatedNumber } from './AnimatedNumber';
import { shadows } from '@/constants/theme';

type StatTileProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconColor?: string;
  className?: string;
  /** Sayısal değerler için count-up animasyonu. Varsayılan true. */
  animate?: boolean;
  prefix?: string;
  suffix?: string;
};

/**
 * İstatistik kutusu — renkli yumuşak ikon zemini, yumuşak gölge ve
 * sayısal değerler için count-up animasyonu.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  iconColor = '#6366F1',
  className = '',
  animate = true,
  prefix = '',
  suffix = '',
}: StatTileProps) {
  const numeric = typeof value === 'number';

  return (
    <View
      style={shadows.sm}
      className={`flex-1 rounded-2xl border border-border-soft bg-bg-surface p-4 ${className}`}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${iconColor}1F` }}
      >
        <Icon color={iconColor} size={18} />
      </View>
      {numeric && animate ? (
        <AnimatedNumber
          value={value as number}
          prefix={prefix}
          suffix={suffix}
          className="mt-2 text-2xl font-bold text-text-primary"
        />
      ) : (
        <Text className="mt-2 text-2xl font-bold text-text-primary">
          {prefix}
          {value}
          {suffix}
        </Text>
      )}
      <Text className="text-xs text-text-muted">{label}</Text>
    </View>
  );
}

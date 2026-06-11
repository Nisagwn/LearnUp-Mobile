import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';

type Props = {
  icon?: LucideIcon;
  iconColor?: string;
  label: string;
  sublabel?: string;
  rightText?: string;
  right?: ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  first?: boolean;
  onPress?: () => void;
};

export function SettingsRow({
  icon: Icon,
  iconColor = '#16A34A',
  label,
  sublabel,
  rightText,
  right,
  showChevron,
  destructive,
  disabled,
  first,
  onPress,
}: Props) {
  const labelColor = destructive ? 'text-danger' : 'text-text-primary';
  const resolvedIconColor = destructive ? '#DC2626' : iconColor;
  const iconBg = destructive ? 'bg-danger-soft' : 'bg-accent-soft';

  const content = (
    <View
      className={`flex-row items-center px-4 py-3.5 ${first ? '' : 'border-t border-border-soft'} ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {Icon ? (
        <View className={`h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon color={resolvedIconColor} size={18} />
        </View>
      ) : null}
      <View className={`flex-1 ${Icon ? 'ml-3' : ''}`}>
        <Text className={`text-sm font-medium ${labelColor}`} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text className="mt-0.5 text-xs text-text-muted" numberOfLines={2}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {rightText ? <Text className="ml-2 text-sm text-text-muted">{rightText}</Text> : null}
      {right}
      {showChevron ? <ChevronRight color="#94A3B8" size={18} /> : null}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable onPress={onPress} className="active:bg-bg-elevated">
        {content}
      </Pressable>
    );
  }
  return content;
}

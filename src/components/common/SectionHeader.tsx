import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  className?: string;
};

export function SectionHeader({
  title,
  actionLabel,
  onActionPress,
  className = '',
}: SectionHeaderProps) {
  return (
    <View className={`flex-row items-center justify-between ${className}`}>
      <Text className="text-base font-semibold text-text-primary">{title}</Text>
      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          className="flex-row items-center active:opacity-60"
          hitSlop={8}
        >
          <Text className="text-xs font-medium text-accent-fg">{actionLabel}</Text>
          <ChevronRight color="#4F46E5" size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}

import { Pressable, View, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';
import { X } from 'lucide-react-native';

export type BulkAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  color?: string;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  selectedCount: number;
  actions: BulkAction[];
  onActionPress: (id: string) => void;
  onCancel: () => void;
};

export function BulkActionToolbar({
  visible,
  selectedCount,
  actions,
  onActionPress,
  onCancel,
}: Props) {
  if (!visible) return null;
  return (
    // NOT: Animated.View'a className verilmesi NativeWind cssInterop + Reanimated v4
    // layout-animation kombosunda render döngüsü tetikliyor. className iç View'a alındı.
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        elevation: 8,
      }}
    >
      <View className="border-t border-border-soft bg-bg-base px-4 pb-6 pt-3">
        <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable
            onPress={onCancel}
            hitSlop={10}
            accessibilityLabel="Seçimi iptal et"
            className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
          >
            <X color="#475569" size={16} />
          </Pressable>
          <Text className="text-sm font-semibold text-text-primary">
            {selectedCount} seçili
          </Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          {actions.map((a) => {
            const Icon = a.icon;
            const color = a.destructive ? '#DC2626' : a.color ?? '#4F46E5';
            return (
              <Pressable
                key={a.id}
                onPress={() => onActionPress(a.id)}
                className={`flex-row items-center rounded-xl border px-3 py-2 active:opacity-70 ${
                  a.destructive
                    ? 'border-danger-soft bg-danger-soft'
                    : 'border-accent/30 bg-accent-soft'
                }`}
              >
                <Icon color={color} size={14} />
                <Text
                  className={`ml-1.5 text-xs font-semibold ${
                    a.destructive ? 'text-danger' : 'text-accent-fg'
                  }`}
                >
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      </View>
    </Animated.View>
  );
}

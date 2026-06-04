import { Modal, Pressable, View, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

export type OverflowMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  iconColor?: string;
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  items: OverflowMenuItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function OverflowMenu({ visible, title, subtitle, items, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/50">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mt-auto rounded-t-3xl bg-bg-base px-5 pb-8 pt-3"
        >
          <View className="mx-auto h-1.5 w-12 rounded-full bg-border-soft" />
          {title ? (
            <View className="mt-3">
              <Text className="text-base font-semibold text-text-primary">{title}</Text>
              {subtitle ? (
                <Text className="mt-0.5 text-xs text-text-muted">{subtitle}</Text>
              ) : null}
            </View>
          ) : null}
          <View className="mt-3 gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const color = item.destructive
                ? '#DC2626'
                : item.iconColor ?? '#475569';
              return (
                <Pressable
                  key={item.id}
                  disabled={item.disabled}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  className={`flex-row items-center rounded-2xl px-3 py-3 active:bg-bg-elevated ${
                    item.disabled ? 'opacity-40' : ''
                  }`}
                >
                  <View
                    className="h-9 w-9 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${color}1A` }}
                  >
                    <Icon color={color} size={18} />
                  </View>
                  <Text
                    className={`ml-3 flex-1 text-sm font-medium ${
                      item.destructive ? 'text-danger' : 'text-text-primary'
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

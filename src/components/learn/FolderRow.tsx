import { Pressable, View, Text } from 'react-native';
import { ChevronDown, ChevronRight, Folder, FolderPlus } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

type Props = {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trailingAction?: { label: string; onPress: () => void };
};

export function FolderRow({
  label,
  count,
  expanded,
  onToggle,
  icon: Icon,
  iconColor = '#4F46E5',
  iconBg = '#EEF2FF',
  trailingAction,
}: Props) {
  const DisplayIcon = Icon ?? Folder;
  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center rounded-2xl border border-border-soft bg-bg-surface p-3 active:bg-bg-elevated"
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconBg }}
      >
        <DisplayIcon color={iconColor} size={18} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
          {label}
        </Text>
        <Text className="text-[11px] text-text-muted">{count} kayıt</Text>
      </View>
      {trailingAction ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            trailingAction.onPress();
          }}
          hitSlop={6}
          className="mr-2 flex-row items-center rounded-full bg-accent-soft px-2.5 py-1 active:opacity-70"
        >
          <Text className="text-[11px] font-semibold text-accent-fg">{trailingAction.label}</Text>
        </Pressable>
      ) : null}
      {expanded ? (
        <ChevronDown color="#94A3B8" size={18} />
      ) : (
        <ChevronRight color="#94A3B8" size={18} />
      )}
    </Pressable>
  );
}

/** "+ Yeni klasör" çağrısı için tek satırlık aksiyon satırı. */
export function AddFolderRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-2xl border border-dashed border-border-soft bg-bg-base p-3 active:bg-bg-elevated"
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent-soft">
        <FolderPlus color="#4F46E5" size={18} />
      </View>
      <Text className="ml-3 text-sm font-semibold text-accent-fg">Yeni klasör oluştur</Text>
    </Pressable>
  );
}

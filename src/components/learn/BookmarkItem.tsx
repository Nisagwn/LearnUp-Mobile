import { Pressable, View, Text } from 'react-native';
import {
  MoreHorizontal,
  StickyNote,
  Check,
} from 'lucide-react-native';
import type { BookmarkDoc } from '@/services/bookmarksApi';

type Props = {
  bookmark: BookmarkDoc;
  subjectLabel: string;
  selectionMode: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMenuPress: () => void;
};

export function BookmarkItem({
  bookmark,
  subjectLabel,
  selectionMode,
  selected,
  onPress,
  onLongPress,
  onMenuPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      className={`rounded-2xl border p-3 active:opacity-90 ${
        selected ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
      }`}
    >
      <View className="flex-row items-start">
        {selectionMode ? (
          <View
            className={`mr-2 mt-0.5 h-4 w-4 items-center justify-center rounded-full border ${
              selected
                ? 'border-accent bg-accent'
                : 'border-border-soft bg-bg-base'
            }`}
          >
            {selected ? <Check color="white" size={10} /> : null}
          </View>
        ) : null}
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-accent-fg">
              {subjectLabel}
            </Text>
            {bookmark.note ? (
              <View className="ml-2 flex-row items-center">
                <StickyNote color="#D97706" size={11} />
                <Text className="ml-0.5 text-[10px] font-medium text-warning">not</Text>
              </View>
            ) : null}
          </View>
          <Text className="mt-1 text-sm leading-5 text-text-primary" numberOfLines={3}>
            {bookmark.questionText || 'Soru metni yok'}
          </Text>
          {bookmark.tags.length > 0 ? (
            <View className="mt-2 flex-row flex-wrap" style={{ gap: 4 }}>
              {bookmark.tags.slice(0, 4).map((tag) => (
                <View
                  key={tag}
                  className="rounded-full bg-bg-elevated px-2 py-0.5"
                >
                  <Text className="text-[10px] font-medium text-text-secondary">#{tag}</Text>
                </View>
              ))}
              {bookmark.tags.length > 4 ? (
                <Text className="text-[10px] text-text-muted">+{bookmark.tags.length - 4}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
        {!selectionMode ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onMenuPress();
            }}
            hitSlop={8}
            accessibilityLabel="Daha fazla eylem"
            className="ml-1 h-8 w-8 items-center justify-center rounded-full active:bg-bg-elevated"
          >
            <MoreHorizontal color="#475569" size={16} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

import { ScrollView, Pressable, View, Text } from 'react-native';

export type FilterChip<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

type FilterChipsProps<T extends string> = {
  chips: ReadonlyArray<FilterChip<T>>;
  active: T;
  onChange: (id: T) => void;
  className?: string;
};

export function FilterChips<T extends string>({
  chips,
  active,
  onChange,
  className = '',
}: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
      className={className}
    >
      {chips.map((chip) => {
        const isActive = chip.id === active;
        const showBadge = typeof chip.count === 'number' && chip.count > 0;
        return (
          <Pressable
            key={chip.id}
            onPress={() => onChange(chip.id)}
            className={`flex-row items-center rounded-full px-4 py-2 active:opacity-70 ${
              isActive
                ? 'bg-accent'
                : 'border border-border-soft bg-bg-surface'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                isActive ? 'text-white' : 'text-text-secondary'
              }`}
            >
              {chip.label}
            </Text>
            {showBadge ? (
              <View
                className={`ml-1.5 min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 ${
                  isActive ? 'bg-white/25' : 'bg-accent-soft'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    isActive ? 'text-white' : 'text-accent-fg'
                  }`}
                >
                  {chip.count! > 99 ? '99+' : chip.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

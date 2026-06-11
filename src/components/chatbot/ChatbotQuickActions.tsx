import { Pressable, View, Text } from 'react-native';
import { Swords, FileText, Target } from 'lucide-react-native';

export type QuickAction = 'duel' | 'summary' | 'weak';

type Props = {
  onAction: (action: QuickAction) => void;
};

const CHIPS: { id: QuickAction; label: string; icon: typeof Swords; color: string }[] = [
  { id: 'duel', label: 'Düello', icon: Swords, color: '#DC2626' },
  { id: 'summary', label: 'Özet', icon: FileText, color: '#16A34A' },
  { id: 'weak', label: 'Zayıf Konum', icon: Target, color: '#D97706' },
];

export function ChatbotQuickActions({ onAction }: Props) {
  return (
    <View className="flex-row items-center gap-2 border-b border-border-soft px-4 py-2.5">
      {CHIPS.map((c) => {
        const Icon = c.icon;
        return (
          <Pressable
            key={c.id}
            onPress={() => onAction(c.id)}
            className="flex-row items-center rounded-full border border-border-soft bg-bg-surface px-3 py-1.5 active:bg-bg-elevated"
            hitSlop={6}
          >
            <Icon color={c.color} size={13} />
            <Text className="ml-1.5 text-[11px] font-semibold text-text-primary">{c.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

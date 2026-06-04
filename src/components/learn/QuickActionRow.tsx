import { ScrollView, Pressable, View, Text } from 'react-native';
import { Zap, Layers, Target, GraduationCap } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

type Action = {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  onPress: () => void;
};

type Props = {
  onQuickQuiz: () => void;
  onFlashcard: () => void;
  onFocusQuiz: () => void;
  onMockExam: () => void;
};

export function QuickActionRow({
  onQuickQuiz,
  onFlashcard,
  onFocusQuiz,
  onMockExam,
}: Props) {
  const actions: Action[] = [
    { id: 'quick', label: 'Hızlı Quiz', icon: Zap, color: '#6366F1', bg: '#EEF2FF', onPress: onQuickQuiz },
    { id: 'flashcard', label: 'Flashcard', icon: Layers, color: '#0891B2', bg: '#CFFAFE', onPress: onFlashcard },
    { id: 'focus', label: 'Odak Quiz', icon: Target, color: '#DC2626', bg: '#FEE2E2', onPress: onFocusQuiz },
    { id: 'mock', label: 'Mock Sınav', icon: GraduationCap, color: '#D97706', bg: '#FEF3C7', onPress: onMockExam },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
    >
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Pressable
            key={a.id}
            onPress={a.onPress}
            className="flex-row items-center rounded-2xl border border-border-soft bg-bg-surface px-3 py-2.5 active:opacity-80"
          >
            <View
              className="h-8 w-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: a.bg }}
            >
              <Icon color={a.color} size={16} />
            </View>
            <Text className="ml-2 text-xs font-semibold text-text-primary">{a.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

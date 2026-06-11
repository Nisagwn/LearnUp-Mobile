import { View, Text, Pressable } from 'react-native';
import { Sparkles, ClipboardList, Megaphone, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

type Props = {
  onGenerateQuestion: () => void;
  onCreateAssignment: () => void;
  onCreateAnnouncement: () => void;
  onOpenStudents: () => void;
};

function ActionCard({
  icon: Icon,
  label,
  color,
  bg,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center rounded-2xl border border-border-soft bg-bg-surface p-4 active:bg-bg-elevated"
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: bg }}
      >
        <Icon color={color} size={22} />
      </View>
      <Text className="mt-2 text-center text-xs font-semibold text-text-primary">{label}</Text>
    </Pressable>
  );
}

export function QuickActionGrid({
  onGenerateQuestion,
  onCreateAssignment,
  onCreateAnnouncement,
  onOpenStudents,
}: Props) {
  return (
    <View style={{ gap: 12 }}>
      <View className="flex-row" style={{ gap: 12 }}>
        <ActionCard
          icon={Sparkles}
          label="Soru Üret"
          color="#16A34A"
          bg="#DCFCE7"
          onPress={onGenerateQuestion}
        />
        <ActionCard
          icon={ClipboardList}
          label="Ödev Oluştur"
          color="#D97706"
          bg="#FEF3C7"
          onPress={onCreateAssignment}
        />
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <ActionCard
          icon={Megaphone}
          label="Duyuru Yap"
          color="#0891B2"
          bg="#CFFAFE"
          onPress={onCreateAnnouncement}
        />
        <ActionCard
          icon={Users}
          label="Öğrencilerim"
          color="#16A34A"
          bg="#DCFCE7"
          onPress={onOpenStudents}
        />
      </View>
    </View>
  );
}

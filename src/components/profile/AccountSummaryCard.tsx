import { View, Text } from 'react-native';
import { Calendar, ListChecks, Target, Sigma } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

type Props = {
  memberSince: string;
  totalSolved: number;
  successRate: number;
  net: number;
};

function Cell({
  icon: Icon,
  iconColor,
  value,
  label,
}: {
  icon: LucideIcon;
  iconColor: string;
  value: string | number;
  label: string;
}) {
  return (
    <View className="flex-1 flex-row items-center">
      <View
        className="h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${iconColor}1A` }}
      >
        <Icon color={iconColor} size={16} />
      </View>
      <View className="ml-2.5 flex-1">
        <Text className="text-sm font-bold text-text-primary" numberOfLines={1}>
          {value}
        </Text>
        <Text className="text-[10px] text-text-muted" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export function AccountSummaryCard({ memberSince, totalSolved, successRate, net }: Props) {
  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
      <View className="flex-row" style={{ gap: 10 }}>
        <Cell icon={Calendar} iconColor="#6366F1" value={memberSince} label="Üyelik" />
        <Cell icon={ListChecks} iconColor="#16A34A" value={totalSolved} label="Çözülen soru" />
      </View>
      <View className="my-3 h-px bg-border-soft" />
      <View className="flex-row" style={{ gap: 10 }}>
        <Cell icon={Target} iconColor="#D97706" value={`%${successRate}`} label="Başarı oranı" />
        <Cell icon={Sigma} iconColor="#0891B2" value={net} label="Net skor" />
      </View>
    </View>
  );
}

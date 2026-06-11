import { View, Text } from 'react-native';
import { Sparkles, ClipboardList, Megaphone } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';

type Props = {
  questionsCreated: number;
  assignmentsCreated: number;
  announcementsCreated: number;
  loading?: boolean;
};

function Row({
  icon: Icon,
  iconColor,
  bgColor,
  label,
  value,
  loading,
}: {
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  label: string;
  value: number;
  loading?: boolean;
}) {
  return (
    <View className="flex-row items-center">
      <View
        className="h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: bgColor }}
      >
        <Icon color={iconColor} size={18} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-xs text-text-muted">{label}</Text>
        {loading ? (
          <Text className="mt-0.5 text-lg font-bold text-text-muted">—</Text>
        ) : (
          <AnimatedNumber
            value={value}
            duration={600}
            className="mt-0.5 text-lg font-bold text-text-primary"
          />
        )}
      </View>
    </View>
  );
}

/** Öğretmenin lifetime üretim toplamlarını gösteren kart (3 satır). */
export function TeacherImpactCard({
  questionsCreated,
  assignmentsCreated,
  announcementsCreated,
  loading,
}: Props) {
  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4" style={{ gap: 14 }}>
      <Row
        icon={Sparkles}
        iconColor="#16A34A"
        bgColor="#DCFCE7"
        label="Üretilen Soru"
        value={questionsCreated}
        loading={loading}
      />
      <Row
        icon={ClipboardList}
        iconColor="#16A34A"
        bgColor="#DCFCE7"
        label="Atanan Ödev"
        value={assignmentsCreated}
        loading={loading}
      />
      <Row
        icon={Megaphone}
        iconColor="#D97706"
        bgColor="#FEF3C7"
        label="Yayınlanan Duyuru"
        value={announcementsCreated}
        loading={loading}
      />
    </View>
  );
}

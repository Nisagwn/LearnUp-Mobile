import { View } from 'react-native';
import { Users, UserCheck, Target, ListChecks, CheckCircle2 } from 'lucide-react-native';
import { StatTile } from '@/components/common/StatTile';

type Props = {
  studentCount: number;
  activeStudents: number;
  classAverage: number;
  totalSolved: number;
  /** Son 30 gün ödevlerin teslim oranı (%) — opsiyonel (yoksa stat gösterilmez). */
  submissionRate?: number | null;
};

export function ClassAnalyticsCard({
  studentCount,
  activeStudents,
  classAverage,
  totalSolved,
  submissionRate,
}: Props) {
  return (
    <View style={{ gap: 12 }}>
      <View className="flex-row" style={{ gap: 12 }}>
        <StatTile icon={Users} label="Öğrenci" value={studentCount} iconColor="#16A34A" />
        <StatTile icon={UserCheck} label="Aktif (7g)" value={activeStudents} iconColor="#16A34A" />
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <StatTile icon={Target} label="Sınıf ort." value={`%${classAverage}`} iconColor="#D97706" />
        <StatTile icon={ListChecks} label="Çözülen (30g)" value={totalSolved} iconColor="#0891B2" />
      </View>
      {typeof submissionRate === 'number' ? (
        <View className="flex-row" style={{ gap: 12 }}>
          <StatTile
            icon={CheckCircle2}
            label="Teslim oranı (30g)"
            value={`%${submissionRate}`}
            iconColor="#16A34A"
          />
          <View style={{ flex: 1 }} />
        </View>
      ) : null}
    </View>
  );
}

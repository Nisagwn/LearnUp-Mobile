import { View, Text, Pressable } from 'react-native';
import { ChevronRight, Users } from 'lucide-react-native';
import type { StudentRisk } from '@/services/studentAnalyticsApi';

type Props = {
  items: StudentRisk[] | null;
  loading?: boolean;
  onOpenStudent: (studentId: string) => void;
};

function initial(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

function rateColor(rate: number): string {
  if (rate >= 70) return 'text-success';
  if (rate >= 50) return 'text-warning';
  return 'text-danger';
}

function rateBg(rate: number): string {
  if (rate >= 70) return 'bg-success-soft';
  if (rate >= 50) return 'bg-warning-soft';
  return 'bg-danger-soft';
}

export function StudentsAtRiskCard({ items, loading, onOpenStudent }: Props) {
  if (loading && !items) {
    return (
      <View className="rounded-2xl border border-border-soft bg-bg-surface p-4" style={{ gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} className="h-12 rounded-xl bg-bg-elevated" />
        ))}
      </View>
    );
  }

  if (!items || items.length === 0) {
    return (
      <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-bg-elevated">
            <Users color="#94A3B8" size={18} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-sm font-semibold text-text-primary">Risk verisi yok</Text>
            <Text className="text-[11px] text-text-muted">
              Öğrenciler yeterli soru çözünce burada görünecek (≥10 cevap).
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-3" style={{ gap: 6 }}>
      {items.map((s) => (
        <Pressable
          key={s.studentId}
          onPress={() => onOpenStudent(s.studentId)}
          className="flex-row items-center rounded-xl p-2 active:bg-bg-elevated"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
            <Text className="text-base font-bold text-accent-fg">{initial(s.name)}</Text>
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
              {s.name}
            </Text>
            <Text className="text-[11px] text-text-muted">
              {s.wrongCount} yanlış · {s.totalAnswered} cevap
            </Text>
          </View>
          <View className={`mr-1 rounded-full px-2 py-1 ${rateBg(s.successRate)}`}>
            <Text className={`text-xs font-bold ${rateColor(s.successRate)}`}>
              %{s.successRate}
            </Text>
          </View>
          <ChevronRight color="#94A3B8" size={16} />
        </Pressable>
      ))}
    </View>
  );
}

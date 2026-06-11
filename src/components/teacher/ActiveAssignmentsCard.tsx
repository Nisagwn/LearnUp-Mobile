import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import {
  ClipboardList,
  Plus,
  ChevronRight,
  Users,
  CalendarClock,
  AlertCircle,
  Trash2,
} from 'lucide-react-native';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';
import { formatTimeUntil } from '@/utils/relativeTime';
import type { TeacherAssignment } from '@/services/assignmentsApi';

export interface ActiveAssignmentSummary extends TeacherAssignment {
  /** assignment_submissions count (status≥submitted). */
  submittedCount: number;
  /** Bu öğretmenin toplam öğrenci sayısı (oran payda). */
  studentCount: number;
  /** Bekleyen inceleme (status=submitted, henüz reviewed değil). */
  pendingReview: number;
}

type Props = {
  items: ActiveAssignmentSummary[];
  loading?: boolean;
  onCreate: () => void;
  onOpenAll: () => void;
  onOpenAssignment: (id: string) => void;
  onDeleteAssignment?: (id: string) => Promise<void> | void;
};

export function ActiveAssignmentsCard({
  items,
  loading,
  onCreate,
  onOpenAll,
  onOpenAssignment,
  onDeleteAssignment,
}: Props) {
  const askDelete = (id: string, title: string) => {
    if (!onDeleteAssignment) return;
    Alert.alert('Ödevi sil', `"${title || 'Bu ödev'}" silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await onDeleteAssignment(id);
          } catch (err) {
            Alert.alert('Hata', (err as Error).message);
          }
        },
      },
    ]);
  };
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <SectionHeader title="Aktif Ödevler" />
        <Pressable
          onPress={onCreate}
          className="flex-row items-center rounded-full bg-accent px-3 py-1.5 active:opacity-80"
        >
          <Plus color="white" size={13} />
          <Text className="ml-1 text-[11px] font-bold text-white">Yeni Ödev</Text>
        </Pressable>
      </View>

      {loading && items.length === 0 ? (
        <View className="mt-3 items-center rounded-2xl border border-border-soft bg-bg-surface p-6">
          <ActivityIndicator color="#16A34A" />
        </View>
      ) : items.length === 0 ? (
        <Card>
          <View className="items-center py-4">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
              <ClipboardList color="#16A34A" size={22} />
            </View>
            <Text className="mt-3 text-sm font-semibold text-text-primary">
              Henüz aktif ödev yok
            </Text>
            <Text className="mt-1 text-center text-xs text-text-muted">
              İlk ödevini oluştur, öğrencilerine anında ulaşsın.
            </Text>
            <Pressable
              onPress={onCreate}
              className="mt-4 flex-row items-center rounded-xl bg-accent px-4 py-2.5 active:opacity-80"
            >
              <Plus color="white" size={14} />
              <Text className="ml-1.5 text-sm font-bold text-white">Yeni Ödev Oluştur</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <View className="mt-3" style={{ gap: 8 }}>
          {items.map((a) => {
            const denom = Math.max(1, a.studentCount);
            const ratio = Math.min(1, a.submittedCount / denom);
            const dueLabel = a.dueDateMs ? formatTimeUntil(a.dueDateMs) : 'Tarihsiz';
            const isOverdue = dueLabel === 'Süresi geçti';
            return (
              <Card key={a.id} onPress={() => onOpenAssignment(a.id)}>
                <View className="flex-row items-center">
                  <Text className="flex-1 text-sm font-semibold text-text-primary" numberOfLines={1}>
                    {a.title || '(Başlıksız ödev)'}
                  </Text>
                  {onDeleteAssignment ? (
                    <Pressable
                      onPress={() => askDelete(a.id, a.title)}
                      hitSlop={8}
                      className="p-1 active:opacity-60"
                    >
                      <Trash2 color="#DC2626" size={14} />
                    </Pressable>
                  ) : null}
                  <ChevronRight color="#94A3B8" size={16} />
                </View>
                <View className="mt-1 flex-row items-center" style={{ gap: 10 }}>
                  {a.subject ? (
                    <Text className="text-[11px] font-semibold text-accent-fg">{a.subject}</Text>
                  ) : null}
                  <Text className="text-[11px] text-text-muted">{a.questionIds.length} soru</Text>
                  <View className="flex-row items-center">
                    <CalendarClock
                      color={isOverdue ? '#DC2626' : '#94A3B8'}
                      size={11}
                    />
                    <Text
                      className={`ml-1 text-[11px] font-semibold ${
                        isOverdue ? 'text-danger' : 'text-text-muted'
                      }`}
                    >
                      {dueLabel}
                    </Text>
                  </View>
                </View>

                <View className="mt-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Users color="#475569" size={11} />
                      <Text className="ml-1 text-[11px] font-semibold text-text-secondary">
                        {a.submittedCount}/{a.studentCount} teslim
                      </Text>
                    </View>
                    {a.pendingReview > 0 ? (
                      <View className="flex-row items-center rounded-full bg-warning-soft px-2 py-0.5">
                        <AlertCircle color="#D97706" size={10} />
                        <Text className="ml-1 text-[10px] font-bold text-warning">
                          {a.pendingReview} inceleme
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View className="mt-1.5">
                    <AnimatedProgressBar value={ratio} height={5} fillColor="#16A34A" />
                  </View>
                </View>
              </Card>
            );
          })}

          <Pressable
            onPress={onOpenAll}
            className="mt-1 flex-row items-center justify-center rounded-xl border border-border-soft bg-bg-surface py-2.5 active:bg-bg-elevated"
          >
            <Text className="text-xs font-semibold text-text-secondary">Tüm ödevleri gör</Text>
            <ChevronRight color="#475569" size={14} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

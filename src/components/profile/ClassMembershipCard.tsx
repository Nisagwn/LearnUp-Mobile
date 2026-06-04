import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { School, UserCheck, LogOut, ChevronRight } from 'lucide-react-native';
import { getTeacherName } from '@/services/classApi';

type Props = {
  teacherId?: string | null;
  teacherName?: string | null;
  classRank?: number | null;
  classTotal?: number | null;
  onJoinPress: () => void;
  onLeave: () => void;
};

export function ClassMembershipCard({
  teacherId,
  teacherName,
  classRank,
  classTotal,
  onJoinPress,
  onLeave,
}: Props) {
  const [resolvedName, setResolvedName] = useState<string | null>(teacherName ?? null);

  useEffect(() => {
    let alive = true;
    if (teacherId && !teacherName) {
      getTeacherName(teacherId).then((n) => {
        if (alive) setResolvedName(n);
      });
    } else {
      setResolvedName(teacherName ?? null);
    }
    return () => {
      alive = false;
    };
  }, [teacherId, teacherName]);

  // Sınıfa katılmamış durum
  if (!teacherId) {
    return (
      <Pressable
        onPress={onJoinPress}
        className="flex-row items-center rounded-2xl border border-accent/30 bg-accent-soft p-4 active:opacity-90"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent">
          <School color="white" size={18} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-sm font-semibold text-text-primary">Sınıfa katıl</Text>
          <Text className="mt-0.5 text-xs text-text-muted">
            Öğretmeninin kodunu gir, sıralamaya dahil ol
          </Text>
        </View>
        <ChevronRight color="#4F46E5" size={18} />
      </Pressable>
    );
  }

  // Katılmış durum
  const hasRank = typeof classRank === 'number' && typeof classTotal === 'number' && classTotal > 0;
  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-success-soft">
          <UserCheck color="#16A34A" size={18} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-xs text-text-muted">Öğretmenin</Text>
          {resolvedName === null ? (
            <ActivityIndicator color="#94A3B8" size="small" style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
              {resolvedName}
            </Text>
          )}
        </View>
        <Pressable
          onPress={onLeave}
          hitSlop={8}
          accessibilityLabel="Sınıftan ayrıl"
          className="flex-row items-center rounded-full bg-bg-elevated px-3 py-1.5 active:opacity-70"
        >
          <LogOut color="#DC2626" size={13} />
          <Text className="ml-1 text-[11px] font-semibold text-danger">Ayrıl</Text>
        </Pressable>
      </View>

      {hasRank ? (
        <View className="mt-3 flex-row items-center rounded-xl bg-accent-soft px-3 py-2">
          <Text className="text-xs text-accent-fg">
            Sınıfında <Text className="font-bold">{classRank}.</Text> sıradasın
            <Text className="text-text-muted"> / {classTotal} öğrenci</Text>
          </Text>
        </View>
      ) : (
        <Text className="mt-2 text-[11px] text-text-muted">
          Bu sınıfın sıralamasına dahilsin — soru çözdükçe yüksel.
        </Text>
      )}
    </View>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  School,
  UserCheck,
  LogOut,
  Plus,
  Trophy,
  GraduationCap,
} from 'lucide-react-native';
import { getTeacherInfo, type TeacherInfo } from '@/services/classApi';

export type JoinedClassRow = {
  teacherId: string;
  teacherName: string;
};

type Props = {
  classes: JoinedClassRow[];
  /** Sıralama bilgisi sadece "primary" (ilk) sınıf için gösterilir. */
  classRank?: number | null;
  classTotal?: number | null;
  onJoinPress: () => void;
  onLeave: (teacherId: string) => void;
};

function isUsableName(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  return t.length > 0 && t.toLowerCase() !== 'öğretmen';
}

export function ClassMembershipCard({
  classes,
  classRank,
  classTotal,
  onJoinPress,
  onLeave,
}: Props) {
  const [resolved, setResolved] = useState<Record<string, TeacherInfo>>({});

  // Eksik/jenerik adı olan veya branşı bilinmeyen öğretmenleri Firestore'dan çek.
  const missingIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of classes) {
      const cached = resolved[c.teacherId];
      const haveName = isUsableName(c.teacherName) || isUsableName(cached?.name);
      const haveBranch = !!cached?.branch;
      if (!haveName || !haveBranch) set.add(c.teacherId);
    }
    return Array.from(set);
  }, [classes, resolved]);

  useEffect(() => {
    if (missingIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missingIds.map(async (id) => {
          const info = await getTeacherInfo(id);
          return [id, info] as const;
        }),
      );
      if (cancelled) return;
      setResolved((prev) => {
        const next = { ...prev };
        for (const [id, info] of entries) if (info) next[id] = info;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [missingIds]);

  const displayName = (c: JoinedClassRow): string => {
    if (isUsableName(c.teacherName)) return c.teacherName.trim();
    const cached = resolved[c.teacherId]?.name;
    if (isUsableName(cached)) return cached!.trim();
    return 'Öğretmen';
  };

  const displayBranch = (c: JoinedClassRow): string | null => {
    return resolved[c.teacherId]?.branch ?? null;
  };

  // Sınıfa katılmamış durum
  if (classes.length === 0) {
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
        <Plus color="#15803D" size={18} />
      </Pressable>
    );
  }

  const hasRank =
    typeof classRank === 'number' && typeof classTotal === 'number' && classTotal > 0;
  const primary = classes[0]!;
  const primaryBranch = displayBranch(primary);
  const primaryName = displayName(primary);
  // Branş varsa "Matematik sınıfı" daha doğal; yoksa öğretmen adına düş.
  const rankLabel = primaryBranch ? `${primaryBranch} sınıfı` : `${primaryName} sınıfı`;

  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
      <View style={{ gap: 10 }}>
        {classes.map((c, idx) => {
          const isPrimary = idx === 0;
          const name = displayName(c);
          const branch = displayBranch(c);
          return (
            <View
              key={c.teacherId}
              className={`flex-row items-center rounded-xl border p-2.5 ${
                isPrimary ? 'border-success/30 bg-success-soft' : 'border-border-soft bg-bg-base'
              }`}
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-lg ${
                  isPrimary ? 'bg-success' : 'bg-accent-soft'
                }`}
              >
                <UserCheck color={isPrimary ? 'white' : '#15803D'} size={16} />
              </View>
              <View className="ml-2.5 flex-1">
                <Text className="text-[10px] uppercase tracking-wide text-text-muted">
                  {isPrimary ? 'Birincil sınıf' : 'Diğer sınıf'}
                </Text>
                <Text
                  className="text-sm font-semibold text-text-primary"
                  numberOfLines={1}
                >
                  {name}
                </Text>
                {branch ? (
                  <View className="mt-0.5 flex-row items-center">
                    <GraduationCap color="#16A34A" size={10} />
                    <Text
                      className="ml-1 text-[10px] font-medium text-accent-fg"
                      numberOfLines={1}
                    >
                      {branch} Öğretmeni
                    </Text>
                  </View>
                ) : null}
              </View>
              <Pressable
                onPress={() => onLeave(c.teacherId)}
                hitSlop={8}
                accessibilityLabel={`${name} sınıfından ayrıl`}
                className="ml-2 flex-row items-center rounded-full bg-bg-elevated px-2.5 py-1.5 active:opacity-70"
              >
                <LogOut color="#DC2626" size={11} />
                <Text className="ml-1 text-[10px] font-semibold text-danger">Ayrıl</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {hasRank ? (
        <View className="mt-3 flex-row items-center rounded-xl bg-accent-soft px-3 py-2">
          <Trophy color="#D97706" size={12} />
          <Text className="ml-1.5 flex-1 text-xs text-accent-fg" numberOfLines={2}>
            <Text className="font-semibold">{rankLabel}nda</Text>{' '}
            <Text className="font-bold">{classRank}.</Text> sıradasın
            <Text className="text-text-muted"> · {classTotal} öğrenci</Text>
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={onJoinPress}
        className="mt-3 flex-row items-center justify-center rounded-xl border border-dashed border-accent/40 bg-bg-base py-2.5 active:opacity-70"
      >
        <Plus color="#16A34A" size={14} />
        <Text className="ml-1 text-xs font-semibold text-accent-fg">Başka sınıfa katıl</Text>
      </Pressable>
    </View>
  );
}

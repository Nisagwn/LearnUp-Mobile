import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Megaphone, Clock, User } from 'lucide-react-native';
import { SectionHeader } from '@/components/common/SectionHeader';
import {
  subscribeStudentAnnouncements,
  type Announcement,
} from '@/services/announcementsApi';
import { getTeacherName } from '@/services/classApi';

type Props = {
  /** Tek bir öğretmen veya birden çok öğretmen ID'si. */
  teacherIds?: string | string[] | null;
  /** teacherId → öğretmen adı eşlemesi. Legacy duyurularda denormalize teacherName 'Öğretmen' kalmışsa burası canlı isimle override eder. */
  teacherNames?: Record<string, string> | null;
};

/**
 * Akıllı zaman formatı:
 * - 1 dakikadan az → "az önce"
 * - 1 saatten az → "X dk önce"
 * - Bugünse → "Bugün 14:30"
 * - Dünse → "Dün 14:30"
 * - 7 günden eskiyse → "19 May 14:30"
 * Tek satır, redundancy yok.
 */
function formatSmartTime(ms: number): string {
  if (!ms) return '';
  const now = new Date();
  const d = new Date(ms);
  const diffMin = Math.floor((now.getTime() - ms) / 60000);
  if (diffMin < 1) return 'az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;

  const hm = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isSameDay) return `Bugün ${hm}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return `Dün ${hm}`;

  const datePart = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return `${datePart} ${hm}`;
}

function isUsableName(s: string | null | undefined): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  return trimmed.length > 0 && trimmed.toLowerCase() !== 'öğretmen';
}

/** Öğrenci ana sayfasında bağlı olduğu öğretmen(ler)in son duyurularını gösterir. */
export function AnnouncementCard({ teacherIds, teacherNames }: Props) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  const idList = Array.isArray(teacherIds)
    ? teacherIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : typeof teacherIds === 'string' && teacherIds.length > 0
      ? [teacherIds]
      : [];
  const idKey = idList.join(',');

  useEffect(() => {
    if (idList.length === 0) {
      setItems([]);
      return;
    }
    const unsub = subscribeStudentAnnouncements(idList, setItems);
    return () => {
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  // Eksik/legacy öğretmen adlarını canlı olarak Firestore'dan çek (her teacherId için bir kez).
  const missingIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of items) {
      if (!a.teacherId) continue;
      const fromProp = teacherNames?.[a.teacherId];
      const fromDoc = a.teacherName;
      if (isUsableName(fromProp) || isUsableName(fromDoc)) continue;
      if (resolvedNames[a.teacherId]) continue;
      set.add(a.teacherId);
    }
    return Array.from(set);
  }, [items, teacherNames, resolvedNames]);

  useEffect(() => {
    if (missingIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missingIds.map(async (id) => {
          const n = await getTeacherName(id);
          return [id, isUsableName(n) ? (n as string) : ''] as const;
        }),
      );
      if (cancelled) return;
      setResolvedNames((prev) => {
        const next = { ...prev };
        for (const [id, name] of entries) if (name) next[id] = name;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [missingIds]);

  if (idList.length === 0 || items.length === 0) return null;

  const latest = items.slice(0, 3);

  const displayName = (a: Announcement): string => {
    const fromProp = teacherNames?.[a.teacherId];
    if (isUsableName(fromProp)) return fromProp!.trim();
    if (isUsableName(a.teacherName)) return a.teacherName.trim();
    if (isUsableName(resolvedNames[a.teacherId])) return resolvedNames[a.teacherId]!.trim();
    return 'Öğretmen';
  };

  return (
    <View>
      <SectionHeader title="Duyurular" />
      <View className="mt-3" style={{ gap: 8 }}>
        {latest.map((a) => (
          <View key={a.id} className="rounded-2xl border border-accent/30 bg-accent-soft p-3">
            <View className="flex-row items-center">
              <Megaphone color="#15803D" size={14} />
              <Text
                className="ml-2 flex-1 text-sm font-semibold text-text-primary"
                numberOfLines={1}
              >
                {a.title}
              </Text>
            </View>
            {a.content ? (
              <Text
                className="mt-1.5 text-xs leading-5 text-text-secondary"
                numberOfLines={3}
              >
                {a.content}
              </Text>
            ) : null}
            <View
              className="mt-2 flex-row flex-wrap items-center"
              style={{ rowGap: 4, columnGap: 10 }}
            >
              <View className="flex-row items-center">
                <User color="#16A34A" size={10} />
                <Text
                  className="ml-1 text-[10px] font-semibold text-accent-fg"
                  numberOfLines={1}
                >
                  {displayName(a)}
                </Text>
              </View>
              {a.createdAtMs ? (
                <View className="flex-row items-center">
                  <Clock color="#94A3B8" size={10} />
                  <Text className="ml-1 text-[10px] text-text-muted" numberOfLines={1}>
                    {formatSmartTime(a.createdAtMs)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

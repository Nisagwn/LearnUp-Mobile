import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Megaphone } from 'lucide-react-native';
import { SectionHeader } from '@/components/common/SectionHeader';
import { subscribeStudentAnnouncements, type Announcement } from '@/services/announcementsApi';

type Props = {
  teacherId?: string | null;
};

/** Öğrenci ana sayfasında öğretmenin son duyurularını gösterir. Veri yoksa hiçbir şey render etmez. */
export function AnnouncementCard({ teacherId }: Props) {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!teacherId) {
      setItems([]);
      return;
    }
    const unsub = subscribeStudentAnnouncements(teacherId, setItems);
    return () => {
      if (unsub) unsub();
    };
  }, [teacherId]);

  if (!teacherId || items.length === 0) return null;

  const latest = items.slice(0, 3);

  return (
    <View>
      <SectionHeader title="Öğretmeninden" />
      <View className="mt-3" style={{ gap: 8 }}>
        {latest.map((a) => (
          <View key={a.id} className="rounded-2xl border border-accent/30 bg-accent-soft p-3">
            <View className="flex-row items-center">
              <Megaphone color="#4F46E5" size={14} />
              <Text className="ml-2 flex-1 text-sm font-semibold text-text-primary" numberOfLines={1}>
                {a.title}
              </Text>
            </View>
            {a.content ? (
              <Text className="mt-1 text-xs leading-5 text-text-secondary" numberOfLines={3}>
                {a.content}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

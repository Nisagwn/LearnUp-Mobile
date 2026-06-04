import { View, Text, Pressable } from 'react-native';
import {
  Send,
  Sparkles,
  UserPlus,
  ClipboardList,
  Megaphone,
  Activity,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { formatRelativeTime } from '@/utils/relativeTime';
import type { ActivityEvent, ActivityType } from '@/services/teacherActivityApi';

const ICON_MAP: Record<ActivityType, { icon: LucideIcon; color: string; bg: string }> = {
  submission: { icon: Send, color: '#D97706', bg: 'bg-warning/15' },
  targeted_done: { icon: Sparkles, color: '#16A34A', bg: 'bg-success/15' },
  new_student: { icon: UserPlus, color: '#6366F1', bg: 'bg-accent/15' },
  assignment_created: { icon: ClipboardList, color: '#0891B2', bg: 'bg-accent/15' },
  announcement_created: { icon: Megaphone, color: '#0891B2', bg: 'bg-accent/15' },
};

type Props = {
  events: ActivityEvent[] | null;
  loading?: boolean;
  onEventPress: (deepLink: string) => void;
};

export function RecentActivityCard({ events, loading, onEventPress }: Props) {
  if (loading && !events) {
    return (
      <View className="rounded-2xl border border-border-soft bg-bg-surface p-4" style={{ gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} className="h-10 rounded-xl bg-bg-elevated" />
        ))}
      </View>
    );
  }

  if (!events || events.length === 0) {
    return (
      <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-bg-elevated">
            <Activity color="#94A3B8" size={18} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-sm font-semibold text-text-primary">Aktivite yok</Text>
            <Text className="text-[11px] text-text-muted">
              Son zamanlarda kayda değer bir hareket yok.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const now = Date.now();
  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-3" style={{ gap: 4 }}>
      {events.map((e) => {
        const cfg = ICON_MAP[e.type];
        const Icon = cfg.icon;
        return (
          <Pressable
            key={e.id}
            onPress={() => onEventPress(e.deepLink)}
            className="flex-row items-center rounded-xl p-2 active:bg-bg-elevated"
          >
            <View className={`h-9 w-9 items-center justify-center rounded-xl ${cfg.bg}`}>
              <Icon color={cfg.color} size={16} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[13px] text-text-primary" numberOfLines={2}>
                {e.message}
              </Text>
              <Text className="mt-0.5 text-[10px] text-text-muted">
                {formatRelativeTime(e.tsMs, now)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

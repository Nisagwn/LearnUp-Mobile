import { View, Text, Pressable } from 'react-native';
import {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Flame,
  Inbox,
  Megaphone,
  MessageCircle,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import type { AppNotification, NotificationTone } from '@/services/notificationsApi';
import { formatRelativeTime } from '@/utils/relativeTime';

const ICON_MAP: Record<string, LucideIcon> = {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  ClipboardList,
  Flame,
  Inbox,
  Megaphone,
  MessageCircle,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
};

const TONE_CLASSES: Record<
  NotificationTone,
  { iconBg: string; cardBg: string; cardBorder: string }
> = {
  accent: {
    iconBg: 'bg-accent/15',
    cardBg: 'bg-bg-surface',
    cardBorder: 'border-border-soft',
  },
  success: {
    iconBg: 'bg-success/15',
    cardBg: 'bg-bg-surface',
    cardBorder: 'border-border-soft',
  },
  warning: {
    iconBg: 'bg-warning/15',
    cardBg: 'bg-bg-surface',
    cardBorder: 'border-border-soft',
  },
  danger: {
    iconBg: 'bg-danger/15',
    cardBg: 'bg-bg-surface',
    cardBorder: 'border-border-soft',
  },
};

const TONE_ICON_COLOR: Record<NotificationTone, string> = {
  accent: '#16A34A',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
};

type Props = {
  item: AppNotification;
  onPress: (n: AppNotification) => void;
};

export function NotificationRow({ item, onPress }: Props) {
  const Icon = ICON_MAP[item.icon] ?? Bell;
  const tone = TONE_CLASSES[item.tone];
  const iconColor = TONE_ICON_COLOR[item.tone];
  const unread = !item.readAtMs;

  return (
    <Pressable
      onPress={() => onPress(item)}
      className={`flex-row items-start rounded-2xl border p-3.5 active:opacity-80 ${tone.cardBg} ${tone.cardBorder}`}
    >
      <View
        className={`mt-0.5 h-10 w-10 items-center justify-center rounded-xl ${tone.iconBg}`}
      >
        <Icon color={iconColor} size={18} />
      </View>
      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          {unread ? (
            <View className="mr-1.5 h-2 w-2 rounded-full bg-danger" />
          ) : null}
          <Text
            className="flex-1 text-sm font-semibold text-text-primary"
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </View>
        {item.body ? (
          <Text className="mt-0.5 text-[12px] text-text-secondary" numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text className="mt-1 text-[11px] text-text-muted">
          {formatRelativeTime(item.createdAtMs)}
        </Text>
      </View>
      {item.deepLink ? (
        <ChevronRight color="#94A3B8" size={18} style={{ marginTop: 12 }} />
      ) : null}
    </Pressable>
  );
}

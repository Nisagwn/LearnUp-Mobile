import { View, Text, Pressable } from 'react-native';
import { ChevronRight, Inbox, Clock, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { TeacherInbox } from '@/services/teacherInboxApi';

type Tone = 'warning' | 'danger' | 'accent' | 'success';

interface Row {
  icon: LucideIcon;
  count: number;
  text: string;
  tone: Tone;
  onPress: () => void;
}

const TONE_CLASSES: Record<Tone, { bg: string; border: string; chipBg: string; iconBg: string }> = {
  warning: {
    bg: 'bg-warning-soft',
    border: 'border-warning/40',
    chipBg: 'bg-warning',
    iconBg: 'bg-warning/15',
  },
  danger: {
    bg: 'bg-danger-soft',
    border: 'border-danger/40',
    chipBg: 'bg-danger',
    iconBg: 'bg-danger/15',
  },
  accent: {
    bg: 'bg-accent-soft',
    border: 'border-accent/40',
    chipBg: 'bg-accent',
    iconBg: 'bg-accent/15',
  },
  success: {
    bg: 'bg-success-soft',
    border: 'border-success/40',
    chipBg: 'bg-success',
    iconBg: 'bg-success/15',
  },
};

const TONE_ICON_COLOR: Record<Tone, string> = {
  warning: '#D97706',
  danger: '#DC2626',
  accent: '#6366F1',
  success: '#16A34A',
};

type Props = {
  inbox: TeacherInbox | null;
  loading?: boolean;
  onOpenSubmissions: () => void;
  onOpenPendingQuestions: () => void;
  onOpenAssignments: () => void;
  onOpenStudents: () => void;
};

export function ActionInboxCard({
  inbox,
  loading,
  onOpenSubmissions,
  onOpenPendingQuestions,
  onOpenAssignments,
  onOpenStudents,
}: Props) {
  if (loading && !inbox) {
    return (
      <View className="rounded-2xl border border-border-soft bg-bg-surface p-4" style={{ gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} className="h-12 rounded-xl bg-bg-elevated" />
        ))}
      </View>
    );
  }

  const rows: Row[] = [];
  if (inbox) {
    if (inbox.pendingSubmissions > 0) {
      rows.push({
        icon: Clock,
        count: inbox.pendingSubmissions,
        text: 'ödev gönderimi incelenmeyi bekliyor',
        tone: 'warning',
        onPress: onOpenSubmissions,
      });
    }
    if (inbox.upcomingDeadlines > 0) {
      rows.push({
        icon: AlertTriangle,
        count: inbox.upcomingDeadlines,
        text: 'ödev 24 saat içinde bitiyor',
        tone: 'danger',
        onPress: onOpenAssignments,
      });
    }
    if (inbox.pendingAIQuestions > 0) {
      rows.push({
        icon: Sparkles,
        count: inbox.pendingAIQuestions,
        text: 'AI soru onayını bekliyor',
        tone: 'accent',
        onPress: onOpenPendingQuestions,
      });
    }
    if (inbox.completedTargetedSets > 0) {
      rows.push({
        icon: CheckCircle2,
        count: inbox.completedTargetedSets,
        text: 'öğrenci hedefli setini bitirdi',
        tone: 'success',
        onPress: onOpenStudents,
      });
    }
  }

  if (rows.length === 0) {
    return (
      <View className="flex-row items-center rounded-2xl border border-success/30 bg-success-soft p-4">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-success/15">
          <Inbox color="#16A34A" size={20} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-sm font-semibold text-text-primary">Aksiyon kutusu boş ✨</Text>
          <Text className="text-[11px] text-text-muted">
            Şu an seni bekleyen bir şey yok — sınıfın iyi durumda.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, i) => {
        const Icon = row.icon;
        const tone = TONE_CLASSES[row.tone];
        return (
          <Pressable
            key={i}
            onPress={row.onPress}
            className={`flex-row items-center rounded-2xl border p-3.5 active:opacity-80 ${tone.bg} ${tone.border}`}
          >
            <View className={`h-10 w-10 items-center justify-center rounded-xl ${tone.iconBg}`}>
              <Icon color={TONE_ICON_COLOR[row.tone]} size={18} />
            </View>
            <View className="ml-3 flex-1 flex-row items-center">
              <View className={`mr-2 rounded-full px-2 py-0.5 ${tone.chipBg}`}>
                <Text className="text-[11px] font-bold text-white">{row.count}</Text>
              </View>
              <Text className="flex-1 text-sm text-text-primary" numberOfLines={2}>
                {row.text}
              </Text>
            </View>
            <ChevronRight color="#94A3B8" size={18} />
          </Pressable>
        );
      })}
    </View>
  );
}

import { useMemo, useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import {
  Zap,
  Sparkles,
  MessageCircle,
  Flame,
  ChevronRight,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
  Clock,
  Layers,
  GraduationCap,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { BADGE_CATALOG } from '@/utils/badges';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';
import { OverflowMenu, OverflowMenuItem } from '@/components/common/OverflowMenu';

type UnlockedMap = Record<string, unknown>;
type Trend = 'up' | 'down' | 'flat';

type Props = {
  subject: string;
  icon: LucideIcon;
  iconColor: string;
  questionCount: number;
  masteryScore: number;
  masterySolvedCount: number;
  lastSolvedAtMs?: number;
  todayActive?: boolean;
  unlockedBadges: UnlockedMap;
  isRecommended?: boolean;
  trend?: Trend;
  weakSubTopic?: string;
  estimatedMinutes?: number;
  onQuiz: () => void;
  onAIGenerate: () => void;
  onExplain: () => void;
  onFlashcard?: () => void;
  onMockExam?: () => void;
};

function relativeTime(ms?: number): string | null {
  if (!ms) return null;
  const diff = Date.now() - ms;
  if (diff < 0) return 'az önce';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend === 'up') {
    return (
      <View className="flex-row items-center rounded-full bg-success-soft px-2 py-0.5">
        <ArrowUpRight color="#16A34A" size={11} />
        <Text className="ml-0.5 text-[10px] font-semibold text-success">Yükseliş</Text>
      </View>
    );
  }
  if (trend === 'down') {
    return (
      <View className="flex-row items-center rounded-full bg-danger-soft px-2 py-0.5">
        <ArrowDownRight color="#DC2626" size={11} />
        <Text className="ml-0.5 text-[10px] font-semibold text-danger">Düşüş</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center rounded-full bg-bg-elevated px-2 py-0.5">
      <Minus color="#94A3B8" size={11} />
      <Text className="ml-0.5 text-[10px] font-semibold text-text-muted">Sabit</Text>
    </View>
  );
}

export function SubjectCard({
  subject,
  icon: Icon,
  iconColor,
  questionCount,
  masteryScore,
  masterySolvedCount,
  lastSolvedAtMs,
  todayActive = false,
  unlockedBadges,
  isRecommended = false,
  trend,
  weakSubTopic,
  estimatedMinutes,
  onQuiz,
  onAIGenerate,
  onExplain,
  onFlashcard,
  onMockExam,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const relatedBadges = useMemo(() => {
    const subjectLower = subject.toLowerCase();
    return BADGE_CATALOG.filter((b) => {
      if (!unlockedBadges[b.id]) return false;
      if (b.family === 'flower') return true;
      if (b.id.toLowerCase().includes(subjectLower)) return true;
      return false;
    }).slice(0, 3);
  }, [subject, unlockedBadges]);

  const lastSeen = relativeTime(lastSolvedAtMs);
  const ratio = Math.min(1, Math.max(0, masteryScore / 100));
  const isUntouched = masterySolvedCount === 0;
  const showStatsStrip = !isUntouched && (trend || weakSubTopic || estimatedMinutes);

  const menuItems = useMemo<OverflowMenuItem[]>(() => {
    const items: OverflowMenuItem[] = [
      { id: 'ai', label: 'AI ile soru üret', icon: Sparkles, iconColor: '#16A34A' },
      { id: 'explain', label: 'Konuyu anlat', icon: MessageCircle, iconColor: '#475569' },
    ];
    if (onFlashcard) items.push({ id: 'flashcard', label: 'Flashcard çalış', icon: Layers, iconColor: '#0891B2' });
    if (onMockExam) items.push({ id: 'mock', label: 'Mock sınav (10 soru)', icon: GraduationCap, iconColor: '#D97706' });
    return items;
  }, [onFlashcard, onMockExam]);

  const handleSelect = (id: string) => {
    if (id === 'ai') onAIGenerate();
    else if (id === 'explain') onExplain();
    else if (id === 'flashcard') onFlashcard?.();
    else if (id === 'mock') onMockExam?.();
  };

  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
      <View className="flex-row items-center">
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${iconColor}1A` }}
        >
          <Icon color={iconColor} size={22} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
            {subject}
          </Text>
          <Text className="text-xs text-text-muted">
            {questionCount} soru havuzu · {masterySolvedCount} çözüldü
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-sm font-bold text-accent-fg">%{masteryScore}</Text>
          <Text className="text-[10px] text-text-muted">ustalık</Text>
        </View>
      </View>

      {isRecommended ? (
        <View className="absolute right-3 top-3 rounded-full bg-warning-soft px-2 py-0.5">
          <Text className="text-[9px] font-bold uppercase text-warning">Önerilen</Text>
        </View>
      ) : null}

      {showStatsStrip ? (
        <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 6 }}>
          {trend ? <TrendBadge trend={trend} /> : null}
          {weakSubTopic ? (
            <View className="flex-row items-center rounded-full bg-srs-new-soft px-2 py-0.5">
              <AlertTriangle color="#DC2626" size={11} />
              <Text className="ml-1 text-[10px] font-semibold text-srs-new" numberOfLines={1}>
                Zayıf: {weakSubTopic}
              </Text>
            </View>
          ) : null}
          {estimatedMinutes && estimatedMinutes > 0 ? (
            <View className="flex-row items-center rounded-full bg-accent-soft px-2 py-0.5">
              <Clock color="#15803D" size={11} />
              <Text className="ml-1 text-[10px] font-semibold text-accent-fg">
                ~{estimatedMinutes} dk
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="mt-3">
        <AnimatedProgressBar value={ratio} height={6} fillColor="#16A34A" />
      </View>

      <View className="mt-3 flex-row flex-wrap items-center" style={{ gap: 8 }}>
        {isUntouched ? (
          <Text className="text-[11px] text-text-muted">Henüz başlamadın</Text>
        ) : lastSeen ? (
          <Text className="text-[11px] text-text-muted">{lastSeen}</Text>
        ) : null}
        {todayActive ? (
          <View className="flex-row items-center rounded-full bg-warning-soft px-2 py-0.5">
            <Flame color="#D97706" size={10} />
            <Text className="ml-1 text-[10px] font-semibold text-warning">Bugün +1</Text>
          </View>
        ) : null}
        {relatedBadges.map((b) => (
          <Text key={b.id} style={{ fontSize: 14 }}>
            {b.emoji}
          </Text>
        ))}
      </View>

      <View className="mt-3 flex-row gap-2">
        <Pressable
          onPress={onQuiz}
          className="flex-1 flex-row items-center justify-center rounded-xl bg-accent py-2.5 active:opacity-80"
        >
          <Zap color="white" size={14} />
          <Text className="ml-1.5 text-xs font-semibold text-white">
            {isUntouched ? 'Tanışma Quiz\'i (3 soru)' : 'Quiz Başlat'}
          </Text>
          <ChevronRight color="white" size={12} />
        </Pressable>
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityLabel="Daha fazla eylem"
          className="h-10 w-10 items-center justify-center rounded-xl border border-border-soft active:bg-bg-elevated"
        >
          <MoreHorizontal color="#475569" size={18} />
        </Pressable>
      </View>

      <OverflowMenu
        visible={menuOpen}
        title={subject}
        subtitle="Bu ders için diğer eylemler"
        items={menuItems}
        onSelect={handleSelect}
        onClose={() => setMenuOpen(false)}
      />
    </View>
  );
}

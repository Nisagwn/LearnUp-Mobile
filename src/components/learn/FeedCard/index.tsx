import { View, Text } from 'react-native';
import {
  Target,
  RotateCw,
  PlayCircle,
  Flame,
  Trophy,
  AlertTriangle,
  Sparkles,
  GraduationCap,
} from 'lucide-react-native';
import { AnimatedProgressBar } from '@/components/learn/AnimatedProgressBar';
import type { FeedItem } from '@/utils/learnFeed';
import { FeedCardBase } from './Base';

type Callbacks = {
  onStartTodayGoal: (subject: string) => void;
  onStartReview: () => void;
  onContinue: (subject: string) => void;
  onProtectStreak: () => void;
  onCelebrateMilestone: () => void;
  onFocusWeakTopic: (subTopic: string) => void;
  onStartNewSubject: (subject: string) => void;
  onStartMockExam: (subject: string) => void;
  onDismiss: (id: string) => void;
};

type Props = {
  item: FeedItem;
  subjectLabel: (key: string) => string;
  callbacks: Callbacks;
};

export function FeedCard({ item, subjectLabel, callbacks }: Props) {
  const dismiss = () => callbacks.onDismiss(item.id);

  switch (item.type) {
    case 'today_goal': {
      const ratio = item.target > 0 ? Math.min(1, item.progress / item.target) : 0;
      return (
        <FeedCardBase
          icon={Target}
          iconColor="#4F46E5"
          iconBg="#EEF2FF"
          category="Bugünkü hedef"
          title={`${subjectLabel(item.subject)} — ${item.progress}/${item.target} soru`}
          subtitle="Bugünün görevini tamamla, +XP kazan"
          primaryLabel="Hedefe devam et"
          onPrimary={() => callbacks.onStartTodayGoal(item.subject)}
          onDismiss={dismiss}
        >
          <AnimatedProgressBar value={ratio} height={6} fillColor="#6366F1" />
        </FeedCardBase>
      );
    }

    case 'review_due': {
      const subtitle =
        item.count >= 10
          ? 'Birikmiş tekrarlar var — kısa bir tur yeterli olur.'
          : `${item.count} soru bekliyor`;
      return (
        <FeedCardBase
          icon={RotateCw}
          iconColor="#D97706"
          iconBg="#FEF3C7"
          category="Tekrar zamanı"
          title={`${item.count} kart için tekrar zamanı geldi`}
          subtitle={subtitle}
          primaryLabel="Hemen tekrar et"
          primaryColor="#D97706"
          onPrimary={callbacks.onStartReview}
          onDismiss={dismiss}
        />
      );
    }

    case 'continue': {
      const minutesAgo = Math.max(1, Math.floor((Date.now() - item.lastSolvedAtMs) / 60000));
      const sub = item.subTopic ? ` — ${item.subTopic}` : '';
      return (
        <FeedCardBase
          icon={PlayCircle}
          iconColor="#4F46E5"
          iconBg="#EEF2FF"
          category="Kaldığın yer"
          title={`${subjectLabel(item.subject)}${sub}`}
          subtitle={`Son aktivite ${minutesAgo} dk önce`}
          primaryLabel="Devam et"
          onPrimary={() => callbacks.onContinue(item.subject)}
          onDismiss={dismiss}
        />
      );
    }

    case 'streak_at_risk': {
      return (
        <FeedCardBase
          icon={Flame}
          iconColor="#DC2626"
          iconBg="#FEE2E2"
          category="Seri tehlikede"
          title={`${item.currentStreak} günlük serin sönmek üzere`}
          subtitle="Bugün 1 soru bile yeterli — alev sürsün."
          primaryLabel="Seriyi koru"
          primaryColor="#DC2626"
          onPrimary={callbacks.onProtectStreak}
          onDismiss={dismiss}
        />
      );
    }

    case 'streak_milestone': {
      return (
        <FeedCardBase
          icon={Trophy}
          iconColor="#D97706"
          iconBg="#FEF3C7"
          category="Yarın milestone"
          title={`Yarın ${item.nextDay}. günü tamamlayacaksın 🎉`}
          subtitle="Bugün de aktif kal, kutla yarın gelsin."
          primaryLabel="Bugünkü turu başlat"
          primaryColor="#D97706"
          onPrimary={callbacks.onCelebrateMilestone}
          onDismiss={dismiss}
        />
      );
    }

    case 'weak_topic': {
      return (
        <FeedCardBase
          icon={AlertTriangle}
          iconColor="#DC2626"
          iconBg="#FEE2E2"
          category="Zayıf konu"
          title={item.subTopic}
          subtitle={`${subjectLabel(item.subject)} · ${item.wrongCount} yanlış`}
          primaryLabel="Odak quiz aç"
          primaryColor="#DC2626"
          onPrimary={() => callbacks.onFocusWeakTopic(item.subTopic)}
          onDismiss={dismiss}
        />
      );
    }

    case 'new_subject': {
      return (
        <FeedCardBase
          icon={Sparkles}
          iconColor="#0891B2"
          iconBg="#CFFAFE"
          category="Yeni keşif"
          title={`Henüz ${subjectLabel(item.subject)}'a hiç dokunmadın`}
          subtitle="3 soruluk tanışma quiz'i ile başla"
          primaryLabel="Tanışma quiz'i başlat"
          primaryColor="#0891B2"
          onPrimary={() => callbacks.onStartNewSubject(item.subject)}
          onDismiss={dismiss}
        />
      );
    }

    case 'mock_exam': {
      return (
        <FeedCardBase
          icon={GraduationCap}
          iconColor="#D97706"
          iconBg="#FEF3C7"
          category="Mock sınav"
          title="Haftanın değerlendirme turu"
          subtitle={`${subjectLabel(item.subject)} · 10 soru, zor zorlukta`}
          primaryLabel="Mock sınava başla"
          primaryColor="#D97706"
          onPrimary={() => callbacks.onStartMockExam(item.subject)}
          onDismiss={dismiss}
        />
      );
    }

    default: {
      // exhaustiveness için fallback
      const exhaustiveCheck: never = item;
      void exhaustiveCheck;
      return (
        <View>
          <Text>Tanınmayan kart</Text>
        </View>
      );
    }
  }
}

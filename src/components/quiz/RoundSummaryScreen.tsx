import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import {
  Sparkles,
  RotateCcw,
  Home,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
} from 'lucide-react-native';
import { getBadgeById } from '@/utils/badges';
import { AppLottie } from '@/components/common/AppLottie';
import { lottie } from '@/constants/lottie';

export interface SolvedItem {
  id: string;
  subject: string;
  isCorrect: boolean;
  isSkipped?: boolean;
  timeSpentMs: number;
  xpGained?: number;
}

type Props = {
  history: SolvedItem[];
  durationMs: number;
  xpEarnedTotal: number;
  levelUpDuringRound?: boolean;
  unlockedBadgesThisRound?: string[];
  onRestart: () => void;
  onHome: () => void;
};

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec} sn`;
  return `${min} dk ${sec.toString().padStart(2, '0')} sn`;
}

export function RoundSummaryScreen({
  history,
  durationMs,
  xpEarnedTotal,
  levelUpDuringRound = false,
  unlockedBadgesThisRound = [],
  onRestart,
  onHome,
}: Props) {
  const { width } = useWindowDimensions();
  const confettiRef = useRef<ConfettiCannon>(null);

  const stats = useMemo(() => {
    const total = history.length;
    const correct = history.filter((h) => h.isCorrect).length;
    const skipped = history.filter((h) => h.isSkipped).length;
    const wrong = total - correct - skipped;
    const successRate = total > 0 ? Math.round((correct / total) * 100) : 0;
    const net = Math.round((correct - wrong * 0.25) * 10) / 10;
    const avgSecPerQ =
      total > 0 ? Math.round(history.reduce((acc, h) => acc + h.timeSpentMs, 0) / total / 1000) : 0;
    return { total, correct, wrong, skipped, successRate, net, avgSecPerQ };
  }, [history]);

  const subjectBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; correct: number }>();
    history.forEach((h) => {
      const cur = map.get(h.subject) ?? { total: 0, correct: 0 };
      cur.total += 1;
      if (h.isCorrect) cur.correct += 1;
      map.set(h.subject, cur);
    });
    return Array.from(map.entries())
      .map(([subject, v]) => ({ subject, total: v.total, correct: v.correct }))
      .sort((a, b) => b.total - a.total);
  }, [history]);

  const goodResult = stats.successRate >= 60 && stats.total > 0;

  useEffect(() => {
    if (goodResult) {
      const t = setTimeout(() => confettiRef.current?.start(), 250);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [goodResult]);

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5 pt-2">
          <LinearGradient
            colors={goodResult ? ['#6366F1', '#8B5CF6'] : ['#94A3B8', '#64748B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 24 }}
            className="overflow-hidden p-5"
          >
            <View className="flex-row items-center">
              <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/20">
                {goodResult ? (
                  <AppLottie source={lottie.trophy} autoPlay loop={false} style={{ width: 52, height: 52 }} />
                ) : (
                  <Sparkles color="white" size={28} />
                )}
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-xs text-white/80">Tur tamamlandı</Text>
                <Text className="mt-0.5 text-base font-semibold text-white">
                  {stats.total > 0
                    ? `${stats.correct} doğru · ${formatDuration(durationMs)}`
                    : 'Henüz soru çözmedin'}
                </Text>
              </View>
            </View>
            <View className="mt-4 flex-row items-end justify-between">
              <View>
                <Text className="text-4xl font-bold text-white">%{stats.successRate}</Text>
                <Text className="text-xs text-white/85">başarı</Text>
              </View>
              <View className="items-end">
                <Text className="text-2xl font-bold text-white">+{xpEarnedTotal} XP</Text>
                {levelUpDuringRound ? (
                  <Text className="text-xs text-white/85">Seviye atladın!</Text>
                ) : null}
              </View>
            </View>
          </LinearGradient>
        </View>

        <View className="mt-5 px-5">
          <View className="flex-row gap-3">
            <StatBox
              icon={CheckCircle2}
              color="#16A34A"
              bg="#DCFCE7"
              label="Doğru"
              value={stats.correct}
            />
            <StatBox icon={XCircle} color="#DC2626" bg="#FEE2E2" label="Yanlış" value={stats.wrong} />
            <StatBox
              icon={Sparkles}
              color="#94A3B8"
              bg="#F1F5F9"
              label="Boş"
              value={stats.skipped}
            />
          </View>
          <View className="mt-3 flex-row gap-3">
            <StatBox icon={Award} color="#6366F1" bg="#EEF2FF" label="Net" value={stats.net} />
            <StatBox
              icon={Clock}
              color="#F97316"
              bg="#FFEDD5"
              label="Ort. süre"
              value={`${stats.avgSecPerQ} sn`}
            />
            <StatBox
              icon={Sparkles}
              color="#0EA5E9"
              bg="#E0F2FE"
              label="Toplam"
              value={stats.total}
            />
          </View>
        </View>

        {unlockedBadgesThisRound.length > 0 ? (
          <View className="mt-5 px-5">
            <Text className="text-sm font-semibold text-text-secondary">Yeni rozetler</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {unlockedBadgesThisRound.map((id) => {
                const badge = getBadgeById(id);
                if (!badge) return null;
                return (
                  <View
                    key={id}
                    className="flex-row items-center rounded-full px-3 py-1.5"
                    style={{ backgroundColor: `${badge.color}1A`, borderWidth: 1, borderColor: `${badge.color}55` }}
                  >
                    <Text style={{ fontSize: 16 }}>{badge.emoji}</Text>
                    <Text className="ml-1.5 text-xs font-semibold text-text-primary">
                      {badge.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {subjectBreakdown.length > 0 ? (
          <View className="mt-6 px-5">
            <Text className="text-sm font-semibold text-text-secondary">Konu dağılımı</Text>
            <View className="mt-2 gap-2">
              {subjectBreakdown.map((s) => (
                <View
                  key={s.subject}
                  className="flex-row items-center justify-between rounded-2xl border border-border-soft bg-bg-surface p-3"
                >
                  <Text className="text-sm font-medium text-text-primary">{s.subject}</Text>
                  <Text className="text-xs text-text-muted">
                    {s.correct} / {s.total} doğru
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="mt-8 gap-3 px-5">
          <Pressable
            onPress={onRestart}
            className="flex-row items-center justify-center rounded-2xl bg-accent py-4 active:opacity-80"
          >
            <RotateCcw color="white" size={18} />
            <Text className="ml-2 text-base font-semibold text-white">Yeni Tur Başlat</Text>
          </Pressable>
          <Pressable
            onPress={onHome}
            className="flex-row items-center justify-center rounded-2xl border border-border-soft py-4 active:bg-bg-elevated"
          >
            <Home color="#0F172A" size={18} />
            <Text className="ml-2 text-base font-semibold text-text-primary">Öğren&apos;e Dön</Text>
          </Pressable>
        </View>
      </ScrollView>

      {goodResult ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 260 }}
        >
          <AppLottie source={lottie.celebrate} autoPlay loop={false} style={{ flex: 1 }} />
        </View>
      ) : null}

      <ConfettiCannon
        ref={confettiRef}
        count={100}
        origin={{ x: width / 2, y: -10 }}
        autoStart={false}
        fadeOut
        explosionSpeed={350}
        fallSpeed={2500}
      />
    </SafeAreaView>
  );
}

function StatBox({
  icon: Icon,
  color,
  bg,
  label,
  value,
}: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  color: string;
  bg: string;
  label: string;
  value: string | number;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-border-soft bg-bg-surface p-3">
      <View
        className="h-8 w-8 items-center justify-center rounded-xl"
        style={{ backgroundColor: bg }}
      >
        <Icon color={color} size={16} />
      </View>
      <Text className="mt-2 text-lg font-bold text-text-primary">{value}</Text>
      <Text className="text-xs text-text-muted">{label}</Text>
    </View>
  );
}

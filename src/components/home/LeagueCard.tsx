import { useMemo } from 'react';
import { Pressable, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { getTierMeta } from '@/utils/league';

type Props = {
  tier?: string;
  weeklyXP?: number;
  onPress?: () => void;
};

function timeUntilNextMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0 sun .. 6 sat
  const daysUntilMon = ((1 - day + 7) % 7) || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMon);
  next.setHours(0, 5, 0, 0);
  const diff = next.getTime() - now.getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days} gün ${hours} sa kaldı`;
  return `${hours} sa kaldı`;
}

function shadeColor(hex: string, percent: number): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return hex;
  const [r, g, b] = m.map((c) => Math.max(0, Math.min(255, parseInt(c, 16) + percent)));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function LeagueCard({ tier, weeklyXP = 0, onPress }: Props) {
  const meta = getTierMeta(tier ?? 'bronze');
  const countdown = useMemo(timeUntilNextMonday, []);

  if (!tier) return null;

  const dark = shadeColor(meta.color, -30);

  return (
    <Pressable onPress={onPress} className="active:opacity-90">
      <LinearGradient
        colors={[meta.color, dark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 20 }}
        className="overflow-hidden p-4"
      >
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/25">
            <Text style={{ fontSize: 26 }}>{meta.emoji}</Text>
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-xs text-white/80">Haftalık Lig</Text>
            <Text className="text-base font-semibold text-white">{meta.label}</Text>
          </View>
          <ChevronRight color="white" size={18} />
        </View>
        <View className="mt-3 flex-row items-end justify-between">
          <View>
            <Text className="text-xl font-bold text-white">{weeklyXP} XP</Text>
            <Text className="text-xs text-white/75">bu hafta kazanılan</Text>
          </View>
          <Text className="text-[10px] text-white/75">{countdown}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

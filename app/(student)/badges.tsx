import { useContext, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { BADGE_CATALOG, BADGE_GROUPS } from '@/utils/badges';
import { BadgeDetailModal } from '@/components/home/BadgeDetailModal';

type UnlockedMap = Record<string, string | number | { toMillis?: () => number } | undefined>;

export default function BadgesScreen() {
  const router = useRouter();
  const ctx = useContext(UserStatsContext);
  const unlocked: UnlockedMap = (ctx?.userProfile?.unlockedBadges ?? {}) as UnlockedMap;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return BADGE_GROUPS.map((g) => ({
      ...g,
      items: BADGE_CATALOG.filter((b) => b.group === g.id),
    }));
  }, []);

  const totalUnlocked = Object.keys(unlocked).length;

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-bg-elevated"
          hitSlop={6}
        >
          <ChevronLeft color="#0F172A" size={22} />
        </Pressable>
        <Text className="ml-1 text-lg font-bold text-text-primary">
          Rozetler ({totalUnlocked}/{BADGE_CATALOG.length})
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {grouped.map((group) => (
          <View key={group.id} className="mt-6">
            <Text className="text-sm font-semibold text-text-secondary">{group.label}</Text>
            <View className="mt-3 flex-row flex-wrap" style={{ gap: 12 }}>
              {group.items.map((badge) => {
                const locked = !unlocked[badge.id];
                return (
                  <Pressable
                    key={badge.id}
                    onPress={() => setSelectedId(badge.id)}
                    className="items-center active:opacity-70"
                    style={{ width: '22%' }}
                  >
                    <View
                      className="h-16 w-16 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: locked ? '#F1F5F9' : `${badge.color}1A`,
                        borderWidth: 1,
                        borderColor: locked ? '#E2E8F0' : `${badge.color}55`,
                        opacity: locked ? 0.55 : 1,
                      }}
                    >
                      <Text style={{ fontSize: 28, opacity: locked ? 0.4 : 1 }}>{badge.emoji}</Text>
                    </View>
                    <Text
                      className="mt-1.5 text-center text-[10px] font-medium"
                      style={{ color: locked ? '#94A3B8' : '#0F172A' }}
                      numberOfLines={2}
                    >
                      {badge.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <BadgeDetailModal
        visible={!!selectedId}
        badgeId={selectedId}
        unlockedAt={selectedId ? unlocked[selectedId] : undefined}
        onClose={() => setSelectedId(null)}
      />
    </SafeAreaView>
  );
}

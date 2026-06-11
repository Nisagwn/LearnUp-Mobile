import { useMemo } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Award } from 'lucide-react-native';
import { SectionHeader } from '@/components/common/SectionHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { BADGE_CATALOG, getBadgeById, normalizeUnlockedMap } from '@/utils/badges';

type CatalogEntry = (typeof BADGE_CATALOG)[number];
type BadgeTimestamp = string | number | { toMillis?: () => number } | undefined;

type Props = {
  unlocked: Record<string, BadgeTimestamp> | undefined;
  onBadgePress?: (badgeId: string) => void;
  onSeeAll?: () => void;
};

function unlockedMillis(value: BadgeTimestamp): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

export function BadgeStrip({ unlocked, onBadgePress, onSeeAll }: Props) {
  const items = useMemo(() => {
    const unlockedMap = normalizeUnlockedMap(unlocked) as Record<string, BadgeTimestamp>;
    const sortedUnlocked = Object.keys(unlockedMap)
      .map((id) => ({ entry: getBadgeById(id), ts: unlockedMillis(unlockedMap[id]) }))
      .filter((x): x is { entry: CatalogEntry; ts: number } => !!x.entry)
      .sort((a, b) => b.ts - a.ts);

    const recentUnlocked = sortedUnlocked.slice(0, 3).map((x) => ({
      badge: x.entry,
      locked: false,
    }));

    const lockedNext = BADGE_CATALOG.filter((b) => !unlockedMap[b.id])
      .slice(0, 3)
      .map((badge) => ({ badge, locked: true }));

    return [...recentUnlocked, ...lockedNext];
  }, [unlocked]);

  const unlockedCount = Object.keys(normalizeUnlockedMap(unlocked) || {}).length;

  if (unlockedCount === 0 && items.length === 0) {
    return (
      <View>
        <SectionHeader title="Rozetler" />
        <View className="mt-3">
          <EmptyState
            icon={Award}
            title="İlk rozetini kazan"
            subtitle="Soru çöz, seri yap — rozetler açılacak"
          />
        </View>
      </View>
    );
  }

  return (
    <View>
      <SectionHeader
        title={`Rozetler (${unlockedCount}/${BADGE_CATALOG.length})`}
        actionLabel="Tümü"
        onActionPress={onSeeAll}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 12, paddingRight: 12 }}
      >
        {items.map(({ badge, locked }, i) => (
          <Pressable
            key={badge.id}
            onPress={() => onBadgePress?.(badge.id)}
            className="mr-3 items-center active:opacity-70"
            style={{ width: 76 }}
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
              <Text style={{ fontSize: 30, opacity: locked ? 0.4 : 1 }}>{badge.emoji}</Text>
            </View>
            <Text
              className="mt-1.5 text-center text-[10px] font-medium"
              style={{ color: locked ? '#94A3B8' : '#0F172A' }}
              numberOfLines={2}
            >
              {badge.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

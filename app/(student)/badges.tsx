import { useContext, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ChevronLeft, Lock } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import {
  BADGE_CATALOG,
  BADGE_FAMILIES,
  getFamilyTone,
  normalizeUnlockedMap,
} from '@/utils/badges';
import { BadgeDetailModal } from '@/components/home/BadgeDetailModal';
import type { GradientKey } from '@/constants/theme';
import { NatureBackdrop } from '@/components/map/NatureBackdrop';

type UnlockedMap = Record<string, string | number | { toMillis?: () => number } | undefined>;
type CatalogItem = (typeof BADGE_CATALOG)[number];

export default function BadgesScreen() {
  const router = useRouter();
  const { colors, gradients } = useThemeColors();
  const ctx = useContext(UserStatsContext);

  const unlocked: UnlockedMap = useMemo(() => {
    const raw = (ctx?.userProfile?.unlockedBadges ?? {}) as UnlockedMap;
    return normalizeUnlockedMap(raw) as UnlockedMap;
  }, [ctx?.userProfile?.unlockedBadges]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Aile bazlı gruplama
  const grouped = useMemo(() => {
    return BADGE_FAMILIES.map((family) => {
      const items = BADGE_CATALOG.filter((b) => b.family === family.id);
      const unlockedCount = items.filter((b) => !!unlocked[b.id]).length;
      return { family, items, unlockedCount, total: items.length };
    });
  }, [unlocked]);

  const totalUnlocked = Object.keys(unlocked).filter((k) => !!unlocked[k]).length;
  const totalAll = BADGE_CATALOG.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <NatureBackdrop width={420} height={1200} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={6}
            style={{
              height: 40,
              width: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
            }}
          >
            <ChevronLeft color={colors.textPrimary} size={22} />
          </Pressable>
          <Text
            style={{
              marginLeft: 4,
              fontSize: 18,
              fontWeight: '800',
              color: colors.textPrimary,
            }}
          >
            Rozetler ({totalUnlocked}/{totalAll})
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Üst hero pill - özet */}
          <Animated.View
            entering={FadeInUp.duration(400)}
            style={{ paddingHorizontal: 16 }}
          >
            <LinearGradient
              colors={[gradients.mint[0], gradients.success[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 20,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 32 }}>🌿</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: colors.white,
                    opacity: 0.9,
                    letterSpacing: 0.8,
                  }}
                >
                  ROZET KOLEKSİYONUN
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '900',
                    color: colors.white,
                    marginTop: 2,
                  }}
                >
                  {totalUnlocked} / {totalAll} kazanıldı
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.white,
                    opacity: 0.85,
                    marginTop: 2,
                  }}
                >
                  Tohumdan ormana, damladan okyanusa
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* 7 aile */}
          {grouped.map((group, gi) => {
            const familyGrad: readonly [string, string] =
              gradients[group.family.gradKey as GradientKey] ??
              gradients.success;
            const tone = getFamilyTone(group.family.id);
            return (
              <Animated.View
                key={group.family.id}
                entering={FadeInUp.duration(360).delay(80 + gi * 60)}
                style={{ paddingHorizontal: 16, marginTop: 18 }}
              >
                {/* Aile başlığı */}
                <View
                  style={{
                    borderRadius: 18,
                    backgroundColor: colors.bgBase,
                    borderWidth: 1,
                    borderColor: colors.borderSoft,
                    overflow: 'hidden',
                  }}
                >
                  <LinearGradient
                    colors={familyGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: 'rgba(255,255,255,0.28)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{group.family.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '900',
                          color: colors.white,
                        }}
                      >
                        {group.family.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '500',
                          color: colors.white,
                          opacity: 0.92,
                          marginTop: 1,
                        }}
                      >
                        {group.family.desc}
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: 'rgba(255,255,255,0.25)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: colors.white,
                        }}
                      >
                        {group.unlockedCount}/{group.total}
                      </Text>
                    </View>
                  </LinearGradient>

                  {/* Rozet grid */}
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingTop: 14,
                      paddingBottom: 10,
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    {group.items.map((badge) => (
                      <BadgeCell
                        key={badge.id}
                        badge={badge}
                        locked={!unlocked[badge.id]}
                        tone={tone}
                        onPress={() => setSelectedId(badge.id)}
                      />
                    ))}
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      <BadgeDetailModal
        visible={!!selectedId}
        badgeId={selectedId}
        unlockedAt={selectedId ? unlocked[selectedId] : undefined}
        onClose={() => setSelectedId(null)}
      />
    </View>
  );
}

function BadgeCell({
  badge,
  locked,
  tone,
  onPress,
}: {
  badge: CatalogItem;
  locked: boolean;
  tone: string;
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  const cellWidth = '22%';
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: cellWidth,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: locked ? colors.bgElevated : colors.bgBase,
          borderWidth: 2,
          borderColor: locked ? colors.borderSoft : tone,
          opacity: locked ? 0.65 : 1,
        }}
      >
        <Text style={{ fontSize: 26, opacity: locked ? 0.45 : 1 }}>
          {badge.emoji}
        </Text>
        {locked ? (
          <View
            style={{
              position: 'absolute',
              right: -3,
              bottom: -3,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: colors.bgBase,
              borderWidth: 1.4,
              borderColor: colors.borderSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Lock size={9} color={colors.textMuted} strokeWidth={2.6} />
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={2}
        style={{
          marginTop: 4,
          textAlign: 'center',
          fontSize: 10,
          fontWeight: '600',
          color: locked ? colors.textMuted : colors.textPrimary,
        }}
      >
        {badge.name}
      </Text>
    </Pressable>
  );
}

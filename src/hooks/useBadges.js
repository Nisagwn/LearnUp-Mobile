import { useMemo } from 'react';
import { useUserStats } from '@/contexts/UserStatsContext';
import { BADGE_CATALOG } from '@/utils/badges';

/**
 * Rozet gösterimi — yalnızca okuma.
 * Rozet kazanımı ve kutlaması artık sunucuda (recordAnswer) yapılıyor;
 * açılan rozetler users/{uid}.unlockedBadges'e yazılıyor ve SessionSummary'de
 * kutlanıyor. Bu hook sadece kazanılmış rozet kimliklerini okur.
 */
export default function useBadges() {
  const { userProfile } = useUserStats();

  const earnedIds = useMemo(
    () => Object.keys(userProfile?.unlockedBadges || {}),
    [userProfile?.unlockedBadges]
  );

  return {
    catalog: BADGE_CATALOG,
    earnedIds,
    newlyUnlocked: [],
    totalEarned: earnedIds.length,
  };
}

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { NatureBackdrop } from '@/components/map/NatureBackdrop';
import { JourneyPath, getCurrentStationY } from '@/components/map/JourneyPath';
import { StationDetailSheet } from '@/components/map/StationDetailSheet';
import { MapTabBar, type MapTab } from '@/components/map/MapTabBar';
import { GardenScreen } from '@/components/garden/GardenScreen';
import { buildJourney, type Station } from '@/utils/journey';
import { normalizeUnlockedMap } from '@/utils/badges';

const TAB_BAR_HEIGHT = 70;

export default function MapScreen() {
  const { colors } = useThemeColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ctx = useContext(UserStatsContext);

  const stats = ctx?.stats || {};
  const profile = ctx?.userProfile || {};
  const correctAnswers = (stats as { correctAnswers?: number }).correctAnswers || 0;
  const level = (stats as { level?: number }).level || 1;
  const unlockedRaw = (profile as { unlockedBadges?: Record<string, unknown> })
    .unlockedBadges || {};

  // Üst sekme: yol (öğrenme yolculuğu) ↔ orman (dekor oyunu)
  const [activeTab, setActiveTab] = useState<MapTab>('road');

  const stations: Station[] = useMemo(() => {
    const normalized = normalizeUnlockedMap(unlockedRaw);
    const unlockedBadgeIds = new Set(Object.keys(normalized));
    return buildJourney({ correctAnswers, level, unlockedBadgeIds });
  }, [correctAnswers, level, unlockedRaw]);

  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  // Scroll: yol mount sonrası current durağa
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (activeTab !== 'road') return;
    const t = setTimeout(() => {
      if (!scrollRef.current) return;
      const y = getCurrentStationY(stations);
      const target = Math.max(0, y + 60 - 220);
      scrollRef.current.scrollTo({ y: target, animated: true });
    }, 350);
    return () => clearTimeout(t);
  }, [stations, activeTab]);

  const backdropHeight = stations.length * 110 + 280;

  // Floating tab pill üst pozisyonu — safe area + 6px boşluk
  const tabTop = insets.top + 6;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      {/* Content — tab pill arkasında tam ekran */}
      {activeTab === 'road' ? (
        <>
          <NatureBackdrop width={width} height={backdropHeight} />
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: tabTop + 36 + 10, // pill yüksekliği + boşluk
              paddingBottom: TAB_BAR_HEIGHT + 32,
            }}
          >
            <JourneyPath
              stations={stations}
              width={width}
              onStationPress={setSelectedStation}
            />
          </ScrollView>
        </>
      ) : (
        // Orman tam ekran — kendi safe area'sını ve mini chip'lerini içerir
        <GardenScreen />
      )}

      {/* Floating sekme pill — sadece görünür, layout alanı tüketmez */}
      <View
        style={{
          position: 'absolute',
          top: tabTop,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 100,
        }}
        pointerEvents="box-none"
      >
        <MapTabBar active={activeTab} onChange={setActiveTab} />
      </View>

      <StationDetailSheet
        visible={!!selectedStation}
        station={selectedStation}
        currentCorrect={correctAnswers}
        onClose={() => setSelectedStation(null)}
      />
    </View>
  );
}

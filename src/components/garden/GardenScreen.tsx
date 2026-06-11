import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Alert, BackHandler, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { ShoppingBag, Backpack, Pencil, Check } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { PressableScale } from '@/components/common/PressableScale';
import { GardenCanvas, type ScreenRect } from './GardenCanvas';
import { InventorySheet } from './InventorySheet';
import { DragGhost } from './DragGhost';
import { EditModeOverlay } from './EditModeOverlay';
import { TrashDropZone } from './TrashDropZone';
import { PlantActionSheet } from './PlantActionSheet';
import { MarketSheet } from '@/components/market/MarketSheet';
import {
  plantSeed,
  movePlant,
  removePlant,
} from '@/services/gardenApi';
import { findFreePosition, clampPosition, type GardenPlant } from '@/utils/garden';
import { normalizeUnlockedMap } from '@/utils/badges';

const TAB_BAR_HEIGHT = 70;
// Çöp kutusu sabit pozisyonu (TrashDropZone ile aynı değerler)
const TRASH_SIZE = 76;
const TRASH_LEFT = 18;
const TRASH_BOTTOM_OFFSET = 24;

export function GardenScreen() {
  const { colors } = useThemeColors();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ctx = useContext(UserStatsContext);

  const profile = (ctx?.userProfile ?? {}) as Record<string, unknown>;
  const gamification = (profile.gamification ?? {}) as {
    coins?: number;
  };
  const coins = gamification.coins ?? 0;

  const inventory = (ctx?.inventory ?? []) as Array<{ itemId: string; kind: string; count: number }>;
  const plants = (ctx?.gardenPlants ?? []) as GardenPlant[];
  const stats = (ctx?.stats ?? {}) as { level?: number };
  const level = stats.level ?? 1;

  const unlockedBadgeIds = useMemo(() => {
    const raw = (profile.unlockedBadges ?? {}) as Record<string, unknown>;
    return new Set(Object.keys(normalizeUnlockedMap(raw)));
  }, [profile.unlockedBadges]);

  // Canvas TAM EKRAN — boyutu pencereden DEĞİL parent View'dan onLayout ile
  // ölçülür. Pencereden hesap (height - tabBarTotalH) yanlış sonuç veriyordu
  // çünkü expo-router Tabs tab bar'ı absolute pozisyonlu; parent zaten daha
  // küçük geliyor → çift düşme → altta beyaz boşluk.
  const tabBarTotalH = TAB_BAR_HEIGHT + insets.bottom;
  const [canvasSize, setCanvasSize] = useState({ w: width, h: Math.max(280, height - tabBarTotalH) });
  const canvasW = canvasSize.w;
  const canvasH = canvasSize.h;

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setCanvasSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  // Canvas parent View'un içinde absoluteFill olarak duruyor — drop detection
  // için offset 0 (canvas, GardenScreen container'ının ekran içindeki konumuyla
  // başlar; bizim layout'ta bu da 0).
  const canvasOffsetY = 0;
  const canvasOffsetX = 0;

  // Sheet & mode state
  const [editMode, setEditMode] = useState(false);
  const [actionPlant, setActionPlant] = useState<GardenPlant | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [ghost, setGhost] = useState<{ emoji: string; color: string; itemId: string } | null>(null);

  // Drag ghost shared values
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);

  // Aktif sürüklenen bitki (edit mode'da çöp kutusu animasyonu için)
  const [draggingPlantId, setDraggingPlantId] = useState<string | null>(null);

  // Çöp kutusu hit-test rect'i — DETERMINISTIK, screen dim'den hesaplanır.
  // SharedValue olarak tutulur ki state update'i plant'ları remount etmesin
  // (remount → mid-drag → reanimated worklet crash). Edit mode değişince
  // useEffect ile güncellenir.
  const trashRectSv = useSharedValue<ScreenRect | null>(null);
  useEffect(() => {
    if (editMode) {
      const bottomEdge = TAB_BAR_HEIGHT + insets.bottom + TRASH_BOTTOM_OFFSET;
      trashRectSv.value = {
        x: TRASH_LEFT,
        y: height - bottomEdge - TRASH_SIZE,
        w: TRASH_SIZE,
        h: TRASH_SIZE,
      };
    } else {
      trashRectSv.value = null;
    }
  }, [editMode, height, insets.bottom, trashRectSv]);

  // Android back tuşu: edit modda iken back → edit modu kapat (ekrandan çıkma).
  // Bu, drag esnasında back tuşuyla ekranın unmount olup reanimated worklet'in
  // crash atmasını da engeller (uygulamanın ana ekrana atması).
  useEffect(() => {
    if (!editMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setEditMode(false);
      return true;
    });
    return () => sub.remove();
  }, [editMode]);

  function handleRemove() {
    if (!actionPlant) return;
    Alert.alert(
      'Bitkiyi söke',
      'Bitki ağıla geri eklenecek. Emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Söke',
          style: 'destructive',
          onPress: async () => {
            try {
              await removePlant(actionPlant.plantId);
              setActionPlant(null);
            } catch (e) {
              Alert.alert('Hata', e instanceof Error ? e.message : 'Söke başarısız');
            }
          },
        },
      ],
    );
  }

  // Plants snapshot — useRef'te tutarız ki collision avoidance handler'ı
  // useCallback deps'siz stabil kalsın. Plants array'i her render'da yeni
  // referans olur; handler closure'a yakalanırsa stale data tutar — ama
  // useRef ile her zaman güncel snapshot okuruz.
  const plantsRef = useRef<GardenPlant[]>(plants);
  useEffect(() => { plantsRef.current = plants; }, [plants]);

  // useCallback ile referans sabitlenir — `GardenPlantNode` memo'lu olduğu için
  // her render'da yeni fonksiyon geçmek tüm bitkileri remount eder; drag esnasında
  // remount → reanimated worklet → CRASH. Bu memoization tam o crash'i önler.
  //
  // Collision avoidance: sürüklenen plant hariç mevcut plant'lara göre
  // findFreePosition ile spiral arama → 40px komşuluk dışında konum bul.
  // scale opsiyonel: pinch ile gelen yeni boyut. Verilmezse backend mevcut
  // boyutu korur (movePlant yalnız x/y yazar).
  const handlePlantMove = useCallback(async (
    plantId: string,
    x: number,
    y: number,
    scale?: number,
  ) => {
    const others = plantsRef.current.filter((p) => p.plantId !== plantId);
    const safe = findFreePosition(others, x, y, canvasW, canvasH, 40);
    try {
      await movePlant({
        plantId,
        x: safe.x,
        y: safe.y,
        ...(typeof scale === 'number' ? { scale } : {}),
      });
    } catch (e) {
      Alert.alert('Taşıma başarısız', e instanceof Error ? e.message : 'Hata');
    }
  }, [canvasW, canvasH]);

  const handlePlantTap = useCallback((p: GardenPlant) => {
    setActionPlant(p);
  }, []);

  // Çöp kutusu drop → backend silme + envantere geri. Toast yerine sessiz çalışır;
  // hata olursa Alert.
  const handleTrashDrop = useCallback(async (plantId: string) => {
    try {
      await removePlant(plantId);
    } catch (e) {
      Alert.alert('Silme başarısız', e instanceof Error ? e.message : 'Hata');
    } finally {
      setDraggingPlantId(null);
    }
  }, []);

  const handleDragStateChange = useCallback((plantId: string | null) => {
    setDraggingPlantId(plantId);
  }, []);

  // Ağıldan drag: ghost overlay yönetimi.
  // ÖNEMLİ: Burada `setInventoryOpen(false)` çağırmayız — sheet'i unmount
  // etmek aktif GestureDetector'ı tear-down eder, reanimated worklet native
  // tarafta crash atar (telefon ana ekrana atıyordu). Sheet mounted kalır,
  // sadece `ghost` aktifken görsel olarak gizlenir (opacity 0 + pointerEvents
  // none). Başarılı drop sonrası onGhostEnd içinde kapatılır.
  function onGhostStart(p: { emoji: string; color: string; itemId: string; x: number; y: number }) {
    setGhost({ emoji: p.emoji, color: p.color, itemId: p.itemId });
    ghostX.value = p.x;
    ghostY.value = p.y;
  }

  function onGhostUpdate(x: number, y: number) {
    ghostX.value = x;
    ghostY.value = y;
  }

  async function onGhostEnd(p: { itemId: string; x: number; y: number }) {
    setGhost(null);
    // Bırakma noktası canvas içinde mi?
    const canvasTopY = canvasOffsetY;
    const canvasBottomY = canvasOffsetY + canvasH;
    if (p.y < canvasTopY || p.y > canvasBottomY) {
      // Canvas dışı — iptal
      return;
    }
    const localX = p.x - canvasOffsetX;
    const localY = p.y - canvasTopY;
    const safe = findFreePosition(plants, localX, localY, canvasW, canvasH, 40);
    const clamped = clampPosition(safe.x, safe.y, canvasW, canvasH);
    try {
      await plantSeed({ itemId: p.itemId, x: clamped.x, y: clamped.y });
      setInventoryOpen(false);
    } catch (e) {
      Alert.alert('Dikme başarısız', e instanceof Error ? e.message : 'Hata');
    }
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bgBase }}
      onLayout={onContainerLayout}
    >
      {/* Canvas TAM EKRAN — arka plan baştan sona görünür */}
      <GardenCanvas
        width={canvasW}
        height={canvasH}
        plants={plants}
        editMode={editMode}
        isRainDay={false}
        trashRectSv={trashRectSv}
        onPlantTap={handlePlantTap}
        onPlantMove={handlePlantMove}
        onPlantTrash={handleTrashDrop}
        onDragStateChange={handleDragStateChange}
      />

      {/* Mini altın chip (sol üst, sekme pill'in altında).
          Su mekaniği kaldırıldı → sadece tek bir altın rozeti var. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 44,
          left: 14,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: 'rgba(15,23,42,0.32)',
          }}
        >
          <Text style={{ fontSize: 12 }}>🪙</Text>
          <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFFFFF' }}>
            {coins.toLocaleString('tr-TR')}
          </Text>
        </View>
      </View>

      {/* FAB'lar (sağ alt) — minimal & sade, tab bar üstüne konumlanır */}
      <View
        style={{
          position: 'absolute',
          right: 14,
          bottom: tabBarTotalH + 14,
          gap: 10,
        }}
      >
        <PressableScale onPress={() => setMarketOpen(true)}>
          <View
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.42)',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.55)',
            }}
          >
            <ShoppingBag size={20} color="#FFFFFF" strokeWidth={2.6} />
          </View>
        </PressableScale>
        <PressableScale onPress={() => setInventoryOpen(true)}>
          <View
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.42)',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.55)',
            }}
          >
            <Backpack size={20} color="#FFFFFF" strokeWidth={2.6} />
          </View>
        </PressableScale>
        <PressableScale onPress={() => setEditMode((v) => !v)}>
          <View
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: editMode ? 'rgba(22,163,74,0.85)' : 'rgba(255,255,255,0.42)',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1,
              borderColor: editMode ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
            }}
          >
            {editMode ? (
              <Check size={20} color="#FFFFFF" strokeWidth={2.8} />
            ) : (
              <Pencil size={18} color="#FFFFFF" strokeWidth={2.6} />
            )}
          </View>
        </PressableScale>
      </View>

      {/* Edit Mode UI Overlay */}
      <EditModeOverlay visible={editMode} onDone={() => setEditMode(false)} />

      {/* Çöp kutusu drop zone — edit modda görünür, drag sırasında büyür.
          Hit-test rect'i ekran dimensions'tan deterministik hesaplanıyor;
          bu component sadece görsel. */}
      <TrashDropZone
        visible={editMode}
        active={!!draggingPlantId}
        bottomOffset={tabBarTotalH + TRASH_BOTTOM_OFFSET}
        leftOffset={TRASH_LEFT}
        size={TRASH_SIZE}
      />

      {/* Modals */}
      <PlantActionSheet
        visible={!!actionPlant}
        plant={actionPlant}
        onRemove={handleRemove}
        onClose={() => setActionPlant(null)}
      />
      <InventorySheet
        visible={inventoryOpen}
        inventory={inventory}
        ghostX={ghostX}
        ghostY={ghostY}
        dragging={!!ghost}
        onClose={() => setInventoryOpen(false)}
        onGhostStart={onGhostStart}
        onGhostUpdate={onGhostUpdate}
        onGhostEnd={onGhostEnd}
      />
      <MarketSheet
        visible={marketOpen}
        coins={coins}
        level={level}
        unlockedBadgeIds={unlockedBadgeIds}
        inventory={inventory}
        onClose={() => setMarketOpen(false)}
      />

      {/* Drag Ghost — en üstte; sheet kapanınca canvas üzerinde görünür kalır.
          itemId verilmesinin sebebi: ghost artık PNG kullanacak (emoji'ye düşmez
          ağaç/dekor PNG'si varsa). */}
      <DragGhost
        emoji={ghost?.emoji ?? null}
        itemId={ghost?.itemId ?? null}
        color={ghost?.color}
        x={ghostX}
        y={ghostY}
      />
    </View>
  );
}

import { memo, useCallback, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { InteractionManager } from 'react-native';
import { PlantRenderer } from './PlantRenderer';
import { getItemById } from '@/constants/marketCatalog';
import {
  computeStage,
  computeStatus,
  PLANT_SCALE_MIN,
  PLANT_SCALE_MAX,
  PLANT_SCALE_DEFAULT,
  type GardenPlant,
} from '@/utils/garden';
import type { ScreenRect } from './GardenCanvas';

type Props = {
  plant: GardenPlant;
  canvasW: number;
  canvasH: number;
  editMode: boolean;
  size?: number;
  /**
   * Çöp kutusunun ekran absolute rect'ini taşıyan shared value.
   * React state'inden geçmediği için trash rect güncellemesi plant'ları
   * remount etmez (kritik: drag esnasında remount → reanimated crash).
   */
  trashRectSv: SharedValue<ScreenRect | null>;
  onTap: (plant: GardenPlant) => void;
  /** Pozisyon ve/veya boyut commit'i — scale verilirse backend'e yazılır. */
  onMoveCommit: (plantId: string, x: number, y: number, scale?: number) => void;
  onTrash: (plantId: string) => void;
  onDragStateChange: (plantId: string | null) => void;
};

const DEFAULT_SIZE = 60;

/**
 * Bahçedeki tek bitki/dekor — Hay Day tarzı sade görünüm.
 *
 *  • Statik durur (sürekli sallanmaz). Sadece yerleştirildiğinde tek bir
 *    "settle" sıçraması yapar.
 *  • Edit mode'da hafif scale 1.04 + sarı outline — sürüklenebilir sinyali.
 *  • Drag → scale 1.18; çöp rect içinde bırakılırsa scale 0'a indirilip silinir;
 *    değilse clamped konumda yerine yerleşir.
 *  • Renkli halo, sparkle ve sürekli sway/wiggle KALDIRILDI (görsel kirlilik +
 *    Android crash riski).
 */
function GardenPlantNodeBase({
  plant, canvasW, canvasH, editMode, size = DEFAULT_SIZE,
  trashRectSv, onTap, onMoveCommit, onTrash, onDragStateChange,
}: Props) {
  const now = Date.now();
  const item = getItemById(plant.itemId);
  const computedStage = computeStage(plant, now);
  const computedStatus = computeStatus(plant, now);

  const tx = useSharedValue(plant.x);
  const ty = useSharedValue(plant.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const editPulse = useSharedValue(0); // 0 = idle, 1 = edit
  const meter = useSharedValue(0); // 0 → 1 long-press meter ring

  // Pinch (boyut) — kalıcı görsel scale + canlı pinch çarpanı.
  // persistedScale: backend'den gelen değer. liveScale: aktif pinch sırasındaki
  // çarpan (pinch end'de persistedScale ile çarpılıp commit edilir).
  const persistedScale = useSharedValue(plant.scale ?? PLANT_SCALE_DEFAULT);
  const liveScale = useSharedValue(1);
  const startPersistedScale = useSharedValue(PLANT_SCALE_DEFAULT);

  // Pozisyon senkron
  useEffect(() => { tx.value = plant.x; ty.value = plant.y; }, [plant.x, plant.y, tx, ty]);

  // Scale senkron — backend güncellenince UI'a yansısın
  useEffect(() => {
    persistedScale.value = plant.scale ?? PLANT_SCALE_DEFAULT;
  }, [plant.scale, persistedScale]);

  // İlk dikim "settle" sıçraması — bir kere, sonra statik
  useEffect(() => {
    dragScale.value = withSequence(
      withTiming(1.15, { duration: 160 }),
      withSpring(1, { damping: 8, stiffness: 180 }),
    );
  }, [plant.plantId, dragScale]);

  // Edit moda geçince hafif scale + outline opacity geçişi
  useEffect(() => {
    editPulse.value = withTiming(editMode ? 1 : 0, { duration: 220 });
  }, [editMode, editPulse]);

  // ── Central runOnJS handler ────────────────────────────────────────────
  // Tüm onPanEnd çıktıları (move / trash) tek bir JS fonksiyonuna geçer.
  // Birden fazla runOnJS çağrısı state batch'ini bozabiliyor → crash riski.
  type PanResult =
    | { outcome: 'move'; x: number; y: number }
    | { outcome: 'trash' };
  const onPanEnd = useCallback((res: PanResult) => {
    // CRASH HARDENING:
    // Gesture worklet'inden JS'e dönüş frame'inde React state set etmek +
    // backend mutation tetiklemek + haptic çağırmak Android'de ara sıra
    // native crash (uygulamayı ana ekrana atma) yaratıyordu. Bu işleri bir
    // sonraki interaction frame'ine erteliyoruz — Reanimated UI thread'i
    // drop spring'ini bitirip JS thread'i de gesture cleanup'ını tamamlasın.
    InteractionManager.runAfterInteractions(() => {
      onDragStateChange(null);
      if (res.outcome === 'trash') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        onTrash(plant.plantId);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onMoveCommit(plant.plantId, res.x, res.y);
      }
    });
  }, [onDragStateChange, onTrash, onMoveCommit, plant.plantId]);

  // Pinch commit — clamp ile yeni scale'i backend'e gönder.
  // Pozisyon aynı kalır; movePlant tek endpoint hem x/y hem scale yazar.
  const onPinchEnd = useCallback((newScale: number) => {
    InteractionManager.runAfterInteractions(() => {
      const clamped = Math.max(PLANT_SCALE_MIN, Math.min(PLANT_SCALE_MAX, newScale));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onMoveCommit(plant.plantId, plant.x, plant.y, clamped);
    });
  }, [onMoveCommit, plant.plantId, plant.x, plant.y]);

  // Pickup başlangıcı (long-press doldu) — haptic + drag state başlat
  const onPickup = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDragStateChange(plant.plantId);
  }, [onDragStateChange, plant.plantId]);

  const handleTap = useCallback(() => {
    onTap(plant);
  }, [onTap, plant]);

  // ── Pan + Tap composed ────────────────────────────────────────────────
  // Pan `activateAfterLongPress(220)` ile touch-hold pickup yapar.
  // Tap edit modda da çalışır (long-press eşiğine ulaşılmazsa açılır).
  const composed = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(editMode)
      .activateAfterLongPress(220)
      .onBegin(() => {
        'worklet';
        // Arrow meter dolmaya başlar — pan henüz aktif değil, sadece görsel feedback
        meter.value = withTiming(1, { duration: 220 });
      })
      .onStart(() => {
        'worklet';
        startX.value = tx.value;
        startY.value = ty.value;
        dragScale.value = withTiming(1.18, { duration: 120 });
        runOnJS(onPickup)();
      })
      .onUpdate((e) => {
        'worklet';
        tx.value = startX.value + e.translationX;
        ty.value = startY.value + e.translationY;
      })
      .onEnd((e) => {
        'worklet';
        const r = trashRectSv.value;
        const inTrash =
          !!r &&
          e.absoluteX >= r.x && e.absoluteX <= r.x + r.w &&
          e.absoluteY >= r.y && e.absoluteY <= r.y + r.h;
        if (inTrash) {
          dragScale.value = withTiming(0, { duration: 180 });
          runOnJS(onPanEnd)({ outcome: 'trash' });
          return;
        }
        // Inline clamp — worklet boundary'sini ortadan kaldırır (modül JS
        // fonksiyonu çağrısı Android'de bazı sürümlerde silent crash atıyordu).
        const PAD = 24;
        const cx = Math.max(PAD, Math.min(canvasW - PAD, tx.value));
        const cy = Math.max(PAD, Math.min(canvasH - PAD, ty.value));
        tx.value = withTiming(cx, { duration: 140 });
        ty.value = withTiming(cy, { duration: 140 });
        // Tek bir withSpring — withSequence+withSpring çakışması native
        // tarafta intermittent crash atıyordu, sade spring daha güvenli.
        dragScale.value = withSpring(1, { damping: 12, stiffness: 180 });
        runOnJS(onPanEnd)({ outcome: 'move', x: cx, y: cy });
      })
      .onFinalize(() => {
        'worklet';
        meter.value = withTiming(0, { duration: 150 });
      });

    // Tap — view modda ve edit modda çalışır; long-press eşiğinde Pan kazanır.
    const tap = Gesture.Tap()
      .maxDuration(220)
      .onEnd((_, success) => {
        'worklet';
        if (success) runOnJS(handleTap)();
      });

    // Pinch — 2 parmakla boyut. Edit modda aktif. Pan ile Simultaneous,
    // yani tek parmakla sürüklerken bile ikinci parmakla pinch başlatılabilir.
    const pinch = Gesture.Pinch()
      .enabled(editMode)
      .onStart(() => {
        'worklet';
        startPersistedScale.value = persistedScale.value;
        liveScale.value = 1;
      })
      .onUpdate((e) => {
        'worklet';
        // Geçici liveScale güncelle — final persistedScale × liveScale
        const next = startPersistedScale.value * e.scale;
        // Worklet içinde clamp (PLANT_SCALE_MIN/MAX sabit, modül-level OK)
        const c = Math.max(PLANT_SCALE_MIN, Math.min(PLANT_SCALE_MAX, next));
        liveScale.value = c / startPersistedScale.value;
      })
      .onEnd(() => {
        'worklet';
        const final = startPersistedScale.value * liveScale.value;
        const c = Math.max(PLANT_SCALE_MIN, Math.min(PLANT_SCALE_MAX, final));
        // UI hemen yeni boyutta dursun — backend sync gelene kadar flicker yok
        persistedScale.value = c;
        liveScale.value = withSpring(1, { damping: 14, stiffness: 200 });
        runOnJS(onPinchEnd)(c);
      });

    // Pan/tap ile pinch Simultaneous — tek/iki parmak aynı anda çalışır.
    return Gesture.Simultaneous(Gesture.Race(pan, tap), pinch);
  }, [
    editMode, canvasW, canvasH,
    onPanEnd, onPickup, handleTap, onPinchEnd,
    trashRectSv, dragScale, startX, startY, tx, ty, meter,
    persistedScale, liveScale, startPersistedScale,
  ]);

  // Cleanup — component unmount olduğunda meter'i durdur
  useEffect(() => {
    return () => {
      cancelAnimation(meter);
      cancelAnimation(dragScale);
    };
  }, [meter, dragScale]);

  const containerStyle = useAnimatedStyle(() => {
    // Birleşik scale: persistedScale × liveScale (kullanıcı boyutu)
    //                × dragScale (drag/settle anim)
    //                × (1 + editPulse × 0.04) (edit modunda hafif vurgu)
    const userScale = persistedScale.value * liveScale.value;
    return {
      position: 'absolute',
      left: tx.value - size / 2,
      top: ty.value - size / 2,
      transform: [
        { scale: userScale * dragScale.value * (1 + editPulse.value * 0.04) },
      ],
    };
  });

  // editRingStyle ve meterRingStyle KALDIRILDI — artık halka render edilmiyor.
  // editPulse hafif scale feedback'i containerStyle içinde devam ediyor.

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={containerStyle}>
        {/* Edit modu sarı halo + long-press meter ring TAMAMEN KALDIRILDI
            (kullanıcı "halka oluşmasın" dedi). Edit mode feedback'i
            containerStyle içindeki editPulse hafif scale ile sağlanır. */}

        <View
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Plant render (PNG ya da SVG fallback) */}
          <PlantRenderer
            plantType={item?.plantType || ''}
            itemId={plant.itemId}
            stage={computedStage}
            status={computedStatus}
            size={size}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export const GardenPlantNode = memo(GardenPlantNodeBase);

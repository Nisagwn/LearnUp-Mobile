import { useEffect, useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet, BackHandler } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { X, Backpack } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getItemById, RARITY_TONE } from '@/constants/marketCatalog';
import { pickItemImage } from '@/constants/treeAssets';
import type { InventoryItem } from '@/services/gardenApi';

type Props = {
  visible: boolean;
  inventory: InventoryItem[];
  /** Drag ghost shared values (parmak konumu) */
  ghostX: SharedValue<number>;
  ghostY: SharedValue<number>;
  /** Aktif drag var mı? Varsa sheet görsel olarak gizlenir (mount kalır). */
  dragging: boolean;
  onClose: () => void;
  /** Long-press başlangıcı — ghost'u görünür yap. */
  onGhostStart: (params: { emoji: string; color: string; itemId: string; x: number; y: number }) => void;
  /** Long-press hareketi — ghost konumunu güncelle */
  onGhostUpdate: (x: number, y: number) => void;
  /** Long-press bitti — drop koordinatlarına ek (canvas dışındaysa iptal) */
  onGhostEnd: (params: { itemId: string; x: number; y: number }) => void;
};

const PLANTABLE_KINDS = new Set(['seed', 'flower', 'tree', 'decor']);

/**
 * Ağıl (Inventory) — slide-up bottom sheet (RN Modal değil — Garden ekran
 * ağacında yaşar). Modal kullanılmıyor çünkü drag ghost'un modal üstüne
 * binmesi mümkün değildi.
 *
 * Pan gesture içe ScrollView'lu konteyner kullanmıyor — uzun-bas + sürükle
 * conflict'i ScrollView ile çakışıyordu. Item sayısı az olduğundan grid
 * tek katmanda durur; çok dolarsa overflow scroll yerine kompakt sıralama
 * kullanılır.
 */
export function InventorySheet({
  visible, inventory, ghostX, ghostY, dragging, onClose,
  onGhostStart, onGhostUpdate, onGhostEnd,
}: Props) {
  const { colors, gradients } = useThemeColors();

  const items = useMemo(() => {
    return inventory
      .filter((i) => PLANTABLE_KINDS.has(i.kind) && i.count > 0)
      .map((i) => ({ ...i, def: getItemById(i.itemId) }))
      .filter((i) => i.def);
  }, [inventory]);

  // Slide-up animasyonu
  const translate = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
      translate.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 150 });
      translate.value = withTiming(600, { duration: 200 });
    }
  }, [visible, translate, backdropOpacity]);

  // Android back tuşu — sheet açıkken kapat (ekrandan çıkma).
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translate.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  // Drag sırasında sheet'i görsel olarak gizle (mount korunur ki gesture
  // worklet'i sağ kalsın). Touches pass-through olur, drop kanvasa düşer.
  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        dragging && { opacity: 0 },
      ]}
      pointerEvents={dragging ? 'none' : 'box-none'}
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: 'rgba(0,0,0,0.45)' },
          backdropStyle,
        ]}
      >
        <Pressable onPress={onClose} style={StyleSheet.absoluteFillObject} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '55%',
            backgroundColor: colors.bgBase,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingTop: 14,
            paddingHorizontal: 16,
            paddingBottom: 24,
          },
          sheetStyle,
        ]}
      >
        {/* Drag bar */}
        <View
          style={{
            alignSelf: 'center',
            width: 44,
            height: 4,
            borderRadius: 999,
            backgroundColor: colors.borderSoft,
            marginBottom: 12,
          }}
        />

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <View
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: gradients.streak[0],
              alignItems: 'center', justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Backpack size={20} color={colors.white} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary }}>
              Ağıl
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>
              Item'a basılı tut → bahçeye sürükle ve bırak
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: colors.bgElevated,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Item grid — wrap, ScrollView yok (drag conflict önleme) */}
        {items.length === 0 ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
              Ağıl boş.{'\n'}Marketten tohum, çiçek veya dekor al.
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 10,
              paddingBottom: 8,
            }}
          >
            {items.slice(0, 16).map((it) => (
              <InventoryDraggable
                key={it.itemId}
                item={it}
                ghostX={ghostX}
                ghostY={ghostY}
                onGhostStart={onGhostStart}
                onGhostUpdate={onGhostUpdate}
                onGhostEnd={onGhostEnd}
              />
            ))}
            {items.length > 16 ? (
              <Text style={{ width: '100%', fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
                +{items.length - 16} daha (ilk 16 gösteriliyor)
              </Text>
            ) : null}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

type DragProps = {
  item: { itemId: string; count: number; def: ReturnType<typeof getItemById> };
  ghostX: SharedValue<number>;
  ghostY: SharedValue<number>;
  onGhostStart: Props['onGhostStart'];
  onGhostUpdate: Props['onGhostUpdate'];
  onGhostEnd: Props['onGhostEnd'];
};

function InventoryDraggable({
  item, ghostX, ghostY, onGhostStart, onGhostUpdate, onGhostEnd,
}: DragProps) {
  const { colors } = useThemeColors();
  const def = item.def!;
  const tone = RARITY_TONE[def.rarity];

  // Pan + uzun-bas eşiği: 220ms yer hassasiyetli — yanlışlıkla tap'ta tetiklenmez,
  // makul bir hold sonrası sürükleme başlar. Worklet onStart/onEnd JS thread'e
  // runOnJS ile geri çağrılır; React unmount sonrası bile gesture native
  // katmanda yaşar (sheet kapansa da onEnd fires).
  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart((e) => {
      ghostX.value = e.absoluteX;
      ghostY.value = e.absoluteY;
      runOnJS(onGhostStart)({
        emoji: def.emoji,
        color: tone.fg,
        itemId: item.itemId,
        x: e.absoluteX,
        y: e.absoluteY,
      });
    })
    .onUpdate((e) => {
      ghostX.value = e.absoluteX;
      ghostY.value = e.absoluteY;
      runOnJS(onGhostUpdate)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(onGhostEnd)({
        itemId: item.itemId,
        x: e.absoluteX,
        y: e.absoluteY,
      });
    });

  const treeImg = pickItemImage(def, 'mature');

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{
          width: '22%',
          aspectRatio: 1,
          borderRadius: 14,
          backgroundColor: tone.soft,
          borderWidth: 1.5,
          borderColor: tone.fg,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {treeImg ? (
          <Image
            source={treeImg}
            style={{ width: 48, height: 48 }}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ fontSize: 30 }}>{def.emoji}</Text>
        )}
        <Text
          numberOfLines={1}
          style={{
            fontSize: 9,
            fontWeight: '800',
            color: colors.textPrimary,
            marginTop: 2,
            paddingHorizontal: 4,
            textAlign: 'center',
          }}
        >
          {def.name.length > 12 ? def.name.slice(0, 11) + '…' : def.name}
        </Text>
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: 999,
            backgroundColor: tone.fg,
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: '900', color: colors.white }}>
            ×{item.count}
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

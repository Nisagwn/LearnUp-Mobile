import { View, Text, Image, Alert, useWindowDimensions } from 'react-native';
import { Lock, Sparkles, Star } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { PressableScale } from '@/components/common/PressableScale';
import {
  RARITY_TONE,
  type MarketItem,
  type Rarity,
} from '@/constants/marketCatalog';
import { pickItemImage } from '@/constants/treeAssets';
import { canPurchaseItem } from '@/utils/garden';

function rarityToStars(rarity: Rarity): number {
  return { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }[rarity];
}

type Props = {
  item: MarketItem;
  coins: number;
  level: number;
  unlockedBadgeIds: Set<string>;
  ownedCount: number;
  onOpen: (item: MarketItem) => void;
};

/**
 * 2-sütun grid market kartı — yan yana iki kart. Genişlik ekran/2 - padding.
 * MarketHorizontalCard'a benzer ama dikey grid için boyutlandırılmış.
 */
export function MarketGridCard({
  item, coins, level, unlockedBadgeIds, ownedCount, onOpen,
}: Props) {
  const { colors } = useThemeColors();
  const { width: screenW } = useWindowDimensions();
  const tone = RARITY_TONE[item.rarity];
  const check = canPurchaseItem(item, { coins, level, unlockedBadgeIds });
  const locked = !check.ok;
  const lockReason = check.reason;
  const isNew = !locked && ownedCount === 0;
  const stars = rarityToStars(item.rarity);

  // Grid: 2 sütun, dış padding 10 + gap 10 → (screenW - 30) / 2
  const cardW = (screenW - 30) / 2;
  const cardH = 178;

  return (
    <PressableScale
      onPress={() => {
        if (locked && lockReason !== 'Yetersiz altın') {
          Alert.alert(item.name, lockReason || 'Bu item şu an alınamaz');
          return;
        }
        onOpen(item);
      }}
    >
      <View
        style={{
          width: cardW,
          height: cardH,
          borderRadius: 16,
          backgroundColor: colors.bgBase,
          borderWidth: 1.5,
          borderColor: tone.fg,
          overflow: 'hidden',
          opacity: locked && lockReason !== 'Yetersiz altın' ? 0.55 : 1,
          position: 'relative',
        }}
      >
        {/* Üst rarity şerit */}
        <View style={{ height: 4, backgroundColor: tone.fg }} />

        {/* NEW ribbon */}
        {isNew ? (
          <View
            style={{
              position: 'absolute',
              top: 10,
              right: -18,
              paddingHorizontal: 20,
              paddingVertical: 2,
              backgroundColor: tone.fg,
              transform: [{ rotate: '40deg' }],
              zIndex: 5,
            }}
            pointerEvents="none"
          >
            <Text style={{ fontSize: 8, fontWeight: '900', color: colors.white, letterSpacing: 1 }}>
              YENİ
            </Text>
          </View>
        ) : null}

        {/* Görsel alanı */}
        <View
          style={{
            height: 92,
            backgroundColor: tone.soft,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {(() => {
            const img = pickItemImage(item, 'mature');
            if (img) {
              return (
                <Image
                  source={img}
                  style={{ width: 76, height: 76 }}
                  resizeMode="contain"
                />
              );
            }
            return <Text style={{ fontSize: 50 }}>{item.emoji}</Text>;
          })()}
          {locked && lockReason !== 'Yetersiz altın' ? (
            <View
              style={{
                position: 'absolute',
                right: 6, bottom: 6,
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: colors.textPrimary,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1.5, borderColor: colors.bgBase,
              }}
            >
              <Lock size={11} color={colors.white} strokeWidth={2.4} />
            </View>
          ) : null}
        </View>

        {/* Alt bilgi */}
        <View style={{ paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, flex: 1 }}>
          {/* Yıldızlar */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 1, marginBottom: 4 }}>
            {Array.from({ length: stars }).map((_, i) => (
              <Star key={i} size={9} color={tone.fg} fill={tone.fg} strokeWidth={1.2} />
            ))}
          </View>

          {/* Ad */}
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12, fontWeight: '900', color: colors.textPrimary,
              textAlign: 'center',
            }}
          >
            {item.name}
          </Text>

          <View style={{ flex: 1 }} />

          {/* Price pill */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 3, alignSelf: 'center',
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
              backgroundColor: locked && lockReason === 'Yetersiz altın' ? colors.bgElevated : tone.fg,
              marginTop: 4,
            }}
          >
            {locked && lockReason !== 'Yetersiz altın' ? (
              <Lock size={10} color={colors.white} />
            ) : (
              <Sparkles size={10} color={colors.white} />
            )}
            <Text style={{ fontSize: 11, fontWeight: '900', color: colors.white }}>
              {item.price}
            </Text>
          </View>

          {ownedCount > 0 ? (
            <Text
              style={{
                fontSize: 9, fontWeight: '800', color: colors.success,
                textAlign: 'center', marginTop: 3,
              }}
            >
              Sahip: {ownedCount}×
            </Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

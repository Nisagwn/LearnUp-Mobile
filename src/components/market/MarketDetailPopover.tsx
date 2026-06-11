import { Modal, View, Text, Image, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Sparkles, Star } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { RARITY_TONE, type MarketItem, type Rarity } from '@/constants/marketCatalog';
import { pickItemImage } from '@/constants/treeAssets';
import { canPurchaseItem } from '@/utils/garden';
import { purchaseItem } from '@/services/gardenApi';

function rarityToStars(rarity: Rarity): number {
  return { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }[rarity];
}

type Props = {
  item: MarketItem | null;
  coins: number;
  level: number;
  unlockedBadgeIds: Set<string>;
  onClose: () => void;
};

/**
 * Market kartı tap'inde açılır — büyük emoji + ad + 1-2 cümle açıklama +
 * altın fiyatı + "Satın al" CTA. Detay sadece BURADA görünür; kartlar sade.
 */
export function MarketDetailPopover({ item, coins, level, unlockedBadgeIds, onClose }: Props) {
  const { colors, gradients } = useThemeColors();
  if (!item) return null;

  const tone = RARITY_TONE[item.rarity];
  const check = canPurchaseItem(item, { coins, level, unlockedBadgeIds });
  const canBuy = check.ok;
  const stars = rarityToStars(item.rarity);

  async function handleBuy() {
    if (!item) return;
    if (!canBuy) {
      Alert.alert(item.name, check.reason || 'Satın alınamaz');
      return;
    }
    try {
      await purchaseItem(item.id);
      onClose();
    } catch (e) {
      Alert.alert('Satın alma başarısız', e instanceof Error ? e.message : 'Hata');
    }
  }

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 28,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 320,
            borderRadius: 22,
            backgroundColor: colors.bgBase,
            overflow: 'hidden',
          }}
        >
          {/* Üst gradient başlık */}
          <LinearGradient
            colors={[tone.fg, tone.soft]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingTop: 22,
              paddingBottom: 14,
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={onClose}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: 'rgba(0,0,0,0.25)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} color={colors.white} />
            </Pressable>
            {(() => {
              const img = pickItemImage(item, 'mature');
              if (img) {
                return (
                  <Image
                    source={img}
                    style={{ width: 96, height: 96 }}
                    resizeMode="contain"
                  />
                );
              }
              return <Text style={{ fontSize: 56 }}>{item.emoji}</Text>;
            })()}
            <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
              {Array.from({ length: stars }).map((_, i) => (
                <Star key={i} size={12} color={colors.white} fill={colors.white} strokeWidth={1.2} />
              ))}
            </View>
          </LinearGradient>

          {/* Ad + açıklama */}
          <View style={{ padding: 18 }}>
            <Text
              style={{
                fontSize: 18, fontWeight: '900', color: colors.textPrimary,
                textAlign: 'center',
              }}
            >
              {item.name}
            </Text>
            <Text
              style={{
                fontSize: 12, color: colors.textSecondary,
                textAlign: 'center', marginTop: 6, lineHeight: 17,
              }}
            >
              {item.description}
            </Text>

            {/* Buy CTA */}
            <Pressable
              onPress={handleBuy}
              disabled={!canBuy}
              style={{
                marginTop: 18,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: canBuy ? tone.fg : colors.bgElevated,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Sparkles size={14} color={canBuy ? colors.white : colors.textMuted} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '900',
                  color: canBuy ? colors.white : colors.textMuted,
                  letterSpacing: 0.4,
                }}
              >
                {canBuy ? `Satın Al · ${item.price} 🪙` : check.reason || 'Alınamaz'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import { useState, useMemo } from 'react';
import { Modal, Pressable, View, Text, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  MARKET_FILTERS,
  filterMarketItems,
  type MarketFilterId,
  type MarketItem,
} from '@/constants/marketCatalog';
import { MarketGridCard } from './MarketGridCard';
import { MarketDetailPopover } from './MarketDetailPopover';
import type { InventoryItem } from '@/services/gardenApi';

type Props = {
  visible: boolean;
  coins: number;
  level: number;
  unlockedBadgeIds: Set<string>;
  inventory: InventoryItem[];
  onClose: () => void;
};

/**
 * Sade market — kategori bölümleri YOK.
 * Üstte minimal başlık + altın + kapat. Altında 4 küçük filtre çipi
 * (Tümü/Ağaç/Dekor/Özel). Altta 2-sütun grid. Tek dikey scroll.
 * Tap → MarketDetailPopover (description + buy).
 */
export function MarketSheet({
  visible, coins, level, unlockedBadgeIds, inventory, onClose,
}: Props) {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<MarketItem | null>(null);
  const [filter, setFilter] = useState<MarketFilterId>('all');

  const inventoryMap = useMemo(() => {
    const map = new Map<string, number>();
    inventory.forEach((inv) => map.set(inv.itemId, inv.count));
    return map;
  }, [inventory]);

  const items = useMemo(() => filterMarketItems(filter), [filter]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
        {/* Minimal başlık */}
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 14,
            paddingBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSoft,
          }}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '900',
              color: colors.textPrimary,
              flex: 1,
            }}
          >
            Market
          </Text>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
              backgroundColor: colors.bgElevated,
            }}
          >
            <Text style={{ fontSize: 13 }}>🪙</Text>
            <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textPrimary }}>
              {coins.toLocaleString('tr-TR')}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={{
              width: 30, height: 30, borderRadius: 15,
              backgroundColor: colors.bgElevated,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Hafif filtre çipleri — kategori bölümü değil, sadece filter pill'ler */}
        <View
          style={{
            flexDirection: 'row',
            gap: 6,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 8,
          }}
        >
          {MARKET_FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                hitSlop={4}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: isActive ? colors.textPrimary : colors.bgElevated,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: isActive ? colors.white : colors.textSecondary,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tek grid — 2 sütun, hepsi düz liste. Kategori başlığı YOK. */}
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ paddingHorizontal: 10, gap: 10 }}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 32, gap: 10 }}
          renderItem={({ item }) => (
            <MarketGridCard
              item={item}
              coins={coins}
              level={level}
              unlockedBadgeIds={unlockedBadgeIds}
              ownedCount={inventoryMap.get(item.id) ?? 0}
              onOpen={setDetail}
            />
          )}
        />
      </View>

      {/* Detay popover */}
      <MarketDetailPopover
        item={detail}
        coins={coins}
        level={level}
        unlockedBadgeIds={unlockedBadgeIds}
        onClose={() => setDetail(null)}
      />
    </Modal>
  );
}

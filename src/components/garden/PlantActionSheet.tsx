import { Modal, Pressable, View, Text } from 'react-native';
import { Trash2, X } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getItemById } from '@/constants/marketCatalog';
import { plantTooltipETA, type GardenPlant } from '@/utils/garden';

type Props = {
  visible: boolean;
  plant: GardenPlant | null;
  onRemove: () => void;
  onClose: () => void;
};

/**
 * Bitkili slot tap'inde açılır — sadece Söke / Kapat.
 * Su mekaniği kaldırıldığı için Sula/İhya butonları yok.
 */
export function PlantActionSheet({ visible, plant, onRemove, onClose }: Props) {
  const { colors } = useThemeColors();

  if (!plant) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      </Modal>
    );
  }

  const now = Date.now();
  const item = getItemById(plant.itemId);
  const tooltip = plantTooltipETA(plant, now);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.bgBase,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: 28,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 6 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderSoft }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 32, marginRight: 10 }}>{item?.emoji ?? '🌱'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: colors.textPrimary }}>
                {item?.name ?? 'Bitki'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                {tooltip}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.bgElevated,
              }}
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={{ marginTop: 18, gap: 10 }}>
            <Pressable
              onPress={onRemove}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: colors.dangerSoft,
              }}
            >
              <Trash2 size={20} color={colors.danger} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.danger }}>
                Söke (fiyatın %30&apos;u iade)
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

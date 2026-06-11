import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Pencil } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  visible: boolean;
  onDone: () => void;
};

/**
 * Edit mode aktifken ekranın altında "Bitti" CTA + üst ipucu bandı.
 */
export function EditModeOverlay({ visible, onDone }: Props) {
  const { colors, gradients } = useThemeColors();
  if (!visible) return null;

  return (
    <>
      {/* Üst ipucu bandı */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 12,
          left: 16,
          right: 16,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 14,
          backgroundColor: 'rgba(15,23,42,0.85)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          zIndex: 50,
        }}
      >
        <Pencil size={14} color={colors.white} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.white, flex: 1 }}>
          Sürükle → taşı · Çöp kutusuna at → ağıla geri
        </Text>
      </View>

      {/* Alt "Bitti" pill */}
      <View
        style={{
          position: 'absolute',
          bottom: 28,
          alignSelf: 'center',
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 50,
        }}
        pointerEvents="box-none"
      >
        <Pressable onPress={onDone}>
          <LinearGradient
            colors={[gradients.success[0], gradients.success[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: 999,
              shadowColor: colors.textPrimary,
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Check size={18} color={colors.white} strokeWidth={2.8} />
            <Text style={{ fontSize: 14, fontWeight: '900', color: colors.white, letterSpacing: 0.4 }}>
              BİTTİ
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </>
  );
}

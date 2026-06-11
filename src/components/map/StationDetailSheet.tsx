import { Modal, Pressable, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Lock, MapPin, Sparkles } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { AppLottie } from '@/components/common/AppLottie';
import { lottie } from '@/constants/lottie';
import type { Station } from '@/utils/journey';

type Props = {
  visible: boolean;
  station: Station | null;
  /** Şu anki correctAnswers — "X doğru daha" hesabı için. */
  currentCorrect: number;
  onClose: () => void;
};

function kindLabel(kind: Station['kind']): string {
  switch (kind) {
    case 'level':
      return 'Seviye Anıtı';
    case 'badge':
      return 'Rozet';
    case 'checkpoint':
    default:
      return 'Ara Durak';
  }
}

/**
 * Bottom-sheet tarzı modal. Üst yarıda durak başlık + emoji + gradient halo,
 * alt yarıda şart/durum bilgisi. Kazanılmışsa celebrate lottie üstte 80px.
 */
export function StationDetailSheet({
  visible,
  station,
  currentCorrect,
  onClose,
}: Props) {
  const { colors, gradients } = useThemeColors();

  if (!station) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable
          onPress={onClose}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        />
      </Modal>
    );
  }

  const grad = gradients[station.gradKey];
  const remaining = station.threshold - currentCorrect;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.bgBase,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: 32,
            minHeight: 320,
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.borderSoft,
              }}
            />
          </View>

          {/* Close */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                backgroundColor: colors.bgElevated,
              }}
            >
              <X color={colors.textSecondary} size={18} />
            </Pressable>
          </View>

          {/* Hero gradient */}
          <View
            style={{
              alignItems: 'center',
              marginTop: 4,
              marginBottom: 14,
            }}
          >
            <LinearGradient
              colors={grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 108,
                height: 108,
                borderRadius: 54,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: station.isUnlocked ? 1 : 0.45,
              }}
            >
              <View
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: colors.bgBase,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 46, opacity: station.isUnlocked ? 1 : 0.45 }}>
                  {station.emoji}
                </Text>
              </View>
            </LinearGradient>

            {/* Kazanım kutlama lottie — sadece açıkken üstte */}
            {station.isUnlocked && lottie.celebrate ? (
              <View
                style={{
                  position: 'absolute',
                  width: 220,
                  height: 220,
                  top: -50,
                }}
                pointerEvents="none"
              >
                <AppLottie
                  source={lottie.celebrate}
                  autoPlay
                  loop={false}
                  style={{ width: 220, height: 220 }}
                />
              </View>
            ) : null}
          </View>

          {/* Kind label pill */}
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: colors.bgSurface,
              }}
            >
              <MapPin size={12} color={grad[1]} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  color: colors.textSecondary,
                }}
              >
                {kindLabel(station.kind)}
              </Text>
            </View>
          </View>

          {/* Başlık + alt */}
          <Text
            style={{
              fontSize: 22,
              fontWeight: '900',
              color: colors.textPrimary,
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            {station.label}
          </Text>
          {station.subLabel ? (
            <Text
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: 4,
                lineHeight: 18,
              }}
            >
              {station.subLabel}
            </Text>
          ) : null}

          {/* Durum kartı */}
          <View
            style={{
              marginTop: 18,
              borderRadius: 16,
              padding: 14,
              backgroundColor: station.isUnlocked
                ? colors.successSoft
                : colors.bgSurface,
              borderWidth: 1,
              borderColor: station.isUnlocked
                ? gradients.success[1]
                : colors.borderSoft,
            }}
          >
            {station.isUnlocked ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Sparkles size={16} color={gradients.success[1]} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: gradients.success[1],
                  }}
                >
                  Bu durağa ulaştın 🎉
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Lock size={14} color={colors.textMuted} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: colors.textSecondary,
                  }}
                >
                  {station.kind === 'badge'
                    ? 'Rozet henüz kilitli — koşulu tamamla'
                    : remaining > 0
                      ? `${remaining} doğru cevap daha`
                      : 'Çok yakında'}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

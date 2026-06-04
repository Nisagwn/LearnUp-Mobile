import { View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatar, getDeterministicAvatar, type AvatarDef } from '@/constants/avatars';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  /** Seçili avatar kimliği (öncelikli). */
  avatarId?: string | null;
  /** Eski yüklenmiş fotoğraf (geriye dönük). avatarId/getAvatar geçersizse fallbackSeed önceliklidir. */
  photoURL?: string | null;
  size?: number;
  /** Parlayan halka + glow shadow. */
  ring?: boolean;
  /** Halka kalınlığı (default 4). */
  ringWidth?: number;
  /**
   * avatarId geçersizse (eski 'rocket'/'cat' vs.) bu seed'den deterministik bir
   * avatar seçilir. Genelde uid verilir → her kullanıcı stabil bir avatar görür.
   */
  fallbackSeed?: string | null;
};

/**
 * Kullanıcı avatarı. Öncelik sırası:
 *   1. avatarId → bitmoji PNG
 *   2. photoURL → eski yüklenmiş foto (geriye uyum)
 *   3. fallbackSeed → deterministik bitmoji
 *   4. seedsiz: ilk avatar
 *
 * `ring=true` ise: avatarın kendi `ringColor`'unda halka + glow shadow.
 */
export function Avatar({
  avatarId,
  photoURL,
  size = 96,
  ring = false,
  ringWidth = 4,
  fallbackSeed,
}: Props) {
  const { colors } = useThemeColors();

  const def: AvatarDef | null = getAvatar(avatarId);

  // photoURL geriye dönük destek — avatarId yoksa ve photoURL varsa onu göster.
  if (!def && photoURL) {
    return (
      <View>
        <Image
          source={{ uri: photoURL }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      </View>
    );
  }

  const resolved = def ?? getDeterministicAvatar(fallbackSeed ?? null);

  const inner = (
    <Image
      source={resolved.image}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  );

  if (!ring) return inner;

  const outerSize = size + ringWidth * 2;
  const innerHole = size;

  // Açık ton elde etmek için ringColor'a beyaz karışım: gradient iki noktası.
  const ringGradient: readonly [string, string] = [resolved.ringColor, withAlpha(resolved.ringColor, 0.5)];

  return (
    <View
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: outerSize / 2,
        shadowColor: resolved.ringColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
        elevation: 6,
      }}
    >
      <LinearGradient
        colors={ringGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: innerHole,
            height: innerHole,
            borderRadius: innerHole / 2,
            backgroundColor: colors.bgBase,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {inner}
        </View>
      </LinearGradient>
    </View>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${a}`;
  return hex;
}

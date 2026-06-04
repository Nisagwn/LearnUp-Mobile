/**
 * Merkezi tasarım token'ları — JS tarafı (style/icon prop'ları için).
 *
 * NativeWind/Tailwind class'ları global.css değişkenlerinden beslenir; ancak
 * Lucide ikon `color` prop'ları ve RN inline style'ları class kullanamaz.
 * Bu dosya o değerlerin TEK kaynağıdır ve global.css ile birebir eşleşir.
 *
 * Kullanım: `useThemeColors()` aktif moda göre `palette` döndürür.
 */

export type ColorPalette = {
  bgBase: string;
  bgSurface: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSoft: string;
  accent: string;
  accentFg: string;
  accentSoft: string;
  accentGlow: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  white: string;
};

/** Aydınlık tema — canlı/parlak. global.css :root ile eşleşir. */
export const lightPalette: ColorPalette = {
  bgBase: '#FFFFFF',
  bgSurface: '#F8FAFC',
  bgElevated: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  borderSoft: '#E2E8F0',
  accent: '#6366F1',
  accentFg: '#4F46E5',
  accentSoft: '#EEF2FF',
  accentGlow: '#818CF8',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  white: '#FFFFFF',
};

/** Karanlık tema. global.css .dark ile eşleşir. */
export const darkPalette: ColorPalette = {
  bgBase: '#0F172A',
  bgSurface: '#1E293B',
  bgElevated: '#334155',
  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  borderSoft: '#334155',
  accent: '#818CF8',
  accentFg: '#A5B4FC',
  accentSoft: '#312E81',
  accentGlow: '#A5B4FC',
  success: '#22C55E',
  successSoft: '#14532D',
  danger: '#F87171',
  dangerSoft: '#7F1D1D',
  warning: '#F59E0B',
  warningSoft: '#78350F',
  white: '#FFFFFF',
};

/**
 * Oyunlaştırılmış gradyanlar — LinearGradient `colors` prop'u için.
 * Parlak ve doygun; light/dark'ta da canlı durur (tema-bağımsız).
 */
export const gradients = {
  brand: ['#6366F1', '#8B5CF6'] as const, // indigo → mor (marka)
  xp: ['#8B5CF6', '#6366F1'] as const, // mor → indigo
  streak: ['#FB923C', '#EF4444'] as const, // turuncu → kırmızı (alev)
  streakLost: ['#FCA5A5', '#F87171'] as const,
  league: ['#FBBF24', '#F59E0B'] as const, // altın
  success: ['#34D399', '#16A34A'] as const, // canlı yeşil
  ocean: ['#22D3EE', '#3B82F6'] as const, // turkuaz → mavi
  sunset: ['#F472B6', '#FB923C'] as const, // pembe → turuncu
  grape: ['#A78BFA', '#7C3AED'] as const, // açık mor → mor
  mint: ['#6EE7B7', '#10B981'] as const,
} as const;

export type GradientKey = keyof typeof gradients;

/** Ders adına göre parlak gradyan; bilinmeyen ders deterministik bir renge düşer. */
const subjectGradients: Record<string, readonly [string, string]> = {
  matematik: gradients.ocean,
  geometri: gradients.grape,
  fizik: ['#60A5FA', '#4F46E5'],
  kimya: gradients.mint,
  biyoloji: gradients.success,
  türkçe: gradients.sunset,
  edebiyat: ['#F472B6', '#DB2777'],
  tarih: ['#FBBF24', '#D97706'],
  coğrafya: ['#34D399', '#059669'],
  ingilizce: gradients.brand,
  felsefe: gradients.grape,
  din: ['#FCD34D', '#F59E0B'],
};

const subjectFallback: readonly (readonly [string, string])[] = [
  gradients.brand,
  gradients.ocean,
  gradients.sunset,
  gradients.mint,
  gradients.grape,
  gradients.league,
];

export function getSubjectGradient(subject?: string | null): readonly [string, string] {
  if (!subject) return gradients.brand;
  const key = subject.toLocaleLowerCase('tr-TR').trim();
  if (subjectGradients[key]) return subjectGradients[key];
  // Deterministik dağılım — aynı ders hep aynı renk.
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return subjectFallback[hash % subjectFallback.length];
}

/** Gölge/elevation preset'leri — iOS shadow + Android elevation. */
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  /** Accent renkli yumuşak parıltı — oyunlaştırılmış vurgular için. */
  glow: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
} as const;

export type ShadowKey = keyof typeof shadows;

/** Tipografi ölçeği — tutarlı boyut/ağırlık/satır yüksekliği. */
export const typography = {
  display: { fontSize: 32, fontWeight: '800' as const, lineHeight: 38 },
  h1: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

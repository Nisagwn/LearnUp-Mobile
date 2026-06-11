/**
 * Merkezi tasarım token'ları — JS tarafı (style/icon prop'ları için).
 *
 * v2 — ORMAN/DOĞA TEMASI. İndigo/mor tamamen kaldırıldı; yeşil-toprak-altın
 * paleti ile bahçe oyununa tematik tutarlılık sağlandı.
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

/** Aydınlık tema — text'ler nötr slate, accent/aksiyonlar yeşil. */
export const lightPalette: ColorPalette = {
  bgBase:        '#FFFFFF',
  bgSurface:     '#F8FAFC',   // nötr soft (mint cast yok)
  bgElevated:    '#F1F5F9',   // nötr hafif
  textPrimary:   '#0F172A',   // slate-900 (okunabilirlik)
  textSecondary: '#475569',   // slate-600
  textMuted:     '#94A3B8',   // slate-400 (lime DEĞİL)
  borderSoft:    '#E2E8F0',   // nötr border
  accent:        '#16A34A',   // canlı yeşil (button/CTA)
  accentFg:      '#15803D',   // moss (link)
  accentSoft:    '#DCFCE7',   // mint chip bg
  accentGlow:    '#4ADE80',   // taze yaprak
  success:       '#22C55E',
  successSoft:   '#DCFCE7',
  danger:        '#DC2626',
  dangerSoft:    '#FEE2E2',
  warning:       '#CA8A04',   // altın güneş
  warningSoft:   '#FEF9C3',
  white:         '#FFFFFF',
};

/** Karanlık tema — gece ormanı zemin + nötr açık text. */
export const darkPalette: ColorPalette = {
  bgBase:        '#0F172A',   // slate-900 (orman gece)
  bgSurface:     '#1E293B',   // slate-800
  bgElevated:    '#334155',   // slate-700
  textPrimary:   '#F1F5F9',   // slate-100
  textSecondary: '#CBD5E1',   // slate-300
  textMuted:     '#94A3B8',   // slate-400
  borderSoft:    '#334155',
  accent:        '#4ADE80',   // parlak yeşil (button)
  accentFg:      '#86EFAC',
  accentSoft:    '#14532D',
  accentGlow:    '#4ADE80',
  success:       '#4ADE80',
  successSoft:   '#14532D',
  danger:        '#F87171',
  dangerSoft:    '#7F1D1D',
  warning:       '#FACC15',
  warningSoft:   '#713F12',
  white:         '#FFFFFF',
};

/**
 * Oyunlaştırılmış gradyanlar — LinearGradient `colors` prop'u için.
 * Orman paleti — parlak ve doygun; light/dark'ta da canlı durur.
 */
export const gradients = {
  // Ana brand (eski indigo+mor → derin orman)
  brand:      ['#16A34A', '#166534'] as const,  // canlı yeşil → derin orman
  // XP — taze büyüme
  xp:         ['#84CC16', '#65A30D'] as const,  // lime → moss
  // Streak — sonbahar alevi (alev metaforu doğa içinde devam)
  streak:     ['#F59E0B', '#B45309'] as const,  // amber → koyu turuncu
  streakLost: ['#D6D3D1', '#A8A29E'] as const,  // gri (kuru dal)
  // League — altın güneş (orman ışığı)
  league:     ['#EAB308', '#A16207'] as const,
  // Success — yaprak yeşili
  success:    ['#22C55E', '#15803D'] as const,
  // Ocean — orman gölü
  ocean:      ['#06B6D4', '#0E7490'] as const,
  // Sunset — toprak portakal (pembe yerine)
  sunset:     ['#FB923C', '#C2410C'] as const,
  // Grape eski mor → koyu moss
  grape:      ['#84CC16', '#4D7C0F'] as const,
  // Mint — taze çayır
  mint:       ['#86EFAC', '#34D399'] as const,
  // Yeni token'lar
  forest:     ['#15803D', '#14532D'] as const,  // orman tonları
  cedar:      ['#92400E', '#7C2D12'] as const,  // ahşap kahve
  sky:        ['#7DD3FC', '#0EA5E9'] as const,  // açık gökyüzü
  moss:       ['#4D7C0F', '#365314'] as const,  // yosun
  earth:      ['#A16207', '#713F12'] as const,  // toprak altın
} as const;

export type GradientKey = keyof typeof gradients;

/**
 * Ders adına göre doğa paletli gradyan; bilinmeyen ders deterministik bir renge düşer.
 * Hiçbir mor/indigo yok — tüm dersler doğa içinde bir konum bulur.
 */
const subjectGradients: Record<string, readonly [string, string]> = {
  matematik:  gradients.ocean,    // matematik = derin göl
  geometri:   gradients.sky,      // geometri = gökyüzü
  fizik:      ['#0EA5E9', '#0369A1'],  // fizik = derin mavi
  kimya:      gradients.mint,     // kimya = taze mint
  biyoloji:   gradients.success,  // biyoloji = yaprak yeşili
  türkçe:     gradients.sunset,   // türkçe = toprak portakal
  edebiyat:   gradients.cedar,    // edebiyat = ahşap kahve
  tarih:      gradients.earth,    // tarih = eski toprak altın
  coğrafya:   gradients.forest,   // coğrafya = orman
  ingilizce:  gradients.moss,     // ingilizce = yosun
  felsefe:    ['#65A30D', '#3F6212'],  // felsefe = derin moss
  din:        gradients.league,   // din = altın
};

const subjectFallback: readonly (readonly [string, string])[] = [
  gradients.brand,
  gradients.ocean,
  gradients.sunset,
  gradients.mint,
  gradients.moss,
  gradients.league,
  gradients.cedar,
  gradients.earth,
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
    shadowColor: '#14532D',  // orman gölgesi
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#14532D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  lg: {
    shadowColor: '#14532D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  /** Accent renkli yumuşak parıltı — oyunlaştırılmış vurgular için. */
  glow: {
    shadowColor: '#16A34A',  // yeşil glow (eski indigo)
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

export type ShadowKey = keyof typeof shadows;

/** Tipografi ölçeği — tutarlı boyut/ağırlık/satır yüksekliği. */
export const typography = {
  display:    { fontSize: 32, fontWeight: '800' as const, lineHeight: 38 },
  h1:         { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  h2:         { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  h3:         { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body:       { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 21 },
  caption:    { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  tiny:       { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

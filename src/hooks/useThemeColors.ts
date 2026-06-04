import { useColorScheme } from 'nativewind';
import {
  lightPalette,
  darkPalette,
  gradients,
  shadows,
  type ColorPalette,
} from '@/constants/theme';

export type ThemeColors = {
  colors: ColorPalette;
  isDark: boolean;
  gradients: typeof gradients;
  shadows: typeof shadows;
};

/**
 * Aktif tema moduna göre (light/dark — 'system' nativewind tarafından çözülür)
 * JS renk paletini döndürür. İkon ve inline style prop'ları bunu kullanır,
 * hardcoded hex yerine.
 *
 * Tek doğruluk kaynağı ThemeContext/nativewind colorScheme'tir — yeni context yok.
 */
export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return {
    colors: isDark ? darkPalette : lightPalette,
    isDark,
    gradients,
    shadows,
  };
}

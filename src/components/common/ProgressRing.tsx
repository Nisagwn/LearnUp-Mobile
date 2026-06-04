import type { ReactNode } from 'react';
import { CircularProgressBase } from 'react-native-circular-progress-indicator';
import { useThemeColors } from '@/hooks/useThemeColors';

type Props = {
  /** 0..100 ilerleme yüzdesi. */
  progress: number;
  radius?: number;
  strokeWidth?: number;
  /** Halka rengi (varsayılan accent). İkincil renk ile gradyan oluşur. */
  color?: string;
  colorSecondary?: string;
  trackColor?: string;
  /** Halkanın ortasına yerleşecek içerik (seviye, %, ikon...). */
  children?: ReactNode;
  duration?: number;
};

/**
 * Animasyonlu dairesel ilerleme halkası (XP/seviye/mastery göstergeleri).
 * `react-native-circular-progress-indicator` üzerine tema-uyumlu sarmalayıcı.
 */
export function ProgressRing({
  progress,
  radius = 44,
  strokeWidth = 9,
  color,
  colorSecondary,
  trackColor,
  children,
  duration = 900,
}: Props) {
  const { colors } = useThemeColors();
  const active = color ?? colors.accent;
  const secondary = colorSecondary ?? colors.accentGlow;
  const track = trackColor ?? colors.bgElevated;

  return (
    <CircularProgressBase
      value={Math.max(0, Math.min(100, progress))}
      radius={radius}
      maxValue={100}
      activeStrokeWidth={strokeWidth}
      inActiveStrokeWidth={strokeWidth}
      activeStrokeColor={active}
      activeStrokeSecondaryColor={secondary}
      inActiveStrokeColor={track}
      duration={duration}
    >
      {children}
    </CircularProgressBase>
  );
}

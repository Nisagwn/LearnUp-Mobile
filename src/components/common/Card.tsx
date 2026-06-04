import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { PressableScale } from './PressableScale';
import { shadows, type ShadowKey } from '@/constants/theme';

export type CardVariant = 'flat' | 'elevated' | 'gradient' | 'glow';

type CardProps = {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
  variant?: CardVariant;
  /** variant="gradient" için renkler. */
  gradientColors?: readonly [string, string, ...string[]];
  /** Gölge preset'i (elevated/glow varyantlarında otomatik). */
  shadow?: ShadowKey;
  haptic?: boolean;
};

const BASE = 'rounded-2xl p-5';

/**
 * Çok amaçlı kart.
 * - flat: mevcut sade görünüm (border + surface)
 * - elevated: yumuşak gölge ile derinlik
 * - gradient: parlak gradyan zemin (içerik beyaz olmalı)
 * - glow: accent renkli parıltı (oyunlaştırılmış vurgu)
 */
export function Card({
  children,
  className = '',
  onPress,
  variant = 'flat',
  gradientColors,
  shadow,
  haptic = true,
}: CardProps) {
  const shadowStyle =
    shadows[shadow ?? (variant === 'glow' ? 'glow' : variant === 'elevated' ? 'md' : 'none')];

  const surfaceClass =
    variant === 'gradient'
      ? BASE
      : `${BASE} border border-border-soft bg-bg-surface`;

  const inner =
    variant === 'gradient' ? (
      <LinearGradient
        colors={gradientColors ?? (['#6366F1', '#8B5CF6'] as const)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 16 }}
        className={`${BASE} overflow-hidden ${className}`}
      >
        {children}
      </LinearGradient>
    ) : (
      <View className={`${surfaceClass} ${className}`}>{children}</View>
    );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} haptic={haptic} style={shadowStyle}>
        {inner}
      </PressableScale>
    );
  }

  return <View style={shadowStyle}>{inner}</View>;
}

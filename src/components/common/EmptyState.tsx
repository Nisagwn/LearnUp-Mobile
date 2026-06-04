import { View, Text } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { AppLottie } from './AppLottie';
import { useThemeColors } from '@/hooks/useThemeColors';

type EmptyStateProps = {
  /** Lottie animasyonu (öncelikli). require('...json') / lottie.empty gibi. */
  lottieSource?: number | object | null;
  /** Lottie yoksa gösterilecek ikon. */
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  /** Buton/aksiyon slotu. */
  action?: ReactNode;
  className?: string;
  lottieSize?: number;
};

/**
 * Boş durum — varsa Lottie animasyonu, yoksa gradyan/glow ikon dairesi.
 * İsteğe bağlı CTA aksiyonu alır.
 */
export function EmptyState({
  lottieSource,
  icon: Icon,
  title,
  subtitle,
  action,
  className = '',
  lottieSize = 140,
}: EmptyStateProps) {
  const { colors } = useThemeColors();

  return (
    <View className={`items-center justify-center px-6 py-10 ${className}`}>
      {lottieSource ? (
        <AppLottie
          source={lottieSource}
          loop
          autoPlay
          style={{ width: lottieSize, height: lottieSize }}
        />
      ) : Icon ? (
        <View className="h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
          <Icon color={colors.accent} size={28} />
        </View>
      ) : null}
      <Text className="mt-3 text-base font-semibold text-text-primary">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 text-center text-sm text-text-muted">{subtitle}</Text>
      ) : null}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}

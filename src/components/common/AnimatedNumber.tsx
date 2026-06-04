import { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';

type Props = TextProps & {
  /** Hedef sayısal değer. */
  value: number;
  /** Animasyon süresi (ms). Varsayılan 700. */
  duration?: number;
  /** Ondalık basamak sayısı. Varsayılan 0. */
  decimals?: number;
  /** Başına eklenecek metin (örn. "%"). */
  prefix?: string;
  /** Sonuna eklenecek metin. */
  suffix?: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Değer değiştikçe eski değerden yenisine yumuşakça "sayan" metin.
 * Stat tile'larda ve XP göstergelerinde oyunlaştırılmış his için kullanılır.
 */
export function AnimatedNumber({
  value,
  duration = 700,
  decimals = 0,
  prefix = '',
  suffix = '',
  ...textProps
}: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    startRef.current = 0;

    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  const text =
    prefix + display.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + suffix;

  return <Text {...textProps}>{text}</Text>;
}

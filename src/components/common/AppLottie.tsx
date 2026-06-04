import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import LottieView, { type LottieViewProps } from 'lottie-react-native';

export type AppLottieRef = {
  play: (start?: number, end?: number) => void;
  reset: () => void;
  pause: () => void;
};

type ColorFilter = { keypath: string; color: string };

type Props = {
  /** require('...json') ya da { uri } — yoksa fallback render edilir. */
  source?: number | { uri: string } | object | null;
  autoPlay?: boolean;
  loop?: boolean;
  /** 0..1 — verilirse animasyon bu kareye sürülür (progress-driven). */
  progress?: number;
  speed?: number;
  colorFilters?: ColorFilter[];
  style?: StyleProp<ViewStyle>;
  onAnimationFinish?: (cancelled?: boolean) => void;
  /** source yokken gösterilecek yedek (ikon vb.). */
  fallback?: ReactNode;
};

/**
 * `lottie-react-native` üzerine ince, dayanıklı sarmalayıcı.
 *
 * - Imperative `play(start,end)/reset/pause` ile segment kontrolü.
 * - `progress` prop'u ile kareye-kadar sürme (etkileşimli/scroll-bağlı animasyon).
 * - `colorFilters` ile aktif tema paletine boyama.
 * - `source` yoksa `fallback` render eder (asset eklenene kadar uygulama kırılmaz).
 */
export const AppLottie = forwardRef<AppLottieRef, Props>(function AppLottie(
  {
    source,
    autoPlay = true,
    loop = true,
    progress,
    speed = 1,
    colorFilters,
    style,
    onAnimationFinish,
    fallback = null,
  },
  ref,
) {
  const lottieRef = useRef<LottieView>(null);

  useImperativeHandle(ref, () => ({
    play: (start, end) => lottieRef.current?.play(start as number, end as number),
    reset: () => lottieRef.current?.reset(),
    pause: () => lottieRef.current?.pause(),
  }));

  if (!source) {
    return <View style={style}>{fallback}</View>;
  }

  return (
    <LottieView
      ref={lottieRef}
      source={source as LottieViewProps['source']}
      autoPlay={progress === undefined ? autoPlay : false}
      loop={loop}
      progress={progress}
      speed={speed}
      colorFilters={colorFilters}
      onAnimationFinish={onAnimationFinish}
      style={style}
    />
  );
});

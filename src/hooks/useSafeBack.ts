import { useRouter } from 'expo-router';
import { useCallback } from 'react';

export function useSafeBack(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback as never);
    }
  }, [router, fallback]);
}

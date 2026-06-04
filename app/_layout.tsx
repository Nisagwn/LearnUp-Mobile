import { useEffect, useRef } from 'react';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { UserStatsProvider } from '@/contexts/UserStatsContext';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { addNotificationResponseListener } from '@/services/pushService';
import 'react-native-reanimated';
import '../global.css';

export default function RootLayout() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const pendingDeepLink = useRef<string | null>(null);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    let unsub: (() => void) | null = null;
    addNotificationResponseListener((data) => {
      const deepLink = (data as { deepLink?: string })?.deepLink;
      if (!deepLink) return;
      if (navState?.key) {
        try {
          router.push(deepLink as any);
        } catch (err) {
          console.warn('Deep link açılamadı:', err);
        }
      } else {
        pendingDeepLink.current = deepLink;
      }
    }).then((u) => {
      unsub = u;
    });
    return () => {
      if (unsub) unsub();
    };
  }, [router, navState?.key]);

  useEffect(() => {
    if (navState?.key && pendingDeepLink.current) {
      const link = pendingDeepLink.current;
      pendingDeepLink.current = null;
      try {
        router.push(link as any);
      } catch (err) {
        console.warn('Deep link açılamadı:', err);
      }
    }
  }, [navState?.key, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <UserStatsProvider>
            <OfflineBanner />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' },
              }}
            />
            <StatusBar style={isDark ? 'light' : 'dark'} />
          </UserStatsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

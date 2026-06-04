import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = '@settings/theme';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  setMode: () => {},
  ready: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        const next: ThemeMode = saved === 'light' || saved === 'dark' ? saved : 'system';
        colorScheme.set(next);
        setModeState(next);
      })
      .catch(() => colorScheme.set('system'))
      .finally(() => setReady(true));
  }, []);

  const setMode = (next: ThemeMode) => {
    colorScheme.set(next);
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ mode, setMode, ready }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

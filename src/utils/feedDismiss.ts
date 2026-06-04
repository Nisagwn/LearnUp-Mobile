import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TTL_MS = 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'learn_feed_dismissed';

type Entry = { id: string; expiresAt: number };

function storageKey(userId: string | null): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : `${STORAGE_PREFIX}:anon`;
}

async function readEntries(userId: string | null): Promise<Entry[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is Entry => !!e && typeof e.id === 'string' && typeof e.expiresAt === 'number');
  } catch {
    return [];
  }
}

async function writeEntries(userId: string | null, entries: Entry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(entries));
  } catch {
    // sessizce yut — kalıcılık kritik değil
  }
}

/**
 * Smart Feed dismiss kalıcılığı. AsyncStorage'da userId başına liste tutar;
 * her giriş 24sa sonra geçerliliğini yitirir. Aktif dismissed ID'leri döner.
 */
export function useFeedDismiss(userId: string | null) {
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await readEntries(userId);
      const now = Date.now();
      const valid = entries.filter((e) => e.expiresAt > now);
      // bayatlamış girişleri AsyncStorage'dan da temizle
      if (valid.length !== entries.length) {
        await writeEntries(userId, valid);
      }
      if (alive) {
        setActiveIds(valid.map((e) => e.id));
        setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const dismiss = useCallback(
    (id: string) => {
      setActiveIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        const expiresAt = Date.now() + TTL_MS;
        readEntries(userId).then((entries) => {
          const merged = entries.filter((e) => e.id !== id);
          merged.push({ id, expiresAt });
          writeEntries(userId, merged);
        });
        return next;
      });
    },
    [userId],
  );

  const reset = useCallback(async () => {
    await writeEntries(userId, []);
    setActiveIds([]);
  }, [userId]);

  return { activeIds, dismiss, reset, loaded };
}

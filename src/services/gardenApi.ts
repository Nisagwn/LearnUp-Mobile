import {
  collection,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { BACKEND_BASE } from '@/constants/config';
import { legacyRowColToXY, type GardenPlant } from '@/utils/garden';

async function postJson<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${BACKEND_BASE.replace(/\/$/, '')}/${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* sessiz */
  }
  const payload = { userId: auth.currentUser?.uid, ...body };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `İstek başarısız (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ============================
// Backend mutasyonları
// ============================

export interface PurchaseResult {
  success: boolean;
  coins: number;
  itemId: string;
  newCount: number;
}

export const purchaseItem = (itemId: string) =>
  postJson<PurchaseResult>('purchaseGardenItem', { itemId });

export interface PlantSeedResult {
  success: boolean;
  plantId: string;
}

/** v2: x, y koordinatları (canvas px). */
export const plantSeed = (params: {
  itemId: string;
  x: number;
  y: number;
}) => postJson<PlantSeedResult>('plantSeed', params);

/** v2: bitkiyi yeni konuma taşı (edit mode). Opsiyonel scale ile pinch
 * boyut güncellemesi de aynı endpoint'ten gider — backend default 1.0 alır
 * ve [PLANT_SCALE_MIN, PLANT_SCALE_MAX] aralığında clamp eder. */
export const movePlant = (params: {
  plantId: string;
  x: number;
  y: number;
  scale?: number;
}) => postJson<{ success: boolean }>('movePlant', params);

export interface RemovePlantResult {
  success: boolean;
  /** Envantere geri eklenen itemId; legacy item ise null. */
  returnedItemId: string | null;
  /** Envanterdeki yeni count. */
  newCount?: number;
}

export const removePlant = (plantId: string) =>
  postJson<RemovePlantResult>('removePlant', { plantId });

// ============================
// Real-time listeners
// ============================

export type InventoryItem = {
  itemId: string;
  kind: string;
  count: number;
};

/** users/{uid}/inventory real-time stream. */
export function subscribeInventory(
  uid: string,
  callback: (items: InventoryItem[]) => void,
): Unsubscribe {
  const ref = collection(db, 'users', uid, 'inventory');
  return onSnapshot(ref, (snap) => {
    const items: InventoryItem[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as { itemId?: string; kind?: string; count?: number };
      items.push({
        itemId: data.itemId ?? doc.id,
        kind: data.kind ?? 'unknown',
        count: data.count ?? 0,
      });
    });
    callback(items);
  });
}

/** users/{uid}/garden real-time stream. v2: x,y'a normalize, legacy row/col migrate. */
export function subscribeGardenPlants(
  uid: string,
  callback: (plants: GardenPlant[]) => void,
): Unsubscribe {
  const ref = collection(db, 'users', uid, 'garden');
  const q = query(ref, orderBy('plantedAt', 'asc'));
  return onSnapshot(q, (snap) => {
    const plants: GardenPlant[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as Partial<GardenPlant> & {
        plantedAt?: { toMillis?: () => number } | number;
        lastWateredAt?: { toMillis?: () => number } | number;
        row?: number;
        col?: number;
      };
      const toMs = (v: unknown): number => {
        if (typeof v === 'number') return v;
        if (v && typeof (v as { toMillis?: () => number }).toMillis === 'function') {
          try {
            return (v as { toMillis: () => number }).toMillis();
          } catch {
            return 0;
          }
        }
        return 0;
      };

      // x/y yoksa legacy row/col'dan hesapla
      let x = data.x;
      let y = data.y;
      if (x == null || y == null) {
        const legacy = legacyRowColToXY(data.row ?? 0, data.col ?? 0);
        x = legacy.x;
        y = legacy.y;
      }

      plants.push({
        plantId: data.plantId ?? doc.id,
        itemId: data.itemId ?? '',
        x,
        y,
        stage: (data.stage ?? 'seed') as GardenPlant['stage'],
        plantedAt: toMs(data.plantedAt),
        lastWateredAt: toMs(data.lastWateredAt),
        status: (data.status ?? 'healthy') as GardenPlant['status'],
        scale: typeof data.scale === 'number' ? data.scale : 1,
      });
    });
    callback(plants);
  });
}

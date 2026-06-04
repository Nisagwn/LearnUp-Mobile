/**
 * Tüm client-side environment değerleri burada toplanır.
 * Her sabit `EXPO_PUBLIC_*` env değişkeninden okunur. Değer yoksa runtime'da
 * boş string döner — Firebase init bunu yakalar ve net bir hata atar.
 *
 * Yeni geliştirici: `.env.example`'i `.env`'e kopyala, değerleri Firebase
 * Console'dan al. Sonra Metro'yu temiz başlat: `npx expo start -c`.
 *
 * Üretim önerisi: bu dosyada **sabit hex/key değeri tutma** (GitHub Secret
 * Scanning false-positive üretiyor) — env zorunlu.
 */

function req(name: string, value: string | undefined): string {
  if (!value) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`[config] Missing env var: ${name}. .env dosyasını kontrol et.`);
    }
    return '';
  }
  return value;
}

export const FIREBASE_CONFIG = {
  apiKey: req('EXPO_PUBLIC_FIREBASE_API_KEY', process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: req('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: req('EXPO_PUBLIC_FIREBASE_PROJECT_ID', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: req(
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  ),
  messagingSenderId: req(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  ),
  appId: req('EXPO_PUBLIC_FIREBASE_APP_ID', process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
  measurementId: req(
    'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID',
    process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  ),
} as const;

export const FIREBASE_PROJECT_ID = FIREBASE_CONFIG.projectId;

export const FUNCTIONS_REGION =
  process.env.EXPO_PUBLIC_FUNCTIONS_REGION ?? 'us-central1';

export const BACKEND_BASE = (
  process.env.EXPO_PUBLIC_BACKEND_BASE_URL ??
  (FIREBASE_PROJECT_ID
    ? `https://${FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net`
    : '')
).replace(/\/$/, '');

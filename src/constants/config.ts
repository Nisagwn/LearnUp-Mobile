/**
 * Tüm client-side environment değerleri burada toplanır.
 * Her sabit `EXPO_PUBLIC_*` env değişkeninden okunur, fallback varsayılan değer.
 *
 * Üretim önerisi: `.env` doldur, yeniden Metro başlat (process.env değerleri
 * bundle'a build zamanında gömülür).
 */

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyD6tEe_NdbNIuvUD9hh5eTjtw1pGdAfVFs',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'learnup-3cdb7.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'learnup-3cdb7',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'learnup-3cdb7.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '596521797129',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:596521797129:web:802005a59ecf309f3e9ad8',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? 'G-ZXFTN6MP5E',
} as const;

export const FIREBASE_PROJECT_ID = FIREBASE_CONFIG.projectId;

export const FUNCTIONS_REGION =
  process.env.EXPO_PUBLIC_FUNCTIONS_REGION ?? 'us-central1';

export const BACKEND_BASE = (
  process.env.EXPO_PUBLIC_BACKEND_BASE_URL ??
  `https://${FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net`
).replace(/\/$/, '');

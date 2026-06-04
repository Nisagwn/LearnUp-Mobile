import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  // @ts-expect-error getReactNativePersistence runtime export missing from public types
  getReactNativePersistence,
  getAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG, FUNCTIONS_REGION } from '@/constants/config';

const existingApps = getApps();
const isNewApp = existingApps.length === 0;
const app = isNewApp ? initializeApp(FIREBASE_CONFIG) : existingApps[0]!;

export const auth = isNewApp
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db = getFirestore(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);
export const storage = getStorage(app);

export { app };

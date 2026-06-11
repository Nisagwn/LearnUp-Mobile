import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { collection, deleteDoc, doc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { BACKEND_BASE } from '@/constants/config';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';

async function loadNotificationsModule() {
  return import('expo-notifications');
}

if (!isExpoGo) {
  loadNotificationsModule()
    .then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    })
    .catch(() => {});
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) {
    console.log('Push: Expo Go ortamı — development build gerek');
    return null;
  }
  if (!Device.isDevice) {
    console.log('Push: simulator/web — token alınmaz');
    return null;
  }

  const Notifications = await loadNotificationsModule();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Push: izin verilmedi');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Genel',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#86EFAC',
    });
  }

  // projectId — bare/standalone build'lerde otomatik çözülemeyebilir; açıkça geçir.
  const projectId =
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
    ((Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId) ??
    'bceed329-0a6e-4270-9408-9745d7e35a55';

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    const uid = auth.currentUser?.uid;
    if (uid && token) {
      const tokenHash = token.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
      await setDoc(
        doc(db, 'users', uid, 'devices', tokenHash),
        {
          expoPushToken: token,
          platform: Platform.OS,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
    return token;
  } catch (err) {
    const msg = (err as Error).message || '';
    // TEŞHİS: release build JS log'u bastırdığı için hatayı Firestore'a yaz (geçici).
    const uidDbg = auth.currentUser?.uid;
    if (uidDbg) {
      void setDoc(
        doc(db, 'users', uidDbg, 'devices', '_debug'),
        { lastError: msg, projectId, at: serverTimestamp() },
        { merge: true },
      ).catch(() => {});
    }
    // FCM yapılandırılmamış (google-services.json yok / native Firebase init edilmemiş):
    // beklenen durum — arka plan push kapalı ama in-app bildirimler çalışmaya devam eder.
    // Korkutucu bir hata yerine net, beklenen bir bilgi mesajı bas.
    if (/FirebaseApp is not initialized|fcm-credentials|firebase|fcm/i.test(msg)) {
      console.log(
        '[push] FCM yapılandırılmamış — arka plan push devre dışı. ' +
          'In-app bildirimler (zil) çalışıyor. Etkinleştirmek için: google-services.json + ' +
          'expo-notifications plugin + yeni dev build.',
      );
    } else {
      console.warn('[push] Token alınamadı:', msg);
    }
    return null;
  }
}

/**
 * Bildirim tercihini ayarlar. Açık → token kaydı yapılır; kapalı → kullanıcının
 * tüm cihaz token'ları silinir (artık push gönderilmez). `users/{uid}.notificationsEnabled`
 * bayrağı her durumda yazılır (gönderim tarafında kontrol için).
 */
export async function setPushEnabled(enabled: boolean): Promise<string | null> {
  const uid = auth.currentUser?.uid;
  if (uid) {
    await setDoc(doc(db, 'users', uid), { notificationsEnabled: enabled }, { merge: true });
  }
  if (enabled) {
    return registerForPushNotifications();
  }
  if (uid) {
    const snap = await getDocs(collection(db, 'users', uid, 'devices'));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
  return null;
}

export async function addNotificationResponseListener(
  handler: (data: Record<string, unknown>) => void,
): Promise<() => void> {
  if (isExpoGo) return () => {};
  const Notifications = await loadNotificationsModule();
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(response.notification.request.content.data ?? {});
  });
  return () => sub.remove();
}

const TEST_PUSH_URL = `${BACKEND_BASE}/sendTestPush`;

/**
 * Mevcut kullanıcıya test bildirimi gönderir. Settings ekranında debug için.
 */
export async function sendTestPush(): Promise<{ sent: number }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Oturum bulunamadı');
  const token = await user.getIdToken().catch(() => null);
  const res = await fetch(TEST_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ userId: user.uid }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `İstek başarısız (${res.status})`);
  }
  const data = (await res.json()) as { sent?: number };
  return { sent: typeof data.sent === 'number' ? data.sent : 0 };
}

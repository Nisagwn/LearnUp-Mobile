import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db, storage } from '@/services/firebase';

export type PickSource = 'camera' | 'library';

export async function pickAndUploadAvatar(source: PickSource = 'library'): Promise<string | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Önce giriş yapmalısın');

  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') throw new Error('Kamera izni verilmedi');
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new Error('Galeri izni verilmedi');
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];

  let blob: Blob;
  try {
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error(`Görsel okunamadı (HTTP ${response.status})`);
    }
    blob = await response.blob();
  } catch (err) {
    throw new Error(`Görsel hazırlanamadı: ${(err as Error).message}`);
  }

  const mimeType = asset.mimeType ?? 'image/jpeg';
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const storageRef = ref(storage, `avatars/${uid}.${ext}`);

  try {
    await uploadBytes(storageRef, blob, { contentType: mimeType });
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    const msg = (err as Error).message;
    console.error('uploadBytes failed:', code, msg);
    if (code === 'storage/unauthorized') {
      throw new Error('Yetki yok — Firebase Storage kurallarını kontrol et');
    }
    if (code === 'storage/quota-exceeded') {
      throw new Error('Depolama kotası doldu');
    }
    throw new Error(`Yükleme başarısız: ${msg}`);
  }

  const url = await getDownloadURL(storageRef);

  await updateDoc(doc(db, 'users', uid), { photoURL: url });
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL: url }).catch(() => {});
  }
  return url;
}

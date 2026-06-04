/**
 * Haptik geri bildirim yardımcısı — `expo-haptics` üzerine ince sarmalayıcı.
 * Web ve desteklemeyen platformlarda sessizce no-op olur (asla hata fırlatmaz).
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Hafif dokunuş — buton/kart basışları. */
export function tapLight() {
  if (!supported) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Orta dokunuş — belirgin etkileşimler (seçim onayı). */
export function tapMedium() {
  if (!supported) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Başarı bildirimi — kutlama, kazanım, doğru cevap. */
export function success() {
  if (!supported) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Uyarı bildirimi — hata, yanlış cevap, oyun bitti. */
export function warning() {
  if (!supported) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Seçim değişimi — segment/sekme/avatar seçimi. */
export function selection() {
  if (!supported) return;
  Haptics.selectionAsync().catch(() => {});
}

export const haptics = { tapLight, tapMedium, success, warning, selection };
export default haptics;

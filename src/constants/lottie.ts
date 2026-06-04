/**
 * Lottie animasyon kayıt defteri — tüm .json varlıkları tek noktadan.
 * Varlıklar LottieFiles'ın ücretsiz kütüphanesinden alınmıştır.
 *
 * Kullanım: `<AppLottie source={lottie.celebrate} ... />`
 */
export const lottie = {
  /** Konfeti topları — level-up, görev tamamlama, oyun kazanımı. */
  celebrate: require('../../assets/lottie/celebrate.json'),
  /** Kupa — seviye atlama / büyük başarı. */
  trophy: require('../../assets/lottie/trophy.json'),
  /** Onay tiki — kayıt/kaydetme başarısı. */
  success: require('../../assets/lottie/success.json'),
  /** Öğrenen karakter — giriş/kayıt hero & onboarding maskotu. */
  learning: require('../../assets/lottie/learning.json'),
  /** Kağıt uçak — gönderim / hafif boş durum. */
  paperplane: require('../../assets/lottie/paperplane.json'),
  /** Yükleniyor spinner. */
  loading: require('../../assets/lottie/loading.json'),
  /** Boş durum — sonuç yok / arama boş. */
  empty: require('../../assets/lottie/empty.json'),
  /** Doğru cevap — yeşil onay tiki (tek seferlik). */
  correct: require('../../assets/lottie/correct.json'),
  /** Yanlış cevap — kırmızı X işareti (tek seferlik). */
  wrong: require('../../assets/lottie/wrong.json'),
  /** AI soru üretimi — sparkle yükleme döngüsü. */
  aiMagic: require('../../assets/lottie/ai_magic.json'),
  /** Streak alevi — yanan alev döngüsü. */
  fire: require('../../assets/lottie/fire.json'),
} as const;

export type LottieName = keyof typeof lottie;

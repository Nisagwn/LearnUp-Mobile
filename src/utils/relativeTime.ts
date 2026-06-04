/**
 * Türkçe relatif zaman formatı: "az önce", "5 dk önce", "2 saat önce", "dün",
 * "3 gün önce", "4 hafta önce", "5 ay önce". Üç haftadan ileri "X hafta",
 * sekiz haftadan ileri "X ay", 12 aydan ileri "X yıl" görür.
 */
export function formatRelativeTime(tsMs: number, now: number = Date.now()): string {
  if (!tsMs || tsMs <= 0) return '';
  const diffMs = now - tsMs;
  if (diffMs < 0) return 'az sonra';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'az önce';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'dün';
  if (day < 7) return `${day} gün önce`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week} hafta önce`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} ay önce`;
  const year = Math.floor(day / 365);
  return `${year} yıl önce`;
}

/**
 * "3 gün kaldı" / "5 saat kaldı" / "Süresi geçti" — gelecek tarih için.
 */
export function formatTimeUntil(targetMs: number, now: number = Date.now()): string {
  if (!targetMs || targetMs <= 0) return '';
  const diffMs = targetMs - now;
  if (diffMs <= 0) return 'Süresi geçti';
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk kaldı`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat kaldı`;
  const day = Math.floor(hr / 24);
  return `${day} gün kaldı`;
}

/**
 * 12 hazır bitmoji-tarzı avatar (DiceBear avataaars stilinden, offline PNG bundle).
 * Dağılım: 6 erkek (kısa saç) + 6 kız (uzun saç).
 * Firestore'da `avatarId` olarak saklanır; her id kalıcı bir görsele bağlıdır.
 *
 * Eski (Lucide ikon + gradient) avatar id'leri ('rocket', 'cat', ...) artık
 * geçerli değil; getAvatar() null döner → Avatar bileşeni `fallbackSeed` ile
 * deterministik bir bitmoji seçer ve kullanıcıyı "Avatarını seç"e davet eder.
 */
export type AvatarGender = 'male' | 'female';

export type AvatarDef = {
  id: string;
  /** RN Image source — require(...). */
  image: number;
  label: string;
  gender: AvatarGender;
  /** Parlayan halka ve glow shadow rengi (avatar arka planıyla uyumlu). */
  ringColor: string;
};

export const AVATARS: AvatarDef[] = [
  // ── Erkek (6) ─────────────────────────────────────────────────────────────
  { id: 'axel', image: require('../../assets/avatars/axel.png'), label: 'Axel', gender: 'male',   ringColor: '#60A5FA' },
  { id: 'kai',  image: require('../../assets/avatars/kai.png'),  label: 'Kai',  gender: 'male',   ringColor: '#A78BFA' },
  { id: 'zeno', image: require('../../assets/avatars/zeno.png'), label: 'Zeno', gender: 'male',   ringColor: '#818CF8' },
  { id: 'theo', image: require('../../assets/avatars/theo.png'), label: 'Theo', gender: 'male',   ringColor: '#FBBF24' },
  { id: 'omar', image: require('../../assets/avatars/omar.png'), label: 'Omar', gender: 'male',   ringColor: '#8B5CF6' },
  { id: 'dax',  image: require('../../assets/avatars/dax.png'),  label: 'Dax',  gender: 'male',   ringColor: '#F97316' },
  // ── Kız (6) ───────────────────────────────────────────────────────────────
  { id: 'luna', image: require('../../assets/avatars/luna.png'), label: 'Luna', gender: 'female', ringColor: '#F472B6' },
  { id: 'mira', image: require('../../assets/avatars/mira.png'), label: 'Mira', gender: 'female', ringColor: '#FB923C' },
  { id: 'ivy',  image: require('../../assets/avatars/ivy.png'),  label: 'Ivy',  gender: 'female', ringColor: '#F59E0B' },
  { id: 'nova', image: require('../../assets/avatars/nova.png'), label: 'Nova', gender: 'female', ringColor: '#E879F9' },
  { id: 'zara', image: require('../../assets/avatars/zara.png'), label: 'Zara', gender: 'female', ringColor: '#FB923C' },
  { id: 'eda',  image: require('../../assets/avatars/eda.png'),  label: 'Eda',  gender: 'female', ringColor: '#C084FC' },
];

export const AVATAR_MAP: Record<string, AvatarDef> = AVATARS.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<string, AvatarDef>,
);

export const DEFAULT_AVATAR_ID = AVATARS[0]!.id;

export function getAvatar(id?: string | null): AvatarDef | null {
  if (!id) return null;
  return AVATAR_MAP[id] ?? null;
}

/**
 * Verilen string'den deterministik bir avatar üretir (yeni kullanıcı için
 * fallback). Aynı seed → her zaman aynı avatar, yenilemeler arasında stabil.
 */
export function getDeterministicAvatar(seed?: string | null): AvatarDef {
  const s = seed ?? '';
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATARS.length;
  return AVATARS[idx]!;
}

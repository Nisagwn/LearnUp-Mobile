// Ders adı normalleştirme — backend/seed verisinde dersler hem İngilizce
// ("Mathematics", "Biology") hem Türkçe ("Matematik") hem de büyük/küçük harf
// varyantlarıyla geçiyor. Bu util tek bir Türkçe kanonik etikete indirger ve
// müfredat dersi olup olmadığını söyler (özel AI konularını ayıklamak için).

export interface ResolvedSubject {
  /** Türkçe görünen ad. */
  label: string;
  /** Birleştirme anahtarı (kanonik dersler için sabit, değilse normalize metin). */
  key: string;
  /** MEB/YKS müfredat dersi mi? (false → özel AI konusu vb.) */
  canonical: boolean;
}

interface CanonicalEntry {
  key: string;
  label: string;
  aliases: string[];
}

// Her kanonik dersin alias'ları (tümü normalize edilmiş halde karşılaştırılır).
const CANONICAL: CanonicalEntry[] = [
  { key: 'matematik', label: 'Matematik', aliases: ['math', 'mathematics', 'matematik', 'mat'] },
  { key: 'fizik', label: 'Fizik', aliases: ['physics', 'fizik'] },
  { key: 'kimya', label: 'Kimya', aliases: ['chemistry', 'kimya'] },
  { key: 'biyoloji', label: 'Biyoloji', aliases: ['biology', 'biyoloji'] },
  {
    key: 'edebiyat',
    label: 'Türk Dili ve Edebiyatı',
    aliases: [
      'turkish language and literature',
      'literature',
      'edebiyat',
      'turk dili ve edebiyati',
      'türk dili ve edebiyatı',
      'turkce',
      'türkçe',
    ],
  },
  { key: 'tarih', label: 'Tarih', aliases: ['history', 'tarih'] },
  { key: 'cografya', label: 'Coğrafya', aliases: ['geography', 'cografya', 'coğrafya'] },
  { key: 'felsefe', label: 'Felsefe', aliases: ['philosophy', 'felsefe'] },
  {
    key: 'din',
    label: 'Din Kültürü ve Ahlak Bilgisi',
    aliases: [
      'religion and ethics',
      'din kulturu ve ahlak bilgisi',
      'din kültürü ve ahlak bilgisi',
      'din kulturu',
      'din kültürü',
      'din',
    ],
  },
  { key: 'ingilizce', label: 'İngilizce', aliases: ['english', 'ingilizce', 'ing', 'i̇ngilizce'] },
];

// Normalize: küçük harf (TR-duyarlı), kenar boşluk, çoklu boşluk tek, aksan sade.
function normalize(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

// Alias eşleşmesi için aksanları da sadeleştiren ek normalize (ç→c, ı→i, vb.)
function deaccent(s: string): string {
  return s
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/i̇/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');
}

const ALIAS_TO_ENTRY = new Map<string, CanonicalEntry>();
for (const entry of CANONICAL) {
  for (const a of entry.aliases) {
    ALIAS_TO_ENTRY.set(deaccent(normalize(a)), entry);
  }
}

function toTitleCaseTR(s: string): string {
  return normalize(s)
    .split(' ')
    .map((w) => (w ? w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1) : w))
    .join(' ');
}

/**
 * Ham ders adını Türkçe kanonik etikete çözer.
 * Kanonik müfredat dersi değilse: Türkçe title-case'lenmiş haliyle, canonical:false döner.
 */
export function resolveSubject(raw: string | undefined | null): ResolvedSubject {
  const safe = (raw ?? '').toString();
  const norm = deaccent(normalize(safe));
  const entry = ALIAS_TO_ENTRY.get(norm);
  if (entry) {
    return { label: entry.label, key: entry.key, canonical: true };
  }
  return { label: toTitleCaseTR(safe) || 'Genel', key: norm || 'genel', canonical: false };
}

/** Sadece Türkçe görünen ad lazımsa kısayol. */
export function subjectLabelTR(raw: string | undefined | null): string {
  return resolveSubject(raw).label;
}

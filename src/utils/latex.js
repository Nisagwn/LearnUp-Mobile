// Çıplak (delimiter'sız) LaTeX desenlerini otomatik olarak $...$ ile sarmalar.
// Veritabanındaki eski sorularda formüller "\frac{d}{dx}", "x^2" gibi yazılmış
// (AI promptu $...$ ister ama seed/eski veriler bazen sarmasız). Bu yardımcı,
// MathMarkdown ve Quiz renderContent'in girdisinde tetiklenir.

// Yakalanan örüntüler:
//   • \cmd{...}{...}  — LaTeX komutları + zincirli argümanlar
//   • \cmd            — argümansız komut (\alpha, \Delta, \sum, …)
//   • x^N  veya  x^{...}  — üst (exponent)
//   • x_N  veya  x_{...}  — alt (subscript)
// (İç içe süslü parantezler regex ile tam desteklenmez; bunlar için yazar
// $...$ kullanmaya devam etmeli.)
const LATEX_TOKEN =
  /\\[a-zA-Z]+(?:\{[^{}]*\})*|[a-zA-Z0-9](?:\^|_)(?:\{[^{}]*\}|[a-zA-Z0-9]+)/g;

/**
 * İç içe geçmiş delimiter'ları düzeltir. Seed verisinde formüller bazen hem
 * `$...$` hem de içeride `\(...\)` ile çift sarmalanmış:
 *   "$\(\mathrm{\frac{a}{b}}\)$"
 * Bu durumda KaTeX dıştaki `$...$`'i delimiter olarak alır, içeride kalan
 * `\(...\)`'yi matematik komutu sanıp hata verir (kaynağı kırmızı basar).
 * Burada redundant iç delimiter'lar temizlenir → tek katman `$...$` kalır.
 * Yalnız `$`'a komşu olanlar temizlenir; saf `\(...\)` (dolar'sız) içerik
 * KaTeX'in kendi delimiter config'iyle render edildiği için korunur.
 */
export function normalizeDelimiters(s) {
  return s
    .replace(/\$\$\s*\\\[/g, '$$$$') // $$ \[  → $$
    .replace(/\\\]\s*\$\$/g, '$$$$') // \] $$  → $$
    .replace(/\$\s*\\\(/g, '$') //      $ \(   → $
    .replace(/\\\)\s*\$/g, '$'); //     \) $   → $
}

// LaTeX komut → okunabilir Unicode sembol eşlemesi (uzun anahtarlar ÖNCE gelmeli;
// ör. \leq, \le'den önce — aksi halde \leq → "≤q" olur).
const LATEX_SYMBOLS = [
  // Prefix çakışmasını önlemek için uzun/özel anahtarlar önce:
  // \left, \right → \le/\ge'den ÖNCE (yoksa \le, \left'i "≤ft" yapar).
  ['\\leftrightarrow', '↔'], ['\\Rightarrow', '⇒'], ['\\rightarrow', '→'],
  ['\\leftarrow', '←'], ['\\left', ''], ['\\right', ''], ['\\to', '→'],
  ['\\leq', '≤'], ['\\le', '≤'], ['\\geq', '≥'], ['\\ge', '≥'],
  ['\\neq', '≠'], ['\\ne', '≠'], ['\\approx', '≈'], ['\\equiv', '≡'],
  ['\\times', '×'], ['\\cdot', '·'], ['\\div', '÷'], ['\\pm', '±'], ['\\mp', '∓'],
  ['\\infty', '∞'], ['\\int', '∫'], ['\\sum', 'Σ'], ['\\prod', '∏'], ['\\sqrt', '√'],
  ['\\alpha', 'α'], ['\\beta', 'β'], ['\\gamma', 'γ'], ['\\Delta', 'Δ'], ['\\delta', 'δ'],
  ['\\theta', 'θ'], ['\\lambda', 'λ'], ['\\mu', 'μ'], ['\\pi', 'π'], ['\\sigma', 'σ'],
  ['\\omega', 'ω'], ['\\Omega', 'Ω'],
  ['\\,', ' '], ['\\;', ' '], ['\\!', ''], ['\\quad', ' '],
];

/**
 * LaTeX'i okunabilir düz metne çevirir — uzun listelerde her satıra WebView
 * (MathRenderer) koymak ağır olduğu için ÖNİZLEME amaçlı kullanılır.
 * Tam matematik render'ı detay/quiz ekranında MathRenderer ile yapılır.
 */
export function latexToPlainText(input) {
  if (input == null) return '';
  let s = typeof input === 'string' ? input : String(input);
  if (!s) return '';
  s = normalizeDelimiters(s);
  // Delimiter'ları kaldır: $$, $, \(, \), \[, \]
  s = s.replace(/\${1,2}/g, ' ').replace(/\\[()[\]]/g, ' ');
  // \frac{a}{b} → (a)/(b) , \sqrt{x} → √(x) — iç içe için yinele (en içten dışa).
  let prev;
  do {
    prev = s;
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  } while (s !== prev);
  // Biçim komutlarını (içeriği KORUYARAK) kaldır: \mathrm{X} → {X} → sonra X.
  s = s.replace(
    /\\(?:displaystyle|textstyle|mathrm|mathbf|mathit|mathsf|mathcal|mathbb|text|operatorname|rm|bf|it)\b\s*/g,
    '',
  );
  // Sembolleri çevir (uzun anahtar önce)
  for (const [k, v] of LATEX_SYMBOLS) s = s.split(k).join(v);
  // Üst/alt indis süslülerini sadeleştir: ^{...} → ^... , _{...} → _... (yinele)
  do {
    prev = s;
    s = s.replace(/\^\s*\{([^{}]*)\}/g, '^$1').replace(/_\s*\{([^{}]*)\}/g, '_$1');
  } while (s !== prev);
  // Kalan \komut → komut adı (ters eğik çizgi düşer: \sin → sin)
  s = s.replace(/\\([a-zA-Z]+)/g, '$1');
  // Gereksiz kalan süslü parantezleri ve fazla boşlukları temizle
  s = s.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Eğer metin zaten `$` içeriyorsa (yazar elle sarmalamış) olduğu gibi döner.
 * Aksi halde LaTeX-benzeri her token'ı `$...$` ile sarar.
 */
export function autoWrapLatex(text) {
  if (text == null) return '';
  let s = typeof text === 'string' ? text : String(text);
  if (!s) return '';
  // Çift-sarmalı delimiter'ları (ör. "$\(...\)$") önce tek katmana indir.
  s = normalizeDelimiters(s);
  // Yazar zaten herhangi bir delimiter ile sarmaladıysa olduğu gibi geçir:
  //   • $...$ ve $$...$$ — KaTeX varsayılan
  //   • \(...\) ve \[...\] — TeX style (KaTeX delimiters config ile destekleniyor)
  if (s.includes('$') || /\\[([]/.test(s)) return s;
  // Regex.test() lastIndex'i kirletir — replace çağrısı için sıfırla
  LATEX_TOKEN.lastIndex = 0;
  if (!LATEX_TOKEN.test(s)) return s;
  LATEX_TOKEN.lastIndex = 0;
  return s.replace(LATEX_TOKEN, (m) => `$${m}$`);
}

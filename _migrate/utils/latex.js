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
 * Eğer metin zaten `$` içeriyorsa (yazar elle sarmalamış) olduğu gibi döner.
 * Aksi halde LaTeX-benzeri her token'ı `$...$` ile sarar.
 */
export function autoWrapLatex(text) {
  if (text == null) return '';
  const s = typeof text === 'string' ? text : String(text);
  if (!s) return '';
  if (s.includes('$')) return s; // yazar sarmaladıysa dokunma
  // Regex.test() lastIndex'i kirletir — replace çağrısı için sıfırla
  LATEX_TOKEN.lastIndex = 0;
  if (!LATEX_TOKEN.test(s)) return s;
  LATEX_TOKEN.lastIndex = 0;
  return s.replace(LATEX_TOKEN, (m) => `$${m}$`);
}

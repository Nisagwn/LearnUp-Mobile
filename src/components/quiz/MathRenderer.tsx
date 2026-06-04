import { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import WebView from 'react-native-webview';
import { autoWrapLatex } from '@/utils/latex';

interface MathRendererProps {
  content: string;
  fontSize?: number;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
}

function escapeHtml(s: string): string {
  // Yalnızca `&` escape'lenir. `<` ve `>` LaTeX'te operatör olarak kullanılır
  // (`$x < 5$`, `$f \le g$` vs.) ve HTML entity'e çevrilirse KaTeX render'ını
  // kırar. Soru metni güvenli kanaldan (kendi backend) geldiği için XSS riski
  // bu MVP'de yok sayılabilir.
  return s.replace(/&/g, '&amp;');
}

function hasLatex(text: string): boolean {
  if (!text) return false;
  // $...$ • $$...$$ • \(...\) • \[...\] • çıplak komut/exponent/subscript
  return /\$|\\[([]|\\[a-zA-Z]+|\^|_/.test(text);
}

function buildHtml(content: string, fontSize: number, color: string, align: string): string {
  const wrapped = autoWrapLatex(content);
  // Yalnızca `&` escape'lendiği için eski `&lt;br&gt;` düzeltmesi gereksiz.
  // <br/> tag'lerini olduğu gibi geçirmek için ham metnin içindekileri korur.
  const safe = escapeHtml(wrapped);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    html, body { margin: 0; padding: 0; background: transparent; }
    body { color: ${color}; font-size: ${fontSize}px; font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; line-height: 1.55; text-align: ${align}; }
    .katex { font-size: 1em !important; }
    .katex-display { margin: 0.4em 0; overflow-x: auto; overflow-y: hidden; }
  </style>
</head>
<body>
  <div id="root">${safe}</div>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script>
    try {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\\\(', right: '\\\\)', display: false },
          { left: '\\\\[', right: '\\\\]', display: true }
        ],
        throwOnError: false
      });
    } catch (e) {}
    function reportSize() {
      var h = document.body.scrollHeight || document.documentElement.scrollHeight || 24;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(String(h));
    }
    setTimeout(reportSize, 80);
    setTimeout(reportSize, 300);
    setTimeout(reportSize, 800);
  </script>
</body>
</html>`;
}

export function MathRenderer({
  content,
  fontSize = 14,
  color = '#ffffff',
  textAlign = 'left',
}: MathRendererProps) {
  const [height, setHeight] = useState(28);
  const html = useMemo(
    () => buildHtml(content, fontSize, color, textAlign),
    [content, fontSize, color, textAlign],
  );

  if (!hasLatex(content)) {
    return (
      <Text
        style={{
          color,
          fontSize,
          lineHeight: fontSize * 1.5,
          textAlign,
        }}
      >
        {content}
      </Text>
    );
  }

  return (
    <View style={{ height, width: '100%' }}>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: 'transparent', width: '100%' }}
        androidLayerType="hardware"
        onMessage={(e) => {
          const h = parseInt(e.nativeEvent.data, 10);
          if (!Number.isNaN(h) && h > 0 && h !== height) setHeight(h + 4);
        }}
      />
    </View>
  );
}

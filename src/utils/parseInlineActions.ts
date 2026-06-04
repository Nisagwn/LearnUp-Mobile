// Bot mesajlarındaki [QUIZ:konu:soru_sayısı] ve [KONU:başlık] etiketlerini
// metin segmentleri ile butonlara böler. Renderer Pressable'a çevirir.

export type InlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'quiz'; topic: string; count: number; raw: string }
  | { kind: 'topic'; title: string; raw: string };

const PATTERN = /\[(QUIZ|KONU):([^\]]+)\]/g;

export function parseInlineActions(text: string): InlineSegment[] {
  if (!text) return [];
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
    }
    const kind = match[1]!;
    const body = match[2]!;
    const raw = match[0];

    if (kind === 'QUIZ') {
      const parts = body.split(':').map((p) => p.trim());
      const topic = parts[0] || 'genel';
      const count = Math.max(1, Math.min(20, parseInt(parts[1] ?? '5', 10) || 5));
      segments.push({ kind: 'quiz', topic, count, raw });
    } else if (kind === 'KONU') {
      const title = body.trim();
      if (title) segments.push({ kind: 'topic', title, raw });
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ kind: 'text', text }];
}

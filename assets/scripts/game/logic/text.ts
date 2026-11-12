// Pure bitmap-text layout (no 'cc'). Fonts from the atlas (tools/art/manifest.mjs):
//   font5_<charCode>  5×7 glyphs for ASCII 32..126, line height 9
//   font7_<charCode>  7×9 glyphs for 0-9 + - !  (damage numbers), line height 11
export type FontId = 'font5' | 'font7';
// Glyph sprites carry a 1-px dark outline; their anchor is the top-left of the ink box, and atlas.json gives each
// glyph a pen `advance` (ink width + 1). Line heights from assets/resources/art/font.json.
export const FONT_METRICS: Record<FontId, { cell: number; lineH: number; glyphH: number }> = {
  font5: { cell: 5, lineH: 10, glyphH: 7 },
  font7: { cell: 7, lineH: 12, glyphH: 9 },
};
const FONT7_CHARS = new Set([...'0123456789+-!'].map((c) => c.charCodeAt(0)));

/** Glyph frame name for a char code, falling back to font5 / '?' for unsupported characters. */
export function glyphName(font: FontId, code: number): string {
  if (font === 'font7' && FONT7_CHARS.has(code)) return `font7_${code}`;
  if (code < 32 || code > 126) code = 63; // '?'
  return `font5_${code}`;
}

/** Strip Vietnamese diacritics etc. so text renders with the ASCII bitmap font. */
export function toAscii(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7e\n]/g, '?');
}

export interface Glyph { name: string; x: number; y: number }
export interface Layout { glyphs: Glyph[]; width: number; height: number; lines: number }

/**
 * Lay out text in art px. Origin = top-left of the text block, +y DOWN (callers flip). `advanceOf(name)` returns the
 * glyph pen advance from atlas.json (0 = unknown → cell + 1). `maxWidth` wraps on spaces.
 */
export function layoutText(text: string, font: FontId, advanceOf: (name: string) => number, maxWidth = Infinity,
  align: 'left' | 'center' | 'right' = 'left'): Layout {
  const m = FONT_METRICS[font];
  const src = toAscii(text);
  const adv = (ch: string) => {
    const name = glyphName(font, ch.charCodeAt(0));
    const fm = name.startsWith('font7') ? FONT_METRICS.font7 : FONT_METRICS.font5;
    const a = advanceOf(name);
    return { name, a: a > 0 ? a : (ch === ' ' ? 4 : fm.cell + 1) };
  };
  const textWidth = (w: string) => { let s = 0; for (const ch of w) s += adv(ch).a; return Math.max(0, s - 1); };
  const lines: string[] = [];
  for (const para of src.split('\n')) {
    if (maxWidth === Infinity) { lines.push(para); continue; }
    let cur = '';
    for (const word of para.split(' ')) {
      const cand = cur ? `${cur} ${word}` : word;
      if (cur && textWidth(cand) > maxWidth) { lines.push(cur); cur = word; } else cur = cand;
    }
    lines.push(cur);
  }
  const widths = lines.map(textWidth);
  const blockW = Math.max(0, ...widths);
  const glyphs: Glyph[] = [];
  lines.forEach((line, li) => {
    let x = align === 'center' ? Math.floor((blockW - widths[li]) / 2) : align === 'right' ? blockW - widths[li] : 0;
    const y = li * m.lineH;
    for (const ch of line) {
      const g = adv(ch);
      // font5 fallback glyphs inside a font7 line sit on the same baseline
      if (ch !== ' ') glyphs.push({ name: g.name, x, y: y + (font === 'font7' && g.name.startsWith('font5') ? 2 : 0) });
      x += g.a;
    }
  });
  return { glyphs, width: blockW, height: lines.length ? (lines.length - 1) * m.lineH + m.glyphH : 0, lines: lines.length };
}

/** Compact number formatting for HUD counters (1234 → 1.2k). */
export function fmtNum(n: number): string {
  const v = Math.floor(n);
  if (Math.abs(v) >= 10000) return `${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

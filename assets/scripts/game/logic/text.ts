// Pure bitmap-text layout (no 'cc'). Fonts from the atlas (tools/art/manifest.mjs):
//   font5_<charCode>  5×7 glyphs for ASCII 32..126, line height 9
//   font7_<charCode>  7×9 glyphs for 0-9 + - !  (damage numbers), line height 11
export type FontId = 'font5' | 'font7';
export const FONT_METRICS: Record<FontId, { cell: number; lineH: number; glyphH: number; spacing: number }> = {
  font5: { cell: 5, lineH: 9, glyphH: 7, spacing: 1 },
  font7: { cell: 7, lineH: 11, glyphH: 9, spacing: 1 },
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
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7e\n]/g, '?');
}

export interface Glyph { name: string; x: number; y: number; w: number }
export interface Layout { glyphs: Glyph[]; width: number; height: number; lines: number }

/**
 * Lay out text in art px. Origin = top-left of the text block, +y DOWN (callers flip). `widthOf(name)` returns a glyph
 * frame width (atlas), used for the advance (proportional when glyphs are trimmed). `maxWidth` wraps on spaces.
 */
export function layoutText(text: string, font: FontId, widthOf: (name: string) => number, maxWidth = Infinity,
  align: 'left' | 'center' | 'right' = 'left'): Layout {
  const m = FONT_METRICS[font];
  const src = toAscii(text);
  const adv = (ch: string) => {
    const name = glyphName(font, ch.charCodeAt(0));
    const fm = name.startsWith('font7') ? FONT_METRICS.font7 : FONT_METRICS.font5;
    const w = widthOf(name);
    return { name, w: w > 0 ? w : fm.cell, a: (ch === ' ' ? Math.max(3, fm.cell - 1) : (w > 0 ? w : fm.cell)) + fm.spacing };
  };
  const wordWidth = (w: string) => { let s = 0; for (const ch of w) s += adv(ch).a; return s; };
  // wrap into lines
  const lines: string[] = [];
  for (const para of src.split('\n')) {
    if (maxWidth === Infinity) { lines.push(para); continue; }
    const words = para.split(' ');
    let cur = '';
    for (const word of words) {
      const cand = cur ? `${cur} ${word}` : word;
      if (cur && wordWidth(cand) - m.spacing > maxWidth) { lines.push(cur); cur = word; }
      else cur = cand;
    }
    lines.push(cur);
  }
  const glyphs: Glyph[] = [];
  let width = 0;
  const widths = lines.map((l) => Math.max(0, wordWidth(l) - (l.length ? m.spacing : 0)));
  const blockW = Math.max(0, ...widths);
  lines.forEach((line, li) => {
    let x = align === 'center' ? Math.floor((blockW - widths[li]) / 2) : align === 'right' ? blockW - widths[li] : 0;
    const y = li * m.lineH;
    for (const ch of line) {
      const g = adv(ch);
      if (ch !== ' ') glyphs.push({ name: g.name, x, y: y + (g.name.startsWith('font5') && font === 'font7' ? 2 : 0), w: g.w });
      x += g.a;
    }
    width = Math.max(width, x - m.spacing);
  });
  return { glyphs, width: blockW || Math.max(0, width), height: lines.length ? (lines.length - 1) * m.lineH + m.glyphH : 0, lines: lines.length };
}

/** Compact number formatting for HUD counters (1234 → 1.2k). */
export function fmtNum(n: number): string {
  const v = Math.floor(n);
  if (Math.abs(v) >= 10000) return `${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

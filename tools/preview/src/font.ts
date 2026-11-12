// Bitmap text from the atlas glyphs (tools/art/sprites/ui.mjs): font5_<code> (5×7 ink, ASCII 32..126) and
// font7_<code> (7×9 digits + - !). Each glyph sprite = ink 'w' + baked 1px 'k' outline; anchor (1,1) = top-left of
// the ink box; `advance` (atlas.json) is the proportional pen advance. Colour = recolour of the ink only, so the
// outline always stays. No system fonts are ever used.
import type { Atlas } from './atlas';
import { toAscii } from './shared';

export type FontSize = 5 | 7;
/** shadow: null = draw the ink only (no baked outline) — for dark text on light parchment. */
export interface TextOpts { color?: string; shadow?: string | null; align?: 'left' | 'center' | 'right'; size?: FontSize; alpha?: number }

export const COL = {
  white: '#f6f2e6', ink: '#1b1b2f', gold: '#ffe27a', fire: '#f7a93b', red: '#d14b4b', green: '#7cc45a',
  ice: '#7fd0f0', grey: '#a3a9b8', wood: '#e2c48a', stone: '#d6dae3', purple: '#d08be8', dim: '#73798c', pink: '#e86a92',
  brown: '#5a3a2e', plum: '#4b2a6b', wine: '#8c2f39',
};

const FONT7 = new Set([...'0123456789+-!'].map((c) => c.charCodeAt(0)));

export class BitmapFont {
  lineHeight = { 5: 10, 7: 12 };
  constructor(private atlas: Atlas) {}

  private glyph(code: number, size: FontSize): string | null {
    if (size === 7 && FONT7.has(code)) return `font7_${code}`;
    if (code < 32 || code > 126) code = 63;
    return `font5_${code}`;
  }
  private adv(code: number, size: FontSize): number {
    const g = this.glyph(code, size);
    const f = g ? (this.atlas.frames[g] as { advance?: number; w: number } | undefined) : undefined;
    if (f) return f.advance ?? f.w - 1;
    return code === 32 ? 4 : size === 7 ? 8 : 6;
  }
  lineH(size: FontSize = 5) { return this.lineHeight[size]; }

  width(text: string, size: FontSize = 5): number {
    text = toAscii(text);
    let w = 0;
    for (let i = 0; i < text.length; i++) w += this.adv(text.charCodeAt(i), size);
    return Math.max(0, w - 1);
  }

  /** Greedy word wrap to maxW art px. */
  wrap(text: string, maxW: number, size: FontSize = 5): string[] {
    const out: string[] = [];
    for (const para of toAscii(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (this.width(t, size) <= maxW || !line) line = t; else { out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  }

  /** (x, y) = top-left of the ink box of the first glyph (after alignment). */
  draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOpts = {}): number {
    const size = o.size ?? 5;
    text = toAscii(text);
    const w = this.width(text, size);
    let cx = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
    y = Math.round(y);
    const color = o.color && o.color !== COL.white ? o.color : undefined;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code !== 32) {
        const g = this.glyph(code, size)!;
        // font7 glyphs are 2px taller: align their baseline with font5 text
        this.atlas.draw(ctx, g, cx, size === 7 && !FONT7.has(code) ? y + 1 : y, { recolor: color, noOutline: o.shadow === null, alpha: o.alpha });
      }
      cx += this.adv(code, size);
    }
    return w;
  }

  drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, o: TextOpts = {}) {
    const lh = this.lineH(o.size ?? 5);
    lines.forEach((l, i) => this.draw(ctx, l, x, y + i * lh, o));
    return lines.length * lh;
  }
}

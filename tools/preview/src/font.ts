// Bitmap text from the atlas glyphs font5_<charCode> (5×7, line 9) and font7_<charCode> (7×9 digits/+/-/!).
// No system fonts are ever used.
import type { Atlas } from './atlas';
import { toAscii } from './shared';

export type FontSize = 5 | 7;
export interface TextOpts { color?: string; shadow?: string | null; align?: 'left' | 'center' | 'right'; size?: FontSize; alpha?: number; maxW?: number }

export const COL = {
  white: '#f6f2e6', ink: '#1b1b2f', gold: '#ffe27a', fire: '#f7a93b', red: '#d14b4b', green: '#7cc45a',
  ice: '#7fd0f0', grey: '#a3a9b8', wood: '#e2c48a', stone: '#d6dae3', purple: '#d08be8', dim: '#73798c', pink: '#e86a92',
};

export class BitmapFont {
  constructor(private atlas: Atlas) {}

  private glyph(code: number, size: FontSize): string | null {
    if (size === 7) {
      const n = `font7_${code}`;
      if (this.atlas.has(n)) return n;
    }
    const n5 = `font5_${code}`;
    if (this.atlas.has(n5)) return n5;
    const lower = String.fromCharCode(code).toUpperCase().charCodeAt(0);
    if (this.atlas.has(`font5_${lower}`)) return `font5_${lower}`;
    this.atlas.get(n5); // logs missing once
    return null;
  }
  private adv(code: number, size: FontSize): number {
    const g = this.glyph(code, size);
    const f = g ? this.atlas.frames[g] : null;
    if (code === 32) return size === 7 ? 5 : 4;
    return (f ? f.w : size === 7 ? 7 : 5) + 1;
  }
  lineH(size: FontSize = 5) { return size === 7 ? 11 : 9; }

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

  draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOpts = {}): number {
    const size = o.size ?? 5;
    text = toAscii(text);
    const w = this.width(text, size);
    let cx = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
    y = Math.round(y);
    const color = o.color ?? COL.white;
    const shadow = o.shadow === undefined ? COL.ink : o.shadow;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const g = code === 32 ? null : this.glyph(code, size);
      if (g) {
        if (shadow) {
          this.atlas.drawTL(ctx, g, cx + 1, y + 1, { tint: shadow, alpha: o.alpha });
          this.atlas.drawTL(ctx, g, cx, y + 1, { tint: shadow, alpha: o.alpha });
        }
        this.atlas.drawTL(ctx, g, cx, y, { tint: color, alpha: o.alpha });
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

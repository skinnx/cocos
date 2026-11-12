// Text rendered exclusively from the pixel font glyph sprites in the atlas (font5_* / font7_*), never a system font
// (SPEC §9.4). Optional 1-px drop shadow for legibility over the world. Big-text mode scales UI text ×1.5 (§10.4).
import type { Node } from 'cc';
import { layoutText, type FontId } from '../logic/text';
import { Atlas } from '../render/Atlas';
import { mkNode, SpriteHandle, PAL } from '../render/Nodes';

export interface TextOpts {
  font?: FontId; align?: 'left' | 'center' | 'right'; maxWidth?: number;
  /** anchor of the text block: ax 0 left .. 1 right; ay 0 bottom .. 1 top */
  ax?: number; ay?: number;
  shadow?: boolean; color?: readonly number[]; scalable?: boolean;
}

export class BitmapText {
  static bigText = false;
  readonly node: Node;
  private sh: Node; private gl: Node;
  private glyphs: SpriteHandle[] = [];
  private shadows: SpriteHandle[] = [];
  private text = '\u0000';
  private col: readonly number[] = PAL.w;
  private alphaV = 255;
  width = 0; height = 0;
  opts: Required<Omit<TextOpts, 'color'>>;

  constructor(parent: Node | null, opts: TextOpts = {}) {
    this.node = mkNode('text', parent);
    this.sh = mkNode('sh', this.node);
    this.gl = mkNode('gl', this.node);
    this.opts = {
      font: opts.font ?? 'font5', align: opts.align ?? 'left', maxWidth: opts.maxWidth ?? Infinity,
      ax: opts.ax ?? 0, ay: opts.ay ?? 1, shadow: opts.shadow ?? true, scalable: opts.scalable ?? true,
    };
    if (opts.color) this.col = opts.color;
  }

  get scaleK(): number { return this.opts.scalable && BitmapText.bigText ? 1.5 : 1; }

  set(text: string, color?: readonly number[]): this {
    const k = this.scaleK;
    if (text === this.text && (!color || color === this.col) && this.node.scale.x === k) return this;
    if (color) this.col = color;
    this.text = text;
    const a = Atlas.inst;
    const lay = layoutText(text, this.opts.font, (n) => a.width(n), this.opts.maxWidth / k, this.opts.align);
    this.width = lay.width * k; this.height = lay.height * k;
    const ox = -Math.round(this.opts.ax * lay.width), top = Math.round((1 - this.opts.ay) * lay.height);
    let i = 0;
    for (const g of lay.glyphs) {
      const h = this.glyphs[i] ?? (this.glyphs[i] = new SpriteHandle('g', this.gl));
      h.set(g.name).pos(ox + g.x, top - g.y).show(true).color(this.col[0], this.col[1], this.col[2], this.alphaV);
      if (this.opts.shadow) {
        const s = this.shadows[i] ?? (this.shadows[i] = new SpriteHandle('s', this.sh));
        s.set(g.name).pos(ox + g.x + 1, top - g.y - 1).show(true).color(PAL.k[0], PAL.k[1], PAL.k[2], this.alphaV);
      }
      i++;
    }
    for (let j = i; j < this.glyphs.length; j++) this.glyphs[j].show(false);
    for (let j = i; j < this.shadows.length; j++) this.shadows[j].show(false);
    this.node.setScale(k, k, 1);
    return this;
  }

  setColor(color: readonly number[]): this {
    if (color === this.col) return this;
    this.col = color;
    for (const g of this.glyphs) g.color(color[0], color[1], color[2], this.alphaV);
    return this;
  }
  alpha(a: number): this {
    const v = Math.max(0, Math.min(255, Math.round(a)));
    if (v === this.alphaV) return this;
    this.alphaV = v;
    for (const g of this.glyphs) g.alpha(v);
    for (const s of this.shadows) s.alpha(v);
    return this;
  }
  pos(x: number, y: number): this { this.node.setPosition(x, y, 0); return this; }
  show(v: boolean): this { if (this.node.active !== v) this.node.active = v; return this; }
  /** Force relayout (e.g. after the big-text setting changed). */
  refresh(): this { const t = this.text; this.text = '\u0000'; return this.set(t); }
}

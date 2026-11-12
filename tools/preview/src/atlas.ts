// Sprite atlas (assets/resources/art/atlas.png + atlas.json). All drawing is in ART PIXELS on the
// low-res back buffer, so every sprite is pixel-perfect by construction.
import { defaultAnchor, defaultSlice } from '../../../assets/scripts/game/logic/atlasData';

export interface Frame { x: number; y: number; w: number; h: number; ax: number; ay: number; slice?: [number, number, number, number] | null }

/** tint: whole silhouette in one colour (hit flash, elite rim). recolor: every pixel except the #1b1b2f outline. */
export interface DrawOpts { flip?: boolean; alpha?: number; tint?: string; recolor?: string; noOutline?: boolean; scale?: number; rot?: number }

export class Atlas {
  img: HTMLImageElement | null = null;
  frames: Record<string, Frame> = {};
  readonly missing = new Set<string>();
  private tintCache = new Map<string, HTMLCanvasElement>();

  async load(base: string): Promise<void> {
    try {
      const res = await fetch(`${base}/art/atlas.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`atlas.json ${res.status}`);
      const json = await res.json();
      this.frames = json.frames || {};
      for (const [name, f] of Object.entries(this.frames)) {
        if (f.ax === undefined || f.ay === undefined) { const [ax, ay] = defaultAnchor(name, f.w, f.h); f.ax ??= ax; f.ay ??= ay; }
        if (!Array.isArray(f.slice)) f.slice = defaultSlice(name, f.w, f.h);
      }
      const img = new Image();
      img.src = `${base}/art/atlas.png?v=${Date.now()}`;
      await img.decode();
      this.img = img;
    } catch (e) {
      console.warn('[preview] atlas not available yet:', (e as Error).message);
    }
  }

  has(name: string): boolean { return !!this.frames[name]; }
  get(name: string): Frame | null {
    const f = this.frames[name];
    if (!f) { if (this.img && !this.missing.has(name)) { this.missing.add(name); console.warn(`[preview] missing sprite: ${name}`); } return null; }
    return f;
  }
  /** Picks the first existing name (no warning for the fallbacks that miss). */
  pick(...names: string[]): string {
    for (const n of names) if (this.frames[n]) return n;
    return names[0];
  }
  /** Number of frames available for an animated base name (name_0..name_n-1). */
  count(base: string): number {
    let n = 0; while (this.frames[`${base}_${n}`]) n++;
    return n;
  }

  /** Sprite (or its single-colour silhouette) as a drawable source rect. */
  private source(name: string, f: Frame, tint?: string, recolor?: string, noOutline?: boolean): [CanvasImageSource, number, number] {
    if ((recolor || noOutline) && !tint) return [this.recolored(name, f, recolor, noOutline), 0, 0];
    if (!tint) return [this.img!, f.x, f.y];
    const key = name + '|' + tint;
    let c = this.tintCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
      const g = c.getContext('2d')!;
      g.drawImage(this.img!, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = tint; g.fillRect(0, 0, f.w, f.h);
      this.tintCache.set(key, c);
    }
    return [c, 0, 0];
  }

  private recolored(name: string, f: Frame, color: string | undefined, noOutline = false): HTMLCanvasElement {
    const key = name + '#' + (color ?? '') + (noOutline ? '!' : '');
    let c = this.tintCache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    const g = c.getContext('2d')!;
    g.drawImage(this.img!, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    const d = g.getImageData(0, 0, f.w, f.h);
    const r = color ? parseInt(color.slice(1, 3), 16) : -1, gg = color ? parseInt(color.slice(3, 5), 16) : 0, b = color ? parseInt(color.slice(5, 7), 16) : 0;
    for (let i = 0; i < d.data.length; i += 4) {
      if (d.data[i + 3] === 0) continue;
      if (d.data[i] === 0x1b && d.data[i + 1] === 0x1b && d.data[i + 2] === 0x2f) { if (noOutline) d.data[i + 3] = 0; continue; }
      if (r >= 0) { d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; }
    }
    g.putImageData(d, 0, 0);
    this.tintCache.set(key, c);
    return c;
  }

  /** Draws `name` with its anchor at art-px (x, y). */
  draw(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, o: DrawOpts = {}): Frame | null {
    const f = this.get(name);
    if (!f || !this.img) return f;
    const [src, sx, sy] = this.source(name, f, o.tint, o.recolor, o.noOutline);
    const a = o.alpha ?? 1;
    if (a <= 0) return f;
    const simple = !o.flip && !o.scale && !o.rot;
    if (a !== 1) ctx.globalAlpha = a;
    // fractional anchors (e.g. 2.5) are snapped so every sprite lands on whole art pixels
    if (simple) ctx.drawImage(src, sx, sy, f.w, f.h, Math.round(x - f.ax), Math.round(y - f.ay), f.w, f.h);
    else {
      ctx.save(); ctx.translate(Math.round(x - f.ax) + f.ax, Math.round(y - f.ay) + f.ay);
      if (o.rot) ctx.rotate(o.rot);
      const s = o.scale ?? 1;
      ctx.scale(o.flip ? -s : s, s);
      ctx.drawImage(src, sx, sy, f.w, f.h, -f.ax, -f.ay, f.w, f.h);
      ctx.restore();
    }
    if (a !== 1) ctx.globalAlpha = 1;
    return f;
  }

  /** Draws the sprite's top-left at (x, y) ignoring the anchor (UI layout). */
  drawTL(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, o: DrawOpts = {}): Frame | null {
    const f = this.get(name);
    if (!f) return null;
    return this.draw(ctx, name, x + f.ax, y + f.ay, o);
  }

  /** Draws the sprite centred on (x, y) ignoring the anchor (icons, flyers). */
  drawC(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, o: DrawOpts = {}): Frame | null {
    const f = this.get(name);
    if (!f) return null;
    return this.draw(ctx, name, Math.round(x - f.w / 2) + f.ax, Math.round(y - f.h / 2) + f.ay, o);
  }

  /** Draws a sub-rectangle of a sprite (debris shards, partial fills). */
  drawPart(ctx: CanvasRenderingContext2D, name: string, sx: number, sy: number, w: number, h: number, dx: number, dy: number, alpha = 1) {
    const f = this.get(name);
    if (!f || !this.img) return;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(this.img, f.x + sx, f.y + sy, w, h, Math.round(dx), Math.round(dy), w, h);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  /** 9-slice a panel/button sprite to w×h at (x, y). Insets from atlas.json `slice` (or CONTRACT defaults);
   *  `border` overrides all four. Edges and centre are TILED (never stretched) so the pixel texture is preserved. */
  nine(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number, border?: number, alpha = 1) {
    const f = this.get(name);
    if (!f || !this.img) return;
    let [l, t, r, b] = border !== undefined ? [border, border, border, border] : f.slice ?? [3, 3, 3, 3];
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (w < l + r) { l = Math.floor(w / 2); r = w - l; }
    if (h < t + b) { t = Math.floor(h / 2); b = h - t; }
    const im = this.img;
    const cw = f.w - l - r, ch = f.h - t - b, iw = w - l - r, ih = h - t - b;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    const part = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) => {
      if (sw > 0 && sh > 0) ctx.drawImage(im, f.x + sx, f.y + sy, sw, sh, dx, dy, sw, sh);
    };
    // corners
    part(0, 0, l, t, x, y); part(f.w - r, 0, r, t, x + w - r, y);
    part(0, f.h - b, l, b, x, y + h - b); part(f.w - r, f.h - b, r, b, x + w - r, y + h - b);
    if (cw > 0) for (let dx = 0; dx < iw; dx += cw) {
      const ww = Math.min(cw, iw - dx);
      part(l, 0, ww, t, x + l + dx, y); part(l, f.h - b, ww, b, x + l + dx, y + h - b);
    }
    if (ch > 0) for (let dy = 0; dy < ih; dy += ch) {
      const hh = Math.min(ch, ih - dy);
      part(0, t, l, hh, x, y + t + dy); part(f.w - r, t, r, hh, x + w - r, y + t + dy);
      if (cw > 0) for (let dx = 0; dx < iw; dx += cw) part(l, t, Math.min(cw, iw - dx), hh, x + l + dx, y + t + dy);
    }
    if (alpha !== 1) ctx.globalAlpha = 1;
  }
}

// Immediate-mode UI: widgets register hit rects each frame; input tests them topmost-first.
import type { Atlas } from './atlas';
import { BitmapFont, COL, TextOpts } from './font';

export interface Hit { x: number; y: number; w: number; h: number; id: string; onTap?: () => void; onDown?: (px: number, py: number) => void; onDrag?: (dx: number, dy: number, x: number, y: number) => void; block?: boolean }

export class UI {
  hits: Hit[] = [];
  pressed: string | null = null;
  tapX = 0; tapY = 0;
  constructor(public atlas: Atlas, public font: BitmapFont, public ctx: CanvasRenderingContext2D) {}

  begin() { this.hits = []; }
  add(h: Hit) { this.hits.push(h); }
  /** Area that swallows input (panels). */
  block(x: number, y: number, w: number, h: number, id = 'block') { this.hits.push({ x, y, w, h, id, block: true }); }
  at(px: number, py: number): Hit | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (px >= h.x && py >= h.y && px < h.x + h.w && py < h.y + h.h) return h;
    }
    return null;
  }

  panel(x: number, y: number, w: number, h: number, kind: 'parchment' | 'stone' = 'parchment', alpha = 1) {
    this.atlas.nine(this.ctx, `ui_panel_${kind}`, x, y, w, h, undefined, alpha);
  }

  /** Button: 9-slice btn sprite + optional icon + label. Returns the rect. Touch targets ≥ 24 art px (≈88 design px). */
  button(id: string, x: number, y: number, w: number, h: number, label: string, onTap: () => void, o: { icon?: string; disabled?: boolean; color?: string; textOpts?: TextOpts } = {}) {
    x = Math.round(x); y = Math.round(y);
    const down = this.pressed === id;
    const spr = o.disabled ? 'ui_btn_disabled' : down ? 'ui_btn_down' : 'ui_btn_up';
    this.atlas.nine(this.ctx, spr, x, y, w, h);
    const off = down ? 1 : 0;
    const tw = label ? this.font.width(label) : 0;
    const iw = o.icon ? 16 : 0;
    const gap = o.icon && label ? 2 : 0;
    let cx = Math.round(x + (w - tw - iw - gap) / 2);
    if (o.icon) { this.atlas.drawTL(this.ctx, o.icon, cx, Math.round(y + (h - 16) / 2) + off, { alpha: o.disabled ? 0.5 : 1 }); cx += iw + gap; }
    if (label) this.font.draw(this.ctx, label, cx, Math.round(y + (h - 7) / 2) + off, { color: o.disabled ? COL.dim : o.color ?? COL.white, ...o.textOpts });
    this.add({ x, y, w, h, id, onTap: o.disabled ? undefined : onTap, block: true });
    return { x, y, w, h };
  }

  iconButton(id: string, x: number, y: number, size: number, icon: string, onTap: () => void, o: { disabled?: boolean; on?: boolean } = {}) {
    return this.button(id, x, y, size, size, '', onTap, { icon, disabled: o.disabled });
  }

  text(t: string, x: number, y: number, o?: TextOpts) { return this.font.draw(this.ctx, t, x, y, o); }

  /** Horizontal bar using bar_frame + bar_fill_* (fill tiled from its first columns). */
  bar(x: number, y: number, w: number, h: number, r: number, fill: string) {
    const A = this.atlas;
    A.nine(this.ctx, 'ui_bar_frame', x, y, w, h, Math.min(2, Math.floor(h / 3)));
    const ff = A.frames[`ui_${fill}`];
    if (!ff || !A.img) { A.get(`ui_${fill}`); return; }
    const b = Math.min(2, Math.floor(h / 3)) || 1;
    const iw = Math.round((w - 2 * b) * Math.max(0, Math.min(1, r)));
    if (iw <= 0) return;
    const ih = h - 2 * b;
    const sh = Math.min(ff.h, ih);
    // stretch the fill's vertical gradient to the bar height (rows repeat), never horizontally blur
    for (let dx = 0; dx < iw; dx += ff.w) {
      const ww = Math.min(ff.w, iw - dx);
      this.ctx.drawImage(A.img, ff.x, ff.y, ww, sh, x + b + dx, y + b, ww, ih);
    }
  }
}

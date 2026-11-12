// Minimal immediate-hit UI toolkit in UI-pixel space (origin bottom-left, 1 unit = 1 UI art pixel). Buttons are
// 9-slice sprites (btn_up / btn_down / btn_disabled) with an icon and/or bitmap text; hit areas are padded so every
// touch target is >= 88×88 design px (SPEC §3).
import type { Node } from 'cc';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';
import { BitmapText } from './BitmapText';
import { NineSlice } from './NineSlice';

export interface Hit {
  x: number; y: number; w: number; h: number; z: number;
  active(): boolean;
  onDown?(x: number, y: number): void;
  onMove?(x: number, y: number): void;
  onUp?(x: number, y: number, inside: boolean): void;
  onTap?(): void;
}

/** Global UI hit registry. `minTouch` = minimum touch size in UI px (88 design px / uiScale). */
export class UiInput {
  static minTouch = 29;
  private hits: Hit[] = [];
  add(h: Hit): Hit { this.hits.push(h); return h; }
  remove(h: Hit): void { const i = this.hits.indexOf(h); if (i >= 0) this.hits.splice(i, 1); }
  /** Topmost active hit containing (x, y), with touch-size padding. */
  find(x: number, y: number): Hit | null {
    let best: Hit | null = null;
    for (const h of this.hits) {
      if (!h.active()) continue;
      const px = Math.max(0, (UiInput.minTouch - h.w) / 2), py = Math.max(0, (UiInput.minTouch - h.h) / 2);
      if (x >= h.x - px && x <= h.x + h.w + px && y >= h.y - py && y <= h.y + h.h + py) {
        if (!best || h.z >= best.z) best = h;
      }
    }
    return best;
  }
}

export const uiInput = new UiInput();

/** True when the node and all its ancestors are active. */
export function shownInHierarchy(n: Node): boolean { return n.activeInHierarchy; }

export class Button {
  readonly node: Node;
  readonly bg: NineSlice;
  icon: SpriteHandle | null = null;
  label: BitmapText | null = null;
  readonly hit: Hit;
  enabled = true;
  pressed = false;
  private style: 'btn' | 'tab' | 'plain';
  selected = false;
  onTap: () => void = () => undefined;
  x = 0; y = 0; w = 0; h = 0;

  constructor(parent: Node, opts: { icon?: string; text?: string; z?: number; style?: 'btn' | 'tab' | 'plain'; textColor?: readonly number[] } = {}) {
    this.node = mkNode('button', parent);
    this.style = opts.style ?? 'btn';
    this.bg = new NineSlice(this.node, this.style === 'tab' ? 'ui_tab_off' : 'ui_btn_up');
    this.bg.show(this.style !== 'plain');
    if (opts.icon) this.icon = new SpriteHandle('icon', this.node, opts.icon);
    if (opts.text !== undefined) this.label = new BitmapText(this.node, { ax: 0.5, ay: 0.5, align: 'center', color: opts.textColor ?? PAL.k, shadow: false });
    if (opts.text) this.label!.set(opts.text);
    const self = this;
    this.hit = uiInput.add({
      x: 0, y: 0, w: 0, h: 0, z: opts.z ?? 10,
      active: () => self.node.activeInHierarchy && self.enabled,
      onDown: () => { self.pressed = true; self.refresh(); },
      onUp: (_x, _y, inside) => { self.pressed = false; self.refresh(); if (inside) self.onTap(); },
    });
  }

  layout(x: number, y: number, w: number, h: number): this {
    this.x = Math.round(x); this.y = Math.round(y); this.w = Math.round(w); this.h = Math.round(h);
    this.node.setPosition(this.x, this.y, 0);
    this.bg.size(this.w, this.h);
    Object.assign(this.hit, { x: this.x, y: this.y, w: this.w, h: this.h });
    this.place();
    return this;
  }
  /** Re-sync the absolute hit rect when the parent container moved. */
  offset(ox: number, oy: number): this { Object.assign(this.hit, { x: this.x + ox, y: this.y + oy }); return this; }

  setIcon(name: string): this {
    if (!this.icon) this.icon = new SpriteHandle('icon', this.node);
    this.icon.set(name); this.place(); return this;
  }
  setText(t: string, color?: readonly number[]): this {
    if (!this.label) this.label = new BitmapText(this.node, { ax: 0.5, ay: 0.5, align: 'center', color: PAL.k, shadow: false });
    this.label.set(t, color); this.place(); return this;
  }
  setEnabled(v: boolean): this { if (v !== this.enabled) { this.enabled = v; this.refresh(); } return this; }
  setSelected(v: boolean): this { if (v !== this.selected) { this.selected = v; this.refresh(); } return this; }
  show(v: boolean): this { if (this.node.active !== v) this.node.active = v; return this; }

  private refresh(): void {
    if (this.style === 'plain') return;
    if (this.style === 'tab') this.bg.setFrame(this.selected || this.pressed ? 'ui_tab_on' : 'ui_tab_off');
    else this.bg.setFrame(!this.enabled ? 'ui_btn_disabled' : this.pressed || this.selected ? 'ui_btn_down' : 'ui_btn_up');
    this.place();
    if (this.icon) this.icon.alpha(this.enabled ? 255 : 120);
  }

  private place(): void {
    const press = this.pressed && this.style === 'btn' ? -1 : 0;
    const hasIcon = !!this.icon && this.icon.shown;
    const hasText = !!this.label && this.label.width > 0;
    if (hasIcon && hasText) {
      const iw = this.icon!.w, tw = this.label!.width;
      const total = iw + 3 + tw;
      const x0 = Math.round((this.w - total) / 2);
      this.icon!.anchor(0, 0.5).pos(x0, Math.round(this.h / 2) + press);
      this.label!.pos(x0 + iw + 3 + Math.round(tw / 2), Math.round(this.h / 2) + press);
    } else if (hasIcon) {
      this.icon!.anchor(0.5, 0.5).pos(Math.round(this.w / 2), Math.round(this.h / 2) + press);
    } else if (hasText) {
      this.label!.pos(Math.round(this.w / 2), Math.round(this.h / 2) + press);
    }
  }
}

/** Full-screen input blocker for modal screens (z just below their buttons). */
export function blocker(node: Node, z: number, rect: () => { x: number; y: number; w: number; h: number }, onTap?: () => void): Hit {
  const h: Hit = {
    x: 0, y: 0, w: 0, h: 0, z,
    active: () => { if (!node.activeInHierarchy) return false; Object.assign(h, rect()); return true; },
    onTap,
    onUp: (_x, _y, inside) => { if (inside && onTap) onTap(); },
  };
  return uiInput.add(h);
}

/** Icon + number pair (resources, costs). */
export class IconValue {
  readonly node: Node;
  readonly icon: SpriteHandle;
  readonly text: BitmapText;
  constructor(parent: Node, icon: string, color: readonly number[] = PAL.w) {
    this.node = mkNode('iv', parent);
    this.icon = new SpriteHandle('i', this.node, icon).anchor(0, 0.5);
    this.text = new BitmapText(this.node, { ax: 0, ay: 0.5, color });
  }
  set(v: string, color?: readonly number[]): this {
    this.text.set(v, color);
    this.text.pos(this.icon.w + 2, 0);
    return this;
  }
  get width(): number { return this.icon.w + 2 + this.text.width; }
  pos(x: number, y: number): this { this.node.setPosition(Math.round(x), Math.round(y), 0); return this; }
  show(v: boolean): this { if (this.node.active !== v) this.node.active = v; return this; }
}

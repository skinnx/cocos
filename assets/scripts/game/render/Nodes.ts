// Small scene-graph helpers shared by render/ and ui/: every node lives on the UI_2D layer (rendered by the Canvas
// camera of the 2D scene template); sprites are sized in art px with anchors from atlas.json.
import { Color, Layers, Node, Sprite, UITransform, Vec2 } from 'cc';
import { Atlas } from './Atlas';

export function mkNode(name: string, parent?: Node | null): Node {
  const n = new Node(name);
  n.layer = Layers.Enum.UI_2D;
  if (parent) parent.addChild(n);
  return n;
}

const tmpColor = new Color(255, 255, 255, 255);

/** A sprite node driven by atlas frame names, with change detection to avoid redundant engine updates. */
export class SpriteHandle {
  readonly node: Node;
  readonly sprite: Sprite;
  readonly ut: UITransform;
  private cur = '';
  private flashing = false;
  private visible = true;
  private cr = 255; private cg = 255; private cb = 255; private ca = 255;
  private lx = NaN; private ly = NaN; private sx = 1; private sy = 1;
  private fw = 0; private fh = 0;
  /** anchor override that survives frame changes (UI icons); null = use the atlas anchor */
  private ovr: [number, number] | null = null;

  constructor(name: string, parent: Node | null, frame?: string) {
    this.node = mkNode(name, parent);
    this.sprite = this.node.addComponent(Sprite);
    this.ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sprite.trim = false;
    if (frame) this.set(frame);
  }

  get name(): string { return this.cur; }
  get w(): number { return this.fw; }
  get h(): number { return this.fh; }

  /** Show atlas frame `name` (anchor + size from atlas.json). `flash` uses the white silhouette twin. */
  set(name: string, flash = false): this {
    if (name === this.cur && flash === this.flashing) return this;
    const a = Atlas.inst;
    const r = a.rect(name);
    if (!r) { this.show(false); this.cur = name; return this; }
    const sf = (flash ? a.flash(name) : null) ?? a.frame(name);
    this.sprite.spriteFrame = sf;
    if (r.w !== this.fw || r.h !== this.fh) { this.ut.setContentSize(r.w, r.h); this.fw = r.w; this.fh = r.h; }
    if (this.ovr) this.ut.setAnchorPoint(this.ovr[0], this.ovr[1]); else this.ut.setAnchorPoint(r.anchorX, r.anchorY);
    this.cur = name; this.flashing = flash && !!a.flash(name);
    return this;
  }

  /** Use the solid white texture stretched to w×h (UI dims, fades, bar underlays). */
  solid(w: number, h: number, ax = 0, ay = 0): this {
    if (this.cur !== '#solid') { this.sprite.spriteFrame = Atlas.inst.solid; this.cur = '#solid'; }
    if (w !== this.fw || h !== this.fh) { this.ut.setContentSize(w, h); this.fw = w; this.fh = h; }
    this.ovr = [ax, ay];
    this.ut.setAnchorPoint(ax, ay);
    return this;
  }

  /** Stretch the current frame to a custom size (bars). */
  size(w: number, h: number): this {
    if (w !== this.fw || h !== this.fh) { this.ut.setContentSize(w, h); this.fw = w; this.fh = h; }
    return this;
  }
  /** Pin a custom anchor (kept across later set() calls). */
  anchor(ax: number, ay: number): this { this.ovr = [ax, ay]; this.ut.setAnchorPoint(ax, ay); return this; }

  pos(x: number, y: number): this {
    if (x !== this.lx || y !== this.ly) { this.node.setPosition(x, y, 0); this.lx = x; this.ly = y; }
    return this;
  }
  scale(sx: number, sy = sx): this {
    if (sx !== this.sx || sy !== this.sy) { this.node.setScale(sx, sy, 1); this.sx = sx; this.sy = sy; }
    return this;
  }
  show(v: boolean): this {
    if (v !== this.visible) { this.node.active = v; this.visible = v; }
    return this;
  }
  get shown(): boolean { return this.visible; }
  color(r: number, g: number, b: number, a = 255): this {
    if (r !== this.cr || g !== this.cg || b !== this.cb || a !== this.ca) {
      tmpColor.set(r, g, b, a); this.sprite.color = tmpColor;
      this.cr = r; this.cg = g; this.cb = b; this.ca = a;
    }
    return this;
  }
  alpha(a: number): this { return this.color(this.cr, this.cg, this.cb, Math.max(0, Math.min(255, Math.round(a)))); }
  angle(deg: number): this { this.node.angle = deg; return this; }
  fill(type: Sprite.FillType, start: number, range: number, center?: Vec2): this {
    this.sprite.type = Sprite.Type.FILLED;
    this.sprite.fillType = type;
    if (center) this.sprite.fillCenter = center;
    this.sprite.fillStart = start;
    this.sprite.fillRange = range;
    return this;
  }
  destroy(): void { this.node.destroy(); }
}

/** Generic object pool with explicit acquire/release, for nodes created once at startup and reused. */
export class Pool<T> {
  private free: T[] = [];
  readonly live = new Set<T>();
  constructor(private readonly make: () => T, private readonly onAcquire: (t: T) => void, private readonly onRelease: (t: T) => void) {}
  prewarm(n: number): void { for (let i = 0; i < n; i++) { const t = this.make(); this.onRelease(t); this.free.push(t); } }
  get(): T {
    const t = this.free.pop() ?? this.make();
    this.live.add(t); this.onAcquire(t);
    return t;
  }
  put(t: T): void {
    if (!this.live.delete(t)) return;
    this.onRelease(t); this.free.push(t);
  }
  get size(): number { return this.live.size; }
}

/** Hex colour '#rrggbb' → [r, g, b]. */
export function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
/** Palette (tools/art/pixel.mjs) colours used for tints. */
export const PAL = {
  k: hex('#1b1b2f'), n: hex('#2b2d52'), w: hex('#f6f2e6'), z: hex('#ffe27a'), y: hex('#f7a93b'), x: hex('#d9742b'),
  R: hex('#d14b4b'), r: hex('#8c2f39'), o: hex('#f28b6c'), D: hex('#7fd0f0'), E: hex('#d8f4ff'), C: hex('#3f7fd1'),
  M: hex('#8a4fb5'), L: hex('#d08be8'), m: hex('#4b2a6b'), d: hex('#7cc45a'), c: hex('#4c9a4a'), h: hex('#b98a56'),
  g: hex('#8a5a3c'), u: hex('#a3a9b8'), t: hex('#73798c'), i: hex('#e2c48a'), v: hex('#d6dae3'),
} as const;

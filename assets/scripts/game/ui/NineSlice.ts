// 9-slice panel built from 9 sprites cut from one atlas frame using its slice insets (atlas.json `slice` or the
// defaults in logic/atlasData). Corners keep their pixel size, edges/centre stretch, so panels of any size stay crisp.
import { Color, Sprite, UITransform, type Node, type SpriteFrame } from 'cc';
import { Atlas } from '../render/Atlas';
import { mkNode } from '../render/Nodes';

export class NineSlice {
  readonly node: Node;
  private parts: Array<{ node: Node; sprite: Sprite; ut: UITransform }> = [];
  private frameName = '';
  private frames: Array<SpriteFrame | null> = [];
  private insets: [number, number, number, number] = [0, 0, 0, 0];
  w = 0; h = 0;

  constructor(parent: Node | null, frame: string, w = 0, h = 0) {
    this.node = mkNode('nine', parent);
    for (let i = 0; i < 9; i++) {
      const n = mkNode(`p${i}`, this.node);
      const sprite = n.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      const ut = n.getComponent(UITransform) ?? n.addComponent(UITransform);
      ut.setAnchorPoint(0, 0);
      this.parts.push({ node: n, sprite, ut });
    }
    this.setFrame(frame);
    if (w && h) this.size(w, h);
  }

  setFrame(frame: string): this {
    if (frame === this.frameName) return this;
    this.frameName = frame;
    const a = Atlas.inst;
    const r = a.rect(frame);
    const nine = a.nine(frame);
    if (r && nine) {
      this.frames = nine; this.insets = r.slice!;
    } else {
      // no insets: stretch the whole frame in the centre cell
      const f = a.frame(frame);
      this.frames = [null, null, null, null, f, null, null, null, null]; this.insets = [0, 0, 0, 0];
    }
    for (let i = 0; i < 9; i++) this.parts[i].sprite.spriteFrame = this.frames[i];
    const w = this.w, h = this.h; this.w = -1;
    if (w > 0) this.size(w, h);
    return this;
  }

  /** Resize; the node's local origin is the panel's bottom-left corner. */
  size(w: number, h: number): this {
    w = Math.round(w); h = Math.round(h);
    if (w === this.w && h === this.h) return this;
    this.w = w; this.h = h;
    const [l, t, r, b] = this.insets;
    const cw = Math.max(0, w - l - r), ch = Math.max(0, h - t - b);
    const xs = [0, l, l + cw], ws = [l, cw, r];
    const ys = [h - t, b, 0], hs = [t, ch, b]; // rows top→bottom, y from bottom
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const p = this.parts[row * 3 + col];
      const vis = !!this.frames[row * 3 + col] && ws[col] > 0 && hs[row] > 0;
      p.node.active = vis;
      if (!vis) continue;
      p.ut.setContentSize(ws[col], hs[row]);
      p.node.setPosition(xs[col], ys[row], 0);
    }
    return this;
  }

  pos(x: number, y: number): this { this.node.setPosition(Math.round(x), Math.round(y), 0); return this; }
  show(v: boolean): this { if (this.node.active !== v) this.node.active = v; return this; }
  tint(r: number, g: number, b: number, a = 255): this {
    const c = new Color(r, g, b, a);
    for (const p of this.parts) p.sprite.color = c;
    return this;
  }
}

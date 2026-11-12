// Pooled event-driven effects (SPEC §9.8, §13.3): one-shot sprite animations, ballistic debris/shards, and damage
// numbers that pop up and fade. No node is created in the hot loop once the pools are warm.
import type { Node } from 'cc';
import { TILE } from '../logic/camera';
import { damageNumber, debris, DMG_NUMBER_SEC } from '../logic/juice';
import { Atlas } from './Atlas';
import { Pool, SpriteHandle } from './Nodes';

const WHITE = [255, 255, 255] as const;
import { BitmapText } from '../ui/BitmapText';

interface Anim {
  h: SpriteHandle; base: string; frames: number; fps: number; t: number; life: number; loop: boolean;
  x: number; y: number; vx: number; vy: number; g: number; spin: number; fade: boolean;
}
interface Num { txt: BitmapText; t: number; x: number; y: number; dur: number; big: boolean }

export interface AnimOpts {
  fps?: number; life?: number; loop?: boolean; scale?: number; tint?: readonly number[]; layer?: 'air' | 'floor';
  vx?: number; vy?: number; g?: number; spin?: number; fade?: boolean; dy?: number; angle?: number; frame?: number; alpha?: number;
}

export class FxPool {
  private anims: Anim[] = [];
  private nums: Num[] = [];
  private airPool: Pool<SpriteHandle>;
  private floorPool: Pool<SpriteHandle>;
  private numPool: Pool<BitmapText>;
  private handleLayer = new Map<SpriteHandle, 'air' | 'floor'>();

  constructor(readonly air: Node, readonly floor: Node, readonly top: Node) {
    this.airPool = new Pool(() => new SpriteHandle('fx', air), (h) => h.show(true), (h) => h.show(false));
    this.floorPool = new Pool(() => new SpriteHandle('fxf', floor), (h) => h.show(true), (h) => h.show(false));
    this.numPool = new Pool(() => new BitmapText(top, { font: 'font7', ax: 0.5, ay: 0, scalable: false }), (t) => t.show(true), (t) => t.show(false));
    this.airPool.prewarm(48); this.floorPool.prewarm(12); this.numPool.prewarm(24);
  }

  /** Play an animation `<base>_0..n` at tile position (x, y). */
  anim(base: string, x: number, y: number, o: AnimOpts = {}): void {
    if (this.anims.length > 220) return; // hard cap under heavy load
    const a = Atlas.inst;
    const frames = Math.max(1, a.count(base));
    const fps = o.fps ?? 12;
    const layer = o.layer ?? 'air';
    const h = (layer === 'air' ? this.airPool : this.floorPool).get();
    this.handleLayer.set(h, layer);
    const first = o.frame !== undefined ? o.frame : 0;
    h.set(a.anim(base, first)).scale(o.scale ?? 1).angle(o.angle ?? 0);
    const tint = o.tint ?? WHITE;
    h.color(tint[0], tint[1], tint[2], Math.round((o.alpha ?? 1) * 255));
    const px = x * TILE, py = -y * TILE + (o.dy ?? 0);
    h.pos(Math.round(px), Math.round(py));
    this.anims.push({
      h, base, frames, fps, t: 0, life: o.life ?? (o.loop ? 1 : frames / fps), loop: !!o.loop,
      x: px, y: py, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, spin: o.spin ?? 0, fade: o.fade ?? false,
    });
    if (o.frame !== undefined) this.anims[this.anims.length - 1].fps = 0;
  }

  /** Death burst: 4–6 shards in the unit's colour flying out with gravity. */
  shards(x: number, y: number, tint: readonly number[], count = 5, base = 'fx_chip_stone'): void {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const sp = 30 + Math.random() * 40;
      this.anim(base, x, y, {
        frame: i & 1, vx: Math.cos(ang) * sp, vy: 50 + Math.sin(ang) * sp * 0.6 + Math.random() * 30, g: 260,
        life: 0.55 + Math.random() * 0.2, tint, fade: true, dy: 6, spin: (Math.random() - 0.5) * 720,
      });
    }
  }

  /** Floating damage / info number at a tile position. */
  number(text: string, x: number, y: number, color: readonly number[], big = false, dur = DMG_NUMBER_SEC): void {
    if (this.nums.length > 60) { const old = this.nums.shift()!; this.numPool.put(old.txt); }
    const txt = this.numPool.get();
    txt.alpha(255).set(text, color);
    this.nums.push({ txt, t: 0, x: x * TILE + (Math.random() - 0.5) * 6, y: -y * TILE + 10, dur, big });
  }

  update(dt: number): void {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      if (a.t >= a.life) { this.release(i); continue; }
      if (a.fps > 0) {
        const f = Math.floor(a.t * a.fps);
        a.h.set(Atlas.inst.anim(a.base, a.loop ? f % a.frames : Math.min(a.frames - 1, f)));
      }
      if (a.vx || a.vy || a.g) {
        const d = debris(a.t, a.vx, a.vy, a.g);
        a.h.pos(Math.round(a.x + d.x), Math.round(a.y + d.y));
      }
      if (a.spin) a.h.angle(Math.round((a.spin * a.t) / 90) * 90);
      if (a.fade) a.h.alpha(255 * Math.min(1, (a.life - a.t) / (a.life * 0.4)));
    }
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      if (n.t >= n.dur) { this.numPool.put(n.txt); this.nums.splice(i, 1); continue; }
      const c = damageNumber(n.t, n.dur);
      const s = (n.big ? 1.5 : 1) * c.scale;
      n.txt.node.setScale(s, s, 1);
      n.txt.pos(Math.round(n.x), Math.round(n.y + c.dy)).alpha(c.alpha * 255);
    }
  }

  private release(i: number): void {
    const a = this.anims[i];
    const layer = this.handleLayer.get(a.h);
    a.h.angle(0).scale(1);
    (layer === 'floor' ? this.floorPool : this.airPool).put(a.h);
    this.anims.splice(i, 1);
  }

  clear(): void { for (let i = this.anims.length - 1; i >= 0; i--) this.release(i); for (const n of this.nums) this.numPool.put(n.txt); this.nums = []; }
}

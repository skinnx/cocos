// Juice (SPEC §9.8): hit flash, damage numbers, shake, hit-stop, debris, flying coins/resources, sprite FX.
import type { Atlas } from './atlas';
import { BitmapFont, COL } from './font';

interface SpriteFx { base: string; n: number; fps: number; x: number; y: number; t: number; loop: number; flip?: boolean; alpha?: number; follow?: () => { x: number; y: number } | null; above?: boolean }
interface Debris { name: string; sx: number; sy: number; w: number; h: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; life: number }
interface Num { text: string; color: string; size: 5 | 7; x: number; y: number; t: number; life: number; dx: number }
export interface Flyer { icon: string; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; delay: number; onArrive?: () => void; arc: number }
interface Banner { text: string; sub?: string; t: number; life: number; color: string }

export class Fx {
  sprites: SpriteFx[] = [];
  debris: Debris[] = [];
  nums: Num[] = [];
  flyers: Flyer[] = [];
  banners: Banner[] = [];
  flash = new Map<number, number>();     // uid -> seconds left (white flash)
  bounce = new Map<number, number>();    // building uid -> seconds since placed
  shakeT = 0; shakeAmp = 0;
  hitStop = 0;
  fade = 0; // screen fade-in (1 -> 0)
  hudPulse: Record<string, number> = {};

  constructor(private atlas: Atlas, private font: BitmapFont) {}

  anim(base: string, x: number, y: number, fps = 14, loop = 1, extra: Partial<SpriteFx> = {}) {
    const n = Math.max(1, this.atlas.count(base));
    if (!this.atlas.count(base)) this.atlas.get(`${base}_0`);
    if (this.sprites.length > 400) this.sprites.shift();
    this.sprites.push({ base, n, fps, x, y, t: 0, loop, ...extra });
  }
  number(text: string, x: number, y: number, color: string = COL.white, size: 5 | 7 = 7) {
    if (this.nums.length > 120) this.nums.shift();
    this.nums.push({ text, color, size, x, y, t: 0, life: 0.8, dx: (Math.random() - 0.5) * 8 });
  }
  shake(amp: number, dur = 0.25) { this.shakeAmp = Math.min(4, Math.max(this.shakeAmp, amp)); this.shakeT = Math.max(this.shakeT, dur); }
  stop(sec: number) { this.hitStop = Math.max(this.hitStop, sec); }
  hit(uid: number) { this.flash.set(uid, 0.08); }
  banner(text: string, sub?: string, color: string = COL.white, life = 2.2) { this.banners.push({ text, sub, t: 0, life, color }); }

  /** Breaks a sprite into 4–6 shards of its own pixels. */
  shatter(name: string, x: number, y: number, count = 5) {
    const f = this.atlas.frames[name];
    if (!f) return;
    for (let i = 0; i < count; i++) {
      const w = 3 + ((Math.random() * 3) | 0), h = 3 + ((Math.random() * 3) | 0);
      const sx = (Math.random() * Math.max(1, f.w - w)) | 0, sy = (Math.random() * Math.max(1, f.h - h)) | 0;
      const a = Math.random() * Math.PI * 2, sp = 15 + Math.random() * 30;
      if (this.debris.length > 500) this.debris.shift();
      this.debris.push({ name, sx, sy, w, h, x: x - f.ax + sx, y: y - f.ay + sy, z: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 40 + Math.random() * 40, t: 0, life: 0.6 + Math.random() * 0.3 });
    }
  }
  fly(icon: string, x0: number, y0: number, x1: number, y1: number, delay = 0, onArrive?: () => void) {
    if (this.flyers.length > 80) return;
    this.flyers.push({ icon, x0, y0, x1, y1, t: 0, dur: 0.55 + Math.random() * 0.2, delay, onArrive, arc: 20 + Math.random() * 20 });
  }
  pulse(key: string) { this.hudPulse[key] = 0.25; }

  update(dt: number) {
    for (const s of this.sprites) s.t += dt;
    this.sprites = this.sprites.filter((s) => s.loop <= 0 || s.t * s.fps < s.n * s.loop);
    for (const d of this.debris) {
      d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vz -= 220 * dt; d.z = Math.max(0, d.z + d.vz * dt);
      if (d.z === 0) { d.vx *= 0.8; d.vy *= 0.8; }
    }
    this.debris = this.debris.filter((d) => d.t < d.life);
    for (const n of this.nums) n.t += dt;
    this.nums = this.nums.filter((n) => n.t < n.life);
    for (const f of this.flyers) { f.t += dt; if (f.t - f.delay >= f.dur && f.onArrive) { f.onArrive(); f.onArrive = undefined; } }
    this.flyers = this.flyers.filter((f) => f.t - f.delay < f.dur);
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter((b) => b.t < b.life);
    for (const [k, v] of this.flash) { if (v - dt <= 0) this.flash.delete(k); else this.flash.set(k, v - dt); }
    for (const [k, v] of this.bounce) { if (v + dt > 0.4) this.bounce.delete(k); else this.bounce.set(k, v + dt); }
    this.shakeT = Math.max(0, this.shakeT - dt); if (!this.shakeT) this.shakeAmp = 0;
    this.fade = Math.max(0, this.fade - dt * 2.5);
    for (const k in this.hudPulse) this.hudPulse[k] = Math.max(0, this.hudPulse[k] - dt);
  }
  shakeOffset(t: number): [number, number] {
    if (!this.shakeT) return [0, 0];
    const a = this.shakeAmp * Math.min(1, this.shakeT / 0.15);
    return [Math.round(Math.sin(t * 91) * a), Math.round(Math.cos(t * 77) * a)];
  }
  bounceScale(uid: number): number {
    const t = this.bounce.get(uid);
    if (t === undefined) return 1;
    return 1 + 0.2 * Math.max(0, 1 - t / 0.25);
  }

  /** World-space FX (camera transform already applied). */
  drawWorld(ctx: CanvasRenderingContext2D, above: boolean) {
    for (const s of this.sprites) {
      if (!!s.above !== above) continue;
      let i = Math.floor(s.t * s.fps); if (s.loop <= 0) i %= s.n; else i = Math.min(s.n - 1, i % s.n);
      const p = s.follow ? s.follow() : null;
      if (s.follow && !p) continue;
      const x = p ? p.x : s.x, y = p ? p.y : s.y;
      this.atlas.draw(ctx, s.n > 1 || this.atlas.has(`${s.base}_0`) ? `${s.base}_${i}` : s.base, x, y, { flip: s.flip, alpha: s.alpha });
    }
    if (!above) return;
    for (const d of this.debris) this.atlas.drawPart(ctx, d.name, d.sx, d.sy, d.w, d.h, d.x, d.y - d.z, d.t > d.life - 0.2 ? (d.life - d.t) / 0.2 : 1);
  }
  drawNumbers(ctx: CanvasRenderingContext2D) {
    for (const n of this.nums) {
      const k = n.t / n.life;
      const rise = n.t < 0.15 ? n.t / 0.15 * 10 : 10 + (n.t - 0.15) * 6;
      this.font.draw(ctx, n.text, n.x + n.dx * k, n.y - rise, { color: n.color, size: n.size, align: 'center', alpha: k > 0.6 ? (1 - k) / 0.4 : 1 });
    }
  }
  /** Screen-space flyers: curved path to the HUD. */
  drawFlyers(ctx: CanvasRenderingContext2D) {
    for (const f of this.flyers) {
      const u = Math.max(0, (f.t - f.delay) / f.dur);
      if (f.t < f.delay) continue;
      const e = u * u * (3 - 2 * u);
      const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * u) * f.arc;
      this.atlas.drawC(ctx, f.icon, x, y);
    }
  }
}

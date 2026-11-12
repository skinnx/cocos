// SPEC §5 light: static sources (Hearth, burning braziers), dynamic leader lantern, fog of war,
// and the smoothed per-tile overlay alpha for the view.
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { CENTER } from './MapGen';
import { type World, type BuildingX, boonStacks, leader } from './World';

export const LIGHT_ALPHA = { lit: 0, dim: 0.45, dark: 0.85, fog: 1 };

export function hearthLightRadius(w: World): number {
  const base = BALANCE.light.hearth[w.s.hearthLevel - 1] + boonStacks(w, 'bigfire') * BOON_FX.bigfire;
  return base * w.s.buffs.hearthLightMul;
}

export function brazierRadius(b: BuildingX): number { return BALANCE.light.brazier[b.level >= 2 ? 1 : 0]; }

/** Whether a brazier currently burns (emits light). */
export function brazierBurning(w: World, b: BuildingX): boolean {
  if (b.id !== 'brazier' || b.dead) return false;
  if (b.snuffed || b.offT > 0 || b.constructing > 0) return false;
  if (w.s.phase === 'night' && !b.fueled) return false;
  return true;
}

function stamp(arr: Uint8Array, size: number, cx: number, cy: number, r: number): void {
  const R = r + BALANCE.light.dimBand;
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(size - 1, Math.floor(cx + R));
  const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(size - 1, Math.floor(cy + R));
  const r2 = r * r, R2 = R * R;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
    const i = y * size + x;
    if (d2 <= r2) arr[i] = 2; else if (d2 <= R2 && arr[i] < 1) arr[i] = 1;
  }
}

export function computeStaticLight(w: World): void {
  const sl = w.staticLight;
  if (w.s.buffs.falseDawnT > 0) { sl.fill(2); w.lightDirty = false; return; }
  sl.fill(0);
  stamp(sl, w.size, CENTER, CENTER, hearthLightRadius(w));
  for (const b of w.s.buildings as BuildingX[]) {
    const burning = b.id === 'brazier' ? brazierBurning(w, b) : false;
    if (b.id === 'brazier') {
      if (b.lit !== burning) { b.lit = burning; }
      if (burning) stamp(sl, w.size, b.x + 0.5, b.y + 0.5, brazierRadius(b));
    }
  }
  w.lightDirty = false;
}

/** Per-step: static + leader lantern → state.map.light; updates explored (fog). */
export function updateLight(w: World): void {
  if (w.lightDirty) computeStaticLight(w);
  const L = w.s.map.light, ex = w.s.map.explored, sl = w.staticLight, n = w.size;
  L.set(sl);
  for (let i = 0; i < n * n; i++) if (sl[i] > 0) ex[i] = 1;
  const ld = leader(w);
  if (ld) {
    const r = boonStacks(w, 'farlight') ? BALANCE.light.leaderFar : BALANCE.light.leader;
    stamp(L, n, ld.x, ld.y, r);
    const fr = Math.max(BALANCE.light.fogRadius, r);
    const x0 = Math.max(0, Math.floor(ld.x - fr)), x1 = Math.min(n - 1, Math.floor(ld.x + fr));
    const y0 = Math.max(0, Math.floor(ld.y - fr)), y1 = Math.min(n - 1, Math.floor(ld.y + fr));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - ld.x, dy = y + 0.5 - ld.y;
      if (dx * dx + dy * dy <= fr * fr) ex[y * n + x] = 1;
    }
  }
}

export function isNightVisual(w: World): boolean {
  const p = w.s.phase;
  return p === 'night' || p === 'dusk' || p === 'defeat';
}

/** Smooth the overlay alpha toward its target. `dt` is real seconds (runs even while the sim is paused). */
export function smoothLightAlpha(w: World, dt: number, instant = false): void {
  const A = w.s.map.lightAlpha, L = w.s.map.light, ex = w.s.map.explored;
  const night = isNightVisual(w);
  const rate = (LIGHT_ALPHA.dark / BALANCE.light.fadeSeconds) * dt;
  for (let i = 0; i < A.length; i++) {
    let target: number;
    if (!ex[i]) target = LIGHT_ALPHA.fog;
    else if (!night) target = 0;
    else target = L[i] === 2 ? LIGHT_ALPHA.lit : L[i] === 1 ? LIGHT_ALPHA.dim : LIGHT_ALPHA.dark;
    const a = A[i];
    if (instant) A[i] = target;
    else if (a < target) A[i] = Math.min(target, a + (target === LIGHT_ALPHA.fog ? 1 : rate));
    else if (a > target) A[i] = Math.max(target, a - (a === LIGHT_ALPHA.fog ? Math.max(rate, 0.12) : rate));
  }
}

/** Light level at a world position (0 dark, 1 dim, 2 lit). */
export function lightAt(w: World, x: number, y: number): number {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= w.size || cy >= w.size) return 0;
  return w.s.map.light[cy * w.size + cx];
}
export function staticLightAt(w: World, cx: number, cy: number): number {
  if (cx < 0 || cy < 0 || cx >= w.size || cy >= w.size) return 0;
  return w.staticLight[cy * w.size + cx];
}

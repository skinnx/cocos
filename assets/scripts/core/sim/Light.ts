// SPEC §5 light: static sources (Hearth, burning braziers), dynamic leader lantern, fog of war,
// and the smoothed per-tile overlay alpha for the view.
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { BUILDINGS } from '../data/buildings';
import { RESEARCH } from '../data/progression';
import { CENTER } from './MapGen';
import { type World, type BuildingX, boonStacks, leader, researchDone } from './World';

export const LIGHT_ALPHA = { lit: 0, dim: 0.45, dark: 0.85, fog: 1 };

/** Moon/weather modifier added to every light radius tonight (§8.4 new −1 / full +1, §8.6 rain −1 on braziers). */
export function moonLightMod(w: World): number {
  if (w.s.phase !== 'night') return 0;
  return w.s.moon === 'new' ? BALANCE.moon.newLight : w.s.moon === 'full' ? BALANCE.moon.fullLight : 0;
}

export function hearthLightRadius(w: World): number {
  const base = BALANCE.light.hearth[Math.max(0, Math.min(9, w.s.hearthTier - 1))] + boonStacks(w, 'bigfire') * BOON_FX.bigfire + moonLightMod(w);
  return Math.max(1, base * w.s.buffs.hearthLightMul);
}

export function brazierRadius(w: World, b: BuildingX): number {
  let r = BALANCE.light.brazier[Math.min(2, b.level - 1)];
  if (researchDone(w, 1, 1)) r += RESEARCH.brazierRadius;
  r += moonLightMod(w);
  if (w.s.phase === 'night' && w.s.nightEvent === 'rain') r += BALANCE.event.rainLight;
  if (w.s.zones.some((z) => z.kind === 'blizzard')) r *= 0.5;
  return Math.max(0.5, r);
}

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

function stampDim(arr: Uint8Array, size: number, cx: number, cy: number, r: number): void {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(size - 1, Math.floor(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(size - 1, Math.floor(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, i = y * size + x;
    if (dx * dx + dy * dy <= r * r && arr[i] < 1) arr[i] = 1;
  }
}

export function computeStaticLight(w: World): void {
  const sl = w.staticLight;
  if (w.s.buffs.falseDawnT > 0) { sl.fill(2); w.lightDirty = false; return; }
  sl.fill(0);
  stamp(sl, w.size, CENTER, CENTER, hearthLightRadius(w));
  const bs = w.s.buildings as BuildingX[];
  for (const b of bs) {
    if (b.id !== 'brazier') continue;
    const burning = brazierBurning(w, b);
    if (b.lit !== burning) b.lit = burning;
    if (burning) stamp(sl, w.size, b.x + 0.5, b.y + 0.5, brazierRadius(w, b));
  }
  // §5 rule 5: village buildings work only while their whole footprint is lit
  const n = w.size;
  for (const b of bs) {
    if (!BUILDINGS[b.id].village) { b.powered = !b.dead; continue; }
    let ok = !b.dead && b.constructing <= 0;
    for (let y = b.y; ok && y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (sl[y * n + x] < 2) { ok = false; break; }
    b.powered = ok;
  }
  w.lightDirty = false;
}

/** Per-step: static + leader lantern → state.map.light; updates explored (fog). */
export function updateLight(w: World): void {
  if (w.lightDirty) computeStaticLight(w);
  const L = w.s.map.light, ex = w.s.map.explored, sl = w.staticLight, n = w.size;
  L.set(sl);
  for (let i = 0; i < n * n; i++) if (sl[i] > 0) ex[i] = 1;
  // dynamic light: watchtowers (dim only), flares (lit), leader lantern
  for (const b of w.s.buildings as BuildingX[]) if (b.id === 'watchtower' && !b.dead && b.constructing <= 0) stampDim(L, n, b.x + 0.5, b.y + 0.5, BALANCE.light.watchtower);
  for (const z of w.s.zones) if (z.kind === 'flare') stamp(L, n, z.x, z.y, z.r || BALANCE.light.flare);
  const ld = leader(w);
  if (ld) {
    const r = Math.max(1, (boonStacks(w, 'farlight') ? BALANCE.light.leaderFar : BALANCE.light.leader) + moonLightMod(w));
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
  return p === 'night' || p === 'dusk';
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

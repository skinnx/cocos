// Shared helpers for ui2.mjs (v2 icons + Hold UI). Owner: art-ui. Not a sprite module (no default export).
// Builds on the v1 helpers (_ui_helpers.mjs) so v2 icons share the exact same drawing vocabulary.
import { Px, RAMPS } from '../pixel.mjs';
import { poly, thick, ring, disc, ringPanel } from './_ui_helpers.mjs';

export { poly, thick, ring, disc, ringPanel, RAMPS };
export const P = (w = 16, h = 16) => new Px(w, h);
// Draw on a fresh layer, optionally shade with a ramp, then stamp onto dst.
export const layer = (dst, draw, ramp) => { const l = P(dst.w, dst.h); draw(l); if (ramp) l.shade(ramp); return dst.stamp(l); };
// Hand-typed grid; rows may differ in length (right-padded with '.').
export function grid(rows) {
  const w = Math.max(...rows.map((r) => r.length));
  return Px.grid(rows.map((r) => r.padEnd(w, '.')));
}
// Stamp a (ragged) grid at (ox, oy).
export const put = (p, rows, ox = 0, oy = 0) => p.stamp(grid(rows), ox, oy);
// Centre a ragged grid in a w×h canvas (dx/dy nudge), no outline.
export function centred(rows, w = 16, h = 16, dx = 0, dy = 0) {
  const g = grid(rows); return P(w, h).stamp(g, Math.floor((w - g.w) / 2) + dx, Math.floor((h - g.h) / 2) + dy);
}
// Centred grid + 1px 'k' outline: the standard icon recipe.
export const icon = (rows, dx = 0, dy = 0) => centred(rows, 16, 16, dx, dy).outline();
export const out = (p) => p.outline();
// Palette swap (returns a new Px).
export function swap(p, map) { const q = p.clone(); for (const r of q.d) for (let x = 0; x < r.length; x++) if (map[r[x]]) r[x] = map[r[x]]; return q; }
// Small flame with base centre (cx, by), height ≈ 7·s. cols = [outer, mid, core].
export function flame(p, cx, by, s, cols = ['x', 'y', 'z']) {
  poly(p, [[cx - 2.6 * s, by - 2.2 * s], [cx, by - 7 * s], [cx + 2.6 * s, by - 2.2 * s]], cols[0]);
  p.ellipse(cx, by - 2.2 * s, 2.6 * s, 2.2 * s, cols[0]);
  poly(p, [[cx - 1.5 * s, by - 1.8 * s], [cx, by - 5 * s], [cx + 1.5 * s, by - 1.8 * s]], cols[1]);
  p.ellipse(cx, by - 1.8 * s, 1.5 * s, 1.5 * s, cols[1]);
  if (s >= 0.9) p.ellipse(cx, by - 1.4 * s, 0.8 * s, 0.9 * s, cols[2]);
  return p;
}
// n-point star polygon centred at (cx, cy) (pixel-edge coordinates), first point straight up.
export function starPts(cx, cy, R, r, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n, d = i % 2 ? r : R; pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); }
  return pts;
}
// Moon disc: lit fraction via a terminator ellipse. k ∈ [-1, 1]: pixel lit when side·xn > k·√(1−yn²).
// side = +1 lights the right (waxing), −1 the left (waning). cols = { lit, hi, lo, dark, rim, crater }.
export function moonDisc(p, cx, cy, R, k, side, cols) {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const xn = (x + 0.5 - cx) / R, yn = (y + 0.5 - cy) / R, d = xn * xn + yn * yn;
    if (d > 1) continue;
    const lit = side * xn > k * Math.sqrt(Math.max(0, 1 - yn * yn));
    let c = lit ? cols.lit : cols.dark;
    if (lit) { if (xn + yn < -0.75 && d > 0.45) c = cols.hi; else if (xn + yn > 0.8 && d > 0.5) c = cols.lo; }
    else if (cols.rim && d > 0.72 && side * xn < 0 && xn + yn < 0.2) c = cols.rim;
    p.set(x, y, c);
  }
  return p;
}
// 9-slice-friendly rounded panel from rings; re-exported for clarity at call sites.
export const panel = (w, h, rings, fill, radius = 2, opts) => ringPanel(w, h, rings, fill, radius, opts);
// Rim descriptor: lit top/left, shadowed bottom/right.
export const rim = (hi, mid, lo) => ({ t: hi, l: hi, b: lo, r: lo, m: mid });

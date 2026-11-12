// Helpers for the v2 terrain module (world2_terrain.mjs): edge-overlay masks and painters (same convention and
// geometry as tools/art/sprites/tiles.mjs: 5 px deep at the tile border, organic, no outline) plus small prop
// shading helpers mirroring props.mjs. Pure functions over Px canvases; nothing touches the filesystem.
import { Px, hash, boundaryDist } from './_world_helpers.mjs';

export const S = 16; // tile size
export const D = 5;  // edge band depth at the tile border (must match tiles.mjs so v1 and v2 pieces chain)

// ── edge masks (boolean S×S grids) ─────────────────────────────────────────────
export const mk = () => Array.from({ length: S }, () => Array(S).fill(false));
export const rot = (m) => { const o = mk(); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) o[y][x] = m[S - 1 - x][y]; return o; }; // 90° cw
export const union = (a, b) => a.map((r, y) => r.map((v, x) => v || b[y][x]));
export function bandN(prof) { const m = mk(); for (let x = 0; x < S; x++) for (let y = 0; y < prof[x]; y++) m[y][x] = true; return m; }
export function cornerNE(wob) { // quarter blob around the tile's top-right corner, radius D at both borders
  const m = mk();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = 16 - (x + 0.5), dy = y + 0.5, th = Math.atan2(dy, dx);
    if (Math.hypot(dx, dy) < D + 0.3 + wob * Math.sin(2 * th)) m[y][x] = true;
  }
  return m;
}
export function innerNE(prof) { // N band ∪ E band + rounded concave fillet
  const m = union(bandN(prof), rot(bandN(prof)));
  const r = 3, cx = 16 - D - r, cy = D + r;
  for (let y = D - 1; y < D + r; y++) for (let x = 16 - D - r; x < 16 - D + 1; x++)
    if (x >= 0 && y < S && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r + 0.2) m[y][x] = true;
  return m;
}
// All 12 pieces from one north profile + corner wobble, in manifest order.
export function edgeMasks(prof, wob) {
  const n = bandN(prof), ne = cornerNE(wob), ine = innerNE(prof);
  const r1 = rot, r2 = (m) => rot(rot(m)), r3 = (m) => rot(rot(rot(m)));
  return { n, e: r1(n), s: r2(n), w: r3(n), ne, se: r1(ne), sw: r2(ne), nw: r3(ne), ine, ise: r1(ine), isw: r2(ine), inw: r3(ine) };
}

// Paint the upper material through `mask`; border pixels of the patch get edgeHi (top/left) / edgeLo (bottom/right)
// (null = keep the fill colour); rimOut / rimOutLit go on the lower side just below-right / above-left of the patch.
export function paintEdge(mask, upper, { rimOut = null, rimOutLit = null, hi = null, lo = null } = {}) {
  const p = new Px(S, S);
  const U = (x, y) => x >= 0 && y >= 0 && x < S && y < S && mask[y][x];
  const lowAt = (x, y) => x >= 0 && y >= 0 && x < S && y < S && !mask[y][x];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!U(x, y)) continue;
    let c = upper.d[y][x];
    if (lo && (lowAt(x, y + 1) || lowAt(x + 1, y))) c = lo; else if (hi && (lowAt(x, y - 1) || lowAt(x - 1, y))) c = hi;
    p.set(x, y, c);
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (U(x, y)) continue;
    if (rimOut && (U(x, y - 1) || U(x - 1, y))) p.set(x, y, rimOut);
    else if (rimOutLit && (U(x, y + 1) || U(x + 1, y))) p.set(x, y, rimOutLit);
  }
  return p;
}

// Snow drift seam: a drift lip (done by paintEdge), loose snow clumps just outside the drift, and the lower ground
// poking through thin snow just inside it. Tile-border rows/columns are left alone so pieces chain.
export function snowSeam(p, mask, { poke, pokeHi, seed }) {
  const dist = boundaryDist(mask);
  let clumps = 0;
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    const h = hash(x, y, seed), d = dist[y][x];
    if (mask[y][x]) {
      if (d === 2 && h < 0.13) { p.set(x, y, poke); if (pokeHi && mask[y - 1][x] && dist[y - 1][x] >= 2) p.set(x, y - 1, pokeHi); }
    } else if (d === 2 && h < 0.16 && clumps < 3 && !mask[y][x + 1] && x < S - 2) { // a clump: lit pixel + its own small shadow
      p.set(x, y, 'w'); if (dist[y][x + 1] >= 2) p.set(x + 1, y, 'v'); clumps++;
    } else if (d === 3 && h < 0.05) p.set(x, y, 'v');
  }
  // small pieces (outer corners) may get no poke from the hash: put one at the deepest interior pixel
  if (!p.d.some((r) => r.includes(poke))) {
    let best = null;
    for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) if (mask[y][x] && dist[y][x] < 99 && (!best || dist[y][x] > best[2])) best = [x, y, dist[y][x]];
    if (best) p.set(best[0], best[1], poke);
  }
  return p;
}
// Burnt seam: ash frays into the lower ground through a singed fringe — holes along the ash border, a scorched ring
// (singe colours) just outside it fading over 3 px, and a few drifted ash flecks further out.
export function scorchSeam(p, mask, { singe, singe2, fleck, seed }) {
  const dist = boundaryDist(mask);
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    const h = hash(x, y, seed), d = dist[y][x];
    if (mask[y][x]) { if (d === 1 && h < 0.22) p.set(x, y, singe[0]); }
    else if (d === 1) { if (h < 0.75) p.set(x, y, h < 0.4 ? singe[0] : singe[1]); }
    else if (d === 2 && h < 0.4) p.set(x, y, h < 0.12 ? fleck : singe2);
    else if (d === 3 && h < 0.08) p.set(x, y, fleck);
  }
  return p;
}
// Ruin flagstones breaking up onto the ground (same recipe as tiles.mjs brokenSlabs).
export function brokenSlabs(p, mask, low, seed) {
  const dist = boundaryDist(mask);
  let frags = 0;
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    const h = hash(x, y, seed), d = dist[y][x];
    if (mask[y][x]) {
      if (d === 1 && h < 0.2) p.set(x, y, low.base);
      else if (d <= 2 && p.get(x, y) === 's' && h < 0.6) p.set(x, y, low.blade);
      else if (d === 2 && h > 0.88) p.set(x, y, 's');
    } else if (d === 2 && frags < 2 && x < S - 2 && !mask[y][x + 1] && dist[y][x + 1] >= 2 && h < 0.12) {
      p.set(x, y, 'u').set(x + 1, y, 't'); if (y + 1 < S - 1 && !mask[y + 1][x]) p.set(x, y + 1, low.shadow);
      frags++;
    } else if (d === 3 && h < 0.04) p.set(x, y, 't');
  }
  return p;
}

// ── prop helpers (mirrors of the unexported ones in props.mjs) ─────────────────
// Per-pixel top-left light inside an ellipse frame over pixels of `mid` (or any of `on`).
export function volume(p, cx, cy, rx, ry, [lo, mid, hi], { on = null, hiT = -0.55, loT = 0.45 } = {}) {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = p.get(x, y); if (c === '.' || (on ? !on.includes(c) : c !== mid)) continue;
    const t = ((x + 0.5 - cx) / rx) * 0.6 + ((y + 0.5 - cy) / ry) * 0.8;
    p.set(x, y, t < hiT ? hi : t > loT ? lo : mid);
  }
  return p;
}
// Knock corners off a boxy silhouette (before outline).
export function chamfer(p, x0, y0, x1, y1, n = 2) {
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) { p.set(x0 + i, y0 + j, '.'); p.set(x1 - i, y0 + j, '.'); p.set(x0 + i, y1 - j, '.'); p.set(x1 - i, y1 - j, '.'); }
  return p;
}
// Recolour every pixel through a char→char map (chars not in the map are kept).
export function remap(p, map) { for (const r of p.d) for (let x = 0; x < r.length; x++) if (map[r[x]]) r[x] = map[r[x]]; return p; }
// Wrapped horizontal distance (for seamless horizontally-tiling sprites).
export const wdx = (a, b, w = S) => { const d = Math.abs(a - b) % w; return Math.min(d, w - d); };

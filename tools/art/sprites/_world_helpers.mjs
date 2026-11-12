// Shared helpers for the art-world sprite modules (tiles, props, buildings).
// Pure functions over Px canvases from ../pixel.mjs; nothing here touches the filesystem.
import { Px, RAMPS } from '../pixel.mjs';

export { Px, RAMPS };

// Deterministic hash → [0,1). Used for every "random" choice so builds are reproducible.
export function hash(...v) {
  let n = 0x9e3779b9;
  for (const x of v) { n = Math.imul(n ^ (x | 0), 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; }
  return (n >>> 0) / 4294967296;
}
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Wrapped set (seamless tiles).
export function wset(p, x, y, c) { p.d[((y % p.h) + p.h) % p.h][((x % p.w) + p.w) % p.w] = c; return p; }
export function wget(p, x, y) { return p.d[((y % p.h) + p.h) % p.h][((x % p.w) + p.w) % p.w]; }
// Wrapped copy shifted by dx,dy (water frames).
export function wshift(p, dx, dy) { const o = new Px(p.w, p.h); for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) wset(o, x + dx, y + dy, p.d[y][x]); return o; }

// Set only over opaque pixels (or only over a given colour set).
export function over(p, x, y, c, on) { const cur = p.get(x, y); if (cur === '.') return p; if (on && !on.includes(cur)) return p; return p.set(x, y, c); }
// Paint every pixel of colour `from` that is in rect with `to`.
export function recolorRect(p, x0, y0, w, h, from, to) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (p.get(x, y) === from) p.set(x, y, to); return p; }
// For a boolean mask (rows of booleans): Chebyshev distance (≤ r, else 99) from every cell to the nearest cell with the
// opposite value, looking only inside the mask. Used by edge overlays to fray / decorate a patch's border.
export function boundaryDist(mask, r = 3) {
  const h = mask.length, w = mask[0].length;
  const dist = Array.from({ length: h }, () => Array(w).fill(99));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const X = x + i, Y = y + j;
      if (X < 0 || Y < 0 || X >= w || Y >= h || mask[Y][X] === mask[y][x]) continue;
      dist[y][x] = Math.min(dist[y][x], Math.max(Math.abs(i), Math.abs(j)));
    }
  return dist;
}
// Pixels list helper.
export function dots(p, pts, c) { for (const [x, y] of pts) p.set(x, y, c); return p; }

// Generic face shading on an arbitrary filled region of colour `mid`: pixels whose
// neighbour (outside the region: different colour) is above/left become `hi`,
// below/right become `lo`. Unlike Px.shade it treats ANY non-`mid` pixel as boundary.
export function shadeRegion(p, mid, lo, hi, { only } = {}) {
  const src = p.clone();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (src.d[y][x] !== mid) continue;
    const diff = (i, j) => { const c = src.get(x + i, y + j); return only ? only.includes(c) : c !== mid; };
    if (diff(0, 1) || diff(1, 0)) p.d[y][x] = lo; else if (diff(0, -1) || diff(-1, 0)) p.d[y][x] = hi;
  }
  return p;
}

// Outline but with sides that must stay open (auto-tiling joins). `open` = {l,r,t,b} pixel bands
// that are cleared after outlining. Simpler: we draw on a padded canvas and crop.
export function outlineCrop(p, x, y, w, h, c = 'k') { return p.outline(c).crop(x, y, w, h); }

// Inner outline: draw `c` on pixels of `p` that border `.` — used to give stacked parts their own outline.
export function innerEdge(p, c, test) {
  const src = p.clone();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const v = src.d[y][x]; if (v === '.' || (test && !test(v))) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => src.get(x + i, y + j) === '.')) p.d[y][x] = c;
  }
  return p;
}

// ¾ view block: top face (light) + front face (mid) with a dark right column and dark base row.
// x,y = top-left of the top face on screen; w wide; td = top-face depth; fh = front-face height.
export function block(p, x, y, w, td, fh, ramp, { rim = true, topHi = null } = {}) {
  const [lo, mid, hi] = ramp;
  p.rect(x, y, w, td, hi);
  p.rect(x, y + td, w, fh, mid);
  if (rim) { p.rect(x + w - 1, y + td, 1, fh, lo); p.rect(x, y + td + fh - 1, w, 1, lo); }
  if (topHi) { p.rect(x, y, w, 1, topHi); p.rect(x, y, 1, td, topHi); }
  return p;
}

// Soft ground shadow drawn in 'n' (rendered at alpha by the game when it is a separate sprite;
// inside a building sprite it is an opaque contact shadow kept small).
export function contactShadow(p, cx, cy, rx, ry, c = 'n') {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && p.get(x, y) === '.') p.set(x, y, c);
  return p;
}

// ── Fire ────────────────────────────────────────────────────────────────────────
// Multi-tongue flame. Several teardrop tongues of different heights merge into one jagged silhouette;
// every tongue's height and lean cycle with `phase` (0..3) at its own offset, so 4 frames loop and the
// fire visibly licks rather than scaling. Layers: outer `x`, body `y`, core `z` (+ optional `w` heart).
// cx = centre column (may be .5), by = bottom row, hw = half-width of the whole fire, h = max height.
export function flame(p, cx, by, hw, h, phase, { tongues = 3, core = true, heart = false } = {}) {
  const ph = (phase % 4) * (Math.PI / 2);
  const T = [];
  for (let i = 0; i < tongues; i++) {
    const u = tongues === 1 ? 0 : (i / (tongues - 1)) * 2 - 1; // -1..1 across the fire
    const centre = 1 - Math.abs(u) * 0.45;
    T.push({
      x: cx + u * hw * 0.55,
      w: hw * (tongues === 1 ? 1 : 0.62) * (0.8 + 0.2 * centre),
      h: h * centre * (0.86 + 0.14 * Math.sin(ph + i * 2.3)),
      lean: Math.sin(ph * 1 + i * 1.7) * 1.6 + u * 1.2,
    });
  }
  const tongue = (t, sw, sh, c, dy = 0) => {
    const H = t.h * sh, W = t.w * sw;
    for (let y = 0; y <= Math.ceil(H); y++) {
      const k = y / H; if (k > 1) break;
      const half = W * Math.pow(1 - k, 0.75) * Math.min(1, 0.65 + k * 2.2);
      const xc = t.x + t.lean * k * k * sh;
      for (let x = Math.floor(xc - half); x <= Math.ceil(xc + half); x++) if (Math.abs(x + 0.5 - xc) <= half) p.set(x, by - y - dy, c);
    }
  };
  T.forEach((t) => tongue(t, 1, 1, 'x'));
  T.forEach((t) => tongue(t, 0.66, 0.72, 'y'));
  if (core) T.filter((_, i) => tongues < 3 || (i > 0 && i < tongues - 1)).forEach((t) => tongue(t, 0.4, 0.42, 'z'));
  if (heart) { p.set(Math.round(cx - 0.5), by - 2, 'w'); p.set(Math.round(cx + 0.5), by - 3, 'w'); }
  return p;
}

// Thick line (for bars, ballista arms, cracks).
export function thick(p, x0, y0, x1, y1, c, w = 1) {
  for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) p.line(Math.round(x0) + i, Math.round(y0) + j, Math.round(x1) + i, Math.round(y1) + j, c);
  return p;
}

// Count opaque bounding box (debug helper).
export function bbox(p) { let a = 1e9, b = 1e9, c = -1, d = -1; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[y][x] !== '.') { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return { x: a, y: b, w: c - a + 1, h: d - b + 1 }; }

// Place `src` onto a fresh canvas of w×h with its content bottom-aligned at row h-1-mb and centred.
export function fit(src, w, h, mb = 0) {
  const b = bbox(src); const o = new Px(w, h);
  return o.stamp(src.crop(b.x, b.y, b.w, b.h), Math.floor((w - b.w) / 2), h - mb - b.h);
}

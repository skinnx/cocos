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
// Layered flame: tongues whose heights wobble with `phase` (0..3). Outer x, mid y, core z.
// cx = centre column (may be .5), by = bottom row, w = half-width at base, h = height.
export function flame(p, cx, by, hw, h, phase, { tongues = 3, core = true, sparks = true, outer = 'x', mid = 'y', inner = 'z' } = {}) {
  const ph = (phase % 4) * (Math.PI / 2);
  const layer = (scale, c, hshift) => {
    const H = h * scale, W = hw * scale;
    for (let y = 0; y < Math.ceil(H) + 1; y++) {
      const t = y / H; if (t > 1) break;
      // body tapers; tongues add flicker in the upper half
      let half = W * Math.sqrt(Math.max(0, 1 - t)) * (1 - 0.35 * t);
      const lean = Math.sin(ph + t * 3.2) * t * hw * 0.35;
      const yy = by - y - hshift;
      for (let x = Math.floor(cx - half + lean - 0.5); x <= Math.ceil(cx + half + lean - 0.5); x++) {
        const px = x + 0.5 - (cx + lean);
        if (Math.abs(px) <= half + 0.01) p.set(x, yy, c);
      }
    }
  };
  layer(1, outer, 0);
  // tongues: thin licks above the body, heights cycle with phase
  for (let i = 0; i < tongues; i++) {
    const off = (i - (tongues - 1) / 2) * (hw * 0.75);
    const th = Math.round(h * (0.25 + 0.2 * Math.sin(ph + i * 2.1)) );
    const x = Math.round(cx - 0.5 + off + Math.sin(ph + i) * 0.6);
    const base = by - Math.round(h * (0.55 - 0.15 * Math.abs(off) / Math.max(1, hw)));
    for (let k = 0; k < th; k++) p.set(x + (k > th / 2 ? Math.round(Math.sin(ph + i * 1.7)) : 0), base - k, outer);
  }
  layer(0.72, mid, 0);
  if (core) layer(0.42, inner, 0);
  if (sparks) {
    const s = rng(phase * 31 + Math.round(cx * 7));
    for (let i = 0; i < 2; i++) { const sx = Math.round(cx - 0.5 + (s() - 0.5) * hw * 2.2); const sy = by - h - 1 - Math.floor(s() * 3) - ((phase + i) % 2); p.set(sx, sy, i ? mid : inner); }
  }
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

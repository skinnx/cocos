// Zero-dependency pixel-art toolkit (Node >= 18). Seed for the game's art pipeline.
// Sprites are drawn in an indexed canvas (1 char = 1 palette colour), then exported as PNG.
// Usage: see tools/art/anchors.mjs. Rules for using it: SPEC.md §9.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// ── Master palette (SPEC §9.2). One char per colour. '.' = transparent. ─────────────
export const PALETTE = {
  k: '#1b1b2f', n: '#2b2d52',                                       // outline, deep shadow
  a: '#1f4a3a', b: '#2f6b3a', c: '#4c9a4a', d: '#7cc45a', e: '#b4e06e', // greens
  f: '#5a3a2e', g: '#8a5a3c', h: '#b98a56', i: '#e2c48a',           // earth / wood / sand
  s: '#4a4e63', t: '#73798c', u: '#a3a9b8', v: '#d6dae3',           // stone / steel
  p: '#c9825b', q: '#f2c69a',                                       // skin
  r: '#8c2f39', R: '#d14b4b', o: '#f28b6c',                         // reds
  x: '#d9742b', y: '#f7a93b', z: '#ffe27a',                         // fire / gold
  B: '#2a4a8a', C: '#3f7fd1', D: '#7fd0f0', E: '#d8f4ff',           // blues
  m: '#4b2a6b', M: '#8a4fb5', L: '#d08be8',                         // purples (the Gloom)
  H: '#e86a92', w: '#f6f2e6',                                       // pink, off-white
};
// Shading ramps: [shadow, base, highlight]. Used by Px.shade().
export const RAMPS = {
  grass: ['b', 'c', 'd'], leaf: ['a', 'b', 'c'], wood: ['f', 'g', 'h'], sand: ['g', 'h', 'i'],
  stone: ['s', 't', 'u'], steel: ['t', 'u', 'v'], red: ['r', 'R', 'o'], fire: ['x', 'y', 'z'],
  blue: ['B', 'C', 'D'], ice: ['C', 'D', 'E'], gloom: ['m', 'M', 'L'], skin: ['p', 'q', 'q'],
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export class Px {
  constructor(w, h, fill = '.') {
    this.w = w; this.h = h;
    this.d = Array.from({ length: h }, () => Array(w).fill(fill));
  }
  static grid(rows) { // build from an array of equal-length strings
    const w = rows[0].length;
    rows.forEach((r, i) => { if (r.length !== w) throw new Error(`row ${i} is ${r.length} wide, expected ${w}: "${r}"`); });
    const p = new Px(w, rows.length);
    rows.forEach((r, y) => [...r].forEach((ch, x) => p.set(x, y, ch)));
    return p;
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.d[y][x] : '.'; }
  set(x, y, c) {
    if (!this.in(x, y)) return this;
    if (c !== '.' && !PALETTE[c]) throw new Error(`unknown palette char "${c}"`);
    this.d[y][x] = c; return this;
  }
  clone() { const p = new Px(this.w, this.h); p.d = this.d.map((r) => [...r]); return p; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
  ellipse(cx, cy, rx, ry, c) { // filled, pixel-centre sampled; cx/cy may be .5 for even sizes
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, c);
    return this;
  }
  line(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    return this;
  }
  stamp(src, ox = 0, oy = 0) { // '.' in src leaves destination untouched
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.d[y][x]; if (c !== '.') this.set(ox + x, oy + y, c); }
    return this;
  }
  crop(x, y, w, h) { const p = new Px(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.d[j][i] = this.get(x + i, y + j); return p; }
  mirrorX() { const p = this.clone(); p.d = p.d.map((r) => [...r].reverse()); return p; }
  shift(dx, dy) { return new Px(this.w, this.h).stamp(this, dx, dy); }
  replace(from, to) { for (const r of this.d) for (let x = 0; x < r.length; x++) if (r[x] === from) r[x] = to; return this; }
  // Speckle `c` over pixels currently equal to `on` with a deterministic hash (texture: grass tufts, brick wear).
  speckle(on, c, density, seed = 1) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      let n = (x * 374761393 + y * 668265263 + seed * 974711) | 0; n = (n ^ (n >>> 13)) * 1274126177; n = (n ^ (n >>> 16)) >>> 0;
      if (this.d[y][x] === on && n / 4294967296 < density) this.d[y][x] = c;
    }
    return this;
  }
  // Light from top-left: base pixels on an upper/left silhouette edge become highlight,
  // on a lower/right edge become shadow. Call BEFORE outline().
  shade(ramp) {
    const [lo, mid, hi] = ramp; const src = this.clone();
    const open = (x, y) => src.get(x, y) === '.';
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src.d[y][x] !== mid) continue;
      if (open(x, y + 1) || open(x + 1, y)) this.d[y][x] = lo;
      else if (open(x, y - 1) || open(x - 1, y)) this.d[y][x] = hi;
    }
    return this;
  }
  // 1px outline in transparent pixels touching the silhouette (4-neighbour). Canvas must leave a 1px margin.
  outline(c = 'k') {
    const src = this.clone();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src.d[y][x] !== '.') continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => src.get(x + i, y + j) !== '.')) this.d[y][x] = c;
    }
    return this;
  }
  rgba(scale = 1) {
    const W = this.w * scale, H = this.h * scale, out = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = this.d[(y / scale) | 0][(x / scale) | 0]; if (c === '.') continue;
      const [r, g, b] = hex(PALETTE[c]); out.set([r, g, b, 255], (y * W + x) * 4);
    }
    return { w: W, h: H, data: out };
  }
  save(path, scale = 1) { const { w, h, data } = this.rgba(scale); writePNG(path, w, h, data); return this; }
}

// ── Art lint (SPEC §9.6): rejects "programmer art" — flat squares/circles. ─────────
// kind: 'unit' | 'building' | 'wall' (auto-tiling, rectangular by nature) | 'prop' | 'tile' | 'icon' | 'fx'
export function lint(name, px, kind = 'unit') {
  const issues = []; const colors = new Set(); let opaque = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, edge = 0, edgeDark = 0;
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    const c = px.d[y][x]; if (c === '.') continue;
    opaque++; colors.add(c); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => px.get(x + i, y + j) === '.')) { edge++; if (c === 'k' || c === 'n') edgeDark++; }
  }
  if (!opaque) return [`${name}: empty sprite`];
  const fill = opaque / ((maxX - minX + 1) * (maxY - minY + 1));
  const minColors = { unit: 6, building: 6, wall: 5, prop: 5, tile: 3, icon: 4, fx: 2 }[kind];
  if (colors.size < minColors) issues.push(`${name}: only ${colors.size} colours (min ${minColors} for ${kind})`);
  if (kind !== 'tile' && kind !== 'fx') {
    if (kind !== 'wall' && fill > 0.9) issues.push(`${name}: silhouette fills ${(fill * 100) | 0}% of its bounding box (looks like a plain rectangle)`);
    if (edgeDark / edge < 0.85) issues.push(`${name}: outline covers only ${((edgeDark / edge) * 100) | 0}% of the silhouette edge (min 85%)`);
  }
  return issues;
}

// ── Contact sheet: every sprite at `scale`x on a neutral background, for visual review. ─
export function sheet(path, entries, { scale = 8, cols = 6, pad = 2, bg = '#3a3f55' } = {}) {
  const cw = Math.max(...entries.map((e) => e.px.w)) + pad * 2, ch = Math.max(...entries.map((e) => e.px.h)) + pad * 2;
  const rows = Math.ceil(entries.length / cols), W = cw * cols * scale, H = ch * rows * scale, out = Buffer.alloc(W * H * 4);
  const [br, bgc, bb] = hex(bg);
  for (let i = 0; i < W * H; i++) out.set([br, bgc, bb, 255], i * 4);
  entries.forEach((e, n) => {
    const ox = ((n % cols) * cw + ((cw - e.px.w) >> 1)) * scale, oy = (((n / cols) | 0) * ch + (ch - e.px.h - pad)) * scale;
    const { w, h, data } = e.px.rgba(scale);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (y * w + x) * 4; if (data[s + 3]) out.set(data.subarray(s, s + 4), ((oy + y) * W + ox + x) * 4); }
  });
  writePNG(path, W, H, out);
}

// ── Minimal PNG encoder (RGBA8, no deps). ───────────────────────────────────────────
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}
export function writePNG(path, w, h, rgba) {
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

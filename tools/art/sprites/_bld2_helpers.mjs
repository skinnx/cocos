// Helpers for world2_buildings.mjs (owner: art-buildings). Pure functions over Px canvases.
// Most shape helpers mirror the private helpers of buildings.mjs (v1) so v2 buildings share one hand:
// same ¾ projection, same roof/brick/banner language, same light from the top-left.
import { Px } from '../pixel.mjs';
import { hash, dots, flame } from './_world_helpers.mjs';

export { Px, hash, dots, flame };

// ── v1 shape language ─────────────────────────────────────────────────────────
// Elliptic cylinder (dais, bowls, barrels seen ¾): top ellipse at centre (cx, cy), front wall h tall.
export function cyl(p, cx, cy, rx, ry, h, [lo, mid, hi], { top = hi, rim = null, band = null } = {}) {
  p.ellipse(cx, cy + h, rx, ry, mid); p.rect(Math.ceil(cx - rx), cy, Math.floor(rx * 2) + (Number.isInteger(cx) ? 1 : 0), h, mid);
  for (let y = Math.floor(cy); y <= Math.ceil(cy + h + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    if (p.get(x, y) !== mid) continue;
    const t = (x + 0.5 - cx) / rx;
    if (t > 0.45) p.set(x, y, lo); else if (t < -0.7) p.set(x, y, hi);
  }
  if (band) for (const [by, c] of band) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const t = (x + 0.5 - cx) / rx; if (Math.abs(t) > 1) continue;
    const yy = Math.round(cy + by + ry * Math.sqrt(1 - t * t));
    if (p.get(x, yy) !== '.') p.set(x, yy, t > 0.45 && c.length > 1 ? c[1] : c[0]);
  }
  p.ellipse(cx, cy, rx, ry, top);
  if (rim) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (p.get(x, y) !== top) continue;
      const inner = (((x + 0.5 - cx) / (rx - 1.2)) ** 2 + ((y + 0.5 - cy) / (ry - 1)) ** 2) <= 1;
      if (!inner) p.set(x, y, y + 0.5 < cy ? rim[1] : rim[0]);
    }
  }
  return p;
}
// Gable roof facing the viewer (¾): shingle courses, light ridge, dark eave, chamfered top corners.
export function roof(p, x, y, w, h, [lo, mid, hi], { ridge = hi, eave = 'k' } = {}) {
  for (let j = 0; j < h; j++) {
    const inset = j === 0 ? 2 : j === 1 ? 1 : 0;
    for (let i = inset; i < w - inset; i++) {
      let c = mid;
      if (j === 0) c = ridge; else if ((j % 2) === 0) c = ((i + (j % 4 ? 1 : 0)) % 3 === 0) ? lo : mid;
      else c = (i % 3 === (j % 4 === 1 ? 0 : 2)) ? lo : mid;
      if (i === inset && j > 0) c = hi;
      if (i === w - 1 - inset && j > 0) c = lo;
      p.set(x + i, y + j, c);
    }
  }
  for (let i = 0; i < w; i++) p.set(x + i, y + h, eave === 'k' ? lo : eave);
  return p;
}
// Thatch roof: vertical straw strands, ragged eave.
export function thatch(p, x, y, w, h) {
  for (let j = 0; j < h; j++) {
    const inset = j === 0 ? 3 : j === 1 ? 1 : 0;
    for (let i = inset; i < w - inset; i++) {
      let c = (i * 2 + (j >> 1)) % 5 === 0 ? 'g' : (i + j) % 7 === 0 ? 'i' : 'h';
      if (j === 0) c = 'i';
      if (i === inset) c = 'i'; else if (i === w - 1 - inset) c = 'g';
      if (j === h - 1) c = i % 3 === 1 ? 'f' : 'g';
      p.set(x + i, y + j, c);
    }
  }
  for (let i = 1; i < w - 1; i += 3) p.set(x + i, y + h, 'g'); // ragged straw ends
  return p;
}
// ¾ box: top face (hi), front face (mid), dark right column + base row.
export function box(p, x, y, w, td, fh, [lo, mid, hi], { top = hi } = {}) {
  p.rect(x, y, w, td, top); p.rect(x, y + td, w, fh, mid);
  p.rect(x + w - 1, y + td, 1, fh, lo); p.rect(x, y + td + fh - 1, w, 1, lo);
  return p;
}
export function bricks(p, x, y, w, h, on = 't', mortar = 's', period = 4, seed = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (p.get(x + i, y + j) !== on) continue;
    const course = Math.floor(j / 3), row = j % 3;
    if (row === 2 || ((i + (course % 2) * (period / 2) + seed) % period === 0)) p.set(x + i, y + j, mortar);
  }
  return p;
}
export function banner(p, x, y, h, [lo, mid, hi], emblem = 'z') { // hanging cloth with swallow-tail
  p.rect(x - 1, y, 5, 1, 'f');
  p.rect(x, y + 1, 3, h, mid); p.rect(x, y + 1, 1, h, hi); p.rect(x + 2, y + 1, 1, h, lo);
  p.set(x + 1, y + h, '.'); p.set(x, y + h, mid); p.set(x + 2, y + h, lo);
  p.set(x + 1, y + 2 + ((h - 2) >> 1), emblem);
  return p;
}
export function windowLit(p, x, y, w = 2, h = 3) { p.rect(x, y, w, h, 'y'); p.set(x, y, 'z'); p.rect(x, y + h, w, 1, 'f'); p.rect(x - 1, y - 1, w + 2, 1, 'f'); return p; }
export function windowDark(p, x, y, w = 2, h = 3) { p.rect(x, y, w, h, 'n'); p.set(x, y, 'B'); p.rect(x, y + h, w, 1, 'f'); p.rect(x - 1, y - 1, w + 2, 1, 'f'); return p; }
export function flagPole(p, x, y, h = 6, c = ['r', 'R', 'o']) { p.rect(x, y, 1, h, 'f'); p.rect(x + 1, y, 3, 2, c[1]); p.set(x + 3, y + 1, c[0]); p.set(x + 1, y, c[2]); return p; }
export function frames(base, n, anim, post) { return Array.from({ length: n }, (_, f) => { const p = base.clone(); anim(p, f); p.outline(); if (post) post(p, f); return p; }); }
export function logWall(p, x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.set(x + i, y + j, j % 2 ? 'g' : 'h');
  for (let j = 0; j < h; j += 2) { p.set(x, y + j, 'i'); p.set(x, y + j + 1, 'g'); p.set(x + w - 1, y + j, 'g'); p.set(x + w - 1, y + j + 1, 'f'); }
  for (let i = 0; i < w; i++) p.set(x + i, y + h - 1, 'f');
  return p;
}
export function plankWall(p, x, y, w, h, ramp = ['f', 'g', 'h']) {
  const [lo, mid, hi] = ramp;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.set(x + i, y + j, i % 3 === 0 ? lo : i % 3 === 1 ? hi : mid);
  p.rect(x + w - 1, y, 1, h, lo); p.rect(x, y + h - 1, w, 1, lo);
  return p;
}
export function stoneWall(p, x, y, w, h, ramp = ['s', 't', 'u']) {
  const [lo, mid, hi] = ramp;
  p.rect(x, y, w, h, mid); bricks(p, x, y, w, h, mid, lo, 5);
  p.rect(x, y, 1, h, hi); p.rect(x + w - 1, y, 1, h, lo); p.rect(x, y + h - 1, w, 1, lo);
  p.speckle(mid, hi, 0.05, x * 3 + y);
  return p;
}
export function plaster(p, x, y, w, h) { // timber-framed plaster
  p.rect(x, y, w, h, 'i'); p.rect(x, y, w, 1, 'g'); p.rect(x, y + h - 1, w, 1, 'f');
  for (let i = x; i < x + w; i += 5) p.rect(i, y, 1, h, 'g');
  p.rect(x + w - 1, y, 1, h, 'f');
  for (let i = x; i + 5 <= x + w; i += 5) p.line(i, y + h - 1, i + 4, y, 'g');
  return p;
}
export function door(p, x, y, w = 4, h = 6, frame = 'f') {
  p.rect(x - 1, y - 1, w + 2, h + 1, frame); p.rect(x, y, w, h, 'g'); p.rect(x, y, 1, h, 'h');
  for (let i = x + 2; i < x + w; i += 2) p.rect(i, y, 1, h, 'f');
  p.set(x + w - 2, y + (h >> 1), 'y');
  return p;
}
export function archDoor(p, x, y, w, h, fill = 'n') { // round-topped opening
  p.rect(x, y + 1, w, h - 1, fill); p.rect(x + 1, y, w - 2, 1, fill);
  return p;
}
export function chimney(p, x, y, h, smoke = true) {
  p.rect(x, y, 3, h, 't'); p.rect(x, y, 1, h, 'u'); p.rect(x + 2, y, 1, h, 's'); p.rect(x - 1, y - 1, 5, 1, 'u'); p.set(x + 3, y - 1, 's');
  if (smoke) { dots(p, [[x + 1, y - 3], [x + 2, y - 4], [x + 1, y - 5], [x + 2, y - 7], [x + 3, y - 7]], 'v'); dots(p, [[x + 2, y - 3], [x + 2, y - 5], [x + 3, y - 6]], 'u'); }
  return p;
}
export function gear(p, cx, cy, r, c = ['s', 't', 'u']) {
  p.ellipse(cx, cy, r, r, c[1]);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.set(Math.round(cx + Math.cos(a) * (r + 0.8) - 0.5), Math.round(cy + Math.sin(a) * (r + 0.8) - 0.5), c[1]); }
  p.ellipse(cx - 0.6, cy - 0.6, r * 0.5, r * 0.5, c[2]); p.ellipse(cx, cy, r * 0.32, r * 0.32, 'n');
  return p;
}
export function cone(p, cx, top, bot, half, [lo, mid, hi]) { // conical roof, shingled
  for (let y = top; y <= bot; y++) {
    const t = (y - top) / (bot - top), hw = 0.5 + t * half;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw) - 1; x++) {
      const u = (x + 0.5 - cx) / hw;
      p.set(x, y, u < -0.4 ? hi : u > 0.45 ? lo : ((y - top) % 3 === 2 && (x % 2 === 0)) ? lo : mid);
    }
  }
  for (let x = Math.floor(cx - half - 0.5); x <= Math.ceil(cx + half - 0.5); x++) if (p.get(x, bot) !== '.') p.set(x, bot, lo);
  return p;
}
export function crenels(p, x, y, w) { for (let i = x; i < x + w; i += 3) { p.rect(i, y, 2, 2, 'u'); p.set(i, y, 'v'); p.set(i + 1, y + 1, 's'); } return p; }
export function stoneShaft(p, x, y, w, h) {
  p.rect(x, y, w, h, 't'); bricks(p, x, y, w, h, 't', 's', 4);
  p.rect(x, y, 1, h, 'u'); p.rect(x + w - 1, y, 1, h, 's'); p.rect(x, y + h - 1, w, 1, 's');
  p.speckle('t', 'u', 0.04, x + y);
  return p;
}
export function woodLegs(p, x0, x1, y0, y1) {
  p.rect(x0, y0, 2, y1 - y0 + 1, 'g').rect(x0, y0, 1, y1 - y0 + 1, 'h');
  p.rect(x1, y0, 2, y1 - y0 + 1, 'g').rect(x1 + 1, y0, 1, y1 - y0 + 1, 'f');
  p.line(x0 + 2, y0 + 1, x1 - 1, y1 - 1, 'f'); p.line(x1 - 1, y0 + 1, x0 + 2, y1 - 1, 'g');
  return p;
}
export function crystal(p, cx, top, hw, h, [lo, mid, hi] = ['C', 'D', 'E'], glint = 'w') {
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1), half = t < 0.3 ? 0.5 + (t / 0.3) * (hw - 0.5) : 0.5 + ((1 - t) / 0.7) * (hw - 0.5);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half) - 1; x++) {
      const u = (x + 0.5 - cx);
      p.set(x, top + y, u < -0.5 ? hi : u > 0.5 ? lo : mid);
    }
  }
  if (glint && h > 3) p.set(Math.round(cx) - 1, top + 2, glint);
  return p;
}
// small things
export function crate(p, x, y, w = 5, h = 4) {
  p.rect(x, y, w, h, 'g'); p.rect(x, y, w, 1, 'h'); p.rect(x + w - 1, y, 1, h, 'f'); p.rect(x, y + h - 1, w, 1, 'f');
  p.line(x, y + 1, x + w - 2, y + h - 2, 'f'); p.set(x, y, 'i');
  return p;
}
export function barrel(p, x, y, w = 4, h = 5) {
  p.rect(x, y, w, h, 'g'); p.rect(x, y, w, 1, 'h'); p.rect(x + w - 1, y, 1, h, 'f'); p.rect(x, y + 1, 1, h - 1, 'h');
  p.rect(x, y + 1, w, 1, 't'); p.rect(x, y + h - 2, w, 1, 't'); p.set(x + w - 1, y + 1, 's'); p.set(x + w - 1, y + h - 2, 's');
  return p;
}
export function sack(p, x, y, c = ['g', 'h', 'i']) { // grain sack 4×5 with tied neck
  p.rect(x, y + 1, 4, 4, c[1]); p.rect(x + 1, y, 2, 1, c[0]); p.set(x, y + 1, c[2]); p.set(x, y + 2, c[2]); p.rect(x + 3, y + 1, 1, 4, c[0]); p.rect(x, y + 4, 4, 1, c[0]);
  return p;
}
export function lantern(p, x, y) { p.set(x, y, 's'); p.rect(x - 1, y + 1, 3, 1, 't'); p.set(x - 1, y + 2, 'y'); p.set(x, y + 2, 'z'); p.set(x + 1, y + 2, 'x'); p.rect(x - 1, y + 3, 3, 1, 's'); return p; }

// ── auto-tiling walls (same geometry + joining as buildings.mjs v1) ─────────────
// Masks N=1 E=2 S=4 W=8. 16×27 sprites, bottom 16 rows = footprint, anchor bottom-centre.
// `mat` = { ewG, nsX, h, post, top(x,g,part), front(x,r,h,part) }; `decorate(S, mat, mask)` adds detail in tile
// coordinates before the outline. Textures must use periods that divide 16 so runs read as one wall.
export const WALL_W = 16, WALL_H = 27;
const WP = 3, WF = WALL_H - 16;
export function wallTile(M, mask, decorate, after) {
  const c = new Px(WALL_W + 2 * WP, WALL_H + 2 * WP);
  const S = (x, y, col) => c.set(WP + x, WP + WF + y, col);
  const G = (x, y) => c.get(WP + x, WP + WF + y);
  const blk = (x0, x1, g0, g1, h, part) => {
    for (let g = g0; g <= g1; g++) for (let x = x0; x <= x1; x++) S(x, g - h, M.top(x, g, part));
    for (let r = 0; r < h; r++) for (let x = x0; x <= x1; x++) S(x, g1 - r, M.front(x, r, h, part));
  };
  const N = mask & 1, E = mask & 2, So = mask & 4, W = mask & 8;
  const [eg0, eg1] = M.ewG, [nx0, nx1] = M.nsX, h = M.h, po = M.post;
  if (N) blk(nx0, nx1, -WP - 2, po.g[0], h, 'ns');
  if (W) blk(-WP, po.x[0], eg0, eg1, h, 'ew');
  if (E) blk(po.x[1], 15 + WP, eg0, eg1, h, 'ew');
  if (So) blk(nx0, nx1, po.g[1], 15 + WP, h, 'ns');
  if (So) { blk(po.x[0], po.x[1], po.g[0], po.g[1], po.h, 'post'); blk(nx0, nx1, po.g[1] + 1, 15 + WP, h, 'ns'); }
  else blk(po.x[0], po.x[1], po.g[0], po.g[1], po.h, 'post');
  if (decorate) decorate(S, M, mask, G);
  c.outline('k');
  if (N) for (let y = -h - WP - 4; y < -h; y++) for (let x = nx0 - 1; x <= nx1 + 1; x++) if (!(x >= po.x[0] - 1 && x <= po.x[1] + 1 && y >= po.g[0] - po.h - 1)) S(x, y, '.');
  const out = c.crop(WP, WP, WALL_W, WALL_H);
  if (So) for (let x = nx0; x <= nx1; x++) out.set(x, WALL_H - 1, 'k');
  const joint = 'n';
  if (W) for (let y = 0; y < WALL_H; y++) if (out.get(0, y) !== '.' && out.get(0, y) !== 'k') out.set(0, y, joint);
  if (E) for (let y = 0; y < WALL_H; y++) if (out.get(15, y) !== '.' && out.get(15, y) !== 'k') out.set(15, y, joint);
  if (N) for (let x = nx0; x <= nx1; x++) out.set(x, WF - h, joint);
  if (after) after(out, mask);
  return out;
}
// v1 materials (verbatim copies; the review script asserts they reproduce bld_wall_* pixel-for-pixel).
export const STONE = {
  ewG: [5, 10], nsX: [5, 10], h: 8, post: { x: [4, 11], g: [4, 11], h: 10 },
  top(x, g, part) {
    if (part === 'post') return (x === 4 || g === 4) ? 'v' : ((x * 7 + g * 3) % 11 === 0 ? 'v' : 'u');
    return ((x * 5 + g * 9) % 13 === 0) ? 'v' : (((x + g * 3) % 17 === 0) ? 't' : 'u');
  },
  front(x, r, h) {
    if (r === 0) return 's';
    if (r === h - 1) return 't';
    const course = Math.floor((r - 1) / 3);
    if ((r - 1) % 3 === 2) return 's';
    const off = course % 2 ? 4 : 0;
    if (((x + off) % 8) === 0) return 's';
    if (((x * 3 + r * 7) % 19) === 0) return 'u';
    return 't';
  },
};
export const WOOD = {
  ewG: [6, 9], nsX: [6, 9], h: 9, post: { x: [5, 10], g: [5, 10], h: 12 },
  top(x, g, part) {
    if (part === 'post') { const d = Math.hypot(x - 7.5, g - 7.5); return d < 1 ? 'g' : d < 2 ? 'h' : (x === 5 || g === 5) ? 'i' : 'h'; }
    if (part === 'ns') return (g % 4 === 0) ? 'f' : (g % 4 === 1 ? 'i' : 'h');
    return (x % 4 === 0) ? 'f' : (x % 4 === 1 ? 'i' : 'h');
  },
  front(x, r, h, part) {
    if (part === 'post') { const cx = x - 5; if (r === 3 || r === 4) return r === 4 ? 't' : 's'; return cx === 0 ? 'h' : cx >= 4 ? 'f' : 'g'; }
    if (r === 3 || r === 6) return (x % 4 === 0) ? 'f' : (r === 6 ? 'h' : 'f');
    if (x % 4 === 0) return 'f';
    if (x % 4 === 1) return 'h';
    if (r === 0) return 'f';
    return 'g';
  },
};
export function decorateV1(mat) {
  return (S, M, mask) => {
    const po = M.post, top = po.g[0] - po.h;
    if (mat === 'stone') {
      for (const x of [po.x[0], po.x[1] - 2]) { for (let i = 0; i < 3; i++) { S(x + i, top - 2, 'v'); S(x + i, top - 1, i === 2 ? 's' : 't'); } }
      for (const [has, xs] of [[mask & 8, [0]], [mask & 2, [13]]]) if (has) for (const x of xs) for (let i = 0; i < 3; i++) { S(x + i, M.ewG[0] - M.h - 2, 'u'); S(x + i, M.ewG[0] - M.h - 1, i === 2 ? 's' : 't'); }
      S(7, po.g[1] - 6, 'n'); S(7, po.g[1] - 5, 'n'); S(8, po.g[1] - 6, 'n'); S(8, po.g[1] - 5, 'n');
      S(5, po.g[1], 'c'); S(10, po.g[1] - 1, 'b');
    } else {
      const cx = 7; S(cx, top - 1, 'h'); S(cx + 1, top - 1, 'g'); S(cx, top - 2, 'i');
      const tip = M.ewG[0] - M.h - 1;
      for (let x = -WP; x < 16 + WP; x++) if (x % 4 === 2 && ((x < po.x[0] && mask & 8) || (x > po.x[1] && mask & 2))) S(x, tip, 'h');
      S(5, po.g[1] - 9, 'i'); S(10, po.g[1] - 9, 'g');
    }
  };
}
// tile-periodic hash (period 16 in x and in ground rows) so textures continue across neighbouring tiles
export const th = (x, y, s = 0) => hash(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, s);

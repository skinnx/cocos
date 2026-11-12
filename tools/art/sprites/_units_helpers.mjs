// Shared helpers for units.mjs / fx.mjs (owner: art-units).
// Convention: unit grids are typed WITHOUT the outer outline; `fin()` adds the 1px `k` outline last,
// so derived frames (shifted, squashed, re-posed weapons) always get a seamless outline.
import { Px } from '../pixel.mjs';

export const G = (rows) => Px.grid(rows);

// Stamp `src` at (x,y); with selout=true a 1px `k` rim is drawn around `src` first, so a weapon
// held over the body stays readable (selective outline).
export function put(dst, src, x = 0, y = 0, selout = false) {
  if (selout) {
    const rim = new Px(src.w + 2, src.h + 2).stamp(src, 1, 1).outline('k');
    for (let j = 0; j < rim.h; j++) for (let i = 0; i < rim.w; i++) if (rim.d[j][i] === 'k') dst.set(x + i - 1, y + j - 1, 'k');
  }
  return dst.stamp(src, x, y);
}

// Remove a 1px outer outline (k/n pixels touching transparency) so an outlined grid can be re-posed.
export function strip(px) {
  const src = px.clone(), out = px.clone();
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    const c = src.d[y][x];
    if ((c === 'k' || c === 'n') && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => src.get(x + i, y + j) === '.')) out.d[y][x] = '.';
  }
  return out;
}

export const fin = (px) => px.outline('k');

// Rotate 90° clockwise (top → right).
export function rotCW(px) {
  const p = new Px(px.h, px.w);
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) p.d[x][px.h - 1 - y] = px.d[y][x];
  return p;
}
export function bbox(px) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.d[y][x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
// Place the content of `px` into a w×h canvas, horizontally centred (+dx) with its lowest pixel on row `bottom`.
export function seat(px, w, h, bottom = h - 2, dx = 0) {
  const b = bbox(px), out = new Px(w, h);
  return out.stamp(px.crop(b.x0, b.y0, b.w, b.h), Math.floor((w - b.w) / 2) + dx, bottom - b.h + 1);
}

// Move rows [y0, y1] of px by dy (others untouched; rows moved over are overwritten).
export function shiftRows(px, y0, y1, dx, dy) {
  const band = px.crop(0, y0, px.w, y1 - y0 + 1), out = px.clone();
  for (let y = y0; y <= y1; y++) for (let x = 0; x < px.w; x++) out.d[y][x] = '.';
  return out.stamp(band, dx, y0 + dy);
}
// Vertical squash: delete row `y` and drop everything above it by 1px.
export function squash(px, y) {
  const out = new Px(px.w, px.h);
  out.stamp(px.crop(0, y + 1, px.w, px.h - y - 1), 0, y + 1);
  out.stamp(px.crop(0, 0, px.w, y), 0, 1);
  return out;
}
// Vertical stretch: duplicate row `y` and lift everything above it by 1px.
export function stretch(px, y) {
  const out = new Px(px.w, px.h);
  out.stamp(px.crop(0, y, px.w, px.h - y), 0, y);
  out.stamp(px.crop(0, 0, px.w, y + 1), 0, -1);
  return out;
}
// Set a list of [x, y, c] pixels.
export function dots(px, list) { for (const [x, y, c] of list) px.set(x, y, c); return px; }
// Recolour via a map {from: to}.
export function recolor(px, map) { const o = px.clone(); for (const r of o.d) for (let x = 0; x < r.length; x++) if (map[r[x]]) r[x] = map[r[x]]; return o; }
// Deterministic hash in [0,1).
export function hash(a, b = 0, c = 0) { let n = (a * 374761393 + b * 668265263 + c * 974711) | 0; n = (n ^ (n >>> 13)) * 1274126177; n = (n ^ (n >>> 16)) >>> 0; return n / 4294967296; }
// Flip vertically.
export function flipY(px) { const p = px.clone(); p.d.reverse(); return p; }

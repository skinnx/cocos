import { Px, hash, rng, dots, thick, flame } from './_world_helpers.mjs';

// ── shared building helpers ─────────────────────────────────────────────────
// Elliptic cylinder (dais, bowls, barrels seen ¾): top ellipse at centre (cx, cy), front wall h tall.
function cyl(p, cx, cy, rx, ry, h, [lo, mid, hi], { top = hi, rim = null, band = null } = {}) {
  p.ellipse(cx, cy + h, rx, ry, mid); p.rect(Math.ceil(cx - rx), cy, Math.floor(rx * 2) + (Number.isInteger(cx) ? 1 : 0), h, mid);
  // shade the front wall: left third lit, right third dark, bottom rim dark
  for (let y = Math.floor(cy); y <= Math.ceil(cy + h + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    if (p.get(x, y) !== mid) continue;
    const t = (x + 0.5 - cx) / rx;
    if (t > 0.45) p.set(x, y, lo); else if (t < -0.7) p.set(x, y, hi);
  }
  if (band) for (const [by, c] of band) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    // band follows the ellipse curvature
    const t = (x + 0.5 - cx) / rx; if (Math.abs(t) > 1) continue;
    const yy = Math.round(cy + by + ry * Math.sqrt(1 - t * t));
    if (p.get(x, yy) !== '.') p.set(x, yy, t > 0.45 && c.length > 1 ? c[1] : c[0]);
  }
  p.ellipse(cx, cy, rx, ry, top);
  if (rim) { // lit back rim / dark front lip of the top ellipse
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (p.get(x, y) !== top) continue;
      const inner = (((x + 0.5 - cx) / (rx - 1.2)) ** 2 + ((y + 0.5 - cy) / (ry - 1)) ** 2) <= 1;
      if (!inner) p.set(x, y, y + 0.5 < cy ? rim[1] : rim[0]);
    }
  }
  return p;
}
// Gable roof facing the viewer (¾): shingle courses, light ridge, dark eave, chamfered top corners.
function roof(p, x, y, w, h, [lo, mid, hi], { ridge = hi, eave = 'k' } = {}) {
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
// ¾ box: top face (hi), front face (mid), dark right column + base row.
function box(p, x, y, w, td, fh, [lo, mid, hi], { top = hi } = {}) {
  p.rect(x, y, w, td, top); p.rect(x, y + td, w, fh, mid);
  p.rect(x + w - 1, y + td, 1, fh, lo); p.rect(x, y + td + fh - 1, w, 1, lo);
  return p;
}
function bricks(p, x, y, w, h, on = 't', mortar = 's', period = 4, seed = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (p.get(x + i, y + j) !== on) continue;
    const course = Math.floor(j / 3), row = j % 3;
    if (row === 2 || ((i + (course % 2) * (period / 2) + seed) % period === 0)) p.set(x + i, y + j, mortar);
  }
  return p;
}
function banner(p, x, y, h, [lo, mid, hi], emblem = 'z') { // hanging cloth with swallow-tail
  p.rect(x - 1, y, 5, 1, 'f');
  p.rect(x, y + 1, 3, h, mid); p.rect(x, y + 1, 1, h, hi); p.rect(x + 2, y + 1, 1, h, lo);
  p.set(x + 1, y + h, '.'); p.set(x, y + h, mid); p.set(x + 2, y + h, lo);
  p.set(x + 1, y + 2 + ((h - 2) >> 1), emblem);
  return p;
}
function windowLit(p, x, y, w = 2, h = 3) { p.rect(x, y, w, h, 'y'); p.set(x, y, 'z'); p.rect(x, y + h, w, 1, 'f'); p.rect(x - 1, y - 1, w + 2, 1, 'f'); return p; }
function flagPole(p, x, y, h = 6, c = ['r', 'R', 'o']) { p.rect(x, y, 1, h, 'f'); p.rect(x + 1, y, 3, 2, c[1]); p.set(x + 3, y + 1, c[0]); p.set(x + 1, y, c[2]); return p; }
function frames(base, n, anim, post) { return Array.from({ length: n }, (_, f) => { const p = base.clone(); anim(p, f); p.outline(); if (post) post(p, f); return p; }); }

// ── Hearth (2×2, hero object) ─────────────────────────────────────────────────
function menhir(p, x, top, bot, w = 5, rune = true) { // tapered standing stone with a glowing carved rune
  for (let y = top; y <= bot; y++) {
    const inset = y === top ? 2 : y === top + 1 ? 1 : 0;
    for (let i = inset; i < w - inset; i++) p.set(x + i, y, i === inset ? 'u' : i === w - 1 - inset ? 's' : 't');
  }
  p.set(x + 1, top + 1, 'v');
  p.speckle('t', 's', 0.04, x + top);
  if (rune) { const cx = x + (w >> 1), y0 = top + 4; dots(p, [[cx, y0], [cx - 1, y0 + 1], [cx + 1, y0 + 1], [cx, y0 + 2], [cx, y0 + 3], [cx - 1, y0 + 4], [cx + 1, y0 + 5]], 'x'); p.set(cx, y0 + 2, 'y'); p.set(cx, y0, 'z'); }
  return p;
}
function hearthBase(lv) {
  const H = [38, 41, 44][lv - 1], p = new Px(32, H), gy = H - 2; // gy: lowest row of the art (outline below)
  if (lv === 1) {
    menhir(p, 3, gy - 24, gy - 7, 5);
    // spare firewood stacked at the back right
    for (const [x, y] of [[21, gy - 12], [25, gy - 12], [23, gy - 15]]) { p.rect(x, y, 5, 3, 'g'); p.rect(x, y, 5, 1, 'h'); p.rect(x + 4, y, 1, 3, 'f'); p.set(x, y + 1, 'i').set(x, y + 2, 'h'); p.set(x + 1, y + 1, 'h'); }
    const stones = ringStones(16, gy - 6, 12.5, 4.6, 12);
    stones.filter((s) => s.back).forEach((s) => stoneAt(p, s));
    p.ellipse(16, gy - 6, 10, 3.4, 'n').ellipse(16, gy - 6, 8, 2.4, 'f');
    p.speckle('f', 'r', 0.25, 4).speckle('n', 'f', 0.2, 6);
    return { p, fire: { cx: 16, by: gy - 6, hw: 5.5, h: 19 }, front: stones.filter((s) => !s.back),
      logs: [[9, gy - 7, 22, gy - 4], [10, gy - 4, 22, gy - 8]] };
  }
  if (lv === 2) {
    menhir(p, 2, gy - 31, gy - 9); menhir(p, 25, gy - 31, gy - 9);
    cyl(p, 16, gy - 7, 14.5, 5, 4, ['s', 't', 'u'], { top: 'u', rim: ['t', 'v'] });
    bricks(p, 2, gy - 6, 28, 7, 't', 's', 6);
    p.speckle('u', 'v', 0.08, 3);
    cyl(p, 16, gy - 11, 9.5, 3.2, 4, ['s', 't', 'u'], { top: 'n', rim: ['s', 'v'], band: [[1, 'ys']] });
    p.ellipse(16, gy - 11, 7, 1.8, 'f').speckle('f', 'r', 0.3, 9);
    dots(p, [[8, gy - 9], [24, gy - 9], [16, gy - 7]], 'z'); // gold rivets
    return { p, fire: { cx: 16, by: gy - 11, hw: 6.5, h: 22 }, front: [], logs: [[10, gy - 12, 22, gy - 10], [11, gy - 10, 21, gy - 13]] };
  }
  // lv 3: two pillars with royal banners, two-tier dais with steps, steel crown-bowl rimmed in gold
  for (const x of [2, 25]) {
    p.rect(x, gy - 38, 5, 30, 't').rect(x, gy - 38, 1, 30, 'u').rect(x + 4, gy - 38, 1, 30, 's');
    for (let y = gy - 36; y < gy - 8; y += 2) p.set(x + 2, y, 's'); // fluting
    p.rect(x - 1, gy - 40, 7, 2, 'v').rect(x - 1, gy - 38, 7, 1, 's').set(x + 5, gy - 40, 'u').set(x + 5, gy - 39, 'u');
    p.rect(x, gy - 9, 5, 1, 'u');
    p.set(x + 2, gy - 41, 'y').set(x + 2, gy - 42, 'z'); // gold finial
    // banner: 4 wide, gold trim + flame emblem
    const bx = x, by = gy - 37;
    p.rect(bx, by, 5, 14, 'R'); p.rect(bx, by, 1, 14, 'o'); p.rect(bx + 4, by, 1, 14, 'r');
    p.rect(bx, by, 5, 1, 'y'); p.set(bx + 2, by + 14, 'R').set(bx + 1, by + 14, 'r').set(bx + 3, by + 14, 'r');
    dots(p, [[bx + 2, by + 4], [bx + 1, by + 6], [bx + 2, by + 5], [bx + 3, by + 6], [bx + 2, by + 7]], 'y'); p.set(bx + 2, by + 6, 'z');
  }
  cyl(p, 16, gy - 8, 14, 4.5, 4, ['s', 't', 'u'], { top: 'u', rim: ['t', 'v'] });
  bricks(p, 2, gy - 7, 28, 7, 't', 's', 6);
  cyl(p, 16, gy - 12, 11.5, 3.8, 4, ['s', 't', 'u'], { top: 'v', rim: ['u', 'w'], band: [[0, 'yx']] });
  p.speckle('u', 'v', 0.08, 5);
  // front steps
  for (let i = 0; i < 3; i++) { p.rect(12 - i, gy - 5 + i * 2, 8 + i * 2, 1, 'v'); p.rect(12 - i, gy - 4 + i * 2, 8 + i * 2, 1, i === 2 ? 's' : 't'); p.set(19 + i, gy - 4 + i * 2, 's'); }
  cyl(p, 16, gy - 16, 9, 3, 4, ['s', 't', 'u'], { top: 'n', rim: ['y', 'z'], band: [[1, 'yx']] });
  p.ellipse(16, gy - 16, 6.5, 1.6, 'r').speckle('r', 'x', 0.3, 12);
  dots(p, [[6, gy - 5], [26, gy - 5], [9, gy - 10], [23, gy - 10]], 'z'); // glowing runes
  dots(p, [[7, gy - 5], [25, gy - 5]], 'x');
  return { p, fire: { cx: 16, by: gy - 16, hw: 7.5, h: 25 }, front: [], logs: [] };
}
function ringStones(cx, cy, rx, ry, n) {
  return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, back: Math.sin(a) < 0, i }; });
}
function stoneAt(p, { x, y, i }) {
  const w = 4 + (i % 2), h = 3;
  const x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2) - 1;
  p.rect(x0, y0, w, h + 1, 't'); p.rect(x0, y0, w, 1, 'u'); p.set(x0, y0 + 1, 'u'); p.rect(x0 + w - 1, y0 + 1, 1, h, 's'); p.rect(x0, y0 + h, w, 1, 's');
  p.set(x0, y0, 'v');
}
export function hearth(lv) {
  const { p: base, fire, front, logs } = hearthBase(lv);
  // logs under the fire are part of the base (static)

  return frames(base, 4, (p, f) => {
    flame(p, fire.cx, fire.by, fire.hw, fire.h, f, { tongues: lv + 2, heart: lv === 3 });
    
    for (const [x0, y0, x1, y1] of logs) { thick(p, x0, y0, x1, y1, 'g', 2); p.line(x0, y0, x1, y1, 'h'); p.set(x1, y1, 'i'); p.set(x0, y0 + 1, 'f'); p.set(x1 + 1, y1 + 1, 'f'); }
    for (const s of front) stoneAt(p, s);
    glowFront(p, fire);
  }, (p, f) => {
    // embers floating above (outside outline, like the anchor brazier)
    const r = rng(f * 13 + lv); for (let i = 0; i < 2; i++) { const x = Math.round(fire.cx + (r() - 0.5) * fire.hw * 2.5), y = Math.round(fire.by - fire.h - 2 - r() * 4); if (p.get(x, y) === '.') p.set(x, y, i ? 'y' : 'z'); }
  });
}
// warm firelight on the lit stone faces nearest the fire (u→i, v→w), 1 ring only
function glowFront(p, fire) { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (y >= fire.by - 2 && Math.hypot(x - fire.cx, (y - fire.by) * 1.8) < fire.hw + 5) { const c = p.get(x, y); if (c === 'u') p.set(x, y, 'i'); else if (c === 'v') p.set(x, y, 'w'); } }

// ── Brazier (1×1) ─────────────────────────────────────────────────────────────
function brazierBase(lv) {
  const H = lv === 1 ? 22 : 26, p = new Px(16, H), gy = H - 2;
  if (lv === 1) {
    // tripod legs + iron bowl
    p.line(4, gy, 7, gy - 7, 's'); p.line(11, gy, 8, gy - 7, 's'); p.rect(7, gy - 7, 2, 8, 't').set(7, gy - 7, 'u');
    p.set(3, gy, 't').set(12, gy, 's');
    cyl(p, 7.5, gy - 11, 5.5, 2, 3, ['s', 't', 'u'], { top: 'n', rim: ['s', 'u'] });
    p.ellipse(7.5, gy - 11, 3.5, 1, 'r');
    return { p, fire: { cx: 8, by: gy - 11, hw: 3.6, h: 9 } };
  }
  // lv2: stone plinth, wrapped red cloth, wide bowl with gold band and rim spikes
  box(p, 3, gy - 4, 10, 2, 3, ['s', 't', 'u']);
  p.rect(6, gy - 12, 4, 8, 't').rect(6, gy - 12, 1, 8, 'u').rect(9, gy - 12, 1, 8, 's');
  p.rect(6, gy - 9, 4, 2, 'R').set(9, gy - 9, 'r').set(9, gy - 8, 'r').set(6, gy - 9, 'o'); // cloth wrap
  p.set(10, gy - 7, 'R').set(10, gy - 6, 'r');
  cyl(p, 7.5, gy - 16, 6.5, 2.2, 3, ['s', 't', 'u'], { top: 'n', rim: ['s', 'v'], band: [[1, 'yx']] });
  for (const x of [1, 14]) p.set(x, gy - 17, 'u').set(x, gy - 18, 'v'); // rim spikes
  p.ellipse(7.5, gy - 16, 4.5, 1.1, 'r');
  return { p, fire: { cx: 8, by: gy - 16, hw: 4.6, h: 11 } };
}
export function brazier(lv) {
  const { p: base, fire } = brazierBase(lv);
  const lit = frames(base, 4, (p, f) => flame(p, fire.cx, fire.by, fire.hw, fire.h + [0, 1, -1, 1][f], f, { tongues: 2 }),
    (p, f) => { p.set(f % 2 ? 12 : 3, Math.max(0, fire.by - fire.h - 2 - (f % 3)), 'y'); if (f === 2) p.set(10, Math.max(0, fire.by - fire.h - 4), 'z'); });
  const off = base.clone();
  // cold: charcoal heap + one dying ember, thin smoke curl
  off.ellipse(fire.cx - 0.5, fire.by - 1, fire.hw - 0.6, 1.2, 's').set(fire.cx - 2, fire.by - 1, 'n').set(fire.cx + 1, fire.by - 2, 'n').set(fire.cx, fire.by - 1, 'r').set(fire.cx - 1, fire.by - 2, 't');
  off.outline();
  dots(off, [[fire.cx, fire.by - 5], [fire.cx + 1, fire.by - 6], [fire.cx, fire.by - 8]], 'u');
  return { lit, off };
}
export { cyl, roof, box, bricks, banner, windowLit, flagPole, frames };

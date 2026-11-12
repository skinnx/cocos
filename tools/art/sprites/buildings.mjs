// Buildings (SPEC §6.3, §9.3, §9.4): hearth, auto-tiling walls, gates, braziers, towers, economy
// buildings, traps and building overlays. Technique (B): procedural ¾ shapes + hand-placed detail + outline.
// Animated sprites (hearth, brazier, frost/spark towers, burning tar) clone ONE base frame and only
// redraw the animated part per frame.
//
// Anchors (art px from the sprite's top-left): default bottom-centre for every building/wall/prop.
//  - bld_ballista_head_<d>: anchor = pivot (14,12). Place it on the base sprite at base pixel (16,17),
//    i.e. 18 px above the base's bottom row (base is 32×36). d: 0 = east, counter-clockwise, 45° steps.
//  - bld_flame_tip_*: anchor = flame base (3,8); bld_rally_flag_*: pole foot (1,11);
//    bld_embed_base: bottom-centre (9,6), drawn under a 1×1 tower before the tower.
//  - bld_crack_1/2: 16×16 overlays, centre anchor (fx default); tile them over 2×2 buildings.
// Walls/gates: 16×27, the bottom 16 rows are the footprint. Wall masks N=1 E=2 S=4 W=8 (gates count as
// wall neighbours). Seams between neighbours are a 1 px deep-shadow joint on each side.
import { Px, hash, rng, dots, thick, flame } from './_world_helpers.mjs';

// ════ walls ════
// Auto-tiling walls (wood palisade / stone curtain) + gates. Built procedurally from a centre post
// and up to four connectors (mask N=1 E=2 S=4 W=8), drawn in ¾ projection on a padded canvas, outlined,
// then cropped to 16×27 so that connector ends have NO outline and neighbours join seamlessly.
//
// Geometry (tile-local; ground row g, height h): a block covering ground rows g0..g1 draws its top face on
// screen rows g0-h..g1-h and its front face on rows g1-h+1..g1. The sprite's bottom 16 rows are the tile
// footprint; anchor = bottom-centre (8, 27). Textures are computed in tile-local coordinates whose periods
// divide 16, so a run of walls reads as one continuous wall.

const WALL_W = 16, WALL_H = 27;
const P = 3, F = WALL_H - 16; // pad, footprint offset

function canvas() { return new Px(WALL_W + 2 * P, WALL_H + 2 * P); }
// set in tile coords (x: 0..15, y: screen row relative to tile top; may be negative)
const S = (c, x, y, col) => c.set(P + x, P + F + y, col);
const G = (c, x, y) => c.get(P + x, P + F + y);

// ── materials ────────────────────────────────────────────────────────────────
const STONE = {
  ewG: [5, 10], nsX: [5, 10], h: 8, post: { x: [4, 11], g: [4, 11], h: 10 },
  top(x, g, part) { // top-face colour; g = ground row
    if (part === 'post') return (x === 4 || g === 4) ? 'v' : ((x * 7 + g * 3) % 11 === 0 ? 'v' : 'u');
    return ((x * 5 + g * 9) % 13 === 0) ? 'v' : (((x + g * 3) % 17 === 0) ? 't' : 'u');
  },
  front(x, r, h, part) { // r = rows above ground (0 = base row), h = block height
    if (r === 0) return 's';
    if (r === h - 1) return 't'; // lip under the top face (shaded below by outline row)
    const course = Math.floor((r - 1) / 3);
    if ((r - 1) % 3 === 2) return 's';
    const off = course % 2 ? 4 : 0;
    if (((x + off) % 8) === 0) return 's';
    if (((x * 3 + r * 7) % 19) === 0) return 'u';
    return 't';
  },
  lipFront: 'u',
};
const WOOD = {
  ewG: [6, 9], nsX: [6, 9], h: 9, post: { x: [5, 10], g: [5, 10], h: 12 },
  top(x, g, part) {
    if (part === 'post') { const d = Math.hypot(x - 7.5, g - 7.5); return d < 1 ? 'g' : d < 2 ? 'h' : (x === 5 || g === 5) ? 'i' : 'h'; }
    if (part === 'ns') return (g % 4 === 0) ? 'f' : (g % 4 === 1 ? 'i' : 'h');
    return (x % 4 === 0) ? 'f' : (x % 4 === 1 ? 'i' : 'h');
  },
  front(x, r, h, part) {
    if (part === 'post') { const cx = x - 5; if (r === 3 || r === 4) return r === 4 ? 't' : 's'; return cx === 0 ? 'h' : cx >= 4 ? 'f' : 'g'; }
    if (r === 3 || r === 6) return (x % 4 === 0) ? 'f' : (r === 6 ? 'h' : 'f'); // two cross-rails (lit top rail, shadowed lower)
    if (x % 4 === 0) return 'f';
    if (x % 4 === 1) return 'h';
    if (r === 0) return 'f';
    return 'g';
  },
};

// Draw a ¾ block. x0..x1 columns, g0..g1 ground rows, height h. part: 'ew' | 'ns' | 'post'.
function block(c, M, x0, x1, g0, g1, h, part) {
  for (let g = g0; g <= g1; g++) for (let x = x0; x <= x1; x++) S(c, x, g - h, M.top(x, g, part));
  for (let r = 0; r < h; r++) for (let x = x0; x <= x1; x++) S(c, x, g1 - r, M.front(x, r, h, part));
}

function wall(mat, mask) {
  const M = mat === 'wood' ? WOOD : STONE, c = canvas();
  const N = mask & 1, E = mask & 2, So = mask & 4, W = mask & 8;
  const [eg0, eg1] = M.ewG, [nx0, nx1] = M.nsX, h = M.h, po = M.post;
  if (N) block(c, M, nx0, nx1, -P - 2, po.g[0], h, 'ns');
  if (W) block(c, M, -P, po.x[0], eg0, eg1, h, 'ew');
  if (E) block(c, M, po.x[1], 15 + P, eg0, eg1, h, 'ew');
  if (So) block(c, M, nx0, nx1, po.g[1], 15 + P, h, 'ns');
  // post (drawn over the back connectors, under the south one)
  if (So) { block(c, M, po.x[0], po.x[1], po.g[0], po.g[1], po.h, 'post'); block(c, M, nx0, nx1, po.g[1] + 1, 15 + P, h, 'ns'); /* south connector in front of the post */ }
  else block(c, M, po.x[0], po.x[1], po.g[0], po.g[1], po.h, 'post');
  decorate(c, M, mat, mask);
  c.outline('k');
  // the N connector must stop exactly at screen row -h (where the tile above's S connector top face ends)
  if (N) for (let y = -h - P - 4; y < -h; y++) for (let x = nx0 - 1; x <= nx1 + 1; x++) if (!(x >= po.x[0] - 1 && x <= po.x[1] + 1 && y >= po.g[0] - po.h - 1)) S(c, x, y, '.');
  const out = c.crop(P, P, WALL_W, WALL_H);
  // hidden seams (covered by the neighbour's sprite) get the outline colour so the edge stays dark
  if (So) for (let x = nx0; x <= nx1; x++) out.set(x, WALL_H - 1, 'k');
  // visible seams: a 1px deep-shadow joint on each side of a tile boundary (reads as the gap between wall
  // sections, and keeps the silhouette edge dark for the art lint)
  const joint = 'n';
  if (W) for (let y = 0; y < WALL_H; y++) if (out.get(0, y) !== '.' && out.get(0, y) !== 'k') out.set(0, y, joint);
  if (E) for (let y = 0; y < WALL_H; y++) if (out.get(15, y) !== '.' && out.get(15, y) !== 'k') out.set(15, y, joint);
  if (N) for (let x = nx0; x <= nx1; x++) out.set(x, F - h, joint);
  return out;
}

function decorate(c, M, mat, mask) {
  const po = M.post, top = po.g[0] - po.h; // post top-face first row
  if (mat === 'stone') {
    // merlons on the post corners (raised 2px), lit top, dark side
    for (const x of [po.x[0], po.x[1] - 2]) { for (let i = 0; i < 3; i++) { S(c, x + i, top - 2, 'v'); S(c, x + i, top - 1, i === 2 ? 's' : 't'); } }
    // merlons along E-W runs at the back edge of the top face
    for (const [has, xs] of [[mask & 8, [0]], [mask & 2, [13]]]) if (has) for (const x of xs) for (let i = 0; i < 3; i++) { S(c, x + i, M.ewG[0] - M.h - 2, 'u'); S(c, x + i, M.ewG[0] - M.h - 1, i === 2 ? 's' : 't'); }
    // arrow slit + moss on the post front
    S(c, 7, po.g[1] - 6, 'n'); S(c, 7, po.g[1] - 5, 'n'); S(c, 8, po.g[1] - 6, 'n'); S(c, 8, po.g[1] - 5, 'n');
    S(c, 5, po.g[1], 'c'); S(c, 10, po.g[1] - 1, 'b');
  } else {
    // sharpened post tip + rope lashing, stakes get pointed tips along E-W runs
    const cx = 7; S(c, cx, top - 1, 'h'); S(c, cx + 1, top - 1, 'g'); S(c, cx, top - 2, 'i');
    const tip = M.ewG[0] - M.h - 1;
    for (let x = -P; x < 16 + P; x++) if (x % 4 === 2 && ((x < po.x[0] && mask & 8) || (x > po.x[1] && mask & 2))) S(c, x, tip, 'h');
    S(c, 5, po.g[1] - 9, 'i'); S(c, 10, po.g[1] - 9, 'g');
  }
}

// Gates sit in a wall run: 'h' = in an E-W run (passage north-south), 'v' = in a N-S run.
function gate(orient, open) {
  const c = canvas();
  // stone pillar: x0..x1 columns, g0..g1 ground rows, height hh; cap overhangs by 1px
  const pillar = (x0, x1, g0, g1, hh) => {
    for (let g = g0; g <= g1; g++) for (let x = x0; x <= x1; x++) S(c, x, g - hh, x === x0 || g === g0 ? 'v' : 'u');
    for (let r = 0; r < hh; r++) for (let x = x0; x <= x1; x++) {
      const brick = (r % 4 === 0) || ((x + (Math.floor(r / 4) % 2) * 2) % 4 === 0 && x !== x0);
      S(c, x, g1 - r, r === 0 || x === x1 ? 's' : brick ? 's' : 't');
    }
    for (let x = x0 - 1; x <= x1 + 1; x++) { S(c, x, g0 - hh - 1, x === x0 - 1 ? 'v' : 'u'); S(c, x, g0 - hh, x === x1 + 1 ? 's' : 't'); }
  };
  const plank = (x, r, x0, x1) => (r === 2 || r === 6 ? (x === x0 ? 'u' : 't') : x === x1 ? 'f' : (x - x0) % 3 === 0 ? 'f' : (x - x0) % 3 === 1 ? 'h' : 'g');
  if (orient === 'h') { // in an E-W wall: we look at the door face-on
    const g0 = 5, g1 = 10, h = 11;
    if (!open) {
      for (let r = 0; r < h; r++) for (let x = 4; x <= 11; x++) S(c, x, g1 - r, r === 0 ? 'f' : plank(x, r, 4, 11));
      for (let r = 1; r < h; r++) S(c, 8, g1 - r, 'f'); // the split between the two leaves
      S(c, 7, g1 - 4, 'y'); S(c, 9, g1 - 4, 'y'); S(c, 7, g1 - 5, 'z'); // ring handles
    } else {
      for (let r = 0; r < h; r++) for (let x = 4; x <= 11; x++) S(c, x, g1 - r, r === 0 ? 'h' : r === 1 ? 'g' : 'n'); // dark passage + threshold
      for (let r = 1; r < h; r++) { S(c, 4, g1 - r, r % 4 === 2 ? 'u' : 'h'); S(c, 11, g1 - r, r % 4 === 2 ? 't' : 'g'); } // leaves swung in, edge-on
      for (let r = 1; r < 4; r++) for (let x = 5; x <= 10; x++) S(c, x, g1 - r, r === 1 ? 'g' : 'f'); // ground seen through
    }
    // lintel beam on top + iron studs
    for (let x = 2; x <= 13; x++) { S(c, x, g1 - h - 1, 'h'); S(c, x, g1 - h, 'g'); S(c, x, g1 - h + 1, 'f'); }
    for (const x of [3, 8, 12]) S(c, x, g1 - h, 't');
    S(c, 2, g1 - h - 1, 'i');
    pillar(1, 3, g0, g1, h + 1); pillar(12, 14, g0, g1, h + 1);
    // little red pennant on the left pillar
    S(c, 2, g0 - h - 4, 'f'); S(c, 2, g0 - h - 3, 'f'); S(c, 3, g0 - h - 4, 'R'); S(c, 4, g0 - h - 4, 'R'); S(c, 3, g0 - h - 3, 'r');
  } else { // in a N-S wall: low pillars N and S, the door between seen from above as a plank deck
    const x0 = 5, x1 = 10, h = 9;
    pillar(4, 11, 0, 2, 7); // back pillar first (¾ draw order: north to south)
    if (!open) {
      for (let g = 3; g <= 12; g++) for (let x = x0; x <= x1; x++) S(c, x, g - h, x === x0 ? 'i' : x === x1 ? 'g' : (g === 5 || g === 10) ? 't' : (x % 2 ? 'h' : 'g'));
      for (let r = 0; r < h; r++) for (let x = x0; x <= x1; x++) S(c, x, 12 - r, plank(x, r, x0, x1));
      S(c, 7, 12 - h + 1, 'u'); S(c, 8, 12 - h + 1, 'u'); S(c, 7, 7 - h, 'y'); S(c, 8, 7 - h, 'z'); // iron ring on top
    } else { // leaves folded back against the north pillar, threshold planks on the ground
      for (let g = 3; g <= 4; g++) for (let x = x0; x <= x1; x++) S(c, x, g - h, x === x0 ? 'i' : 'h');
      for (let r = 0; r < h; r++) for (let x = x0; x <= x1; x++) S(c, x, 4 - r, r === 2 || r === 6 ? 't' : x === x1 ? 'f' : (x % 2 ? 'g' : 'h'));
      for (let g = 6; g <= 12; g++) for (let x = x0; x <= x1; x++) S(c, x, g, g % 2 ? 'g' : 'f');
    }
    pillar(4, 11, 13, 15, 6);
    // torch bracket on the north pillar
    S(c, 12, -3, 'f'); S(c, 12, -4, 'g'); S(c, 12, -5, 'y'); S(c, 12, -6, 'x'); S(c, 12, -5, 'z');
  }
  c.outline('k');
  const out = c.crop(P, P, WALL_W, WALL_H);
  for (let x = 0; x < 16; x++) if (out.get(x, WALL_H - 1) !== '.') out.set(x, WALL_H - 1, 'k'); // hidden under the next row
  return out;
}

// ════ blda ════
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
function hearth(lv) {
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
function brazier(lv) {
  const { p: base, fire } = brazierBase(lv);
  const lit = frames(base, 4, (p, f) => flame(p, fire.cx, fire.by, fire.hw, fire.h + [0, 1, -1, 1][f], f, { tongues: 1 }),
    (p, f) => { p.set(f % 2 ? 12 : 3, Math.max(0, fire.by - fire.h - 2 - (f % 3)), 'y'); if (f === 2) p.set(10, Math.max(0, fire.by - fire.h - 4), 'z'); });
  const off = base.clone();
  // cold: charcoal heap + one dying ember, thin smoke curl
  off.ellipse(fire.cx - 0.5, fire.by - 1, fire.hw - 0.6, 1.2, 's').set(fire.cx - 2, fire.by - 1, 'n').set(fire.cx + 1, fire.by - 2, 'n').set(fire.cx, fire.by - 1, 'r').set(fire.cx - 1, fire.by - 2, 't');
  off.outline();
  dots(off, [[fire.cx, fire.by - 5], [fire.cx + 1, fire.by - 6], [fire.cx, fire.by - 8]], 'u');
  return { lit, off };
}

// ════ bldb ════
// ── tower parts (1×1, 16 wide) ───────────────────────────────────────────────
function stoneShaft(p, x, y, w, h) { // brick shaft with lit left column, dark right column
  p.rect(x, y, w, h, 't'); bricks(p, x, y, w, h, 't', 's', 4);
  p.rect(x, y, 1, h, 'u'); p.rect(x + w - 1, y, 1, h, 's'); p.rect(x, y + h - 1, w, 1, 's');
  p.speckle('t', 'u', 0.04, x + y);
  return p;
}
function woodLegs(p, x0, x1, y0, y1) { // two front legs + X bracing
  p.rect(x0, y0, 2, y1 - y0 + 1, 'g').rect(x0, y0, 1, y1 - y0 + 1, 'h');
  p.rect(x1, y0, 2, y1 - y0 + 1, 'g').rect(x1 + 1, y0, 1, y1 - y0 + 1, 'f');
  p.line(x0 + 2, y0 + 1, x1 - 1, y1 - 1, 'f'); p.line(x1 - 1, y0 + 1, x0 + 2, y1 - 1, 'g');
  return p;
}
function platform(p, x, y, w, td, fh, mat = 'wood') {
  if (mat === 'wood') { box(p, x, y, w, td, fh, ['f', 'g', 'h']); for (let i = x + 2; i < x + w; i += 3) p.rect(i, y, 1, td, 'g'); p.rect(x, y, w, 1, 'i'); }
  else { box(p, x, y, w, td, fh, ['s', 't', 'u']); p.rect(x, y, w, 1, 'v'); }
  return p;
}
function railing(p, x, y, w) { for (let i = x; i < x + w; i += 3) p.rect(i, y, 1, 3, 'g'); p.rect(x, y, w, 1, 'h'); p.set(x + w - 1, y, 'g'); return p; }
function crenels(p, x, y, w) { for (let i = x; i < x + w; i += 3) { p.rect(i, y, 2, 2, 'u'); p.set(i, y, 'v'); p.set(i + 1, y + 1, 's'); } return p; }
function cone(p, cx, top, bot, half, [lo, mid, hi]) { // conical roof, shingled
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

// ── Arrow tower ───────────────────────────────────────────────────────────────
function arrowTower(lv) {
  const H = [27, 29, 30][lv - 1], p = new Px(16, H), gy = H - 2;
  if (lv === 1) {
    woodLegs(p, 2, 12, gy - 13, gy);
    p.rect(7, gy - 12, 2, 13, 'h'); for (let y = gy - 11; y <= gy; y += 2) p.rect(7, y, 2, 1, 'f'); // ladder
    platform(p, 1, gy - 19, 14, 3, 3);
    railing(p, 1, gy - 22, 14);
    // bow rack + quiver on the deck, red pennant
    p.rect(11, gy - 23, 1, 4, 'f'); p.set(12, gy - 23, 't').set(12, gy - 22, 'u');
    flagPole(p, 3, gy - 26, 6);
  } else if (lv === 2) {
    stoneShaft(p, 2, gy - 11, 12, 12);
    p.rect(6, gy - 5, 4, 6, 'f').rect(7, gy - 5, 1, 6, 'g').rect(6, gy - 6, 4, 1, 's').set(9, gy - 2, 'y'); // door
    platform(p, 1, gy - 19, 14, 3, 5);
    for (let i = 3; i < 15; i += 4) p.rect(i, gy - 15, 1, 4, 'f'); // timber hoarding studs
    p.rect(1, gy - 16, 14, 1, 't').set(1, gy - 16, 'u');      // iron band
    railing(p, 1, gy - 22, 14);
    p.set(5, gy - 9, 'n').set(5, gy - 8, 'n').set(10, gy - 9, 'n').set(10, gy - 8, 'n'); // arrow slits
    flagPole(p, 12, gy - 27, 7);
  } else {
    stoneShaft(p, 2, gy - 15, 12, 16);
    p.rect(6, gy - 5, 4, 6, 'f').rect(7, gy - 5, 1, 6, 'g').rect(6, gy - 6, 4, 1, 'u').set(9, gy - 2, 'y');
    p.rect(7, gy - 12, 2, 3, 'n');
    platform(p, 1, gy - 19, 14, 2, 3, 'stone');
    crenels(p, 1, gy - 21, 14);
    cone(p, 8, gy - 28, gy - 19, 7.5, ['r', 'R', 'o']);
    p.set(8, gy - 28, 'y').set(7, gy - 28, 'y'); // gold finial
    banner(p, 3, gy - 16, 6, ['r', 'R', 'o']); banner(p, 10, gy - 16, 6, ['r', 'R', 'o']);
  }
  return p.outline();
}

// ── Frost tower (4 frames) ────────────────────────────────────────────────────
function crystal(p, cx, top, hw, h) { // faceted ice crystal: lit left facet, mid, dark right facet
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1), half = t < 0.3 ? 0.5 + (t / 0.3) * (hw - 0.5) : 0.5 + ((1 - t) / 0.7) * (hw - 0.5);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half) - 1; x++) {
      const u = (x + 0.5 - cx);
      p.set(x, top + y, u < -0.5 ? 'E' : u > 0.5 ? 'C' : 'D');
    }
  }
  p.set(Math.round(cx) - 1, top + 2, 'w');
  return p;
}
function frostTower(lv) {
  const H = [26, 28, 30][lv - 1], base = new Px(16, H), gy = H - 2;
  const ped = [8, 9, 10][lv - 1];
  // pedestal: stepped plinth + octagonal column
  box(base, 2, gy - 3, 12, 1, 3, ['s', 't', 'u']); base.rect(2, gy - 3, 12, 1, 'v');
  stoneShaft(base, 4, gy - ped, 8, ped - 3);
  base.rect(3, gy - ped - 2, 10, 2, 'u').rect(3, gy - ped - 2, 10, 1, 'v').rect(3, gy - ped, 10, 1, 's'); // cap
  base.ellipse(7.5, gy - ped - 2, 3, 0.8, 'B'); // frosted cup
  dots(base, [[7, gy - ped + 3], [8, gy - ped + 4], [7, gy - ped + 5]], 'D'); // rune
  if (lv >= 2) { base.rect(4, gy - ped + 1, 8, 1, 'u'); base.rect(4, gy - 5, 8, 1, 'u'); dots(base, [[5, gy - ped + 1], [10, gy - 5]], 'v'); }
  if (lv >= 2) { crystal(base, 3, gy - ped - 6, 1.6, 5); crystal(base, 13, gy - ped - 5, 1.4, 4); } // side shards
  if (lv === 3) { banner(base, 4, gy - ped + 2, 5, ['B', 'C', 'D'], 'E'); banner(base, 9, gy - ped + 2, 5, ['B', 'C', 'D'], 'E'); }
  const ch = [11, 12, 13][lv - 1], chw = [2.8, 3.2, 3.8][lv - 1];
  return frames(base, 4, (p, f) => {
    const bob = [0, -1, -1, 0][f];
    crystal(p, 8, gy - ped - 3 - ch + bob, chw, ch);
    p.set(7, gy - ped - 3 - ch + bob + 2 + (f % 2), 'w');
  }, (p, f) => { // snow motes orbiting the crystal (outside the outline)
    const a = (f / 4) * Math.PI * 2, cy = gy - ped - 3 - ch / 2;
    for (let i = 0; i < (lv + 1); i++) {
      const b = a + (i * Math.PI * 2) / (lv + 1), x = Math.round(8 + Math.cos(b) * 6.5), y = Math.round(cy + Math.sin(b) * 2.5);
      if (p.get(x, y) === '.') p.set(x, y, i % 2 ? 'D' : 'E');
    }
  });
}

// ── Spark tower (4 frames) ────────────────────────────────────────────────────
function sparkTower(lv) {
  const H = [27, 29, 30][lv - 1], base = new Px(16, H), gy = H - 2;
  box(base, 2, gy - 4, 12, 1, 4, ['s', 't', 'u']); base.rect(2, gy - 4, 12, 1, 'v');
  const coilTop = gy - [16, 18, 19][lv - 1];
  if (lv === 1) { base.rect(6, coilTop, 4, gy - 4 - coilTop, 'g'); base.rect(6, coilTop, 1, gy - 4 - coilTop, 'h'); base.rect(9, coilTop, 1, gy - 4 - coilTop, 'f'); }
  else stoneShaft(base, 4, gy - 9, 8, 6);
  // copper coil wound around the mast
  const cb = lv === 1 ? gy - 5 : gy - 10;
  for (let y = coilTop + 2; y <= cb; y++) {
    const w = 3 + (lv >= 2 ? 1 : 0);
    for (let x = 8 - w; x < 8 + w; x++) base.set(x, y, (y % 2) ? (x < 8 - w + 2 ? 'y' : x >= 8 + w - 2 ? 'x' : 'y') : 'f');
    base.set(8 - w, y, y % 2 ? 'z' : 'g');
  }
  if (lv >= 2) { // side prongs
    for (const [x, d] of [[2, -1], [13, 1]]) { base.rect(x, coilTop + 3, 1, 6, 't'); base.set(x, coilTop + 2, 'u'); base.set(x - d, coilTop + 8, 't'); base.set(x, coilTop + 1, 'y'); }
  }
  // orb
  const orbR = [2.4, 2.8, 3.4][lv - 1], oy = coilTop - orbR + 0.5;
  if (lv < 3) { base.ellipse(7.5, oy, orbR, orbR, 'y'); base.ellipse(7, oy - 0.5, orbR * 0.5, orbR * 0.5, 'z'); base.set(Math.round(7.5 + orbR) - 1, Math.round(oy), 'x').set(Math.round(7.5 + orbR) - 1, Math.round(oy) + 1, 'x'); }
  else { base.ellipse(7.5, oy, orbR, orbR, 'C'); base.ellipse(7, oy - 0.7, orbR * 0.55, orbR * 0.55, 'D'); base.set(6, Math.round(oy) - 2, 'E'); base.rect(4, Math.round(oy), 8, 1, 'y'); base.set(11, Math.round(oy), 'x'); base.set(9, Math.round(oy) + 2, 'B').set(10, Math.round(oy) + 1, 'B'); }
  if (lv === 3) { base.rect(2, gy - 9, 12, 1, 'u'); dots(base, [[3, gy - 9], [12, gy - 9]], 'y'); }
  return frames(base, 4, () => {}, (p, f) => {
    // lightning arcs leaping from the orb; different each frame, drawn over the outline (FX-bright)
    const r = rng(f * 7 + lv * 31), arcs = lv + (f % 2);
    for (let i = 0; i < arcs; i++) {
      const ang = r() * Math.PI * 2, len = 4 + Math.floor(r() * 3);
      let x = 7.5 + Math.cos(ang) * orbR, y = oy + Math.sin(ang) * orbR;
      for (let k = 0; k < len; k++) {
        x += Math.cos(ang) + (r() - 0.5) * 1.4; y += Math.sin(ang) * 0.8 + (r() - 0.5) * 1.4;
        const X = Math.round(x), Y = Math.round(y);
        if (X < 0 || X > 15 || Y < 0) break;
        if (p.get(X, Y) === '.') p.set(X, Y, k === len - 1 ? 'D' : (k % 2 ? 'E' : 'w'));
      }
    }
  });
}

// ── Ballista (2×2 base + 8-direction head) ────────────────────────────────────
const BALLISTA_PIVOT = { x: 16, y: 17 }; // base-sprite pixel where the head's anchor goes
function ballistaBase(lv) {
  const H = 36, p = new Px(32, H);
  const stone = lv >= 2;
  // round gun platform: top ellipse centred on the pivot, 7px front wall
  if (!stone) {
    cyl(p, 16, 17, 14, 9, 7, ['f', 'g', 'h'], { top: 'h', rim: ['g', 'i'] });
    for (let y = 9; y < 27; y++) for (let x = 0; x < 32; x++) if (p.get(x, y) === 'h' && x % 4 === 1) p.set(x, y, 'g');
    for (let x = 0; x < 32; x++) for (let y = 24; y < 34; y++) if ('gf'.includes(p.get(x, y)) && y > 26 && x % 5 === 0) p.set(x, y, 'f');
    for (const x of [6, 25]) { p.rect(x, 25, 2, 8, 'f'); p.set(x, 25, 'g'); } // lashing posts
    for (let x = 3; x < 29; x++) if ('gfh'.includes(p.get(x, 29))) p.set(x, 29, 't');      // iron hoop
  } else {
    cyl(p, 16, 17, 14, 9, 7, ['s', 't', 'u'], { top: 'u', rim: ['t', 'v'] });
    bricks(p, 2, 25, 28, 9, 't', 's', 6);
    p.ellipse(16, 17, 11, 6.5, 'h');
    for (let y = 10; y < 24; y++) for (let x = 0; x < 32; x++) if (p.get(x, y) === 'h' && x % 3 === 0) p.set(x, y, 'g');
    p.speckle('u', 'v', 0.12, 4);
    if (lv === 3) { for (const [x, y] of [[3, 15], [27, 15], [8, 9], [22, 9]]) { p.rect(x, y, 3, 2, 'v'); p.rect(x, y + 2, 3, 1, 's'); } } // merlons
  }
  // iron turntable
  p.ellipse(16, 17, 7, 4, 's').ellipse(16, 16.6, 6, 3.2, 't').ellipse(16, 17, 4, 2, 'f');
  for (const [x, y] of [[10, 17], [22, 17], [16, 13], [16, 21]]) p.set(x, y, 'u');
  if (lv >= 2) for (let i = 0; i < 3; i++) { p.rect(22, 21 + i * 2, 5, 1, 'g'); p.set(26, 21 + i * 2, 'v'); p.set(22, 21 + i * 2, 'f'); } // bolt rack
  if (lv === 2) for (let x = 3; x < 29; x++) if ('ts'.includes(p.get(x, 30))) p.set(x, 30, 'u');
  if (lv === 3) { banner(p, 7, 26, 5, ['r', 'R', 'o']); banner(p, 22, 26, 5, ['r', 'R', 'o']); flagPole(p, 5, 3, 8); p.rect(6, 19, 3, 3, 'g').rect(6, 19, 3, 1, 'h').set(8, 21, 'f'); }
  return p.outline();
}
// dir 0 = east, counter-clockwise in 45° steps. 28×24 canvas, pivot (14, 12).
const BALLISTA_HEAD_PIVOT = { x: 14, y: 12 };
function ballistaHead(dir, lv = 1) {
  const W = 28, H = 24, p = new Px(W, H), cx = 14, cy = 12;
  const a = (dir * Math.PI) / 4, fx = Math.cos(a), fy = -Math.sin(a) * 0.75, sa = Math.sin(a), ca = Math.cos(a) * 0.75;
  const local = (x, y) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; return [(dx * ca - sa * dy) / 0.75, (fx * dy - fy * dx) / 0.75]; };
  const arcF = (s) => 3.5 - 0.03 * s * s;
  const shape = (f, s) => {
    const as = Math.abs(s);
    if (f > 7.8 && f < 11.5 && as < 1.3 - (f - 7.8) * 0.33) return 'v';               // bolt head
    if (as < 0.75 && f > -4 && f <= 7.8) return 'u';                                 // bolt shaft
    if (as <= 10.5 && Math.abs(f - arcF(s)) < (as < 5 ? 1.3 : 0.95)) return 'A';      // bow arms
    if (as < 10.5 && Math.abs(f - (-4 + (as / 10.5) * (arcF(10.5) + 4))) < 0.5) return 'S'; // string
    if (as < 2.4 && f > -8 && f < 5.5) return 'B';                                   // stock / carriage
    if (as < 3.6 && f > -9 && f < -6) return 'W';                                    // winch drum
    return null;
  };
  const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => shape(...local(x, y))));
  const is = (x, y, c) => grid[y]?.[x] === c;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = grid[y][x]; if (!c) continue;
    let col = c;
    if (c === 'B') col = !is(x, y - 1, 'B') ? 'h' : !is(x, y + 1, 'B') || !is(x + 1, y, 'B') ? 'f' : 'g';
    if (c === 'A') col = !is(x, y - 1, 'A') ? 'h' : !is(x, y + 1, 'A') ? 'f' : 'g';
    if (c === 'S') col = 'i';
    if (c === 'W') col = !is(x, y - 1, 'W') ? 'u' : !is(x, y + 1, 'W') ? 's' : 't';
    p.set(x, y, col);
  }
  p.set(cx, cy, lv >= 3 ? 'y' : 't'); p.set(cx - 1, cy, 'u'); // pivot pin
  return p.outline();
}

// ── Mortar (2×2) ──────────────────────────────────────────────────────────────
function mortar(lv) {
  const H = [36, 37, 38][lv - 1], p = new Px(32, H), gy = H - 2;
  // low ring wall around a sunken floor
  const ry = 6.5, cy = gy - 12;
  cyl(p, 16, cy, 14.5, ry, 4, ['s', 't', 'u'], { top: 'u', rim: ['t', 'v'] });
  bricks(p, 2, cy, 28, ry + 6, 't', 's', 5);
  p.ellipse(16, cy, 11.5, ry - 2.2, lv === 1 ? 'g' : 'f');
  if (lv === 1) for (let x = 5; x < 28; x += 3) for (let y = cy - 4; y <= cy + 4; y++) if (p.get(x, y) === 'g') p.set(x, y, 'f'); // plank floor
  else p.speckle('f', 'g', 0.2, 7);
  p.speckle('u', 'v', 0.1, 3);
  if (lv === 3) for (const [x, y] of [[2, cy - 2], [27, cy - 2], [7, cy - 6], [22, cy - 6]]) { p.rect(x, y, 3, 2, 'v'); p.rect(x, y + 2, 3, 1, 's'); } // merlons
  // cradle
  const by = cy + 1;
  box(p, 10, by - 1, 12, 2, 3, ['f', 'g', 'h']);
  // barrel: bulb + short neck tilted back, mouth facing up
  const br = [5, 5.5, 6.5][lv - 1];
  const tone = (x, cx, r) => { const u = (x + 0.5 - cx) / r; return u < -0.5 ? 'u' : u > 0.35 ? 's' : 't'; };
  for (let y = Math.floor(by - br * 0.8); y <= by + 1; y++) for (let x = 0; x < 32; x++) if (((x + 0.5 - 16) / (br + 1)) ** 2 + ((y + 0.5 - by + 1) / (br * 0.8)) ** 2 <= 1) p.set(x, y, tone(x, 16, br + 1));
  const neckH = [8, 9, 11][lv - 1];
  for (let k = 0; k <= neckH; k++) { const yc = by - 2 - k; for (let x = 0; x < 32; x++) if (Math.abs(x + 0.5 - 16) <= br - 0.4) p.set(x, yc, tone(x, 16, br)); }
  const band = lv === 3 ? ['y', 'x'] : lv === 2 ? ['u', 's'] : ['s', 'n'];
  for (const k of lv === 1 ? [2] : [2, neckH - 1]) for (let x = 0; x < 32; x++) if (Math.abs(x + 0.5 - 16) <= br - 0.4) p.set(x, by - 2 - k, x > 17 ? band[1] : band[0]);
  const my = by - 3 - neckH;
  p.ellipse(16, my, br, 2.2, 'u'); p.ellipse(16, my, br - 1.2, 1.4, 'n'); p.rect(15, my, 2, 1, 'k'); p.set(Math.round(16 + br) - 1, my, 's');
  p.set(Math.round(16 - br) + 1, by - 4, 'v').set(Math.round(16 - br) + 1, by - 5, 'v');
  // shells + powder keg
  const balls = lv === 1 ? [[24, cy + 1]] : [[23, cy + 1], [26, cy + 1], [24.5, cy - 1]];
  for (const [x, y] of balls) { p.ellipse(x, y, 1.5, 1.5, 's'); p.set(Math.floor(x) - 1, y - 1, 'u'); p.set(Math.floor(x) + 1, y + 1, 'n'); }
  if (lv >= 2) { p.rect(5, cy - 1, 3, 4, 'g').rect(5, cy - 1, 3, 1, 'h').rect(7, cy, 1, 3, 'f').set(5, cy + 1, 't').set(6, cy + 1, 't'); }
  if (lv === 3) { flagPole(p, 4, 1, 10); banner(p, 14, gy - 5, 4, ['r', 'R', 'o']); }
  return p.outline();
}

// ════ bldc ════
// ── house parts (¾: big roof slope toward the viewer, front wall below) ───────
function logWall(p, x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.set(x + i, y + j, j % 2 ? 'g' : 'h');
  for (let j = 0; j < h; j += 2) { p.set(x, y + j, 'i'); p.set(x, y + j + 1, 'g'); p.set(x + w - 1, y + j, 'g'); p.set(x + w - 1, y + j + 1, 'f'); }
  for (let i = 0; i < w; i++) p.set(x + i, y + h - 1, 'f');
  return p;
}
function plankWall(p, x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.set(x + i, y + j, i % 3 === 0 ? 'f' : i % 3 === 1 ? 'h' : 'g');
  p.rect(x + w - 1, y, 1, h, 'f'); p.rect(x, y + h - 1, w, 1, 'f');
  return p;
}
function stoneWall(p, x, y, w, h) {
  p.rect(x, y, w, h, 't'); bricks(p, x, y, w, h, 't', 's', 5);
  p.rect(x, y, 1, h, 'u'); p.rect(x + w - 1, y, 1, h, 's'); p.rect(x, y + h - 1, w, 1, 's');
  p.speckle('t', 'u', 0.05, x * 3 + y);
  return p;
}
function plaster(p, x, y, w, h) { // timber-framed plaster
  p.rect(x, y, w, h, 'i'); p.rect(x, y, w, 1, 'g'); p.rect(x, y + h - 1, w, 1, 'f');
  for (let i = x; i < x + w; i += 5) p.rect(i, y, 1, h, 'g');
  p.rect(x + w - 1, y, 1, h, 'f');
  for (let i = x; i + 5 <= x + w; i += 5) p.line(i, y + h - 1, i + 4, y, 'g');
  return p;
}
function door(p, x, y, w = 4, h = 6) {
  p.rect(x - 1, y - 1, w + 2, h + 1, 'f'); p.rect(x, y, w, h, 'g'); p.rect(x, y, 1, h, 'h');
  for (let i = x + 2; i < x + w; i += 2) p.rect(i, y, 1, h, 'f');
  p.set(x + w - 2, y + (h >> 1), 'y');
  return p;
}
function chimney(p, x, y, h, smoke = true) {
  p.rect(x, y, 3, h, 't'); p.rect(x, y, 1, h, 'u'); p.rect(x + 2, y, 1, h, 's'); p.rect(x - 1, y - 1, 5, 1, 'u'); p.set(x + 3, y - 1, 's');
  if (smoke) { dots(p, [[x + 1, y - 3], [x + 2, y - 4], [x + 1, y - 5], [x + 2, y - 7], [x + 3, y - 7]], 'v'); dots(p, [[x + 2, y - 3], [x + 2, y - 5], [x + 3, y - 6]], 'u'); }
  return p;
}
function logPile(p, x, y, n = 3) { // stacked log ends (circles) seen from the front
  const pos = n === 3 ? [[0, 3], [4, 3], [2, 0]] : n === 6 ? [[0, 6], [4, 6], [8, 6], [2, 3], [6, 3], [4, 0]] : [[0, 3], [4, 3], [8, 3], [2, 0], [6, 0]];
  for (const [dx, dy] of pos) { const cx = x + dx, cy = y + dy; p.rect(cx, cy, 4, 4, 'f'); p.rect(cx + 1, cy, 2, 4, 'g'); p.rect(cx, cy + 1, 4, 2, 'g'); p.rect(cx + 1, cy + 1, 2, 2, 'h'); p.set(cx + 1, cy + 1, 'i'); p.set(cx, cy, '.'); p.set(cx + 3, cy, '.'); }
  return p;
}
function stoneBlocks(p, x, y, n) {
  const pos = [[0, 4], [6, 4], [3, 0], [12, 4]].slice(0, n);
  for (const [dx, dy] of pos) box(p, x + dx, y + dy, 6, 2, 3, ['s', 't', 'u'], { top: 'v' });
  return p;
}
function gear(p, cx, cy, r, c = ['s', 't', 'u']) {
  p.ellipse(cx, cy, r, r, c[1]);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.set(Math.round(cx + Math.cos(a) * (r + 0.8) - 0.5), Math.round(cy + Math.sin(a) * (r + 0.8) - 0.5), c[1]); }
  p.ellipse(cx - 0.6, cy - 0.6, r * 0.5, r * 0.5, c[2]); p.ellipse(cx, cy, r * 0.32, r * 0.32, 'n');
  return p;
}

// ── Lumber camp ───────────────────────────────────────────────────────────────
function lumberCamp(lv) {
  const H = [36, 38, 40][lv - 1], p = new Px(32, H), gy = H - 2;
  if (lv === 1) { // open-sided shed on posts
    roof(p, 3, gy - 22, 20, 8, ['f', 'g', 'h']);
    for (const x of [4, 20]) { p.rect(x, gy - 13, 2, 12, 'g'); p.rect(x, gy - 13, 1, 12, 'h'); }
    p.rect(6, gy - 13, 14, 1, 'n'); // shade under the roof
    // sawhorse with a log
    p.line(9, gy - 2, 11, gy - 6, 'f'); p.line(13, gy - 2, 11, gy - 6, 'f'); p.line(15, gy - 2, 17, gy - 6, 'f'); p.line(19, gy - 2, 17, gy - 6, 'f');
    p.rect(8, gy - 8, 12, 2, 'g'); p.rect(8, gy - 8, 12, 1, 'h'); p.set(8, gy - 8, 'i').set(8, gy - 7, 'h');
    logPile(p, 21, gy - 7, 3);
  } else {
    roof(p, 2, gy - 25, 22, 10, lv === 3 ? ['r', 'R', 'o'] : ['f', 'g', 'h']);
    logWall(p, 3, gy - 14, 20, 12);
    door(p, 11, gy - 9, 4, 7);
    windowLit(p, 5, gy - 11, 3, 2); windowLit(p, 18, gy - 11, 3, 2);
    logPile(p, 21, gy - 8, lv === 3 ? 6 : 5);
    if (lv === 3) {
      chimney(p, 17, gy - 29, 5);
      // circular saw on a frame
      p.rect(0, gy - 6, 2, 6, 'g'); gear(p, 4.5, gy - 3.5, 3, ['s', 't', 'v']);
      banner(p, 6, gy - 25, 5, ['r', 'R', 'o']);
      p.rect(3, gy - 15, 20, 1, 't');
    }
  }
  // chopping stump with an axe (all levels)
  const sx = lv === 1 ? 24 : 26, sy = gy - (lv === 1 ? 12 : 15);
  if (lv === 1) { p.rect(sx, sy, 5, 3, 'g'); p.rect(sx, sy, 5, 1, 'i'); p.rect(sx + 4, sy, 1, 3, 'f'); p.line(sx + 2, sy - 3, sx + 3, sy, 'f'); p.rect(sx + 1, sy - 4, 2, 2, 'u'); p.set(sx + 1, sy - 4, 'v'); }
  else { p.line(29, gy - 16, 27, gy - 10, 'g'); p.rect(28, gy - 17, 3, 2, 'u'); p.set(28, gy - 17, 'v'); p.set(30, gy - 16, 't'); }
  return p.outline();
}

// ── Quarry ────────────────────────────────────────────────────────────────────
function quarry(lv) {
  const H = [36, 38, 40][lv - 1], p = new Px(32, H), gy = H - 2;
  // the pit: rough rock rim around a dark terraced hole
  p.ellipse(14, gy - 9, 12.5, 6.5, 't'); p.ellipse(14, gy - 9.5, 10, 4.6, 's'); p.ellipse(14.5, gy - 9, 7.5, 3.2, 'n'); p.ellipse(15, gy - 8.5, 4, 1.6, 'k');
  for (let y = 0; y < H; y++) for (let x = 0; x < 32; x++) if (p.get(x, y) === 't' && (p.get(x, y - 1) === '.' || p.get(x - 1, y) === '.')) p.set(x, y, 'u');
  p.speckle('t', 'u', 0.12, 3).speckle('s', 't', 0.1, 4);
  // terrace ledges inside the pit
  for (let x = 6; x < 23; x++) if (p.get(x, gy - 12) === 's') p.set(x, gy - 12, 't');
  stoneBlocks(p, 19, gy - 13, lv === 1 ? 2 : 3);
  // pickaxe leaning on the blocks
  p.line(17, gy - 2, 20, gy - 8, 'g'); p.line(18, gy - 9, 22, gy - 8, 'u'); p.set(22, gy - 7, 't');
  if (lv === 1) { // wooden tripod hoist with a bucket
    p.line(6, gy - 6, 10, gy - 22, 'g'); p.line(14, gy - 6, 10, gy - 22, 'f'); p.line(10, gy - 22, 10, gy - 10, 'h');
    p.rect(9, gy - 10, 3, 2, 'g').set(9, gy - 10, 'h'); p.set(10, gy - 23, 'f');
  } else { // crane: mast, jib, rope with a hanging block
    const metal = lv === 3;
    p.rect(3, gy - 28, 2, 22, 'g'); p.rect(3, gy - 28, 1, 22, 'h');
    p.rect(3, gy - 28, 18, 2, 'g'); p.rect(3, gy - 28, 18, 1, 'h');
    p.line(5, gy - 20, 12, gy - 26, 'f');
    p.rect(17, gy - 26, 1, 7, 'f'); box(p, 15, gy - 19, 5, 1, 3, ['s', 't', 'u'], { top: 'v' });
    if (metal) { for (const y of [gy - 24, gy - 16, gy - 10]) p.rect(3, y, 2, 1, 'u'); p.rect(19, gy - 28, 2, 2, 'u'); flagPole(p, 3, gy - 35, 7); }
    // mine cart
    p.rect(23, gy - 4, 7, 3, 't'); p.rect(23, gy - 4, 7, 1, 'u'); p.rect(29, gy - 4, 1, 3, 's'); dots(p, [[24, gy - 1], [28, gy - 1]], 'n');
    dots(p, [[24, gy - 5], [26, gy - 5], [25, gy - 6]], 'v');
    if (metal) dots(p, [[27, gy - 5], [26, gy - 6]], 'y'); // gold ore in the cart
  }
  return p.outline();
}

// ── Barracks ──────────────────────────────────────────────────────────────────
function barracks(lv) {
  const H = [36, 40, 42][lv - 1], p = new Px(32, H), gy = H - 2;
  if (lv === 1) { // war tent + weapon rack
    for (let y = 0; y < 18; y++) { const half = 1 + y * 0.75; for (let x = Math.round(13 - half); x <= Math.round(13 + half); x++) p.set(x, gy - 19 + y, x < 13 - half * 0.5 ? 'o' : x > 13 + half * 0.4 ? 'r' : 'R'); }
    for (let y = gy - 11; y <= gy - 2; y++) { const half = (y - (gy - 12)) * 0.45; for (let x = Math.round(13 - half); x <= Math.round(13 + half); x++) p.set(x, y, 'n'); }
    p.line(13, gy - 19, 13, gy - 12, 'r');
    for (let y = gy - 16; y < gy - 1; y += 4) for (let x = 0; x < 32; x++) if (p.get(x, y) === 'R') p.set(x, y, 'w'); // trim stripes
    p.rect(12, gy - 22, 1, 4, 'f'); p.rect(13, gy - 22, 3, 2, 'y'); p.set(15, gy - 21, 'x'); // pennant
    // rack with spears + shield
    p.rect(23, gy - 10, 7, 1, 'g'); p.rect(23, gy - 4, 7, 1, 'g'); p.rect(23, gy - 10, 1, 9, 'f'); p.rect(29, gy - 10, 1, 9, 'f');
    for (const x of [25, 27]) { p.rect(x, gy - 15, 1, 13, 'h'); p.set(x, gy - 16, 'v'); p.set(x, gy - 15, 'u'); }
    p.ellipse(26, gy - 6, 2.5, 2.5, 'C'); p.set(25, gy - 7, 'D'); p.set(26, gy - 6, 'y');
  } else {
    const stone = lv === 3;
    roof(p, 1, gy - 27, 30, 12, ['r', 'R', 'o']);
    if (stone) stoneWall(p, 2, gy - 15, 28, 14); else logWall(p, 2, gy - 15, 28, 14);
    door(p, 13, gy - 10, 6, 9);
    windowLit(p, 5, gy - 12, 3, 3); windowLit(p, 24, gy - 12, 3, 3);
    // shields on the wall
    for (const x of [9, 21]) { p.ellipse(x + 0.5, gy - 11, 1.8, 2, 'C'); p.set(x, gy - 12, 'D'); p.set(x + 1, gy - 10, 'B'); }
    if (stone) {
      // corner watch tower
      p.rect(25, gy - 33, 6, 18, 't'); bricks(p, 25, gy - 33, 6, 18, 't', 's', 4); p.rect(25, gy - 33, 1, 18, 'u'); p.rect(30, gy - 33, 1, 18, 's');
      for (const x of [24, 27, 30]) p.rect(x, gy - 35, 2, 2, 'u');
      p.set(27, gy - 29, 'n').set(27, gy - 28, 'n');
      banner(p, 5, gy - 26, 7, ['r', 'R', 'o']); banner(p, 17, gy - 26, 7, ['r', 'R', 'o']);
      p.rect(2, gy - 15, 28, 1, 'y'); p.set(29, gy - 15, 'x');
    } else flagPole(p, 28, gy - 32, 8);
  }
  return p.outline();
}

// ── Workshop ──────────────────────────────────────────────────────────────────
function workshop(lv) {
  const H = [36, 40, 42][lv - 1], p = new Px(32, H), gy = H - 2;
  const stone = lv === 3;
  if (lv === 1) {
    roof(p, 2, gy - 22, 21, 8, ['f', 'g', 'h']);
    plankWall(p, 3, gy - 13, 19, 12);
    p.rect(7, gy - 10, 10, 9, 'n'); p.rect(7, gy - 10, 10, 1, 'f'); // open front
    dots(p, [[9, gy - 8], [10, gy - 8], [14, gy - 7], [15, gy - 7]], 't'); // tools on the back wall
    p.set(12, gy - 6, 'x').set(12, gy - 5, 'y'); // forge glow
  } else {
    roof(p, 1, gy - 26, 24, 11, stone ? ['s', 't', 'u'] : ['f', 'g', 'h'], { ridge: stone ? 'v' : 'h' });
    if (stone) stoneWall(p, 2, gy - 15, 22, 14); else plankWall(p, 2, gy - 15, 22, 14);
    door(p, 4, gy - 10, 5, 9);
    p.rect(12, gy - 12, 9, 6, 'n'); p.rect(12, gy - 12, 9, 1, 'f'); p.rect(13, gy - 9, 7, 3, 'x'); p.rect(14, gy - 9, 5, 2, 'y'); p.set(16, gy - 9, 'z'); // forge mouth
    chimney(p, 18, gy - 31, 7);
    if (stone) { chimney(p, 5, gy - 30, 6); gear(p, 13, gy - 21, 3.2, ['x', 'y', 'z']); p.rect(1, gy - 15, 24, 1, 'y'); }
  }
  // anvil + gear sign + crate outside (all levels)
  const ax = lv === 1 ? 24 : 26, ay = gy - 4;
  p.rect(ax, ay, 5, 2, 't'); p.rect(ax - 1, ay, 7, 1, 'u'); p.rect(ax + 1, ay + 2, 3, 2, 's'); p.set(ax - 1, ay, 'v'); p.set(ax + 5, ay, 's');
  if (lv === 1) gear(p, 27, gy - 14, 2.6); else { p.rect(26, gy - 20, 1, 12, 'g'); gear(p, 28.5, gy - 19, 2.4, stone ? ['x', 'y', 'z'] : ['s', 't', 'u']); }
  if (lv >= 2) { p.rect(26, gy - 10, 4, 4, 'g'); p.rect(26, gy - 10, 4, 1, 'h'); p.rect(29, gy - 10, 1, 4, 'f'); }
  return p.outline();
}

// ── Tavern ────────────────────────────────────────────────────────────────────
function tavern() {
  const H = 42, p = new Px(32, H), gy = H - 2;
  roof(p, 1, gy - 37, 28, 11, ['r', 'R', 'o']);
  chimney(p, 21, gy - 40, 5);
  plaster(p, 2, gy - 26, 26, 10);              // upper storey
  windowLit(p, 6, gy - 23, 3, 3); windowLit(p, 20, gy - 23, 3, 3);
  p.rect(1, gy - 16, 28, 2, 'g'); p.rect(1, gy - 16, 28, 1, 'h');  // jetty beam
  stoneWall(p, 2, gy - 14, 26, 13);              // ground floor
  door(p, 12, gy - 10, 5, 9);
  windowLit(p, 4, gy - 10, 4, 3); windowLit(p, 21, gy - 10, 4, 3);
  // hanging sign with a mug
  p.rect(28, gy - 17, 3, 1, 'f'); p.rect(29, gy - 16, 1, 1, 't');
  p.rect(27, gy - 15, 4, 4, 'g'); p.rect(27, gy - 15, 4, 1, 'h'); p.rect(28, gy - 14, 2, 2, 'y'); p.set(30, gy - 14, 'x'); p.set(28, gy - 14, 'w');
  // barrels by the door
  for (const x of [19]) { p.rect(x, gy - 4, 4, 4, 'g'); p.rect(x, gy - 4, 4, 1, 'h'); p.rect(x, gy - 2, 4, 1, 't'); p.rect(x + 3, gy - 4, 1, 4, 'f'); }
  p.set(3, gy - 26, 'H'); p.set(4, gy - 27, 'c').set(26, gy - 26, 'H'); // window-box flowers
  return p.outline();
}

// ── Traps (flat on the ground, 16 wide) ──────────────────────────────────────
function spikes(lv, up) {
  const p = new Px(16, 15);
  const top = 6, td = 6, fh = 2;
  // plate with chamfered corners (wood planks / riveted iron)
  const ramp = lv === 1 ? ['f', 'g', 'h'] : ['s', 't', 'u'];
  for (let y = top; y < top + td + fh; y++) for (let x = 1; x < 15; x++) {
    const ey = Math.min(y - top, top + td + fh - 1 - y), ex = Math.min(x - 1, 14 - x);
    const corner = ex + ey < 2;
    if (corner) continue;
    p.set(x, y, y >= top + td ? (y === top + td + fh - 1 ? ramp[0] : ramp[1]) : (y === top ? ramp[2] : ramp[1]));
  }
  if (lv === 1) for (let x = 4; x < 14; x += 4) for (let y = top + 1; y < top + td; y++) p.set(x, y, 'f');
  else dots(p, [[2, top + 1], [13, top + 1], [2, top + td - 1], [13, top + td - 1]], 'v');
  const holes = lv === 1 ? [[3, top + 2], [7, top + 2], [11, top + 2], [5, top + 4], [9, top + 4]] : [[3, top + 2], [6, top + 2], [9, top + 2], [12, top + 2], [4, top + 4], [7, top + 4], [10, top + 4], [13, top + 4]];
  for (const [x, y] of holes) {
    if (!up) { p.set(x, y, 'n'); p.set(x + 1, y, 'n'); continue; }
    const h = lv === 1 ? 4 : 5;
    p.set(x, y, 'n'); p.set(x + 1, y, 'n');
    for (let k = 1; k < h; k++) { p.set(x, y - k, k === h - 1 ? 'v' : 'u'); if (k < h - 2) p.set(x + 1, y - k, 's'); }
  }
  if (up && lv === 2) p.set(6, top - 3, 'r');
  return p.outline();
}
function tarPool() {
  const p = new Px(16, 11);
  p.ellipse(7.5, 5.5, 6.5, 3.6, 'n'); p.ellipse(11, 6.5, 3.2, 2.4, 'n'); p.ellipse(4, 6.8, 2.6, 2, 'n');
  p.ellipse(7, 5, 3.2, 1.4, 'm');
  dots(p, [[5, 4], [6, 4], [10, 5]], 'B'); dots(p, [[5, 3]], 't'); p.set(11, 7, 's').set(12, 7, 'm');
  return p;
}
function tar() { return tarPool().outline(); }
function tarBurning() {
  const base = tarPool();
  return [0, 1, 2].map((f) => {
    const p = base.clone();
    for (const [i, [x, h]] of [[4, 5], [8, 7], [12, 4]].entries()) flame(p, x, 6 + (i % 2), 2, h + ((f + i) % 3) - 1, f + i, { tongues: 1 });
    return p.outline();
  });
}
function crack(n) { // damage overlay, 16×16, drawn on top of a building
  const p = new Px(16, 16);
  const paths = n === 1 ? [[[3, 2], [5, 5], [4, 7], [7, 10]]] : [[[3, 1], [5, 4], [4, 7], [7, 10], [6, 13]], [[13, 3], [11, 6], [12, 8], [9, 9]], [[5, 4], [2, 6]]];
  for (const pts of paths) for (let i = 0; i < pts.length - 1; i++) p.line(...pts[i], ...pts[i + 1], 'k');
  const src = p.clone();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (src.get(x, y) === 'k' && src.get(x + 1, y) === '.') p.set(x + 1, y, 'n');
  if (n === 2) { p.rect(10, 12, 2, 2, 'k'); p.set(12, 12, 'n'); p.set(2, 11, 'k'); }
  return p;
}
function flameTip(f) { const p = new Px(7, 9); flame(p, 3.5, 8, 2.4, 7 + f, f * 2, { tongues: 1 }); return p.outline(); }
function rallyFlag(f) {
  const p = new Px(10, 12);
  p.rect(1, 1, 1, 11, 'f'); p.set(1, 0, 'y');
  const wave = f ? [0, 1, 1, 0, -1, 0] : [0, 0, -1, -1, 0, 1];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) p.set(2 + i, 1 + j + wave[i] + (i > 2 ? 1 : 0), j === 0 ? 'o' : j === 3 ? 'r' : 'R');
  p.set(4, 3 + wave[2], 'y');
  return p.outline();
}
function embedBase() { // stone collar under a tower set into a wall line
  const p = new Px(18, 7);
  for (let i = 0; i < 4; i++) { const x = 1 + i * 4; p.rect(x, 1, 4, 2, 'u'); p.rect(x, 3, 4, 2, 't'); p.set(x + 3, 3, 's').set(x + 3, 4, 's'); p.set(x, 1, 'v'); }
  p.rect(1, 5, 16, 1, 's');
  return p.outline();
}

// ════ build ════
export default function build() {
  const out = [];
  const add = (name, px, kind = 'building', extra = {}) => out.push({ name, px, kind, ...extra });
  const addFrames = (name, list, kind = 'building', extra = {}) => list.forEach((px, i) => add(`${name}_${i}`, px, kind, extra));
  for (const lv of [1, 2, 3]) addFrames(`bld_hearth_l${lv}`, hearth(lv));
  for (let m = 0; m < 16; m++) { add(`bld_wall_wood_${m}`, wall('wood', m), 'wall'); add(`bld_wall_stone_${m}`, wall('stone', m), 'wall'); }
  for (const o of ['h', 'v']) for (const s of ['closed', 'open']) add(`bld_gate_${o}_${s}`, gate(o, s === 'open'));
  for (const lv of [1, 2]) { const b = brazier(lv); addFrames(`bld_brazier_l${lv}`, b.lit); add(`bld_brazier_l${lv}_off`, b.off); }
  for (const lv of [1, 2, 3]) {
    add(`bld_tower_arrow_l${lv}`, arrowTower(lv));
    add(`bld_tower_ballista_l${lv}_base`, ballistaBase(lv));
    addFrames(`bld_tower_frost_l${lv}`, frostTower(lv));
    add(`bld_tower_mortar_l${lv}`, mortar(lv));
    addFrames(`bld_tower_spark_l${lv}`, sparkTower(lv));
    add(`bld_lumber_camp_l${lv}`, lumberCamp(lv));
    add(`bld_quarry_l${lv}`, quarry(lv));
    add(`bld_barracks_l${lv}`, barracks(lv));
    add(`bld_workshop_l${lv}`, workshop(lv));
  }
  for (let d = 0; d < 8; d++) add(`bld_ballista_head_${d}`, ballistaHead(d), 'building', { ax: BALLISTA_HEAD_PIVOT.x, ay: BALLISTA_HEAD_PIVOT.y });
  add('bld_tavern_l1', tavern());
  for (const lv of [1, 2]) { add(`bld_trap_spikes_l${lv}_up`, spikes(lv, true), 'prop'); add(`bld_trap_spikes_l${lv}_down`, spikes(lv, false), 'prop'); }
  add('bld_trap_tar', tar(), 'prop');
  addFrames('bld_trap_tar_burning', tarBurning(), 'fx');
  add('bld_crack_1', crack(1), 'fx'); add('bld_crack_2', crack(2), 'fx');
  addFrames('bld_flame_tip', [flameTip(0), flameTip(1)], 'fx', { ax: 3, ay: 8 });
  addFrames('bld_rally_flag', [rallyFlag(0), rallyFlag(1)], 'fx', { ax: 1, ay: 11 });
  add('bld_embed_base', embedBase(), 'fx', { ax: 9, ay: 6 });
  return out;
}

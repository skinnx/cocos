// Auto-tiling walls (wood palisade / stone curtain) + gates. Built procedurally from a centre post
// and up to four connectors (mask N=1 E=2 S=4 W=8), drawn in ¾ projection on a padded canvas, outlined,
// then cropped to 16×27 so that connector ends have NO outline and neighbours join seamlessly.
//
// Geometry (tile-local; ground row g, height h): a block covering ground rows g0..g1 draws its top face on
// screen rows g0-h..g1-h and its front face on rows g1-h+1..g1. The sprite's bottom 16 rows are the tile
// footprint; anchor = bottom-centre (8, 27). Textures are computed in tile-local coordinates whose periods
// divide 16, so a run of walls reads as one continuous wall.
import { Px } from './_world_helpers.mjs';

export const WALL_W = 16, WALL_H = 27;
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

export function wall(mat, mask) {
  const M = mat === 'wood' ? WOOD : STONE, c = canvas();
  const N = mask & 1, E = mask & 2, So = mask & 4, W = mask & 8;
  const [eg0, eg1] = M.ewG, [nx0, nx1] = M.nsX, h = M.h, po = M.post;
  if (N) block(c, M, nx0, nx1, -P - 2, po.g[0], h, 'ns');
  if (W) block(c, M, -P, po.x[0], eg0, eg1, h, 'ew');
  if (E) block(c, M, po.x[1], 15 + P, eg0, eg1, h, 'ew');
  if (So) block(c, M, nx0, nx1, po.g[1], 15 + P, h, 'ns');
  // post (drawn over the back connectors, under the south one)
  if (So) { const s = c.clone(); block(c, M, po.x[0], po.x[1], po.g[0], po.g[1], po.h, 'post'); /* redraw S on top */ block(c, M, nx0, nx1, po.g[1] + 1, 15 + P, h, 'ns'); void s; }
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
export function gate(orient, open) {
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

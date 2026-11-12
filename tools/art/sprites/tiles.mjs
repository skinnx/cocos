// Ground tiles + biome edge overlays (SPEC §9.3/§9.4). 16×16, no outline, low contrast, seamless.
//
// Edge overlay convention — `edge_<upper>_<lower>_<piece>` is drawn ON TOP of a LOWER-biome tile:
//   n e s w      : the neighbour on that side is UPPER biome → a band of upper creeps in along that edge.
//   ne se sw nw  : outer corner — only that DIAGONAL neighbour is upper → small rounded blob in that corner.
//   ine ise isw inw : inner corner — BOTH orthogonal neighbours (e.g. N and E for ine) are upper → L-shaped
//                  band with a rounded concave corner. Use it instead of drawing the two edge pieces.
// Every band is exactly 5 px deep where it meets the tile border, so pieces chain seamlessly with each other.
import { Px, hash, wset, wget, wshift, boundaryDist } from './_world_helpers.mjs';
import { EDGE_PAIRS } from '../manifest.mjs';

const S = 16;

// ── base tiles ───────────────────────────────────────────────────────────────
function tuft(p, x, y, hi = 'd', lo = 'b') { // tiny grass blade cluster, light top, shadow foot
  wset(p, x, y, hi); wset(p, x + 1, y - 1, hi); wset(p, x + 2, y, hi); wset(p, x + 1, y + 1, lo);
}
function grass(seed) {
  const p = new Px(S, S, 'c');
  p.speckle('c', 'b', 0.045, seed).speckle('c', 'd', 0.06, seed + 11);
  const r = (k) => hash(seed, k);
  const n = 2 + Math.floor(r(1) * 2);
  for (let i = 0; i < n; i++) tuft(p, Math.floor(r(10 + i) * S), 2 + Math.floor(r(20 + i) * 13));
  if (seed % 4 === 3) { wset(p, Math.floor(r(40) * S), Math.floor(r(41) * S), 'e'); } // rare bright sprout
  if (seed % 4 === 2) { const x = Math.floor(r(50) * 12), y = Math.floor(r(51) * 12); wset(p, x, y, 'h'); wset(p, x + 1, y, 'g'); } // pebble in the grass
  return p;
}
function flowerGrass(seed) {
  const p = grass(seed + 100);
  const cols = seed === 0 ? [['w', 'z'], ['w', 'y'], ['H', 'z']] : [['z', 'x'], ['D', 'w'], ['w', 'z']];
  const spots = seed === 0 ? [[3, 4], [11, 3], [7, 11], [13, 12]] : [[2, 9], [9, 6], [13, 13], [5, 2]];
  spots.forEach(([x, y], i) => {
    const [pet, mid] = cols[i % cols.length];
    if (i === 3) { wset(p, x, y, pet); wset(p, x, y + 1, 'b'); return; } // a lone bud
    wset(p, x, y - 1, pet); wset(p, x - 1, y, pet); wset(p, x + 1, y, pet); wset(p, x, y, mid); wset(p, x, y + 1, 'b'); wset(p, x + 1, y + 1, 'b');
  });
  return p;
}
function darkGrass(seed) {
  const p = new Px(S, S, 'b');
  p.speckle('b', 'a', 0.09, seed + 3).speckle('b', 'c', 0.05, seed + 7);
  const r = (k) => hash(seed, k, 7);
  for (let i = 0; i < 3; i++) tuft(p, Math.floor(r(i) * S), 2 + Math.floor(r(i + 9) * 13), 'c', 'a');
  // fallen needles / twig
  const x = Math.floor(r(30) * S), y = Math.floor(r(31) * S);
  if (seed === 1) { wset(p, x, y, 'f'); wset(p, x + 1, y, 'g'); wset(p, x + 2, y + 1, 'f'); }
  if (seed === 2) { wset(p, x, y, 'a'); wset(p, x + 1, y - 1, 'a'); wset(p, x - 1, y - 1, 'a'); wset(p, x, y - 2, 'a'); } // fern sprig
  return p;
}
function dirt(seed) {
  const p = new Px(S, S, 'h');
  p.speckle('h', 'g', 0.07, seed + 2).speckle('h', 'i', 0.05, seed + 21);
  const r = (k) => hash(seed, k, 13);
  for (let i = 0; i < 2; i++) { const x = Math.floor(r(i) * S), y = Math.floor(r(i + 5) * S); wset(p, x, y, 'g'); wset(p, x + 1, y, 'g'); wset(p, x, y - 1, 'i'); }
  if (seed === 1) { const x = Math.floor(r(20) * S), y = Math.floor(r(21) * S); wset(p, x, y, 't'); wset(p, x - 1, y, 'u'); wset(p, x, y + 1, 'g'); } // small stone
  if (seed === 2) { const x = Math.floor(r(22) * S), y = Math.floor(r(23) * S); for (let k = 0; k < 4; k++) wset(p, x + k, y + (k > 1 ? 1 : 0), 'g'); } // crack
  return p;
}
function sand(seed) {
  const p = new Px(S, S, 'i');
  p.speckle('i', 'h', 0.05, seed + 4).speckle('i', 'w', 0.035, seed + 17);
  const r = (k) => hash(seed, k, 19);
  // wind ripples: short wavy 'h' lines
  for (let i = 0; i < 2; i++) {
    const x0 = Math.floor(r(i) * S), y0 = 3 + Math.floor(r(i + 4) * 11);
    for (let k = 0; k < 5; k++) wset(p, x0 + k, y0 + (k === 2 ? -1 : 0), 'h');
  }
  if (seed === 1) { const x = Math.floor(r(30) * S), y = Math.floor(r(31) * S); wset(p, x, y, 'q'); wset(p, x + 1, y, 'w'); wset(p, x, y + 1, 'p'); } // shell
  if (seed === 2) { const x = Math.floor(r(32) * S), y = Math.floor(r(33) * S); wset(p, x, y, 'u'); wset(p, x + 1, y, 't'); }
  return p;
}
// Ruin flagstones: horizontal grout at y=0 and y=8 in every variant; vertical joints at x=0 always
// (so variants mix freely), extra joints differ per variant. Slab top-left edges catch the light.
function ruins(seed) {
  const p = new Px(S, S, 't');
  p.speckle('t', 'u', 0.05, seed + 5).speckle('t', 's', 0.03, seed + 9);
  const joints = [[[0, 7], [0, 10]], [[0, 9], [0, 5, 11]], [[0, 6, 12], [0, 8]]][seed];
  for (const yy of [0, 8]) for (let x = 0; x < S; x++) p.set(x, yy, 's');
  joints.forEach((xs, row) => xs.forEach((jx) => { for (let y = row * 8; y < row * 8 + 8; y++) p.set(jx, y, 's'); }));
  // light catch on slab top/left edges
  joints.forEach((xs, row) => xs.forEach((jx) => { for (let y = row * 8 + 1; y < row * 8 + 8; y++) if (p.get(jx + 1, y) !== 's') p.set(jx + 1, y, 'u'); }));
  for (const yy of [1, 9]) for (let x = 0; x < S; x++) if (p.get(x, yy) !== 's' && hash(seed, x, yy) < 0.7) p.set(x, yy, 'u');
  const r = (k) => hash(seed, k, 23);
  // moss in the grout + a crack
  for (let i = 0; i < 4; i++) { const x = Math.floor(r(i) * S); p.set(x, i < 2 ? 0 : 8, i % 2 ? 'b' : 'c'); }
  const cx = 2 + Math.floor(r(9) * 10), cy = 2 + Math.floor(r(10) * 4) + (seed % 2) * 8;
  p.set(cx, cy, 's').set(cx + 1, cy + 1, 's').set(cx + 1, cy + 2, 's').set(cx + 2, cy + 3, 's');
  if (seed === 2) { p.rect(9, 10, 3, 4, 'h').set(9, 10, 'g').set(10, 10, 'g').set(11, 13, 'g').set(10, 12, 'c'); } // missing chip shows earth + weed
  return p;
}
function water(frame) {
  const base = new Px(S, S, 'C');
  base.speckle('C', 'B', 0.07, 31).speckle('C', 'D', 0.02, 37);
  const waves = new Px(S, S);
  for (const [x, y, n] of [[2, 3, 3], [10, 6, 4], [5, 11, 3], [13, 13, 2]]) {
    for (let k = 0; k < n; k++) wset(waves, x + k, y, 'D');
    wset(waves, x + 1, y + 1, 'B'); wset(waves, x + n - 1, y - 1, 'E');
  }
  return base.stamp(frame ? wshift(waves, 2, 1) : waves);
}

// ── edge overlays ────────────────────────────────────────────────────────────
const D = 5; // depth at tile borders
// Organic band profiles (north band depth per column); both ends = D.
const PROFILES = {
  grass_dirt: [5, 5, 6, 6, 5, 4, 4, 5, 6, 7, 6, 5, 4, 4, 5, 5],
  grass_sand: [5, 6, 6, 5, 4, 4, 5, 5, 6, 6, 7, 6, 5, 4, 5, 5],
  sand_water: [5, 5, 4, 4, 5, 6, 6, 6, 5, 4, 4, 5, 6, 6, 5, 5],
  // forest floor: ragged, finer-grained boundary (softened further by dithering)
  soft: [5, 4, 6, 7, 5, 3, 4, 6, 7, 5, 4, 6, 3, 4, 6, 5],
  // over ruin flagstones: stepped runs that break along slab-sized chunks
  broken: [5, 5, 6, 6, 6, 4, 4, 4, 5, 7, 7, 6, 6, 4, 5, 5],
  dirt_sand: [5, 6, 5, 4, 4, 5, 6, 7, 6, 5, 5, 4, 5, 6, 5, 5],
};
const mk = () => Array.from({ length: S }, () => Array(S).fill(false));
const rot = (m) => { const o = mk(); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) o[y][x] = m[S - 1 - x][y]; return o; }; // 90° clockwise
const union = (a, b) => a.map((r, y) => r.map((v, x) => v || b[y][x]));
function bandN(prof) { const m = mk(); for (let x = 0; x < S; x++) for (let y = 0; y < prof[x]; y++) m[y][x] = true; return m; }
function cornerNE(wob) { // quarter blob around the tile's top-right corner, radius D at both borders
  const m = mk();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = 16 - (x + 0.5), dy = y + 0.5, th = Math.atan2(dy, dx);
    if (Math.hypot(dx, dy) < D + 0.3 + wob * Math.sin(2 * th)) m[y][x] = true;
  }
  return m;
}
function innerNE(prof) { // N band ∪ E band + rounded concave fillet
  let m = union(bandN(prof), rot(bandN(prof)));
  const r = 3, cx = 16 - D - r, cy = D + r; // fillet circle centre (inside lower area)
  for (let y = D - 1; y < D + r; y++) for (let x = 16 - D - r; x < 16 - D + 1; x++)
    if (x >= 0 && y < S && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r + 0.2) m[y][x] = true;
  return m;
}
function paintEdge(mask, upper, rimOut, rimOutLit, edgeHi, edgeLo, tuftC) {
  const p = new Px(S, S);
  const U = (x, y) => x >= 0 && y >= 0 && x < S && y < S && mask[y][x];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (!U(x, y)) continue;
    let c = upper.d[y][x];
    // border pixels of the upper patch (only where the neighbour inside this tile is lower)
    const lowAt = (i, j) => { const X = x + i, Y = y + j; return X >= 0 && Y >= 0 && X < S && Y < S && !mask[Y][X]; };
    if (lowAt(0, 1) || lowAt(1, 0)) c = edgeLo; else if (lowAt(0, -1) || lowAt(-1, 0)) c = edgeHi;
    p.set(x, y, c);
  }
  // rim on the lower side: shadow below/right of the patch, lighter rim above/left (foam for water)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (U(x, y)) continue;
    if (rimOut && (U(x, y - 1) || U(x - 1, y))) p.set(x, y, rimOut);
    else if (rimOutLit && (U(x, y + 1) || U(x + 1, y))) p.set(x, y, rimOutLit);
  }
  // a few blades poking out past the border (grass only)
  if (tuftC) for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++)
    if (!U(x, y) && U(x, y - 1) && (p.get(x, y) === rimOut || !rimOut) && hash(x, y, 77) < 0.18) p.set(x, y, tuftC);
  return p;
}
// Forest-floor seam: no hard rim — the light patch frays into the dark floor (holes along its border, stray
// light pixels and blades just outside it). Tile-border rows/columns are left untouched so pieces chain.
function softenEdge(p, mask, light, blade, seed) {
  const dist = boundaryDist(mask);
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    const h = hash(x, y, seed), d = dist[y][x];
    if (mask[y][x]) { if (d === 1 && h < 0.3) p.set(x, y, '.'); }
    else if (d === 1 && h < 0.42) p.set(x, y, h < 0.12 ? blade : light);
    else if (d === 2 && h < 0.16) p.set(x, y, light);
    else if (d === 3 && h < 0.05) p.set(x, y, light);
  }
  return p;
}
// Ruin flagstones breaking up onto the ground around them: chipped slab edges show the ground through, the ground's
// growth / dust fills the joints near the break, a hairline crack or two, and loose slab fragments lie just outside.
function brokenSlabs(p, mask, low, seed) {
  const dist = boundaryDist(mask);
  let frags = 0;
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    const h = hash(x, y, seed), d = dist[y][x];
    if (mask[y][x]) {
      if (d === 1 && h < 0.2) p.set(x, y, low.base); // chipped-off edge
      else if (d <= 2 && p.get(x, y) === 's' && h < 0.6) p.set(x, y, low.blade); // growth / dust in the joints
      else if (d === 2 && h > 0.88) p.set(x, y, 's'); // hairline crack
    } else if (d === 2 && frags < 2 && x < S - 2 && !mask[y][x + 1] && dist[y][x + 1] >= 2 && h < 0.12) {
      p.set(x, y, 'u').set(x + 1, y, 't'); if (y + 1 < S - 1 && !mask[y + 1][x]) p.set(x, y + 1, low.shadow); // loose fragment + its shadow
      frags++;
    } else if (d === 3 && h < 0.04) p.set(x, y, 't'); // pebble
  }
  return p;
}
// Loose crumbs either side of a soft-material seam (dirt over sand): grains of the lower material inside the patch,
// crumbs of the upper one just outside it.
function crumbs(p, mask, inC, outC, seed) {
  const dist = boundaryDist(mask);
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    const h = hash(x, y, seed);
    if (dist[y][x] === 2 && h < 0.14) p.set(x, y, mask[y][x] ? inC : outC);
  }
  // small corner blobs may get no grain from the hash: place one at the deepest interior pixel
  if (!p.d.some((r) => r.includes(inC))) {
    let best = null;
    for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) if (mask[y][x] && dist[y][x] < 99 && (!best || dist[y][x] > best[2])) best = [x, y, dist[y][x]];
    if (best) p.set(best[0], best[1], inC);
  }
  return p;
}
// Per pair: [upper fill, rim shadow (lower side), lit rim (lower side), upper border hi, upper border lo, blade colour, profile, corner wobble]
const EDGE_STYLE = {
  grass_dirt: () => [grass(1), 'g', null, 'd', 'b', 'c', PROFILES.grass_dirt, 0.7],
  grass_sand: () => [grass(2), 'h', null, 'd', 'b', 'c', PROFILES.grass_sand, 0.7],
  sand_water: () => [sand(0), 'E', 'D', 'i', 'h', null, PROFILES.sand_water, -0.6],
  grass_grassdark: () => [grass(0), null, null, 'd', 'b', null, PROFILES.soft, 0.9],
  grassdark_dirt: () => [darkGrass(0), 'g', null, 'c', 'a', 'b', PROFILES.grass_dirt, 0.7],
  grassdark_sand: () => [darkGrass(1), 'h', null, 'c', 'a', 'b', PROFILES.grass_sand, 0.7],
  dirt_sand: () => [dirt(0), 'h', null, 'i', 'g', null, PROFILES.dirt_sand, 0.6],
  // ruin flagstones over the ground: slabs lit top-left ('u'), dark bottom-right edge ('s'), ground shadow below
  ruins_grass: () => [ruins(0), 'b', null, 'u', 's', 'd', PROFILES.broken, 0.4],
  ruins_grassdark: () => [ruins(1), 'a', null, 'u', 's', 'c', PROFILES.broken, 0.4],
  ruins_dirt: () => [ruins(2), 'g', null, 'u', 's', null, PROFILES.broken, 0.4],
  ruins_sand: () => [ruins(0), 'h', null, 'u', 's', null, PROFILES.broken, 0.4],
};
// the ground under ruins_<lower>: base, shadow and growth/dust colours (used by brokenSlabs)
const UNDER = {
  ruins_grass: { base: 'c', shadow: 'b', blade: 'd' }, ruins_grassdark: { base: 'b', shadow: 'a', blade: 'c' },
  ruins_dirt: { base: 'h', shadow: 'g', blade: 'h' }, ruins_sand: { base: 'i', shadow: 'h', blade: 'i' },
};
function edges(pair) {
  const [upper, rimOut, rimLit, hi, lo, tuftC, prof, wob] = EDGE_STYLE[pair]();
  const n = bandN(prof), ne = cornerNE(wob), ine = innerNE(prof);
  const r1 = rot, r2 = (m) => rot(rot(m)), r3 = (m) => rot(rot(rot(m)));
  const masks = { n, e: r1(n), s: r2(n), w: r3(n), ne, se: r1(ne), sw: r2(ne), nw: r3(ne), ine, ise: r1(ine), isw: r2(ine), inw: r3(ine) };
  return Object.entries(masks).map(([k, m], i) => {
    const p = paintEdge(m, upper, rimOut, rimLit, hi, lo, tuftC);
    if (pair === 'sand_water') { // second, broken foam ring + sparkle for life
      const src = p.clone();
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (src.d[y][x] !== '.') continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => src.get(x + i, y + j) === 'E') && hash(x, y, 5) < 0.45) p.set(x, y, 'D');
      }
    }
    if (pair === 'grass_grassdark') softenEdge(p, m, 'c', 'd', 91 + i);
    if (pair === 'dirt_sand') crumbs(p, m, 'i', 'g', 151 + i);
    if (UNDER[pair]) brokenSlabs(p, m, UNDER[pair], 131 + i);
    return { name: `edge_${pair}_${k}`, px: p, kind: 'tile', ax: 0, ay: 0 };
  });
}

export default function build() {
  const out = [];
  const add = (name, px) => out.push({ name, px, kind: 'tile', ax: 0, ay: 0 });
  for (let i = 0; i < 4; i++) add(`tile_grass_${i}`, grass(i));
  for (let i = 0; i < 2; i++) add(`tile_grass_flower_${i}`, flowerGrass(i));
  for (let i = 0; i < 3; i++) add(`tile_grass_dark_${i}`, darkGrass(i));
  for (let i = 0; i < 3; i++) add(`tile_dirt_${i}`, dirt(i));
  for (let i = 0; i < 3; i++) add(`tile_sand_${i}`, sand(i));
  for (let i = 0; i < 3; i++) add(`tile_ruins_${i}`, ruins(i));
  for (let i = 0; i < 2; i++) add(`tile_water_${i}`, water(i));
  for (const pair of EDGE_PAIRS) out.push(...edges(pair));
  return out;
}

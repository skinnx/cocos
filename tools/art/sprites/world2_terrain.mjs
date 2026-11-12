// SPEC v2 world terrain (SPEC §4, §9.9): snow / ice / ash / lava tiles, biome edge overlays for EDGE_PAIRS_V2,
// the Gloom veil, and the v2 props (snow pines, dead trees, regional nodes, ancient ruin, boat, expedition chest,
// rubble, rift heart). Owner: art-terrain. Aggregated by world2.mjs together with world2_buildings.mjs.
//
// Edge overlays follow tiles.mjs exactly: `edge_<upper>_<lower>_<piece>` is drawn on a LOWER-material tile; bands are
// 5 px deep at the tile border; n/e/s/w = edge band, ne.. = outer-corner blob, ine.. = inner-corner L (replaces the
// two bands it joins). Materials stack (low → high) water < sand < dirt < grassdark < grass, with snow and ash above
// grass (ash_grass / ash_grassdark exist, so ash must sit above grass), then ruins on top.
//
// Ice and lava are self-contained "features" whose border pixels are plain snow / ash ground, so they drop into a
// snow / ash region as tile variants without needing edges of their own.
//
// The veil (fx, 16×24): the lower 16 rows are the tile it stands on (same texture family as veil_fill) and the top
// 8 rows are mist billowing up over the neighbouring tile. Columns wrap, so it tiles seamlessly along a border row.
import { Px, hash, wset, dots, thick, boundaryDist } from './_world_helpers.mjs';
import { S, edgeMasks, paintEdge, snowSeam, scorchSeam, brokenSlabs, volume, chamfer, remap, wdx } from './_terrain_helpers.mjs';
import { EDGE_PAIRS_V2 } from '../manifest.mjs';
import tilesV1 from './tiles.mjs';

let V1 = null; // v1 base tiles (ruin flagstones are the upper fill of ruins_snow / ruins_ash)
const v1 = (name) => { if (!V1) V1 = new Map(tilesV1().map((e) => [e.name, e.px])); return V1.get(name).clone(); };

// ═════════════════════════════ base tiles ═════════════════════════════
// Snow: soft off-white drifts. Wind ripples are short arcs (lit 'w' crest over a 'u' trough), a few cold sparkles.
function snow(seed) {
  const p = new Px(S, S, 'v');
  p.speckle('v', 'w', 0.05, seed + 61).speckle('v', 'u', 0.012, seed + 67);
  const r = (k) => hash(seed, k, 71);
  for (let i = 0; i < 2; i++) {
    const x0 = Math.floor(r(i) * S), y0 = 4 + Math.floor(r(i + 4) * 10), n = 4 + Math.floor(r(i + 8) * 3);
    for (let k = 0; k < n; k++) { const dy = k === 0 || k === n - 1 ? 0 : -1; wset(p, x0 + k, y0 + dy, 'u'); wset(p, x0 + k, y0 + dy - 1, 'w'); }
  }
  wset(p, Math.floor(r(20) * S), Math.floor(r(21) * S), 'E');
  if (seed === 1) { const x = Math.floor(r(30) * 11) + 2, y = Math.floor(r(31) * 10) + 4; for (let k = 0; k < 4; k++) { wset(p, x + k, y, k < 2 ? 'w' : 'v'); wset(p, x + k, y + 1, k === 0 ? 'v' : 'u'); } wset(p, x + 1, y - 1, 'w'); } // a small drift mound
  if (seed === 2) { const x = Math.floor(r(32) * 12) + 2, y = Math.floor(r(33) * 10) + 3; wset(p, x, y, 't'); wset(p, x + 1, y, 's'); wset(p, x, y - 1, 'w'); wset(p, x + 1, y + 1, 'u'); } // stone under the snow
  return p;
}
// Ice: a frozen pool sunk into snow (snow at every tile border). Shaded far bank on the pool's top-left inner edge,
// lit near bank bottom-right; diagonal reflection streaks and a hairline crack on the ice.
function ice(seed) {
  const p = snow(seed === 0 ? 0 : 2);
  const blobs = seed === 0 ? [[8.5, 8.5, 6.2, 5.4], [5.5, 6, 3.4, 3]] : [[6, 6.5, 4.6, 3.8], [11.2, 11, 3.6, 3.1], [9, 8.5, 2.5, 2]];
  const m = Array.from({ length: S }, (_, y) => Array.from({ length: S }, (_, x) =>
    x > 0 && y > 0 && x < S - 1 && y < S - 1 && blobs.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1)));
  const I = (x, y) => x >= 0 && y >= 0 && x < S && y < S && m[y][x];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (I(x, y)) p.set(x, y, !I(x, y - 1) || !I(x - 1, y) ? 'C' : !I(x, y + 1) || !I(x + 1, y) ? 'E' : 'D');
    else if (I(x, y - 1) || I(x - 1, y)) p.set(x, y, 'w');        // near bank catches the light
    else if (I(x, y + 1) || I(x + 1, y)) p.set(x, y, 'u');        // far bank in shadow
  }
  const streaks = seed === 0 ? [[6, 10], [10, 7], [11, 11]] : [[4, 7], [10, 12], [8, 9]];
  for (const [x, y] of streaks) for (let k = 0; k < 3; k++) if (I(x + k, y - k) && p.get(x + k, y - k) === 'D') p.set(x + k, y - k, 'E');
  const crack = seed === 0 ? [[5, 8], [6, 8], [7, 9], [8, 9], [9, 10]] : [[5, 6], [6, 7], [7, 7], [11, 10], [12, 11]];
  for (const [x, y] of crack) if (p.get(x, y) === 'D') p.set(x, y, 'C');
  const g = seed === 0 ? [9, 6] : [5, 5]; if (I(...g)) p.set(g[0], g[1], 'w');
  return p;
}
// Ash: burnt slate-grey ground with charcoal grit, drifted pale ash and scorched-earth stains.
function ash(seed) {
  const p = new Px(S, S, 's');
  p.speckle('s', 'n', 0.04, seed + 81).speckle('s', 't', 0.03, seed + 83);
  const r = (k) => hash(seed, k, 89);
  for (let i = 0; i < 2; i++) { // ash drifts: small pale smudges, lit on top
    const x = Math.floor(r(i) * S), y = Math.floor(r(i + 3) * S);
    wset(p, x, y, 't'); wset(p, x + 1, y, 't'); wset(p, x + 2, y + 1, 't'); wset(p, x + 1, y - 1, 'u');
  }
  { const x = Math.floor(r(10) * S), y = Math.floor(r(11) * S); wset(p, x, y, 'f'); wset(p, x + 1, y, 'f'); wset(p, x, y + 1, 'f'); wset(p, x - 1, y + 1, 'n'); } // scorch stain
  if (seed === 1) { const x = 3 + Math.floor(r(20) * 9), y = 3 + Math.floor(r(21) * 10); for (let k = 0; k < 4; k++) wset(p, x + k, y + (k > 1 ? 1 : 0), k === 0 ? 'f' : 'n'); wset(p, x + 1, y - 1, 't'); } // charred twig
  if (seed === 2) { const x = 3 + Math.floor(r(22) * 10), y = 3 + Math.floor(r(23) * 10); wset(p, x, y, 'u'); wset(p, x + 1, y, 't'); wset(p, x, y + 1, 't'); wset(p, x + 1, y + 1, 'n'); wset(p, x + 2, y + 1, 'n'); } // half-buried pebble
  return p;
}
// Cooled lava: a crusted fissure in ash ground. Glowing cracks run from a hot centre to the middle of the top, right
// and bottom borders (so neighbouring lava tiles join up) and cool to dim red toward the border (so an ash neighbour
// just sees a hairline). Blackened basalt crust lines the cracks; frame 1 the cracks flare and heat bleeds red.
const LAVA_PATHS = [[[8, -1], [7, 3], [9, 6], [8, 8]], [[8, 8], [11, 9], [13, 7], [16, 8]], [[8, 8], [6, 11], [7, 14], [8, 16]],
  [[9, 6], [6, 5], [3, 6]], [[6, 11], [3, 12]], [[11, 9], [12, 12]]];
function segDist(px, py, [ax, ay], [bx, by]) { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
function lava(frame) {
  const p = ash(0);
  const dist = (x, y) => { let d = 99, main = false; LAVA_PATHS.forEach((pts, k) => { for (let i = 0; i < pts.length - 1; i++) { const e = segDist(x, y, pts[i], pts[i + 1]); if (e < d) { d = e; main = k < 3; } } }); return [d, main]; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const [d, main] = dist(x, y), rr = Math.hypot(x - 8, y - 8.5);
    if (d < (main ? 0.62 : 0.5)) {
      const heat = main ? (rr < 2.5 ? 3 : rr < 5 ? 2 : rr < 6.6 ? 1 : 0) : rr < 4 ? 1 : 0;
      p.set(x, y, frame ? ['r', 'x', 'y', 'z'][heat] : ['n', 'r', 'x', 'y'][heat]);
    } else if (d < 1.7 && rr < 7.5) p.set(x, y, 'n');
    else if (d < 2.7 && rr < 6.5 && hash(x, y, 17) < 0.55) p.set(x, y, hash(x, y, 18) < 0.3 ? 'f' : 'n');
  }
  // crust relief: lip pixels whose crack is below/right face the light; heat bleed next to hot cracks on frame 1
  const src = p.clone(), hot = (c) => 'xyz'.includes(c);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (src.d[y][x] !== 'n') continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([i, j]) => src.get(x + i, y + j));
    if (frame && nb.some((c) => 'yz'.includes(c))) p.set(x, y, 'r');
    else if (hot(nb[0]) || hot(nb[2])) p.set(x, y, 's');
  }
  return p;
}

// ═════════════════════════════ edge overlays ═════════════════════════════
const PROF = {
  drift: [5, 5, 6, 6, 6, 5, 4, 4, 4, 5, 6, 7, 7, 6, 5, 5],   // snow: smooth rounded drifts
  drift2: [5, 6, 6, 5, 4, 4, 5, 6, 7, 7, 6, 5, 4, 4, 5, 5],
  burn: [5, 4, 6, 6, 5, 3, 4, 5, 7, 6, 4, 5, 4, 5, 6, 5],    // ash: ragged burnt front
  broken: [5, 5, 6, 6, 6, 4, 4, 4, 5, 7, 7, 6, 6, 4, 5, 5],  // ruin slabs: stepped runs (same as tiles.mjs)
};
// snow over <lower>: drift lip (lit top-left crest 'w', 'u' trough on its bottom-right), shadow on the lower ground,
// lower ground (or its blades) poking through just inside the drift, loose snow clumps outside.
const SNOW_LOW = {
  grass: { rim: 'b', poke: 'b', pokeHi: 'c' }, grassdark: { rim: 'a', poke: 'a', pokeHi: 'b' },
  sand: { rim: 'h', poke: 'h', pokeHi: 'i' }, dirt: { rim: 'g', poke: 'g', pokeHi: 'h' },
};
// ash over <lower>: singed ring colours (inner, outer) and the ash fleck colour.
const ASH_LOW = {
  grass: { singe: ['g', 'f'], singe2: 'b' }, grassdark: { singe: ['f', 'g'], singe2: 'a' },
  sand: { singe: ['h', 'g'], singe2: 'h' }, dirt: { singe: ['g', 'f'], singe2: 'g' },
};
const RUIN_LOW = { snow: { base: 'v', shadow: 'u', blade: 'v', rim: 'u' }, ash: { base: 's', shadow: 'n', blade: 't', rim: 'n' } };

function edges(pair) {
  const [up, low] = pair.split('_');
  const out = [];
  let prof, wob, fill, opts, post;
  if (up === 'snow') {
    const L = SNOW_LOW[low];
    prof = low === 'grass' || low === 'dirt' ? PROF.drift : PROF.drift2; wob = 0.7; fill = snow(0);
    opts = { rimOut: L.rim, hi: 'w', lo: 'u' };
    post = (p, m, i) => snowSeam(p, m, { poke: L.poke, pokeHi: L.pokeHi, seed: 211 + i });
  } else if (up === 'ash') {
    const L = ASH_LOW[low];
    prof = PROF.burn; wob = 0.9; fill = ash(1);
    opts = { lo: 'n' };
    post = (p, m, i) => scorchSeam(p, m, { singe: L.singe, singe2: L.singe2, fleck: 's', seed: 231 + i });
  } else { // ruins over snow / ash
    const L = RUIN_LOW[low];
    prof = PROF.broken; wob = 0.4; fill = v1(low === 'snow' ? 'tile_ruins_0' : 'tile_ruins_1');
    opts = { rimOut: L.rim, hi: 'u', lo: 's' };
    post = (p, m, i) => brokenSlabs(p, m, L, 251 + i);
  }
  const masks = edgeMasks(prof, wob);
  Object.entries(masks).forEach(([k, m], i) => out.push({ name: `edge_${pair}_${k}`, px: post(paintEdge(m, fill, opts), m, i), kind: 'tile', ax: 0, ay: 0 }));
  return out;
}

// ═════════════════════════════ the Gloom veil ═════════════════════════════
// Seamless churning texture: periodic in x and y with period 16. `ox` shifts it horizontally (rolling).
function veilTex(x, y, ox = 0) {
  const T = (2 * Math.PI) / S, X = x - ox;
  return Math.sin(T * X + 1.7 * Math.sin(T * y + 0.6)) + 0.7 * Math.sin(T * 2 * y + 1.3 * Math.cos(T * X) + 1.1);
}
// Mostly flat 'm' with loose deep-violet grain, a faint swirl and a rare lit fleck: dense enough to read as an opaque
// wall, quiet enough that a field of it doesn't read as wallpaper.
function veilColor(v, x, y) {
  const h = hash(x, y, 301);
  return v < -1.5 || h < 0.06 ? 'n' : h > 0.988 ? 'M' : 'm';
}
function veilFill() {
  const p = new Px(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) p.set(x, y, veilColor(veilTex(x, y), x, y));
  return p;
}
// Border frame: rows 8..23 = the veiled tile (fill texture, drifting 4 px/frame), rows 0..7 = billows spilling over the
// open neighbour. Two rows of puffs roll in opposite directions (front +4 px/frame, back −4 ≡ +12), so the 4 frames
// loop and the bank churns. Front puffs: lit 'L' rim on their top-left silhouette, 'M' upper body, 'm' lower body,
// a dark 'n' crease where they sink into the bank; back puffs one tone darker. Wisps peel off the top and rise.
function veil(frame) {
  const W = S, H = 24, p = new Px(W, H);
  for (let y = 8; y < H; y++) for (let x = 0; x < W; x++) { const X = (((x - frame * 4) % W) + W) % W; p.set(x, y, veilColor(veilTex(X, y - 8), X, y - 8)); }
  const ph = (frame * Math.PI) / 2;
  const rows = [
    { cy: 9.4, shift: -4, puffs: [[7, 4], [14.5, 3.2]], back: true },
    { cy: 10.4, shift: 4, puffs: [[2.5, 7.6], [11, 4.6]], back: false },
  ];
  for (const row of rows) row.puffs.forEach(([px0, r0], i) => {
    const cx = (((px0 + row.shift * frame) % W) + W) % W, r = r0 + 0.5 * Math.sin(ph + i * 2.6 + (row.back ? 1.2 : 0)), cy = row.cy - 0.5 * Math.cos(ph + i * 1.9);
    const inP = (x, y) => { const dx = ((x + 0.5 - cx + W * 1.5) % W) - W / 2, dy = y + 0.5 - cy; return Math.hypot(dx, dy) <= r; };
    for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++) for (let x = 0; x < W; x++) {
      if (!inP(x, y)) continue;
      const dx = ((x + 0.5 - cx + W * 1.5) % W) - W / 2, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / r, top = !inP(x, y - 1);
      let c;
      if (row.back) c = top ? 'M' : dx + dy > r * 0.5 ? 'n' : 'm';
      else if (top && dy < 0) c = dx < r * 0.25 ? 'L' : 'M';
      else if (d > 0.84 && dy > 0.25 * r) c = 'n';
      else c = dx * 0.6 + dy * 0.8 < -0.15 * r ? 'M' : 'm';
      p.set(x, y, c);
    }
  });
  // hazy fringe: a checker of dark mist just outside the billows' upper silhouette (reads as fog, not a hard edge)
  { const src = p.clone();
    for (let y = 0; y < 9; y++) for (let x = 0; x < W; x++) if (src.get(x, y) === '.' && src.get(x, y + 1) !== '.' && (x + y + frame) % 2 === 0) p.set(x, y, src.get(x, y + 1) === 'L' ? 'M' : 'm'); }
  // wisps peeling off the top and rising (1 px per frame), plus motes
  [[1, 2, 1], [9, 3, -1]].forEach(([wx, wy, dir]) => {
    const y = wy - frame + 1, x = (wx + frame * dir + W) % W, len = 3 - (frame >> 1);
    if (y < 0) return;
    for (let k = 0; k < len; k++) { const X = (x + k) % W; if (p.get(X, y) === '.') p.set(X, y, k === 0 ? 'L' : 'M'); }
  });
  const motes = [[[6, 1], [13, 0]], [[6, 0], [14, 2]], [[5, 2], [14, 1]], [[5, 1], [13, 2]]][frame];
  for (const [x, y] of motes) if (p.get(x, y) === '.') p.set(x, y, 'L');
  return p;
}

// ═════════════════════════════ props ═════════════════════════════
// Snow-laden pine: the v1 pine build (stacked tiers, top-left light) in colder greens, with each tier's upper half
// under a wavy snow cap (lit 'w' left, 'v' right, 'u' lip on the shaded side) over its green hem, and a snow mound.
function snowPine(v) {
  const p = new Px(18, 26), cx = 9, snowM = Array.from({ length: 26 }, () => Array(18).fill(false));
  p.rect(8, 20, 2, 5, 'g').rect(8, 20, 1, 5, 'h').rect(9, 20, 1, 5, 'f');
  const tiers = v === 0 ? [[13, 8, 7.5], [8, 7, 5.6], [3, 6, 3.8]] : [[15, 6, 8], [11, 6, 6.6], [7, 5, 5], [2, 6, 3.2]];
  tiers.forEach(([y0, rows, mh], ti) => {
    for (let r = 0; r < rows; r++) {
      const half = 0.6 + (r * (mh - 0.6)) / (rows - 1);
      for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
        p.set(x, y0 + r, 'b');
        const capRows = rows * (v === 1 ? 0.55 : 0.45) + (hash(x, ti, 7) < 0.5 ? 1 : 0) - (x >= cx + 2 ? 1 : 0);
        snowM[y0 + r][x] = r < Math.max(1.5, capRows);
      }
    }
    for (let x = Math.round(cx - mh) + 1; x < Math.round(cx + mh) - 1; x += 2) { p.set(x + (ti % 2), y0 + rows, 'b'); snowM[y0 + rows][x + (ti % 2)] = false; }
  });
  volume(p, cx - 1, 12, 7, 10, ['a', 'b', 'c'], { on: ['b'], hiT: -0.5, loT: 0.2 });
  tiers.forEach(([y0, rows]) => { for (let x = 0; x < 18; x++) if (p.get(x, y0 + rows) !== '.' && p.get(x, y0 + rows - 1) !== '.') p.set(x, y0 + rows, 'a'); });
  p.speckle('b', 'a', 0.12, 13 + v).speckle('c', 'b', 0.2, 17 + v);
  for (let y = 0; y < 26; y++) for (let x = 0; x < 18; x++) {
    if (!snowM[y][x] || p.get(x, y) === '.') continue;
    const lip = y + 1 < 26 && !snowM[y + 1][x] && p.get(x, y + 1) !== '.';
    p.set(x, y, lip && x >= cx ? 'u' : x < cx - 1 ? 'w' : 'v');
  }
  // icicle-like drips of snow over the hems + the mound at the foot
  for (const [x, y] of v === 0 ? [[4, 17], [12, 11], [6, 6]] : [[3, 18], [13, 14], [6, 10]]) if (p.get(x, y) !== '.' && !snowM[y][x]) p.set(x, y, 'v');
  p.ellipse(9, 24.5, 4.5, 1.3, 'v'); p.set(5, 25, 'u').rect(10, 25, 4, 1, 'u'); p.rect(8, 23, 2, 1, 'g').set(6, 24, 'w').set(7, 24, 'w');
  return p.outline();
}
// Dead trees: v0 a gnarled bare tree (forked limbs, twigs, a hollow knot), v1 a lightning-split burnt snag with an
// ember still glowing in its split.
function deadTree(v) {
  const p = new Px(18, 26);
  const limb = (pts, w, c = 'g') => { for (let i = 0; i < pts.length - 1; i++) thick(p, ...pts[i], ...pts[i + 1], c, w); };
  if (v === 0) {
    limb([[8, 24], [8, 17], [7, 12], [8, 9]], 3);
    limb([[8, 13], [5, 9], [3, 5], [2, 2]], 2); limb([[9, 12], [12, 8], [14, 5], [15, 2]], 2);
    limb([[8, 9], [9, 5], [8, 1]], 1); limb([[4, 7], [1, 6]], 1); limb([[13, 7], [16, 7]], 1); limb([[10, 16], [13, 14], [15, 14]], 1);
    limb([[3, 4], [4, 2]], 1); limb([[14, 4], [12, 2]], 1); limb([[7, 19], [4, 17]], 1);
    p.set(6, 24, 'g').set(11, 24, 'g').set(5, 25, 'g').set(12, 25, 'g');
  } else {
    limb([[7, 25], [7, 10]], 4);
    limb([[8, 14], [12, 10], [14, 9]], 2); limb([[7, 17], [4, 15], [3, 13]], 2); limb([[13, 10], [15, 7]], 1); limb([[4, 14], [2, 15]], 1);
    // splintered top: jagged spikes
    for (const [x, h] of [[7, 3], [8, 6], [9, 2], [10, 5]]) for (let k = 0; k < h; k++) p.set(x, 9 - k, 'g');
    p.set(5, 25, 'g').set(12, 25, 'g').set(6, 24, 'g').set(11, 24, 'g');
  }
  // light: left-facing edges 'h', right/bottom edges 'f'
  const src = p.clone();
  for (let y = 0; y < 26; y++) for (let x = 0; x < 18; x++) {
    if (src.get(x, y) !== 'g') continue;
    if (src.get(x + 1, y) === '.' || src.get(x, y + 1) === '.') p.set(x, y, 'f'); else if (src.get(x - 1, y) === '.' || src.get(x, y - 1) === '.') p.set(x, y, 'h');
  }
  if (v === 0) {
    p.rect(8, 15, 1, 6, 'f').set(9, 21, 'f'); p.rect(8, 18, 2, 2, 'n').set(8, 18, 'k'); // bark groove + hollow knot
    dots(p, [[7, 22], [9, 12], [5, 9]], 'n'); // charred patches
    dots(p, [[7, 23], [10, 23]], 's');
  } else {
    // charred: most of the bark burnt to charcoal, a few lit bark streaks remain on the left
    for (let y = 0; y < 26; y++) for (let x = 0; x < 18; x++) {
      const c = p.get(x, y); if (c === '.') continue;
      if (c === 'g') p.set(x, y, hash(x, y, 9) < 0.55 ? 'n' : 's'); else if (c === 'f') p.set(x, y, hash(x, y, 4) < 0.5 ? 'k' : 'n'); else if (c === 'h') p.set(x, y, hash(x, y, 8) < 0.6 ? 't' : y > 16 ? 'g' : 's');
    }
    p.rect(8, 11, 1, 9, 'x').set(8, 13, 'y').set(8, 16, 'y').set(8, 14, 'z').set(9, 15, 'x').set(7, 18, 'x'); // glowing split
    p.set(9, 12, 'r').set(9, 18, 'r');
    p.ellipse(8, 24.5, 5, 1.4, 't'); p.set(4, 25, 's').rect(10, 25, 4, 1, 's').set(6, 24, 'u');
    p.rect(7, 22, 3, 3, 'n').rect(7, 23, 1, 2, 's');
  }
  return p.outline();
}
// Resin node: a pine snag weeping amber sap. v0 tall snag with two blobs and drips; v1 a wide tapped stump with a
// notch, sap running into a little wooden cup. Spent: the same snag scraped pale where the sap was.
function snag(p) {
  const top = [5, 4, 6, 3, 5, 7]; // jagged broken top per column (x = 5..10)
  for (let i = 0; i < 6; i++) p.rect(5 + i, top[i], 1, 18 - top[i], 'g');
  p.set(4, 17, 'g').set(11, 17, 'f').set(3, 18, 'g').set(12, 18, 'f').rect(4, 18, 8, 1, 'g');
  for (let i = 0; i < 6; i++) { p.set(5 + i, top[i], 'h'); }
  p.rect(5, 6, 1, 12, 'h').rect(10, 8, 1, 10, 'f');
  for (const [x, y0, y1] of [[7, 7, 12], [9, 5, 9], [8, 13, 17]]) p.rect(x, y0, 1, y1 - y0, 'f');
  p.set(6, 3, 'i').set(8, 3, 'i');
  return p;
}
function amber(p, x, y, w, h) { // glossy blob: x body, y upper-left, z glint, r dark underside
  p.ellipse(x, y, w, h, 'x');
  for (let j = Math.floor(y - h); j <= Math.ceil(y + h); j++) for (let i = Math.floor(x - w); i <= Math.ceil(x + w); i++) if (p.get(i, j) === 'x') {
    const t = ((i + 0.5 - x) / w) * 0.6 + ((j + 0.5 - y) / h) * 0.8; if (t < -0.3) p.set(i, j, 'y'); else if (t > 0.6) p.set(i, j, 'r');
  }
  p.set(Math.floor(x - w * 0.4), Math.floor(y - h * 0.5), 'z');
  return p;
}
function resin(v) {
  if (v === 'spent') {
    const p = snag(new Px(16, 20));
    p.rect(7, 8, 3, 3, 'i').set(9, 10, 'h').set(7, 8, 'w'); p.rect(8, 11, 1, 3, 'h'); p.rect(9, 14, 2, 2, 'i'); // scraped scars
    p.set(8, 14, 'f').set(10, 16, 'f'); dots(p, [[6, 18], [10, 18]], 'f');
    p.set(4, 18, 'c').set(12, 18, 'b');
    return p.outline();
  }
  if (v === 0) {
    const p = snag(new Px(16, 20));
    amber(p, 8, 9, 1.8, 1.6); amber(p, 9.7, 14, 1.2, 1.1);
    p.rect(8, 11, 1, 3, 'x').set(8, 13, 'y'); p.set(7, 11, 'r'); // drip
    p.rect(6, 18, 4, 1, 'x').set(6, 18, 'y').set(9, 18, 'r'); // sap pooled at the foot
    p.set(4, 18, 'c').set(12, 18, 'b');
    return p.outline();
  }
  const p = new Px(18, 19);
  for (let x = 3; x <= 13; x++) { const bulge = x === 3 || x === 13 ? 1 : 0; p.rect(x, 5 + bulge, 1, 10 - bulge, 'g'); } // body
  p.rect(2, 13, 13, 2, 'g').set(1, 14, 'g').set(15, 14, 'f').rect(1, 15, 15, 1, 'f').set(0, 15, 'g'); // root flare
  p.rect(3, 6, 1, 8, 'h').rect(4, 5, 1, 9, 'h').rect(13, 6, 1, 9, 'f').rect(12, 5, 1, 9, 'f');
  for (const [x, y0] of [[6, 7], [10, 6], [8, 10]]) p.rect(x, y0, 1, 14 - y0, 'f');
  p.ellipse(8, 4.6, 5.6, 2.1, 'h'); p.ellipse(8, 4.6, 3.8, 1.2, 'i'); p.ellipse(8, 4.6, 1.6, 0.6, 'h'); p.set(10, 4, 'g').set(11, 5, 'g'); // cut top + rings
  p.rect(5, 7, 4, 3, 'n').rect(5, 7, 4, 1, 'f'); // tap notch
  amber(p, 7, 9.8, 1.7, 1.3); p.rect(7, 11, 1, 2, 'x');
  // wooden bucket hung under the tap, brimming with sap
  p.rect(5, 13, 6, 4, 'h').rect(5, 13, 1, 4, 'i').rect(10, 13, 1, 4, 'g').rect(5, 15, 6, 1, 't').set(10, 15, 's');
  p.rect(5, 12, 6, 1, 'x').rect(5, 12, 2, 1, 'y').set(9, 12, 'r');
  p.set(2, 15, 'c').set(14, 16, 'b');
  return p.outline();
}
// Frost crystals: hexagonal prisms (lit 'E' left face, 'D' middle, 'C' right face, 'w' tip) growing out of a
// snow-capped rock. Spent: snapped stumps and loose shards.
function crystal(p, x, yb, h, lean = 0, w = 3) {
  for (let k = 0; k < h; k++) {
    const xo = x + Math.round((lean * k) / h), y = yb - k, ww = k >= h - 1 ? 1 : k >= h - 2 ? 2 : w;
    for (let i = 0; i < ww; i++) p.set(xo + i + (ww < w && lean >= 0 ? (w - ww) >> 1 : 0), y, ww === 1 ? 'w' : i === 0 ? 'E' : i === ww - 1 ? 'C' : 'D');
  }
  return p;
}
function frost(v) {
  const p = new Px(16, 18);
  p.ellipse(8, 14, 6.4, 2.5, 't'); volume(p, 8, 14, 6.4, 2.5, ['s', 't', 'u'], { hiT: -0.35, loT: 0.3 });
  if (v === 'spent') {
    for (const [x, h] of [[4, 3], [7, 4], [10, 2]]) crystal(p, x, 13, h, 0, 3);
    for (const [x, y] of [[6, 10], [10, 11]]) p.set(x, y, '.'); // snapped, flat-topped
    dots(p, [[3, 15], [12, 15], [13, 16]], 'D'); p.set(12, 16, 'E');
    p.rect(4, 12, 3, 1, 'v').set(5, 12, 'w');
  } else {
    const set = v === 0 ? [[6, 13, 11, 0], [3, 14, 7, -1], [10, 14, 8, 1], [12, 15, 4, 1]] : [[4, 14, 9, -1], [7, 13, 12, 0], [10, 14, 7, 1], [1, 15, 4, -1]];
    set.sort((a, b) => a[2] - b[2]).reverse().forEach(([x, yb, h, l]) => crystal(p, x, yb, h, l));
    p.speckle('D', 'E', 0.12, 41 + (v || 0));
  }
  p.ellipse(4, 12.8, 2.2, 0.8, 'v'); p.set(3, 12, 'w');
  p.rect(9, 16, 3, 1, 'v');
  p.set(5, 16, 's').set(13, 15, 's');
  return p.outline();
}
// Coal: a heap of faceted black coal lumps on a ring of pale ash, red-hot where lumps touch, sparks rising.
// Silhouette is a bumpy mound of small chunks (v1 ore is one big grey boulder with gold veins). Spent: grey and cold.
function coal(v) {
  const p = new Px(18, 16);
  p.ellipse(9, 12.6, 7.6, 2.2, 't'); p.speckle('t', 'u', 0.2, 51).speckle('t', 's', 0.12, 52);
  const lumps = v === 'spent' ? [[6, 11.5, 2.4, 1.8], [10.5, 11.8, 2.8, 1.9], [8.5, 9.8, 2.2, 1.7]]
    : v === 0 ? [[4.5, 10.6, 2.6, 2], [13.4, 11, 2.4, 1.9], [9, 11.4, 3, 2.1], [6.6, 7.8, 2.6, 2.2], [11.4, 8, 2.6, 2.2], [9, 4.8, 2.4, 2.1]]
    : [[5, 10.4, 2.8, 2.2], [9.6, 11.2, 2.6, 2], [13.6, 10.2, 2.2, 1.9], [7.6, 7, 2.6, 2.2], [11.8, 6.8, 2.2, 2], [3.2, 7.6, 1.6, 1.5]];
  const owner = Array.from({ length: 16 }, () => Array(18).fill(-1));
  lumps.forEach(([x, y, rx, ry], i) => {
    for (let j = 0; j < 16; j++) for (let k = 0; k < 18; k++) {
      // faceted: a diamond-ish superellipse instead of a smooth disc
      if (Math.abs((k + 0.5 - x) / rx) ** 1.3 + Math.abs((j + 0.5 - y) / ry) ** 1.3 > 1) continue;
      owner[j][k] = i; const t = ((k + 0.5 - x) / rx) * 0.6 + ((j + 0.5 - y) / ry) * 0.8;
      p.set(k, j, t < -0.55 ? 't' : t < -0.1 ? 's' : 'n');
    }
  });
  const src = p.clone();
  for (let j = 1; j < 15; j++) for (let k = 1; k < 17; k++) { // a crisp glint on each lump's lit facet
    if (src.d[j][k] === 't' && owner[j][k] >= 0 && src.d[j - 1][k] !== 't' && src.d[j][k - 1] !== 't' && hash(k, j, 3) < 0.5) p.set(k, j, 'u');
  }
  if (v !== 'spent') {
    for (let j = 1; j < 15; j++) for (let k = 1; k < 17; k++) {
      const o = owner[j][k]; if (o < 0) continue;
      const seam = [[1, 0], [0, 1]].some(([a, b]) => owner[j + b][k + a] >= 0 && owner[j + b][k + a] !== o);
      if (seam) p.set(k, j, hash(k, j, 6 + v) < 0.3 ? 'x' : 'r');
    }
    const hot = v === 0 ? [[8, 9], [10, 10], [9, 7]] : [[7, 9], [9, 9], [10, 8]];
    hot.forEach(([x, y], i) => { if (owner[y][x] >= 0) p.set(x, y, i ? 'y' : 'z'); });
    dots(p, v === 0 ? [[3, 12], [15, 12]] : [[2, 11], [16, 11]], 'x'); // embers fallen into the ash
  } else {
    remap(p, { n: 's', s: 't', t: 'u', u: 'v' }); p.speckle('s', 'n', 0.15, 55);
    dots(p, [[4, 13], [13, 13]], 'n');
  }
  p.outline();
  if (v !== 'spent') for (const [x, y] of v === 0 ? [[6, 1], [13, 3]] : [[8, 2], [14, 3]]) p.set(x, y, 'y'); // sparks
  return p;
}
// Ancient ruin (POI "Phế tích cổ"): a dolmen gate of weathered blocks over a lectern. Unlooted: gold runes lit on the
// lintel, an open tome glowing on the lectern, a page drifting. Looted: runes dead, lectern bare, a torn page.
function ruinOld(looted) {
  const p = new Px(32, 30);
  // plinth (top face + front face)
  p.rect(2, 23, 28, 2, 'u').rect(1, 25, 30, 3, 't').rect(1, 27, 30, 1, 's').rect(30, 25, 1, 3, 's');
  for (const x of [8, 15, 23]) p.rect(x, 25, 1, 2, 's');
  // pillars of stacked blocks
  for (const x0 of [3, 23]) {
    p.rect(x0, 9, 6, 14, 't').rect(x0, 9, 1, 14, 'u').rect(x0 + 5, 9, 1, 14, 's');
    for (const y of [13, 18]) { p.rect(x0, y, 6, 1, 's'); p.set(x0, y + 1, 'u'); }
    p.rect(x0 + 2, 10, 1, 3, 's'); p.rect(x0 + 3, 14, 1, 4, 's'); p.rect(x0 + 1, 19, 1, 4, 's');
  }
  // lintel: top face + front face, chipped right end, slightly offset (settled)
  p.rect(1, 3, 29, 3, 'u').rect(1, 6, 30, 3, 't').rect(1, 8, 30, 1, 's').rect(30, 6, 1, 3, 's');
  p.rect(1, 3, 29, 1, 'v'); p.set(29, 3, '.').set(28, 3, '.').set(30, 6, '.').set(29, 4, 'u');
  p.rect(25, 3, 2, 1, '.').set(26, 4, 's'); // chip
  // runes on the lintel front
  const runes = [[5, 6], [6, 7], [8, 6], [8, 7], [11, 7], [12, 6], [13, 7], [16, 6], [17, 6], [17, 7], [20, 7], [21, 6], [24, 7], [25, 6]];
  runes.forEach(([x, y], i) => p.set(x, y, looted ? 's' : i % 3 === 0 ? 'z' : 'y'));
  // lectern
  p.rect(13, 16, 6, 7, 't').rect(13, 16, 1, 7, 'u').rect(18, 16, 1, 7, 's').rect(12, 22, 8, 1, 's').rect(12, 21, 8, 1, 't');
  p.rect(11, 14, 10, 2, 'u').rect(11, 15, 10, 1, 't').set(20, 15, 's');
  if (!looted) {
    p.rect(11, 12, 4, 2, 'w').rect(17, 12, 4, 2, 'w').rect(15, 13, 2, 1, 'r'); // open tome
    p.rect(12, 12, 2, 1, 'i').rect(18, 12, 2, 1, 'i').set(11, 13, 'i').set(20, 13, 'i');
    p.set(13, 11, 'w').set(18, 11, 'w').set(12, 11, 'i').set(19, 11, 'i');
  } else {
    dots(p, [[13, 14], [16, 14], [17, 14]], 's'); // dust where the tome lay
    p.rect(22, 24, 2, 1, 'i').set(23, 23, 'w'); // torn page on the plinth
  }
  // moss & vines
  dots(p, [[4, 12], [4, 16], [5, 17], [27, 10], [27, 11], [28, 15], [2, 22], [29, 22], [9, 24], [10, 24]], 'c');
  dots(p, [[4, 17], [28, 16], [3, 22]], 'b');
  p.speckle('t', 's', 0.04, 61 + (looted ? 1 : 0)).speckle('u', 'v', 0.08, 62);
  p.outline();
  if (!looted) { dots(p, [[16, 9], [10, 10], [22, 11]], 'z'); p.set(15, 10, 'y'); } // lore motes rising from the tome
  return p;
}
// Boat at the dock: a clinker-built sloop seen ¾ from above — open hull with thwarts, furled sail on the boom,
// pennant, a lantern at the bow; a ring of foam where it sits in the water.
function boat() {
  const p = new Px(34, 28);
  // hull side (front face) — a crescent tapering to bow (right) and stern (left)
  for (let y = 17; y < 25; y++) {
    const k = (y - 17) / 7, l = Math.round(3 + k * k * 6 + k * 2), r = Math.round(31 - k * k * 7 - k * 3);
    for (let x = l; x <= r; x++) p.set(x, y, 'g');
  }
  for (const y of [19, 21, 23]) for (let x = 0; x < 34; x++) if (p.get(x, y) === 'g') p.set(x, y, 'f'); // plank seams
  for (let y = 17; y < 25; y++) for (let x = 0; x < 34; x++) if (p.get(x, y) === 'g' && p.get(x + 1, y) === '.') p.set(x, y, 'f');
  // deck opening (top), gunwale
  p.ellipse(16.5, 15.5, 14, 3.4, 'h'); p.rect(30, 14, 2, 3, 'h').set(32, 15, 'h'); // bow point
  p.ellipse(16.5, 15.6, 12, 2.1, 'f');
  for (let x = 0; x < 34; x++) for (let y = 12; y < 18; y++) if (p.get(x, y) === 'h' && (p.get(x, y - 1) === '.' || p.get(x - 1, y) === '.')) p.set(x, y, 'i');
  for (const x of [9, 22]) p.rect(x, 14, 2, 4, 'g').rect(x, 14, 2, 1, 'h'); // thwarts
  p.rect(13, 16, 3, 1, 'u').set(14, 15, 't'); // a coil of rope / anchor
  // mast, boom, furled sail
  p.rect(16, 1, 2, 15, 'g').rect(16, 1, 1, 15, 'h');
  thick(p, 6, 11, 17, 9, 'f'); // boom
  for (let x = 7; x < 17; x++) { const y = 9 + Math.round((17 - x) * 0.18); p.set(x, y - 1, 'v').set(x, y - 2, x % 3 ? 'w' : 'u'); }
  p.set(7, 8, 'u').set(8, 7, 'w');
  for (const x of [9, 12, 15]) p.set(x, 7 + Math.round((17 - x) * 0.18), 'g'); // sail ties
  p.rect(18, 1, 4, 1, 'R').rect(18, 2, 3, 1, 'r').set(22, 1, 'r'); // pennant
  p.set(16, 0, 'y');
  // lantern on the bow post
  p.rect(30, 10, 1, 4, 'f'); p.rect(29, 8, 3, 2, 'y').set(30, 8, 'z').set(31, 9, 'x').set(30, 7, 'k');
  p.outline();
  for (const [x, y] of [[4, 25], [5, 25], [26, 25], [27, 25], [33, 18]]) if (p.get(x, y) === '.') p.set(x, y, 'E'); // foam where hull meets water
  return p;
}
// Expedition chest: sea chest in dyed blue wood, iron bands and rivets, a gold compass rose on the front.
// Open: lid back, loot glinting inside (gold, a gem, a blade hilt, a map roll).
function expChest(open) {
  const p = new Px(18, 16), by = 7;
  p.rect(1, by, 16, 7, 'C').rect(1, by, 16, 1, 'D').rect(1, by + 6, 16, 1, 'B').rect(16, by, 1, 7, 'B').rect(1, by + 1, 1, 5, 'D');
  for (const x of [3, 14]) { p.rect(x, by, 1, 7, 'u'); p.set(x, by + 6, 't'); p.set(x + 1, by + 1, 't'); }
  p.rect(1, by + 3, 16, 1, 'B');
  for (const [x, y] of [[2, by + 1], [15, by + 1], [2, by + 5], [15, by + 5]]) p.set(x, y, 'v');
  p.rect(0, by + 2, 1, 2, 'h'); p.rect(17, by + 2, 1, 2, 'g'); // rope handles
  if (!open) {
    p.rect(1, 3, 16, 4, 'C').rect(2, 2, 14, 1, 'C').rect(1, 6, 16, 1, 'B'); // domed lid
    p.rect(2, 2, 14, 1, 'D').rect(1, 3, 1, 3, 'D').set(2, 3, 'E').set(3, 2, 'E');
    for (const x of [3, 14]) { p.rect(x, 2, 1, 5, 'u'); p.set(x, 2, 'v'); }
    p.rect(16, 3, 1, 4, 'B');
    // compass rose lock plate
    p.rect(8, 5, 2, 5, 'y').rect(7, 7, 4, 1, 'y').set(8, 5, 'z').set(7, 7, 'z').set(9, 9, 'x').set(10, 7, 'x').set(8, 7, 'k').set(9, 7, 'R');
  } else {
    p.rect(1, 0, 16, 3, 'B').rect(2, 1, 14, 1, 'f'); // lid tipped back, inner lining
    for (const x of [3, 14]) p.rect(x, 0, 1, 3, 't');
    p.rect(1, 3, 16, 4, 'n'); // interior shadow
    p.rect(2, 5, 14, 2, 'y'); dots(p, [[3, 4], [4, 4], [12, 4], [13, 5], [6, 5], [10, 5]], 'z'); dots(p, [[5, 6], [11, 6], [14, 6]], 'x');
    p.set(8, 4, 'L').set(9, 4, 'M').set(8, 5, 'M').set(8, 3, 'w'); // gem
    p.rect(11, 2, 1, 3, 'v').rect(10, 4, 3, 1, 'g').set(11, 2, 'w'); // blade hilt
    p.rect(4, 3, 3, 2, 'i').set(4, 3, 'w').set(6, 4, 'h'); // map roll
    p.rect(8, by + 2, 2, 3, 'y').set(8, by + 2, 'z').set(9, by + 3, 'k');
  }
  chamfer(p, 1, open ? 0 : 2, 16, 13, 2); p.rect(5, 13, 8, 1, '.');
  if (open) { p.set(1, 3, '.'); p.set(16, 3, '.'); }
  return new Px(18, 16).stamp(p, 0, open ? 1 : 1).crop(0, 0, 18, 16).outline();
}
// Rubble: what a broken building leaves. A stone block (lit top 'u', face 't', dark right/bottom 's'), plank
// (light top edge, dark underside) and dust helpers; heaps are composed back-to-front.
function block3(p, x, y, w, h, top = 1) { p.rect(x, y, w, h, 't').rect(x, y, w, top, 'u').rect(x + w - 1, y + top, 1, h - top, 's').rect(x, y + h - 1, w, 1, 's'); p.set(x, y, 'v'); return p; }
function plank(p, x0, y0, x1, y1, w = 2) { thick(p, x0, y0, x1, y1, 'g', w); p.line(x0, y0, x1, y1, 'h'); p.line(x0, y0 + w - 1, x1, y1 + w - 1, 'f'); return p; }
function rubble(kind) {
  if (kind === 1) {
    const p = new Px(18, 14);
    p.ellipse(9, 10.4, 7.4, 2.2, 'h'); p.speckle('h', 'g', 0.25, 71);
    block3(p, 2, 6, 4, 4); block3(p, 10, 7, 5, 4); block3(p, 7, 4, 3, 3);
    plank(p, 3, 4, 9, 8); plank(p, 11, 3, 15, 6, 1);
    block3(p, 6, 9, 3, 3); p.set(14, 11, 'u').set(15, 11, 's');
    p.set(5, 5, 't').set(12, 4, 'k');
    return p.outline();
  }
  const p = new Px(34, 24);
  p.ellipse(17, 19, 15.5, 3.6, 'h'); p.speckle('h', 'g', 0.25, 72).speckle('h', 'i', 0.08, 73);
  if (kind === 'wood') {
    // standing stub of the log wall at the back-left
    for (let i = 0; i < 4; i++) { const x = 3 + i * 3, h = [9, 12, 7, 5][i]; p.rect(x, 17 - h, 3, h, 'g').rect(x, 17 - h, 1, h, 'h').rect(x + 2, 17 - h, 1, h, 'f'); p.set(x + 1, 17 - h, 'i').set(x + 2, 17 - h, 'h'); }
    plank(p, 4, 15, 26, 7, 2); // the fallen roof beam
    plank(p, 12, 18, 30, 13, 2); plank(p, 18, 10, 24, 18, 1); plank(p, 25, 16, 32, 18, 1);
    plank(p, 8, 18, 15, 21, 1); plank(p, 20, 20, 27, 21, 1);
    // splinters, nails, soot
    dots(p, [[27, 6], [28, 6], [6, 3], [15, 4]], 'h'); dots(p, [[14, 11], [22, 15], [10, 19]], 'u');
    dots(p, [[17, 16], [18, 17], [13, 20]], 'n');
    block3(p, 28, 17, 3, 3);
  } else {
    // broken wall stub: brick courses, jagged top
    const top = [7, 6, 6, 8, 9, 11, 10, 12, 13, 14, 14, 15];
    for (let i = 0; i < 12; i++) { const x = 2 + i; p.rect(x, top[i], 1, 2, 'u'); p.rect(x, top[i] + 2, 1, 18 - top[i], 't'); }
    for (let y = 11; y < 20; y += 3) for (let x = 2; x < 14; x++) if (p.get(x, y) === 't') p.set(x, y, 's');
    for (let y = 8, k = 0; y < 20; y += 3, k++) for (let x = 3 + (k % 2) * 2; x < 14; x += 4) for (let j = 1; j < 3; j++) if (p.get(x, y + j) === 't') p.set(x, y + j, 's');
    // the fallen blocks, back to front
    block3(p, 15, 11, 5, 4); block3(p, 22, 12, 4, 4); block3(p, 19, 14, 6, 4); block3(p, 27, 15, 4, 3);
    block3(p, 12, 16, 5, 4); block3(p, 24, 17, 5, 4); block3(p, 17, 18, 6, 4); block3(p, 7, 18, 4, 3);
    plank(p, 20, 9, 28, 13, 1); // a charred beam
    dots(p, [[14, 21], [30, 20], [5, 21], [29, 14]], 'u');
    dots(p, [[4, 9], [5, 9], [9, 12]], 'c');
  }
  return p.outline();
}

// ── Rift heart (48×48) — the hero object of each region ─────────────────────────
// A gloom heart sunk in a torn crater: two lobes over a heavy body, a crown of black crystal shards behind it, a thorny
// root wrapped around it, veins across its skin and a slit eye at its core; the crater's front lip hides its base.
//   sleep  (2 f): dark, eye shut with a sliver of light under the lid, slow breath (1 px swell), two drifting motes.
//   awake  (4 f): heartbeat rest → swell → peak → recoil; veins and eye blaze, the pit glows, motes and ground sparks.
//   sealed (1 f): petrified to stone; old veins and a sun-seal ring filled with dawn gold; crown tips broken off.
const HEART_PARTS = (s) => [[24, 28.5, 11 + s, 10.5 + s], [18, 19.5 - s * 0.5, 7.6 + s, 7.4 + s], [30.2, 20 - s * 0.5, 7 + s, 6.9 + s], [24, 35.5, 5.6 + s * 0.5, 5.4]];
function heart(state, frame = 0) {
  const awake = state === 'awake', sleep = state === 'sleep', sealed = state === 'sealed';
  const p = new Px(48, 48);
  const beat = awake ? [0, 1, 2, 0.6][frame] : sleep ? frame : 0, s = beat * 0.5;
  const CX = 24, CY = 39.5;
  const inEll = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  // 1. crater: earth rim, pit, deep pit; the back wall of the pit catches the heart's glow
  p.ellipse(CX, CY, 21.5, 6.6, 'g');
  for (let y = 30; y < 48; y++) for (let x = 0; x < 48; x++) if (p.get(x, y) === 'g' && (p.get(x, y - 1) === '.' || p.get(x - 1, y) === '.')) p.set(x, y, 'h');
  p.speckle('g', 'f', 0.22, 111).speckle('g', 'h', 0.06, 112);
  p.ellipse(CX, CY + 0.3, 16.5, 3.9, 'n'); p.ellipse(CX, CY + 0.9, 11.5, 2.4, 'k');
  for (let y = 30; y < 48; y++) for (let x = 0; x < 48; x++) {
    if (p.get(x, y) !== 'n' || y > CY) continue;
    if (p.get(x, y - 1) === 'g' || p.get(x, y - 1) === 'h' || p.get(x, y - 1) === 'f') p.set(x, y, awake ? (frame === 2 ? 'L' : 'M') : sleep ? 'm' : 's');
  }
  // 2. crown of crystal shards behind the lobes: lit left face 'M', 'm' middle, 'n' right face, glowing tip
  const shards = [[12, 16, 6, -1.2], [17, 13, 8, -0.5], [21, 14, 5, -0.2], [29, 13, 10, 0.4], [34, 15, 6, 1.1], [8, 23, 4, -1.6], [40, 23, 4, 1.6]];
  shards.forEach(([x, y, h, l]) => {
    for (let k = 0; k < h; k++) {
      const xx = Math.round(x + l * k * 0.5), w = k < h * 0.45 ? 3 : k < h - 1 ? 2 : 1;
      for (let i = 0; i < w; i++) p.set(xx + i - (w >> 1), Math.round(y - k), w === 1 ? 'L' : i === 0 ? 'M' : i === w - 1 ? 'n' : 'm');
    }
  });
  // 3. body: 4-tone light from the top-left, a specular cap on each lobe, deep cleft between the lobes
  const parts = HEART_PARTS(s);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    if (!parts.some(([cx, cy, rx, ry]) => inEll(x, y, cx, cy, rx, ry))) continue;
    const t = ((x + 0.5 - 22) / 14) * 0.6 + ((y + 0.5 - 24) / 15) * 0.8;
    let c = t < -0.62 ? 'L' : t < -0.1 ? 'M' : t < 0.6 ? 'm' : 'n';
    for (const [cx, cy, rx, ry] of parts.slice(1, 3)) {
      const lx = (x + 0.5 - (cx - rx * 0.38)) / (rx * 0.42), ly = (y + 0.5 - (cy - ry * 0.42)) / (ry * 0.36);
      if (lx * lx + ly * ly < 1) c = 'L';
    }
    p.set(x, y, c);
  }
  for (const [x, y, c] of [[24, 15, 'n'], [24, 16, 'n'], [23, 16, 'm'], [24, 17, 'n'], [25, 17, 'm'], [24, 18, 'm']]) if (p.get(x, y) !== '.') p.set(x, y, c);
  // rim light on the lower silhouette: the pit's glow reflected on the heart's underside (separates it from the pit)
  { const src = p.clone(), inB = (x, y) => parts.some(([cx, cy, rx, ry]) => inEll(x, y, cx, cy, rx, ry));
    for (let y = 26; y < 48; y++) for (let x = 0; x < 48; x++) if (inB(x, y) && (!inB(x, y + 1) || !inB(x + 1, y + 1) && !inB(x + 1, y))) p.set(x, y, src.get(x, y) === 'n' ? 'm' : 'M'); }
  // muscle bands: two arcs that darken the skin one step (keeps the shading, adds form)
  const darker = { L: 'M', M: 'm', m: 'n', n: 'n' };
  for (const [rr, a0, a1] of [[9, 3.9, 5.5]]) for (let k = 0; k <= 60; k++) {
    const a = a0 + ((a1 - a0) * k) / 60, x = Math.round(24 + Math.cos(a) * rr * 1.05), y = Math.round(36 + Math.sin(a) * rr);
    const c = p.get(x, y); if (darker[c] && parts.some(([cx, cy, rx, ry]) => inEll(x, y, cx, cy, rx, ry))) p.set(x, y, darker[c]);
  }
  p.speckle('m', 'M', 0.03, 113).speckle('M', 'm', 0.03, 114);
  // 4. veins from the core
  const veins = [[[24, 25], [20, 21], [17, 17], [15, 15]], [[24, 25], [28, 20], [31, 17]], [[24, 25], [18, 28], [15, 31]], [[24, 25], [30, 29], [33, 27]], [[20, 21], [15, 22]], [[28, 20], [33, 22]], [[18, 28], [19, 33]]];
  const veinC = awake ? (frame === 2 ? 'H' : 'L') : sleep ? 'n' : 'y';
  if (sleep) { // dormant veins: just a one-step-darker groove in the skin
    const V = new Px(48, 48); veins.forEach((pts) => { for (let k = 0; k < pts.length - 1; k++) V.line(...pts[k], ...pts[k + 1], 'k'); });
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (V.d[y][x] === 'k' && darker[p.get(x, y)] && hash(x, y, 5) < 0.7) p.set(x, y, darker[p.get(x, y)]);
  } else veins.forEach((pts) => { for (let k = 0; k < pts.length - 1; k++) p.line(...pts[k], ...pts[k + 1], veinC); });
  if (awake) veins.forEach((pts) => { const [x, y] = pts[pts.length - 1]; p.set(x, y, frame === 2 ? 'w' : 'H'); });
  // 5. thorny root wrapped around the body (cast shadow under it, lit top edge, thorns)
  const T = new Px(48, 48);
  const roots = [[[3, 41], [9, 36], [14, 33], [20, 33], [26, 31.5], [31, 28], [35, 23], [36.5, 18], [35, 15]], [[13, 30], [12, 25], [14, 20], [17, 16]]];
  roots.forEach((pts, i) => { for (let k = 0; k < pts.length - 1; k++) thick(T, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], 'm', i === 0 && k < 6 ? 2 : 1); });
  for (let y = 1; y < 47; y++) for (let x = 1; x < 47; x++) if (T.get(x, y) === '.' && T.get(x, y - 1) === 'm' && p.get(x, y) !== '.') p.set(x, y, 'n'); // shadow
  T.shade(['n', 'm', 'M']);
  for (const [x, y, dx, dy] of [[10, 35, -1, -1], [18, 32, 0, -1], [27, 30, 1, 1], [33, 25, 1, 0], [36, 20, 1, -1], [12, 26, -1, 0], [15, 19, -1, -1]]) { T.set(x + dx, y + dy, 'n'); T.set(x + dx * 2, y + dy * 2, 'M'); }
  p.stamp(T);
  if (sleep) remap(p, { L: 'M', H: 'M' });
  // 6. the eye
  if (awake) {
    const r = [3.8, 4.3, 4.8, 4][frame];
    if (frame === 2) for (let y = 18; y < 32; y++) for (let x = 17; x < 32; x++) if (inEll(x, y, 24, 24.5, r * 0.75 + 1.6, r + 1.6) && p.get(x, y) !== '.') p.set(x, y, 'H'); // flare
    p.ellipse(24, 24.5, r * 0.75, r, 'x'); p.ellipse(24, 24.5, r * 0.75 - 0.8, r - 0.8, 'y'); p.ellipse(23.6, 24, r * 0.4, r * 0.55, 'z');
    p.rect(24, Math.round(24.5 - r + 1.5), 1, Math.round(r * 2 - 3), 'k'); p.set(23, 22, 'w');
  } else if (sleep) { // heavy closed lids over the slit: an almond of lid with a dark seam, light leaking through it
    p.ellipse(24, 24.5, 3.8, 5, 'n'); p.ellipse(24, 24.5, 2.9, 4.1, 'm'); p.ellipse(23.4, 23.8, 1.6, 2.6, 'M'); p.set(22, 22, 'L');
    for (let y = 21; y <= 28; y++) p.set(24, y, 'k');
    p.set(25, 22, 'n').set(25, 27, 'n').set(23, 21, 'n').set(23, 28, 'n');
    for (let y = 23; y <= 26; y++) if (frame || (y > 23 && y < 26)) p.set(24, y, 'L'); // light leaking through the seam (brighter on the in-breath)
  } else {
    for (let a = 0; a < 32; a++) { const t = (a / 32) * Math.PI * 2; p.set(Math.round(24 + Math.cos(t) * 5.5), Math.round(24.5 + Math.sin(t) * 5.5), 'y'); }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [-0.7, -0.7]]) {
      const n = Math.abs(dx) === 1 || Math.abs(dy) === 1 ? 3 : 2; for (let k = 0; k < n; k++) p.set(Math.round(24 + dx * (7 + k)), Math.round(24.5 + dy * (7 + k)), k ? 'y' : 'z');
    }
    p.ellipse(24, 24.5, 2.6, 2.6, 'y'); p.ellipse(23.6, 24, 1.4, 1.4, 'z'); p.set(23, 23, 'w');
  }
  // 7. front lip of the crater over the heart's base, with a few broken clods
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    if (y < CY + 1 || !inEll(x, y, CX, CY, 21.5, 6.6) || inEll(x, y, CX, CY - 0.4, 16.5, 3.9)) continue;
    p.set(x, y, inEll(x, y - 1, CX, CY - 0.4, 16.5, 3.9) ? 'h' : hash(x, y, 115) < 0.25 ? 'f' : 'g');
  }
  for (const [x, y, w] of [[15, 42, 3], [29, 43, 4], [21, 44, 2]]) { p.rect(x, y, w, 2, 'g').rect(x, y, w, 1, 'h').set(x + w - 1, y + 1, 'f'); }
  if (awake) for (const [x, y] of [[12, 41], [36, 41], [24, 45]]) p.set(x, y, frame === 2 ? 'L' : 'M'); // root glow through the earth
  // 8. state recolours
  if (sleep) p.set(16, 15, 'L').set(17, 15, 'L').set(28, 16, 'L');
  if (sealed) {
    remap(p, { M: 't', L: 'u', m: 's', H: 'y' });
    p.speckle('t', 'u', 0.06, 117).speckle('s', 't', 0.05, 118).speckle('u', 'v', 0.1, 119);
    for (const [x, y] of [[17, 7], [26, 2], [27, 3], [31, 7], [12, 10]]) p.set(x, y, '.'); // broken crown tips
  }
  p.outline();
  // 9. motes
  if (awake) {
    const m = [[[9, 12], [39, 9], [14, 4], [36, 15]], [[9, 10], [39, 7], [13, 2], [37, 13]], [[8, 8], [40, 5], [7, 15], [42, 11]], [[10, 6], [39, 3], [8, 13], [41, 14]]][frame];
    m.forEach(([x, y], i) => { if (p.get(x, y) === '.') p.set(x, y, i % 2 ? 'H' : 'L'); });
    if (frame === 2) for (const [x, y] of [[1, 37], [46, 37], [4, 46], [44, 46]]) if (p.get(x, y) === '.') p.set(x, y, 'L');
  } else if (sleep) {
    for (const [x, y] of [[[10, 11], [38, 8]], [[10, 9], [38, 6]]][frame]) if (p.get(x, y) === '.') p.set(x, y, 'M');
  } else for (const [x, y] of [[11, 7], [37, 10], [24, 2]]) if (p.get(x, y) === '.') p.set(x, y, 'z');
  return p;
}

export default function build() {
  const out = [];
  const tile = (name, px) => out.push({ name, px, kind: 'tile', ax: 0, ay: 0 });
  const prop = (name, px, extra = {}) => out.push({ name, px, kind: 'prop', ...extra });
  for (let i = 0; i < 3; i++) tile(`tile_snow_${i}`, snow(i));
  for (let i = 0; i < 2; i++) tile(`tile_ice_${i}`, ice(i));
  for (let i = 0; i < 3; i++) tile(`tile_ash_${i}`, ash(i));
  for (let f = 0; f < 2; f++) tile(`tile_lava_${f}`, lava(f));
  for (const pair of EDGE_PAIRS_V2) out.push(...edges(pair));
  for (let f = 0; f < 4; f++) out.push({ name: `veil_${f}`, px: veil(f), kind: 'fx' });
  tile('veil_fill', veilFill());
  prop('prop_snowpine_0', snowPine(0)); prop('prop_snowpine_1', snowPine(1));
  prop('prop_deadtree_0', deadTree(0)); prop('prop_deadtree_1', deadTree(1));
  prop('prop_resin_0', resin(0)); prop('prop_resin_1', resin(1)); prop('prop_resin_spent', resin('spent'));
  prop('prop_frost_0', frost(0)); prop('prop_frost_1', frost(1)); prop('prop_frost_spent', frost('spent'));
  prop('prop_coal_0', coal(0)); prop('prop_coal_1', coal(1)); prop('prop_coal_spent', coal('spent'));
  prop('prop_ruin_old', ruinOld(false)); prop('prop_ruin_old_looted', ruinOld(true));
  prop('prop_boat', boat());
  prop('prop_exp_chest_closed', expChest(false)); prop('prop_exp_chest_open', expChest(true));
  prop('prop_rubble_1', rubble(1)); prop('prop_rubble_2_wood', rubble('wood')); prop('prop_rubble_2_stone', rubble('stone'));
  prop('prop_heart_sealed', heart('sealed'));
  for (let f = 0; f < 2; f++) prop(`prop_heart_sleep_${f}`, heart('sleep', f));
  for (let f = 0; f < 4; f++) prop(`prop_heart_awake_${f}`, heart('awake', f));
  return out;
}

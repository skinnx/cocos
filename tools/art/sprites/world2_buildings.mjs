// SPEC v2 buildings (owner: art-buildings). SPEC §6.5, §9.9, §11.1, §11.3, §11.9, §11.11.
// Technique (B): procedural ¾ shapes + hand-placed detail + outline, same shape language as buildings.mjs.
// Animated sprites clone ONE base frame and only redraw the animated part per frame.
//
// Anchors (art px, origin = sprite top-left; "bottom edge" = y equal to the sprite height):
//  - every bld_* building / wall / decor: default bottom-centre (w/2, h), footprint at the bottom.
//    Hearth tiers grow up to 48×64 and stay bottom-centred on the 2×2 footprint (they overhang it sideways).
//  - bld_beacon_<lvl>_<f>: anchor = flame base (7, 21) on a 14×22 canvas. Place it at the hearth's beacon socket,
//    given as an offset from the hearth's own anchor: HEARTH_SOCKETS[tier].beacon (exported below).
//  - hearth_flame_<id>_<f>: anchor = flame base (12, 37) on a 24×38 canvas. Draw it OVER the hearth at
//    HEARTH_SOCKETS[tier].fire; it fully covers the baked fire of tiers 3–10 (asserted by the review script).
//  - banner_<i>_<f>: anchor = pole foot (1, 15) on 12×16, like bld_rally_flag.
//  - bld_module_<id>: anchor = peg foot (5, 11) on 11×11: stand it on a tower's top deck.
//  - bld_frozen_1/2: anchor bottom-centre (w/2, h) — draw at the building's anchor (1×1 towers; ×2 side by side on 2×2).
//  - bld_burning_<f>: centre anchor (fx default), draw at the building's visual centre.
// Walls (bld_wall_ember_*, skin_*): 16×27, same N=1 E=2 S=4 W=8 auto-tile masks and seams as v1 bld_wall_*.
import { Px, hash, dots, flame } from './_bld2_helpers.mjs';
import {
  cyl, roof, thatch, box, bricks, banner, windowLit, flagPole, frames, logWall, plankWall, stoneWall, plaster, door, archDoor,
  chimney, gear, cone, crenels, stoneShaft, woodLegs, crystal, crate, barrel, sack, lantern,
  wallTile, STONE, WOOD, decorateV1, th,
} from './_bld2_helpers.mjs';

// ════ colour-swapped flame (beacons, cosmetics, braziers) ════
function tintFlame(p, cx, by, hw, h, phase, ramp, opts = {}) {
  const t = new Px(p.w, p.h);
  flame(t, cx, by, hw, h, phase, opts);
  const map = { x: ramp[0], y: ramp[1], z: ramp[2], w: ramp[3] ?? 'w' };
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) { const c = t.d[y][x]; if (c !== '.') p.set(x, y, map[c]); }
  return p;
}
function glowFront(p, fire, reach = 5) {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (y >= fire.by - 2 && Math.hypot(x - fire.cx, (y - fire.by) * 1.8) < fire.hw + reach) {
    const c = p.get(x, y); if (c === 'u') p.set(x, y, 'i'); else if (c === 'v') p.set(x, y, 'w');
  }
}

// ════ Hearth tiers 4–10 ════
// Each tier keeps everything from the tier below and adds one big readable element:
//  4 three-ring dais + gold capitals + lantern posts · 5 front pillars carrying braziers + rune ring · 6 arch with the
//  beacon cresset · 7 plaza, carpet, standing braziers (6 fires) · 8 fire raised on a pedestal, back braziers, pennants ·
//  9 gilded rims, blue banners, sun crest · 10 crystal crown around the bowl, crystal spires, white-hot heart.
// fire of each tier: [hw, h]; 'l3' = v1 bld_hearth_l3 (tongues 5). Cosmetic flames are the union of all of these.
const TIER_FIRE = { l3: [7.5, 25], 4: [7.5, 26], 5: [8, 27], 6: [8, 27], 7: [8, 28], 8: [8.5, 28], 9: [8.5, 29], 10: [8.5, 30] };
const HEARTH_DIM = { 4: [36, 48], 5: [40, 50], 6: [40, 54], 7: [44, 56], 8: [44, 60], 9: [48, 62], 10: [48, 64] };
export const HEARTH_SOCKETS = {};

function pillar(p, x, top, bot, { gold = false, bands = [], fins = true } = {}) {
  p.rect(x, top, 5, bot - top, 't').rect(x, top, 1, bot - top, 'u').rect(x + 4, top, 1, bot - top, 's');
  for (let y = top + 2; y < bot - 1; y += 2) p.set(x + 2, y, 's');
  p.rect(x - 1, top - 2, 7, 2, gold ? 'y' : 'v').rect(x - 1, top, 7, 1, gold ? 'x' : 's');
  p.set(x + 5, top - 2, gold ? 'x' : 'u').set(x + 5, top - 1, gold ? 'x' : 'u'); if (gold) p.set(x - 1, top - 2, 'z');
  p.rect(x - 1, bot - 1, 7, 1, 'u').set(x + 5, bot - 1, 's');
  for (const y of bands) { p.rect(x, y, 5, 1, 'y'); p.set(x, y, 'z'); p.set(x + 4, y, 'x'); }
  if (fins) p.set(x + 2, top - 3, 'y').set(x + 2, top - 4, 'z');
  return p;
}
function hearthBanner(p, x, y, len, [lo, mid, hi], trim = 'y', emblem = 'flame') {
  p.rect(x, y, 5, len, mid); p.rect(x, y, 1, len, hi); p.rect(x + 4, y, 1, len, lo);
  p.rect(x, y, 5, 1, trim); p.set(x + 4, y, trim === 'y' ? 'x' : trim);
  p.set(x + 2, y + len, mid).set(x + 1, y + len, lo).set(x + 3, y + len, lo); p.set(x, y + len - 1, '.'); p.set(x + 4, y + len - 1, '.');
  const cy = y + 3 + ((len - 8) >> 1);
  if (emblem === 'flame') { dots(p, [[x + 2, cy], [x + 1, cy + 2], [x + 2, cy + 1], [x + 3, cy + 2], [x + 2, cy + 3], [x + 1, cy + 3], [x + 3, cy + 3]], 'y'); p.set(x + 2, cy + 2, 'z'); }
  else if (emblem === 'sun') { dots(p, [[x + 2, cy], [x + 1, cy + 1], [x + 3, cy + 1], [x + 2, cy + 2], [x + 2, cy + 3]], 'y'); p.set(x + 2, cy + 1, 'z'); dots(p, [[x + 1, cy + 3], [x + 3, cy + 3]], 'x'); }
  else if (emblem === 'crystal') { dots(p, [[x + 2, cy], [x + 2, cy + 1], [x + 1, cy + 2], [x + 3, cy + 2], [x + 2, cy + 3]], 'E'); p.set(x + 2, cy + 2, 'D'); p.set(x + 2, cy + 4, 'C'); }
  return p;
}
function miniBowl(p, cx, cy, gold = false) { // small iron fire bowl on a pillar or tripod
  cyl(p, cx, cy, 3.4, 1.2, 2, ['s', 't', 'u'], { top: 'n', rim: gold ? ['x', 'y'] : ['s', 'u'] });
  p.set(cx, cy, 'r');
}
function standingBrazier(p, cx, gy) { // tripod brazier on the plaza; fire drawn per frame at (cx, gy-8)
  p.line(cx - 2, gy, cx, gy - 5, 's'); p.line(cx + 2, gy, cx, gy - 5, 's'); p.rect(cx, gy - 5, 1, 5, 't');
  miniBowl(p, cx, gy - 8);
}
function hearthTier(t) {
  const [W, H] = HEARTH_DIM[t], cx = W / 2, gy = H - 2, p = new Px(W, H);
  const r1 = 15.5 + (t >= 5 ? 1 : 0) + (t >= 7 ? 1.5 : 0) + (t >= 9 ? 1.5 : 0);
  const R1 = { cy: gy - 7, rx: r1, ry: 4.5, h: 3 }, R2 = { cy: gy - 10, rx: r1 - 3, ry: 4, h: 3 }, R3 = { cy: gy - 13, rx: r1 - 5.5, ry: 3.5, h: 3 };
  const raised = t >= 8;
  const bowl = { cy: raised ? gy - 21 : gy - 17, rx: raised ? 9 : 8.5, ry: 3, h: 4 };
  const fire = { cx, by: bowl.cy, hw: TIER_FIRE[t][0], h: TIER_FIRE[t][1] };
  const pTop = gy - [41, 42, 43, 44, 46, 47, 48][t - 4];
  const bl = Math.round(cx - Math.floor(r1) + 1), br = Math.round(cx + Math.floor(r1) - 5);
  const gild = t >= 9;
  const stoneRamp = ['s', 't', 'u'];
  const fires = []; // extra small fires: [x, by, hw, h]
  const back = []; const front = []; // crystals for t10 (drawn behind / in front of the main fire)

  // ── back: pillars, banners, arch ──
  if (t >= 7) { // plaza flagstones (flat, ground level)
    p.ellipse(cx, gy - 4, r1 + 2.5, 4.5, 't');
    for (let y = gy - 9; y <= gy; y++) for (let x = 0; x < W; x++) if (p.get(x, y) === 't') {
      if ((y + (x >> 2)) % 3 === 0 || (x + (y % 2) * 2) % 6 === 0) p.set(x, y, 's'); else if (hash(x, y, 7) < 0.12) p.set(x, y, 'u');
    }
  }
  for (const x of [bl, br]) {
    const bands = t >= 7 ? [pTop + 6, gy - 14] : [];
    pillar(p, x, pTop, gy - 8, { gold: t >= 4, bands, fins: t < 6 });
    const blen = 14 + Math.min(4, t - 4);
    hearthBanner(p, x, pTop + 1, blen, ['r', 'R', 'o'], 'y', gild ? 'sun' : 'flame');
  }
  if (t >= 6) { // arch: lintel across the back pillars, cresset for the beacon at its centre
    const y0 = pTop - 5;
    p.rect(bl - 1, y0, br - bl + 7, 1, gild ? 'y' : 'v').rect(bl - 1, y0 + 1, br - bl + 7, 1, 'u').rect(bl - 1, y0 + 2, br - bl + 7, 1, 't');
    p.rect(bl - 1, y0 + 3, br - bl + 7, 1, 's');
    for (let x = bl + 1; x < br + 5; x += 4) { p.set(x, y0 + 2, 's'); p.set(x + 2, y0 + 1, 't'); }
    p.set(br + 5, y0 + 1, 's').set(br + 5, y0 + 2, 's');
    if (gild) { p.rect(bl - 1, y0 + 3, br - bl + 7, 1, 'x'); for (let x = bl + 2; x < br + 4; x += 5) p.set(x, y0 + 1, 'y'); }
    // keystone + cresset
    p.rect(cx - 2, y0 - 1, 5, 5, 'u').rect(cx - 2, y0 - 1, 5, 1, 'v').rect(cx + 2, y0, 1, 4, 's').set(cx, y0 + 1, 'y').set(cx, y0 + 2, 'x');
    p.rect(cx - 3, y0 - 3, 7, 1, 'u').rect(cx - 2, y0 - 2, 5, 1, 't').set(cx + 3, y0 - 3, 's').set(cx + 2, y0 - 2, 's').set(cx - 3, y0 - 3, 'v');
    p.rect(cx - 2, y0 - 3, 5, 1, 'n'); p.set(cx - 1, y0 - 3, 'r').set(cx + 1, y0 - 3, 'x');
    // finials on the arch ends
    for (const x of [bl + 2, br + 2]) if (t < 10) { p.set(x, y0 - 1, t >= 8 ? 'y' : 'u').set(x, y0 - 2, t >= 8 ? 'z' : 'v'); }
    HEARTH_SOCKETS[`t${t}`] = { beacon: [0, (y0 - 3) - H] };
    if (t >= 8) { // pennants above the arch ends
      for (const [x, d] of [[bl + 2, -1], [br + 2, 1]]) if (t < 10) { p.rect(x, y0 - 5, 1, 5, 'f'); p.set(x, y0 - 6, 'y'); const fx = d < 0 ? x - 3 : x + 1; p.rect(fx, y0 - 5, 3, 2, gild ? 'C' : 'R'); p.set(d < 0 ? fx : fx + 2, y0 - 4, gild ? 'B' : 'r'); p.set(d < 0 ? fx + 2 : fx, y0 - 5, gild ? 'D' : 'o'); }
    }
    if (t >= 7) { dots(p, [[cx - 6, y0 + 4], [cx + 6, y0 + 4]], 's'); lantern(p, cx - 6, y0 + 4); lantern(p, cx + 6, y0 + 4); }
  }
  if (t === 10) { // crystal spires standing on the arch above each pillar
    const y0 = pTop - 5;
    for (const x of [bl + 2, br + 2]) { crystal(p, x + 0.5, y0 - 8, 2.2, 8); crystal(p, x - 1.5, y0 - 5, 1.3, 5); crystal(p, x + 2.5, y0 - 5, 1.3, 5); }
  }

  // ── dais ──
  cyl(p, cx, R1.cy, R1.rx, R1.ry, R1.h, stoneRamp, { top: 'u', rim: gild ? ['x', 'y'] : ['t', 'v'] });
  bricks(p, 0, R1.cy, W, gy - R1.cy + 1, 't', 's', 6);
  if (t >= 5) for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + (i / 6) * 0.7), x = Math.round(cx - Math.cos(a) * (r1 - 2)), y = Math.round(R1.cy + Math.sin(a) * R1.ry + 2); if (p.get(x, y) !== '.') p.set(x, y, i % 2 ? 'x' : 'z'); }
  if (t >= 8) for (const s of [-1, 1]) { const x = Math.round(cx + s * (r1 - 6)); standingBrazier(p, x, R2.cy - 1); fires.push([x, R2.cy - 9, 2.2, 6]); }
  cyl(p, cx, R2.cy, R2.rx, R2.ry, R2.h, stoneRamp, { top: 'u', rim: gild ? ['x', 'z'] : ['t', 'v'], band: t >= 6 ? [[0, 'yx']] : null });
  bricks(p, 0, R2.cy + 1, W, R2.h + 3, 't', 's', 6, 3);
  p.speckle('u', 'v', 0.08, 5 + t);
  cyl(p, cx, R3.cy, R3.rx, R3.ry, R3.h, stoneRamp, { top: 'v', rim: ['u', 'w'], band: [[0, 'yx']] });
  // steps
  const n = t >= 7 ? 5 : 4;
  for (let i = 0; i < n; i++) {
    const y = gy - 2 * (n - i) + 1, w = 8 + 2 * i, x = cx - 4 - i;
    p.rect(x, y, w, 1, 'v'); p.rect(x, y + 1, w, 1, i === n - 1 ? 's' : 't'); p.set(x + w - 1, y + 1, 's'); p.set(x, y, 'w');
    if (t >= 7) { p.rect(cx - 2, y, 4, 1, 'R'); p.set(cx - 2, y, 'o'); p.rect(cx - 2, y + 1, 4, 1, 'r'); if (gild) { p.set(cx - 3, y, 'y'); p.set(cx + 2, y, 'y'); } }
  }
  // bowl (raised on a pedestal from tier 8)
  if (raised) {
    cyl(p, cx, gy - 17, 6, 2.2, 5, stoneRamp, { top: 'u', rim: ['t', 'v'], band: [[2, gild ? 'yx' : 'ts']] });
    for (let y = gy - 16; y < gy - 12; y++) p.set(cx - 2, y, 'u');
  }
  if (t === 10) { // back half of the crystal crown (rises behind the fire's flanks)
    for (const [dx, hgt] of [[-9.5, 10], [9.5, 10], [-7, 13], [7, 13]]) back.push([cx + dx, bowl.cy + 1 - hgt, hgt]);
    for (const [x, top, hgt] of back) crystal(p, x, top, 1.9, hgt);
  }
  cyl(p, cx, bowl.cy, bowl.rx, bowl.ry, bowl.h, ['s', 't', 'u'], { top: 'n', rim: ['y', 'z'], band: [[1, 'yx']] });
  p.ellipse(cx, bowl.cy, bowl.rx - 2.5, bowl.ry - 1.4, 'r').speckle('r', 'x', 0.3, 12);
  dots(p, [[cx - 9, gy - 4], [cx + 9, gy - 4]], 'z');
  // ── front: lantern posts (t4) / brazier pillars (t5+) / standing braziers (t7+) ──
  if (t === 4) for (const x of [cx - 15, cx + 13]) {
    p.rect(x, gy - 9, 3, 9, 't').rect(x, gy - 9, 1, 9, 'u').rect(x + 2, gy - 9, 1, 9, 's');
    p.rect(x - 1, gy - 10, 5, 1, 'u'); p.set(x + 3, gy - 10, 's'); lantern(p, x + 1, gy - 14);
  }
  if (t >= 5) {
    const fl = Math.round(cx - Math.floor(r1) - 2), fr = Math.round(cx + Math.floor(r1) - 2), ftop = gy - (t >= 8 ? 22 : 20);
    for (const x of [fl, fr]) {
      pillar(p, x, ftop, gy, { gold: t >= 6, bands: t >= 7 ? [gy - 6] : [], fins: false });
      miniBowl(p, x + 2, ftop - 4, t >= 6);
      fires.push([x + 2, ftop - 4, 2.6, 7]);
      if (gild) hearthBanner(p, x, ftop + 1, 9, ['B', 'C', 'D'], 'y', 'sun');
    }
  }
  if (t >= 7) for (const s of [-1, 1]) { const x = Math.round(cx + s * 9.5); standingBrazier(p, x, gy - 1); fires.push([x, gy - 9, 2.2, 6]); }
  if (t === 10) for (const [dx, hgt] of [[-6, 6], [6, 6], [-3, 5], [3, 5], [0, 7]]) front.push([cx + dx, bowl.cy + bowl.ry + 1 - hgt, hgt]);

  if (!HEARTH_SOCKETS[`t${t}`]) HEARTH_SOCKETS[`t${t}`] = { beacon: null };
  HEARTH_SOCKETS[`t${t}`].fire = [fire.cx - W / 2, fire.by + 1 - H];

  const out = frames(p, 4, (q, f) => {
    flame(q, fire.cx, fire.by, fire.hw, fire.h, f, { tongues: 5, heart: t >= 9 });
    if (t === 10) { q.set(cx, fire.by - 4, 'w'); q.set(cx - 1, fire.by - 5, 'w'); q.set(cx, fire.by - 6, 'w'); }
    fires.forEach(([x, by, hw, h], i) => flame(q, x, by, hw, h + ((f + i) % 2), f + i, { tongues: 1 }));
    if (t >= 6 && t < 10) for (let k = -2; k <= 2; k++) { const x = cx + k * 3, y = bowl.cy + bowl.ry - (Math.abs(k) === 2 ? 1 : 0); q.set(x, y, 'y'); q.set(x, y - 1, 'y'); q.set(x, y - 2, 'z'); q.set(x + 1, y, 'x'); }
    for (const [x, top, hgt] of front) crystal(q, x, top, 1.5, hgt);
    glowFront(q, fire, 3);
  }, (q, f) => {
    const r = rngLite(f * 13 + t);
    for (let i = 0; i < 3; i++) { const x = Math.round(fire.cx + (r() - 0.5) * fire.hw * 2.5), y = Math.round(fire.by - fire.h - 1 - r() * 3); if (q.get(x, y) === '.') q.set(x, y, i ? 'y' : 'z'); }
    if (t === 10) { // floating crystal motes orbit the crown
      for (let i = 0; i < 4; i++) { const a = (f / 4 + i / 4) * Math.PI * 2, x = Math.round(cx + Math.cos(a) * (fire.hw + 5)), y = Math.round(fire.by - 12 + Math.sin(a) * 4); if (q.get(x, y) === '.') q.set(x, y, i % 2 ? 'E' : 'D'); }
    }
  });
  if (!HEARTH_SOCKETS[`t${t}`].beacon) { // no cresset yet: the beacon floats 2 px above the highest flame tip
    let top = H; for (const q of out) for (let y = 0; y < H; y++) for (let x = cx - 3; x <= cx + 3; x++) if (q.get(x, y) !== '.' && y < top) top = y;
    HEARTH_SOCKETS[`t${t}`].beacon = [0, top - 2 - H];
  }
  return out;
}
function rngLite(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

// v1 hearth sockets (for the view): fire base and beacon float point, as offsets from the hearth anchor (bottom-centre).
HEARTH_SOCKETS.l1 = { fire: [0, -7], beacon: [0, -38] };
HEARTH_SOCKETS.l2 = { fire: [0, -12], beacon: [0, -41] };
HEARTH_SOCKETS.l3 = { fire: [0, -17], beacon: [0, -44] };

// ════ Beacon flames (4 levels × 3 frames) ════
const BEACON = {
  calm: { ramp: ['C', 'D', 'E', 'w'], hw: 3, h: 11, tongues: 1, motes: ['E', 'D'] },
  steady: { ramp: ['x', 'y', 'z', 'w'], hw: 3.6, h: 14, tongues: 3, motes: ['y', 'z'] },
  fierce: { ramp: ['r', 'R', 'o', 'z'], hw: 4.6, h: 17, tongues: 4, motes: ['R', 'y', 'o'] },
  nightmare: { ramp: ['m', 'M', 'L', 'w'], hw: 5, h: 19, tongues: 4, motes: ['L', 'M', 'L', 'M'] },
};
function beacon(id, f) {
  const B = BEACON[id], p = new Px(14, 22), cx = 7, by = 20;
  const ph = (f * 4) / 3;
  tintFlame(p, cx, by, B.hw, B.h + [0, 1, -1][f], ph, B.ramp, { tongues: B.tongues, heart: id !== 'nightmare' });
  if (id === 'nightmare') { p.set(5, by - 5, 'z'); p.set(8, by - 5, 'z'); p.set(5, by - 4, 'n'); p.set(8, by - 4, 'n'); }
  if (id === 'fierce') p.set(7, by - 3, 'z').set(6, by - 2, 'y');
  p.outline();
  B.motes.forEach((c, i) => { const a = f * 2.1 + i * 2.4, x = Math.round(cx + Math.cos(a) * (B.hw + 1.5)), y = Math.round(by - B.h * 0.6 - ((f + i) % 3) * 2 - i); if (p.get(x, y) === '.') p.set(x, y, c); });
  return p;
}

// ════ Hearth flame cosmetics (5 × 4 frames) ════
const COSMETIC = {
  ember: { ramp: ['r', 'x', 'y', 'z'], spark: ['x', 'y', 'o'] },
  azure: { ramp: ['B', 'C', 'D', 'E'], spark: ['D', 'E', 'w'] },
  verdant: { ramp: ['b', 'c', 'd', 'e'], spark: ['d', 'e', 'c'] },
  violet: { ramp: ['m', 'M', 'L', 'w'], spark: ['L', 'M', 'H'] },
  gold: { ramp: ['y', 'z', 'w', 'w'], spark: ['z', 'w', 'y'] },
};
function cosmeticFlame(id, f) {
  const C = COSMETIC[id], p = new Px(24, 38), cx = 12, by = 36;
  // union of its own big flame and every tier's baked fire for the same frame (hottest layer wins), so it always covers
  const heat = { x: 1, y: 2, z: 3, w: 4 }, acc = new Px(24, 38);
  for (const [hw, h, heart] of [[9.6, 32, true], ...Object.values(TIER_FIRE).map(([a, b]) => [a, b, false])]) {
    const t = new Px(24, 38); flame(t, cx, by, hw, h, f, { tongues: 5, heart });
    for (let y = 0; y < 38; y++) for (let x = 0; x < 24; x++) { const c = t.d[y][x]; if (c !== '.' && (acc.d[y][x] === '.' || heat[c] > heat[acc.d[y][x]])) acc.d[y][x] = c; }
  }
  const map = { x: C.ramp[0], y: C.ramp[1], z: C.ramp[2], w: C.ramp[3] };
  for (let y = 0; y < 38; y++) for (let x = 0; x < 24; x++) if (acc.d[y][x] !== '.') p.set(x, y, map[acc.d[y][x]]);
  // a fat inner body so the outer layer never thins to nothing at the base
  for (let y = by - 4; y <= by; y++) for (let x = cx - 7; x <= cx + 7; x++) if (p.get(x, y) === C.ramp[0] && Math.abs(x - cx) < 6) p.set(x, y, C.ramp[1]);
  if (id === 'ember') { const r = rngLite(f + 5); for (let i = 0; i < 6; i++) { const x = Math.round(cx + (r() - 0.5) * 12), y = Math.round(by - 4 - r() * 20); if (p.get(x, y) !== '.') p.set(x, y, 'z'); } }
  if (id === 'gold') for (const [x, y] of [[cx - 3, by - 10], [cx + 2, by - 16], [cx - 1, by - 22]]) p.set(x, y + (f % 2), 'w');
  if (id === 'verdant') for (const [x, y] of [[cx - 4, by - 6], [cx + 4, by - 9]]) { p.set(x, y, 'e'); p.set(x + 1, y - 1, 'd'); } // leaf glints
  p.outline();
  const r = rngLite(f * 7 + id.length);
  for (let i = 0; i < 4; i++) { const x = Math.round(cx + (r() - 0.5) * 20), y = Math.round(by - 20 - r() * 15); if (p.get(x, y) === '.' && y > 0) p.set(x, y, C.spark[i % 3]); }
  return p;
}

// ════ Village buildings (3 levels each, 2×2: 32 wide) ════
function house(lv) {
  const H = [36, 40, 44][lv - 1], p = new Px(32, H), gy = H - 2;
  if (lv === 1) { // log cabin under a straw thatch
    logWall(p, 5, gy - 12, 20, 12);
    door(p, 13, gy - 7, 4, 7);
    windowLit(p, 7, gy - 8, 2, 2); windowLit(p, 21, gy - 8, 2, 2);
    thatch(p, 3, gy - 22, 24, 10);
    p.rect(21, gy - 25, 2, 5, 's').rect(21, gy - 25, 1, 5, 't').set(20, gy - 26, 't').set(21, gy - 26, 'u').set(22, gy - 26, 't'); // stove pipe
    dots(p, [[22, gy - 28], [21, gy - 29], [22, gy - 31]], 'u');
    barrel(p, 26, gy - 5, 4, 5);                                                      // rain barrel
    p.rect(1, gy - 3, 4, 1, 'h').rect(1, gy - 2, 1, 2, 'g').rect(4, gy - 2, 1, 2, 'f'); // stool
    dots(p, [[2, gy - 1], [3, gy]], 'c');
  } else if (lv === 2) { // timber-framed cottage, red tiles, chimney, flower boxes
    p.rect(3, gy - 1, 26, 2, 't').rect(3, gy - 1, 26, 1, 'u').rect(28, gy - 1, 1, 2, 's'); bricks(p, 3, gy, 26, 1, 't', 's', 4);
    plaster(p, 4, gy - 13, 24, 12);
    door(p, 14, gy - 9, 4, 8);
    for (const x of [7, 22]) { windowLit(p, x, gy - 10, 3, 3); p.rect(x - 1, gy - 6, 5, 1, 'g'); dots(p, [[x - 1, gy - 7], [x + 1, gy - 7], [x + 3, gy - 7]], 'H'); dots(p, [[x, gy - 7], [x + 2, gy - 7]], 'c'); }
    roof(p, 2, gy - 25, 28, 11, ['r', 'R', 'o']);
    chimney(p, 22, gy - 29, 6);
    lantern(p, 20, gy - 12);
    p.rect(29, gy - 4, 1, 4, 'g'); p.rect(30, gy - 4, 1, 4, 'g'); // fence stub
  } else { // two storeys: stone ground floor, plaster upper, blue slate roof with a dormer
    stoneWall(p, 3, gy - 12, 26, 13);
    p.rect(2, gy - 14, 28, 2, 'g').rect(2, gy - 14, 28, 1, 'h');
    plaster(p, 3, gy - 23, 26, 9);
    roof(p, 1, gy - 36, 30, 12, ['B', 'C', 'D'], { ridge: 'D' });
    // dormer
    p.rect(12, gy - 32, 8, 6, 'i').rect(12, gy - 32, 8, 1, 'g').rect(19, gy - 32, 1, 6, 'f'); windowLit(p, 14, gy - 30, 4, 3);
    p.rect(11, gy - 34, 10, 2, 'B').rect(11, gy - 34, 10, 1, 'D').rect(20, gy - 34, 1, 2, 'n'); p.set(11, gy - 33, 'C');
    chimney(p, 24, gy - 40, 7);
    for (const x of [6, 22]) { windowLit(p, x, gy - 21, 3, 3); p.rect(x - 1, gy - 17, 5, 1, 'g'); dots(p, [[x - 1, gy - 18], [x + 1, gy - 18], [x + 3, gy - 18]], 'H'); p.set(x, gy - 18, 'c'); }
    archDoor(p, 13, gy - 9, 6, 9, 'f'); door(p, 14, gy - 8, 4, 8, 'g');
    windowLit(p, 6, gy - 9, 3, 3); windowLit(p, 23, gy - 9, 3, 3);
    lantern(p, 21, gy - 11); lantern(p, 10, gy - 11);
    p.rect(29, gy - 6, 2, 1, 'h').rect(29, gy - 5, 1, 5, 'g'); // bench end
    dots(p, [[1, gy], [2, gy - 1], [30, gy]], 'c'); p.set(2, gy, 'H');
  }
  return p.outline();
}

function storehouse(lv) {
  const H = [34, 40, 44][lv - 1], p = new Px(32, H), gy = H - 2;
  if (lv === 1) { // open lean-to piled with crates and sacks
    p.rect(5, gy - 13, 21, 12, 'n');
    for (const x of [4, 25]) { p.rect(x, gy - 14, 2, 14, 'g'); p.rect(x, gy - 14, 1, 14, 'h'); }
    roof(p, 2, gy - 21, 28, 7, ['f', 'g', 'h']);
    crate(p, 6, gy - 11, 6, 5); crate(p, 6, gy - 6, 6, 5); crate(p, 12, gy - 5, 5, 5);
    sack(p, 17, gy - 5); sack(p, 20, gy - 6); sack(p, 18, gy - 9, ['g', 'h', 'i']);
    barrel(p, 26, gy - 6, 4, 6);
    p.rect(28, gy - 18, 1, 4, 'i'); p.set(28, gy - 14, 'h'); // hanging rope
  } else if (lv === 2) { // red plank barn with a white-braced double door
    plankWall(p, 3, gy - 14, 26, 15, ['r', 'R', 'o']);
    p.rect(11, gy - 11, 10, 12, 'R'); p.rect(11, gy - 11, 10, 1, 'w'); p.rect(11, gy - 11, 1, 12, 'w'); p.rect(20, gy - 11, 1, 12, 'v'); p.rect(15, gy - 11, 2, 12, 'w');
    p.line(12, gy - 10, 14, gy, 'w'); p.line(14, gy - 10, 12, gy, 'w'); p.line(17, gy - 10, 19, gy, 'v'); p.line(19, gy - 10, 17, gy, 'v');
    p.set(14, gy - 5, 'y').set(17, gy - 5, 'y');
    roof(p, 1, gy - 28, 30, 13, ['f', 'g', 'h']);
    p.rect(13, gy - 24, 6, 5, 'n').rect(13, gy - 25, 6, 1, 'w'); dots(p, [[14, gy - 20], [15, gy - 21], [16, gy - 20], [17, gy - 20]], 'i'); p.set(15, gy - 20, 'h'); // hay loft
    sack(p, 4, gy - 4); sack(p, 25, gy - 4); sack(p, 27, gy - 7, ['g', 'h', 'i']);
  } else { // stone-based granary with hoist beam, iron-banded doors, flag
    stoneWall(p, 3, gy - 8, 26, 9);
    plankWall(p, 3, gy - 18, 26, 10, ['r', 'R', 'o']);
    p.rect(3, gy - 9, 26, 1, 'g');
    roof(p, 1, gy - 32, 30, 13, ['f', 'g', 'h']);
    // doors with iron bands
    p.rect(11, gy - 13, 10, 14, 'g'); for (let x = 11; x < 21; x += 2) p.rect(x, gy - 13, 1, 14, 'f'); p.rect(11, gy - 13, 1, 14, 'h');
    for (const y of [gy - 11, gy - 3]) { p.rect(11, y, 10, 1, 't'); dots(p, [[12, y], [15, y], [19, y]], 'u'); }
    p.rect(10, gy - 14, 12, 1, 's'); p.set(15, gy - 7, 'y').set(16, gy - 7, 'y');
    // loft + hoist
    p.rect(13, gy - 27, 6, 5, 'n'); sack(p, 14, gy - 26); p.rect(13, gy - 28, 6, 1, 'h');
    p.rect(15, gy - 34, 2, 6, 'g').rect(15, gy - 34, 1, 6, 'h'); p.rect(14, gy - 35, 4, 1, 'f'); gear(p, 16, gy - 31, 1.3, ['s', 't', 'u']);
    p.rect(16, gy - 29, 1, 9, 'i'); crate(p, 14, gy - 21, 5, 4);
    flagPole(p, 4, gy - 38, 7, ['f', 'g', 'h']); p.set(5, gy - 38, 'y').set(6, gy - 38, 'z');
    crate(p, 23, gy - 5, 5, 5); crate(p, 25, gy - 9, 4, 4); barrel(p, 4, gy - 5, 4, 5);
  }
  return p.outline();
}

function farm(lv) {
  const H = [34, 36, 38][lv - 1], p = new Px(32, H), gy = H - 2;
  const top = gy - 27; // back edge of the field
  // soil plot with chamfered corners, furrows across (period 4 rows: lit ridge, ridge, ridge, furrow)
  for (let y = top; y <= gy; y++) {
    const e = Math.min(y - top, gy - y), inset = e === 0 ? 3 : e === 1 ? 1 : 0;
    for (let x = 1 + inset; x <= 30 - inset; x++) {
      const k = (y - top) % 4; p.set(x, y, k === 0 ? 'h' : k === 3 ? 'f' : 'g');
    }
  }
  p.speckle('g', 'h', 0.06, 3).speckle('f', 'n', 0.05, 4);
  for (let y = top; y <= gy; y++) { if (p.get(30, y) !== '.') p.set(30, y, 'f'); if (p.get(1, y) !== '.' && (y - top) % 4 !== 3) p.set(1, y, 'h'); }
  const rows = []; for (let y = top + 3; y <= gy - 1; y += 4) rows.push(y);
  if (lv === 1) { // sprouts
    rows.forEach((y, j) => { for (let x = 4 + (j % 2) * 2; x < 28; x += 4) { p.set(x, y - 1, 'c'); p.set(x, y - 2, 'd'); p.set(x + 1, y - 1, 'b'); } });
    for (const [x, y] of [[2, top - 3], [29, top - 3], [2, gy - 3], [29, gy - 3]]) { p.rect(x, y, 1, 4, 'g'); p.set(x, y, 'h'); } // corner stakes
    p.line(24, gy - 1, 27, gy - 8, 'g'); p.rect(26, gy - 9, 3, 1, 'u'); p.set(28, gy - 8, 't'); // hoe
    sack(p, 5, gy - 4, ['g', 'h', 'i']); p.set(6, gy - 5, 'c');
  } else {
    const ripe = lv === 3;
    rows.forEach((y, j) => {
      if (ripe && j === 3) { for (let x = 4; x < 27; x += 4) { p.ellipse(x + 0.5, y - 1, 1.6, 1.3, 'c'); p.set(x, y - 2, 'd'); p.set(x + 1, y, 'b'); } return; } // cabbages
      for (let x = 3 + (j % 2); x < 29; x += 2) {
        const tall = 3 + ((x + j) % 3 === 0 ? 1 : 0);
        for (let k = 1; k <= tall; k++) p.set(x, y - k, ripe ? (k === tall ? 'z' : k === tall - 1 ? 'y' : 'x') : (k === tall ? 'e' : k === 1 ? 'b' : 'c'));
        if (ripe) p.set(x, y - tall - 1, 'i');
      }
    });
    if (ripe) { p.ellipse(25.5, gy - 2, 2.2, 1.6, 'x'); p.set(25, gy - 3, 'y').set(25, gy - 4, 'b'); p.set(27, gy - 2, 'r'); } // pumpkin
    // scarecrow
    const sx = 23, sy = top - 6;
    p.rect(sx, sy, 1, 12, 'g'); p.rect(sx - 4, sy + 4, 9, 1, 'g'); p.set(sx - 4, sy + 4, 'h');
    p.rect(sx - 2, sy + 3, 5, 5, ripe ? 'C' : 'R'); p.set(sx - 2, sy + 3, ripe ? 'D' : 'o'); p.rect(sx + 2, sy + 3, 1, 5, ripe ? 'B' : 'r'); p.set(sx, sy + 5, 'i');
    p.rect(sx - 1, sy, 3, 3, 'i'); p.set(sx - 1, sy, 'q'); p.set(sx, sy + 1, 'f'); p.rect(sx - 2, sy - 1, 5, 1, 'f'); p.rect(sx - 1, sy - 2, 3, 1, 'g');
    dots(p, [[sx - 4, sy + 5], [sx + 4, sy + 5]], 'i');
    // split-rail fence along the front edge
    for (let x = 2; x <= 29; x += 5) { p.rect(x, gy - 4, 1, 5, 'g'); p.set(x, gy - 4, 'h'); }
    p.rect(2, gy - 3, 28, 1, 'h'); p.rect(2, gy - 1, 28, 1, 'g');
    if (ripe) { p.rect(12, gy - 3, 6, 3, '.'); for (let x = 12; x < 18; x++) for (let y = gy - 3; y <= gy; y++) if (p.get(x, y) === '.') p.set(x, y, (y - top) % 4 === 3 ? 'f' : 'g'); p.rect(13, gy - 4, 1, 5, 'g'); p.rect(16, gy - 4, 1, 5, 'g'); p.line(13, gy - 3, 16, gy, 'h'); } // open gate
    if (ripe) { box(p, 3, top - 3, 6, 2, 3, ['g', 'h', 'i'], { top: 'i' }); p.rect(3, top - 1, 6, 1, 'y'); p.set(8, top, 'g'); } // hay bale
    // water trough
    box(p, 3, top + 9, 6, 1, 2, ['f', 'g', 'h']); p.rect(4, top + 9, 4, 1, 'C'); p.set(4, top + 9, 'D');
  }
  return p.outline();
}

function vault(lv) {
  const H = [36, 40, 44][lv - 1], p = new Px(32, H), gy = H - 2;
  // low heavy bunker sunk into an earth berm
  const fy = gy - 12; // top of the front face
  box(p, 3, fy - 6, 26, 6, 13, ['s', 't', 'u'], { top: 'c' });
  for (let y = fy - 6; y < fy; y++) for (let x = 3; x < 29; x++) if (hash(x, y, 4) < 0.2) p.set(x, y, 'd'); else if (hash(x, y, 5) < 0.1) p.set(x, y, 'b');
  p.rect(3, fy - 1, 26, 1, 'b');
  bricks(p, 3, fy, 26, 13, 't', 's', 8);
  p.rect(3, fy, 1, 13, 'u');
  p.speckle('t', 'u', 0.04, 9);
  // massive iron door
  const dx = 11, dw = 10;
  archDoor(p, dx - 1, gy - 10, dw + 2, 11, 's');
  p.rect(dx, gy - 9, dw, 10, 't'); p.rect(dx + 1, gy - 10, dw - 2, 1, 't'); p.rect(dx, gy - 9, 1, 10, 'u'); p.rect(dx + dw - 1, gy - 9, 1, 10, 's');
  for (let x = dx + 2; x < dx + dw - 1; x += 3) p.rect(x, gy - 9, 1, 10, 's');
  dots(p, [[dx + 1, gy - 8], [dx + dw - 2, gy - 8], [dx + 1, gy - 1], [dx + dw - 2, gy - 1]], 'v');
  p.rect(dx + 3, gy - 6, 4, 3, 'y'); p.set(dx + 3, gy - 6, 'z'); p.set(dx + 6, gy - 4, 'x'); p.set(dx + 5, gy - 5, 'n'); // lock plate
  // buttresses
  for (const x of [1, 27]) { box(p, x, fy - 3, 4, 2, 15, ['s', 't', 'u'], { top: 'v' }); bricks(p, x, fy - 1, 4, 14, 't', 's', 4); }
  if (lv >= 2) {
    for (const y of [fy + 3, gy - 2]) for (let x = 5; x < 27; x++) if (x < dx - 1 || x > dx + dw) { p.set(x, y, 'u'); if (x % 4 === 1) p.set(x, y, 'v'); }
    for (const x of [6, 23]) { p.rect(x, fy + 5, 3, 4, 'n'); p.rect(x + 1, fy + 5, 1, 4, 's'); p.set(x, fy + 7, 'y'); p.set(x + 2, fy + 6, 'z'); } // barred windows, gold glints
    crenels(p, 4, fy - 9, 24); p.rect(4, fy - 7, 24, 1, 's');
    flagPole(p, 28, fy - 16, 8, ['B', 'C', 'D']);
  }
  if (lv === 3) { // dome on top + round vault wheel + lanterns + gold trim
    const dcy = fy - 9;
    for (let y = dcy - 9; y <= dcy; y++) for (let x = 6; x <= 25; x++) {
      const u = (x + 0.5 - 16) / 9.6, v = (y + 0.5 - dcy) / 9.5; if (u * u + v * v > 1) continue;
      p.set(x, y, u < -0.45 ? 'u' : u > 0.4 ? 's' : 't');
    }
    for (const x of [10, 16, 21]) for (let y = dcy - 9; y <= dcy; y++) if (p.get(x, y) !== '.' && 'stu'.includes(p.get(x, y))) p.set(x, y, x === 16 ? 'y' : 'x');
    p.rect(6, dcy, 20, 1, 'y'); p.set(25, dcy, 'x');
    p.set(16, dcy - 10, 'y').set(16, dcy - 11, 'z').set(15, dcy - 10, 'x');
    p.set(13, dcy - 6, 'v'); p.set(12, dcy - 5, 'v');
    // round vault wheel on the door
    p.ellipse(15.5, gy - 5, 3.2, 3.2, 'u'); p.ellipse(15.5, gy - 5, 2.1, 2.1, 't');
    for (const [a, b] of [[15, gy - 8], [15, gy - 2], [12, gy - 5], [18, gy - 5]]) p.set(a, b, 'y');
    p.set(15, gy - 5, 'z'); p.set(16, gy - 5, 'y');
    for (const x of [4, 27]) { p.rect(x, gy - 13, 1, 4, 'f'); lantern(p, x, gy - 16); }
  }
  return p.outline();
}

function scoutLodge(lv) {
  const H = [38, 42, 44][lv - 1], p = new Px(32, H), gy = H - 2;
  if (lv === 1) { // hunter's tent + lookout pole + spear rack
    for (let y = 0; y < 16; y++) { const half = 1 + y * 0.72; for (let x = Math.round(11 - half); x <= Math.round(11 + half); x++) p.set(x, gy - 16 + y, x < 11 - half * 0.5 ? 'd' : x > 11 + half * 0.4 ? 'b' : 'c'); }
    for (let y = gy - 9; y <= gy - 1; y++) { const half = (y - (gy - 10)) * 0.5; for (let x = Math.round(11 - half); x <= Math.round(11 + half); x++) p.set(x, y, 'n'); }
    p.line(11, gy - 16, 11, gy - 10, 'b'); for (let y = gy - 13; y < gy; y += 4) for (let x = 0; x < 32; x++) if (p.get(x, y) === 'c') p.set(x, y, 'a');
    p.rect(10, gy - 19, 1, 4, 'f');
    // lookout pole with crow's nest
    p.rect(25, gy - 26, 2, 26, 'g').rect(25, gy - 26, 1, 26, 'h');
    for (let y = gy - 22; y < gy; y += 3) { p.set(24, y, 'h'); p.set(27, y, 'g'); }
    box(p, 21, gy - 30, 10, 2, 3, ['f', 'g', 'h']); p.rect(21, gy - 33, 1, 3, 'g'); p.rect(30, gy - 33, 1, 3, 'f'); p.rect(21, gy - 33, 10, 1, 'h');
    p.rect(25, gy - 37, 1, 4, 'f'); p.rect(26, gy - 37, 3, 2, 'c'); p.set(28, gy - 36, 'b'); p.set(26, gy - 37, 'd');
    for (const x of [18, 20]) { p.rect(x, gy - 9, 1, 9, 'h'); p.set(x, gy - 10, 'v'); }
    p.ellipse(4, gy - 2, 2.4, 1.2, 'f'); p.set(3, gy - 3, 'x').set(4, gy - 4, 'y').set(5, gy - 3, 'x'); // campfire
  } else {
    const stone = lv === 3;
    logWall(p, 2, gy - 13, 19, 13);
    roof(p, 0, gy - 24, 23, 10, stone ? ['a', 'b', 'c'] : ['f', 'g', 'h']);
    door(p, 9, gy - 8, 4, 8);
    p.rect(8, gy - 12, 6, 1, 'i'); dots(p, [[7, gy - 13], [14, gy - 13], [6, gy - 14], [15, gy - 14]], 'i'); // antlers over the door
    windowLit(p, 4, gy - 9, 2, 2); windowLit(p, 16, gy - 9, 2, 2);
    if (!stone) { // timber lookout
      woodLegs(p, 22, 28, gy - 18, gy);
      box(p, 21, gy - 24, 10, 2, 4, ['f', 'g', 'h']);
      for (let x = 21; x < 31; x += 3) p.rect(x, gy - 27, 1, 3, 'g'); p.rect(21, gy - 27, 10, 1, 'h');
      p.rect(22, gy - 34, 1, 7, 'f'); p.rect(23, gy - 34, 4, 2, 'c'); p.set(26, gy - 33, 'b'); p.set(23, gy - 34, 'd');
      banner(p, 3, gy - 23, 6, ['a', 'b', 'c'], 'y');
    } else { // stone lookout tower with a green cone roof and a spyglass
      stoneShaft(p, 22, gy - 26, 8, 27);
      p.rect(25, gy - 6, 3, 6, 'f').set(26, gy - 6, 'g');
      p.rect(24, gy - 20, 3, 3, 'n'); p.set(25, gy - 19, 'y');
      p.line(21, gy - 22, 18, gy - 24, 'y'); p.set(18, gy - 25, 'D'); p.set(21, gy - 21, 'x'); // spyglass
      crenels(p, 21, gy - 28, 10);
      cone(p, 26, gy - 38, gy - 28, 6.5, ['a', 'b', 'c']); p.set(26, gy - 39, 'y').set(25, gy - 39, 'z');
      banner(p, 3, gy - 23, 6, ['a', 'b', 'c'], 'y'); banner(p, 16, gy - 23, 6, ['a', 'b', 'c'], 'y');
      p.rect(1, gy - 5, 1, 5, 'g'); p.rect(0, gy - 8, 3, 3, 'i'); p.set(1, gy - 7, 'r'); p.set(0, gy - 8, 'w'); // map board
    }
  }
  return p.outline();
}

function forge(lv) {
  const H = [36, 40, 44][lv - 1], p = new Px(32, H), gy = H - 2;
  const anvil = (ax, ay, gold = false) => {
    p.rect(ax + 1, ay + 2, 4, 3, 'g').rect(ax + 1, ay + 2, 1, 3, 'h').rect(ax + 4, ay + 2, 1, 3, 'f'); // stump
    p.rect(ax, ay, 6, 2, 't'); p.rect(ax - 1, ay, 8, 1, 'u'); p.set(ax - 1, ay, 'v'); p.set(ax + 6, ay, 's'); p.set(ax + 6, ay + 1, 's');
    if (gold) p.set(ax + 2, ay, 'z');
  };
  if (lv === 1) { // open-air stone forge with bellows
    box(p, 4, gy - 13, 14, 3, 11, ['s', 't', 'u'], { top: 'u' });
    bricks(p, 4, gy - 10, 14, 11, 't', 's', 4);
    p.rect(7, gy - 8, 8, 5, 'n'); p.rect(8, gy - 6, 6, 3, 'x'); p.rect(9, gy - 5, 4, 2, 'y'); p.set(10, gy - 5, 'z'); p.set(12, gy - 6, 'z');
    p.rect(13, gy - 21, 4, 8, 't').rect(13, gy - 21, 1, 8, 'u').rect(16, gy - 21, 1, 8, 's').rect(12, gy - 22, 6, 1, 'u');
    dots(p, [[14, gy - 24], [16, gy - 26], [15, gy - 28]], 'y'); p.set(15, gy - 23, 'x');
    // bellows
    p.line(1, gy - 9, 4, gy - 7, 'f'); p.rect(1, gy - 8, 3, 3, 'g'); p.set(1, gy - 8, 'h'); p.line(0, gy - 6, 3, gy - 5, 'f');
    anvil(21, gy - 6);
    barrel(p, 27, gy - 6, 4, 6); p.rect(27, gy - 6, 4, 1, 'C'); p.set(28, gy - 6, 'D');
    p.line(22, gy - 9, 25, gy - 12, 'g'); p.rect(25, gy - 13, 2, 2, 't'); // hammer on the anvil
  } else {
    const big = lv === 3;
    stoneWall(p, 2, gy - 14, 22, 15, ['n', 's', 't']);
    roof(p, 0, gy - 25, 26, 10, ['n', 's', 't'], { ridge: 'u' });
    // furnace mouth
    const fw = big ? 10 : 8, fx = 4;
    archDoor(p, fx - 1, gy - (big ? 11 : 9), fw + 2, big ? 11 : 9, 'u');
    archDoor(p, fx, gy - (big ? 10 : 8), fw, big ? 10 : 8, 'n');
    p.rect(fx + 1, gy - 4, fw - 2, 3, 'x'); p.rect(fx + 2, gy - 4, fw - 4, 2, 'y'); p.set(fx + 3, gy - 4, 'z'); p.set(fx + fw - 3, gy - 3, 'z');
    if (big) for (let x = fx + 1; x < fx + fw; x += 2) p.rect(x, gy - 9, 1, 4, 't');
    door(p, 17, gy - 8, 4, 8);
    // chimney stack glowing at the mouth
    const chim = (x, top, h) => { p.rect(x, top, 5, h, 's'); bricks(p, x, top, 5, h, 's', 'n', 4); p.rect(x, top, 1, h, 't'); p.rect(x - 1, top - 1, 7, 2, 't'); p.rect(x - 1, top - 1, 7, 1, 'u'); p.set(x + 5, top, 'n'); p.rect(x, top - 1, 5, 1, 'x'); p.set(x + 2, top - 1, 'y'); dots(p, [[x + 1, top - 3], [x + 3, top - 5], [x + 2, top - 7]], 'y'); p.set(x + 4, top - 4, 'x'); };
    chim(19, gy - 31, 13);
    if (big) { chim(4, gy - 33, 10); p.rect(0, gy - 15, 26, 1, 'u'); }
    // outside: anvil, quench barrel, rack
    anvil(25, gy - 6, big);
    barrel(p, 27, gy - 13, 4, 5); p.rect(27, gy - 13, 4, 1, 'C'); p.set(28, gy - 13, 'D');
    if (big) {
      p.rect(30, gy - 26, 1, 12, 'g'); p.rect(27, gy - 26, 4, 1, 'f'); // sign arm
      p.rect(26, gy - 25, 5, 4, 'n'); p.rect(26, gy - 25, 5, 1, 'y'); p.rect(27, gy - 23, 3, 1, 'y'); p.set(28, gy - 22, 'y'); p.set(27, gy - 23, 'z'); // anvil sign
      for (const x of [9, 12, 15]) { p.rect(x, gy - 27, 1, 7, 'v'); p.set(x, gy - 28, 'w'); p.set(x, gy - 20, 'g'); p.rect(x - 1, gy - 21, 3, 1, 'f'); } // swords on the roof rack
      p.rect(8, gy - 20, 9, 1, 'g');
      p.rect(22, gy - 2, 3, 1, 'u'); p.rect(22, gy - 3, 3, 1, 'y'); p.set(22, gy - 3, 'z'); // ingots
    }
  }
  return p.outline();
}

function study(lv) {
  const H = [38, 42, 44][lv - 1], p = new Px(32, H), gy = H - 2;
  const books = (x, y, n) => { const c = ['R', 'C', 'c', 'y', 'M', 'h']; for (let i = 0; i < n; i++) { p.rect(x, y - i * 2, 5 - (i % 2), 2, c[i % c.length]); p.set(x, y - i * 2, 'w'); } };
  const lectern = (x, y) => { p.rect(x + 1, y, 1, 5, 'g'); p.rect(x, y + 5, 3, 1, 'f'); p.rect(x - 1, y - 1, 5, 2, 'w'); p.set(x + 1, y - 1, 'u'); p.set(x + 3, y, 'i'); };
  if (lv === 1) {
    plaster(p, 5, gy - 12, 18, 13);
    roof(p, 3, gy - 23, 22, 10, ['B', 'C', 'D']);
    door(p, 12, gy - 8, 4, 8);
    p.ellipse(8.5, gy - 8, 2, 2, 'f'); p.ellipse(8.5, gy - 8, 1.2, 1.2, 'y'); p.set(8, gy - 9, 'z'); // round window
    p.ellipse(19.5, gy - 8, 2, 2, 'f'); p.ellipse(19.5, gy - 8, 1.2, 1.2, 'y'); p.set(19, gy - 9, 'z');
    books(24, gy - 2, 4); lectern(28, gy - 7);
  } else {
    const obs = lv === 3, bw = obs ? 21 : 26;
    stoneWall(p, 3, gy - 15, bw, 16);
    roof(p, 1, gy - 27, bw + 4, 11, ['B', 'C', 'D'], { ridge: 'D' });
    // tall stained-glass arched windows
    for (const x of obs ? [6] : [6, 22]) {
      archDoor(p, x - 1, gy - 14, 5, 9, 's'); archDoor(p, x, gy - 13, 3, 7, 'C');
      p.set(x, gy - 12, 'y'); p.set(x + 1, gy - 11, 'R'); p.set(x + 2, gy - 9, 'y'); p.set(x, gy - 8, 'D'); p.set(x + 1, gy - 13, 'E'); p.rect(x, gy - 10, 3, 1, 't');
    }
    archDoor(p, obs ? 13 : 14, gy - 10, 6, 11, 'u'); door(p, obs ? 14 : 15, gy - 9, 4, 9);
    p.rect(obs ? 14 : 15, gy - 13, 4, 2, 'y'); p.set(obs ? 15 : 16, gy - 13, 'w'); p.set(obs ? 16 : 17, gy - 13, 'w'); p.set(obs ? 17 : 18, gy - 12, 'x'); // gold book plaque
    if (!obs) { books(1, gy - 1, 3); lectern(28, gy - 6); }
    else { // observatory: round tower, dome, telescope
      stoneShaft(p, 23, gy - 26, 8, 27);
      p.rect(25, gy - 18, 3, 4, 'n'); p.set(26, gy - 18, 'y');
      p.rect(22, gy - 27, 10, 1, 'u'); p.set(31, gy - 27, 's');
      for (let y = gy - 34; y <= gy - 28; y++) for (let x = 22; x <= 31; x++) { const u = (x + 0.5 - 27) / 5, v = (y + 0.5 - (gy - 27.5)) / 6.5; if (u * u + v * v <= 1) p.set(x, y, u < -0.4 ? 'D' : u > 0.4 ? 'B' : 'C'); }
      p.rect(26, gy - 34, 1, 7, 'y'); p.set(26, gy - 35, 'z');
      p.line(24, gy - 31, 20, gy - 36, 'y'); p.line(25, gy - 31, 21, gy - 36, 'x'); p.set(20, gy - 37, 'D'); // telescope
      banner(p, 2, gy - 26, 6, ['B', 'C', 'D'], 'y'); banner(p, 18, gy - 26, 6, ['B', 'C', 'D'], 'y');
      books(0, gy - 1, 2);
    }
  }
  return p.outline();
}

function market(lv) {
  const H = [34, 38, 42][lv - 1], p = new Px(32, H), gy = H - 2;
  const awning = (x, y, w, h, [a, b], scallop = true) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.set(x + i, y + j, Math.floor(i / 3) % 2 ? b : a);
    for (let i = 0; i < w; i++) { p.set(x + i, y, Math.floor(i / 3) % 2 ? (b === 'w' ? 'v' : b) : (a === 'R' ? 'o' : a)); }
    if (scallop) for (let i = 0; i < w; i++) if (i % 3 !== 1) p.set(x + i, y + h, Math.floor(i / 3) % 2 ? (b === 'w' ? 'v' : b) : (a === 'R' ? 'r' : a === 'C' ? 'B' : a));
  };
  const goods = (x, y, w) => { for (let i = 0; i < w; i++) { const k = i % 6; p.set(x + i, y, ['R', 'o', 'c', 'd', 'h', 'i'][k]); if (i % 2 === 0) p.set(x + i, y - 1, ['R', 'c', 'y'][i % 3]); } };
  const stall = (x, y, w, colours) => {
    for (const px of [x + 1, x + w - 2]) { p.rect(px, y, 1, gy - y + 1, 'g'); p.set(px, y, 'h'); }
    p.rect(x + 2, y + 2, w - 4, 5, 'n');
    awning(x, y - 4, w, 4, colours);
    box(p, x + 1, gy - 6, w - 2, 2, 5, ['f', 'g', 'h']);
    goods(x + 2, gy - 7, w - 4);
  };
  if (lv === 1) {
    stall(3, gy - 15, 20, ['R', 'w']);
    crate(p, 24, gy - 5, 6, 5); dots(p, [[25, gy - 6], [27, gy - 6], [26, gy - 7]], 'R'); p.set(28, gy - 6, 'o');
    sack(p, 25, gy - 10, ['g', 'h', 'i']);
  } else if (lv === 2) {
    stall(16, gy - 19, 15, ['C', 'w']);
    stall(1, gy - 15, 16, ['R', 'w']);
    barrel(p, 27, gy - 4, 4, 5);
    p.rect(2, gy - 25, 1, 6, 'g'); p.rect(1, gy - 25, 6, 3, 'g'); p.rect(1, gy - 25, 6, 1, 'h'); p.rect(3, gy - 24, 2, 1, 'y'); p.set(3, gy - 24, 'z'); // coin sign
  } else { // covered market hall with bunting, lanterns, gold coin sign
    for (const x of [2, 15, 28]) { p.rect(x, gy - 20, 2, 21, 'g'); p.rect(x, gy - 20, 1, 21, 'h'); }
    roof(p, 0, gy - 31, 32, 10, ['r', 'R', 'o']);
    awning(1, gy - 21, 30, 3, ['C', 'w']);
    p.rect(3, gy - 17, 26, 7, 'n'); for (const x of [2, 15, 28]) { p.rect(x, gy - 17, 2, 7, 'g'); p.set(x, gy - 17, 'h'); }
    // bunting
    for (let x = 3; x < 29; x++) { const y = gy - 17 + Math.round(Math.sin(((x - 3) / 12) * Math.PI) * 2); p.set(x, y, 'i'); if (x % 3 === 0) { p.set(x, y + 1, ['R', 'y', 'C', 'c'][(x / 3) % 4]); p.set(x, y + 2, ['r', 'x', 'B', 'b'][(x / 3) % 4]); } }
    lantern(p, 8, gy - 16); lantern(p, 22, gy - 16);
    box(p, 1, gy - 7, 30, 2, 6, ['f', 'g', 'h']); goods(3, gy - 8, 11); goods(17, gy - 8, 11);
    p.rect(15, gy - 10, 3, 1, 'u'); p.set(14, gy - 9, 'y').set(18, gy - 9, 'y'); p.set(16, gy - 11, 't'); // scale
    p.ellipse(16, gy - 35, 3, 3, 'y'); p.ellipse(15.6, gy - 35.4, 1.6, 1.6, 'z'); p.set(18, gy - 34, 'x').set(17, gy - 33, 'x'); p.rect(16, gy - 32, 1, 1, 'f'); // coin sign
    dots(p, [[16, gy - 35]], 'x');
  }
  return p.outline();
}

function dock(lv) {
  const H = [34, 38, 42][lv - 1], p = new Px(32, H), gy = H - 2;
  // posts going down into the water (ripples) at the front, plank deck above
  const deckY = gy - 18, deckB = gy - 6, dx0 = lv === 1 ? 8 : 4, dx1 = lv === 1 ? 23 : 27;
  for (const x of lv === 1 ? [9, 15, 21] : [5, 11, 17, 23]) {
    p.rect(x, deckB + 1, 2, 5, 'g'); p.rect(x, deckB + 1, 1, 5, 'h'); p.rect(x, gy - 1, 2, 2, 'f');
    p.set(x - 1, gy, 'D'); p.set(x + 2, gy, 'C'); p.set(x - 2, gy, 'C'); p.set(x + 3, gy, 'B');
  }
  for (let y = deckY; y <= deckB - 2; y++) for (let x = dx0; x <= dx1; x++) p.set(x, y, (x - dx0) % 3 === 2 ? 'g' : (y + x) % 9 === 0 ? 'g' : 'h');
  for (let y = deckY; y <= deckB - 2; y++) { p.set(dx0, y, 'i'); p.set(dx1, y, 'g'); }
  p.rect(dx0, deckB - 1, dx1 - dx0 + 1, 2, 'g'); p.rect(dx0, deckB, dx1 - dx0 + 1, 1, 'f');
  for (let x = dx0 + 1; x < dx1; x += 5) p.set(x, deckB - 1, 'u');
  // shore end at the back: a sandy lip
  p.rect(dx0 - 2, deckY - 2, dx1 - dx0 + 5, 2, 'i'); p.set(dx0 - 2, deckY - 2, '.'); p.set(dx1 + 2, deckY - 2, '.'); p.speckle('i', 'h', 0.25, 6);
  // bollard + rope
  const bol = (x, y) => { p.rect(x, y, 3, 3, 't'); p.rect(x, y, 3, 1, 'u'); p.set(x + 2, y + 1, 's'); p.set(x + 2, y + 2, 's'); p.set(x, y, 'v'); };
  bol(dx0 + 1, deckB - 4); bol(dx1 - 3, deckB - 4);
  p.ellipse(dx0 + 7, deckB - 4, 2.2, 1.3, 'i'); p.set(dx0 + 7, deckB - 4, 'g'); p.set(dx0 + 6, deckB - 5, 'h');
  if (lv === 1) {
    p.rect(dx1 - 1, deckY - 8, 1, 8, 'g'); p.rect(dx1 - 2, deckY - 8, 3, 1, 'f'); lantern(p, dx1 - 1, deckY - 8);
  } else {
    // crane with a hanging cargo net
    p.rect(dx0 + 1, deckY - 16, 2, 16, 'g'); p.rect(dx0 + 1, deckY - 16, 1, 16, 'h');
    p.rect(dx0 + 1, deckY - 17, 11, 2, 'g'); p.rect(dx0 + 1, deckY - 17, 11, 1, 'h'); p.line(dx0 + 3, deckY - 9, dx0 + 8, deckY - 15, 'f');
    p.rect(dx0 + 10, deckY - 15, 1, 5, 'i');
    p.ellipse(dx0 + 10, deckY - 8, 2.4, 2.4, 'h'); for (const [a, b] of [[-1, -1], [1, 0], [0, 1], [-1, 1]]) p.set(dx0 + 10 + a, deckY - 8 + b, 'f');
    crate(p, dx1 - 7, deckY + 2, 5, 4); barrel(p, dx1 - 3, deckY + 1, 3, 5);
    p.rect(dx1 - 1, deckY - 8, 1, 8, 'g'); lantern(p, dx1 - 1, deckY - 11);
    if (lv === 3) { // boathouse at the shore end + bell + flag
      plankWall(p, 13, deckY - 9, 11, 9); door(p, 16, deckY - 6, 4, 6);
      roof(p, 11, deckY - 17, 15, 7, ['r', 'R', 'o']);
      flagPole(p, 23, deckY - 24, 7, ['B', 'C', 'D']);
      p.rect(dx0 + 15, deckB - 7, 1, 3, 'f'); p.rect(dx0 + 14, deckB - 8, 3, 1, 'g'); p.rect(dx0 + 14, deckB - 7, 3, 2, 'y'); p.set(dx0 + 14, deckB - 7, 'z'); p.set(dx0 + 16, deckB - 6, 'x'); // bell
    }
  }
  return p.outline();
}

// ════ Dawn shrine, watchtower, brazier l3 ════
function dawnShrine() {
  const H = 44, p = new Px(32, H), gy = H - 2, cx = 16;
  // the sun disc in a stone ring, rays as gold spikes (drawn first: the dais sits in front of its foot)
  const sy = gy - 25;
  p.rect(cx - 2, sy + 6, 5, 10, 'u').rect(cx - 2, sy + 6, 1, 10, 'v').rect(cx + 2, sy + 6, 1, 10, 't');
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 - Math.PI / 2, L = k % 2 ? 11 : 13; for (let r = 8; r <= L; r++) p.set(Math.round(cx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), r === L ? 'z' : k % 2 ? 'x' : 'y'); }
  p.ellipse(cx, sy, 9, 9, 'u');
  for (let y = sy - 9; y <= sy + 9; y++) for (let x = cx - 9; x <= cx + 9; x++) if (p.get(x, y) === 'u') { const u = x - cx, v = y - sy; if (u + v > 6) p.set(x, y, 't'); else if (u + v < -6) p.set(x, y, 'v'); }
  p.ellipse(cx, sy, 6.6, 6.6, 'y'); p.ellipse(cx - 0.4, sy - 0.4, 4.6, 4.6, 'z'); p.ellipse(cx - 1.2, sy - 1.2, 1.8, 1.8, 'w');
  for (let y = sy - 7; y <= sy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) if (p.get(x, y) === 'y' && x - cx + y - sy > 3) p.set(x, y, 'x');
  // dais
  cyl(p, cx, gy - 7, 14.5, 4.5, 3, ['t', 'u', 'v'], { top: 'v', rim: ['u', 'w'] });
  bricks(p, 0, gy - 7, 32, 8, 'u', 't', 6);
  cyl(p, cx, gy - 10, 10.5, 3.5, 3, ['t', 'u', 'v'], { top: 'w', rim: ['v', 'w'], band: [[0, 'yx']] });
  for (let i = 0; i < 3; i++) { p.rect(12 - i, gy - 5 + i * 2, 8 + i * 2, 1, 'w'); p.rect(12 - i, gy - 4 + i * 2, 8 + i * 2, 1, i === 2 ? 't' : 'u'); p.set(19 + i, gy - 4 + i * 2, 't'); }
  // dawn lamps with pale fire, flowers
  for (const x of [3, 27]) { p.rect(x, gy - 11, 3, 8, 'u').rect(x, gy - 11, 1, 8, 'v').rect(x + 2, gy - 11, 1, 8, 't'); p.rect(x - 1, gy - 12, 5, 1, 'v'); p.set(x + 3, gy - 12, 't'); p.set(x + 1, gy - 13, 'o'); p.set(x + 1, gy - 14, 'z'); p.set(x, gy - 13, 'y'); }
  dots(p, [[8, gy - 2], [24, gy - 1], [6, gy - 1]], 'H'); dots(p, [[7, gy - 1], [25, gy - 2], [23, gy]], 'c'); p.set(9, gy - 1, 'w');
  return p.outline();
}
function watchtower(lv) {
  const H = 30, p = new Px(16, H), gy = H - 2;
  if (lv === 1) { // tall timber stilt tower with a lantern cabin
    woodLegs(p, 3, 11, gy - 15, gy);
    p.rect(7, gy - 14, 2, 15, 'h'); for (let y = gy - 13; y <= gy; y += 2) p.rect(7, y, 2, 1, 'f');
    box(p, 2, gy - 22, 12, 1, 7, ['f', 'g', 'h']); for (let x = 4; x < 13; x += 3) p.rect(x, gy - 21, 1, 6, 'f');
    p.rect(5, gy - 20, 6, 3, 'y'); p.rect(5, gy - 20, 6, 1, 'z'); p.rect(7, gy - 20, 1, 3, 'x'); p.set(10, gy - 18, 'x');
    cone(p, 8, gy - 28, gy - 22, 7, ['f', 'g', 'h']); p.set(8, gy - 28, 'y');
  } else { // slim stone shaft, brass lantern room, blue cone
    stoneShaft(p, 4, gy - 15, 8, 16);
    p.rect(6, gy - 5, 4, 6, 'f').rect(7, gy - 5, 1, 6, 'g').set(9, gy - 2, 'y');
    p.rect(7, gy - 11, 2, 2, 'n');
    p.rect(2, gy - 16, 12, 1, 'u').rect(2, gy - 15, 12, 1, 's'); p.set(2, gy - 16, 'v');
    p.rect(3, gy - 22, 10, 6, 'x'); p.rect(4, gy - 21, 8, 4, 'y'); p.rect(5, gy - 21, 6, 2, 'z'); p.set(5, gy - 21, 'w');
    for (const x of [6, 9]) p.rect(x, gy - 21, 1, 4, 'x');
    cone(p, 8, gy - 28, gy - 22, 6.5, ['B', 'C', 'D']); p.set(8, gy - 28, 'y'); p.set(7, gy - 28, 'z');
  }
  const o = p.outline();
  if (lv === 2) { o.set(0, gy - 20, 'z'); o.set(15, gy - 19, 'z'); o.set(1, gy - 23, 'y'); } // light glints
  return o;
}
function brazierL3() {
  const H = 32, base = new Px(16, H), gy = H - 2;
  box(base, 1, gy - 4, 14, 2, 3, ['s', 't', 'u'], { top: 'v' });
  box(base, 3, gy - 7, 10, 1, 3, ['s', 't', 'u'], { top: 'v' });
  base.rect(6, gy - 14, 4, 8, 't').rect(6, gy - 14, 1, 8, 'u').rect(9, gy - 14, 1, 8, 's');
  for (const y of [gy - 12, gy - 8]) { base.rect(6, y, 4, 1, 'y'); base.set(9, y, 'x'); base.set(6, y, 'z'); }
  base.rect(5, gy - 15, 6, 1, 'u').set(10, gy - 15, 's');
  cyl(base, 7.5, gy - 19, 6.5, 2.2, 3, ['s', 't', 'u'], { top: 'n', rim: ['y', 'z'], band: [[1, 'yx']] });
  for (const x of [1, 14]) base.set(x, gy - 20, 'y').set(x, gy - 21, 'z');
  for (const x of [4, 11]) base.set(x, gy - 21, 'u').set(x, gy - 22, 'v');
  base.ellipse(7.5, gy - 19, 4.5, 1.1, 'r');
  dots(base, [[3, gy - 3], [12, gy - 3]], 'x');
  const fire = { cx: 8, by: gy - 19, hw: 5, h: 12 };
  return frames(base, 4, (p, f) => flame(p, fire.cx, fire.by, fire.hw, fire.h + [0, 1, -1, 1][f], f, { tongues: 2 }),
    (p, f) => { p.set(f % 2 ? 13 : 2, Math.max(0, fire.by - fire.h - 1 - (f % 3)), 'y'); if (f === 1) p.set(10, Math.max(0, fire.by - fire.h - 3), 'z'); });
}

// ════ Decor props (1×1) ════
function decor(id) {
  if (id === 'statue') { // hero with a raised sword on a plinth
    const p = new Px(16, 28), gy = 26;
    box(p, 2, gy - 6, 12, 2, 5, ['s', 't', 'u'], { top: 'v' }); p.rect(5, gy - 3, 6, 1, 'y'); p.set(10, gy - 3, 'x');
    const f = Px.grid([
      '.....vvv.....',
      '....vuuut....',
      '....vuuut....',
      '.....ttt.....',
      '...vuuuuut...',
      '..vuuuuuuut..',
      '.vuuuutuuuut.',
      '.vu.uuuuu.t..',
      '....uutuu....',
      '....ut.ut....',
      '....ut.ut....',
      '...vvt.vtt...',
    ]);
    p.stamp(f, 2, gy - 18);
    p.rect(12, gy - 25, 1, 12, 'v'); p.set(12, gy - 26, 'w'); p.rect(11, gy - 15, 3, 1, 'u'); p.set(12, gy - 14, 't'); // sword
    p.set(3, gy - 11, 'u'); dots(p, [[2, gy - 1], [13, gy - 1]], 'c');
    return p.outline();
  }
  if (id === 'well') {
    const p = new Px(16, 26), gy = 24;
    cyl(p, 7.5, gy - 7, 6.5, 2.6, 5, ['s', 't', 'u'], { top: 'u', rim: ['t', 'v'] });
    bricks(p, 0, gy - 6, 16, 8, 't', 's', 4);
    p.ellipse(7.5, gy - 7, 4.5, 1.4, 'B'); p.set(6, gy - 7, 'C'); p.set(8, gy - 7, 'D');
    for (const x of [1, 13]) { p.rect(x, gy - 17, 2, 10, 'g'); p.rect(x, gy - 17, 1, 10, 'h'); }
    p.rect(2, gy - 15, 12, 1, 'f'); p.set(7, gy - 15, 't'); p.rect(7, gy - 14, 1, 4, 'i');
    barrel(p, 6, gy - 11, 3, 3);
    roof(p, 0, gy - 22, 16, 5, ['r', 'R', 'o']);
    return p.outline();
  }
  if (id === 'garden') {
    const p = new Px(16, 13), gy = 11;
    box(p, 1, gy - 6, 14, 5, 2, ['f', 'g', 'h'], { top: 'f' });
    for (let y = gy - 5; y < gy - 1; y++) for (let x = 2; x < 14; x++) p.set(x, y, hash(x, y, 3) < 0.3 ? 'g' : 'f');
    const fl = [[3, 'H', 'w'], [5, 'R', 'z'], [7, 'z', 'x'], [9, 'L', 'w'], [11, 'H', 'z'], [13, 'R', 'w']];
    fl.forEach(([x, c, cc], i) => { const y = gy - 6 - (i % 2) * 2; p.set(x, y + 2, 'b'); p.set(x, y + 1, 'c'); p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y - 1, c); p.set(x, y, cc); p.set(x + 1, y + 2, 'd'); });
    return p.outline();
  }
  if (id === 'lamp') {
    const p = new Px(16, 26), gy = 24;
    box(p, 5, gy - 3, 6, 1, 3, ['s', 't', 'u'], { top: 'v' });
    p.rect(7, gy - 17, 2, 14, 's'); p.rect(7, gy - 17, 1, 14, 't'); p.rect(6, gy - 10, 4, 1, 't');
    p.rect(4, gy - 18, 8, 1, 's'); p.set(4, gy - 19, 's'); p.set(11, gy - 19, 's');
    p.rect(5, gy - 23, 6, 5, 'x'); p.rect(6, gy - 22, 4, 3, 'y'); p.set(6, gy - 22, 'z'); p.set(7, gy - 21, 'z'); p.rect(8, gy - 22, 1, 3, 'x');
    p.rect(4, gy - 24, 8, 1, 's'); p.rect(6, gy - 25, 4, 1, 't'); p.set(4, gy - 24, 't');
    return p.outline();
  }
  if (id === 'coop') {
    const p = new Px(16, 22), gy = 20;
    for (const x of [3, 11]) p.rect(x, gy - 4, 1, 5, 'g');
    box(p, 2, gy - 12, 12, 1, 8, ['f', 'g', 'h']); for (let x = 4; x < 13; x += 3) p.rect(x, gy - 11, 1, 7, 'f');
    p.rect(6, gy - 9, 3, 3, 'n'); p.set(7, gy - 8, 'y');
    p.line(9, gy - 5, 13, gy, 'h'); p.line(10, gy - 5, 14, gy, 'g');
    roof(p, 1, gy - 17, 14, 5, ['r', 'R', 'o']);
    // hen
    const hen = Px.grid(['.R..', 'wwy.', 'www.', 'wwv.']); p.stamp(hen, 1, gy - 3); p.set(2, gy - 2, 'n');
    dots(p, [[6, gy], [8, gy - 1]], 'i');
    return p.outline();
  }
  // notice board
  const p = new Px(16, 22), gy = 20;
  for (const x of [2, 12]) { p.rect(x, gy - 15, 2, 16, 'g'); p.rect(x, gy - 15, 1, 16, 'h'); }
  p.rect(1, gy - 13, 14, 9, 'f'); p.rect(2, gy - 12, 12, 7, 'g'); for (let x = 2; x < 14; x += 3) p.rect(x, gy - 12, 1, 7, 'f');
  p.rect(3, gy - 11, 4, 5, 'w'); p.rect(3, gy - 10, 3, 1, 'u'); p.rect(3, gy - 8, 3, 1, 'u'); p.set(5, gy - 11, 'R');
  p.rect(8, gy - 12, 4, 3, 'i'); p.rect(8, gy - 11, 3, 1, 'g'); p.set(10, gy - 12, 'C');
  p.rect(9, gy - 8, 4, 3, 'w'); p.set(10, gy - 7, 'R'); p.set(11, gy - 7, 'R'); p.set(9, gy - 8, 'y');
  roof(p, 0, gy - 17, 16, 3, ['f', 'g', 'h']);
  return p.outline();
}

// ════ Walls: ember wall + 3 skins over the v1 shapes ════
const p16 = (x) => ((x % 16) + 16) % 16;
const EMBER = {
  ...STONE,
  top(x, g, part) {
    if (part === 'post') {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(g - 7.5));
      if (d < 1) return (x + g) % 2 ? 'z' : 'y'; if (d < 2) return (x + g) % 2 ? 'y' : 'x'; if (d < 3) return 'n';
      return (x === 4 || g === 4) ? 'u' : 't';
    }
    if (th(x, g, 31) < 0.07) return 'x';
    return ((x * 5 + g * 9) % 13 === 0) ? 't' : 's';
  },
  front(x, r, h) {
    if (r === 0) return 'n';
    if (r === h - 1) return 't';
    if (r === h - 2) return th(x, 0, 33) < 0.5 ? 'u' : 't'; // iron band
    const course = Math.floor((r - 1) / 3), off = course % 2 ? 4 : 0;
    const seam = (r - 1) % 3 === 2 || ((x + off) % 8) === 0;
    if (seam) return th(x, r, 32) < 0.4 ? 'x' : 'n';
    if (th(x, r, 34) < 0.06) return 'r';
    return th(x, r, 35) < 0.12 ? 't' : 's';
  },
};
function emberDecorate(S, M, mask) {
  const po = M.post, top = po.g[0] - po.h;
  for (const x of [po.x[0], po.x[1]]) { S(x, top - 1, 'u'); S(x, top - 2, 'v'); } // iron horns on the grate corners
  for (let r = 0; r < 3; r++) { S(7, po.g[1] - 4 - r, r === 1 ? 'z' : 'y'); S(8, po.g[1] - 4 - r, 'x'); } // glowing slit
  if (mask & 10) for (const x of [1, 14]) if ((x < 8 && mask & 8) || (x > 8 && mask & 2)) S(x, M.ewG[0] - M.h - 1, 'u');
}
function emberAfter(out) { out.set(7, 0, 'y'); out.set(9, 1, 'x'); }

const mossAt = (x, g) => th(p16(x) >> 1, p16(g) >> 1, 11);
function skinMat(base, skin, mat) {
  const stone = mat === 'stone';
  return {
    ...base,
    top(x, g, part) {
      const c = base.top(x, g, part);
      if (skin === 'moss') { const m = mossAt(x, g); if (m < (part === 'post' ? 0.45 : 0.35)) return th(x, g, 12) < 0.3 ? 'd' : (c === 'f' ? 'b' : 'c'); return c; }
      if (skin === 'frost') { if (!stone && c === 'f' && th(x, g, 21) < 0.5) return 'u'; return th(x, g, 22) < 0.16 ? 'E' : 'w'; }
      // gilded
      if (stone) return c === 'v' ? 'w' : c === 't' ? 'u' : (th(x, g, 23) < 0.12 ? 'v' : 'w');
      return { f: 'r', g: 'y', h: 'R', i: 'o' }[c] ?? c;
    },
    front(x, r, h, part) {
      const c = base.front(x, r, h, part);
      if (skin === 'moss') {
        const drip = th(x, 0, 13), len = drip < 0.5 ? 1 + Math.floor(drip * 6) : 0;
        if (r === h - 1 && mossAt(x, 0) < 0.6) return 'c';
        if (len && r >= h - 1 - len) return r === h - 1 - len ? 'a' : 'b';
        if (r === 0) return th(x, 1, 14) < 0.55 ? 'b' : c;
        if (r === 1 && th(x, 2, 15) < 0.3) return 'c';
        return c;
      }
      if (skin === 'frost') {
        if (r === h - 1) return 'w';
        const ic = th(x, 1, 21), len = ic < 0.15 ? 3 : ic < 0.4 ? 2 : ic < 0.55 ? 1 : 0;
        if (len && r >= h - 1 - len) return r === h - 2 ? 'E' : 'D';
        if (r === 0) return th(x, 2, 24) < 0.65 ? 'w' : 'E';
        if (r === 1 && th(x, 3, 25) < 0.3) return 'w';
        if (c === 'u' || c === 'h') return 'E';
        if (!stone && c === 'g' && th(x, r, 26) < 0.12) return 'E';
        return c;
      }
      // gilded
      if (stone) {
        if (r === h - 1) return 'y';
        if (r === 0) return 'x';
        if (r === h - 2) return 'z';
        return { s: 'u', t: 'v', u: 'w' }[c] ?? c;
      }
      if (part === 'post' && (r === 3 || r === 4)) return r === 4 ? 'z' : 'x';
      if (part !== 'post' && (r === 3 || r === 6)) return r === 6 ? 'y' : 'x';
      return { f: 'r', g: 'R', h: 'o', s: 'x', t: 'y' }[c] ?? c;
    },
  };
}
function skinDecorate(skin, mat) {
  const v1 = decorateV1(mat);
  return (S, M, mask, G) => {
    const po = M.post, top = po.g[0] - po.h;
    if (mat === 'stone') {
      const merl = skin === 'gilded' ? ['z', 'y', 'x'] : skin === 'frost' ? ['w', 'E', 'D'] : ['v', 't', 's'];
      for (const x of [po.x[0], po.x[1] - 2]) for (let i = 0; i < 3; i++) { S(x + i, top - 2, merl[0]); S(x + i, top - 1, i === 2 ? merl[2] : merl[1]); }
      for (const [has, x] of [[mask & 8, 0], [mask & 2, 13]]) if (has) for (let i = 0; i < 3; i++) { S(x + i, M.ewG[0] - M.h - 2, skin === 'gilded' ? 'y' : skin === 'frost' ? 'w' : 'u'); S(x + i, M.ewG[0] - M.h - 1, i === 2 ? merl[2] : merl[1]); }
      if (skin === 'gilded') { // sun boss instead of the arrow slit
        const y = po.g[1] - 6; S(7, y, 'y'); S(8, y, 'y'); S(7, y + 1, 'z'); S(8, y + 1, 'x'); S(6, y + 1, 'y'); S(9, y + 1, 'x'); S(7, y + 2, 'x'); S(8, y + 2, 'x'); S(7, y - 1, 'z');
      } else { S(7, po.g[1] - 6, 'n'); S(7, po.g[1] - 5, 'n'); S(8, po.g[1] - 6, 'n'); S(8, po.g[1] - 5, 'n'); }
      if (skin === 'moss') { // ivy up the post + a red-capped mushroom
        for (let r = 0; r < 7; r++) S(5 + (r % 3 === 1 ? 1 : 0), po.g[1] - r, r % 2 ? 'b' : 'c');
        S(6, po.g[1] - 7, 'd'); S(10, po.g[1] - 1, 'R'); S(11, po.g[1] - 1, 'R'); S(10, po.g[1], 'w'); S(10, po.g[1] - 2, 'o');
      }
      if (skin === 'frost') { S(6, top - 3, 'w'); S(7, top - 3, 'w'); S(8, top - 3, 'E'); S(9, top - 3, 'w'); S(5, top - 2, 'w'); S(10, top - 2, 'E'); S(9, po.g[1] - 3, 'E'); }
    } else {
      const cx = 7;
      const tip = skin === 'gilded' ? ['y', 'x', 'z'] : skin === 'frost' ? ['w', 'E', 'w'] : ['h', 'g', 'i'];
      S(cx, top - 1, tip[0]); S(cx + 1, top - 1, tip[1]); S(cx, top - 2, tip[2]);
      const tipRow = M.ewG[0] - M.h - 1;
      for (let x = -3; x < 19; x++) if (x % 4 === 2 && ((x < po.x[0] && mask & 8) || (x > po.x[1] && mask & 2))) S(x, tipRow, skin === 'gilded' ? 'y' : skin === 'frost' ? 'w' : 'h');
      S(5, po.g[1] - 9, skin === 'gilded' ? 'z' : 'i'); S(10, po.g[1] - 9, skin === 'gilded' ? 'x' : 'g');
      if (skin === 'moss') { for (let r = 1; r < 8; r++) S(9 - (r % 3 === 0 ? 1 : 0), po.g[1] - r, r % 2 ? 'b' : 'c'); S(6, po.g[1], 'R'); S(7, po.g[1], 'R'); S(6, po.g[1] - 1, 'o'); S(8, po.g[1] - 8, 'd'); }
      if (skin === 'frost') { S(6, top - 1, 'w'); S(8, top - 1, 'w'); S(7, top - 3, 'w'); for (let r = 7; r < 10; r++) S(10, po.g[1] - r, 'E'); }
      if (skin === 'gilded') { S(7, po.g[1] - 6, 'z'); S(8, po.g[1] - 6, 'y'); S(7, po.g[1] - 5, 'y'); S(8, po.g[1] - 5, 'x'); }
    }
    void v1; void G;
  };
}
export function v1Wall(mat, mask) { return wallTile(mat === 'stone' ? STONE : WOOD, mask, decorateV1(mat)); }

// ════ Banners (8 heraldic designs × 2 waving frames) ════
const BANNERS = [
  { ramp: ['r', 'R', 'o'], trim: 'y', em: ['..y..', '.yzy.', 'yyzyy', '.yyy.'], ec: null },             // 0 ember flame
  { ramp: ['B', 'C', 'D'], trim: 'w', em: ['w.w.w', '.wEw.', 'wEwEw', '.wEw.', 'w.w.w'], ec: null },     // 1 frost star
  { ramp: ['a', 'b', 'c'], trim: 'y', em: ['..e..', '.ede.', 'edcde', '..g..', '..g..'], ec: null },    // 2 grove tree
  { ramp: ['x', 'y', 'z'], trim: 'r', em: ['r.R.r', '.RRR.', 'RRoRR', '.RRR.', 'r.R.r'], ec: null },    // 3 sun
  { ramp: ['m', 'M', 'L'], trim: 'w', em: ['.ww..', 'ww...', 'ww...', 'ww...', '.ww..'], ec: null },    // 4 night crescent
  { ramp: ['s', 't', 'u'], trim: 'R', em: ['R...R', 'RR.RR', '.RRR.', '..R..'], ec: null },            // 5 iron chevron
  { ramp: ['r', 'H', 'o'], trim: 'w', em: ['.ww..', 'wwww.', 'wwRw.', '.www.', '..c..'], ec: null },    // 6 rose
  { ramp: ['n', 'B', 'C'], trim: 'y', em: ['y.y.y', 'yyyyy', 'yzyzy', 'yyyyy'], ec: null },            // 7 royal crown
];
function bannerFlag(i, f) {
  const B = BANNERS[i], p = new Px(12, 16), [lo, mid, hi] = B.ramp;
  p.rect(1, 1, 1, 15, 'f'); p.set(1, 0, 'y');
  const w = 9, h = 8;
  const wave = (x) => Math.round(Math.sin((x / w) * Math.PI * 1.5 + f * Math.PI) * (x / w) * 1.4);
  for (let x = 0; x < w; x++) {
    const dy = wave(x), tail = x >= w - 2 ? (x === w - 1 ? 2 : 1) : 0;
    for (let y = 0; y < h; y++) {
      if (tail && y >= (h >> 1) - tail + 1 && y <= (h >> 1) + tail - 2) continue; // swallow-tail notch
      let c = y === 0 ? hi : y === h - 1 ? lo : mid;
      if (x === 0 || y === 0) c = B.trim;
      const shade = Math.sin((x / w) * Math.PI * 1.5 + f * Math.PI + 0.9);
      if (c === mid && shade < -0.6) c = lo; else if (c === mid && shade > 0.75) c = hi;
      p.set(2 + x, 2 + y + dy, c);
    }
  }
  const em = B.em, ex = 4, ey = 3;
  em.forEach((row, j) => [...row].forEach((c, k) => { if (c === '.') return; const x = ex + k; const dy = wave(x - 2); p.set(x, ey + j + dy + (em.length < 5 ? 1 : 0), c); }));
  return p.outline();
}

// ════ Module plates (sit on a tower top) ════
const MODULE_ICON = {
  split: ['v...v', '.v.v.', '..h..', '..h..', '..g..'],
  barb: ['..u..', '.vu..', '..uR.', 'u.u..', '.uR..'],
  frostoil: ['..E..', '.EDD.', '.DDC.', 'EDCCB', '.DCB.'],
  scope: ['.yyy.', 'yDEDy', 'yDDCy', 'yCDBy', '.yyy.'],
  winch: ['.y.y.', 'yyxyy', '.xnx.', 'yyxyy', '.y.y.'],
  coalcore: ['.xyx.', 'xyzyx', 'yzwzy', 'xyzyx', '.nxn.'],
  hawkeye: ['.....', '.www.', 'wyny.', '.www.', '.....'],
  bulwark: ['CCCCC', 'CDyCB', 'CyyyB', '.CyB.', '..B..'],
};
function modulePlate(id) {
  const p = new Px(11, 12);
  // round-cornered iron plate on a short peg
  for (let y = 1; y <= 7; y++) for (let x = 1; x <= 9; x++) { const corner = (x === 1 || x === 9) && (y === 1 || y === 7); if (!corner) p.set(x, y, 't'); }
  for (let x = 2; x <= 8; x++) p.set(x, 1, 'u'); for (let y = 2; y <= 6; y++) p.set(1, y, 'u'); p.set(2, 2, 'v');
  for (let x = 2; x <= 8; x++) p.set(x, 7, 's'); for (let y = 2; y <= 6; y++) p.set(9, y, 's');
  p.rect(3, 2, 5, 5, 'n');
  p.rect(4, 8, 3, 2, 's'); p.set(4, 8, 't'); p.rect(3, 10, 5, 1, 't'); p.set(7, 10, 's');
  MODULE_ICON[id].forEach((row, j) => [...row].forEach((c, k) => { if (c !== '.') p.set(3 + k, 2 + j, c); }));
  dots(p, [[2, 2], [8, 6]], 'y');
  return p.outline();
}

// ════ Status overlays: frozen ×2, burning ×3 ════
function frozen(lv) {
  const W = 20, H = lv === 1 ? 16 : 30, p = new Px(W, H), gy = H - 2;
  const shards = lv === 1
    ? [[3, 6, 1.4], [6, 9, 1.8], [10, 7, 1.6], [14, 10, 2], [17, 6, 1.4]]
    : [[2, 10, 1.6], [5, 18, 2.2], [9, 26, 2.8], [13, 21, 2.4], [16, 14, 2], [18, 9, 1.4]];
  for (const [x, h, hw] of shards) crystal(p, x + 0.5, gy - h + 1, hw, h, ['C', 'D', 'E']);
  // frozen crust along the ground
  for (let x = 1; x < W - 1; x++) { const h = 2 + Math.round(hash(x, lv, 9) * 2); for (let y = gy - h + 1; y <= gy; y++) if (p.get(x, y) === '.' || y > gy - 2) p.set(x, y, y === gy ? 'C' : y === gy - h + 1 ? 'E' : 'D'); }
  if (lv === 2) for (const [x, y] of [[7, gy - 14], [12, gy - 9], [4, gy - 6]]) { p.set(x, y, 'w'); p.set(x + 1, y + 1, 'E'); }
  const o = p.outline();
  if (lv === 2) dots(o, [[1, 3], [18, 5], [10, 1]], 'E'); else dots(o, [[2, 3], [16, 2]], 'E');
  return o;
}
function burning(f) {
  const p = new Px(20, 22), gy = 20;
  // charred beams
  p.rect(2, gy - 1, 16, 2, 'n'); p.rect(3, gy - 1, 4, 1, 'f'); p.rect(12, gy - 1, 5, 1, 'f'); p.set(8, gy, 'r'); p.set(13, gy, 'x');
  [[5, 3, 9], [11, 3.6, 13], [16, 2.4, 7]].forEach(([x, hw, h], i) => flame(p, x, gy - 1, hw, h + ((f + i) % 3) - 1, f + i * 2, { tongues: i === 1 ? 2 : 1 }));
  p.outline();
  const smoke = [[11, 4], [12, 2], [10, 1], [13, 0]];
  smoke.forEach(([x, y], i) => { const yy = y + ((f + i) % 3) - 1; if (yy >= 0 && p.get(x + (f % 2), yy) === '.') p.set(x + (f % 2), yy, i % 2 ? 't' : 'u'); });
  if (p.get(3, 4 + f) === '.') p.set(3, 4 + f, 'y');
  return p;
}

// ════ build ════
export default function build() {
  const out = [];
  const add = (name, px, kind = 'building', extra = {}) => out.push({ name, px, kind, ...extra });
  const addFrames = (name, list, kind = 'building', extra = {}) => list.forEach((px, i) => add(`${name}_${i}`, px, kind, extra));
  for (let t = 4; t <= 10; t++) addFrames(`bld_hearth_t${t}`, hearthTier(t));
  for (const b of Object.keys(BEACON)) addFrames(`bld_beacon_${b}`, [0, 1, 2].map((f) => beacon(b, f)), 'fx', { ax: 7, ay: 21 });
  const village = { house, storehouse, farm, vault, scout_lodge: scoutLodge, forge, study, market, dock };
  for (const [id, fn] of Object.entries(village)) for (const lv of [1, 2, 3]) add(`bld_${id}_l${lv}`, fn(lv));
  add('bld_dawn_shrine_l1', dawnShrine()); add('bld_watchtower_l1', watchtower(1)); add('bld_watchtower_l2', watchtower(2));
  for (let m = 0; m < 16; m++) add(`bld_wall_ember_${m}`, wallTile(EMBER, m, emberDecorate, emberAfter), 'wall');
  addFrames('bld_brazier_l3', brazierL3());
  for (const d of ['statue', 'well', 'garden', 'lamp', 'coop', 'board']) add(`bld_decor_${d}`, decor(d), 'prop');
  for (const sk of ['moss', 'frost', 'gilded']) for (const w of ['wood', 'stone']) {
    const M = skinMat(w === 'stone' ? STONE : WOOD, sk, w);
    for (let m = 0; m < 16; m++) add(`skin_${sk}_${w}_${m}`, wallTile(M, m, skinDecorate(sk, w)), 'wall');
  }
  for (let i = 0; i < 8; i++) addFrames(`banner_${i}`, [0, 1].map((f) => bannerFlag(i, f)), 'fx', { ax: 1, ay: 15 });
  for (const m of Object.keys(MODULE_ICON)) add(`bld_module_${m}`, modulePlate(m), 'fx', { ax: 5, ay: 11 });
  for (const lv of [1, 2]) { const px = frozen(lv); add(`bld_frozen_${lv}`, px, 'fx', { ax: px.w / 2, ay: px.h }); }
  addFrames('bld_burning', [0, 1, 2].map(burning), 'fx');
  for (const fl of Object.keys(COSMETIC)) addFrames(`hearth_flame_${fl}`, [0, 1, 2, 3].map((f) => cosmeticFlame(fl, f)), 'fx', { ax: 12, ay: 37 });
  return out;
}

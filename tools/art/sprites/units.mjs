// Heroes, enemies (the Gloom), militia, bosses, mini turret. Owner: art-units.
// Technique (A): hand-typed grids WITHOUT the outer outline; every frame is DERIVED from the base grid
// (crop/shift/stamp of body bands, weapon layers re-posed per frame), then fin() adds the 1px `k` outline.
import { Px, RAMPS } from '../pixel.mjs';
import { G, put, fin, rotCW, seat, shiftRows, squash, stretch, dots, flipY, recolor, bbox } from './_units_helpers.mjs';

// ════════════════════════════════════════════════════════════════════════════════
// HEROES — 18×18 canvas, content rows 2..16 (row 0/1 free so the walk bob never clips the outline).
// `up` = rows 0..14 (head + torso, no legs, no weapon hand). Legs are generated per frame.
// ════════════════════════════════════════════════════════════════════════════════
const W = 18, H = 18;

// weapons (hand pixel `q` included so the hand travels with the weapon)
const SWORD_V = G(['.w.', '.v.', '.v.', '.v.', '.u.', 'yzy', '.q.', '.g.']);
const SWORD_UR = G(['....vw', '...vu.', '..vu..', '.zu...', 'qy....', 'g.....']);
const SWORD_H = G(['..y....', 'gqzvvvw', '..y....']);
const BOW = G(['h..', '.h.', 'th.', 't.h', 't.g', 'tqg', 't.g', 't.h', 'tg.', '.g.', 'g..']);
const BOW_DRAW = G(['...h..', '..t.h.', '.t...g', 'qhhhhu', '.t...g', '..t.g.', '...g..']);
const STAFF_FIRE = G(['.y.', 'yzy', 'xzx', '.x.', '.h.', '.g.', '.q.', '.g.', '.g.', '.f.']);
const STAFF_FIRE_BIG = G(['..y..', '.yzy.', 'yzzzx', 'xyzyx', '.xhx.', '..g..', '..q..', '..g..', '..g..', '..f..']);
const STAFF_FIRE_TILT = G(['....y.', '..yzzy', '..xzzx', '..hxx.', '..g...', '.g....', 'q.....', 'g.....']);
const WRENCH = G(['u.u', 'utu', '.u.', '.t.', '.q.', '.g.']);
const WRENCH_H = G(['......u', 'gqttuu.', '......u']);
const STAFF_HALO = G(['.yzy.', 'y...z', 'y...y', '.yhy.', '..h..', '..i..', '..h..', '..i..', '..h..', '..q..', '..g..']);
const STAFF_HALO_LIT = G(['.zwz.', 'z...w', 'z...z', '.zhz.', '..h..', '..i..', '..h..', '..i..', '..h..', '..q..', '..g..']);
const DAGGER = G(['q', 'y', 'v', 'w']);
const DAGGER_UP = G(['w', 'v', 'y', 'q']);
const DAGGER_H = G(['qyvw']);

const HEROES = {
  knight: {
    up: [
      '..................',
      '..................',
      '.......oRRr.......',
      '......oRRRRr......',
      '.....vvuRRuuu.....',
      '....vvuuuuuuut....',
      '....vuuuuuuuut....',
      '....usssssssss....',
      '....tqqqqkqkqs....',
      '....tqqqqkqkps....',
      '.vvvutpqqqqpps....',
      '.vDCCtuRoRRrt.....',
      '.vCyCtuRRRRrt.....',
      '.uCCBtsRRRrrs.....',
      '..uBttsysssss.....',
    ],
    legs: { type: 'pants', lx: 7, rx: 10, P: 'ts', F: 'ff' },
    eyes: [[9, 8], [11, 8]],
    w: {
      idle: { g: SWORD_V, h: [1, 6], at: [13, 12] },
      a0: { g: SWORD_V, h: [1, 6], at: [12, 9], dy: 1 },
      a1: { g: SWORD_H, h: [1, 1], at: [10, 12], dx: 1 },
      a2: { g: flipY(SWORD_UR), h: [0, 1], at: [11, 12] },
    },
  },
  ranger: {
    up: [
      '..................',
      '..................',
      '..oR...cccc.......',
      '..Ro.cdddcccb.....',
      '..fgcddccccccb....',
      '..fccdcccccccb....',
      '..fbcggggggggb....',
      '..fbcghqqqqqqb....',
      '..fbcgqqqkqkqb....',
      '..fbbcqqqkqkpb....',
      '..fbbcpqqqqppb....',
      '...bbbcghhhgb.....',
      '...abbghfhhgb.....',
      '...aabghhfhgg.....',
      '....aafggygf......',
    ],
    legs: { type: 'pants', lx: 7, rx: 10, P: 'gf', F: 'ff' },
    eyes: [[9, 8], [11, 8]],
    w: {
      idle: { g: BOW, h: [1, 5], at: [13, 10] },
      a0: { g: BOW_DRAW, h: [0, 3], at: [11, 11], dx: -1 },
      a1: { g: BOW, h: [1, 5], at: [14, 10], dx: 1 },
      a2: { g: BOW, h: [1, 5], at: [14, 11] },
    },
  },
  pyro: {
    up: [
      '..................',
      '..................',
      '....rR............',
      '....rRRo..........',
      '.....rRRo.........',
      '....rRRRRo........',
      '....ryyyyyz.......',
      '..rrRRRRRRRRo.....',
      '...fqqqqkqkqf.....',
      '...fqqqqkqkpf.....',
      '...ffpqqqqppf.....',
      '...yxRyxxxxx......',
      '..yxxRyxxxxr......',
      '..yxxRyxxxrr......',
      '..xxxrrxxxrrr.....',
    ],
    legs: { type: 'robe', x0: 3, x1: 12, hem: 'xr', lx: 5, rx: 9, F: 'ff' },
    eyes: [[8, 8], [10, 8]],
    w: {
      idle: { g: STAFF_FIRE, h: [1, 6], at: [12, 12] },
      a0: { g: STAFF_FIRE_BIG, h: [2, 6], at: [11, 9], dx: -1 },
      a1: { g: STAFF_FIRE_TILT, h: [0, 6], at: [10, 12], dx: 1 },
      a2: { g: STAFF_FIRE, h: [1, 6], at: [13, 13] },
    },
  },
  tinker: {
    up: [
      '..................',
      '..................',
      '......hhhhh.......',
      '.....hiiihhg......',
      '....hhhhhhhhg.....',
      '.u.gtDEttDEtg.....',
      '.t.gtCDttCDtg.....',
      '.tusfqqqqqqqg.....',
      '.uysgqqqkqkqg.....',
      '.ttssqqqkqkpg.....',
      '.ttsgpqqqqppg.....',
      '.ttsghhiihhg......',
      '..ssghgtgghg......',
      '...sghgtghhf......',
      '....fffyfff.......',
    ],
    legs: { type: 'pants', lx: 6, rx: 9, P: 'gf', F: 'ff' },
    eyes: [[8, 8], [10, 8]],
    w: {
      idle: { g: WRENCH, h: [1, 4], at: [12, 12] },
      a0: { g: WRENCH, h: [1, 4], at: [11, 7], dy: 1 },
      a1: { g: WRENCH_H, h: [1, 1], at: [10, 12], dx: 1 },
      a2: { g: flipY(WRENCH), h: [1, 1], at: [12, 12] },
    },
  },
  cleric: {
    up: [
      '..................',
      '..................',
      '......wwww........',
      '....wwwwwwv.......',
      '...wwwwwwwwv......',
      '..wwyyyyyyzwv.....',
      '..wvzqqqqqqzv.....',
      '..wvzqqqkqkzv.....',
      '..wvqqqqkqkpv.....',
      '..vvzpqqqqppu.....',
      '..vuwzyyyyzwu.....',
      '..wwvwwwwwvu......',
      '.wwwvwwwwwvu......',
      '.wvwvwwwwvuu......',
      '.vvuuyyyyyuu......',
    ],
    legs: { type: 'robe', x0: 2, x1: 11, hem: 'vu', lx: 4, rx: 8, F: 'gg' },
    eyes: [[8, 7], [10, 7]],
    w: {
      idle: { g: STAFF_HALO, h: [2, 9], at: [13, 12] },
      a0: { g: STAFF_HALO_LIT, h: [2, 9], at: [13, 10], dy: 1 },
      a1: { g: STAFF_HALO_LIT, h: [2, 9], at: [13, 12], dx: 1 },
      a2: { g: STAFF_HALO, h: [2, 9], at: [13, 13] },
    },
  },
  rogue: {
    up: [
      '..................',
      '..................',
      '......mmm.........',
      '.....mMMMm........',
      '....mMLMMMMm......',
      '...mMLMMMMMMm.....',
      '..mMMnnnnnnMm.....',
      '..mMMnqqqqqqMn....',
      '..mMMnqqkqkqMn....',
      '.RmmMRRRRRRRRn....',
      '.rRmMrRRRRRrMn....',
      '..rmnnmmmmmmn.....',
      '...nmnmMMMmmn.....',
      '....nmmMMmmn......',
      '....nnnyznnn......',
    ],
    legs: { type: 'pants', lx: 6, rx: 9, P: 'mn', F: 'nn' },
    eyes: [[8, 8], [10, 8]],
    w: {
      idle: { g: DAGGER, h: [0, 0], at: [13, 12] },
      back: { g: DAGGER, h: [0, 0], at: [3, 12] },
      a0: { g: DAGGER_UP, h: [0, 3], at: [12, 9], dy: 1 },
      a0b: { g: DAGGER_UP, h: [0, 3], at: [3, 10] },
      a1: { g: DAGGER_H, h: [0, 0], at: [11, 11], dx: 2 },
      a1b: { g: DAGGER_H, h: [0, 0], at: [11, 13], dx: 2 },
      a2: { g: DAGGER, h: [0, 0], at: [13, 12], dx: 1 },
      a2b: { g: DAGGER, h: [0, 0], at: [3, 12], dx: 1 },
    },
  },
};

// legs for one frame: phase {lo, ro: horizontal offsets of left/right foot, ll/rl: lifted, bob: -1|0}
function drawLegs(def, ph) {
  const p = new Px(W, H), L = def.legs, top = 15 + (ph.bob || 0);
  const leg = (x, lifted, [c0, c1], [f0, f1]) => {
    const bot = lifted ? 15 : 16;
    for (let y = top; y <= bot; y++) { const foot = y === bot; p.set(x, y, foot ? f0 : c0).set(x + 1, y, foot ? f1 : c1); }
  };
  if (L.type === 'robe') {
    const s = ph.sway || 0;
    for (let y = top; y <= 15; y++) for (let x = L.x0 + s; x <= L.x1 + s; x++) p.set(x, y, x > L.x1 + s - 3 || y === 15 && x > L.x0 + s + 1 ? L.hem[1] : L.hem[0]);
    if (!ph.ll) p.set(L.lx + (ph.lo || 0), 16, L.F[0]).set(L.lx + 1 + (ph.lo || 0), 16, L.F[1]);
    if (!ph.rl) p.set(L.rx + (ph.ro || 0), 16, L.F[0]).set(L.rx + 1 + (ph.ro || 0), 16, L.F[1]);
  } else {
    leg(L.lx + (ph.lo || 0), ph.ll, L.P, L.F);
    leg(L.rx + (ph.ro || 0), ph.rl, L.P, L.F);
  }
  return p;
}
const upper = (def) => G(def.up.concat(Array(H - def.up.length).fill('.'.repeat(W))));

function weapon(dst, def, key, dx = 0, dy = 0) {
  const w = def.w[key]; if (!w) return dst;
  return put(dst, w.g, w.at[0] - w.h[0] + dx, w.at[1] - w.h[1] + dy, true);
}

function heroFrame(def, { legs = {}, bob = 0, dx = 0, dy = 0, wkey = 'idle', bkey = 'back', breathe = false }) {
  const p = new Px(W, H);
  put(p, drawLegs(def, { ...legs, bob }));
  let up = upper(def);
  if (breathe) up = shiftRows(up, 0, 13, 0, 1);
  if (def.w[bkey]) weapon(p, def, bkey, dx, dy + bob);
  put(p, up.shift(dx, dy + bob));
  weapon(p, def, wkey, dx, dy + bob + (breathe ? 1 : 0));
  return fin(p);
}

const WALK = [
  { legs: { lo: -1, ro: 1, sway: -0 }, bob: 0 },
  { legs: { rl: true, sway: 1 }, bob: -1 },
  { legs: { lo: 1, ro: -1, sway: 0 }, bob: 0 },
  { legs: { ll: true, sway: -1 }, bob: -1 },
];

function heroDown(def) {
  const body = new Px(W, H);
  put(body, drawLegs(def, {}));
  put(body, upper(def));
  for (const [x, y] of def.eyes) body.set(x, y + 1, body.get(x - 1, y + 1)); // eyes shut: keep only top pixel
  const lying = seat(rotCW(body), W, H, 16, 0);
  const w = def.w.idle.g, wr = rotCW(w);
  const p = new Px(W, H);
  put(p, wr, W - wr.w - 2, 16 - wr.h + 1);
  put(p, lying, 0, 0);
  return fin(p);
}

function heroSprites(id) {
  const def = HEROES[id], out = [];
  out.push({ name: `hero_${id}_idle_0`, px: heroFrame(def, {}) });
  out.push({ name: `hero_${id}_idle_1`, px: heroFrame(def, { breathe: true }) });
  WALK.forEach((f, i) => out.push({ name: `hero_${id}_walk_${i}`, px: heroFrame(def, f) }));
  const st = { lo: -1, ro: 1 };
  const a = def.w;
  out.push({ name: `hero_${id}_attack_0`, px: heroFrame(def, { legs: st, dx: a.a0.dx || 0, dy: a.a0.dy || 0, wkey: 'a0', bkey: 'a0b' }) });
  out.push({ name: `hero_${id}_attack_1`, px: heroFrame(def, { legs: { lo: -1, ro: 2 }, dx: a.a1.dx || 0, dy: a.a1.dy || 0, wkey: 'a1', bkey: 'a1b' }) });
  out.push({ name: `hero_${id}_attack_2`, px: heroFrame(def, { legs: st, dx: a.a2.dx || 0, dy: a.a2.dy || 0, wkey: 'a2', bkey: 'a2b' }) });
  out.push({ name: `hero_${id}_down`, px: heroDown(def) });
  return out.map((e) => ({ ...e, kind: 'unit' }));
}

export const HERO_IDS = ['knight', 'ranger', 'pyro', 'tinker', 'cleric', 'rogue'];

export default function build() {
  const out = [];
  for (const h of HERO_IDS) out.push(...heroSprites(h));
  return out;
}

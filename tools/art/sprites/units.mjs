// Heroes, enemies (the Gloom), militia, bosses, mini turret. Owner: art-units.
// Technique (A): hand-typed grids WITHOUT the outer outline; every frame is DERIVED from the base grid
// (crop/shift/stamp of body bands, weapon layers re-posed per frame), then fin() adds the 1px `k` outline.
import { Px, RAMPS } from '../pixel.mjs';
import { G, put, fin, rotCW, seat, shiftRows, squash, stretch, dots, flipY, recolor, bbox, pad, delCol, delRow } from './_units_helpers.mjs';

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
      idle: { g: DAGGER, h: [0, 0], at: [13, 11] },
      back: { g: DAGGER, h: [0, 0], at: [2, 11] },
      a0: { g: DAGGER_UP, h: [0, 3], at: [12, 9], dy: 1 },
      a0b: { g: DAGGER_UP, h: [0, 3], at: [3, 10] },
      a1: { g: DAGGER_H, h: [0, 0], at: [11, 11], dx: 2 },
      a1b: { g: DAGGER_H, h: [0, 0], at: [11, 13], dx: 2 },
      a2: { g: DAGGER, h: [0, 0], at: [14, 12] },
      a2b: { g: DAGGER, h: [0, 0], at: [2, 12] },
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

// ── Portraits 24×24 bust: shared face/shoulder construction + per-hero hand-typed headgear overlay ──
const PORTRAITS = {
  knight: { back: 's', cloth: RAMPS.steel, over: [
    '........................',
    '..........oRRr..........',
    '.........oRRRRr.........',
    '......vvvvoRRRuuu.......',
    '.....vvuuuuoRruuuut.....',
    '....vvuuuuuuuuuuuuut....',
    '....vuuuuuuuuuuuuuut....',
    '....vuuuuuuuuuuuuuuut...',
    '....ussssssssssssssst...',
    '....tu..............t...',
    '....tu..............t...',
    '....tu..............t...',
    '....tt.............tt...',
    '.....t.............t....',
    '.....t.............t....',
    '........................',
    '........................',
    '........................',
    '........................',
    '...vvuu....RRRR...uut...',
    '..vuuuuu..RRoRRr.uuuut..',
    '..uuuuuu..RRRRRr.uuuut..',
    '..tttttt..RRRRrr.ttttt..',
  ] },
  ranger: { back: 'a', cloth: RAMPS.wood, over: [
    '........................',
    '.........cccccc.........',
    '.......ccddddcccb.......',
    '.....ccddcccccccbb......',
    '....cddccccccccccbb.....',
    '...cdcccccccccccccbb....',
    '...cdccccccccccccccb....',
    '..cdccggggggggggggccb...',
    '..ccgghgggggggggggggb...',
    '..ccgg..............gb..',
    '..bcg................b..',
    '..bcc................b..',
    '..bcc................b..',
    '..bbc...............bb..',
    '...bb...............b...',
    '...bb...............b...',
    '...ab..............bb...',
    '...abb............bb....',
    '..cabbcc........ccbb....',
    '.ccccbbcc......ccbbbb...',
    '.cdcccbbcc....cccbbbb...',
    '.ccccccbbhhhhhcccbbbbb..',
    '.bbbbbbbbgggggbbbbbbbb..',
  ] },
  pyro: { back: 'f', cloth: RAMPS.fire, over: [
    '........................',
    '......rR................',
    '......rRR...............',
    '.......rRRo.............',
    '.......rRRRo............',
    '......rRRRRRo...........',
    '......rRRRRRRo..........',
    '.....rRRRRRRRRo.........',
    '.....ryyyyyyyyyz........',
    '..rrrRRRRRRRRRRRRRRo....',
    '.rrRRRRRRRRRRRRRRRRRRo..',
    '..rrrrrrrrrrrrrrrrrrr...',
    '....ff..............f...',
    '....ff..............f...',
    '....ff..............f...',
    '....f..............ff...',
    '........................',
    '........................',
    '........................',
    '...yyyx..........xxxr...',
    '..yyxxxxRRRRRRRRxxxxrr..',
    '..yxxxxxRRRRRRRRxxxxrr..',
    '..xxxxxrrrrrrrrrrxxrrr..',
  ] },
  tinker: { back: 'g', cloth: RAMPS.wood, over: [
    '........................',
    '........................',
    '........hhhhhhhh........',
    '......hhiiiihhhhhg......',
    '.....hiiihhhhhhhhhg.....',
    '....hhhhhhhhhhhhhhhg....',
    '....ghhhhhhhhhhhhhhg....',
    '...gttttttttttttttttg...',
    '...gtDDEtttttttDDEttg...',
    '...gtDEEttgggttDEEttg...',
    '...ftCDDtt...ttCDDtgf...',
    '...ffttttt...ttttttff...',
    '...ff................f..',
    '...ff................f..',
    '....f...............ff..',
    '....f...............f...',
    '........................',
    '........................',
    '........................',
    '...hhhg...........ghgg..',
    '..hhhgggtt.......tggggg.',
    '..hggggggtu.ytt.utgggff.',
    '..gggggggftttttttfgffff.',
  ] },
  cleric: { back: 'z', cloth: ['u', 'v', 'w'], over: [
    '........................',
    '.........wwwwww.........',
    '.......wwwwwwwwwv.......',
    '.....wwwwwwwwwwwwvv.....',
    '....wwwwwwwwwwwwwwvv....',
    '...wwwwwwwwwwwwwwwwvv...',
    '...wwwwwwwwwwwwwwwwwv...',
    '..wwwyyyyyyzyyyyyyywwv..',
    '..wwwwzzzzzzzzzzzzzwvv..',
    '..wwz...............vu..',
    '..wvz...............zu..',
    '..wvz...............zu..',
    '..wvzz..............zu..',
    '..vvz...............zu..',
    '..vvz...............vu..',
    '..vvu..............vuu..',
    '...vu..............vu...',
    '...vuu............vuu...',
    '..wwvuu..........uuvvw..',
    '.wwwwvvu.yyyyyy.uvvwwww.',
    '.wwwwwvvuyyzzyyuvvwwwvv.',
    '.wwwwwwvvuyyyyuvvwwwvvu.',
    '.vvvvvvvvvuyyuvvvvvvuuu.',
  ] },
  rogue: { back: 'n', cloth: ['n', 'm', 'M'], over: [
    '........................',
    '...........mmmm.........',
    '.........mmMMMMm........',
    '........mMMMMMMMm.......',
    '......mmMLLMMMMMMm......',
    '.....mMMLMMMMMMMMMm.....',
    '....mMMLMMMMMMMMMMMm....',
    '...mMMLMMMMMMMMMMMMMm...',
    '...mMMMMnnnnnnnnnnMMm...',
    '..mMMMnn..........nMMm..',
    '..mMMn.............nMm..',
    '..mMMn..............Mm..',
    '..mMMn..............Mm..',
    '..mMMn..............Mm..',
    '..mMMRRoRRRRRRRRRRRRrm..',
    '..mmMRRRRRRRRRRRRRRrrm..',
    '...mmRRRRRRRRRRRRRrrm...',
    '..RRmmrrrrrrrrrrrrrmm...',
    '.RRrnmmmmmmmmmmmmmmn....',
    '.Rrnnmmmmmmmmmmmmmmnn...',
    '..nnmmmMMMMMMMMMMmmmnn..',
    '..nmmmMMMMyMMMMMMmmmmn..',
    '..nnnnnnnnnnnnnnnnnnnn..',
  ] },
};
function portrait(id) {
  const P = PORTRAITS[id], p = new Px(24, 24);
  const sh = new Px(24, 24).ellipse(11.5, 23, 9.6, 4.8, P.cloth[1]); for (let x = 0; x < 24; x++) sh.d[23][x] = '.';
  put(p, sh.shade(P.cloth));
  p.ellipse(11.5, 11.5, 8.2, 7.6, P.back);
  p.rect(10, 16, 4, 4, 'p');
  const face = new Px(24, 24).ellipse(12, 12.5, 6.4, 6, 'q').shade(RAMPS.skin);
  put(p, face);
  dots(p, [[14, 12, 'k'], [14, 13, 'k'], [17, 12, 'k'], [17, 13, 'k'], [13, 15, 'o'], [18, 15, 'o'], [16, 16, 'p'], [15, 16, 'p']]);
  const ov = G(P.over.concat(Array(24 - P.over.length).fill('.'.repeat(24))));
  put(p, ov);
  return fin(p);
}

// ════════════════════════════════════════════════════════════════════════════════
// ENEMIES — the Gloom: purple ramp m M L, glowing yellow eyes z. Grids are typed at final canvas size
// (1px margin kept free for the outline). Frames derived with squash/stretch/shift + small hand edits.
// ════════════════════════════════════════════════════════════════════════════════
// Gloomling = the style anchor (tools/art/anchors.mjs), outline stripped and re-applied per frame.
const GLOOMLING = G([
  '................',
  '................',
  '................',
  '...L........L...',
  '...MM.MMMM.MM...',
  '..MLLMMMMMMMMm..',
  '..MLMMMMMMMMMm..',
  '.MMMzkMMMMzkMMm.',
  '.MMMzkMMMMzkMMm.',
  '.MMMMMMMMMMMMmm.',
  '.MMMMkwkwkMMMmm.',
  '.mMMMMkkkMMMmmm.',
  '..mmMMMMMMmmmm..',
  '................',
]);
const GLOOMLING_BITE = G([
  '................',
  '................',
  '................',
  '...L........L...',
  '...MM.MMMM.MM...',
  '..MLLMMMMMMMMm..',
  '..MLMMMMMMMMMm..',
  '.MMMzkMMMMzkMMm.',
  '.MMMzkMMMMzkMMm.',
  '.MMMMkwkwkwkMmm.',
  '.MMMMkkkkkkkMmm.',
  '.mMMMkwkwkwkmmm.',
  '..mmMMMMMMmmmm..',
  '................',
]);
const SKITTER = G([
  '..................',
  '..................',
  '...L..L..L........',
  '...ML.ML.ML....L..',
  '..mMMMMMMMMm..L...',
  '.mMLLMMLLMMMmMMm..',
  '.mMLMMMLMMMmMMzMw.',
  '.mMMMMMMMMmMMMMMm.',
  '..mmMMMMMmmMMMw...',
  '...mmmmmmmmmm.....',
  '...M.M..M.M..M....',
  '..M..M.M..M.M.....',
  '..................',
]);
const SKITTER_LEGS_B = G([
  '....M.M..M.M..M...',
  '....M..M..M..M....',
]);
const SPITTER = G([
  '..................',
  '..................',
  '......mmmmm.......',
  '....mMMLLMMMm.....',
  '...mMLLMMMMMMm....',
  '..mMLMMMMLMMMMm...',
  '..mMLMMMMMzkMzkm..',
  '.mMMMMLMMMzkMzkm..',
  '.mMMMMMMMMMMMMMMm.',
  '.mMMLMMMMMLLLLLLm.',
  '.mMMMMMMMLnnnnnnL.',
  '.mMMMMLMMLnwnnwnL.',
  '.mmMMMMMMMLLLLLLm.',
  '..mmMMLMMMMMMMmm..',
  '...mmmmmmmmmmmm...',
  '....mm.....mm.....',
  '..................',
  '..................',
]);
const SPITTER_SPIT = G([
  '..................',
  '..................',
  '......mmmmm.......',
  '....mMMLLMMMm.....',
  '...mMLLMMMMMMm....',
  '..mMLMMMMLMMMMm...',
  '..mMLMMMMMzkMzkm..',
  '.mMMMMLMMMzkMzkm..',
  '.mMMMMMMMMLLLLLLm.',
  '.mMMLMMMMLnnnnnnnL',
  '.mMMMMMMMnnLLMLnnL',
  '.mMMMMLMMnnMLLMnnL',
  '.mMMMMMMMLnnnnnnnL',
  '.mmMMMMMMMLLLLLLm.',
  '..mmMMLMMMMMMMmm..',
  '...mmmmmmmmmmmm...',
  '....mm.....mm.....',
  '..................',
]);
const BRUTE = G([
  '......................',
  '......................',
  '...wi...........iw....',
  '...vwi.........iwv....',
  '....vwi.sttts.iwv.....',
  '.....vsttuuutsv.......',
  '......tuuvvuuut.......',
  '.....mssssssssm.......',
  '....mMMzzMMzzMMm......',
  '..ttmMMMMMMMMMMmtt....',
  '.tuuumMwMMMMwMmuuut...',
  '.tuvutmMwwwwMmtuvut...',
  '.ttuutMMMMMMMMMtuut...',
  '.mMtsMMLMMMMMMMmstMm..',
  '.mMmMMLLMMMMMMMMmMMm..',
  'mMLMmMMMMtttMMMMmMLMm.',
  'mLLMmmMMMtytMMMmmLLMm.',
  'mMMMm.mMMMMMMMm.mMMMm.',
  '.mmm..mMMm.mMMm..mmm..',
  '......mmmm.mmmm.......',
  '......................',
  '......................',
]);
const WISP = G([
  '................',
  '.......L........',
  '......LM....L...',
  '.....LMM...LM...',
  '....LMMML.LMM...',
  '...LMMwLLLMMMm..',
  '...MMwwLLLLMMm..',
  '..LMwLzLLLzLMm..',
  '..MMLLzLLLzLMm..',
  '..MMLLLLLLLLMm..',
  '...MMLLLLLLMMm..',
  '...mMMMMMMMMm...',
  '..mMmMMMMMMm....',
  '.mM..mmMMm......',
  '.m....mm........',
  '................',
]);
const BOMBER = G([
  '................',
  '..........z.....',
  '.........yzy....',
  '..........y.....',
  '.........g......',
  '.....nnngnn.....',
  '...nnmMMmmmnn...',
  '..nmMMMmmmmmmn..',
  '..nmMmmmmmmmmn..',
  '.nmmmmmmzkmzkmn.',
  '.nttttttzkmzkmn.',
  '.nsttssststtssn.',
  '.nmmmmmwkkkwmnn.',
  '..nnmmmmmmmmnn..',
  '...nnnnnnnnnn...',
  '....mm....mm....',
  '................',
]);
const SNUFFER = G([
  '..................',
  '........u.........',
  '.......uut........',
  '.......vts........',
  '......vuuts.......',
  '......uuuts.......',
  '.....vuuuuts......',
  '....vuuuuuuts.....',
  '...ttttttttttss...',
  '....nnnzknnzkn....',
  '....mnnnnnnnnm....',
  '...mMmMMMMMMmMm...',
  '..mMmMMLMMMMmMMm..',
  '..mM.mMLMMMMm.MMm.',
  '..MM.mMMMMMMm..Mm.',
  '..Mm.mmMMMMmm..Mm.',
  '..Mm..mm..mm...Mm.',
  '.LLL..mm..mm..LLL.',
  '..................',
]);
// Move a rectangular block (x,y,w,h) of px by (dx,dy).
function moveBlock(px, x, y, w, h, dx, dy) {
  const b = px.crop(x, y, w, h), o = px.clone();
  o.rect(x, y, w, h, '.');
  return o.stamp(b, x + dx, y + dy);
}
const SPEAR = G(['..v', '.vu', 'gt.', 'g..', 'q..', 'g..', 'g..', 'g..', 'g..', 'f..']);
const SPEAR_H = G(['gggqgggtuv', '.......v..']);
const MILITIA = {
  up: [
    '..................',
    '..................',
    '..................',
    '......vvuuu.......',
    '.....vuuuuuut.....',
    '....tuuuuuuuuts...',
    '....sssssssssss...',
    '.....fqqqkqkqf....',
    '.....fqqqkqkpf....',
    '.....ffpqqqppf....',
    '.....hBCCCCBBh....',
    '.....hBDCCCBBh....',
    '.....gBCCCCBBg....',
    '......gBCCCBBg....',
    '......ggfyfgg.....',
  ],
  legs: { type: 'pants', lx: 7, rx: 10, P: 'gf', F: 'ff' },
  eyes: [[9, 7], [11, 7]],
  w: {
    idle: { g: SPEAR, h: [0, 4], at: [13, 11] },
    a0: { g: SPEAR, h: [0, 4], at: [12, 10], dy: 1 },
    a1: { g: SPEAR_H, h: [3, 0], at: [9, 11], dx: 1 },
  },
};

function enemySprites() {
  const out = [], add = (n, px, i) => out.push({ name: `enemy_${n}_${i}`, px: fin(px), kind: 'unit' });
  const anim = (n, kind, frames) => frames.forEach((f, i) => add(n, f, `${kind}_${i}`.replace(/^(move|attack)_/, '$1_')));
  // gloomling: hop cycle (rest, squash, stretch, airborne); bite = lunge + open maw
  const gl = pad(GLOOMLING, 1, 1, 1, 0);
  anim('gloomling', 'move', [gl, squash(gl, 10), stretch(gl, 10).shift(0, -1), gl.shift(0, -2)]);
  anim('gloomling', 'attack', [squash(gl, 10).shift(-1, 0), pad(GLOOMLING_BITE, 1, 1, 1, 0).shift(1, -1)]);
  // skitter: scuttling legs + antenna twitch; attack = rear up, then lunge with mandibles
  const sk = SKITTER, body = (p, dx, dy) => moveBlock(p, 0, 2, 18, 8, dx, dy);
  const skB = body(sk, 0, -1).rect(0, 10, 18, 2, '.').stamp(SKITTER_LEGS_B, 0, 10);
  const twitch = (p, dy) => dots(p.clone(), [[15, 3 + dy, '.'], [14, 4 + dy, '.'], [16, 3 + dy, 'L'], [15, 4 + dy, 'L']]);
  anim('skitter', 'move', [sk, skB, twitch(sk, 0), twitch(skB, -1)]);
  const skUp = dots(body(sk, 0, -1), [[16, 4, 'w'], [16, 7, 'w'], [15, 6, 'k']]);
  anim('skitter', 'attack', [skUp, dots(body(sk, 0, 1), [[16, 8, 'w'], [16, 7, 'w'], [15, 9, 'w']]).rect(0, 10, 18, 2, '.').stamp(SKITTER_LEGS_B, 1, 10)]);
  // spitter: wobble; attack = inhale (puffed, mouth shut), spit
  const sp = pad(delCol(delCol(SPITTER, 6), 0), 1, 0, 1, 0);
  const spFeet = dots(sp.clone().rect(0, 15, 18, 1, '.'), [[3, 15, 'm'], [4, 15, 'm'], [9, 15, 'm'], [10, 15, 'm']]);
  anim('spitter', 'move', [sp, squash(sp, 8), spFeet, stretch(sp, 8)]);
  const puff = stretch(recolor(sp.crop(0, 0, 18, 18), {}), 9);
  for (let x = 8; x <= 16; x++) for (const y of [9, 10]) if ('nw'.includes(puff.get(x, y))) puff.set(x, y, 'M');
  anim('spitter', 'attack', [puff, pad(delCol(delCol(SPITTER_SPIT, 6), 0), 1, 0, 1, 0)]);
  // brute: heavy stomp; attack = fists raised overhead, then ground slam
  const br = pad(delCol(BRUTE, 10), 1, 0, 0, 0);
  const brLegs = (lift) => { const p = br.clone().rect(0, 18, 22, 2, '.'); if (lift !== 'l') p.rect(6, 18, 4, 1, 'm').rect(6, 19, 4, 1, 'm'); else p.rect(6, 18, 4, 1, 'm'); if (lift !== 'r') p.rect(11, 18, 4, 1, 'm').rect(11, 19, 4, 1, 'm'); else p.rect(11, 18, 4, 1, 'm'); return p; };
  const sink = (p) => { const b = p.crop(0, 0, 22, 18), o = p.clone().rect(0, 0, 22, 18, '.'); return o.stamp(b, 0, 1); };
  anim('brute', 'move', [brLegs(), sink(brLegs('l')), moveBlock(moveBlock(brLegs(), 0, 13, 5, 5, 0, -1), 17, 13, 5, 5, 0, 1).rect(17, 13, 5, 1, '.'), sink(brLegs('r'))]);
  let raise = moveBlock(br, 0, 13, 5, 5, 0, -9); raise = moveBlock(raise, 16, 13, 6, 5, 0, -9);
  raise = dots(raise, [[1, 9, 'M'], [2, 9, 'M'], [3, 9, 'm'], [17, 9, 'M'], [18, 9, 'M'], [19, 9, 'm'], [2, 8, 'M'], [18, 8, 'M']]);
  let slam = sink(br); slam = moveBlock(slam, 16, 14, 6, 5, -1, 1); slam = moveBlock(slam, 0, 14, 5, 5, 1, 1);
  anim('brute', 'attack', [raise, slam]);
  // wisp: flicker + bob; attack = recoil then flare-dash
  const wi = pad(WISP, 1, 1, 1, 1);
  const wi1 = dots(wi.shift(0, -1), [[8, 1, '.'], [9, 1, 'L'], [13, 2, '.'], [14, 3, 'L'], [2, 13, '.'], [1, 14, 'm']]);
  const wi2 = dots(wi.clone(), [[8, 2, '.'], [7, 2, 'L'], [2, 15, '.'], [3, 15, 'm']]);
  const wi3 = dots(wi.shift(0, -1), [[13, 2, '.'], [12, 2, 'L'], [2, 14, '.'], [3, 15, 'm']]);
  anim('wisp', 'move', [wi, wi1, wi2, wi3]);
  const flare = recolor(wi, { L: 'w', M: 'L', m: 'M' });
  anim('wisp', 'attack', [stretch(wi, 9).shift(-1, 0), dots(flare.shift(1, 0), [[2, 14, 'm'], [3, 14, 'm'], [6, 14, 'm']])]);
  // bomber: waddle with sputtering fuse; attack = swell, then white-hot flash before the blast
  const bo = pad(BOMBER, 1, 1, 1, 0);
  const fuse2 = (p) => dots(p.clone(), [[11, 2, 'y'], [10, 3, 'z'], [12, 3, 'z'], [11, 3, 'y'], [12, 2, 'z']]);
  anim('bomber', 'move', [bo, fuse2(squash(bo, 10)), dots(bo.clone().rect(0, 16, 18, 1, '.'), [[4, 16, 'm'], [5, 16, 'm'], [12, 16, 'm'], [13, 16, 'm']]), fuse2(stretch(bo, 10))]);
  const swell = stretch(bo, 10);
  anim('bomber', 'attack', [dots(swell, [[11, 1, 'w'], [10, 2, 'z'], [12, 2, 'z']]), dots(recolor(bo, { n: 'm', m: 'M', M: 'L', t: 'u', s: 't', z: 'w' }), [[11, 2, 'w'], [10, 3, 'w'], [12, 3, 'w'], [11, 1, 'z']])]);
  // snuffer: loping walk, arms swing; attack = rise with arms up, then smother forward
  const sn = delRow(SNUFFER, 5);
  const snSwing = (p, d) => (d > 0 ? moveBlock(p, 0, 11, 4, 6, 1, 0) : moveBlock(p, 14, 11, 4, 6, -1, 0));
  anim('snuffer', 'move', [sn, shiftRows(sn, 0, 14, 0, 1), snSwing(sn, 1), shiftRows(snSwing(sn, -1), 0, 14, 0, 1)]);
  const snUp = dots(moveBlock(moveBlock(sn, 0, 11, 4, 7, 0, -6), 14, 11, 4, 7, 0, -6), [[7, 8, 'w'], [10, 8, 'w']]);
  const snDown = moveBlock(shiftRows(sn, 0, 13, 0, 1), 14, 11, 4, 6, 0, -2);
  anim('snuffer', 'attack', [snUp, snDown]);
  // militia (friendly spearman): hero rig
  WALK.forEach((f, i) => out.push({ name: `enemy_militia_move_${i}`, px: heroFrame(MILITIA, f), kind: 'unit' }));
  out.push({ name: 'enemy_militia_attack_0', px: heroFrame(MILITIA, { legs: { lo: -1, ro: 1 }, dy: 1, wkey: 'a0' }), kind: 'unit' });
  out.push({ name: 'enemy_militia_attack_1', px: heroFrame(MILITIA, { legs: { lo: -1, ro: 2 }, dx: 1, wkey: 'a1' }), kind: 'unit' });
  // veiled: only the eyes show in darkness (fx: no outline)
  out.push({ name: 'enemy_eyes_veiled_0', px: G(['..........', '.yz....yz.', '.zz....zz.', '..........']), kind: 'fx' });
  out.push({ name: 'enemy_eyes_veiled_1', px: G(['..........', '..........', '.yz....yz.', '..........']), kind: 'fx' });
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════
// BOSSES — technique (B): procedural shapes + shade() + speckle() + hand-placed details + outline.
// ════════════════════════════════════════════════════════════════════════════════
// Mossback 48×40: giant stone turtle carrying ruins. lifts = [nearFront, nearBack, farFront, farBack].
function mossback({ lifts = [0, 0, 0, 0], bob = 0, retract = false, glow = 0 } = {}) {
  const p = new Px(48, 40), dy = bob + (retract ? 4 : 0);
  const leg = (x, w, top, bot, lift, far) => {
    const l = new Px(48, 40), b = bot - lift;
    l.rect(x, top, w, b - top + 1, far ? 's' : 't').rect(x - 1, b - 1, w + 2, 2, far ? 's' : 't');
    if (!far) { l.shade(RAMPS.stone); l.speckle('t', 's', 0.08, x); }
    for (let i = 0; i < w + 2; i += 2) l.set(x - 1 + i, b, far ? 't' : 'v');
    return l;
  };
  if (!retract) { put(p, leg(14, 4, 26, 35, lifts[3], true)); put(p, leg(33, 4, 26, 35, lifts[2], true)); }
  // tail
  if (!retract) dots(p, [[4, 27 + dy, 't'], [3, 28 + dy, 't'], [4, 28 + dy, 's'], [5, 27 + dy, 's']]);
  // shell dome
  const sh = new Px(48, 40);
  sh.ellipse(21, 22 + dy, 16.5, 11, 't');
  for (let y = 0; y < 40; y++) for (let x = 0; x < 48; x++) if (y > 27 + dy) sh.d[y][x] = '.';
  sh.shade(RAMPS.stone);
  // plates: a ring + staggered seams
  for (let x = 6; x <= 36; x++) if (sh.get(x, 22 + dy) !== '.') sh.set(x, 22 + dy, 's');
  for (let x = 9; x <= 33; x++) if (sh.get(x, 16 + dy) !== '.' && sh.get(x, 15 + dy) !== '.') sh.set(x, 16 + dy, 's');
  for (const x of [10, 17, 25, 32]) for (let y = 17; y < 22; y++) if (sh.get(x, y + dy) !== '.') sh.set(x, y + dy, 's');
  for (const x of [7, 14, 21, 28, 35]) for (let y = 23; y < 27; y++) if (sh.get(x, y + dy) !== '.') sh.set(x, y + dy, 's');
  for (const x of [14, 21, 28]) for (let y = 12; y < 16; y++) if (sh.get(x, y + dy) !== '.') sh.set(x, y + dy, 's');
  // lit upper-left plates, worn highlights
  for (let y = 0; y < 40; y++) for (let x = 0; x < 48; x++) if (sh.d[y][x] === 't' && (x - 21) / 16.5 + (y - 22 - dy) / 11 < -0.75) sh.d[y][x] = 'u';
  sh.speckle('u', 'v', 0.1, 4).speckle('t', 'u', 0.04, 3);
  // moss hanging off the lower rim, plus a few tufts in seams
  for (let x = 5; x <= 37; x++) { const y = 27 + dy, h = (x * 7) % 5; if (sh.get(x, y) !== '.' && h < 3) { sh.set(x, y, x % 3 ? 'b' : 'c'); if (h === 0) sh.set(x, y - 1, 'c'); } }
  for (const [x, y] of [[9, 21], [10, 21], [26, 15], [27, 15], [33, 21], [16, 26], [24, 26], [25, 25]]) if (sh.get(x, y + dy) !== '.') sh.set(x, y + dy, y > 24 ? 'b' : 'c');
  put(p, sh);
  // plastron rim
  for (let x = 6; x <= 36; x++) { p.set(x, 28 + dy, x < 12 ? 'h' : 'g'); if (x > 8 && x < 34) p.set(x, 29 + dy, 'f'); }
  // ruins on top: two broken pillars + a wall stub with a window
  const ru = new Px(48, 40);
  ru.rect(12, 4, 4, 9, 'u').rect(11, 12, 6, 2, 'u');                // tall pillar
  ru.set(12, 3, 'u').set(13, 3, 'u').set(15, 5, '.').set(15, 4, '.');  // broken top
  ru.rect(26, 7, 4, 6, 'u').rect(25, 12, 6, 2, 'u').set(29, 7, '.').set(28, 6, 'u');
  ru.rect(17, 8, 8, 5, 't');                                         // wall stub
  ru.set(17, 7, 't').set(18, 7, 't').set(19, 6, 't').set(22, 7, 't'); ru.rect(19, 9, 2, 3, 'n'); ru.set(19, 8, 'n').set(20, 8, 'n');
  ru.shade(RAMPS.steel); ru.shade(RAMPS.stone);
  for (const [x, y] of [[13, 6], [13, 9], [27, 9], [18, 11], [23, 10]]) ru.set(x, y, 's');
  dots(ru, [[12, 8, 'c'], [12, 9, 'b'], [16, 12, 'c'], [24, 8, 'c'], [24, 9, 'b'], [30, 11, 'c'], [11, 13, 'b'], [17, 12, 'b'], [26, 12, 'd'], [13, 12, 'd']]);
  put(p, ru.shift(0, dy));
  // gloom cracks in the shell (glow when retracted)
  const crack = glow ? ['L', 'w'] : ['m', 'M'];
  dots(p, [[19, 18 + dy, crack[0]], [20, 19 + dy, crack[1]], [21, 19 + dy, crack[0]], [22, 20 + dy, crack[0]], [30, 24 + dy, crack[0]], [31, 25 + dy, crack[1]], [12, 24 + dy, crack[0]], [11, 25 + dy, crack[0]]]);
  if (!retract) {
    put(p, leg(9, 5, 27, 36, lifts[1], false)); put(p, leg(28, 5, 27, 36, lifts[0], false));
    // neck + head
    const hd = new Px(48, 40);
    hd.rect(34, 23, 5, 5, 't');
    hd.ellipse(41, 24, 5.2, 4.2, 't');
    hd.shade(RAMPS.stone);
    hd.rect(37, 20, 7, 1, 'b').set(38, 19, 'c').set(41, 19, 'c').set(43, 20, 'a');   // mossy brow
    hd.set(42, 22, 'k').set(43, 22, 'z').set(42, 23, 'z').set(43, 23, 'z');           // glowing eye
    hd.set(39, 22, 'k').set(39, 23, 'y');                                             // far eye
    for (let x = 40; x <= 46; x++) hd.set(x, 26, 'k');                                // mouth line
    hd.set(46, 25, 'u').set(45, 27, 's');
    put(p, hd.shift(0, dy + (lifts[0] ? -1 : 0)));
  } else {
    // dark openings where head and legs went in; eyes peep out on the glow frame
    p.rect(35, 24 + dy, 3, 3, 'n'); p.rect(11, 29 + dy, 4, 1, 'n'); p.rect(29, 29 + dy, 4, 1, 'n');
    if (glow) p.set(36, 25 + dy, 'z');
    p.set(37, 25 + dy, 'n');
  }
  return fin(p);
}

// The Unlit 40×48: floating hollow king — crown, void face, ermine collar, tattered robes, an empty lantern.
function unlit({ bob = 0, cast = 0, tatter = 0 } = {}) {
  const p = new Px(40, 48), oy = bob + 2;
  // robe body: flared, with fold lines and a gold-trimmed opening
  const robe = new Px(40, 48);
  for (let y = 19; y <= 39; y++) { const t = (y - 19) / 20, half = 6 + t * 10.5; for (let x = Math.ceil(19.5 - half); x <= Math.floor(19.5 + half); x++) robe.set(x, y + oy, 'm'); }
  for (let x = 4; x <= 35; x++) { // tattered hem: ragged strips of uneven length
    const n = [1, 3, 2, 0, 2, 4, 1, 2, 3, 1][(x + tatter * 3) % 10];
    for (let y = 40; y < 40 + n; y++) if (robe.get(x, 39 + oy) !== '.') robe.set(x, y + oy, 'm');
  }
  robe.shade(['n', 'm', 'M']);
  for (const [x, y0, y1] of [[9, 30, 41], [13, 25, 42], [26, 25, 42], [30, 29, 41], [16, 33, 41], [23, 33, 41]])
    for (let y = y0; y <= y1; y++) if (robe.get(x, y + oy) !== '.') robe.set(x, y + oy, x < 19 ? 'M' : 'n');
  for (let y = 21; y <= 41; y++) for (const [x, c] of [[18, 'y'], [19, 'n'], [20, 'n'], [21, 'x']]) if (robe.get(x, y + oy) !== '.') robe.set(x, y + oy, c);
  put(p, robe);
  // bell sleeves + bony claws (raised when casting)
  const sl = new Px(40, 48), up = cast ? -9 : 0;
  for (let j = 0; j <= 9; j++) {
    const w = 3 + Math.floor(j / 2.5);
    for (let i = 0; i < w; i++) { sl.set(9 - i, 21 + j + up, 'M'); sl.set(30 + i, 21 + j + up, 'M'); }
  }
  sl.shade(['m', 'M', 'L']);
  for (let i = 0; i < 6; i++) { sl.set(4 + i, 30 + up, 'n'); sl.set(30 + i, 30 + up, 'n'); }
  for (const [x, y] of [[5, 31], [7, 31], [9, 31], [30, 31], [32, 31], [34, 31], [6, 32], [33, 32], [9, 32], [30, 32]]) sl.set(x, y + up, (x + y) % 3 ? 'u' : 'v');
  put(p, sl.shift(0, oy));
  // empty lantern hanging from the right hand (not while casting)
  if (!cast) {
    const ln = new Px(40, 48);
    ln.set(33, 33, 's').set(33, 34, 's');
    ln.rect(31, 35, 5, 6, 't'); ln.rect(32, 36, 3, 4, 'n'); ln.rect(31, 41, 5, 1, 's'); ln.rect(32, 35, 3, 1, 'u');
    ln.set(32, 36, 'k').set(34, 39, 'm');
    put(p, ln.shift(0, oy));
  }
  // ermine collar
  const col = new Px(40, 48);
  col.ellipse(19.5, 20, 10.5, 3.2, 'w');
  col.shade(['v', 'w', 'w']);
  for (const [x, y] of [[12, 20], [16, 21], [22, 21], [26, 20], [19, 19], [10, 19], [29, 19]]) col.set(x, y, 'k');
  put(p, col.shift(0, oy));
  // hood + void face
  const hd = new Px(40, 48);
  hd.ellipse(19.5, 13, 7.5, 6.5, 'm');
  hd.shade(['n', 'm', 'M']);
  hd.ellipse(19.5, 14, 4.6, 4, 'n');
  hd.rect(16, 16, 8, 2, 'k');
  const eye = cast ? 'w' : 'z';
  hd.set(17, 13, eye).set(22, 13, eye).set(17, 14, 'y').set(22, 14, 'y');
  put(p, hd.shift(0, oy));
  // crown (one prong snapped)
  const cr = new Px(40, 48);
  cr.rect(13, 6, 14, 3, 'y');
  for (const x of [13, 17, 22, 26]) cr.rect(x, 3, 1, 3, 'y');
  for (const x of [15, 24]) cr.rect(x, 4, 1, 2, 'y');
  cr.rect(19, 2, 2, 4, 'y');
  cr.shade(['x', 'y', 'z']);
  cr.set(19, 7, 'L').set(20, 7, 'M').set(15, 7, 'R').set(24, 7, 'R').set(26, 5, '.').set(26, 4, '.').set(26, 3, '.').set(26, 6, 'x');
  put(p, cr.shift(0, oy));
  // casting: gloom orb gathering between the raised hands
  if (cast) {
    const r = cast === 1 ? 3 : 4.5, o = new Px(40, 48);
    o.ellipse(19.5, 26, r + 1, r + 1, 'M').ellipse(19.5, 26, r, r, 'L').ellipse(19.5, 26, r * 0.45, r * 0.45, 'w');
    if (cast === 2) for (const [x, y] of [[11, 23], [28, 23], [13, 31], [26, 31], [19, 19]]) o.set(x, y, 'L');
    put(p, o.shift(0, oy));
  }
  return fin(p);
}

function bossSprites() {
  const out = [], u = (name, px) => out.push({ name, px, kind: 'unit' });
  const L = [[0, 2, 2, 0], [0, 1, 1, 0], [2, 0, 0, 2], [1, 0, 0, 1]];
  L.forEach((lifts, i) => u(`boss_mossback_walk_${i}`, mossback({ lifts, bob: i % 2 ? -1 : 0 })));
  u('boss_mossback_shell_0', mossback({ retract: true }));
  u('boss_mossback_shell_1', mossback({ retract: true, glow: 1 }));
  [0, -1, -2, -1].forEach((bob, i) => u(`boss_unlit_float_${i}`, unlit({ bob, tatter: i })));
  u('boss_unlit_cast_0', unlit({ bob: -1, cast: 1, tatter: 1 }));
  u('boss_unlit_cast_1', unlit({ bob: -2, cast: 2, tatter: 2 }));
  return out;
}

// Tobi's mini turret (16×16): brass-banded steel barrel on a wooden tripod.
function turretMini() {
  return fin(G([
    '................',
    '................',
    '................',
    '.....yy.........',
    '....vuuut.......',
    '...vuvvvuuuuuuv.',
    '...uuuuutttttts.',
    '...tyuuts.......',
    '....sstts.......',
    '....hhhhg.......',
    '...hiihhgg......',
    '...gggfggf......',
    '..gf.g.f.gf.....',
    '..f..g..f.f.....',
    '.f...f..f..f....',
    '................',
  ]));
}

export const HERO_IDS = ['knight', 'ranger', 'pyro', 'tinker', 'cleric', 'rogue'];

export default function build() {
  const out = [];
  for (const h of HERO_IDS) out.push(...heroSprites(h));
  out.push(...enemySprites());
  out.push(...bossSprites());
  out.push({ name: 'turret_mini', px: turretMini(), kind: 'unit' });
  for (const h of HERO_IDS) out.push({ name: `portrait_${h}`, px: portrait(h), kind: 'icon' });
  return out;
}

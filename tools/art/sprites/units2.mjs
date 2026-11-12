// SPEC v2 characters (owner: art-units). Villagers, traveler + cart, 4 new heroes (Fenn, Orla, Sable, Garrick),
// garrison busts for all 10 heroes, Fenn's wolf, new projectiles/FX, 5 regional Gloom enemies, 3 regional bosses,
// the Blood-Moon Gloom Champion + its 3 skill overlays, and region/tier FX.
// Technique (A) for characters: hand-typed grids WITHOUT outline, every frame derived (generated legs, re-posed
// tool/weapon layer, shifted body bands), fin() adds the 1px `k` outline last. Technique (B) for bosses/FX.
import { Px, RAMPS } from '../pixel.mjs';
import buildV1 from './units.mjs';
import {
  G, put, fin, rotCW, seat, shiftRows, squash, stretch, dots, flipY, recolor, bbox, pad, strip, hash,
  moveBlock, rig, WALK, portrait, ring, disc, poly, thick,
} from './_units2_helpers.mjs';

const unit = (name, px) => ({ name, px, kind: 'unit' });
// rig sprites carry a 1px empty margin below the feet: anchor one row above the bottom edge
const unitP = (name, px) => ({ name, px, kind: 'unit', ay: px.h - 1 });
const fx = (name, px) => ({ name, px, kind: 'fx' });

// ════════════════════════════════════════════════════════════════════════════════
// VILLAGERS — 16×16, content 13 rows (smaller than the 15-row heroes), no armour, no weapons:
// tunics, aprons, headscarves, visible hair. Tools are a separate layer re-posed per work frame.
// ════════════════════════════════════════════════════════════════════════════════
const V = rig(16, 16);
const HAND = { g: G(['q']), h: [0, 0], at: [12, 10], selout: false };
// work tools (hand pixel `q` included); "up" = wind-up, "dn" = strike
const T = {
  axeUp: G(['.uv', 'tuv', '.g.', '.g.', '.q.', '.g.']),
  axeDn: G(['.....tu', 'ggqgggv', '.....tu']),
  pickUp: G(['.ttu.', 't.g.v', '..g..', '..g..', '..q..', '..g..']),
  pickDn: G(['....t', '....u', 'qgggg', '....u', '....v']),
  hoeUp: G(['tu..', '.g..', '..g.', '..g.', '..q.', '...g']),
  hoeDn: G(['q....', '.g...', '..g..', '...g.', '...tu', '..h.i']),
  hamUp: G(['tuv', 'stu', '.g.', '.q.', '.g.']),
  hamDn: G(['...tu', 'qggtv', '...su']),
  book0: G(['wvww.', 'rwwvq', '.rrr.']),
  book1: G(['..w..', 'wvwv.', 'rwwvq', '.rrr.']),
  sell0: G(['.Ro', 'rRR', '.q.', '.q.']),
  sell1: G(['qzy', '.yx']),
};
const villagerW = {
  idle: HAND,
  chop0: { g: T.axeUp, h: [1, 4], at: [12, 8] }, chop1: { g: T.axeDn, h: [2, 1], at: [11, 10] },
  mine0: { g: T.pickUp, h: [2, 4], at: [12, 8] }, mine1: { g: T.pickDn, h: [0, 2], at: [11, 10] },
  farm0: { g: T.hoeUp, h: [2, 4], at: [12, 8] }, farm1: { g: T.hoeDn, h: [0, 0], at: [11, 7] },
  forge0: { g: T.hamUp, h: [1, 3], at: [12, 8] }, forge1: { g: T.hamDn, h: [0, 1], at: [11, 10] },
  read0: { g: T.book0, h: [4, 1], at: [13, 11] }, read1: { g: T.book1, h: [4, 2], at: [13, 11] },
  sell0: { g: T.sell0, h: [1, 3], at: [12, 6] }, sell1: { g: T.sell1, h: [0, 0], at: [12, 10] },
};
const VILLAGERS = [
  { // 0: man — brown hair, sage tunic, tan apron
    up: [
      '................',
      '................',
      '.....ggggg......',
      '....gghhggf.....',
      '...gghggggggf...',
      '...ggqqqqqgqf...',
      '...gqqqqkqkqf...',
      '...fqqqqkqkpf...',
      '....ppqqqqpp....',
      '....cdcccccb....',
      '...qcfhgggfb....',
      '....cbhgggbb....',
      '....bbgggfbb....',
    ],
    legs: { type: 'pants', lx: 5, rx: 8, P: 'ff', F: 'nn' },
    eyes: [[8, 6], [10, 6]], mouth: [9, 8], sleeve: ['c', 'b'], w: villagerW,
  },
  { // 1: man — ginger hair + beard, cream shirt, brown vest
    up: [
      '................',
      '................',
      '.....xxxxx......',
      '....xyyxxxr.....',
      '...xxyxxxxxxr...',
      '...xxqqqqqxqr...',
      '...xqqqqkqkqr...',
      '...rqqqqkqkpr...',
      '....rxqqqqxr....',
      '....gxxxxxxg....',
      '...qgiwxxigg....',
      '....giiiwigg....',
      '....gfffyfgg....',
    ],
    legs: { type: 'pants', lx: 5, rx: 8, P: 'BB', F: 'ff' },
    eyes: [[8, 6], [10, 6]], mouth: [9, 9], sleeve: ['i', 'h'], w: villagerW,
  },
  { // 2: woman — red headscarf, blue dress, white apron
    up: [
      '................',
      '................',
      '.....RRRRR......',
      '....RoRRRRr.....',
      '...RoRRRRRRr....',
      '...RgqqqqqRrr...',
      '...Rqqqqkqkqrr..',
      '...rqqqqkqkpr...',
      '....ppqqqqpp....',
      '....CBwwwwCB....',
      '...qCBwwvwBB....',
      '...CCwwwvwBBB...',
      '...CCwwvwwBBB...',
    ],
    legs: { type: 'robe', x0: 3, x1: 12, hem: 'CB', lx: 5, rx: 9, F: 'ff' },
    eyes: [[8, 6], [10, 6]], mouth: [9, 8], sleeve: ['C', 'B'], w: villagerW,
  },
  { // 3: woman — blonde braid, rose dress, brown shawl
    up: [
      '................',
      '................',
      '.....yyyyy......',
      '....yzzyyyx.....',
      '...yzyyyyyyx....',
      '...yyqqqqqyqx...',
      '...yqqqqkqkqx...',
      '..yxqqqqkqkpx...',
      '..yx.ppqqqpp....',
      '..x.hhhhhhhg....',
      '...qhHHoHHgg....',
      '...HHHoHHHrr....',
      '...HHHHHHrrr....',
    ],
    legs: { type: 'robe', x0: 3, x1: 12, hem: 'Hr', lx: 5, rx: 9, F: 'gg' },
    eyes: [[8, 6], [10, 6]], mouth: [9, 8], sleeve: ['H', 'r'], w: villagerW,
  },
];

// flee: both arms thrown up beside the head, mouth open, sweat drop
function fleeEdit(def, f) {
  return (p, { dx, dy }) => {
    const [s0, s1] = def.sleeve, l = f ? 1 : 0, P = (x, y, c) => p.set(x + dx, y + dy, c);
    P(3, 10, '.'); // tuck the resting hand
    // arms flung up and out in a V, hands open; frame 1 = arms flail one pixel lower/wider
    [[3, 9, s0], [2, 8, s0], [2, 7 + l, s0], [1, 6 + l, s0], [1, 5 + l, 'q'], [0, 4 + l, 'q']].forEach(([x, y, c]) => P(x, y, c));
    [[12, 9, s1], [13, 8, s1], [13, 7 - l, s1], [14, 6 - l, s1], [14, 5 - l, 'q'], [15, 4 - l, 'q']].forEach(([x, y, c]) => P(x, y, c));
    const [mx, my] = def.mouth; P(mx, my, 'k'); P(mx + 1, my, 'k');
    for (const [x, y] of def.eyes) P(x, y - 1, 'k'); // wide, startled eyes
    if (!f) { P(2, 2, 'E'); P(2, 3, 'D'); } else { P(3, 2, 'E'); P(3, 3, 'D'); }
  };
}
function villagerSprites(v) {
  const def = VILLAGERS[v], out = [], n = (s) => `villager_${v}_${s}`;
  WALK.forEach((f, i) => out.push(unitP(n(`walk_${i}`), V.frame(def, { ...f, wdy: i % 2 ? 0 : (i ? -1 : 0) }))));
  out.push(unitP(n('flee_0'), V.frame(def, { legs: { lo: -2, ro: 2 }, bob: 0, dx: 0, wkey: 'none', edit: fleeEdit(def, 0) })));
  out.push(unitP(n('flee_1'), V.frame(def, { legs: { ll: true, ro: 1, sway: 1 }, bob: -1, wkey: 'none', edit: fleeEdit(def, 1) })));
  const sparks = (p, { dx, dy }) => dots(p, [[14 + dx, 9 + dy, 'z'], [15 + dx, 8 + dy, 'y'], [13 + dx, 8 + dy, 'y'], [14 + dx, 13 + dy, 'x']]);
  const dirt = (p, { dx, dy }) => dots(p, [[14 + dx, 13 + dy, 'h'], [13 + dx, 12 + dy, 'g']]);
  const chip = (p, { dx, dy }) => dots(p, [[14 + dx, 7 + dy, 'h'], [15 - 1 + dx, 6 + dy, 'i']]);
  const shout = (p, { dx, dy }) => { const [mx, my] = def.mouth; p.set(mx + dx, my + dy, 'k'); };
  const look = (p, { dx, dy }) => { for (const [x, y] of def.eyes) { p.set(x + dx, y + dy, p.get(x + dx - 1, y + dy)); } };
  const jobs = {
    chop: [{ wkey: 'chop0', bob: -1, legs: { lo: -1, ro: 1 } }, { wkey: 'chop1', dx: 1, dy: 1, legs: { lo: -1, ro: 1 }, edit: chip }],
    mine: [{ wkey: 'mine0', bob: -1, legs: { lo: -1, ro: 1 } }, { wkey: 'mine1', dx: 1, dy: 1, legs: { lo: -1, ro: 1 }, edit: (p, o) => dots(p, [[15 - 1 + o.dx, 9 + o.dy, 'u'], [13 + o.dx, 8 + o.dy, 'v']]) }],
    farm: [{ wkey: 'farm0', bob: -1, legs: {} }, { wkey: 'farm1', dy: 1, legs: { ro: 1 }, edit: dirt }],
    forge: [{ wkey: 'forge0', bob: -1, legs: { lo: -1, ro: 1 } }, { wkey: 'forge1', dx: 1, dy: 1, legs: { lo: -1, ro: 1 }, edit: sparks }],
    read: [{ wkey: 'read0', breathe: true, edit: look }, { wkey: 'read1', breathe: true, wdy: 0, edit: look }],
    sell: [{ wkey: 'sell0', bob: -1, edit: shout }, { wkey: 'sell1', legs: { ro: 1 } }],
  };
  for (const [j, fr] of Object.entries(jobs)) fr.forEach((o, i) => out.push(unitP(n(`${j}_${i}`), V.frame(def, o))));
  return out;
}

// ── Traveler (18×18, hero rig): hooded wanderer with a big pack and a walking staff ──
const H18 = rig(18, 18);
const TRAVELER = { // wide straw hat, blue travelling cloak, tall pack with a red bedroll, walking staff
  up: [
    '..................',
    '..................',
    '..rRRr............',
    '..fhgg.iiii.......',
    '..fhggihhhhh......',
    '..fgiihhhhhhhh....',
    '..ihhhhhhhhhhhhg..',
    '..fgggghhgggggg...',
    '..fhggBqqqqkqkq...',
    '..fhggBqqqqkqkp...',
    '..ffggBpqqqqppB...',
    '..fhggCCBBBBBCB...',
    '..ffgfCCCBhBBBB...',
    '...ffCCCCBBBBB....',
    '.....BBCByCBBB....',
  ],
  legs: { type: 'pants', lx: 7, rx: 10, P: 'gf', F: 'ff' },
  eyes: [[11, 8], [13, 8]],
  w: { idle: { g: G(['.h.', 'hih', '.g.', '.g.', '.q.', '.g.', '.g.', '.g.', '.f.']), h: [1, 4], at: [16, 11] } },
};

// ════════════════════════════════════════════════════════════════════════════════
// NEW HEROES — 18×18 (same rig and proportions as v1 heroes)
// ════════════════════════════════════════════════════════════════════════════════
const JAV = G(['.v.', 'vuv', '.t.', '.h.', '.g.', '.h.', '.g.', '.q.', '.g.', '.R.', 'RoR']);
const JAV_H = G(['R.........u.', 'oRggqhgghvvw', 'R.........u.']);
const WARHAM = G(['tuvvu', 'tuuuu', 'sttts', '..g..', '..g..', '..q..', '..g..', '..f..']);
const WARHAM_H = G(['......tut.', 'fgqgggvuus', '......tut.']);
const HXBOW = G(['....u', 'qgggt', '.n..u']);
const HXBOW_LOW = G(['q...', 'gg..', '.gtu', '..u.']);
const HXBOW_FIRE = G(['....u.zw', 'qgggtyzz', '.n..u.zw']);
const BOMB_H = G(['..z.', '.yg.', '.ng.', 'nssn', 'nsnn', 'nnnn', '.qn.']);
const BOMB_UP = G(['.z..', 'y...', '.g..', 'nsnn', 'snnn', 'nnnn', '.q..']);
const HAND_E = G(['q']);

const HEROES2 = {
  beast: { // Fenn — wolf-skull hood, fur cloak, javelin
    up: [
      '..................',
      '..................',
      '....s.....s.......',
      '...sts...sts......',
      '...tsstttsst......',
      '..tssuvvvvvut.....',
      '..tsuvkvvvkvvvu...',
      '..tssuvvvvvvvvvuk.',
      '..stssuwuwuwuwu...',
      '..stsqqqqkqkqs....',
      '..stsqqqqkqkps....',
      '.hhtsppqqqqpps....',
      '.hgghhgwiwigg.....',
      '.hgggfggiggggf....',
      '..hgf.fgfyggf.....',
    ],
    legs: { type: 'pants', lx: 7, rx: 10, P: 'gf', F: 'ff' },
    eyes: [[9, 9], [11, 9]],
    w: {
      idle: { g: JAV, h: [1, 7], at: [14, 11] },
      a0: { g: JAV_H, h: [4, 1], at: [8, 3], dx: -1 },
      a1: { g: JAV_H, h: [4, 1], at: [14, 10], dx: 1 },
      a2: { g: HAND_E, h: [0, 0], at: [14, 12], selout: false },
    },
  },
  warden: { // Orla — winged steel helm, teal tabard, tower shield + warhammer
    up: [
      '..................',
      '..................',
      '..w.........w.....',
      '..vw..uuuu.wv.....',
      '...vwuvvuuuvt.....',
      '....vuuuuuuuut....',
      '....uuuuuuuuut....',
      '.uvvutssssssssa...',
      'uvaaavqqqqkqkqa...',
      'vaDDaauqqqkqkpa...',
      'vaDDDauqqqqqppt...',
      'vaaDaauaaDaaat....',
      'uaaDaatsaDDaat....',
      'uaaaaatsaaaaas....',
      '.uaaauttsysss.....',
    ],
    legs: { type: 'pants', lx: 7, rx: 10, P: 'ts', F: 'ss' },
    eyes: [[10, 8], [12, 8]],
    w: {
      idle: { g: WARHAM, h: [2, 5], at: [14, 12] },
      a0: { g: WARHAM, h: [2, 5], at: [13, 8], dy: 1 },
      a1: { g: WARHAM_H, h: [2, 1], at: [11, 12], dx: 1 },
      a2: { g: flipY(WARHAM), h: [2, 2], at: [14, 10] },
    },
  },
  shade: { // Sable — wide-brim hat, dark grey long coat, hand crossbow, cyan eye glow
    up: [
      '..................',
      '..................',
      '......nnnn........',
      '.....nsttsn.......',
      '.....nsttsnn......',
      '..nnnsrrrrsnnnn...',
      '...nnnnnnnnnnnnn..',
      '....tnpppEpEpn....',
      '....tnqqqDqDpn....',
      '....tsnqqqqqpn....',
      '...tsrnnnnnnrs....',
      '...tsstnnnnsst....',
      '...tssttytttss....',
      '..tssstttttsss....',
      '..tsss.ttsssss....',
    ],
    legs: { type: 'pants', lx: 7, rx: 10, P: 'nn', F: 'kk' },
    eyes: [[10, 7], [12, 7]],
    w: {
      idle: { g: HXBOW_LOW, h: [0, 0], at: [13, 11] },
      a0: { g: HXBOW, h: [0, 1], at: [13, 9], dx: -1 },
      a1: { g: HXBOW_FIRE, h: [0, 1], at: [13, 9] },
      a2: { g: HXBOW, h: [0, 1], at: [12, 8], dx: -1, dy: -1 },
    },
  },
  bomb: { // Garrick — orange bandana, soot, beard, brown vest with a bandolier of bombs
    up: [
      '..................',
      '..................',
      '..................',
      '......xxxxx.......',
      '.....xyyxxxr......',
      '....xyxxxxxxr.....',
      '....xxxxxxxxrxr...',
      '....rqqqqqqqrrx...',
      '....fqqqqkqkq.x...',
      '....fqnqqkqkp.....',
      '...gfffqqqqff.....',
      '..hgnsfffffgfh....',
      '..hgnnrgggggxh....',
      '..hgggnsrggggg....',
      '...gfgnnfrnsf.....',
    ],
    legs: { type: 'pants', lx: 6, rx: 9, P: 'gf', F: 'ff' },
    eyes: [[9, 8], [11, 8]],
    w: {
      idle: { g: BOMB_H, h: [1, 6], at: [14, 13] },
      a0: { g: BOMB_UP, h: [1, 6], at: [12, 8], dx: -1, dy: 1 },
      a1: { g: HAND_E, h: [0, 0], at: [14, 9], dx: 1, selout: false },
      a2: { g: HAND_E, h: [0, 0], at: [14, 12], selout: false },
    },
  },
};

function heroSprites(id) {
  const def = HEROES2[id], out = [];
  out.push(unitP(`hero_${id}_idle_0`, H18.frame(def, {})));
  out.push(unitP(`hero_${id}_idle_1`, H18.frame(def, { breathe: true })));
  WALK.forEach((f, i) => out.push(unitP(`hero_${id}_walk_${i}`, H18.frame(def, f))));
  const a = def.w, st = { lo: -1, ro: 1 };
  out.push(unitP(`hero_${id}_attack_0`, H18.frame(def, { legs: st, dx: a.a0.dx || 0, dy: a.a0.dy || 0, wkey: 'a0' })));
  out.push(unitP(`hero_${id}_attack_1`, H18.frame(def, { legs: { lo: -1, ro: 2 }, dx: a.a1.dx || 0, dy: a.a1.dy || 0, wkey: 'a1' })));
  out.push(unitP(`hero_${id}_attack_2`, H18.frame(def, { legs: st, dx: a.a2.dx || 0, dy: a.a2.dy || 0, wkey: 'a2' })));
  out.push(unitP(`hero_${id}_down`, H18.down(def)));
  return out;
}

const PORTRAITS2 = {
  beast: { back: 'f', cloth: RAMPS.wood, over: [
    '........................',
    '.....tt..........tt.....',
    '.....tvt........tvt.....',
    '.....tuvt.uuuu.tvut.....',
    '.....tuuuuvvvvuuuut.....',
    '....tuuvwwwwwwwwvuut....',
    '....tuvwwwwwwwwwwvut....',
    '...tuvwwkkwwwwkkwwvut...',
    '...tuvwwkkwwwwkkwwvut...',
    '...tuuvwwwwwvvwwwvuut...',
    '...tutsvwvwvwvwvwsutt...',
    '...tut............tts...',
    '...tus............tus...',
    '...tus............tss...',
    '...tts............ts....',
    '....ts...........tts....',
    '....ts...........ts.....',
    '....tss.........tss.....',
    '..hhhtss.......sshhh....',
    '.hhiihhgg.wvw.gghhihh...',
    '.hihhhhggggRggghhhhihh..',
    '.hhhhggggggggggghhhhhh..',
    '.ggggggggggggggggggggg..',
  ] },
  warden: { back: 'a', cloth: RAMPS.steel, over: [
    '........................',
    '........................',
    '..w..................w..',
    '..vw.....uuuuuu.....wv..',
    '...vw..uuvvvvuuuu..wv...',
    '....vwuvvuuuuuuuuuwv....',
    '.....uvuuuuuuuuuuuut....',
    '....uvuuuuuuuuuuuuuut...',
    '....uuuuuuuuuuuuuuuut...',
    '....tssssssssssssssst...',
    '....tu.....tt.......t...',
    '....tu.....tt.......t...',
    '....tu.....tt.......t...',
    '....tt..............t...',
    '.....t.............tt...',
    '.....t.............t....',
    '........................',
    '........................',
    '........................',
    '...vvuu..aaaaaa...uut...',
    '..vuuuuuaaDDaaaau.uuut..',
    '..uuuuuuaaaDaaaaauuuut..',
    '..tttttttaaaaaattttttt..',
  ] },
  shade: { back: 'n', cloth: RAMPS.stone, skin: ['p', 'p', 'q'], eye: 'E', eye2: 'D', noBlush: true, over: [
    '........................',
    '.........nnnnnn.........',
    '........nsttttsn........',
    '.......nstttttttsn......',
    '.......nsttttttttn......',
    '.......nsrrrrrrrrn......',
    '..nnnnnssssssssssnnnnn..',
    '.nnssttttttttttttttssnn.',
    '..nnnnnnnnnnnnnnnnnnnn..',
    '.....nn............nn...',
    '.....n..............n...',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '......nn........nn......',
    '.....tnnnnnnnnnnnnt.....',
    '....tsnnnnnnnnnnnnst....',
    '...ttsstnnnnnnnnsssst...',
    '..ttssssttttttttsssstt..',
    '..tssssssssyssssssssst..',
    '..sssssssssssssssssssss.',
  ] },
  bomb: { back: 'g', cloth: RAMPS.fire, over: [
    '........................',
    '........................',
    '.........xxxxxx.........',
    '.......xyyyxxxxxx.......',
    '......xyyxxxxxxxxx......',
    '.....xyxxxxxxxxxxxxr....',
    '.....xxxxxxxxxxxxxxrrx..',
    '.....rrrrrrrrrrrrrrrxxr.',
    '.....f.............f.xr.',
    '.....f..............f...',
    '.....f..............f...',
    '.....f..............f...',
    '.....f..nn..........f...',
    '.....f.nn...........f...',
    '.....ff............ff...',
    '......ffff......fffff...',
    '......fffffffffffffff...',
    '.......fffffffffffff....',
    '...hhgg.fffffffffff.gg..',
    '..hhggnsnnfffffnnsngghh.',
    '..hggnssnyxnnyxnssnggghh',
    '..ggxnnnnxxnnxxnnnnxxgg.',
    '..xxxxxxxxxxxxxxxxxxxxx.',
  ] },
};

// ════════════════════════════════════════════════════════════════════════════════
// GARRISON BUSTS — 18×16: the hero's head + shoulders (cropped from its idle frames, so they always match the
// field sprite) peeking over a stone parapet with two merlons. Frame 1 = breathe/look-out bob.
// ════════════════════════════════════════════════════════════════════════════════
function parapet() {
  const p = new Px(18, 16);
  p.rect(1, 11, 16, 4, 't');
  p.rect(1, 9, 4, 2, 't'); p.rect(13, 9, 4, 2, 't');
  p.shade(RAMPS.stone);
  for (let x = 1; x <= 16; x++) p.set(x, 11, x < 5 || x > 12 ? 'u' : 'v');
  for (let x = 1; x <= 4; x++) p.set(x, 9, 'v');
  for (let x = 13; x <= 16; x++) p.set(x, 9, 'v');
  p.set(1, 9, 'u').set(13, 9, 'u');
  for (let x = 1; x <= 16; x++) p.set(x, 12, 'k');
  for (const x of [5, 11]) p.set(x, 13, 'k');
  for (const x of [2, 8, 14]) p.set(x, 14, 's');
  for (let x = 1; x <= 16; x++) p.set(x, 15, '.');
  p.rect(1, 12, 16, 3, '.');
  p.rect(1, 12, 16, 3, 't');
  for (let x = 1; x <= 16; x++) { p.set(x, 12, 's'); p.set(x, 14, x % 5 === 2 ? 's' : 't'); }
  for (const x of [4, 9, 14]) p.set(x, 13, 's');
  p.set(16, 13, 's').set(16, 14, 's');
  dots(p, [[3, 10, 'c'], [15, 13, 'b'], [6, 14, 'c']]);
  return p;
}
const PARAPET = parapet();
function bust(heroPx, dy = 0) {
  const src = heroPx.w === 22 ? heroPx.crop(2, 1, 18, 18) : heroPx; // rig sprites are padded (2,1,2,1)
  const body = strip(src).crop(0, 0, 18, 13);
  const p = new Px(18, 16).stamp(body, 0, dy - 1);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 18; x++) if (y >= 12) p.set(x, y, '.');
  put(p, PARAPET);
  return pad(fin(p));
}

// ════════════════════════════════════════════════════════════════════════════════
// Typed grids for creatures: rows are right-padded automatically; F() adds a 2px clear margin + outline so no
// pixel ever touches the canvas edge (entries anchor at ay = h - 1, like the rig sprites).
// ════════════════════════════════════════════════════════════════════════════════
const T2 = (rows) => { const w = Math.max(...rows.map((r) => r.length)); return G(rows.map((r) => r.padEnd(w, '.'))); };
const F = (px) => fin(pad(px, 2, 2, 2, 2));
// Place `src` into a w×h canvas with its lowest pixel on the bottom row (+dx, +dy).
const onto = (src, w, h, dx = 0, dy = 0) => new Px(w, h).stamp(src, dx, h - src.h + dy);

// Silhouette typed in ramp mid-tones, then shade() per ramp (light from top-left), then hand details stay.
const S = (rows, ...ramps) => { let p = T2(rows); for (const r of ramps) p.shade(r); return p; };
const GL = RAMPS.gloom, ST = RAMPS.stone;

// ── Fenn's wolf (ally): grey timber wolf with a neck ruff; the red collar marks it as friendly ──
const WOLF_BODY = (() => {
  const p = S([
    '..............t.t...',
    '.............tt.tt..',
    '............tttttt..',
    '...........ttttttttt',
    't.tttttttttttttttttt',
    'tttttttttttttttt....',
    '.ttttttttttttttt....',
    '..tttttttttttttt....',
    '...tttttttttttt.....',
  ], ST);
  dots(p, [[15, 3, 'k'], [19, 4, 'k'], [17, 4, 'u'], [18, 5, '.'], [16, 5, 'v'], [17, 5, '.'], [14, 1, 'u'], [17, 1, 'u'],
    [13, 5, 'R'], [13, 6, 'r'], [12, 5, 'R'], [12, 6, 'r'], [14, 5, 'R'], [14, 6, 'r'],
    [11, 3, 'u'], [12, 3, 'u'], [11, 4, 'u'], [5, 7, 'v'], [6, 7, 'v'], [7, 7, 'v'], [8, 7, 'v'], [9, 7, 'v'], [5, 8, 'v'], [6, 8, 'v'], [7, 8, 'v'], [8, 8, 'v'],
    [6, 4, 's'], [8, 4, 's'], [4, 5, 's'], [0, 5, 's'], [1, 6, 's'], [2, 4, 'u'], [3, 4, 'u'], [16, 2, 'u']]);
  return p;
})();
function wolfLegs(p, ph, y0) {
  // 4 legs, 4px long: back pair x 4/7, front pair x 11/14; ph = per-leg [dx, lifted]
  [[4, 's'], [7, 't'], [11, 's'], [14, 't']].forEach(([x, c], i) => {
    const [dx, up] = ph[i], bot = y0 + 3 - up;
    for (let y = y0; y <= bot; y++) { const foot = y === bot; p.set(x + dx, y, foot ? 'n' : c); if (y <= y0 + 1) p.set(x + dx + 1, y, c); }
  });
  return p;
}
function wolf(f) {
  const p = new Px(21, 14);
  const gait = [
    [[-1, 0], [1, 0], [-1, 0], [1, 0]], [[0, 1], [0, 0], [0, 1], [0, 0]],
    [[1, 0], [-1, 0], [1, 0], [-1, 0]], [[0, 0], [0, 1], [0, 0], [0, 1]],
  ];
  const bob = f % 2 ? -1 : 0;
  wolfLegs(p, gait[f], 9 + bob);
  p.stamp(WOLF_BODY, 0, 2 + bob);
  if (f % 2) dots(p, [[0, 4 + bob, '.'], [0, 3 + bob, 't'], [1, 3 + bob, 'u']]); // tail lifts
  return p;
}
function wolfAttack(f) {
  const p = new Px(21, 14);
  if (f === 0) { // crouch: body low, hind legs bunched, teeth bared
    wolfLegs(p, [[1, 1], [0, 1], [0, 1], [0, 1]], 10);
    p.stamp(WOLF_BODY, 0, 3);
    dots(p, [[17, 8, 'w'], [18, 8, 'w'], [19, 7, 'w']]);
  } else { // lunge: thrown forward, jaws open
    wolfLegs(p, [[-1, 0], [-1, 0], [1, 1], [2, 1]], 9);
    const b = WOLF_BODY.clone();
    dots(b, [[17, 4, 'k'], [18, 4, 'k'], [19, 4, '.'], [16, 5, 'w'], [18, 5, 'w'], [17, 5, 'n'], [19, 3, 'k'], [18, 3, 'w']]);
    p.stamp(b, 0, 1);
  }
  return p;
}

// ── Burrower: hunched gloom mole, bristled spine, pointed snout, huge digging claws ──
const BURROWER = (() => {
  const p = S([
    '...M.M.M.M........',
    '...MMMMMMMM.......',
    '..MMMMMMMMMMM.....',
    '.MMMMMMMMMMMMMM...',
    'MMMMMMMMMMMMMMMM..',
    'MMMMMMMMMMMMMMMMMM',
    'MMMMMMMMMMMMMMMMM.',
    'MMMMMMMMMMMMMM....',
    '.MMMMMMMMMMMM.....',
    '..MMMMMMMMMM......',
    '...MM....MM.......',
  ], GL);
  dots(p, [[3, 0, 'L'], [5, 0, 'L'], [7, 0, 'L'], [9, 0, 'L'],                                                  // spine bristles
    [11, 4, 'z'], [12, 4, 'k'], [11, 5, 'z'], [12, 5, 'k'],                                                      // eye
    [17, 5, 'H'], [16, 6, 'm'], [14, 6, 'm'], [15, 6, 'm'],                                                      // snout + nose
    [5, 4, 'L'], [6, 3, 'L'], [4, 5, 'L'], [3, 7, 'm'], [6, 8, 'm'], [9, 7, 'm']]);
  // big shovel claws reaching forward under the snout
  for (const [x, y, c] of [[13, 7, 'm'], [14, 7, 'u'], [15, 7, 'w'], [16, 7, 'w'], [17, 7, 'w'], [13, 8, 'u'], [14, 8, 'w'], [15, 8, '.'], [16, 8, 'w'], [17, 8, '.'], [18, 8, 'w'], [14, 9, 'v'], [12, 9, 'm']]) p.set(x, y, c);
  return p;
})();
// ── Shrieker: gaunt howler with flared ear-fins and a huge maw ──────────────────
const SHRIEKER = (() => {
  const p = S([
    '.M..........M.',
    '.MM..MMMM..MM.',
    '..MMMMMMMMMM..',
    '..MMMMMMMMMM..',
    '...MMMMMMMMM..',
    '...MMMMMMMMM..',
    '...MMMMMMMMM..',
    '...MMMMMMMMM..',
    '....MMMMMMM...',
    '.....MMMMM....',
    '....MMMMMM....',
    '...MMMMMMMM...',
    '..M.MMMMMM.M..',
    '..M.MMMMMM.M..',
    '....MMMMMM....',
    '....M.MM.M....',
    '....M....M....',
  ], GL);
  dots(p, [[1, 0, 'L'], [12, 0, 'L'], [2, 1, 'L'], [11, 1, 'M'],
    [4, 4, 'z'], [5, 4, 'k'], [8, 4, 'z'], [9, 4, 'k'],
    [4, 6, 'k'], [5, 6, 'n'], [6, 6, 'n'], [7, 6, 'n'], [8, 6, 'n'], [9, 6, 'k'],
    [4, 7, 'n'], [5, 7, 'w'], [6, 7, 'n'], [7, 7, 'n'], [8, 7, 'w'], [9, 7, 'n'],
    [5, 8, 'n'], [6, 8, 'n'], [7, 8, 'n'], [8, 8, 'n'], [2, 13, 'L'], [11, 13, 'L'], [6, 11, 'L'], [5, 12, 'L']]);
  return p;
})();
// ── Hurler: armoured rock-thrower — stone slab helm and pauldrons, long arms ─────
const HURLER = (() => {
  const p = S([
    '.......tttt..........',
    '......tttttt.........',
    '.....MttttttM........',
    '....MMMMMMMMMM.......',
    '..ttMMMMMMMMMMtt.....',
    '.ttttMMMMMMMMtttt....',
    '.ttttMMMMMMMMtttt....',
    '.ttttMMMMMMMMMttt....',
    '.MMMMMMMMMMMMMMMMM...',
    'MMMMMMMMtttMMMMMMMM..',
    'MMMMMMMttttMMM.MMMM..',
    'MMMM.MttttttMM..MMM..',
    '.MM..MMMMMMMMM...M...',
    '.....MMMM.MMMM.......',
    '.....MMMM.MMMM.......',
  ], GL, ST);
  dots(p, [[6, 3, 'n'], [7, 3, 'z'], [8, 3, 'n'], [10, 3, 'z'], [11, 3, 'n'], [9, 3, 'n'],          // eyes under the helm
    [7, 5, 'k'], [8, 5, 'w'], [9, 5, 'k'], [10, 5, 'w'], [11, 5, 'k'], [9, 1, 's'], [8, 7, 'L'], [7, 8, 'L'],
    [3, 5, 's'], [14, 5, 's'], [2, 6, 's'], [15, 6, 's'], [9, 10, 's'], [8, 11, 's'], [1, 11, 'L'], [17, 10, 'L']]);
  return p;
})();
const BOULDER = S(['..tttt..', '.tttttt.', 'tttttttt', 'tttttttt', 'tttttttt', '.tttttt.'], ['s', 't', 'u']);
dots(BOULDER, [[2, 1, 'v'], [3, 1, 'v'], [1, 2, 'v'], [5, 3, 's'], [4, 3, 's'], [6, 2, 's'], [2, 4, 's'], [3, 2, 'u'], [5, 4, 'L']]);
// ── Frostwraith: small hooded gloom wraith crowned with ice, tattered frost-tipped hem ──
const FROSTWRAITH = (() => {
  const p = S([
    '..............',
    '..............',
    '....MMMMMM....',
    '...MMMMMMMM...',
    '..MMMMMMMMMM..',
    '..MMMMMMMMMM..',
    '..MMMMMMMMMM..',
    '.MMMMMMMMMMMM.',
    'MMMMMMMMMMMMMM',
    '.MMMMMMMMMMMM.',
    '..MMMMMMMMMM..',
    '..MMMMMMMMM...',
    '...MM.MMM.M...',
    '...M...MM.....',
    '........M.....',
  ], GL);
  dots(p, [[4, 0, 'E'], [4, 1, 'D'], [6, 0, 'w'], [6, 1, 'E'], [8, 1, 'E'], [9, 0, 'D'], [10, 1, 'D'], [5, 2, 'D'], [7, 2, 'E'], [8, 2, 'D'],   // ice crown
    [4, 4, 'n'], [5, 4, 'n'], [6, 4, 'n'], [7, 4, 'n'], [8, 4, 'n'], [9, 4, 'n'], [10, 4, 'n'],
    [4, 5, 'n'], [5, 5, 'z'], [6, 5, 'n'], [7, 5, 'n'], [8, 5, 'z'], [9, 5, 'n'], [10, 5, 'n'],
    [4, 6, 'n'], [5, 6, 'y'], [6, 6, 'n'], [7, 6, 'n'], [8, 6, 'y'], [9, 6, 'n'], [5, 7, 'n'], [6, 7, 'n'], [7, 7, 'n'], [8, 7, 'n'],
    [0, 8, 'D'], [13, 8, 'D'], [0, 9, 'E'], [13, 9, 'E'],                                              // icy claws
    [3, 12, 'D'], [4, 13, 'E'], [8, 13, 'D'], [8, 14, 'E'], [10, 12, 'D'], [5, 9, 'L'], [4, 10, 'L']]);
  return p;
})();
// ── Cinderling: small ember imp — gloom hide cracked with embers, flame crest, stubby horns ─
const CINDERLING = (() => {
  const p = S([
    '...........',
    '...........',
    '.M.......M.',
    '.MMMMMMMMM.',
    'MMMMMMMMMMM',
    'MMMMMMMMMMM',
    'MMMMMMMMMMM',
    '.MMMMMMMMM.',
    '..MMMMMMM..',
    '.M.MM.MM.M.',
    '...M...M...',
  ], GL);
  dots(p, [[5, 0, 'y'], [4, 1, 'y'], [5, 1, 'z'], [6, 1, 'x'], [4, 2, 'x'], [5, 2, 'z'], [6, 2, 'y'], [5, 3, 'y'], [3, 2, '.'], [7, 2, '.'], // flame crest
    [3, 5, 'z'], [4, 5, 'k'], [7, 5, 'z'], [8, 5, 'k'], [4, 7, 'x'], [5, 7, 'y'], [6, 7, 'x'],                       // eyes, ember mouth
    [2, 4, 'x'], [8, 8, 'x'], [9, 6, 'y'], [1, 6, 'x'], [1, 2, 'L'], [9, 2, 'L']]);
  return p;
})();

function enemySprites() {
  const out = [], add = (n, px) => out.push({ name: n, px: F(px), kind: 'unit' });
  const anim = (base, frames) => frames.forEach((px, i) => add(`${base}_${i}`, px));
  // burrower: waddle (rock side to side), attack = claws raised, then raking swipe
  const bu = onto(BURROWER, 20, 13, 0, 0);
  const buFeet = (p, a, b) => { const o = p.clone().rect(0, 12, 20, 1, '.'); dots(o, [[3 + a, 12, 'm'], [4 + a, 12, 'm'], [9 + b, 12, 'm'], [10 + b, 12, 'm']]); return o; };
  anim('enemy_burrower_move', [bu, buFeet(squash(bu, 6), -1, 1), moveBlock(bu, 13, 9, 7, 3, 0, -1), buFeet(stretch(bu, 6), 1, -1)]);
  const raise = moveBlock(stretch(bu, 6), 12, 8, 7, 3, 0, -5);
  const swipe = moveBlock(squash(bu, 6), 12, 9, 7, 3, 1, 1);
  anim('enemy_burrower_attack', [raise, swipe]);
  // mound: churned dirt with gloom claws breaking through
  for (let f = 0; f < 2; f++) {
    const m = new Px(20, 11);
    m.ellipse(9.5, 10, 8.5, 6.2 + f * 0.6, 'g');
    for (let x = 0; x < 20; x++) m.set(x, 10, '.');
    m.shade(RAMPS.wood).speckle('g', 'f', 0.18, 3 + f).speckle('h', 'i', 0.3, 5);
    // stones in the soil, gloom bristles breaking the surface, the burrower's eyes glinting in the crack
    dots(m, [[4, 8, 't'], [5, 8, 'u'], [14, 7, 't'], [15, 7, 's'], [10, 9, 's']]);
    dots(m, f ? [[8, 4, 'k'], [9, 4, 'z'], [11, 4, 'z'], [10, 4, 'k'], [7, 5, 'k'], [12, 5, 'k'], [6, 3, 'L'], [13, 3, 'L']]
      : [[9, 4, 'k'], [10, 4, 'k'], [8, 5, 'k'], [11, 5, 'k'], [8, 3, 'L'], [11, 3, 'L'], [9, 2, 'M']]);
    // flung clods
    dots(m, f ? [[2, 4, 'g'], [17, 3, 'h'], [1, 2, 'f']] : [[3, 3, 'h'], [16, 5, 'g'], [18, 2, 'f']]);
    add(`enemy_burrower_mound_${f}`, m);
  }
  // shrieker: lurching hop, fins flutter; attack = draw breath (maw shut), then SHRIEK (maw gaping, fins flared)
  const sh = onto(SHRIEKER, 14, 18);
  const fins = (p) => dots(p.clone(), [[1, 1, '.'], [1, 0, '.'], [0, 0, 'L'], [12, 1, '.'], [12, 0, '.'], [13, 0, 'L'], [0, 1, 'L'], [13, 1, 'L']]);
  anim('enemy_shrieker_move', [sh, shiftRows(fins(sh), 0, 13, 0, 1), sh.shift(0, -1), shiftRows(sh, 0, 13, 0, 1)]);
  const shut = dots(squash(sh, 9), [[4, 8, 'M'], [5, 8, 'k'], [6, 8, 'k'], [7, 8, 'k'], [8, 8, 'k'], [9, 8, 'M'], [5, 9, 'M'], [6, 9, 'M'], [7, 9, 'M'], [8, 9, 'M']]);
  let scream = stretch(fins(sh), 8);
  dots(scream, [[4, 7, 'n'], [5, 7, 'n'], [8, 7, 'n'], [9, 7, 'n'], [5, 9, 'n'], [6, 9, 'n'], [7, 9, 'n'], [8, 9, 'n'], [4, 5, 'w'], [7, 5, 'w']]);
  anim('enemy_shrieker_attack', [shut, scream]);
  // hurler: heavy stomp, boulder carried on the back shoulder; attack = boulder hoisted overhead, then hurled
  const HW = 22, HH = 21;
  const hu = onto(HURLER, HW, HH, 0, 0);
  const legs = (p, lift) => { // lift 'l'/'r': raise that leg 1px
    const o = p.clone();
    if (lift === 'l') o.stamp(moveBlock(o, 5, HH - 2, 4, 2, 0, -1).crop(0, 0, HW, HH), 0, 0);
    if (lift === 'r') o.stamp(moveBlock(o, 10, HH - 2, 4, 2, 0, -1).crop(0, 0, HW, HH), 0, 0);
    return o;
  };
  const sink = (p) => { const top = p.crop(0, 0, HW, HH - 2), o = p.clone().rect(0, 0, HW, HH - 2, '.'); return o.stamp(top, 0, 1); };
  const carry = (p, dy = 0) => put(new Px(HW, HH), BOULDER, 1, 4 + dy, true).stamp(p, 0, 0);
  anim('enemy_hurler_move', [carry(hu), carry(sink(legs(hu, 'l')), 1), carry(moveBlock(hu, 15, 14, 5, 4, 0, -1)), carry(sink(legs(hu, 'r')), 1)]);
  let hoist = moveBlock(hu, 0, 14, 5, 5, 3, -9); hoist = moveBlock(hoist, 15, 14, 5, 5, -3, -9);
  hoist = put(new Px(HW, HH), BOULDER, 7, 0, true).stamp(stretch(hoist, 14), 0, 0);
  let hurl = moveBlock(hu, 15, 14, 5, 5, 2, -2); hurl = moveBlock(hurl, 0, 14, 5, 5, 4, -1);
  anim('enemy_hurler_attack', [hoist, sink(hurl).shift(1, 0)]);
  // frostwraith: hover bob, crystals glint, tail sways; attack = rear back, then icy lunge with frost breath
  const fw = onto(FROSTWRAITH, 16, 18, 1, -1);
  const tail = (p, d) => moveBlock(p, 0, 13, 16, 4, d, 0);
  anim('enemy_frostwraith_move', [fw, tail(fw.shift(0, -1), 1), dots(fw.clone(), [[7, 1, 'w'], [11, 2, 'w']]), tail(fw.shift(0, 1), -1)]);
  const rear = stretch(fw, 9).shift(-1, -1);
  const lunge = dots(moveBlock(fw.shift(1, 1), 13, 8, 3, 4, 1, -2), [[15, 5, 'E'], [15, 6, 'w'], [14, 6, 'E'], [15, 7, 'D']]);
  anim('enemy_frostwraith_attack', [rear, lunge]);
  // cinderling: skittering hop with flickering crest; attack = flare up, then pounce trailing sparks
  const ci = onto(CINDERLING, 13, 13, 1, 0);
  const flick = (p, k) => dots(p.clone(), k ? [[6, 2, '.'], [7, 2, 'y'], [7, 3, 'x']] : [[5, 3, 'y'], [6, 2, 'z']]);
  anim('enemy_cinderling_move', [flick(ci, 0), flick(ci.shift(0, -2), 1), flick(squash(ci, 6), 0), flick(ci.shift(0, -1), 1)]);
  const flare = dots(stretch(recolor(ci, { x: 'y', y: 'z' }), 6), [[6, 0, 'z'], [4, 1, 'y'], [8, 1, 'y'], [6, 1, 'w']]);
  const pounce = dots(ci.shift(1, -1), [[0, 9, 'y'], [1, 10, 'x'], [0, 6, 'x']]);
  anim('enemy_cinderling_attack', [flare, pounce]);
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════
// BOSSES — technique (B): procedural shapes + shade() + speckle() + hand-placed details + outline.
// ════════════════════════════════════════════════════════════════════════════════
// Briarqueen 44×48: thorn-crowned queen of brambles — leaf ruff, bramble gown studded with thorns and roses,
// rose sceptre. walk: hem writhes + bob; cast: arms raised, thorns erupt round the hem.
function briarqueen({ bob = 0, tw = 0, cast = 0 } = {}) {
  const W = 44, H = 48, p = new Px(W, H), oy = bob;
  // gown: flared bramble skirt
  const gown = new Px(W, H);
  for (let y = 26; y <= 42; y++) { const t = (y - 26) / 16, half = 5 + t * 12.5; for (let x = Math.ceil(21.5 - half); x <= Math.floor(21.5 + half); x++) gown.set(x, y + oy, 'b'); }
  for (let x = 6; x <= 37; x++) { // ragged root hem
    const n = [2, 0, 3, 1, 2, 4, 1, 0, 2, 3][(x + tw * 3) % 10];
    for (let y = 43; y < 43 + n; y++) if (gown.get(x, 42 + oy) !== '.') gown.set(x, y + oy, n > 2 && y === 42 + n ? 'f' : 'b');
  }
  gown.shade(['a', 'b', 'c']);
  // twisting vines (diagonal bands) + purple gloom showing through the brambles
  for (let y = 27; y <= 44; y++) for (let x = 4; x <= 40; x++) {
    if (gown.get(x, y + oy) === '.') continue;
    const v = (x + y * 0.8 + tw * 2) % 7, u = (x - y * 0.9 + 40 - tw) % 9;
    if (v < 1) gown.set(x, y + oy, 'c'); else if (u < 1) gown.set(x, y + oy, 'a'); else if ((x * 3 + y * 5) % 11 === 0) gown.set(x, y + oy, 'm');
  }
  // thorns sticking out of the silhouette + roses
  const thornsAt = [[9, 34], [7, 38], [5, 42], [34, 33], [36, 37], [38, 41], [12, 30], [31, 29]];
  for (const [x, y] of thornsAt) { const dx = x < 22 ? -1 : 1; gown.set(x + dx, y + oy, 'i'); }
  for (const [x, y] of [[14, 33], [27, 36], [19, 40], [31, 41], [11, 41], [24, 30]]) dots(gown, [[x, y + oy, 'R'], [x + 1, y + oy, 'R'], [x, y + 1 + oy, 'r'], [x + 1, y + 1 + oy, 'R'], [x, y - 1 + oy, 'H']]);
  put(p, gown);
  // bodice (gloom) with vine lacing
  const bod = new Px(W, H);
  for (let y = 19; y <= 28; y++) { const half = y < 23 ? 6 - (y - 19) * 0.4 : 4.5; for (let x = Math.ceil(21.5 - half); x <= Math.floor(21.5 + half); x++) bod.set(x, y + oy, 'M'); }
  bod.shade(['m', 'M', 'L']);
  for (let y = 20; y <= 27; y++) { bod.set(19 + (y % 2) * 4, y + oy, 'b'); bod.set(21, y + oy, (y % 2) ? 'a' : 'b'); bod.set(22, y + oy, (y % 2) ? 'b' : 'a'); }
  dots(bod, [[21, 24 + oy, 'R'], [22, 24 + oy, 'R'], [21, 23 + oy, 'H']]);
  put(p, bod);
  // arms (raised when casting) with a rose-and-thorn sceptre in the right hand
  const arm = new Px(W, H), up = cast ? -1 : 0;
  const armPts = cast
    ? [[[15, 20], [11, 15], [9, 9]], [[28, 20], [32, 15], [34, 9]]]
    : [[[15, 20], [12, 26], [11, 31]], [[28, 20], [31, 26], [32, 31]]];
  for (const pts of armPts) for (let i = 0; i < pts.length - 1; i++) thick(arm, pts[i][0], pts[i][1] + oy, pts[i + 1][0], pts[i + 1][1] + oy, 'M', 2);
  arm.shade(['m', 'M', 'L']);
  // bramble cuffs + clawed fingers
  for (const [x, y] of armPts.map((a) => a[2])) dots(arm, [[x, y + oy, 'L'], [x + 1, y + oy, 'M'], [x - 1, y + 1 + oy, 'L'], [x + 2, y + 1 + oy, 'L'], [x, y + 1 + oy, 'm']]);
  for (const pts of armPts) { const [x, y] = pts[1]; dots(arm, [[x, y + oy, 'b'], [x + 1, y + oy, 'a'], [x, y - 1 + oy, 'c']]); }
  put(p, arm);
  // sceptre: vine staff with a big gloom rose
  const sc = new Px(W, H), [hx, hy] = armPts[1][2];
  const top = cast ? hy - 9 : hy - 12, sx = hx + 1;
  for (let y = top + 3; y <= hy + 6 + (cast ? -4 : 0); y++) sc.set(sx, y + oy, (y % 3) ? 'g' : 'f');
  for (const [x, y] of [[sx - 1, top + 7], [sx + 1, top + 10], [sx - 1, top + 13]]) sc.set(x, y + oy, 'i');
  dots(sc, [[sx - 1, top + oy, 'M'], [sx, top + oy, 'L'], [sx + 1, top + oy, 'M'], [sx - 2, top + 1 + oy, 'M'], [sx - 1, top + 1 + oy, 'L'], [sx, top + 1 + oy, cast ? 'w' : 'z'],
    [sx + 1, top + 1 + oy, 'L'], [sx + 2, top + 1 + oy, 'm'], [sx - 1, top + 2 + oy, 'm'], [sx, top + 2 + oy, 'M'], [sx + 1, top + 2 + oy, 'm'], [sx - 2, top + 3 + oy, 'c'], [sx + 2, top + 3 + oy, 'b']]);
  put(p, sc, 0, 0, true);
  // leaf ruff fanning behind the head
  const ruff = new Px(W, H);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.95 + i * 0.1375), x1 = 21.5 + Math.cos(a) * 11, y1 = 18 + Math.sin(a) * 8;
    thick(ruff, 21, 17 + oy, Math.round(x1), Math.round(y1) + oy, 'b', 2);
  }
  ruff.shade(['a', 'b', 'c']);
  for (let i = 0; i < 9; i++) { const a = Math.PI * (0.95 + i * 0.1375); ruff.set(Math.round(21.5 + Math.cos(a) * 12), Math.round(18 + Math.sin(a) * 9) + oy, 'i'); }
  put(p, ruff);
  // head: gloom face, vine hair falling to the shoulders
  const hd = new Px(W, H);
  hd.ellipse(21.5, 13.5, 5.6, 5.2, 'M');
  hd.shade(['m', 'M', 'L']);
  const eye = cast ? 'w' : 'z';
  dots(hd, [[19, 13 + oy - oy, eye], [19, 14, 'y'], [24, 13, eye], [24, 14, 'y'], [20, 13, 'k'], [25, 13, 'k'], [20, 17, 'k'], [21, 17, 'k'], [22, 17, 'k'], [23, 17, 'k'], [21, 16, 'm']]);
  for (const [x0, len] of [[16, 9], [15, 7], [27, 9], [28, 7]]) for (let y = 11; y < 11 + len; y++) hd.set(x0 + ((y > 15) ? (x0 < 21 ? -1 : 1) : 0), y, y % 3 ? 'a' : 'b');
  put(p, hd.shift(0, oy));
  // thorn crown
  const cr = new Px(W, H);
  cr.rect(15, 8, 14, 2, 'g');
  for (const [x, h] of [[15, 3], [17, 5], [19, 4], [21, 7], [22, 7], [24, 4], [26, 5], [28, 3]]) for (let y = 8 - h; y < 8; y++) cr.set(x, y, 'g');
  cr.shade(['f', 'g', 'h']);
  for (const [x, h] of [[15, 3], [17, 5], [19, 4], [21, 7], [22, 7], [24, 4], [26, 5], [28, 3]]) cr.set(x, 8 - h, 'i');
  dots(cr, [[16, 4, 'g'], [18, 3, 'g'], [20, 2, 'g'], [23, 2, 'g'], [25, 3, 'g'], [27, 4, 'g'], [16, 3, 'i'], [27, 3, 'i']]);
  dots(cr, [[18, 8, 'R'], [19, 8, 'R'], [18, 9, 'r'], [25, 8, 'R'], [26, 8, 'R'], [26, 9, 'r'], [21, 9, 'L'], [22, 9, 'L']]);
  put(p, cr.shift(0, oy));
  // casting: thorns burst from the ground around the hem
  if (cast) {
    const th = new Px(W, H), hgt = cast === 1 ? 4 : 8;
    for (const [x, k] of [[4, 1], [9, 0.7], [34, 0.8], [39, 1], [15, 0.5], [28, 0.6]]) {
      const hh = Math.round(hgt * k);
      for (let y = 45 - hh; y <= 45; y++) { th.set(x, y, 'b'); if (y > 45 - hh / 2) th.set(x + 1, y, 'a'); }
      th.set(x, 45 - hh - 1, 'i'); th.set(x - 1, 45 - (hh >> 1), 'i'); th.set(x + 2, 45 - (hh >> 2) - 1, 'i');
    }
    put(p, th);
  }
  return fin(p);
}

// Cairn Colossus 56×56: stacked-stone giant with a glowing rune core. lifts = [left leg, right leg];
// swing = arm sway; throwing = 0 none / 1 boulder raised overhead / 2 arm thrown forward.
function colossus({ lifts = [0, 0], bob = 0, swing = 0, throwing = 0 } = {}) {
  const W = 56, H = 56, p = new Px(W, H);
  const stone = (cx, cy, rx, ry, seed, base = 't') => {
    const s = new Px(W, H).ellipse(cx, cy, rx, ry, base);
    s.shade(['s', 't', 'u']);
    s.speckle('t', 's', 0.08, seed).speckle('u', 'v', 0.12, seed + 1);
    return s;
  };
  const oy = bob;
  // legs: stacked blocks (far/near), feet slabs
  const leg = (x, lift) => {
    const l = new Px(W, H), b = 52 - lift;
    put(l, stone(x, b - 9, 4.2, 3.6, x + 3));
    put(l, stone(x + 0.5, b - 3.5, 5, 3, x + 5));
    for (let i = -4; i <= 5; i += 2) l.set(x + i, b, 'u');
    return l;
  };
  put(p, leg(19, lifts[0])); put(p, leg(36, lifts[1]));
  // hips + torso stack
  put(p, stone(27.5, 39 + oy, 11, 4.5, 7));
  const torso = stone(27.5, 28 + oy, 14.5, 10, 11);
  // moss on top ledges
  for (let x = 14; x <= 41; x++) for (let y = 17; y < 23; y++) if (torso.get(x, y + oy) !== '.' && torso.get(x, y - 1 + oy) === '.' && (x * 7) % 5 < 3) { torso.set(x, y + oy, x % 3 ? 'b' : 'c'); break; }
  put(p, torso);
  // seams between the stacked stones
  for (let x = 16; x <= 39; x++) if (p.get(x, 35 + oy) !== '.' && (x % 9) !== 4) p.set(x, 35 + oy, 's');
  // rune core: glowing gloom heart with rune spokes
  const glow = throwing === 2 ? ['L', 'w', 'w'] : ['M', 'L', 'w'];
  const core = new Px(W, H);
  core.ellipse(27.5, 29 + oy, 4.6, 4.2, 'n');
  core.ellipse(27.5, 29 + oy, 3.4, 3, glow[0]);
  core.ellipse(27.5, 29 + oy, 2.1, 1.8, glow[1]);
  core.set(27, 29 + oy, glow[2]).set(28, 29 + oy, glow[2]);
  put(p, core);
  for (const [x, y] of [[21, 24], [20, 23], [34, 24], [35, 23], [21, 34], [34, 34], [27, 22], [28, 21], [27, 36]]) p.set(x, y + oy, 'M');
  for (const [x, y] of [[19, 22], [36, 22], [27, 20]]) p.set(x, y + oy, 'L');
  // head: small boulder with glowing slit eyes, sunk between the shoulders
  const hd = stone(27.5, 15 + oy, 6.2, 5, 21);
  dots(hd, [[24, 15 + oy, 'n'], [25, 15 + oy, 'z'], [26, 15 + oy, 'z'], [29, 15 + oy, 'z'], [30, 15 + oy, 'z'], [31, 15 + oy, 'n'], [25, 16 + oy, 'y'], [30, 16 + oy, 'y'],
    [23, 11 + oy, 'b'], [24, 10 + oy, 'c'], [25, 10 + oy, 'b'], [32, 11 + oy, 'b'], [26, 18 + oy, 's'], [27, 18 + oy, 's'], [28, 18 + oy, 's']]);
  put(p, hd);
  // arms: shoulder boulder + 2 stones + fist; left arm hangs, right arm swings / throws
  const arm = (pts, seed) => { const a = new Px(W, H); pts.forEach(([x, y, r], i) => put(a, stone(x, y, r, r * 0.85, seed + i))); return a; };
  const L = arm([[12, 21 + oy, 5.5], [9, 28 + oy - swing, 3.6], [8, 34 + oy - swing, 3.4], [8, 40 + oy - swing, 4.2]], 31);
  let R;
  if (throwing === 1) R = arm([[43, 21 + oy, 5.5], [45, 15 + oy, 3.6], [44, 9 + oy, 3.4]], 41);
  else if (throwing === 2) R = arm([[43, 21 + oy, 5.5], [48, 24 + oy, 3.6], [51, 28 + oy, 3.4], [51, 34 + oy, 4]], 41);
  else R = arm([[43, 21 + oy, 5.5], [46, 28 + oy + swing, 3.6], [47, 34 + oy + swing, 3.4], [47, 40 + oy + swing, 4.2]], 41);
  // glowing gloom cracks in the joints
  for (const a of [L, R]) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a.get(x, y) === 's' && hash(x, y, 9) < 0.15) a.set(x, y, 'm');
  put(p, L); put(p, R);
  if (throwing === 1) { // boulder held overhead
    const b = new Px(W, H).ellipse(44, 4.5 + oy, 5, 3.2, 't'); b.shade(['s', 't', 'u']); b.speckle('t', 's', 0.15, 3);
    put(p, b, 0, 0, true);
  }
  if (throwing === 2) for (const [x, y] of [[53, 22], [54, 25], [52, 19]]) p.set(x, y + oy, 'u'); // dust trail
  return fin(p);
}

// Rimefather 48×56: ancient frost elder — ice crown, icicle beard, heavy frost robe, crystal staff.
function rimefather({ bob = 0, sway = 0, cast = 0 } = {}) {
  const W = 48, H = 56, p = new Px(W, H), oy = bob;
  // robe
  const robe = new Px(W, H);
  for (let y = 20; y <= 49; y++) { const t = (y - 20) / 29, half = 7 + t * 12; for (let x = Math.ceil(23.5 - half + (y > 40 ? sway : 0)); x <= Math.floor(23.5 + half + (y > 40 ? sway : 0)); x++) robe.set(x, y + oy, 'D'); }
  for (let x = 4; x <= 43; x++) { const n = [1, 2, 0, 3, 1, 2][(x + sway * 2) % 6]; for (let y = 50; y < 50 + n; y++) if (robe.get(x, 49 + oy) !== '.') robe.set(x, y + oy, 'D'); }
  robe.shade(['C', 'D', 'E']);
  // deep folds + gloom lining showing at the front opening
  for (const [x, y0, y1] of [[12, 34, 50], [17, 28, 51], [30, 28, 51], [35, 34, 50]]) for (let y = y0; y <= y1; y++) if (robe.get(x + (y > 40 ? sway : 0), y + oy) !== '.') robe.set(x + (y > 40 ? sway : 0), y + oy, x < 23 ? 'E' : 'C');
  for (let y = 30; y <= 51; y++) for (let x = 22; x <= 25; x++) { const xx = x + (y > 40 ? sway : 0); if (robe.get(xx, y + oy) !== '.') robe.set(xx, y + oy, x === 22 ? 'B' : x === 25 ? 'B' : 'm'); }
  // frost rime trim along the hem
  for (let x = 0; x < W; x++) for (let y = H - 1; y > 40; y--) if (robe.get(x, y) !== '.') { robe.set(x, y, 'w'); if (robe.get(x, y - 1) !== '.' && x % 2) robe.set(x, y - 1, 'E'); break; }
  put(p, robe);
  // fur-lined mantle over the shoulders
  const man = new Px(W, H);
  man.ellipse(23.5, 22 + oy, 13, 5, 'B');
  man.shade(['n', 'B', 'C']);
  for (let x = 11; x <= 36; x++) { const y = 26 + oy + ((x % 3) ? 0 : 1); if (man.get(x, y - 1) !== '.') man.set(x, y, 'E'); }
  put(p, man);
  // sleeves + hands; staff in the right hand (raised when casting)
  const sl = new Px(W, H), lift = cast ? -8 : 0;
  for (let j = 0; j <= 9; j++) { const w = 3 + (j >> 2); for (let i = 0; i < w; i++) { sl.set(12 - i, 23 + j + oy, 'D'); sl.set(35 + i, 23 + j + oy + Math.round(lift * (j / 9)), 'D'); } }
  sl.shade(['C', 'D', 'E']);
  dots(sl, [[10, 33 + oy, 'M'], [11, 33 + oy, 'M'], [9, 33 + oy, 'm'], [36, 32 + oy + lift, 'M'], [37, 32 + oy + lift, 'M'], [38, 32 + oy + lift, 'm']]);
  put(p, sl);
  const st = new Px(W, H), sx = 39, top = 6 + oy + lift;
  for (let y = top + 5; y <= 50 + oy + (cast ? lift : 0); y++) st.set(sx, y, y % 4 ? 'g' : 'f');
  for (let y = top + 5; y <= top + 9; y++) st.set(sx + 1, y, 'D');
  const cg = cast ? ['E', 'w', 'w'] : ['C', 'D', 'E'];
  dots(st, [[sx, top, cg[2]], [sx, top + 1, cg[1]], [sx - 1, top + 2, cg[0]], [sx, top + 2, cg[2]], [sx + 1, top + 2, cg[1]], [sx - 1, top + 3, cg[1]], [sx, top + 3, cg[2]],
    [sx + 1, top + 3, cg[0]], [sx - 1, top + 4, cg[0]], [sx, top + 4, cg[1]], [sx + 1, top + 4, cg[0]], [sx - 2, top + 3, cg[0]], [sx + 2, top + 2, cg[0]]]);
  put(p, st, 0, 0, true);
  // head: hooded gloom face
  const hd = new Px(W, H);
  hd.ellipse(23.5, 14.5 + oy, 7, 6.2, 'B');
  hd.shade(['n', 'B', 'C']);
  hd.ellipse(23.5, 15.5 + oy, 4.6, 4, 'M');
  const eye = cast ? 'w' : 'z';
  dots(hd, [[21, 15 + oy, eye], [21, 16 + oy, 'y'], [26, 15 + oy, eye], [26, 16 + oy, 'y'], [20, 14 + oy, 'E'], [21, 14 + oy, 'E'], [26, 14 + oy, 'E'], [27, 14 + oy, 'E'], [19, 13 + oy, 'L'], [20, 13 + oy, 'L']]);
  put(p, hd);
  // icicle beard: tapering icicles down the chest (blown sideways when casting)
  const bd = new Px(W, H);
  const lens = [6, 10, 14, 17, 15, 18, 13, 9, 5];
  lens.forEach((len, i) => {
    const x = 19 + i;
    for (let k = 0; k < len; k++) { const y = 19 + k + oy, xx = x + (cast && k > 6 ? 1 : 0); bd.set(xx, y, k > len - 3 ? 'D' : (k + i) % 5 === 0 ? 'w' : i % 3 === 0 ? 'D' : 'E'); }
  });
  put(p, bd);
  // ice crown: tall uneven spikes
  const cr = new Px(W, H);
  cr.rect(16, 8 + oy, 16, 2, 'D');
  for (const [x, h] of [[16, 3], [18, 6], [20, 4], [22, 8], [24, 7], [26, 9], [28, 5], [30, 6], [31, 3]]) for (let y = 8 - h; y < 8; y++) { cr.set(x, y + oy, 'D'); if (h > 5 && y > 8 - h + 2) cr.set(x + 1, y + oy, 'D'); }
  cr.shade(['C', 'D', 'E']);
  for (const [x, h] of [[18, 6], [22, 8], [26, 9], [30, 6]]) cr.set(x, 8 - h + oy, 'w');
  dots(cr, [[23, 9 + oy, 'M'], [24, 9 + oy, 'L']]);
  put(p, cr);
  // casting: snow swirl around the staff
  if (cast) for (let i = 0; i < 10; i++) { const a = i * 0.63 + cast, r = 6 + (i % 3) * 2 + cast; p.set(Math.round(sx + Math.cos(a) * r), Math.round(top + 3 + Math.sin(a) * r * 0.8), i % 2 ? 'w' : 'E'); }
  return fin(p);
}

// Gloom Champion 28×28 (Blood Moon): horn-crowned armoured gloom knight, blood-red tabard + cape, great cleaver.
function champion({ bob = 0, lifts = [0, 0], swing = 0 } = {}) {
  const W = 28, H = 28, p = new Px(W, H), oy = bob;
  // cape behind
  const cape = new Px(W, H);
  poly(cape, [[8, 9 + oy], [19, 9 + oy], [22, 23], [5, 23]], 'r');
  for (let x = 5; x <= 22; x++) if ((x + swing) % 3 === 0) cape.set(x, 23, '.');
  cape.shade(['n', 'r', 'R']);
  put(p, cape);
  // legs
  const lg = new Px(W, H);
  for (const [x, l] of [[10, lifts[0]], [15, lifts[1]]]) { lg.rect(x, 20 + oy, 3, 4 - l, 's'); lg.rect(x - 1, 24 - l, 4, 1, 'n'); lg.set(x, 20 + oy, 't'); }
  put(p, lg);
  // armoured body
  const bd = new Px(W, H);
  bd.ellipse(13.5, 15.5 + oy, 6.5, 5.5, 's');
  bd.shade(['n', 's', 't']);
  bd.rect(11, 14 + oy, 5, 7, 'r'); bd.rect(12, 14 + oy, 3, 6, 'R'); bd.set(13, 16 + oy, 'z'); bd.set(13, 17 + oy, 'y');
  // pauldrons with spikes
  for (const cx of [7.5, 19.5]) { const pa = new Px(W, H).ellipse(cx, 11.5 + oy, 3.2, 2.4, 't'); pa.shade(['s', 't', 'u']); put(bd, pa); }
  dots(bd, [[6, 8 + oy, 'v'], [7, 9 + oy, 'u'], [21, 8 + oy, 'v'], [20, 9 + oy, 'u']]);
  put(p, bd);
  // gloom face in a helm, crowned with horns
  const hd = new Px(W, H);
  hd.ellipse(13.5, 7 + oy, 4.6, 4.2, 's');
  hd.shade(['n', 's', 't']);
  hd.rect(10, 6 + oy, 7, 3, 'm'); hd.rect(11, 6 + oy, 5, 2, 'M');
  dots(hd, [[11, 7 + oy, 'z'], [12, 7 + oy, 'k'], [14, 7 + oy, 'z'], [15, 7 + oy, 'k'], [13, 4 + oy, 'R'], [13, 3 + oy, 'r']]);
  for (const [x, y] of [[9, 4], [8, 3], [7, 2], [7, 1], [18, 4], [19, 3], [20, 2], [20, 1], [10, 3], [17, 3]]) hd.set(x, y + oy, y < 3 ? 'w' : 'v');
  put(p, hd);
  // great cleaver: raised (swing 1), slammed (swing 2), or resting on the shoulder
  const cl = new Px(W, H);
  if (swing === 1) { cl.rect(20, 2 + oy, 2, 9, 'g'); cl.rect(18, 0 + oy, 6, 5, 'u'); cl.rect(18, 0 + oy, 1, 5, 'v'); cl.rect(23, 0 + oy, 1, 5, 't'); cl.set(20, 2 + oy, 'R'); cl.set(21, 2 + oy, 'r'); dots(cl, [[20, 11 + oy, 'M'], [21, 11 + oy, 'M']]); }
  else if (swing === 2) { cl.rect(19, 15 + oy, 6, 2, 'g'); cl.rect(22, 16 + oy, 4, 8, 'u'); cl.rect(25, 16 + oy, 1, 8, 't'); cl.rect(22, 16 + oy, 1, 8, 'v'); cl.set(23, 18 + oy, 'R'); dots(cl, [[19, 15 + oy, 'M'], [21, 24, 'u'], [26, 24, 'u']]); }
  else { cl.rect(20, 10 + oy, 2, 10, 'g'); cl.rect(21, 4 + oy, 5, 7, 'u'); cl.rect(25, 4 + oy, 1, 7, 't'); cl.rect(21, 4 + oy, 5, 1, 'v'); cl.set(23, 6 + oy, 'R'); cl.set(23, 7 + oy, 'r'); dots(cl, [[20, 14 + oy, 'M'], [21, 14 + oy, 'M']]); }
  put(p, cl, 0, 0, true);
  return fin(p);
}

// Champion skill overlays (32×32, centred on the champion): summon rune, haste streaks, frontal shield.
function championFx(kind, f) {
  const p = new Px(32, 32);
  if (kind === 'summon') {
    ring(p, 15.5, 25, 12, 2, 'M', 0.35); ring(p, 15.5, 25, 9, 1, 'L', 0.35);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + f * 0.5; p.set(Math.round(15.5 + Math.cos(a) * 10.5), Math.round(25 + Math.sin(a) * 3.7), 'w'); }
    for (const [x, y, h] of f ? [[6, 18, 4], [25, 16, 5], [12, 12, 3], [20, 9, 4]] : [[8, 16, 5], [23, 19, 3], [15, 10, 4], [27, 11, 3]]) { for (let k = 0; k < h; k++) p.set(x, y + k, k ? 'M' : 'L'); p.set(x, y + h, 'm'); }
    return p;
  }
  if (kind === 'haste') {
    for (const [y, x0, len] of f ? [[8, 1, 7], [13, 0, 9], [18, 2, 6], [23, 1, 8]] : [[10, 0, 8], [15, 2, 6], [20, 0, 9], [25, 3, 5]]) for (let i = 0; i < len; i++) p.set(x0 + i, y, i < 2 ? 'x' : i < len - 2 ? 'y' : 'z');
    ring(p, 15.5, 26, 9 + f, 1, 'y', 0.3, (x) => x < 13 + f * 3);
    for (const [x, y] of f ? [[27, 7], [29, 15], [26, 22]] : [[28, 10], [27, 18], [29, 24]]) dots(p, [[x, y, 'z'], [x + 1, y, 'w']]);
    return p;
  }
  // shield: convex barrier arc in front (east side) with hex sparkle
  ring(p, 10, 16, 18, 3, 'L', 1, (x) => x >= 22);
  ring(p, 10, 16, 16, 1, 'M', 1, (x) => x >= 22);
  for (let y = 0; y < 32; y++) for (let x = 22; x < 32; x++) if (p.get(x, y) === 'L' && (y + f * 2) % 5 === 0) p.set(x, y, 'w');
  for (const [x, y] of f ? [[25, 6], [29, 26]] : [[28, 9], [26, 24]]) p.set(x, y, 'w');
  return p.outline('m');
}

// ════════════════════════════════════════════════════════════════════════════════
export const HERO2_IDS = ['beast', 'warden', 'shade', 'bomb'];
const ALL_HEROES = ['knight', 'ranger', 'pyro', 'tinker', 'cleric', 'rogue', 'beast', 'warden', 'shade', 'bomb'];

export default function build() {
  const out = [];
  for (let v = 0; v < 4; v++) out.push(...villagerSprites(v));
  WALK.forEach((f, i) => out.push(unitP(`traveler_walk_${i}`, H18.frame(TRAVELER, f))));
  for (const h of HERO2_IDS) out.push(...heroSprites(h));
  for (const h of HERO2_IDS) out.push({ name: `portrait_${h}`, px: portrait(PORTRAITS2[h]), kind: 'icon' });
  const v1 = new Map(buildV1().map((e) => [e.name, e.px]));
  const heroPx = (n) => v1.get(n) || out.find((e) => e.name === n).px;
  for (const h of ALL_HEROES) {
    out.push(unitP(`garrison_${h}_0`, bust(heroPx(`hero_${h}_idle_0`), 0)));
    out.push(unitP(`garrison_${h}_1`, bust(heroPx(`hero_${h}_idle_1`), 0)));
  }
  for (let i = 0; i < 4; i++) out.push(unitP(`ally_wolf_move_${i}`, F(wolf(i))));
  for (let i = 0; i < 2; i++) out.push(unitP(`ally_wolf_attack_${i}`, F(wolfAttack(i))));
  out.push(...enemySprites().map((e) => ({ ...e, ay: e.px.h - 1 })));
  // bosses (canvas keeps a 1px clear margin; outline sits on the old ground row → ay = h - 1)
  const B = (name, px) => out.push(unitP(name, pad(px, 0, 0, 0, 0)));
  [0, -1, 0, -1].forEach((bob, i) => B(`boss_briarqueen_walk_${i}`, briarqueen({ bob, tw: i })));
  B('boss_briarqueen_cast_0', briarqueen({ cast: 1, tw: 1 })); B('boss_briarqueen_cast_1', briarqueen({ cast: 2, bob: -1, tw: 2 }));
  [[[3, 0], 0, 1], [[1, 0], -1, 0], [[0, 3], 0, -1], [[0, 1], -1, 0]].forEach(([lifts, bob, swing], i) => B(`boss_colossus_walk_${i}`, colossus({ lifts, bob, swing })));
  B('boss_colossus_throw_0', colossus({ throwing: 1, bob: -1 })); B('boss_colossus_throw_1', colossus({ throwing: 2, lifts: [2, 0] }));
  [[0, 0], [-1, 1], [0, 0], [-1, -1]].forEach(([bob, sway], i) => B(`boss_rimefather_walk_${i}`, rimefather({ bob, sway })));
  B('boss_rimefather_cast_0', rimefather({ cast: 1, bob: -1 })); B('boss_rimefather_cast_1', rimefather({ cast: 2, bob: -2 }));
  [[0, [0, 0], 0], [-1, [2, 0], 0], [0, [0, 0], 0], [-1, [0, 2], 0]].forEach(([bob, lifts], i) => B(`enemy_champion_move_${i}`, champion({ bob, lifts, swing: 0 })));
  B('enemy_champion_attack_0', champion({ swing: 1, bob: -1 })); B('enemy_champion_attack_1', champion({ swing: 2, lifts: [0, 1] }));
  for (const k of ['summon', 'haste', 'shield']) for (let f = 0; f < 2; f++) out.push(fx(`champion_${k}_${f}`, championFx(k, f)));
  return out;
}

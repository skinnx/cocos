// v2 UI sprites (SPEC §9.9, §10.5, §11): resource/system icons, beacons, moon phases, night events, charms,
// tower modules, research nodes, gear frames, achievement badge frames and the Hold UI pieces.
// Owner: art-ui. Contract: docs/CONTRACT.md. Names: tools/art/manifest.mjs (owner 'ui2').
// Same recipe as v1 ui.mjs: 16×16 icons, full 1px 'k' outline, light from the top-left, ≥3 tones per ramp.
// Extra entry fields understood by build-atlas: slice [l,t,r,b] (9-slice insets, art px).
import { NAMES } from '../manifest.mjs';
import {
  P, layer, put, icon, out, swap, flame, starPts, moonDisc, poly, thick, ring, disc, panel, rim, RAMPS,
} from './_ui2_helpers.mjs';

// ═════════════════════════════ 1. Resource & system icons ═════════════════════════════
const ICONS = {
  // ── resources ──
  iron: () => icon([ // iron ingot: bright top face, dark front face, stamped mark
    '...wwwwwwww...',
    '..wvvvvvvvvu..',
    '.wvvvvvvvvvvu.',
    'uuuuuuuuuuuuut',
    'uttttttttttts.',
    'utttttssttttts',
    'uttttttttttts.',
    'ssssssssssssss',
  ], 0, 1),
  food() { // bread loaf with a wheat ear behind it
    const p = P();
    thick(p, 9, 9, 12, 2, 0.5, 'h');
    for (const [x, y, c] of [[12, 1, 'z'], [11, 2, 'y'], [13, 2, 'y'], [12, 3, 'z'], [11, 4, 'y'], [13, 4, 'x'], [12, 5, 'y'], [10, 3, 'y'], [11, 6, 'x']]) p.set(x, y, c);
    layer(p, (l) => l.ellipse(7.5, 10, 6.3, 3.8, 'h'), RAMPS.sand);
    for (const [x, y] of [[4, 8], [7, 7], [10, 8]]) { p.set(x, y, 'g').set(x + 1, y + 1, 'g').set(x - 1, y + 1, 'i').set(x, y + 2, 'i'); }
    p.set(3, 9, 'w');
    return out(p);
  },
  essence() { // gloom wisp-orb with a curling tail
    const p = P();
    layer(p, (l) => l.ellipse(7.5, 10, 4.6, 4.3, 'M'), RAMPS.gloom);
    p.ellipse(7, 9.5, 2.2, 2, 'L'); p.set(5, 8, 'w').set(6, 7, 'w').set(5, 7, 'L');
    for (const [x, y, c] of [[9, 5, 'M'], [10, 4, 'M'], [10, 3, 'L'], [9, 2, 'L'], [8, 1, 'M'], [11, 5, 'm'], [11, 4, 'm']]) p.set(x, y, c);
    out(p);
    for (const [x, y] of [[2, 3], [13, 8]]) p.set(x, y, 'L');
    return p;
  },
  lore: () => icon([ // knowledge page: dog-ear, torn edge, glowing rune
    'wwwwwwwwi...',
    'wiiiiiiihh..',
    'wihhhhhihgh.',
    'wiiiiiiiggg.',
    'wihhhhhhhhi.',
    'wiiiiiiiiih.',
    'wihhhhiiiiii',
    'wiiiiiiiDiih',
    'wiiiiiiDECih',
    'wiiiiCiiCiih',
    'wiiiiiiiiih.',
    'wiiiiiiiiiih',
    '.hihhihhihh.',
    '..h..h..h...',
  ]),
  resin() { // amber drop hanging from a twig
    const p = P();
    p.rect(2, 2, 12, 2, 'g'); p.rect(2, 2, 12, 1, 'h'); p.set(13, 3, 'f').set(2, 3, 'f'); p.set(4, 1, 'b').set(5, 1, 'c');
    layer(p, (l) => { poly(l, [[8, 4], [12, 10], [4, 10]], 'x'); l.ellipse(8, 10.5, 4, 3.6, 'x'); }, ['r', 'x', 'y']);
    p.ellipse(7.5, 10, 2.2, 2.2, 'y'); p.set(7, 11, 'z').set(8, 10, 'z');
    p.set(6, 7, 'w').set(5, 9, 'z');
    p.set(9, 12, 'g');
    return out(p);
  },
  frost() { // ice-crystal cluster (region material; also reads as "frost" anywhere v1 used it)
    const crystal = (x0, w, tip, bot) => {
      const l = P(), mid = x0 + (w - 1) / 2;
      for (let x = x0; x < x0 + w; x++) {
        const t = tip + Math.round(Math.abs(x - mid) * 1.6);
        for (let y = t; y <= bot; y++) l.set(x, y, x < mid - 0.6 ? 'E' : x <= mid + 0.6 ? 'D' : 'C');
      }
      return l;
    };
    const p = P();
    p.stamp(crystal(1, 4, 5, 13).outline()); p.stamp(crystal(11, 4, 4, 13).outline());
    const c = crystal(5, 6, 1, 14); c.outline(); p.stamp(c);
    for (let y = 4; y < 12; y++) p.set(7, y, 'w');
    p.set(2, 8, 'w').set(12, 7, 'w').set(2, 9, 'w');
    for (const x of [3, 4, 13, 14, 9, 10]) p.set(x, 13, 'B');
    return p;
  },
  coal() { // core coal: dark faceted lump with glowing cracks
    const p = P();
    layer(p, (l) => poly(l, [[1.5, 10], [3.5, 4.5], [8, 2], [12.5, 3.5], [14.5, 9], [12, 14], [4, 14]], 's'), ['n', 's', 't']);
    for (const [x, y] of [[5, 5], [6, 4], [9, 4], [4, 6]]) p.set(x, y, 'u');
    for (const [x, y, c] of [[4, 8, 'x'], [5, 8, 'y'], [6, 9, 'y'], [7, 9, 'z'], [8, 9, 'z'], [9, 8, 'y'], [10, 7, 'x'], [11, 6, 'x'],
      [8, 10, 'y'], [8, 11, 'x'], [9, 12, 'x'], [7, 6, 'x'], [7, 7, 'y'], [11, 10, 'r'], [12, 11, 'r']]) p.set(x, y, c);
    return out(p);
  },
  warmth() { // hearth-warmth coal (lit). Compact so 7 can ring the Hearth icon.
    const p = P();
    layer(p, (l) => poly(l, [[3, 9], [5, 5], [9, 4], [12.5, 6], [13, 10], [10.5, 13], [5, 13]], 'x'), ['r', 'x', 'y']);
    for (const [x, y, c] of [[6, 7, 'z'], [7, 6, 'z'], [7, 7, 'w'], [8, 9, 'z'], [9, 8, 'y'], [10, 10, 'y'], [6, 10, 'y']]) p.set(x, y, c);
    p.set(4, 3, 'y').set(11, 2, 'x');
    return out(p);
  },
  warmth_off() {
    const p = P();
    layer(p, (l) => poly(l, [[3, 9], [5, 5], [9, 4], [12.5, 6], [13, 10], [10.5, 13], [5, 13]], 's'), ['n', 's', 't']);
    for (const [x, y, c] of [[6, 7, 'u'], [7, 6, 't'], [8, 9, 'n'], [9, 10, 'n'], [10, 9, 'n']]) p.set(x, y, c);
    return out(p);
  },
  shard: () => icon([ // hero shard: tall broken crystal splinter + sparkle
    '......w......',
    '.....woH.....',
    '.....oHR.....',
    '....ooHRR....',
    '....oHRRR..z.',
    '...ooHRRr.zwz',
    '...oHRRRr..z.',
    '..ooHRRrr....',
    '..oHRRRrr....',
    '.ooHRRrr.....',
    '.oHRRrrr.....',
    '..oR.Rr......',
    '...o..r......',
  ]),
  // ── loops / currencies ──
  trail() { // signpost: "New Trail" expedition tokens
    const p = P();
    p.rect(7, 3, 2, 11, 'g'); p.rect(7, 3, 1, 11, 'h');
    put(p, ['hhhhhhhhi.', 'iiiiiiiiih', 'ggggggggf.'], 4, 2); p.set(13, 3, 'g');
    put(p, ['.ihhhhhhh', 'hiiiiiiii', '.ggggggff'], 2, 7); p.set(2, 8, 'h');
    p.set(5, 3, 'f').set(9, 3, 'f').set(5, 8, 'f').set(9, 8, 'f');
    p.rect(4, 14, 8, 1, 'c'); p.set(5, 13, 'd').set(10, 13, 'c').set(6, 14, 'b');
    return out(p);
  },
  bounty: () => icon([
    '.hhhhhhhhhhh.',
    'gihhhhhhhhhhg',
    '.giiiiiiiiig.',
    '..iwwiiiiih..',
    '..ihhhhhhih..',
    '..iiiiiiiih..',
    '..ihhhhhih...',
    '..iiiiRRRi...',
    '..ihhRoRRr...',
    '..iiiRRRrr...',
    '.hhhhhrrrhhh.',
    'giiiiirgriiig',
    '.ggggg.r.ggg.',
  ]),
  chronicle: () => icon([
    '..rRRRRRRRRR.',
    '.rRoooooooRRi',
    '.rRoRRRRRRRii',
    '.rRoRRyyRRRii',
    '.rRoRyzzyRRii',
    '.rRoRyzwyRRii',
    '.rRoRRyyRRRii',
    '.rRoRRRRRRRii',
    'yyRoRRRRRRRii',
    'xyRoRRRRRRRii',
    '.rRoRRRRRRRih',
    '.rrrrrrrrrrhg',
    '..ggggggggggg',
  ]),
  garrison: () => icon([
    '....RR.......',
    '...Rov.......',
    '..vvvvu......',
    '.vuukku......',
    '.vuuuut......',
    'uu.uuu.uu.uut',
    'uvtuvttuvtuvt',
    'uvvvvvvvvvvtt',
    '.uuuuuuuuuut.',
    '.uvuuuskuuut.',
    '.uuuuukkuuut.',
    '.uvuuuuuuuts.',
    '.ttttttttts..',
  ]),
  dispatch: () => icon([ // winged boot
    '........w.wv..',
    '.ggggg.wvwvu..',
    '.hhhhgwvvvu...',
    '.hiihgvvvu....',
    '.hiihguuu.....',
    '.hiihg........',
    '.hihhg........',
    '.hihhhhgg.....',
    '.hihhhhhhgg...',
    '.hiiiiiihhhg..',
    'ffffffffffff..',
    '.ffffffffff...',
  ]),
  extract: () => icon([
    '......h.......',
    '......hwww....',
    '......hwvvw...',
    '......hwvvvw..',
    '......hwvvvvw.',
    '......huuuuuu.',
    '......h.......',
    'hhhhhhhhhhhhhh',
    'giiiiiiiiiiiig',
    '.ggggggggggggg',
    '..ffffffffff..',
    'DDCDDCCDDCDDCC',
  ]),
  village: () => icon([
    '......R.......',
    '.....RoR......',
    '....RooRR.....',
    '...RooRRRR....',
    '..RooRRRRRR...',
    '.RRRRRRRRRRR..',
    'rrrrrrrrrrrrr.',
    '.iiiiiiiiiih..',
    '.iwwiiiggih...',
    '.iyyiiigfih...',
    '.iyxiiigfih...',
    '.iiiiiigfih...',
    '.hhhhhhgfhh...',
  ], 1),
  hero: () => icon([
    '.....RRo....',
    '....RRoo....',
    '...vvvRvu...',
    '..vwvvvvuu..',
    '.vwvvvvvvut.',
    '.vvvvvvvvut.',
    '.yyyyyyyyyx.',
    '.uvkkkkkkut.',
    '.uvuuukuuut.',
    '.uvvvvkuuut.',
    '.tuuuukuutt.',
    '..ttttttts..',
  ]),
  book: () => icon([
    '..wwwi..iwww..',
    '.wwiiihhiiiiv.',
    '.wihhhihihhhv.',
    '.wiiiiihiiiiv.',
    '.wihhhihihhhv.',
    'Cwiiiiihiiiivu',
    'Cwihhhihihhhvu',
    'CwiiiiihiiiivB',
    'CiiiiiigiiiiiB',
    'CCCCCCRRCCCCBB',
    '.BBBBBRRBBBBB.',
    '......R.......',
  ]),
  map: () => icon([
    'iiii.....iiii.',
    'iwiihhhhiiiih.',
    'iiDDhihhhicih.',
    'iDDDhiccccch..',
    'iDDhhiccdcih..',
    'iDhhiiiccihh..',
    'ihhciiiiihRhRh',
    'ihhcciiihhhRhh',
    'ihcccciihhRhRh',
    'ihhcciiihhhhhh',
    'ihhhhiihhhhhh.',
    'hh...hhhh...h.',
  ]),
  research: () => icon([
    '....ggh....',
    '....uvu....',
    '....uwt....',
    '....uvt....',
    '...uvvvt...',
    '..uvvvvvt..',
    '.uvwEEDDDt.',
    'uvEEwDDDDCt',
    'uEEDDDwDCCt',
    'uDDDwDDDCCt',
    'uDDDDDCCCBt',
    '.tDCCCCCBt.',
    '..ttttttt..',
  ]),
  forge: () => icon([
    '..........z...',
    '.........zyz..',
    'vvvvvvvvvvz...',
    'wvvvvvvvvuut..',
    '.uuuuuuuuttt..',
    '..ttuuuutss...',
    '....tuuts.....',
    '....stts......',
    '...ttttttt....',
    '..sssssssss...',
    '.hhhhhhhhhhh..',
    '.giiiiiiiihg..',
    '.ggggggggggf..',
  ], 1),
  market: () => icon([
    'RRwwRRwwRRwwRR',
    'RowwRowwRowwRo',
    'rrvvrrvvrrvvrr',
    '.h..........g.',
    '.h..........g.',
    '.h..yz.Rc...g.',
    '.h.yxzyRRdc.g.',
    'hhhhhhhhhhhhhg',
    'giiiiiiiiiiiig',
    'ghhhhhhhhhhhhf',
    'gffffffffffff.',
    '.g..........f.',
  ]),
  storage: () => icon([ // crate with iron corners + a grain sack beside it
    '....uiiiiiiiu.',
    '....ihhhhhhhh.',
    '....ugggggggt.',
    '....hhhhhfhhg.',
    '.ii.hhhhfhhhg.',
    'iwhihhhfhhhhg.',
    'ihhihhfhhhhhg.',
    'ihhhhfhhhhhhg.',
    'ihhhfhhhhhhhg.',
    'ihhhthhhhhhht.',
    '.ggguffffffft.',
  ]),
  vault() {
    const p = P();
    layer(p, (l) => disc(l, 8, 8, 6.6, 'u'), RAMPS.steel);
    ring(p, 8, 8, 4.6, 5.4, 's');
    disc(p, 8, 8, 4.4, 't'); ring(p, 8, 8, 3.4, 4.4, 'u', -Math.PI, -Math.PI / 2);
    for (const [dx, dy] of [[0, -3], [0, 3], [-3, 0], [3, 0]]) thick(p, 7.5, 7.5, 7.5 + dx * 0.9, 7.5 + dy * 0.9, 0.5, 'y');
    disc(p, 8, 8, 1.4, 'x'); p.set(7, 7, 'z');
    for (const [x, y] of [[8, 1], [2, 8], [13, 8], [8, 14]]) p.set(x, y, 'v');
    p.set(4, 3, 'w');
    return out(p);
  },
  gear_weapon: () => icon([
    '......w.......',
    '.....wvu......',
    '.....wvu......',
    '.....wvu......',
    '.....wvu......',
    '.....wvu......',
    '.....wvu......',
    '.....wvt......',
    '..zyyyyyyx....',
    '..xxxxyxxr....',
    '.....hg.......',
    '.....hg.......',
    '.....yx.......',
  ], 1),
  gear_armor: () => icon([
    '.vvv......uut.',
    'vwvvu....uuutt',
    'vvvvuvvvvuuutt',
    'uvvvvwvvvvuutt',
    '.uvvvwvuvvuut.',
    '..vvvwvuvvut..',
    '..vvvwvuvvut..',
    '..yyyyyyyyyx..',
    '..uvvvvuvvut..',
    '..uvvvvuvvut..',
    '...uvvvuvut...',
    '....tttttt....',
  ]),
  gear_charm() {
    const p = P();
    ring(p, 8, 5.5, 3.2, 4.2, 'y', -Math.PI, 0); p.set(4, 6, 'x').set(11, 6, 'x').set(4, 5, 'y').set(11, 5, 'x');
    p.set(5, 3, 'z');
    layer(p, (l) => { poly(l, [[8, 6.5], [12.5, 10.5], [8, 15], [3.5, 10.5]], 'y'); }, RAMPS.fire);
    put(p, ['.D.', 'DEC', 'DCB', '.B.'], 7, 9); p.set(7, 10, 'w');
    return out(p);
  },
  star() {
    const p = P();
    layer(p, (l) => poly(l, starPts(8, 8.6, 7.4, 3.1), 'y'), RAMPS.fire);
    p.set(7, 4, 'z').set(7, 5, 'w').set(6, 7, 'z');
    return out(p);
  },
  star_off() {
    const p = P();
    layer(p, (l) => poly(l, starPts(8, 8.6, 7.4, 3.1), 's'), ['n', 's', 't']);
    return out(p);
  },
  relocate() {
    const p = P();
    layer(p, (l) => {
      l.rect(7, 3, 2, 10, 'v'); l.rect(3, 7, 10, 2, 'v');
      poly(l, [[8, 0.5], [11.5, 4], [4.5, 4]], 'v'); poly(l, [[8, 15.5], [11.5, 12], [4.5, 12]], 'v');
      poly(l, [[0.5, 8], [4, 4.5], [4, 11.5]], 'v'); poly(l, [[15.5, 8], [12, 4.5], [12, 11.5]], 'v');
    }, ['u', 'v', 'w']);
    p.set(7, 7, 'C').set(8, 7, 'C').set(7, 8, 'C').set(8, 8, 'B');
    return out(p);
  },
  rebuild() { // hammer over a brick pile
    const p = P();
    const brick = (x, y, w) => { p.rect(x, y, w, 2, 'R'); p.rect(x, y, w, 1, 'o'); p.set(x + w - 1, y + 1, 'r'); };
    brick(1, 12, 5); brick(6, 12, 5); brick(11, 12, 4); brick(3, 10, 5); brick(8, 10, 5);
    thick(p, 3, 9, 9, 3, 0.8, 'g'); for (const [x, y] of [[3, 8], [4, 7], [5, 6], [6, 5]]) p.set(x, y, 'h');
    layer(p, (l) => poly(l, [[6.5, 2.5], [9.5, -0.5], [14.5, 4.5], [11.5, 7.5]], 'u'), RAMPS.steel);
    p.set(9, 1, 'w');
    return out(p);
  },
  clock() {
    const p = P();
    layer(p, (l) => disc(l, 8, 8, 6.8, 'y'), RAMPS.fire);
    disc(p, 8, 8, 5.2, 'w'); ring(p, 8, 8, 4.4, 5.2, 'v', 0, Math.PI);
    for (const [x, y] of [[7, 3], [12, 7], [7, 12], [3, 7]]) p.set(x, y, 't');
    p.rect(7, 4, 1, 4, 'k'); p.rect(8, 7, 3, 1, 'k'); p.set(7, 7, 'R');
    p.set(4, 3, 'z');
    return out(p);
  },
  goal: () => icon([
    '.z..........',
    'zyz.........',
    '.h..........',
    '.hRRRRo.....',
    '.hRooRRRRo..',
    '.hRoRRRRRRR.',
    '.hRRRRRRrr..',
    '.hRRrrrr....',
    '.hr.........',
    '.h..........',
    '.h..........',
    'cdcc........',
    'bbccc.......',
  ], 1),
  gift: () => icon([
    '..RR...RR....',
    '.RooR.RoRR...',
    '.RooyyyRRR...',
    '..RRyzyRR....',
    'iiiiiyziiiiih',
    'iwwiiyziiiiih',
    'hhhhhyxhhhhhg',
    '.RoRRyzRRRRr.',
    '.RoRRyzRRRRr.',
    '.RRRRyxRRRRr.',
    '.RRRRyxRRRrr.',
    '.rrrryxrrrrr.',
  ]),
  blessing() {
    const p = P();
    layer(p, (l) => poly(l, starPts(9, 8, 6.6, 1.7, 4), 'y'), RAMPS.fire);
    disc(p, 9, 8, 1.6, 'z'); p.set(8, 7, 'w').set(9, 7, 'w').set(8, 8, 'w');
    put(p, ['.z.', 'zwz', '.z.'], 1, 1); put(p, ['.y.', 'yzy', '.y.'], 2, 11);
    return out(p);
  },
  achievement() {
    const p = P();
    put(p, ['BB...RR', 'CBB.RRo', '.CBRRo.', '..CBo..', '...C...'], 4, 0);
    layer(p, (l) => disc(l, 8, 10, 4.9, 'y'), RAMPS.fire);
    ring(p, 8, 10, 3.2, 3.9, 'x');
    poly(p, starPts(8, 10, 2.8, 1.2), 'z'); p.set(7, 9, 'w');
    p.set(5, 7, 'w');
    return out(p);
  },
  cosmetic() { // paint brush with a fresh pink stroke
    const p = P();
    thick(p, 9, 6, 13, 2, 0.9, 'g'); for (const [x, y] of [[10, 4], [11, 3], [12, 2], [13, 1]]) p.set(x, y, 'h');
    thick(p, 7, 8, 9, 6, 1.0, 'u'); p.set(7, 7, 'v').set(8, 6, 'v').set(9, 7, 't');
    poly(p, [[4.5, 8.5], [7, 7.5], [8.5, 10], [3, 13]], 'i'); p.set(6, 8, 'w');
    poly(p, [[3.4, 10.6], [6.5, 10.6], [2.5, 14]], 'H'); p.set(4, 11, 'o').set(3, 13, 'r');
    put(p, ['..HHo', '.Hr..', 'Hr...'], 8, 11);
    return out(p);
  },
  threat() { // skull wreathed in gloom flame
    const p = P();
    flame(p, 8, 13, 1.75, ['m', 'M', 'L']);
    put(p, [
      '.wwwww.',
      'wwwwwvv',
      'wkkwkkv',
      'wkzwkzv',
      'wwwkwvu',
      '.vwvwu.',
      '.w.v.u.',
    ], 5, 7);
    return out(p);
  },
  region: () => icon([
    '.......w......',
    '......wwv.....',
    '.....wvvut....',
    '..w..vuuutt...',
    '.wwv.uuutttt..',
    'wvvutuuttttt..',
    'vuuutuutttsst.',
    'uuuttutttssss.',
    'uttttttsssssss',
    'cccdcccccbbbbb',
    '.bbbbbbbbbaaa.',
  ]),
  workers: () => icon([
    '.......ggg...',
    '......gffffg.',
    '..hhh.gqqqqf.',
    '.hggghqkqqkg.',
    '.gqqqgqqqqqp.',
    '.qkqkqcqppqc.',
    '.pqqqpcccccc.',
    '..ppbdccccccb',
    '.CCCcdcccccbb',
    'CDCCcccccccbb',
    'CCCCCcccccbb.',
  ], 0, 1),
  hungry() { // empty bowl + alarm mark
    const p = P();
    layer(p, (l) => { l.ellipse(7, 11, 6, 3.4, 'h'); l.rect(1, 8, 13, 3, '.'); l.rect(1, 9, 13, 2, 'h'); }, RAMPS.wood);
    p.ellipse(7, 9.5, 5.6, 1.2, 'f'); p.rect(2, 9, 11, 1, 'f'); p.rect(3, 8, 9, 1, 'i'); p.set(2, 9, 'i').set(12, 9, 'g');
    p.set(5, 10, 'i').set(9, 10, 'h');
    put(p, ['RR', 'Ro', 'RR', 'Rr', '..', 'Rr'], 13, 0);
    return out(p);
  },
  away() { // offline: crescent moon + Zz
    const p = P();
    layer(p, (l) => { disc(l, 6, 10, 5, 'D'); disc(l, 8.6, 8.4, 4.1, '.'); }, ['C', 'D', 'E']);
    p.set(3, 10, 'w');
    put(p, ['wwww', '..wv', '.wv.', 'wwvv'], 9, 1);
    put(p, ['vvv', '.v.', 'vvu'], 12, 7);
    return out(p);
  },
};

// ═════════════════════════════ 2. Beacons, moon phases, night events ═════════════════════════════
// Beacon stakes (§8.3): stone brazier bowl + flame. Tier is coded by flame SIZE and shape, not only colour
// (calm = small blue, steady = gold, fierce = big + side tongues, nightmare = purple with a skull and horns).
const FLAMES = { // hand-drawn tongues: o = outer, m = mid, i = core
  calm: ['...o...', '..oo...', '..omo..', '.oomo..', '.ommoo.', 'oommmo.', 'ommimmo', '.omiimo'],
  steady: ['....o....', '...oo....', '...omo...', '..oomo.o.', '..ommooo.', '.oommmmo.', '.ommimmoo', 'oommiimmo', 'ommiiiimo', '.omiiiimo'],
  big: ['......o......', '.....oo......', '....ooo...o..', '..o.omo..oo..', '..ooomoo.oo..', '.oommmoooomo.', '.ommmmmoommo.',
    'oommimmmmmmoo', 'ommiiimmmmimo', 'ommiiiimmiimo', 'oommiiiiiimmo', '.oommiiiimmo.'],
};
function beacon(level) {
  const p = P();
  const [shape, cols] = { calm: ['calm', 'BCE'], steady: ['steady', 'xyz'], fierce: ['big', 'rxy'], nightmare: ['big', 'mML'] }[level];
  const rows = FLAMES[shape].map((r) => r.replace(/o/g, cols[0]).replace(/m/g, cols[1]).replace(/i/g, cols[2]));
  put(p, rows, Math.floor((16 - rows[0].length) / 2), 13 - rows.length);
  if (level === 'nightmare') put(p, ['.www.', 'wwwww', 'wkwkw', '.wvw.'], 6, 6);
  if (level === 'calm') p.set(7, 9, 'w');
  if (level === 'steady') p.set(7, 7, 'w');
  if (level === 'fierce') p.set(6, 6, 'z').set(6, 7, 'z');
  layer(p, (l) => poly(l, [[2.5, 11.5], [13.5, 11.5], [11.5, 14.5], [4.5, 14.5]], 't'), RAMPS.stone);
  p.rect(3, 11, 10, 1, 'u'); p.set(3, 11, 'v').set(4, 11, 'v');
  for (let x = 5; x < 12; x += 3) p.set(x, 13, 's');
  return out(p);
}
const MOON = { lit: 'E', hi: 'w', lo: 'D', dark: 'n', rim: 'B' };
function moon(phase) {
  const p = P();
  const K = { new: [1.01, 1], crescent: [0.45, 1], half: [0, 1], gibbous: [-0.5, 1], full: [-1.01, 1], waning: [0.45, -1], blood: [-1.01, 1] }[phase];
  const cols = phase === 'blood' ? { lit: 'R', hi: 'o', lo: 'r', dark: 'r' } : MOON;
  moonDisc(p, 8, 8, 6.6, K[0], K[1], cols);
  const lit = (x, y) => p.get(x, y) === cols.lit;
  for (const [x, y] of [[9, 5], [10, 5], [6, 9], [10, 10], [11, 10], [8, 12], [12, 7]]) if (lit(x, y)) p.set(x, y, phase === 'blood' ? 'r' : 'D');
  if (phase === 'new') { for (const [x, y] of [[3, 6], [4, 4], [3, 7], [6, 2]]) p.set(x, y, 'C'); }
  if (phase === 'blood') { p.set(4, 4, 'H').set(5, 3, 'H'); out(p); for (const [x, y, c] of [[7, 15, 'r'], [10, 15, 'R']]) p.set(x, y, c); p.set(10, 14, 'R').set(7, 14, 'r'); return p; }
  return out(p);
}
const EVENTS = {
  swarm() { // three gloomlings crowding forward
    const blob = (cx, cy, r) => {
      const l = P(); l.ellipse(cx, cy, r, r * 0.9, 'M'); l.shade(RAMPS.gloom);
      l.set(Math.round(cx - r * 0.45), Math.round(cy - 0.5), 'z').set(Math.round(cx + r * 0.35), Math.round(cy - 0.5), 'z');
      return l.outline();
    };
    const p = P();
    p.stamp(blob(4, 5.5, 2.6)); p.stamp(blob(11.5, 5, 2.6)); p.stamp(blob(7.5, 10.5, 3.6));
    return p;
  },
  pincer() { // two arrows converging (a V) onto the Hearth flame
    const p = P();
    layer(p, (l) => {
      for (const sx of [1, -1]) {
        const X = (x) => (sx > 0 ? x : 15 - x);
        thick(l, X(1), 1, X(5), 5, 0.75, 'R');
        thick(l, X(6), 6, X(2.5), 6, 0.75, 'R'); thick(l, X(6), 6, X(6), 2.5, 0.75, 'R');
      }
    }, RAMPS.red);
    p.set(1, 1, 'o').set(14, 1, 'o');
    flame(p, 8, 15, 0.95); p.set(7, 12, 'w');
    return out(p);
  },
  hunters() { // a snuffer's hood looming over a small flame
    const p = P();
    layer(p, (l) => { l.ellipse(8, 7, 6.2, 5.6, 'M'); l.rect(2, 7, 13, 6, 'M'); }, RAMPS.gloom);
    p.ellipse(8, 8, 4, 4, 'k'); p.rect(4, 8, 8, 5, 'k');
    p.set(6, 7, 'z').set(10, 7, 'z').set(6, 6, 'y').set(10, 6, 'y');
    flame(p, 8, 14.5, 0.8); p.set(8, 12, 'z');
    return out(p);
  },
  short() { // short night: moon + fast-forward chevrons
    const p = P();
    layer(p, (l) => { disc(l, 5.5, 8, 4.6, 'D'); disc(l, 7.6, 6.6, 3.8, '.'); }, ['C', 'D', 'E']);
    p.set(3, 8, 'w');
    for (const ox of [7, 11]) layer(p, (l) => poly(l, [[ox, 3.5], [ox + 4, 8], [ox, 12.5], [ox, 10.5], [ox + 2, 8], [ox, 5.5]], 'y'), RAMPS.fire);
    return out(p);
  },
  rain() {
    const p = P();
    layer(p, (l) => { disc(l, 5, 6.5, 3.2, 'u'); disc(l, 9.5, 5, 4, 'u'); disc(l, 12.5, 7.5, 2.4, 'u'); l.rect(3, 6, 11, 4, 'u'); }, ['t', 'u', 'v']);
    p.set(8, 2, 'w').set(7, 3, 'w');
    for (const [x, y] of [[4, 12], [8, 11], [12, 12], [6, 14], [10, 14]]) { p.set(x, y, 'D').set(x - 1, y + 1, 'C'); }
    return out(p);
  },
};

// ═════════════════════════════ 3. Charms (§11.4) and tower modules (§11.9) ═════════════════════════════
const CHARMS = {
  owl: () => icon([ // barred owl feather
    '...........iw.',
    '..........iwih',
    '.........hiwhg',
    '........iiwhgg',
    '.......hiwihg.',
    '......iiwhgg..',
    '.....hiwihg...',
    '....iiwhgg....',
    '...hiwihg.....',
    '...iwhgg......',
    '..hwhg........',
    '.gh...........',
    'f.............',
  ]),
  whetstone() {
    const p = P();
    layer(p, (l) => thick(l, 3, 11, 12, 5, 2.1, 't'), RAMPS.stone);
    for (const [x, y] of [[6, 8], [9, 6], [7, 9]]) p.set(x, y, 's');
    p.set(4, 9, 'v').set(5, 8, 'v');
    put(p, ['.w.', 'wzw', '.w.'], 11, 0); p.set(2, 4, 'w').set(14, 10, 'D');
    return out(p);
  },
  chestnut() {
    const p = P();
    layer(p, (l) => { l.ellipse(8, 10.5, 5.6, 4.2, 'g'); poly(l, [[4, 9], [8, 4.5], [12, 9]], 'g'); }, RAMPS.wood);
    p.rect(4, 12, 8, 1, 'i'); p.rect(5, 13, 6, 1, 'i'); p.set(4, 12, 'h').set(11, 12, 'h'); p.set(5, 13, 'h');
    p.set(6, 7, 'i').set(5, 8, 'i');
    flame(p, 8, 5.5, 0.6);
    return out(p);
  },
  tinkerlock() {
    const p = P();
    layer(p, (l) => {
      disc(l, 8, 8, 5, 'y');
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; thick(l, 7.5 + Math.cos(a) * 4.4, 7.5 + Math.sin(a) * 4.4, 7.5 + Math.cos(a) * 5.9, 7.5 + Math.sin(a) * 5.9, 1.1, 'y'); }
    }, RAMPS.fire);
    disc(p, 8, 7, 1.6, 'k'); p.rect(7, 8, 2, 3, 'k');
    p.set(5, 4, 'w');
    return out(p);
  },
  shell() {
    const p = P();
    layer(p, (l) => l.ellipse(7.5, 8, 6.2, 5.8, 'h'), RAMPS.sand);
    for (let t = 0; t < 7.6; t += 0.05) { const r = 0.6 + t * 0.66; p.set(Math.round(7.5 + Math.cos(t + 2) * r - 0.5), Math.round(8 + Math.sin(t + 2) * r * 0.95 - 0.5), 'g'); }
    p.set(7, 7, 'f');
    put(p, ['.HH', 'HoH', 'HHr'], 12, 11); p.set(3, 4, 'w');
    return out(p);
  },
  windchime() {
    const p = P();
    p.rect(1, 2, 14, 2, 'g'); p.rect(1, 2, 14, 1, 'h'); p.set(7, 1, 'g').set(8, 1, 'g'); p.set(7, 0, 'y');
    for (const [x, len] of [[2, 7], [5, 9], [10, 8], [13, 6]]) {
      p.set(x, 4, 'u'); p.set(x + (x > 8 ? 0 : 0), 5, 'u');
      for (let y = 6; y < 6 + len; y++) { p.set(x - 1 + (x > 8 ? 1 : 0), y, 'v'); p.set(x + (x > 8 ? 1 : 0), y, 't'); }
      p.set(x - 1 + (x > 8 ? 1 : 0), 6, 'w');
    }
    p.set(8, 4, 'u').set(8, 5, 'u').set(8, 6, 'u'); disc(p, 8, 8, 1.3, 'y'); p.set(7, 7, 'z');
    return out(p);
  },
  cateye() {
    const p = P();
    layer(p, (l) => poly(l, [[0.5, 8], [4, 4.5], [8, 3.5], [12, 4.5], [15.5, 8], [12, 11.5], [8, 12.5], [4, 11.5]], 'd'), ['c', 'd', 'e']);
    p.ellipse(8, 8, 3.2, 3.6, 'y'); p.set(6, 6, 'z').set(7, 5, 'z');
    p.rect(7, 4, 2, 9, 'k'); p.set(7, 4, 'y').set(8, 12, 'y');
    p.set(9, 6, 'w');
    return out(p);
  },
  hunger: () => icon([ // paper talisman with a red fang glyph
    '.....g......',
    '....g.g.....',
    '..wwwwwwww..',
    '..wiiiiiih..',
    '..wRRRRRRh..',
    '..wiRiiRih..',
    '..wiRiiRih..',
    '..wiiRRiih..',
    '..wiiiiiih..',
    '..wiiRRiih..',
    '..wiRRRRih..',
    '..wiiRRiih..',
    '..wiih.iih..',
    '..hh.....h..',
  ]),
  icecore() {
    const p = P();
    layer(p, (l) => disc(l, 8, 9.5, 5.4, 'D'), ['C', 'D', 'E']);
    put(p, ['..w..', 'w.E.w', '.EwE.', 'w.E.w', '..w..'], 6, 7);
    p.set(5, 6, 'w').set(6, 5, 'w');
    p.rect(6, 2, 4, 2, 'u'); p.rect(6, 2, 4, 1, 'v'); p.set(9, 3, 't'); ring(p, 8, 1.5, 0.6, 1.5, 'y', -Math.PI, 0);
    return out(p);
  },
  luckycoin() {
    const p = P();
    layer(p, (l) => disc(l, 7, 7, 5.8, 'y'), RAMPS.fire);
    ring(p, 7, 7, 3.6, 4.4, 'x');
    p.rect(6, 6, 2, 2, '.');
    p.set(4, 3, 'w').set(3, 4, 'z');
    thick(p, 11, 11, 13, 14, 0.5, 'R'); p.set(12, 11, 'R').set(13, 12, 'R'); p.set(12, 14, 'r').set(14, 13, 'r').set(13, 14, 'r');
    return out(p);
  },
  phoenix: () => icon([ // fire feather, flame tip
    '..z..........',
    '.zyz.........',
    '.yxyz........',
    '.xyzyy.......',
    '..xyzyR......',
    '...xyzRR.....',
    '...RyzyRR....',
    '....RyzRRr...',
    '.....RyzRr...',
    '......RyRrr..',
    '.......Ryrr..',
    '........Rhr..',
    '..........h..',
    '...........g.',
  ]),
  fuse() {
    const p = P();
    for (let t = 0; t < Math.PI * 2; t += 0.05) { const x = 6.5 + Math.cos(t) * 4, y = 10 + Math.sin(t) * 3; disc(p, x, y, 1.15, Math.sin(t * 5) > 0 ? 'h' : 'g'); }
    p.ellipse(6.5, 10, 2, 1, '.');
    thick(p, 10, 8, 12, 4, 0.55, 'h'); p.set(11, 6, 'g');
    put(p, ['.z.', 'zwz', '.y.'], 11, 1); p.set(14, 1, 'y').set(14, 4, 'x');
    return out(p);
  },
};
const MODULES = {
  split() { // forked arrowhead: one shaft, two steel heads
    const p = P();
    thick(p, 2, 13, 7, 8, 0.85, 'h'); thick(p, 7, 8, 10, 3, 0.75, 'h'); thick(p, 7, 8, 11, 9, 0.75, 'h');
    p.set(3, 12, 'i').set(4, 11, 'i').set(5, 10, 'i');
    layer(p, (l) => { poly(l, [[14.5, 0.5], [8.5, 2.5], [12.5, 6.5]], 'u'); poly(l, [[15.5, 10], [10.5, 6.5], [10.5, 13]], 'u'); }, RAMPS.steel);
    p.set(13, 1, 'w').set(12, 9, 'w');
    put(p, ['R..', 'oR.', '.Rr'], 1, 11); p.set(1, 14, 'r');
    return out(p);
  },
  barb() { // barbed iron head with a red drip
    const p = P();
    layer(p, (l) => poly(l, [[12.5, 1.5], [10.5, 9.5], [8.5, 7.5], [7.5, 10], [5.5, 8], [7, 6.5], [4.5, 6], [9, 3]], 'u'), RAMPS.steel);
    thick(p, 3, 13, 7, 9, 0.6, 'g');
    p.set(11, 3, 'w').set(10, 4, 'w');
    put(p, ['R', 'R', 'r'], 12, 11); put(p, ['R', 'r'], 9, 12);
    return out(p);
  },
  frostoil: () => icon([
    '....gh....',
    '....ff....',
    '....uv....',
    '....vt....',
    '...uvvt...',
    '..uEEEDt..',
    '.uEwEDDCt.',
    '.uEEDDDCt.',
    '.uEDDDDCt.',
    '.uDDwDCCt.',
    '.uDDDCCBt.',
    '.uDCCCBBt.',
    '..tttttt..',
  ], -2, 0),
  scope() {
    const p = P();
    layer(p, (l) => { thick(l, 9, 7, 13, 3, 2.4, 'y'); thick(l, 5, 11, 9, 7, 1.7, 'y'); thick(l, 2, 14, 5, 11, 1.1, 'y'); }, RAMPS.fire);
    thick(p, 8, 8, 10, 6, 0.6, 'x'); thick(p, 4, 12, 5, 11, 0.5, 'x');
    put(p, ['.E.', 'EDC', '.C.'], 12, 1); p.set(12, 1, 'w');
    return out(p);
  },
  winch() {
    const p = P();
    layer(p, (l) => {
      disc(l, 7, 7, 4.5, 'u');
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 + 0.39; thick(l, 6.5 + Math.cos(a) * 4, 6.5 + Math.sin(a) * 4, 6.5 + Math.cos(a) * 5.6, 6.5 + Math.sin(a) * 5.6, 1, 'u'); }
    }, RAMPS.steel);
    disc(p, 7, 7, 1.6, 's'); p.set(6, 6, 'v');
    thick(p, 7, 7, 12, 12, 0.6, 't'); p.set(9, 9, 'u');
    p.rect(12, 11, 3, 4, 'g'); p.rect(12, 11, 1, 4, 'h');
    return out(p);
  },
  coalcore() {
    const p = P();
    layer(p, (l) => disc(l, 8, 8, 6, 's'), ['n', 's', 't']);
    disc(p, 8, 8, 3, 'x'); disc(p, 7.6, 7.6, 2, 'y'); p.set(7, 7, 'z').set(6, 7, 'w');
    for (let i = 2; i < 14; i++) { if (p.get(i, 8) !== 'z' && Math.abs(i - 8) > 2) p.set(i, 8, 'u'); if (Math.abs(i - 8) > 2) p.set(8, i, 'u'); }
    p.set(2, 8, 'v').set(8, 2, 'v');
    return out(p);
  },
  hawkeye: () => icon([
    'gg..........gg',
    'hgg........ggf',
    'ihhg..ww..ghgf',
    '.ihhgwwwvghhg.',
    '..iwwyyyywhg..',
    '..wwyykkyvv...',
    '..vwyykzyvt...',
    '...vvyyyyvt...',
    '....vvvvtt....',
  ]),
  bulwark: () => icon([
    'uu.uuu.uuu.uu',
    'uvtuvttuvttuv',
    'uvvvvvvvvvvvt',
    'uvRRRRoRRRRut',
    'uvRoRRoRRRrut',
    'uvRRRRoRRRrut',
    'uvoooyzyoooot',
    'uvRRRRyRRRrut',
    'uvRRRRoRRRrut',
    '.uvRRRoRRrut.',
    '..uvRRoRrut..',
    '...uvRoRut...',
    '....ttttt....',
  ]),
};

// ═════════════════════════════ 4. Research nodes (§11.8): 3 branches × 8 ═════════════════════════════
// Branch is coded by medallion COLOUR and SHAPE: Fortification = stone-grey octagon, Flame = orange flame-drop,
// Stewardship = green disc. The glyph sits on a dark sunken face so it reads at 1×.
const BRANCHES = [
  { ramp: ['s', 't', 'u'], hi: 'v', cy: 7, glints: [[3, 2], [4, 2], [2, 3], [2, 4]],
    mask: (l) => poly(l, [[1, 3], [3, 1], [13, 1], [15, 3], [15, 9], [8, 15.5], [1, 9]], 't') },
  { ramp: ['r', 'x', 'y'], hi: 'z', cy: 10, glints: [[7, 2], [6, 4], [5, 5]],
    mask: (l) => { disc(l, 8, 9.6, 5.9, 'x'); poly(l, [[3.2, 7.5], [8, 0.6], [12.8, 7.5]], 'x'); } },
  { ramp: ['b', 'c', 'd'], hi: 'e', cy: 9, glints: [[4, 5], [3, 6], [5, 4], [4, 2]],
    mask: (l) => { disc(l, 8, 9, 6.3, 'c'); l.ellipse(5, 2.6, 2.6, 1.4, 'c'); l.ellipse(11, 2.6, 2.6, 1.4, 'c'); l.rect(7, 2, 2, 2, 'c'); } },
];
function medallion(b, glyph) {
  const B = BRANCHES[b], p = P();
  layer(p, B.mask, B.ramp);
  // sunken face = mask eroded by 2px; its top/left lip is shadowed, bottom/right lip catches light
  const inner = (x, y, d) => { for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) if (Math.abs(i) + Math.abs(j) <= d && p.get(x + i, y + j) === '.') return false; return true; };
  const face = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inner(x, y, 2)) face.push([x, y]);
  const isFace = new Set(face.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of face) {
    const up = !isFace.has(`${x},${y - 1}`) || !isFace.has(`${x - 1},${y}`), dn = !isFace.has(`${x},${y + 1}`) || !isFace.has(`${x + 1},${y}`);
    p.set(x, y, up ? 'k' : dn ? B.ramp[0] : 'n');
  }
  const g = glyph(); p.stamp(g, Math.round(8 - g.w / 2), Math.round(B.cy - g.h / 2));
  for (const [x, y] of B.glints) if (p.get(x, y) !== 'n' && p.get(x, y) !== 'k' && p.get(x, y) !== '.') p.set(x, y, B.hi); // rim glints, lit side
  if (b === 2) p.set(8, 4, 'a').set(7, 4, 'b');
  return out(p);
}
const gl = (rows) => () => { const w = Math.max(...rows.map((r) => r.length)); const q = P(w, rows.length); put(q, rows); return q; };
const RESEARCH = [
  [ // Fortification
    gl(['.....c.', '....cdc', 'vvuvvc.', 'tsttts.', 'vvvuvvv', 'ststtst']),                               // walls +15% HP
    gl(['v.v....', 'vvv....', '.vu....', '..vu...', '...vyy.', '...yzyy', '...ykky', '....yx.']),             // repair −30%
    gl(['.vvvvv.y.', 'vtttttyzy', 'vtutututy', 'vtututut.', 'vuuuuuuu.', 'vtututut.', 'sssssssss']),          // auto gate
    gl(['R..R..R', 'v..v..v', 'v.vt.vt', 'vtvtvtv', 'hhhhhhh', 'ggggggg']),                                // traps +25%
    gl(['vvuvv....', 'ttstt....', 'vvkvvhhhv', 'ttktt....', 'vvuvv....', 'ttstt....']),                      // loopholes
    gl(['v.v.v.v', 'vvvvvvv', '.vtttu.', '.vtkts.', '.vtttu.', '.vtttu.']),                                 // towers +10%
    gl(['..vvuvvv', '..ttsttt', 'vvuvvvuv', 'ttsttsts', 'vvvuvvv.', 'tttsttt.']),                         // double wall
    gl(['vvvvvvv', 'vuuzuut', 'vuzzuut', 'vuuzzut', '.vuzut.', '..vut..']),                                // last stand
  ],
  [ // Flame
    gl(['y..y..y', '.......', '..xzx..', '..xyx..', '.ttttt.', '..tst..']),                               // brazier +radius
    gl(['..x...x..', '.xyx.xyx.', '.yzy.yzy.', '.........', 'ghhhhhhhi', '.fffffff.']),                     // fuel: 1 wood → 2 braziers
    gl(['...x...', '..xyx..', '..yzy..', '.......', '.wwwww.', 'wwkDkww', '.wwwww.']),                     // signal fire: reveals veiled
    gl(['RR.RR..', 'RoRRRr.', 'RRRRRr.', '.RRRr.x', '..Rr.xy', '....yzy']),                                // heal in light
    gl(['.x.....x.', 'xyx.x.xyx', 'yzyxyxyzy', '.yzyzyzy.', 'ttttttttt', '.vtttttt.']),                     // twin-coal brazier
    gl(['.CC......', 'CnnC..z..', 'CnnC..zz.', '.CC.zzzzz', '......zz.', '......z..']),                       // +range on new moon
    gl(['.zzzzz.', 'z..x..z', '..xyx..', '..yzy..', '.xyzyx.', '.xyzyx.']),                                 // holy fire
    gl(['...y...', 'y..y..y', '.zzzzz.', 'zzwzzzz', 'BBBBBBB', 'CCCCCCC']),                                 // early dawn
  ],
  [ // Stewardship
    gl(['......d..', 'iiiii.ded', 'ihhhg..d.', 'ihfhg....', 'ihhfg....', 'ggggg....']),                     // storage +200
    gl(['.gg...d.', 'gqqg.ddd', 'qkqk..d.', 'qqqq..d.', '.cc...d.', 'cccc....']),                           // villagers +15%
    gl(['.DD.....', 'D....vv.', 'D...vt.v', '.DD.gv..', '...g....', '..g.....']),                           // night shift
    gl(['..yyy...', '.ywwwy..', 'ywwkwwy.', 'ywwkkwyd', '.ywwwyddd', '..yyy..d.']),                         // offline 12 h
    gl(['ihhhhhhh.', 'hggggggg.', '.ggggggg.', '.tut.tut.', '.utu.utu.', '..t...t..']),                     // cart
    gl(['.hh...d.', '.hh..ddd', '.hh...d.', '.hhhh...', '.hhhhhh.', 'ffffff..']),                           // +1 dispatch slot
    gl(['..gg...', '.g..g..', 'hhhhhhh', 'hiyyiih', 'hihhiih', 'hiiiiih', '.ggggg.']),                     // traveler +2 items
    gl(['.....z.', '....zwz', 'yyy..z.', 'zzzy...', 'yyyx.y.', 'zzzy.z.', 'xxxx...']),                     // prosperity
  ],
];

// ═════════════════════════════ 5. Frames, badges and Hold UI pieces ═════════════════════════════
// Sink the interior of a filled shape: pixels ≥ d steps from the edge become `fill`, with a shadowed top/left lip
// and a lit bottom/right lip (reads as a recessed face).
function sink(p, d, fill = 'n', lipDark = 'k', lipLit = null) {
  const inside = (x, y) => { for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) if (Math.abs(i) + Math.abs(j) <= d && p.get(x + i, y + j) === '.') return false; return true; };
  const face = new Set();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) !== '.' && inside(x, y)) face.add(y * p.w + x);
  const f = (x, y) => face.has(y * p.w + x);
  for (const k of face) {
    const x = k % p.w, y = (k / p.w) | 0;
    p.set(x, y, !f(x, y - 1) || !f(x - 1, y) ? lipDark : lipLit && (!f(x, y + 1) || !f(x + 1, y)) ? lipLit : fill);
  }
  return p;
}
const RARITY = { common: { hi: 'v', m: 'u', lo: 't', d: 's' }, rare: { hi: 'D', m: 'C', lo: 'B', d: 'B' }, epic: { hi: 'L', m: 'M', lo: 'm', d: 'm' } };
// Gear item frame (24×24, 16×16 interior). Rarity is coded by corner SHAPE too: rivet / gem / gold gem + spikes.
function gearFrame(r) {
  const R = RARITY[r];
  const p = panel(24, 24, ['k', rim(R.hi, R.m, R.d), { t: R.m, l: R.m, b: R.lo, r: R.lo }, 'k'], 'n', 2);
  const corner = {
    common: ['kkkk', 'kvuk', 'kutk', 'kkkk'],
    rare: ['..k..', '.kEk.', 'kEDCk', '.kCk.', '..k..'],
    epic: ['..k..', '.kzk.', 'kzyxk', '.kxk.', '..k..'],
  }[r];
  const n = corner.length;
  for (const [x, y] of [[0, 0], [24 - n, 0], [0, 24 - n], [24 - n, 24 - n]]) put(p, corner, x, y);
  if (r === 'epic') for (const [x, y] of [[11, 0], [12, 0], [0, 11], [0, 12], [23, 11], [23, 12], [11, 23], [12, 23]]) p.set(x, y, 'k');
  if (r === 'epic') { put(p, ['.k.', 'kyk'], 10.5 | 0, 0); p.set(12, 1, 'y'); }
  p.set(2, 2, R.hi === 'v' ? 'w' : R.hi);
  return p;
}
// Achievement badge frames: 10 shapes/metals; a 16×16 symbol icon sits on the dark face.
const METALS = { bronze: ['f', 'g', 'h', 'i'], silver: ['s', 't', 'u', 'v'], gold: ['x', 'y', 'z', 'w'], green: ['a', 'b', 'c', 'd'], blue: ['B', 'C', 'D', 'E'], purple: ['m', 'M', 'L', 'w'] };
function badge(i) {
  const W = 24, p = P(W, W);
  const shapes = [
    ['disc', 'bronze'], ['disc', 'silver'], ['disc', 'gold'], ['shield', 'silver'], ['shield', 'gold'],
    ['hex', 'green'], ['hex', 'blue'], ['burst', 'gold'], ['laurel', 'gold'], ['flame', 'purple'],
  ][i];
  const [shape, metal] = shapes, M = METALS[metal];
  const mask = (l) => {
    if (shape === 'disc') disc(l, 12, 12, 11, M[1]);
    if (shape === 'shield') poly(l, [[1, 3], [4, 1], [20, 1], [23, 3], [23, 13], [12, 23.5], [1, 13]], M[1]);
    if (shape === 'hex') poly(l, [[12, 0.5], [22.5, 6.2], [22.5, 17.8], [12, 23.5], [1.5, 17.8], [1.5, 6.2]], M[1]);
    if (shape === 'burst') { poly(l, starPts(12, 12, 11.6, 8.6, 8, -Math.PI / 2), M[1]); disc(l, 12, 12, 9, M[1]); }
    if (shape === 'laurel' || shape === 'flame') disc(l, 12, 12.5, 8.6, M[1]);
  };
  if (shape === 'laurel') { // leaves around a gold ring
    for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {
      const a = Math.PI / 2 + sx * (0.35 + k * 0.42), cx = 12 + Math.cos(a) * 10, cy = 12.5 + Math.sin(a) * 10;
      p.ellipse(cx, cy, 1.6, 1.6, k % 2 ? 'c' : 'b'); p.set(Math.round(cx - 0.5), Math.round(cy - 1), 'd');
    }
  }
  if (shape === 'flame') { // fire tongues around a purple ring
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 4, cx = 12 + Math.cos(a) * 9.4, cy = 12.5 + Math.sin(a) * 9.4;
      disc(p, cx, cy, 2.2, 'x'); disc(p, cx - Math.cos(a) * 0.6, cy - Math.sin(a) * 0.6, 1.3, 'y');
    }
  }
  layer(p, mask, [M[0], M[1], M[2]]);
  sink(p, 3, 'n', 'k', null);
  if (shape === 'burst') { disc(p, 12, 12, 7.2, 'n'); ring(p, 12, 12, 6.4, 7.2, 'k', -Math.PI, -Math.PI / 2 + 0.4); }
  if (shape === 'disc' || shape === 'laurel' || shape === 'flame') { p.set(5, 6, M[3]).set(6, 5, M[3]); }
  if (shape === 'hex') { p.set(11, 2, M[3]).set(9, 3, M[3]); for (const [x, y] of [[2, 12], [21, 12]]) p.set(x, y, M[0]); }
  if (shape === 'shield') { p.set(4, 2, M[3]).set(3, 3, M[3]); put(p, ['.y.', 'yzy', '.x.'], 10.5 | 0, 20); }
  if (shape === 'burst') p.set(12, 1, M[3]).set(5, 5, M[3]);
  return out(p);
}
// Bottom bar (9-slice): dark stone slab with a gold-trimmed top edge.
function bottombar() {
  const p = panel(32, 24, ['k', { t: 'y', l: 'u', b: 's', r: 's', m: 't' }, { t: 'x', l: 't', b: 's', r: 's' }, 'k', { t: 's', l: 'n', b: 'n', r: 'n' }], 'n', 2);
  p.rect(3, 1, 26, 1, 'z'); p.set(2, 1, 'y').set(29, 1, 'y');
  for (const x of [4, 27]) put(p, ['zy', 'yx'], x, 5);
  return p;
}
function tabIcon(on) {
  const p = on
    ? panel(24, 24, ['k', rim('z', 'y', 'x'), { t: 'w', l: 'w', b: 'h', r: 'h', m: 'i' }], 'i', 3)
    : panel(24, 24, ['k', rim('t', 's', 'n'), { t: 'k', l: 'k', b: 's', r: 's', m: 'n' }], 'n', 3);
  if (on) p.set(3, 3, 'w').set(4, 3, 'w').set(3, 4, 'w'); else p.set(3, 2, 'u');
  return p;
}
function chronicleBar() {
  const p = panel(24, 10, ['k', rim('h', 'g', 'f'), 'k'], 'n', 1);
  p.set(1, 1, 'i'); p.rect(3, 3, 18, 1, 'k');
  return p;
}
function chronicleNode(done) {
  const p = P(14, 14);
  layer(p, (l) => poly(l, [[7, 0.6], [13.4, 7], [7, 13.4], [0.6, 7]], done ? 'y' : 't'), done ? RAMPS.fire : RAMPS.stone);
  if (done) { poly(p, [[7, 3.5], [10.5, 7], [7, 10.5], [3.5, 7]], 'z'); put(p, ['.....', '....y', 'y..y.', '.yy..'], 5, 5); p.set(6, 3, 'w').set(5, 4, 'w'); }
  else { poly(p, [[7, 3], [11, 7], [7, 11], [3, 7]], 'n'); poly(p, [[7, 3], [11, 7], [7, 7], [3, 7]], 'k'); p.set(7, 4, 'n'); p.set(4, 4, 'v'); }
  return out(p);
}
function awayHeader() { // ribbon banner, swallowtail ends (9-slice, ends in the side slices)
  const W = 48, H = 16, p = P(W, H);
  for (const sx of [0, 1]) {
    const X = (x) => (sx ? W - 1 - x : x);
    for (let y = 4; y < 14; y++) for (let x = 1; x < 10; x++) if (!(x < 5 && Math.abs(y - 9) < 5 - x)) p.set(X(x), y, y === 4 ? 'R' : y === 13 ? 'r' : 'r');
    for (let y = 4; y < 14; y++) p.set(X(9), y, 'm');
  }
  p.rect(9, 2, W - 18, 11, 'R'); p.rect(9, 2, W - 18, 1, 'o'); p.rect(9, 12, W - 18, 1, 'r');
  p.rect(9, 3, W - 18, 1, 'y'); p.rect(9, 11, W - 18, 1, 'x');
  p.set(10, 2, 'w');
  return p.outline();
}
function goalStrip() { // dark strip with a gold flag tab at the left (9-slice: tab stays in the left inset)
  const p = panel(24, 12, ['k', rim('t', 's', 'n'), 'k'], 'n', 1);
  put(p, ['kkkkkkk.', 'kyyyyyzk', 'kyzzzyyk', 'kyyyyxk.', 'kxxxxk..'], 0, 2);
  p.set(1, 3, 'y').set(1, 1, 'u');
  for (let x = 1; x < 4; x++) p.set(x, 8, 'g'), p.set(x, 9, 'g');
  return p;
}
function islandCard() { // sea-blue frame, sand inner trim, dark face; shell studs in the corners
  const p = panel(32, 40, ['k', rim('D', 'C', 'B'), { t: 'C', l: 'C', b: 'B', r: 'B' }, 'k', { t: 'i', l: 'i', b: 'h', r: 'h' }, 'k'], 'n', 3);
  for (const [x, y] of [[1, 1], [26, 1], [1, 34], [26, 34]]) put(p, ['.ii.', 'iwhi', 'ihhg', '.gg.'], x, y);
  return p;
}
function timerFrame() {
  const p = panel(32, 16, ['k', rim('u', 't', 's'), { t: 't', l: 't', b: 's', r: 's' }, 'k'], 'n', 2);
  for (const [x, y] of [[2, 2], [28, 2], [2, 12], [28, 12]]) p.set(x, y, 'y'), p.set(x + 1, y, 'x'), p.set(x, y + 1, 'x');
  p.set(1, 1, 'v');
  return p;
}
function slotEmpty() { // sunken socket: dark lip at top/left, lit lip at bottom/right
  const p = panel(20, 20, ['k', { t: 's', l: 's', b: 'u', r: 'u', m: 't' }, { t: 'k', l: 'k', b: 't', r: 't', m: 's' }], 'n', 2);
  p.set(17, 17, 'v');
  return p;
}
function slotGarrison() { // tower top with merlons and a corbelled base: a hero stands in the dark well
  const p = P(24, 24);
  layer(p, (l) => {
    for (let y = 7; y < 23; y++) { const inset = Math.max(0, y - 17); l.rect(1 + inset, y, 22 - 2 * inset, 1, 't'); }
    for (const x of [1, 10, 19]) l.rect(x, 1, 4, 6, 't');
  }, RAMPS.stone);
  for (const x of [1, 10, 19]) { p.rect(x, 1, 4, 1, 'v'); p.set(x, 1, 'w'); }
  p.rect(4, 8, 16, 10, 'n'); p.rect(4, 8, 16, 1, 'k'); p.rect(4, 8, 1, 10, 'k'); p.rect(5, 17, 15, 1, 's');
  for (const [x, y] of [[2, 10], [2, 15], [21, 12], [21, 16]]) p.set(x, y, 's');
  for (let y = 18; y < 23; y++) p.set(12, y, 's');
  p.set(11, 20, 'R').set(13, 20, 'o');
  return out(p);
}
function progressFrame() {
  const p = panel(16, 10, ['k', rim('z', 'y', 'x'), 'k'], 'n', 1);
  p.set(1, 1, 'w');
  return p;
}
function progressFill() { // ice ramp + glint cap (bar_fill_* use other ramps)
  const p = P(8, 6); p.rect(0, 0, 8, 6, 'k');
  p.rect(1, 1, 6, 1, 'E').rect(1, 2, 6, 2, 'D').rect(1, 4, 6, 1, 'C');
  p.set(1, 1, 'w').set(1, 2, 'E');
  return p;
}
function mapFrame() { // carved wood frame with brass compass studs; transparent window
  const p = panel(32, 32, ['k', rim('h', 'g', 'f'), { t: 'g', l: 'g', b: 'f', r: 'f' }, rim('i', 'h', 'g'), 'k'], '.', 2);
  for (const [x, y] of [[1, 1], [26, 1], [1, 26], [26, 26]]) put(p, ['..k..', '.kzk.', 'kzyxk', '.kxk.', '..k..'], x, y);
  for (const [x, y] of [[15, 1], [16, 1], [15, 30], [16, 30]]) p.set(x, y, 'y');
  return p;
}
function mapPin(kind) { // teardrop pin, emblem by kind; anchor = tip
  const p = P(12, 16);
  const C = { heart: ['m', 'M', 'L'], dock: ['B', 'C', 'D'], rift: ['k', 'm', 'M'] }[kind];
  layer(p, (l) => { disc(l, 6, 5.6, 4.9, C[1]); poly(l, [[2, 8], [10, 8], [6, 15]], C[1]); }, C);
  disc(p, 6, 5.6, 3, 'n');
  if (kind === 'heart') put(p, ['RR.RR', 'RoRRr', '.RRr.', '..r..'], 4, 4);
  if (kind === 'dock') put(p, ['..v..', '.vuv.', '..u..', 'u.u.u', '.uuu.'], 4, 3);
  if (kind === 'rift') { ring(p, 6, 5.6, 1.2, 2.2, 'L', -Math.PI, Math.PI / 2); p.set(6, 5, 'w'); p.set(5, 3, 'M'); }
  p.set(3, 2, C[2] === 'M' ? 'L' : 'w');
  return out(p);
}

// ═════════════════════════════ build ═════════════════════════════
export default function build() {
  const E = [];
  const add = (name, px, kind, extra = {}) => { if (!NAMES.has(name)) throw new Error(`ui2: ${name} is not in manifest.mjs`); E.push({ name, px, kind, ...extra }); };
  for (const [n, f] of Object.entries(ICONS)) add(`icon_${n}`, f(), 'icon');
  for (const b of ['calm', 'steady', 'fierce', 'nightmare']) add(`beacon_${b}`, beacon(b), 'icon');
  for (const m of ['new', 'crescent', 'half', 'gibbous', 'full', 'waning', 'blood']) add(`moon_${m}`, moon(m), 'icon');
  for (const [n, f] of Object.entries(EVENTS)) add(`event_${n}`, f(), 'icon');
  for (const [n, f] of Object.entries(CHARMS)) add(`charm_${n}`, f(), 'icon');
  for (const [n, f] of Object.entries(MODULES)) add(`module_${n}`, f(), 'icon');
  RESEARCH.forEach((row, b) => row.forEach((g, i) => add(`research_${b}_${i}`, medallion(b, g), 'icon')));
  for (const r of ['common', 'rare', 'epic']) add(`ui_gear_frame_${r}`, gearFrame(r), 'ui', { slice: [7, 7, 7, 7] });
  for (let i = 0; i < 10; i++) add(`badge_frame_${i}`, badge(i), 'ui', { ax: 12, ay: 12 });
  const ui = (n, px, extra = {}) => add(`ui_${n}`, px, 'ui', extra);
  ui('bottombar', bottombar(), { slice: [8, 8, 8, 8] });
  ui('tab_icon_on', tabIcon(true), { slice: [6, 6, 6, 6] });
  ui('tab_icon_off', tabIcon(false), { slice: [6, 6, 6, 6] });
  ui('chronicle_bar', chronicleBar(), { slice: [4, 4, 4, 4] });
  ui('chronicle_node', chronicleNode(false), { ax: 7, ay: 7 });
  ui('chronicle_node_done', chronicleNode(true), { ax: 7, ay: 7 });
  ui('away_header', awayHeader(), { slice: [12, 5, 12, 5] });
  ui('goal_strip', goalStrip(), { slice: [9, 4, 4, 4] });
  ui('island_card', islandCard(), { slice: [10, 10, 10, 10] });
  ui('timer_frame', timerFrame(), { slice: [6, 6, 6, 6] });
  ui('slot_empty', slotEmpty(), { slice: [5, 5, 5, 5] });
  ui('slot_garrison', slotGarrison());
  ui('progress_frame', progressFrame(), { slice: [4, 3, 4, 3] });
  ui('progress_fill', progressFill(), { slice: [2, 1, 1, 1] });
  ui('map_frame', mapFrame(), { slice: [10, 10, 10, 10] });
  for (const k of ['heart', 'dock', 'rift']) ui(`map_pin_${k}`, mapPin(k), { ax: 6, ay: 16 });
  return E;
}

// Style anchors: the minimum visual quality bar for every sprite in the game (SPEC §9).
// Run:  node tools/art/anchors.mjs   → docs/art/style-anchor.png (contact sheet, 8x) + lint report.
// They show the two allowed drawing techniques:
//   (A) hand-typed pixel grids for small characters/icons (faces need hand placement),
//   (B) procedural shapes + shade() + speckle() + outline() for buildings, props, tiles.
import { Px, RAMPS, lint, sheet } from './pixel.mjs';

// ── (A) Hand-typed grids ────────────────────────────────────────────────────────────
const knight = Px.grid([
  '......kkk.......',
  '.....kRRok......',
  '....kkRRkkk.....',
  '...kvvuuuuuk....',
  '..kvuuuuuuutk...',
  '..kuuuuuuuutk.k.',
  '..kukkkkkkktkkwk',
  '..kkqqqqqqpkkkwk',
  '..kkqkqqkqpkkkwk',
  '..ktqqqqqqptkkwk',
  '.kkkkkkkkkkkkkwk',
  'kCDkkRoRRRrkkyyk',
  'kCDCkRRRRrrpkgk.',
  'kBCCkRRRrrrkkkk.',
  '.kBkkfkkkfkk....',
  '..k.kkk.kkk.....',
]);
// Walk frame = the SAME sprite bobbed 1px with one foot lifted. Derive frames; never redraw from scratch.
const knightWalk = new Px(16, 16).stamp(knight.crop(0, 0, 16, 14), 0, 1).stamp(Px.grid(['....kfkkkkk.....']), 0, 15);
const gloomling = Px.grid([
  '..kk........kk..',
  '..kLk.kkkk.kLk..',
  '..kMMkMMMMkMMk..',
  '.kMLLMMMMMMMMmk.',
  '.kMLMMMMMMMMMmk.',
  'kMMMzkMMMMzkMMmk',
  'kMMMzkMMMMzkMMmk',
  'kMMMMMMMMMMMMmmk',
  'kMMMMkwkwkMMMmmk',
  'kmMMMMkkkMMMmmmk',
  '.kmmMMMMMMmmmmk.',
  '..kkkkkkkkkkkk..',
]);
const gloomlingSquash = Px.grid([ // squash frame for the hop animation: 1px lower, 2px wider feel
  '................',
  '..kk........kk..',
  '..kLkkkkkkkkkLk.',
  '.kMMMMMMMMMMMMk.',
  'kMLLMMMMMMMMMMmk',
  'kMMMzkMMMMzkMMmk',
  'kMMMzkMMMMzkMMmk',
  'kMMMMMMMMMMMMmmk',
  'kMMMMkwkwkMMMmmk',
  'kmMMMMkkkMMMmmmk',
  'kmmmMMMMMMmmmmmk',
  '.kkkkkkkkkkkkkk.',
]);
const heart = Px.grid([
  '.kk...kk.',
  'kooRkRRRk',
  'kowRRRRRk',
  'kRRRRRRrk',
  '.kRRRRrk.',
  '..kRRrk..',
  '...krk...',
  '....k....',
]);

// ── (B) Procedural shapes ───────────────────────────────────────────────────────────
function pine() {
  const p = new Px(18, 26), cx = 8.5;
  p.rect(8, 19, 2, 5, 'g').set(8, 23, 'f').set(9, 22, 'f').set(9, 23, 'f');
  const layer = (y0, rows, maxHalf) => {
    for (let r = 0; r < rows; r++) {
      const half = 0.5 + (r * (maxHalf - 0.5)) / (rows - 1);
      for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) p.set(x, y0 + r, r === rows - 1 ? 'a' : 'b');
    }
  };
  layer(12, 8, 7.5); layer(7, 7, 5.5); layer(2, 6, 3.5); // back to front
  p.shade(RAMPS.leaf).speckle('b', 'c', 0.22, 3);
  for (const [x, y] of [[7, 4], [6, 9], [5, 14], [7, 15], [9, 10]]) p.set(x, y, 'd'); // hand-placed sun glints
  return p.outline();
}
function tower() {
  const p = new Px(18, 30);
  p.rect(4, 11, 10, 16, 't');                               // shaft
  p.rect(3, 7, 12, 4, 't');                                 // parapet
  for (const x of [3, 7, 11]) p.rect(x, 5, 3, 2, 't');      // merlons
  p.rect(3, 10, 12, 1, 's');                                // parapet underside shadow
  for (let y = 14; y < 27; y += 4) p.rect(4, y, 10, 1, 's'); // brick courses
  for (let y = 11, k = 0; y < 27; y += 4, k++) for (let x = 6 + (k % 2) * 2; x < 14; x += 4) p.rect(x, y, 1, 3, 's');
  p.shade(RAMPS.stone).speckle('t', 'u', 0.06, 7);
  p.rect(8, 16, 2, 4, 'n').set(8, 15, 'n').set(9, 15, 'n'); // arrow slit
  p.rect(7, 23, 4, 4, 'f').rect(8, 22, 2, 1, 'f').rect(8, 23, 1, 4, 'g').set(10, 25, 'y'); // door + knob
  p.rect(8, 1, 1, 4, 'f').rect(9, 1, 4, 2, 'R').set(12, 2, 'r').set(9, 2, 'o'); // flag
  return p.outline();
}
function wall() { // top face + front face = the 3/4 top-down look used for every building
  const p = new Px(18, 20);
  p.rect(1, 3, 16, 7, 'u');                                 // top face (lit)
  p.rect(1, 10, 16, 8, 't');                                // front face
  for (const x of [1, 7, 13]) p.rect(x, 1, 4, 2, 'u');      // battlements
  p.rect(1, 10, 16, 1, 's');
  for (let y = 14; y < 18; y += 4) p.rect(1, y, 16, 1, 's');
  for (let y = 11, k = 0; y < 18; y += 4, k++) for (let x = 4 + (k % 2) * 3; x < 17; x += 6) p.rect(x, y, 1, 3, 's');
  p.speckle('u', 'v', 0.12, 5).speckle('t', 's', 0.05, 9);
  p.rect(1, 17, 16, 1, 's');
  for (const [x, y] of [[3, 12], [10, 16], [14, 12]]) p.set(x, y, 'c'); // moss
  return p.outline();
}
function brazier() {
  const p = new Px(16, 20);
  p.rect(7, 13, 2, 4, 't').rect(5, 17, 6, 1, 't').rect(4, 18, 8, 1, 's'); // stem + foot
  p.rect(3, 10, 10, 3, 't').rect(4, 13, 8, 1, 's');          // bowl
  p.shade(RAMPS.stone);
  p.ellipse(7.5, 7, 3.4, 3.6, 'x').ellipse(7.5, 8, 2.4, 2.6, 'y').ellipse(7.5, 9, 1.2, 1.4, 'z'); // flame core
  p.set(7, 2, 'x').set(8, 3, 'x').set(6, 4, 'y').set(9, 5, 'y');            // licks
  p.rect(3, 10, 10, 1, 'u');
  return p.outline().set(11, 1, 'y').set(4, 2, 'x');          // sparks sit outside the outline on purpose
}
function grassTile(seed) { // tiles: no outline, must tile seamlessly, low contrast so units pop
  const p = new Px(16, 16, 'c');
  p.speckle('c', 'b', 0.05, seed).speckle('c', 'd', 0.07, seed + 11);
  for (const [x, y] of [[3, 4], [11, 9], [6, 13]]) p.set(x, y, 'd').set(x + 1, y - 1, 'd').set(x + 2, y, 'd'); // tufts
  return p;
}
function dirtTile() {
  const p = new Px(16, 16, 'h');
  p.speckle('h', 'g', 0.08, 2).speckle('h', 'i', 0.06, 21);
  for (const [x, y] of [[4, 5], [12, 11]]) p.rect(x, y, 2, 1, 'g').set(x, y - 1, 'i'); // pebbles
  return p;
}

const entries = [
  { name: 'hero_knight_idle', px: knight, kind: 'unit' },
  { name: 'hero_knight_walk', px: knightWalk, kind: 'unit' },
  { name: 'gloomling_idle', px: gloomling, kind: 'unit' },
  { name: 'gloomling_squash', px: gloomlingSquash, kind: 'unit' },
  { name: 'icon_heart', px: heart, kind: 'icon' },
  { name: 'tile_grass', px: grassTile(1), kind: 'tile' },
  { name: 'prop_pine', px: pine(), kind: 'prop' },
  { name: 'bld_tower', px: tower(), kind: 'building' },
  { name: 'bld_wall', px: wall(), kind: 'wall' },
  { name: 'bld_brazier', px: brazier(), kind: 'building' },
  { name: 'tile_dirt', px: dirtTile(), kind: 'tile' },
];

const issues = entries.flatMap((e) => lint(e.name, e.px, e.kind));
sheet(new URL('../../docs/art/style-anchor.png', import.meta.url).pathname, entries, { scale: 8, cols: 6 });
console.log(`${entries.length} anchors rendered → docs/art/style-anchor.png`);
if (issues.length) { console.error(issues.join('\n')); process.exit(1); }
console.log('art lint: OK');

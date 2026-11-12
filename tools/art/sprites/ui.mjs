// UI sprites: 9-slice panels, buttons, tabs, cards, bars, joystick, build markers, icons, boon icons, logo, bitmap fonts.
// Owner: art-ui. Contract: docs/CONTRACT.md. Names: tools/art/manifest.mjs (owner 'ui').
// Extra entry fields understood by build-atlas: slice [l,t,r,b] (9-slice insets, art px), advance (glyph pen advance).
import { Px, RAMPS } from '../pixel.mjs';
import { poly, thick, ring, disc, put, centred, ringPanel, FONT5, FONT7 } from './_ui_helpers.mjs';

const P = (w = 16, h = 16) => new Px(w, h);
// Draw on a fresh layer, optionally shade with a ramp, then stamp onto dst.
const layer = (dst, draw, ramp) => { const l = P(dst.w, dst.h); draw(l); if (ramp) l.shade(ramp); return dst.stamp(l); };

// ── 9-slice panels ──────────────────────────────────────────────────────────────────
function panelParchment() {
  const wood = { t: 'h', l: 'h', b: 'f', r: 'f', m: 'g' };
  const p = ringPanel(24, 24, ['k', wood, { t: 'g', l: 'g', b: 'f', r: 'f' }, 'k', { t: 'h', l: 'h', b: 'i', r: 'i' }], 'i', 3);
  // brass corner caps (same orientation on every corner so the light stays top-left)
  for (const [x, y] of [[1, 1], [20, 1], [1, 20], [20, 20]]) put(p, ['zy.', 'yx.', '...'], x, y);
  for (const [x, y] of [[2, 2], [21, 2], [2, 21], [21, 21]]) p.set(x, y, 'x');
  // worn parchment flecks only in the corners (corners never stretch)
  for (const [x, y] of [[5, 5], [18, 6], [6, 18], [17, 17]]) p.set(x, y, 'h');
  return p;
}
function panelStone() {
  const rim = { t: 'u', l: 'u', b: 's', r: 's', m: 't' };
  const p = ringPanel(24, 24, ['k', rim, { t: 't', l: 't', b: 's', r: 's' }, 'k', { t: 'k', l: 'k', b: 'n', r: 'n' }], 'n', 3);
  for (const [x, y] of [[1, 1], [20, 1], [1, 20], [20, 20]]) put(p, ['vu.', 'ut.', '...'], x, y);
  for (const [x, y] of [[5, 5], [18, 18]]) p.set(x, y, 'm');
  return p;
}
// Buttons: 3/4 look like the walls — lit top face + darker front lip; pressed = face sunk by 2px.
function button(state) {
  const W = 24, H = 20, pressed = state === 'down';
  const pal = state === 'disabled' ? { hi: 'v', face: 'u', lip: 't', seam: 's', deep: 's' } : { hi: 'z', face: 'y', lip: 'x', seam: 'r', deep: 'r' };
  const top = pressed ? 2 : 0, lipH = pressed ? 2 : 4; // pressed: face sinks 2px, front lip shrinks
  const p = P(W, H);
  p.stamp(ringPanel(W, H - top, ['k', { t: pal.hi, l: pal.hi, b: pal.deep, r: pal.lip, m: pal.face }], pal.face, 2), 0, top);
  // front face (lip) like the walls: dark seam, lip body, darkest bottom row
  for (let x = 1; x < W - 1; x++) for (let j = 1; j <= lipH; j++) {
    const y = H - 1 - j; if (p.get(x, y) === '.' || p.get(x, y) === 'k') continue;
    p.set(x, y, j === lipH ? pal.seam : j === 1 ? pal.deep : x === 1 || x === 2 ? pal.face : pal.lip);
  }
  p.set(2, top + 2, state === 'disabled' ? 'v' : 'w').set(3, top + 2, pal.hi).set(2, top + 3, pal.hi);
  return p;
}
function tab(on) {
  const p = on
    ? ringPanel(24, 16, ['k', { t: 'w', l: 'w', b: 'i', r: 'h', m: 'i' }], 'i', 3, { squareBottom: true })
    : ringPanel(24, 16, ['k', { t: 'h', l: 'h', b: 'g', r: 'f', m: 'g' }], 'g', 3, { squareBottom: true });
  for (let x = 0; x < 24; x++) p.set(x, 15, 'k');
  if (!on) for (let x = 1; x < 23; x++) p.set(x, 14, 'f'); // off tab sits behind: darker foot
  else p.set(2, 2, 'z');
  return p;
}
// Card frames: rarity is coded by corner SHAPE as well as colour (square rivet / gem / gem + flame flourish).
function card(rarity) {
  const R = { common: { hi: 'v', m: 'u', lo: 't', d: 's' }, rare: { hi: 'D', m: 'C', lo: 'B', d: 'B' }, legendary: { hi: 'z', m: 'y', lo: 'x', d: 'r' } }[rarity];
  const W = 36, H = 46;
  const p = ringPanel(W, H, ['k', { t: R.hi, l: R.hi, b: R.d, r: R.d, m: R.m }, R.m, { t: R.m, l: R.m, b: R.lo, r: R.lo }, 'k', { t: 'k', l: 'k', b: 'm', r: 'm' }], 'n', 3);
  const corner = {
    common: ['.kkkkk.', 'kvvvuuk', 'kvuuutk', 'kvuuutk', 'kuuuttk', 'kuttttk', '.kkkkk.'],
    rare: ['...k...', '..kEk..', '.kEDDk.', 'kEDDCBk', '.kDCBk.', '..kBk..', '...k...'],
    legendary: ['...k...', '..kwk..', '.kwLLk.', 'kwLLMmk', '.kLMmk.', '..kmk..', '...k...'],
  }[rarity];
  for (const [x, y] of [[0, 0], [W - 7, 0], [0, H - 7], [W - 7, H - 7]]) put(p, corner, x, y);
  if (rarity === 'legendary') { // flame flourishes beside the top gems, all inside the 12px corner slice
    for (const x of [7, W - 11]) put(p, ['..k.', '.kzk', 'kzyk', 'kyxk', '.kk.'].map((r) => r), x, 0);
    for (const x of [7, W - 11]) put(p, ['.kk.', 'kxyk', 'kyzk', '.kzk', '..k.'], x, H - 5);
  }
  if (rarity === 'rare') for (const x of [8, W - 9]) { p.set(x, 1, 'E'); }
  return p;
}
function barFrame() {
  const p = ringPanel(24, 10, ['k', { t: 'u', l: 'u', b: 's', r: 's', m: 't' }, 'k'], '.', 1);
  p.set(1, 1, 'v');
  return p;
}
function barFill(ramp) { // [shadow, base, highlight]; 2px left cap holds the glint, body stretches
  const [lo, mid, hi] = ramp;
  const p = P(8, 6); p.rect(0, 0, 8, 6, 'k');
  p.rect(1, 1, 6, 1, hi).rect(1, 2, 6, 2, mid).rect(1, 4, 6, 1, lo);
  p.set(1, 1, 'w'); p.set(1, 2, hi);
  return p;
}
function joyBase() {
  const p = P(48, 48), c = 23.5;
  disc(p, c, c, 22.5, 'k');
  ring(p, c, c, 19.5, 21.6, 't');
  ring(p, c, c, 19.5, 21.6, 'u', -Math.PI, -Math.PI / 2 + 0.3);
  ring(p, c, c, 19.5, 21.6, 's', 0, Math.PI / 2 + 0.3);
  disc(p, c, c, 18.6, 'n');
  ring(p, c, c, 17.6, 18.6, 'k', -Math.PI, -Math.PI / 2 + 0.4);
  ring(p, c, c, 9.5, 10.5, 's');
  // direction chevrons
  put(p, ['..u..', '.utu.', 'ut.tu'], 21.5, 7);
  put(p, ['tu.ut', '.utu.', '..u..'], 21.5, 37);
  put(p, ['..u', '.ut', 'ut.', '.ut', '..u'], 7, 21);
  put(p, ['u..', 'tu.', '.ut', 'ut.', 'u..'], 37, 21);
  return p;
}
function joyKnob() {
  const p = P(24, 24), c = 11.5;
  disc(p, c, c, 10.6, 'u');
  const l = P(24, 24); disc(l, c, c, 10.6, 'u'); l.shade(RAMPS.steel); p.stamp(l);
  ring(p, c + 1, c + 1, 9.3, 10.6, 't', 0, Math.PI / 2);
  disc(p, c - 3, c - 3, 2.6, 'v'); p.set(7, 7, 'w'); p.set(8, 7, 'w'); p.set(7, 8, 'w');
  ring(p, c, c, 5.5, 6.4, 't', 0, Math.PI);
  ring(p, c, c, 5.5, 6.4, 'v', Math.PI, 2 * Math.PI);
  return p.outline();
}
// Build-mode cell markers (accessibility: ✓ = OK, diagonal hatch = BAD; colour is only a second cue).
function buildOk() {
  const p = P();
  for (let i = 2; i < 14; i++) { p.set(i, 1, 'e'); p.set(1, i, 'e'); p.set(i, 14, 'c'); p.set(14, i, 'c'); }
  p.set(1, 1, '.').set(14, 1, '.').set(1, 14, '.').set(14, 14, '.');
  thick(p, 4, 8, 6, 10, 0.75, 'e'); thick(p, 6, 10, 11, 5, 0.75, 'e');
  p.set(6, 11, 'd').set(7, 10, 'd').set(11, 4, 'w');
  return p.outline();
}
function buildBad() {
  const p = P();
  for (let i = 2; i < 14; i++) { p.set(i, 1, 'o'); p.set(1, i, 'o'); p.set(i, 14, 'r'); p.set(14, i, 'r'); }
  p.set(1, 1, '.').set(14, 1, '.').set(1, 14, '.').set(14, 14, '.');
  for (let k = -12; k < 16; k += 5) for (let i = 3; i <= 12; i++) { const j = i + k; if (j >= 3 && j <= 12) p.set(i, 15 - j, 'R'); }
  return p.outline();
}
function gridCell() {
  const p = P();
  for (const [x, y, sx, sy] of [[1, 1, 1, 1], [14, 1, -1, 1], [1, 14, 1, -1], [14, 14, -1, -1]]) {
    p.set(x, y, 'v'); p.set(x + sx, y, 'u'); p.set(x, y + sy, 'u');
  }
  return p.outline('n');
}
const rangeDot = () => Px.grid(['..k..', '.kzk.', 'kzyxk', '.kxk.', '..k..']);
const linkDot = () => Px.grid(['.kkkk.', 'kEDDCk', 'kDDCCk', 'kDCCBk', 'kCCBBk', '.kkkk.']);
function arrowEdge() {
  const p = P();
  layer(p, (l) => poly(l, [[2, 5], [8, 5], [8, 1.5], [14.5, 8], [8, 14.5], [8, 11], [2, 11]], 'R'), RAMPS.red);
  p.set(9, 4, 'w');
  return p.outline();
}
function minimapFrame() {
  const p = ringPanel(32, 32, ['k', { t: 'u', l: 'u', b: 's', r: 's', m: 't' }, { t: 't', l: 't', b: 's', r: 's' }, 'k'], '.', 2);
  for (const [x, y] of [[1, 1], [27, 1], [1, 27], [27, 27]]) put(p, ['zyy.', 'yxx.', 'yx..', '....'], x, y);
  return p;
}
function blueprintCorner() {
  const p = P(8, 8);
  p.rect(1, 1, 6, 2, 'D').rect(1, 1, 2, 6, 'D');
  p.rect(1, 1, 6, 1, 'E').rect(1, 1, 1, 6, 'E'); p.set(6, 2, 'C').set(2, 6, 'C');
  return p.outline();
}

// ── Icons 16×16 ─────────────────────────────────────────────────────────────────────
const out = (p) => p.outline();
const ICONS = {
  wood() {
    const p = P();
    layer(p, (l) => { l.rect(5, 4, 9, 8, 'g'); l.set(13, 4, '.').set(13, 11, '.'); }, RAMPS.wood);
    for (const [x, y, n] of [[7, 6, 3], [10, 8, 2], [8, 9, 2]]) p.rect(x, y, n, 1, 'f');
    p.ellipse(4.5, 7.5, 3, 4, 'i');
    p.ellipse(4.5, 7.5, 2, 2.6, 'h'); p.ellipse(4.5, 7.5, 1, 1.4, 'i'); p.set(4, 7, 'g');
    p.set(2, 5, 'w');
    p.set(11, 3, 'c').set(12, 2, 'd').set(12, 3, 'c');
    return out(p);
  },
  stone() {
    const p = P();
    layer(p, (l) => poly(l, [[3, 9], [5, 4], [9, 2], [13, 4], [14.5, 9], [13, 13], [7, 13.5]], 't'), RAMPS.stone);
    for (const [x, y] of [[9, 6], [10, 7], [10, 8], [11, 9]]) p.set(x, y, 's');
    p.set(7, 4, 'v').set(6, 5, 'v').set(8, 4, 'v');
    layer(p, (l) => poly(l, [[1.5, 11], [3.5, 9], [6.5, 9.5], [7, 13.5], [2, 13.5]], 't'), RAMPS.stone);
    p.set(3, 10, 'v');
    return out(p);
  },
  gold() {
    const p = P();
    disc(p, 8, 8, 6.6, 'x');
    disc(p, 7.6, 7.6, 5.7, 'y');
    ring(p, 7.6, 7.6, 4.2, 5.7, 'z', -Math.PI, -Math.PI / 2);
    ring(p, 7.6, 7.6, 2.6, 3.5, 'x');
    put(p, ['.z.', 'zyz', '.z.'], 6, 6);
    p.set(4, 4, 'w').set(5, 3, 'w');
    return out(p);
  },
  ember() {
    const p = P();
    poly(p, [[8, 1.5], [13, 7.5], [8, 14.5], [3, 7.5]], 'y');
    poly(p, [[8, 1.5], [13, 7.5], [8, 14.5], [8, 7.5]], 'x');
    poly(p, [[8, 1.5], [3, 7.5], [8, 7.5]], 'z');
    poly(p, [[8, 14.5], [8, 10], [12, 9]], 'R');
    p.set(6, 5, 'w').set(7, 4, 'w').set(7, 5, 'w');
    return out(p);
  },
  heart: () => out(centred(['.RRR...RRR.', 'RowRR.RRRRR', 'RwoRRRRRRRr', 'RoRRRRRRRRr', 'RRRRRRRRRrr', '.RRRRRRRrr.', '..RRRRRrr..', '...RRRrr...', '....Rrr....', '.....r.....'])),
  hammer() {
    const p = P();
    thick(p, 3, 12, 9, 6, 0.9, 'g');
    for (const [x, y] of [[3, 11], [4, 10], [5, 9], [6, 8], [7, 7]]) p.set(x, y, 'h');
    layer(p, (l) => poly(l, [[6.5, 4.5], [9.5, 1.5], [14.5, 6.5], [11.5, 9.5]], 'u'), RAMPS.steel);
    p.set(9, 2, 'w');
    for (const [x, y] of [[8, 7], [10, 9]]) p.set(x, y, 't');
    return out(p);
  },
  sword() {
    const p = P();
    thick(p, 5, 10, 13, 2, 1.0, 'u');
    for (let i = 0; i < 8; i++) p.set(5 + i, 9 - i, 'v');
    p.set(13, 2, 'w').set(12, 3, 'w');
    thick(p, 2, 8, 7, 13, 0.7, 'y'); p.set(2, 8, 'z').set(3, 9, 'z').set(7, 13, 'x');
    thick(p, 2, 13, 3, 12, 0.6, 'g');
    p.set(1, 14, 'y');
    return out(p);
  },
  moon() {
    const p = P();
    disc(p, 7.5, 8, 6, 'D'); disc(p, 10.5, 6, 5, '.');
    p.shade(['C', 'D', 'E']);
    p.set(4, 9, 'C').set(5, 11, 'C').set(3, 7, 'C');
    p.set(12, 11, 'z').set(13, 12, 'y').set(11, 12, 'y').set(12, 13, 'y').set(12, 10, 'y');
    return out(p);
  },
  sun: () => out(centred([
    '......zy......',
    '..x...zy...x..',
    '...x......x...',
    '.....zzzy.....',
    '....zwzyyy....',
    '...zzzyyyyx...',
    'zz.zyyyyyyx.yy',
    'yy.yyyyyyyx.xx',
    '...yyyyyyxx...',
    '....yyyyxx....',
    '.....xxxx.....',
    '...x......x...',
    '..x...yx...x..',
    '......yx......',
  ])),
  pause() {
    const p = P();
    for (const x of [3, 9]) { p.rect(x, 3, 4, 10, 'v'); p.rect(x, 3, 1, 10, 'w'); p.rect(x + 3, 3, 1, 10, 'u'); p.rect(x, 12, 4, 1, 'u'); p.set(x, 3, '.').set(x + 3, 12, '.'); }
    return out(p);
  },
  play() {
    const p = P();
    layer(p, (l) => poly(l, [[4, 2], [13.5, 8], [4, 14]], 'v'), ['u', 'v', 'w']);
    p.set(5, 4, 'w');
    return out(p);
  },
  close() {
    const p = P();
    layer(p, (l) => { thick(l, 3, 3, 12, 12, 1.25, 'R'); thick(l, 12, 3, 3, 12, 1.25, 'R'); }, RAMPS.red);
    p.set(3, 3, 'w');
    return out(p);
  },
  tick() {
    const p = P();
    layer(p, (l) => { thick(l, 2, 8, 6, 12, 1.3, 'c'); thick(l, 6, 12, 13, 3, 1.3, 'c'); }, RAMPS.grass);
    p.set(12, 3, 'e');
    return out(p);
  },
  lock() {
    const p = P();
    ring(p, 8, 7, 2.2, 4, 'u', -Math.PI, 0);
    p.rect(4, 6, 2, 2, 'u').rect(10, 6, 2, 2, 'u');
    p.set(5, 4, 'v').set(6, 3, 'v');
    layer(p, (l) => l.rect(3, 8, 10, 7, 'y'), RAMPS.fire);
    put(p, ['kk', 'kk', '.k'], 7, 10);
    p.set(4, 9, 'w');
    return out(p);
  },
  upgrade() {
    const p = P();
    layer(p, (l) => poly(l, [[8, 1.5], [14.5, 8], [11, 8], [11, 14.5], [5, 14.5], [5, 8], [1.5, 8]], 'c'), RAMPS.grass);
    p.set(8, 3, 'e').set(7, 4, 'e');
    for (let x = 6; x < 10; x++) p.set(x, 10, 'b');
    return out(p);
  },
  wrench() {
    const p = P();
    layer(p, (l) => {
      thick(l, 2, 13, 9, 6, 1.1, 'u');
      ring(l, 10.5, 5.5, 1.4, 3.8, 'u');
      disc(l, 12.5, 3.5, 1.5, '.'); l.set(12, 4, '.').set(11, 4, '.');
    }, RAMPS.steel);
    p.set(3, 12, 'v').set(4, 11, 'v');
    return out(p);
  },
  sell() {
    const p = P();
    layer(p, (l) => poly(l, [[1.5, 8], [8, 1.5], [14.5, 1.5], [14.5, 8], [8, 14.5]], 'h'), RAMPS.sand);
    disc(p, 11.5, 4.5, 1.2, 'k');
    disc(p, 7, 9, 2.6, 'y'); p.set(6, 8, 'z').set(8, 10, 'x').set(7, 9, 'x');
    return out(p);
  },
  horn() {
    const p = P(), pt = (t) => [(1 - t) ** 2 * 2 + 2 * (1 - t) * t * 4 + t * t * 11.5, (1 - t) ** 2 * 13 + 2 * (1 - t) * t * 4 + t * t * 6.5];
    const l = P();
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const [x, y] = pt(t), band = (t > 0.3 && t < 0.36) || (t > 0.62 && t < 0.68);
      disc(l, x, y, 0.9 + t * 2.7, band ? 'y' : 'i');
    }
    // shade the ivory body (bands keep their gold), then cut the bell mouth
    const sh = l.clone().replace('y', 'i').shade(['h', 'i', 'w']);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (l.d[y][x] === 'i') l.d[y][x] = sh.d[y][x]; else if (l.d[y][x] === 'y' && sh.d[y][x] === 'h') l.d[y][x] = 'x';
    p.stamp(l);
    p.ellipse(12.6, 6.5, 1.3, 2.9, 'y'); p.ellipse(12.9, 6.5, 0.7, 2.0, 'f');
    p.set(2, 13, 'g').set(1, 14, 'g');
    return out(p);
  },
  pin() {
    const p = P();
    layer(p, (l) => { disc(l, 8, 6.5, 4.8, 'R'); poly(l, [[4, 8.5], [12, 8.5], [8, 14.8]], 'R'); }, RAMPS.red);
    disc(p, 8, 6.5, 1.8, 'w'); p.set(8, 7, 'v');
    p.set(6, 3, 'o');
    return out(p);
  },
  undo: () => out(centred([
    '...w..........',
    '..wv..........',
    '.wvvvvvvvvv...',
    'wvvvvvvvvvvvv.',
    '.uvvv.....vvvv',
    '..uv.......vvu',
    '...u.......vvu',
    '...........vvu',
    '..........vvuu',
    '....vvvvvvvuu.',
    '....uuuuuuuu..',
  ])),
  skull: () => out(centred(['..wwwwwww..', '.wwwwwwwwv.', 'wwwvvvvwwvv', 'wwkkwwwkkvv', 'wwkkwvwkkvu', 'wwwwwkvwwvu', '.vwwvkvwvu.', '..vwwwwvu..', '..w.w.v.u..', '..vwvwvuu..'])),
  shield() {
    const p = P();
    layer(p, (l) => poly(l, [[2.5, 1.5], [13.5, 1.5], [13.5, 8], [8, 14.5], [2.5, 8]], 'C'), RAMPS.blue);
    for (let y = 3; y < 13; y++) p.set(7, y, 'u'), p.set(8, y, 't');
    for (let x = 4; x < 12; x++) p.set(x, 6, x < 8 ? 'u' : 't');
    p.set(7, 6, 'v');
    p.set(4, 3, 'E');
    return out(p);
  },
  fire() {
    const p = P();
    poly(p, [[3.5, 9], [5, 5], [6.5, 6], [8, 1.5], [11, 6], [12.5, 4.5], [13, 9]], 'x');
    p.ellipse(8.2, 10.5, 5, 4, 'x');
    poly(p, [[5.5, 10], [8, 4.5], [10.5, 10]], 'y'); p.ellipse(8, 11, 3, 2.8, 'y');
    p.ellipse(8, 12, 1.6, 1.8, 'z');
    p.set(6, 7, 'z');
    for (const [x, y] of [[12, 12], [11, 13], [10, 14], [12, 11]]) p.set(x, y, 'r');
    return out(p);
  },
  frost() {
    const p = P(), c = 7;
    const arms = [[0, -6], [5, -3], [5, 3], [0, 6], [-5, 3], [-5, -3]];
    for (const [dx, dy] of arms) {
      p.line(c, c, c + dx, c + dy, 'D');
      const mx = c + Math.round(dx * 0.6), my = c + Math.round(dy * 0.6);
      if (dx === 0) { p.set(mx - 1, my + Math.sign(dy) * 1, 'D'); p.set(mx + 1, my + Math.sign(dy), 'D'); }
      else { p.set(mx, my - Math.sign(dy) * 2 + Math.sign(dy), 'D'); p.set(mx - Math.sign(dx), my + Math.sign(dy), 'D'); }
      p.set(c + dx, c + dy, 'E');
    }
    put(p, ['.E.', 'EwE', '.E.'], c - 1, c - 1);
    for (const [dx, dy] of arms) p.set(c + Math.round(dx * 0.4), c + Math.round(dy * 0.4), 'C');
    return out(p.shift(1, 1));
  },
  settings() {
    const p = P();
    layer(p, (l) => {
      disc(l, 8, 8, 4.8, 'u');
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; thick(l, 8 + Math.cos(a) * 4 - 0.5, 8 + Math.sin(a) * 4 - 0.5, 8 + Math.cos(a) * 5.7 - 0.5, 8 + Math.sin(a) * 5.7 - 0.5, 1.1, 'u'); }
      disc(l, 8, 8, 1.8, '.');
    }, RAMPS.steel);
    return out(p);
  },
  sfx() {
    const p = P();
    layer(p, (l) => poly(l, [[2, 6], [5, 6], [9, 2.5], [9, 13.5], [5, 10], [2, 10]], 'u'), RAMPS.steel);
    ring(p, 9, 8, 2.6, 3.6, 'v', -Math.PI / 3, Math.PI / 3);
    ring(p, 9, 8, 4.6, 5.6, 'v', -Math.PI / 3, Math.PI / 3);
    return out(p);
  },
  vibrate() {
    const p = P();
    p.rect(5, 2, 6, 12, 't'); p.rect(5, 2, 6, 1, 'u'); p.rect(5, 2, 1, 12, 'u');
    p.rect(6, 4, 4, 7, 'D'); p.rect(6, 4, 4, 1, 'E'); p.set(7, 12, 's').set(8, 12, 's');
    for (const x of [2, 13]) { p.set(x, 5, 'v'); p.set(x + (x === 2 ? 1 : -1) * 0, 6, '.'); p.set(x, 7, 'v'); p.set(x, 9, 'v'); p.set(x, 11, 'v'); }
    return out(p);
  },
};
ICONS.music = () => out(centred([
  '....vvvvvv',
  '....wuuuuv',
  '....vtttuv',
  '....v....v',
  '....v....v',
  '....v....v',
  '.uuvv..uuv',
  'uwvvv.uwvv',
  'uvvvt.uvvt',
  '.ttt...ttt',
]));

// ── Boon icons 16×16 ────────────────────────────────────────────────────────────────
function flame(p, cx, by, s, cols = ['x', 'y', 'z']) { // small flame with base centre (cx, by), height ~ 6*s
  poly(p, [[cx - 2.6 * s, by - 2.2 * s], [cx, by - 7 * s], [cx + 2.6 * s, by - 2.2 * s]], cols[0]);
  p.ellipse(cx, by - 2.2 * s, 2.6 * s, 2.2 * s, cols[0]);
  poly(p, [[cx - 1.5 * s, by - 1.8 * s], [cx, by - 5 * s], [cx + 1.5 * s, by - 1.8 * s]], cols[1]);
  p.ellipse(cx, by - 1.8 * s, 1.5 * s, 1.5 * s, cols[1]);
  if (s >= 0.9) p.ellipse(cx, by - 1.4 * s, 0.8 * s, 0.9 * s, cols[2]);
  return p;
}
function brick(p, x, y, w, h) { p.rect(x, y, w, h, 'R'); p.rect(x, y, w, 1, 'o'); p.rect(x, y + h - 1, w, 1, 'r'); p.rect(x + w - 1, y, 1, h, 'r'); }
const BOONS = {
  sharp() { const p = ICONS.sword(); put(p, ['.z.', 'zwz', '.z.'], 11, 7); p.set(12, 6, 'k').set(12, 10, 'k').set(10, 8, 'k').set(14, 8, 'k'); return p; },
  thick() {
    const p = P();
    layer(p, (l) => poly(l, [[2, 3], [6, 1.5], [10, 1.5], [14, 3], [13, 11], [8, 14.5], [3, 11]], 'u'), RAMPS.steel);
    put(p, ['.RR.RR.', 'RoRRRRr', 'RRRRRRr', '.RRRRr.', '..RRr..', '...r...'], 5, 5);
    p.set(4, 3, 'w');
    return out(p);
  },
  swift() {
    const p = P();
    layer(p, (l) => poly(l, [[5, 2.5], [9.5, 2.5], [9.5, 9], [14, 10], [14.5, 13.5], [4.5, 13.5]], 'g'), RAMPS.wood);
    p.rect(5, 12, 10, 1, 'f'); p.rect(5, 5, 5, 1, 'y');
    put(p, ['wwv.', '.wwv', '..wv'], 1, 5); put(p, ['wv.', '.wv'], 1, 9);
    return out(p);
  },
  leech() {
    const p = P();
    layer(p, (l) => { poly(l, [[8, 4], [12, 10.5], [4, 10.5]], 'R'); disc(l, 8, 11, 3.8, 'R'); }, RAMPS.red);
    p.set(6, 9, 'w').set(6, 10, 'o');
    const f = P(); put(f, ['wwv...wwv', '.wv....wv', '.v.....v.'], 2, 1); f.outline();
    return out(p).stamp(f);
  },
  horn() {
    const p = ICONS.horn();
    const l = P(); for (const [x, y] of [[14, 10], [14, 11], [12, 12], [13, 13]]) l.set(x, y, 'z');
    return p.stamp(l.outline()).stamp(l);
  },
  ally() {
    const p = out(centred([
      '.....Ro......',
      '....RRRo.....',
      '...vvvvvuu...',
      '..vvuuuuuut..',
      '.vuuuuuuuuut.',
      '.vukkkkkkkkt.',
      '.vuuukuukuut.',
      '.uuuuuuuuutt.',
      '..ttttttttt..',
      '.............',
      '.............',
    ]));
    const plus = P(); put(plus, ['.d.', 'ddc', '.c.'], 12, 11); plus.outline();
    return p.stamp(plus);
  },
  cooldown() {
    const p = P();
    p.rect(3, 1, 10, 2, 'g').rect(3, 13, 10, 2, 'g'); p.rect(3, 1, 10, 1, 'h').rect(3, 13, 10, 1, 'h');
    poly(p, [[4, 3], [12, 3], [8.5, 8], [12, 13], [4, 13], [7.5, 8]], 'D');
    poly(p, [[5, 3.5], [11, 3.5], [8, 7]], 'y');
    poly(p, [[8, 9], [11, 13], [5, 13]], 'y'); p.set(8, 8, 'y');
    p.set(5, 4, 'E');
    return out(p);
  },
  twin() {
    const p = P();
    const bolt = ['...zzy', '..zzy.', '.zzy..', 'zzzzyy', '..yyx.', '.yyx..', '.yx...', 'yx....'];
    put(p, bolt, 1, 1); put(p, bolt, 8, 6);
    return out(p);
  },
  mason() {
    const p = P();
    brick(p, 1, 9, 6, 3); brick(p, 7, 9, 7, 3); brick(p, 4, 12, 7, 3); brick(p, 1, 12, 3, 3); brick(p, 11, 12, 3, 3);
    layer(p, (l) => poly(l, [[6, 1.5], [13.5, 1.5], [9, 7.5]], 'u'), RAMPS.steel);
    p.rect(9, 7, 1, 2, 'g');
    return out(p);
  },
  boulder() {
    const p = P();
    layer(p, (l) => poly(l, [[1.5, 10], [3, 4.5], [7.5, 1.5], [12.5, 2.5], [14.5, 7.5], [13.5, 13.5], [3.5, 14]], 't'), RAMPS.stone);
    for (const [x, y] of [[8, 4], [8, 5], [9, 6], [9, 7], [10, 8], [9, 9]]) p.set(x, y, 's');
    p.set(5, 4, 'v').set(6, 3, 'v').set(4, 5, 'v'); p.speckle('t', 'u', 0.08, 4);
    for (const [x, y, c] of [[5, 2, 'c'], [6, 2, 'd'], [7, 1, 'c'], [4, 3, 'b']]) p.set(x, y, c);
    return out(p);
  },
  hawk() {
    return out(centred([
      '....hhhhh.....',
      '..hhiiihhh....',
      '.hiiiiiihhgg..',
      'hiiiikkiiigggg',
      'hiiiikwiiiggff',
      'hiiiiiiyyyyygf',
      'gfhiiiiiyyyxx.',
      '.gfhhiiiyyx...',
      '..gfhhhhhx....',
      '...ggfhhhgf...',
      '....ggffgg....',
    ]).mirrorX());
  },
  reload() {
    const p = P();
    ring(p, 8, 8, 4.6, 6.2, 'z', -Math.PI * 0.95, -Math.PI * 0.05);
    ring(p, 8, 8, 4.6, 6.2, 'y', Math.PI * 0.05, Math.PI * 0.95);
    poly(p, [[11, 6], [15, 6], [13, 9]], 'z'); poly(p, [[5, 10], [1, 10], [3, 7]], 'y');
    thick(p, 5, 10, 10, 5, 0.6, 'h'); p.set(10, 5, 'v').set(11, 4, 'v').set(9, 5, 'v'); p.set(5, 10, 'R').set(4, 11, 'R');
    return out(p);
  },
  spikes() {
    const p = P();
    for (const x of [2, 6, 10]) layer(p, (l) => poly(l, [[x, 11], [x + 2, 2.5], [x + 4, 11]], 'u'), RAMPS.steel);
    p.rect(1, 11, 14, 3, 'g'); p.rect(1, 11, 14, 1, 'h'); p.rect(1, 13, 14, 1, 'f');
    p.set(4, 3, 'w').set(8, 3, 'w').set(12, 3, 'w');
    return out(p);
  },
  harvest() {
    const p = P();
    thick(p, 2, 13, 11, 4, 0.7, 'g'); thick(p, 13, 13, 4, 4, 0.7, 'h');
    layer(p, (l) => poly(l, [[9, 1.5], [13.5, 2], [14.5, 6.5], [11, 5]], 'u'), RAMPS.steel);
    layer(p, (l) => { thick(l, 1, 6, 4, 2, 0.6, 'u'); thick(l, 4, 2, 8, 2, 0.6, 'u'); }, RAMPS.steel);
    p.set(10, 2, 'w');
    return out(p);
  },
  thorns() {
    const p = P();
    brick(p, 1, 8, 7, 3); brick(p, 8, 8, 7, 3); brick(p, 1, 11, 4, 3); brick(p, 5, 11, 7, 3);
    for (let x = 1; x <= 14; x++) p.set(x, 6 + (x % 4 === 0 ? -1 : x % 4 === 2 ? 1 : 0), 'b');
    for (const x of [2, 6, 10, 14]) p.set(x, 4, 'c');
    for (const x of [4, 8, 12]) p.set(x, 8, 'b');
    p.set(5, 5, 'R');
    return out(p);
  },
  living() {
    const p = P();
    layer(p, (l) => { l.rect(3, 6, 10, 8, 't'); for (const x of [3, 6, 9]) l.rect(x, 4, 2, 2, 't'); l.rect(12, 4, 1, 2, 't'); }, RAMPS.stone);
    p.rect(7, 10, 2, 4, 'n');
    put(p, ['.dd', 'dcb', 'cb.'], 11, 1);
    put(p, ['ee.', 'dcc', '.cb'], 2, 1);
    p.set(10, 3, 'b').set(10, 4, 'b').set(5, 3, 'b');
    put(p, ['.d.', 'ded', '.d.'], 12, 8);
    return out(p);
  },
  bigfire() {
    const p = P();
    ring(p, 8, 8, 6, 7, 'y', -Math.PI, 0);
    flame(p, 8, 14.5, 1.65);
    p.set(6, 7, 'w');
    return out(p);
  },
  embers() {
    const p = P();
    layer(p, (l) => { l.rect(3, 9, 10, 3, 't'); l.rect(7, 12, 2, 2, 't'); l.rect(5, 14, 6, 1, 's'); }, RAMPS.stone);
    flame(p, 8, 9, 0.9);
    for (const [x, y] of [[3, 3], [12, 2], [10, 5], [5, 1]]) p.set(x, y, 'y');
    p.set(3, 9, 'u');
    return out(p);
  },
  ash() {
    const p = P();
    layer(p, (l) => { disc(l, 5.5, 8, 3.6, 'u'); disc(l, 10, 7, 4.2, 'u'); l.rect(3, 9, 11, 3, 'u'); }, RAMPS.steel);
    for (const [x, y] of [[4, 13], [7, 14], [10, 13], [12, 14]]) p.set(x, y, 'x');
    p.set(9, 4, 'w');
    for (const [x, y] of [[6, 13], [12, 12]]) p.set(x, y, 'y');
    return out(p);
  },
  farlight() {
    const p = P();
    p.rect(6, 1, 4, 1, 's'); p.rect(7, 0, 2, 1, 's').set(7, 0, '.').set(8, 0, '.');
    p.rect(5, 2, 6, 2, 't'); p.rect(5, 12, 6, 2, 't'); p.rect(5, 2, 6, 1, 'u');
    p.rect(5, 4, 6, 8, 'y'); p.rect(5, 4, 1, 8, 's'); p.rect(10, 4, 1, 8, 's');
    p.rect(7, 6, 2, 4, 'z'); p.set(7, 6, 'w');
    for (const [x, y] of [[2, 6], [1, 8], [2, 10], [13, 6], [14, 8], [13, 10]]) p.set(x, y, 'z');
    return out(p);
  },
  mirror() {
    const p = P();
    p.ellipse(7, 6, 4.6, 5, 'y'); p.ellipse(7, 6, 3.4, 3.9, 'D'); p.ellipse(6, 5, 1.6, 2.2, 'E');
    p.set(7, 2, 'y'); p.rect(6, 11, 2, 4, 'g'); p.set(6, 14, 'f');
    for (const [x, y] of [[12, 2], [13, 1], [13, 4], [14, 5], [12, 7], [13, 8]]) p.set(x, y, 'z');
    return out(p);
  },
  spread() {
    const p = P();
    flame(p, 8, 9.5, 1.1);
    flame(p, 3.5, 14.5, 0.75, ['x', 'y', 'y']); flame(p, 12.5, 14.5, 0.75, ['x', 'y', 'y']);
    p.set(5, 10, 'x').set(11, 10, 'x');
    return out(p);
  },
  rebirth() {
    const p = P();
    put(p, ['.xxx...xxx.', 'xyzyx.xyyyx', 'xzwyyxyyyyx', 'xyyyyyyyyRx', 'xyyyyyyyRRx', '.xyyyyyRRx.', '..xyyyRRx..', '...xyRRx...', '....xRx....', '.....x.....'], 2, 5);
    flame(p, 8, 5.5, 0.6, ['x', 'y', 'z']);
    p.set(3, 2, 'y').set(12, 3, 'y');
    return out(p);
  },
  falsedawn() {
    const p = P();
    for (let k = 0; k < 5; k++) { const a = Math.PI + (k * Math.PI) / 4; p.line(Math.round(7.5 + Math.cos(a) * 5), Math.round(9 + Math.sin(a) * 5), Math.round(7.5 + Math.cos(a) * 6.6), Math.round(9 + Math.sin(a) * 6.6), 'y'); }
    disc(p, 7.5, 10, 4.2, 'y'); ring(p, 7.5, 10, 3, 4.2, 'z', -Math.PI, -Math.PI / 2);
    p.rect(1, 10, 14, 4, 'M'); p.rect(1, 10, 14, 1, 'L'); p.rect(1, 13, 14, 1, 'm');
    p.set(5, 12, 'z').set(10, 11, 'z'); p.set(5, 7, 'w');
    return out(p);
  },
};

// ── Logo ────────────────────────────────────────────────────────────────────────────
// Each letter: a 5×7 skeleton scaled ×3 with chamfered outer corners, banded fire gradient,
// 3px ember extrusion and a flame rising out of the O whose counter glows.
const LOGO_SKEL = {
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
};
function logo() {
  const W = 204, H = 80, S = 4, word = 'EMBERHOLD', gap = 2, lw = 5 * S, lh = 7 * S;
  const ox = Math.floor((W - (word.length * lw + (word.length - 1) * gap)) / 2), base = H - 6 - lh;
  const ink = P(W, H), letterX = [];
  [...word].forEach((ch, i) => {
    const x0 = ox + i * (lw + gap), g = LOGO_SKEL[ch], on = (r, c) => !!(g[r] && g[r][c] === '#');
    letterX.push(x0);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
      const X = x0 + c * S, Y = base + r * S;
      if (on(r, c)) {
        ink.rect(X, Y, S, S, 'y');
        // round only the letter's outer corners (both neighbours empty AND the diagonal empty)
        if (!on(r - 1, c) && !on(r, c - 1) && !on(r - 1, c - 1)) ink.set(X, Y, '.');
        if (!on(r - 1, c) && !on(r, c + 1) && !on(r - 1, c + 1)) ink.set(X + S - 1, Y, '.');
        if (!on(r + 1, c) && !on(r, c - 1) && !on(r + 1, c - 1)) ink.set(X, Y + S - 1, '.');
        if (!on(r + 1, c) && !on(r, c + 1) && !on(r + 1, c + 1)) ink.set(X + S - 1, Y + S - 1, '.');
        continue;
      }
      // smooth diagonal-only joints (M, R leg, O shoulders) with a filled half-cell
      for (let j = 0; j < S; j++) for (let i2 = 0; i2 < S; i2++) {
        const fill = (on(r, c - 1) && on(r + 1, c) && !on(r + 1, c - 1) && i2 + (S - 1 - j) < S - 1 ? 0 : 0) ||
          (on(r - 1, c) && on(r, c + 1) && i2 + (S - 1 - j) >= S + 1) || (on(r - 1, c) && on(r, c - 1) && i2 + j < S - 2) ||
          (on(r + 1, c) && on(r, c + 1) && i2 + j > S) || (on(r + 1, c) && on(r, c - 1) && (S - 1 - i2) + j > S);
        if (fill) ink.set(X + i2, Y + j, 'y');
      }
    }
  });
  // fire gradient bands, lit top/left edges, shaded right/bottom edges
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (ink.d[y][x] === '.') continue;
    const t = (y - base) / lh, band = t < 0.34 ? 'z' : t < 0.67 ? 'y' : 'x';
    let c = band;
    if (ink.get(x, y - 1) === '.') c = t < 0.34 ? 'w' : 'z';
    else if (ink.get(x - 1, y) === '.') c = t < 0.67 ? 'z' : 'y';
    else if (ink.get(x, y + 1) === '.' || ink.get(x + 1, y) === '.') c = t < 0.34 ? 'y' : t < 0.67 ? 'x' : 'R';
    ink.d[y][x] = c;
  }
  const p = P(W, H);
  // flame behind the O (drawn first, letters on top): three curved tongues, each a teardrop in 3 fire tones
  const oi = word.indexOf('O'), Ox = letterX[oi], fx = Ox + lw / 2, fb = base + S + 6;
  const tongue = (cx, h, hw, lean, c) => {
    for (let r = 0; r <= h; r++) {
      const t = r / h, half = hw * Math.pow(1 - t, 0.9) * Math.min(1, (t + 0.12) / 0.3), off = lean * t * t;
      for (let x = Math.ceil(cx + off - half - 0.5); x <= Math.floor(cx + off + half - 0.5); x++) p.set(x, fb - r, c);
    }
  };
  for (const [c, k] of [['x', 1], ['y', 0.74], ['z', 0.46]]) {
    tongue(fx - 7, 22 * k + 4, 6 * k + 0.6, -5 * k, c);
    tongue(fx + 8, 18 * k + 4, 5.5 * k + 0.6, 5 * k, c);
    tongue(fx, 40 * k + 4, 10 * k + 0.8, 7 * k, c);
  }
  p.set(Math.round(fx + 1), fb - 12, 'w').set(Math.round(fx + 2), fb - 14, 'w').set(Math.round(fx + 1), fb - 13, 'w');
  // extrusion: 3px down, dark ember ramp, then the letters
  for (let d = 3; d >= 1; d--) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink.d[y][x] !== '.') p.set(x, y + d, d === 3 ? 'm' : 'r');
  p.stamp(ink);
  // the O's counter is a hearth: dark interior, glowing coals at the bottom
  p.rect(Ox + S, base + S, 3 * S, 5 * S, 'r');
  p.rect(Ox + S, base + S, 3 * S, 2, 'm'); p.rect(Ox + S, base + S, 1, 5 * S, 'm');
  p.ellipse(Ox + lw / 2, base + lh - S - 3, 5.5, 5, 'x');
  p.ellipse(Ox + lw / 2, base + lh - S - 2, 3.5, 3, 'y');
  p.ellipse(Ox + lw / 2, base + lh - S - 1.5, 1.6, 1.5, 'z');
  p.set(Ox + S + 2, base + lh - S - 1, 'y').set(Ox + 4 * S - 3, base + lh - S - 2, 'y');
  p.outline();
  // floating embers outside the outline (same trick as the brazier anchor)
  for (const [dx, dy, c] of [[-17, -26, 'y'], [17, -30, 'x'], [-10, -38, 'x'], [14, -42, 'y'], [-20, -16, 'x'], [4, -49, 'y']]) p.set(Math.round(fx + dx), fb + dy, c);
  return p;
}

// ── Bitmap fonts ────────────────────────────────────────────────────────────────────
// font5: glyph ink 'w' with a 1px 'k' outline; sprite = (gw+2)×11, ink box at (1,1), advance = gw+1.
// Anchor (ax,ay) = (1,1) = top-left of the 9px line cell; neighbouring outlines overlap by exactly 1px.
function glyph(rows, rowsTotal, shade) {
  const gw = Math.max(...rows.map((r) => r.length));
  const p = new Px(gw + 2, rowsTotal + 2);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') p.set(x + 1, y + 1, shade ? shade(y) : 'w'); }));
  return { px: rows.length && rows.some((r) => r.includes('#')) ? p.outline() : p, gw };
}

export default function build() {
  const E = [];
  const ui = (n, px, extra = {}) => E.push({ name: `ui_${n}`, px, kind: 'ui', ...extra });
  ui('panel_parchment', panelParchment(), { slice: [8, 8, 8, 8] });
  ui('panel_stone', panelStone(), { slice: [8, 8, 8, 8] });
  ui('btn_up', button('up'), { slice: [6, 6, 6, 8] });
  ui('btn_down', button('down'), { slice: [6, 6, 6, 8] });
  ui('btn_disabled', button('disabled'), { slice: [6, 6, 6, 8] });
  ui('tab_on', tab(true), { slice: [6, 6, 6, 4] });
  ui('tab_off', tab(false), { slice: [6, 6, 6, 4] });
  for (const r of ['common', 'rare', 'legendary']) ui(`card_${r}`, card(r), { slice: [12, 12, 12, 12] });
  ui('bar_frame', barFrame(), { slice: [3, 3, 3, 3] });
  for (const [n, ramp] of [['red', RAMPS.red], ['green', RAMPS.grass], ['blue', RAMPS.blue], ['gold', RAMPS.fire]]) ui(`bar_fill_${n}`, barFill(ramp), { slice: [2, 1, 1, 1] });
  ui('joy_base', joyBase(), { ax: 24, ay: 24 });
  ui('joy_knob', joyKnob(), { ax: 12, ay: 12 });
  ui('build_ok', buildOk());
  ui('build_bad', buildBad());
  ui('grid_cell', gridCell());
  ui('range_dot', rangeDot(), { ax: 2.5, ay: 2.5 });
  ui('link_dot', linkDot(), { ax: 3, ay: 3 });
  ui('arrow_edge', arrowEdge(), { ax: 8, ay: 8 });
  ui('minimap_frame', minimapFrame(), { slice: [8, 8, 8, 8] });
  ui('blueprint_corner', blueprintCorner());
  for (const [n, f] of Object.entries(ICONS)) E.push({ name: `icon_${n}`, px: f(), kind: 'icon' });
  for (const [n, f] of Object.entries(BOONS)) E.push({ name: `boon_${n}`, px: f(), kind: 'icon' });
  E.push({ name: 'logo', px: logo(), kind: 'ui' });
  for (let c = 32; c <= 126; c++) {
    const ch = String.fromCharCode(c), rows = FONT5[ch];
    if (!rows) throw new Error(`font5 missing glyph ${JSON.stringify(ch)}`);
    const { px, gw } = glyph(rows, 9);
    E.push({ name: `font5_${c}`, px, kind: 'font', ax: 1, ay: 1, advance: gw + 1 });
  }
  for (const ch of '0123456789+-!') {
    const { px, gw } = glyph(FONT7[ch], 9, (y) => (y < 4 ? 'w' : y < 7 ? 'v' : 'u'));
    E.push({ name: `font7_${ch.charCodeAt(0)}`, px, kind: 'font', ax: 1, ay: 1, advance: gw + 1 });
  }
  return E;
}

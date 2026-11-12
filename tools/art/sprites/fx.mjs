// Projectiles + combat/feedback FX. Owner: art-units. All projectiles point EAST (view rotates them).
// FX are bright, few frames, readable at 1×. Fire/explosions: x y z. Frost: C D E. Spark: z + E (+ w core).
// Small solid objects (projectiles, coins, chips, plus) keep the `k` outline; bursts/glows use a darker
// ramp step as their rim instead (FX may skip the outline, SPEC §9.1).
import { Px } from '../pixel.mjs';
import { G, fin, dots, hash, recolor } from './_units_helpers.mjs';

// ring of thickness t around (cx,cy) with radius r (pixel-centre sampled), optional ellipse squash sy
function ring(p, cx, cy, r, t, c, sy = 1, keep = () => true) {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const d = Math.hypot(x - cx, (y - cy) / sy);
    if (d <= r && d > r - t && keep(x, y)) p.set(x, y, c);
  }
  return p;
}
function disc(p, cx, cy, r, c, sy = 1) { return ring(p, cx, cy, r, r + 1, c, sy); }
// colour the rim of whatever is drawn (4-neighbour) with c — a soft "outline" in the FX's own ramp
function rim(p, c) { return p.outline(c); }

// ── projectiles ────────────────────────────────────────────────────────────────
const arrow = () => fin(G([
  '..............',
  '.R.........u..',
  '.oRhhhhhhhhvv.',
  '.R.........u..',
  '..............',
]));
const bolt = () => fin(G([
  '................',
  '.rR.......ut....',
  '.RRggggggguvvv..',
  '.rRffffffftuuw..',
  '.rR.......ut....',
  '................',
]));
const frostShard = () => fin(G([
  '............',
  '.....DD.....',
  '..CDDEEDD...',
  '.CDEEwwEEDw.',
  '..BCCDDCC...',
  '.....CC.....',
  '............',
]));
const mortar = () => fin(G([
  '..........',
  '.....z....',
  '....yg....',
  '...ttts...',
  '..tvuuts..',
  '..tuuuts..',
  '..ttttss..',
  '...ssss...',
  '..........',
]));
const spit = () => G([
  '..........',
  '......LL..',
  '.m..LLwLM.',
  '..mMMLLLMm',
  '.m.mMMMMm.',
  '....mmmm..',
  '..........',
]).outline('n');
const turretShot = () => fin(G([
  '........',
  '.yzzzw..',
  '.xyyyz..',
  '........',
]));
function fireball(f) {
  const p = new Px(14, 10);
  // trailing licks (alternate per frame)
  const tail = f ? [[1, 4], [2, 3], [3, 6], [2, 5], [4, 2]] : [[1, 5], [2, 6], [3, 3], [2, 4], [4, 7]];
  for (const [x, y] of tail) p.set(x, y, 'x');
  disc(p, 8.5, 4.5, 3.6, 'x'); disc(p, 9, 4.5, 2.6, 'y'); disc(p, 9.5, 4.5, 1.4, 'z');
  p.set(10, 4, 'w');
  dots(p, f ? [[5, 2, 'y'], [4, 4, 'y'], [5, 7, 'y']] : [[5, 3, 'y'], [4, 5, 'y'], [5, 6, 'x']]);
  return rim(p, 'r');
}
// lightning segment: 16 px long, enters and exits on row 3 so segments chain end to end
function sparkSeg(f) {
  const ys = f ? [3, 2, 1, 2, 3, 4, 5, 4, 3, 3, 2, 3, 4, 4, 3, 3] : [3, 4, 5, 4, 3, 2, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3];
  const p = new Px(16, 8);
  ys.forEach((y, x) => { p.set(x, y, 'w'); if (p.get(x, y - 1) === '.') p.set(x, y - 1, 'z'); if (p.get(x, y + 1) === '.') p.set(x, y + 1, 'E'); });
  // a branch fork
  if (f) dots(p, [[6, 6, 'E'], [7, 7, 'z']]); else dots(p, [[10, 7, 'E'], [11, 7, 'z'], [6, 0, 'E']]);
  return p;
}

// ── hits & slashes ────────────────────────────────────────────────────────────
function hit(f) {
  const p = new Px(13, 13), c = 6;
  const L = [2, 5, 6][f];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = f === 2 ? 3 : 0; i <= L; i++) p.set(c + dx * i, c + dy * i, i < 2 ? 'w' : i < 4 ? 'z' : 'y');
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) for (let i = f === 2 ? 3 : 1; i <= L - 2; i++) p.set(c + dx * i, c + dy * i, i < 2 ? 'z' : 'y');
  if (f < 2) disc(p, c, c, f ? 1.6 : 1.2, 'w');
  return f === 2 ? p : rim(p, 'x');
}
function slash(f) {
  const p = new Px(18, 18), cx = 5, cy = 9;
  const a0 = [-1.5, -1.5, 0.2][f], a1 = [0.3, 1.4, 1.5][f];
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    const a = Math.atan2(y - cy, x - cx), d = Math.hypot(x - cx, y - cy);
    if (a < a0 || a > a1) continue;
    const mid = (a - a0) / (a1 - a0), th = f === 2 ? 1.2 : 1 + 2.2 * Math.sin(mid * Math.PI);
    if (d <= 11 && d > 11 - th) p.set(x, y, d > 10.2 ? 'w' : d > 9.2 ? 'E' : 'D');
  }
  return f === 2 ? p : rim(p, 'C');
}

// ── explosion 32×32 ──────────────────────────────────────────────────────────
function explosion(f) {
  const p = new Px(32, 32), c = 15.5;
  if (f === 0) { disc(p, c, c, 4, 'y'); disc(p, c, c, 2.6, 'z'); disc(p, c, c, 1.4, 'w'); return rim(p, 'x'); }
  if (f <= 2) {
    const R = f === 1 ? 8 : 11;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const a = Math.atan2(y - c, x - c), d = Math.hypot(x - c, y - c), wob = R + Math.sin(a * 7 + f) * 1.4;
      if (d <= wob) p.set(x, y, d < wob * 0.35 ? 'w' : d < wob * 0.6 ? 'z' : d < wob * 0.85 ? 'y' : 'x');
    }
    for (let i = 0; i < 8; i++) { const a = i * 0.785 + f * 0.4, r = R + 3; p.set(Math.round(c + Math.cos(a) * r), Math.round(c + Math.sin(a) * r), 'y'); }
    return rim(p, 'r');
  }
  if (f === 3) { // fire ring breaking into smoke
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const a = Math.atan2(y - c, x - c), d = Math.hypot(x - c, y - c), R = 13 + Math.sin(a * 5) * 1.2;
      if (d <= R && d > R - 4) p.set(x, y, d > R - 1.5 ? 'x' : 'y');
      else if (d <= R - 4 && d > R - 7 && hash(x, y, 3) < 0.6) p.set(x, y, hash(x, y, 4) < 0.5 ? 't' : 'u');
    }
    return p;
  }
  // f4: scattered smoke puffs + embers
  for (const [x, y, r] of [[8, 9, 3], [23, 8, 3.5], [6, 21, 2.5], [25, 22, 3], [15, 4, 2.5], [16, 27, 2.5]]) { disc(p, x, y, r, 't'); disc(p, x - 0.6, y - 0.6, r * 0.6, 'u'); }
  dots(p, [[14, 15, 'y'], [19, 13, 'x'], [12, 19, 'x'], [20, 19, 'y']]);
  return p;
}
function dust(f) {
  const p = new Px(18, 10);
  const puffs = [[[6, 7, 2], [11, 7, 2]], [[4, 6, 2.6], [9, 5, 3], [14, 6, 2.4]], [[3, 5, 2], [9, 4, 2.4], [15, 5, 1.8]]][f];
  for (const [x, y, r] of puffs) { disc(p, x, y, r, f === 2 ? 'h' : 'i'); disc(p, x - 0.5, y - 0.6, r * 0.5, f < 2 ? 'w' : 'i'); }
  return f === 2 ? p : rim(p, 'h');
}
function heal(f) {
  const p = G([
    '..........',
    '...kkkk...',
    '...kdek...',
    '.kkkdckkk.',
    '.kddwdcck.',
    '.kccdccbk.',
    '.kkkcbkkk.',
    '...kcbk...',
    '...kkkk...',
    '..........',
  ]);
  return f ? dots(p.shift(0, -1), [[8, 1, 'e'], [1, 8, 'd']]) : p;
}
function levelup(f) {
  const p = new Px(32, 32);
  const r = [6, 10, 13, 15][f];
  ring(p, 15.5, 26, r, 2, f < 2 ? 'z' : 'y', 0.35);
  ring(p, 15.5, 26, r - 2, 1, 'y', 0.35);
  // rising arrow + sparkles
  const ay = 18 - f * 4;
  if (f < 3) {
    const ar = G(['...z...', '..zwz..', '.zwwwz.', 'zzywyzz', '..ywy..', '..yzy..', '..yyy..']);
    p.stamp(rim(new Px(9, 9).stamp(ar, 1, 1), 'x'), 11, ay - 1);
  }
  for (const [x, y] of [[5, 20 - f * 3], [26, 18 - f * 3], [9, 10 - f], [23, 8 - f], [16, 4 + f]]) if (y > 0) { p.set(x, y, 'w'); if (f % 2 === 0) { p.set(x - 1, y, 'z'); p.set(x + 1, y, 'z'); } else { p.set(x, y - 1, 'z'); p.set(x, y + 1, 'z'); } }
  return p;
}
function burn(f) {
  const shapes = [
    ['....x.......', '...xy...x...', '...yyx.xy...', '..xyzyxyx...', '..yzzzyyx...', '.xyzwzzyx...', '.xyzzzzyx...', '..xyyyyx....'],
    ['.......x....', '..x...xy....', '..xy.xyyx...', '.xyyxyzyx...', '.xyzzzzyx...', '.xyzwwzyx...', '.xyzzzzyx...', '..xxyyxx....'],
    ['.....x......', '..x.xyx.....', '.xyxyzx.x...', '.xyzzyxxy...', '.yzzwzzyx...', 'xyzwwzzyx...', '.xyzzzzyx...', '..xyyyx.....'],
  ];
  const p = new Px(12, 12).stamp(G(shapes[f]), 0, 3);
  return rim(p, 'r');
}
function snow(f) {
  const p = f ? G(['.........', '....D....', '..D.E.D..', '...EwE...', '.DEwwwED.', '...EwE...', '..D.E.D..', '....D....', '.........'])
    : G(['.........', '.D.....D.', '..E.E.E..', '...EwE...', '..EwwwE..', '...EwE...', '..E.E.E..', '.D.....D.', '.........']);
  return rim(p, 'C');
}
const chip = (ramp, f) => fin(f ? G(['......', '..' + ramp[2] + ramp[1] + '..', '.' + ramp[2] + ramp[1] + ramp[1] + ramp[0] + '.', '..' + ramp[0] + ramp[0] + '..', '......'])
  : G(['......', '.' + ramp[2] + ramp[1] + '...', '.' + ramp[1] + ramp[1] + ramp[0] + '..', '..' + ramp[0] + ramp[0] + '..', '......']));
function coin(f) {
  const g = [
    ['.yyyy.', 'yzzzyx', 'yzyyyx', 'yzyyyx', 'yyyyxx', '.xxxx.'],
    ['..yy..', '.yzyx.', '.yzyx.', '.yzyx.', '.yyxx.', '..xx..'],
    ['..y...', '..zx..', '..yx..', '..yx..', '..yx..', '..x...'],
    ['..yy..', '.yzyx.', '.yyyx.', '.yyyx.', '.yyxx.', '..xx..'],
  ][f];
  return fin(new Px(8, 8).stamp(G(g), 1, 1));
}
function smoke(f) {
  const p = new Px(16, 16), s = [0.55, 0.8, 1][f];
  for (const [x, y, r] of [[7.5, 9, 4], [5, 7, 3], [10, 6, 3.2], [8, 4, 2.6]]) disc(p, 8 + (x - 8) * s, 9 + (y - 9) * s - f, r * s, f === 2 ? 't' : 'u');
  for (const [x, y, r] of [[6.5, 6.5, 1.6], [9.5, 5, 1.3]]) disc(p, 8 + (x - 8) * s, 9 + (y - 9) * s - f, r * s, f === 2 ? 'u' : 'v');
  if (f === 2) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p.get(x, y) !== '.' && hash(x, y, 7) < 0.18) p.set(x, y, '.');
  return f === 2 ? p : rim(p, 't');
}
function frostAura(f) {
  const p = new Px(32, 32);
  ring(p, 15.5, 15.5, 14, 1, 'D', 1, (x, y) => (Math.floor(Math.atan2(y - 15.5, x - 15.5) * 4 + f * 3) % 2) === 0);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + f * Math.PI / 8, x = Math.round(15.5 + Math.cos(a) * 13), y = Math.round(15.5 + Math.sin(a) * 13);
    dots(p, [[x, y, 'w'], [x + 1, y, 'E'], [x - 1, y, 'E'], [x, y + 1, 'E'], [x, y - 1, 'E']]);
  }
  for (let i = 0; i < 6; i++) { const a = i * 1.047 + f * 0.5, x = Math.round(15.5 + Math.cos(a) * 9), y = Math.round(15.5 + Math.sin(a) * 9); p.set(x, y, 'D'); }
  return p.outline('C');
}
function firewall(f) {
  const p = new Px(16, 20);
  for (let x = 1; x < 15; x++) {
    const h = 6 + Math.round(4 * Math.abs(Math.sin(x * 0.9 + f * 1.3)) + 3 * hash(x, f, 2));
    for (let y = 18 - h; y <= 18; y++) { const t = (y - (18 - h)) / h; p.set(x, y, t < 0.25 ? 'x' : t < 0.55 ? 'y' : t < 0.85 ? 'z' : 'y'); }
  }
  for (let x = 2; x < 14; x += 3) p.set(x + (f % 2), 18, 'w');
  dots(p, [[3 + f, 3, 'y'], [11 - f, 4, 'x'], [7, 2 + f, 'y']]);
  return rim(p, 'r');
}
function sanctum(f) {
  const p = new Px(32, 32);
  disc(p, 15.5, 15.5, 14, 'z', 0.55); disc(p, 15.5, 15.5, 12.5, '.', 0.55);
  ring(p, 15.5, 15.5, 11, 1, 'y', 0.55);
  for (let i = 0; i < 6; i++) { // runes
    const a = i * Math.PI / 3 + f * Math.PI / 6, x = Math.round(15.5 + Math.cos(a) * 13.2), y = Math.round(15.5 + Math.sin(a) * 13.2 * 0.55);
    dots(p, [[x, y, 'w'], [x, y - 1, 'w']]);
  }
  // light motes rising
  for (const [x, y] of f ? [[10, 9], [20, 7], [15, 12], [24, 13]] : [[12, 11], [19, 10], [8, 14], [22, 15]]) dots(p, [[x, y, 'w'], [x, y + 1, 'z']]);
  // plus at centre
  dots(p, [[15, 14, 'w'], [16, 14, 'w'], [15, 15, 'w'], [16, 15, 'w'], [14, 15, 'z'], [17, 15, 'z'], [15, 16, 'z'], [16, 16, 'z'], [15, 13, 'z'], [16, 13, 'z'], [14, 14, 'z'], [17, 14, 'z']]);
  return p.outline('y');
}
function stun(f) {
  const p = new Px(18, 9), star = G(['.z.', 'zwz', '.z.']), small = G(['y']);
  const pos = f ? [[2, 4], [8, 1], [13, 4]] : [[4, 2], [10, 4], [14, 1]];
  pos.forEach(([x, y], i) => p.stamp(i === 1 ? star : star, x, y));
  dots(p, f ? [[6, 6], [12, 7]].map(([x, y]) => [x, y, 'y']) : [[2, 6], [8, 7]].map(([x, y]) => [x, y, 'y']));
  return rim(p, 'x');
}
function blink(f) {
  const p = new Px(18, 18);
  if (f === 0) { disc(p, 8.5, 9.5, 5, 'm', 1.3); disc(p, 8.5, 9.5, 3, 'n', 1.3); dots(p, [[7, 8, 'L'], [10, 8, 'L']]); return rim(p, 'M'); }
  if (f === 1) {
    ring(p, 8.5, 9.5, 8, 2, 'M'); ring(p, 8.5, 9.5, 6, 1, 'm');
    for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.3; p.set(Math.round(8.5 + Math.cos(a) * 4), Math.round(9.5 + Math.sin(a) * 4), 'L'); }
    return p;
  }
  for (const [x, y] of [[2, 4], [15, 3], [3, 15], [14, 14], [8, 1], [9, 16]]) dots(p, [[x, y, 'L'], [x + 1, y, 'M'], [x, y + 1, 'm']]);
  return p;
}
function shatter(f) {
  const p = new Px(18, 18), c = 8.5, d = [1.5, 4, 6.5][f];
  const shard = G(['.D', 'DE', 'Cw']);
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.2; p.stamp(f === 2 && i % 2 ? recolor(shard, { w: 'E' }) : shard, Math.round(c + Math.cos(a) * d) - 1, Math.round(c + Math.sin(a) * d) - 1); }
  if (f === 0) disc(p, c, c, 2, 'E');
  return rim(p, 'B');
}

export default function build() {
  const out = [], add = (name, px) => out.push({ name, px, kind: 'fx' });
  add('proj_arrow', arrow()); add('proj_bolt', bolt()); add('proj_frost_shard', frostShard()); add('proj_mortar', mortar());
  add('proj_spit', spit()); add('proj_turret', turretShot());
  for (let i = 0; i < 2; i++) add(`proj_fireball_${i}`, fireball(i));
  for (let i = 0; i < 2; i++) add(`proj_spark_seg_${i}`, sparkSeg(i));
  const anim = (n, k, fn) => { for (let i = 0; i < k; i++) add(`fx_${n}_${i}`, fn(i)); };
  anim('hit', 3, hit); anim('slash', 3, slash); anim('explosion', 5, explosion); anim('dust', 3, dust); anim('heal', 2, heal);
  anim('levelup', 4, levelup); anim('burn', 3, burn); anim('snow', 2, snow);
  anim('chip_wood', 2, (f) => chip(['f', 'g', 'h'], f)); anim('chip_stone', 2, (f) => chip(['s', 't', 'u'], f));
  anim('coin', 4, coin); anim('smoke', 3, smoke); anim('frost_aura', 2, frostAura); anim('firewall', 3, firewall);
  anim('sanctum', 2, sanctum); anim('stun', 2, stun); anim('blink', 3, blink); anim('shatter', 3, shatter);
  return out;
}

import { Px, dots, thick, rng } from './_world_helpers.mjs';
import { cyl, roof, box, bricks, banner, flagPole, frames } from './_bld_a.mjs';

// ── tower parts (1×1, 16 wide) ───────────────────────────────────────────────
function stoneShaft(p, x, y, w, h) { // brick shaft with lit left column, dark right column
  p.rect(x, y, w, h, 't'); bricks(p, x, y, w, h, 't', 's', 4);
  p.rect(x, y, 1, h, 'u'); p.rect(x + w - 1, y, 1, h, 's'); p.rect(x, y + h - 1, w, 1, 's');
  p.speckle('t', 'u', 0.04, x + y);
  return p;
}
function woodLegs(p, x0, x1, y0, y1) { // two front legs + X bracing
  p.rect(x0, y0, 2, y1 - y0 + 1, 'g').rect(x0, y0, 1, y1 - y0 + 1, 'h');
  p.rect(x1, y0, 2, y1 - y0 + 1, 'g').rect(x1 + 1, y0, 1, y1 - y0 + 1, 'f');
  p.line(x0 + 2, y0 + 1, x1 - 1, y1 - 1, 'f'); p.line(x1 - 1, y0 + 1, x0 + 2, y1 - 1, 'g');
  return p;
}
function platform(p, x, y, w, td, fh, mat = 'wood') {
  if (mat === 'wood') { box(p, x, y, w, td, fh, ['f', 'g', 'h']); for (let i = x + 2; i < x + w; i += 3) p.rect(i, y, 1, td, 'g'); p.rect(x, y, w, 1, 'i'); }
  else { box(p, x, y, w, td, fh, ['s', 't', 'u']); p.rect(x, y, w, 1, 'v'); }
  return p;
}
function railing(p, x, y, w) { for (let i = x; i < x + w; i += 3) p.rect(i, y, 1, 3, 'g'); p.rect(x, y, w, 1, 'h'); p.set(x + w - 1, y, 'g'); return p; }
function crenels(p, x, y, w) { for (let i = x; i < x + w; i += 3) { p.rect(i, y, 2, 2, 'u'); p.set(i, y, 'v'); p.set(i + 1, y + 1, 's'); } return p; }
function cone(p, cx, top, bot, half, [lo, mid, hi]) { // conical roof, shingled
  for (let y = top; y <= bot; y++) {
    const t = (y - top) / (bot - top), hw = 0.5 + t * half;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw) - 1; x++) {
      const u = (x + 0.5 - cx) / hw;
      p.set(x, y, u < -0.4 ? hi : u > 0.45 ? lo : ((y - top) % 3 === 2 && (x % 2 === 0)) ? lo : mid);
    }
  }
  for (let x = Math.floor(cx - half - 0.5); x <= Math.ceil(cx + half - 0.5); x++) if (p.get(x, bot) !== '.') p.set(x, bot, lo);
  return p;
}

// ── Arrow tower ───────────────────────────────────────────────────────────────
export function arrowTower(lv) {
  const H = [27, 29, 30][lv - 1], p = new Px(16, H), gy = H - 2;
  if (lv === 1) {
    woodLegs(p, 2, 12, gy - 13, gy);
    p.rect(7, gy - 12, 2, 13, 'h'); for (let y = gy - 11; y <= gy; y += 2) p.rect(7, y, 2, 1, 'f'); // ladder
    platform(p, 1, gy - 19, 14, 3, 3);
    railing(p, 1, gy - 22, 14);
    // bow rack + quiver on the deck, red pennant
    p.rect(11, gy - 23, 1, 4, 'f'); p.set(12, gy - 23, 't').set(12, gy - 22, 'u');
    flagPole(p, 3, gy - 26, 6);
  } else if (lv === 2) {
    stoneShaft(p, 2, gy - 11, 12, 12);
    p.rect(6, gy - 5, 4, 6, 'f').rect(7, gy - 5, 1, 6, 'g').rect(6, gy - 6, 4, 1, 's').set(9, gy - 2, 'y'); // door
    platform(p, 1, gy - 19, 14, 3, 5);
    for (let i = 3; i < 15; i += 4) p.rect(i, gy - 15, 1, 4, 'f'); // timber hoarding studs
    p.rect(1, gy - 16, 14, 1, 't').set(1, gy - 16, 'u');      // iron band
    railing(p, 1, gy - 22, 14);
    p.set(5, gy - 9, 'n').set(5, gy - 8, 'n').set(10, gy - 9, 'n').set(10, gy - 8, 'n'); // arrow slits
    flagPole(p, 12, gy - 27, 7);
  } else {
    stoneShaft(p, 2, gy - 15, 12, 16);
    p.rect(6, gy - 5, 4, 6, 'f').rect(7, gy - 5, 1, 6, 'g').rect(6, gy - 6, 4, 1, 'u').set(9, gy - 2, 'y');
    p.rect(7, gy - 12, 2, 3, 'n');
    platform(p, 1, gy - 19, 14, 2, 3, 'stone');
    crenels(p, 1, gy - 21, 14);
    cone(p, 8, gy - 28, gy - 19, 7.5, ['r', 'R', 'o']);
    p.set(8, gy - 28, 'y').set(7, gy - 28, 'y'); // gold finial
    banner(p, 3, gy - 16, 6, ['r', 'R', 'o']); banner(p, 10, gy - 16, 6, ['r', 'R', 'o']);
  }
  return p.outline();
}

// ── Frost tower (4 frames) ────────────────────────────────────────────────────
function crystal(p, cx, top, hw, h) { // faceted ice crystal: lit left facet, mid, dark right facet
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1), half = t < 0.3 ? 0.5 + (t / 0.3) * (hw - 0.5) : 0.5 + ((1 - t) / 0.7) * (hw - 0.5);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half) - 1; x++) {
      const u = (x + 0.5 - cx);
      p.set(x, top + y, u < -0.5 ? 'E' : u > 0.5 ? 'C' : 'D');
    }
  }
  p.set(Math.round(cx) - 1, top + 2, 'w');
  return p;
}
export function frostTower(lv) {
  const H = [26, 28, 30][lv - 1], base = new Px(16, H), gy = H - 2;
  const ped = [8, 10, 12][lv - 1];
  // pedestal: stepped plinth + octagonal column
  box(base, 2, gy - 3, 12, 1, 3, ['s', 't', 'u']); base.rect(2, gy - 3, 12, 1, 'v');
  stoneShaft(base, 4, gy - ped, 8, ped - 3);
  base.rect(3, gy - ped - 2, 10, 2, 'u').rect(3, gy - ped - 2, 10, 1, 'v').rect(3, gy - ped, 10, 1, 's'); // cap
  base.ellipse(7.5, gy - ped - 2, 3, 0.8, 'B'); // frosted cup
  dots(base, [[7, gy - ped + 3], [8, gy - ped + 4], [7, gy - ped + 5]], 'D'); // rune
  if (lv >= 2) { base.rect(4, gy - ped + 1, 8, 1, 'u'); base.rect(4, gy - 5, 8, 1, 'u'); dots(base, [[5, gy - ped + 1], [10, gy - 5]], 'v'); }
  if (lv >= 2) { crystal(base, 3, gy - ped - 6, 1.6, 5); crystal(base, 13, gy - ped - 5, 1.4, 4); } // side shards
  if (lv === 3) { banner(base, 4, gy - ped + 2, 5, ['B', 'C', 'D'], 'E'); banner(base, 9, gy - ped + 2, 5, ['B', 'C', 'D'], 'E'); }
  const ch = [11, 13, 15][lv - 1], chw = [2.8, 3.2, 3.8][lv - 1];
  return frames(base, 4, (p, f) => {
    const bob = [0, -1, -1, 0][f];
    crystal(p, 8, gy - ped - 3 - ch + bob, chw, ch);
    p.set(7, gy - ped - 3 - ch + bob + 2 + (f % 2), 'w');
  }, (p, f) => { // snow motes orbiting the crystal (outside the outline)
    const a = (f / 4) * Math.PI * 2, cy = gy - ped - 3 - ch / 2;
    for (let i = 0; i < (lv + 1); i++) {
      const b = a + (i * Math.PI * 2) / (lv + 1), x = Math.round(8 + Math.cos(b) * 6.5), y = Math.round(cy + Math.sin(b) * 2.5);
      if (p.get(x, y) === '.') p.set(x, y, i % 2 ? 'D' : 'E');
    }
  });
}

// ── Spark tower (4 frames) ────────────────────────────────────────────────────
export function sparkTower(lv) {
  const H = [27, 29, 30][lv - 1], base = new Px(16, H), gy = H - 2;
  box(base, 2, gy - 4, 12, 1, 4, ['s', 't', 'u']); base.rect(2, gy - 4, 12, 1, 'v');
  const coilTop = gy - [16, 18, 19][lv - 1];
  if (lv === 1) { base.rect(6, coilTop, 4, gy - 4 - coilTop, 'g'); base.rect(6, coilTop, 1, gy - 4 - coilTop, 'h'); base.rect(9, coilTop, 1, gy - 4 - coilTop, 'f'); }
  else stoneShaft(base, 4, gy - 9, 8, 6);
  // copper coil wound around the mast
  const cb = lv === 1 ? gy - 5 : gy - 10;
  for (let y = coilTop + 2; y <= cb; y++) {
    const w = 3 + (lv >= 2 ? 1 : 0);
    for (let x = 8 - w; x < 8 + w; x++) base.set(x, y, (y % 2) ? (x < 8 - w + 2 ? 'y' : x >= 8 + w - 2 ? 'x' : 'y') : 'f');
    base.set(8 - w, y, y % 2 ? 'z' : 'g');
  }
  if (lv >= 2) { // side prongs
    for (const [x, d] of [[2, -1], [13, 1]]) { base.rect(x, coilTop + 3, 1, 6, 't'); base.set(x, coilTop + 2, 'u'); base.set(x - d, coilTop + 8, 't'); base.set(x, coilTop + 1, 'y'); }
  }
  // orb
  const orbR = [2.4, 2.8, 3.4][lv - 1], oy = coilTop - orbR + 0.5;
  if (lv < 3) { base.ellipse(7.5, oy, orbR, orbR, 'y'); base.ellipse(7, oy - 0.5, orbR * 0.5, orbR * 0.5, 'z'); base.set(Math.round(7.5 + orbR) - 1, Math.round(oy), 'x').set(Math.round(7.5 + orbR) - 1, Math.round(oy) + 1, 'x'); }
  else { base.ellipse(7.5, oy, orbR, orbR, 'C'); base.ellipse(7, oy - 0.7, orbR * 0.55, orbR * 0.55, 'D'); base.set(6, Math.round(oy) - 2, 'E'); base.rect(4, Math.round(oy), 8, 1, 'y'); base.set(11, Math.round(oy), 'x'); base.set(9, Math.round(oy) + 2, 'B').set(10, Math.round(oy) + 1, 'B'); }
  if (lv === 3) { base.rect(2, gy - 9, 12, 1, 'u'); dots(base, [[3, gy - 9], [12, gy - 9]], 'y'); }
  return frames(base, 4, () => {}, (p, f) => {
    // lightning arcs leaping from the orb; different each frame, drawn over the outline (FX-bright)
    const r = rng(f * 7 + lv * 31), arcs = lv + (f % 2);
    for (let i = 0; i < arcs; i++) {
      const ang = r() * Math.PI * 2, len = 4 + Math.floor(r() * 3);
      let x = 7.5 + Math.cos(ang) * orbR, y = oy + Math.sin(ang) * orbR;
      for (let k = 0; k < len; k++) {
        x += Math.cos(ang) + (r() - 0.5) * 1.4; y += Math.sin(ang) * 0.8 + (r() - 0.5) * 1.4;
        const X = Math.round(x), Y = Math.round(y);
        if (X < 0 || X > 15 || Y < 0) break;
        if (p.get(X, Y) === '.') p.set(X, Y, k === len - 1 ? 'D' : (k % 2 ? 'E' : 'w'));
      }
    }
  });
}

// ── Ballista (2×2 base + 8-direction head) ────────────────────────────────────
export const BALLISTA_PIVOT = { x: 16, y: 17 }; // base-sprite pixel where the head's anchor goes
export function ballistaBase(lv) {
  const H = 36, p = new Px(32, H);
  const stone = lv >= 2;
  // round gun platform: top ellipse centred on the pivot, 7px front wall
  if (!stone) {
    cyl(p, 16, 17, 14, 9, 7, ['f', 'g', 'h'], { top: 'h', rim: ['g', 'i'] });
    for (let y = 9; y < 27; y++) for (let x = 0; x < 32; x++) if (p.get(x, y) === 'h' && x % 4 === 1) p.set(x, y, 'g');
    for (let x = 0; x < 32; x++) for (let y = 24; y < 34; y++) if ('gf'.includes(p.get(x, y)) && y > 26 && x % 5 === 0) p.set(x, y, 'f');
    for (const x of [6, 25]) { p.rect(x, 25, 2, 8, 'f'); p.set(x, 25, 'g'); } // lashing posts
    for (let x = 3; x < 29; x++) if ('gfh'.includes(p.get(x, 29))) p.set(x, 29, 't');      // iron hoop
  } else {
    cyl(p, 16, 17, 14, 9, 7, ['s', 't', 'u'], { top: 'u', rim: ['t', 'v'] });
    bricks(p, 2, 25, 28, 9, 't', 's', 6);
    p.ellipse(16, 17, 11, 6.5, 'h');
    for (let y = 10; y < 24; y++) for (let x = 0; x < 32; x++) if (p.get(x, y) === 'h' && x % 3 === 0) p.set(x, y, 'g');
    p.speckle('u', 'v', 0.12, 4);
    if (lv === 3) { for (const [x, y] of [[3, 15], [27, 15], [8, 9], [22, 9]]) { p.rect(x, y, 3, 2, 'v'); p.rect(x, y + 2, 3, 1, 's'); } } // merlons
  }
  // iron turntable
  p.ellipse(16, 17, 7, 4, 's').ellipse(16, 16.6, 6, 3.2, 't').ellipse(16, 17, 4, 2, 'f');
  for (const [x, y] of [[10, 17], [22, 17], [16, 13], [16, 21]]) p.set(x, y, 'u');
  if (lv >= 2) for (let i = 0; i < 3; i++) { p.rect(22, 21 + i * 2, 5, 1, 'g'); p.set(26, 21 + i * 2, 'v'); p.set(22, 21 + i * 2, 'f'); } // bolt rack
  if (lv === 2) for (let x = 3; x < 29; x++) if ('ts'.includes(p.get(x, 30))) p.set(x, 30, 'u');
  if (lv === 3) { banner(p, 7, 26, 5, ['r', 'R', 'o']); banner(p, 22, 26, 5, ['r', 'R', 'o']); flagPole(p, 5, 3, 8); p.rect(6, 19, 3, 3, 'g').rect(6, 19, 3, 1, 'h').set(8, 21, 'f'); }
  return p.outline();
}
// dir 0 = east, counter-clockwise in 45° steps. 28×24 canvas, pivot (14, 12).
export const BALLISTA_HEAD_PIVOT = { x: 14, y: 12 };
export function ballistaHead(dir, lv = 1) {
  const W = 28, H = 24, p = new Px(W, H), cx = 14, cy = 12;
  const a = (dir * Math.PI) / 4, fx = Math.cos(a), fy = -Math.sin(a) * 0.75, sa = Math.sin(a), ca = Math.cos(a) * 0.75;
  const local = (x, y) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; return [(dx * ca - sa * dy) / 0.75, (fx * dy - fy * dx) / 0.75]; };
  const arcF = (s) => 3.5 - 0.03 * s * s;
  const shape = (f, s) => {
    const as = Math.abs(s);
    if (f > 7.8 && f < 11.5 && as < 1.3 - (f - 7.8) * 0.33) return 'v';               // bolt head
    if (as < 0.75 && f > -4 && f <= 7.8) return 'u';                                 // bolt shaft
    if (as <= 10.5 && Math.abs(f - arcF(s)) < (as < 5 ? 1.3 : 0.95)) return 'A';      // bow arms
    if (as < 10.5 && Math.abs(f - (-4 + (as / 10.5) * (arcF(10.5) + 4))) < 0.5) return 'S'; // string
    if (as < 2.4 && f > -8 && f < 5.5) return 'B';                                   // stock / carriage
    if (as < 3.6 && f > -9 && f < -6) return 'W';                                    // winch drum
    return null;
  };
  const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => shape(...local(x, y))));
  const is = (x, y, c) => grid[y]?.[x] === c;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = grid[y][x]; if (!c) continue;
    let col = c;
    if (c === 'B') col = !is(x, y - 1, 'B') ? 'h' : !is(x, y + 1, 'B') || !is(x + 1, y, 'B') ? 'f' : 'g';
    if (c === 'A') col = !is(x, y - 1, 'A') ? 'h' : !is(x, y + 1, 'A') ? 'f' : 'g';
    if (c === 'S') col = 'i';
    if (c === 'W') col = !is(x, y - 1, 'W') ? 'u' : !is(x, y + 1, 'W') ? 's' : 't';
    p.set(x, y, col);
  }
  p.set(cx, cy, lv >= 3 ? 'y' : 't'); p.set(cx - 1, cy, 'u'); // pivot pin
  return p.outline();
}

// ── Mortar (2×2) ──────────────────────────────────────────────────────────────
export function mortar(lv) {
  const H = [34, 36, 38][lv - 1], p = new Px(32, H), gy = H - 2;
  // low ring wall around a sunken floor
  const ry = 6.5, cy = gy - 12;
  cyl(p, 16, cy, 14.5, ry, 4, ['s', 't', 'u'], { top: 'u', rim: ['t', 'v'] });
  bricks(p, 2, cy, 28, ry + 6, 't', 's', 5);
  p.ellipse(16, cy, 11.5, ry - 2.2, lv === 1 ? 'g' : 'f');
  if (lv === 1) for (let x = 5; x < 28; x += 3) for (let y = cy - 4; y <= cy + 4; y++) if (p.get(x, y) === 'g') p.set(x, y, 'f'); // plank floor
  else p.speckle('f', 'g', 0.2, 7);
  p.speckle('u', 'v', 0.1, 3);
  if (lv === 3) for (const [x, y] of [[2, cy - 2], [27, cy - 2], [7, cy - 6], [22, cy - 6]]) { p.rect(x, y, 3, 2, 'v'); p.rect(x, y + 2, 3, 1, 's'); } // merlons
  // cradle
  const by = cy + 1;
  box(p, 10, by - 1, 12, 2, 3, ['f', 'g', 'h']);
  // barrel: bulb + short neck tilted back, mouth facing up
  const br = [5, 5.5, 6.5][lv - 1];
  const tone = (x, cx, r) => { const u = (x + 0.5 - cx) / r; return u < -0.5 ? 'u' : u > 0.35 ? 's' : 't'; };
  for (let y = Math.floor(by - br * 0.8); y <= by + 1; y++) for (let x = 0; x < 32; x++) if (((x + 0.5 - 16) / (br + 1)) ** 2 + ((y + 0.5 - by + 1) / (br * 0.8)) ** 2 <= 1) p.set(x, y, tone(x, 16, br + 1));
  const neckH = [8, 9, 11][lv - 1];
  for (let k = 0; k <= neckH; k++) { const yc = by - 2 - k; for (let x = 0; x < 32; x++) if (Math.abs(x + 0.5 - 16) <= br - 0.4) p.set(x, yc, tone(x, 16, br)); }
  const band = lv === 3 ? ['y', 'x'] : lv === 2 ? ['u', 's'] : ['s', 'n'];
  for (const k of lv === 1 ? [2] : [2, neckH - 1]) for (let x = 0; x < 32; x++) if (Math.abs(x + 0.5 - 16) <= br - 0.4) p.set(x, by - 2 - k, x > 17 ? band[1] : band[0]);
  const my = by - 3 - neckH;
  p.ellipse(16, my, br, 2.2, 'u'); p.ellipse(16, my, br - 1.2, 1.4, 'n'); p.rect(15, my, 2, 1, 'k'); p.set(Math.round(16 + br) - 1, my, 's');
  p.set(Math.round(16 - br) + 1, by - 4, 'v').set(Math.round(16 - br) + 1, by - 5, 'v');
  // shells + powder keg
  const balls = lv === 1 ? [[24, cy + 1]] : [[23, cy + 1], [26, cy + 1], [24.5, cy - 1]];
  for (const [x, y] of balls) { p.ellipse(x, y, 1.5, 1.5, 's'); p.set(Math.floor(x) - 1, y - 1, 'u'); p.set(Math.floor(x) + 1, y + 1, 'n'); }
  if (lv >= 2) { p.rect(5, cy - 1, 3, 4, 'g').rect(5, cy - 1, 3, 1, 'h').rect(7, cy, 1, 3, 'f').set(5, cy + 1, 't').set(6, cy + 1, 't'); }
  if (lv === 3) { flagPole(p, 4, 1, 10); banner(p, 14, gy - 5, 4, ['r', 'R', 'o']); }
  return p.outline();
}

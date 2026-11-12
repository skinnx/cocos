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
    const t = y / (h - 1), half = t < 0.35 ? (t / 0.35) * hw : ((1 - t) / 0.65) * hw;
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
  const ch = [10, 11, 13][lv - 1], chw = [3.2, 3.6, 4.2][lv - 1];
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
        if (p.get(X, Y) === '.' || p.get(X, Y) === 'k') p.set(X, Y, k === len - 1 ? 'D' : (k % 2 ? 'E' : 'w'));
      }
    }
  });
}

// ── Ballista (2×2 base + 8-direction head) ────────────────────────────────────
export const BALLISTA_PIVOT = { x: 16, y: 18 }; // where the head's anchor sits on the base sprite
export function ballistaBase(lv) {
  const H = 36, p = new Px(32, H), gy = H - 2;
  const mat = lv === 1 ? 'wood' : 'stone';
  if (mat === 'wood') {
    box(p, 2, 8, 28, 19, 7, ['f', 'g', 'h']);
    for (let x = 4; x < 30; x += 4) p.rect(x, 8, 1, 19, 'g'); p.rect(2, 8, 28, 1, 'i');
    for (let y = 28; y < 33; y += 2) for (let x = 3; x < 29; x++) if (x % 7 === 0) p.set(x, y, 'f');
    for (const x of [2, 28]) { p.rect(x, 26, 2, 8, 'f'); p.rect(x, 26, 1, 8, 'g'); } // corner posts
  } else {
    box(p, 2, 9, 28, 17, 8, ['s', 't', 'u']);
    bricks(p, 3, 27, 26, 7, 't', 's', 6);
    p.rect(2, 9, 28, 1, 'v').rect(2, 9, 1, 17, 'v');
    // wooden deck inset
    p.rect(5, 11, 22, 13, 'h'); for (let x = 7; x < 27; x += 3) p.rect(x, 11, 1, 13, 'g'); p.rect(5, 11, 22, 1, 'i').rect(26, 11, 1, 13, 'g').rect(5, 23, 22, 1, 'f');
    crenels(p, 2, 7, 28);
  }
  // turntable ring
  p.ellipse(16, 18, 6, 3.4, 'f').ellipse(16, 18, 4.6, 2.4, 't').ellipse(16, 18, 2.4, 1.2, 's');
  for (const [x, y] of [[11, 18], [21, 18], [16, 15], [16, 21]]) p.set(x, y, 'u');
  // bolt rack on the right side of the deck
  if (lv >= 2) for (let i = 0; i < 3; i++) { p.rect(24, 12 + i * 2, 4, 1, 'g'); p.set(27, 12 + i * 2, 'u'); }
  if (lv === 3) {
    for (const x of [2, 27]) { p.rect(x, 26, 3, 8, 'u'); p.rect(x, 26, 1, 8, 'v'); p.rect(x + 2, 26, 1, 8, 't'); dots(p, [[x + 1, 28], [x + 1, 32]], 's'); }
    banner(p, 7, 27, 5, ['r', 'R', 'o']); banner(p, 22, 27, 5, ['r', 'R', 'o']);
    flagPole(p, 4, 1, 7);
  }
  if (lv === 2) { p.rect(3, 26, 26, 1, 'u'); dots(p, [[6, 26], [16, 26], [26, 26]], 'v'); }
  return p.outline();
}
// dir 0 = east, counter-clockwise in 45° steps. Pivot at (12, 11) of a 24×20 canvas.
export function ballistaHead(dir, lv = 1) {
  const p = new Px(24, 20), cx = 12, cy = 11;
  const a = (dir * Math.PI) / 4, fx = Math.cos(a), fy = -Math.sin(a) * 0.75;
  // forward axis (fx, fy) and side axis, both foreshortened 0.75 vertically for the ¾ view
  const px = (f, s) => [cx + fx * f + Math.sin(a) * s, cy + fy * f + Math.cos(a) * 0.75 * s];
  const P = (f, s) => { const v = px(f, s); return [Math.round(v[0]), Math.round(v[1])]; };
  // mount (under everything)
  p.ellipse(cx - 0.5, cy + 1, 3.5, 2.2, 'f').ellipse(cx - 0.5, cy + 0.5, 2.4, 1.4, 'g');
  // stock
  thick(p, ...P(-6, 0), ...P(7, 0), 'g', 2);
  p.line(...P(-6, 0), ...P(7, 0), 'h');
  // bow arms (bent back) + string
  const tipL = P(1, 8.5), tipR = P(1, -8.5), root = P(4, 0), nock = P(-3, 0);
  thick(p, ...root, ...P(3.5, 4.5), 'f', 2); thick(p, ...P(3.5, 4.5), ...tipL, 'f', 1);
  thick(p, ...root, ...P(3.5, -4.5), 'f', 2); thick(p, ...P(3.5, -4.5), ...tipR, 'f', 1);
  p.line(...P(3.5, 4.5), ...tipL, 'h'); p.line(...P(3.5, -4.5), ...tipR, 'g');
  p.line(...tipL, ...nock, 'w'); p.line(...tipR, ...nock, 'w');
  // bolt with steel head
  p.line(...P(-2, 0), ...P(8, 0), 'u'); p.set(...P(9, 0), 'v'); p.set(...P(8, 0), 'v');
  // steel fittings
  p.set(...root, 't'); p.set(...tipL, 's'); p.set(...tipR, 's'); p.set(...P(-6, 0), 'f');
  if (lv) p.set(...P(0, 0), 'y');
  return p.outline();
}

// ── Mortar (2×2) ──────────────────────────────────────────────────────────────
export function mortar(lv) {
  const H = [34, 36, 38][lv - 1], p = new Px(32, H), gy = H - 2;
  // emplacement ring
  cyl(p, 16, gy - 11, 14, 5.5, 5, ['s', 't', 'u'], { top: lv === 1 ? 'g' : 'h', rim: ['t', 'v'] });
  bricks(p, 2, gy - 9, 28, 9, 't', 's', 5);
  if (lv === 1) for (let x = 4; x < 29; x += 3) p.set(x, gy - 11, 'f'); // plank floor
  // sandbags / parapet blocks on the rim
  if (lv >= 2) for (const x of [3, 9, 20, 26]) { p.rect(x, gy - 7, 4, 2, lv === 3 ? 'u' : 'i'); p.rect(x, gy - 6, 4, 1, lv === 3 ? 't' : 'h'); p.set(x + 3, gy - 7, lv === 3 ? 't' : 'h'); }
  // barrel: squat iron cylinder tilted toward the north, mouth up
  const br = [5, 5.5, 6.5][lv - 1], by = gy - 16;
  p.rect(Math.round(16 - br), by - 6, Math.round(br * 2), 10, 't');
  p.ellipse(16, by + 4, br, 2.4, 't');
  for (let y = by - 6; y <= by + 6; y++) for (let x = 0; x < 32; x++) if (p.get(x, y) === 't' && x <= 16 - br + 1) p.set(x, y, 'u'); else if (p.get(x, y) === 't' && x >= 16 + br - 2) p.set(x, y, 's');
  p.rect(Math.round(16 - br) + 2, by - 6, 1, 10, 'v');
  // bands
  const band = lv === 3 ? 'y' : 'f', bandD = lv === 3 ? 'x' : 'f';
  for (const yy of [by - 2, by + 2]) for (let x = Math.round(16 - br); x < Math.round(16 + br); x++) p.set(x, yy, x >= 16 + br - 2 ? bandD : band);
  // mouth
  p.ellipse(16, by - 6, br, 2.2, 'u'); p.ellipse(16, by - 6, br - 1.3, 1.3, 'n'); p.ellipse(16.5, by - 5.5, br - 2.5, 0.6, 'k');
  // trunnion mount
  p.rect(Math.round(16 - br) - 2, by, 2, 4, 'g').rect(Math.round(16 + br), by, 2, 4, 'f');
  // cannonballs
  const balls = lv === 1 ? [[25, gy - 12]] : [[24, gy - 12], [27, gy - 12], [25.5, gy - 14]];
  for (const [x, y] of balls) { p.ellipse(x, y, 1.6, 1.6, 's'); p.set(Math.floor(x) - 1, y - 1, 'u'); }
  if (lv === 3) { flagPole(p, 5, gy - 30, 10); banner(p, 26, gy - 6, 4, ['r', 'R', 'o']); }
  if (lv >= 2) { p.rect(4, gy - 14, 3, 3, 'g').rect(4, gy - 14, 3, 1, 'h').set(6, gy - 13, 'f'); } // powder keg
  return p.outline();
}

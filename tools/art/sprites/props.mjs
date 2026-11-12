// World props (SPEC §9.3/§9.4): trees, rocks, ore, ruins, containers, POIs, rift, shadows.
// Technique (B): procedural shapes + per-volume top-left shading + hand-placed details + outline().
// Anchors: bottom-centre (default) except shadows and the rift (ground decals, centred).
import { Px, RAMPS, hash, rng, dots, shadeRegion, thick } from './_world_helpers.mjs';

// Shade a roughly round volume: per-pixel light from top-left inside an ellipse frame.
function volume(p, cx, cy, rx, ry, [lo, mid, hi], { on = null, hiT = -0.55, loT = 0.45 } = {}) {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = p.get(x, y); if (c === '.' || (on ? !on.includes(c) : c !== mid)) continue;
    const t = ((x + 0.5 - cx) / rx) * 0.6 + ((y + 0.5 - cy) / ry) * 0.8;
    p.set(x, y, t < hiT ? hi : t > loT ? lo : mid);
  }
  return p;
}
// Foliage clump: disc in `mid`, lit crescent top-left, shadow crescent bottom-right.
function clump(p, cx, cy, r, ramp = RAMPS.leaf, ry = r) {
  const [lo, mid, hi] = ramp;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / ry; const d = dx * dx + dy * dy;
      if (d > 1) continue;
      // crescents: offset circles
      const lit = ((x + 0.5 - (cx - r * 0.35)) / r) ** 2 + ((y + 0.5 - (cy - ry * 0.4)) / ry) ** 2 < 0.42;
      const dark = ((x + 0.5 - (cx + r * 0.3)) / r) ** 2 + ((y + 0.5 - (cy + ry * 0.45)) / ry) ** 2 > 0.75;
      p.set(x, y, lit ? hi : dark ? lo : mid);
    }
  return p;
}
// Knock 2-3 px off each corner of a boxy silhouette (before outline) so crates/chests read as objects, not squares.
function chamfer(p, x0, y0, x1, y1, n = 2) {
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) { p.set(x0 + i, y0 + j, '.'); p.set(x1 - i, y0 + j, '.'); p.set(x0 + i, y1 - j, '.'); p.set(x1 - i, y1 - j, '.'); }
  return p;
}
function trunk(p, x, y, w, h) { // light left column, dark right column, root flare
  p.rect(x, y, w, h, 'g'); p.rect(x, y, 1, h, 'h'); p.rect(x + w - 1, y, 1, h, 'f');
  p.set(x - 1, y + h - 1, 'g').set(x + w, y + h - 1, 'f').set(x + 1, y + h - 2, 'f');
  return p;
}

// ── trees ─────────────────────────────────────────────────────────────────────
function pine(v) {
  const p = new Px(18, 26), cx = 9;
  trunk(p, 8, 20, 2, 5);
  // tiers: [top y, rows, max half-width]; branch tips droop at the tier hem
  const tiers = v === 0 ? [[13, 8, 7.5], [8, 7, 5.6], [3, 6, 3.8]] : [[15, 6, 8], [11, 6, 6.6], [7, 5, 5], [2, 6, 3.2]];
  tiers.forEach(([y0, rows, mh], ti) => {
    for (let r = 0; r < rows; r++) {
      const half = 0.6 + (r * (mh - 0.6)) / (rows - 1);
      for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
        // jagged hem: every other column on the last row hangs 1px lower
        p.set(x, y0 + r, 'b');
      }
    }
    const hem = y0 + rows; const half = mh;
    for (let x = Math.round(cx - half) + 1; x < Math.round(cx + half) - 1; x += 2) p.set(x + (ti % 2), hem, 'b');
  });
  // light: left/top lighter, right darker, then tier hems shadowed
  volume(p, cx - 1, 12, 7, 10, ['a', 'b', 'c'], { on: ['b'], hiT: -0.35, loT: 0.35 });
  tiers.forEach(([y0, rows, mh]) => { // the underside of each tier is in shadow over the tier below
    for (let x = 0; x < 18; x++) { if (p.get(x, y0 + rows) !== '.' && p.get(x, y0 + rows - 1) !== '.') p.set(x, y0 + rows, 'a'); }
    for (let r = 0; r < 2; r++) { const yy = y0 + r; for (let x = 0; x < 18; x++) if (p.get(x, yy) === 'b' && x < cx) p.set(x, yy, 'c'); }
  });
  p.speckle('b', 'c', 0.12, 3 + v).speckle('c', 'd', 0.12, 9 + v).speckle('a', 'b', 0.1, 4 + v);
  dots(p, v === 0 ? [[7, 4], [6, 9], [5, 15], [8, 10]] : [[8, 3], [6, 8], [5, 12], [4, 17]], 'd');
  if (v === 1) dots(p, [[11, 9], [12, 14], [8, 18]], 'e'); // fresh tips
  return p.outline();
}
function oak(v) {
  const p = new Px(18, 26);
  trunk(p, 7, 17, 4, 8);
  p.set(6, 24, 'g').set(11, 24, 'f').set(12, 24, 'f'); // roots
  p.rect(8, 19, 1, 3, 'f').set(9, 22, 'f'); // bark groove
  // branch stubs under the crown
  p.set(6, 17, 'g').set(5, 16, 'g').set(11, 17, 'f').set(12, 16, 'f');
  const clumps = v === 0
    ? [[5, 12, 4.2], [12.5, 12, 4.3], [9, 13.5, 4.5], [6.5, 7, 4.2], [11.5, 7.5, 4.2], [9, 4.5, 4]]
    : [[4.8, 13, 4], [13, 13, 4], [9, 14.5, 4.2], [5, 8, 4], [12.5, 8.5, 4.2], [8.5, 9.5, 4.2], [9, 4.5, 3.6]];
  // back-to-front: draw from the top/back clumps toward the front so lower clumps overlap
  [...clumps].sort((a, b) => a[1] - b[1]).forEach(([x, y, r]) => clump(p, x, y, r, ['a', 'b', 'c'], r * 0.92));
  p.speckle('b', 'a', 0.05, 11 + v).speckle('c', 'd', 0.14, 5 + v);
  dots(p, v === 0 ? [[5, 3], [3, 9], [7, 1]] : [[6, 2], [2, 10], [8, 6]], 'd');
  if (v === 1) { // fruit tree: red apples with a glint
    for (const [x, y] of [[4, 12], [12, 11], [8, 15], [14, 15], [10, 6]]) p.set(x, y, 'R').set(x, y + 1, 'r').set(x - 1, y, 'o');
  } else {
    dots(p, [[11, 10], [6, 14]], 'e');
  }
  return p.outline();
}
function stump() {
  const p = new Px(14, 11);
  p.rect(2, 4, 10, 5, 'g').rect(1, 8, 12, 1, 'g'); // bark front + root flare
  p.set(0, 9, 'g').set(13, 9, 'f').rect(1, 9, 12, 1, 'f');
  p.rect(11, 4, 1, 5, 'f').rect(2, 4, 1, 4, 'h');
  for (const x of [4, 7, 9]) p.rect(x, 5, 1, 3, 'f');
  p.ellipse(6.5, 3.5, 5, 2.3, 'h'); // cut top
  p.ellipse(6.5, 3.5, 3.2, 1.3, 'i').ellipse(6.5, 3.5, 1.4, 0.6, 'h');
  p.set(9, 2, 'g').set(10, 3, 'g'); // radial crack
  p.set(3, 3, 'i').set(2, 4, 'h');
  dots(p, [[1, 7], [12, 6]], 'c'); // moss
  return p.outline();
}
function bush(v) {
  const p = new Px(16, 12);
  const cl = v === 0 ? [[5, 6.5, 3.6], [10.5, 6.5, 3.8], [8, 4.5, 3.6]] : [[4.5, 7, 3.4], [11, 7, 3.4], [7.5, 5, 3.4], [10, 4, 2.6]];
  cl.forEach(([x, y, r]) => clump(p, x, y, r, ['a', 'b', 'c'], r * 0.85));
  p.speckle('c', 'd', 0.15, 21 + v);
  if (v === 1) for (const [x, y] of [[4, 5], [8, 3], [11, 6], [6, 8], [12, 3]]) p.set(x, y, 'R').set(x + 1, y, 'r');
  else dots(p, [[5, 3], [9, 2], [12, 5]], 'w');
  return p.outline();
}

// ── rocks & ore ───────────────────────────────────────────────────────────────
// Boulder: union of ellipses; top facet lit, front mid, base/right dark; crack + moss.
function boulder(p, parts, seed, { moss = true } = {}) {
  parts.forEach(([x, y, rx, ry]) => p.ellipse(x, y, rx, ry, 't'));
  // facet lighting per part, back to front
  parts.forEach(([x, y, rx, ry]) => {
    for (let yy = Math.floor(y - ry); yy <= Math.ceil(y + ry); yy++) for (let xx = Math.floor(x - rx); xx <= Math.ceil(x + rx); xx++) {
      if ((((xx + 0.5 - x) / rx) ** 2 + ((yy + 0.5 - y) / ry) ** 2) > 1) continue;
      const ty = (yy + 0.5 - y) / ry, tx = (xx + 0.5 - x) / rx;
      p.set(xx, yy, ty < -0.25 && tx < 0.55 ? 'u' : (ty > 0.55 || tx > 0.7) ? 's' : 't');
    }
  });
  // top-edge sparkle and wear
  p.speckle('u', 'v', 0.18, seed).speckle('t', 's', 0.06, seed + 1).speckle('t', 'u', 0.05, seed + 2);
  if (moss) p.speckle('u', 'c', 0.07, seed + 3);
  return p;
}
function rock(size) {
  if (size === 's') {
    const p = new Px(12, 10); boulder(p, [[6, 5.5, 4.6, 3.6]], 41);
    p.set(5, 6, 's').set(6, 7, 's'); return p.outline();
  }
  if (size === 'm') {
    const p = new Px(16, 13); boulder(p, [[6.5, 7, 5.3, 4.8], [11, 8.5, 3.6, 3.3]], 43);
    p.set(7, 7, 's').set(8, 8, 's').set(8, 9, 's'); dots(p, [[3, 4], [4, 4]], 'c'); return p.outline();
  }
  const p = new Px(24, 20);
  boulder(p, [[10, 9.5, 8.2, 7.6], [17.5, 12.5, 5.2, 5.4], [5, 14.5, 4, 3.6]], 47);
  thick(p, 9, 8, 11, 13, 's'); p.set(12, 13, 's').set(10, 9, 'n');
  p.set(16, 11, 's').set(17, 12, 's');
  dots(p, [[6, 3], [7, 3], [8, 2], [5, 4]], 'c'); dots(p, [[7, 2], [6, 2]], 'd');
  return p.outline();
}
function ore(v) {
  const p = new Px(16, 14);
  if (v === 0) boulder(p, [[7.5, 7.5, 6, 5.5], [3.5, 10, 3, 2.8]], 53, { moss: false });
  else boulder(p, [[7.5, 7.5, 6, 5.3], [11.8, 9.6, 2.8, 2.8]], 59, { moss: false });
  // gold veins following the facets, with bright nuggets
  const veins = v === 0 ? [[[3, 7], [6, 6], [9, 8], [12, 7]], [[5, 10], [8, 11]]] : [[[4, 5], [7, 8], [10, 7], [13, 9]], [[6, 11], [9, 10]]];
  veins.forEach((pts) => { for (let i = 0; i < pts.length - 1; i++) p.line(...pts[i], ...pts[i + 1], 'x'); });
  const nug = v === 0 ? [[6, 5], [9, 7], [4, 9]] : [[7, 7], [10, 6], [12, 8], [8, 10]];
  for (const [x, y] of nug) p.set(x, y, 'y').set(x + 1, y, 'y').set(x, y - 1, 'z').set(x + 1, y + 1, 'x');
  dots(p, [[3, 3], [11, 4]], 'v');
  return p.outline();
}

// ── ruins ─────────────────────────────────────────────────────────────────────
function pillar(v) {
  const p = new Px(14, v === 0 ? 26 : 20);
  const H = p.h;
  p.rect(1, H - 5, 12, 2, 'u').rect(1, H - 3, 12, 2, 't'); // plinth (top + front)
  p.rect(12, H - 3, 1, 2, 's');
  const top = v === 0 ? 4 : 6;
  p.rect(3, top + 2, 8, H - 5 - top - 2, 't'); // shaft
  for (const x of [5, 7, 9]) p.rect(x, top + 3, 1, H - 9 - top, 's'); // fluting
  p.rect(3, top + 2, 1, H - 7 - top, 'u').rect(10, top + 2, 1, H - 7 - top, 's');
  if (v === 0) { // capital (intact, chipped corner)
    p.rect(2, top, 10, 2, 'u').rect(2, top + 2, 10, 1, 't').rect(11, top + 2, 1, 1, 's');
    p.set(11, top, '.').set(10, top, 't');
    p.rect(1, top - 2, 12, 2, 'v').set(12, top - 2, '.').set(12, top - 1, 'u');
  } else { // snapped shaft with a jagged break
    const jag = [0, 1, 0, 2, 1, 3, 2, 1];
    for (let x = 0; x < 8; x++) for (let y = 0; y < jag[x]; y++) p.set(3 + x, top + 2 + y, '.');
    for (let x = 0; x < 8; x++) p.set(3 + x, top + 2 + jag[x], 'u');
    p.rect(9, H - 7, 4, 2, 't').rect(9, H - 8, 3, 1, 'u'); // fallen chunk at the foot
  }
  // vines
  const vine = v === 0 ? [[4, 9], [5, 10], [5, 11], [4, 12], [4, 13], [5, 14], [6, 15], [10, 18], [9, 19]] : [[9, 10], [8, 11], [8, 12], [9, 13], [4, 14], [4, 15]];
  vine.forEach(([x, y], i) => p.set(x, y, i % 3 ? 'b' : 'c'));
  p.speckle('t', 's', 0.05, 61 + v).speckle('u', 'v', 0.15, 62 + v);
  dots(p, [[2, H - 6], [11, H - 6]], 'c');
  return p.outline();
}
function ruinWall() {
  const p = new Px(26, 18);
  // jagged top silhouette; ¾: top face strip + front brick face
  const top = [6, 5, 5, 4, 3, 3, 3, 4, 6, 7, 7, 8, 6, 5, 5, 4, 4, 5, 7, 9, 9, 10, 11, 11];
  for (let x = 0; x < 24; x++) { const ty = top[x]; p.rect(x + 1, ty, 1, 2, 'u'); p.rect(x + 1, ty + 2, 1, 15 - ty, 't'); }
  for (let y = 9; y < 17; y += 3) for (let x = 1; x < 25; x++) if (p.get(x, y) === 't') p.set(x, y, 's');
  for (let y = 6, k = 0; y < 17; y += 3, k++) for (let x = 3 + (k % 2) * 3; x < 25; x += 6) for (let j = 0; j < 2; j++) if (p.get(x, y + j + 1) === 't') p.set(x, y + j + 1, 's');
  p.rect(1, 16, 24, 1, 's').rect(24, 11, 1, 6, 's');
  // arched window gap
  p.rect(13, 9, 3, 5, 'n').set(14, 8, 'n').rect(16, 10, 1, 4, 'u');
  p.speckle('t', 'u', 0.04, 71).speckle('u', 'v', 0.2, 72);
  // rubble at the foot + moss + vines
  p.rect(20, 15, 4, 2, 'u').set(22, 14, 'u').rect(21, 16, 3, 1, 't');
  dots(p, [[3, 7], [4, 7], [8, 5], [17, 6], [2, 13], [10, 15], [11, 15]], 'c'); dots(p, [[5, 6], [18, 6]], 'b');
  return p.outline();
}

// ── containers ────────────────────────────────────────────────────────────────
function barrel() {
  const p = new Px(12, 15);
  p.rect(2, 3, 8, 11, 'g').rect(1, 5, 10, 7, 'g'); // bulging body
  for (const x of [3, 6, 8]) p.rect(x, 4, 1, 9, 'f');
  p.rect(1, 5, 1, 7, 'h').rect(2, 4, 1, 9, 'h').rect(10, 5, 1, 7, 'f');
  for (const y of [5, 11]) { p.rect(1, y, 10, 1, 't'); p.set(1, y, 'u').set(10, y, 's'); }
  p.ellipse(5.5, 2.6, 4.2, 1.7, 'h'); // lid
  p.rect(3, 2, 6, 1, 'g').set(4, 3, 'g').set(2, 2, 'i').set(3, 1, 'i');
  p.set(6, 3, 'f');
  return p.outline();
}
function crate() {
  const p = new Px(13, 14);
  p.rect(1, 1, 11, 4, 'h').rect(1, 5, 11, 8, 'g'); // top + front
  p.rect(1, 2, 11, 1, 'g').set(1, 1, 'i').set(2, 1, 'i'); // top plank gap
  p.rect(1, 5, 11, 1, 'f').rect(1, 12, 11, 1, 'f').rect(11, 5, 1, 8, 'f'); // frame shadow
  p.rect(1, 5, 1, 8, 'h').rect(2, 6, 1, 6, 'h');
  thick(p, 3, 6, 9, 11, 'h'); thick(p, 3, 11, 9, 6, 'f'); // X brace (light / dark diagonal)
  p.set(2, 6, 't').set(10, 6, 't').set(2, 11, 't').set(10, 11, 's'); // nail heads
  chamfer(p, 1, 1, 11, 12, 2);
  p.rect(4, 12, 5, 1, '.'); // gap between the two runners
  return p.outline();
}
function cage(broken) {
  const p = new Px(16, 20);
  p.rect(1, 15, 14, 2, 'h').rect(1, 17, 14, 2, 'g').rect(14, 17, 1, 2, 'f'); // plank base
  p.rect(1, 3, 14, 2, 'g').rect(1, 3, 14, 1, 'h').rect(14, 4, 1, 1, 'f'); // top frame
  p.rect(6, 1, 4, 2, 't').set(7, 0, 's').set(8, 0, 's'); // hanging ring
  if (!broken) { // prisoner: a small hunched hero silhouette with eyes
    p.rect(5, 9, 6, 6, 'n').rect(6, 7, 4, 2, 'n').set(7, 9, 'w').set(9, 9, 'w');
    p.rect(5, 13, 6, 2, 'r').set(5, 13, 'R');
  }
  const bars = broken ? [2, 5, 12] : [2, 5, 8, 11, 13];
  for (const x of bars) { p.rect(x, 5, 1, 10, 't'); p.set(x, 5, 'u').set(x, 6, 'u').set(x, 14, 's'); }
  if (broken) { // bent bars + door hanging open + splinters
    p.set(8, 5, 't').set(8, 6, 't').set(9, 7, 't').set(10, 8, 's');
    p.set(11, 14, 't').set(12, 13, 'u').set(13, 12, 's');
    p.rect(14, 6, 1, 8, 's'); p.set(15, 7, 't').set(15, 12, 't');
    p.set(3, 3, 'f').set(10, 3, '.').set(10, 4, 'f');
    dots(p, [[7, 14], [9, 14]], 'g');
  } else p.set(12, 9, 'y'); // padlock
  p.rect(1, 5, 1, 10, 'g').rect(14, 5, 1, 10, 'f'); // corner posts
  p.set(1, 5, 'h');
  chamfer(p, 1, 3, 14, 18, 2); p.rect(4, 18, 8, 1, '.'); // rounded frame + two feet
  return p.outline();
}
function shrine(used) {
  const p = new Px(16, 24);
  p.rect(1, 19, 14, 2, 'u').rect(1, 21, 14, 2, 't').rect(14, 21, 1, 2, 's'); // base step
  p.rect(3, 17, 10, 2, 'v').rect(3, 19, 10, 1, 't');
  p.rect(4, 4, 8, 13, 't'); // obelisk
  p.rect(5, 2, 6, 2, 't').rect(6, 1, 4, 1, 'u');
  p.rect(4, 4, 1, 13, 'u').rect(11, 4, 1, 13, 's').rect(5, 2, 1, 2, 'u').rect(10, 2, 1, 2, 's');
  // rune: a flame/eye sigil carved into the face
  const rune = [[7, 6], [8, 6], [6, 7], [9, 7], [6, 8], [9, 8], [7, 9], [8, 9], [7, 10], [8, 11], [7, 12], [8, 12], [7, 13]];
  rune.forEach(([x, y]) => p.set(x, y, used ? 's' : 'D'));
  if (!used) { p.set(7, 7, 'E').set(8, 8, 'E').set(7, 12, 'E'); p.set(6, 6, 'C').set(9, 6, 'C'); }
  else { p.set(10, 6, 's').set(10, 7, 'n').set(9, 8, 'n'); } // crack
  p.speckle('t', 's', 0.05, 81).speckle('v', 'u', 0.2, 82);
  dots(p, [[2, 18], [13, 18], [12, 16]], 'c');
  p.outline();
  if (!used) dots(p, [[2, 6], [13, 3], [14, 10]], 'D'); // floating motes
  return p;
}
function chest(open) {
  const p = new Px(16, 14);
  const by = 6;
  p.rect(1, by, 14, 7, 'g').rect(1, by, 14, 1, 'h').rect(1, by + 6, 14, 1, 'f').rect(14, by, 1, 7, 'f');
  for (const x of [3, 12]) p.rect(x, by, 1, 7, 'y'); // gold bands
  p.set(3, by + 6, 'x').set(12, by + 6, 'x');
  if (!open) {
    p.rect(1, 2, 14, 4, 'h').rect(2, 1, 12, 1, 'h').rect(1, 5, 14, 1, 'g'); // domed lid
    p.rect(2, 1, 3, 1, 'i').set(1, 2, 'i');
    for (const x of [3, 12]) p.rect(x, 1, 1, 5, 'y');
    p.set(3, 1, 'z');
    p.rect(7, 4, 2, 4, 'y').set(7, 4, 'z').set(8, 6, 'k'); // lock plate + keyhole
  } else {
    p.rect(1, 0, 14, 3, 'f').rect(2, 1, 12, 1, 'g'); // lid tipped back (inside visible)
    for (const x of [3, 12]) p.rect(x, 0, 1, 3, 'x');
    p.rect(1, 3, 14, 3, 'n'); // interior shadow
    p.rect(2, 4, 12, 2, 'y'); // heaped coins
    dots(p, [[4, 3], [5, 3], [8, 3], [9, 2], [10, 3], [6, 4], [11, 4]], 'z'); dots(p, [[7, 5], [12, 5], [3, 5]], 'x');
    p.set(9, 3, 'R'); // a gem
    p.set(7, 6, 'y').set(8, 6, 'y');
  }
  chamfer(p, 1, open ? 0 : 1, 14, 12, 2); p.rect(4, 12, 8, 1, '.'); // rounded corners + feet
  if (open) { p.set(1, 3, '.'); p.set(14, 3, '.'); }
  return new Px(16, 15).stamp(p, 0, 1).outline(); // 1px headroom so the tipped-back lid keeps its outline
}

// ── Gloom POIs ────────────────────────────────────────────────────────────────
function root() {
  const p = new Px(22, 20);
  // three gnarled tendrils emerging from a broken-earth mound
  p.ellipse(11, 16.5, 9, 2.6, 'g'); p.ellipse(11, 16, 7, 1.6, 'f');
  const tendril = (pts, w) => { for (let i = 0; i < pts.length - 1; i++) thick(p, ...pts[i], ...pts[i + 1], 'M', w); };
  tendril([[8, 16], [7, 12], [5, 9], [5, 5], [7, 2]], 2);
  tendril([[12, 16], [13, 11], [16, 8], [17, 5]], 2);
  tendril([[10, 16], [10, 10], [11, 7]], 1);
  tendril([[15, 16], [18, 13], [20, 12]], 1);
  // shade tendrils: left lit, right dark
  for (let y = 0; y < 20; y++) for (let x = 0; x < 22; x++) if (p.get(x, y) === 'M') {
    if (p.get(x - 1, y) === '.' || p.get(x, y - 1) === '.') p.set(x, y, 'L'); else if (p.get(x + 1, y) === '.') p.set(x, y, 'm');
  }
  // thorns + glowing eyes in the bark
  dots(p, [[4, 7], [18, 7], [9, 9], [15, 10]], 'm');
  p.set(6, 11, 'z').set(14, 12, 'z');
  dots(p, [[3, 17], [19, 17], [6, 18]], 'n');
  dots(p, [[4, 16], [17, 15]], 'h');
  return p.outline();
}
function camp() {
  const p = new Px(28, 20);
  // ooze mound
  p.ellipse(14, 13, 12, 5.5, 'M'); p.ellipse(10, 10, 6, 4, 'M'); p.ellipse(18, 10.5, 5.5, 3.5, 'M');
  volume(p, 12, 10, 12, 6, ['m', 'M', 'L'], { hiT: -0.5, loT: 0.35 });
  p.speckle('M', 'm', 0.08, 91);
  // spikes / crystal shards of dark matter
  for (const [x, y, h] of [[6, 7, 4], [12, 5, 5], [20, 7, 4], [24, 10, 3]]) for (let k = 0; k < h; k++) { p.set(x, y - k, k < h - 1 ? 'm' : 'L'); if (k < h - 2) p.set(x + 1, y - k, 'n'); }
  // bones scattered in the ooze
  p.rect(4, 15, 4, 1, 'w').set(4, 14, 'w').set(7, 16, 'u');
  p.rect(19, 15, 3, 1, 'w').set(22, 14, 'w').set(18, 16, 'u');
  // eyes peering from inside (sockets + glow)
  for (const [x, y] of [[9, 11], [16, 10], [13, 14]]) { p.rect(x, y, 2, 2, 'n'); p.set(x, y + 1, 'z'); p.set(x + 1, y + 1, 'z'); }
  dots(p, [[8, 6], [17, 7]], 'L');
  return p.outline();
}
// Rift: 32×32 ground fissure; inner spiral of gloom rotates over 4 frames (rim is the shared base frame).
function riftBase() {
  const p = new Px(32, 32);
  const R = (a) => 1 + 0.14 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 7);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = (x + 0.5 - 16) / 14.5, dy = (y + 0.5 - 16.5) / 11, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy) / R(a);
    if (d < 1) p.set(x, y, d > 0.8 ? (dy < 0 ? 'f' : 'g') : 'm');
  }
  // broken earth chunks on the rim catch light top-left
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if ('fg'.includes(p.get(x, y)) && (p.get(x, y - 1) === '.' || p.get(x - 1, y) === '.')) p.set(x, y, 'h');
  p.speckle('g', 'f', 0.2, 101);
  dots(p, [[6, 9], [7, 9], [25, 8], [26, 9], [4, 18], [27, 21]], 'u');
  dots(p, [[7, 10], [26, 10], [5, 18]], 't');
  return p;
}
function rift(frame) {
  const p = riftBase();
  const ph = frame * (Math.PI / 2) / 2; // quarter-turn per 2 frames → smooth 4-frame loop with 2-fold symmetric arms
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (p.get(x, y) !== 'm') continue;
    const dx = (x + 0.5 - 16) / 1.3, dy = (y + 0.5 - 16.5), r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const arm = Math.sin(2 * (a - ph) + r * 0.55);
    p.set(x, y, r < 2.2 ? 'n' : arm > 0.55 ? (r < 6 ? 'L' : 'M') : arm > -0.1 ? 'M' : 'm');
  }
  p.set(16, 16, 'k').set(15, 16, 'n');
  p.outline();
  // motes drifting up out of the rift
  const m = [[[10, 3], [21, 2]], [[11, 2], [22, 4]], [[9, 1], [20, 3]], [[10, 0], [21, 1]]][frame];
  for (const [x, y] of m) p.set(x, y, 'L');
  return p;
}
function shadow(rx, ry) { // contact shadow: game draws it at alpha 0.35 (SPEC §9.1)
  const w = Math.ceil(rx * 2) + 2, h = Math.ceil(ry * 2) + 2, p = new Px(w, h);
  p.ellipse(w / 2, h / 2, rx, ry, 'n').ellipse(w / 2, h / 2, rx * 0.6, ry * 0.55, 'k');
  return p;
}

export default function build() {
  const out = [];
  const add = (name, px, extra = {}) => out.push({ name, px, kind: 'prop', ...extra });
  add('prop_pine_0', pine(0)); add('prop_pine_1', pine(1));
  add('prop_oak_0', oak(0)); add('prop_oak_1', oak(1));
  add('prop_stump', stump());
  add('prop_bush_0', bush(0)); add('prop_bush_1', bush(1));
  add('prop_rock_s', rock('s')); add('prop_rock_m', rock('m')); add('prop_rock_l', rock('l'));
  add('prop_ore_0', ore(0)); add('prop_ore_1', ore(1));
  add('prop_ruin_pillar_0', pillar(0)); add('prop_ruin_pillar_1', pillar(1)); add('prop_ruin_wall', ruinWall());
  add('prop_barrel', barrel()); add('prop_crate', crate());
  add('prop_cage', cage(false)); add('prop_cage_broken', cage(true));
  add('prop_shrine', shrine(false)); add('prop_shrine_used', shrine(true));
  add('prop_chest_closed', chest(false)); add('prop_chest_open', chest(true));
  add('prop_root', root()); add('prop_camp', camp());
  // shadows are flat 2-tone ellipses (no outline by design) → linted as fx; centred anchor
  for (const [n, rx, ry] of [['s', 4, 1.6], ['m', 6, 2.2], ['l', 10, 3.4]]) { const px = shadow(rx, ry); add(`prop_shadow_${n}`, px, { kind: 'fx', ax: px.w / 2, ay: px.h / 2 }); }
  for (let f = 0; f < 4; f++) add(`prop_rift_${f}`, rift(f), { ax: 16, ay: 16 });
  return out;
}

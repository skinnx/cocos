// Shared helpers for units2.mjs (owner: art-units). Generalises the v1 hero rig from units.mjs
// (base grid typed WITHOUT outline + generated legs + separate weapon/tool layer, fin() outlines last)
// to any canvas size, so villagers (16×16), the traveler and the 4 new heroes (18×18) share one system.
import { Px, RAMPS } from '../pixel.mjs';
import { G, put, fin, rotCW, seat, shiftRows, dots, pad } from './_units_helpers.mjs';

export * from './_units_helpers.mjs';

// Move a rectangular block (x,y,w,h) of px by (dx,dy).
export function moveBlock(px, x, y, w, h, dx, dy) {
  const b = px.crop(x, y, w, h), o = px.clone();
  o.rect(x, y, w, h, '.');
  return o.stamp(b, x + dx, y + dy);
}

// ── Character rig ───────────────────────────────────────────────────────────────
// def = { up: [rows], legs: {type:'pants'|'robe', lx, rx, P, F, x0, x1, hem}, eyes, w: {key: {g, h:[hx,hy], at:[x,y], dx?, dy?}} }
// `up` rows are the head + torso (no legs); legs are generated under it on rows up.length and up.length+1.
export function rig(W, H) {
  const upper = (def) => G(def.up.concat(Array(H - def.up.length).fill('.'.repeat(W))));
  function drawLegs(def, ph) {
    const p = new Px(W, H), L = def.legs, y0 = def.up.length, top = y0 + (ph.bob || 0), foot = y0 + 1;
    const leg = (x, lifted, [c0, c1], [f0, f1]) => {
      const bot = lifted ? foot - 1 : foot;
      for (let y = top; y <= bot; y++) { const ft = y === bot; p.set(x, y, ft ? f0 : c0).set(x + 1, y, ft ? f1 : c1); }
    };
    if (L.type === 'robe') {
      const s = ph.sway || 0;
      for (let y = top; y <= y0; y++) for (let x = L.x0 + s; x <= L.x1 + s; x++) p.set(x, y, x > L.x1 + s - 3 || (y === y0 && x > L.x0 + s + 1) ? L.hem[1] : L.hem[0]);
      if (!ph.ll) p.set(L.lx + (ph.lo || 0), foot, L.F[0]).set(L.lx + 1 + (ph.lo || 0), foot, L.F[1]);
      if (!ph.rl) p.set(L.rx + (ph.ro || 0), foot, L.F[0]).set(L.rx + 1 + (ph.ro || 0), foot, L.F[1]);
    } else {
      leg(L.lx + (ph.lo || 0), ph.ll, L.P, L.F);
      leg(L.rx + (ph.ro || 0), ph.rl, L.P, L.F);
    }
    return p;
  }
  function weapon(dst, def, key, dx = 0, dy = 0) {
    const w = def.w && def.w[key]; if (!w) return dst;
    return put(dst, w.g, w.at[0] - w.h[0] + dx, w.at[1] - w.h[1] + dy, w.selout !== false);
  }
  // Frames are composed on W×H exactly like v1, then padded (2px left/right, 1px top/bottom) BEFORE the outline,
// so weapons may reach the old canvas edge without being clipped and no pixel touches the final canvas edge.
// Entries built from them carry ay = h - 1 so the feet sit on the same ground line as v1 heroes.
// opts: legs (phase), bob, dx/dy (whole body), wkey/bkey (front/back weapon layer), breathe, body (replacement up grid), edit(px) hook
  function frame(def, { legs = {}, bob = 0, dx = 0, dy = 0, wkey = 'idle', bkey = 'back', breathe = false, body = null, edit = null, wdx = 0, wdy = 0 } = {}) {
    const p = new Px(W, H);
    put(p, drawLegs(def, { ...legs, bob }));
    let up = body ? G(body.concat(Array(H - body.length).fill('.'.repeat(W)))) : upper(def);
    if (breathe) up = shiftRows(up, 0, def.up.length - 2, 0, 1);
    if (def.w && def.w[bkey]) weapon(p, def, bkey, dx, dy + bob);
    put(p, up.shift(dx, dy + bob));
    if (edit) edit(p, { dx, dy: dy + bob + (breathe ? 1 : 0) });
    weapon(p, def, wkey, dx + wdx, dy + bob + (breathe ? 1 : 0) + wdy);
    return fin(pad(p, 2, 1, 2, 1));
  }
  function down(def, { wkey = 'idle' } = {}) {
    const body = new Px(W, H);
    put(body, drawLegs(def, {}));
    put(body, upper(def));
    for (const [x, y] of def.eyes) body.set(x, y + 1, body.get(x - 1, y + 1)); // eyes shut
    const lying = seat(rotCW(body), W, H, H - 2, 0);
    const p = new Px(W, H);
    if (def.w && def.w[wkey]) { const wr = rotCW(def.w[wkey].g); put(p, wr, Math.max(1, W - wr.w - 2), H - 2 - wr.h + 1); }
    put(p, lying, 0, 0);
    return fin(pad(p, 2, 1, 2, 1));
  }
  return { W, H, upper, drawLegs, weapon, frame, down };
}

export const WALK = [
  { legs: { lo: -1, ro: 1 }, bob: 0 },
  { legs: { rl: true, sway: 1 }, bob: -1 },
  { legs: { lo: 1, ro: -1 }, bob: 0 },
  { legs: { ll: true, sway: -1 }, bob: -1 },
];

// ── Portrait 24×24 (same construction as v1 portraits: shoulders + backdrop + shaded face + typed overlay) ──
export function portrait(P) {
  const p = new Px(24, 24);
  const sh = new Px(24, 24).ellipse(11.5, 23, 9.6, 4.8, P.cloth[1]); for (let x = 0; x < 24; x++) sh.d[23][x] = '.';
  put(p, sh.shade(P.cloth));
  p.ellipse(11.5, 11.5, 8.2, 7.6, P.back);
  p.rect(10, 16, 4, 4, P.neck || 'p');
  const face = new Px(24, 24).ellipse(12, 12.5, 6.4, 6, P.skin ? P.skin[1] : 'q').shade(P.skin || RAMPS.skin);
  put(p, face);
  const eye = P.eye || 'k';
  dots(p, [[14, 12, eye], [14, 13, P.eye2 || eye], [17, 12, eye], [17, 13, P.eye2 || eye]]);
  if (!P.noBlush) dots(p, [[13, 15, 'o'], [18, 15, 'o']]);
  dots(p, [[16, 16, 'p'], [15, 16, 'p']]);
  if (P.face) dots(p, P.face);
  const ov = G(P.over.concat(Array(24 - P.over.length).fill('.'.repeat(24))));
  put(p, ov);
  if (P.after) dots(p, P.after);
  // keep a clean margin: content in [2,21]², so the outline never touches the 24×24 canvas edge
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (x < 2 || y < 2 || x > 21 || y > 21) p.set(x, y, '.');
  return fin(p);
}

// ── FX helpers (same as fx.mjs) ─────────────────────────────────────────────────
export function ring(p, cx, cy, r, t, c, sy = 1, keep = () => true) {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const d = Math.hypot(x - cx, (y - cy) / sy);
    if (d <= r && d > r - t && keep(x, y)) p.set(x, y, c);
  }
  return p;
}
export function disc(p, cx, cy, r, c, sy = 1) { return ring(p, cx, cy, r, r + 1, c, sy); }

// Draw a filled polygon (pixel-centre test).
export function poly(p, pts, c) {
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      let ins = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) ins = !ins;
      }
      if (ins) p.set(x, y, c);
    }
  return p;
}
// Thick line.
export function thick(p, x0, y0, x1, y1, c, t = 2) {
  for (let i = 0; i < t; i++) for (let j = 0; j < t; j++) p.line(x0 + i, y0 + j, x1 + i, y1 + j, c);
  return p;
}

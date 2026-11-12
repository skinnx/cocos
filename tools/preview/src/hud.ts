// In-run HUD (SPEC §10.2), drawn in art px over the world.
import type { App } from './app';
import { COL } from './font';
import { fillMinimap, fmtNum } from './shared';
import { T } from './world';
import { ENEMIES } from '../../../assets/scripts/core/data/enemies';
import { BALANCE } from '../../../assets/scripts/core/data/balance';

let miniCv: HTMLCanvasElement | null = null, miniT = -1;

export function drawHud(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const ui = app.ui; const f = app.font;
  const { W, H, safe } = app;
  const L = safe.l + 3, Tp = safe.t + 3, R = W - safe.r - 3, B = H - safe.b - 3;
  const hearth = s.buildings.find((b) => b.uid === s.hearthUid);

  // hearth low: red vignette
  if (hearth && hearth.hp / hearth.maxHp < 0.3 && s.phase === 'night') {
    g.globalAlpha = 0.25 + 0.2 * Math.sin(app.time * 6);
    g.fillStyle = COL.red;
    g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3); g.fillRect(0, 0, 3, H); g.fillRect(W - 3, 0, 3, H);
    g.globalAlpha = 1;
  }

  edgeArrows(app);

  // ── top-left: hearth bar + resources ────────────────────────────────────
  A.drawTL(g, 'icon_fire', L, Tp);
  if (hearth) {
    ui.bar(L + 17, Tp + 3, 44, 10, hearth.hp / hearth.maxHp, 'bar_fill_red');
    f.draw(g, fmtNum(hearth.hp), L + 17 + 22, Tp + 14, { align: 'center', color: COL.white });
  }
  const res: Array<['wood' | 'stone' | 'gold', string]> = [['wood', COL.wood], ['stone', COL.stone], ['gold', COL.gold]];
  res.forEach(([k], i) => {
    const y = Tp + 22 + i * 13;
    const pulse = app.fx.hudPulse[k] > 0 ? -1 : 0;
    A.drawTL(g, `icon_${k}`, L, y + pulse);
    f.draw(g, fmtNum(s.res[k]), L + 18, y + 5 + pulse, { color: pulse ? COL.gold : COL.white });
  });

  // ── top-centre: phase clock ─────────────────────────────────────────────
  const cx = Math.round(W / 2), cy = Tp + 20, r = 16;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    A.drawC(g, 'ui_range_dot', cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85, { alpha: 0.9 });
  }
  const frac = s.phaseDur > 0 ? Math.max(0, Math.min(1, s.phaseT / s.phaseDur)) : s.phase === 'night' ? Math.min(1, s.nightT / 90) : 1;
  const ang = Math.PI + frac * Math.PI;
  const isNight = s.phase === 'night' || s.phase === 'dusk';
  A.drawC(g, isNight ? 'icon_moon' : 'icon_sun', cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.85);
  const label = s.phase === 'day' ? `${app.tr('phase.day')} ${s.night}` : s.endless ? app.tr('hud.nightEndless', { n: s.night }) : app.tr('hud.night', { n: s.night });
  f.draw(g, label, cx, cy + 3, { align: 'center', color: isNight ? COL.purple : COL.gold });
  if (s.phase === 'night') {
    const t = app.tr('hud.enemiesLeft', { n: s.enemiesLeft });
    const tw = f.width(t) + 12;
    A.drawTL(g, 'icon_skull', cx - tw / 2 - 3, cy + 10);
    f.draw(g, t, cx - tw / 2 + 13, cy + 14, { color: COL.white });
  } else if (s.phase === 'day') {
    const left = Math.max(0, Math.ceil(s.phaseDur - s.phaseT));
    f.draw(g, `${left}s`, cx, cy + 13, { align: 'center', color: COL.white });
  }

  // ── top-right: pause + minimap ──────────────────────────────────────────
  ui.iconButton('pause', R - 24, Tp, 24, 'icon_pause', () => { app.paused = true; });
  drawMinimap(app, R, Tp + 27);

  // ── boss bar ────────────────────────────────────────────────────────────
  if (s.boss && s.boss.hp > 0) {
    const bw = W - safe.l - safe.r - 24, bx = safe.l + 12, by = Tp + 92;
    f.draw(g, app.tr(`enemy.${s.boss.id}.name`), W / 2, by - 9, { align: 'center', color: COL.purple });
    ui.bar(bx, by, bw, 10, s.boss.hp / s.boss.maxHp, 'bar_fill_red');
  }

  // ── left-middle: squad portraits ────────────────────────────────────────
  const py0 = Math.round(H * 0.3);
  s.heroes.forEach((h, i) => {
    const x = L, y = py0 + i * 34;
    A.nine(g, 'ui_panel_stone', x - 1, y - 1, 26, 26);
    A.drawTL(g, `portrait_${h.id}`, x, y, { alpha: h.anim === 'down' ? 0.45 : 1 });
    // skill cooldown: dark wipe from the top
    if (h.skillCdMax > 0 && h.skillCd > 0) {
      const k = Math.min(1, h.skillCd / h.skillCdMax);
      g.globalAlpha = 0.55; g.fillStyle = COL.ink; g.fillRect(x, y, 24, Math.round(24 * k)); g.globalAlpha = 1;
    }
    if (h.leader) A.drawTL(g, 'icon_pin', x + 14, y - 5);
    f.draw(g, String(h.level), x + 1, y + 16, { color: COL.gold });
    ui.bar(x - 1, y + 25, 26, 8, h.hp / h.maxHp, h.anim === 'down' ? 'bar_fill_blue' : 'bar_fill_green');
    if (h.anim === 'down' && h.reviveT > 0) f.draw(g, `${Math.ceil(h.reviveT)}`, x + 12, y + 8, { align: 'center', color: COL.white });
  });

  // ── bottom-right: build + horn ──────────────────────────────────────────
  if (!app.build.open) {
    const hb = 30;
    const hx = R - hb, hy = B - hb;
    ui.iconButton('horn', hx, hy, hb, 'icon_horn', () => app.cmd({ t: 'horn' }), { disabled: s.hornCharge < BALANCE.horn.charge || s.hornT > 0 });
    const n = 12, lit = Math.floor(Math.min(1, s.hornCharge / BALANCE.horn.charge) * n);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      A.drawC(g, 'ui_range_dot', hx + hb / 2 + Math.cos(a) * (hb / 2 + 3), hy + hb / 2 + Math.sin(a) * (hb / 2 + 3), { alpha: i < lit || s.hornT > 0 ? 1 : 0.25 });
    }
    ui.iconButton('hammer', hx - hb - 8, hy, hb, 'icon_hammer', () => app.build.enter());
    // bottom-centre (day): call night early
    if (s.phase === 'day') {
      const left = Math.max(0, s.phaseDur - s.phaseT);
      const gold = Math.floor(left / 2);
      const lbl = app.tr('hud.callNight');
      const bw = Math.min(hx - hb - 14 - L, app.font.width(lbl) + 30);
      ui.button('callNight', L, B - 24, bw, 24, lbl, () => app.cmd({ t: 'callNight' }), { icon: 'icon_moon' });
      f.draw(g, app.tr('hud.callNightGold', { n: gold }), L + bw / 2, B - 34, { align: 'center', color: COL.gold });
    }
  }

  // ── tutorial line ───────────────────────────────────────────────────────
  if (s.tutorial >= 0 && s.tutorial <= 4 && !app.tutorialHidden && s.phase !== 'dawn') {
    const msg = app.tr(`tutorial.${s.tutorial}`);
    const lines = f.wrap(msg, W - 24 - safe.l - safe.r);
    const ph = lines.length * 9 + 18;
    const py = app.build.open ? Tp + 100 : B - 72 - ph;
    A.nine(g, 'ui_panel_parchment', safe.l + 6, py, W - 12 - safe.l - safe.r, ph);
    f.drawLines(g, lines, W / 2, py + 5, { align: 'center', color: COL.ink, shadow: null });
    ui.add({ x: safe.l + 6, y: py, w: W - 12, h: ph, id: 'tut', block: true });
    ui.button('tutSkip', W - safe.r - 58, py + ph - 3, 50, 14, app.tr('tutorial.skip').split(' ')[0], () => app.cmd({ t: 'skipTutorial' }));
  }

  // ── dusk: omens + start night ───────────────────────────────────────────
  if (s.phase === 'dusk') drawOmens(app);

  // ── banners ─────────────────────────────────────────────────────────────
  for (const bn of app.fx.banners) {
    const k = bn.t / bn.life;
    const alpha = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    const y = Math.round(H * 0.46 - (k < 0.15 ? (1 - k / 0.15) * 10 : 0));
    const big = /^[0-9A-Z !-]+$/.test(bn.text) && bn.text.length <= 14;
    const tw = f.width(bn.text, 5) * (big ? 2 : 1);
    const bw = Math.min(W - 8, tw + 20);
    A.nine(g, 'ui_panel_stone', W / 2 - bw / 2, y - 6, bw, big ? 26 : 19, undefined, alpha);
    if (big) {
      // 2× bitmap text: render glyphs into a temp canvas then integer-upscale (still pixel-exact)
      drawBig(app, bn.text, W / 2, y, bn.color, alpha);
    } else f.draw(g, bn.text, W / 2, y, { align: 'center', color: bn.color, alpha });
  }
  if (app.bossIntro) {
    const k = app.bossIntro.t / 1.8, alpha = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
    g.globalAlpha = 0.6 * alpha; g.fillStyle = COL.ink; g.fillRect(0, H * 0.42 - 20, W, 44); g.globalAlpha = 1;
    drawBig(app, app.bossIntro.name.toUpperCase(), W / 2, H * 0.42 - 10, COL.purple, alpha);
    f.draw(g, app.tr('banner.boss'), W / 2, H * 0.42 + 10, { align: 'center', color: COL.white, alpha });
  }
  app.fx.drawFlyers(g);
  // floating joystick
  if (app.joy) {
    A.draw(g, 'ui_joy_base', app.joy.ox, app.joy.oy, { alpha: 0.85 });
    A.draw(g, 'ui_joy_knob', app.joy.kx, app.joy.ky);
  }
}

const bigCv = document.createElement('canvas');
export function drawBig(app: App, text: string, cx: number, y: number, color: string, alpha = 1) {
  const w = app.font.width(text) + 2, h = 10;
  bigCv.width = w; bigCv.height = h;
  const bg = bigCv.getContext('2d')!; bg.imageSmoothingEnabled = false; bg.clearRect(0, 0, w, h);
  app.font.draw(bg, text, 0, 0, { color });
  const g = app.b; g.imageSmoothingEnabled = false;
  g.globalAlpha = alpha;
  g.drawImage(bigCv, Math.round(cx - w), Math.round(y), w * 2, h * 2);
  g.globalAlpha = 1;
}

function drawMinimap(app: App, right: number, top: number) {
  const s = app.state!; const g = app.b;
  const n = s.map.size;
  if (!miniCv) { miniCv = document.createElement('canvas'); }
  if (miniCv.width !== n) { miniCv.width = n; miniCv.height = n; miniT = -1; }
  if (app.time - miniT > 0.25 || miniT < 0) {
    miniT = app.time;
    const mg = miniCv.getContext('2d')!;
    const img = mg.createImageData(n, n);
    fillMinimap(new Uint8Array(img.data.buffer), {
      size: n, biome: s.map.biome, explored: s.map.explored, light: s.map.light, night: s.phase === 'night',
      buildings: s.buildings, rifts: s.pois.filter((p) => p.kind === 'rift').map((p) => ({ x: p.x, y: p.y, active: p.active })),
      pois: s.pois.filter((p) => p.kind !== 'rift' && p.active), heroes: s.heroes, enemies: s.enemies,
    });
    mg.putImageData(img, 0, 0);
  }
  const k = app.minimapBig ? 2 : 1;
  const sz = n * k;
  const x = right - sz - 2, y = top;
  app.atlas.nine(g, 'ui_minimap_frame', x - 2, y - 2, sz + 4, sz + 4);
  g.drawImage(miniCv, x, y, sz, sz);
  // camera rectangle marker corners
  const c = app.camRect();
  const rx = x + Math.round((c.x / T) * k), ry = y + Math.round((c.y / T) * k);
  const rw = Math.round((c.w / T) * k), rh = Math.round((c.h / T) * k);
  g.fillStyle = COL.white; g.globalAlpha = 0.7;
  for (const [px, py] of [[rx, ry], [rx + rw - 2, ry], [rx, ry + rh - 2], [rx + rw - 2, ry + rh - 2]]) {
    const qx = Math.max(x, Math.min(x + sz - 2, px)), qy = Math.max(y, Math.min(y + sz - 2, py));
    g.fillRect(qx, qy, 2, 1); g.fillRect(qx, qy, 1, 2);
  }
  g.globalAlpha = 1;
  app.ui.add({ x: x - 2, y: y - 2, w: sz + 4, h: sz + 4, id: 'minimap', block: true, onTap: () => { app.minimapBig = !app.minimapBig; } });
}

function edgeArrows(app: App) {
  const s = app.state!; const g = app.b;
  const { W, H, safe } = app;
  const box = { x: safe.l + 12, y: safe.t + 104, w: W - safe.l - safe.r - 24, h: H - safe.t - safe.b - 104 - 52 };
  const targets: Array<{ tx: number; ty: number; icon?: string; pulse: boolean }> = [];
  const hearth = s.buildings.find((b) => b.uid === s.hearthUid);
  if (hearth) targets.push({ tx: hearth.x + 1, ty: hearth.y + 1, icon: 'icon_fire', pulse: false });
  if (s.phase === 'night' || s.phase === 'dusk') for (const p of s.pois) if (p.kind === 'rift' && p.active) targets.push({ tx: p.x + 0.5, ty: p.y + 0.5, icon: 'icon_skull', pulse: true });
  for (const uid of app.world.attacked.keys()) {
    const b = s.buildings.find((q) => q.uid === uid);
    if (b && b.uid !== s.hearthUid) targets.push({ tx: b.x + b.w / 2, ty: b.y + b.h / 2, pulse: true });
  }
  if (hearth && app.world.attacked.has(hearth.uid)) targets[0].pulse = true;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  for (const t of targets) {
    const p = app.tileToScreen(t.tx, t.ty);
    if (p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) continue;
    const dx = p.x - cx, dy = p.y - cy;
    const k = Math.min(Math.abs((box.w / 2) / (dx || 1e-6)), Math.abs((box.h / 2) / (dy || 1e-6)));
    const ax = cx + dx * k, ay = cy + dy * k;
    const ang = Math.atan2(dy, dx);
    const alpha = t.pulse ? 0.6 + 0.4 * Math.sin(app.time * 8) : 1;
    app.atlas.drawC(g, 'ui_arrow_edge', ax, ay, { rot: ang, alpha });
    if (t.icon) app.atlas.drawC(g, t.icon, ax - Math.cos(ang) * 13, ay - Math.sin(ang) * 13, { alpha });
  }
}

function drawOmens(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font; const ui = app.ui;
  const { W, H, safe } = app;
  // aggregate by enemy
  const by = new Map<string, { count: number; elite: number; rifts: Set<number> }>();
  for (const o of s.omens) {
    const e = by.get(o.enemy) ?? { count: 0, elite: 0, rifts: new Set<number>() };
    e.count += o.count; e.elite += o.elite; e.rifts.add(o.rift); by.set(o.enemy, e);
  }
  const rows = [...by.entries()];
  const pw = W - safe.l - safe.r - 16, px = safe.l + 8, py = safe.t + 92;
  const rowH = 22, cols = 2;
  const ph = app.omensOpen ? 30 + Math.ceil(rows.length / cols) * rowH + 4 : 18;
  A.nine(g, 'ui_panel_parchment', px, py, pw, ph);
  ui.add({ x: px, y: py, w: pw, h: ph, id: 'omens', block: true, onTap: () => { app.omensOpen = !app.omensOpen; } });
  f.draw(g, `${app.tr('omen.title')} - ${app.tr('hud.night', { n: s.night })}`, px + pw / 2, py + 5, { align: 'center', color: COL.ink, shadow: null });
  if (!app.omensOpen) return;
  f.draw(g, app.tr('omen.subtitle'), px + pw / 2, py + 16, { align: 'center', color: COL.brown, shadow: null });
  rows.forEach(([id, e], i) => {
    const cx = px + 8 + (i % cols) * Math.floor((pw - 16) / cols), cy = py + 30 + Math.floor(i / cols) * rowH;
    const spr = id === 'mossback' ? 'boss_mossback_walk_0' : id === 'unlit' ? 'boss_unlit_float_0' : `enemy_${id}_move_0`;
    const fr = A.frames[spr];
    if (fr && fr.h > 22) {
      // bosses: show a cropped head-and-shoulders window
      A.drawPart(g, spr, Math.max(0, Math.round(fr.w / 2 - 10)), Math.max(0, fr.h - 22), 20, 20, cx - 2, cy - 2);
    } else A.draw(g, spr, cx + 10, cy + 19);
    f.draw(g, `x${e.count}`, cx + 24, cy + 2, { color: COL.ink, shadow: null });
    const tag = ENEMIES[id as keyof typeof ENEMIES] && (id === 'mossback' || id === 'unlit') ? app.tr('omen.boss') : e.elite ? `${app.tr('omen.elite')} ${e.elite}` : [...e.rifts].map((r) => `R${r + 1}`).join(' ');
    f.draw(g, tag, cx + 24, cy + 11, { color: e.elite || id === 'mossback' || id === 'unlit' ? COL.wine : COL.plum, shadow: null });
  });
  // start night
  const lbl = app.tr('hud.startNight');
  const bw = f.width(lbl) + 32;
  ui.button('startNight', W / 2 - bw / 2, py + ph + 4, bw, 24, lbl, () => { app.build.exit(); app.cmd({ t: 'startNight' }); }, { icon: 'icon_moon' });
  void H;
}

// In-world HUD for the persistent Hold (SPEC §10.2 / §10.5), drawn in art px over the world:
//   top-left  Hearth bar + warmth coals + blessings + wood/stone/gold/iron (tap → Storage) + next-goal strip
//   top-mid   sun/moon arc clock, DAY/NIGHT n, moon phase, threat x/cap (night: enemies left + beacon colour)
//   top-right pause + minimap (tap → world map)
//   left      squad portraits          bottom (PEACE) 5-tab bar (unlock-gated) + dusk bell; night: hammer + horn
//   DUSK      omens + moon/event + 4 beacon buttons + garrison row + start night
//   expedition: big timer, carried loot, chests, arrow to the boat, extract bar
import type { App } from './app';
import type { Beacon, HeroId, ResKey } from './core';
import { COL } from './font';
import { fillMinimap, fmtNum, fmtCountdown } from './shared';
import { T } from './world';
import { bossPortrait, resIcon } from './sprites2';

let miniCv: HTMLCanvasElement | null = null, miniT = -1, miniKey: unknown = null;
const HORN_CHARGE = 40;
const BEACONS: Beacon[] = ['calm', 'steady', 'fierce', 'nightmare'];
const HUD_RES: ResKey[] = ['wood', 'stone', 'gold', 'iron'];

/** Layout constants shared with fly-to-HUD targets. */
function topLeft(app: App) {
  const s = app.state!;
  const L = app.safe.l + 3, Tp = app.safe.t + 3;
  const blessY = Tp + 22;
  const resY = blessY + (s.blessings.length ? 20 : 0);
  return { L, Tp, blessY, resY };
}
export function hudResTarget(app: App, res: string): [number, number] {
  if (!app.state) return [app.W / 2, 10];
  const { L, resY } = topLeft(app);
  const i = HUD_RES.indexOf(res as ResKey);
  return i >= 0 ? [L + 8, resY + i * 12 + 6] : [L + 8, resY + 4 * 12];
}

export function drawHud(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const ui = app.ui; const f = app.font;
  const { W, H, safe } = app;
  const R = W - safe.r - 3, B = H - safe.b - 3;
  const hearth = s.buildings.find((b) => b.uid === s.hearthUid);

  if (s.expedition) { expeditionHud(app); return; }

  if (hearth && hearth.hp / hearth.maxHp < 0.3 && s.phase === 'night') {
    g.globalAlpha = 0.25 + 0.2 * Math.sin(app.time * 6);
    g.fillStyle = COL.red;
    g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3); g.fillRect(0, 0, 3, H); g.fillRect(W - 3, 0, 3, H);
    g.globalAlpha = 1;
  }
  edgeArrows(app);

  // ── top-left: Hearth bar, warmth coals, blessings, resources ────────────
  const { L, Tp, blessY, resY } = topLeft(app);
  A.drawTL(g, 'icon_fire', L, Tp);
  if (hearth) {
    ui.bar(L + 17, Tp + 1, 46, 9, hearth.hp / hearth.maxHp, 'bar_fill_red');
    f.draw(g, fmtNum(hearth.hp), L + 17 + 23, Tp + 2, { align: 'center', color: COL.white });
  }
  // 7 warmth coals (SPEC §11.10) under the bar
  const coal = A.frames['icon_warmth'];
  const cw = coal ? Math.min(7, coal.w - 2) : 6;
  for (let i = 0; i < 7; i++) {
    const on = i < s.warmth;
    const cx = L + 17 + i * cw + 3, cy = Tp + 16;
    if (coal && coal.w <= 9) A.drawC(g, on ? 'icon_warmth' : 'icon_warmth_off', cx, cy);
    else A.drawPart(g, on ? 'icon_warmth' : 'icon_warmth_off', 4, 4, 8, 8, cx - 4, cy - 4);
  }
  // blessings with nights left
  s.blessings.forEach((bl, i) => {
    const x = L + i * 18, y = blessY;
    A.drawTL(g, `boon_${bl.id}`, x, y);
    f.draw(g, String(bl.nightsLeft), x + 12, y + 10, { color: COL.gold });
  });
  // resources (tap → storage)
  HUD_RES.forEach((k, i) => {
    const y = resY + i * 12;
    const pulse = app.fx.hudPulse[k] > 0 ? -1 : 0;
    A.drawTL(g, resIcon(k), L, y - 3 + pulse);
    const full = s.res[k] >= s.storageCap && k !== 'gold';
    f.draw(g, fmtNum(s.res[k]), L + 17, y + 2 + pulse, { color: pulse ? COL.gold : full ? COL.red : COL.white });
  });
  ui.add({ x: L, y: resY - 3, w: 52, h: 4 * 12 + 2, id: 'storage', block: true, onTap: () => app.openPanel('storage') });
  if (app.storageFullT > 0 && Math.floor(app.time * 4) % 2 === 0) f.draw(g, app.tr('hud.storageFull'), L + 54, resY + 2, { color: COL.red });
  // next-goal strip (SPEC §2.5 / §10.5) under the resource cluster; tap expands to 3 lines
  if (s.phase === 'peace') goalStrip(app, L, resY + 4 * 12 + 3);

  // ── top-centre: phase clock ─────────────────────────────────────────────
  const cx = Math.round(W / 2) + 4, cy = Tp + 18, r = 15;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    A.drawC(g, 'ui_range_dot', cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85, { alpha: 0.9 });
  }
  const frac = s.phase === 'peace' && s.phaseDur > 0 ? Math.max(0, Math.min(1, s.phaseT / s.phaseDur)) : s.phase === 'night' ? Math.min(1, s.nightT / 90) : s.phase === 'dawn' ? 0 : 1;
  const ang = Math.PI + frac * Math.PI;
  const isNight = s.phase === 'night' || s.phase === 'dusk';
  A.drawC(g, isNight ? 'icon_moon' : 'icon_sun', cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.85);
  const lbl = app.tr(s.phase === 'peace' ? 'hud.day' : s.phase === 'dusk' ? 'hud.dusk' : s.phase === 'dawn' ? 'hud.dawn' : 'hud.night', { n: s.night });
  f.draw(g, lbl, cx, cy + 2, { align: 'center', color: isNight ? (s.moon === 'blood' ? COL.red : COL.purple) : COL.gold });
  // moon phase icon + threat
  const thr = s.trCap > 0 && s.trCap < 999 ? app.tr('hud.threat', { x: s.tr, cap: s.trCap }) : app.tr('hud.threatNoCap', { x: s.tr });
  const tw = f.width(thr) + 18;
  A.drawTL(g, `moon_${s.moon}`, cx - tw / 2 - 1, cy + 9);
  f.draw(g, thr, cx - tw / 2 + 17, cy + 13, { color: s.tr >= s.trCap ? COL.fire : COL.white });
  if (s.phase === 'night') {
    const t = app.tr('hud.enemiesLeft', { n: s.enemiesLeft });
    const ew = f.width(t) + 34;
    A.drawTL(g, `beacon_${s.beacon}`, cx - ew / 2 - 2, cy + 22);
    A.drawTL(g, 'icon_skull', cx - ew / 2 + 14, cy + 22);
    f.draw(g, t, cx - ew / 2 + 31, cy + 27, { color: COL.white });
  } else if (s.phase === 'peace') {
    const left = Math.max(0, Math.ceil(s.phaseDur - s.phaseT));
    f.draw(g, fmtCountdown(left) + (s.buildMode ? ' II' : ''), cx, cy + 25, { align: 'center', color: COL.white });
    if (s.tr >= s.trCap && s.trCap < 999) f.draw(g, app.tr('hud.atCap'), cx, cy + 35, { align: 'center', color: COL.fire });
  }

  // ── top-right: pause + minimap ──────────────────────────────────────────
  ui.iconButton('pause', R - 22, Tp, 22, 'icon_pause', () => app.openPanel('pause'));
  drawMinimap(app, R, Tp + 25);

  // ── boss bar ────────────────────────────────────────────────────────────
  if (s.boss && s.boss.hp > 0) {
    const bw = W - safe.l - safe.r - 24, bx = safe.l + 12, by = Tp + 110;
    f.draw(g, app.tr(`enemy.${s.boss.id}.name`), W / 2, by - 9, { align: 'center', color: COL.purple });
    ui.bar(bx, by, bw, 10, s.boss.hp / s.boss.maxHp, 'bar_fill_red');
  }

  // ── left-middle: squad portraits ────────────────────────────────────────
  if (s.phase !== 'dusk') {
    const py0 = Math.round(H * 0.4);
    s.heroes.forEach((h, i) => {
      const x = L, y = py0 + i * 32;
      A.nine(g, 'ui_panel_stone', x - 1, y - 1, 26, 26);
      A.drawTL(g, `portrait_${h.id}`, x, y, { alpha: h.anim === 'down' ? 0.45 : 1 });
      if (h.skillCdMax > 0 && h.skillCd > 0) {
        const k = Math.min(1, h.skillCd / h.skillCdMax);
        g.globalAlpha = 0.55; g.fillStyle = COL.ink; g.fillRect(x, y, 24, Math.round(24 * k)); g.globalAlpha = 1;
      }
      if (h.leader) A.drawTL(g, 'icon_pin', x + 14, y - 5);
      f.draw(g, String(s.roster[h.id]?.level ?? 1), x + 1, y + 16, { color: COL.gold });
      ui.bar(x - 1, y + 24, 26, 6, h.hp / h.maxHp, h.anim === 'down' ? 'bar_fill_blue' : 'bar_fill_green');
      if (h.anim === 'down' && h.reviveT > 0) f.draw(g, `${Math.ceil(h.reviveT)}`, x + 12, y + 8, { align: 'center', color: COL.white });
    });
  }

  // ── bottom: PEACE bar or night buttons ──────────────────────────────────
  if (!app.build.open) {
    if (s.phase === 'peace') bottomBar(app);
    else if (s.phase === 'night') {
      const hb = 30, hx = R - hb, hy = B - hb;
      ui.iconButton('horn', hx, hy, hb, 'icon_horn', () => app.cmd({ t: 'horn' }), { disabled: s.hornCharge < HORN_CHARGE || s.hornT > 0 });
      const n = 12, lit = Math.floor(Math.min(1, s.hornCharge / HORN_CHARGE) * n);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        A.drawC(g, 'ui_range_dot', hx + hb / 2 + Math.cos(a) * (hb / 2 + 3), hy + hb / 2 + Math.sin(a) * (hb / 2 + 3), { alpha: i < lit || s.hornT > 0 ? 1 : 0.25 });
      }
      ui.iconButton('hammer', hx - hb - 8, hy, hb, 'icon_hammer', () => app.build.enter());
    }
  }

  // ── tutorial line ───────────────────────────────────────────────────────
  if (s.tutorial >= 0 && s.tutorial <= 4 && !app.tutorialHidden && s.phase !== 'dawn' && !app.panel) {
    const msg = app.tr(`tutorial.${s.tutorial}`);
    const lines = f.wrap(msg, W - 24 - safe.l - safe.r);
    const ph = lines.length * 9 + 18;
    const py = app.build.open ? Tp + 104 : B - 72 - ph;
    A.nine(g, 'ui_panel_parchment', safe.l + 6, py, W - 12 - safe.l - safe.r, ph);
    f.drawLines(g, lines, W / 2, py + 5, { align: 'center', color: COL.ink, shadow: null });
    ui.add({ x: safe.l + 6, y: py, w: W - 12, h: ph, id: 'tut', block: true });
    ui.button('tutSkip', W - safe.r - 58, py + ph - 3, 50, 14, app.tr('tutorial.skip').split(' ')[0], () => app.cmd({ t: 'skipTutorial' }));
  }

  if (s.phase === 'dusk') drawDusk(app);
  if (app.garrisonPick && s.phase !== 'dusk') {
    f.draw(g, app.tr('dusk.garrisonHint'), W / 2, B - 60, { align: 'center', color: COL.gold });
  }

  drawBanners(app);
  app.fx.drawFlyers(g);
  if (app.joy) {
    A.draw(g, 'ui_joy_base', app.joy.ox, app.joy.oy, { alpha: 0.85 });
    A.draw(g, 'ui_joy_knob', app.joy.kx, app.joy.ky);
  }
}

// ── bottom bar (SPEC §10.5): 5 buttons, each hidden until its system is unlocked (§2.7) ──
export function barTabs(app: App): Array<{ id: string; icon: string; label: string; on: () => void }> {
  const s = app.state!;
  const owned = Object.values(s.roster).filter((r) => r.owned).length;
  const tabs = [{ id: 'barBuild', icon: 'icon_hammer', label: app.tr('bar.build'), on: () => app.build.enter() }];
  if (owned >= 2 || app.unlocked('garrison') || app.unlocked('dispatch')) tabs.push({ id: 'barHero', icon: 'icon_hero', label: app.tr('bar.hero'), on: () => app.openPanel('hero') });
  if (s.villagers.length > 0 || s.buildings.some((b) => b.id === 'house')) tabs.push({ id: 'barVillage', icon: 'icon_village', label: app.tr('bar.village'), on: () => app.openPanel('village') });
  if (app.unlocked('bounties') || app.unlocked('chronicle')) tabs.push({ id: 'barBook', icon: 'icon_book', label: app.tr('bar.book'), on: () => app.openPanel('book') });
  if (app.unlocked('dock') || s.regionsOpen >= 2) tabs.push({ id: 'barMap', icon: 'icon_map', label: app.tr('bar.map'), on: () => app.openPanel('map') });
  return tabs;
}

function bottomBar(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const ui = app.ui; const f = app.font;
  const { W, H, safe } = app;
  const tabs = barTabs(app);
  const bh = 30, by = H - safe.b - bh;
  if (A.frames['ui_bottombar']) A.nine(g, 'ui_bottombar', 0, by - 3, W, bh + 3 + safe.b);
  else A.nine(g, 'ui_panel_stone', 0, by - 3, W, bh + 3 + safe.b);
  const n = 5, bw = Math.floor((W - safe.l - safe.r - 4) / n);
  // centred: unlocked tabs only (hidden, not greyed)
  const x0 = Math.round(W / 2 - (tabs.length * bw) / 2);
  tabs.forEach((t, i) => {
    const x = x0 + i * bw;
    const down = ui.pressed === t.id;
    A.nine(g, down ? 'ui_tab_on' : 'ui_tab_off', x + 1, by, bw - 2, bh - 2);
    A.drawTL(g, t.icon, x + Math.round((bw - 2) / 2 - 7), by + 2 + (down ? 1 : 0));
    const lw = f.width(t.label);
    if (lw <= bw - 3) f.draw(g, t.label, x + bw / 2, by + 19, { align: 'center', color: COL.white });
    ui.add({ x, y: by, w: bw, h: bh, id: t.id, block: true, onTap: t.on });
  });
  // dusk bell (left) and horn (right) above the bar
  const left = Math.max(0, s.phaseDur - s.phaseT);
  const lbl = app.tr('hud.bell');
  const bellW = f.width(lbl) + 26;
  ui.button('bell', safe.l + 4, by - 30, bellW, 24, lbl, () => { app.audio.sfx('bell'); app.cmd({ t: 'ringBell' }); }, { icon: 'icon_moon' });
  if (left >= 60) f.draw(g, app.tr('hud.bellBonus'), safe.l + 4 + bellW / 2, by - 39, { align: 'center', color: COL.gold });
  const hb = 24;
  ui.iconButton('horn', W - safe.r - 4 - hb, by - 30, hb, 'icon_horn', () => app.cmd({ t: 'horn' }), { disabled: s.hornCharge < HORN_CHARGE || s.hornT > 0 });
}

function goalStrip(app: App, x: number, y: number) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font;
  const w = app.W - app.safe.r - 56 - x;
  const rows: Array<[string, string]> = app.goalsOpen
    ? [['hud.goal.session', s.nextGoals.session], ['hud.goal.day', s.nextGoals.day], ['hud.goal.week', s.nextGoals.week]]
    : [['hud.goal.session', s.nextGoals.session]];
  const lines = rows.map(([k, v]) => ({ k, text: goalText(app, v) })).filter((r) => r.text);
  if (!lines.length) return;
  const h = 4 + lines.length * 10 + 2;
  if (A.frames['ui_goal_strip']) A.nine(g, 'ui_goal_strip', x - 1, y, w, h); else A.nine(g, 'ui_panel_stone', x - 1, y, w, h);
  lines.forEach((l, i) => {
    if (i === 0) A.drawC(g, 'icon_goal', x + 7, y + 7);
    const t = f.wrap(l.text, w - 22)[0];
    f.draw(g, t, x + 16, y + 4 + i * 10, { color: i === 0 ? COL.gold : COL.white });
  });
  app.ui.add({ x: x - 1, y, w, h, id: 'goals', block: true, onTap: () => { app.goalsOpen = !app.goalsOpen; } });
}
/** nextGoals entries are i18n keys with optional params ("key|a=1|b=x" or "key?a=1&b=x"); plain text passes through. */
export function goalText(app: App, v: string | undefined): string {
  if (!v) return '';
  const m = /^([^|?]+)[|?](.*)$/.exec(v);
  if (!m) return app.tr(v);
  const params: Record<string, string> = {};
  for (const kv of m[2].split(/[|&]/)) { const [k, val] = kv.split('='); if (k) params[k] = val !== undefined && app.tr(val) !== val ? app.tr(val) : (val ?? ''); }
  return app.tr(m[1], params);
}

// ── DUSK: omens, moon + event, beacon stakes, garrison, start night (SPEC §8.7, §10.5) ──
function drawDusk(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font; const ui = app.ui;
  const { W, safe } = app;
  const pw = W - safe.l - safe.r - 8, px = safe.l + 4, py = safe.t + 74;
  const by = new Map<string, { count: number; elite: number; rifts: Set<number> }>();
  for (const o of s.omens) {
    const e = by.get(o.enemy) ?? { count: 0, elite: 0, rifts: new Set<number>() };
    e.count += o.count; e.elite += o.elite; e.rifts.add(o.rift); by.set(o.enemy, e);
  }
  const rows = [...by.entries()];
  const garrisonOn = app.unlocked('garrison') && s.garrisonSlots > 0;
  const rowH = 20, cols = 3;
  const omenH = Math.ceil(rows.length / cols) * rowH;
  const ph = app.omensOpen ? 14 + 22 + omenH + 4 + 40 + (garrisonOn ? 32 : 0) + 4 : 14;
  A.nine(g, 'ui_panel_parchment', px, py, pw, ph);
  ui.add({ x: px, y: py, w: pw, h: 12, id: 'omens', block: true, onTap: () => { app.omensOpen = !app.omensOpen; } });
  ui.block(px, py, pw, ph, 'omensBody');
  f.draw(g, s.siege ? app.tr('dusk.siege') : app.tr('dusk.omens', { n: s.night }), px + pw / 2, py + 4, { align: 'center', color: s.moon === 'blood' ? COL.wine : COL.ink, shadow: null });
  let y = py + 14;
  if (app.omensOpen) {
    // moon + event line
    A.drawTL(g, `moon_${s.moon}`, px + 4, y);
    f.draw(g, app.tr(`moon.${s.moon}`), px + 22, y + 1, { color: s.moon === 'blood' ? COL.wine : COL.plum, shadow: null });
    f.draw(g, f.wrap(app.tr(`moon.${s.moon}.rule`), pw / 2 - 26)[0], px + 22, y + 10, { color: COL.brown, shadow: null });
    if (s.nightEvent !== 'none') {
      A.drawTL(g, `event_${s.nightEvent}`, px + pw / 2 + 2, y);
      f.draw(g, app.tr(`event.${s.nightEvent}`), px + pw / 2 + 20, y + 5, { color: COL.wine, shadow: null });
    }
    y += 22;
    rows.forEach(([id, e], i) => {
      const cw = Math.floor((pw - 8) / cols);
      const cx = px + 4 + (i % cols) * cw, cy = y + Math.floor(i / cols) * rowH;
      const spr = bossPortrait(id);
      const fr = A.frames[spr];
      if (fr && fr.h > 22) A.drawPart(g, spr, Math.max(0, Math.round(fr.w / 2 - 9)), Math.max(0, fr.h - 20), 18, 18, cx, cy);
      else A.draw(g, spr, cx + 9, cy + 18);
      f.draw(g, `x${e.count}`, cx + 20, cy + 2, { color: COL.ink, shadow: null });
      const tag = e.elite ? `+${e.elite}*` : [...e.rifts].map((r) => `R${r + 1}`).join(' ');
      f.draw(g, tag, cx + 20, cy + 10, { color: e.elite ? COL.wine : COL.plum, shadow: null });
    });
    y += omenH + 4;
    // beacon stakes (hidden while recovering from a loss → forced calm, or during a siege)
    const bw = Math.floor((pw - 8) / 4);
    BEACONS.forEach((b, i) => {
      const x = px + 4 + i * bw;
      const unlocked = b === 'calm' || b === 'steady' || app.unlocked(`beacon_${b}`);
      const forced = s.forcedCalm > 0 && b !== 'calm';
      const sel = s.beacon === b;
      const dis = !unlocked || forced || s.siege;
      A.nine(g, sel ? 'ui_card_rare' : 'ui_card_common', x, y, bw - 2, 38);
      A.drawTL(g, `beacon_${b}`, x + Math.round((bw - 2) / 2 - 8), y + 2, { alpha: dis ? 0.4 : 1 });
      if (!unlocked) A.drawC(g, 'icon_lock', x + (bw - 2) / 2 + 6, y + 13);
      f.draw(g, app.tr(`beacon.${b}`), x + (bw - 2) / 2, y + 19, { align: 'center', color: sel ? COL.gold : dis ? COL.dim : COL.white });
      const sub = !unlocked ? app.tr(`beacon.locked.${b}`) : app.tr(`beacon.${b}.reward`).split(',')[0];
      f.draw(g, f.wrap(sub, bw - 4)[0], x + (bw - 2) / 2, y + 28, { align: 'center', color: COL.grey });
      ui.add({ x, y, w: bw - 2, h: 38, id: `beacon_${b}`, block: true, onTap: dis ? undefined : () => app.cmd({ t: 'setBeacon', beacon: b }) });
    });
    y += 40;
    if (s.forcedCalm > 0) f.draw(g, app.tr('dusk.forcedCalm', { n: s.forcedCalm }), px + pw / 2, y - 2, { align: 'center', color: COL.wine, shadow: null });
    // garrison row: garrisoned heroes + free owned heroes (tap one, then a tower)
    if (garrisonOn) {
      f.draw(g, `${app.tr('dusk.garrison')} ${s.buildings.filter((b) => b.garrison).length}/${s.garrisonSlots}`, px + 6, y + 2, { color: COL.ink, shadow: null });
      const cands = Object.values(s.roster).filter((r) => r.owned && r.status !== 'dispatch');
      cands.slice(0, 7).forEach((r, i) => {
        const x = px + 70 + i * 17, yy = y;
        const sel = app.garrisonPick === r.id;
        A.nine(g, sel ? 'ui_card_legendary' : r.status === 'garrison' ? 'ui_card_rare' : 'ui_card_common', x - 1, yy - 1, 17, 26);
        A.drawPart(g, `portrait_${r.id}`, 4, 2, 15, 16, x, yy + 1);
        if (r.status === 'garrison') A.drawC(g, 'icon_garrison', x + 8, yy + 20);
        ui.add({ x: x - 1, y: yy - 1, w: 17, h: 26, id: `garrison_${r.id}`, block: true, onTap: () => {
          if (r.status === 'garrison') app.cmd({ t: 'garrison', hero: r.id as HeroId, uid: 0 });
          else app.garrisonPick = sel ? null : r.id;
        } });
      });
      if (app.garrisonPick) f.draw(g, app.tr('dusk.garrisonHint'), px + pw / 2, y + 28, { align: 'center', color: COL.wine, shadow: null });
      y += 32;
    }
  }
  const lbl = app.tr('dusk.startNight');
  const bw = f.width(lbl) + 32;
  ui.button('startNight', W / 2 - bw / 2, py + ph + 3, bw, 24, lbl, () => { app.build.exit(); app.garrisonPick = null; app.cmd({ t: 'startNight' }); }, { icon: 'icon_moon' });
}

// ── expedition HUD (SPEC §10.5): big timer top-centre, carried loot left, arrow back to the boat ──
function expeditionHud(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const ui = app.ui; const f = app.font;
  const ex = s.expedition!;
  const { W, H, safe } = app;
  const L = safe.l + 3, Tp = safe.t + 3, R = W - safe.r - 3, B = H - safe.b - 3;
  // timer
  const left = Math.max(0, ex.timeLeft);
  const urgent = left <= 30;
  const tw = 56;
  if (A.frames['ui_timer_frame']) A.nine(g, 'ui_timer_frame', W / 2 - tw / 2, Tp, tw, 24); else A.nine(g, 'ui_panel_stone', W / 2 - tw / 2, Tp, tw, 24);
  A.drawTL(g, 'icon_clock', W / 2 - tw / 2 + 3, Tp + 4);
  const blink = urgent && Math.floor(app.time * 4) % 2 === 0;
  drawBig(app, fmtCountdown(left), W / 2 + 18, Tp + 4, urgent ? (blink ? COL.white : COL.red) : COL.white);
  f.draw(g, app.tr('exp.chests', { a: ex.chestsOpened, b: ex.chestsTotal }), W / 2, Tp + 28, { align: 'center', color: COL.gold });
  // carried (left)
  f.draw(g, app.tr('exp.carried'), L, Tp + 2, { color: COL.fire });
  let y = Tp + 12;
  for (const [k, v] of Object.entries(ex.carried)) {
    if (k === 'shards' || k === 'gear' || !v) continue;
    A.drawTL(g, resIcon(k), L, y - 3);
    f.draw(g, fmtNum(v as number), L + 17, y + 2, { color: COL.white });
    y += 12;
  }
  const shards = ex.carried.shards ? Object.values(ex.carried.shards).reduce((a, b) => a + (b ?? 0), 0) : 0;
  if (shards) { A.drawTL(g, 'icon_shard', L, y - 3); f.draw(g, String(shards), L + 17, y + 2); y += 12; }
  if (ex.carried.gear) { A.drawTL(g, 'icon_gear_weapon', L, y - 3); f.draw(g, String(ex.carried.gear), L + 17, y + 2); y += 12; }
  // trip boons
  ex.boons.forEach((bl, i) => A.drawTL(g, `boon_${bl.id}`, R - 18 - i * 17, Tp + 30));
  ui.iconButton('pause', R - 22, Tp, 22, 'icon_pause', () => app.openPanel('pause'));
  // squad
  s.heroes.forEach((h, i) => {
    const x = L, yy = Math.round(H * 0.42) + i * 30;
    A.nine(g, 'ui_panel_stone', x - 1, yy - 1, 26, 26);
    A.drawTL(g, `portrait_${h.id}`, x, yy, { alpha: h.anim === 'down' ? 0.45 : 1 });
    ui.bar(x - 1, yy + 24, 26, 5, h.hp / h.maxHp, h.anim === 'down' ? 'bar_fill_blue' : 'bar_fill_green');
  });
  // arrow to the boat (always, SPEC §11.6)
  const p = app.tileToScreen(ex.boatX, ex.boatY);
  const box = { x: safe.l + 14, y: safe.t + 50, w: W - safe.l - safe.r - 28, h: H - safe.t - safe.b - 100 };
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const inside = p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
  if (!inside) {
    const dx = p.x - cx, dy = p.y - cy;
    const k = Math.min(Math.abs((box.w / 2) / (dx || 1e-6)), Math.abs((box.h / 2) / (dy || 1e-6)));
    const ax = cx + dx * k, ay = cy + dy * k, ang = Math.atan2(dy, dx);
    A.drawC(g, 'ui_arrow_edge', ax, ay, { rot: ang, alpha: urgent ? 0.6 + 0.4 * Math.sin(app.time * 10) : 1 });
    A.drawC(g, 'icon_extract', ax - Math.cos(ang) * 14, ay - Math.sin(ang) * 14);
  } else A.drawC(g, 'icon_extract', p.x, p.y - 34 + Math.round(Math.sin(app.time * 4) * 2));
  // extract progress (stand 3 s at the boat)
  if (ex.extractT > 0 && !ex.result) {
    f.draw(g, app.tr('exp.extract'), W / 2, B - 44, { align: 'center', color: COL.gold });
    ui.bar(W / 2 - 40, B - 34, 80, 9, Math.min(1, ex.extractT / 3), 'bar_fill_gold');
  }
  if (urgent && !ex.result) { g.globalAlpha = 0.15 + 0.15 * Math.sin(app.time * 8); g.fillStyle = COL.red; g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3); g.globalAlpha = 1; }
  drawBanners(app);
  app.fx.drawFlyers(g);
  if (app.joy) { A.draw(g, 'ui_joy_base', app.joy.ox, app.joy.oy, { alpha: 0.85 }); A.draw(g, 'ui_joy_knob', app.joy.kx, app.joy.ky); }
}

function drawBanners(app: App) {
  const g = app.b; const A = app.atlas; const f = app.font; const { W, H } = app;
  for (const bn of app.fx.banners) {
    const k = bn.t / bn.life;
    const alpha = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    const y = Math.round(H * 0.46 - (k < 0.15 ? (1 - k / 0.15) * 10 : 0));
    const big = /^[0-9A-Z !-]+$/.test(bn.text) && bn.text.length <= 14;
    const tw = f.width(bn.text, 5) * (big ? 2 : 1);
    const bw = Math.min(W - 8, tw + 20);
    A.nine(g, 'ui_panel_stone', W / 2 - bw / 2, y - 6, bw, big ? 26 : 19, undefined, alpha);
    if (big) drawBig(app, bn.text, W / 2, y, bn.color, alpha);
    else f.draw(g, bn.text, W / 2, y, { align: 'center', color: bn.color, alpha });
  }
  if (app.bossIntro) {
    const k = app.bossIntro.t / 1.8, alpha = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
    g.globalAlpha = 0.6 * alpha; g.fillStyle = COL.ink; g.fillRect(0, H * 0.42 - 20, W, 44); g.globalAlpha = 1;
    drawBig(app, app.bossIntro.name.toUpperCase(), W / 2, H * 0.42 - 10, COL.purple, alpha);
    f.draw(g, app.tr('banner.boss'), W / 2, H * 0.42 + 10, { align: 'center', color: COL.white, alpha });
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
  if (!miniCv) miniCv = document.createElement('canvas');
  if (miniCv.width !== n || miniKey !== s.map.biome) { miniCv.width = n; miniCv.height = n; miniT = -1; miniKey = s.map.biome; }
  if (app.time - miniT > 0.25 || miniT < 0) {
    miniT = app.time;
    paintMinimap(app, miniCv);
  }
  // 96-tile island → 48 px (≈112 design px at 720 wide, SPEC §10.2)
  const sz = Math.min(48, n);
  const x = right - sz - 2, y = top;
  app.atlas.nine(g, 'ui_minimap_frame', x - 2, y - 2, sz + 4, sz + 4);
  g.imageSmoothingEnabled = false;
  g.drawImage(miniCv, x, y, sz, sz);
  const k = sz / n;
  const c = app.camRect();
  const rx = x + Math.round((c.x / T) * k), ry = y + Math.round((c.y / T) * k);
  const rw = Math.round((c.w / T) * k), rh = Math.round((c.h / T) * k);
  g.fillStyle = COL.white; g.globalAlpha = 0.7;
  for (const [px, py] of [[rx, ry], [rx + rw - 2, ry], [rx, ry + rh - 2], [rx + rw - 2, ry + rh - 2]]) {
    const qx = Math.max(x, Math.min(x + sz - 2, px)), qy = Math.max(y, Math.min(y + sz - 2, py));
    g.fillRect(qx, qy, 2, 1); g.fillRect(qx, qy, 1, 2);
  }
  g.globalAlpha = 1;
  app.ui.add({ x: x - 2, y: y - 2, w: sz + 4, h: sz + 4, id: 'minimap', block: true, onTap: () => { if (!s.expedition) app.openPanel('map'); } });
}

/** Minimap pixels via the client's pure painter, plus the Gloom Veil tint (v2). */
export function paintMinimap(app: App, cv: HTMLCanvasElement) {
  const s = app.state!; const n = s.map.size;
  const mg = cv.getContext('2d')!;
  const img = mg.createImageData(n, n);
  const px = new Uint8Array(img.data.buffer);
  fillMinimap(px, {
    size: n, biome: s.map.biome, explored: s.map.explored, light: s.map.light, night: s.phase === 'night',
    buildings: s.buildings.filter((b) => !b.ruined), rifts: s.pois.filter((p) => p.kind === 'rift').map((p) => ({ x: p.x, y: p.y, active: p.active })),
    pois: s.pois.filter((p) => p.kind !== 'rift' && p.active), heroes: s.heroes, enemies: s.enemies,
  } as never);
  const veil = s.map.veil;
  if (veil && !s.expedition) for (let i = 0; i < n * n; i++) if (veil[i]) { px[i * 4] = 0x4b; px[i * 4 + 1] = 0x2a; px[i * 4 + 2] = 0x6b; px[i * 4 + 3] = 255; }
  mg.putImageData(img, 0, 0);
}

function edgeArrows(app: App) {
  const s = app.state!; const g = app.b;
  const { W, H, safe } = app;
  const box = { x: safe.l + 12, y: safe.t + 104, w: W - safe.l - safe.r - 24, h: H - safe.t - safe.b - 104 - 70 };
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

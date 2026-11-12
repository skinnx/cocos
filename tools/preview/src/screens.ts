// Full-screen and modal screens (SPEC §10.1): Title, Barracks, Settings, Pause, Dawn/chest boon picker, Tavern,
// Victory / Defeat.
import type { App } from './app';
import type { Boon, HeroId } from './core';
import { COL } from './font';
import { drawBig } from './hud';
import { HEROES, HERO_IDS } from '../../../assets/scripts/core/data/heroes';
import { TALENTS } from '../../../assets/scripts/core/data/talents';
import { BUILDINGS } from '../../../assets/scripts/core/data/buildings';
import { buildingIcon } from './info';

export function drawScreens(app: App) {
  const s = app.state;
  if (app.screen === 'loading') { app.font.draw(app.b, 'Loading...', app.W / 2, app.H / 2, { align: 'center' }); return; }
  if (app.screen === 'title') return title(app);
  if (app.screen === 'barracks') return barracks(app);
  if (app.screen === 'settings') return settings(app);
  if (!s) return;
  if (s.phase === 'victory' || s.phase === 'defeat') return endScreen(app);
  if (s.boonOffer && s.boonOffer.length) return boonPicker(app);
  if (s.tavernOffer && s.tavernOffer.length && (s.phase === 'day' || s.phase === 'dawn') && !app.build.open) tavern(app);
  if (app.paused) pause(app);
}

function dim(app: App, a = 0.6) { const g = app.b; g.globalAlpha = a; g.fillStyle = COL.ink; g.fillRect(0, 0, app.W, app.H); g.globalAlpha = 1; }
function blockAll(app: App) { app.ui.block(0, 0, app.W, app.H, 'modal'); }

function title(app: App) {
  const { W, H, safe } = app; const A = app.atlas; const ui = app.ui; const f = app.font;
  dim(app, 0.35);
  blockAll(app);
  const logo = A.frames['logo'];
  const ly = safe.t + Math.round(H * 0.12);
  if (logo) A.drawTL(app.b, 'logo', Math.round(W / 2 - logo.w / 2), ly); else A.get('logo');
  const bw = 120, bh = 26, x = Math.round(W / 2 - bw / 2);
  let y = Math.round(H * 0.5);
  ui.button('play', x, y, bw, bh, app.tr('ui.play'), () => { app.clearRun(); app.newRun(); }, { icon: 'icon_play' }); y += bh + 6;
  const saved = app.savedRun();
  ui.button('continue', x, y, bw, bh, app.tr('ui.continue'), () => app.newRun(undefined, saved!), { disabled: !saved, icon: 'icon_fire' }); y += bh + 6;
  ui.button('barracks', x, y, bw, bh, app.tr('ui.barracks'), () => { app.screen = 'barracks'; }, { icon: 'icon_shield' }); y += bh + 6;
  ui.button('settings', x, y, bw, bh, app.tr('ui.settings'), () => { app.settingsFrom = 'title'; app.screen = 'settings'; }, { icon: 'icon_settings' });
  A.drawTL(app.b, 'icon_ember', W / 2 - 22, H - safe.b - 26);
  f.draw(app.b, String(app.meta.ember), W / 2 - 4, H - safe.b - 21, { color: COL.fire });
  f.draw(app.b, 'web preview', W / 2, H - safe.b - 10, { align: 'center', color: COL.dim });
}

function header(app: App, text: string, y: number) {
  const f = app.font, g = app.b;
  f.draw(g, text, app.W / 2, y, { align: 'center', color: COL.gold });
}

function barracks(app: App) {
  const { W, H, safe } = app; const A = app.atlas; const ui = app.ui; const f = app.font; const g = app.b; const m = app.meta;
  dim(app, 0.5); blockAll(app);
  const px = safe.l + 4, pw = W - safe.l - safe.r - 8, py = safe.t + 4, ph = H - safe.t - safe.b - 8;
  A.nine(g, 'ui_panel_stone', px, py, pw, ph);
  drawBig(app, app.tr('ui.barracks').toUpperCase(), W / 2, py + 6, COL.gold);
  A.drawTL(g, 'icon_ember', px + pw - 46, py + 4);
  f.draw(g, String(m.ember), px + pw - 28, py + 9, { color: COL.fire });
  // heroes
  let y = py + 30;
  header(app, app.tr('ui.heroes'), y); y += 11;
  const cw = Math.floor((pw - 8) / 3), ch = 46;
  HERO_IDS.forEach((id, i) => {
    const cx = px + 4 + (i % 3) * cw, cy = y + Math.floor(i / 3) * (ch + 2);
    const unlocked = m.unlockedHeroes.includes(id), starter = m.starterHero === id;
    const cost = HEROES[id].unlockEmber;
    A.nine(g, starter ? 'ui_card_legendary' : unlocked ? 'ui_card_rare' : 'ui_card_common', cx, cy, cw - 2, ch);
    A.drawTL(g, `portrait_${id}`, cx + Math.round((cw - 2) / 2 - 12), cy + 3, { alpha: unlocked ? 1 : 0.4 });
    if (!unlocked) A.drawC(g, 'icon_lock', cx + (cw - 2) / 2 + 10, cy + 22);
    f.draw(g, app.tr(`hero.${id}.name`), cx + (cw - 2) / 2, cy + 28, { align: 'center', color: starter ? COL.gold : COL.white });
    f.draw(g, starter ? app.tr('ui.starter').split(' ')[0] : unlocked ? app.tr('ui.unlocked') : String(cost), cx + (cw - 2) / 2, cy + 37, { align: 'center', color: unlocked ? COL.green : m.ember >= cost ? COL.fire : COL.red });
    ui.add({ x: cx, y: cy, w: cw - 2, h: ch, id: `hero_${id}`, block: true, onTap: () => {
      if (unlocked) m.starterHero = id as HeroId;
      else if (m.ember >= cost) { m.ember -= cost; m.unlockedHeroes.push(id as HeroId); app.audio.sfx('levelup'); }
      else { app.audio.sfx('fail'); return; }
      app.saveMeta();
    } });
  });
  y += 2 * (ch + 2) + 4;
  // talents
  header(app, app.tr('ui.talents'), y); y += 11;
  const rowH = 15;
  for (const t of TALENTS) {
    const lv = m.talents[t.id] ?? 0;
    const cost = lv < t.maxLevel ? t.costs[lv] : 0;
    f.draw(g, app.tr(`talent.${t.id}.name`), px + 6, y + 4, { color: COL.white });
    for (let i = 0; i < t.maxLevel; i++) A.drawC(g, 'ui_range_dot', px + pw - 70 + i * 6, y + 7, { alpha: i < lv ? 1 : 0.3 });
    if (lv < t.maxLevel) ui.button(`tal_${t.id}`, px + pw - 48, y, 42, 14, String(cost), () => {
      if (m.ember < cost) { app.audio.sfx('fail'); return; }
      m.ember -= cost; m.talents[t.id] = lv + 1; app.saveMeta(); app.audio.sfx('upgrade');
    }, { disabled: m.ember < cost, color: COL.fire });
    else f.draw(g, app.tr('ui.max'), px + pw - 27, y + 4, { align: 'center', color: COL.green });
    y += rowH;
  }
  y += 3;
  // blueprints (SHOULD buildings)
  header(app, app.tr('ui.blueprints'), y); y += 11;
  const bps = (Object.keys(BUILDINGS) as Array<keyof typeof BUILDINGS>).filter((id) => BUILDINGS[id].should);
  const bw = Math.floor((pw - 8) / bps.length);
  bps.forEach((id, i) => {
    const cx = px + 4 + i * bw, unlocked = m.unlockedBlueprints.includes(id), cost = BUILDINGS[id].blueprintCost;
    A.nine(g, unlocked ? 'ui_card_rare' : 'ui_card_common', cx, y, bw - 2, 58);
    g.save(); g.beginPath(); g.rect(cx + 2, y + 2, bw - 6, 36); g.clip();
    A.draw(g, buildingIcon(id), cx + (bw - 2) / 2, y + 40, { alpha: unlocked ? 1 : 0.45 });
    g.restore();
    f.draw(g, unlocked ? app.tr('ui.unlocked').slice(0, 7) : String(cost), cx + (bw - 2) / 2, y + 46, { align: 'center', color: unlocked ? COL.green : m.ember >= cost ? COL.fire : COL.red });
    ui.add({ x: cx, y, w: bw - 2, h: 58, id: `bp_${id}`, block: true, onTap: () => {
      if (unlocked || m.ember < cost) { app.audio.sfx('fail'); return; }
      m.ember -= cost; m.unlockedBlueprints.push(id); app.saveMeta(); app.audio.sfx('upgrade');
    } });
  });
  ui.button('back', W / 2 - 40, py + ph - 30, 80, 24, app.tr('ui.back'), () => { app.screen = 'title'; });
}

function settings(app: App) {
  const { W, H, safe } = app; const A = app.atlas; const ui = app.ui; const f = app.font; const g = app.b; const st = app.meta.settings;
  dim(app, 0.55); blockAll(app);
  const pw = Math.min(W - 16, 180), px = Math.round(W / 2 - pw / 2), ph = 200, py = Math.round(H / 2 - ph / 2);
  A.nine(g, 'ui_panel_parchment', px, py, pw, ph);
  f.draw(g, app.tr('ui.settings'), W / 2, py + 7, { align: 'center', color: COL.ink, shadow: null });
  let y = py + 24;
  const row = (label: string, value: string, minus: (() => void) | null, plus: () => void, id: string) => {
    f.draw(g, label, px + 8, y + 6, { color: COL.ink, shadow: null });
    if (minus) ui.button(`${id}-`, px + pw - 74, y, 20, 18, '-', minus);
    f.draw(g, value, px + pw - 42, y + 6, { align: 'center', color: '#5a3a2e', shadow: null });
    ui.button(`${id}+`, px + pw - 28, y, 20, 18, minus ? '+' : '*', plus);
    y += 22;
  };
  const vol = (k: 'music' | 'sfx', d: number) => { st[k] = Math.max(0, Math.min(1, Math.round((st[k] + d) * 10) / 10)); app.audio.setVolumes(st.music, st.sfx); app.saveMeta(); };
  row(app.tr('ui.music'), `${Math.round(st.music * 10)}`, () => vol('music', -0.1), () => vol('music', 0.1), 'music');
  row(app.tr('ui.sfx'), `${Math.round(st.sfx * 10)}`, () => vol('sfx', -0.1), () => vol('sfx', 0.1), 'sfx');
  row(app.tr('ui.haptics'), st.haptics ? app.tr('ui.on') : app.tr('ui.off'), null, () => { st.haptics = !st.haptics; app.saveMeta(); }, 'hap');
  row(app.tr('ui.bigText'), st.bigText ? app.tr('ui.on') : app.tr('ui.off'), null, () => { st.bigText = !st.bigText; app.saveMeta(); }, 'big');
  row(app.tr('ui.language'), st.lang.toUpperCase(), null, () => { st.lang = st.lang === 'en' ? 'vi' : 'en'; app.saveMeta(); }, 'lang');
  ui.button('reset', px + 8, y + 2, pw - 16, 20, app.tr('ui.resetData'), () => {
    if (window.confirm(app.tr('ui.resetConfirm'))) { try { localStorage.clear(); } catch { /* ignore */ } app.meta = app.readMeta(); }
  }, { color: COL.red });
  ui.button('settingsBack', W / 2 - 40, py + ph - 30, 80, 24, app.tr('ui.back'), () => { app.screen = app.settingsFrom; });
  void safe;
}

function pause(app: App) {
  const { W, H } = app; const ui = app.ui; const g = app.b;
  dim(app, 0.55); blockAll(app);
  const pw = 140, ph = 120, px = Math.round(W / 2 - pw / 2), py = Math.round(H / 2 - ph / 2);
  app.atlas.nine(g, 'ui_panel_stone', px, py, pw, ph);
  app.font.draw(g, app.tr('ui.pause'), W / 2, py + 8, { align: 'center', color: COL.gold });
  ui.button('resume', px + 10, py + 24, pw - 20, 24, app.tr('ui.resume'), () => { app.paused = false; }, { icon: 'icon_play' });
  ui.button('pauseSettings', px + 10, py + 52, pw - 20, 24, app.tr('ui.settings'), () => { app.settingsFrom = 'game'; app.screen = 'settings'; }, { icon: 'icon_settings' });
  ui.button('quit', px + 10, py + 80, pw - 20, 24, app.tr('ui.quit'), () => { app.saveRun(); app.toTitle(); });
}

const RARITY_COL: Record<Boon['rarity'], string> = { common: COL.white, rare: COL.ice, legendary: COL.gold };

function boonPicker(app: App) {
  const s = app.state!; const { W, H, safe } = app; const A = app.atlas; const ui = app.ui; const f = app.font; const g = app.b;
  dim(app, 0.6); blockAll(app);
  const offer = s.boonOffer!;
  const dawn = s.boonSource !== 'chest';
  const pw = W - safe.l - safe.r - 12, px = safe.l + 6;
  const cardH = 54;
  const headH = dawn ? 74 : 34;
  const ph = headH + offer.length * (cardH + 4) + 8;
  const py = Math.max(safe.t + 6, Math.round(H / 2 - ph / 2));
  A.nine(g, 'ui_panel_stone', px, py, pw, ph);
  drawBig(app, (dawn ? app.tr('dawn.title') : app.tr('chest.title')).toUpperCase(), W / 2, py + 6, COL.gold);
  let y = py + 28;
  if (dawn) {
    f.draw(g, app.tr('dawn.summary', { n: s.stats.nightsSurvived }), W / 2, y, { align: 'center', color: COL.white }); y += 11;
    A.drawTL(g, 'icon_skull', px + 14, y - 4); f.draw(g, `${app.tr('dawn.kills')}: ${s.stats.kills}`, px + 32, y + 1, { color: COL.white });
    A.drawTL(g, 'icon_gold', px + pw / 2 + 6, y - 4); f.draw(g, `${s.stats.goldEarned}`, px + pw / 2 + 24, y + 1, { color: COL.gold }); y += 16;
    f.draw(g, app.tr('dawn.choose'), W / 2, y, { align: 'center', color: COL.fire }); y += 12;
  } else { f.draw(g, app.tr('chest.choose'), W / 2, y - 2, { align: 'center', color: COL.fire }); y += 8; }
  offer.forEach((b, i) => {
    const cy = y + i * (cardH + 4);
    A.nine(g, `ui_card_${b.rarity}`, px + 4, cy, pw - 8, cardH);
    A.drawTL(g, `boon_${b.id}`, px + 10, cy + 6);
    f.draw(g, b.name, px + 32, cy + 6, { color: RARITY_COL[b.rarity] });
    f.draw(g, `${app.tr(`boon.group.${b.group}`)} - ${app.tr(`boon.rarity.${b.rarity}`)}`, px + 32, cy + 15, { color: COL.grey });
    if (b.maxStacks > 1) f.draw(g, app.tr('boon.stacks', { n: b.stacks, m: b.maxStacks }), px + pw - 12, cy + 6, { align: 'right', color: COL.grey });
    const lines = f.wrap(b.desc, pw - 22).slice(0, 3);
    f.drawLines(g, lines, px + 10, cy + 26, { color: COL.white });
    ui.add({ x: px + 4, y: cy, w: pw - 8, h: cardH, id: `boon_${i}`, block: true, onTap: () => { app.audio.sfx('boon_pick'); app.cmd({ t: 'pickBoon', index: i }); } });
  });
}

function tavern(app: App) {
  const s = app.state!; const { W, H, safe } = app; const ui = app.ui; const f = app.font; const g = app.b; const A = app.atlas;
  const offer = s.tavernOffer!;
  const pw = 150, ph = 22 + offer.length * 28, px = Math.round(W / 2 - pw / 2), py = H - safe.b - 80 - ph;
  A.nine(g, 'ui_panel_parchment', px, py, pw, ph);
  f.draw(g, app.tr('tavern.title'), W / 2, py + 6, { align: 'center', color: COL.ink, shadow: null });
  offer.forEach((o, i) => {
    const y = py + 18 + i * 28;
    A.drawTL(g, `portrait_${o.hero}`, px + 6, y);
    ui.button(`hire_${i}`, px + 34, y + 2, pw - 40, 20, app.tr('tavern.hire', { n: o.cost }), () => app.cmd({ t: 'hire', index: i }), { disabled: s.res.gold < o.cost });
  });
}

function endScreen(app: App) {
  const s = app.state!; const { W, H, safe } = app; const A = app.atlas; const ui = app.ui; const f = app.font; const g = app.b;
  dim(app, 0.7); blockAll(app);
  const win = s.phase === 'victory';
  const pw = W - safe.l - safe.r - 16, px = safe.l + 8, ph = 210, py = Math.round(H / 2 - ph / 2);
  A.nine(g, win ? 'ui_panel_parchment' : 'ui_panel_stone', px, py, pw, ph);
  drawBig(app, app.tr(win ? 'phase.victory' : 'phase.defeat').toUpperCase(), W / 2, py + 8, win ? COL.gold : COL.red);
  f.draw(g, app.tr(win ? 'end.victory' : 'end.defeat'), W / 2, py + 32, { align: 'center', color: win ? COL.ink : COL.white, shadow: win ? null : undefined });
  const rows: Array<[string, string, string | number]> = [
    ['icon_moon', 'end.nights', s.stats.nightsSurvived], ['icon_skull', 'end.bosses', s.stats.bosses], ['icon_shield', 'end.camps', s.stats.camps],
    ['icon_sword', 'end.kills', s.stats.kills], ['icon_hammer', 'end.built', s.stats.built], ['icon_ember', 'end.ember', `+${app.game!.emberEarned()}`],
  ];
  rows.forEach(([icon, key, v], i) => {
    const y = py + 46 + i * 17;
    A.drawTL(g, icon, px + 12, y);
    const c = win ? COL.ink : COL.white;
    f.draw(g, app.tr(key), px + 32, y + 5, { color: c, shadow: win ? null : undefined });
    f.draw(g, String(v), px + pw - 12, y + 5, { align: 'right', color: key === 'end.ember' ? COL.fire : c, shadow: win ? null : undefined });
  });
  const by = py + ph - 32;
  if (win) {
    ui.button('endless', px + 8, by - 28, pw - 16, 24, app.tr('end.endless'), () => app.cmd({ t: 'endless' }), { icon: 'icon_moon' });
  }
  ui.button('toTitle', px + 8, by, pw - 16, 24, app.tr('end.title'), () => app.toTitle(), { icon: 'icon_play' });
}

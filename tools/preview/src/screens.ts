// Full-screen and modal screens of the persistent Hold (SPEC §10.5): Title ("Enter the Hold"), Settings, Pause,
// "While you were away", new-system cards, Dawn gifts, "The fire gutters", expedition result. The in-game panels
// (hero, village, book, map, dock, building…) live in panels.ts.
import type { App } from './app';
import type { Cost, DawnGift, ResKey } from './core';
import { COL } from './font';
import { drawBig } from './hud';
import { drawPanel } from './panels';
import { fmtNum, costParts } from './shared';
import { resIcon } from './sprites2';
import { fmtDuration } from './strings';
import { BOON_BY_ID } from '../../../assets/scripts/core/data/boons';

export function drawScreens(app: App) {
  const s = app.state;
  if (app.screen === 'loading') { app.font.draw(app.b, 'Loading...', app.W / 2, app.H / 2, { align: 'center' }); return; }
  if (app.screen === 'title') return title(app);
  if (app.screen === 'settings') return settings(app);
  if (!s) return;
  // priority: away → expedition result → gutter → gifts → unlock card → panel
  if (app.away && !app.awayCollected) return awaySummary(app);
  if (s.expedition && s.expedition.result) return expeditionResult(app);
  if (s.lossReport && app.gutterSeen !== s.lossReport) return fireGutters(app);
  if (s.gifts && s.gifts.length) return gifts(app);
  if (app.unlockCards.length) return unlockCard(app);
  if (app.panel === 'pause') return pause(app);
  if (app.panel) drawPanel(app);
}

export function dim(app: App, a = 0.6) { const g = app.b; g.globalAlpha = a; g.fillStyle = COL.ink; g.fillRect(0, 0, app.W, app.H); g.globalAlpha = 1; }
export function blockAll(app: App) { app.ui.block(0, 0, app.W, app.H, 'modal'); }

/** Row of cost/resources as icon + number pairs; returns the width. */
export function costRow(app: App, c: Cost | Partial<Record<string, number>>, x: number, y: number, o: { color?: string; ink?: boolean; plus?: boolean } = {}) {
  const g = app.b, A = app.atlas, f = app.font;
  let cx = x;
  for (const [k, v] of Object.entries(c)) {
    if (!v || typeof v !== 'number') continue;
    A.drawTL(g, resIcon(k), cx, y - 4);
    const t = (o.plus ? '+' : '') + fmtNum(v);
    f.draw(g, t, cx + 16, y + 1, { color: o.color ?? (o.ink ? COL.ink : COL.white), shadow: o.ink ? null : undefined });
    cx += 18 + f.width(t) + 4;
  }
  return cx - x;
}

function title(app: App) {
  const { W, H, safe } = app; const A = app.atlas; const ui = app.ui; const f = app.font;
  dim(app, 0.35);
  blockAll(app);
  const logo = A.frames['logo'];
  const ly = safe.t + Math.round(H * 0.12);
  if (logo) A.drawTL(app.b, 'logo', Math.round(W / 2 - logo.w / 2), ly); else A.get('logo');
  const sum = app.holdSummary();
  const bw = 140, bh = 28, x = Math.round(W / 2 - bw / 2);
  let y = Math.round(H * 0.52);
  ui.button('enterHold', x, y, bw, bh, app.tr(sum ? 'title.enter' : 'title.first'), () => app.enterHold(), { icon: 'icon_fire' });
  if (sum) f.draw(app.b, app.tr('title.status', { n: sum.night, tr: sum.tr, tier: sum.tier }), W / 2, y + bh + 5, { align: 'center', color: COL.gold });
  y += bh + 20;
  ui.button('settings', x + 20, y, bw - 40, 24, app.tr('ui.settings'), () => { app.settingsFrom = 'title'; app.screen = 'settings'; }, { icon: 'icon_settings' });
  f.draw(app.b, app.tr('title.preview'), W / 2, H - safe.b - 10, { align: 'center', color: COL.dim });
}

let eraseStep = 0;
function settings(app: App) {
  const { W, H } = app; const A = app.atlas; const ui = app.ui; const f = app.font; const g = app.b; const st = app.settings;
  dim(app, 0.55); blockAll(app);
  const pw = Math.min(W - 16, 180), px = Math.round(W / 2 - pw / 2), ph = 226, py = Math.round(H / 2 - ph / 2);
  A.nine(g, 'ui_panel_parchment', px, py, pw, ph);
  f.draw(g, app.tr('ui.settings'), W / 2, py + 7, { align: 'center', color: COL.ink, shadow: null });
  let y = py + 24;
  const row = (label: string, value: string, minus: (() => void) | null, plus: () => void, id: string) => {
    f.draw(g, label, px + 8, y + 6, { color: COL.ink, shadow: null });
    if (minus) ui.button(`${id}-`, px + pw - 74, y, 20, 18, '-', minus);
    f.draw(g, value, px + pw - 42, y + 6, { align: 'center', color: COL.brown, shadow: null });
    ui.button(`${id}+`, px + pw - 28, y, 20, 18, minus ? '+' : '*', plus);
    y += 22;
  };
  const vol = (k: 'music' | 'sfx', d: number) => { st[k] = Math.max(0, Math.min(1, Math.round((st[k] + d) * 10) / 10)); app.saveSettingsNow(); };
  row(app.tr('ui.music'), `${Math.round(st.music * 10)}`, () => vol('music', -0.1), () => vol('music', 0.1), 'music');
  row(app.tr('ui.sfx'), `${Math.round(st.sfx * 10)}`, () => vol('sfx', -0.1), () => vol('sfx', 0.1), 'sfx');
  row(app.tr('ui.haptics'), st.haptics ? app.tr('ui.on') : app.tr('ui.off'), null, () => { st.haptics = !st.haptics; app.saveSettingsNow(); }, 'hap');
  row(app.tr('ui.bigText'), st.bigText ? app.tr('ui.on') : app.tr('ui.off'), null, () => { st.bigText = !st.bigText; app.saveSettingsNow(); }, 'big');
  row(app.tr('ui.language'), st.lang.toUpperCase(), null, () => { st.lang = st.lang === 'en' ? 'vi' : 'en'; app.saveSettingsNow(); }, 'lang');
  // export / import the Hold save as a string (SPEC §13.7)
  ui.button('export', px + 8, y + 2, (pw - 20) / 2, 20, app.tr('ui.export'), () => {
    const raw = app.game ? app.game.save() : app.savedHold();
    if (raw) { try { navigator.clipboard?.writeText(raw); } catch { /* ignore */ } window.prompt(app.tr('ui.export'), raw); }
  });
  ui.button('import', px + 12 + (pw - 20) / 2, y + 2, (pw - 20) / 2, 20, app.tr('ui.import'), () => {
    const raw = window.prompt(app.tr('ui.import'));
    if (raw) { try { JSON.parse(raw); localStorage.setItem('emberhold.hold.v2', raw); app.toTitle(); } catch { app.fx.banner('Invalid save', undefined, COL.red); } }
  });
  y += 26;
  // erase: asks twice (SPEC §10.1)
  ui.button('reset', px + 8, y, pw - 16, 20, eraseStep === 0 ? app.tr('ui.resetData') : eraseStep === 1 ? app.tr('ui.resetConfirm') : app.tr('ui.resetConfirm2'), () => {
    eraseStep++;
    if (eraseStep >= 3) { eraseStep = 0; app.clearHold(); app.game = null; app.backdrop = null; app.screen = 'title'; app.boot(); }
  }, { color: COL.red });
  ui.button('settingsBack', W / 2 - 40, py + ph - 30, 80, 24, app.tr('ui.back'), () => { eraseStep = 0; app.screen = app.settingsFrom; });
}

function pause(app: App) {
  const { W, H } = app; const ui = app.ui; const g = app.b;
  dim(app, 0.55); blockAll(app);
  const s = app.state!;
  const exp = !!s.expedition;
  const pw = 150, ph = exp ? 148 : 120, px = Math.round(W / 2 - pw / 2), py = Math.round(H / 2 - ph / 2);
  app.atlas.nine(g, 'ui_panel_stone', px, py, pw, ph);
  app.font.draw(g, app.tr('ui.pause'), W / 2, py + 8, { align: 'center', color: COL.gold });
  ui.button('resume', px + 10, py + 24, pw - 20, 24, app.tr('ui.resume'), () => { app.panel = null; }, { icon: 'icon_play' });
  ui.button('pauseSettings', px + 10, py + 52, pw - 20, 24, app.tr('ui.settings'), () => { app.panel = null; app.settingsFrom = 'game'; app.screen = 'settings'; }, { icon: 'icon_settings' });
  ui.button('quit', px + 10, py + 80, pw - 20, 24, app.tr('ui.quit'), () => app.toTitle());
  if (exp) ui.button('abandon', px + 10, py + 108, pw - 20, 24, app.tr('exp.abandon'), () => { app.panel = null; app.cmd({ t: 'abandonExpedition' }); }, { color: COL.red });
}

// ── "While you were away" (SPEC §2.3 / §10.5) ───────────────────────────────
function awaySummary(app: App) {
  const a = app.away!; const { W, H, safe } = app; const A = app.atlas; const ui = app.ui; const f = app.font; const g = app.b;
  dim(app, 0.65); blockAll(app);
  const pw = W - safe.l - safe.r - 12, px = safe.l + 6;
  const rows: Array<{ icon: string; text: string; res?: Cost | Partial<Record<string, number>> }> = [];
  if (costParts(a.produced).length) rows.push({ icon: 'icon_village', text: app.tr('away.villagers'), res: a.produced });
  for (const d of a.dispatches) {
    const shards = Object.values(d.shards ?? {}).reduce((x, y) => x + (y ?? 0), 0);
    rows.push({ icon: `portrait_${d.hero}`, text: app.tr('away.dispatch', { hero: app.tr(`hero.${d.hero}.name`), kind: app.tr(`dispatch.${d.kind}`) }), res: { ...d.loot, ...(shards ? { shards } : {}) } });
  }
  if (a.newBounties) rows.push({ icon: 'icon_bounty', text: app.tr('away.bounties', { n: a.newBounties }) });
  if (a.traveler) rows.push({ icon: 'icon_market', text: app.tr('away.traveler') });
  if (a.warmthDelta) rows.push({ icon: 'icon_warmth', text: app.tr('away.warmth', { d: (a.warmthDelta > 0 ? '+' : '') + a.warmthDelta }) });
  const rowH = 30;
  const ph = 52 + Math.max(1, rows.length) * rowH + 40;
  const py = Math.max(safe.t + 8, Math.round(H / 2 - ph / 2));
  A.nine(g, 'ui_panel_parchment', px, py, pw, ph);
  if (A.frames['ui_away_header']) A.nine(g, 'ui_away_header', px + 4, py + 4, pw - 8, 22);
  A.drawTL(g, 'icon_away', px + 8, py + 7);
  f.draw(g, app.tr('away.title'), px + pw / 2 + 6, py + 9, { align: 'center', color: A.frames['ui_away_header'] ? COL.white : COL.ink, shadow: A.frames['ui_away_header'] ? undefined : null });
  f.draw(g, app.tr('away.time', { t: fmtDuration(a.seconds) }), px + pw / 2, py + 32, { align: 'center', color: COL.brown, shadow: null });
  let y = py + 46;
  if (!rows.length) { f.draw(g, app.tr('away.nothing'), px + pw / 2, y + 8, { align: 'center', color: COL.ink, shadow: null }); y += rowH; }
  rows.forEach((r, i) => {
    const yy = y + i * rowH;
    A.nine(g, 'ui_card_common', px + 4, yy, pw - 8, rowH - 2);
    if (r.icon.startsWith('portrait_')) A.drawPart(g, r.icon, 4, 2, 16, 18, px + 8, yy + 4); else A.drawTL(g, r.icon, px + 8, yy + 6);
    f.draw(g, f.wrap(r.text, pw - 40)[0], px + 28, yy + 4, { color: COL.white });
    if (r.res) costRow(app, r.res, px + 28, yy + 18, { color: COL.gold, plus: true });
  });
  ui.button('collectAway', W / 2 - 50, py + ph - 32, 100, 26, app.tr('away.collect'), () => app.collectAway(), { icon: 'icon_gift' });
}

// ── new-system card (SPEC §10.5: one 2-line card per unlock) ─────────────────
function unlockCard(app: App) {
  const what = app.unlockCards[0]; const { W, H } = app; const A = app.atlas; const ui = app.ui; const f = app.font; const g = app.b;
  dim(app, 0.5); blockAll(app);
  const pw = Math.min(W - 24, 170), ph = 92, px = Math.round(W / 2 - pw / 2), py = Math.round(H * 0.38 - ph / 2);
  A.nine(g, 'ui_panel_parchment', px, py, pw, ph);
  drawBig(app, app.tr('unlock.title').toUpperCase(), W / 2, py + 6, COL.wine);
  const nameKey = what.startsWith('hero_') ? `hero.${what.slice(5)}.name` : what.startsWith('region_') ? `region.${what.slice(7)}` : what.startsWith('beacon_') ? `beacon.${what.slice(7)}` : `bld.${what}.name`;
  const name = app.tr(nameKey) !== nameKey ? app.tr(nameKey) : app.tr(`unlock.${what}.name`) !== `unlock.${what}.name` ? app.tr(`unlock.${what}.name`) : what;
  const descKey = `unlock.${what}.desc`;
  const desc = app.tr(descKey) !== descKey ? app.tr(descKey) : app.tr('unlock.generic', { what: name });
  f.draw(g, name, W / 2, py + 30, { align: 'center', color: COL.ink, shadow: null });
  f.drawLines(g, f.wrap(desc, pw - 16).slice(0, 2), W / 2, py + 42, { align: 'center', color: COL.brown, shadow: null });
  ui.button('unlockOk', W / 2 - 30, py + ph - 26, 60, 22, 'OK', () => { app.unlockCards.shift(); });
}

// ── Dawn gifts (SPEC §11.7) ──────────────────────────────────────────────────
let dropFor: number | null = null;
function giftInfo(app: App, gft: DawnGift): { icon: string; name: string; sub: string; rarity: 'common' | 'rare' | 'legendary' } {
  if (gft.kind === 'blessing') {
    const def = (BOON_BY_ID as Record<string, { group: string }>)[gft.boon];
    return { icon: `boon_${gft.boon}`, name: app.tr(`boon.${gft.boon}.name`), sub: `${app.tr(`boon.group.${def?.group ?? 'squad'}`)} - ${app.tr('gift.blessing', { n: 3 })}`, rarity: gft.rarity };
  }
  if (gft.kind === 'resources') return { icon: resIcon(gft.res), name: `+${fmtNum(gft.amount)} ${app.tr(`res.${gft.res}`)}`, sub: app.tr('gift.resources'), rarity: 'common' };
  const name = gft.what === 'shards' ? app.tr('gift.shards', { n: gft.amount, hero: app.tr(`hero.${gft.hero}.name`) }) : gft.what === 'gear' ? app.tr('gift.gear') : app.tr('gift.lore', { n: gft.amount });
  return { icon: gft.what === 'shards' ? (gft.hero ? `portrait_${gft.hero}` : 'icon_shard') : gft.what === 'gear' ? 'icon_gear_weapon' : 'icon_lore', name, sub: app.tr('gift.rare'), rarity: 'rare' };
}

function gifts(app: App) {
  const s = app.state!; const { W, H, safe } = app; const A = app.atlas; const ui = app.ui; const f = app.font; const g = app.b;
  dim(app, 0.6); blockAll(app);
  const offer = s.gifts!;
  const src = s.giftSource ?? 'dawn';
  const pw = W - safe.l - safe.r - 12, px = safe.l + 6;
  const cardH = 44;
  const full = s.blessings.length >= s.blessingSlots;
  const headH = src === 'dawn' ? 56 : 32;
  const ph = headH + offer.length * (cardH + 3) + (full ? 40 : 0) + (src === 'dawn' && s.buildings.some((b) => b.id === 'dawn_shrine' && !b.ruined) ? 26 : 4);
  const py = Math.max(safe.t + 6, Math.round(H / 2 - ph / 2));
  A.nine(g, 'ui_panel_stone', px, py, pw, ph);
  drawBig(app, (src === 'dawn' ? app.tr('dawn.title') : src === 'chest' ? app.tr('dawn.chest') : app.tr('dawn.expedition')).toUpperCase(), W / 2, py + 6, COL.gold);
  let y = py + 28;
  if (src === 'dawn') {
    f.draw(g, app.tr('dawn.won', { n: Math.max(1, s.night - 1) }), W / 2, y, { align: 'center', color: COL.white }); y += 12;
    f.draw(g, app.tr('dawn.choose'), W / 2, y, { align: 'center', color: COL.fire }); y += 14;
  }
  offer.forEach((gft, i) => {
    const cy = y + i * (cardH + 3);
    const info = giftInfo(app, gft);
    A.nine(g, `ui_card_${info.rarity}`, px + 4, cy, pw - 8, cardH);
    if (info.icon.startsWith('portrait_')) A.drawPart(g, info.icon, 2, 2, 20, 20, px + 8, cy + 4); else A.drawTL(g, info.icon, px + 10, cy + 6);
    f.draw(g, info.name, px + 32, cy + 6, { color: info.rarity === 'legendary' ? COL.gold : info.rarity === 'rare' ? COL.ice : COL.white });
    f.draw(g, info.sub, px + 32, cy + 15, { color: COL.grey });
    if (gft.kind === 'blessing') {
      const d = app.tr(`boon.${gft.boon}.desc`);
      f.drawLines(g, f.wrap(d, pw - 42).slice(0, 2), px + 32, cy + 25, { color: COL.white });
    }
    ui.add({ x: px + 4, y: cy, w: pw - 8, h: cardH, id: `gift_${i}`, block: true, onTap: () => {
      const needsDrop = gft.kind === 'blessing' && full && !s.blessings.some((b) => b.id === gft.boon);
      if (needsDrop) { dropFor = i; return; }
      app.audio.sfx('boon_pick'); app.cmd({ t: 'pickGift', index: i }); dropFor = null;
    } });
  });
  y += offer.length * (cardH + 3);
  if (full) {
    f.draw(g, app.tr('dawn.full'), W / 2, y + 2, { align: 'center', color: dropFor !== null ? COL.gold : COL.grey });
    s.blessings.forEach((bl, i) => {
      const x = Math.round(W / 2 - (s.blessings.length * 22) / 2 + i * 22);
      A.nine(g, 'ui_card_common', x, y + 12, 20, 24);
      A.drawTL(g, `boon_${bl.id}`, x + 2, y + 14);
      f.draw(g, String(bl.nightsLeft), x + 14, y + 28, { color: COL.gold });
      ui.add({ x, y: y + 12, w: 20, h: 24, id: `drop_${i}`, block: true, onTap: () => {
        app.cmd({ t: 'dropBlessing', id: bl.id });
        if (dropFor !== null) { app.audio.sfx('boon_pick'); app.cmd({ t: 'pickGift', index: dropFor }); dropFor = null; }
      } });
    });
    y += 40;
  }
  if (src === 'dawn' && s.buildings.some((b) => b.id === 'dawn_shrine' && !b.ruined)) ui.button('rerollGifts', W / 2 - 40, y, 80, 20, app.tr('dawn.reroll'), () => app.cmd({ t: 'rerollGifts' }));
}

// ── "The fire gutters" (SPEC §2.4): encouraging, lists lost vs kept, Rebuild all / Back to the village ──
function fireGutters(app: App) {
  const s = app.state!; const r = s.lossReport!; const { W, H, safe } = app; const A = app.atlas; const ui = app.ui; const f = app.font; const g = app.b;
  dim(app, 0.72); blockAll(app);
  const pw = W - safe.l - safe.r - 16, px = safe.l + 8, ph = 236, py = Math.round(H / 2 - ph / 2);
  A.nine(g, 'ui_panel_stone', px, py, pw, ph);
  const fl = Math.floor(app.time * 6) % 4;
  A.draw(g, `bld_hearth_l1_${fl}`, W / 2, py + 50, { alpha: 0.6 });
  drawBig(app, app.tr('gutter.title').toUpperCase(), W / 2, py + 54, COL.fire);
  f.drawLines(g, f.wrap(app.tr('gutter.sub'), pw - 16), W / 2, py + 78, { align: 'center', color: COL.white });
  let y = py + 100;
  f.draw(g, app.tr('gutter.lost'), px + 8, y, { color: COL.grey }); y += 11;
  const lostW = costRow(app, r.lost, px + 10, y + 3, { color: COL.red });
  if (!lostW) f.draw(g, '-', px + 12, y, { color: COL.grey });
  y += 16;
  f.draw(g, app.tr('gutter.goldKept', { n: fmtNum(r.goldKept) }), px + 8, y, { color: COL.gold }); y += 11;
  f.draw(g, app.tr('gutter.ruins', { n: r.ruins }), px + 8, y, { color: COL.white }); y += 11;
  f.draw(g, `${app.tr('gutter.kept')}: ${app.tr('storage.protected', { n: s.protected })}`, px + 8, y, { color: COL.green }); y += 11;
  f.draw(g, app.tr('gutter.calm'), px + 8, y, { color: COL.ice }); y += 14;
  const canRebuild = r.ruins > 0 && costParts(r.rebuildCost).every((q) => (s.res[q.res as ResKey] ?? 0) >= q.amount);
  if (r.ruins > 0) {
    ui.button('gutterRebuild', px + 8, py + ph - 58, pw - 16, 24, app.tr('gutter.rebuildAll'), () => app.cmd({ t: 'rebuildAll' }), { icon: 'icon_rebuild', disabled: !canRebuild });
    costRow(app, r.rebuildCost, px + 12, py + ph - 68, { color: canRebuild ? COL.white : COL.red });
  }
  ui.button('gutterReturn', px + 8, py + ph - 30, pw - 16, 24, app.tr('gutter.return'), () => app.dismissGutter(), { icon: 'icon_village' });
}

// ── expedition result (SPEC §10.5) ───────────────────────────────────────────
function expeditionResult(app: App) {
  const s = app.state!; const ex = s.expedition!; const res = ex.result!; const { W, H, safe } = app; const A = app.atlas; const ui = app.ui; const f = app.font; const g = app.b;
  dim(app, 0.65); blockAll(app);
  const pw = W - safe.l - safe.r - 16, px = safe.l + 8, ph = 170, py = Math.round(H / 2 - ph / 2);
  A.nine(g, res.outcome === 'extracted' ? 'ui_panel_parchment' : 'ui_panel_stone', px, py, pw, ph);
  const ink = res.outcome === 'extracted';
  drawBig(app, app.tr(`exp.result.${res.outcome}`).toUpperCase(), W / 2, py + 8, ink ? COL.wine : COL.fire);
  f.drawLines(g, f.wrap(app.tr(`exp.result.sub.${res.outcome}`), pw - 16), W / 2, py + 32, { align: 'center', color: ink ? COL.ink : COL.white, shadow: ink ? null : undefined });
  let y = py + 54;
  f.draw(g, app.tr('exp.kept'), px + 8, y, { color: ink ? COL.brown : COL.grey, shadow: ink ? null : undefined }); y += 14;
  const kept: Record<string, number> = {};
  for (const [k, v] of Object.entries(res.kept)) if (k !== 'shards' && typeof v === 'number' && v) kept[k] = v;
  const shards = res.kept.shards ? Object.values(res.kept.shards).reduce((a, b) => a + (b ?? 0), 0) : 0;
  if (shards) kept.shards = shards;
  const entries = Object.entries(kept);
  for (let i = 0; i < entries.length; i += 3) { costRow(app, Object.fromEntries(entries.slice(i, i + 3)), px + 10, y + 3, { color: ink ? COL.ink : COL.white, ink }); y += 16; }
  f.draw(g, app.tr('exp.chests', { a: ex.chestsOpened, b: ex.chestsTotal }), px + 8, py + ph - 44, { color: ink ? COL.ink : COL.white, shadow: ink ? null : undefined });
  ui.button('expHome', W / 2 - 50, py + ph - 30, 100, 24, app.tr('exp.home'), () => app.cmd({ t: 'abandonExpedition' }), { icon: 'icon_extract' });
}

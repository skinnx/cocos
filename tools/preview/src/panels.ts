// In-game panels of the persistent Hold (SPEC §10.5): Hero, Village (+ Forge / Study / Market / Storage), Book,
// World map, Dock, Building panel. Every button issues a core Command; numbers come from the state / data tables.
import type { App } from './app';
import type { BuildingState, Cost, GearSlot, HeroId, HeroRecord, Rarity, ResKey } from './core';
import { COL } from './font';
import { drawBig, paintMinimap } from './hud';
import { buildingIcon } from './info';
import { costParts, fmtNum, affordable } from './shared';
import { resIcon, garrisonSprite } from './sprites2';
import { fmtDuration, getLang } from './strings';
import { costRow, dim, blockAll } from './screens';
import { BUILDINGS } from '../../../assets/scripts/core/data/buildings';
import { HERO_IDS, HERO_BAL, HERO_TXT, SKILL_PICKS, GARRISON_TXT } from '../../../assets/scripts/core/data/heroes';
import { FORGE_COST, GEAR_SLOTS, RARITIES } from '../../../assets/scripts/core/data/gear';
import { DISPATCH, MODIFIERS } from '../../../assets/scripts/core/data/expedition';
import { RESEARCH_IDS, RESEARCH_LORE, RESEARCH_GOLD, TIER_REQ, ACHIEVEMENTS } from '../../../assets/scripts/core/data/progression';

type Txt = { en: string; vi: string };
const L = (t: Txt | undefined) => (t ? t[getLang()] ?? t.en : '');
const RES_ALL: ResKey[] = ['wood', 'stone', 'gold', 'iron', 'food', 'essence', 'lore', 'resin', 'frost', 'coal'];
const WORKPLACES = new Set(['lumber_camp', 'quarry', 'farm', 'forge', 'study', 'market']);

export function drawPanel(app: App) {
  switch (app.panel) {
    case 'hero': return heroPanel(app);
    case 'village': case 'forge': case 'study': case 'market': return villagePanel(app);
    case 'storage': return storagePanel(app);
    case 'book': return bookPanel(app);
    case 'map': return mapPanel(app);
    case 'dock': return dockPanel(app);
    case 'building': return buildingPanel(app);
  }
}

/** Full-screen stone frame with a title and a close button; returns the content rect. */
function frame(app: App, title: string, icon?: string) {
  const { W, H, safe } = app; const A = app.atlas; const g = app.b;
  dim(app, 0.55); blockAll(app);
  const x = safe.l + 3, y = safe.t + 3, w = W - safe.l - safe.r - 6, h = H - safe.t - safe.b - 6;
  A.nine(g, 'ui_panel_stone', x, y, w, h);
  if (icon) A.drawTL(g, icon, x + 6, y + 5);
  drawBig(app, title.toUpperCase(), W / 2, y + 6, COL.gold);
  app.ui.iconButton('panelClose', x + w - 26, y + 3, 22, 'icon_close', () => app.openPanel(null));
  return { x: x + 6, y: y + 30, w: w - 12, h: h - 36 };
}

function tabs(app: App, x: number, y: number, w: number, items: Array<{ id: string; label: string; on: boolean; tap: () => void }>) {
  const g = app.b, A = app.atlas, f = app.font;
  const tw = Math.floor(w / items.length);
  items.forEach((it, i) => {
    const tx = x + i * tw;
    A.nine(g, it.on ? 'ui_tab_on' : 'ui_tab_off', tx, y, tw - 1, 16);
    f.draw(g, it.label, tx + (tw - 1) / 2, y + 5, { align: 'center', color: it.on ? COL.gold : COL.grey });
    app.ui.add({ x: tx, y, w: tw - 1, h: 16, id: it.id, block: true, onTap: it.tap });
  });
  return y + 20;
}

function stars(app: App, n: number, x: number, y: number) {
  for (let i = 0; i < 5; i++) app.atlas.drawPart(app.b, i < n ? 'icon_star' : 'icon_star_off', 3, 3, 10, 10, x + i * 9, y);
}

// ── Hero screen (squad, level, stars, gear, skills, garrison, dispatch) ─────
let heroSel: HeroId = 'knight';
function heroPanel(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font; const ui = app.ui;
  const r = frame(app, app.tr('hero.title'), 'icon_hero');
  // roster grid 5×2
  const cw = Math.floor(r.w / 5), ch = 48;
  HERO_IDS.forEach((id, i) => {
    const rec = s.roster[id]; const cx = r.x + (i % 5) * cw, cy = r.y + Math.floor(i / 5) * (ch + 2);
    const sel = heroSel === id;
    A.nine(g, sel ? 'ui_card_legendary' : rec?.owned ? 'ui_card_rare' : 'ui_card_common', cx, cy, cw - 2, ch);
    A.drawTL(g, `portrait_${id}`, cx + Math.round((cw - 2) / 2 - 12), cy + 3, { alpha: rec?.owned ? 1 : 0.35 });
    if (rec?.owned) {
      f.draw(g, app.tr('hero.level', { n: rec.level }), cx + (cw - 2) / 2, cy + 29, { align: 'center', color: COL.white });
      stars(app, rec.stars, cx + Math.round((cw - 2) / 2 - 22), cy + 37);
      const st = rec.status === 'squad' ? 'icon_sword' : rec.status === 'garrison' ? 'icon_garrison' : rec.status === 'dispatch' ? 'icon_dispatch' : null;
      if (st) A.drawPart(g, st, 3, 3, 10, 10, cx + 2, cy + 2);
    } else {
      f.draw(g, `${rec?.shards ?? 0}/${HERO_BAL.unlockShards}`, cx + (cw - 2) / 2, cy + 31, { align: 'center', color: COL.grey });
      A.drawPart(g, 'icon_lock', 3, 3, 10, 10, cx + 2, cy + 2);
    }
    ui.add({ x: cx, y: cy, w: cw - 2, h: ch, id: `heroCard_${id}`, block: true, onTap: () => { heroSel = id; } });
  });
  let y = r.y + 2 * (ch + 2) + 4;
  const rec = s.roster[heroSel]; const txt = HERO_TXT[heroSel];
  A.nine(g, 'ui_panel_parchment', r.x, y, r.w, r.h - (y - r.y));
  const ink = { color: COL.ink, shadow: null } as const;
  A.drawTL(g, `portrait_${heroSel}`, r.x + 6, y + 6);
  f.draw(g, `${txt.name} - ${L(txt.role)}`, r.x + 36, y + 6, { ...ink });
  if (rec?.owned) {
    stars(app, rec.stars, r.x + 36, y + 16);
    const cap = HERO_BAL.capByStar[rec.stars - 1];
    f.draw(g, `${app.tr('hero.level', { n: rec.level })}/${cap}`, r.x + 84, y + 17, { color: COL.brown, shadow: null });
    ui.bar(r.x + 36, y + 26, Math.min(110, r.w - 44), 6, rec.level >= cap ? 1 : rec.xp / HERO_BAL.xpToNext(rec.level), 'bar_fill_gold');
  } else f.draw(g, app.tr('hero.locked'), r.x + 36, y + 17, { color: COL.wine, shadow: null });
  f.drawLines(g, f.wrap(`${L(txt.skill)}: ${L(txt.skillDesc)}`, r.w - 12).slice(0, 2), r.x + 6, y + 36, { ...ink });
  y += 58;
  // shards → unlock / star up
  const shardsNeed = rec?.owned ? (rec.stars < 5 ? HERO_BAL.starShards[rec.stars - 1] : 0) : HERO_BAL.unlockShards;
  const essNeed = rec?.owned && rec.stars < 5 ? HERO_BAL.starEssence[rec.stars - 1] : 0;
  A.drawTL(g, 'icon_shard', r.x + 4, y - 3);
  f.draw(g, app.tr('hero.shards', { a: rec?.shards ?? 0, b: shardsNeed || '-' }), r.x + 20, y + 2, { ...ink });
  if (shardsNeed) {
    const can = (rec?.shards ?? 0) >= shardsNeed && s.res.essence >= essNeed;
    const lbl = rec?.owned ? `${app.tr('hero.starUp')}${essNeed ? ` ${essNeed}e` : ''}` : app.tr('hero.unlock');
    ui.button('heroStar', r.x + r.w - 78, y - 3, 74, 16, lbl, () => app.cmd({ t: 'starUp', hero: heroSel }), { disabled: !can });
  }
  y += 18;
  if (rec?.owned) {
    // status + squad / garrison / dispatch
    const inSquad = rec.status === 'squad';
    const squad = Object.values(s.roster).filter((q) => q.owned && q.status === 'squad').map((q) => q.id);
    const statusTxt = rec.status === 'dispatch' && rec.dispatch ? app.tr('hero.back', { t: fmtDuration((rec.dispatch.endsAt - app.clock.now()) / 1000) }) : app.tr(`hero.${rec.status}`);
    f.draw(g, statusTxt, r.x + 6, y + 2, { color: COL.plum, shadow: null });
    if (rec.status !== 'dispatch' && (s.phase === 'peace' || s.phase === 'dusk')) {
      ui.button('heroSquad', r.x + r.w - 78, y - 3, 74, 16, inSquad ? app.tr('hero.leaveSquad') : app.tr('hero.toSquad'), () => {
        const next = inSquad ? squad.filter((h) => h !== heroSel) : [...squad, heroSel].slice(-s.squadMax);
        if (next.length) app.cmd({ t: 'setSquad', heroes: next });
      }, { disabled: !inSquad && squad.length >= s.squadMax && false });
    }
    if (rec.status === 'garrison') {
      f.drawLines(g, f.wrap(L(GARRISON_TXT[heroSel]), r.w - 12).slice(0, 2), r.x + 6, y + 12, { color: COL.brown, shadow: null });
    }
    y += 30;
    // gear: 3 slots, tap to cycle through spare items of that slot
    f.draw(g, app.tr('hero.gear'), r.x + 6, y, { ...ink });
    GEAR_SLOTS.forEach((slot, i) => {
      const uid = rec.gear[slot]; const item = s.gear.find((q) => q.uid === uid);
      const gx = r.x + 6 + i * 26, gy = y + 10;
      A.nine(g, item ? `ui_gear_frame_${item.rarity}` : 'ui_card_common', gx, gy, 24, 24);
      A.drawTL(g, item?.charm ? `charm_${item.charm}` : `icon_gear_${slot}`, gx + 4, gy + 4, { alpha: item ? 1 : 0.35 });
      ui.add({ x: gx, y: gy, w: 24, h: 24, id: `gear_${slot}`, block: true, onTap: () => {
        const spare = s.gear.filter((q) => q.slot === slot && !q.equippedBy);
        const nextItem = spare[0];
        app.cmd({ t: 'equip', hero: heroSel, slot, item: nextItem ? nextItem.uid : 0 });
      } });
    });
    // skill path: picks at 5/10/15/20/25
    const sx = r.x + 92;
    f.draw(g, app.tr('hero.skills'), sx, y, { ...ink });
    HERO_BAL.skillPickLevels.forEach((lv, i) => {
      const picked = rec.skills[i];
      const opts = SKILL_PICKS.filter((p) => p.hero === heroSel && p.level === lv);
      const yy = y + 10 + i * 10;
      const can = rec.level >= lv && picked === -1;
      f.draw(g, `${lv}`, sx, yy + 1, { color: rec.level >= lv ? COL.brown : COL.dim, shadow: null });
      opts.forEach((o, k) => {
        const on = picked === o.option;
        const label = L(o.name).slice(0, 12);
        const bx = sx + 12 + k * Math.floor((r.x + r.w - sx - 14) / 2), bw = Math.floor((r.x + r.w - sx - 16) / 2);
        if (can) ui.button(`skill_${lv}_${k}`, bx, yy - 2, bw, 10, '', () => app.cmd({ t: 'pickSkill', hero: heroSel, level: lv, option: o.option as 0 | 1 }));
        f.draw(g, label, bx + 2, yy, { color: on ? COL.wine : can ? COL.white : COL.dim, shadow: on || !can ? null : undefined });
      });
    });
    y += 64;
    // dispatch (Scout Lodge, SPEC §11.5)
    if (app.unlocked('dispatch') && s.buildings.some((b) => b.id === 'scout_lodge' && !b.ruined) && rec.status !== 'dispatch' && rec.status !== 'squad') {
      f.draw(g, app.tr('hero.dispatch'), r.x + 6, y, { ...ink });
      let bx = r.x + 6; const by = y + 9;
      for (const kind of ['forage', 'hunt', 'scout'] as const) for (const m of DISPATCH[kind].minutes) {
        const lbl = `${L(DISPATCH[kind].name).split(' ').pop()} ${m >= 60 ? m / 60 + 'h' : m + 'm'}`;
        const w = f.width(lbl) + 8;
        if (bx + w > r.x + r.w - 4) continue;
        ui.button(`dispatch_${kind}_${m}`, bx, by, w, 16, lbl, () => app.cmd({ t: 'dispatch', hero: heroSel, kind, minutes: m }), { disabled: s.phase === 'night' });
        bx += w + 2;
      }
    }
  }
}

// ── Village (+ Forge / Study / Market tabs) ──────────────────────────────────
function villagePanel(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font; const ui = app.ui;
  const has = (id: string) => s.buildings.some((b) => b.id === id && !b.ruined);
  const r = frame(app, app.tr('village.title'), 'icon_village');
  const items = [{ id: 'tabVillage', label: app.tr('village.title'), on: app.panel === 'village', tap: () => { app.panel = 'village'; } }];
  if (has('forge')) items.push({ id: 'tabForge', label: app.tr('village.forge'), on: app.panel === 'forge', tap: () => { app.panel = 'forge'; } });
  if (has('study')) items.push({ id: 'tabStudy', label: app.tr('village.study'), on: app.panel === 'study', tap: () => { app.panel = 'study'; } });
  if (has('market') || s.traveler || s.tavernOffer) items.push({ id: 'tabMarket', label: app.tr('village.market'), on: app.panel === 'market', tap: () => { app.panel = 'market'; } });
  let y = items.length > 1 ? tabs(app, r.x, r.y, r.w, items) : r.y;
  if (app.panel === 'forge') return forgeTab(app, r, y);
  if (app.panel === 'study') return studyTab(app, r, y);
  if (app.panel === 'market') return marketTab(app, r, y);
  // villagers + housing + food + warmth
  const housing = s.buildings.filter((b) => b.id === 'house' && !b.ruined).reduce((a, b) => a + (BUILDINGS.house.housing?.[b.level - 1] ?? 2), 0);
  const hungry = s.villagers.filter((v) => v.hungry).length;
  A.drawTL(g, 'icon_workers', r.x, y);
  f.draw(g, app.tr('village.villagers', { a: s.villagers.length, b: housing }), r.x + 18, y + 5, { color: COL.white });
  if (hungry) { A.drawTL(g, 'icon_hungry', r.x + 100, y); f.draw(g, app.tr('village.hungry', { n: hungry }), r.x + 118, y + 5, { color: COL.red }); }
  y += 16;
  A.drawTL(g, 'icon_food', r.x, y); f.draw(g, app.tr('village.food', { n: fmtNum(s.res.food) }), r.x + 18, y + 5, { color: COL.white });
  A.drawTL(g, 'icon_warmth', r.x + 100, y); f.draw(g, app.tr('village.warmth', { n: s.warmth }), r.x + 118, y + 5, { color: COL.fire });
  y += 18;
  ui.button('autoAssign', r.x, y, 110, 18, `${app.tr('village.auto')}: ${s.autoAssign ? app.tr('ui.on') : app.tr('ui.off')}`, () => app.cmd({ t: 'autoAssign', on: !s.autoAssign }));
  ui.button('openStorage', r.x + r.w - 70, y, 70, 18, app.tr('village.storage'), () => app.openPanel('storage'), { icon: 'icon_storage' });
  y += 24;
  f.draw(g, app.tr('village.jobs'), r.x, y, { color: COL.gold }); y += 11;
  const jobs = s.buildings.filter((b) => WORKPLACES.has(b.id) && !b.ruined);
  for (const b of jobs.slice(0, Math.floor((r.y + r.h - y) / 30))) {
    A.nine(g, 'ui_card_common', r.x, y, r.w, 28);
    g.save(); g.beginPath(); g.rect(r.x + 2, y + 2, 26, 24); g.clip();
    A.draw(g, buildingIcon(b.id, b.level), r.x + 15, y + 34); g.restore();
    f.draw(g, `${app.tr(`bld.${b.id}.name`)} ${b.level}`, r.x + 32, y + 4, { color: b.powered ? COL.white : COL.grey });
    f.draw(g, b.powered ? app.tr('panel.workers', { a: b.workers, b: b.workerSlots }) : app.tr('panel.unpowered'), r.x + 32, y + 15, { color: b.powered ? COL.gold : COL.red });
    ui.button(`workMinus_${b.uid}`, r.x + r.w - 46, y + 5, 20, 18, '-', () => app.cmd({ t: 'assignWorkers', uid: b.uid, count: Math.max(0, b.workers - 1) }), { disabled: b.workers <= 0 });
    ui.button(`workPlus_${b.uid}`, r.x + r.w - 24, y + 5, 20, 18, '+', () => app.cmd({ t: 'assignWorkers', uid: b.uid, count: b.workers + 1 }), { disabled: b.workers >= b.workerSlots });
    y += 30;
  }
}

let forgeSlot: GearSlot = 'weapon';
function forgeTab(app: App, r: { x: number; y: number; w: number; h: number }, y: number) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font; const ui = app.ui;
  y = tabs(app, r.x, y, r.w, GEAR_SLOTS.map((sl) => ({ id: `forgeSlot_${sl}`, label: app.tr(`forge.slot.${sl}`), on: forgeSlot === sl, tap: () => { forgeSlot = sl; } })));
  RARITIES.forEach((rar: Rarity, i) => {
    const fc = FORGE_COST[rar];
    const yy = y + i * 34;
    A.nine(g, `ui_gear_frame_${rar}`, r.x, yy, 28, 28);
    A.drawTL(g, `icon_gear_${forgeSlot}`, r.x + 6, yy + 6);
    f.draw(g, app.tr(`rarity.${rar}`), r.x + 34, yy + 2, { color: rar === 'epic' ? COL.gold : rar === 'rare' ? COL.ice : COL.white });
    costRow(app, { ...fc.cost, ...(fc.regional ? { resin: fc.regional } : {}) }, r.x + 34, yy + 18);
    const can = affordable(s.res, fc.cost) && (!fc.blueprint || forgeSlot !== 'charm' || s.blueprints.length > 0);
    ui.button(`craft_${rar}`, r.x + r.w - 54, yy + 4, 54, 20, app.tr('forge.craft'), () => app.cmd({ t: 'craft', slot: forgeSlot, rarity: rar, charm: forgeSlot === 'charm' && s.blueprints.length ? s.blueprints[0] : undefined }), { disabled: !can });
  });
  y += 3 * 34 + 4;
  f.draw(g, `${app.tr('hero.gear')} (${s.gear.length})`, r.x, y, { color: COL.gold }); y += 11;
  const per = Math.floor(r.w / 26);
  s.gear.slice(0, per * 3).forEach((it, i) => {
    const gx = r.x + (i % per) * 26, gy = y + Math.floor(i / per) * 26;
    A.nine(g, `ui_gear_frame_${it.rarity}`, gx, gy, 24, 24);
    A.drawTL(g, it.charm ? `charm_${it.charm}` : `icon_gear_${it.slot}`, gx + 4, gy + 4);
    if (it.equippedBy) A.drawPart(g, `portrait_${it.equippedBy}`, 6, 4, 9, 9, gx + 14, gy + 14);
    else ui.add({ x: gx, y: gy, w: 24, h: 24, id: `salvage_${it.uid}`, block: true, onTap: () => app.cmd({ t: 'salvage', item: it.uid }) });
  });
}

function studyTab(app: App, r: { x: number; y: number; w: number; h: number }, y: number) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font; const ui = app.ui;
  A.drawTL(g, 'icon_lore', r.x, y); f.draw(g, `${fmtNum(s.res.lore)}`, r.x + 18, y + 5, { color: COL.white });
  A.drawTL(g, 'icon_gold', r.x + 60, y); f.draw(g, `${fmtNum(s.res.gold)}`, r.x + 78, y + 5, { color: COL.gold });
  y += 20;
  const colW = Math.floor(r.w / 3);
  for (let b = 0; b < 3; b++) {
    const x = r.x + b * colW;
    f.draw(g, app.tr(`study.branch.${b}`), x + colW / 2, y, { align: 'center', color: COL.gold });
    const done = s.research[b];
    for (let i = 0; i < 8; i++) {
      const yy = y + 10 + i * 24;
      const state = i < done ? 'done' : i === done ? 'next' : 'later';
      A.nine(g, state === 'done' ? 'ui_card_rare' : state === 'next' ? 'ui_card_legendary' : 'ui_card_common', x + 2, yy, colW - 4, 22);
      A.drawTL(g, `research_${b}_${i}`, x + 4, yy + 3, { alpha: state === 'later' ? 0.4 : 1 });
      const key = `research.${RESEARCH_IDS[b][i]}.name`;
      const name = app.tr(key) !== key ? app.tr(key) : RESEARCH_IDS[b][i];
      f.draw(g, f.wrap(name, colW - 26)[0], x + 21, yy + 3, { color: state === 'done' ? COL.green : COL.white });
      if (state === 'next') {
        const can = s.res.lore >= RESEARCH_LORE[i] && s.res.gold >= RESEARCH_GOLD(i + 1);
        f.draw(g, `${RESEARCH_LORE[i]}l ${RESEARCH_GOLD(i + 1)}g`, x + 21, yy + 12, { color: can ? COL.gold : COL.red });
        ui.add({ x: x + 2, y: yy, w: colW - 4, h: 22, id: `research_${b}`, block: true, onTap: can ? () => app.cmd({ t: 'research', branch: b as 0 | 1 | 2 }) : undefined });
      }
    }
  }
}

function marketTab(app: App, r: { x: number; y: number; w: number; h: number }, y: number) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font; const ui = app.ui;
  f.draw(g, app.tr('market.traveler'), r.x, y, { color: COL.gold }); y += 12;
  if (!s.traveler || !s.traveler.length) { f.drawLines(g, f.wrap(app.tr('market.none'), r.w), r.x, y, { color: COL.grey }); y += 24; }
  else s.traveler.forEach((o, i) => {
    A.nine(g, 'ui_card_common', r.x, y, r.w, 30);
    const give = o.give as Record<string, unknown>;
    let gx = r.x + 4;
    if ('shards' in give) { A.drawTL(g, `portrait_${give.shards}`, gx, y + 3); f.draw(g, `+${give.amount}`, gx + 26, y + 10); }
    else if ('gear' in give) { A.drawTL(g, 'icon_gear_weapon', gx, y + 6); f.draw(g, app.tr(`rarity.${give.gear}`), gx + 18, y + 10); }
    else if ('cosmetic' in give) { A.drawTL(g, 'icon_cosmetic', gx, y + 6); f.draw(g, String(give.cosmetic).replace(/_/g, ' '), gx + 18, y + 10); }
    else gx += costRow(app, give as Cost, gx, y + 12, { plus: true, color: COL.green });
    f.draw(g, '<', r.x + r.w / 2 - 6, y + 10, { color: COL.grey });
    costRow(app, o.price, r.x + r.w / 2 + 4, y + 12, { color: affordable(s.res, o.price) ? COL.white : COL.red });
    ui.button(`trade_${i}`, r.x + r.w - 44, y + 5, 40, 20, o.bought ? app.tr('market.sold') : app.tr('market.buy'), () => app.cmd({ t: 'trade', index: i }), { disabled: o.bought || !affordable(s.res, o.price) });
    y += 32;
  });
  if (s.tavernOffer) {
    y += 4;
    f.draw(g, app.tr('bld.tavern.name'), r.x, y, { color: COL.gold }); y += 12;
    A.nine(g, 'ui_card_rare', r.x, y, r.w, 30);
    A.drawTL(g, `portrait_${s.tavernOffer.hero}`, r.x + 4, y + 3);
    f.draw(g, HERO_TXT[s.tavernOffer.hero].name, r.x + 32, y + 4);
    costRow(app, s.tavernOffer.cost, r.x + 32, y + 18);
    ui.button('recruit', r.x + r.w - 54, y + 5, 50, 20, app.tr('hero.unlock'), () => app.cmd({ t: 'recruit', index: 0 }), { disabled: !affordable(s.res, s.tavernOffer.cost) });
  }
}

function storagePanel(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font;
  const r = frame(app, app.tr('storage.title'), 'icon_storage');
  let y = r.y;
  for (const k of RES_ALL) {
    const cap = k === 'gold' || k === 'lore' ? 0 : k === 'essence' ? s.essenceCap : s.storageCap;
    A.drawTL(g, resIcon(k), r.x, y);
    f.draw(g, app.tr(`res.${k}`), r.x + 18, y + 5, { color: COL.white });
    f.draw(g, cap ? `${fmtNum(s.res[k])}/${fmtNum(cap)}` : fmtNum(s.res[k]), r.x + r.w - 2, y + 5, { align: 'right', color: cap && s.res[k] >= cap ? COL.red : COL.gold });
    if (cap) app.ui.bar(r.x + 80, y + 4, r.w - 150, 7, s.res[k] / cap, 'bar_fill_gold');
    y += 19;
  }
  A.drawTL(g, 'icon_ember', r.x, y); f.draw(g, `Ember ${fmtNum(s.ember)}`, r.x + 18, y + 5, { color: COL.fire }); y += 22;
  A.drawTL(g, 'icon_vault', r.x, y); f.draw(g, app.tr('storage.protected', { n: s.protected }), r.x + 18, y + 5, { color: COL.green });
}

// ── Book: bounties, chronicle, gloom book, feats ─────────────────────────────
let bookTab: 'bounties' | 'chronicle' | 'gloom' | 'feats' = 'bounties';
function bookPanel(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font; const ui = app.ui;
  const r = frame(app, app.tr('book.title'), 'icon_book');
  const items: Array<{ id: string; label: string; on: boolean; tap: () => void }> = [];
  if (app.unlocked('bounties')) items.push({ id: 'bookBounties', label: app.tr('book.bounties'), on: bookTab === 'bounties', tap: () => { bookTab = 'bounties'; } });
  if (app.unlocked('chronicle')) items.push({ id: 'bookChronicle', label: app.tr('book.chronicle'), on: bookTab === 'chronicle', tap: () => { bookTab = 'chronicle'; } });
  items.push({ id: 'bookGloom', label: app.tr('book.gloom'), on: bookTab === 'gloom', tap: () => { bookTab = 'gloom'; } });
  items.push({ id: 'bookFeats', label: app.tr('book.achievements'), on: bookTab === 'feats', tap: () => { bookTab = 'feats'; } });
  if (!items.some((i) => i.on)) bookTab = 'gloom';
  let y = tabs(app, r.x, r.y, r.w, items);
  if (bookTab === 'bounties') {
    s.bounties.forEach((b, i) => {
      A.nine(g, b.done ? 'ui_card_rare' : 'ui_card_common', r.x, y, r.w, 40);
      A.drawTL(g, 'icon_bounty', r.x + 4, y + 4);
      f.draw(g, f.wrap(b.text.startsWith('bounty.') ? app.tr(b.text, { n: b.goal }) : b.text, r.w - 74)[0], r.x + 22, y + 5, { color: COL.white });
      ui.bar(r.x + 22, y + 16, r.w - 80, 7, b.progress / Math.max(1, b.goal), 'bar_fill_gold');
      f.draw(g, `${Math.min(b.progress, b.goal)}/${b.goal}`, r.x + r.w - 56, y + 16, { align: 'right', color: COL.gold });
      costRow(app, { gold: b.reward.gold ?? 0, ember: b.reward.ember ?? 0 }, r.x + 22, y + 30, { color: COL.gold });
      if (b.done && !b.claimed) ui.button(`claim_${i}`, r.x + r.w - 50, y + 4, 46, 18, app.tr('book.claim'), () => app.cmd({ t: 'claimBounty', index: i }));
      else if (!b.done && s.bountyRerolls > 0) ui.button(`rerollBounty_${i}`, r.x + r.w - 50, y + 4, 46, 18, app.tr('book.reroll'), () => app.cmd({ t: 'rerollBounty', index: i }));
      y += 43;
    });
  } else if (bookTab === 'chronicle') {
    const c = s.chronicle;
    f.draw(g, `${app.tr('book.week', { n: c.week })} - ${app.tr('book.deeds', { n: c.deeds })}`, r.x, y, { color: COL.gold }); y += 14;
    // 7-step bar
    const steps = 7, bw = r.w - 16, sx = r.x + 8;
    if (A.frames['ui_chronicle_bar']) A.nine(g, 'ui_chronicle_bar', sx, y + 8, bw, 8); else ui.bar(sx, y + 8, bw, 8, 0, 'bar_fill_gold');
    const perStep = 30;
    ui.bar(sx, y + 8, bw, 8, Math.min(1, c.deeds / (perStep * steps)), 'bar_fill_gold');
    for (let i = 0; i < steps; i++) {
      const nx = sx + Math.round(((i + 1) / steps) * bw) - 6;
      const reached = c.deeds >= (i + 1) * perStep;
      A.drawTL(g, reached ? 'ui_chronicle_node_done' : 'ui_chronicle_node', nx - 2, y + 2);
      if (reached && c.claimed <= i) ui.button(`chron_${i}`, nx - 10, y + 22, 26, 14, app.tr('book.claim').slice(0, 4), () => app.cmd({ t: 'claimChronicle', step: i }));
      if (i === steps - 1) A.drawTL(g, 'icon_cosmetic', nx - 2, y + 22);
    }
  } else if (bookTab === 'gloom') {
    const ids = Object.keys(s.gloomBook);
    const per = 3, cw = Math.floor(r.w / per);
    ids.slice(0, 18).forEach((id, i) => {
      const e = s.gloomBook[id as keyof typeof s.gloomBook]!;
      const x = r.x + (i % per) * cw, yy = y + Math.floor(i / per) * 34;
      A.nine(g, 'ui_card_common', x, yy, cw - 2, 32);
      if (e.seen) A.draw(g, `enemy_${id}_move_0`, x + 12, yy + 26); else A.draw(g, `enemy_eyes_veiled_0`, x + 12, yy + 18);
      f.draw(g, e.seen ? app.tr(`enemy.${id}.name`).slice(0, 10) : app.tr('book.unseen'), x + 24, yy + 6, { color: COL.white });
      f.draw(g, app.tr('book.kills', { n: fmtNum(e.kills) }), x + 24, yy + 17, { color: COL.grey });
    });
  } else {
    const per = 6, cw = Math.floor(r.w / per);
    ACHIEVEMENTS.forEach((a, i) => {
      const got = s.achievements.includes(a.id);
      const x = r.x + (i % per) * cw, yy = y + Math.floor(i / per) * 30;
      A.drawTL(g, `badge_frame_${i % 10}`, x + Math.round(cw / 2 - 12), yy, { alpha: got ? 1 : 0.3 });
      if (got) A.drawTL(g, 'icon_achievement', x + Math.round(cw / 2 - 8), yy + 4);
    });
  }
}

// ── World map (regions, rifts, rift hearts, dock) ───────────────────────────
let mapCv: HTMLCanvasElement | null = null;
function mapPanel(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font;
  const r = frame(app, app.tr('map.title'), 'icon_map');
  const n = s.map.size;
  if (!mapCv) mapCv = document.createElement('canvas');
  if (mapCv.width !== n) { mapCv.width = n; mapCv.height = n; }
  paintMinimap(app, mapCv);
  const k = Math.max(1, Math.floor(Math.min(r.w, r.h - 60) / n));
  const sz = n * k, mx = Math.round(r.x + r.w / 2 - sz / 2), my = r.y + 2;
  if (A.frames['ui_map_frame']) A.nine(g, 'ui_map_frame', mx - 3, my - 3, sz + 6, sz + 6); else A.nine(g, 'ui_minimap_frame', mx - 2, my - 2, sz + 4, sz + 4);
  g.imageSmoothingEnabled = false;
  g.drawImage(mapCv, mx, my, sz, sz);
  for (const p of s.pois) {
    if (p.kind !== 'rift' && p.kind !== 'heart') continue;
    if (!s.map.explored[Math.floor(p.y) * n + Math.floor(p.x)] && p.kind !== 'rift') continue;
    A.drawC(g, p.kind === 'heart' ? 'ui_map_pin_heart' : 'ui_map_pin_rift', mx + (p.x + 0.5) * k, my + (p.y + 0.5) * k - 4);
  }
  const dock = s.buildings.find((b) => b.id === 'dock');
  if (dock) A.drawC(g, 'ui_map_pin_dock', mx + (dock.x + 1) * k, my + (dock.y + 1) * k - 4);
  const h = s.buildings.find((b) => b.uid === s.hearthUid);
  if (h) A.drawC(g, 'icon_fire', mx + (h.x + 1) * k, my + (h.y + 1) * k - 4);
  let y = my + sz + 8;
  for (let reg = 1; reg <= 5; reg++) {
    const open = reg <= s.regionsOpen, sealed = reg < s.regionsOpen;
    A.drawPart(g, open ? 'icon_region' : 'icon_lock', 3, 3, 10, 10, r.x, y);
    f.draw(g, `${reg}. ${app.tr(`region.${reg}`)}`, r.x + 14, y + 2, { color: open ? COL.white : COL.dim });
    f.draw(g, sealed ? app.tr('map.sealed') : open ? '' : app.tr('map.veiled'), r.x + r.w, y + 2, { align: 'right', color: sealed ? COL.green : COL.purple });
    y += 11;
  }
}

// ── Dock: 3 island cards, tier, trails, set sail (SPEC §10.5 / §11.6) ───────
let dockIsland = 0, dockTier = 1;
function dockPanel(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font; const ui = app.ui;
  const r = frame(app, app.tr('dock.title'), 'icon_extract');
  A.drawTL(g, 'icon_trail', r.x, r.y); f.draw(g, app.tr('dock.trails', { n: s.trails }), r.x + 18, r.y + 5, { color: s.trails ? COL.gold : COL.grey });
  if (!s.trails) f.draw(g, app.tr('dock.noTrail'), r.x + r.w, r.y + 5, { align: 'right', color: COL.grey });
  let y = r.y + 20;
  const isl = s.islands.slice(0, 3);
  isl.forEach((is, i) => {
    const sel = dockIsland === i;
    const ch = 58;
    if (A.frames['ui_island_card']) A.nine(g, 'ui_island_card', r.x, y, r.w, ch); else A.nine(g, sel ? 'ui_card_rare' : 'ui_card_common', r.x, y, r.w, ch);
    if (sel) A.nine(g, 'ui_card_legendary', r.x, y, r.w, ch, undefined, 0.6);
    const tile = is.biome === 'snow' ? 'tile_snow_0' : is.biome === 'ash' ? 'tile_ash_0' : is.biome === 'forest' ? 'tile_grassdark_0' : is.biome === 'quarry' || is.biome === 'ruins' ? 'tile_ruins_0' : 'tile_grass_0';
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) A.drawTL(g, tile, r.x + 4 + j * 16, y + 6 + k * 16);
    A.drawTL(g, 'prop_boat', r.x + 8, y + 18);
    const mod = (MODIFIERS as Record<string, { name: Txt; desc: Txt }>)[is.modifier];
    f.draw(g, mod ? L(mod.name) : is.modifier, r.x + 42, y + 5, { color: COL.white });
    f.drawLines(g, f.wrap(mod ? L(mod.desc) : '', r.w - 48).slice(0, 2), r.x + 42, y + 15, { color: COL.grey });
    A.drawTL(g, `icon_${is.focus === 'regional' ? 'resin' : is.focus === 'shards' ? 'shard' : is.focus === 'blueprint' ? 'gear_charm' : is.focus}`, r.x + 42, y + 36);
    f.draw(g, app.tr('dock.focus', { f: app.tr(`focus.${is.focus}`) }), r.x + 60, y + 41, { color: COL.gold });
    ui.add({ x: r.x, y, w: r.w, h: ch, id: `island_${i}`, block: true, onTap: () => { dockIsland = i; dockTier = Math.min(dockTier, is.maxTier); } });
    y += ch + 3;
  });
  const is = isl[dockIsland];
  if (!is) return;
  // tier selector I..V (unlocked by sealed regions)
  f.draw(g, app.tr('dock.tier', { n: dockTier }), r.x, y + 5, { color: COL.white });
  for (let t = 1; t <= 5; t++) {
    const ok = t <= is.maxTier;
    ui.button(`tier_${t}`, r.x + 40 + (t - 1) * 24, y, 22, 18, ['I', 'II', 'III', 'IV', 'V'][t - 1], () => { dockTier = t; }, { disabled: !ok, color: dockTier === t ? COL.gold : undefined });
  }
  y += 24;
  // crew = current squad
  const squad = Object.values(s.roster).filter((q) => q.owned && q.status === 'squad').map((q) => q.id as HeroId);
  f.draw(g, app.tr('dock.squad'), r.x, y + 8, { color: COL.white });
  squad.forEach((id, i) => A.drawTL(g, `portrait_${id}`, r.x + 34 + i * 26, y));
  y += 30;
  ui.button('sail', app.W / 2 - 60, Math.min(y, r.y + r.h - 28), 120, 26, app.tr('dock.sail'), () => {
    app.saveHold();
    app.openPanel(null);
    app.cmd({ t: 'startExpedition', island: is.index, tier: dockTier, squad });
  }, { icon: 'icon_extract', disabled: s.phase !== 'peace' || !squad.length });
}

// ── Building panel (tap a building outside build mode) ──────────────────────
function buildingPanel(app: App) {
  const s = app.state!; const g = app.b; const A = app.atlas; const f = app.font; const ui = app.ui;
  const b = s.buildings.find((q) => q.uid === app.panelArg);
  if (!b) { app.openPanel(null); return; }
  const { W, H, safe } = app;
  const d = BUILDINGS[b.id];
  const pw = W - safe.l - safe.r - 12, px = safe.l + 6;
  const ph = 168, py = H - safe.b - ph - 6;
  ui.block(0, 0, W, H, 'bpanelOutside');
  ui.add({ x: 0, y: 0, w: W, h: py, id: 'bpanelDismiss', block: true, onTap: () => app.openPanel(null) });
  A.nine(g, 'ui_panel_parchment', px, py, pw, ph);
  ui.block(px, py, pw, ph, 'bpanel');
  app.ui.iconButton('panelClose', px + pw - 24, py + 2, 22, 'icon_close', () => app.openPanel(null));
  const ink = { color: COL.ink, shadow: null } as const;
  g.save(); g.beginPath(); g.rect(px + 4, py + 4, 36, 40); g.clip();
  A.draw(g, buildingIcon(b.id, b.id === 'hearth' ? s.hearthTier : b.level), px + 22, py + 44); g.restore();
  const name = app.tr(`bld.${b.id}.name`);
  const lvl = b.id === 'hearth' ? `${app.tr('panel.tierUp').split(' ').pop()} ${s.hearthTier}` : app.tr('panel.level', { n: b.level });
  f.draw(g, `${name} - ${lvl}`, px + 44, py + 6, { ...ink });
  ui.bar(px + 44, py + 16, Math.min(100, pw - 76), 7, b.hp / Math.max(1, b.maxHp), 'bar_fill_green');
  f.draw(g, app.tr('panel.hp', { a: Math.round(b.hp), b: b.maxHp }), px + 44 + Math.min(100, pw - 76) + 4, py + 16, { color: COL.brown, shadow: null });
  const descKey = `bld.${b.id}.desc`;
  f.drawLines(g, f.wrap(app.tr(descKey) !== descKey ? app.tr(descKey) : '', pw - 52).slice(0, 2), px + 44, py + 27, { color: COL.brown, shadow: null });
  let y = py + 48;
  if (b.ruined) {
    f.draw(g, app.tr('build.ruin'), px + 8, y, { color: COL.wine, shadow: null }); y += 12;
  }
  // workers
  if (WORKPLACES.has(b.id) && !b.ruined) {
    f.draw(g, b.powered ? app.tr('panel.workers', { a: b.workers, b: b.workerSlots }) : app.tr('panel.unpowered'), px + 8, y + 3, { color: b.powered ? COL.ink : COL.wine, shadow: null });
    ui.button('bpWorkMinus', px + pw - 50, y - 2, 20, 16, '-', () => app.cmd({ t: 'assignWorkers', uid: b.uid, count: Math.max(0, b.workers - 1) }), { disabled: b.workers <= 0 });
    ui.button('bpWorkPlus', px + pw - 28, y - 2, 20, 16, '+', () => app.cmd({ t: 'assignWorkers', uid: b.uid, count: b.workers + 1 }), { disabled: b.workers >= b.workerSlots });
    y += 18;
  }
  // garrison (towers level ≥ 2)
  if (b.id.startsWith('tower') && app.unlocked('garrison') && !b.ruined) {
    f.draw(g, `${app.tr('panel.garrison')}:`, px + 8, y + 3, { ...ink });
    if (b.garrison) {
      A.draw(g, garrisonSprite(b.garrison, app.time), px + 70, y + 14);
      ui.button('bpUngarrison', px + 86, y - 2, 40, 16, 'x', () => app.cmd({ t: 'garrison', hero: b.garrison!, uid: 0 }));
    } else if (b.level >= 2) {
      const free = Object.values(s.roster).filter((r: HeroRecord) => r.owned && (r.status === 'rest' || r.status === 'garrison'));
      free.slice(0, 6).forEach((r, i) => {
        const x = px + 60 + i * 18;
        A.drawPart(g, `portrait_${r.id}`, 4, 2, 16, 16, x, y - 2);
        ui.add({ x, y: y - 2, w: 16, h: 16, id: `bpGarrison_${r.id}`, block: true, onTap: () => app.cmd({ t: 'garrison', hero: r.id, uid: b.uid }) });
      });
    } else f.draw(g, app.tr('panel.level', { n: 2 }) + '+', px + 60, y + 3, { color: COL.dim, shadow: null });
    y += 18;
  }
  // module (towers level 3, SHOULD)
  if (b.id.startsWith('tower') && b.level >= 3 && app.unlocked('modules') && !b.ruined) {
    f.draw(g, `${app.tr('panel.module')}: ${b.module ?? app.tr('panel.none')}`, px + 8, y + 3, { ...ink });
    const owned = Object.entries(s.modules).filter(([, n]) => (n ?? 0) > 0).map(([m]) => m);
    owned.slice(0, 5).forEach((m, i) => {
      A.drawPart(g, `module_${m}`, 2, 2, 12, 12, px + 100 + i * 15, y - 1);
      ui.add({ x: px + 100 + i * 15, y: y - 1, w: 13, h: 13, id: `bpModule_${m}`, block: true, onTap: () => app.cmd({ t: 'setModule', uid: b.uid, module: m as never }) });
    });
    y += 18;
  }
  // actions
  const by = py + ph - 26;
  const btns: Array<{ id: string; label: string; icon: string; tap: () => void; dis?: boolean; cost?: Cost }> = [];
  if (b.id === 'hearth') {
    const t = s.hearthTier;
    if (t < 10) {
      const cost = app.game!.buildingCost('hearth', Math.min(10, t + 1) as never);
      const req = TIER_REQ[t];
      const reqTxt = req.kind === 'nightsWon' ? `${req.n} nights won` : req.kind === 'villagers' ? `${req.n} villagers` : req.kind === 'sealed' ? `seal region ${req.region}` : req.kind === 'tr' ? `threat ${req.n}` : '';
      if (reqTxt) f.draw(g, app.tr('panel.tierCond', { c: reqTxt }), px + 8, by - 22, { color: COL.wine, shadow: null });
      btns.push({ id: 'bpTierUp', label: app.tr('panel.tierUp'), icon: 'icon_upgrade', tap: () => app.cmd({ t: 'upgradeHearth' }), dis: s.phase !== 'peace' || !affordable(s.res, cost), cost });
    }
  } else if (b.ruined) {
    let c: Cost = {};
    for (const q of costParts(app.game!.buildingCost(b.id, b.level as 1 | 2 | 3))) c[q.res] = Math.ceil(q.amount / 2);
    btns.push({ id: 'bpRebuild', label: app.tr('build.rebuild'), icon: 'icon_rebuild', tap: () => app.cmd({ t: 'rebuild', uid: b.uid }), dis: !affordable(s.res, c), cost: c });
    btns.push({ id: 'bpClear', label: app.tr('build.clear'), icon: 'icon_close', tap: () => { app.cmd({ t: 'clearRuin', uid: b.uid }); app.openPanel(null); } });
  } else {
    if (d.upgradeTo || b.level < d.maxLevel) {
      const c = d.upgradeTo ? app.game!.buildingCost(d.upgradeTo, 1) : app.game!.buildingCost(b.id, Math.min(3, b.level + 1) as 1 | 2 | 3);
      btns.push({ id: 'bpUpgrade', label: app.tr('panel.upgrade'), icon: 'icon_upgrade', tap: () => app.cmd({ t: 'upgrade', uid: b.uid }), dis: !affordable(s.res, c), cost: c });
    }
    btns.push({ id: 'bpRepair', label: app.tr('panel.repair'), icon: 'icon_wrench', tap: () => app.cmd({ t: 'repair', uid: b.uid }), dis: b.hp >= b.maxHp });
    btns.push({ id: 'bpSell', label: app.tr('panel.sell'), icon: 'icon_sell', tap: () => { app.cmd({ t: 'sell', uid: b.uid }); app.openPanel(null); } });
    if (s.phase === 'peace' || s.phase === 'dusk') btns.push({ id: 'bpMove', label: app.tr('panel.move'), icon: 'icon_relocate', tap: () => { app.openPanel(null); app.build.enter(); app.build.moving = { uid: b.uid, at: { x: b.x, y: b.y } }; } });
    if (b.id === 'dock') btns.push({ id: 'bpDock', label: app.tr('dock.title'), icon: 'icon_extract', tap: () => app.openPanel('dock') });
  }
  const bw = Math.floor((pw - 8) / Math.max(1, btns.length));
  btns.forEach((bt, i) => {
    ui.button(bt.id, px + 4 + i * bw, by, bw - 2, 22, f.width(bt.label) + 18 <= bw - 2 ? bt.label : '', bt.tap, { icon: bt.icon, disabled: bt.dis });
    if (bt.cost) costRow(app, bt.cost, px + 6 + i * bw, by - 9, { ink: true });
  });
  void (null as unknown as BuildingState);
}

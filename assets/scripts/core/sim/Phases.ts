// SPEC §2.2 phase machine DAY → DUSK → NIGHT → DAWN, victory/defeat/endless, horn, false dawn, tutorial.
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { BUILDINGS, TAVERN } from '../data/buildings';
import { HERO_IDS } from '../data/heroes';
import { TALENT_BY_ID } from '../data/talents';
import { applyStun } from './Combat';
import { offerBoons, pickBoon } from './Boons';
import { setBuildMode, updateTimeScale } from './Economy';
import { maybeRecomputeFields } from './FlowField';
import { rebuildTerrain } from './Grid';
import { CENTER } from './MapGen';
import { planNight, spawnRoots, isBossNight } from './Spawner';
import { reviveHero, recruitHero } from './Squad';
import { spawnMilitia } from './Towers';
import { type World, type BuildingX, type HeroX, type EnemyX, type AllyX, type NodeX, emit, boonStacks, distToRect } from './World';

export function dayDuration(w: World): number {
  const base = w.s.night <= 1 ? BALANCE.day.firstDaySeconds : BALANCE.day.seconds;
  return base + TALENT_BY_ID.longDay.perLevel * (w.meta.talents.longDay ?? 0);
}

export function startDay(w: World): void {
  const s = w.s;
  s.phase = 'day'; s.phaseT = 0; s.phaseDur = dayDuration(w); s.nightT = 0;
  s.boonSource = null;
  w.r.rootCut = [];
  w.r.enraged = false;
  for (const b of s.buildings as BuildingX[]) if (b.id === 'brazier') { b.snuffed = false; b.offT = 0; b.fueled = true; b.relightT = 0; }
  // stumps regrow after 2 days
  let changed = false;
  for (const nd of s.nodes as NodeX[]) {
    if (nd.kind !== 'stump') continue;
    nd.regrowT -= 1;
    if (nd.regrowT <= 0 && !w.bldAt[nd.y * w.size + nd.x] && !w.trapAt[nd.y * w.size + nd.x]) {
      const blockedByUnit = (s.heroes as HeroX[]).some((h) => distToRect(h.x, h.y, { x: nd.x, y: nd.y, w: 1, h: 1 }) < 0.35);
      if (!blockedByUnit) { nd.kind = nd.orig; nd.hp = BALANCE.harvest.treeChops; nd.maxHp = nd.hp; nd.regrowT = 0; changed = true; }
    }
  }
  if (changed) { rebuildTerrain(w); w.r.fieldDirty = true; }
  spawnRoots(w);
  w.lightDirty = true;
  setBuildMode(w, false);
  updateTimeScale(w);
  emit(w, { t: 'phase', phase: 'day', night: s.night });
}

export function callNight(w: World): void {
  if (w.s.phase !== 'day') return;
  const left = Math.max(0, w.s.phaseDur - w.s.phaseT);
  const g = Math.floor(left * BALANCE.day.callNightGoldPerSec);
  if (g > 0) { w.s.res.gold += g; w.s.stats.goldEarned += g; emit(w, { t: 'gold', amount: g, x: CENTER, y: CENTER }); }
  startDusk(w);
}

export function startDusk(w: World): void {
  const s = w.s;
  s.phase = 'dusk'; s.phaseT = 0; s.phaseDur = 0;
  // rift roots wither at dusk (their effect is recorded in rootCut)
  s.pois = s.pois.filter((p) => p.kind !== 'root');
  for (const e of s.enemies as EnemyX[]) if (e.guard && !s.pois.some((p) => p.uid === e.guard)) e.dead = true;
  // brazier fuel (rule 3): 1 wood each, nearest-to-Hearth first; unfuelled braziers stay dark tonight
  const braziers = (s.buildings as BuildingX[]).filter((b) => b.id === 'brazier')
    .sort((a, b) => Math.hypot(a.x + 0.5 - CENTER, a.y + 0.5 - CENTER) - Math.hypot(b.x + 0.5 - CENTER, b.y + 0.5 - CENTER) || a.uid - b.uid);
  const free = boonStacks(w, 'embers') > 0;
  for (const b of braziers) {
    if (free) { b.fueled = true; continue; }
    if (s.res.wood >= BALANCE.light.brazierFuelWood) { s.res.wood -= BALANCE.light.brazierFuelWood; b.fueled = true; }
    else b.fueled = false;
  }
  w.lightDirty = true; w.r.snuffDirty = true;
  planNight(w);
  setBuildMode(w, true);
  updateTimeScale(w);
  emit(w, { t: 'phase', phase: 'dusk', night: s.night });
}

export function startNight(w: World): void {
  const s = w.s;
  if (s.phase !== 'dusk') return;
  s.phase = 'night'; s.phaseT = 0; s.nightT = 0; s.phaseDur = BALANCE.night.spawnWindow(s.night);
  w.r.nightKills = 0; w.r.nightGold = 0; w.r.bossSpawned = false; w.r.falseDawnUsed = false; w.r.enraged = false;
  setBuildMode(w, false);
  spawnMilitia(w);
  w.lightDirty = true;
  maybeRecomputeFields(w, true);
  if (s.tutorial === 4) advanceTutorial(w, -1);
  updateTimeScale(w);
  emit(w, { t: 'phase', phase: 'night', night: s.night });
  emit(w, { t: 'horn' });
}

export function startDawn(w: World): void {
  const s = w.s;
  s.phase = 'dawn'; s.phaseT = 0; s.nightT = 0;
  s.stats.nightsSurvived = Math.max(s.stats.nightsSurvived, s.night);
  if (s.boonOffer && s.boonSource === 'chest') pickBoon(w, 0);
  for (const h of s.heroes as HeroX[]) { if (h.dead) reviveHero(w, h); h.hp = h.maxHp; }
  for (const b of s.buildings as BuildingX[]) {
    if (b.id === 'trap_spikes') b.charges = BUILDINGS.trap_spikes.charges![b.level - 1] + BOON_FX.spikes * boonStacks(w, 'spikes');
  }
  s.allies = (s.allies as AllyX[]).filter((a) => a.id !== 'militia');
  s.zones = [];
  s.projectiles = [];
  if (s.buffs.shrine && s.night >= w.r.shrineUntil) s.buffs.shrine = null;
  s.buffs.unlitPulseT = 0; s.buffs.hearthLightMul = 1; s.buffs.falseDawnT = 0;
  w.r.hearthLowWarned = w.hearth.hp < w.hearth.maxHp * 0.3;
  w.r.enraged = false;
  s.boss = null;
  w.r.fieldDirty = true; w.lightDirty = true;
  // tavern
  s.tavernOffer = null;
  if ((s.buildings as BuildingX[]).some((b) => b.id === 'tavern')) {
    const owned = new Set([...(s.heroes as HeroX[]).map((h) => h.id), ...s.reserve]);
    const pool = HERO_IDS.filter((h) => !owned.has(h));
    const opts = [];
    for (let k = 0; k < 2 && pool.length; k++) opts.push(pool.splice(w.rng.int(0, pool.length - 1), 1)[0]);
    const pick = opts.length ? opts[w.rng.int(0, opts.length - 1)] : null;
    if (pick) s.tavernOffer = [{ hero: pick, cost: TAVERN.goldPerHero * (s.heroes.length + s.reserve.length) }];
  }
  setBuildMode(w, false);
  updateTimeScale(w);
  emit(w, { t: 'phase', phase: 'dawn', night: s.night });
  offerBoons(w, 'dawn');
}

export function hireHero(w: World, index: number): boolean {
  const o = w.s.tavernOffer?.[index];
  if (!o || w.s.res.gold < o.cost) return false;
  w.s.res.gold -= o.cost;
  recruitHero(w, o.hero, CENTER, CENTER + 2.2, 1);
  w.s.tavernOffer = null;
  emit(w, { t: 'hired', hero: o.hero });
  return true;
}

export function victory(w: World): void {
  w.s.phase = 'victory';
  w.s.stats.nightsSurvived = Math.max(w.s.stats.nightsSurvived, w.s.night);
  setBuildMode(w, false); updateTimeScale(w);
  emit(w, { t: 'phase', phase: 'victory', night: w.s.night });
}

export function defeat(w: World): void {
  if (w.s.phase === 'defeat') return;
  w.s.phase = 'defeat';
  setBuildMode(w, false); updateTimeScale(w);
  emit(w, { t: 'phase', phase: 'defeat', night: w.s.night });
}

export function continueEndless(w: World): void {
  if (w.s.phase !== 'victory') return;
  w.s.endless = true;
  startDawn(w);
}

/** After a dawn boon is picked: next day. */
export function afterDawnPick(w: World): void {
  w.s.night++;
  startDay(w);
}

/** Per-step phase logic (dt in sim seconds). */
export function updatePhase(w: World, dt: number): void {
  const s = w.s;
  if (s.hornT > 0) { s.hornT -= dt; if (s.hornT < 0) s.hornT = 0; }
  if (s.buffs.unlitPulseT > 0) { s.buffs.unlitPulseT -= dt; if (s.buffs.unlitPulseT <= 0) { s.buffs.unlitPulseT = 0; s.buffs.hearthLightMul = 1; w.lightDirty = true; w.r.snuffDirty = true; } }
  if (s.buffs.falseDawnT > 0) { s.buffs.falseDawnT -= dt; if (s.buffs.falseDawnT <= 0) { s.buffs.falseDawnT = 0; w.lightDirty = true; } }
  if (w.hearth.hp <= 0) { defeat(w); return; }
  if (s.phase === 'day') {
    s.phaseT += dt;
    if (boonStacks(w, 'rebirth')) w.hearth.hp = Math.min(w.hearth.maxHp, w.hearth.hp + BOON_FX.rebirth * dt);
    if (s.phaseT >= s.phaseDur) startDusk(w);
    return;
  }
  if (s.phase !== 'night') return;
  s.phaseT += dt; s.nightT += dt;
  if (!w.r.enraged && s.nightT >= BALANCE.night.enrageAfter) { w.r.enraged = true; emit(w, { t: 'enrage' }); }
  // false dawn (legendary boon)
  if (boonStacks(w, 'falsedawn') && !w.r.falseDawnUsed && w.hearth.hp < w.hearth.maxHp * BOON_FX.falseDawnAt) {
    w.r.falseDawnUsed = true;
    s.buffs.falseDawnT = BOON_FX.falseDawnSecs;
    for (const e of s.enemies as EnemyX[]) applyStun(e, BOON_FX.falseDawnStun);
    w.lightDirty = true;
    emit(w, { t: 'falseDawn' });
  }
  if (s.enemiesLeft === 0 && w.r.spawnIdx >= w.r.spawn.length) {
    if (s.night === 10 && !s.endless) victory(w);
    else startDawn(w);
  }
}

// ── tutorial (§10.3) ────────────────────────────────────────────────────────
export function advanceTutorial(w: World, step: number): void {
  w.s.tutorial = step;
  if (step < 0) w.meta.tutorialDone = true;
  emit(w, { t: 'tutorial', step });
}

export function updateTutorial(w: World): void {
  const s = w.s;
  if (s.tutorial < 0) return;
  if (s.tutorial === 0 && w.r.tut.moved >= 3) advanceTutorial(w, 1);
  else if (s.tutorial === 1 && w.r.tutHarvested) advanceTutorial(w, 2);
  else if (s.tutorial === 2 && w.r.tut.walls >= 6) advanceTutorial(w, 3);
  else if (s.tutorial === 3 && (s.buildings as BuildingX[]).some((b) => b.id === 'tower_arrow' && b.synMask & 1)) advanceTutorial(w, 4);
}

export { isBossNight };

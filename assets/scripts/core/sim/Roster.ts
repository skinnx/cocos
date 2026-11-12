// SPEC v2 §11.4 roster (ownership, shards, levels, stars, skill picks, gear), §11.5 garrison + dispatch,
// §6.5 tavern recruit, §11.9 modules (via Forge.ts). Owned by core-heroes.
//
// Integration surface (docs/CONTRACT.md): initRoster, rosterCommand, heroStats, garrisonTowerMods, moduleMods, towerMods,
// grantHeroXp, grantKillXp, grantShards, rosterOnDawn, rosterTick, settleDispatches, plus the combat hooks re-exported from Squad.ts.
import type { BuildingState, CharmId, Command, Cost, DispatchKind, GameState, HeroId, HeroRecord, ModuleId, ResKey } from '../api';
import { CHARM_FX, CHARM_RARITY_MUL, MODULES, NO_MODULE, type ModuleFx } from '../data/gear';
import { DISPATCH, DISPATCH_FX, EXP, TAVERN } from '../data/expedition';
import { GARRISON, HEROES, HERO_BAL, HERO_IDS, PF, PICK_BY_ID, PASSIVE_BY_STAR } from '../data/heroes';
import { craftGear, craftModule, salvageGear, setModule } from './Forge';
import { Rng, mixSeed } from './Rng';
import {
  activeHoldLines, refreshHeroUnits, refreshStructureHp, syncSquad,
} from './Squad';
import { type World, type BuildingX, canAfford, capOf, emit, isTower, payCost } from './World';

export {
  heroHitMul, heroAfterHit, heroIncomingDamage, heroOnDown, tauntTarget, structureMods, isRevealed, buildCostMul,
  syncSquad, reviveAllHeroes, updateHeroes, refreshStructureHp,
} from './Squad';
export { craftGear, salvageGear, craftModule, setModule } from './Forge';

// ── records ────────────────────────────────────────────────────────────────────
export function defaultRecord(id: HeroId): HeroRecord {
  return {
    id, owned: false, shards: 0, stars: 1, level: 1, xp: 0, skills: [-1, -1, -1, -1, -1],
    gear: { weapon: 0, armor: 0, charm: 0 }, status: 'rest', garrisonUid: 0, dispatch: null,
  };
}

/** Fill `state.roster` (idempotent; repairs missing records/fields of an older save). Brann is owned and in the squad. */
export function initRoster(state: GameState): void {
  const r = (state.roster ?? {}) as Record<HeroId, HeroRecord>;
  for (const id of HERO_IDS) {
    const d = defaultRecord(id);
    r[id] = r[id] ? { ...d, ...r[id], gear: { ...d.gear, ...(r[id].gear ?? {}) }, skills: r[id].skills?.length === 5 ? r[id].skills : d.skills } : d;
  }
  state.roster = r;
  if (!HERO_IDS.some((id) => r[id].owned)) { r.knight.owned = true; r.knight.status = 'squad'; }
  if (!HERO_IDS.some((id) => r[id].status === 'squad')) {
    const first = HERO_IDS.find((id) => r[id].owned && r[id].status === 'rest');
    if (first) r[first].status = 'squad';
  }
  state.gear ??= [];
  state.modules ??= {};
  state.blueprints ??= [];
  refreshRosterCaps(state);
}

export const pickIndex = (level: number) => HERO_BAL.skillPickLevels.indexOf(level);
export function hasPick(rec: HeroRecord | undefined, id: string): boolean {
  if (!rec) return false;
  const p = PICK_BY_ID[id];
  if (!p || p.hero !== rec.id) return false;
  const i = pickIndex(p.level);
  return rec.level >= p.level && rec.skills[i] === p.option;
}
export function levelCap(rec: HeroRecord): number { return HERO_BAL.capByStar[rec.stars - 1]; }
export function passiveValue(rec: HeroRecord): number { return PASSIVE_BY_STAR[rec.id].values[rec.stars - 1]; }

export function squadIds(state: GameState): HeroId[] { return HERO_IDS.filter((id) => state.roster[id]?.owned && state.roster[id].status === 'squad'); }
export function garrisonedIds(state: GameState): HeroId[] { return HERO_IDS.filter((id) => state.roster[id]?.owned && state.roster[id].status === 'garrison'); }

// ── slots by hearth tier (§11.1/§11.5) ───────────────────────────────────────
export function garrisonSlotsFor(tier: number): number {
  let n = 0;
  for (const [t, s] of HERO_BAL.garrisonSlotsByTier) if (tier >= t) n = s;
  return n;
}
export function squadMaxFor(tier: number): number { return tier >= HERO_BAL.squadMax5Tier ? 5 : HERO_BAL.squadMax; }
export function dispatchSlotsFor(state: GameState): number {
  const lodge = state.buildings.find((b) => b.id === 'scout_lodge' && !b.ruined);
  if (!lodge) return 0;
  return DISPATCH_FX.slotsByLevel[Math.min(3, lodge.level) - 1] + ((state.research?.[2] ?? 0) >= DISPATCH_FX.researchSlotNode ? 1 : 0);
}
/** Recompute garrison/dispatch slots and the squad cap from the hearth tier (keeps a boon-raised squadMax). */
export function refreshRosterCaps(state: GameState): void {
  state.garrisonSlots = garrisonSlotsFor(state.hearthTier ?? 1);
  state.dispatchSlots = dispatchSlotsFor(state);
  state.squadMax = Math.max(state.squadMax ?? 0, squadMaxFor(state.hearthTier ?? 1));
}

// ── stats (§11.4) ─────────────────────────────────────────────────────────────
export interface HeroStats {
  level: number; stars: number;
  hpMul: number; dmgMul: number; rateMul: number; rangeAdd: number; critAdd: number; critMul: number; cdMul: number;
  reduce: number; leech: number; squadSpeed: number; onHit: Array<'burn' | 'slow' | 'bleed'>;
  charm: CharmId | null; charmMul: number; passive: number; picks: string[];
}

export function heroStats(state: GameState, id: HeroId): HeroStats {
  const rec = state.roster[id] ?? defaultRecord(id);
  const def = HEROES[id];
  const lvMul = 1 + HERO_BAL.levelMul * (rec.level - 1);
  const st: HeroStats = {
    level: rec.level, stars: rec.stars, hpMul: lvMul, dmgMul: lvMul, rateMul: 1, rangeAdd: 0, critAdd: 0, critMul: 0, cdMul: 1,
    reduce: 0, leech: 0, squadSpeed: 0, onHit: [], charm: null, charmMul: 1, passive: passiveValue(rec), picks: [],
  };
  for (let i = 0; i < 5; i++) {
    const lv = HERO_BAL.skillPickLevels[i];
    if (rec.skills[i] >= 0 && rec.level >= lv) {
      const p = Object.values(PICK_BY_ID).find((q) => q.hero === id && q.level === lv && q.option === rec.skills[i]);
      if (p) st.picks.push(p.id);
    }
  }
  const has = (p: string) => st.picks.includes(p);
  // gear
  for (const slot of ['weapon', 'armor', 'charm'] as const) {
    const uid = rec.gear[slot];
    if (!uid) continue;
    const it = state.gear.find((g) => g.uid === uid);
    if (!it) continue;
    st.dmgMul *= 1 + it.dmgPct / 100;
    st.hpMul *= 1 + it.hpPct / 100;
    st.reduce = 1 - (1 - st.reduce) * (1 - it.reducePct / 100);
    if (it.onHit) st.onHit.push(it.onHit);
    if (it.charm) { st.charm = it.charm; st.charmMul = CHARM_RARITY_MUL[it.rarity]; }
  }
  const cm = st.charmMul;
  switch (st.charm) {
    case 'owl': if (!def.melee) st.rangeAdd += CHARM_FX.owl.range * cm; break;
    case 'whetstone': st.critAdd += CHARM_FX.whetstone.crit * cm; break;
    case 'hunger': st.leech += CHARM_FX.hunger.leech * cm; break;
    case 'windchime': st.squadSpeed += CHARM_FX.windchime.speed * cm; break;
    case 'fuse': st.cdMul *= 1 - CHARM_FX.fuse.cd * cm; break;
    default: break;
  }
  // stat-type skill picks
  if (has('knight_wall')) { st.hpMul *= PF.knight_wall.hpMul; st.rateMul *= PF.knight_wall.rateMul; }
  if (has('ranger_longbow')) { st.rangeAdd += PF.ranger_longbow.range; st.dmgMul *= PF.ranger_longbow.dmgMul; st.rateMul *= PF.ranger_longbow.rateMul; }
  if (has('pyro_firebolt')) { st.rateMul *= PF.pyro_firebolt.rateMul; st.dmgMul *= PF.pyro_firebolt.dmgMul; }
  if (has('tinker_rapid')) st.cdMul *= PF.tinker_rapid.cdMul;
  if (has('cleric_storm')) { st.rateMul *= PF.cleric_storm.rateMul; st.dmgMul *= PF.cleric_storm.dmgMul; }
  if (has('rogue_precision')) { st.critAdd += PF.rogue_precision.crit; st.critMul = PF.rogue_precision.critMul; }
  if (has('shade_repeater')) { st.rateMul *= PF.shade_repeater.rateMul; st.dmgMul *= PF.shade_repeater.dmgMul; }
  if (has('shade_allseeing')) st.cdMul *= PF.shade_allseeing.cdMul;
  if (has('bomb_shortfuse')) st.cdMul *= PF.bomb_shortfuse.cdMul;
  if (has('bomb_longarm')) st.rangeAdd += PF.bomb_longarm.range;
  return st;
}

// ── XP and levels ─────────────────────────────────────────────────────────────
/** Give XP to one hero (levels up to its star cap; excess held up to one level). */
export function grantHeroXp(w: World | { s: GameState; events?: unknown[] }, id: HeroId, xp: number): void {
  const s = w.s;
  const rec = s.roster[id];
  if (!rec || !rec.owned || !(xp > 0)) return;
  rec.xp += xp;
  let leveled = false;
  const cap = Math.min(HERO_BAL.maxLevel, levelCap(rec));
  while (rec.level < cap && rec.xp >= HERO_BAL.xpToNext(rec.level)) {
    rec.xp -= HERO_BAL.xpToNext(rec.level);
    rec.level++;
    leveled = true;
    if ('rng' in w) emit(w as World, { t: 'levelUp', hero: id });
  }
  if (rec.level >= cap) rec.xp = Math.min(rec.xp, HERO_BAL.xpToNext(rec.level));
  if (leveled && 'rng' in w) refreshHeroUnits(w as World);
}

/** Kill XP: squad heroes on the field share it equally; garrisoned heroes get 50% of a squad share each. */
export function grantKillXp(w: World, xp: number): void {
  const s = w.s;
  const squad = squadIds(s);
  if (!squad.length && !garrisonedIds(s).length) return;
  const share = xp / Math.max(1, squad.length);
  for (const id of squad) grantHeroXp(w, id, share);
  if (!s.expedition) for (const id of garrisonedIds(s)) grantHeroXp(w, id, share * HERO_BAL.garrisonXpShare);
}

// ── shards / unlock ─────────────────────────────────────────────────────────
export function unlockHero(state: GameState, id: HeroId): boolean {
  const rec = state.roster[id];
  if (!rec || rec.owned) return false;
  rec.owned = true; rec.status = 'rest';
  if (squadIds(state).length < state.squadMax) rec.status = 'squad';
  if (!state.unlocked.includes(`hero_${id}`)) state.unlocked.push(`hero_${id}`);
  return true;
}

/** Add shards; an un-owned hero reaching 30 is unlocked (30 shards consumed). Returns true if it unlocked. */
export function grantShards(state: GameState, id: HeroId, n: number): boolean {
  const rec = state.roster[id];
  if (!rec || !(n > 0)) return false;
  rec.shards += Math.floor(n);
  if (!rec.owned && rec.shards >= HERO_BAL.unlockShards) { rec.shards -= HERO_BAL.unlockShards; return unlockHero(state, id); }
  return false;
}

export function grantShardsW(w: World, id: HeroId, n: number): void {
  if (grantShards(w.s, id, n)) { emit(w, { t: 'unlock', what: `hero_${id}` }); syncSquad(w); }
}

export function starUpCost(rec: HeroRecord): { shards: number; essence: number } | null {
  if (rec.stars >= 5) return null;
  return { shards: HERO_BAL.starShards[rec.stars - 1], essence: HERO_BAL.starEssence[rec.stars - 1] };
}

/** A random un-owned hero (cage / tavern), or null when the collection is complete. */
export function randomUnowned(state: GameState, rng: Rng): HeroId | null {
  const pool = HERO_IDS.filter((id) => !state.roster[id].owned);
  return pool.length ? pool[rng.int(0, pool.length - 1)] : null;
}

// ── garrison mods (§11.5) + modules (§11.9) ─────────────────────────────────
export interface TowerMods {
  dmgMul: number; rateMul: number; rangeAdd: number; pierceAdd: number; splashAdd: number; flame: boolean;
  critChance: number; critMul: number; preferMostHp: boolean; preferFlying: boolean; flyingDmgMul: number;
  bleedDps: number; bleedSecs: number; slow: number; slowSecs: number; extraTargets: number; hpMul: number; immuneDisable: boolean; reveal: boolean;
}
export function baseTowerMods(): TowerMods {
  return {
    dmgMul: 1, rateMul: 1, rangeAdd: 0, pierceAdd: 0, splashAdd: 0, flame: false, critChance: 0, critMul: 1, preferMostHp: false,
    preferFlying: false, flyingDmgMul: 1, bleedDps: 0, bleedSecs: 0, slow: 0, slowSecs: 0, extraTargets: 0, hpMul: 1, immuneDisable: false, reveal: false,
  };
}

const bcx = (b: BuildingState) => b.x + b.w / 2, bcy = (b: BuildingState) => b.y + b.h / 2;

/** Garrison effect of the hero on this tower + auras from other garrisoned towers and squad heroes. */
export function garrisonTowerMods(w: World, b: BuildingState): TowerMods {
  const m = baseTowerMods();
  const s = w.s;
  if (!isTower(b.id)) return m;
  const g = b.garrison;
  if (g && s.roster[g]) {
    const rec = s.roster[g];
    m.dmgMul *= 1 + HERO_BAL.garrisonDmgPerLevel * rec.level;
    switch (g) {
      case 'ranger': m.rangeAdd += GARRISON.ranger.range; m.pierceAdd += GARRISON.ranger.pierce; break;
      case 'pyro': m.flame = true; m.splashAdd += GARRISON.pyro.splash; break;
      case 'cleric': m.immuneDisable = true; break;
      case 'rogue': m.critChance = GARRISON.rogue.crit; m.critMul = GARRISON.rogue.critMul; m.preferMostHp = true; break;
      case 'shade': m.reveal = true; break;
      default: break;
    }
  }
  // auras: Orla garrisoned on another tower within 3 tiles (+15%)
  for (const o of s.buildings) {
    if (o === b || o.garrison !== 'warden' || o.ruined || !isTower(o.id)) continue;
    if (Math.hypot(bcx(o) - bcx(b), bcy(o) - bcy(b)) <= GARRISON.warden.range) m.rateMul *= 1 + GARRISON.warden.rate;
  }
  // squad heroes near the tower (Orla passive, picks)
  if (!s.expedition) {
    for (const h of s.heroes) {
      if ((h as { dead?: boolean }).dead) continue;
      const rec = s.roster[h.id];
      const d = Math.hypot(h.x - bcx(b), h.y - bcy(b));
      if (h.id === 'warden') {
        const drill = hasPick(rec, 'warden_drill');
        const R = drill ? PF.warden_drill.range : PASSIVE_RANGE_WARDEN;
        if (d <= R) {
          m.rateMul *= 1 + passiveValue(rec) * (drill ? PF.warden_drill.rateMul : 1);
          if (hasPick(rec, 'warden_spotter')) m.rangeAdd += PF.warden_spotter.range;
        }
      } else if (h.id === 'tinker' && hasPick(rec, 'tinker_overclock') && d <= PF.tinker_overclock.range) {
        m.rateMul *= 1 + PF.tinker_overclock.rate;
      }
    }
    for (const z of activeHoldLines(w)) if (z.volley && Math.hypot(z.x - bcx(b), z.y - bcy(b)) <= z.r) m.rateMul *= 1 + PF.warden_volley.rate;
  }
  return m;
}
const PASSIVE_RANGE_WARDEN = 3;

export function moduleMods(module: ModuleId | null | undefined): ModuleFx {
  return module ? MODULES[module].fx : NO_MODULE;
}

/** garrisonTowerMods merged with the tower's module. */
export function towerMods(w: World, b: BuildingState): TowerMods {
  const m = garrisonTowerMods(w, b);
  if (!b.module || b.level < 3) return m;
  const f = moduleMods(b.module);
  m.dmgMul *= f.dmgMul; m.rateMul *= f.rateMul; m.rangeAdd += f.rangeAdd; m.extraTargets += f.extraTargets;
  m.bleedDps = Math.max(m.bleedDps, f.bleedDps); m.bleedSecs = Math.max(m.bleedSecs, f.bleedSecs);
  m.slow = Math.max(m.slow, f.slow); m.slowSecs = Math.max(m.slowSecs, f.slowSecs);
  m.splashAdd += f.splashAdd; m.flame = m.flame || f.flame; m.preferFlying = m.preferFlying || f.preferFlying;
  m.flyingDmgMul *= f.flyingDmgMul; m.hpMul *= f.hpMul;
  return m;
}

// ── dispatch (§11.5) ────────────────────────────────────────────────────────
export type DispatchRow = { hero: HeroId; kind: DispatchKind; loot: Cost; shards: Partial<Record<HeroId, number>> };

export function dispatchLoot(state: GameState, id: HeroId, d: NonNullable<HeroRecord['dispatch']>): DispatchRow {
  const rec = state.roster[id];
  const fi = DISPATCH_FX.durationsMin.indexOf(d.minutes);
  const mul = (d.minutes / 60) * DISPATCH_FX.perHourFalloff[Math.max(0, fi)] * (1 + DISPATCH_FX.levelMul * (rec.level - 1));
  const rng = new Rng(mixSeed(mixSeed(state.seed, Math.floor(d.endsAt / 1000)), HERO_IDS.indexOf(id) + 1));
  const loot: Cost = {};
  const shards: Partial<Record<HeroId, number>> = {};
  if (d.kind === 'forage') {
    for (const [k, v] of Object.entries(DISPATCH_FX.forage)) loot[k as ResKey] = Math.round(v * mul);
  } else if (d.kind === 'hunt') {
    loot.essence = Math.round(DISPATCH_FX.hunt.essence * mul);
    loot.gold = Math.round(DISPATCH_FX.hunt.gold * mul);
    if (rng.chance(DISPATCH_FX.hunt.shardChance[d.minutes] ?? 0)) {
      const weights = HERO_IDS.map((h) => (state.roster[h].owned ? 1 : 2));
      const who = HERO_IDS[rng.weighted(weights)];
      shards[who] = rng.int(DISPATCH_FX.hunt.shards[0], DISPATCH_FX.hunt.shards[1]);
    }
  } else {
    loot.lore = DISPATCH_FX.scout.lore[d.minutes] ?? 1;
  }
  return { hero: id, kind: d.kind, loot, shards };
}

/** Apply finished dispatches (endsAt ≤ now). Pure on state; returns the rows for the away summary / toast. */
export function settleDispatches(state: GameState, now: number): DispatchRow[] {
  const out: DispatchRow[] = [];
  if (!Number.isFinite(now)) return out;
  for (const id of HERO_IDS) {
    const rec = state.roster?.[id];
    const d = rec?.dispatch;
    if (!rec || !d) continue;
    const dur = d.minutes * 60000;
    if (now < d.endsAt - dur) d.endsAt = now + dur;     // clock set back before the start: never longer than its duration
    if (now < d.endsAt) continue;
    const row = dispatchLoot(state, id, d);
    for (const k in row.loot) {
      const key = k as ResKey;
      const v = row.loot[key] ?? 0;
      const add = Math.max(0, Math.min(v, capOf(state, key) - state.res[key]));
      state.res[key] += add;
      row.loot[key] = add;
    }
    for (const h in row.shards) grantShards(state, h as HeroId, row.shards[h as HeroId] ?? 0);
    if (d.kind === 'scout') {
      state.trails = Math.min(EXP.trailsMax, state.trails + DISPATCH_FX.scout.trails);
      state.scoutedUntil = Math.max(state.scoutedUntil ?? 0, state.night + DISPATCH_FX.scout.omenNights);
    }
    rec.dispatch = null;
    rec.status = 'rest';
    out.push(row);
  }
  return out;
}

/** Called ~1/s by Game.tick(now): completes dispatches in real time. */
export function rosterTick(state: GameState, now: number): DispatchRow[] { return settleDispatches(state, now); }

// ── dawn ────────────────────────────────────────────────────────────────────
export function rosterOnDawn(w: World): void {
  const s = w.s;
  refreshRosterCaps(s);
  const hrt = heroRunOf(w);
  hrt.phoenixUsed = []; hrt.resurrectUsed = false;
  // tavern (§6.5): one visitor per dawn
  const tavern = s.buildings.some((b) => b.id === 'tavern' && !b.ruined);
  if (!tavern) { s.tavernOffer = null; return; }
  const un = randomUnowned(s, w.rng);
  if (un) s.tavernOffer = { hero: un, cost: { gold: TAVERN.recruitGold + TAVERN.recruitGoldPerOwned * HERO_IDS.filter((id) => s.roster[id].owned).length } };
  else s.tavernOffer = { hero: HERO_IDS[w.rng.int(0, HERO_IDS.length - 1)], cost: { gold: TAVERN.packGold } };
}

/** Per-hold hero runtime (saved with the hold data). */
export interface HeroRun { phoenixUsed: HeroId[]; resurrectUsed: boolean; nextFx: number }
export function heroRunOf(w: World): HeroRun {
  const r = w.r as unknown as { heroRun?: HeroRun };
  r.heroRun ??= { phoenixUsed: [], resurrectUsed: false, nextFx: 0 };
  return r.heroRun;
}

// ── commands ────────────────────────────────────────────────────────────────
const canManage = (s: GameState) => !s.expedition && (s.phase === 'peace' || s.phase === 'dusk' || s.phase === 'dawn');

function leaveAssignment(w: World, rec: HeroRecord): void {
  if (rec.status === 'garrison') {
    const b = w.s.buildings.find((x) => x.uid === rec.garrisonUid);
    if (b && b.garrison === rec.id) b.garrison = null;
    rec.garrisonUid = 0;
  }
  rec.status = 'rest';
}

export function rosterCommand(w: World, c: Command): boolean {
  const s = w.s;
  switch (c.t) {
    case 'setSquad': {
      if (!canManage(s)) return true;
      const ids = [...new Set(c.heroes)].filter((id) => s.roster[id]?.owned && s.roster[id].status !== 'dispatch');
      if (!ids.length || ids.length > s.squadMax) return true;
      for (const id of HERO_IDS) { const rec = s.roster[id]; if (rec.status === 'squad' && !ids.includes(id)) rec.status = 'rest'; }
      for (const id of ids) { const rec = s.roster[id]; if (rec.status !== 'squad') { leaveAssignment(w, rec); rec.status = 'squad'; } }
      syncSquad(w, ids);
      refreshStructureHp(w);
      return true;
    }
    case 'garrison': {
      if (!canManage(s) || s.phase === 'dawn') return true;
      const rec = s.roster[c.hero];
      if (!rec?.owned || rec.status === 'dispatch') return true;
      if (c.uid === 0) {
        if (rec.status === 'garrison') { leaveAssignment(w, rec); refreshStructureHp(w); }
        return true;
      }
      const b = s.buildings.find((x) => x.uid === c.uid) as BuildingX | undefined;
      if (!b || !isTower(b.id) || b.level < 2 || b.ruined || s.garrisonSlots <= 0) return true;
      if (rec.status === 'squad' && squadIds(s).length <= 1) return true; // keep a leader
      const used = garrisonedIds(s).filter((id) => id !== c.hero && s.roster[id].garrisonUid !== c.uid).length;
      if (used >= s.garrisonSlots) return true;
      if (b.garrison && b.garrison !== c.hero) leaveAssignment(w, s.roster[b.garrison]);
      leaveAssignment(w, rec);
      rec.status = 'garrison'; rec.garrisonUid = b.uid; b.garrison = c.hero;
      syncSquad(w);
      refreshStructureHp(w);
      return true;
    }
    case 'dispatch': {
      if (!canManage(s)) return true;
      const rec = s.roster[c.hero];
      const kind = DISPATCH[c.kind];
      if (!rec?.owned || rec.status === 'dispatch' || !kind || !kind.minutes.includes(c.minutes)) return true;
      s.dispatchSlots = dispatchSlotsFor(s);
      const busy = HERO_IDS.filter((id) => s.roster[id].status === 'dispatch').length;
      if (busy >= s.dispatchSlots) return true;
      if (rec.status === 'squad' && squadIds(s).length <= 1) return true;
      leaveAssignment(w, rec);
      rec.status = 'dispatch';
      rec.dispatch = { kind: c.kind, minutes: c.minutes, endsAt: (s.clock?.lastNow ?? 0) + c.minutes * 60000 };
      syncSquad(w);
      refreshStructureHp(w);
      return true;
    }
    case 'starUp': {
      if (s.expedition) return true;
      const rec = s.roster[c.hero];
      if (!rec?.owned) return true;
      const cost = starUpCost(rec);
      if (!cost || rec.shards < cost.shards || s.res.essence < cost.essence) return true;
      rec.shards -= cost.shards; s.res.essence -= cost.essence;
      rec.stars = (rec.stars + 1) as HeroRecord['stars'];
      grantHeroXp(w, c.hero, 0.0001); // spend held XP on the raised cap
      refreshHeroUnits(w);
      emit(w, { t: 'unlock', what: `hero_${c.hero}` });
      return true;
    }
    case 'pickSkill': {
      if (s.expedition || s.phase === 'night') return true;
      const rec = s.roster[c.hero];
      const i = pickIndex(c.level);
      if (!rec?.owned || i < 0 || rec.level < c.level || (c.option !== 0 && c.option !== 1)) return true;
      if (rec.skills[i] === c.option) return true;
      if (rec.skills[i] !== -1) {
        const price: Cost = { gold: HERO_BAL.respecGoldPerLevel * rec.level };
        if (!canAfford(s.res, price)) return true;
        payCost(w, price);
      }
      rec.skills[i] = c.option;
      refreshHeroUnits(w);
      return true;
    }
    case 'equip': {
      if (s.expedition || s.phase === 'night') return true;
      const rec = s.roster[c.hero];
      if (!rec?.owned) return true;
      if (c.item === 0) {
        const it = s.gear.find((g) => g.uid === rec.gear[c.slot]);
        if (it) it.equippedBy = null;
        rec.gear[c.slot] = 0;
      } else {
        const it = s.gear.find((g) => g.uid === c.item);
        if (!it || it.slot !== c.slot) return true;
        if (it.equippedBy && it.equippedBy !== c.hero) s.roster[it.equippedBy].gear[c.slot] = 0;
        const old = s.gear.find((g) => g.uid === rec.gear[c.slot]);
        if (old) old.equippedBy = null;
        rec.gear[c.slot] = it.uid; it.equippedBy = c.hero;
      }
      refreshHeroUnits(w);
      return true;
    }
    case 'craft': craftGear(w, c.slot, c.rarity, c.charm); return true;
    case 'salvage': salvageGear(w, c.item); return true;
    case 'craftModule': craftModule(w, c.module); return true;
    case 'setModule': setModule(w, c.uid, c.module); return true;
    case 'recruit': {
      const off = s.tavernOffer;
      if (!off || s.expedition || !canAfford(s.res, off.cost)) return true;
      payCost(w, off.cost);
      if (!s.roster[off.hero].owned) { unlockHero(s, off.hero); emit(w, { t: 'unlock', what: `hero_${off.hero}` }); syncSquad(w); }
      else grantShardsW(w, off.hero, TAVERN.packShards);
      s.tavernOffer = null;
      return true;
    }
    default: return false;
  }
}

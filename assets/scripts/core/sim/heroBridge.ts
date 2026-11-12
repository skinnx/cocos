// Bridge to the core-heroes integration surface (docs/CONTRACT.md + DECISIONS "INTEGRATION HOOKS").
// TEMPORARY local fallback with the same function names, used only until core/sim/Roster.ts and
// core/sim/expedition/index.ts exist; then this file re-exports those modules instead.
import type { BuildingId, Command, GameState, HeroId, HeroRecord, ModuleId, AwaySummary } from '../api';
import { HERO_IDS, HEROES } from '../data/heroes';
import { BALANCE } from '../data/balance';
import { CENTER } from './MapGen';
import { createHero, reviveHero, updateHeroes as v1UpdateHeroes } from './Squad';
import { type World, type HeroX, type BuildingX, type EnemyX, emit } from './World';

const V1: HeroId[] = ['knight', 'ranger', 'pyro', 'tinker', 'cleric', 'rogue'];

export function initRoster(s: GameState): void {
  const r = {} as Record<HeroId, HeroRecord>;
  for (const id of HERO_IDS) {
    r[id] = { id, owned: id === 'knight', shards: 0, stars: 1, level: 1, xp: 0, skills: [-1, -1, -1, -1, -1], gear: { weapon: 0, armor: 0, charm: 0 }, status: id === 'knight' ? 'squad' : 'rest', garrisonUid: 0, dispatch: null };
  }
  s.roster = r;
}

export function syncSquad(w: World): void {
  const s = w.s;
  const keep = new Map((s.heroes as HeroX[]).map((h) => [h.id, h]));
  const ids = HERO_IDS.filter((id) => s.roster[id]?.owned && s.roster[id].status === 'squad' && V1.includes(id) && HEROES[id]).slice(0, s.squadMax);
  const out: HeroX[] = [];
  ids.forEach((id, k) => {
    const h = keep.get(id) ?? createHero(w, id, CENTER + (k % 2 ? 0.8 : -0.8) * Math.ceil(k / 2), CENTER + 2.2, s.roster[id].level);
    out.push(h);
  });
  s.heroes = out;
  if (out.length && !out.some((h) => h.leader)) out[0].leader = true;
}

export function reviveAllHeroes(w: World): void {
  for (const h of w.s.heroes as HeroX[]) { if (h.dead) reviveHero(w, h); h.hp = h.maxHp; }
}

export function rosterCommand(w: World, c: Command): boolean {
  const s = w.s;
  switch (c.t) {
    case 'setSquad': {
      for (const id of HERO_IDS) if (s.roster[id].status === 'squad') s.roster[id].status = 'rest';
      for (const id of c.heroes.slice(0, s.squadMax)) if (s.roster[id]?.owned) s.roster[id].status = 'squad';
      syncSquad(w);
      return true;
    }
    case 'garrison': {
      const rec = s.roster[c.hero];
      if (!rec?.owned) return true;
      for (const b of s.buildings) if (b.garrison === c.hero) b.garrison = null;
      if (c.uid) { const b = w.bmap.get(c.uid); if (b && !b.dead) { b.garrison = c.hero; rec.status = 'garrison'; rec.garrisonUid = b.uid; } }
      else { rec.status = 'rest'; rec.garrisonUid = 0; }
      syncSquad(w);
      return true;
    }
    case 'dispatch': case 'starUp': case 'pickSkill': case 'equip': case 'craft': case 'salvage': case 'setModule': case 'craftModule': case 'recruit':
      return true;
  }
  return false;
}

export function heroStats(s: GameState, id: HeroId) { void s; void id; return { hpMul: 1, dmgMul: 1, rateMul: 1, rangeAdd: 0, critAdd: 0 }; }
export function garrisonTowerMods(w: World, b: BuildingX) { const lv = b.garrison ? w.s.roster[b.garrison].level : 0; return { dmgMul: 1 + BALANCE.hero.garrisonDmgPerLevel * lv, rateMul: 1, rangeAdd: 0, pierceAdd: 0 }; }
export function moduleMods(m: ModuleId | null) { void m; return { dmgMul: 1, rateMul: 1, rangeAdd: 0, pierceAdd: 0 }; }
export function towerMods(w: World, b: BuildingX) { const g = garrisonTowerMods(w, b); return { ...g, immuneDisable: false, splashAdd: 0, flame: false, critChance: 0, critMul: 1, targetMostHp: false, slowAdd: 0, flyingMul: 1, extraTargets: 0, hpMul: 1 }; }
export function structureMods(w: World, b: BuildingX) { void w; void b; return { dmgTakenMul: 1, hpMul: 1 }; }
export function buildCostMul(w: World): number { void w; return 1; }

export function grantHeroXp(w: World, id: HeroId, xp: number): void {
  const rec = w.s.roster[id]; if (!rec) return;
  rec.xp += xp;
  const need = (L: number) => Math.round(12 + 8 * Math.pow(L, 1.5));
  const cap = BALANCE.hero.capByStar[rec.stars - 1];
  while (rec.level < cap && rec.xp >= need(rec.level)) { rec.xp -= need(rec.level); rec.level++; emit(w, { t: 'levelUp', hero: id }); }
}
export function grantKillXp(w: World, xp: number): void {
  const hs = (w.s.heroes as HeroX[]).filter((h) => !h.dead);
  for (const h of hs) grantHeroXp(w, h.id, xp / Math.max(1, hs.length));
}
export function grantShards(s: GameState, id: HeroId, n: number): void {
  const rec = s.roster[id]; if (!rec) return;
  rec.shards += n;
  if (!rec.owned && rec.shards >= BALANCE.hero.unlockShards) { rec.owned = true; rec.shards -= BALANCE.hero.unlockShards; }
}
export function rosterOnDawn(w: World): void { void w; }
export function rosterTick(s: GameState, now: number): void { void s; void now; }
export function settleDispatches(s: GameState, now: number): AwaySummary['dispatches'] { void s; void now; return []; }
export function withHoldState<T>(w: World, fn: () => T): T { void w; return fn(); }

export function heroHitMul(w: World, h: HeroX, e: EnemyX, dtype: string): number { void w; void h; void e; void dtype; return 1; }
export function heroAfterHit(w: World, h: HeroX, e: EnemyX, dealt: number, dtype: string): void { void w; void h; void e; void dealt; void dtype; }
export function heroIncomingDamage(w: World, h: HeroX, amt: number, attacker: EnemyX | null): number { void w; void h; void attacker; return amt; }
export function heroOnDown(w: World, h: HeroX): boolean { void w; void h; return false; }
export function tauntTarget(w: World, e: EnemyX): { kind: 'hero' | 'ally' | 'building'; uid: number } | null { void w; void e; return null; }
export function isRevealed(w: World, e: EnemyX): boolean { void w; void e; return false; }

export function updateHeroes(w: World, dt: number): void { v1UpdateHeroes(w, dt); }

// expedition (core-heroes): fallback does nothing — the hold never enters an expedition without the real module
export function startExpedition(w: World, c: Command): boolean { void w; void c; return false; }
export function stepExpedition(w: World): void { void w; }
export function expeditionCommand(w: World, c: Command): boolean { void w; void c; return false; }
export function rollIslands(seed: number, dayKey: number, regionsOpen: number): GameState['islands'] {
  void seed; void dayKey; void regionsOpen; return [];
}
export type { BuildingId };

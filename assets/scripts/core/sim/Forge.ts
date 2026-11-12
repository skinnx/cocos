// SPEC v2 §11.9 forge: crafting/salvaging gear, crafting and fitting tower modules. Owned by core-heroes.
import type { CharmId, Cost, GameState, GearItem, GearSlot, ModuleId, Rarity, ResKey } from '../api';
import {
  CHARM_IDS, FORGE, FORGE_COST, GEAR_ROLLS, MODULE_COST, MODULE_IDS, MODULE_MIN_TIER, MODULE_TOWER_LEVEL, REGIONAL,
} from '../data/gear';
import { refreshHeroUnits } from './Squad';
import type { Rng } from './Rng';
import { type World, canAfford, emit, isTower, payCost } from './World';

export function forgeBuilding(s: GameState) { return s.buildings.find((b) => b.id === 'forge' && !b.ruined) ?? null; }

/** Forge price after the worker discount (10%/worker, max 30%). Regional material is returned separately. */
export function craftPrice(s: GameState, rarity: Rarity): { cost: Cost; regional: number; blueprint: boolean } {
  const f = FORGE_COST[rarity];
  const workers = forgeBuilding(s)?.workers ?? 0;
  const m = 1 - Math.min(FORGE.maxWorkerDiscount, FORGE.workerDiscount * workers);
  const cost: Cost = {};
  for (const k in f.cost) cost[k as ResKey] = Math.ceil((f.cost[k as ResKey] ?? 0) * m - 1e-9);
  return { cost, regional: Math.ceil(f.regional * m - 1e-9), blueprint: f.blueprint };
}

function regionalHave(s: GameState): number { return REGIONAL.reduce((a, k) => a + s.res[k], 0); }
function payRegional(s: GameState, n: number): void {
  for (const k of REGIONAL) { const t = Math.min(n, s.res[k]); s.res[k] -= t; n -= t; if (n <= 0) break; }
}

const ri = (rng: Rng, [a, b]: readonly number[]) => rng.int(a, b);

export function nextGearUid(s: GameState): number { return s.gear.reduce((m, g) => Math.max(m, g.uid), 0) + 1; }

/** Roll a gear item (also used by expedition/boss drops). */
export function rollGear(s: GameState, rng: Rng, slot: GearSlot, rarity: Rarity, charm?: CharmId): GearItem {
  const it: GearItem = { uid: nextGearUid(s), slot, rarity, dmgPct: 0, hpPct: 0, reducePct: 0, equippedBy: null };
  if (slot === 'weapon') {
    it.dmgPct = ri(rng, GEAR_ROLLS.weapon.dmgPct[rarity]);
    if (rng.chance(GEAR_ROLLS.weapon.onHitChance[rarity])) it.onHit = (['burn', 'slow', 'bleed'] as const)[rng.int(0, 2)];
  } else if (slot === 'armor') {
    it.hpPct = ri(rng, GEAR_ROLLS.armor.hpPct[rarity]);
    it.reducePct = ri(rng, GEAR_ROLLS.armor.reducePct[rarity]);
  } else {
    it.charm = charm ?? CHARM_IDS[rng.int(0, CHARM_IDS.length - 1)];
  }
  return it;
}

export function craftGear(w: World, slot: GearSlot, rarity: Rarity, charm?: CharmId): GearItem | null {
  const s = w.s;
  if (s.expedition || s.phase === 'night' || !forgeBuilding(s)) return null;
  if (!FORGE_COST[rarity] || !['weapon', 'armor', 'charm'].includes(slot)) return null;
  const p = craftPrice(s, rarity);
  if (!canAfford(s.res, p.cost) || regionalHave(s) < p.regional) return null;
  // charm choice needs its blueprint; epic needs a blueprint (any for weapon/armor; the charm's own for a charm)
  let ch: CharmId | undefined;
  if (slot === 'charm') {
    if (charm && !s.blueprints.includes(charm)) return null;
    if (rarity === 'epic' && !charm) return null;
    ch = charm;
  } else if (p.blueprint && !s.blueprints.length) return null;
  payCost(w, p.cost);
  payRegional(s, p.regional);
  const it = rollGear(s, w.rng, slot, rarity, ch);
  s.gear.push(it);
  return it;
}

/** Salvage: refund 50% of the material cost (base price), item must not be in use (it is unequipped first). */
export function salvageGear(w: World, uid: number): boolean {
  const s = w.s;
  if (s.expedition || s.phase === 'night') return false;
  const i = s.gear.findIndex((g) => g.uid === uid);
  if (i < 0) return false;
  const it = s.gear[i];
  if (it.equippedBy) { s.roster[it.equippedBy].gear[it.slot] = 0; }
  s.gear.splice(i, 1);
  const f = FORGE_COST[it.rarity];
  for (const k in f.cost) s.res[k as ResKey] += Math.floor((f.cost[k as ResKey] ?? 0) * FORGE.salvageRefund);
  s.res[REGIONAL[0]] += Math.floor(f.regional * FORGE.salvageRefund);
  refreshHeroUnits(w);
  return true;
}

export function craftModule(w: World, m: ModuleId): boolean {
  const s = w.s;
  if (s.expedition || s.phase === 'night' || !MODULE_IDS.includes(m)) return false;
  if ((s.hearthTier ?? 1) < MODULE_MIN_TIER || !forgeBuilding(s) || !canAfford(s.res, MODULE_COST)) return false;
  payCost(w, MODULE_COST);
  s.modules[m] = (s.modules[m] ?? 0) + 1;
  return true;
}

/** Fit / remove a module on a level-3 tower (free, PEACE only). `state.modules` counts the spare (unfitted) ones. */
export function setModule(w: World, uid: number, m: ModuleId | null): boolean {
  const s = w.s;
  if (s.expedition || s.phase !== 'peace') return false;
  const b = s.buildings.find((x) => x.uid === uid);
  if (!b || !isTower(b.id) || b.ruined || b.level < MODULE_TOWER_LEVEL) return false;
  if (m && !((s.modules[m] ?? 0) > 0)) return false;
  if (b.module) s.modules[b.module] = (s.modules[b.module] ?? 0) + 1;
  b.module = null;
  if (m) { s.modules[m] = (s.modules[m] ?? 0) - 1; b.module = m; }
  return true;
}

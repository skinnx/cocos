// View-side catalogue helpers on top of core data tables (no 'cc').
import type { BuildingId, HeroId, MetaState } from '../../core/api';
import { BUILDINGS, type BuildTab } from '../../core/data/buildings';
import { HERO_IDS } from '../../core/data/heroes';
import { TALENTS, type TalentId } from '../../core/data/talents';
import {
  blueprintCost, buyBlueprint, buyTalent as coreBuyTalent, heroUnlockCost, setStarterHero, talentCost, unlockHero,
} from '../../core/sim/Meta';

export const TABS: BuildTab[] = ['defense', 'light', 'traps', 'economy'];

/** Placeable buildings per drawer tab, in display order (hearth is upgraded via the radial menu, not placed). */
export function tabItems(tab: BuildTab): BuildingId[] {
  return (Object.keys(BUILDINGS) as BuildingId[]).filter((id) => id !== 'hearth' && BUILDINGS[id].tab === tab);
}

export function footprint(id: BuildingId): { w: number; h: number } {
  const d = BUILDINGS[id];
  return { w: d.w, h: d.h };
}

export function isPaintable(id: BuildingId): boolean { return BUILDINGS[id].paintable; }

export function isLocked(id: BuildingId, meta: MetaState): boolean {
  const d = BUILDINGS[id];
  return d.should && !meta.unlockedBlueprints.includes(id);
}

/** Range rings (tiles) to show for a building at a level: outer ring + optional inner (mortar min range). */
export function rangeRings(id: BuildingId, level: 1 | 2 | 3): number[] {
  const d = BUILDINGS[id];
  const out: number[] = [];
  if (d.range) out.push(d.range[level - 1]);
  else if (d.light && id === 'brazier') out.push(d.light[level - 1]);
  else if (id === 'lumber_camp' || id === 'quarry') out.push(3);
  else if (id === 'barracks') out.push(5);
  if (d.minRange) out.push(d.minRange);
  return out;
}

export function isTowerId(id: BuildingId): boolean {
  return id === 'tower_arrow' || id === 'tower_ballista' || id === 'tower_frost' || id === 'tower_mortar' || id === 'tower_spark';
}

/** Preview sprite (level 1, first frame) for a drawer card / ghost. */
export function previewSprite(id: BuildingId): string {
  switch (id) {
    case 'hearth': return 'bld_hearth_l1_0';
    case 'wall_wood': return 'bld_wall_wood_10';
    case 'wall_stone': return 'bld_wall_stone_10';
    case 'gate': return 'bld_gate_h_closed';
    case 'brazier': return 'bld_brazier_l1_0';
    case 'tower_ballista': return 'bld_tower_ballista_l1_base';
    case 'tower_frost': case 'tower_spark': return `bld_${id}_l1_0`;
    case 'trap_spikes': return 'bld_trap_spikes_l1_up';
    case 'trap_tar': return 'bld_trap_tar';
    case 'tavern': return 'bld_tavern_l1';
    default: return `bld_${id}_l1`;
  }
}

export function maxLevel(id: BuildingId): number { return BUILDINGS[id].maxLevel; }
export function upgradesInto(id: BuildingId): BuildingId | undefined { return BUILDINGS[id].upgradeTo; }

export const HERO_LIST: HeroId[] = HERO_IDS;
export const BLUEPRINTS: BuildingId[] = (Object.keys(BUILDINGS) as BuildingId[]).filter((id) => BUILDINGS[id].should);
export const TALENT_LIST = TALENTS;
export { heroUnlockCost, blueprintCost, buyBlueprint };

/** Meta purchases (Barracks) delegate to core/sim/Meta (mutate meta in place; true when it happened). */
export function buyHero(meta: MetaState, id: HeroId): boolean { return unlockHero(meta, id); }
export function talentNextCost(meta: MetaState, id: string): number | null {
  return TALENTS.some((t) => t.id === id) ? talentCost(meta, id as TalentId) : null;
}
export function buyTalent(meta: MetaState, id: string): boolean {
  return TALENTS.some((t) => t.id === id) ? coreBuyTalent(meta, id as TalentId) : false;
}
export { setStarterHero };

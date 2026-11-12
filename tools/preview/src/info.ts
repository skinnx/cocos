// Preview-side presentation metadata (names, drawer tabs, sprite naming). Gameplay numbers (cost, range,
// footprint) are always read from the core (game.buildingCost / core data); the values here are only the
// SPEC §6.3 defaults used if a field is absent from the core tables.
import type { BuildingId, EnemyId, HeroId } from './core';

export interface BInfo { name: string; tab: 0 | 1 | 2 | 3; w: number; h: number; range?: number; minRange?: number; paint?: boolean; aura?: number; light?: number }
export const BINFO: Record<BuildingId, BInfo> = {
  hearth: { name: 'Hearth', tab: 1, w: 2, h: 2, light: 7, range: 4 },
  wall_wood: { name: 'Wood Wall', tab: 0, w: 1, h: 1, paint: true },
  wall_stone: { name: 'Stone Wall', tab: 0, w: 1, h: 1, paint: true },
  gate: { name: 'Gate', tab: 0, w: 1, h: 1 },
  brazier: { name: 'Brazier', tab: 1, w: 1, h: 1, light: 4 },
  tower_arrow: { name: 'Arrow Tower', tab: 0, w: 1, h: 1, range: 5 },
  tower_ballista: { name: 'Ballista', tab: 0, w: 2, h: 2, range: 8 },
  tower_frost: { name: 'Frost Tower', tab: 0, w: 1, h: 1, aura: 3 },
  tower_mortar: { name: 'Mortar', tab: 0, w: 2, h: 2, range: 9, minRange: 4 },
  trap_spikes: { name: 'Spikes', tab: 2, w: 1, h: 1, paint: true },
  trap_tar: { name: 'Tar Pit', tab: 2, w: 1, h: 1, paint: true },
  lumber_camp: { name: 'Lumber Camp', tab: 3, w: 2, h: 2, aura: 3 },
  quarry: { name: 'Quarry', tab: 3, w: 2, h: 2, aura: 3 },
  tower_spark: { name: 'Spark Tower', tab: 0, w: 1, h: 1, range: 4.5 },
  barracks: { name: 'Barracks', tab: 3, w: 2, h: 2, aura: 5 },
  workshop: { name: 'Workshop', tab: 3, w: 2, h: 2, aura: 5 },
  tavern: { name: 'Tavern', tab: 3, w: 2, h: 2 },
};
export const TABS = ['DEFENSE', 'LIGHT', 'TRAPS', 'ECONOMY'];
export const TAB_ICONS = ['icon_shield', 'icon_fire', 'icon_skull', 'icon_wood'];
export const BUILD_ORDER: BuildingId[] = ['wall_wood', 'wall_stone', 'gate', 'tower_arrow', 'tower_ballista', 'tower_frost', 'tower_mortar', 'tower_spark',
  'brazier', 'trap_spikes', 'trap_tar', 'lumber_camp', 'quarry', 'barracks', 'workshop', 'tavern'];

export const HERO_NAME: Record<HeroId, string> = { knight: 'Brann', ranger: 'Wren', pyro: 'Ilka', tinker: 'Tobi', cleric: 'Mira', rogue: 'Vex' };
export const HERO_ROLE: Record<HeroId, string> = { knight: 'Guardian', ranger: 'Archer', pyro: 'Fire mage', tinker: 'Engineer', cleric: 'Healer', rogue: 'Assassin' };
export const ENEMY_NAME: Record<EnemyId, string> = { gloomling: 'Gloomling', skitter: 'Skitter', spitter: 'Spitter', brute: 'Brute', wisp: 'Wisp', bomber: 'Bomber', snuffer: 'Snuffer', mossback: 'Mossback', unlit: 'The Unlit', militia: 'Militia' };

/** Static sprite (frame 0) used for drawer cards / ghosts. */
export function buildingIcon(id: BuildingId, level = 1): string {
  switch (id) {
    case 'hearth': return `bld_hearth_l${level}_0`;
    case 'wall_wood': return 'bld_wall_wood_0';
    case 'wall_stone': return 'bld_wall_stone_0';
    case 'gate': return 'bld_gate_h_closed';
    case 'brazier': return `bld_brazier_l${Math.min(2, level)}_0`;
    case 'tower_ballista': return `bld_tower_ballista_l${level}_base`;
    case 'tower_frost': return `bld_tower_frost_l${level}_0`;
    case 'tower_spark': return `bld_tower_spark_l${level}_0`;
    case 'trap_spikes': return `bld_trap_spikes_l${Math.min(2, level)}_up`;
    case 'trap_tar': return 'bld_trap_tar';
    case 'tavern': return 'bld_tavern_l1';
    default: return `bld_${id}_l${level}`;
  }
}

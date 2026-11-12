// Preview-side presentation helpers. Gameplay numbers always come from the core (data tables / Game API).
import type { BuildingId } from './core';

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

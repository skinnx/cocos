// SPEC §6.3 building catalogue (MUST + SHOULD rows).
import type { BuildingId, DamageType, Resources } from '../api';

export type BuildTab = 'defense' | 'light' | 'traps' | 'economy';

export interface BuildingDef {
  id: BuildingId;
  w: number; h: number;
  cost: Resources;                 // level-1 cost
  upgradeCost?: [Resources | null, Resources | null]; // explicit L2 / L3 cost (otherwise base × upgradeCostMul)
  maxLevel: 1 | 2 | 3;
  upgradeTo?: BuildingId;          // wall_wood → wall_stone (replaces building)
  hp: [number, number, number];
  blocks: boolean;                 // obstacle (path cost) — traps are false
  paintable: boolean;              // 1×1 drag-paint
  stone: boolean;                  // repaired with stone instead of wood
  tab: BuildTab;
  should: boolean;                 // SHOULD content: requires a blueprint unlock (meta)
  blueprintCost: number;
  wallLike: boolean;               // auto-tile family (walls + gates)
  // combat stats (towers)
  range?: [number, number, number];
  minRange?: number;
  dmg?: number;
  rate?: number;                   // shots / s
  dtype?: DamageType;
  hitsFlying?: boolean;
  pierce?: [number, number, number];
  splash?: [number, number, number];
  chain?: [number, number, number];
  slow?: [number, number, number];
  light?: [number, number, number];
  produce?: [number, number, number]; // seconds per resource
  militia?: [number, number, number];
  repairHps?: [number, number, number];
  charges?: [number, number, number];
}

const R = (wood: number, stone: number, gold: number): Resources => ({ wood, stone, gold });

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  hearth: { id: 'hearth', w: 2, h: 2, cost: R(0, 0, 0), upgradeCost: [R(30, 40, 60), R(60, 90, 150)], maxLevel: 3, hp: [500, 800, 1200], blocks: true, paintable: false, stone: true, tab: 'light', should: false, blueprintCost: 0, wallLike: false,
    range: [4, 4, 4], dmg: 5, rate: 1, dtype: 'fire', hitsFlying: true, light: [7, 9, 11] },
  wall_wood: { id: 'wall_wood', w: 1, h: 1, cost: R(4, 0, 0), maxLevel: 1, upgradeTo: 'wall_stone', hp: [60, 60, 60], blocks: true, paintable: true, stone: false, tab: 'defense', should: false, blueprintCost: 0, wallLike: true },
  wall_stone: { id: 'wall_stone', w: 1, h: 1, cost: R(0, 6, 0), maxLevel: 2, hp: [160, 260, 260], blocks: true, paintable: true, stone: true, tab: 'defense', should: false, blueprintCost: 0, wallLike: true },
  gate: { id: 'gate', w: 1, h: 1, cost: R(10, 0, 0), upgradeCost: [R(0, 12, 0), null], maxLevel: 2, hp: [90, 200, 200], blocks: true, paintable: false, stone: false, tab: 'defense', should: false, blueprintCost: 0, wallLike: true },
  brazier: { id: 'brazier', w: 1, h: 1, cost: R(12, 4, 0), maxLevel: 2, hp: [40, 80, 80], blocks: true, paintable: false, stone: false, tab: 'light', should: false, blueprintCost: 0, wallLike: false, light: [4, 5.5, 5.5] },
  tower_arrow: { id: 'tower_arrow', w: 1, h: 1, cost: R(20, 10, 0), maxLevel: 3, hp: [120, 170, 230], blocks: true, paintable: false, stone: false, tab: 'defense', should: false, blueprintCost: 0, wallLike: false,
    range: [5, 5, 6], dmg: 8, rate: 1.0, dtype: 'pierce', hitsFlying: true },
  tower_ballista: { id: 'tower_ballista', w: 2, h: 2, cost: R(30, 40, 0), maxLevel: 3, hp: [200, 280, 380], blocks: true, paintable: false, stone: true, tab: 'defense', should: false, blueprintCost: 0, wallLike: false,
    range: [8, 8, 8], dmg: 30, rate: 0.4, dtype: 'impact', hitsFlying: false, pierce: [4, 4, 6] },
  tower_frost: { id: 'tower_frost', w: 1, h: 1, cost: R(0, 25, 30), maxLevel: 3, hp: [100, 140, 190], blocks: true, paintable: false, stone: true, tab: 'defense', should: false, blueprintCost: 0, wallLike: false,
    range: [3, 3, 4], dmg: 2, rate: 1, dtype: 'frost', hitsFlying: true, slow: [0.4, 0.5, 0.5] },
  tower_mortar: { id: 'tower_mortar', w: 2, h: 2, cost: R(0, 50, 40), maxLevel: 3, hp: [180, 250, 340], blocks: true, paintable: false, stone: true, tab: 'defense', should: false, blueprintCost: 0, wallLike: false,
    range: [9, 9, 9], minRange: 4, dmg: 24, rate: 0.33, dtype: 'impact', hitsFlying: false, splash: [1.5, 1.5, 2.0] },
  trap_spikes: { id: 'trap_spikes', w: 1, h: 1, cost: R(8, 4, 0), maxLevel: 2, hp: [1, 1, 1], blocks: false, paintable: true, stone: false, tab: 'traps', should: false, blueprintCost: 0, wallLike: false,
    dmg: 10, charges: [6, 9, 9] },
  trap_tar: { id: 'trap_tar', w: 1, h: 1, cost: R(6, 0, 0), maxLevel: 1, hp: [1, 1, 1], blocks: false, paintable: true, stone: false, tab: 'traps', should: false, blueprintCost: 0, wallLike: false,
    slow: [0.5, 0.5, 0.5], dmg: 6 },
  lumber_camp: { id: 'lumber_camp', w: 2, h: 2, cost: R(25, 0, 10), maxLevel: 3, hp: [150, 210, 280], blocks: true, paintable: false, stone: false, tab: 'economy', should: false, blueprintCost: 0, wallLike: false, produce: [4, 3, 2] },
  quarry: { id: 'quarry', w: 2, h: 2, cost: R(30, 0, 15), maxLevel: 3, hp: [150, 210, 280], blocks: true, paintable: false, stone: false, tab: 'economy', should: false, blueprintCost: 0, wallLike: false, produce: [5, 4, 3] },
  tower_spark: { id: 'tower_spark', w: 1, h: 1, cost: R(0, 30, 60), maxLevel: 3, hp: [100, 140, 190], blocks: true, paintable: false, stone: true, tab: 'defense', should: true, blueprintCost: 80, wallLike: false,
    range: [4.5, 4.5, 4.5], dmg: 10, rate: 0.7, dtype: 'spark', hitsFlying: true, chain: [3, 3, 5] },
  barracks: { id: 'barracks', w: 2, h: 2, cost: R(40, 20, 40), maxLevel: 3, hp: [220, 300, 400], blocks: true, paintable: false, stone: false, tab: 'defense', should: true, blueprintCost: 100, wallLike: false, militia: [2, 3, 4] },
  workshop: { id: 'workshop', w: 2, h: 2, cost: R(40, 40, 30), maxLevel: 3, hp: [180, 250, 330], blocks: true, paintable: false, stone: false, tab: 'economy', should: true, blueprintCost: 100, wallLike: false, repairHps: [4, 6, 9], range: [5, 5, 5] },
  tavern: { id: 'tavern', w: 2, h: 2, cost: R(30, 20, 60), maxLevel: 1, hp: [180, 180, 180], blocks: true, paintable: false, stone: false, tab: 'economy', should: true, blueprintCost: 120, wallLike: false },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
export const TOWER_IDS: BuildingId[] = ['tower_arrow', 'tower_ballista', 'tower_frost', 'tower_mortar', 'tower_spark'];
export const WALL_IDS: BuildingId[] = ['wall_wood', 'wall_stone'];
export const MILITIA = { hp: 50, dmg: 6, rate: 1, range: 1.1, speed: 2.2, guard: 5 };
export const TURRET = { dmg: 5, rate: 2, range: 5, ttl: 8, hp: 60 };
export const TAVERN = { goldPerHero: 40 };

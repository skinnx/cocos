// SPEC v2 §6.3 + §6.5 building catalogue. Unlock tiers from §11.1 (hearth tier needed to build).
import type { BuildingId, Cost, DamageType } from '../api';

export type BuildTab = 'defense' | 'light' | 'traps' | 'economy';

export interface BuildingDef {
  id: BuildingId;
  w: number; h: number;
  cost: Cost;                      // level-1 cost (wood/stone/gold + iron)
  upgradeCost?: [Cost | null, Cost | null]; // explicit L2 / L3 cost (otherwise base × upgradeCostMul)
  maxLevel: 1 | 2 | 3;
  upgradeTo?: BuildingId;          // wall_wood → wall_stone (replaces building)
  hp: [number, number, number];
  blocks: boolean;                 // obstacle (path cost) — traps/farms are false (walk over)
  paintable: boolean;              // 1×1 drag-paint
  stone: boolean;                  // repaired with stone instead of wood
  wood: boolean;                   // wooden: cinderlings set it on fire
  tab: BuildTab;
  tier: number;                    // hearth tier that unlocks it (§11.1); 0 = never buildable (hearth)
  unique: boolean;                 // "chỉ xây 1"
  village: boolean;                // §5 rule 5: needs a fully lit footprint to work
  wallLike: boolean;               // auto-tile family (walls + gates)
  should: boolean;                 // SHOULD content (still implemented)
  cosmetic?: string;               // decor: must be owned (cosmetics) to place
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
  militia?: [number, number, number];
  repairHps?: [number, number, number];
  charges?: [number, number, number];
  housing?: [number, number, number];
  slots?: [number, number, number];   // worker slots
  produce?: 'wood' | 'stone' | 'food';
}

const C = (wood: number, stone: number, gold: number, iron = 0): Cost => {
  const c: Cost = {};
  if (wood) c.wood = wood; if (stone) c.stone = stone; if (gold) c.gold = gold; if (iron) c.iron = iron;
  return c;
};

type Base = Omit<BuildingDef, 'id' | 'blocks' | 'paintable' | 'stone' | 'wood' | 'unique' | 'village' | 'wallLike' | 'should' | 'maxLevel'> &
  Partial<Pick<BuildingDef, 'blocks' | 'paintable' | 'stone' | 'wood' | 'unique' | 'village' | 'wallLike' | 'should' | 'maxLevel'>>;
const D = (id: BuildingId, b: Base): BuildingDef => ({
  id, blocks: true, paintable: false, stone: false, wood: false, unique: false, village: false, wallLike: false, should: false, maxLevel: 3, ...b,
});

const decor = (id: BuildingId, size: 1 | 2, gold: number): BuildingDef =>
  D(id, { w: size, h: size, cost: C(0, 0, gold), maxLevel: 1, hp: [40, 40, 40], tab: 'economy', tier: 1, should: true, cosmetic: id });

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  hearth: D('hearth', { w: 2, h: 2, cost: {}, maxLevel: 3, hp: [500, 500, 500], stone: true, tab: 'light', tier: 0,
    range: [4, 4, 4], dmg: 5, rate: 1, dtype: 'fire', hitsFlying: true, light: [7, 7, 7] }),
  wall_wood: D('wall_wood', { w: 1, h: 1, cost: C(4, 0, 0), maxLevel: 1, upgradeTo: 'wall_stone', hp: [60, 60, 60], paintable: true, wood: true, tab: 'defense', tier: 1, wallLike: true }),
  wall_stone: D('wall_stone', { w: 1, h: 1, cost: C(0, 6, 0), maxLevel: 2, hp: [160, 260, 260], paintable: true, stone: true, tab: 'defense', tier: 3, wallLike: true }),
  wall_ember: D('wall_ember', { w: 1, h: 1, cost: C(0, 10, 0, 2), maxLevel: 1, hp: [420, 420, 420], paintable: true, stone: true, tab: 'defense', tier: 7, wallLike: true, should: true, dmg: 2 }),
  gate: D('gate', { w: 1, h: 1, cost: C(10, 0, 0), upgradeCost: [C(0, 12, 0), null], maxLevel: 2, hp: [90, 200, 200], wood: true, tab: 'defense', tier: 1, wallLike: true }),
  brazier: D('brazier', { w: 1, h: 1, cost: C(12, 4, 0), maxLevel: 2, hp: [40, 80, 140], wood: true, tab: 'light', tier: 1, light: [4, 5.5, 7] }),
  watchtower: D('watchtower', { w: 1, h: 1, cost: C(30, 40, 0, 10), maxLevel: 1, hp: [150, 150, 150], tab: 'light', tier: 7, should: true, light: [7, 7, 7] }),
  tower_arrow: D('tower_arrow', { w: 1, h: 1, cost: C(20, 10, 0), hp: [120, 170, 230], wood: true, tab: 'defense', tier: 1,
    range: [5, 5, 6], dmg: 8, rate: 1.0, dtype: 'pierce', hitsFlying: true }),
  tower_ballista: D('tower_ballista', { w: 2, h: 2, cost: C(30, 40, 0), hp: [200, 280, 380], stone: true, tab: 'defense', tier: 4,
    range: [8, 8, 8], dmg: 30, rate: 0.4, dtype: 'impact', hitsFlying: false, pierce: [4, 4, 6] }),
  tower_frost: D('tower_frost', { w: 1, h: 1, cost: C(0, 25, 30), hp: [100, 140, 190], stone: true, tab: 'defense', tier: 3,
    range: [3, 3, 4], dmg: 2, rate: 1, dtype: 'frost', hitsFlying: true, slow: [0.4, 0.5, 0.5] }),
  tower_mortar: D('tower_mortar', { w: 2, h: 2, cost: C(0, 50, 40), hp: [180, 250, 340], stone: true, tab: 'defense', tier: 5,
    range: [9, 9, 9], minRange: 4, dmg: 24, rate: 0.33, dtype: 'impact', hitsFlying: false, splash: [1.5, 1.5, 2.0] }),
  tower_spark: D('tower_spark', { w: 1, h: 1, cost: C(0, 30, 60), hp: [100, 140, 190], stone: true, tab: 'defense', tier: 6,
    range: [4.5, 4.5, 4.5], dmg: 10, rate: 0.7, dtype: 'spark', hitsFlying: true, chain: [3, 3, 5] }),
  trap_spikes: D('trap_spikes', { w: 1, h: 1, cost: C(8, 4, 0), maxLevel: 2, hp: [1, 1, 1], blocks: false, paintable: true, tab: 'traps', tier: 1, dmg: 10, charges: [6, 9, 9] }),
  trap_tar: D('trap_tar', { w: 1, h: 1, cost: C(6, 0, 0), maxLevel: 1, hp: [1, 1, 1], blocks: false, paintable: true, tab: 'traps', tier: 2, slow: [0.5, 0.5, 0.5], dmg: 6 }),
  lumber_camp: D('lumber_camp', { w: 2, h: 2, cost: C(25, 0, 10), hp: [150, 210, 280], wood: true, tab: 'economy', tier: 1, village: true, slots: [2, 3, 4], produce: 'wood' }),
  quarry: D('quarry', { w: 2, h: 2, cost: C(30, 0, 15), hp: [150, 210, 280], tab: 'economy', tier: 2, village: true, slots: [2, 3, 4], produce: 'stone' }),
  farm: D('farm', { w: 2, h: 2, cost: C(15, 0, 0), hp: [60, 90, 120], blocks: false, wood: true, tab: 'economy', tier: 2, village: true, slots: [2, 3, 4], produce: 'food' }),
  house: D('house', { w: 2, h: 2, cost: C(20, 0, 0), hp: [120, 170, 230], wood: true, tab: 'economy', tier: 1, village: true, housing: [2, 3, 4] }),
  storehouse: D('storehouse', { w: 2, h: 2, cost: C(30, 10, 0), hp: [160, 220, 300], wood: true, tab: 'economy', tier: 1, village: true }),
  vault: D('vault', { w: 2, h: 2, cost: C(0, 120, 60, 30), hp: [400, 560, 760], stone: true, tab: 'economy', tier: 4, unique: true, village: true }),
  dock: D('dock', { w: 2, h: 2, cost: C(40, 10, 0), maxLevel: 1, hp: [200, 200, 200], wood: true, tab: 'economy', tier: 2, unique: true }),
  scout_lodge: D('scout_lodge', { w: 2, h: 2, cost: C(50, 30, 20), hp: [180, 250, 330], wood: true, tab: 'economy', tier: 3, unique: true, village: true }),
  forge: D('forge', { w: 2, h: 2, cost: C(40, 60, 30), hp: [220, 300, 400], stone: true, tab: 'economy', tier: 3, unique: true, village: true, slots: [1, 1, 2] }),
  study: D('study', { w: 2, h: 2, cost: C(60, 80, 50, 20), hp: [200, 280, 380], tab: 'economy', tier: 4, unique: true, village: true, slots: [1, 2, 3] }),
  market: D('market', { w: 2, h: 2, cost: C(60, 40, 40), hp: [180, 250, 330], wood: true, tab: 'economy', tier: 4, unique: true, village: true, slots: [1, 1, 2] }),
  tavern: D('tavern', { w: 2, h: 2, cost: C(30, 20, 60), maxLevel: 1, hp: [180, 180, 180], wood: true, tab: 'economy', tier: 2, unique: true, village: true }),
  barracks: D('barracks', { w: 2, h: 2, cost: C(40, 20, 40), hp: [220, 300, 400], tab: 'defense', tier: 5, militia: [2, 3, 4] }),
  workshop: D('workshop', { w: 2, h: 2, cost: C(40, 40, 30), hp: [180, 250, 330], tab: 'economy', tier: 6, repairHps: [4, 6, 9], range: [5, 5, 5] }),
  dawn_shrine: D('dawn_shrine', { w: 2, h: 2, cost: C(0, 200, 150, 60), maxLevel: 1, hp: [300, 300, 300], stone: true, tab: 'light', tier: 9, unique: true, should: true }),
  decor_statue: decor('decor_statue', 2, 40),
  decor_well: decor('decor_well', 2, 30),
  decor_garden: decor('decor_garden', 2, 20),
  decor_lamp: decor('decor_lamp', 1, 15),
  decor_coop: decor('decor_coop', 2, 25),
  decor_board: decor('decor_board', 1, 15),
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
export const TOWER_IDS: BuildingId[] = ['tower_arrow', 'tower_ballista', 'tower_frost', 'tower_mortar', 'tower_spark'];
export const WALL_IDS: BuildingId[] = ['wall_wood', 'wall_stone', 'wall_ember'];
export const DECOR_IDS: BuildingId[] = ['decor_statue', 'decor_well', 'decor_garden', 'decor_lamp', 'decor_coop', 'decor_board'];
export const MILITIA = { hp: 50, dmg: 6, rate: 1, range: 1.1, speed: 2.2, guard: 5 };
export const TURRET = { dmg: 5, rate: 2, range: 5, ttl: 8, hp: 60 };
export const TAVERN = { goldPerHero: 40 };
export const STOREHOUSE = { perLevel: 400, essencePerLevel: 100 };

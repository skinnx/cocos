// SPEC v2 §11: hearth tier unlocks, research tree, bounty templates, chronicle rewards, achievements, cosmetics.
import type { BuildingId, Cost, UnlockKey } from '../api';

// ── §11.1 hearth tiers: requirement + what each tier opens (UnlockKey list) ──────────────────────────────────
export type TierReq = { kind: 'none' } | { kind: 'nightsWon'; n: number } | { kind: 'villagers'; n: number } | { kind: 'sealed'; region: number } | { kind: 'tr'; n: number };
export const TIER_REQ: TierReq[] = [
  { kind: 'none' }, { kind: 'nightsWon', n: 2 }, { kind: 'villagers', n: 4 }, { kind: 'sealed', region: 1 }, { kind: 'tr', n: 14 },
  { kind: 'sealed', region: 2 }, { kind: 'tr', n: 24 }, { kind: 'sealed', region: 3 }, { kind: 'tr', n: 34 }, { kind: 'sealed', region: 4 },
];
/** Unlocks granted on reaching tier (index = tier-1). Tier-1 village buildings arrive after the first dawn (§2.7 session 1). */
export const TIER_UNLOCKS: UnlockKey[][] = [
  ['wall_wood', 'gate', 'brazier', 'tower_arrow', 'trap_spikes'],
  ['quarry', 'farm', 'trap_tar', 'dock', 'tavern', 'beacon_fierce', 'bounties'],
  ['wall_stone', 'tower_frost', 'scout_lodge', 'dispatch', 'garrison', 'forge', 'chronicle'],
  ['tower_ballista', 'study', 'research', 'market', 'vault', 'beacon_nightmare'],
  ['tower_mortar', 'barracks'],
  ['tower_spark', 'workshop', 'modules'],
  ['wall_ember', 'watchtower'],
  ['squad5'],
  ['dawn_shrine'],
  [],
];
export const FIRST_DAWN_UNLOCKS: UnlockKey[] = ['house', 'lumber_camp', 'storehouse'];

// ── §11.8 research: 3 branches × 8 nodes ─────────────────────────────────────────────────────────────────────
export const RESEARCH_LORE = [2, 3, 4, 6, 8, 10, 13, 16];
export const RESEARCH_GOLD = (node: number) => 100 * node; // node = 1..8
export const RESEARCH = {
  // branch 0 Fortification
  wallHp: 0.15, repairDiscount: 0.3, trapDmg: 0.25, loopholeDps: 3, towerMul: 0.1, doubleWallMul: 1.5, lastStandSecs: 5,
  // branch 1 Flame
  brazierRadius: 0.5, signalRevealSecs: 4, litRegen: 0.01, sacredMul: 2,
  // branch 2 Stewardship
  storage: 200, villageProd: 0.15, nightShift: 0.25, cartFrac: 0.05, travelerExtra: 2, prosperityPer: 10,
};
export const RESEARCH_IDS: string[][] = [
  ['wallHp', 'cheapRepair', 'autoGate', 'trapDmg', 'loopholes', 'towerMul', 'doubleWall', 'lastStand'],
  ['brazierRadius', 'halfFuel', 'signalFire', 'litRegen', 'doubleBrazier', 'newMoonRange', 'sacredFire', 'earlyDawn'],
  ['storage', 'villageProd', 'nightShift', 'offline12', 'cart', 'dispatchSlot', 'travelerExtra', 'prosperity'],
];

// ── §11.10 bounties: 24 templates in 4 groups ───────────────────────────────────────────────────────────────
export type BountyKind =
  | 'nightWin' | 'nightWinFierce' | 'nightWinNightmare' | 'flawless' | 'kills' | 'trapKills' | 'flyingKills' | 'eliteKills'
  | 'upgrade' | 'walls' | 'towers' | 'traps' | 'repair' | 'relocate'
  | 'expedition' | 'extract' | 'extract3' | 'chests' | 'islandBoss'
  | 'harvestWood' | 'harvestStone' | 'harvestIron' | 'food' | 'camp' | 'research' | 'trade' | 'ruin';
export interface BountyTemplate { id: string; group: 'defense' | 'build' | 'expedition' | 'village'; kind: BountyKind; goal: number; gold: number; minTier: number }
const BT = (id: string, group: BountyTemplate['group'], kind: BountyKind, goal: number, gold: number, minTier = 2): BountyTemplate => ({ id, group, kind, goal, gold, minTier });
export const BOUNTIES: BountyTemplate[] = [
  BT('win2', 'defense', 'nightWin', 2, 40), BT('winFierce', 'defense', 'nightWinFierce', 1, 60), BT('winNightmare', 'defense', 'nightWinNightmare', 1, 120, 4),
  BT('flawless', 'defense', 'flawless', 1, 60), BT('kill60', 'defense', 'kills', 60, 40), BT('trap25', 'defense', 'trapKills', 25, 50),
  BT('flying10', 'defense', 'flyingKills', 10, 50, 3), BT('elite3', 'defense', 'eliteKills', 3, 70, 4),
  BT('upgrade3', 'build', 'upgrade', 3, 40), BT('walls20', 'build', 'walls', 20, 30), BT('towers2', 'build', 'towers', 2, 40), BT('traps10', 'build', 'traps', 10, 30),
  BT('repair200', 'build', 'repair', 200, 40), BT('relocate2', 'build', 'relocate', 2, 30),
  BT('expedition2', 'expedition', 'expedition', 2, 50), BT('extract1', 'expedition', 'extract', 1, 50), BT('extract3', 'expedition', 'extract3', 1, 80),
  BT('chests5', 'expedition', 'chests', 5, 50), BT('islandBoss', 'expedition', 'islandBoss', 1, 70),
  BT('wood80', 'village', 'harvestWood', 80, 30), BT('stone50', 'village', 'harvestStone', 50, 30), BT('iron20', 'village', 'harvestIron', 20, 50),
  BT('food40', 'village', 'food', 40, 30), BT('camp2', 'village', 'camp', 2, 50),
];
export const BOUNTY_REWARD = { ember: 3, deeds: 10 };
export const EXTRA_BOUNTY_KINDS: BountyKind[] = ['research', 'trade', 'ruin']; // tracked for achievements

// ── §11.10 chronicle: 7 steps per week ──────────────────────────────────────────────────────────────────────
export const CHRONICLE_REWARDS: Array<Cost & { ember?: number; shards?: number; cosmetic?: boolean }> = [
  { wood: 150, stone: 100 }, { gold: 120 }, { shards: 5 }, { lore: 3 }, { iron: 40, essence: 40 }, { shards: 10, ember: 10 }, { cosmetic: true },
];

// ── §11.11 cosmetics ────────────────────────────────────────────────────────────────────────────────────────
export const FLAMES = ['ember', 'azure', 'verdant', 'violet', 'gold'];
export const BANNERS = ['banner_0', 'banner_1', 'banner_2', 'banner_3', 'banner_4', 'banner_5', 'banner_6', 'banner_7'];
export const WALL_SKINS = ['default', 'moss', 'frost', 'gilded'];
export const DECORS: BuildingId[] = ['decor_statue', 'decor_well', 'decor_garden', 'decor_lamp', 'decor_coop', 'decor_board'];
/** Every collectible cosmetic id (owned list uses these names). */
export const COSMETICS: string[] = [
  ...FLAMES.slice(1).map((f) => `flame_${f}`), ...BANNERS.slice(1), ...WALL_SKINS.slice(1).map((s) => `skin_${s}`), ...DECORS,
];
export const DEFAULT_COSMETICS = ['flame_ember', 'banner_0', 'skin_default'];

// ── §11.11 achievements (30, 4 groups) ──────────────────────────────────────────────────────────────────────
export interface AchievementDef { id: string; group: 'build' | 'combat' | 'explore' | 'village'; gold: number; ember: number }
const A = (id: string, group: AchievementDef['group'], gold: number, ember = 0): AchievementDef => ({ id, group, gold, ember });
export const ACHIEVEMENTS: AchievementDef[] = [
  A('first_wall', 'build', 20), A('walls_100', 'build', 60), A('stone_ring', 'build', 80, 5), A('towers_10', 'build', 60), A('max_tower', 'build', 80, 5),
  A('hearth_3', 'build', 60, 5), A('hearth_5', 'build', 150, 10), A('buildings_100', 'build', 100, 5),
  A('first_night', 'combat', 20), A('nights_10', 'combat', 60), A('nights_50', 'combat', 200, 10), A('flawless', 'combat', 80, 5), A('fierce_win', 'combat', 60, 5),
  A('nightmare_win', 'combat', 150, 10), A('blood_moon', 'combat', 100, 5), A('kills_1000', 'combat', 120, 5), A('mossback', 'combat', 150, 10), A('briarqueen', 'combat', 200, 15),
  A('first_camp', 'explore', 20), A('camps_10', 'explore', 80), A('region_2', 'explore', 100, 5), A('region_3', 'explore', 200, 10), A('first_ruin', 'explore', 40), A('first_expedition', 'explore', 40),
  A('first_villager', 'village', 20), A('villagers_10', 'village', 80, 5), A('villagers_20', 'village', 150, 10), A('well_fed', 'village', 60), A('first_research', 'village', 60, 5), A('warmth_7', 'village', 100, 5),
];

// ── traveler (§11.10) ───────────────────────────────────────────────────────────────────────────────────────
export const TRADE_RES = ['wood', 'stone', 'iron', 'food', 'essence'] as const;

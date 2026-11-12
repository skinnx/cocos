// View-side catalogue (no 'cc'): building drawer tabs, footprints, unlock tiers (SPEC §11.1), hero / dispatch /
// research / forge constants (SPEC §11, §17). Footprints and level caps are read from core/data/buildings when the
// core table provides them, with the SPEC tables as fallback; costs and validity always come from the live Game
// (game.buildingCost / game.canPlace), never from here.
import type { Beacon, BuildingId, CharmId, DispatchKind, GearSlot, HeroId, ModuleId, MoonPhase, NightEvent, Rarity, UnlockKey } from '../../core/api';
import { BUILDINGS } from '../../core/data/buildings';

export type BuildTab = 'defense' | 'light' | 'traps' | 'economy';
export const TABS: BuildTab[] = ['defense', 'light', 'traps', 'economy'];

interface Meta { tab: BuildTab; w: number; h: number; paint?: boolean; tier: number; max: number; stone?: boolean; range?: number[]; light?: number[]; minRange?: number }
// SPEC §6.3 / §6.5 / §11.1 (tier = Hearth tier that unlocks it; 0 = cosmetic, unlocked by owning it)
const META: Record<BuildingId, Meta> = {
  hearth: { tab: 'light', w: 2, h: 2, tier: 1, max: 10, light: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
  wall_wood: { tab: 'defense', w: 1, h: 1, paint: true, tier: 1, max: 1 },
  wall_stone: { tab: 'defense', w: 1, h: 1, paint: true, tier: 3, max: 2, stone: true },
  wall_ember: { tab: 'defense', w: 1, h: 1, paint: true, tier: 7, max: 1, stone: true },
  gate: { tab: 'defense', w: 1, h: 1, tier: 1, max: 2 },
  tower_arrow: { tab: 'defense', w: 1, h: 1, tier: 1, max: 3, range: [5, 5, 6] },
  tower_ballista: { tab: 'defense', w: 2, h: 2, tier: 4, max: 3, stone: true, range: [8, 8, 8] },
  tower_frost: { tab: 'defense', w: 1, h: 1, tier: 3, max: 3, stone: true, range: [3, 3, 4] },
  tower_mortar: { tab: 'defense', w: 2, h: 2, tier: 5, max: 3, stone: true, range: [9, 9, 9], minRange: 4 },
  tower_spark: { tab: 'defense', w: 1, h: 1, tier: 6, max: 3, stone: true, range: [4.5, 4.5, 4.5] },
  watchtower: { tab: 'light', w: 1, h: 1, tier: 7, max: 2, stone: true, light: [7, 7] },
  barracks: { tab: 'defense', w: 2, h: 2, tier: 5, max: 3, range: [5, 5, 5] },
  workshop: { tab: 'defense', w: 2, h: 2, tier: 6, max: 3, range: [5, 5, 5] },
  brazier: { tab: 'light', w: 1, h: 1, tier: 1, max: 3, light: [4, 5.5, 7] },
  trap_spikes: { tab: 'traps', w: 1, h: 1, paint: true, tier: 1, max: 2 },
  trap_tar: { tab: 'traps', w: 1, h: 1, paint: true, tier: 2, max: 1 },
  house: { tab: 'economy', w: 2, h: 2, tier: 1, max: 3 },
  lumber_camp: { tab: 'economy', w: 2, h: 2, tier: 1, max: 3, range: [4, 4, 4] },
  storehouse: { tab: 'economy', w: 2, h: 2, tier: 1, max: 3 },
  quarry: { tab: 'economy', w: 2, h: 2, tier: 2, max: 3, stone: true, range: [4, 4, 4] },
  farm: { tab: 'economy', w: 2, h: 2, tier: 2, max: 3 },
  dock: { tab: 'economy', w: 2, h: 2, tier: 2, max: 3 },
  scout_lodge: { tab: 'economy', w: 2, h: 2, tier: 3, max: 3 },
  forge: { tab: 'economy', w: 2, h: 2, tier: 3, max: 3, stone: true },
  tavern: { tab: 'economy', w: 2, h: 2, tier: 3, max: 1 },
  study: { tab: 'economy', w: 2, h: 2, tier: 4, max: 3, stone: true },
  market: { tab: 'economy', w: 2, h: 2, tier: 4, max: 3 },
  vault: { tab: 'economy', w: 2, h: 2, tier: 4, max: 3, stone: true },
  dawn_shrine: { tab: 'economy', w: 2, h: 2, tier: 9, max: 1, stone: true },
  decor_statue: { tab: 'economy', w: 1, h: 1, tier: 0, max: 1, stone: true },
  decor_well: { tab: 'economy', w: 1, h: 1, tier: 0, max: 1, stone: true },
  decor_garden: { tab: 'economy', w: 1, h: 1, tier: 0, max: 1 },
  decor_lamp: { tab: 'economy', w: 1, h: 1, tier: 0, max: 1 },
  decor_coop: { tab: 'economy', w: 1, h: 1, tier: 0, max: 1 },
  decor_board: { tab: 'economy', w: 1, h: 1, tier: 0, max: 1 },
};
export const BUILDING_IDS = Object.keys(META) as BuildingId[];

/** Field from the core data table when present and well-formed, else the SPEC fallback. */
function core(id: BuildingId): Record<string, unknown> | null {
  const t = BUILDINGS as unknown as Record<string, Record<string, unknown> | undefined>;
  return t[id] ?? null;
}
function num(v: unknown, fb: number): number { return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fb; }
function arr(v: unknown, fb: number[] | undefined): number[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : fb;
}

export function footprint(id: BuildingId): { w: number; h: number } {
  const m = META[id], c = core(id);
  return { w: num(c?.w, m?.w ?? 1), h: num(c?.h, m?.h ?? 1) };
}
export function isPaintable(id: BuildingId): boolean {
  const c = core(id);
  return typeof c?.paintable === 'boolean' ? c.paintable : !!META[id]?.paint;
}
export function maxLevel(id: BuildingId): number { return num(core(id)?.maxLevel, META[id]?.max ?? 1); }
export function upgradesInto(id: BuildingId): BuildingId | undefined {
  const u = core(id)?.upgradeTo;
  if (typeof u === 'string' && u in META) return u as BuildingId;
  return id === 'wall_wood' ? 'wall_stone' : undefined;
}
export function isStone(id: BuildingId): boolean { const c = core(id); return typeof c?.stone === 'boolean' ? c.stone : !!META[id]?.stone; }
export function unlockTier(id: BuildingId): number { return META[id]?.tier ?? 1; }
export function tabOf(id: BuildingId): BuildTab { return META[id]?.tab ?? 'economy'; }

export function isTowerId(id: string): boolean {
  return id === 'tower_arrow' || id === 'tower_ballista' || id === 'tower_frost' || id === 'tower_mortar' || id === 'tower_spark';
}
export function isWall(id: string): boolean { return id === 'wall_wood' || id === 'wall_stone' || id === 'wall_ember' || id === 'gate'; }
export function isDecor(id: string): boolean { return id.startsWith('decor_'); }
/** Buildings that host villagers' jobs (§11.3). */
export function isWorkplace(id: string): boolean {
  return id === 'lumber_camp' || id === 'quarry' || id === 'farm' || id === 'forge' || id === 'study' || id === 'market';
}

/** Placeable buildings per drawer tab (hearth is upgraded from its panel, not placed). */
export function tabItems(tab: BuildTab): BuildingId[] { return BUILDING_IDS.filter((id) => id !== 'hearth' && tabOf(id) === tab); }

export type CardState = { id: BuildingId; locked: false } | { id: BuildingId; locked: true; tier: number };
/**
 * Drawer cards for a tab (§2.7 + §10.5): unlocked buildings, plus the ones the *next* Hearth tier opens shown locked
 * with their condition. Anything further away stays hidden. Decor only shows when owned (state.unlocked).
 */
export function drawerCards(tab: BuildTab, unlocked: readonly UnlockKey[], hearthTier: number): CardState[] {
  const out: CardState[] = [];
  for (const id of tabItems(tab)) {
    if (unlocked.includes(id)) out.push({ id, locked: false });
    else if (!isDecor(id) && unlockTier(id) === hearthTier + 1) out.push({ id, locked: true, tier: unlockTier(id) });
  }
  return out;
}

/** Range rings (tiles) for a building at a level: outer ring + optional inner (mortar minimum range). */
export function rangeRings(id: BuildingId, level: number): number[] {
  const m = META[id], c = core(id);
  const i = Math.max(0, Math.min(2, level - 1));
  const out: number[] = [];
  const range = arr(c?.range, m?.range), light = arr(c?.light, m?.light);
  if (range && id !== 'brazier') out.push(range[Math.min(i, range.length - 1)]);
  else if (light && (id === 'brazier' || id === 'watchtower')) out.push(light[Math.min(i, light.length - 1)]);
  const min = typeof c?.minRange === 'number' ? c.minRange : m?.minRange;
  if (min) out.push(min);
  return out;
}

/** Preview sprite (level 1, first frame) for a drawer card / ghost. */
export function previewSprite(id: BuildingId, wallSkin = ''): string {
  switch (id) {
    case 'hearth': return 'bld_hearth_l1_0';
    case 'wall_wood': return wallSkin ? `skin_${wallSkin}_wood_10` : 'bld_wall_wood_10';
    case 'wall_stone': return wallSkin ? `skin_${wallSkin}_stone_10` : 'bld_wall_stone_10';
    case 'wall_ember': return 'bld_wall_ember_10';
    case 'gate': return 'bld_gate_h_closed';
    case 'brazier': return 'bld_brazier_l1_0';
    case 'tower_ballista': return 'bld_tower_ballista_l1_base';
    case 'tower_frost': case 'tower_spark': return `bld_${id}_l1_0`;
    case 'trap_spikes': return 'bld_trap_spikes_l1_up';
    case 'trap_tar': return 'bld_trap_tar';
    case 'tavern': return 'bld_tavern_l1';
    case 'dawn_shrine': return 'bld_dawn_shrine_l1';
    case 'watchtower': return 'bld_watchtower_l1';
    default: return id.startsWith('decor_') ? `bld_${id}` : `bld_${id}_l1`;
  }
}

// ── heroes (§11.4, §11.5, §17) ──────────────────────────────────────────────
export const HERO_LIST: HeroId[] = ['knight', 'ranger', 'pyro', 'tinker', 'cleric', 'rogue', 'beast', 'warden', 'shade', 'bomb'];
export const HERO_BAL = {
  unlockShards: 30, starShards: [20, 40, 80, 160], starEssence: [30, 80, 160, 300], capByStar: [10, 15, 20, 25, 30],
  skillPickLevels: [5, 10, 15, 20, 25], respecGoldPerLevel: 50,
} as const;
/** Shards + essence for the next star, or null at 5★. */
export function starUpCost(stars: number): { shards: number; essence: number } | null {
  if (stars >= 5 || stars < 1) return null;
  return { shards: HERO_BAL.starShards[stars - 1], essence: HERO_BAL.starEssence[stars - 1] };
}
export function levelCap(stars: number): number { return HERO_BAL.capByStar[Math.max(0, Math.min(4, stars - 1))]; }

export const DISPATCH: Array<{ kind: DispatchKind; minutes: [number, number]; icon: string }> = [
  { kind: 'forage', minutes: [15, 60], icon: 'icon_wood' },
  { kind: 'hunt', minutes: [60, 240], icon: 'icon_essence' },
  { kind: 'scout', minutes: [240, 480], icon: 'icon_map' },
];
export const GEAR_SLOTS: GearSlot[] = ['weapon', 'armor', 'charm'];
export const RARITIES: Rarity[] = ['common', 'rare', 'epic'];
export const CHARMS: CharmId[] = ['owl', 'whetstone', 'chestnut', 'tinkerlock', 'shell', 'windchime', 'cateye', 'hunger', 'icecore', 'luckycoin', 'phoenix', 'fuse'];
export const MODULES: ModuleId[] = ['split', 'barb', 'frostoil', 'scope', 'winch', 'coalcore', 'hawkeye', 'bulwark'];
/** §11.9 craft prices (regional material = whichever the player has most of; core picks). */
export const CRAFT_COST: Record<Rarity, { iron: number; essence: number; regional: number; blueprint: boolean }> = {
  common: { iron: 30, essence: 20, regional: 0, blueprint: false },
  rare: { iron: 80, essence: 60, regional: 5, blueprint: false },
  epic: { iron: 180, essence: 150, regional: 15, blueprint: true },
};
export const MODULE_COST = { iron: 40, essence: 60 } as const;

// ── research (§11.8) ────────────────────────────────────────────────────────
export const RESEARCH_LORE = [2, 3, 4, 6, 8, 10, 13, 16];
export function researchCost(node: number): { lore: number; gold: number } | null {
  if (node < 0 || node >= RESEARCH_LORE.length) return null;
  return { lore: RESEARCH_LORE[node], gold: 100 * (node + 1) };
}

// ── night stakes (§8.3, §8.4) ───────────────────────────────────────────────
export const BEACONS: Beacon[] = ['calm', 'steady', 'fierce', 'nightmare'];
export const BEACON_INFO: Record<Beacon, { budget: number; loot: number; trGain: number; unlock: UnlockKey | null; tier: number }> = {
  calm: { budget: 0.7, loot: 0.6, trGain: 0, unlock: null, tier: 1 },
  steady: { budget: 1, loot: 1, trGain: 1, unlock: null, tier: 1 },
  fierce: { budget: 1.35, loot: 1.6, trGain: 1, unlock: 'beacon_fierce', tier: 2 },
  nightmare: { budget: 1.8, loot: 2.5, trGain: 2, unlock: 'beacon_nightmare', tier: 4 },
};
export function beaconOpen(b: Beacon, unlocked: readonly UnlockKey[]): boolean {
  const u = BEACON_INFO[b].unlock;
  return !u || unlocked.includes(u);
}
export const MOONS: MoonPhase[] = ['new', 'crescent', 'half', 'gibbous', 'full', 'waning', 'blood'];
export const NIGHT_EVENTS: NightEvent[] = ['swarm', 'pincer', 'hunters', 'short', 'rain'];
/** Chronicle deeds per night by beacon (§11.10). */
export const NIGHT_DEEDS: Record<Beacon, number> = { calm: 3, steady: 5, fierce: 8, nightmare: 12 };

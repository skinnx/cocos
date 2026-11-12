// SPEC v2 §11.6 expeditions (islands, modifiers, tiers, chests, trails), §11.5 dispatch loot tables, §6.5 tavern prices.
// Owned by core-heroes. Pure data.
import type { Biome, DispatchKind, EnemyId, ExpeditionIsland, ResKey } from '../api';
import type { Txt } from './heroes';

export const EXP = {
  size: 40, seconds: 180, rushSeconds: 120, chests: 3, extractSeconds: 3, extractRange: 1.8, failKeep: 0.5,
  trailsPerDay: 3, trailsMax: 6, islandsPerDay: 3, tiers: 5, lastWarning: 30, chestRange: 1.4,
  /** threat rating used for M(TR) at tier I..V (one step inside each region band) */
  tierTr: [3, 10, 18, 28, 38],
  /** loot multiplier per tier */
  tierLoot: [1, 1.6, 2.4, 3.4, 4.6],
  /** guards per pack and number of roaming packs (before modifiers) */
  packSize: [3, 5], packs: 6, chestGuards: 3, campGuards: 5, bossHpMul: 5, bossDmgMul: 1.5, bossScale: 1.6,
};

export type ModifierId = 'swift' | 'horde' | 'fog' | 'ranged' | 'noheal' | 'guarded' | 'dark' | 'mire' | 'rush' | 'warlord';
export const MODIFIER_IDS: ModifierId[] = ['swift', 'horde', 'fog', 'ranged', 'noheal', 'guarded', 'dark', 'mire', 'rush', 'warlord'];

export const MODIFIERS: Record<ModifierId, { name: Txt; desc: Txt }> = {
  swift: { name: { en: 'Restless', vi: 'Hiếu Động' }, desc: { en: 'Gloom move 20% faster.', vi: 'Quái nhanh +20%.' } },
  horde: { name: { en: 'Horde', vi: 'Bầy Đàn' }, desc: { en: '50% more Gloom, but 30% weaker.', vi: 'Quái đông gấp rưỡi nhưng yếu 30%.' } },
  fog: { name: { en: 'Thick Fog', vi: 'Sương Dày' }, desc: { en: 'Sight shrinks to 3 tiles.', vi: 'Tầm nhìn chỉ 3 ô.' } },
  ranged: { name: { en: 'Spitter Nest', vi: 'Ổ Phun' }, desc: { en: 'Every Gloom attacks from range.', vi: 'Toàn quái bắn xa.' } },
  noheal: { name: { en: 'Withering', vi: 'Khô Héo' }, desc: { en: 'No healing of any kind.', vi: 'Không hồi máu.' } },
  guarded: { name: { en: 'Hoard', vi: 'Kho Báu' }, desc: { en: 'Chests hold double, but elite Gloom guard them.', vi: 'Hòm nhân đôi nhưng có canh gác tinh nhuệ.' } },
  dark: { name: { en: 'Moonless', vi: 'Đêm Tối' }, desc: { en: 'Only the leader\'s lantern lights the way.', vi: 'Chỉ có đèn trưởng nhóm.' } },
  mire: { name: { en: 'Mire', vi: 'Đất Lầy' }, desc: { en: 'Everything moves 20% slower.', vi: 'Mọi thứ chậm 20%.' } },
  rush: { name: { en: 'Low Tide', vi: 'Nước Ròng' }, desc: { en: 'Only 120 s, but rewards ×1.5.', vi: 'Thời gian 120 giây nhưng thưởng ×1.5.' } },
  warlord: { name: { en: 'Warlord', vi: 'Lãnh Chúa' }, desc: { en: 'The camp boss is twice as strong and drops gear.', vi: 'Boss ổ mạnh gấp đôi, rơi trang bị.' } },
};

export const MOD_FX = {
  swift: { speed: 1.2 }, horde: { count: 1.5, hp: 0.7 }, fog: { sight: 3 }, mire: { speed: 0.8 }, rush: { loot: 1.5 },
  guarded: { loot: 2 }, warlord: { hp: 2, dmg: 2 }, dark: { veiledSpeed: 1.25, light: 3 },
};

export type Focus = ExpeditionIsland['focus'];
export const FOCI: Focus[] = ['iron', 'essence', 'shards', 'lore', 'regional', 'blueprint'];

/** Island biomes available by regions open (separate maps, so later regions just widen the pool). */
export const ISLAND_BIOMES: Array<{ biome: Biome; region: number }> = [
  { biome: 'meadow', region: 1 }, { biome: 'forest', region: 1 }, { biome: 'quarry', region: 1 }, { biome: 'ruins', region: 2 },
  { biome: 'snow', region: 3 }, { biome: 'ash', region: 4 },
];
export const BIOME_REGIONAL: Partial<Record<Biome, 'resin' | 'frost' | 'coal'>> = { forest: 'resin', snow: 'frost', ash: 'coal' };

/** Enemy pool for expeditions (no building-hunters; the boss is an elite brute). */
export const EXP_ENEMIES: EnemyId[] = ['gloomling', 'skitter', 'spitter', 'brute', 'wisp', 'shrieker', 'hurler'];
export const EXP_RANGED: EnemyId[] = ['spitter', 'hurler'];

/** Per-chest loot at tier I (× tierLoot, × modifiers). `basic` always; `focus` only with a trail. */
export const CHEST_LOOT = {
  basic: { gold: 30, wood: 25, stone: 20, iron: 6 } as Partial<Record<ResKey, number>>,
  focus: { iron: 25, essence: 20, shards: 4, lore: 1, regional: 4, blueprintChance: 0.35, blueprintFallbackEssence: 25 },
  bossMul: 2.5, bossGearChance: 0.35,
  /** trail-less trips still count kills/harvest, but only these resources survive */
  basicKeys: ['wood', 'stone', 'iron', 'gold'] as ResKey[],
};

/** Boons that make no sense on an island (no hearth/towers/braziers, fixed squad). */
export const EXP_BOON_EXCLUDE = ['bigfire', 'embers', 'mirror', 'rebirth', 'falsedawn', 'ally', 'ash'];

// ── §11.5 dispatch ──────────────────────────────────────────────────────────
export const DISPATCH: Record<DispatchKind, { minutes: [number, number]; name: Txt }> = {
  forage: { minutes: [15, 60], name: { en: 'Forage', vi: 'Gom nhặt' } },
  hunt: { minutes: [60, 240], name: { en: 'Gloom Hunt', vi: 'Săn Gloom' } },
  scout: { minutes: [240, 480], name: { en: 'Scout', vi: 'Do thám' } },
};
export const DISPATCH_FX = {
  durationsMin: [15, 60, 240, 480], perHourFalloff: [1, 1, 0.6, 0.44],
  forage: { wood: 120, stone: 80, iron: 12 },
  hunt: { essence: 20, gold: 50, shardChance: { 60: 0.25, 240: 0.6 } as Record<number, number>, shards: [3, 6] },
  scout: { omenNights: 3, trails: 1, lore: { 240: 1, 480: 2 } as Record<number, number> },
  levelMul: 0.04,    // +4% loot per hero level above 1
  slotsByLevel: [1, 2, 3], researchSlotNode: 6,
};

// ── §6.5 tavern ─────────────────────────────────────────────────────────────
export const TAVERN = { recruitGold: 120, recruitGoldPerOwned: 60, packShards: 8, packGold: 80 };

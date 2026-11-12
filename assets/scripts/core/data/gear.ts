// SPEC v2 §11.4 gear (3 slots, 3 rarities, 12 charms) and §11.9 forge + tower modules. Owned by core-heroes.
import type { CharmId, Cost, GearSlot, ModuleId, Rarity } from '../api';
import type { Txt } from './heroes';

export const RARITIES: Rarity[] = ['common', 'rare', 'epic'];
export const GEAR_SLOTS: GearSlot[] = ['weapon', 'armor', 'charm'];

/** Stat roll ranges (integer percents) per rarity. */
export const GEAR_ROLLS = {
  weapon: { dmgPct: { common: [6, 12], rare: [13, 22], epic: [23, 35] }, onHitChance: { common: 0, rare: 0.5, epic: 1 } },
  armor: { hpPct: { common: [8, 15], rare: [16, 26], epic: [27, 40] }, reducePct: { common: [0, 0], rare: [3, 6], epic: [7, 12] } },
} as const;

/** On-hit effects of weapons. */
export const ON_HIT = {
  burn: { dps: 3, secs: 3 },
  slow: { amt: 0.2, secs: 1.5 },
  bleed: { dps: 3, secs: 4 },
} as const;

/** Charm magnitude multiplier by rarity. */
export const CHARM_RARITY_MUL: Record<Rarity, number> = { common: 1, rare: 1.25, epic: 1.5 };

export interface CharmDef { id: CharmId; name: Txt; desc: Txt }
export const CHARM_IDS: CharmId[] = ['owl', 'whetstone', 'chestnut', 'tinkerlock', 'shell', 'windchime', 'cateye', 'hunger', 'icecore', 'luckycoin', 'phoenix', 'fuse'];

/** Base magnitudes (× CHARM_RARITY_MUL). */
export const CHARM_FX = {
  owl: { range: 1 },                    // +range for ranged attacks
  whetstone: { crit: 0.1 },             // +crit chance
  chestnut: { chance: 0.15, dps: 3, secs: 3 }, // basic attacks may burn
  tinkerlock: { hps: 3, range: 1.5 },   // repairs adjacent structures
  shell: { reduce: 0.2 },               // less damage taken while standing still
  windchime: { speed: 0.1 },            // squad move speed
  cateye: { sight: 4 },                 // reveals veiled foes within N tiles
  hunger: { leech: 0.05 },              // heal % of damage dealt
  icecore: { slow: 0.15, secs: 1 },     // basic attacks slow
  luckycoin: { gold: 0.15 },            // extra gold from this hero's kills
  phoenix: { hp: 0.3 },                 // first fall each night → stand up with N HP
  fuse: { cd: 0.15 },                   // skill cooldown reduction
} as const;

export const CHARMS: Record<CharmId, CharmDef> = {
  owl: { id: 'owl', name: { en: 'Owl Feather', vi: 'Lông Cú' }, desc: { en: '+1 attack range for ranged heroes.', vi: '+1 tầm đánh xa.' } },
  whetstone: { id: 'whetstone', name: { en: 'Whetstone', vi: 'Đá Mài' }, desc: { en: '+10% critical chance.', vi: 'Chí mạng +10%.' } },
  chestnut: { id: 'chestnut', name: { en: 'Fire Chestnut', vi: 'Hạt Dẻ Lửa' }, desc: { en: 'Basic attacks have 15% to set foes burning.', vi: 'Đòn thường có 15% gây cháy.' } },
  tinkerlock: { id: 'tinkerlock', name: { en: 'Tinker\'s Lock', vi: 'Khóa Thợ' }, desc: { en: 'Repairs structures next to the hero, 3 HP/s.', vi: 'Sửa công trình khi đứng cạnh, 3 HP/giây.' } },
  shell: { id: 'shell', name: { en: 'Snail Shell', vi: 'Vỏ Ốc' }, desc: { en: '−20% damage taken while standing still.', vi: '−20% sát thương nhận khi đứng yên.' } },
  windchime: { id: 'windchime', name: { en: 'Wind Chime', vi: 'Chuông Gió' }, desc: { en: '+10% move speed for the whole squad.', vi: '+10% tốc chạy toàn đội.' } },
  cateye: { id: 'cateye', name: { en: 'Cat\'s Eye', vi: 'Mắt Mèo' }, desc: { en: 'Reveals veiled foes within 4 tiles.', vi: 'Thấy quái ẩn trong 4 ô.' } },
  hunger: { id: 'hunger', name: { en: 'Hungry Talisman', vi: 'Lá Bùa Đói' }, desc: { en: 'Heals 5% of damage dealt.', vi: 'Hồi 5% sát thương gây ra.' } },
  icecore: { id: 'icecore', name: { en: 'Ice Core', vi: 'Lõi Băng' }, desc: { en: 'Basic attacks slow by 15%.', vi: 'Đòn thường làm chậm 15%.' } },
  luckycoin: { id: 'luckycoin', name: { en: 'Lucky Coin', vi: 'Đồng Xu May' }, desc: { en: '+15% gold from foes this hero slays.', vi: '+15% vàng từ quái hero này hạ.' } },
  phoenix: { id: 'phoenix', name: { en: 'Phoenix Ash', vi: 'Tro Phượng' }, desc: { en: 'The first fall each night: stand up with 30% HP.', vi: 'Gục lần đầu mỗi đêm thì đứng dậy với 30% HP.' } },
  fuse: { id: 'fuse', name: { en: 'Fire Fuse', vi: 'Dây Lửa' }, desc: { en: 'Skill cooldown −15%.', vi: 'Skill hồi nhanh 15%.' } },
};

// ── §11.9 forge ──────────────────────────────────────────────────────────────
export interface ForgeCost { cost: Cost; regional: number; blueprint: boolean }
export const FORGE_COST: Record<Rarity, ForgeCost> = {
  common: { cost: { iron: 30, essence: 20 }, regional: 0, blueprint: false },
  rare: { cost: { iron: 80, essence: 60 }, regional: 5, blueprint: false },
  epic: { cost: { iron: 180, essence: 150 }, regional: 15, blueprint: true },
};
export const FORGE = { workerDiscount: 0.1, maxWorkerDiscount: 0.3, salvageRefund: 0.5, minTier: 3 };
/** Regional materials, paid in this order when a recipe needs N of "any regional material". */
export const REGIONAL: Array<'resin' | 'frost' | 'coal'> = ['resin', 'frost', 'coal'];

// ── §11.9 tower modules (SHOULD; implemented) ───────────────────────────────
export interface ModuleFx {
  dmgMul: number; rateMul: number; rangeAdd: number; extraTargets: number; bleedDps: number; bleedSecs: number;
  slow: number; slowSecs: number; splashAdd: number; flame: boolean; preferFlying: boolean; flyingDmgMul: number; hpMul: number; taunt: number;
}
const M = (o: Partial<ModuleFx>): ModuleFx => ({
  dmgMul: 1, rateMul: 1, rangeAdd: 0, extraTargets: 0, bleedDps: 0, bleedSecs: 0, slow: 0, slowSecs: 0, splashAdd: 0, flame: false,
  preferFlying: false, flyingDmgMul: 1, hpMul: 1, taunt: 0, ...o,
});
export const MODULE_IDS: ModuleId[] = ['split', 'barb', 'frostoil', 'scope', 'winch', 'coalcore', 'hawkeye', 'bulwark'];
export const MODULES: Record<ModuleId, { fx: ModuleFx; name: Txt; desc: Txt }> = {
  split: { fx: M({ extraTargets: 1, dmgMul: 0.75 }), name: { en: 'Split Head', vi: 'Đầu Tên Chẻ' }, desc: { en: 'Shoots 2 targets, −25% damage.', vi: 'Bắn 2 mục tiêu, −25% sát thương.' } },
  barb: { fx: M({ bleedDps: 4, bleedSecs: 4 }), name: { en: 'Iron Barbs', vi: 'Ngạnh Sắt' }, desc: { en: 'Hits cause bleeding, 4/s for 4 s.', vi: 'Gây chảy máu 4/giây trong 4 giây.' } },
  frostoil: { fx: M({ slow: 0.2, slowSecs: 1.5 }), name: { en: 'Frost Oil', vi: 'Dầu Băng' }, desc: { en: 'Hits slow by 20%.', vi: 'Đòn làm chậm 20%.' } },
  scope: { fx: M({ rangeAdd: 1.5, rateMul: 0.85 }), name: { en: 'Long Scope', vi: 'Kính Viễn' }, desc: { en: '+1.5 range, −15% fire rate.', vi: '+1.5 tầm, −15% tốc bắn.' } },
  winch: { fx: M({ rateMul: 1.3, rangeAdd: -1 }), name: { en: 'Quick Winch', vi: 'Tời Nhanh' }, desc: { en: '+30% fire rate, −1 range.', vi: '+30% tốc bắn, −1 tầm.' } },
  coalcore: { fx: M({ splashAdd: 1, flame: true }), name: { en: 'Coal Core', vi: 'Lõi Than' }, desc: { en: 'Shots explode 1 tile and burn.', vi: 'Đòn nổ lan 1 ô, gây cháy.' } },
  hawkeye: { fx: M({ preferFlying: true, flyingDmgMul: 1.5 }), name: { en: 'Hawk Eye', vi: 'Mắt Ưng' }, desc: { en: 'Targets fliers first, +50% damage to them.', vi: 'Ưu tiên quái bay, +50% sát thương lên chúng.' } },
  bulwark: { fx: M({ hpMul: 2, taunt: 2 }), name: { en: 'Bulwark', vi: 'Thành Lũy' }, desc: { en: 'Tower +100% HP; foes within 2 tiles attack it.', vi: 'Tháp +100% HP; quái trong 2 ô ưu tiên đánh nó.' } },
};
export const MODULE_COST: Cost = { iron: 40, essence: 60 };
export const MODULE_MIN_TIER = 6;
export const MODULE_TOWER_LEVEL = 3;
export const NO_MODULE: ModuleFx = M({});

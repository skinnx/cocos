// SPEC v2 §7.3 + §7.7 the Gloom: base stats (× M(TR) at spawn), budget cost, first TR, region gate, bosses.
import type { EnemyId } from '../api';

export const TAG_ARMORED = 1, TAG_SWARM = 2, TAG_FLYING = 4;

export type EnemyField = 'default' | 'breacher' | 'snuff' | 'straight';

export interface EnemyDef {
  id: EnemyId;
  hp: number;
  speed: number;
  dmg: number;
  rate: number;
  range: number;        // attack reach (tiles)
  bldMul: number;       // damage multiplier vs buildings
  tags: number;
  field: EnemyField;
  cost: number;
  fromTr: number;       // §8.2 "Từ TR"
  region: number;       // §7.7: region that must be open
  radius: number;       // collision radius
  weight: number;       // composition weight
  pack?: number;        // spawns in packs of N
  boss?: boolean;
  fireImmune?: boolean;
}

const E = (id: EnemyId, d: Omit<EnemyDef, 'id' | 'region'> & { region?: number }): EnemyDef => ({ id, region: 1, ...d });

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  gloomling: E('gloomling', { hp: 20, speed: 1.6, dmg: 4, rate: 1, range: 0.9, bldMul: 1, tags: 0, field: 'default', cost: 4, fromTr: 1, radius: 0.3, weight: 3 }),
  skitter: E('skitter', { hp: 12, speed: 2.8, dmg: 3, rate: 1.5, range: 0.8, bldMul: 1, tags: TAG_SWARM, field: 'default', cost: 3, fromTr: 2, radius: 0.22, weight: 2, pack: 5 }),
  spitter: E('spitter', { hp: 30, speed: 1.3, dmg: 6, rate: 0.8, range: 4, bldMul: 1, tags: 0, field: 'default', cost: 9, fromTr: 3, radius: 0.3, weight: 2 }),
  brute: E('brute', { hp: 120, speed: 0.9, dmg: 18, rate: 0.7, range: 1.0, bldMul: 2, tags: TAG_ARMORED, field: 'breacher', cost: 22, fromTr: 4, radius: 0.42, weight: 1.2 }),
  wisp: E('wisp', { hp: 18, speed: 1.8, dmg: 5, rate: 1, range: 0.9, bldMul: 1, tags: TAG_FLYING, field: 'straight', cost: 7, fromTr: 6, radius: 0.25, weight: 1.5 }),
  bomber: E('bomber', { hp: 25, speed: 2.0, dmg: 60, rate: 1, range: 0.9, bldMul: 1, tags: 0, field: 'default', cost: 10, fromTr: 7, radius: 0.3, weight: 1.2 }),
  snuffer: E('snuffer', { hp: 60, speed: 1.2, dmg: 8, rate: 1, range: 0.9, bldMul: 1, tags: 0, field: 'snuff', cost: 16, fromTr: 8, radius: 0.34, weight: 1 }),
  burrower: E('burrower', { hp: 45, speed: 1.4, dmg: 7, rate: 1, range: 0.9, bldMul: 1, tags: 0, field: 'default', cost: 12, fromTr: 10, region: 2, radius: 0.3, weight: 1.3 }),
  shrieker: E('shrieker', { hp: 40, speed: 1.5, dmg: 0, rate: 1, range: 0, bldMul: 0, tags: 0, field: 'default', cost: 14, fromTr: 13, region: 2, radius: 0.3, weight: 0.8 }),
  hurler: E('hurler', { hp: 90, speed: 0.8, dmg: 22, rate: 0.4, range: 7, bldMul: 1, tags: TAG_ARMORED, field: 'default', cost: 26, fromTr: 18, region: 3, radius: 0.4, weight: 0.8 }),
  frostwraith: E('frostwraith', { hp: 55, speed: 1.6, dmg: 6, rate: 1, range: 0.9, bldMul: 1, tags: TAG_FLYING, field: 'straight', cost: 18, fromTr: 28, region: 4, radius: 0.3, weight: 1 }),
  cinderling: E('cinderling', { hp: 35, speed: 2.2, dmg: 5, rate: 1, range: 0.8, bldMul: 1, tags: TAG_SWARM, field: 'default', cost: 9, fromTr: 38, region: 5, radius: 0.25, weight: 1.5, fireImmune: true }),
  // bosses (HP = BALANCE.boss[id]); champion = Blood Moon elite (HP ×6 of its base type at spawn)
  mossback: E('mossback', { hp: 1500, speed: 0.5, dmg: 40, rate: 1, range: 1.6, bldMul: 1, tags: TAG_ARMORED, field: 'straight', cost: 0, fromTr: 99, radius: 1.1, weight: 0, boss: true }),
  briarqueen: E('briarqueen', { hp: 3200, speed: 0.6, dmg: 22, rate: 0.8, range: 1.2, bldMul: 1.5, tags: 0, field: 'breacher', cost: 0, fromTr: 99, region: 2, radius: 0.5, weight: 0, boss: true }),
  colossus: E('colossus', { hp: 6000, speed: 0.45, dmg: 40, rate: 0.6, range: 1.4, bldMul: 2, tags: TAG_ARMORED, field: 'breacher', cost: 0, fromTr: 99, region: 3, radius: 0.6, weight: 0, boss: true }),
  rimefather: E('rimefather', { hp: 9000, speed: 0.6, dmg: 30, rate: 0.8, range: 1.3, bldMul: 1.5, tags: 0, field: 'breacher', cost: 0, fromTr: 99, region: 4, radius: 0.55, weight: 0, boss: true }),
  unlit: E('unlit', { hp: 12000, speed: 0.7, dmg: 25, rate: 1, range: 1.3, bldMul: 1, tags: 0, field: 'default', cost: 0, fromTr: 99, region: 5, radius: 0.45, weight: 0, boss: true }),
  champion: E('champion', { hp: 120, speed: 0.9, dmg: 18, rate: 0.8, range: 1.0, bldMul: 2, tags: TAG_ARMORED, field: 'breacher', cost: 0, fromTr: 99, radius: 0.45, weight: 0 }),
};

export const WAVE_ENEMIES: EnemyId[] = ['gloomling', 'skitter', 'spitter', 'brute', 'wisp', 'bomber', 'snuffer', 'burrower', 'shrieker', 'hurler', 'frostwraith', 'cinderling'];
export const BOSS_IDS = ['mossback', 'briarqueen', 'colossus', 'rimefather', 'unlit'] as const;
export const REGION_BOSS = ['mossback', 'briarqueen', 'colossus', 'rimefather', 'unlit'] as const; // index = region-1
export const isBossId = (id: EnemyId) => !!ENEMIES[id].boss;

export const BOMBER = { radius: 1.5, bldDmg: 60, heroDmg: 15, seek: 6 };
export const SNUFFER = { snuffSeconds: 1.5, sacredMul: 2 };
export const BURROWER = { burrowSecs: 2 };
export const SHRIEKER = { auraRange: 3, auraSpeed: 1.3, deathStun: 1, standBack: 2.5 };
export const HURLER = { range: 7 };
export const FROSTWRAITH = { freezeSecs: 3, perTowerCd: 6 };
export const CINDERLING = { burnDps: 5, burnSecs: 6 };
export const CHAMPION = { summonEvery: 10, summonCount: 3, hasteRange: 3, hasteMul: 1.3, shieldArc: Math.PI / 2, scale: 1.75 };
export const MOSSBACK = { crushDps: 40, shellEvery: 8, shellSecs: 3, shellSpawn: 6, heroMulInShell: 2, enrageFrac: 0.3, enrageSpeed: 0.8 };
export const BRIARQUEEN = { thornEvery: 10, thornLen: 5, thornHp: 80, thornSecs: 8, summonEvery: 14, summonCount: 3, rootsAt: 0.4, rootsTowers: 2, rootsSecs: 4, fireMul: 1.5 };
export const COLOSSUS = { throwEvery: 5, throwRange: 9, throwDmg: 60, throwRadius: 1.5, warnSecs: 1.2, armAt: [2 / 3, 1 / 3] };
export const RIMEFATHER = { auraRange: 5, blizzardEvery: 12, blizzardSecs: 4, blizzardLightMul: 0.5, summonEvery: 12, summonCount: 2 };
export const UNLIT = { pulseEvery: 12, pulseRadius: 8, pulseSecs: 6, hearthLightMul: 0.6, summonEvery: 10, summonWisps: 4, teleportAt: [0.66, 0.33], healFrac: 0.05, finalAt: 0.25, darkDps: 3 };

// SPEC §7.3 the Gloom (+ bosses). `militia` is a friendly barracks unit (rendered from the enemy sprite set),
// its stats live in buildings.ts MILITIA; it is listed here for completeness of EnemyId.
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
  firstNight: number;
  radius: number;       // collision radius
  weight: number;       // composition weight
  pack?: number;        // spawns in packs of N
  boss?: boolean;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  gloomling: { id: 'gloomling', hp: 20, speed: 1.6, dmg: 4, rate: 1, range: 0.9, bldMul: 1, tags: 0, field: 'default', cost: 4, firstNight: 1, radius: 0.3, weight: 3 },
  skitter: { id: 'skitter', hp: 12, speed: 2.8, dmg: 3, rate: 1.5, range: 0.8, bldMul: 1, tags: TAG_SWARM, field: 'default', cost: 3, firstNight: 2, radius: 0.22, weight: 2, pack: 5 },
  spitter: { id: 'spitter', hp: 30, speed: 1.3, dmg: 6, rate: 0.8, range: 4, bldMul: 1, tags: 0, field: 'default', cost: 9, firstNight: 3, radius: 0.3, weight: 2 },
  brute: { id: 'brute', hp: 120, speed: 0.9, dmg: 18, rate: 0.7, range: 1.0, bldMul: 2, tags: TAG_ARMORED, field: 'breacher', cost: 22, firstNight: 4, radius: 0.42, weight: 1.2 },
  wisp: { id: 'wisp', hp: 18, speed: 1.8, dmg: 5, rate: 1, range: 0.9, bldMul: 1, tags: TAG_FLYING, field: 'straight', cost: 7, firstNight: 6, radius: 0.25, weight: 1.5 },
  bomber: { id: 'bomber', hp: 25, speed: 2.0, dmg: 60, rate: 1, range: 0.9, bldMul: 1, tags: 0, field: 'default', cost: 10, firstNight: 7, radius: 0.3, weight: 1.2 },
  snuffer: { id: 'snuffer', hp: 60, speed: 1.2, dmg: 8, rate: 1, range: 0.9, bldMul: 1, tags: 0, field: 'snuff', cost: 16, firstNight: 8, radius: 0.34, weight: 1 },
  mossback: { id: 'mossback', hp: 1000, speed: 0.5, dmg: 40, rate: 1, range: 1.6, bldMul: 1, tags: TAG_ARMORED, field: 'straight', cost: 0, firstNight: 5, radius: 1.1, weight: 0, boss: true },
  unlit: { id: 'unlit', hp: 6500, speed: 1.0, dmg: 25, rate: 1, range: 1.3, bldMul: 1, tags: 0, field: 'default', cost: 0, firstNight: 10, radius: 0.45, weight: 0, boss: true },
  militia: { id: 'militia', hp: 50, speed: 2.2, dmg: 6, rate: 1, range: 1.1, bldMul: 1, tags: 0, field: 'default', cost: 0, firstNight: 99, radius: 0.3, weight: 0 },
};

export const WAVE_ENEMIES: EnemyId[] = ['gloomling', 'skitter', 'spitter', 'brute', 'wisp', 'bomber', 'snuffer'];

export const BOMBER = { radius: 1.5, bldDmg: 60, heroDmg: 15, seek: 6 };
export const SNUFFER = { snuffSeconds: 1.5 };
export const MOSSBACK = { crushDps: 40, shellEvery: 8, shellSecs: 3, shellSpawn: 6, heroMulInShell: 2, enrageFrac: 0.3, enrageSpeed: 0.8 };
export const UNLIT = { pulseEvery: 12, pulseRadius: 8, pulseSecs: 6, hearthLightMul: 0.6, summonEvery: 10, summonWisps: 4, teleportAt: [0.66, 0.33], healFrac: 0.05 };

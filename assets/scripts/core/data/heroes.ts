// SPEC §7.1 heroes.
import type { DamageType, HeroId, ProjectileKind } from '../api';

export type SkillId = 'shieldBash' | 'arrowRain' | 'fireWall' | 'miniTurret' | 'sanctum' | 'shadowStep';

export interface HeroDef {
  id: HeroId;
  hp: number;
  dmg: number;
  rate: number;           // attacks / s
  range: number;          // tiles (melee ≈ 1.1)
  melee: boolean;
  dtype: DamageType;
  projectile?: ProjectileKind;
  splash?: number;        // pyro fireball radius
  hitsFlying: boolean;
  crit?: { chance: number; mul: number };
  skill: SkillId;
  skillCd: number;
  unlockEmber: number;
}

export const HEROES: Record<HeroId, HeroDef> = {
  knight: { id: 'knight', hp: 120, dmg: 10, rate: 1.2, range: 1.1, melee: true, dtype: 'impact', hitsFlying: false, skill: 'shieldBash', skillCd: 8, unlockEmber: 0 },
  ranger: { id: 'ranger', hp: 70, dmg: 7, rate: 1.5, range: 5, melee: false, dtype: 'pierce', projectile: 'arrow', hitsFlying: true, skill: 'arrowRain', skillCd: 10, unlockEmber: 50 },
  pyro: { id: 'pyro', hp: 60, dmg: 14, rate: 0.6, range: 4, melee: false, dtype: 'fire', projectile: 'fireball', splash: 1.2, hitsFlying: true, skill: 'fireWall', skillCd: 14, unlockEmber: 120 },
  tinker: { id: 'tinker', hp: 80, dmg: 6, rate: 1.0, range: 1.1, melee: true, dtype: 'impact', hitsFlying: false, skill: 'miniTurret', skillCd: 16, unlockEmber: 120 },
  cleric: { id: 'cleric', hp: 75, dmg: 4, rate: 1.0, range: 3, melee: false, dtype: 'spark', projectile: 'spark', hitsFlying: true, skill: 'sanctum', skillCd: 18, unlockEmber: 200 },
  rogue: { id: 'rogue', hp: 65, dmg: 6, rate: 2.5, range: 1.1, melee: true, dtype: 'pierce', hitsFlying: true, crit: { chance: 0.25, mul: 2.5 }, skill: 'shadowStep', skillCd: 9, unlockEmber: 200 },
};

export const HERO_IDS: HeroId[] = ['knight', 'ranger', 'pyro', 'tinker', 'cleric', 'rogue'];

export const SKILLS = {
  shieldBash: { range: 2, stun: 1, dmg: 10, cone: Math.PI / 2.2 },
  arrowRain: { arrows: 5, spread: 0.5, dmgMul: 1.4, range: 6 },
  fireWall: { length: 4, dps: 8, secs: 4, width: 0.8 },
  miniTurret: { secs: 8 },
  sanctum: { radius: 2.5, secs: 5, hps: 10, enemyDmgMul: 0.8 },
  shadowStep: { range: 6, nextHitMul: 3 },
  passive: { tauntRange: 2, rangerDarkMul: 1.25, tinkerRepairHps: 8, tinkerRepairRange: 3, tinkerCostMul: 0.9, clericHealHps: 6, clericRange: 4, rogueSpeedMul: 1.3 },
};

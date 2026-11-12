// SPEC §17 balance constants. Numbers are tuning starting points (tuned to pass §13.6 gates);
// keys beyond §17 are additions needed by the simulation (documented inline).
export const BALANCE = {
  tile: 16, mapSize: 56, simHz: 30,
  day: { seconds: 75, firstDaySeconds: 60, callNightGoldPerSec: 0.5, buildTimeScale: 0.25 },
  night: { hpScale: (n: number) => 1 + 0.4 * Math.max(0, n - 5), enrageAfter: 105, enrageSpeedMul: 1.5, enrageDmgMul: 3, spawnWindow: (n: number) => Math.min(70, 35 + 4 * n), pulseMin: 6, pulseMax: 8 },
  budget: (n: number) => 40 + 28 * n + 4 * n * n, bossBudgetMul: 0.6, endlessMul: 1.18,
  riftsActive: (n: number) => (n <= 2 ? 1 : n <= 5 ? 2 : n <= 8 ? 3 : 4), rootBudgetCut: 0.3,
  light: { hearth: [7, 9, 11], brazier: [4, 5.5], leader: 3, leaderFar: 5, dimBand: 1.5, veiledSpeedMul: 1.25, brazierFuelWood: 1, relightSeconds: 2, relightRange: 1.6, pyroRelightRange: 3, fogRadius: 5, fadeSeconds: 3 },
  path: { breachDiv: 8, breachDivBrute: 20, tarCost: 1.5, spikeCost: 0.5, recomputeMaxHz: 5, hpChangeFrac: 0.2, aggroRange: 2.5, leashRange: 4 },
  build: { sellRefund: 0.6, upgradeCostMul: [1, 1.6, 2.5], upgradeDmgMul: 0.4, repairHpPerUnit: 15, nightBuildDelay: 1.5, undoDepth: 20 },
  synergy: { flameRange: 2, flameDps: 3, flameSecs: 3, shatterMul: 1.5, embeddedRangeBonus: 1, rallyRange: 3, rallyRateMul: 1.25, tarSpikeMul: 2 },
  squad: { max: 4, maxWithBoon: 5, harvestRange: 1.2, harvestInterval: 0.6, reviveSeconds: 20, xp: [20, 50, 100, 180], levelMul: 0.12, moveSpeed: 3.2, engageRange: 3.5, followCatchup: 1.35, teleportDist: 12 },
  horn: { charge: 40, seconds: 6, boonSeconds: 10, rateMul: 1.5 },
  start: { wood: 40, stone: 15, gold: 0, freeBraziers: 1 },
  gold: { gloomling: 1, skitter: 1, spitter: 3, brute: 6, wisp: 2, bomber: 3, snuffer: 5, eliteMul: 3, boss: 80 } as Record<string, number>,
  xp: { gloomling: 1, skitter: 1, spitter: 3, brute: 8, wisp: 2, bomber: 3, snuffer: 5, eliteMul: 3, boss: 60 } as Record<string, number>,
  ember: { perNight: 10, perBoss: 50, perCamp: 5, victory: 100 },
  caps: { enemies: 250, projectiles: 60, buildings: 150 },
  elite: { fromNight: 9, maxBudgetFrac: 0.15, hpMul: 2.5, dmgMul: 1.3, costMul: 2.5, scale: 1.25 },
  harvest: { treeChops: 3, treeWood: 2, rockChops: { rock_s: 2, rock_m: 4, rock_l: 7 } as Record<string, number>, rockStone: 2, oreChops: 5, oreGold: 3, regrowDays: 2 },
  poi: { camps: 6, cages: 3, shrines: 3, rifts: 4, cageHp: 40, rootHp: 150, chestGold: 25, campGuardsMin: 4, campGuardsMax: 8, touchRange: 1.4 },
  rarity: { early: [70, 25, 5], late: [55, 35, 10], lateFromNight: 6 },
  boss: { mossbackHp: 1500, unlitHp: 4000 },
  speedEnemyMul: 1,
} as const;

export const DT = 1 / BALANCE.simHz;

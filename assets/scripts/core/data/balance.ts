// SPEC v2 §17 balance constants. Numbers are tuning starting points (tuned to pass §13.6 gates, every change
// logged in docs/DECISIONS.md); keys beyond §17 are additions needed by the simulation (documented inline).
export const BALANCE = {
  tile: 16, mapSize: 96, simHz: 30,
  peace: { seconds: 150, firstSeconds: 150, bellBonusMinLeft: 60, bellLootMul: 1.1, buildModePauses: true },
  night: {
    buildTimeScale: 0.25, enrageAfter: 120, enrageSpeedMul: 1.5, spawnWindow: (tr: number) => Math.min(70, 35 + 2 * tr),
    pulseMin: 6, pulseMax: 8,
    dawnBreaks: 150,             // hard stop: remaining Gloom dissolve at sunrise (guarantees §13.6 "no night > 150 s")
    earlyDawnAfter: 100, earlyDawnSlow: 0.2, // research Flame 8
  },
  threat: {
    budget: (tr: number) => 50 + 30 * tr + 1.2 * tr * tr, statMul: (tr: number) => Math.pow(1.06, tr - 1),
    regionBand: [[1, 10], [8, 20], [16, 30], [26, 40], [36, 50]] as ReadonlyArray<readonly [number, number]>, deepFloor: 46, deepCap: 9999,
    riftsActive: (tr: number, open: number) => Math.min(open, 1 + Math.floor(tr / 6)),
    winGain: { calm: 0, steady: 1, fierce: 1, nightmare: 2 }, lossDrop: 2, rootBudgetCut: 0.3, eliteFromTr: 9, eliteMaxShare: 0.15,
    siegeBudget: 0.8, debutShare: 0.25,
  },
  beacon: {
    calm: { budget: 0.7, loot: 0.6 }, steady: { budget: 1, loot: 1 }, fierce: { budget: 1.35, loot: 1.6 }, nightmare: { budget: 1.8, loot: 2.5, minEliteShare: 0.2 },
  } as Record<'calm' | 'steady' | 'fierce' | 'nightmare', { budget: number; loot: number; minEliteShare?: number }>,
  moon: { cycle: 7, newLight: -1, newVeiledDmg: 1.1, newEssenceMul: 1.5, halfRange: -1, halfTrapMul: 1.5, fullLight: 1, fullHeroDmg: 1.15, fullGoldMul: 1.5, bloodBudget: 1.5, championHpMul: 6, championDmgMul: 1.5 },
  event: { fromTr: 6, chance: 0.2, swarmMul: 1.5, hunters: 3, rainLight: -1, rainFireMul: 0.75 },
  loss: { hearthRelightHp: 0.5, rebuildCostMul: 0.5, stockLoss: 0.2, baseProtected: 100, forcedCalmNights: 2, goldKept: 0.5, heartSleepNights: 2 },
  light: {
    hearth: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16], brazier: [4, 5.5, 7], leader: 3, leaderFar: 5, dimBand: 1.5, veiledSpeedMul: 1.25,
    brazierFuelWood: 1, relightSeconds: 2, relightRange: 1.6, pyroRelightRange: 3, fogRadius: 5, fadeSeconds: 3, watchtower: 7, flare: 3,
  },
  path: { breachDiv: 8, breachDivBrute: 20, tarCost: 1.5, spikeCost: 0.5, recomputeMaxHz: 5, hpChangeFrac: 0.2, aggroRange: 2.5, leashRange: 4 },
  build: { sellRefund: 0.6, upgradeCostMul: [1, 1.6, 2.5], upgradeDmgMul: 0.4, repairHpPerUnit: 15, nightBuildDelay: 1.5, undoDepth: 20, cap: 400, wallCapWeight: 0.25, buildTimeScale: 0.25 },
  synergy: { flameRange: 2, flameDps: 3, flameSecs: 3, shatterMul: 1.5, embeddedRangeBonus: 1, rallyRange: 3, rallyRateMul: 1.25, tarSpikeMul: 2 },
  village: {
    storeBase: 300, storePerLevel: 400, essenceBase: 200, essencePerLevel: 100, vaultPerLevel: 150,
    perWorkerPerMin: { wood: 2, stone: 1.5, iron: 0.5, food: 2 }, offlineRate: 0.25, offlineMaxHours: 8, offlineMaxHoursResearch: 12,
    foodPerVillager: 1, hungryMul: 0.5, wellFedAfter: 3, wellFedMul: 1.1, panicMul: 0.75,
    speed: 1.6, workRange: 1.2, nightShift: 0.25, studyLoreEveryNights: 3, marketGoldPerWorker: 0.05, forgeDiscountPerWorker: 0.1,
  },
  regrowNights: { tree: 2, rock: 4, ore: 6, special: 6, camp: 3, shrine: 5, ruin: 6 },
  hero: {
    maxLevel: 30, levelMul: 0.06, capByStar: [10, 15, 20, 25, 30], unlockShards: 30, starShards: [20, 40, 80, 160], starEssence: [30, 80, 160, 300],
    skillPickLevels: [5, 10, 15, 20, 25], garrisonXpShare: 0.5, garrisonDmgPerLevel: 0.02, squadMax: 4,
  },
  // squad movement/combat constants used by Squad.ts (core-heroes) — kept from v1
  squad: { max: 4, maxWithBoon: 5, harvestRange: 1.2, harvestInterval: 0.6, reviveSeconds: 20, xp: [20, 50, 100, 180], levelMul: 0.12, moveSpeed: 3.2, engageRange: 3.5, followCatchup: 1.35, teleportDist: 12 },
  horn: { charge: 40, seconds: 6, boonSeconds: 10, rateMul: 1.5 },
  expedition: { size: 40, seconds: 180, chests: 3, extractSeconds: 3, failKeep: 0.5, trailsPerDay: 3, trailsMax: 6, islandsPerDay: 3, tiers: 5 },
  dispatch: { durationsMin: [15, 60, 240, 480], perHourFalloff: [1, 1, 0.6, 0.44] },
  daily: { resetHour: 4, bounties: 3, bountyQueueMax: 6, freeRerolls: 1, warmthMax: 7, warmthProd: 0.03, warmthGold: 0.02, travelerEveryDawns: 3, awayMinSeconds: 300 },
  chronicle: { steps: 7, thresholds: [20, 50, 90, 130, 170, 210, 250], deeds: { bounty: 10, night: { calm: 3, steady: 5, fierce: 8, nightmare: 12 }, expedition: 6, bloodMoon: 20 } },
  blessing: { nights: 3, slots: 3, slotsAtTier5: 4, rarity: [70, 25, 5], rarityLate: [55, 35, 10], lateFromTr: 12, rareGiftChance: 0.1 },
  start: { wood: 40, stone: 15, gold: 0, freeBraziers: 1 },
  caps: { enemies: 250, projectiles: 60, villagers: 40 },
  // kill rewards (gold / essence / hero XP) — scaled by beacon loot and moon
  gold: { gloomling: 1, skitter: 1, spitter: 3, brute: 6, wisp: 2, bomber: 3, snuffer: 5, burrower: 4, shrieker: 4, hurler: 7, frostwraith: 5, cinderling: 2, champion: 60, eliteMul: 3, boss: 80 } as Record<string, number>,
  essence: { perKill: 0.25, elite: 2, boss: 40, champion: 15, campChest: 8 },
  xp: { gloomling: 1, skitter: 1, spitter: 3, brute: 8, wisp: 2, bomber: 3, snuffer: 5, burrower: 4, shrieker: 4, hurler: 8, frostwraith: 5, cinderling: 2, champion: 40, eliteMul: 3, boss: 60 } as Record<string, number>,
  elite: { hpMul: 2.5, dmgMul: 1.3, costMul: 2.5, scale: 1.25 },
  harvest: { treeChops: 3, treeWood: 2, rockChops: { rock_s: 2, rock_m: 4, rock_l: 7 } as Record<string, number>, rockStone: 2, oreChops: 5, oreIron: 2, specialChops: 4, specialAmount: 1 },
  poi: {
    cageHp: 40, rootHp: 150, campGuardsMin: 4, campGuardsMax: 8, touchRange: 1.4, cageChance: 0.1, ruinSearchSeconds: 4, ruinLore: [1, 3],
    chestGold: 25, chestShardChance: 0.3, chestShards: 3, heartRange: 2.2, campsPerRegion: 4, shrinesPerRegion: 2, riftsPerRegion: 2,
  },
  veil: { hpPerSec: 0.05, push: 2.5 },
  boss: { mossback: 1500, briarqueen: 3200, colossus: 6000, rimefather: 9000, unlit: 12000 } as Record<string, number>,
  sealReward: { ember: 30, shards: 20 },
  dawnChest: { gold: 20, goldPerTr: 4, essence: 4, essencePerTr: 0.6, shardChance: 0.25, loreChance: 0.15 },
  bellLoot: 1.1,
  hearthTiers: [
    { light: 7, hp: 500, cost: {}, ember: 0 },
    { light: 8, hp: 700, cost: { wood: 80, stone: 40 }, ember: 0 },
    { light: 9, hp: 900, cost: { wood: 200, stone: 150 }, ember: 10 },
    { light: 10, hp: 1150, cost: { wood: 400, stone: 350, iron: 40 }, ember: 25 },
    { light: 11, hp: 1400, cost: { wood: 700, stone: 600, iron: 100 }, ember: 40 },
    { light: 12, hp: 1700, cost: { wood: 1100, stone: 1000, iron: 200 }, ember: 60 },
    { light: 13, hp: 2000, cost: { wood: 1600, stone: 1500, iron: 350 }, ember: 80 },
    { light: 14, hp: 2400, cost: { wood: 2300, stone: 2200, iron: 550 }, ember: 110 },
    { light: 15, hp: 2800, cost: { wood: 3200, stone: 3000, iron: 800 }, ember: 150 },
    { light: 16, hp: 3300, cost: { wood: 4500, stone: 4200, iron: 1200 }, ember: 200 },
  ] as ReadonlyArray<{ light: number; hp: number; cost: { wood?: number; stone?: number; iron?: number }; ember: number }>,
  garrisonSlotsByTier: [0, 0, 2, 2, 4, 4, 4, 6, 6, 6],
} as const;

export const DT = 1 / BALANCE.simHz;

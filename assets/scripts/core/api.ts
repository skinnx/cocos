// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT v2 ("persistent Hold", SPEC.md v2) between the deterministic core
// (assets/scripts/core/**) and every consumer (Cocos view, web preview, bots, tests).
// Rules: no `cc` import anywhere under core/; no Date/Math.random in core (real time
// enters only through resume(now)/tick(now)). Positions in TILE units (+y down),
// time in seconds. Changes: additive only, logged in docs/DECISIONS.md.
// ─────────────────────────────────────────────────────────────────────────────

export type BuildingId =
  | 'hearth' | 'wall_wood' | 'wall_stone' | 'wall_ember' | 'gate' | 'brazier' | 'watchtower'
  | 'tower_arrow' | 'tower_ballista' | 'tower_frost' | 'tower_mortar' | 'tower_spark'
  | 'trap_spikes' | 'trap_tar'
  | 'lumber_camp' | 'quarry' | 'farm' | 'house' | 'storehouse' | 'vault'
  | 'dock' | 'scout_lodge' | 'forge' | 'study' | 'market' | 'tavern' | 'barracks' | 'workshop' | 'dawn_shrine'
  | 'decor_statue' | 'decor_well' | 'decor_garden' | 'decor_lamp' | 'decor_coop' | 'decor_board';
export type HeroId = 'knight' | 'ranger' | 'pyro' | 'tinker' | 'cleric' | 'rogue' | 'beast' | 'warden' | 'shade' | 'bomb';
export type EnemyId =
  | 'gloomling' | 'skitter' | 'spitter' | 'brute' | 'wisp' | 'bomber' | 'snuffer'
  | 'burrower' | 'shrieker' | 'hurler' | 'frostwraith' | 'cinderling'
  | 'mossback' | 'briarqueen' | 'colossus' | 'rimefather' | 'unlit' | 'champion';
export type BossId = 'mossback' | 'briarqueen' | 'colossus' | 'rimefather' | 'unlit';
export type DamageType = 'pierce' | 'impact' | 'fire' | 'frost' | 'spark' | 'true';
export type Biome = 'water' | 'shore' | 'meadow' | 'forest' | 'quarry' | 'ruins' | 'snow' | 'ash';
export type Phase = 'peace' | 'dusk' | 'night' | 'dawn';
export type LightLevel = 0 | 1 | 2;
export type Beacon = 'calm' | 'steady' | 'fierce' | 'nightmare';
export type MoonPhase = 'new' | 'crescent' | 'half' | 'gibbous' | 'full' | 'waning' | 'blood'; // index = (night-1) % 7
export type NightEvent = 'none' | 'swarm' | 'pincer' | 'hunters' | 'short' | 'rain';
export type ResKey = 'wood' | 'stone' | 'gold' | 'iron' | 'food' | 'essence' | 'lore' | 'resin' | 'frost' | 'coal';
export type Resources = Record<ResKey, number>;
export type Cost = Partial<Resources>;
export type Vec = { x: number; y: number };

export type NodeKind = 'pine' | 'oak' | 'snowpine' | 'deadtree' | 'stump' | 'rock_s' | 'rock_m' | 'rock_l' | 'ore' | 'bush' | 'resin' | 'frost' | 'coal';
export type PoiKind = 'camp' | 'cage' | 'shrine' | 'rift' | 'root' | 'chest' | 'ruin' | 'heart';
export type HeroStatus = 'squad' | 'garrison' | 'dispatch' | 'rest';
export type GearSlot = 'weapon' | 'armor' | 'charm';
export type Rarity = 'common' | 'rare' | 'epic';
export type CharmId = 'owl' | 'whetstone' | 'chestnut' | 'tinkerlock' | 'shell' | 'windchime' | 'cateye' | 'hunger' | 'icecore' | 'luckycoin' | 'phoenix' | 'fuse';
export type ModuleId = 'split' | 'barb' | 'frostoil' | 'scope' | 'winch' | 'coalcore' | 'hawkeye' | 'bulwark';
export type DispatchKind = 'forage' | 'hunt' | 'scout';
export type ProjectileKind = 'arrow' | 'bolt' | 'fireball' | 'frost_shard' | 'mortar' | 'spark' | 'spit' | 'turret' | 'javelin' | 'bomb' | 'boulder' | 'barrel';

// ── Commands: the ONLY way a player/bot changes the game. ────────────────────
export type Command =
  // world / combat (v1, kept)
  | { t: 'move'; dir: Vec }
  | { t: 'place'; id: BuildingId; x: number; y: number }
  | { t: 'paint'; id: BuildingId; cells: Vec[] }
  | { t: 'upgrade'; uid: number } | { t: 'repair'; uid: number } | { t: 'sell'; uid: number } | { t: 'undo' }
  | { t: 'buildMode'; on: boolean }
  | { t: 'horn' }
  | { t: 'skipTutorial' }
  // v2: hold loop
  | { t: 'ringBell' }                                          // peace → dusk early
  | { t: 'setBeacon'; beacon: Beacon }                          // dusk only
  | { t: 'startNight' }                                         // dusk → night
  | { t: 'pickGift'; index: number }                            // dawn gift (or chest/expedition boon) choice
  | { t: 'dropBlessing'; id: string }                           // when blessing slots are full
  | { t: 'rerollGifts' }                                        // dawn shrine
  | { t: 'rebuild'; uid: number } | { t: 'rebuildAll' } | { t: 'clearRuin'; uid: number }
  | { t: 'relocate'; uid: number; x: number; y: number }       // peace/dusk only
  | { t: 'bulk'; op: 'upgrade' | 'repair'; uids: number[] }
  | { t: 'upgradeHearth' }
  | { t: 'siegeHeart' }                                         // wake the rift heart when TR is at cap (leader near it)
  // v2: village
  | { t: 'assignWorkers'; uid: number; count: number } | { t: 'autoAssign'; on: boolean }
  // v2: heroes
  | { t: 'setSquad'; heroes: HeroId[] }
  | { t: 'garrison'; hero: HeroId; uid: number | 0 }            // 0 = ungarrison
  | { t: 'dispatch'; hero: HeroId; kind: DispatchKind; minutes: number }
  | { t: 'starUp'; hero: HeroId } | { t: 'pickSkill'; hero: HeroId; level: number; option: 0 | 1 }
  | { t: 'equip'; hero: HeroId; item: number | 0; slot: GearSlot }
  | { t: 'craft'; slot: GearSlot; rarity: Rarity; charm?: CharmId } | { t: 'salvage'; item: number }
  | { t: 'setModule'; uid: number; module: ModuleId | null } | { t: 'craftModule'; module: ModuleId }
  | { t: 'recruit'; index: number }                             // tavern offer
  // v2: progression & daily layer
  | { t: 'research'; branch: 0 | 1 | 2 }
  | { t: 'claimBounty'; index: number } | { t: 'rerollBounty'; index: number } | { t: 'claimChronicle'; step: number }
  | { t: 'trade'; index: number }                               // traveler offer
  | { t: 'setCosmetic'; kind: 'flame' | 'banner' | 'wallSkin'; id: string }
  | { t: 'collectAway' }
  // v2: expedition (runs in its own world; the hold is frozen meanwhile)
  | { t: 'startExpedition'; island: number; tier: number; squad: HeroId[] }
  | { t: 'abandonExpedition' };

// ── Events: one-shot things the view turns into FX/SFX/UI. Drained each frame. ─
export type GameEvent =
  | { t: 'hit'; target: number; amount: number; dtype: DamageType; crit: boolean; shatter: boolean; x: number; y: number }
  | { t: 'death'; uid: number; kind: 'enemy' | 'hero' | 'building' | 'ally'; id: string; x: number; y: number }
  | { t: 'shoot'; from: number; projectile: number; kind: ProjectileKind }
  | { t: 'explode'; x: number; y: number; radius: number }
  | { t: 'harvest'; node: number; res: ResKey; amount: number; x: number; y: number }
  | { t: 'built'; uid: number; id: BuildingId; x: number; y: number }
  | { t: 'buildFail'; reason: BuildFailReason; x: number; y: number }
  | { t: 'upgraded' | 'repaired' | 'sold' | 'rebuilt' | 'relocated'; uid: number }
  | { t: 'loot'; res: ResKey; amount: number; x: number; y: number }
  | { t: 'levelUp'; hero: HeroId }
  | { t: 'skill'; hero: number; skill: string; x: number; y: number }
  | { t: 'phase'; phase: Phase; night: number }
  | { t: 'bossIntro'; id: BossId | 'champion' }
  | { t: 'brazier'; uid: number; lit: boolean }
  | { t: 'horn' } | { t: 'hearthLow' } | { t: 'enrage' } | { t: 'falseDawn' }
  | { t: 'poi'; uid: number; kind: PoiKind; action: 'opened' | 'cleared' | 'freed' | 'used' | 'destroyed' | 'woke' | 'sealed' }
  | { t: 'tutorial'; step: number }
  | { t: 'heal'; target: number; amount: number; x: number; y: number }
  | { t: 'teleport'; uid: number; x: number; y: number }
  | { t: 'pulse'; x: number; y: number; radius: number }
  | { t: 'frozen'; uid: number; seconds: number }               // tower frozen (frostwraith / rimefather)
  | { t: 'burrow'; uid: number; x: number; y: number; up: boolean }
  | { t: 'ignite'; uid: number }                                // cinderling sets a wooden building on fire
  | { t: 'gutter' }                                             // hearth fell: the "fire gutters" screen
  | { t: 'regionSealed'; region: number }
  | { t: 'hearthTier'; tier: number }
  | { t: 'unlock'; what: UnlockKey }                            // a system / building / hero became available
  | { t: 'villager'; uid: number; action: 'arrive' | 'flee' | 'home' | 'work' | 'hungry' }
  | { t: 'storageFull'; res: ResKey }
  | { t: 'bounty'; index: number; done: boolean }
  | { t: 'achievement'; id: string }
  | { t: 'expedition'; action: 'start' | 'chest' | 'extract' | 'timeout' | 'wiped' | 'bossDown' };

export type BuildFailReason = 'cost' | 'blocked' | 'dark' | 'locked' | 'unique' | 'cap' | 'phase';
export type UnlockKey = BuildingId | 'beacon_fierce' | 'beacon_nightmare' | 'dock' | 'bounties' | 'chronicle' | 'garrison' | 'dispatch'
  | 'research' | 'forge' | 'market' | 'modules' | 'squad5' | `hero_${HeroId}` | `region_${number}`;

// ── Read-only snapshot shapes (live objects; view must not mutate). ──────────
export interface StatusFx { burn: number; slow: number; stun: number; veiled: boolean; frozen: number }
export interface Unit { uid: number; x: number; y: number; px: number; py: number; facing: 1 | -1; hp: number; maxHp: number; anim: 'idle' | 'move' | 'attack' | 'down' | 'work' | 'flee' | 'cast' | 'shell' | 'burrow'; animT: number; status: StatusFx }
export interface HeroUnit extends Unit { id: HeroId; skillCd: number; skillCdMax: number; leader: boolean; reviveT: number }
export interface EnemyState extends Unit { id: EnemyId; elite: boolean; flying: boolean; targetUid: number; scale: number; championSkill?: 'summon' | 'haste' | 'shield' }
export type AllyId = 'militia' | 'turret' | 'wolf';
export interface AllyState extends Unit { id: AllyId; owner: number; ttl: number }
export interface Villager extends Unit { variant: 0 | 1 | 2 | 3; home: number; job: number /* building uid, 0 = idle */; hungry: boolean }
export interface BuildingState {
  uid: number; id: BuildingId; x: number; y: number; w: number; h: number; level: number; hp: number; maxHp: number;
  lit: boolean; open: boolean; constructing: number; charges: number; aimAngle: number; wallMask: number;
  synergies: Array<'flame' | 'embedded' | 'rally' | 'tarSpike'>; cooldown: number;
  ruined: boolean;              // v2: rubble left after it broke; rebuild for 50%
  workers: number; workerSlots: number; garrison: HeroId | null; module: ModuleId | null;
  frozenT: number; burningT: number; powered: boolean /* fully lit → village building works */;
}
export interface ProjectileState { uid: number; kind: ProjectileKind; x: number; y: number; px: number; py: number; z: number; angle: number }
export interface ResourceNode { uid: number; kind: NodeKind; x: number; y: number; hp: number; maxHp: number; regrowNights: number; shakeT: number }
export interface PoiState { uid: number; kind: PoiKind; x: number; y: number; hp: number; maxHp: number; active: boolean; region: number; cooldownNights: number; data?: Record<string, unknown> }
export interface ZoneState { uid: number; kind: 'firewall' | 'sanctum' | 'flare' | 'thorns' | 'blizzard' | 'holdline' | 'barrel' | 'smoke'; x: number; y: number; x2: number; y2: number; r: number; t: number; dur: number }
export interface OmenEntry { enemy: EnemyId; count: number; rift: number; elite: number }

export interface BoonDef { id: string; name: string; desc: string; group: 'squad' | 'fort' | 'flame'; rarity: 'common' | 'rare' | 'legendary'; maxStacks: number }
export interface Blessing { id: string; stacks: number; nightsLeft: number }
export type DawnGift =
  | { kind: 'blessing'; boon: string; rarity: BoonDef['rarity'] }
  | { kind: 'resources'; res: ResKey; amount: number }
  | { kind: 'rare'; what: 'shards' | 'gear' | 'lore'; hero?: HeroId; amount: number };

export interface GearItem { uid: number; slot: GearSlot; rarity: Rarity; dmgPct: number; hpPct: number; reducePct: number; charm?: CharmId; onHit?: 'burn' | 'slow' | 'bleed'; equippedBy: HeroId | null }
export interface HeroRecord {
  id: HeroId; owned: boolean; shards: number; stars: 1 | 2 | 3 | 4 | 5; level: number; xp: number;
  skills: Array<0 | 1 | -1>;   // picks at levels 5/10/15/20/25 (-1 = not chosen yet)
  gear: { weapon: number; armor: number; charm: number };  // item uids, 0 = empty
  status: HeroStatus; garrisonUid: number; dispatch: { kind: DispatchKind; endsAt: number; minutes: number } | null;
}
export interface Bounty { template: string; text: string; progress: number; goal: number; done: boolean; claimed: boolean; reward: Cost & { ember?: number; deeds?: number } }
export interface TravelerOffer { give: Cost | { shards: HeroId; amount: number } | { gear: Rarity } | { cosmetic: string }; price: Cost; bought: boolean }
export interface AwaySummary { seconds: number; produced: Cost; dispatches: Array<{ hero: HeroId; kind: DispatchKind; loot: Cost; shards: Partial<Record<HeroId, number>> }>; newBounties: number; traveler: boolean; warmthDelta: number }
export interface LossReport { lost: Cost; ruins: number; rebuildCost: Cost; goldKept: number }
export interface ExpeditionIsland { index: number; biome: Biome; modifier: string; focus: 'iron' | 'essence' | 'shards' | 'lore' | 'regional' | 'blueprint'; maxTier: number }
export interface ExpeditionState {
  island: ExpeditionIsland; tier: number; timeLeft: number; carried: Cost & { shards?: Partial<Record<HeroId, number>>; gear?: number };
  chestsOpened: number; chestsTotal: number; bossDown: boolean; boatX: number; boatY: number; extractT: number;
  boons: Blessing[]; result: null | { outcome: 'extracted' | 'timeout' | 'wiped'; kept: Cost & { shards?: Partial<Record<HeroId, number>> } };
}

export interface GameState {
  seed: number; night: number; phase: Phase; phaseT: number; phaseDur: number; timeScale: number; buildMode: boolean; nightT: number;
  // threat & night
  tr: number; trFloor: number; trCap: number; beacon: Beacon; moon: MoonPhase; nightEvent: NightEvent; forcedCalm: number;
  omens: OmenEntry[]; enemiesLeft: number;
  boss: { id: BossId | 'champion'; hp: number; maxHp: number; uid: number } | null;
  siege: boolean;               // tonight is a rift-heart siege
  // world (map of the hold; replaced by the expedition map while one runs — check `expedition`)
  map: { size: number; biome: Biome[]; variant: Uint8Array; explored: Uint8Array; light: Uint8Array; lightAlpha: Float32Array; region: Uint8Array /* 1..5 */; veil: Uint8Array /* 1 = still veiled */ };
  regionsOpen: number;          // 1..5 (6 = deep gloom)
  hearthUid: number; hearthTier: number;  // 1..10
  heroes: HeroUnit[];           // units on the field (squad), garrisoned heroes are drawn on towers via BuildingState.garrison
  enemies: EnemyState[]; buildings: BuildingState[]; projectiles: ProjectileState[]; allies: AllyState[]; zones: ZoneState[];
  villagers: Villager[]; nodes: ResourceNode[]; pois: PoiState[];
  // economy
  res: Resources; ember: number; storageCap: number; essenceCap: number; protected: number; warmth: number; autoAssign: boolean;
  hornCharge: number; hornT: number;
  // roster & items
  roster: Record<HeroId, HeroRecord>; squadMax: number; garrisonSlots: number; dispatchSlots: number;
  gear: GearItem[]; modules: Partial<Record<ModuleId, number>>; blueprints: CharmId[];
  // run-of-the-night rewards
  blessings: Blessing[]; blessingSlots: number; gifts: DawnGift[] | null; giftSource: 'dawn' | 'chest' | 'expedition' | null;
  lossReport: LossReport | null;
  // progression
  research: [number, number, number];   // nodes done per branch (0..8)
  bounties: Bounty[]; bountyRerolls: number; chronicle: { week: number; deeds: number; claimed: number };
  trails: number; islands: ExpeditionIsland[]; traveler: TravelerOffer[] | null; tavernOffer: { hero: HeroId; cost: Cost } | null;
  gloomBook: Partial<Record<EnemyId, { kills: number; seen: boolean }>>; achievements: string[];
  cosmetics: { owned: string[]; flame: string; banner: string; wallSkin: string };
  unlocked: UnlockKey[];        // systems/buildings visible to the player (SPEC §2.7: hidden until unlocked)
  nextGoals: { session: string; day: string; week: string };   // i18n keys/params resolved by t()
  away: AwaySummary | null;     // set by resume(now) when the player was away ≥ 5 min
  scoutedUntil?: number;        // core-heroes: a Scout dispatch lets the player preview omens up to this night number
  expedition: ExpeditionState | null;
  stats: { kills: number; built: number; nightsWon: number; nightsLost: number; bosses: number; camps: number; expeditions: number; goldEarned: number };
  tutorial: number; buffs: { shrine: 'damage' | 'towerRate' | 'heal' | null; falseDawnT: number; hearthLightMul: number };
  clock: { lastNow: number; dayKey: number /* days since epoch at 04:00 local, passed in by the view */ };
}

export interface Settings { music: number; sfx: number; haptics: boolean; bigText: boolean; lang: 'en' | 'vi' }
export interface BuildCheck { ok: boolean; reason?: BuildFailReason; cost: Cost }

export interface Game {
  readonly state: GameState;
  update(dt: number): void;     // real seconds; fixed 1/30 s steps × timeScale
  step(): void;
  cmd(c: Command): void;
  drainEvents(): GameEvent[];
  canPlace(id: BuildingId, x: number, y: number): BuildCheck;
  buildingCost(id: BuildingId, level?: number): Cost;
  alpha(): number;
  hash(): string;
  /** Real-time entry points. `now` = ms since epoch, `dayKey` = local calendar day index with the 04:00 rollover. */
  resume(now: number, dayKey: number): AwaySummary | null;
  tick(now: number, dayKey: number): void;     // call ~1/s while open (dispatch completion, daily rollover)
  save(): string;               // full hold JSON (emberhold.hold.v2)
}

// Implemented in core/sim/Game.ts:
//   createHold(opts: { seed: number; saved?: string; now: number; dayKey: number; legacyMeta?: string | null }): Game
//   loadSettings(json) / defaultSettings() / saveSettings(s)
//   HOLD_KEY = 'emberhold.hold.v2', HOLD_BAK_KEY = 'emberhold.hold.v2.bak', SETTINGS_KEY = 'emberhold.settings.v1'
//   settleOffline(state, elapsedSec) (pure, exported for tests)
// Data tables in core/data/*.ts. Expedition world: core/sim/expedition/*.

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT between the deterministic core (assets/scripts/core/**) and every
// consumer (Cocos view layer, web preview, bots, tests).
// Rules: no `cc` import anywhere under core/. Units: positions in TILE units
// (float, tile (x,y) covers [x,x+1)×[y,y+1)), time in seconds, angles radians.
// Changing a type here = tell every workstream (docs/CONTRACT.md).
// ─────────────────────────────────────────────────────────────────────────────

export type BuildingId =
  | 'hearth' | 'wall_wood' | 'wall_stone' | 'gate' | 'brazier'
  | 'tower_arrow' | 'tower_ballista' | 'tower_frost' | 'tower_mortar'
  | 'trap_spikes' | 'trap_tar' | 'lumber_camp' | 'quarry'
  | 'tower_spark' | 'barracks' | 'workshop' | 'tavern';
export type HeroId = 'knight' | 'ranger' | 'pyro' | 'tinker' | 'cleric' | 'rogue';
export type EnemyId = 'gloomling' | 'skitter' | 'spitter' | 'brute' | 'wisp' | 'bomber' | 'snuffer' | 'mossback' | 'unlit' | 'militia';
export type DamageType = 'pierce' | 'impact' | 'fire' | 'frost' | 'spark';
export type Biome = 'water' | 'shore' | 'meadow' | 'forest' | 'quarry' | 'ruins';
export type Phase = 'day' | 'dusk' | 'night' | 'dawn' | 'victory' | 'defeat';
export type LightLevel = 0 | 1 | 2; // 0 dark, 1 dim, 2 lit
export type Resources = { wood: number; stone: number; gold: number };
export type Vec = { x: number; y: number };

export type NodeKind = 'pine' | 'oak' | 'stump' | 'rock_s' | 'rock_m' | 'rock_l' | 'ore' | 'bush';
export type PoiKind = 'camp' | 'cage' | 'shrine' | 'rift' | 'root' | 'chest';

// ── Commands: the ONLY way a player/bot changes the game. ────────────────────
export type Command =
  | { t: 'move'; dir: Vec }                                   // leader joystick, |dir|<=1; {0,0} = stop
  | { t: 'place'; id: BuildingId; x: number; y: number }      // top-left tile of footprint
  | { t: 'paint'; id: BuildingId; cells: Vec[] }              // 1×1 paintables only; places as many as affordable
  | { t: 'upgrade'; uid: number }
  | { t: 'repair'; uid: number }
  | { t: 'sell'; uid: number }
  | { t: 'undo' }                                             // undo last place/paint of the current build session
  | { t: 'buildMode'; on: boolean }                           // opens/closes a build session (time scale 0.25 in day/night)
  | { t: 'horn' }
  | { t: 'callNight' }                                        // day → dusk early
  | { t: 'startNight' }                                       // dusk → night
  | { t: 'pickBoon'; index: number }                          // dawn (or chest pick) → resolves pending choice
  | { t: 'swapHero'; reserveIndex: number; squadIndex: number };

// ── Events: one-shot things the view turns into FX/SFX/UI. Drained each frame. ─
export type GameEvent =
  | { t: 'hit'; target: number; amount: number; dtype: DamageType; crit: boolean; shatter: boolean; x: number; y: number }
  | { t: 'death'; uid: number; kind: 'enemy' | 'hero' | 'building'; id: string; x: number; y: number }
  | { t: 'shoot'; from: number; projectile: number; kind: ProjectileKind }
  | { t: 'explode'; x: number; y: number; radius: number }
  | { t: 'harvest'; node: number; res: keyof Resources; amount: number; x: number; y: number }
  | { t: 'built'; uid: number; id: BuildingId; x: number; y: number }
  | { t: 'buildFail'; reason: 'cost' | 'blocked' | 'dark' | 'locked'; x: number; y: number }
  | { t: 'upgraded' | 'repaired' | 'sold'; uid: number }
  | { t: 'gold'; amount: number; x: number; y: number }
  | { t: 'levelUp'; hero: number }
  | { t: 'skill'; hero: number; skill: string; x: number; y: number }
  | { t: 'phase'; phase: Phase; night: number }
  | { t: 'bossIntro'; id: 'mossback' | 'unlit' }
  | { t: 'brazier'; uid: number; lit: boolean }
  | { t: 'horn' }
  | { t: 'poi'; uid: number; kind: PoiKind; action: 'opened' | 'cleared' | 'freed' | 'used' | 'destroyed' }
  | { t: 'boonOffer'; source: 'dawn' | 'chest' }
  | { t: 'hearthLow' }
  | { t: 'tutorial'; step: number };

export type ProjectileKind = 'arrow' | 'bolt' | 'fireball' | 'frost_shard' | 'mortar' | 'spark' | 'spit' | 'turret';

// ── Read-only snapshot shapes (the live state objects; view must not mutate). ─
export interface StatusFx { burn: number; slow: number; stun: number; veiled: boolean }
export interface Unit { uid: number; x: number; y: number; px: number; py: number; /* prev pos for interpolation */ facing: 1 | -1; hp: number; maxHp: number; anim: 'idle' | 'move' | 'attack' | 'down'; animT: number; status: StatusFx }
export interface HeroState extends Unit { id: HeroId; level: number; xp: number; skillCd: number; skillCdMax: number; leader: boolean; reviveT: number }
export interface EnemyState extends Unit { id: EnemyId; elite: boolean; flying: boolean; targetUid: number | 0 }
export interface BuildingState { uid: number; id: BuildingId; x: number; y: number; w: number; h: number; level: 1 | 2 | 3; hp: number; maxHp: number; lit: boolean /* brazier burning */; open: boolean /* gate */; constructing: number; charges: number /* traps */; aimAngle: number; wallMask: number /* N1 E2 S4 W8 */; synergies: Array<'flame' | 'embedded' | 'rally' | 'tarSpike'>; cooldown: number }
export interface ProjectileState { uid: number; kind: ProjectileKind; x: number; y: number; px: number; py: number; z: number /* arc height in tiles */; angle: number }
export interface ResourceNode { uid: number; kind: NodeKind; x: number; y: number; hp: number; maxHp: number; regrowT: number; shakeT: number }
export interface PoiState { uid: number; kind: PoiKind; x: number; y: number; hp: number; maxHp: number; active: boolean; data?: Record<string, unknown> }
export interface Boon { id: string; name: string; desc: string; group: 'squad' | 'fort' | 'flame'; rarity: 'common' | 'rare' | 'legendary'; stacks: number; maxStacks: number }
export interface OmenEntry { enemy: EnemyId; count: number; rift: number; elite: number }

export interface GameState {
  seed: number; night: number; phase: Phase; phaseT: number; phaseDur: number; timeScale: number;
  res: Resources; hornCharge: number; hornT: number; buildMode: boolean;
  map: { size: number; biome: Biome[]; /* size*size, index y*size+x */ variant: Uint8Array; explored: Uint8Array; light: Uint8Array /* LightLevel per tile */; lightAlpha: Float32Array /* smoothed overlay alpha per tile, ready to render */ };
  hearthUid: number; hearthLevel: 1 | 2 | 3;
  heroes: HeroState[]; reserve: HeroId[];
  enemies: EnemyState[]; buildings: BuildingState[]; projectiles: ProjectileState[];
  nodes: ResourceNode[]; pois: PoiState[];
  boons: Boon[]; boonOffer: Boon[] | null; omens: OmenEntry[]; enemiesLeft: number;
  boss: { id: 'mossback' | 'unlit'; hp: number; maxHp: number; uid: number } | null;
  stats: { kills: number; built: number; nightsSurvived: number; bosses: number; camps: number; goldEarned: number };
  tutorial: number; // -1 = off/done
}

export interface MetaState {
  version: 1; ember: number; unlockedHeroes: HeroId[]; unlockedBlueprints: BuildingId[];
  talents: Record<string, number>; tutorialDone: boolean; starterHero: HeroId;
  settings: { music: number; sfx: number; haptics: boolean; bigText: boolean; lang: 'en' | 'vi' };
}

export interface BuildCheck { ok: boolean; reason?: 'cost' | 'blocked' | 'dark' | 'locked'; cost: Resources }

export interface Game {
  readonly state: GameState;
  readonly meta: MetaState;
  /** Advance by real seconds; internally fixed 1/30 s steps × timeScale. */
  update(dt: number): void;
  /** Exactly one fixed step (tests/bots). */
  step(): void;
  cmd(c: Command): void;
  drainEvents(): GameEvent[];
  canPlace(id: BuildingId, x: number, y: number): BuildCheck;
  buildingCost(id: BuildingId, level?: 1 | 2 | 3): Resources;
  /** Interpolation alpha for rendering between prev and current fixed step. */
  alpha(): number;
  /** Deterministic hash of the sim state (tests). */
  hash(): string;
  saveRun(): string; // JSON
  emberEarned(): number;
}

// Implemented in core/sim/Game.ts:
//   export function createGame(opts: { seed: number; meta: MetaState; saved?: string }): Game
//   export function defaultMeta(): MetaState
//   export function loadMeta(json: string | null): MetaState
// Data tables in core/data/*.ts (BUILDINGS, HEROES, ENEMIES, BOONS, BALANCE).

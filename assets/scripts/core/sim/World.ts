// Internal world model shared by all systems. Public state (GameState) holds extended entity objects
// whose extra fields are internal; everything in `s` and `r` is plain JSON-able data (saved by Save.ts).
// Derived caches (occupancy grids, light, flow fields, spatial hash) are rebuilt from that data.
import type {
  AllyState, BuildingId, BuildingState, Cost, EnemyState, GameEvent, GameState, HeroUnit, PoiState,
  ProjectileKind, ProjectileState, ResourceNode, ResKey, Resources, Vec, DamageType, NodeKind, EnemyId, Villager,
} from '../api';
import { Rng, type RngState } from './Rng';
import type { FlowField } from './FlowField';
import type { SpatialHash } from './SpatialHash';

export interface EnemyX extends EnemyState {
  spd: number; dmg: number; rate: number; range: number; radius: number; tags: number;
  atkCd: number;
  wave: boolean;            // counts towards night completion
  guard: number;            // guarded POI uid (0 = wave enemy)
  hx: number; hy: number;   // home (guards) / spawn point
  mode: number;             // see EMODE
  burnDps: number; slowAmt: number; slowT: number; frostT: number;
  snuffT: number;           // snuffer contact timer
  lastCell: number;
  gold: number; xp: number;
  t1: number; t2: number; t3: number; // behaviour timers (boss pulse/summon/shell…)
  flags: number;            // boss teleport flags, burrower used, …
  shell: number;            // mossback: >0 while withdrawn; burrower: >0 while underground
  dead: boolean;
  vx: number; vy: number;   // last velocity (mortar prediction)
  stuckT: number;
  dotFire: number; dotFrost: number; // accumulated damage-over-time, applied every 0.5 s
  revealT: number;          // research Flame 3: revealed for N s after crossing dim light
  hasteT: number;           // shrieker/champion aura
}

export const EMODE = { path: 0, chase: 1, attackBld: 2, snuff: 3, ret: 4, idle: 5 } as const;

export interface HeroX extends HeroUnit {
  atkCd: number;
  nextHitMul: number;       // rogue shadow step
  harvestCd: number;
  relightT: number;
  combatT: number;          // seconds since last combat
  twinT: number;            // pending second cast (twin boon), -1 none
  stuckT: number;
  dead: boolean;
  tgt: number;
  // v1 fallback squad fields (level/xp mirrored from the roster record)
  level: number; xp: number;
  searchT?: number;         // ruin search timer (Harvest.ts)
}

export interface AllyX extends AllyState {
  atkCd: number; hx: number; hy: number; dmg: number; rate: number; range: number; dead: boolean;
}

export interface BuildingX extends BuildingState {
  pathHp: number;           // HP used by the last flow-field compute
  invested: Cost;           // total spent (refunds)
  session: number;          // build session id when placed (undo / 100% refund)
  snuffed: boolean;         // put out by snuffer/boss → needs a hero to relight
  offT: number;             // temporarily off (Unlit pulse, roots)
  fueled: boolean;          // has fuel tonight
  relightT: number;
  burnT: number;            // tar burning seconds left
  dead: boolean;            // removed OR ruined (ruins keep ruined=true and stay in s.buildings)
  dusk: boolean;            // placed during current dusk (100% refund)
  synMask: number;          // synergy bitmask mirrored into `synergies`
  produceAcc: number;       // fractional production
  wraithCd: number;         // frostwraith per-tower cooldown
  igniteT: number;          // cinderling fire spread timer
  shieldT: number;          // warden/last-stand invulnerability
  mode: number;             // quarry: 0 stone, 1 iron
}

export interface ProjectileX extends ProjectileState {
  sx: number; sy: number; tx: number; ty: number; vx: number; vy: number;
  speed: number; t: number; T: number;
  target: number;           // homing target uid (0 none)
  dmg: number; dtype: DamageType;
  src: number; srcKind: 0 | 1 | 2 | 3; // 0 building, 1 hero, 2 enemy, 3 ally
  pierce: number; hit: number[]; splash: number; chain: number;
  flame: boolean; crit: boolean; hitsFlying: boolean; dead: boolean; maxDist: number;
}

export interface NodeX extends ResourceNode { orig: NodeKind; region: number }

export interface PoiX extends PoiState { guards: number }

export interface VillagerX extends Villager {
  path: number[];           // remaining cells
  goal: number;             // goal cell (-1 none)
  wanderT: number;
  inside: boolean;          // hiding in its house (night)
  evacuated: boolean;
}

export interface SpawnEntry { t: number; rift: number; enemy: EnemyId; elite: boolean; champion?: 'summon' | 'haste' | 'shield' }

export interface UndoEntry { uids: number[]; cost: Cost; session: number }

export interface HoldData {
  version: 2;
  rng: RngState;
  uid: number;
  stepN: number;
  input: Vec;
  spawn: SpawnEntry[];
  spawnIdx: number;
  rootCut: number[];        // rift indices whose root was destroyed today
  fieldDirty: boolean; fieldLastStep: number; snuffDirty: boolean;
  undo: UndoEntry[];
  session: number;
  shrineUntil: number;
  falseDawnUsed: boolean;
  hearthLowWarned: boolean;
  tut: { moved: number; walls: number; startX: number; startY: number };
  enraged: boolean;
  nightKills: number; nightGold: number; nightEssence: number;
  bossSpawned: boolean;
  heading: Vec;
  tutHarvested: boolean;
  // v2 hold loop
  cycleNight: number;       // normal nights played (moon cycle; sieges don't count)
  activeRifts: number[];    // rift indices active tonight
  lastRifts: number[];
  bell: boolean;            // dusk bell rung with ≥ 60 s left (+10% loot)
  lostTonight: number;      // buildings broken tonight
  lastStandUsed: boolean;
  hearthHitT: number;       // seconds since the hearth was last hit (rebirth blessing)
  dawns: number;
  pendingBlessing: string | null;
  giftRerolled: boolean;
  wellFed: number;          // consecutive fully-fed dawns
  hungry: boolean;
  panic: boolean;           // village light snuffed tonight → −25% tomorrow
  panicDay: boolean;        // today's production suffers
  firstDawnDone: boolean;
  firstBuilt: string[];     // building ids built at least once
  unlockLog: number[];      // nights at which meaningful unlocks happened (pacing gate)
  sessions: number;
  lastPlayDay: number;      // dayKey of the last night played (warmth)
  warmthDay: number;        // dayKey warmth was last granted
  studyNights: number;
  champion: boolean;        // blood moon champion spawned
  heartRegion: number;      // region of tonight's siege (0 none)
  counters: Record<string, number>;
  rerollDay: number;
  travelerDawn: number;
  peaceSaveT: number;
}

export interface World {
  s: GameState;
  r: HoldData;
  rng: Rng;
  size: number;
  // derived
  terrain: Uint8Array;      // 0 walkable, 1 blocked (tree/big rock/ore/cage), 2 water
  nodeAt: Int32Array;       // index+1 into s.nodes
  bldAt: Int32Array;        // uid of blocking building on cell
  trapAt: Int32Array;       // uid of walk-over building (traps, farms) on cell
  ruinAt: Int32Array;       // uid of ruin on cell
  poiAt: Int32Array;        // uid of blocking POI on cell
  staticLight: Uint8Array;  // light from static sources only (build rule 1)
  lightDirty: boolean;
  wallMaskDirty: boolean;
  fields: { def: FlowField; brk: FlowField; snuff: FlowField };
  ehash: SpatialHash;
  bmap: Map<number, BuildingX>;
  emap: Map<number, EnemyX>;
  events: GameEvent[];
  hearth: BuildingX;
  duskSave: string | null;  // hold snapshot taken at the start of NIGHT / expedition (save() returns it meanwhile)
}

export function newUid(w: World): number { return ++w.r.uid; }

export function emit(w: World, e: GameEvent): void {
  if (w.events.length > 4000) w.events.splice(0, 1000);
  w.events.push(e);
}

export const idx = (w: World, x: number, y: number) => y * w.size + x;
export const inMap = (w: World, x: number, y: number) => x >= 0 && y >= 0 && x < w.size && y < w.size;

// ── resources ──────────────────────────────────────────────────────────────────
export const RES_KEYS: ResKey[] = ['wood', 'stone', 'gold', 'iron', 'food', 'essence', 'lore', 'resin', 'frost', 'coal'];
export const STORED_KEYS: ResKey[] = ['wood', 'stone', 'iron', 'food', 'resin', 'frost', 'coal'];
export function zeroRes(): Resources { return { wood: 0, stone: 0, gold: 0, iron: 0, food: 0, essence: 0, lore: 0, resin: 0, frost: 0, coal: 0 }; }

export function capOf(s: GameState, k: ResKey): number {
  if (k === 'gold' || k === 'lore') return Infinity;
  if (k === 'essence') return s.essenceCap;
  return s.storageCap;
}

/** Add a resource respecting storage caps. Returns the amount actually added. */
export function gainRes(w: World, k: ResKey, amount: number): number {
  if (!(amount > 0)) return 0;
  const s = w.s;
  const cap = capOf(s, k);
  const before = s.res[k];
  const after = Math.min(cap, before + amount);
  const added = Math.max(0, after - before);
  if (after > before) s.res[k] = after;
  if (added < amount - 1e-9 && before < cap + 1e-9 && cap !== Infinity) emit(w, { t: 'storageFull', res: k });
  if (k === 'gold') s.stats.goldEarned += added;
  return added;
}

export function canAfford(have: Resources, cost: Cost): boolean {
  for (const k in cost) { const v = cost[k as ResKey] ?? 0; if (v > 0 && have[k as ResKey] < v - 1e-9) return false; }
  return true;
}
export function payCost(w: World, cost: Cost): void {
  for (const k in cost) { const v = cost[k as ResKey] ?? 0; if (v) w.s.res[k as ResKey] -= v; }
}
/** Refund (bypasses caps — it was already stored once). */
export function refund(w: World, cost: Cost, mul = 1): void {
  for (const k in cost) { const v = Math.floor((cost[k as ResKey] ?? 0) * mul); if (v) w.s.res[k as ResKey] += v; }
}
export function addCost(a: Cost, b: Cost, mul = 1): Cost {
  const o: Cost = { ...a };
  for (const k in b) { const v = (b[k as ResKey] ?? 0) * mul; if (v) o[k as ResKey] = (o[k as ResKey] ?? 0) + v; }
  return o;
}
export function scaleCost(c: Cost, m: number): Cost {
  const o: Cost = {};
  for (const k in c) { const v = c[k as ResKey] ?? 0; if (v) o[k as ResKey] = Math.ceil(v * m - 1e-9); }
  return o;
}

// ── blessings ──────────────────────────────────────────────────────────────────
export function boonStacks(w: World, id: string): number {
  const ex = w.s.expedition;
  const list = ex && !ex.result ? ex.boons : w.s.blessings;
  for (const b of list) if (b.id === id) return b.stacks;
  return 0;
}

export function researchDone(w: World, branch: 0 | 1 | 2, node: number): boolean { return w.s.research[branch] >= node; }

export function bCenter(b: BuildingState): Vec { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }

export function dist2(ax: number, ay: number, bx: number, by: number): number { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

/** Distance from point to building footprint rectangle (0 inside). */
export function distToRect(px: number, py: number, b: { x: number; y: number; w: number; h: number }): number {
  const cx = Math.max(b.x, Math.min(px, b.x + b.w));
  const cy = Math.max(b.y, Math.min(py, b.y + b.h));
  return Math.hypot(px - cx, py - cy);
}

export function liveHeroes(w: World): HeroX[] { return (w.s.heroes as HeroX[]).filter((h) => !h.dead); }
export function leader(w: World): HeroX | null {
  for (const h of w.s.heroes as HeroX[]) if (h.leader && !h.dead) return h;
  return null;
}

export const isTower = (id: BuildingId) => id === 'tower_arrow' || id === 'tower_ballista' || id === 'tower_frost' || id === 'tower_mortar' || id === 'tower_spark';
export const isWallLike = (id: BuildingId) => id === 'wall_wood' || id === 'wall_stone' || id === 'wall_ember' || id === 'gate';
export const isWall = (id: BuildingId) => id === 'wall_wood' || id === 'wall_stone' || id === 'wall_ember';
export const isTrap = (id: BuildingId) => id === 'trap_spikes' || id === 'trap_tar';
/** Walk-over buildings (traps and farms) live in trapAt and never block movement. */
export const isFloor = (id: BuildingId) => id === 'trap_spikes' || id === 'trap_tar' || id === 'farm';

export function makeRng(st: RngState): Rng { return new Rng(st); }
export type { ProjectileKind };

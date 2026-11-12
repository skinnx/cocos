// Internal world model shared by all systems. Public state (GameState) holds extended entity objects
// whose extra fields are internal; everything in `s` and `r` is plain JSON-able data (saved by Save.ts).
// Derived caches (occupancy grids, light, flow fields, spatial hash) are rebuilt from that data.
import type {
  AllyState, BuildingId, BuildingState, EnemyState, GameEvent, GameState, HeroState, MetaState, PoiState,
  ProjectileKind, ProjectileState, ResourceNode, Resources, Vec, DamageType, NodeKind, HeroId, EnemyId,
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
  flags: number;            // boss teleport flags etc.
  shell: number;            // mossback: >0 while withdrawn
  dead: boolean;
  scale: number;            // render scale (elite 1.25)
  vx: number; vy: number;   // last velocity (mortar prediction)
}

export const EMODE = { path: 0, chase: 1, attackBld: 2, snuff: 3, ret: 4, idle: 5 } as const;

export interface HeroX extends HeroState {
  atkCd: number;
  nextHitMul: number;       // rogue shadow step
  harvestCd: number;
  relightT: number;
  combatT: number;          // seconds since last combat
  twinT: number;            // pending second cast (twin boon), -1 none
  dead: boolean;
  tgt: number;
}

export interface AllyX extends AllyState {
  atkCd: number; hx: number; hy: number; dmg: number; rate: number; range: number; dead: boolean;
}

export interface BuildingX extends BuildingState {
  pathHp: number;           // HP used by the last flow-field compute
  invested: Resources;      // total spent (refunds)
  session: number;          // build session id when placed (undo / 100% refund)
  produceT: number;
  snuffed: boolean;         // put out by snuffer/boss → needs a hero to relight
  offT: number;             // temporarily off (Unlit pulse)
  fueled: boolean;          // has fuel tonight
  relightT: number;
  burnT: number;            // tar burning seconds left
  dead: boolean;
  dusk: boolean;            // placed during current dusk (100% refund)
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

export interface NodeX extends ResourceNode { orig: NodeKind; }

export interface PoiX extends PoiState { guards: number; } // remaining guard count

export interface SpawnEntry { t: number; rift: number; enemy: EnemyId; elite: boolean }

export interface UndoEntry { uids: number[]; cost: Resources; session: number }

export interface RunData {
  version: 1;
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
  shrineUntil: number;      // night number after which the shrine buff expires (at dawn)
  falseDawnUsed: boolean;
  hearthLowWarned: boolean;
  tut: { moved: number; walls: number; startX: number; startY: number };
  enraged: boolean;
  nightKills: number; nightGold: number;
  starter: HeroId;
  bossSpawned: boolean;
  rallyUntil: number;
}

export interface World {
  s: GameState;
  meta: MetaState;
  r: RunData;
  rng: Rng;
  size: number;
  // derived
  terrain: Uint8Array;      // 0 walkable, 1 blocked (tree/big rock/ore/cage), 2 water
  nodeAt: Int32Array;       // index+1 into s.nodes
  bldAt: Int32Array;        // uid of blocking building on cell
  trapAt: Int32Array;       // uid of trap on cell
  poiAt: Int32Array;        // uid of blocking POI on cell
  staticLight: Uint8Array;  // light from static sources only (build rule 1)
  lightDirty: boolean;
  fields: { def: FlowField; brk: FlowField; snuff: FlowField };
  ehash: SpatialHash;
  bmap: Map<number, BuildingX>;
  emap: Map<number, EnemyX>;
  events: GameEvent[];
  hearth: BuildingX;
}

export function newUid(w: World): number { return ++w.r.uid; }

export function emit(w: World, e: GameEvent): void {
  if (w.events.length > 4000) w.events.splice(0, 1000);
  w.events.push(e);
}

export const idx = (w: World, x: number, y: number) => y * w.size + x;
export const inMap = (w: World, x: number, y: number) => x >= 0 && y >= 0 && x < w.size && y < w.size;

export function addRes(a: Resources, b: Resources, mul = 1): Resources {
  return { wood: a.wood + b.wood * mul, stone: a.stone + b.stone * mul, gold: a.gold + b.gold * mul };
}
export function canAfford(have: Resources, cost: Resources): boolean {
  return have.wood >= cost.wood && have.stone >= cost.stone && have.gold >= cost.gold;
}
export function payRes(w: World, cost: Resources): void {
  w.s.res.wood -= cost.wood; w.s.res.stone -= cost.stone; w.s.res.gold -= cost.gold;
}

export function boonStacks(w: World, id: string): number {
  for (const b of w.s.boons) if (b.id === id) return b.stacks;
  return 0;
}

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
export const isWallLike = (id: BuildingId) => id === 'wall_wood' || id === 'wall_stone' || id === 'gate';
export const isTrap = (id: BuildingId) => id === 'trap_spikes' || id === 'trap_tar';

export function makeRng(st: RngState): Rng { return new Rng(st); }
export type { ProjectileKind };

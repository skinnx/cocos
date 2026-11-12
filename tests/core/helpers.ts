// Scenario helpers for core unit tests (use internal world access).
import type { BuildingId, EnemyId, Game, MetaState } from '../../assets/scripts/core/api';
import { createGame, defaultMeta, worldOf } from '../../assets/scripts/core/sim/Game';
import { spawnBuilding } from '../../assets/scripts/core/sim/Economy';
import { spawnEnemy } from '../../assets/scripts/core/sim/Enemies';
import { rebuildTerrain } from '../../assets/scripts/core/sim/Grid';
import { recomputeFields } from '../../assets/scripts/core/sim/FlowField';
import { computeStaticLight, updateLight } from '../../assets/scripts/core/sim/Light';
import { startDusk, startNight } from '../../assets/scripts/core/sim/Phases';
import type { World, EnemyX, BuildingX, HeroX } from '../../assets/scripts/core/sim/World';

export const C = 28;

export function meta(over: Partial<MetaState> = {}): MetaState { return { ...defaultMeta(), tutorialDone: true, ...over }; }

export function game(seed = 1234, m: MetaState = meta()): { g: Game; w: World } {
  const g = createGame({ seed, meta: m });
  return { g, w: worldOf(g) };
}

/** Empty meadow island (water border), no nodes/guards/POIs except rifts; hearth + gift brazier stay. */
export function flat(seed = 1234, m: MetaState = meta()): { g: Game; w: World } {
  const { g, w } = game(seed, m);
  const n = w.size;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) w.s.map.biome[y * n + x] = x < 2 || y < 2 || x >= n - 2 || y >= n - 2 ? 'water' : 'meadow';
  w.s.nodes = [];
  w.s.pois = w.s.pois.filter((p) => p.kind === 'rift');
  clearEnemies(w);
  rebuildTerrain(w);
  refresh(w);
  return { g, w };
}

export function clearEnemies(w: World): void { w.s.enemies.length = 0; w.emap.clear(); }

export function refresh(w: World): void {
  w.lightDirty = true; computeStaticLight(w); updateLight(w);
  recomputeFields(w, 'all');
}

export function removeGift(w: World): void {
  for (const b of [...w.s.buildings]) if (b.id === 'brazier') { w.s.buildings.splice(w.s.buildings.indexOf(b), 1); w.bmap.delete(b.uid); w.bldAt[b.y * w.size + b.x] = 0; }
  refresh(w);
}

export function addB(w: World, id: BuildingId, x: number, y: number, level: 1 | 2 | 3 = 1): BuildingX {
  const b = spawnBuilding(w, id, x, y, { wood: 0, stone: 0, gold: 0 }, { level });
  refresh(w);
  return b;
}

export function addE(w: World, id: EnemyId, x: number, y: number, o: { elite?: boolean; guard?: number } = {}): EnemyX {
  const e = spawnEnemy(w, id, x, y, { wave: !o.guard, elite: o.elite, guard: o.guard })!;
  w.ehash.rebuild(w.s.enemies);
  return e;
}

/** Enter NIGHT with an empty (never-ending) spawn plan so scenarios control the enemies. */
export function night(w: World, keepPlan = false): void {
  startDusk(w);
  startNight(w);
  if (!keepPlan) { w.r.spawn = [{ t: 1e9, rift: 0, enemy: 'gloomling', elite: false }]; w.r.spawnIdx = 0; }
  clearEnemies(w);
}

export function run(g: Game, seconds: number, each?: () => void): void {
  const steps = Math.round(seconds * 30);
  for (let i = 0; i < steps; i++) { each?.(); g.step(); }
  g.drainEvents();
}

/** Park all heroes far away (so they don't interfere). */
export function parkHeroes(w: World, x = 5, y = 50): void {
  for (const h of w.s.heroes as HeroX[]) { h.x = x; h.y = y; h.px = x; h.py = y; }
}

export function hero(w: World): HeroX { return w.s.heroes[0] as HeroX; }

export function setRes(w: World, wood: number, stone: number, gold: number): void { w.s.res = { wood, stone, gold }; }

/** Follow the default flow field from a cell; returns the visited cells (stops at a building or the goal). */
export function followField(w: World, x: number, y: number, field: 'def' | 'brk' | 'snuff' = 'def', max = 400): number[] {
  const f = w.fields[field];
  const out: number[] = [];
  let c = y * w.size + x;
  for (let i = 0; i < max; i++) {
    const nx = f.next[c];
    if (nx < 0) break;
    out.push(nx);
    if (w.bldAt[nx]) break;
    c = nx;
  }
  return out;
}

// Occupancy grids (terrain, nodes, buildings, traps, blocking POIs), collision and line of sight.
import type { BuildingState } from '../api';
import { BUILDINGS } from '../data/buildings';
import { NODE_BLOCKS } from './MapGen';
import { type World, type BuildingX, isFloor, inMap } from './World';

export function rebuildTerrain(w: World): void {
  const n = w.size;
  w.terrain.fill(0); w.nodeAt.fill(0); w.poiAt.fill(0);
  for (let i = 0; i < n * n; i++) if (w.s.map.biome[i] === 'water') w.terrain[i] = 2;
  w.s.nodes.forEach((nd, k) => {
    const i = nd.y * n + nd.x;
    if (nd.hp <= 0 && nd.kind !== 'stump') return; // depleted rock/ore/special: gone until it regrows
    w.nodeAt[i] = k + 1;
    if (NODE_BLOCKS[nd.kind]) w.terrain[i] = 1;
  });
  for (const p of w.s.pois) if ((p.kind === 'cage' && p.active) || p.kind === 'heart') w.poiAt[p.y * n + p.x] = p.uid;
}

export function rebuildBuildings(w: World): void {
  w.bldAt.fill(0); w.trapAt.fill(0); w.ruinAt.fill(0); w.bmap.clear();
  for (const b of w.s.buildings as BuildingX[]) {
    w.bmap.set(b.uid, b);
    const arr = b.ruined ? w.ruinAt : isFloor(b.id) ? w.trapAt : w.bldAt;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) arr[y * w.size + x] = b.uid;
  }
}

/** Static obstacle (terrain/POI) at cell. */
export function hardBlocked(w: World, cx: number, cy: number): boolean {
  if (!inMap(w, cx, cy)) return true;
  const i = cy * w.size + cx;
  return w.terrain[i] !== 0 || w.poiAt[i] !== 0;
}

export function buildingAt(w: World, cx: number, cy: number): BuildingX | null {
  if (!inMap(w, cx, cy)) return null;
  const u = w.bldAt[cy * w.size + cx];
  return u ? w.bmap.get(u) ?? null : null;
}

/** Cell blocks a ground unit. hero=true lets heroes pass gates. */
export function cellBlocks(w: World, cx: number, cy: number, hero: boolean): boolean {
  if (hardBlocked(w, cx, cy)) return true;
  const u = w.bldAt[cy * w.size + cx];
  if (!u) return false;
  const b = w.bmap.get(u);
  if (b && b.id === 'gate' && (hero || b.open)) return false; // heroes pass gates; an open gate lets Gloom slip through
  return true;
}

function posFree(w: World, x: number, y: number, r: number, hero: boolean): boolean {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    if (!cellBlocks(w, cx, cy, hero)) continue;
    // circle-vs-cell test
    const nx = Math.max(cx, Math.min(x, cx + 1)), ny = Math.max(cy, Math.min(y, cy + 1));
    if ((nx - x) * (nx - x) + (ny - y) * (ny - y) < r * r) return false;
  }
  return true;
}

/** Move a ground unit with axis-separated sliding collision. Returns true if any movement happened. */
export function moveUnit(w: World, u: { x: number; y: number }, dx: number, dy: number, r: number, hero: boolean): boolean {
  const ox = u.x, oy = u.y;
  if (!posFree(w, u.x, u.y, r, hero)) { // stuck inside an obstacle (e.g. pushed) → allow free move out
    u.x += dx; u.y += dy;
    clampMap(w, u);
    return true;
  }
  if (dx !== 0 && posFree(w, u.x + dx, u.y, r, hero)) u.x += dx;
  if (dy !== 0 && posFree(w, u.x, u.y + dy, r, hero)) u.y += dy;
  clampMap(w, u);
  return u.x !== ox || u.y !== oy;
}

export function clampMap(w: World, u: { x: number; y: number }): void {
  const m = w.size - 0.01;
  if (u.x < 0.01) u.x = 0.01; else if (u.x > m) u.x = m;
  if (u.y < 0.01) u.y = 0.01; else if (u.y > m) u.y = m;
}

/** Line of sight blocked by trees/rocks/ore and blocking buildings (not water). */
export function hasLOS(w: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(d / 0.4);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const cx = Math.floor(x0 + (x1 - x0) * t), cy = Math.floor(y0 + (y1 - y0) * t);
    if (!inMap(w, cx, cy)) return false;
    const i = cy * w.size + cx;
    if (w.terrain[i] === 1 || w.bldAt[i]) return false;
  }
  return true;
}

export function footprintCells(b: Pick<BuildingState, 'x' | 'y' | 'w' | 'h'>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) out.push([x, y]);
  return out;
}

export function defOf(b: BuildingState) { return BUILDINGS[b.id]; }

// Bot navigation helpers: BFS over the hero-walkable grid built from the public state.
import type { Game, GameState, Vec } from '../api';

const BLOCK_NODES = new Set(['pine', 'oak', 'rock_l', 'ore']);

export function walkGrid(s: GameState): Uint8Array {
  const n = s.map.size;
  const g = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) if (s.map.biome[i] === 'water') g[i] = 1;
  for (const nd of s.nodes) if (BLOCK_NODES.has(nd.kind)) g[nd.y * n + nd.x] = 1;
  for (const b of s.buildings) {
    if (b.id === 'gate' || b.id === 'trap_spikes' || b.id === 'trap_tar') continue;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) g[y * n + x] = 1;
  }
  for (const p of s.pois) if (p.kind === 'cage' && p.active) g[p.y * n + p.x] = 1;
  return g;
}

/** BFS (8-dir, no corner cutting) from (sx,sy) to any goal cell; returns the cell path (excluding start). */
export function bfs(s: GameState, grid: Uint8Array, sx: number, sy: number, goal: (x: number, y: number) => boolean, maxNodes = 4000): number[] | null {
  const n = s.map.size;
  const start = sy * n + sx;
  const prev = new Int32Array(n * n).fill(-2);
  const q = [start]; prev[start] = -1;
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (let h = 0; h < q.length && h < maxNodes; h++) {
    const c = q[h], x = c % n, y = (c / n) | 0;
    if (c !== start && goal(x, y)) {
      const path: number[] = [];
      for (let k = c; k !== start; k = prev[k]) path.push(k);
      return path.reverse();
    }
    for (const [dx, dy] of D) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = ny * n + nx;
      if (prev[j] !== -2 || grid[j]) continue;
      if (dx && dy && (grid[y * n + nx] || grid[ny * n + x])) continue;
      prev[j] = c; q.push(j);
    }
  }
  if (goal(sx, sy)) return [];
  return null;
}

export interface Walker { path: number[]; key: string; age: number }

export function leaderOf(s: GameState) { return s.heroes.find((h) => h.leader && h.anim !== 'down' && h.hp > 0) ?? null; }

/** Steer the leader toward a goal set; re-plans periodically. Returns true when the goal is reached. */
export function walkTo(game: Game, wk: Walker, key: string, goal: (x: number, y: number) => boolean): boolean {
  const s = game.state;
  const ld = leaderOf(s);
  if (!ld) return false;
  const n = s.map.size;
  const cx = Math.floor(ld.x), cy = Math.floor(ld.y);
  if (goal(cx, cy)) { game.cmd({ t: 'move', dir: { x: 0, y: 0 } }); wk.path = []; return true; }
  wk.age++;
  if (wk.key !== key || wk.age > 45 || !wk.path.length) {
    const p = bfs(s, walkGrid(s), cx, cy, goal);
    wk.path = p ?? []; wk.key = key; wk.age = 0;
    if (!p) { game.cmd({ t: 'move', dir: { x: 0, y: 0 } }); return false; }
  }
  while (wk.path.length && wk.path[0] === cy * n + cx) wk.path.shift();
  // skip waypoints we are already close to
  if (!wk.path.length) { game.cmd({ t: 'move', dir: { x: 0, y: 0 } }); return goal(cx, cy); }
  const c = wk.path[0];
  const tx = (c % n) + 0.5, ty = ((c / n) | 0) + 0.5;
  const dx = tx - ld.x, dy = ty - ld.y, d = Math.hypot(dx, dy);
  if (d < 0.25) { wk.path.shift(); }
  const dir: Vec = d > 0 ? { x: dx / d, y: dy / d } : { x: 0, y: 0 };
  game.cmd({ t: 'move', dir });
  return false;
}

export function stop(game: Game): void { game.cmd({ t: 'move', dir: { x: 0, y: 0 } }); }

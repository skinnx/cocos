// SPEC §7.4: Dijkstra flow fields on the 56×56 grid, 8 directions without corner cutting.
// Buildings are passable at cost 1 + HP/BREACH_DIV (enemies stop and attack them). Three fields:
// default (div 8), breacher (div 20, brutes) and snuff (sources = burning braziers).
import { BALANCE } from '../data/balance';
import { HEARTH_X, HEARTH_Y } from './MapGen';
import { brazierBurning } from './Light';
import { type World, type BuildingX, isTrap } from './World';

export const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

class Heap {
  k = new Float64Array(16384); v = new Int32Array(16384); n = 0;
  push(key: number, val: number) {
    if (this.n >= this.k.length) { const k = new Float64Array(this.n * 2); k.set(this.k); this.k = k; const v = new Int32Array(this.n * 2); v.set(this.v); this.v = v; }
    let i = this.n++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= key) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; }
    this.k[i] = key; this.v[i] = val;
  }
  pop(): number {
    const top = this.v[0]; const key = this.k[--this.n], val = this.v[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= this.n) break;
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= key) break;
      this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
    }
    this.k[i] = key; this.v[i] = val;
    return top;
  }
  topKey() { return this.k[0]; }
}

export class FlowField {
  readonly size: number;
  dist: Float32Array;
  next: Int32Array;      // next cell index toward the goal (-1 = none / goal)
  valid = false;
  private heap = new Heap();
  private done: Uint8Array;
  constructor(size: number) {
    this.size = size;
    this.dist = new Float32Array(size * size).fill(Infinity);
    this.next = new Int32Array(size * size).fill(-1);
    this.done = new Uint8Array(size * size);
  }

  /** enterCost: Infinity = impassable. obstacle(i) = cell blocks corner-cutting. */
  compute(sources: number[], enterCost: Float32Array, obstacle: Uint8Array): void {
    const n = this.size, dist = this.dist, next = this.next, done = this.done, heap = this.heap;
    dist.fill(Infinity); next.fill(-1); done.fill(0); heap.n = 0;
    for (const s of sources) { dist[s] = 0; heap.push(0, s); }
    while (heap.n > 0) {
      const d = heap.topKey(); const b = heap.pop();
      if (done[b]) continue; done[b] = 1;
      if (d > dist[b]) continue;
      const bx = b % n, by = (b / n) | 0;
      const cb = enterCost[b];
      // relax predecessors A = B - dir (moving A→B costs len * cost(B))
      for (let k = 0; k < 8; k++) {
        const dir = DIRS[k];
        const ax = bx - dir[0], ay = by - dir[1];
        if (ax < 0 || ay < 0 || ax >= n || ay >= n) continue;
        const a = ay * n + ax;
        if (done[a] || enterCost[a] === Infinity) continue;
        if (dir[2] !== 1) { // diagonal: both orthogonal cells must be free (no corner cutting)
          if (obstacle[ay * n + bx] || obstacle[by * n + ax]) continue;
        }
        const nd = d + dir[2] * cb;
        if (nd < dist[a]) { dist[a] = nd; next[a] = b; heap.push(nd, a); }
      }
    }
    this.valid = true;
  }
}

const scratch = { cost: new Float32Array(0), costB: new Float32Array(0), obst: new Uint8Array(0) };

function hearthSources(w: World): number[] {
  const out: number[] = [];
  for (let y = HEARTH_Y; y < HEARTH_Y + 2; y++) for (let x = HEARTH_X; x < HEARTH_X + 2; x++) out.push(y * w.size + x);
  return out;
}

export function recomputeFields(w: World, which: 'all' | 'snuff' | 'restore' = 'all'): void {
  const n = w.size, N = n * n;
  if (scratch.cost.length !== N) { scratch.cost = new Float32Array(N); scratch.costB = new Float32Array(N); scratch.obst = new Uint8Array(N); }
  const cost = scratch.cost, costB = scratch.costB, obst = scratch.obst;
  const P = BALANCE.path;
  for (let i = 0; i < N; i++) {
    if (w.terrain[i] !== 0 || w.poiAt[i] !== 0) { cost[i] = Infinity; costB[i] = Infinity; obst[i] = 1; continue; }
    obst[i] = 0; cost[i] = 1; costB[i] = 1;
  }
  for (const b of w.s.buildings as BuildingX[]) {
    if (b.dead) continue;
    if (isTrap(b.id)) {
      const extra = b.id === 'trap_tar' ? P.tarCost : b.charges > 0 ? P.spikeCost : 0;
      const i = b.y * n + b.x; cost[i] += extra; costB[i] += extra;
      continue;
    }
    if (which === 'all') b.pathHp = b.hp;
    const hp = b.pathHp;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const i = y * n + x;
      obst[i] = 1;
      cost[i] = 1 + hp / P.breachDiv; costB[i] = 1 + hp / P.breachDivBrute;
    }
  }
  const hs = hearthSources(w);
  for (const i of hs) { cost[i] = 1; costB[i] = 1; }
  if (which !== 'snuff') {
    w.fields.def.compute(hs, cost, obst);
    w.fields.brk.compute(hs, costB, obst);
  }
  // snuff field: burning braziers are the goals
  const bs: number[] = [];
  for (const b of w.s.buildings as BuildingX[]) if (b.id === 'brazier' && brazierBurning(w, b)) bs.push(b.y * n + b.x);
  if (bs.length) {
    for (const i of bs) cost[i] = 1;
    w.fields.snuff.compute(bs, cost, obst);
  } else w.fields.snuff.valid = false;
  w.r.fieldDirty = false; w.r.snuffDirty = false; w.r.fieldLastStep = w.r.stepN;
}

/** Throttled recompute (≤ recomputeMaxHz). */
export function maybeRecomputeFields(w: World, force = false): void {
  if (!w.r.fieldDirty && !w.r.snuffDirty && !force) return;
  const minSteps = Math.round(BALANCE.simHz / BALANCE.path.recomputeMaxHz);
  if (!force && w.r.stepN - w.r.fieldLastStep < minSteps) return;
  recomputeFields(w, force || w.r.fieldDirty ? 'all' : 'snuff');
}

/** Mark dirty when a building's HP drifted ≥ 20% of max since the last compute. */
export function noteBuildingHp(w: World, b: BuildingX): void {
  if (Math.abs(b.hp - b.pathHp) >= BALANCE.path.hpChangeFrac * b.maxHp) w.r.fieldDirty = true;
}

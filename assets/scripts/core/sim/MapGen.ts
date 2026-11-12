// SPEC §4: procedural 56×56 island from a seed. Pure function of the seed.
import type { Biome, NodeKind, PoiKind } from '../api';
import { BALANCE } from '../data/balance';
import { Rng, hash2, mixSeed } from './Rng';

export const HEARTH_X = 27, HEARTH_Y = 27; // top-left of the 2×2 hearth
export const CENTER = 28;                   // hearth centre (tile units)

export interface GenNode { kind: NodeKind; x: number; y: number }
export interface GenPoi { kind: PoiKind; x: number; y: number; index?: number }
export interface GenMap { size: number; biome: Biome[]; variant: Uint8Array; nodes: GenNode[]; pois: GenPoi[] }

export const NODE_BLOCKS: Record<NodeKind, boolean> = { pine: true, oak: true, stump: false, rock_s: false, rock_m: false, rock_l: true, ore: true, bush: false };
export const isTreeKind = (k: NodeKind) => k === 'pine' || k === 'oak';
export const isRockKind = (k: NodeKind) => k === 'rock_s' || k === 'rock_m' || k === 'rock_l';

function valueNoise(rng: Rng, size: number, cell: number): (x: number, y: number) => number {
  const n = Math.ceil(size / cell) + 2;
  const g = new Float32Array(n * n);
  for (let i = 0; i < g.length; i++) g[i] = rng.next();
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = sm(fx - ix), ty = sm(fy - iy);
    const a = g[iy * n + ix], b = g[iy * n + ix + 1], c = g[(iy + 1) * n + ix], d = g[(iy + 1) * n + ix + 1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

function noise2(rng: Rng, size: number): (x: number, y: number) => number {
  const a = valueNoise(rng, size, 9), b = valueNoise(rng, size, 4);
  return (x, y) => a(x, y) * 0.68 + b(x, y) * 0.32;
}

export function generateMap(seed: number): GenMap {
  const size = BALANCE.mapSize;
  const rng = new Rng(mixSeed(seed, 0x51ed));
  const nEdge = noise2(rng, size), nMoist = noise2(rng, size), nStone = noise2(rng, size);
  const biome: Biome[] = new Array(size * size);
  const dc = (x: number, y: number) => Math.hypot(x + 0.5 - CENTER, y + 0.5 - CENTER);

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = dc(x, y);
    const edge = d / (size / 2) + (nEdge(x, y) - 0.5) * 0.3;
    let b: Biome;
    if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2 || edge > 0.93) b = 'water';
    else if (edge > 0.83) b = 'shore';
    else if (d <= 6.5) b = 'meadow';
    else {
      const s = nStone(x, y), m = nMoist(x, y);
      b = s > 0.6 ? 'quarry' : m > 0.53 ? 'forest' : 'meadow';
    }
    biome[y * size + x] = b;
  }
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && biome[y * size + x] !== 'water';

  // ruins clusters
  const ruinCount = rng.int(2, 3);
  const ruinCenters: Array<[number, number]> = [];
  for (let k = 0, tries = 0; k < ruinCount && tries < 400; tries++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(10, 19);
    const x = Math.floor(CENTER + Math.cos(a) * r), y = Math.floor(CENTER + Math.sin(a) * r);
    if (!land(x, y) || biome[y * size + x] === 'shore') continue;
    if (ruinCenters.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 10)) continue;
    ruinCenters.push([x, y]); k++;
    const rr = rng.range(2, 3.2);
    for (let yy = Math.floor(y - rr); yy <= y + rr; yy++) for (let xx = Math.floor(x - rr); xx <= x + rr; xx++)
      if (land(xx, yy) && Math.hypot(xx - x, yy - y) <= rr && biome[yy * size + xx] !== 'shore') biome[yy * size + xx] = 'ruins';
  }

  // nodes
  const nodeGrid = new Int8Array(size * size).fill(-1); // index into kinds
  const nodes: GenNode[] = [];
  const kindAt = new Map<number, NodeKind>();
  const put = (x: number, y: number, kind: NodeKind) => { const i = y * size + x; if (kindAt.has(i)) return; kindAt.set(i, kind); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const b = biome[y * size + x];
    if (b === 'water' || dc(x, y) <= 6.8) continue;
    const r = rng.next();
    const tree = (): NodeKind => (rng.chance(0.6) ? 'pine' : 'oak');
    if (b === 'forest') { if (r < 0.36) put(x, y, tree()); else if (r < 0.40) put(x, y, 'bush'); else if (r < 0.42) put(x, y, 'rock_s'); }
    else if (b === 'meadow') { if (r < 0.05) put(x, y, tree()); else if (r < 0.10) put(x, y, 'bush'); else if (r < 0.125) put(x, y, 'rock_s'); else if (r < 0.135) put(x, y, 'rock_m'); }
    else if (b === 'quarry') { if (r < 0.08) put(x, y, 'rock_s'); else if (r < 0.15) put(x, y, 'rock_m'); else if (r < 0.19) put(x, y, 'rock_l'); else if (r < 0.21) put(x, y, tree()); }
    else if (b === 'shore') { if (r < 0.02) put(x, y, 'rock_s'); else if (r < 0.04) put(x, y, 'bush'); }
    else if (b === 'ruins') { if (r < 0.04) put(x, y, 'rock_m'); }
  }
  // gold ore 6–8, prefer quarry
  const oreN = rng.int(6, 8);
  for (let k = 0, tries = 0; k < oreN && tries < 3000; tries++) {
    const x = rng.int(3, size - 4), y = rng.int(3, size - 4);
    const b = biome[y * size + x];
    const d = dc(x, y);
    if (!land(x, y) || d < 9 || b === 'shore' || kindAt.has(y * size + x)) continue;
    if (b !== 'quarry' && tries < 1500) continue;
    kindAt.set(y * size + x, 'ore'); k++;
  }

  // POIs
  const pois: GenPoi[] = [];
  const clear = (x: number, y: number, r: number) => {
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++)
      if (Math.hypot(xx - x, yy - y) <= r) kindAt.delete(yy * size + xx);
  };
  // rifts: 4 at the island edge, ≥20 from the Hearth, ≥60° apart
  const a0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < BALANCE.poi.rifts; k++) {
    const a = a0 + (k * Math.PI) / 2 + rng.range(-0.2, 0.2);
    let best = -1;
    for (let r = 20; r < size / 2; r += 0.5) {
      const x = Math.floor(CENTER + Math.cos(a) * r), y = Math.floor(CENTER + Math.sin(a) * r);
      if (land(x, y) && x >= 3 && y >= 3 && x < size - 3 && y < size - 3) best = r; else if (best > 0) break;
    }
    if (best < 0) best = 20.5;
    const r = Math.max(20.5, best - 1);
    const x = Math.floor(CENTER + Math.cos(a) * r), y = Math.floor(CENTER + Math.sin(a) * r);
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (biome[yy * size + xx] === 'water') biome[yy * size + xx] = 'shore';
    clear(x + 0.5, y + 0.5, 2.5);
    pois.push({ kind: 'rift', x, y, index: k });
  }
  const farFromPois = (x: number, y: number, d: number) => pois.every((p) => Math.hypot(p.x - x, p.y - y) >= d);
  const placePois = (kind: PoiKind, n: number, dmin: number, dmax: number, sep: number, preferRuins: boolean) => {
    let placed = 0;
    for (let tries = 0; placed < n && tries < 6000; tries++) {
      let x: number, y: number;
      if (preferRuins && placed < ruinCenters.length && tries < 50) { [x, y] = ruinCenters[placed]; x += rng.int(-1, 1); y += rng.int(-1, 1); }
      else { const a = rng.range(0, Math.PI * 2), r = rng.range(dmin, dmax); x = Math.floor(CENTER + Math.cos(a) * r); y = Math.floor(CENTER + Math.sin(a) * r); }
      const d = dc(x, y);
      if (!land(x, y) || x < 3 || y < 3 || x >= size - 3 || y >= size - 3) continue;
      if (biome[y * size + x] === 'shore' && tries < 3000) continue;
      if (d < dmin - 0.5 || d > dmax + 1) continue;
      if (!farFromPois(x, y, tries < 4000 ? sep : sep * 0.6)) continue;
      clear(x + 0.5, y + 0.5, 1.8);
      pois.push({ kind, x, y }); placed++;
    }
  };
  placePois('shrine', BALANCE.poi.shrines, 8, 21, 6, true);
  placePois('cage', BALANCE.poi.cages, 9, 21, 6, false);
  placePois('camp', BALANCE.poi.camps, 10, 23, 6, false);

  // resource gates within 16 tiles of the Hearth (≥40 trees, ≥20 rocks)
  const count = () => {
    let t = 0, r = 0;
    for (const [i, k] of kindAt) { const x = i % size, y = (i / size) | 0; if (dc(x, y) > 16) continue; if (isTreeKind(k)) t++; else if (isRockKind(k)) r++; }
    return [t, r];
  };
  let [trees, rocks] = count();
  for (let tries = 0; (trees < 44 || rocks < 22) && tries < 20000; tries++) {
    const a = rng.range(0, Math.PI * 2), r = rng.range(8, 15.5);
    const x = Math.floor(CENTER + Math.cos(a) * r), y = Math.floor(CENTER + Math.sin(a) * r);
    const i = y * size + x;
    if (!land(x, y) || kindAt.has(i) || dc(x, y) <= 6.8 || !farFromPois(x, y, 2.5)) continue;
    if (trees < 44) { kindAt.set(i, rng.chance(0.6) ? 'pine' : 'oak'); if (biome[i] === 'meadow' && rng.chance(0.5)) biome[i] = 'forest'; trees++; }
    else { kindAt.set(i, rng.chance(0.5) ? 'rock_s' : 'rock_m'); rocks++; }
  }

  // connectivity: every rift / POI must be reachable from the Hearth (4-connectivity == 8-dir without corner cutting)
  const blocked = (i: number) => biome[i] === 'water' || (kindAt.has(i) && NODE_BLOCKS[kindAt.get(i)!]);
  const reach = () => {
    const seen = new Uint8Array(size * size);
    const q: number[] = [];
    for (let y = HEARTH_Y - 1; y <= HEARTH_Y + 2; y++) for (let x = HEARTH_X - 1; x <= HEARTH_X + 2; x++) { const i = y * size + x; seen[i] = 1; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % size, y = (i / size) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const j = ny * size + nx; if (seen[j] || blocked(j)) continue; seen[j] = 1; q.push(j);
      }
    }
    return seen;
  };
  for (let pass = 0; pass < 3; pass++) {
    const seen = reach();
    let ok = true;
    for (const p of pois) {
      const ring = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      if (ring.some(([dx, dy]) => seen[(p.y + dy) * size + p.x + dx])) continue;
      ok = false;
      // carve a corridor straight to the hearth
      const steps = Math.ceil(Math.hypot(p.x - CENTER, p.y - CENTER) * 2);
      for (let s = 0; s <= steps; s++) {
        const x = Math.floor(p.x + 0.5 + ((CENTER - p.x - 0.5) * s) / steps), y = Math.floor(p.y + 0.5 + ((CENTER - p.y - 0.5) * s) / steps);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
          const i = (y + dy) * size + x + dx;
          if (biome[i] === 'water') biome[i] = 'shore';
          if (kindAt.has(i) && NODE_BLOCKS[kindAt.get(i)!]) kindAt.delete(i);
        }
      }
    }
    if (ok) break;
  }

  const keys = [...kindAt.keys()].sort((a, b) => a - b);
  for (const i of keys) nodes.push({ kind: kindAt.get(i)!, x: i % size, y: (i / size) | 0 });
  void nodeGrid;
  const variant = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) variant[y * size + x] = hash2(x, y, seed);
  return { size, biome, variant, nodes, pois };
}

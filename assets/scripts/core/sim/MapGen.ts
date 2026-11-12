// SPEC v2 §4: procedural 96×96 island from the Hold seed, 5 regions with noisy borders, biomes, nodes and POIs.
// Pure function of the seed: the map is never regenerated — saves store only what changed (nodes, explored, POIs).
import type { Biome, NodeKind, PoiKind } from '../api';
import { BALANCE } from '../data/balance';
import { Rng, hash2, mixSeed } from './Rng';

export const HEARTH_X = 47, HEARTH_Y = 47; // top-left of the 2×2 hearth
export const CENTER = 48;                   // hearth centre (tile units)
export const REGION_R = [16, 30, 44];       // region 1 radius, inner ring outer radius, outer ring outer radius

export interface GenNode { kind: NodeKind; x: number; y: number }
export interface GenPoi { kind: PoiKind; x: number; y: number; index?: number; region: number }
export interface GenMap { size: number; biome: Biome[]; variant: Uint8Array; region: Uint8Array; nodes: GenNode[]; pois: GenPoi[] }

export const NODE_BLOCKS: Record<NodeKind, boolean> = {
  pine: true, oak: true, snowpine: true, deadtree: true, stump: false, rock_s: false, rock_m: false, rock_l: true, ore: true, bush: false, resin: true, frost: true, coal: true,
};
export const isTreeKind = (k: NodeKind) => k === 'pine' || k === 'oak' || k === 'snowpine' || k === 'deadtree';
export const isRockKind = (k: NodeKind) => k === 'rock_s' || k === 'rock_m' || k === 'rock_l';
export const isSpecialKind = (k: NodeKind) => k === 'resin' || k === 'frost' || k === 'coal';

function valueNoise(rng: Rng, size: number, cell: number): (x: number, y: number) => number {
  const n = Math.ceil(size / cell) + 2;
  const g = new Float32Array(n * n);
  for (let i = 0; i < g.length; i++) g[i] = rng.next();
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = Math.max(0, x) / cell, fy = Math.max(0, y) / cell;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = sm(fx - ix), ty = sm(fy - iy);
    const a = g[iy * n + ix], b = g[iy * n + ix + 1], c = g[(iy + 1) * n + ix], d = g[(iy + 1) * n + ix + 1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

function noise2(rng: Rng, size: number): (x: number, y: number) => number {
  const a = valueNoise(rng, size, 11), b = valueNoise(rng, size, 5);
  return (x, y) => a(x, y) * 0.68 + b(x, y) * 0.32;
}

/** Region (1..5) of a tile from its distance/angle to the Hearth plus border noise. */
export function regionOfTile(x: number, y: number, nR: (x: number, y: number) => number, nA: (x: number, y: number) => number): number {
  const dx = x + 0.5 - CENTER, dy = y + 0.5 - CENTER;
  const d = Math.hypot(dx, dy) + (nR(x, y) - 0.5) * 6;
  if (d < REGION_R[0]) return 1;
  const side = (dx + dy) / Math.max(1, Math.hypot(dx, dy)) + (nA(x, y) - 0.5) * 0.7;
  if (d < REGION_R[1]) return side < 0 ? 2 : 3;              // inner ring: north+west arc / east+south arc
  const ns = dy / Math.max(1, Math.hypot(dx, dy)) + (nA(x + 37, y + 11) - 0.5) * 0.6;
  return ns < 0 ? 4 : 5;                                      // outer rim: north (snow) / south (ash)
}

const BIOME_OF_REGION: Biome[] = ['meadow', 'forest', 'quarry', 'snow', 'ash'];

export function generateMap(seed: number): GenMap {
  const size = BALANCE.mapSize;
  const N = size * size;
  const rng = new Rng(mixSeed(seed, 0x51ed));
  const nEdge = noise2(rng, size), nMoist = noise2(rng, size), nStone = noise2(rng, size), nR = noise2(rng, size), nA = noise2(rng, size);
  const biome: Biome[] = new Array(N);
  const region = new Uint8Array(N);
  const dc = (x: number, y: number) => Math.hypot(x + 0.5 - CENTER, y + 0.5 - CENTER);

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const d = dc(x, y);
    const rg = regionOfTile(x, y, nR, nA);
    region[i] = rg;
    const edge = d / 45 + (nEdge(x, y) - 0.5) * 0.12;
    let b: Biome;
    if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2 || edge > 1.0) b = 'water';
    else if (edge > 0.955) b = 'shore';
    else if (d <= 6.5) b = 'meadow';
    else {
      const s = nStone(x, y), m = nMoist(x, y);
      switch (rg) {
        case 1: b = s > 0.66 ? 'quarry' : m > 0.6 ? 'forest' : 'meadow'; break;
        case 2: b = m > 0.36 ? 'forest' : 'meadow'; break;
        case 3: b = s > 0.38 ? 'quarry' : m > 0.62 ? 'forest' : 'meadow'; break;
        default: b = BIOME_OF_REGION[rg - 1];
      }
    }
    biome[i] = b;
  }
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && biome[y * size + x] !== 'water';
  const inner = (x: number, y: number) => x >= 3 && y >= 3 && x < size - 3 && y < size - 3;

  // ruins clusters: 3 in region 3, 1 elsewhere (the ruin POIs sit on them)
  const ruinCenters: Array<[number, number, number]> = [];
  const ruinWant = [1, 1, 3, 1, 1];
  for (let r = 1; r <= 5; r++) {
    for (let k = 0, tries = 0; k < ruinWant[r - 1] && tries < 2000; tries++) {
      const x = rng.int(4, size - 5), y = rng.int(4, size - 5), i = y * size + x;
      if (region[i] !== r || !land(x, y) || biome[i] === 'shore' || dc(x, y) < 9) continue;
      if (ruinCenters.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 9)) continue;
      ruinCenters.push([x, y, r]); k++;
      const rr = rng.range(2, 3);
      for (let yy = Math.floor(y - rr); yy <= y + rr; yy++) for (let xx = Math.floor(x - rr); xx <= x + rr; xx++) {
        if (!land(xx, yy) || Math.hypot(xx - x, yy - y) > rr || biome[yy * size + xx] === 'shore') continue;
        if (r === 3 || r === 1 || r === 2) biome[yy * size + xx] = 'ruins';
      }
    }
  }

  // nodes
  const kindAt = new Map<number, NodeKind>();
  const put = (i: number, kind: NodeKind) => { if (!kindAt.has(i)) kindAt.set(i, kind); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const b = biome[i];
    if (b === 'water' || dc(x, y) <= 6.8) continue;
    const r = rng.next();
    const tree = (): NodeKind => (rng.chance(0.6) ? 'pine' : 'oak');
    switch (b) {
      case 'forest': if (r < 0.34) put(i, tree()); else if (r < 0.38) put(i, 'bush'); else if (r < 0.40) put(i, 'rock_s'); break;
      case 'meadow': if (r < 0.05) put(i, tree()); else if (r < 0.10) put(i, 'bush'); else if (r < 0.125) put(i, 'rock_s'); else if (r < 0.135) put(i, 'rock_m'); break;
      case 'quarry': if (r < 0.08) put(i, 'rock_s'); else if (r < 0.15) put(i, 'rock_m'); else if (r < 0.19) put(i, 'rock_l'); else if (r < 0.21) put(i, tree()); break;
      case 'shore': if (r < 0.02) put(i, 'rock_s'); else if (r < 0.04) put(i, 'bush'); break;
      case 'ruins': if (r < 0.04) put(i, 'rock_m'); break;
      case 'snow': if (r < 0.2) put(i, 'snowpine'); else if (r < 0.23) put(i, 'rock_s'); else if (r < 0.25) put(i, 'rock_m'); else if (r < 0.26) put(i, 'rock_l'); break;
      case 'ash': if (r < 0.1) put(i, 'deadtree'); else if (r < 0.14) put(i, 'rock_s'); else if (r < 0.17) put(i, 'rock_m'); else if (r < 0.185) put(i, 'rock_l'); break;
    }
  }
  const clear = (x: number, y: number, r: number) => {
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++)
      if (Math.hypot(xx - x, yy - y) <= r) kindAt.delete(yy * size + xx);
  };

  // ── POIs ──────────────────────────────────────────────────────────────────
  const pois: GenPoi[] = [];
  const farFromPois = (x: number, y: number, d: number) => pois.every((p) => Math.hypot(p.x - x, p.y - y) >= d);
  const outerR = (r: number) => (r === 1 ? REGION_R[0] : r <= 3 ? REGION_R[1] : REGION_R[2]);
  const innerR = (r: number) => (r === 1 ? 0 : r <= 3 ? REGION_R[0] : REGION_R[1]);
  const okSpot = (x: number, y: number, r: number, allowShore = false) => {
    if (!land(x, y) || !inner(x, y)) return false;
    const i = y * size + x;
    if (region[i] !== r) return false;
    if (!allowShore && biome[i] === 'shore') return false;
    return true;
  };
  // rifts: 2 per region near the region's outer edge, ≥ 14 from the Hearth, far apart
  let riftIndex = 0;
  for (let r = 1; r <= 5; r++) {
    const placed: GenPoi[] = [];
    for (let tries = 0; placed.length < BALANCE.poi.riftsPerRegion && tries < 6000; tries++) {
      const a = rng.range(0, Math.PI * 2);
      const lo = Math.max(14, outerR(r) - (r === 1 ? 2.5 : 5)), hi = outerR(r) - (r === 1 ? 0.5 : 1);
      const rad = rng.range(lo, hi);
      const x = Math.floor(CENTER + Math.cos(a) * rad), y = Math.floor(CENTER + Math.sin(a) * rad);
      if (!okSpot(x, y, r, tries > 3000)) continue;
      if (dc(x, y) < 14) continue;
      const minSep = tries < 4000 ? (r === 1 ? 18 : 22) : 10;
      if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < minSep)) continue;
      if (!farFromPois(x, y, 6)) continue;
      const p: GenPoi = { kind: 'rift', x, y, index: riftIndex++, region: r };
      placed.push(p); pois.push(p);
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (biome[yy * size + xx] === 'water') biome[yy * size + xx] = 'shore';
      clear(x + 0.5, y + 0.5, 2.5);
    }
  }
  // rift hearts: farthest land tile of each region (kept ≥ 4 from rifts)
  for (let r = 1; r <= 5; r++) {
    let best = -1, bd = -1;
    for (let y = 3; y < size - 3; y++) for (let x = 3; x < size - 3; x++) {
      const i = y * size + x;
      if (region[i] !== r || biome[i] === 'water' || biome[i] === 'shore') continue;
      const d = dc(x, y);
      if (d > outerR(r) + 1) continue;
      if (!farFromPois(x, y, 4)) continue;
      if (d > bd) { bd = d; best = i; }
    }
    if (best < 0) continue;
    const x = best % size, y = (best / size) | 0;
    pois.push({ kind: 'heart', x, y, region: r });
    clear(x + 0.5, y + 0.5, 2.2);
  }
  const placeIn = (kind: PoiKind, r: number, n: number, sep: number, centers?: Array<[number, number, number]>) => {
    let placed = 0;
    const cs = centers ? centers.filter((c) => c[2] === r) : [];
    for (let tries = 0; placed < n && tries < 5000; tries++) {
      let x: number, y: number;
      if (placed < cs.length && tries < 60) { x = cs[placed][0] + rng.int(-1, 1); y = cs[placed][1] + rng.int(-1, 1); }
      else {
        const a = rng.range(0, Math.PI * 2), rad = rng.range(Math.max(8, innerR(r) + 2), outerR(r) - 2);
        x = Math.floor(CENTER + Math.cos(a) * rad); y = Math.floor(CENTER + Math.sin(a) * rad);
      }
      if (!okSpot(x, y, r, tries > 3500)) continue;
      if (dc(x, y) < 8) continue;
      if (!farFromPois(x, y, tries < 3000 ? sep : sep * 0.5)) continue;
      clear(x + 0.5, y + 0.5, 1.8);
      pois.push({ kind, x, y, region: r }); placed++;
    }
  };
  for (let r = 1; r <= 5; r++) {
    placeIn('ruin', r, r === 3 ? 3 : 1, 6, ruinCenters);
    placeIn('shrine', r, BALANCE.poi.shrinesPerRegion, 6);
    if (r === 1) placeIn('cage', r, 1, 6);
    placeIn('camp', r, BALANCE.poi.campsPerRegion, r === 1 ? 5 : 7);
  }

  // region 1 resource gate (≥ 40 trees, ≥ 20 rocks)
  const count = () => {
    let t = 0, k = 0;
    for (const [i, kd] of kindAt) { if (region[i] !== 1) continue; if (isTreeKind(kd)) t++; else if (isRockKind(kd)) k++; }
    return [t, k];
  };
  let [trees, rocks] = count();
  for (let tries = 0; (trees < 46 || rocks < 24) && tries < 20000; tries++) {
    const a = rng.range(0, Math.PI * 2), rad = rng.range(8, 15);
    const x = Math.floor(CENTER + Math.cos(a) * rad), y = Math.floor(CENTER + Math.sin(a) * rad);
    const i = y * size + x;
    if (!land(x, y) || region[i] !== 1 || kindAt.has(i) || dc(x, y) <= 6.8 || !farFromPois(x, y, 2.5)) continue;
    if (trees < 46) { kindAt.set(i, rng.chance(0.6) ? 'pine' : 'oak'); if (biome[i] === 'meadow' && rng.chance(0.5)) biome[i] = 'forest'; trees++; }
    else { kindAt.set(i, rng.chance(0.5) ? 'rock_s' : 'rock_m'); rocks++; }
  }

  // connectivity: every POI must be reachable from the Hearth (4-connectivity == 8-dir without corner cutting)
  const blocked = (i: number) => biome[i] === 'water' || (kindAt.has(i) && NODE_BLOCKS[kindAt.get(i)!]);
  const reach = () => {
    const seen = new Uint8Array(N);
    const q: number[] = [];
    for (let y = HEARTH_Y - 1; y <= HEARTH_Y + 2; y++) for (let x = HEARTH_X - 1; x <= HEARTH_X + 2; x++) { const i = y * size + x; seen[i] = 1; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % size, y = (i / size) | 0;
      if (x > 0) { const j = i - 1; if (!seen[j] && !blocked(j)) { seen[j] = 1; q.push(j); } }
      if (x < size - 1) { const j = i + 1; if (!seen[j] && !blocked(j)) { seen[j] = 1; q.push(j); } }
      if (y > 0) { const j = i - size; if (!seen[j] && !blocked(j)) { seen[j] = 1; q.push(j); } }
      if (y < size - 1) { const j = i + size; if (!seen[j] && !blocked(j)) { seen[j] = 1; q.push(j); } }
    }
    return seen;
  };
  const ring = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const reachable = (seen: Uint8Array, p: { x: number; y: number }) => ring.some(([dx, dy]) => seen[(p.y + dy) * size + p.x + dx]);
  for (let pass = 0; pass < 3; pass++) {
    const seen = reach();
    let ok = true;
    for (const p of pois) {
      if (reachable(seen, p)) continue;
      ok = false;
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

  // iron ore 4–6 per region and specialty nodes 6–8 in regions 2/4/5; placed last so they never cut a path
  const placeNodes = (kind: NodeKind, r: number, n: number, minD: number) => {
    let seen = reach();
    for (let k = 0, tries = 0; k < n && tries < 3000; tries++) {
      const x = rng.int(3, size - 4), y = rng.int(3, size - 4), i = y * size + x;
      if (region[i] !== r || !land(x, y) || dc(x, y) < minD || biome[i] === 'shore' || kindAt.has(i) || !farFromPois(x, y, 2.5) || !seen[i]) continue;
      kindAt.set(i, kind);
      const s2 = reach();
      if (pois.every((p) => reachable(s2, p))) { k++; seen = s2; } else kindAt.delete(i);
    }
  };
  for (let r = 1; r <= 5; r++) placeNodes('ore', r, rng.int(4, 6), 9);
  placeNodes('resin', 2, rng.int(6, 8), 17);
  placeNodes('frost', 4, rng.int(6, 8), 31);
  placeNodes('coal', 5, rng.int(6, 8), 31);

  const nodes: GenNode[] = [];
  const keys = [...kindAt.keys()].sort((a, b) => a - b);
  for (const i of keys) nodes.push({ kind: kindAt.get(i)!, x: i % size, y: (i / size) | 0 });
  const variant = new Uint8Array(N);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) variant[y * size + x] = hash2(x, y, seed);
  return { size, biome, variant, region, nodes, pois };
}

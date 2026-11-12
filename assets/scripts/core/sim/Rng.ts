// Seeded mulberry32 RNG. State is a single uint32 so it can be saved/restored.
export interface RngState { s: number }

export function mulberry32Next(st: RngState): number {
  let t = (st.s = (st.s + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export class Rng {
  st: RngState;
  constructor(seed: number | RngState) {
    this.st = typeof seed === 'number' ? { s: seed | 0 } : seed;
  }
  next(): number { return mulberry32Next(this.st); }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  int(a: number, bInclusive: number): number { return a + Math.floor(this.next() * (bInclusive - a + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  weighted(weights: readonly number[]): number {
    let tot = 0; for (const w of weights) tot += w;
    let r = this.next() * tot;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
    return weights.length - 1;
  }
}

/** Mix two integers into a new 32-bit seed (for derived deterministic streams, e.g. omens = seed + night). */
export function mixSeed(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = (h + Math.imul(b | 0, 0xc2b2ae35)) | 0;
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  return (h ^ (h >>> 16)) | 0;
}

/** Stateless hash of tile coordinates → [0,256). */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) & 255;
}

// Pure light-overlay texel generation (no 'cc'). SPEC §5: low-res overlay, 1 texel = 4×4 art px (4 texels per tile),
// colour #1b1b2f, alpha from state.map.lightAlpha (already smoothed by core), NEAREST filtering → stepped edges.
// Fire flicker: the sampling position wobbles by up to ±0.25 tile (sin + noise). At night a faint warm ring
// (alpha 0.08) tints lit areas. Unexplored tiles (fog of war) are fully dark.
export const TEXELS_PER_TILE = 4;
export const DARK_RGB = [0x1b, 0x1b, 0x2f] as const;
export const WARM_RGB = [0xf7, 0xa9, 0x3b] as const;
export const WARM_ALPHA = 0.08;
export const FOG_ALPHA = 0.97;

export interface LightInput {
  size: number;
  lightAlpha: ArrayLike<number>;
  explored: ArrayLike<number>;
  night: boolean;
  /** seconds, for flicker */
  t: number;
}

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Bilinear sample of the per-tile alpha at a tile-space point (tile centres at +0.5). */
export function sampleAlpha(inp: LightInput, tx: number, ty: number): number {
  const n = inp.size;
  const fx = tx - 0.5, fy = ty - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const ux = fx - x0, uy = fy - y0;
  const get = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return inp.night ? 0.85 : 0;
    const i = y * n + x;
    return inp.explored[i] ? inp.lightAlpha[i] : FOG_ALPHA;
  };
  const a = get(x0, y0) * (1 - ux) + get(x0 + 1, y0) * ux;
  const b = get(x0, y0 + 1) * (1 - ux) + get(x0 + 1, y0 + 1) * ux;
  return a * (1 - uy) + b * uy;
}

/** Fill an RGBA8 buffer of (size*4)² texels (row 0 = north). */
export function fillLight(buf: Uint8Array, inp: LightInput): void {
  const n = inp.size, T = TEXELS_PER_TILE, W = n * T;
  // global flicker phase: two sines + a slow noise term, amplitude ±0.25 tile
  const fl = (u: number, v: number) => 0.25 * (0.6 * Math.sin(inp.t * 6.1 + u * 0.9) + 0.4 * Math.sin(inp.t * 9.7 + v * 1.3 + hash2(u | 0, v | 0)));
  for (let ty = 0; ty < W; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const o = (ty * W + tx) * 4;
      const cx = (tx + 0.5) / T, cy = (ty + 0.5) / T;
      const ti = Math.floor(cy) * n + Math.floor(cx);
      let a: number;
      if (!inp.explored[ti]) a = FOG_ALPHA;
      else {
        const j = inp.night ? fl(cx, cy) : 0;
        a = sampleAlpha(inp, cx + j, cy - j * 0.5);
      }
      if (inp.night && a < WARM_ALPHA && inp.explored[ti]) {
        buf[o] = WARM_RGB[0]; buf[o + 1] = WARM_RGB[1]; buf[o + 2] = WARM_RGB[2]; buf[o + 3] = Math.round(WARM_ALPHA * 255);
      } else {
        buf[o] = DARK_RGB[0]; buf[o + 1] = DARK_RGB[1]; buf[o + 2] = DARK_RGB[2];
        buf[o + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
      }
    }
  }
}

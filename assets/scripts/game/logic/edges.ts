// Pure tile + biome-transition overlay selection (no 'cc'). SPEC §4.1 / §9.4.
// Edge overlay naming (tools/art/manifest.mjs): edge_<upper>_<lower>_<piece>. An overlay is drawn ON a tile of the
// LOWER material and paints the UPPER material creeping in from the neighbour side:
//   n/e/s/w  : the neighbour on that side is upper
//   ine..inw : both orthogonal neighbours of that corner are upper (inner corner of the lower region)
//   ne..nw   : only the diagonal neighbour of that corner is upper (outer corner of the upper region)
import type { Biome } from '../../core/api';

export type Material = 'grass' | 'dirt' | 'sand' | 'water' | 'ruins';
export const PAIRS = ['grass_dirt', 'grass_sand', 'sand_water'] as const;

export function materialOf(b: Biome | string): Material {
  switch (b) {
    case 'water': return 'water';
    case 'shore': return 'sand';
    case 'quarry': return 'dirt';
    case 'ruins': return 'ruins';
    default: return 'grass';
  }
}

/** Upper material that overlays onto a lower one, or null when no overlay pair exists. */
export function overlayPair(upper: Material, lower: Material): string | null {
  const lo = lower === 'ruins' ? 'dirt' : lower;
  const key = `${upper}_${lo}`;
  return (PAIRS as readonly string[]).includes(key) ? key : null;
}

/** Base tile sprite name for a biome/variant; water animates over 2 frames. */
export function tileSprite(b: Biome | string, variant: number, waterFrame = 0): string {
  switch (b) {
    case 'water': return `tile_water_${waterFrame & 1}`;
    case 'shore': return `tile_sand_${variant % 3}`;
    case 'quarry': return `tile_dirt_${variant % 3}`;
    case 'ruins': return `tile_ruins_${variant % 3}`;
    case 'forest': return `tile_grass_dark_${variant % 3}`;
    default: {
      // meadow: 4 grass + 2 flower variants mixed by variant byte
      const v = variant % 8;
      return v >= 6 ? `tile_grass_flower_${v - 6}` : `tile_grass_${v % 4}`;
    }
  }
}

const N = 0, E = 1, S = 2, W = 3;
/**
 * Overlay sprite names for the tile at (x, y). `at(x, y)` returns the material at a tile (out of bounds → water).
 */
export function edgeOverlays(x: number, y: number, at: (x: number, y: number) => Material): string[] {
  const me = at(x, y);
  const out: string[] = [];
  // candidate uppers in draw order (lowest first so higher materials draw on top)
  const uppers: Material[] = ['sand', 'grass'];
  for (const up of uppers) {
    if (up === me) continue;
    const pair = overlayPair(up, me);
    if (!pair) continue;
    const isUp = (dx: number, dy: number) => {
      const m = at(x + dx, y + dy);
      // grass also counts as "covering" sand over water etc. via higher priority materials
      return m === up || (up === 'sand' && m === 'grass' && me === 'water');
    };
    const o = [isUp(0, -1), isUp(1, 0), isUp(0, 1), isUp(-1, 0)];
    if (o[N]) out.push(`edge_${pair}_n`);
    if (o[E]) out.push(`edge_${pair}_e`);
    if (o[S]) out.push(`edge_${pair}_s`);
    if (o[W]) out.push(`edge_${pair}_w`);
    const corners: Array<[string, number, number, number, number]> = [
      ['ne', N, E, 1, -1], ['se', S, E, 1, 1], ['sw', S, W, -1, 1], ['nw', N, W, -1, -1]];
    for (const [c, a, b, dx, dy] of corners) {
      if (o[a] && o[b]) out.push(`edge_${pair}_i${c}`);
      else if (!o[a] && !o[b] && isUp(dx, dy)) out.push(`edge_${pair}_${c}`);
    }
  }
  return out;
}

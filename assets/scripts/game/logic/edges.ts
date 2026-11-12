// Pure tile + biome-transition overlay selection (no 'cc'). SPEC §4.1 / §9.4 / §9.9.
// Edge overlay naming (tools/art/manifest.mjs): edge_<upper>_<lower>_<piece>. An overlay is drawn ON a tile of the
// LOWER material and paints the UPPER material creeping in from the neighbour side:
//   n/e/s/w  : the neighbour on that side is upper
//   ine..inw : both orthogonal neighbours of that corner are upper (inner corner of the lower region)
//   ne..nw   : only the diagonal neighbour of that corner is upper (outer corner of the upper region)
// Which material is "upper" for a pair is decided by the pair name that exists in the manifest (EDGE_PAIRS +
// EDGE_PAIRS_V2, mirrored below); MATERIAL_ORDER only fixes the draw order when a tile gets several overlays.
import type { Biome } from '../../core/api';

export type Material = 'water' | 'sand' | 'dirt' | 'ash' | 'grassdark' | 'grass' | 'snow' | 'ruins';
/** Draw order, low → high. */
export const MATERIAL_ORDER: readonly Material[] = ['water', 'sand', 'dirt', 'ash', 'grassdark', 'grass', 'snow', 'ruins'];
/** v1 pairs (manifest EDGE_PAIRS). */
export const PAIRS = ['grass_dirt', 'grass_sand', 'sand_water', 'grass_grassdark', 'ruins_grass', 'grassdark_dirt',
  'grassdark_sand', 'ruins_grassdark', 'dirt_sand', 'ruins_dirt', 'ruins_sand'] as const;
/** v2 pairs (manifest EDGE_PAIRS_V2): snow and ash regions. */
export const EDGE_PAIRS_V2 = ['snow_grass', 'snow_grassdark', 'snow_sand', 'snow_dirt', 'ash_grass', 'ash_grassdark', 'ash_sand',
  'ash_dirt', 'ruins_snow', 'ruins_ash'] as const;
export const ALL_PAIRS: readonly string[] = [...PAIRS, ...EDGE_PAIRS_V2];
const PAIR_SET = new Set(ALL_PAIRS);

export function materialOf(b: Biome | string): Material {
  switch (b) {
    case 'water': return 'water';
    case 'shore': return 'sand';
    case 'quarry': return 'dirt';
    case 'ruins': return 'ruins';
    case 'forest': return 'grassdark';
    case 'snow': return 'snow';
    case 'ash': return 'ash';
    default: return 'grass';
  }
}

/** Overlay pair name when `upper` paints over `lower`, or null when the manifest has no such pair. */
export function overlayPair(upper: Material, lower: Material): string | null {
  const key = `${upper}_${lower}`;
  return PAIR_SET.has(key) ? key : null;
}
/** Pair joining two materials in either direction (null when the two never get a transition). */
export function pairBetween(a: Material, b: Material): string | null { return overlayPair(a, b) ?? overlayPair(b, a); }

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Base tile sprite name for a biome/variant; water and lava animate over 2 frames. */
export function tileSprite(b: Biome | string, variant: number, waterFrame = 0, x = 0, y = 0): string {
  switch (b) {
    case 'water': return `tile_water_${waterFrame & 1}`;
    case 'shore': return `tile_sand_${variant % 3}`;
    case 'quarry': return `tile_dirt_${variant % 3}`;
    case 'ruins': return `tile_ruins_${variant % 3}`;
    case 'forest': return `tile_grass_dark_${variant % 3}`;
    case 'snow': {
      // snow ×3 with the odd patch of ice (§9.9)
      const v = variant % 10;
      return v >= 8 ? `tile_ice_${v - 8}` : `tile_snow_${v % 3}`;
    }
    case 'ash': {
      // ash ground ×3 with cooled-lava cracks that glow over 2 frames
      const v = variant % 10;
      return v >= 8 ? `tile_lava_${(waterFrame + (hash2(x, y) & 1)) & 1}` : `tile_ash_${v % 3}`;
    }
    default: {
      // meadow: 4 grass + 2 flower variants mixed by variant byte
      const v = variant % 8;
      return v >= 6 ? `tile_grass_flower_${v - 6}` : `tile_grass_${v % 4}`;
    }
  }
}

const N = 0, E = 1, S = 2, W = 3;
/** Overlay sprite names for the tile at (x, y). `at(x, y)` returns the material at a tile (out of bounds → water). */
export function edgeOverlays(x: number, y: number, at: (x: number, y: number) => Material): string[] {
  const me = at(x, y);
  const out: string[] = [];
  for (const up of MATERIAL_ORDER) {
    if (up === me) continue;
    const pair = overlayPair(up, me);
    if (!pair) continue;
    // land touching water directly (rare: MapGen normally rings water with shore) gets the sand/foam rim too
    const isUp = (dx: number, dy: number) => {
      const m = at(x + dx, y + dy);
      return m === up || (me === 'water' && up === 'sand' && m !== 'water');
    };
    const o = [isUp(0, -1), isUp(1, 0), isUp(0, 1), isUp(-1, 0)];
    const corners: Array<[string, number, number, number, number]> = [
      ['ne', N, E, 1, -1], ['se', S, E, 1, 1], ['sw', S, W, -1, 1], ['nw', N, W, -1, -1]];
    // inner corners replace the two edge bands they join (art convention, tools/art/sprites/tiles.mjs)
    const covered = [false, false, false, false];
    for (const [c, a, b] of corners) if (o[a] && o[b]) { out.push(`edge_${pair}_i${c}`); covered[a] = covered[b] = true; }
    const sides = ['n', 'e', 's', 'w'];
    for (let k = 0; k < 4; k++) if (o[k] && !covered[k]) out.push(`edge_${pair}_${sides[k]}`);
    for (const [c, a, b, dx, dy] of corners) if (!o[a] && !o[b] && isUp(dx, dy)) out.push(`edge_${pair}_${c}`);
  }
  return out;
}

// ── Gloom veil (§4.2) ───────────────────────────────────────────────────────
/**
 * Veil sprites for a tile: veiled tiles are filled (`veil_fill`); a veiled tile whose northern neighbour is open
 * gets the rolling mist band (`veil_<frame>`, 16×24, overhanging upward) so the border reads as a curtain.
 */
export function veilSprites(x: number, y: number, veiled: (x: number, y: number) => boolean, frame: number): string[] {
  if (!veiled(x, y)) return [];
  const out = ['veil_fill'];
  if (!veiled(x, y - 1) || !veiled(x - 1, y) || !veiled(x + 1, y) || !veiled(x, y + 1)) out.push(`veil_${(frame + ((x * 7 + y * 3) & 3)) & 3}`);
  return out;
}

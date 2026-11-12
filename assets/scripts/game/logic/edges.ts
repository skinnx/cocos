// Pure tile + biome-transition overlay selection (no 'cc'). SPEC §4.1 / §9.4.
// Edge overlay naming (tools/art/manifest.mjs): edge_<upper>_<lower>_<piece>; materials stack in MATERIAL_ORDER. An overlay is drawn ON a tile of the
// LOWER material and paints the UPPER material creeping in from the neighbour side:
//   n/e/s/w  : the neighbour on that side is upper
//   ine..inw : both orthogonal neighbours of that corner are upper (inner corner of the lower region)
//   ne..nw   : only the diagonal neighbour of that corner is upper (outer corner of the upper region)
import type { Biome } from '../../core/api';

export type Material = 'grass' | 'grassdark' | 'dirt' | 'sand' | 'water' | 'ruins';
/** Stacking order, low → high: a higher material's overlay is drawn onto the lower tile. */
// Ruins sit on top: their plazas are compact discs, so the flagstones break up outward onto the surrounding ground.
export const MATERIAL_ORDER: readonly Material[] = ['water', 'sand', 'dirt', 'grassdark', 'grass', 'ruins'];
// One pair for every two land materials MapGen can put side by side (mirror of EDGE_PAIRS in tools/art/manifest.mjs).
export const PAIRS = ['grass_dirt', 'grass_sand', 'sand_water', 'grass_grassdark', 'ruins_grass', 'grassdark_dirt',
  'grassdark_sand', 'ruins_grassdark', 'dirt_sand', 'ruins_dirt', 'ruins_sand'] as const;

export function materialOf(b: Biome | string): Material {
  switch (b) {
    case 'water': return 'water';
    case 'shore': return 'sand';
    case 'quarry': return 'dirt';
    case 'ruins': return 'ruins';
    case 'forest': return 'grassdark';
    default: return 'grass';
  }
}

/** Upper material that overlays onto a lower one, or null when no overlay pair exists. */
export function overlayPair(upper: Material, lower: Material): string | null {
  const key = `${upper}_${lower}`;
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
  for (const up of MATERIAL_ORDER.slice(MATERIAL_ORDER.indexOf(me) + 1)) {
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

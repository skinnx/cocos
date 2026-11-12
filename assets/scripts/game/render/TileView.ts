// Ground tiles with viewport pooling (SPEC §13.3): no node per map tile — a pool of sprites covers the visible tile
// range + 2-tile margin and is re-assigned when the camera crosses a tile boundary. Biome transitions use the
// edge-overlay sprites (computed once per map, static), drawn in a separate layer above the base tiles.
import type { Node } from 'cc';
import type { GameState } from '../../core/api';
import { edgeOverlays, materialOf, tileSprite, type Material } from '../logic/edges';
import { ANIM_FPS } from '../logic/sprites';
import { TILE } from '../logic/camera';
import { SpriteHandle } from './Nodes';

export class TileView {
  private tiles: SpriteHandle[] = [];
  private overlays: SpriteHandle[] = [];
  private edgeCache: string[][] = [];
  private key = '';
  private size = 0;
  private biome: ArrayLike<string> = [];
  private variant: ArrayLike<number> = [];

  constructor(readonly ground: Node, readonly edgeLayer: Node) {}

  /** Bind to a (new) map: precompute the edge overlays for every tile. */
  bind(state: GameState): void {
    const m = state.map;
    this.size = m.size; this.biome = m.biome; this.variant = m.variant;
    const n = m.size;
    const mat = (x: number, y: number): Material => (x < 0 || y < 0 || x >= n || y >= n ? 'water' : materialOf(m.biome[y * n + x]));
    this.edgeCache = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) this.edgeCache.push(edgeOverlays(x, y, mat));
    this.key = '';
  }

  update(range: { x0: number; y0: number; x1: number; y1: number }, t: number): void {
    if (!this.size) return;
    const wf = Math.floor(t * ANIM_FPS.water) & 1;
    const key = `${range.x0},${range.y0},${range.x1},${range.y1},${wf}`;
    if (key === this.key) return;
    this.key = key;
    const n = this.size;
    let ti = 0, oi = 0;
    for (let y = range.y0; y <= range.y1; y++) {
      for (let x = range.x0; x <= range.x1; x++) {
        const inside = x >= 0 && y >= 0 && x < n && y < n;
        const i = y * n + x;
        const name = inside ? tileSprite(this.biome[i], this.variant[i], wf) : `tile_water_${(wf + x + y) & 1}`;
        const h = this.tiles[ti] ?? (this.tiles[ti] = new SpriteHandle('tile', this.ground));
        ti++;
        h.set(name).pos(x * TILE, -y * TILE).show(true);
        if (inside) {
          for (const o of this.edgeCache[i]) {
            const e = this.overlays[oi] ?? (this.overlays[oi] = new SpriteHandle('edge', this.edgeLayer));
            oi++;
            e.set(o).pos(x * TILE, -y * TILE).show(true);
          }
        }
      }
    }
    for (; ti < this.tiles.length; ti++) this.tiles[ti].show(false);
    for (; oi < this.overlays.length; oi++) this.overlays[oi].show(false);
  }
}

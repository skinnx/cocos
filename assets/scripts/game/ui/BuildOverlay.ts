// World-space build-mode visuals (SPEC §6.2, §10.4): faint grid on buildable tiles, diagonal hatch on dark
// unbuildable ground, per-cell green ✓ / red striped ghosts, ghost building sprites, range rings drawn with dot sprites,
// synergy link lines (orange dotted) — all above the light overlay so they read at night.
import type { Node } from 'cc';
import type { BuildingId, GameState } from '../../core/api';
import { BALANCE } from '../../core/data/balance';
import { TILE } from '../logic/camera';
import { isTowerId, previewSprite, rangeRings } from '../logic/catalog';
import { dottedLine, ringPoints } from '../logic/gestures';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';

class Layer {
  private hs: SpriteHandle[] = [];
  private i = 0;
  constructor(readonly node: Node) {}
  begin(): void { this.i = 0; }
  put(name: string, x: number, y: number): SpriteHandle {
    const h = this.hs[this.i] ?? (this.hs[this.i] = new SpriteHandle('o', this.node));
    this.i++;
    return h.set(name).pos(Math.round(x), Math.round(y)).show(true).color(255, 255, 255, 255);
  }
  end(): void { for (let j = this.i; j < this.hs.length; j++) this.hs[j].show(false); }
}

export interface GhostCell { x: number; y: number; ok: boolean }

export class BuildOverlay {
  readonly node: Node;
  private grid: Layer; private ghosts: Layer; private marks: Layer; private rings: Layer;
  private gridKey = ''; private gridAcc = 9;

  constructor(parent: Node) {
    this.node = mkNode('buildOverlay', parent);
    this.grid = new Layer(mkNode('grid', this.node));
    this.ghosts = new Layer(mkNode('ghosts', this.node));
    this.marks = new Layer(mkNode('marks', this.node));
    this.rings = new Layer(mkNode('rings', this.node));
  }

  show(v: boolean): void { if (this.node.active !== v) { this.node.active = v; this.gridKey = ''; } }

  /** Grid / hatch over the visible tiles; `cellState(x,y)` → 'ok' | 'dark' | 'none'. Refreshed when the view moves. */
  drawGrid(range: { x0: number; y0: number; x1: number; y1: number }, dt: number, cellState: (x: number, y: number) => 'ok' | 'dark' | 'none'): void {
    this.gridAcc += dt;
    const key = `${range.x0},${range.y0},${range.x1},${range.y1}`;
    if (key === this.gridKey && this.gridAcc < 0.35) return;
    this.gridKey = key; this.gridAcc = 0;
    this.grid.begin();
    for (let y = range.y0; y <= range.y1; y++) for (let x = range.x0; x <= range.x1; x++) {
      const st = cellState(x, y);
      if (st === 'ok') this.grid.put('ui_grid_cell', x * TILE, -y * TILE).alpha(110);
      else if (st === 'dark') this.grid.put('ui_build_bad', x * TILE, -y * TILE).alpha(70);
    }
    this.grid.end();
  }

  /** Ghosts for the current gesture + range rings + synergy links. */
  drawGhost(s: GameState, id: BuildingId | null, cells: GhostCell[], fp: { x: number; y: number; w: number; h: number } | null,
    selectedUid: number, t: number): void {
    this.ghosts.begin(); this.marks.begin(); this.rings.begin();
    const pulse = 200 + Math.round(40 * Math.sin(t * 8));
    if (id) {
      const spr = previewSprite(id);
      if (fp) {
        // whole-footprint ghost (non-paintable buildings)
        const allOk = cells.every((c) => c.ok);
        const g = this.ghosts.put(spr, (fp.x + fp.w / 2) * TILE, -(fp.y + fp.h) * TILE);
        if (allOk) g.color(255, 255, 255, 170); else g.color(PAL.o[0], PAL.o[1], PAL.o[2], 150);
      } else {
        for (const c of cells) {
          const g = this.ghosts.put(spr, (c.x + 0.5) * TILE, -(c.y + 1) * TILE);
          if (c.ok) g.color(255, 255, 255, 170); else g.color(PAL.o[0], PAL.o[1], PAL.o[2], 140);
        }
      }
      for (const c of cells) this.marks.put(c.ok ? 'ui_build_ok' : 'ui_build_bad', c.x * TILE, -c.y * TILE).alpha(c.ok ? pulse : 220);
      if (fp) {
        const cx = fp.x + fp.w / 2, cy = fp.y + fp.h / 2;
        for (const r of rangeRings(id, 1)) this.ring(cx, cy, r, PAL.z);
        this.links(s, id, fp);
      }
    }
    if (selectedUid) {
      const b = s.buildings.find((q) => q.uid === selectedUid);
      if (b) {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        for (const r of rangeRings(b.id, b.level)) this.ring(cx, cy, r, PAL.D);
      }
    }
    this.ghosts.end(); this.marks.end(); this.rings.end();
  }

  private ring(cx: number, cy: number, r: number, tint: readonly number[]): void {
    for (const p of ringPoints(cx, cy, r, 0.55)) this.rings.put('ui_range_dot', p.x * TILE, -p.y * TILE).color(tint[0], tint[1], tint[2], 220);
  }

  /** Synergy previews (§6.4): flame (tower near lit brazier), embedded (≥2 adjacent walls), tar↔spike. */
  private links(s: GameState, id: BuildingId, fp: { x: number; y: number; w: number; h: number }): void {
    const cx = fp.x + fp.w / 2, cy = fp.y + fp.h / 2;
    const near = (b: { x: number; y: number; w: number; h: number }, r: number) => {
      const dx = Math.max(b.x - (fp.x + fp.w), fp.x - (b.x + b.w), 0), dy = Math.max(b.y - (fp.y + fp.h), fp.y - (b.y + b.h), 0);
      return Math.hypot(dx, dy) <= r;
    };
    const line = (b: { x: number; y: number; w: number; h: number }, tint: readonly number[]) => {
      for (const p of dottedLine(cx, cy, b.x + b.w / 2, b.y + b.h / 2, 0.45)) this.rings.put('ui_link_dot', p.x * TILE, -p.y * TILE).color(tint[0], tint[1], tint[2], 255);
    };
    const flameR = BALANCE.synergy.flameRange;
    if (id === 'tower_arrow' || id === 'tower_ballista') {
      for (const b of s.buildings) if (b.id === 'brazier' && b.lit && near(b, flameR)) line(b, PAL.y);
    }
    if (id === 'brazier') {
      for (const b of s.buildings) if ((b.id === 'tower_arrow' || b.id === 'tower_ballista') && near(b, flameR)) line(b, PAL.y);
    }
    if (isTowerId(id)) {
      const adj = s.buildings.filter((b) => (b.id === 'wall_wood' || b.id === 'wall_stone' || b.id === 'gate') && near(b, 0.01)
        && !(b.x + b.w <= fp.x && b.y + b.h <= fp.y) && !(b.x >= fp.x + fp.w && b.y + b.h <= fp.y)
        && !(b.x + b.w <= fp.x && b.y >= fp.y + fp.h) && !(b.x >= fp.x + fp.w && b.y >= fp.y + fp.h));
      if (adj.length >= 2) for (const b of adj) line(b, PAL.u);
    }
    if (id === 'trap_tar' || id === 'trap_spikes') {
      const other = id === 'trap_tar' ? 'trap_spikes' : 'trap_tar';
      for (const b of s.buildings) if (b.id === other && near(b, 0.01)) line(b, PAL.L);
    }
  }
}

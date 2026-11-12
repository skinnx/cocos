// Build-mode gestures (SPEC §6.2):
//  • paintable 1×1 card selected: touch-drag paints a line, axis-locked to the initial drag direction (diagonal →
//    4-connected Bresenham); green/red ghosts per cell and the running total above the finger; on release the cells
//    are sent as one `paint` command (core places as many as are affordable).
//  • other card selected: tap drops a ghost, drag moves it, floating ✓ / ✕ confirm or cancel; range ring and synergy
//    links are shown while dragging.
//  • no card: one-finger pan; tap a building → radial menu (upgrade / repair / sell).
//  • dragging near a screen edge auto-scrolls the camera. Undo + Done live on the drawer.
import type { Node } from 'cc';
import type { BuildingId, GameState } from '../../core/api';
import type { Ctx } from '../Ctx';
import { edgeScroll } from '../logic/camera';
import { footprint, isPaintable } from '../logic/catalog';
import { cellAt, classifyDrag, footprintOrigin, paintCells, paintPlan, type Cell, type LineMode } from '../logic/gestures';
import { tr } from '../logic/strings';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';
import { BitmapText } from '../ui/BitmapText';
import { affordable, costText, type BuildDrawer } from '../ui/BuildDrawer';
import type { BuildOverlay, GhostCell } from '../ui/BuildOverlay';
import type { RadialMenu } from '../ui/RadialMenu';
import { Button } from '../ui/UiKit';

export class BuildGestures {
  readonly node: Node;
  selected: BuildingId | null = null;
  private stroke: { start: Cell; cur: Cell; mode: LineMode | null; cells: Cell[] } | null = null;
  ghost: { x: number; y: number; w: number; h: number } | null = null;
  private dragGhost = false;
  private pan: { x: number; y: number } | null = null;
  private pointer: { x: number; y: number } | null = null;
  private cells: GhostCell[] = [];
  private confirm: Button; private cancel: Button;
  private total: BitmapText;
  private frameL: SpriteHandle[] = [];
  private gridCache = new Map<number, 'ok' | 'dark' | 'none'>();
  private gridCacheT = 0;

  constructor(parent: Node, readonly ctx: Ctx, readonly drawer: BuildDrawer, readonly overlay: BuildOverlay, readonly radial: RadialMenu) {
    this.node = mkNode('buildUi', parent);
    // blueprint frame corners around the screen while in build mode
    for (let i = 0; i < 4; i++) this.frameL.push(new SpriteHandle('corner', this.node, 'ui_blueprint_corner').anchor(0, 1));
    this.confirm = new Button(this.node, { icon: 'icon_tick', z: 46 });
    this.cancel = new Button(this.node, { icon: 'icon_close', z: 46 });
    this.total = new BitmapText(this.node, { ax: 0.5, ay: 0, color: PAL.w });
    this.confirm.onTap = () => this.place();
    this.cancel.onTap = () => { ctx.sfx('ui_click'); this.ghost = null; };
    drawer.onSelect = (id) => { this.selected = id; this.ghost = null; this.stroke = null; this.radial.close(); };
  }

  layout(): void {
    const L = this.ctx.layout;
    const pts: Array<[number, number, number, number]> = [
      [L.left + 2, L.H - L.top - 2, 1, 1], [L.W - L.right - 2, L.H - L.top - 2, -1, 1],
      [L.left + 2, this.drawer.height + 2, 1, -1], [L.W - L.right - 2, this.drawer.height + 2, -1, -1]];
    pts.forEach(([x, y, sx, sy], i) => this.frameL[i].pos(x, y).scale(sx, sy));
  }

  reset(): void { this.selected = null; this.stroke = null; this.ghost = null; this.pan = null; this.dragGhost = false; this.radial.close(); }

  private valid(id: BuildingId, x: number, y: number): boolean {
    const g = this.ctx.game;
    if (!g) return false;
    const c = g.canPlace(id, x, y);
    return c.ok || c.reason === 'cost';
  }

  // ── touch handlers (UI px, origin bottom-left) ──────────────────────────────
  down(x: number, y: number): void {
    this.pointer = { x, y };
    const tp = this.ctx.uiToTile(x, y);
    const id = this.selected;
    if (id && isPaintable(id)) {
      const c = cellAt(tp.x, tp.y);
      this.stroke = { start: c, cur: c, mode: null, cells: [c] };
      this.radial.close();
      return;
    }
    if (id) {
      const fp = footprint(id);
      if (this.ghost && tp.x >= this.ghost.x - 0.5 && tp.x <= this.ghost.x + fp.w + 0.5 && tp.y >= this.ghost.y - 0.5 && tp.y <= this.ghost.y + fp.h + 0.5) {
        this.dragGhost = true;
      } else {
        const o = footprintOrigin(tp.x, tp.y, fp.w, fp.h);
        this.ghost = { x: o.x, y: o.y, w: fp.w, h: fp.h };
        this.dragGhost = true;
      }
      return;
    }
    this.pan = { x, y };
  }

  move(x: number, y: number): void {
    const prev = this.pointer;
    this.pointer = { x, y };
    if (this.stroke) { this.updateStroke(); return; }
    if (this.dragGhost && this.ghost) { this.updateGhost(); return; }
    if (this.pan && prev) {
      const s = this.ctx.layout.uiS;
      this.ctx.cam.panBy((x - prev.x) * s, (y - prev.y) * s);
      this.pan = { x, y };
    }
  }

  up(x: number, y: number, tap: boolean): void {
    this.pointer = null;
    if (this.stroke) {
      this.updateStroke();
      this.commitStroke();
      this.stroke = null;
      return;
    }
    if (this.dragGhost) { this.dragGhost = false; return; }
    this.pan = null;
    if (tap && !this.selected) {
      const tp = this.ctx.uiToTile(x, y);
      const s = this.ctx.state();
      const b = s.buildings.find((q) => tp.x >= q.x && tp.x < q.x + q.w && tp.y >= q.y && tp.y < q.y + q.h);
      if (b) { this.ctx.sfx('ui_click'); this.radial.open(b.uid); } else this.radial.close();
    }
  }

  private updateStroke(): void {
    const st = this.stroke;
    if (!st || !this.pointer || !this.selected) return;
    const tp = this.ctx.uiToTile(this.pointer.x, this.pointer.y);
    const c = cellAt(tp.x, tp.y);
    st.cur = c;
    if (!st.mode && (c.x !== st.start.x || c.y !== st.start.y)) st.mode = classifyDrag(c.x - st.start.x, c.y - st.start.y);
    st.cells = st.mode ? paintCells(st.start, c, st.mode) : [st.start];
    if (st.cells.length > 40) st.cells = st.cells.slice(0, 40);
  }

  private updateGhost(): void {
    if (!this.pointer || !this.ghost) return;
    const tp = this.ctx.uiToTile(this.pointer.x, this.pointer.y);
    const o = footprintOrigin(tp.x, tp.y, this.ghost.w, this.ghost.h);
    this.ghost.x = o.x; this.ghost.y = o.y;
  }

  private plan(): { cells: GhostCell[]; total: { wood: number; stone: number; gold: number }; count: number } {
    const g = this.ctx.game, id = this.selected;
    if (!g || !id) return { cells: [], total: { wood: 0, stone: 0, gold: 0 }, count: 0 };
    const s = this.ctx.state();
    const cost = g.buildingCost(id, 1);
    if (this.stroke) {
      const p = paintPlan(this.stroke.cells, (c) => this.valid(id, c.x, c.y), cost, s.res);
      return { cells: this.stroke.cells.map((c, i) => ({ x: c.x, y: c.y, ok: p.ok[i] })), total: p.total, count: p.count };
    }
    if (this.ghost) {
      const chk = g.canPlace(id, this.ghost.x, this.ghost.y);
      const out: GhostCell[] = [];
      for (let y = 0; y < this.ghost.h; y++) for (let x = 0; x < this.ghost.w; x++) out.push({ x: this.ghost.x + x, y: this.ghost.y + y, ok: chk.ok });
      return { cells: out, total: cost, count: chk.ok ? 1 : 0 };
    }
    return { cells: [], total: { wood: 0, stone: 0, gold: 0 }, count: 0 };
  }

  private commitStroke(): void {
    const id = this.selected;
    if (!id || !this.stroke) return;
    const p = this.plan();
    const okCells = p.cells.filter((c) => c.ok).map((c) => ({ x: c.x, y: c.y }));
    if (okCells.length) this.ctx.cmd({ t: 'paint', id, cells: okCells });
    if (okCells.length < p.cells.length) {
      // some cells failed: let core report why for the first rejected cell (feedback toast + sfx)
      const bad = p.cells.find((c) => !c.ok)!;
      if (!okCells.length) this.ctx.cmd({ t: 'place', id, x: bad.x, y: bad.y });
      else this.ctx.sfx('place_fail', 1);
    }
  }

  private place(): void {
    const id = this.selected, gh = this.ghost;
    if (!id || !gh) return;
    this.ctx.cmd({ t: 'place', id, x: gh.x, y: gh.y });
    const g = this.ctx.game;
    if (g && g.canPlace(id, gh.x, gh.y).ok === false) return; // core emits buildFail; keep the ghost to adjust
    this.ghost = null;
  }

  /** Grid state of a tile for the overlay (cached ~3×/s). */
  private cellState = (x: number, y: number): 'ok' | 'dark' | 'none' => {
    const g = this.ctx.game;
    if (!g) return 'none';
    const s = this.ctx.state();
    const n = s.map.size;
    if (x < 0 || y < 0 || x >= n || y >= n) return 'none';
    const i = y * n + x;
    const hit = this.gridCache.get(i);
    if (hit) return hit;
    let r: 'ok' | 'dark' | 'none' = 'none';
    if (s.map.explored[i] && s.map.biome[i] !== 'water') {
      const c = g.canPlace('trap_tar', x, y);
      r = c.ok || c.reason === 'cost' ? 'ok' : c.reason === 'dark' ? 'dark' : 'none';
    }
    this.gridCache.set(i, r);
    return r;
  };

  update(s: GameState, dt: number, active: boolean): void {
    this.node.active = active;
    this.overlay.show(active);
    if (!active) { this.reset(); return; }
    this.gridCacheT += dt;
    if (this.gridCacheT > 0.3) { this.gridCacheT = 0; this.gridCache.clear(); }
    // edge auto-scroll while painting / dragging a ghost
    if (this.pointer && (this.stroke || this.dragGhost)) {
      const L = this.ctx.layout;
      const v = edgeScroll(this.pointer.x, this.pointer.y, L.W, L.H - L.top, 22, 7, this.drawer.height + 18);
      if (v.x || v.y) {
        this.ctx.cam.panTiles(v.x * dt, v.y * dt);
        if (this.stroke) this.updateStroke(); else this.updateGhost();
      }
    }
    const range = this.ctx.cam.tileRange(0);
    this.overlay.drawGrid(range, dt, this.cellState);
    const p = this.plan();
    this.cells = p.cells;
    this.overlay.drawGhost(s, this.selected, p.cells, !this.stroke && this.ghost ? this.ghost : null, this.radial.isOpen ? this.radial.uid : 0, this.ctx.time);
    // total cost above the finger / ghost; confirm + cancel next to the ghost
    if (this.stroke && this.pointer && this.selected) {
      const ok = affordable(s.res, p.total);
      this.total.show(true).set(`${tr('build.total')} ${costText(p.total)} (${p.count})`, ok ? PAL.w : PAL.o)
        .pos(Math.round(this.pointer.x), Math.round(this.pointer.y + 34));
    } else if (this.ghost && this.selected) {
      const top = this.ctx.tileToUi(this.ghost.x + this.ghost.w / 2, this.ghost.y - 0.2);
      this.total.show(true).set(costText(p.total), affordable(s.res, p.total) ? PAL.w : PAL.o).pos(Math.round(top.x), Math.round(top.y + 26));
    } else this.total.show(false);
    if (this.ghost && this.selected && !this.stroke) {
      const r = this.ctx.tileToUi(this.ghost.x + this.ghost.w, this.ghost.y + this.ghost.h / 2);
      const L = this.ctx.layout;
      const bx = Math.min(L.W - 30, Math.max(4, r.x + 4)), by = Math.max(this.drawer.height + 4, Math.min(L.H - 100, r.y - 13));
      this.confirm.show(true).layout(bx, by + 14, 26, 26).setEnabled(p.count > 0);
      this.cancel.show(true).layout(bx, by - 16, 26, 26);
    } else { this.confirm.show(false); this.cancel.show(false); }
    this.radial.update();
  }

  /** Cells currently ghosted (debug/e2e). */
  get ghostCells(): GhostCell[] { return this.cells; }
}

// Build mode UX (SPEC §6.2): blueprint frame, grid over buildable tiles, hatching over dark tiles, drawer with 4 tabs
// of real building sprites, paint-by-drag for 1×1 paintables (axis lock / 4-connected Bresenham), ghost + ✓/✕ for
// the rest, range rings, synergy links, radial menu (upgrade / repair / sell), undo, edge auto-scroll.
import type { App } from './app';
import type { BuildingId, BuildingState, Cost, ResKey } from './core';
import { BUILDINGS, type BuildTab } from '../../../assets/scripts/core/data/buildings';
import { COL } from './font';
import { buildingIcon } from './info';
import { classifyDrag, paintCells, paintPlan, footprintOrigin, ringPoints, dottedLine, costParts, affordable as canAfford, addCost, type Cell, type LineMode } from './shared';
import { resIcon } from './sprites2';

const SYN = { flameRange: 2, embeddedRangeBonus: 1, rallyRange: 3 };
const RELOCATE_HOLD_MS = 400;
import { T, type Cam } from './world';

const TABS: BuildTab[] = ['defense', 'light', 'traps', 'economy'];
const CARD_W = 50, CARD_H = 76, TAB_H = 16;

export class BuildUI {
  open = false;
  freeCam = false;
  tab = 0;
  sel: BuildingId | null = null;
  scroll = 0;
  paint: { start: Cell; cur: Cell; mode: LineMode | null; cells: Cell[]; px: number; py: number } | null = null;
  ghost: Cell | null = null;
  ghostDrag = false;
  pan = false;
  menu: number | null = null;
  edgeVel = { x: 0, y: 0 };
  /** long-press relocate (SPEC §6.6): uid being dragged + target cell */
  hold: { uid: number; t0: number; x: number; y: number } | null = null;
  moving: { uid: number; at: Cell } | null = null;
  gridCache: { t: number; ok: Uint8Array; x0: number; y0: number; w: number; h: number } | null = null;

  constructor(private app: App) {}

  get drawerTop() { return this.app.H - this.app.safe.b - (TAB_H + CARD_H + 8); }

  reset() { this.open = false; this.freeCam = false; this.sel = null; this.paint = null; this.ghost = null; this.menu = null; this.hold = null; this.moving = null; }
  enter() {
    if (this.open || !this.app.game) return;
    const s = this.app.game.state;
    if ((s.phase !== 'peace' && s.phase !== 'night' && s.phase !== 'dusk') || s.expedition) return;
    this.open = true; this.freeCam = true; this.menu = null;
    if (s.phase === 'dusk') { // SPEC §2.2: dusk recentres the camera on the Hearth
      const h = s.buildings.find((b) => b.uid === s.hearthUid);
      if (h) { this.app.cam.x = (h.x + h.w / 2) * 16; this.app.cam.y = (h.y + h.h / 2) * 16 + 24; this.app.clampCam(); }
    }
    this.app.cmd({ t: 'buildMode', on: true });
    this.app.joy = null; this.app.cmd({ t: 'move', dir: { x: 0, y: 0 } }); this.app.sentDir = { x: 0, y: 0 };
    this.app.audio.sfx('ui_click');
  }
  exit() {
    if (!this.open) return;
    this.open = false; this.freeCam = false; this.sel = null; this.paint = null; this.ghost = null; this.menu = null; this.hold = null; this.moving = null;
    this.app.cmd({ t: 'buildMode', on: false });
    this.app.saveHold(); // SPEC §13.7: save on leaving build mode
  }
  toggle() { this.open ? this.exit() : this.enter(); }
  cancelGesture() { this.paint = null; this.ghostDrag = false; this.pan = false; }

  /** Cards of the current tab: only what the Hold has unlocked (SPEC §2.7: hidden, not greyed). */
  ids(): BuildingId[] {
    const s = this.app.state!;
    return (Object.keys(BUILDINGS) as BuildingId[]).filter((id) => {
      const d = BUILDINGS[id];
      if (id === 'hearth' || d.tab !== TABS[this.tab] || d.tier <= 0) return false;
      if (d.cosmetic) return s.cosmetics.owned.includes(id) || s.cosmetics.owned.includes(d.cosmetic);
      return (s.unlocked as string[]).includes(id) || d.tier <= s.hearthTier && !(s.unlocked as string[]).length;
    });
  }
  locked(_id: BuildingId) { return false; }
  cost(id: BuildingId): Cost { return this.app.game!.buildingCost(id, 1); }
  affordable(c: Cost) { return canAfford(this.app.state!.res, c); }
  ruins(): BuildingState[] { return this.app.state!.buildings.filter((b) => b.ruined); }
  /** 50% of the current-level price of every ruin (SPEC §6.6). */
  rebuildCost(list = this.ruins()): Cost {
    let c: Cost = {};
    for (const b of list) c = addCost(c, this.app.game!.buildingCost(b.id, b.level as 1 | 2 | 3), 0.5);
    for (const k of Object.keys(c) as ResKey[]) c[k] = Math.ceil(c[k]!);
    return c;
  }

  select(id: BuildingId) {
    if (this.locked(id)) { this.app.audio.sfx('fail'); return; }
    this.sel = this.sel === id ? null : id; this.ghost = null; this.menu = null;
  }

  tick(dt: number) {
    if (!this.open) return;
    if (this.hold && !this.moving && performance.now() - this.hold.t0 >= RELOCATE_HOLD_MS) {
      const b = this.app.state!.buildings.find((q) => q.uid === this.hold!.uid);
      if (b) { this.moving = { uid: b.uid, at: { x: b.x, y: b.y } }; this.pan = false; this.app.audio.sfx('ui_click'); }
    }
    if ((this.paint || this.ghostDrag || this.moving) && (this.edgeVel.x || this.edgeVel.y)) {
      this.app.cam.x += this.edgeVel.x * dt * 90; this.app.cam.y += this.edgeVel.y * dt * 90; this.app.clampCam();
    }
  }

  private cellAt(x: number, y: number): Cell { const t = this.app.screenToTile(x, y); return { x: Math.floor(t.x), y: Math.floor(t.y) }; }
  private buildingAt(c: Cell): BuildingState | null {
    const s = this.app.state!;
    for (const b of s.buildings) if (c.x >= b.x && c.y >= b.y && c.x < b.x + b.w && c.y < b.y + b.h) return b;
    return null;
  }
  private setEdge(x: number, y: number) {
    const W = this.app.W, band = 14;
    let vx = 0, vy = 0;
    if (x < band) vx = -1; else if (x > W - band) vx = 1;
    if (y < this.app.safe.t + band) vy = -1; else if (y > this.drawerTop - 6 && y < this.drawerTop + 4) vy = 1;
    this.edgeVel = { x: vx, y: vy };
  }

  // ── pointer (world area only; UI widgets are handled by the UI layer first) ─────────────
  down(x: number, y: number) {
    if (this.menu !== null) { this.menu = null; return; }
    const c = this.cellAt(x, y);
    const ph = this.app.state!.phase;
    if (!this.sel && (ph === 'peace' || ph === 'dusk')) {
      const b = this.buildingAt(c);
      if (b && b.id !== 'hearth' && !b.ruined) this.hold = { uid: b.uid, t0: performance.now(), x, y };
    }
    if (this.sel && BUILDINGS[this.sel].paintable) {
      this.paint = { start: c, cur: c, mode: null, cells: [c], px: x, py: y };
    } else if (this.sel) {
      const d = BUILDINGS[this.sel];
      if (this.ghost && c.x >= this.ghost.x && c.y >= this.ghost.y && c.x < this.ghost.x + d.w && c.y < this.ghost.y + d.h) this.ghostDrag = true;
      else { const t = this.app.screenToTile(x, y); this.ghost = footprintOrigin(t.x, t.y, d.w, d.h); this.ghostDrag = true; }
    } else this.pan = true;
  }
  move(x: number, y: number, dx: number, dy: number) {
    if (this.hold && !this.moving) {
      if (performance.now() - this.hold.t0 >= RELOCATE_HOLD_MS) { const b = this.app.state!.buildings.find((q) => q.uid === this.hold!.uid); if (b) { this.moving = { uid: b.uid, at: { x: b.x, y: b.y } }; this.pan = false; this.app.audio.sfx('ui_click'); } }
      else if (Math.hypot(x - this.hold.x, y - this.hold.y) > 4) this.hold = null;
    }
    if (this.moving) {
      const b = this.app.state!.buildings.find((q) => q.uid === this.moving!.uid);
      if (b) { const t = this.app.screenToTile(x, y); this.moving.at = footprintOrigin(t.x, t.y, b.w, b.h); }
      this.setEdge(x, y);
      return;
    }
    if (this.paint) {
      const c = this.cellAt(x, y);
      this.paint.cur = c;
      if (!this.paint.mode && (c.x !== this.paint.start.x || c.y !== this.paint.start.y)) this.paint.mode = classifyDrag(c.x - this.paint.start.x, c.y - this.paint.start.y);
      this.paint.cells = this.paint.mode ? paintCells(this.paint.start, c, this.paint.mode) : [this.paint.start];
      this.paint.px = x; this.paint.py = y;
      this.setEdge(x, y);
    } else if (this.ghostDrag && this.sel) {
      const d = BUILDINGS[this.sel]; const t = this.app.screenToTile(x, y);
      this.ghost = footprintOrigin(t.x, t.y, d.w, d.h);
      this.setEdge(x, y);
    } else if (this.pan) { this.app.cam.x -= dx; this.app.cam.y -= dy; this.app.clampCam(); }
  }
  up(x: number, y: number, kind: 'tap' | 'drag', cancel: boolean) {
    this.edgeVel = { x: 0, y: 0 };
    this.hold = null;
    if (this.moving) {
      const m = this.moving; this.moving = null; this.pan = false;
      const b = this.app.state!.buildings.find((q) => q.uid === m.uid);
      if (!cancel && b && (m.at.x !== b.x || m.at.y !== b.y)) this.app.cmd({ t: 'relocate', uid: m.uid, x: m.at.x, y: m.at.y });
      return;
    }
    if (this.paint) {
      const p = this.paint; this.paint = null;
      if (!cancel && this.sel) this.app.cmd({ t: 'paint', id: this.sel, cells: p.cells });
    } else if (this.ghostDrag) this.ghostDrag = false;
    else if (this.pan) {
      this.pan = false;
      if (kind === 'tap') { const b = this.buildingAt(this.cellAt(x, y)); this.menu = b ? b.uid : null; }
    }
  }

  // ── drawing ───────────────────────────────────────────────────────────────
  /** Grid on buildable tiles + hatching on dark tiles (world layer, under entities). */
  drawGroundOverlay(cam: Cam) {
    if (!this.open || !this.app.game) return;
    const g = this.app.b, A = this.app.atlas, game = this.app.game, s = game.state;
    const x0 = Math.max(0, Math.floor(cam.x / T)), y0 = Math.max(0, Math.floor(cam.y / T));
    const x1 = Math.min(s.map.size - 1, Math.ceil((cam.x + cam.w) / T)), y1 = Math.min(s.map.size - 1, Math.ceil((cam.y + cam.h) / T));
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    let gc = this.gridCache;
    if (!gc || this.app.time - gc.t > 0.2 || gc.x0 !== x0 || gc.y0 !== y0 || gc.w !== w || gc.h !== h) {
      const ok = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const r = game.canPlace('trap_tar', x0 + x, y0 + y);
        ok[y * w + x] = r.ok || r.reason === 'cost' ? 1 : r.reason === 'dark' && s.map.biome[(y0 + y) * s.map.size + x0 + x] !== 'water' ? 2 : 0;
      }
      gc = this.gridCache = { t: this.app.time, ok, x0, y0, w, h };
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = gc.ok[y * w + x];
      const sx = (x0 + x) * T - cam.x, sy = (y0 + y) * T - cam.y;
      if (v === 1) A.draw(g, 'ui_grid_cell', sx, sy, { alpha: 0.55 });
      else if (v === 2) hatch(g, sx, sy);
    }
  }

  /** Ghosts, range rings, synergy links, paint costs, radial menu (above the world + light). */
  drawWorldOverlay() {
    if (!this.open || !this.app.game) return;
    const app = this.app, g = app.b, A = app.atlas, game = app.game!, s = game.state;
    const cam = app.camRect();
    const S = (tx: number, ty: number) => ({ x: Math.round(tx * T - cam.x), y: Math.round(ty * T - cam.y) });
    // paint stroke
    if (this.paint && this.sel) {
      const id = this.sel, cost = this.cost(id);
      const plan = paintPlan(this.paint.cells, (c) => { const r = game.canPlace(id, c.x, c.y); return r.ok || r.reason === 'cost'; }, { wood: cost.wood ?? 0, stone: cost.stone ?? 0, gold: cost.gold ?? 0 }, s.res);
      this.paint.cells.forEach((c, i) => {
        const p = S(c.x, c.y);
        if (plan.ok[i]) { A.draw(g, buildingIcon(id), p.x + 8, p.y + 16, { alpha: 0.7 }); A.draw(g, 'ui_build_ok', p.x, p.y); }
        else A.draw(g, 'ui_build_bad', p.x, p.y, { alpha: 0.8 });
      });
      costTag(app, plan.total, this.paint.px, this.paint.py - 22, plan.count);
    }
    // existing towers touched by the current action (wall stroke next to them / radial menu): range ring (incl. the
    // wall-embedded bonus the stroke would give) + their active flame links. Not all towers, to keep the map readable.
    const focus = new Set<number>();
    if (this.menu !== null) focus.add(this.menu);
    if (this.paint) for (const b of s.buildings) {
      if (!b.id.startsWith('tower')) continue;
      if (this.paint.cells.some((c) => c.x >= b.x - 1 && c.x <= b.x + b.w && c.y >= b.y - 1 && c.y <= b.y + b.h)) focus.add(b.uid);
    }
    for (const b of s.buildings) {
      const d = BUILDINGS[b.id];
      if (!focus.has(b.uid) || !d.range) continue;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      let embedded = b.synergies.includes('embedded');
      if (!embedded && this.paint && this.sel && BUILDINGS[this.sel].wallLike) {
        const touch = (x: number, y: number) => (x === b.x - 1 || x === b.x + b.w) && y >= b.y && y < b.y + b.h || (y === b.y - 1 || y === b.y + b.h) && x >= b.x && x < b.x + b.w;
        let sides = 0;
        for (const o of s.buildings) if (BUILDINGS[o.id].wallLike && touch(o.x, o.y)) sides++;
        for (const c of this.paint.cells) if (touch(c.x, c.y) && !game.canPlace(this.sel, c.x, c.y).reason?.startsWith('b')) sides++;
        embedded = sides >= 2;
      }
      const range = d.range[b.level - 1] + (embedded ? SYN.embeddedRangeBonus : 0);
      for (const p of ringPoints(cx, cy, range, 0.45)) { const q = S(p.x, p.y); A.drawC(g, 'ui_range_dot', q.x, q.y); }
      if (embedded && !b.synergies.includes('embedded')) app.font.draw(g, app.tr('build.synergy.embedded'), S(cx, b.y).x, S(cx, b.y).y - 34, { align: 'center', color: COL.fire });
      if (b.synergies.includes('flame')) {
        const br = s.buildings.filter((o) => o.id === 'brazier' && o.lit && Math.hypot(o.x + 0.5 - cx, o.y + 0.5 - cy) <= SYN.flameRange + (b.w + 1) / 2);
        for (const o of br) for (const p of dottedLine(cx, cy, o.x + 0.5, o.y + 0.5, 0.35)) { const q = S(p.x, p.y); A.drawC(g, 'ui_link_dot', q.x, q.y); }
      }
    }
    // relocate ghost (long-press drag)
    if (this.moving) {
      const b = s.buildings.find((q) => q.uid === this.moving!.uid);
      if (b) {
        const at = this.moving.at;
        for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
          const p = S(at.x + x, at.y + y);
          const inOld = at.x + x >= b.x && at.x + x < b.x + b.w && at.y + y >= b.y && at.y + y < b.y + b.h;
          const ok = inOld || game.canPlace('trap_tar', at.x + x, at.y + y).ok || game.canPlace('trap_tar', at.x + x, at.y + y).reason === 'cost';
          A.draw(g, ok ? 'ui_build_ok' : 'ui_build_bad', p.x, p.y);
        }
        const base = S(at.x + b.w / 2, at.y + b.h);
        A.draw(g, buildingIcon(b.id, b.level), base.x, base.y, { alpha: 0.75 });
        app.font.draw(g, app.tr('panel.move'), base.x, S(0, at.y).y - 30, { align: 'center', color: COL.gold });
      }
    }
    // placed-ghost
    if (this.ghost && this.sel) {
      const id = this.sel, d = BUILDINGS[id];
      const chk = game.canPlace(id, this.ghost.x, this.ghost.y);
      const cx = this.ghost.x + d.w / 2, cy = this.ghost.y + d.h / 2;
      this.rings(id, cx, cy, this.ghost);
      for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const p = S(this.ghost.x + x, this.ghost.y + y); A.draw(g, chk.ok ? 'ui_build_ok' : 'ui_build_bad', p.x, p.y); }
      const base = S(cx, this.ghost.y + d.h);
      A.draw(g, buildingIcon(id), base.x, base.y, { alpha: 0.75 });
      const top = S(cx, this.ghost.y);
      if (!chk.ok && chk.reason) app.font.draw(g, app.tr(`build.fail.${chk.reason}`), top.x, top.y - 38, { align: 'center', color: COL.red });
      const bx = Math.round(base.x + (d.w * T) / 2 + 2), by = Math.round(top.y - 12);
      app.ui.iconButton('ghostOk', bx, by, 22, 'icon_tick', () => { if (this.ghost && this.sel) { app.cmd({ t: 'place', id: this.sel, x: this.ghost.x, y: this.ghost.y }); this.ghost = null; } }, { disabled: !chk.ok });
      app.ui.iconButton('ghostNo', bx, by + 24, 22, 'icon_close', () => { this.ghost = null; });
    }
    // radial menu
    if (this.menu !== null) {
      const b = s.buildings.find((q) => q.uid === this.menu);
      if (!b) this.menu = null;
      else this.radial(b);
    }
  }

  private rings(id: BuildingId, cx: number, cy: number, at: Cell) {
    const app = this.app, g = app.b, A = app.atlas, s = app.state!, d = BUILDINGS[id];
    const cam = app.camRect();
    const S = (tx: number, ty: number) => ({ x: Math.round(tx * T - cam.x), y: Math.round(ty * T - cam.y) });
    const near = (b: BuildingState, r: number) => Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy) <= r + (b.w + d.w) / 4;
    // adjacency for "embedded" (≥2 sides touching walls/gates)
    let adj = 0;
    if (id.startsWith('tower')) for (const b of s.buildings) if (BUILDINGS[b.id].wallLike) {
      const touchX = b.x + b.w === at.x || b.x === at.x + d.w, touchY = b.y + b.h === at.y || b.y === at.y + d.h;
      const overlapY = b.y < at.y + d.h && b.y + b.h > at.y, overlapX = b.x < at.x + d.w && b.x + b.w > at.x;
      if ((touchX && overlapY) || (touchY && overlapX)) adj++;
    }
    const embedded = adj >= 2;
    let range = d.range ? d.range[0] : d.light ? d.light[0] : id === 'lumber_camp' || id === 'quarry' ? 3 : 0;
    if (embedded && d.range) range += SYN.embeddedRangeBonus;
    if (range > 0) for (const p of ringPoints(cx, cy, range, 0.45)) A.drawC(g, 'ui_range_dot', S(p.x, p.y).x, S(p.x, p.y).y);
    if (d.minRange) for (const p of ringPoints(cx, cy, d.minRange, 0.6)) A.drawC(g, 'ui_range_dot', S(p.x, p.y).x, S(p.x, p.y).y, { alpha: 0.5 });
    if (embedded) { const p = S(cx, at.y + d.h); A.draw(g, 'bld_embed_base', p.x, p.y); }
    const labels: string[] = [];
    const link = (b: BuildingState) => {
      for (const p of dottedLine(cx, cy, b.x + b.w / 2, b.y + b.h / 2, 0.35)) { const q = S(p.x, p.y); A.drawC(g, 'ui_link_dot', q.x, q.y); }
    };
    if (id === 'tower_arrow' || id === 'tower_ballista') {
      const lit = s.buildings.filter((b) => b.id === 'brazier' && b.lit && near(b, SYN.flameRange));
      lit.forEach(link); if (lit.length) labels.push(app.tr('build.synergy.flame'));
    }
    if (id === 'brazier') s.buildings.filter((b) => (b.id === 'tower_arrow' || b.id === 'tower_ballista') && near(b, SYN.flameRange)).forEach(link);
    if (id === 'trap_tar' || id === 'trap_spikes') {
      const other = id === 'trap_tar' ? 'trap_spikes' : 'trap_tar';
      const n = s.buildings.filter((b) => b.id === other && Math.abs(b.x - at.x) + Math.abs(b.y - at.y) === 1);
      n.forEach(link); if (n.length) labels.push(app.tr('build.synergy.tarSpike'));
    }
    if (id.startsWith('tower')) {
      const leader = s.heroes.find((h) => h.leader);
      if (leader && Math.hypot(leader.x - cx, leader.y - cy) <= SYN.rallyRange) {
        for (const p of dottedLine(cx, cy, leader.x, leader.y, 0.35)) { const q = S(p.x, p.y); A.drawC(g, 'ui_link_dot', q.x, q.y, { alpha: 0.7 }); }
        labels.push(app.tr('build.synergy.rally'));
      }
    }
    if (embedded) labels.push(app.tr('build.synergy.embedded'));
    const top = S(cx, at.y);
    labels.forEach((l, i) => app.font.draw(g, l, top.x, top.y - 30 - i * 9, { align: 'center', color: COL.fire }));
  }

  private radial(b: BuildingState) {
    const app = this.app, g = app.b, ui = app.ui, game = app.game!, s = game.state, d = BUILDINGS[b.id];
    const cam = app.camRect();
    const cx = Math.round((b.x + b.w / 2) * T - cam.x), cy = Math.round((b.y + b.h / 2) * T - cam.y);
    const name = app.tr(`bld.${b.id}.name`);
    app.font.draw(g, b.ruined ? `${app.tr('build.ruin')}: ${name}` : `${name} ${app.tr('panel.level', { n: b.level })}`, cx, cy - 40, { align: 'center', color: COL.gold });
    const r = 24;
    const items: Array<{ id: string; icon: string; onTap: () => void; disabled: boolean; cost?: Cost }> = [];
    if (b.ruined) {
      const c = this.rebuildCost([b]);
      items.push({ id: 'menuRebuild', icon: 'icon_rebuild', onTap: () => { app.cmd({ t: 'rebuild', uid: b.uid }); this.menu = null; }, disabled: !this.affordable(c), cost: c });
      items.push({ id: 'menuClear', icon: 'icon_close', onTap: () => { app.cmd({ t: 'clearRuin', uid: b.uid }); this.menu = null; }, disabled: false });
    } else {
      const canUp = b.id !== 'hearth' && (d.upgradeTo !== undefined || b.level < d.maxLevel);
      if (canUp) {
        const c = d.upgradeTo ? game.buildingCost(d.upgradeTo, 1) : game.buildingCost(b.id, Math.min(3, b.level + 1) as 1 | 2 | 3);
        items.push({ id: 'menuUp', icon: 'icon_upgrade', onTap: () => { app.cmd({ t: 'upgrade', uid: b.uid }); }, disabled: !this.affordable(c), cost: c });
      }
      if (b.maxHp > 1 && b.id !== 'hearth') items.push({ id: 'menuRepair', icon: 'icon_wrench', onTap: () => app.cmd({ t: 'repair', uid: b.uid }), disabled: b.hp >= b.maxHp });
      if (b.id !== 'hearth') items.push({ id: 'menuSell', icon: 'icon_sell', onTap: () => { app.cmd({ t: 'sell', uid: b.uid }); this.menu = null; }, disabled: false });
      if (b.id !== 'hearth' && (s.phase === 'peace' || s.phase === 'dusk')) items.push({ id: 'menuMove', icon: 'icon_relocate', onTap: () => { this.moving = { uid: b.uid, at: { x: b.x, y: b.y } }; this.menu = null; }, disabled: false });
    }
    items.forEach((it, i) => {
      const a = -Math.PI / 2 + (i - (items.length - 1) / 2) * 1.1;
      const bx = Math.round(cx + Math.cos(a) * r - 12), by = Math.round(cy + Math.sin(a) * r - 12);
      ui.iconButton(it.id, bx, by, 24, it.icon, it.onTap, { disabled: it.disabled });
      if (it.cost) costTag(app, it.cost, bx + 12, by - 10);
    });
    void s;
  }

  /** Drawer + undo/done + blueprint frame (screen space). */
  drawUI() {
    if (!this.open || !this.app.game) return;
    const app = this.app, g = app.b, A = app.atlas, ui = app.ui, f = app.font;
    const { W, H, safe } = app;
    // blueprint frame: corners + dotted border
    const fr = A.frames['ui_blueprint_corner'];
    if (fr) {
      const m = 2, top = safe.t + m, bot = this.drawerTop - 2;
      A.drawC(g, 'ui_blueprint_corner', m + fr.w / 2, top + fr.h / 2);
      A.drawC(g, 'ui_blueprint_corner', W - m - fr.w / 2, top + fr.h / 2, { rot: Math.PI / 2 });
      A.drawC(g, 'ui_blueprint_corner', W - m - fr.w / 2, bot - fr.h / 2, { rot: Math.PI });
      A.drawC(g, 'ui_blueprint_corner', m + fr.w / 2, bot - fr.h / 2, { rot: -Math.PI / 2 });
      for (let x = m + fr.w + 4; x < W - m - fr.w - 2; x += 6) { A.drawC(g, 'ui_range_dot', x, top + 1, { alpha: 0.6 }); A.drawC(g, 'ui_range_dot', x, bot - 1, { alpha: 0.6 }); }
      for (let y = top + fr.h + 4; y < bot - fr.h - 2; y += 6) { A.drawC(g, 'ui_range_dot', m + 1, y, { alpha: 0.6 }); A.drawC(g, 'ui_range_dot', W - m - 1, y, { alpha: 0.6 }); }
    }
    // drawer
    const top = this.drawerTop;
    A.nine(g, 'ui_panel_stone', 0, top, W, H - top + 4);
    ui.block(0, top, W, H - top, 'drawer');
    const tw = Math.floor((W - safe.l - safe.r - 8) / 4);
    TABS.forEach((tb, i) => {
      const x = safe.l + 4 + i * tw, y = top + 3;
      A.nine(g, i === this.tab ? 'ui_tab_on' : 'ui_tab_off', x, y, tw - 1, TAB_H);
      f.draw(g, app.tr(`build.tab.${tb}`), x + (tw - 1) / 2, y + 5, { align: 'center', color: i === this.tab ? COL.gold : COL.grey });
      ui.add({ x, y, w: tw - 1, h: TAB_H, id: `tab_${tb}`, block: true, onTap: () => { this.tab = i; this.scroll = 0; } });
    });
    const ids = this.ids();
    const cy = top + TAB_H + 6;
    const maxScroll = Math.max(0, ids.length * (CARD_W + 2) - (W - 8));
    this.scroll = Math.max(0, Math.min(maxScroll, this.scroll));
    g.save(); g.beginPath(); g.rect(2, cy - 1, W - 4, CARD_H + 2); g.clip();
    ids.forEach((id, i) => {
      const x = Math.round(4 + i * (CARD_W + 2) - this.scroll);
      if (x > W || x + CARD_W < 0) return;
      this.card(id, x, cy);
    });
    g.restore();
    // scroll by dragging the card strip
    ui.add({
      x: 0, y: cy, w: W, h: CARD_H, id: 'cards', block: true,
      onDrag: (dx) => { this.scroll -= dx; },
      onTap: () => { const i = Math.floor((app.ui.tapX - 4 + this.scroll) / (CARD_W + 2)); if (i >= 0 && i < ids.length) this.select(ids[i]); },
    });
    // undo + done
    const bx = W - safe.r - 28;
    ui.iconButton('undo', bx - 28, top - 28, 24, 'icon_undo', () => app.cmd({ t: 'undo' }));
    if (app.state!.phase !== 'dusk') ui.iconButton('buildDone', bx, top - 28, 24, 'icon_close', () => this.exit());
    // resource legend on the drawer edge
    const r = app.state!.res;
    let lx = safe.l + 4;
    for (const [k, c] of [['wood', COL.wood], ['stone', COL.stone], ['gold', COL.gold], ['iron', COL.grey]] as const) {
      if (k === 'iron' && !r.iron) continue;
      A.drawTL(g, resIcon(k), lx, top - 20);
      f.draw(g, String(Math.floor(r[k])), lx + 17, top - 15, { color: c });
      lx += 17 + f.width(String(Math.floor(r[k]))) + 5;
    }
    // Rebuild all (SPEC §6.6): shows the total price of every ruin
    const ruins = this.ruins();
    if (ruins.length && app.state!.phase !== 'night') {
      const c = this.rebuildCost(ruins);
      const lbl = `${app.tr('build.rebuildAll')} (${ruins.length})`;
      const w = f.width(lbl) + 26;
      ui.button('rebuildAll', safe.l + 4, top - 50, w, 22, lbl, () => app.cmd({ t: 'rebuildAll' }), { icon: 'icon_rebuild', disabled: !this.affordable(c) });
      costTag(app, c, safe.l + 4 + w + 4 + 30, top - 47);
    }
  }

  private card(id: BuildingId, x: number, y: number) {
    const app = this.app, g = app.b, A = app.atlas, f = app.font;
    const sel = this.sel === id, locked = this.locked(id);
    A.nine(g, sel ? 'ui_card_rare' : 'ui_card_common', x, y, CARD_W, CARD_H);
    g.save(); g.beginPath(); g.rect(x + 2, y + 2, CARD_W - 4, 44); g.clip();
    const icon = buildingIcon(id);
    const fr = A.frames[icon];
    const by = fr && fr.h > 40 ? y + 46 : y + 42;
    A.draw(g, icon, x + CARD_W / 2, by, { alpha: locked ? 0.4 : 1 });
    g.restore();
    if (locked) A.drawC(g, 'icon_lock', x + CARD_W / 2, y + 24);
    const lines = f.wrap(app.tr(`bld.${id}.name`), CARD_W - 4).slice(0, 2);
    f.drawLines(g, lines, x + CARD_W / 2, y + 47, { align: 'center', color: sel ? COL.gold : COL.white });
    const c = this.cost(id), r = app.state!.res;
    const COLS: Partial<Record<ResKey, string>> = { wood: COL.wood, stone: COL.stone, gold: COL.gold, iron: COL.grey };
    const parts: Array<[number, string, boolean]> = costParts(c).slice(0, 3).map((q) => [q.amount, COLS[q.res] ?? COL.white, r[q.res] >= q.amount]);
    const txt = parts.map((p) => String(p[0]));
    const totalW = txt.reduce((a, t) => a + f.width(t), 0) + (txt.length - 1) * 4;
    let cx = Math.round(x + CARD_W / 2 - totalW / 2);
    parts.forEach((p, i) => { f.draw(g, txt[i], cx, y + CARD_H - 10, { color: p[2] ? p[1] : COL.red }); cx += f.width(txt[i]) + 4; });
  }
}

/** Resource cost label floating over the finger: "-12" per resource in its colour next to its icon. */
export function costTag(app: App, c: Cost, x: number, y: number, count?: number) {
  const g = app.b, A = app.atlas, f = app.font;
  const parts = costParts(c).map((q) => q.res);
  const label = count !== undefined ? `x${count}` : '';
  const widths = parts.map((k) => 15 + f.width(String(c[k])));
  const w = widths.reduce((a, b) => a + b, 0) + (label ? f.width(label) + 4 : 0) + 6;
  const x0 = Math.round(x - w / 2);
  A.nine(g, 'ui_panel_stone', x0, Math.round(y), Math.max(14, w), 16);
  let cx = x0 + 3;
  if (label) { f.draw(g, label, cx, y + 5, { color: COL.white }); cx += f.width(label) + 4; }
  parts.forEach((k, i) => {
    A.drawTL(g, resIcon(k), cx - 2, Math.round(y));
    f.draw(g, String(c[k]), cx + 13, y + 5, { color: app.state!.res[k] >= (c[k] ?? 0) ? COL.white : COL.red });
    cx += widths[i];
  });
}

/** Diagonal hatching (SPEC §10.4: invalid = stripes) over a non-buildable tile, in palette ink. */
function hatch(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#1b1b2f';
  g.globalAlpha = 0.45;
  for (let i = 0; i < 16; i++) for (let k = 0; k < 16; k += 4) {
    const px = (i + k) % 16;
    g.fillRect(x + px, y + i, 1, 1);
  }
  g.globalAlpha = 1;
}

// Pure build-gesture math (no 'cc'). SPEC §6.2: paint a line, axis-locked to the initial drag direction;
// a diagonal initial drag draws a 4-connected Bresenham line.
export interface Cell { x: number; y: number }
export type LineMode = 'h' | 'v' | 'diag';

/** Classify the initial drag direction (in tiles; y down). Within ±22.5° of an axis → that axis. */
export function classifyDrag(dx: number, dy: number): LineMode {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const t = Math.tan(Math.PI / 8);
  if (ay <= ax * t) return 'h';
  if (ax <= ay * t) return 'v';
  return 'diag';
}

/** 4-connected Bresenham line (every step moves along exactly one axis), inclusive of both ends. */
export function bresenham4(x0: number, y0: number, x1: number, y1: number): Cell[] {
  const out: Cell[] = [];
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = 0, x = x0, y = y0;
  out.push({ x, y });
  for (let i = 0; i < dx + dy; i++) {
    const ex = e + dy, ey = e - dx; // error after a step in x or in y
    if (Math.abs(ex) < Math.abs(ey)) { x += sx; e = ex; } else { y += sy; e = ey; }
    out.push({ x, y });
  }
  return out;
}

/** Cells of the painted line from start to the current cell given the locked mode. */
export function paintCells(start: Cell, cur: Cell, mode: LineMode): Cell[] {
  if (mode === 'h') {
    const out: Cell[] = []; const s = cur.x >= start.x ? 1 : -1;
    for (let x = start.x; ; x += s) { out.push({ x, y: start.y }); if (x === cur.x) break; }
    return out;
  }
  if (mode === 'v') {
    const out: Cell[] = []; const s = cur.y >= start.y ? 1 : -1;
    for (let y = start.y; ; y += s) { out.push({ x: start.x, y }); if (y === cur.y) break; }
    return out;
  }
  return bresenham4(start.x, start.y, cur.x, cur.y);
}

/** Tile cell under a tile-space point. */
export function cellAt(tx: number, ty: number): Cell { return { x: Math.floor(tx), y: Math.floor(ty) }; }

/** Top-left cell of a w×h footprint centred under a tile-space point. */
export function footprintOrigin(tx: number, ty: number, w: number, h: number): Cell {
  return { x: Math.round(tx - w / 2), y: Math.round(ty - h / 2) };
}

export interface Res { wood: number; stone: number; gold: number }
/**
 * Which cells of a paint stroke will actually be placed: valid cells in stroke order while the running total is
 * affordable (core places "as many as affordable"). Returns per-cell flags and the total cost of placed cells.
 */
export function paintPlan(cells: Cell[], valid: (c: Cell) => boolean, cost: Res, have: Res): { ok: boolean[]; total: Res; count: number } {
  const total: Res = { wood: 0, stone: 0, gold: 0 };
  const ok: boolean[] = [];
  let count = 0;
  for (const c of cells) {
    let good = valid(c);
    if (good) {
      const nw = total.wood + cost.wood, ns = total.stone + cost.stone, ng = total.gold + cost.gold;
      if (nw > have.wood || ns > have.stone || ng > have.gold) good = false;
      else { total.wood = nw; total.stone = ns; total.gold = ng; count++; }
    }
    ok.push(good);
  }
  return { ok, total, count };
}

/** Tap vs drag: a touch that moved less than `slop` design px and lasted < maxTap seconds is a tap. */
export function isTap(dist: number, seconds: number, slop = 18, maxTap = 0.45): boolean {
  return dist < slop && seconds < maxTap;
}

/** Points along a circle (tile units) for a range ring drawn with dot sprites, spaced ~`spacing` tiles apart. */
export function ringPoints(cx: number, cy: number, r: number, spacing = 0.5): Cell[] {
  const n = Math.max(8, Math.round((2 * Math.PI * r) / spacing));
  const out: Cell[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
  return out;
}

/** Points along a segment (tile units) for a dotted link line. */
export function dottedLine(x0: number, y0: number, x1: number, y1: number, spacing = 0.4): Cell[] {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.round(d / spacing));
  const out: Cell[] = [];
  for (let i = 0; i <= n; i++) out.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n });
  return out;
}

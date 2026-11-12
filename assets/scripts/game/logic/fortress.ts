// Fortress-management gestures (no 'cc'): garrison drag-drop targeting (§11.5), relocation preview (§6.6 "hold
// 0.4 s then drag"), the bulk upgrade / repair brush and Rebuild-all totals (§6.6).
import type { BuildCheck, BuildingId, BuildingState, Cost, GameState, HeroId, HeroRecord, Phase } from '../../core/api';
import { addCost } from './format';
import { isTowerId } from './catalog';

type Bld = Pick<BuildingState, 'uid' | 'id' | 'x' | 'y' | 'w' | 'h' | 'level' | 'ruined' | 'garrison'>;

// ── garrison ────────────────────────────────────────────────────────────────
export const GARRISON_MIN_LEVEL = 2;
/** A tower that can host a hero: tower, level ≥ 2, standing (not rubble). */
export function canHostGarrison(b: Bld): boolean { return isTowerId(b.id) && b.level >= GARRISON_MIN_LEVEL && !b.ruined; }

export function garrisonUsed(roster: Record<string, Pick<HeroRecord, 'status'>>): number {
  let n = 0;
  for (const k in roster) if (roster[k].status === 'garrison') n++;
  return n;
}

export type GarrisonDrop =
  | { ok: true; uid: number; swap: HeroId | null }
  | { ok: false; reason: 'none' | 'level' | 'slots' | 'ruined' | 'notTower'; uid: number };
/**
 * Target for a hero dropped at tile point (tx, ty): the building whose footprint (padded by `pad` tiles, for a
 * forgiving thumb) contains the point, nearest centre first. Reports why a drop is refused so the UI can say so.
 */
export function garrisonTarget(buildings: readonly Bld[], tx: number, ty: number, slotsFree: number, hero: HeroId, pad = 0.35): GarrisonDrop {
  let best: Bld | null = null, bd = Infinity;
  for (const b of buildings) {
    if (tx < b.x - pad || tx > b.x + b.w + pad || ty < b.y - pad || ty > b.y + b.h + pad) continue;
    const d = Math.hypot(b.x + b.w / 2 - tx, b.y + b.h / 2 - ty);
    if (d < bd) { bd = d; best = b; }
  }
  if (!best) return { ok: false, reason: 'none', uid: 0 };
  if (!isTowerId(best.id)) return { ok: false, reason: 'notTower', uid: best.uid };
  if (best.ruined) return { ok: false, reason: 'ruined', uid: best.uid };
  if (best.level < GARRISON_MIN_LEVEL) return { ok: false, reason: 'level', uid: best.uid };
  const swap = best.garrison && best.garrison !== hero ? best.garrison : null;
  // re-dropping onto a tower that already holds this hero, or swapping with another garrisoned hero, needs no free slot
  if (!swap && best.garrison !== hero && slotsFree <= 0) return { ok: false, reason: 'slots', uid: best.uid };
  return { ok: true, uid: best.uid, swap };
}

// ── relocation ──────────────────────────────────────────────────────────────
export const HOLD_TO_RELOCATE_SEC = 0.4;
/** Long-press detection: still enough (≤ slop design px) for ≥ 0.4 s. */
export function isHold(movedDesignPx: number, seconds: number, slop = 14, hold = HOLD_TO_RELOCATE_SEC): boolean {
  return movedDesignPx <= slop && seconds >= hold;
}
export function holdProgress(seconds: number, hold = HOLD_TO_RELOCATE_SEC): number { return Math.max(0, Math.min(1, seconds / hold)); }

export function canRelocate(b: Bld, phase: Phase, expedition: boolean): boolean {
  return (phase === 'peace' || phase === 'dusk') && !expedition && b.id !== 'hearth' && !b.ruined;
}

export interface RelocCell { x: number; y: number; ok: boolean; own: boolean }
/**
 * Validity preview for moving building `b` so its top-left lands on (nx, ny). The building's own footprint does
 * not block itself: cells it currently covers are fine, every other cell must pass `probe(x, y)` (a 1×1 placement
 * check). When the new footprint does not overlap the old one, the whole-footprint check `whole` is authoritative.
 * The core re-validates the `relocate` command; this only drives the green / red ghost.
 */
export function relocatePreview(b: Bld, nx: number, ny: number, whole: (id: BuildingId, x: number, y: number) => BuildCheck,
  probe: (x: number, y: number) => boolean): { ok: boolean; cells: RelocCell[]; same: boolean } {
  const cells: RelocCell[] = [];
  const same = nx === b.x && ny === b.y;
  const inOld = (x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  let overlap = false;
  for (let y = ny; y < ny + b.h; y++) for (let x = nx; x < nx + b.w; x++) if (inOld(x, y)) overlap = true;
  if (!overlap) {
    const c = whole(b.id, nx, ny);
    const ok = c.ok || c.reason === 'cost';
    for (let y = ny; y < ny + b.h; y++) for (let x = nx; x < nx + b.w; x++) cells.push({ x, y, ok, own: false });
    return { ok, cells, same };
  }
  let all = true;
  for (let y = ny; y < ny + b.h; y++) for (let x = nx; x < nx + b.w; x++) {
    const own = inOld(x, y);
    const ok = own || probe(x, y);
    if (!ok) all = false;
    cells.push({ x, y, ok, own });
  }
  return { ok: all && !same, cells, same };
}

// ── bulk brush / rebuild-all ────────────────────────────────────────────────
/** Buildings under a brush stroke (unique, in stroke order), filtered by what the op applies to. */
export function bulkTargets(buildings: readonly (Bld & Pick<BuildingState, 'hp' | 'maxHp'>)[], cells: ReadonlyArray<{ x: number; y: number }>,
  op: 'upgrade' | 'repair', maxLevelOf: (id: BuildingId) => number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const c of cells) {
    for (const b of buildings) {
      if (seen.has(b.uid) || b.ruined || b.id === 'hearth') continue;
      if (c.x < b.x || c.x >= b.x + b.w || c.y < b.y || c.y >= b.y + b.h) continue;
      seen.add(b.uid);
      if (op === 'repair' ? b.hp < b.maxHp - 0.5 && b.maxHp > 1 : b.level < maxLevelOf(b.id) || b.id === 'wall_wood') out.push(b.uid);
    }
  }
  return out;
}

/** Repair price (§6.1): 1 wood (stone for stone buildings) per 15 missing HP. */
export function repairCost(b: Pick<BuildingState, 'hp' | 'maxHp'>, stone: boolean, hpPerUnit = 15): Cost {
  const units = Math.ceil(Math.max(0, b.maxHp - b.hp) / hpPerUnit);
  if (!units) return {};
  return stone ? { stone: units } : { wood: units };
}

/** Total of per-building costs (bulk brush, Rebuild-all). */
export function totalCost(uids: readonly number[], costOf: (uid: number) => Cost | null): Cost {
  let t: Cost = {};
  for (const u of uids) t = addCost(t, costOf(u));
  return t;
}

/** Ruins the player can rebuild (§6.6), nearest to the Hearth first. */
export function ruinsOf(s: Pick<GameState, 'buildings' | 'hearthUid'>): number[] {
  const h = s.buildings.find((b) => b.uid === s.hearthUid);
  const hx = h ? h.x + h.w / 2 : 0, hy = h ? h.y + h.h / 2 : 0;
  return s.buildings.filter((b) => b.ruined)
    .sort((a, b) => Math.hypot(a.x - hx, a.y - hy) - Math.hypot(b.x - hx, b.y - hy)).map((b) => b.uid);
}

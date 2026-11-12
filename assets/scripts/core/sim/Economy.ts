// SPEC v2 §6: placement rules, unlocks/uniqueness/cap, costs (incl. iron), place/paint/upgrade/repair/sell/undo,
// ruins (rebuild / rebuild all / clear), relocation, bulk ops, wall auto-tile, adjacency synergies, time scale.
import type { BuildCheck, BuildingId, Cost, Vec } from '../api';
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { BUILDINGS } from '../data/buildings';
import { RESEARCH } from '../data/progression';
import { isRockKind, isTreeKind } from './MapGen';
import { brazierBurning, computeStaticLight } from './Light';
import { removeBuildingNow } from './Combat';
import {
  type World, type BuildingX, type HeroX, emit, newUid, canAfford, payCost, refund, addCost, scaleCost, boonStacks, isTower, isFloor,
  isWallLike, isWall, leader, distToRect, researchDone,
} from './World';
import { bountyProgress, noteFirstBuilt } from './Daily';
import { buildCostMul, structureMods } from './heroBridge';


/** Cost to build (level 1) or to upgrade to `level` (2/3). Includes blessing/hero discounts. */
export function buildingCost(w: World, id: BuildingId, level = 1): Cost {
  const d = BUILDINGS[id];
  let c: Cost;
  if (level <= 1) c = d.cost;
  else {
    const ex = d.upgradeCost?.[level - 2];
    c = ex ?? scaleCost(d.cost, BALANCE.build.upgradeCostMul[Math.min(2, level - 1)]);
  }
  let m = 1;
  if (isWall(id)) m *= Math.max(0, 1 - BOON_FX.mason * boonStacks(w, 'mason'));
  if (id !== 'hearth') m *= buildCostMul(w);
  return m === 1 ? { ...c } : scaleCost(c, m);
}

/** Total cost of a building at `level` (L1 + every upgrade) — used for rebuild prices. */
export function cumulativeCost(w: World, id: BuildingId, level: number): Cost {
  let c: Cost = {};
  for (let l = 1; l <= level; l++) c = addCost(c, buildingCost(w, id, l));
  return c;
}

export function maxLevelOf(w: World, id: BuildingId): number {
  if (id === 'brazier') return researchDone(w, 1, 5) ? 3 : 2;   // research "double brazier"
  return BUILDINGS[id].maxLevel;
}

export function upgradeCostOf(w: World, b: BuildingX): Cost | null {
  const d = BUILDINGS[b.id];
  if (b.id === 'hearth') return null;
  if (d.upgradeTo) return isUnlocked(w, d.upgradeTo) ? buildingCost(w, d.upgradeTo, 1) : null;
  if (b.level >= maxLevelOf(w, b.id)) return null;
  return buildingCost(w, b.id, b.level + 1);
}

export function buildingMaxHp(w: World, id: BuildingId, level: number, b?: BuildingX): number {
  if (id === 'hearth') return BALANCE.hearthTiers[Math.max(0, Math.min(9, w.s.hearthTier - 1))].hp;
  const d = BUILDINGS[id];
  let hp = d.hp[Math.min(2, level - 1)];
  if (isWall(id)) {
    hp *= 1 + BOON_FX.boulder * boonStacks(w, 'boulder');
    if (researchDone(w, 0, 1)) hp *= 1 + RESEARCH.wallHp;
  }
  if (isTower(id) && researchDone(w, 0, 6)) hp *= 1 + RESEARCH.towerMul;
  if (b) hp *= structureMods(w, b).hpMul;
  return Math.round(hp);
}

export function isUnlocked(w: World, id: BuildingId): boolean {
  const d = BUILDINGS[id];
  if (d.cosmetic) return w.s.cosmetics.owned.includes(id);
  return w.s.unlocked.includes(id);
}

/** Building cap usage (§6.6: walls weigh 1/4, ruins count, the Hearth does not). */
export function capUsed(w: World): number {
  let n = 0;
  for (const b of w.s.buildings as BuildingX[]) {
    if (b.id === 'hearth' || (b.dead && !b.ruined)) continue;
    n += isWall(b.id) ? BALANCE.build.wallCapWeight : 1;
  }
  return n;
}

export function countNear(w: World, rect: { x: number; y: number; w: number; h: number }, pred: (k: string) => boolean, r: number): number {
  let n = 0;
  const x0 = Math.max(0, Math.floor(rect.x - r)), x1 = Math.min(w.size - 1, Math.ceil(rect.x + rect.w + r));
  const y0 = Math.max(0, Math.floor(rect.y - r)), y1 = Math.min(w.size - 1, Math.ceil(rect.y + rect.h + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ni = w.nodeAt[y * w.size + x]; if (!ni) continue;
    const nd = w.s.nodes[ni - 1];
    if (!pred(nd.kind)) continue;
    if (distToRect(nd.x + 0.5, nd.y + 0.5, rect) <= r) n++;
  }
  return n;
}

export function buildPhaseOk(w: World): boolean {
  const p = w.s.phase;
  if (w.s.expedition) return false;
  return p === 'peace' || p === 'dusk' || p === 'night';
}

interface PlaceOpts { ignoreUid?: number; free?: boolean; extra?: Cost }

/** Footprint / light / units check shared by place, relocate and rebuild. */
function footprintCheck(w: World, id: BuildingId, x: number, y: number, o: PlaceOpts): BuildCheck['reason'] | null {
  const d = BUILDINGS[id];
  if (w.lightDirty) computeStaticLight(w);
  const n = w.size;
  const floor = isFloor(id);
  let dark = false;
  for (let cy = y; cy < y + d.h; cy++) for (let cx = x; cx < x + d.w; cx++) {
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) return 'blocked';
    const i = cy * n + cx;
    const own = (u: number) => u !== 0 && u !== o.ignoreUid;
    if (w.terrain[i] !== 0 || own(w.bldAt[i]) || own(w.trapAt[i]) || own(w.ruinAt[i]) || w.poiAt[i]) return 'blocked';
    if (w.s.map.veil[i]) return 'blocked';
    const ni = w.nodeAt[i];
    if (ni) { const k = w.s.nodes[ni - 1].kind; if (k !== 'stump' && k !== 'bush') return 'blocked'; }
    for (const p of w.s.pois) if (p.x === cx && p.y === cy && (p.active || p.kind === 'rift' || p.kind === 'chest' || p.kind === 'heart' || p.kind === 'ruin' || p.kind === 'shrine' || p.kind === 'camp')) return 'blocked';
    const L = w.staticLight[i];
    if (id === 'brazier' ? L < 1 : L < 2) dark = true;
    if (id === 'dock' && w.s.map.biome[i] !== 'shore') return 'blocked';
  }
  const rect = { x, y, w: d.w, h: d.h };
  for (const h of w.s.heroes as HeroX[]) if (!h.dead && distToRect(h.x, h.y, rect) < 0.3) return 'blocked';
  if (!floor) {
    for (const e of w.s.enemies) if (distToRect(e.x, e.y, rect) < 0.25 && !e.flying) return 'blocked';
    for (const a of w.s.allies) if (distToRect(a.x, a.y, rect) < 0.25) return 'blocked';
  }
  if (dark) return 'dark';
  if (id === 'lumber_camp' && countNear(w, rect, (k) => isTreeKind(k as never), 4) < 3) return 'blocked';
  if (id === 'quarry' && countNear(w, rect, (k) => isRockKind(k as never) || k === 'ore', 4) < 2) return 'blocked';
  return null;
}

export function canPlace(w: World, id: BuildingId, x: number, y: number, o: PlaceOpts = {}): BuildCheck {
  const d = BUILDINGS[id];
  const cost = buildingCost(w, id, 1);
  if (id === 'hearth') return { ok: false, reason: 'blocked', cost };
  if (!buildPhaseOk(w)) return { ok: false, reason: 'phase', cost };
  if (!isUnlocked(w, id)) return { ok: false, reason: 'locked', cost };
  if (d.unique && (w.s.buildings as BuildingX[]).some((b) => b.id === id && b.uid !== o.ignoreUid && (!b.dead || b.ruined))) return { ok: false, reason: 'unique', cost };
  if (!o.ignoreUid && capUsed(w) + (isWall(id) ? BALANCE.build.wallCapWeight : 1) > BALANCE.build.cap + 1e-9) return { ok: false, reason: 'cap', cost };
  const fr = footprintCheck(w, id, x, y, o);
  if (fr) return { ok: false, reason: fr, cost };
  if (!o.free && !canAfford(w.s.res, o.extra ? addCost(cost, o.extra) : cost)) return { ok: false, reason: 'cost', cost };
  return { ok: true, cost };
}

export function inBuildSession(w: World): boolean { return w.s.buildMode || w.s.phase === 'dusk'; }

function occupy(w: World, b: BuildingX, uid: number): void {
  const arr = b.ruined ? w.ruinAt : isFloor(b.id) ? w.trapAt : w.bldAt;
  for (let cy = b.y; cy < b.y + b.h; cy++) for (let cx = b.x; cx < b.x + b.w; cx++) arr[cy * w.size + cx] = uid;
}

/** Create a building without cost checks (used by place, start gift, tests). */
export function spawnBuilding(w: World, id: BuildingId, x: number, y: number, invested: Cost, opts: { level?: number; night?: boolean } = {}): BuildingX {
  const d = BUILDINGS[id];
  const level = opts.level ?? 1;
  const maxHp = buildingMaxHp(w, id, level);
  const constructing = opts.night ? BALANCE.build.nightBuildDelay : 0;
  const b: BuildingX = {
    uid: newUid(w), id, x, y, w: d.w, h: d.h, level, hp: constructing ? Math.round(maxHp * 0.5) : maxHp, maxHp,
    lit: id === 'brazier', open: false, constructing, charges: d.charges ? d.charges[level - 1] + (id === 'trap_spikes' ? BOON_FX.spikes * boonStacks(w, 'spikes') : 0) : 0,
    aimAngle: 0, wallMask: 0, synergies: [], cooldown: 0,
    ruined: false, workers: 0, workerSlots: d.slots ? d.slots[Math.min(2, level - 1)] : 0, garrison: null, module: null, frozenT: 0, burningT: 0, powered: true,
    pathHp: 0, invested: { ...invested }, session: inBuildSession(w) ? w.r.session : -1, snuffed: false, offT: 0,
    fueled: true, relightT: 0, burnT: 0, dead: false, dusk: w.s.phase === 'dusk', synMask: 0, produceAcc: 0, wraithCd: 0, igniteT: 0, shieldT: 0, mode: 0,
  };
  b.pathHp = b.hp;
  w.s.buildings.push(b);
  w.bmap.set(b.uid, b);
  occupy(w, b, b.uid);
  w.r.fieldDirty = true; w.lightDirty = true; w.r.snuffDirty = true;
  if (d.wallLike) w.wallMaskDirty = true;
  return b;
}

function afterBuilt(w: World, b: BuildingX): void {
  w.s.stats.built++;
  emit(w, { t: 'built', uid: b.uid, id: b.id, x: b.x, y: b.y });
  if (isWallLike(b.id)) w.r.tut.walls++;
  noteFirstBuilt(w, b.id);
  if (isWall(b.id)) bountyProgress(w, 'walls', 1);
  else if (isTower(b.id)) bountyProgress(w, 'towers', 1);
  else if (b.id === 'trap_spikes' || b.id === 'trap_tar') bountyProgress(w, 'traps', 1);
}

export function place(w: World, id: BuildingId, x: number, y: number, group?: number[]): BuildingX | null {
  const chk = canPlace(w, id, x, y);
  if (!chk.ok) { emit(w, { t: 'buildFail', reason: chk.reason!, x, y }); return null; }
  payCost(w, chk.cost);
  const b = spawnBuilding(w, id, x, y, chk.cost, { night: w.s.phase === 'night' });
  afterBuilt(w, b);
  if (group) group.push(b.uid);
  else pushUndo(w, [b.uid], chk.cost);
  return b;
}

function pushUndo(w: World, uids: number[], cost: Cost): void {
  if (!inBuildSession(w) || !uids.length) return;
  w.r.undo.push({ uids, cost, session: w.r.session });
  if (w.r.undo.length > BALANCE.build.undoDepth) w.r.undo.shift();
}

export function paint(w: World, id: BuildingId, cells: Vec[]): number {
  const d = BUILDINGS[id];
  if (!d.paintable) { emit(w, { t: 'buildFail', reason: 'blocked', x: cells[0]?.x ?? 0, y: cells[0]?.y ?? 0 }); return 0; }
  const group: number[] = [];
  let total: Cost = {};
  let failed: BuildCheck['reason'] | null = null;
  const seen = new Set<number>();
  for (const c of cells) {
    const k = c.y * w.size + c.x;
    if (seen.has(k)) continue; seen.add(k);
    const chk = canPlace(w, id, c.x, c.y);
    if (!chk.ok) { if (chk.reason === 'cost' || chk.reason === 'cap' || chk.reason === 'locked') failed = chk.reason; continue; }
    payCost(w, chk.cost);
    total = addCost(total, chk.cost);
    const b = spawnBuilding(w, id, c.x, c.y, chk.cost, { night: w.s.phase === 'night' });
    afterBuilt(w, b);
    group.push(b.uid);
  }
  if (failed && cells.length) emit(w, { t: 'buildFail', reason: failed, x: cells[cells.length - 1].x, y: cells[cells.length - 1].y });
  pushUndo(w, group, total);
  return group.length;
}

export function upgrade(w: World, uid: number): boolean {
  const b = w.bmap.get(uid);
  if (!b || b.dead || !buildPhaseOk(w)) return false;
  const d = BUILDINGS[b.id];
  const cost = upgradeCostOf(w, b);
  if (!cost) { emit(w, { t: 'buildFail', reason: b.id !== 'hearth' && d.upgradeTo ? 'locked' : 'blocked', x: b.x, y: b.y }); return false; }
  if (!canAfford(w.s.res, cost)) { emit(w, { t: 'buildFail', reason: 'cost', x: b.x, y: b.y }); return false; }
  payCost(w, cost);
  b.invested = addCost(b.invested, cost);
  if (d.upgradeTo) {
    b.id = d.upgradeTo; b.level = 1;
    b.maxHp = buildingMaxHp(w, b.id, 1, b);
    b.hp = b.maxHp;
    noteFirstBuilt(w, b.id);
  } else {
    const before = b.maxHp;
    b.level = b.level + 1;
    b.maxHp = buildingMaxHp(w, b.id, b.level, b);
    b.hp = Math.min(b.maxHp, b.hp + (b.maxHp - before));
    if (b.id === 'trap_spikes') b.charges = d.charges![b.level - 1] + BOON_FX.spikes * boonStacks(w, 'spikes');
    if (d.slots) b.workerSlots = d.slots[Math.min(2, b.level - 1)];
  }
  w.r.fieldDirty = true; w.lightDirty = true; w.r.snuffDirty = true;
  emit(w, { t: 'upgraded', uid });
  bountyProgress(w, 'upgrade', 1);
  return true;
}

export function repairUnits(w: World, b: BuildingX): number {
  return Math.ceil((b.maxHp - b.hp) / BALANCE.build.repairHpPerUnit);
}
function repairUnitCost(w: World): number { return researchDone(w, 0, 2) ? 1 - RESEARCH.repairDiscount : 1; }

export function repairCost(w: World, b: BuildingX): Cost {
  const units = Math.ceil(repairUnits(w, b) * repairUnitCost(w) - 1e-9);
  return BUILDINGS[b.id].stone ? { stone: units } : { wood: units };
}

export function repair(w: World, uid: number): boolean {
  const b = w.bmap.get(uid);
  if (!b || b.dead || b.id === 'hearth' || isFloor(b.id) && b.id !== 'farm' || b.hp >= b.maxHp) return false;
  const stone = BUILDINGS[b.id].stone;
  const per = repairUnitCost(w);
  const need = repairUnits(w, b);
  const have = Math.floor((stone ? w.s.res.stone : w.s.res.wood) / per + 1e-9);
  const units = Math.min(need, have);
  if (units <= 0) { emit(w, { t: 'buildFail', reason: 'cost', x: b.x, y: b.y }); return false; }
  const pay = Math.ceil(units * per - 1e-9);
  if (stone) w.s.res.stone -= pay; else w.s.res.wood -= pay;
  const before = b.hp;
  b.hp = Math.min(b.maxHp, b.hp + units * BALANCE.build.repairHpPerUnit);
  if (Math.abs(b.hp - b.pathHp) >= BALANCE.path.hpChangeFrac * b.maxHp) w.r.fieldDirty = true;
  emit(w, { t: 'repaired', uid });
  bountyProgress(w, 'repair', Math.round(b.hp - before));
  return true;
}

export function refundRate(w: World): number {
  if (w.s.phase === 'dusk') return 1;
  return BALANCE.build.sellRefund;
}

export function sell(w: World, uid: number): boolean {
  const b = w.bmap.get(uid);
  if (!b || b.dead || b.id === 'hearth') return false;
  refund(w, b.invested, refundRate(w));
  b.dead = true;
  removeBuildingNow(w, b);
  emit(w, { t: 'sold', uid });
  return true;
}

export function undo(w: World): boolean {
  while (w.r.undo.length) {
    const u = w.r.undo.pop()!;
    if (u.session !== w.r.session) continue;
    let any = false;
    for (const uid of u.uids) {
      const b = w.bmap.get(uid);
      if (!b || b.dead) continue;
      refund(w, b.invested, 1);
      b.dead = true; removeBuildingNow(w, b);
      w.s.stats.built = Math.max(0, w.s.stats.built - 1);
      emit(w, { t: 'sold', uid });
      any = true;
    }
    if (any) return true;
  }
  return false;
}

// ── ruins (§6.6) ─────────────────────────────────────────────────────────────
export function rebuildCost(w: World, b: BuildingX): Cost {
  return scaleCost(cumulativeCost(w, b.id, b.level), BALANCE.loss.rebuildCostMul);
}

export function rebuild(w: World, uid: number, silentFail = false): boolean {
  const b = w.bmap.get(uid);
  if (!b || !b.ruined || !buildPhaseOk(w)) return false;
  const cost = rebuildCost(w, b);
  if (!canAfford(w.s.res, cost)) { if (!silentFail) emit(w, { t: 'buildFail', reason: 'cost', x: b.x, y: b.y }); return false; }
  for (let cy = b.y; cy < b.y + b.h; cy++) for (let cx = b.x; cx < b.x + b.w; cx++) if (w.ruinAt[cy * w.size + cx] === b.uid) w.ruinAt[cy * w.size + cx] = 0;
  const fr = footprintCheck(w, b.id, b.x, b.y, { ignoreUid: b.uid });
  if (fr && fr !== 'dark') { occupy(w, b, b.uid); if (!silentFail) emit(w, { t: 'buildFail', reason: fr, x: b.x, y: b.y }); return false; }
  payCost(w, cost);
  b.ruined = false; b.dead = false;
  b.maxHp = buildingMaxHp(w, b.id, b.level, b);
  b.constructing = w.s.phase === 'night' ? BALANCE.build.nightBuildDelay : 0;
  b.hp = b.constructing ? Math.round(b.maxHp * 0.5) : b.maxHp;
  b.pathHp = b.hp; b.snuffed = false; b.offT = 0; b.burningT = 0; b.frozenT = 0;
  if (b.id === 'trap_spikes') b.charges = BUILDINGS.trap_spikes.charges![b.level - 1];
  occupy(w, b, b.uid);
  w.r.fieldDirty = true; w.lightDirty = true; w.r.snuffDirty = true; w.wallMaskDirty = true;
  emit(w, { t: 'rebuilt', uid });
  return true;
}

export function rebuildAllCost(w: World): Cost {
  let c: Cost = {};
  for (const b of w.s.buildings as BuildingX[]) if (b.ruined) c = addCost(c, rebuildCost(w, b));
  return c;
}

/** Rebuild every ruin that is affordable (cheapest first, Hearth-near first). Returns how many. */
export function rebuildAll(w: World): number {
  const ruins = (w.s.buildings as BuildingX[]).filter((b) => b.ruined)
    .sort((a, b) => distToRect(48, 48, a) - distToRect(48, 48, b) || a.uid - b.uid);
  let n = 0;
  for (const b of ruins) if (rebuild(w, b.uid, true)) n++;
  return n;
}

export function clearRuin(w: World, uid: number): boolean {
  const b = w.bmap.get(uid);
  if (!b || !b.ruined) return false;
  removeBuildingNow(w, b);
  return true;
}

// ── relocation (§6.6) ────────────────────────────────────────────────────────
export function relocate(w: World, uid: number, x: number, y: number): boolean {
  const b = w.bmap.get(uid);
  if (!b || b.dead || b.id === 'hearth') return false;
  if (w.s.phase !== 'peace' && w.s.phase !== 'dusk') { emit(w, { t: 'buildFail', reason: 'phase', x, y }); return false; }
  const fr = footprintCheck(w, b.id, x, y, { ignoreUid: b.uid });
  if (fr) { emit(w, { t: 'buildFail', reason: fr, x, y }); return false; }
  occupy(w, b, 0);
  b.x = x; b.y = y;
  occupy(w, b, b.uid);
  w.r.fieldDirty = true; w.lightDirty = true; w.r.snuffDirty = true; w.wallMaskDirty = true;
  emit(w, { t: 'relocated', uid });
  bountyProgress(w, 'relocate', 1);
  return true;
}

export function bulk(w: World, op: 'upgrade' | 'repair', uids: number[]): number {
  let n = 0;
  for (const u of uids) if (op === 'upgrade' ? upgrade(w, u) : repair(w, u)) n++;
  return n;
}

// ── build mode / time scale ──────────────────────────────────────────────────
export function setBuildMode(w: World, on: boolean): void {
  if (w.s.phase === 'dusk') on = true;
  if (w.s.phase === 'dawn') on = false;
  if (on && !w.s.buildMode) { w.r.session++; w.r.undo = []; }
  if (!on && w.s.buildMode) w.r.undo = [];
  w.s.buildMode = on;
  updateTimeScale(w);
}

export function updateTimeScale(w: World): void {
  const p = w.s.phase;
  if (p === 'dusk' || p === 'dawn') w.s.timeScale = 0;
  else if (p === 'peace') w.s.timeScale = w.s.buildMode && BALANCE.peace.buildModePauses ? 0 : 1;
  else w.s.timeScale = w.s.buildMode ? BALANCE.night.buildTimeScale : 1;
}

// ── wall auto-tile mask (N1 E2 S4 W8) ─────────────────────────────────────────
export function updateWallMasks(w: World): void {
  const n = w.size;
  const wl = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return false;
    const u = w.bldAt[y * n + x]; if (!u) return false;
    const o = w.bmap.get(u); return !!o && isWallLike(o.id);
  };
  for (const b of w.s.buildings as BuildingX[]) {
    if (!isWallLike(b.id) || b.dead) continue;
    b.wallMask = (wl(b.x, b.y - 1) ? 1 : 0) | (wl(b.x + 1, b.y) ? 2 : 0) | (wl(b.x, b.y + 1) ? 4 : 0) | (wl(b.x - 1, b.y) ? 8 : 0);
  }
  w.wallMaskDirty = false;
}

// ── synergies (§6.4) ─────────────────────────────────────────────────────────
export const SYN = { flame: 1, embedded: 2, rally: 4, tarSpike: 8 } as const;
const SYN_NAMES: Array<'flame' | 'embedded' | 'rally' | 'tarSpike'> = ['flame', 'embedded', 'rally', 'tarSpike'];

function cheb(a: { x: number; y: number; w: number; h: number }, x: number, y: number): number {
  const dx = Math.max(a.x - x, 0, x - (a.x + a.w - 1));
  const dy = Math.max(a.y - y, 0, y - (a.y + a.h - 1));
  return Math.max(dx, dy);
}

export function updateSynergies(w: World): void {
  const n = w.size;
  const ld = leader(w);
  const S = BALANCE.synergy;
  let braziers: BuildingX[] | null = null;
  for (const b of w.s.buildings as BuildingX[]) {
    if (b.dead) continue;
    let m = 0;
    if (isTower(b.id)) {
      if (b.id === 'tower_arrow' || b.id === 'tower_ballista') {
        if (!braziers) braziers = (w.s.buildings as BuildingX[]).filter((o) => o.id === 'brazier' && brazierBurning(w, o));
        for (const o of braziers) if (cheb(b, o.x, o.y) <= S.flameRange) { m |= SYN.flame; break; }
      }
      let sides = 0;
      const touch = (x: number, y: number) => { if (x < 0 || y < 0 || x >= n || y >= n) return false; const u = w.bldAt[y * n + x]; const o = u ? w.bmap.get(u) : null; return !!o && isWallLike(o.id); };
      let t = false; for (let x = b.x; x < b.x + b.w; x++) if (touch(x, b.y - 1)) t = true; if (t) sides++;
      t = false; for (let x = b.x; x < b.x + b.w; x++) if (touch(x, b.y + b.h)) t = true; if (t) sides++;
      t = false; for (let y = b.y; y < b.y + b.h; y++) if (touch(b.x - 1, y)) t = true; if (t) sides++;
      t = false; for (let y = b.y; y < b.y + b.h; y++) if (touch(b.x + b.w, y)) t = true; if (t) sides++;
      if (sides >= 2) m |= SYN.embedded;
      if (ld && Math.hypot(ld.x - (b.x + b.w / 2), ld.y - (b.y + b.h / 2)) <= S.rallyRange) m |= SYN.rally;
    } else if (b.id === 'trap_tar' || b.id === 'trap_spikes') {
      const other = b.id === 'trap_tar' ? 'trap_spikes' : 'trap_tar';
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = b.x + dx, y = b.y + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const u = w.trapAt[y * n + x]; const o = u ? w.bmap.get(u) : null;
        if (o && o.id === other) { m |= SYN.tarSpike; break; }
      }
    }
    if (m !== b.synMask) {
      b.synMask = m;
      b.synergies = SYN_NAMES.filter((_, i) => m & (1 << i));
    }
  }
}

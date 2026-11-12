// SPEC §6: placement rules, costs, place/paint/upgrade/repair/sell/undo, wall auto-tile, adjacency synergies,
// economy buildings (lumber camp / quarry production).
import type { BuildCheck, BuildingId, Resources, Vec } from '../api';
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { BUILDINGS } from '../data/buildings';
import { SKILLS } from '../data/heroes';
import { TALENT_BY_ID } from '../data/talents';
import { isRockKind, isTreeKind } from './MapGen';
import { brazierBurning, computeStaticLight } from './Light';
import { removeBuildingNow } from './Combat';
import {
  type World, type BuildingX, type HeroX, emit, newUid, canAfford, payRes, boonStacks, isTower, isTrap, isWallLike,
  leader, distToRect,
} from './World';

const ZERO: Resources = { wood: 0, stone: 0, gold: 0 };

function scaleRes(r: Resources, m: number): Resources {
  return { wood: Math.ceil(r.wood * m - 1e-9) + 0, stone: Math.ceil(r.stone * m - 1e-9) + 0, gold: Math.ceil(r.gold * m - 1e-9) + 0 };
}

function tinkerInSquad(w: World): boolean { return (w.s.heroes as HeroX[]).some((h) => h.id === 'tinker'); }

/** Cost to build (level 1) or to upgrade to `level` (2/3). Includes boon/hero discounts. */
export function buildingCost(w: World, id: BuildingId, level: 1 | 2 | 3 = 1): Resources {
  const d = BUILDINGS[id];
  let c: Resources;
  if (level === 1) c = d.cost;
  else {
    const ex = d.upgradeCost?.[level - 2];
    c = ex ?? scaleRes(d.cost, BALANCE.build.upgradeCostMul[level - 1]);
  }
  let m = 1;
  if (id === 'wall_wood' || id === 'wall_stone') m *= Math.max(0, 1 - BOON_FX.mason * boonStacks(w, 'mason'));
  if (tinkerInSquad(w) && id !== 'hearth') m *= SKILLS.passive.tinkerCostMul;
  return m === 1 ? { ...c } : scaleRes(c, m);
}

export function upgradeCostOf(w: World, b: BuildingX): Resources | null {
  const d = BUILDINGS[b.id];
  if (d.upgradeTo) return buildingCost(w, d.upgradeTo, 1);
  if (b.level >= d.maxLevel) return null;
  return buildingCost(w, b.id, (b.level + 1) as 2 | 3);
}

export function buildingMaxHp(w: World, id: BuildingId, level: number): number {
  const d = BUILDINGS[id];
  let hp = d.hp[level - 1];
  if (id === 'wall_wood' || id === 'wall_stone') hp *= 1 + BOON_FX.boulder * boonStacks(w, 'boulder');
  if (id === 'hearth') hp *= 1 + TALENT_BY_ID.hearthHp.perLevel * (w.meta.talents.hearthHp ?? 0);
  return Math.round(hp);
}

export function countNear(w: World, rect: { x: number; y: number; w: number; h: number }, pred: (k: string) => boolean, r: number): number {
  let n = 0;
  for (const nd of w.s.nodes) {
    if (!pred(nd.kind)) continue;
    if (distToRect(nd.x + 0.5, nd.y + 0.5, rect) <= r) n++;
  }
  return n;
}

export function canPlace(w: World, id: BuildingId, x: number, y: number, extraCost: Resources = ZERO): BuildCheck {
  const d = BUILDINGS[id];
  const cost = buildingCost(w, id, 1);
  if (w.lightDirty) computeStaticLight(w);
  if (id === 'hearth') return { ok: false, reason: 'blocked', cost };
  if (d.should && !w.meta.unlockedBlueprints.includes(id)) return { ok: false, reason: 'locked', cost };
  if (w.s.phase === 'victory' || w.s.phase === 'defeat') return { ok: false, reason: 'blocked', cost };
  if (w.s.buildings.length >= BALANCE.caps.buildings) return { ok: false, reason: 'blocked', cost };
  const n = w.size;
  const trap = isTrap(id);
  let dark = false;
  for (let cy = y; cy < y + d.h; cy++) for (let cx = x; cx < x + d.w; cx++) {
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) return { ok: false, reason: 'blocked', cost };
    const i = cy * n + cx;
    if (w.terrain[i] !== 0 || w.bldAt[i] || w.trapAt[i]) return { ok: false, reason: 'blocked', cost };
    const ni = w.nodeAt[i];
    if (ni) { const k = w.s.nodes[ni - 1].kind; if (k !== 'stump' && k !== 'bush') return { ok: false, reason: 'blocked', cost }; }
    for (const p of w.s.pois) if (p.x === cx && p.y === cy && (p.active || p.kind === 'rift' || p.kind === 'chest')) return { ok: false, reason: 'blocked', cost };
    const L = w.staticLight[i];
    if (id === 'brazier' ? L < 1 : L < 2) dark = true;
  }
  const rect = { x, y, w: d.w, h: d.h };
  for (const h of w.s.heroes as HeroX[]) if (!h.dead && distToRect(h.x, h.y, rect) < 0.3) return { ok: false, reason: 'blocked', cost };
  if (!trap) for (const e of w.s.enemies) if (distToRect(e.x, e.y, rect) < 0.25 && !(e as { flying?: boolean }).flying) return { ok: false, reason: 'blocked', cost };
  for (const a of w.s.allies) if (distToRect(a.x, a.y, rect) < 0.25 && !trap) return { ok: false, reason: 'blocked', cost };
  if (dark) return { ok: false, reason: 'dark', cost };
  if (id === 'lumber_camp' && countNear(w, rect, (k) => k === 'pine' || k === 'oak', 3) < 3) return { ok: false, reason: 'blocked', cost };
  if (id === 'quarry' && countNear(w, rect, (k) => isRockKind(k as never), 3) < 2) return { ok: false, reason: 'blocked', cost };
  const need = { wood: cost.wood + extraCost.wood, stone: cost.stone + extraCost.stone, gold: cost.gold + extraCost.gold };
  if (!canAfford(w.s.res, need)) return { ok: false, reason: 'cost', cost };
  return { ok: true, cost };
}
void isTreeKind;

export function inBuildSession(w: World): boolean { return w.s.buildMode || w.s.phase === 'dusk'; }

/** Create a building without cost checks (used by place, start gift, save restore). */
export function spawnBuilding(w: World, id: BuildingId, x: number, y: number, invested: Resources, opts: { level?: 1 | 2 | 3; night?: boolean } = {}): BuildingX {
  const d = BUILDINGS[id];
  const level = opts.level ?? 1;
  const maxHp = buildingMaxHp(w, id, level);
  const constructing = opts.night ? BALANCE.build.nightBuildDelay : 0;
  const b: BuildingX = {
    uid: newUid(w), id, x, y, w: d.w, h: d.h, level, hp: constructing ? Math.round(maxHp * 0.5) : maxHp, maxHp,
    lit: id === 'brazier', open: false, constructing, charges: d.charges ? d.charges[level - 1] + (id === 'trap_spikes' ? BOON_FX.spikes * boonStacks(w, 'spikes') : 0) : 0,
    aimAngle: 0, wallMask: 0, synergies: [], cooldown: 0,
    pathHp: 0, invested: { ...invested }, session: inBuildSession(w) ? w.r.session : -1, produceT: 0, snuffed: false, offT: 0,
    fueled: true, relightT: 0, burnT: 0, dead: false, dusk: w.s.phase === 'dusk', synMask: 0,
  };
  b.pathHp = b.hp;
  w.s.buildings.push(b);
  w.bmap.set(b.uid, b);
  for (let cy = y; cy < y + d.h; cy++) for (let cx = x; cx < x + d.w; cx++) {
    if (isTrap(id)) w.trapAt[cy * w.size + cx] = b.uid; else w.bldAt[cy * w.size + cx] = b.uid;
  }
  w.r.fieldDirty = true; w.lightDirty = true; w.r.snuffDirty = true;
  if (d.wallLike) w.wallMaskDirty = true;
  return b;
}

export function place(w: World, id: BuildingId, x: number, y: number, group?: number[]): BuildingX | null {
  const chk = canPlace(w, id, x, y);
  if (!chk.ok) { emit(w, { t: 'buildFail', reason: chk.reason!, x, y }); return null; }
  payRes(w, chk.cost);
  const b = spawnBuilding(w, id, x, y, chk.cost, { night: w.s.phase === 'night' });
  w.s.stats.built++;
  emit(w, { t: 'built', uid: b.uid, id, x, y });
  if (group) group.push(b.uid);
  else pushUndo(w, [b.uid], chk.cost);
  if (isWallLike(id)) w.r.tut.walls++;
  return b;
}

function pushUndo(w: World, uids: number[], cost: Resources): void {
  if (!inBuildSession(w) || !uids.length) return;
  w.r.undo.push({ uids, cost, session: w.r.session });
  if (w.r.undo.length > BALANCE.build.undoDepth) w.r.undo.shift();
}

export function paint(w: World, id: BuildingId, cells: Vec[]): number {
  const d = BUILDINGS[id];
  if (!d.paintable) { emit(w, { t: 'buildFail', reason: 'blocked', x: cells[0]?.x ?? 0, y: cells[0]?.y ?? 0 }); return 0; }
  const group: number[] = [];
  const total: Resources = { wood: 0, stone: 0, gold: 0 };
  let failedCost = false;
  const seen = new Set<number>();
  for (const c of cells) {
    const k = c.y * w.size + c.x;
    if (seen.has(k)) continue; seen.add(k);
    const chk = canPlace(w, id, c.x, c.y);
    if (!chk.ok) { if (chk.reason === 'cost') failedCost = true; continue; }
    payRes(w, chk.cost);
    total.wood += chk.cost.wood; total.stone += chk.cost.stone; total.gold += chk.cost.gold;
    const b = spawnBuilding(w, id, c.x, c.y, chk.cost, { night: w.s.phase === 'night' });
    w.s.stats.built++;
    if (isWallLike(id)) w.r.tut.walls++;
    emit(w, { t: 'built', uid: b.uid, id, x: c.x, y: c.y });
    group.push(b.uid);
  }
  if (failedCost && cells.length) emit(w, { t: 'buildFail', reason: 'cost', x: cells[cells.length - 1].x, y: cells[cells.length - 1].y });
  pushUndo(w, group, total);
  return group.length;
}

export function upgrade(w: World, uid: number): boolean {
  const b = w.bmap.get(uid);
  if (!b || b.dead) return false;
  const d = BUILDINGS[b.id];
  const cost = upgradeCostOf(w, b);
  if (!cost) { emit(w, { t: 'buildFail', reason: 'blocked', x: b.x, y: b.y }); return false; }
  if (!canAfford(w.s.res, cost)) { emit(w, { t: 'buildFail', reason: 'cost', x: b.x, y: b.y }); return false; }
  payRes(w, cost);
  b.invested = { wood: b.invested.wood + cost.wood, stone: b.invested.stone + cost.stone, gold: b.invested.gold + cost.gold };
  if (d.upgradeTo) {
    const frac = b.hp / b.maxHp;
    b.id = d.upgradeTo; b.level = 1;
    b.maxHp = buildingMaxHp(w, b.id, 1);
    b.hp = Math.max(1, Math.round(b.maxHp * Math.max(frac, 1)));
  } else {
    const before = b.maxHp;
    b.level = (b.level + 1) as 2 | 3;
    b.maxHp = buildingMaxHp(w, b.id, b.level);
    b.hp = Math.min(b.maxHp, b.hp + (b.maxHp - before));
    if (b.id === 'trap_spikes') b.charges = d.charges![b.level - 1] + BOON_FX.spikes * boonStacks(w, 'spikes');
    if (b.id === 'hearth') w.s.hearthLevel = b.level;
  }
  w.r.fieldDirty = true; w.lightDirty = true; w.r.snuffDirty = true;
  emit(w, { t: 'upgraded', uid });
  return true;
}

export function repairCost(w: World, b: BuildingX): Resources {
  const units = Math.ceil((b.maxHp - b.hp) / BALANCE.build.repairHpPerUnit);
  return BUILDINGS[b.id].stone ? { wood: 0, stone: units, gold: 0 } : { wood: units, stone: 0, gold: 0 };
}

export function repair(w: World, uid: number): boolean {
  const b = w.bmap.get(uid);
  if (!b || b.dead || b.id === 'hearth' || isTrap(b.id) || b.hp >= b.maxHp) return false;
  const stone = BUILDINGS[b.id].stone;
  const need = Math.ceil((b.maxHp - b.hp) / BALANCE.build.repairHpPerUnit);
  const have = Math.floor(stone ? w.s.res.stone : w.s.res.wood);
  const units = Math.min(need, have);
  if (units <= 0) { emit(w, { t: 'buildFail', reason: 'cost', x: b.x, y: b.y }); return false; }
  if (stone) w.s.res.stone -= units; else w.s.res.wood -= units;
  b.hp = Math.min(b.maxHp, b.hp + units * BALANCE.build.repairHpPerUnit);
  if (Math.abs(b.hp - b.pathHp) >= BALANCE.path.hpChangeFrac * b.maxHp) w.r.fieldDirty = true;
  emit(w, { t: 'repaired', uid });
  return true;
}

export function refundRate(w: World): number {
  if (w.s.phase === 'dusk') return 1;
  return Math.min(1, BALANCE.build.sellRefund + TALENT_BY_ID.refund.perLevel * (w.meta.talents.refund ?? 0));
}

export function sell(w: World, uid: number): boolean {
  const b = w.bmap.get(uid);
  if (!b || b.dead || b.id === 'hearth') return false;
  const rate = refundRate(w);
  w.s.res.wood += Math.floor(b.invested.wood * rate);
  w.s.res.stone += Math.floor(b.invested.stone * rate);
  w.s.res.gold += Math.floor(b.invested.gold * rate);
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
      w.s.res.wood += b.invested.wood; w.s.res.stone += b.invested.stone; w.s.res.gold += b.invested.gold;
      b.dead = true; removeBuildingNow(w, b);
      w.s.stats.built = Math.max(0, w.s.stats.built - 1);
      emit(w, { t: 'sold', uid });
      any = true;
    }
    if (any) return true;
  }
  return false;
}

export function setBuildMode(w: World, on: boolean): void {
  if (w.s.phase === 'dusk') on = true;
  if (on && !w.s.buildMode) { w.r.session++; w.r.undo = []; }
  if (!on && w.s.buildMode) w.r.undo = [];
  w.s.buildMode = on;
  updateTimeScale(w);
}

export function updateTimeScale(w: World): void {
  const p = w.s.phase;
  if (p === 'dusk' || p === 'dawn' || p === 'victory' || p === 'defeat') w.s.timeScale = 0;
  else w.s.timeScale = w.s.buildMode ? BALANCE.day.buildTimeScale : 1;
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
    if (!isWallLike(b.id)) continue;
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
    let m = 0;
    if (isTower(b.id)) {
      if (b.id === 'tower_arrow' || b.id === 'tower_ballista') {
        if (!braziers) braziers = (w.s.buildings as BuildingX[]).filter((o) => o.id === 'brazier' && brazierBurning(w, o));
        for (const o of braziers) if (cheb(b, o.x, o.y) <= S.flameRange) { m |= SYN.flame; break; }
      }
      // embedded: ≥ 2 sides touching a wall/gate
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

/** Lumber camps / quarries produce during DAY. */
export function updateProduction(w: World, dt: number): void {
  if (w.s.phase !== 'day') return;
  const mul = 1 + BOON_FX.harvest * boonStacks(w, 'harvest');
  for (const b of w.s.buildings as BuildingX[]) {
    if (b.id !== 'lumber_camp' && b.id !== 'quarry') continue;
    const period = BUILDINGS[b.id].produce![b.level - 1] / mul;
    b.produceT += dt;
    if (b.produceT >= period) {
      b.produceT -= period;
      const res = b.id === 'lumber_camp' ? 'wood' : 'stone';
      w.s.res[res] += 1;
      emit(w, { t: 'harvest', node: b.uid, res, amount: 1, x: b.x + 1, y: b.y + 1 });
    }
  }
}

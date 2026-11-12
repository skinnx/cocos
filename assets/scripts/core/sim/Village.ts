// SPEC v2 §11.3 village: houses + villagers as units (walk to jobs by day, flee home at night, evacuate when the
// home is ruined, never die), jobs + auto-assign, production per worker (PEACE only; light rule 5), food at dawn
// (hungry / well-fed), storage caps, vault protection.
import type { BuildingId, ResKey } from '../api';
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { BUILDINGS } from '../data/buildings';
import { RESEARCH } from '../data/progression';
import { cellBlocks } from './Grid';
import { CENTER } from './MapGen';
import { bountyProgress } from './Daily';
import { type World, type BuildingX, type VillagerX, emit, newUid, gainRes, boonStacks, researchDone, distToRect } from './World';

const PROD_IDS: BuildingId[] = ['farm', 'lumber_camp', 'quarry', 'study', 'market', 'forge'];

// ── storage ──────────────────────────────────────────────────────────────────
export function updateStorage(w: World): void {
  const s = w.s, V = BALANCE.village;
  let lv = 0, vault = 0;
  for (const b of s.buildings as BuildingX[]) {
    if (b.dead) continue;
    if (b.id === 'storehouse') lv += b.level;
    else if (b.id === 'vault') vault = Math.max(vault, b.level);
  }
  s.storageCap = V.storeBase + V.storePerLevel * lv + (researchDone(w, 2, 1) ? RESEARCH.storage : 0);
  s.essenceCap = V.essenceBase + V.essencePerLevel * lv;
  s.protected = vault ? V.vaultPerLevel * vault : BALANCE.loss.baseProtected;
}

// ── housing / villagers ──────────────────────────────────────────────────────
function houses(w: World): BuildingX[] { return (w.s.buildings as BuildingX[]).filter((b) => b.id === 'house' && !b.dead && b.constructing <= 0); }
export function housing(w: World): number { let n = 0; for (const h of houses(w)) n += BUILDINGS.house.housing![h.level - 1]; return n; }

function occupants(w: World, uid: number): number { let n = 0; for (const v of w.s.villagers as VillagerX[]) if (v.home === uid) n++; return n; }

function spawnVillager(w: World, home: BuildingX): VillagerX {
  const uid = newUid(w);
  const x = home.x + 1, y = home.y + home.h + 0.4;
  const v: VillagerX = {
    uid, x, y, px: x, py: y, facing: 1, hp: 1, maxHp: 1, anim: 'idle', animT: 0, status: { burn: 0, slow: 0, stun: 0, veiled: false, frozen: 0 },
    variant: (uid % 4) as 0 | 1 | 2 | 3, home: home.uid, job: 0, hungry: w.r.hungry, path: [], goal: -1, wanderT: 0, inside: false, evacuated: false,
  };
  w.s.villagers.push(v);
  emit(w, { t: 'villager', uid, action: 'arrive' });
  return v;
}

/** New villagers move into houses with room (day/dawn only); homeless villagers move into free beds. */
export function fillHouses(w: World): void {
  const s = w.s;
  if (s.phase === 'night') return;
  const hs = houses(w);
  // re-home villagers whose house is gone (sold) or ruined → evacuated
  for (const v of s.villagers as VillagerX[]) {
    const h = w.bmap.get(v.home);
    if (!h || (h.dead && !h.ruined) || h.id !== 'house') {
      const free = hs.find((o) => occupants(w, o.uid) < BUILDINGS.house.housing![o.level - 1]);
      if (free) { v.home = free.uid; v.evacuated = false; } else { v.home = 0; v.evacuated = true; }
    } else v.evacuated = h.ruined;
  }
  for (const h of hs) {
    const cap = BUILDINGS.house.housing![h.level - 1];
    let n = occupants(w, h.uid);
    while (n < cap && s.villagers.length < BALANCE.caps.villagers) { spawnVillager(w, h); n++; }
  }
}

// ── jobs ─────────────────────────────────────────────────────────────────────
function slotsOf(b: BuildingX): number { const d = BUILDINGS[b.id]; return d.slots ? d.slots[Math.min(2, b.level - 1)] : 0; }

export function workplaces(w: World): BuildingX[] {
  return (w.s.buildings as BuildingX[]).filter((b) => !b.dead && PROD_IDS.includes(b.id) && b.constructing <= 0).sort((a, b) => a.uid - b.uid);
}

function quarryNearOre(w: World, b: BuildingX): boolean {
  for (const nd of w.s.nodes) if (nd.kind === 'ore' && distToRect(nd.x + 0.5, nd.y + 0.5, b) <= 4) return true;
  return false;
}

/** Pick each quarry's output: iron (Hearth tier ≥ 4, next to ore) when iron is scarcer than stone. */
export function updateQuarryModes(w: World): void {
  const s = w.s;
  for (const b of s.buildings as BuildingX[]) {
    if (b.id !== 'quarry' || b.dead) continue;
    b.mode = s.hearthTier >= 4 && quarryNearOre(w, b) && s.res.iron * 3 < s.res.stone ? 1 : 0;
  }
}

/** Auto-assign (§11.3): food first (enough to feed everyone), then wood → stone → iron, then study/market/forge. */
export function autoAssign(w: World): void {
  const s = w.s;
  const avail = (s.villagers as VillagerX[]).filter((v) => !v.evacuated).length;
  const places = workplaces(w);
  for (const b of places) b.workers = 0;
  let left = avail;
  const fill = (b: BuildingX, n: number) => { const k = Math.max(0, Math.min(n, slotsOf(b) - b.workers, left)); b.workers += k; left -= k; };
  const farms = places.filter((b) => b.id === 'farm');
  const perFarmer = BALANCE.village.perWorkerPerMin.food * (BALANCE.peace.seconds / 60);
  let needFarmers = Math.ceil((s.villagers.length * BALANCE.village.foodPerVillager - Math.max(0, s.res.food - s.villagers.length) * 0.25) / perFarmer);
  for (const f of farms) { if (needFarmers <= 0) break; const before = f.workers; fill(f, needFarmers); needFarmers -= f.workers - before; }
  const order: BuildingId[] = ['lumber_camp', 'quarry', 'study', 'market', 'forge', 'farm'];
  // round-robin across wood/stone so both flow
  const camps = places.filter((b) => b.id === 'lumber_camp'), quarries = places.filter((b) => b.id === 'quarry');
  for (let round = 0; left > 0 && round < 4; round++) {
    let any = false;
    for (const b of [...camps, ...quarries]) { if (left <= 0) break; if (b.workers < slotsOf(b) && b.workers <= round) { fill(b, 1); any = true; } }
    if (!any) break;
  }
  for (const id of order) for (const b of places) if (b.id === id) fill(b, slotsOf(b));
}

export function assignWorkers(w: World, uid: number, count: number): boolean {
  const b = w.bmap.get(uid);
  if (!b || b.dead || !PROD_IDS.includes(b.id)) return false;
  w.s.autoAssign = false;
  const avail = (w.s.villagers as VillagerX[]).filter((v) => !v.evacuated).length;
  const others = workplaces(w).filter((o) => o.uid !== uid).reduce((a, o) => a + o.workers, 0);
  b.workers = Math.max(0, Math.min(Math.floor(count), slotsOf(b), avail - others));
  syncJobs(w);
  return true;
}

/** Map building worker counts onto villagers (stable: keep current jobs when still valid). */
export function syncJobs(w: World): void {
  const s = w.s;
  const places = workplaces(w);
  if (s.autoAssign) autoAssign(w);
  else {
    // clamp manual counts to who is available
    let avail = (s.villagers as VillagerX[]).filter((v) => !v.evacuated).length;
    for (const b of places) { b.workers = Math.min(b.workers, slotsOf(b), avail); avail -= b.workers; }
  }
  for (const b of s.buildings as BuildingX[]) { b.workerSlots = slotsOf(b); if (b.dead || !PROD_IDS.includes(b.id)) b.workers = 0; }
  const want = new Map<number, number>();
  for (const b of places) want.set(b.uid, b.workers);
  const vs = s.villagers as VillagerX[];
  for (const v of vs) {
    if (v.evacuated) { v.job = 0; continue; }
    const k = want.get(v.job);
    if (k && k > 0) want.set(v.job, k - 1); else v.job = 0;
  }
  for (const v of vs) {
    if (v.evacuated || v.job) continue;
    for (const [uid, k] of want) if (k > 0) { v.job = uid; want.set(uid, k - 1); emit(w, { t: 'villager', uid: v.uid, action: 'work' }); break; }
  }
}

// ── production ───────────────────────────────────────────────────────────────
export function productionMul(w: World): number {
  const s = w.s, V = BALANCE.village;
  let m = 1 + BALANCE.daily.warmthProd * s.warmth;
  if (w.r.hungry) m *= V.hungryMul;
  else if (w.r.wellFed >= V.wellFedAfter) m *= V.wellFedMul;
  if (w.r.panicDay) m *= V.panicMul;
  m *= 1 + BOON_FX.harvest * boonStacks(w, 'harvest');
  if (researchDone(w, 2, 2)) m *= 1 + RESEARCH.villageProd;
  return m;
}

/** Per-minute production of the whole village (used by the sim and offline settle). */
export function productionPerMin(w: World): Partial<Record<ResKey, number>> {
  const out: Partial<Record<ResKey, number>> = {};
  const P = BALANCE.village.perWorkerPerMin;
  const m = productionMul(w);
  for (const b of w.s.buildings as BuildingX[]) {
    if (b.dead || !b.powered || b.workers <= 0 || b.constructing > 0) continue;
    let res: ResKey | null = null, rate = 0;
    if (b.id === 'farm') { res = 'food'; rate = P.food; }
    else if (b.id === 'lumber_camp') { res = 'wood'; rate = P.wood; }
    else if (b.id === 'quarry') { if (b.mode === 1) { res = 'iron'; rate = P.iron; } else { res = 'stone'; rate = P.stone; } }
    if (!res) continue;
    out[res] = (out[res] ?? 0) + b.workers * rate * m;
  }
  return out;
}

export function updateProduction(w: World, dt: number): void {
  const s = w.s;
  let rate = 0;
  if (s.phase === 'peace') rate = 1;
  else if (s.phase === 'night' && researchDone(w, 2, 3)) rate = RESEARCH.nightShift;
  if (!rate) return;
  const P = BALANCE.village.perWorkerPerMin;
  const m = productionMul(w) * rate;
  for (const b of s.buildings as BuildingX[]) {
    if (b.dead || !b.powered || b.workers <= 0 || b.constructing > 0) continue;
    let res: ResKey | null = null, r = 0;
    if (b.id === 'farm') { res = 'food'; r = P.food; }
    else if (b.id === 'lumber_camp') { res = 'wood'; r = P.wood; }
    else if (b.id === 'quarry') { if (b.mode === 1) { res = 'iron'; r = P.iron; } else { res = 'stone'; r = P.stone; } }
    if (!res) continue;
    b.produceAcc += (b.workers * r * m * dt) / 60;
    if (b.produceAcc >= 1) {
      const n = Math.floor(b.produceAcc);
      b.produceAcc -= n;
      const got = gainRes(w, res, n);
      if (got > 0) emit(w, { t: 'harvest', node: b.uid, res, amount: got, x: b.x + 1, y: b.y + 1 });
      if (res === 'food') bountyProgress(w, 'food', got);
    }
  }
}

/** DAWN: villagers eat; hungry / well-fed; study lore; panic carries into tomorrow. */
export function villageDawn(w: World): void {
  const s = w.s, V = BALANCE.village;
  const need = s.villagers.length * V.foodPerVillager;
  if (need > 0) {
    if (s.res.food >= need) {
      s.res.food -= need; w.r.hungry = false; w.r.wellFed++;
    } else {
      s.res.food = 0; w.r.hungry = true; w.r.wellFed = 0;
      for (const v of s.villagers) emit(w, { t: 'villager', uid: v.uid, action: 'hungry' });
    }
  }
  for (const v of s.villagers) v.hungry = w.r.hungry;
  w.r.panicDay = w.r.panic; w.r.panic = false;
  w.r.studyNights++;
  if (w.r.studyNights % V.studyLoreEveryNights === 0) {
    for (const b of s.buildings as BuildingX[]) if (b.id === 'study' && !b.dead && b.powered && b.workers > 0) gainRes(w, 'lore', b.workers);
  }
  if (researchDone(w, 2, 5)) {
    // cart: +5% of storage of the scarcest basic resource
    const keys: ResKey[] = ['wood', 'stone', 'iron', 'food'];
    let lo = keys[0]; for (const k of keys) if (s.res[k] < s.res[lo]) lo = k;
    gainRes(w, lo, Math.round(s.storageCap * RESEARCH.cartFrac));
  }
}

// ── villager units ───────────────────────────────────────────────────────────
function bfsPath(w: World, sx: number, sy: number, goal: (x: number, y: number) => boolean, max = 5000): number[] | null {
  const n = w.size, start = sy * n + sx;
  const prev = new Map<number, number>();
  prev.set(start, -1);
  const q = [start];
  for (let h = 0; h < q.length && h < max; h++) {
    const c = q[h], x = c % n, y = (c / n) | 0;
    if (goal(x, y)) { const path: number[] = []; for (let k = c; k !== start; k = prev.get(k)!) path.push(k); return path.reverse(); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = ny * n + nx;
      if (prev.has(j) || cellBlocks(w, nx, ny, true)) continue;
      prev.set(j, c); q.push(j);
    }
  }
  return null;
}

function adjGoal(b: { x: number; y: number; w: number; h: number }) {
  return (x: number, y: number) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h && !(x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
}

function setGoal(w: World, v: VillagerX, key: number, goal: (x: number, y: number) => boolean): void {
  if (v.goal === key && v.path.length) return;
  v.goal = key;
  const p = bfsPath(w, Math.floor(v.x), Math.floor(v.y), goal);
  v.path = p ?? [];
}

function walk(w: World, v: VillagerX, dt: number, speed: number): boolean {
  if (!v.path.length) return true;
  const n = w.size;
  const c = v.path[0];
  const cx = c % n, cy = (c / n) | 0;
  if (cellBlocks(w, cx, cy, true)) { v.path = []; v.goal = -1; return false; } // re-path next step
  const tx = cx + 0.5, ty = cy + 0.5, dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy), st = speed * dt;
  if (d <= st) { v.x = tx; v.y = ty; v.path.shift(); }
  else { v.x += (dx / d) * st; v.y += (dy / d) * st; }
  if (Math.abs(dx) > 0.05) v.facing = dx > 0 ? 1 : -1;
  return !v.path.length;
}

export function updateVillagers(w: World, dt: number): void {
  const s = w.s;
  const night = s.phase === 'night';
  const V = BALANCE.village;
  const step = w.r.stepN;
  for (let i = 0; i < s.villagers.length; i++) {
    const v = s.villagers[i] as VillagerX;
    v.px = v.x; v.py = v.y; v.animT += dt;
    if (dt <= 0) continue;
    const home = v.home ? w.bmap.get(v.home) : undefined;
    if (home && home.ruined && !v.evacuated) { v.evacuated = true; v.job = 0; v.inside = false; v.goal = -1; emit(w, { t: 'villager', uid: v.uid, action: 'flee' }); }
    if (v.evacuated || !home) {
      // shelter by the Hearth
      setGoal(w, v, -2, (x, y) => Math.abs(x + 0.5 - CENTER) <= 2.5 && Math.abs(y + 0.5 - CENTER - 2) <= 1.5);
      const arrived = walk(w, v, dt, V.speed * (night ? 1.4 : 1));
      v.anim = arrived ? 'idle' : night ? 'flee' : 'move';
      continue;
    }
    if (night) {
      if (v.inside) continue;
      setGoal(w, v, home.uid * 4 + 1, adjGoal(home));
      if (walk(w, v, dt, V.speed * 1.4)) { v.inside = true; v.anim = 'idle'; v.x = home.x + 1; v.y = home.y + 1; emit(w, { t: 'villager', uid: v.uid, action: 'home' }); }
      else v.anim = 'flee';
      continue;
    }
    if (s.phase !== 'peace') continue;
    if (v.inside) { v.inside = false; v.x = home.x + 1; v.y = home.y + home.h + 0.3; v.px = v.x; v.py = v.y; v.goal = -1; }
    const job = v.job ? w.bmap.get(v.job) : undefined;
    if (job && !job.dead) {
      setGoal(w, v, job.uid * 4 + 2, adjGoal(job));
      if (walk(w, v, dt, V.speed)) { if (v.anim !== 'work') { v.anim = 'work'; v.animT = 0; } v.facing = job.x + 1 >= v.x ? 1 : -1; }
      else v.anim = 'move';
    } else {
      // idle: wander around the house
      v.wanderT -= dt;
      if (v.wanderT <= 0 || (!v.path.length && v.anim === 'move')) {
        v.wanderT = 3 + ((v.uid * 7 + step) % 5);
        const k = (v.uid * 13 + Math.floor(step / 90)) % 8;
        const gx = home.x + [-1, 2, 0, 1, -1, 2, 3, -2][k], gy = home.y + [2, 2, -1, -1, 0, 1, 0, 1][k];
        setGoal(w, v, gx * 1000 + gy, (x, y) => x === gx && y === gy);
      }
      v.anim = walk(w, v, dt, V.speed * 0.6) ? 'idle' : 'move';
    }
  }
  // rule 5 panic: a brazier went out at night while a house is no longer lit
  if (night && step % 15 === 0 && !w.r.panic) {
    const out = (s.buildings as BuildingX[]).some((b) => b.id === 'brazier' && !b.dead && (b.snuffed || b.offT > 0));
    if (out && houses(w).some((h) => !h.powered)) w.r.panic = true;
  }
}

/** Night start: villagers leave their jobs. */
export function villageNightStart(w: World): void {
  for (const v of w.s.villagers as VillagerX[]) { v.goal = -1; v.path = []; if (!v.evacuated) emit(w, { t: 'villager', uid: v.uid, action: 'flee' }); }
}

// SPEC §8 waves: budget, composition (new type ≥ 25% on its debut night, elites from night 9 ≤ 15%),
// per-rift split [0.6,1.4] normalised (root −30%), pulses every 6–8 s inside the spawn window, last pulse holds
// the most expensive unit, omens deterministic from seed + night. Also camp/cage/root guards.
import type { EnemyId, OmenEntry, PoiState } from '../api';
import { BALANCE } from '../data/balance';
import { ENEMIES, WAVE_ENEMIES } from '../data/enemies';
import { CENTER } from './MapGen';
import { Rng, mixSeed } from './Rng';
import { spawnEnemy } from './Enemies';
import { type World, type SpawnEntry, type PoiX, type EnemyX, emit, newUid } from './World';

export function nightBudget(n: number): number {
  if (n <= 10) return BALANCE.budget(n);
  return BALANCE.budget(10) * Math.pow(BALANCE.endlessMul, n - 10);
}
export const isBossNight = (n: number) => n === 5 || n === 10;
export const bossOf = (n: number): 'mossback' | 'unlit' | null => (n === 5 ? 'mossback' : n === 10 ? 'unlit' : null);

export function riftsActive(n: number): number { return BALANCE.riftsActive(n); }

interface Pick { enemy: EnemyId; elite: boolean; count: number; cost: number }

function compose(rng: Rng, n: number, budget: number): Pick[] {
  const avail = WAVE_ENEMIES.filter((id) => ENEMIES[id].firstNight <= n);
  const picks: Pick[] = [];
  let left = budget;
  const unitCost = (id: EnemyId) => ENEMIES[id].cost * (ENEMIES[id].pack ?? 1);
  const add = (id: EnemyId, elite: boolean) => {
    const pk = ENEMIES[id].pack ?? 1;
    const c = unitCost(id) * (elite ? BALANCE.elite.costMul : 1);
    picks.push({ enemy: id, elite, count: elite ? 1 : pk, cost: c });
    left -= c;
  };
  // debut: the newly introduced type takes ≥ 25% of the budget
  const debut = avail.find((id) => ENEMIES[id].firstNight === n);
  if (debut) {
    const target = budget * 0.25;
    let spent = 0;
    do { add(debut, false); spent += unitCost(debut); } while (spent < target && left >= unitCost(debut));
  }
  // elites (night ≥ 9): up to 15% of the budget
  if (n >= BALANCE.elite.fromNight) {
    let eb = budget * BALANCE.elite.maxBudgetFrac;
    const eligible = avail.filter((id) => !ENEMIES[id].pack);
    for (let tries = 0; tries < 20; tries++) {
      const id = eligible[rng.int(0, eligible.length - 1)];
      const c = ENEMIES[id].cost * BALANCE.elite.costMul;
      if (c > eb || c > left) continue;
      add(id, true); eb -= c;
    }
  }
  const weights = avail.map((id) => ENEMIES[id].weight);
  for (let guard = 0; guard < 400 && left > 0; guard++) {
    const fit = avail.map((id, i) => (unitCost(id) <= left ? weights[i] : 0));
    if (fit.every((x) => x === 0)) break;
    add(avail[rng.weighted(fit)], false);
  }
  return picks;
}

/** Build tonight's omens + spawn plan (deterministic from seed + night + destroyed roots). */
export function planNight(w: World): void {
  const n = w.s.night;
  const rng = new Rng(mixSeed(w.s.seed, 1000 + n));
  const B = nightBudget(n) * (isBossNight(n) ? BALANCE.bossBudgetMul : 1);
  const k = riftsActive(n);
  const ws: number[] = [];
  for (let i = 0; i < k; i++) ws.push(rng.range(0.6, 1.4));
  const tot = ws.reduce((a, b) => a + b, 0);
  const W = BALANCE.night.spawnWindow(n);
  const plan: SpawnEntry[] = [];
  const omens: OmenEntry[] = [];
  for (let r = 0; r < k; r++) {
    let share = (B * ws[r]) / tot;
    if (w.r.rootCut.includes(r)) share *= 1 - BALANCE.rootBudgetCut;
    const picks = compose(rng, n, share);
    // pulses
    const times: number[] = [];
    for (let t = 2 + rng.range(0, 2); t <= W; t += rng.range(BALANCE.night.pulseMin, BALANCE.night.pulseMax)) times.push(t);
    if (!times.length) times.push(2);
    picks.sort((a, b) => a.cost - b.cost);
    const last = picks.pop();
    const P = times.length;
    const pulses: Pick[][] = times.map(() => []);
    picks.forEach((p, i) => pulses[Math.min(P - 1, Math.floor((i * P) / Math.max(1, picks.length + 1)))].push(p));
    if (last) pulses[P - 1].push(last); // last pulse always has the most expensive unit
    pulses.forEach((ps, pi) => {
      let dt = 0;
      for (const p of ps) for (let c = 0; c < p.count; c++) { plan.push({ t: times[pi] + dt, rift: r, enemy: p.enemy, elite: p.elite }); dt += 0.12; }
    });
    const agg = new Map<string, OmenEntry>();
    for (const ps of pulses) for (const p of ps) {
      const key = p.enemy;
      const o = agg.get(key) ?? { enemy: p.enemy, count: 0, rift: r, elite: 0 };
      o.count += p.count; if (p.elite) o.elite += 1;
      agg.set(key, o);
    }
    for (const id of WAVE_ENEMIES) { const o = agg.get(id); if (o) omens.push(o); }
  }
  const boss = bossOf(n);
  if (boss && !(w.s.endless && n > 10)) {
    plan.push({ t: 3, rift: 0, enemy: boss, elite: false });
    omens.unshift({ enemy: boss, count: 1, rift: 0, elite: 0 });
  }
  plan.sort((a, b) => a.t - b.t || a.rift - b.rift);
  w.r.spawn = plan; w.r.spawnIdx = 0;
  w.s.omens = omens;
  w.s.enemiesLeft = plan.length;
}

export function riftPois(w: World): PoiState[] {
  return w.s.pois.filter((p) => p.kind === 'rift').sort((a, b) => (a.data!.index as number) - (b.data!.index as number));
}

export function updateSpawner(w: World): void {
  const plan = w.r.spawn;
  const rifts = riftPois(w);
  while (w.r.spawnIdx < plan.length && plan[w.r.spawnIdx].t <= w.s.nightT) {
    const sp = plan[w.r.spawnIdx];
    const rf = rifts[sp.rift] ?? rifts[0];
    const boss = ENEMIES[sp.enemy].boss;
    if (!boss && w.s.enemies.length >= BALANCE.caps.enemies) break; // wait for room
    const jx = w.rng.range(-0.8, 0.8), jy = w.rng.range(-0.8, 0.8);
    spawnEnemy(w, sp.enemy, rf.x + 0.5 + jx, rf.y + 0.5 + jy, { elite: sp.elite, wave: true, hpMul: boss ? 1 : BALANCE.night.hpScale(w.s.night) });
    w.r.spawnIdx++;
  }
  let alive = 0;
  for (const e of w.s.enemies as EnemyX[]) if (e.wave && !e.dead) alive++;
  w.s.enemiesLeft = alive + (plan.length - w.r.spawnIdx);
}

// ── guards ───────────────────────────────────────────────────────────────────
export function spawnGuards(w: World, p: PoiX, count: number, types: EnemyId[], hpMul: number, rng: Rng): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng.range(0, 0.6);
    const r = 1.3 + rng.range(0, 0.8);
    let x = p.x + 0.5 + Math.cos(a) * r, y = p.y + 0.5 + Math.sin(a) * r;
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= w.size || cy >= w.size || w.terrain[cy * w.size + cx] !== 0) { x = p.x + 0.5; y = p.y + 1.5; }
    const e = spawnEnemy(w, types[i % types.length], x, y, { guard: p.uid, wave: false, hpMul });
    if (e) e.anim = 'idle';
  }
  p.guards = count;
}

export function initGuards(w: World): void {
  const rng = new Rng(mixSeed(w.s.seed, 77));
  for (const p of w.s.pois as PoiX[]) {
    const d = Math.hypot(p.x + 0.5 - CENTER, p.y + 0.5 - CENTER);
    if (p.kind === 'camp') {
      const n = Math.max(BALANCE.poi.campGuardsMin, Math.min(BALANCE.poi.campGuardsMax, 4 + Math.floor((d - 10) / 3.5)));
      const types: EnemyId[] = d < 14 ? ['gloomling', 'gloomling', 'skitter'] : d < 18 ? ['gloomling', 'spitter', 'skitter'] : ['gloomling', 'spitter', 'brute'];
      spawnGuards(w, p, n, types, 1 + Math.max(0, d - 10) / 30, rng);
    } else if (p.kind === 'cage') {
      spawnGuards(w, p, rng.int(2, 3), d < 15 ? ['gloomling'] : ['gloomling', 'spitter'], 1, rng);
    }
  }
}

/** Day start: rift roots regrow next to every rift active tonight, with 3–5 guards. */
export function spawnRoots(w: World): void {
  w.s.pois = w.s.pois.filter((p) => p.kind !== 'root');
  // remove leftover root guards
  for (const e of w.s.enemies as EnemyX[]) if (e.guard && !w.s.pois.some((p) => p.uid === e.guard)) e.dead = true;
  const rng = new Rng(mixSeed(w.s.seed, 5000 + w.s.night));
  const k = riftsActive(w.s.night);
  const types = WAVE_ENEMIES.filter((id) => ENEMIES[id].firstNight <= Math.max(1, w.s.night) && !(ENEMIES[id].tags & 4) && id !== 'bomber' && id !== 'snuffer');
  for (const rf of riftPois(w)) {
    const idx = rf.data!.index as number;
    rf.active = idx < k;
    if (!rf.active) continue;
    const dx = CENTER - (rf.x + 0.5), dy = CENTER - (rf.y + 0.5), d = Math.hypot(dx, dy);
    let x = Math.floor(rf.x + 0.5 + (dx / d) * 2.5), y = Math.floor(rf.y + 0.5 + (dy / d) * 2.5);
    if (w.terrain[y * w.size + x] !== 0 || w.bldAt[y * w.size + x]) { x = rf.x; y = rf.y + 1; }
    const root: PoiX = { uid: newUid(w), kind: 'root', x, y, hp: BALANCE.poi.rootHp, maxHp: BALANCE.poi.rootHp, active: true, data: { rift: idx }, guards: 0 };
    w.s.pois.push(root);
    spawnGuards(w, root, rng.int(3, 5), types.length ? types : ['gloomling'], 1 + w.s.night * 0.08, rng);
  }
  void emit;
}

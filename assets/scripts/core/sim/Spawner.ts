// SPEC v2 §8 threat: TR bands per region, budget B(TR) × beacon × moon/event, stat multiplier M(TR), active rifts
// (prefer different from last night), composition (types by TR + region, debut ≥ 25%, elites from TR 9 ≤ 15%,
// nightmare ≥ 20% elites, overflow → elites), pulses every 6–8 s over min(70, 35+2·TR) s, last pulse holds the most
// expensive unit, moon phases (gibbous extra flying pulse, blood moon ×1.5 + Gloom Champion), night events,
// rift-heart sieges (boss + 80% budget at cap). Also camp / root guards. Omens deterministic from seed + night.
import type { Beacon, EnemyId, MoonPhase, NightEvent, OmenEntry, PoiState } from '../api';
import { BALANCE } from '../data/balance';
import { ENEMIES, WAVE_ENEMIES, REGION_BOSS, TAG_FLYING } from '../data/enemies';
import { CENTER } from './MapGen';
import { Rng, mixSeed } from './Rng';
import { spawnEnemy } from './Enemies';
import { type World, type SpawnEntry, type PoiX, type EnemyX, newUid } from './World';

export const MOONS: MoonPhase[] = ['new', 'crescent', 'half', 'gibbous', 'full', 'waning', 'blood'];
export const moonOf = (cycleNight: number): MoonPhase => MOONS[((cycleNight - 1) % 7 + 7) % 7];

export function trBand(regionsOpen: number): [number, number] {
  const T = BALANCE.threat;
  if (regionsOpen > 5) return [T.deepFloor, T.deepCap];
  const b = T.regionBand[Math.max(0, regionsOpen - 1)];
  return [b[0], b[1]];
}

export function applyBand(w: World): void {
  const s = w.s;
  const [lo, hi] = trBand(s.regionsOpen);
  s.trFloor = lo; s.trCap = hi;
  s.tr = Math.max(lo, Math.min(hi, s.tr));
}

export function statMul(tr: number): number { return BALANCE.threat.statMul(tr); }

export function eligible(tr: number, regionsOpen: number): EnemyId[] {
  return WAVE_ENEMIES.filter((id) => ENEMIES[id].fromTr <= tr && ENEMIES[id].region <= regionsOpen);
}

export function riftPois(w: World): PoiX[] {
  return (w.s.pois as PoiX[]).filter((p) => p.kind === 'rift').sort((a, b) => (a.data!.index as number) - (b.data!.index as number));
}
export function openRifts(w: World): PoiX[] { return riftPois(w).filter((p) => p.region <= w.s.regionsOpen); }

interface Pick { enemy: EnemyId; elite: boolean; count: number; cost: number }

function unitCost(id: EnemyId) { return ENEMIES[id].cost * (ENEMIES[id].pack ?? 1); }

function compose(rng: Rng, avail: EnemyId[], budget: number, debut: EnemyId | null, eliteShare: number, minElite: number): Pick[] {
  const picks: Pick[] = [];
  let left = budget;
  const add = (id: EnemyId, elite: boolean) => {
    const pk = ENEMIES[id].pack ?? 1;
    const c = elite ? ENEMIES[id].cost * BALANCE.elite.costMul : unitCost(id);
    picks.push({ enemy: id, elite, count: elite ? 1 : pk, cost: c });
    left -= c;
  };
  if (debut && avail.includes(debut)) {
    const target = budget * BALANCE.threat.debutShare;
    let spent = 0;
    do { add(debut, false); spent += unitCost(debut); } while (spent < target && left >= unitCost(debut));
  }
  const share = Math.max(eliteShare, minElite);
  if (share > 0) {
    let eb = budget * share;
    const el = avail.filter((id) => !ENEMIES[id].pack);
    for (let tries = 0; tries < 40 && eb > 0; tries++) {
      const id = el[rng.int(0, el.length - 1)];
      const c = ENEMIES[id].cost * BALANCE.elite.costMul;
      if (c > left) continue;
      if (c > eb && !(minElite > 0 && eb > c * 0.5)) continue;
      add(id, true); eb -= c;
    }
  }
  const weights = avail.map((id) => ENEMIES[id].weight);
  for (let guard = 0; guard < 2000 && left > 0; guard++) {
    const fit = avail.map((id, i) => (unitCost(id) <= left ? weights[i] : 0));
    if (fit.every((x) => x === 0)) break;
    add(avail[rng.weighted(fit)], false);
  }
  return picks;
}

export interface NightPlan { moon: MoonPhase; event: NightEvent; rifts: number[] }

/** Roll tonight's moon, event and rifts at PEACE start (deterministic from seed + night). */
export function rollNight(w: World): void {
  const s = w.s;
  const rng = new Rng(mixSeed(s.seed, 2000 + s.night));
  s.moon = s.siege ? s.moon : moonOf(w.r.cycleNight + 1);
  s.nightEvent = 'none';
  const T = BALANCE.event;
  if (!s.siege && s.moon !== 'blood' && s.tr >= T.fromTr && rng.chance(T.chance)) {
    const evs: NightEvent[] = ['swarm', 'pincer', 'short', 'rain'];
    if (eligible(s.tr, s.regionsOpen).includes('snuffer')) evs.push('hunters');
    if (openRifts(w).length < 2) evs.splice(evs.indexOf('pincer'), 1);
    s.nightEvent = evs[rng.int(0, evs.length - 1)];
  }
  // rifts
  const open = openRifts(w);
  const k = s.nightEvent === 'pincer' ? Math.max(2, BALANCE.threat.riftsActive(s.tr, open.length)) : BALANCE.threat.riftsActive(s.tr, open.length);
  const order = open.map((p) => ({ i: p.data!.index as number, last: w.r.lastRifts.includes(p.data!.index as number) ? 1 : 0, r: rng.next(), p }));
  order.sort((a, b) => a.last - b.last || a.r - b.r);
  let chosen = order.slice(0, Math.min(k, order.length)).map((o) => o.i);
  if (s.nightEvent === 'pincer' && open.length >= 2) {
    // two rifts on opposite sides
    let best: [number, number] = [order[0].i, order[1].i], bd = -1;
    for (const a of open) for (const b of open) {
      if (a === b) continue;
      const aa = Math.atan2(a.y - CENTER, a.x - CENTER), ab = Math.atan2(b.y - CENTER, b.x - CENTER);
      let d = Math.abs(aa - ab); if (d > Math.PI) d = 2 * Math.PI - d;
      if (d > bd) { bd = d; best = [a.data!.index as number, b.data!.index as number]; }
    }
    chosen = [best[0], best[1], ...chosen.filter((i) => i !== best[0] && i !== best[1])].slice(0, Math.max(2, k));
  }
  w.r.activeRifts = chosen;
  for (const p of riftPois(w)) p.active = chosen.includes(p.data!.index as number);
}

export function nightBudget(w: World): number {
  const s = w.s;
  if (s.siege) return BALANCE.threat.budget(s.trCap) * BALANCE.threat.siegeBudget;
  let b = BALANCE.threat.budget(s.tr) * BALANCE.beacon[s.beacon].budget;
  if (s.moon === 'blood') b *= BALANCE.moon.bloodBudget;
  return b;
}

/** Build tonight's omens + spawn plan (deterministic from seed + night + beacon + destroyed roots). */
export function planNight(w: World): void {
  const s = w.s;
  const tr = s.siege ? s.trCap : s.tr;
  const rng = new Rng(mixSeed(s.seed, 1000 + s.night));
  const B = nightBudget(w);
  const rifts = w.r.activeRifts.length ? w.r.activeRifts : [0];
  const k = rifts.length;
  const ws: number[] = [];
  for (let i = 0; i < k; i++) ws.push(rng.range(0.6, 1.4));
  const tot = ws.reduce((a, b) => a + b, 0);
  let W = BALANCE.night.spawnWindow(tr);
  if (s.nightEvent === 'short') W *= 0.5;
  let avail = eligible(tr, s.regionsOpen);
  if (s.nightEvent === 'swarm') { const pool = avail.filter((id) => !(ENEMIES[id].tags & TAG_FLYING)); avail = [pool[rng.int(0, pool.length - 1)]]; }
  const debut = eligible(tr, s.regionsOpen).find((id) => !s.gloomBook[id]?.seen && id !== 'gloomling') ?? null;
  const eliteShare = tr >= BALANCE.threat.eliteFromTr ? BALANCE.threat.eliteMaxShare : 0;
  const minElite = s.beacon === 'nightmare' && !s.siege ? (BALANCE.beacon.nightmare.minEliteShare ?? 0) : 0;
  const plan: SpawnEntry[] = [];
  const omens: OmenEntry[] = [];
  const evMul = s.nightEvent === 'swarm' ? BALANCE.event.swarmMul : 1;
  for (let r = 0; r < k; r++) {
    const ri = rifts[r];
    let share = (B * ws[r] * evMul) / tot;
    if (w.r.rootCut.includes(ri)) share *= 1 - BALANCE.threat.rootBudgetCut;
    const picks = compose(rng, avail, share, s.nightEvent === 'swarm' ? null : debut, eliteShare, minElite);
    const times: number[] = [];
    const startT = s.nightEvent === 'pincer' ? 2 : 2 + rng.range(0, 2);
    for (let t = startT; t <= W; t += rng.range(BALANCE.night.pulseMin, BALANCE.night.pulseMax) * (s.nightEvent === 'short' ? 0.5 : 1)) times.push(t);
    if (!times.length) times.push(2);
    picks.sort((a, b) => a.cost - b.cost);
    const last = picks.pop();
    const P = times.length;
    const pulses: Pick[][] = times.map(() => []);
    picks.forEach((p, i) => pulses[Math.min(P - 1, Math.floor((i * P) / Math.max(1, picks.length + 1)))].push(p));
    if (last) pulses[P - 1].push(last);
    pulses.forEach((ps, pi) => {
      let dt = 0;
      for (const p of ps) for (let c = 0; c < p.count; c++) { plan.push({ t: times[pi] + dt, rift: ri, enemy: p.enemy, elite: p.elite }); dt += 0.12; }
    });
  }
  // moon: gibbous fog → one extra pulse of flyers (skitters if no flyer is unlocked yet)
  if (s.moon === 'gibbous' && !s.siege) {
    const fly = eligible(tr, s.regionsOpen).filter((id) => ENEMIES[id].tags & TAG_FLYING);
    const id: EnemyId = fly.length ? fly[rng.int(0, fly.length - 1)] : 'skitter';
    const n = Math.max(1, Math.round((B * 0.12) / unitCost(id)));
    const t = W * 0.5;
    for (let c = 0; c < n * (ENEMIES[id].pack ?? 1); c++) plan.push({ t: t + c * 0.15, rift: rifts[c % k], enemy: id, elite: false });
  }
  if (s.nightEvent === 'hunters') for (let c = 0; c < BALANCE.event.hunters; c++) plan.push({ t: W * 0.4 + c, rift: rifts[c % k], enemy: 'snuffer', elite: false });
  if (s.moon === 'blood' && !s.siege) {
    const skills = ['summon', 'haste', 'shield'] as const;
    plan.push({ t: Math.min(W, 20), rift: rifts[0], enemy: 'champion', elite: true, champion: skills[rng.int(0, 2)] });
  }
  if (s.siege && w.r.heartRegion) plan.push({ t: 3, rift: -1, enemy: REGION_BOSS[w.r.heartRegion - 1], elite: false });
  // overflow beyond the 250-alive cap → merge into elites (§8.2)
  const cap = BALANCE.caps.enemies;
  if (plan.length > cap * 2) {
    plan.sort((a, b) => a.enemy.localeCompare(b.enemy) || a.t - b.t);
    for (let i = 0; i + 2 < plan.length && plan.length > cap * 2; i++) {
      const a = plan[i], b = plan[i + 1], c = plan[i + 2];
      if (!a.elite && !b.elite && !c.elite && a.enemy === b.enemy && b.enemy === c.enemy && !ENEMIES[a.enemy].boss) { a.elite = true; plan.splice(i + 1, 2); }
    }
  }
  plan.sort((a, b) => a.t - b.t || a.rift - b.rift);
  // omens per rift
  const agg = new Map<string, OmenEntry>();
  for (const p of plan) {
    const key = p.enemy + '@' + p.rift;
    const o = agg.get(key) ?? { enemy: p.enemy, count: 0, rift: p.rift, elite: 0 };
    o.count++; if (p.elite) o.elite++;
    agg.set(key, o);
  }
  for (const o of agg.values()) omens.push(o);
  omens.sort((a, b) => (ENEMIES[b.enemy].boss ? 1 : 0) - (ENEMIES[a.enemy].boss ? 1 : 0) || a.rift - b.rift || WAVE_ENEMIES.indexOf(a.enemy) - WAVE_ENEMIES.indexOf(b.enemy));
  w.r.spawn = plan; w.r.spawnIdx = 0;
  s.omens = omens;
  s.enemiesLeft = plan.length;
}

export function heartPoi(w: World, region: number): PoiX | null {
  return (w.s.pois as PoiX[]).find((p) => p.kind === 'heart' && p.region === region) ?? null;
}

export function updateSpawner(w: World): void {
  const plan = w.r.spawn;
  const rifts = riftPois(w);
  const M = statMul(w.s.siege ? w.s.trCap : w.s.tr);
  while (w.r.spawnIdx < plan.length && plan[w.r.spawnIdx].t <= w.s.nightT) {
    const sp = plan[w.r.spawnIdx];
    const boss = ENEMIES[sp.enemy].boss;
    if (!boss && w.s.enemies.length >= BALANCE.caps.enemies) break; // wait for room
    let x: number, y: number;
    if (sp.rift < 0) { const h = heartPoi(w, w.r.heartRegion); x = (h?.x ?? CENTER) + 0.5; y = (h?.y ?? CENTER) + 1.5; }
    else { const rf = rifts.find((p) => p.data!.index === sp.rift) ?? rifts[0]; x = rf.x + 0.5 + w.rng.range(-0.8, 0.8); y = rf.y + 0.5 + w.rng.range(-0.8, 0.8); }
    if (sp.enemy === 'champion') {
      const e = spawnEnemy(w, 'champion', x, y, { elite: true, wave: true, hpMul: M * BALANCE.moon.championHpMul / BALANCE.elite.hpMul, dmgMul: M * BALANCE.moon.championDmgMul });
      if (e) { e.championSkill = sp.champion ?? 'summon'; e.scale = 1.75; w.s.boss = { id: 'champion', hp: e.hp, maxHp: e.maxHp, uid: e.uid }; }
    } else spawnEnemy(w, sp.enemy, x, y, { elite: sp.elite, wave: true, hpMul: boss ? 1 : M, dmgMul: M });
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
    const e = spawnEnemy(w, types[i % types.length], x, y, { guard: p.uid, wave: false, hpMul, dmgMul: hpMul });
    if (e) e.anim = 'idle';
  }
  p.guards = count;
}

const REGION_GUARDS: EnemyId[][] = [
  ['gloomling', 'gloomling', 'skitter'], ['gloomling', 'spitter', 'burrower'], ['spitter', 'brute', 'hurler'], ['brute', 'spitter', 'frostwraith'], ['brute', 'cinderling', 'spitter'],
];

/** Spawn camp guards for a camp (region strength). */
export function guardCamp(w: World, p: PoiX, rng: Rng): void {
  const d = Math.hypot(p.x + 0.5 - CENTER, p.y + 0.5 - CENTER);
  const n = Math.max(BALANCE.poi.campGuardsMin, Math.min(BALANCE.poi.campGuardsMax, 4 + Math.floor((d - 8) / 9)));
  const reg = Math.max(1, Math.min(5, p.region));
  let types = REGION_GUARDS[reg - 1];
  if (reg === 1 && d > 12) types = ['gloomling', 'spitter', 'skitter'];
  const band = BALANCE.threat.regionBand[reg - 1];
  spawnGuards(w, p, n, types, statMul(band[0]) * (1 + Math.max(0, d - 10) / 40), rng);
}

/** Guards for every camp/cage in open regions that has none (hold creation, region opening, camp regrowth). */
export function initGuards(w: World, onlyRegion = 0): void {
  const rng = new Rng(mixSeed(w.s.seed, 77 + w.s.night * 31 + onlyRegion));
  for (const p of w.s.pois as PoiX[]) {
    if (p.region > w.s.regionsOpen || (onlyRegion && p.region !== onlyRegion)) continue;
    if (p.kind === 'camp' && p.active) guardCamp(w, p, rng);
    else if (p.kind === 'cage' && p.active) {
      const d = Math.hypot(p.x + 0.5 - CENTER, p.y + 0.5 - CENTER);
      spawnGuards(w, p, rng.int(2, 3), d < 15 ? ['gloomling'] : ['gloomling', 'spitter'], 1, rng);
    }
  }
}

/** PEACE start: rift roots regrow next to every rift active tonight, with 3–5 guards. */
export function spawnRoots(w: World): void {
  w.s.pois = w.s.pois.filter((p) => p.kind !== 'root');
  for (const e of w.s.enemies as EnemyX[]) if (e.guard && !w.s.pois.some((p) => p.uid === e.guard)) e.dead = true;
  if (w.s.siege) return;
  const rng = new Rng(mixSeed(w.s.seed, 5000 + w.s.night));
  const types = eligible(Math.max(1, w.s.tr), w.s.regionsOpen).filter((id) => !(ENEMIES[id].tags & TAG_FLYING) && id !== 'bomber' && id !== 'snuffer' && id !== 'shrieker' && id !== 'burrower');
  const M = statMul(w.s.tr);
  for (const rf of riftPois(w)) {
    const idx = rf.data!.index as number;
    if (!w.r.activeRifts.includes(idx)) continue;
    const dx = CENTER - (rf.x + 0.5), dy = CENTER - (rf.y + 0.5), d = Math.hypot(dx, dy);
    let x = Math.floor(rf.x + 0.5 + (dx / d) * 2.5), y = Math.floor(rf.y + 0.5 + (dy / d) * 2.5);
    if (w.terrain[y * w.size + x] !== 0 || w.bldAt[y * w.size + x]) { x = rf.x; y = rf.y + 1; }
    const root: PoiX = { uid: newUid(w), kind: 'root', x, y, hp: BALANCE.poi.rootHp, maxHp: BALANCE.poi.rootHp, active: true, region: rf.region, cooldownNights: 0, data: { rift: idx }, guards: 0 };
    w.s.pois.push(root);
    spawnGuards(w, root, rng.int(3, 5), types.length ? types : ['gloomling'], M, rng);
  }
}

export type { PoiState, Beacon };

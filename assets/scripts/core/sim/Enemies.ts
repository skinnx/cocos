// SPEC §7.3/§7.4 enemy behaviours: flow-field pathing with breaching, hero aggro/leash, spitter range-stop,
// brute breacher field, wisp straight flight, bomber charge+explode, snuffer brazier hunting, guards, elites,
// veiled-in-dark speed, statuses/DoTs, traps, and both bosses (Mossback, The Unlit).
import type { EnemyId } from '../api';
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { BUILDINGS } from '../data/buildings';
import { ENEMIES, TAG_FLYING, BOMBER, SNUFFER, MOSSBACK, UNLIT } from '../data/enemies';
import { applyBurn, applySlow, damageAlly, damageBuilding, damageEnemy, damageHero, killEnemy } from './Combat';
import type { FlowField } from './FlowField';
import { hasLOS, moveUnit, clampMap } from './Grid';
import { lightAt } from './Light';
import { CENTER, HEARTH_X, HEARTH_Y } from './MapGen';
import { fire } from './Projectiles';
import { forEnemiesInRange } from './Query';
import { type World, type EnemyX, type HeroX, type AllyX, type BuildingX, EMODE, emit, newUid, boonStacks, distToRect, isTrap, isTower } from './World';

export interface SpawnOpts { elite?: boolean; wave?: boolean; guard?: number; hpMul?: number }

export function spawnEnemy(w: World, id: EnemyId, x: number, y: number, o: SpawnOpts = {}): EnemyX | null {
  if (w.s.enemies.length >= BALANCE.caps.enemies && !ENEMIES[id].boss) return null;
  const d = ENEMIES[id];
  const E = BALANCE.elite;
  const elite = !!o.elite;
  const hp = Math.round(d.hp * (elite ? E.hpMul : 1) * (o.hpMul ?? 1));
  const e: EnemyX = {
    uid: newUid(w), id, x, y, px: x, py: y, facing: 1, hp, maxHp: hp, anim: 'move', animT: 0,
    status: { burn: 0, slow: 0, stun: 0, veiled: false }, elite, flying: !!(d.tags & TAG_FLYING), targetUid: 0,
    spd: d.speed, dmg: d.dmg * (elite ? E.dmgMul : 1), rate: d.rate, range: d.range, radius: Math.min(0.36, d.radius * (elite ? E.scale : 1)), tags: d.tags,
    atkCd: 0.3, wave: o.wave ?? !o.guard, guard: o.guard ?? 0, hx: x, hy: y, mode: o.guard ? EMODE.idle : EMODE.path,
    burnDps: 0, slowAmt: 0, slowT: 0, frostT: 0, snuffT: 0, lastCell: -1, gold: 0, xp: 0,
    t1: 0, t2: 0, t3: 0, flags: 0, shell: 0, dead: false, scale: elite ? E.scale : 1, vx: 0, vy: 0, dotFire: 0, dotFrost: 0, stuckT: 0,
  };
  if (id === 'mossback') { e.t1 = MOSSBACK.shellEvery; }
  if (id === 'unlit') { e.t1 = UNLIT.pulseEvery * 0.5; e.t2 = UNLIT.summonEvery; }
  w.s.enemies.push(e);
  w.emap.set(e.uid, e);
  if (d.boss) {
    w.s.boss = { id: id as 'mossback' | 'unlit', hp: e.hp, maxHp: e.maxHp, uid: e.uid };
    emit(w, { t: 'bossIntro', id: id as 'mossback' | 'unlit' });
  }
  return e;
}

function fieldFor(w: World, e: EnemyX): FlowField {
  const f = ENEMIES[e.id].field;
  if (f === 'breacher') return w.fields.brk;
  if (f === 'snuff' && w.fields.snuff.valid) return w.fields.snuff;
  return w.fields.def;
}

/** Remaining path distance to the Hearth (tower targeting priority). */
export function remainingDist(w: World, e: EnemyX): number {
  if (e.flying || e.id === 'mossback') return Math.hypot(e.x - CENTER, e.y - CENTER);
  const c = Math.floor(e.y) * w.size + Math.floor(e.x);
  const d = w.fields.def.dist[c];
  return d === Infinity ? 999 + Math.hypot(e.x - CENTER, e.y - CENTER) : d;
}

const hearthRect = { x: HEARTH_X, y: HEARTH_Y, w: 2, h: 2 };

function inSanctum(w: World, x: number, y: number): boolean {
  for (const z of w.s.zones) if (z.kind === 'sanctum' && Math.hypot(z.x - x, z.y - y) <= z.r) return true;
  return false;
}

function enemyDmg(w: World, e: EnemyX): number {
  let d = e.dmg;
  if (inSanctum(w, e.x, e.y)) d *= 0.8;
  if (w.r.enraged && e.wave) d *= BALANCE.night.enrageDmgMul;
  return d;
}

type Foe = { kind: 'hero'; u: HeroX } | { kind: 'ally'; u: AllyX };

function findFoe(w: World, e: EnemyX, range: number, los: boolean): Foe | null {
  let best: Foe | null = null, bd = Infinity;
  for (const h of w.s.heroes as HeroX[]) {
    if (h.dead) continue;
    let d = Math.hypot(h.x - e.x, h.y - e.y);
    if (d > range) continue;
    if (h.id === 'knight' && d <= 2) d -= 100; // Brann's taunt
    if (d < bd && (!los || hasLOS(w, e.x, e.y, h.x, h.y))) { bd = d; best = { kind: 'hero', u: h }; }
  }
  for (const a of w.s.allies as AllyX[]) {
    if (a.dead) continue;
    const d = Math.hypot(a.x - e.x, a.y - e.y);
    if (d <= range && d < bd && (!los || hasLOS(w, e.x, e.y, a.x, a.y))) { bd = d; best = { kind: 'ally', u: a }; }
  }
  return best;
}

function foeByUid(w: World, uid: number): Foe | null {
  for (const h of w.s.heroes as HeroX[]) if (h.uid === uid) return h.dead ? null : { kind: 'hero', u: h };
  for (const a of w.s.allies as AllyX[]) if (a.uid === uid) return a.dead ? null : { kind: 'ally', u: a };
  return null;
}

function hitFoe(w: World, f: Foe, amt: number): void {
  if (f.kind === 'hero') damageHero(w, f.u, amt); else damageAlly(w, f.u, amt);
}

function separation(w: World, e: EnemyX, out: { x: number; y: number }): void {
  const arr = w.s.enemies as EnemyX[];
  w.ehash.query(e.x, e.y, 1.0, (i) => {
    const o = arr[i];
    if (!o || o === e || o.dead || o.flying !== e.flying) return;
    const dx = e.x - o.x, dy = e.y - o.y;
    const rr = e.radius + o.radius;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2);
    if (d < 1e-4) { const a = ((e.uid * 2654435761) >>> 0) / 4294967296 * Math.PI * 2; out.x += Math.cos(a) * 0.5; out.y += Math.sin(a) * 0.5; return; }
    const push = (rr - d) / rr;
    out.x += (dx / d) * push * 2.2; out.y += (dy / d) * push * 2.2;
  });
}

function speedOf(w: World, e: EnemyX): number {
  let s = e.spd;
  if (e.id === 'mossback' && e.hp < e.maxHp * MOSSBACK.enrageFrac) s = MOSSBACK.enrageSpeed;
  s *= 1 - e.slowAmt;
  if (e.status.veiled) s *= BALANCE.light.veiledSpeedMul;
  if (w.r.enraged && e.wave) s *= BALANCE.night.enrageSpeedMul;
  return s;
}

function attackReady(e: EnemyX, dt: number): boolean {
  e.atkCd -= dt;
  if (e.atkCd > 0) return false;
  e.atkCd = 1 / e.rate;
  if (e.anim !== 'attack') { e.anim = 'attack'; e.animT = 0; }
  return true;
}

function bldDamage(w: World, e: EnemyX): number {
  return enemyDmg(w, e) * ENEMIES[e.id].bldMul;
}

function hitBuilding(w: World, e: EnemyX, b: BuildingX): void {
  e.targetUid = b.uid;
  if (e.id === 'spitter') {
    fire(w, { kind: 'spit', x: e.x, y: e.y - 0.2, targetUid: b.uid, tx: b.x + b.w / 2, ty: b.y + b.h / 2, dmg: bldDamage(w, e), dtype: 'impact', src: e.uid, srcKind: 2, speed: 7 });
  } else damageBuilding(w, b, bldDamage(w, e), e);
}

/** Main per-step enemy update. */
export function updateEnemies(w: World, dt: number): void {
  const night = w.s.phase === 'night';
  const tick = w.r.stepN % 15 === 0; // DoT tick every 0.5 s
  const arr = w.s.enemies as EnemyX[];
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i];
    if (e.dead) continue;
    e.animT += dt;
    statuses(w, e, dt, night, tick);
    if (e.dead) continue;
    if (e.status.stun > 0) { e.status.stun -= dt; e.vx = 0; e.vy = 0; continue; }
    if (e.id === 'mossback') { mossback(w, e, dt); continue; }
    if (e.id === 'unlit') unlitAbilities(w, e, dt);
    if (e.dead) continue;
    if (e.flying) { wisp(w, e, dt); continue; }
    if (e.guard) { guard(w, e, dt); continue; }
    ground(w, e, dt);
  }
}

function statuses(w: World, e: EnemyX, dt: number, night: boolean, tick: boolean): void {
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowAmt = 0; }
  if (e.frostT > 0) e.frostT -= dt;
  const cell = Math.floor(e.y) * w.size + Math.floor(e.x);
  // traps
  if (!e.flying && e.id !== 'mossback') {
    const tu = w.trapAt[cell];
    if (tu) {
      const b = w.bmap.get(tu);
      if (b && b.id === 'trap_tar') {
        applySlow(e, BUILDINGS.trap_tar.slow![0], 0.25, false);
        if (b.lit) e.dotFire += BUILDINGS.trap_tar.dmg! * dt;
      } else if (b && b.id === 'trap_spikes' && e.lastCell !== cell && b.charges > 0 && b.constructing <= 0) {
        const base = b.level >= 2 ? 18 : BUILDINGS.trap_spikes.dmg!;
        const syn = b.synMask & 8 && e.slowAmt > 0 ? BALANCE.synergy.tarSpikeMul : 1;
        b.charges--;
        if (b.charges <= 0) w.r.fieldDirty = true;
        damageEnemy(w, e, base, 'pierce', { src: 'trap', synergyMul: syn });
        if (e.dead) return;
      }
    }
  }
  e.lastCell = cell;
  e.status.slow = e.slowAmt;
  e.status.veiled = night && lightAt(w, e.x, e.y) === 0;
  if (e.status.burn > 0) { e.status.burn -= dt; e.dotFire += e.burnDps * dt; if (e.status.burn <= 0) { e.status.burn = 0; e.burnDps = 0; } }
  const ash = boonStacks(w, 'ash');
  if (ash && night && lightAt(w, e.x, e.y) === 2) e.dotFire += BOON_FX.ash * ash * dt;
  if (tick) {
    if (e.status.burn > 0 && boonStacks(w, 'spread')) {
      forEnemiesInRange(w, e.x, e.y, BOON_FX.spreadRange, (o) => { if (o !== e && o.status.burn <= 0) applyBurn(o, e.burnDps, 2); });
    }
    if (e.dotFire >= 0.5) { const a = e.dotFire; e.dotFire = 0; damageEnemy(w, e, a, 'fire', { src: 'burn' }); }
    if (!e.dead && e.dotFrost >= 0.5) { const a = e.dotFrost; e.dotFrost = 0; damageEnemy(w, e, a, 'frost', { src: 'aura' }); }
  }
}

function moveToward(w: World, e: EnemyX, tx: number, ty: number, dt: number, stopDist = 0): void {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  const sp = speedOf(w, e);
  const sep = { x: 0, y: 0 };
  if (e.stuckT < 0.5) separation(w, e, sep); // a snagged unit ignores the crowd until it is free
  let vx = 0, vy = 0, wx = 0, wy = 0;
  if (d > stopDist + 0.02) { vx = wx = (dx / d) * sp; vy = wy = (dy / d) * sp; if (e.anim !== 'move' && e.animT > 0.25) { e.anim = 'move'; e.animT = 0; } }
  vx += sep.x * sp * 0.6; vy += sep.y * sp * 0.6;
  e.vx = vx; e.vy = vy;
  if (Math.abs(vx) > 0.05) e.facing = vx > 0 ? 1 : -1;
  if (e.flying) { e.x += vx * dt; e.y += vy * dt; clampMap(w, e); }
  else if (!moveUnit(w, e, vx * dt, vy * dt, e.radius, false) && (wx || wy)) moveUnit(w, e, wx * dt, wy * dt, e.radius, false); // crowd jam: ignore separation
}

function chaseFoe(w: World, e: EnemyX, f: Foe, dt: number): void {
  const d = Math.hypot(f.u.x - e.x, f.u.y - e.y);
  e.targetUid = f.u.uid;
  if (d <= e.range + 0.3) {
    e.vx = 0; e.vy = 0;
    e.facing = f.u.x >= e.x ? 1 : -1;
    if (attackReady(e, dt)) {
      if (e.id === 'spitter') fire(w, { kind: 'spit', x: e.x, y: e.y - 0.2, targetUid: f.u.uid, tx: f.u.x, ty: f.u.y, dmg: enemyDmg(w, e), dtype: 'impact', src: e.uid, srcKind: 2, speed: 7 });
      else if (e.id === 'bomber') explode(w, e);
      else hitFoe(w, f, enemyDmg(w, e));
    }
  } else moveToward(w, e, f.u.x, f.u.y, dt, e.range * 0.8);
}

function ground(w: World, e: EnemyX, dt: number): void {
  const P = BALANCE.path;
  // hero aggro / leash
  if (e.mode === EMODE.chase) {
    const f = foeByUid(w, e.targetUid);
    if (!f || Math.hypot(f.u.x - e.x, f.u.y - e.y) > P.leashRange) e.mode = EMODE.path;
    else { chaseFoe(w, e, f, dt); return; }
  }
  if (e.id !== 'wisp') {
    const f = findFoe(w, e, e.id === 'spitter' ? 0 : P.aggroRange, true);
    if (f) { e.mode = EMODE.chase; chaseFoe(w, e, f, dt); return; }
  }
  // spitter: stop at range, prioritise towers then heroes
  if (e.id === 'spitter') {
    let tgt: BuildingX | null = null, bd = Infinity;
    for (const b of w.s.buildings as BuildingX[]) {
      if (!isTower(b.id) || b.dead) continue;
      const d = distToRect(e.x, e.y, b);
      if (d <= e.range && d < bd) { bd = d; tgt = b; }
    }
    if (tgt) { e.vx = 0; e.vy = 0; e.facing = tgt.x + tgt.w / 2 >= e.x ? 1 : -1; if (attackReady(e, dt)) hitBuilding(w, e, tgt); return; }
    const f = findFoe(w, e, e.range, false);
    if (f) { e.targetUid = f.u.uid; e.vx = 0; e.vy = 0; if (attackReady(e, dt)) fire(w, { kind: 'spit', x: e.x, y: e.y - 0.2, targetUid: f.u.uid, tx: f.u.x, ty: f.u.y, dmg: enemyDmg(w, e), dtype: 'impact', src: e.uid, srcKind: 2, speed: 7 }); return; }
    if (distToRect(e.x, e.y, hearthRect) <= e.range) { e.vx = 0; e.vy = 0; if (attackReady(e, dt)) hitBuilding(w, e, w.hearth); return; }
  }
  // bomber: charge the nearest building along the path
  if (e.id === 'bomber') {
    let tgt: BuildingX | null = null, bd = Infinity;
    for (const b of w.s.buildings as BuildingX[]) {
      if (isTrap(b.id) || b.dead) continue;
      const d = distToRect(e.x, e.y, b);
      if (d <= 2.5 && d < bd) { bd = d; tgt = b; }
    }
    if (tgt) {
      e.targetUid = tgt.uid;
      if (bd <= e.radius + 0.35) { explode(w, e); return; }
      moveToward(w, e, tgt.x + tgt.w / 2, tgt.y + tgt.h / 2, dt);
      return;
    }
  }
  // flow field
  const field = fieldFor(w, e);
  const n = w.size;
  const cell = Math.floor(e.y) * n + Math.floor(e.x);
  let nx = field.next[cell];
  if (nx < 0 && field.dist[cell] !== 0) {
    // off-field (e.g. pushed into a blocked cell): head to the Hearth directly
    moveToward(w, e, CENTER, CENTER, dt);
    return;
  }
  if (nx < 0) nx = cell;
  const bu = w.bldAt[nx];
  if (bu) {
    const b = w.bmap.get(bu)!;
    if (b && !b.dead) {
      const d = distToRect(e.x, e.y, b);
      if (d <= e.range + 0.05 || (e.id === 'spitter' && d <= e.range)) {
        e.vx = 0; e.vy = 0;
        e.facing = b.x + b.w / 2 >= e.x ? 1 : -1;
        if (e.id === 'snuffer' && b.id === 'brazier' && b.lit) {
          e.mode = EMODE.snuff; e.targetUid = b.uid;
          e.snuffT += dt;
          if (e.anim !== 'attack') { e.anim = 'attack'; e.animT = 0; }
          if (e.snuffT >= SNUFFER.snuffSeconds) {
            e.snuffT = 0; b.snuffed = true; b.lit = false;
            w.lightDirty = true; w.r.snuffDirty = true;
            emit(w, { t: 'brazier', uid: b.uid, lit: false });
          }
          return;
        }
        e.snuffT = 0;
        e.mode = EMODE.attackBld;
        if (e.id === 'bomber') { explode(w, e); return; }
        if (attackReady(e, dt)) hitBuilding(w, e, b);
        return;
      }
    }
  }
  e.mode = EMODE.path; e.snuffT = 0;
  let tx = (nx % n) + 0.5, ty = Math.floor(nx / n) + 0.5;
  // corner snag: if we barely moved last step, re-centre on our own cell first
  if (e.stuckT > 0.5) { tx = (cell % n) + 0.5; ty = Math.floor(cell / n) + 0.5; if (Math.hypot(e.x - tx, e.y - ty) < 0.1) e.stuckT = 0; }
  const ox = e.x, oy = e.y;
  moveToward(w, e, tx, ty, dt);
  if (Math.hypot(e.x - ox, e.y - oy) < speedOf(w, e) * dt * 0.25) e.stuckT += dt; else if (e.stuckT <= 0.5) e.stuckT = 0;
}

function explode(w: World, e: EnemyX): void {
  if (e.dead) return;
  emit(w, { t: 'explode', x: e.x, y: e.y, radius: BOMBER.radius });
  const hits: BuildingX[] = [];
  for (const b of w.s.buildings as BuildingX[]) if (!isTrap(b.id) && distToRect(e.x, e.y, b) <= BOMBER.radius) hits.push(b);
  const mul = e.elite ? BALANCE.elite.dmgMul : 1;
  for (const b of hits) damageBuilding(w, b, BOMBER.bldDmg * mul, null);
  for (const h of w.s.heroes as HeroX[]) if (!h.dead && Math.hypot(h.x - e.x, h.y - e.y) <= BOMBER.radius) damageHero(w, h, BOMBER.heroDmg * mul);
  for (const a of w.s.allies as AllyX[]) if (!a.dead && Math.hypot(a.x - e.x, a.y - e.y) <= BOMBER.radius) damageAlly(w, a, BOMBER.heroDmg * mul);
  e.dead = true; e.hp = 0;
  emit(w, { t: 'death', uid: e.uid, kind: 'enemy', id: e.id, x: e.x, y: e.y });
}

function wisp(w: World, e: EnemyX, dt: number): void {
  const d = distToRect(e.x, e.y, hearthRect);
  if (d <= e.range) {
    e.vx = 0; e.vy = 0; e.targetUid = w.hearth.uid;
    if (attackReady(e, dt)) damageBuilding(w, w.hearth, bldDamage(w, e), e);
    return;
  }
  if (e.guard) { guard(w, e, dt); return; }
  moveToward(w, e, CENTER, CENTER, dt);
}

function guard(w: World, e: EnemyX, dt: number): void {
  const home = Math.hypot(e.x - e.hx, e.y - e.hy);
  if (e.mode === EMODE.chase) {
    const f = foeByUid(w, e.targetUid);
    if (!f || home > 7 || Math.hypot(f.u.x - e.x, f.u.y - e.y) > 6) { e.mode = EMODE.ret; }
    else { chaseFoe(w, e, f, dt); return; }
  }
  const f = findFoe(w, e, Math.max(4, e.range), !e.flying);
  if (f && home < 6) { e.mode = EMODE.chase; chaseFoe(w, e, f, dt); return; }
  if (home > 0.8) { moveToward(w, e, e.hx, e.hy, dt); if (home < 1) e.mode = EMODE.idle; }
  else { e.vx = 0; e.vy = 0; e.mode = EMODE.idle; if (e.anim !== 'idle') { e.anim = 'idle'; e.animT = 0; } }
}

// ── bosses ─────────────────────────────────────────────────────────────────
function mossback(w: World, e: EnemyX, dt: number): void {
  const M = MOSSBACK;
  if (e.shell > 0) {
    e.shell -= dt; e.vx = 0; e.vy = 0;
    if (e.shell <= 0) { e.shell = 0; e.t1 = M.shellEvery; e.anim = 'move'; }
    return;
  }
  e.t1 -= dt;
  if (e.t1 <= 0) {
    e.shell = M.shellSecs; e.anim = 'attack'; e.animT = 0;
    for (let k = 0; k < M.shellSpawn; k++) {
      const a = (k / M.shellSpawn) * Math.PI * 2;
      const g = spawnEnemy(w, 'gloomling', e.x + Math.cos(a) * 1.4, e.y + Math.sin(a) * 1.4, { wave: true });
      if (g && !posOk(w, g)) { g.x = e.x; g.y = e.y; }
    }
    emit(w, { t: 'skill', hero: e.uid, skill: 'shell', x: e.x, y: e.y });
    return;
  }
  // crush buildings overlapping the body; blocked while something stands in the way
  const dx = CENTER - e.x, dy = CENTER - e.y, d = Math.hypot(dx, dy);
  const sp = speedOf(w, e);
  const nx = d > 0.01 ? e.x + (dx / d) * sp * dt : e.x, ny = d > 0.01 ? e.y + (dy / d) * sp * dt : e.y;
  const touching: BuildingX[] = [];
  for (const b of w.s.buildings as BuildingX[]) if (!isTrap(b.id) && !b.dead && distToRect(nx, ny, b) < ENEMIES.mossback.radius) touching.push(b);
  if (distToRect(nx, ny, hearthRect) < ENEMIES.mossback.radius && !touching.includes(w.hearth)) touching.push(w.hearth);
  if (touching.length) {
    e.vx = 0; e.vy = 0;
    e.t3 += dt;
    if (e.anim !== 'attack') { e.anim = 'attack'; e.animT = 0; }
    if (e.t3 >= 0.5) {
      e.t3 -= 0.5;
      for (const b of touching) damageBuilding(w, b, M.crushDps * 0.5, null);
    }
    return;
  }
  e.vx = (nx - e.x) / dt; e.vy = (ny - e.y) / dt;
  e.facing = dx >= 0 ? 1 : -1;
  e.x = nx; e.y = ny; // walks straight: ignores terrain
  if (e.anim !== 'move') { e.anim = 'move'; e.animT = 0; }
}

function posOk(w: World, e: EnemyX): boolean {
  const cx = Math.floor(e.x), cy = Math.floor(e.y);
  if (cx < 0 || cy < 0 || cx >= w.size || cy >= w.size) return false;
  const i = cy * w.size + cx;
  return w.terrain[i] === 0 && !w.bldAt[i];
}

function unlitAbilities(w: World, e: EnemyX, dt: number): void {
  const U = UNLIT;
  e.t1 -= dt; e.t2 -= dt;
  if (e.t1 <= 0) { // light-snuffing pulse
    e.t1 = U.pulseEvery;
    for (const b of w.s.buildings as BuildingX[]) {
      if (b.id === 'brazier' && distToRect(e.x, e.y, b) <= U.pulseRadius) {
        b.offT = U.pulseSecs; if (b.lit) emit(w, { t: 'brazier', uid: b.uid, lit: false });
      }
    }
    w.s.buffs.unlitPulseT = U.pulseSecs; w.s.buffs.hearthLightMul = U.hearthLightMul;
    w.lightDirty = true; w.r.snuffDirty = true;
    emit(w, { t: 'pulse', x: e.x, y: e.y, radius: U.pulseRadius });
    e.anim = 'attack'; e.animT = 0;
  }
  if (e.t2 <= 0) { // summon wisps
    e.t2 = U.summonEvery;
    for (let k = 0; k < U.summonWisps; k++) {
      const a = (k / U.summonWisps) * Math.PI * 2 + 0.4;
      spawnEnemy(w, 'wisp', e.x + Math.cos(a) * 1.2, e.y + Math.sin(a) * 1.2, { wave: true });
    }
  }
  for (let k = 0; k < U.teleportAt.length; k++) {
    if (e.flags & (1 << k)) continue;
    if (e.hp > e.maxHp * U.teleportAt[k]) continue;
    e.flags |= 1 << k;
    // teleport to another rift (the farthest active one from here)
    const rifts = w.s.pois.filter((p) => p.kind === 'rift');
    let best = rifts[0], bd = -1;
    for (const r of rifts) { const d = Math.hypot(r.x + 0.5 - e.x, r.y + 0.5 - e.y); if (d > bd) { bd = d; best = r; } }
    if (best) {
      e.x = best.x + 0.5; e.y = best.y + 0.5; e.px = e.x; e.py = e.y; e.mode = EMODE.path;
      emit(w, { t: 'teleport', uid: e.uid, x: e.x, y: e.y });
    }
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * U.healFrac);
    if (w.s.boss) w.s.boss.hp = e.hp;
    spawnEnemy(w, 'brute', e.x + 1, e.y, { elite: true, wave: true });
  }
}

export function removeDeadEnemies(w: World): void {
  const arr = w.s.enemies as EnemyX[];
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i];
    if (e.dead) { w.emap.delete(e.uid); continue; }
    arr[j++] = e;
  }
  arr.length = j;
}

export { killEnemy };

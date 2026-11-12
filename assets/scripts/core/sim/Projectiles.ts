// Projectiles with flight time: homing (arrow, fireball, spark, spit, turret), straight piercing (bolt, rain arrows),
// arcing to a predicted point (mortar). Chain lightning for spark. Instant fallback when at the projectile cap.
import type { DamageType, ProjectileKind } from '../api';
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { TAG_FLYING } from '../data/enemies';
import { applyBurn, damageAlly, damageBuilding, damageEnemy, damageHero, type DmgSrc } from './Combat';
import { forEnemiesInRange } from './Query';
import { type World, type ProjectileX, type EnemyX, type HeroX, type AllyX, emit, newUid, boonStacks } from './World';

export interface Shot {
  kind: ProjectileKind; x: number; y: number;
  target?: EnemyX | null; targetUid?: number; tx?: number; ty?: number;
  dmg: number; dtype: DamageType; src: number; srcKind: 0 | 1 | 2 | 3;
  speed: number; pierce?: number; splash?: number; chain?: number; flame?: boolean; crit?: boolean;
  hitsFlying?: boolean; maxDist?: number; flightT?: number;
}

export function fire(w: World, s: Shot): void {
  const tx = s.tx ?? s.target?.x ?? s.x, ty = s.ty ?? s.target?.y ?? s.y;
  const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
  if (w.s.projectiles.length >= BALANCE.caps.projectiles) { instantHit(w, s); return; }
  const T = s.flightT ?? d / s.speed;
  const p: ProjectileX = {
    uid: newUid(w), kind: s.kind, x: s.x, y: s.y, px: s.x, py: s.y, z: 0, angle: Math.atan2(dy, dx),
    sx: s.x, sy: s.y, tx, ty, vx: (dx / d) * s.speed, vy: (dy / d) * s.speed, speed: s.speed, t: 0, T: Math.max(0.05, T),
    target: s.targetUid ?? s.target?.uid ?? 0, dmg: s.dmg, dtype: s.dtype, src: s.src, srcKind: s.srcKind,
    pierce: s.pierce ?? 1, hit: [], splash: s.splash ?? 0, chain: s.chain ?? 0, flame: !!s.flame, crit: !!s.crit,
    hitsFlying: s.hitsFlying ?? true, dead: false, maxDist: s.maxDist ?? 0,
  };
  w.s.projectiles.push(p);
  emit(w, { t: 'shoot', from: s.src, projectile: p.uid, kind: s.kind });
}

function srcType(p: { srcKind: number }): DmgSrc { return p.srcKind === 0 ? 'tower' : p.srcKind === 1 ? 'hero' : 'ally'; }
function heroOf(w: World, p: { srcKind: number; src: number }): HeroX | null {
  if (p.srcKind !== 1) return null;
  for (const h of w.s.heroes as HeroX[]) if (h.uid === p.src) return h;
  return null;
}

function instantHit(w: World, s: Shot): void {
  const fake = {
    uid: 0, kind: s.kind, x: s.tx ?? s.target?.x ?? s.x, y: s.ty ?? s.target?.y ?? s.y, target: s.targetUid ?? s.target?.uid ?? 0,
    dmg: s.dmg, dtype: s.dtype, src: s.src, srcKind: s.srcKind, splash: s.splash ?? 0, chain: s.chain ?? 0, flame: !!s.flame, crit: !!s.crit,
    hitsFlying: s.hitsFlying ?? true, hit: [] as number[],
  };
  if (s.kind === 'bolt') { // resolve as a straight line instantly
    const p = fake as unknown as ProjectileX;
    const ang = Math.atan2((s.ty ?? s.y) - s.y, (s.tx ?? s.x) - s.x);
    const len = s.maxDist ?? 8;
    let left = s.pierce ?? 1;
    for (let k = 0.5; k <= len && left > 0; k += 0.5) {
      const x = s.x + Math.cos(ang) * k, y = s.y + Math.sin(ang) * k;
      forEnemiesInRange(w, x, y, 0.45, (e) => {
        if (left <= 0 || p.hit.includes(e.uid) || (e.tags & TAG_FLYING)) return;
        p.hit.push(e.uid); left--; hitEnemy(w, p, e);
      });
    }
    return;
  }
  resolveArrival(w, fake as unknown as ProjectileX);
}

function enemyByUid(w: World, uid: number): EnemyX | null { const e = w.emap.get(uid); return e && !e.dead ? e : null; }

function hitEnemy(w: World, p: ProjectileX, e: EnemyX): void {
  const h = heroOf(w, p);
  damageEnemy(w, e, p.dmg, p.dtype, { src: srcType(p), hero: h, crit: p.crit });
  if (p.flame && !e.dead) {
    applyBurn(e, BALANCE.synergy.flameDps, BALANCE.synergy.flameSecs);
    igniteTarAt(w, e.x, e.y, 0.5);
  }
}

/** Ignite tar traps within r of (x,y). */
export function igniteTarAt(w: World, x: number, y: number, r: number): void {
  const n = w.size;
  const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(n - 1, Math.floor(x + r));
  const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(n - 1, Math.floor(y + r));
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const u = w.trapAt[cy * n + cx]; if (!u) continue;
    const b = w.bmap.get(u);
    if (b && b.id === 'trap_tar' && !b.lit) { b.lit = true; b.burnT = 4; emit(w, { t: 'brazier', uid: b.uid, lit: true }); }
  }
}

function resolveArrival(w: World, p: ProjectileX): void {
  if (p.srcKind === 2) { // enemy projectile (spit) → building / hero / ally
    const b = w.bmap.get(p.target);
    if (b && !b.dead) { damageBuilding(w, b, p.dmg, null); return; }
    const h = (w.s.heroes as HeroX[]).find((o) => o.uid === p.target);
    if (h && !h.dead) { if (Math.hypot(h.x - p.x, h.y - p.y) < 1.2) damageHero(w, h, p.dmg); return; }
    const a = (w.s.allies as AllyX[]).find((o) => o.uid === p.target);
    if (a && !a.dead && Math.hypot(a.x - p.x, a.y - p.y) < 1.2) damageAlly(w, a, p.dmg);
    return;
  }
  if (p.kind === 'mortar' || (p.kind === 'fireball' && p.splash > 0)) {
    emit(w, { t: 'explode', x: p.x, y: p.y, radius: p.splash });
    const h = heroOf(w, p);
    const hitList: EnemyX[] = [];
    forEnemiesInRange(w, p.x, p.y, p.splash, (e) => { if (p.hitsFlying || !(e.tags & TAG_FLYING)) hitList.push(e); });
    for (const e of hitList) damageEnemy(w, e, p.dmg, p.dtype, { src: srcType(p), hero: h });
    if (p.dtype === 'fire') igniteTarAt(w, p.x, p.y, p.splash);
    return;
  }
  const e = enemyByUid(w, p.target);
  if (!e) return;
  hitEnemy(w, p, e);
  if (p.kind === 'fireball') igniteTarAt(w, e.x, e.y, 0.5);
  if (p.chain > 1) { // chain lightning: jump to nearest un-hit enemies within 2.5
    const hit = [e.uid];
    let cur = e;
    for (let k = 1; k < p.chain; k++) {
      let best: EnemyX | null = null, bd = Infinity;
      forEnemiesInRange(w, cur.x, cur.y, 2.5, (o) => {
        if (hit.includes(o.uid)) return;
        const d = Math.hypot(o.x - cur.x, o.y - cur.y);
        if (d < bd) { bd = d; best = o; }
      });
      if (!best) break;
      const nb: EnemyX = best;
      hit.push(nb.uid);
      emit(w, { t: 'shoot', from: cur.uid, projectile: 0, kind: 'spark' });
      damageEnemy(w, nb, p.dmg, p.dtype, { src: srcType(p), hero: heroOf(w, p) });
      cur = nb;
    }
  }
}

export function updateProjectiles(w: World, dt: number): void {
  for (const p of w.s.projectiles as ProjectileX[]) {
    if (p.dead) continue;
    p.px = p.x; p.py = p.y;
    p.t += dt;
    if (p.kind === 'mortar') {
      const k = Math.min(1, p.t / p.T);
      p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k;
      p.z = 4 * 2.5 * k * (1 - k);
      if (k >= 1) { p.dead = true; resolveArrival(w, p); }
      continue;
    }
    if (p.kind === 'bolt' || (p.kind === 'arrow' && p.maxDist > 0)) { // straight, piercing
      p.x += p.vx * dt; p.y += p.vy * dt;
      forEnemiesInRange(w, p.x, p.y, 0.45, (e) => {
        if (p.dead || p.hit.includes(e.uid)) return;
        if (!p.hitsFlying && e.tags & TAG_FLYING) return;
        p.hit.push(e.uid);
        hitEnemy(w, p, e);
        if (p.hit.length >= p.pierce) p.dead = true;
      });
      if (Math.hypot(p.x - p.sx, p.y - p.sy) >= p.maxDist) p.dead = true;
      continue;
    }
    // homing
    let tx = p.tx, ty = p.ty;
    if (p.srcKind === 2) {
      const b = w.bmap.get(p.target);
      if (b) { tx = b.x + b.w / 2; ty = b.y + b.h / 2; }
      else { const h = (w.s.heroes as HeroX[]).find((o) => o.uid === p.target) ?? (w.s.allies as AllyX[]).find((o) => o.uid === p.target); if (h) { tx = h.x; ty = h.y; } }
    } else {
      const e = enemyByUid(w, p.target);
      if (e) { tx = e.x; ty = e.y; }
    }
    p.tx = tx; p.ty = ty;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d <= step + 0.15) { p.x = tx; p.y = ty; p.dead = true; resolveArrival(w, p); continue; }
    p.x += (dx / d) * step; p.y += (dy / d) * step; p.angle = Math.atan2(dy, dx);
    if (p.t > 4) p.dead = true;
  }
  let j = 0;
  const arr = w.s.projectiles;
  for (let i = 0; i < arr.length; i++) if (!(arr[i] as ProjectileX).dead) arr[j++] = arr[i];
  arr.length = j;
}

export { boonStacks, BOON_FX };

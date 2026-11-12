// Towers (targeting = least remaining path distance, in-light only at night), hearth bolt, frost aura,
// trap timers, workshop repair, living-fortress regen, barracks militia, Tobi's turret, skill zones.
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { BUILDINGS, MILITIA } from '../data/buildings';
import { SKILLS } from '../data/heroes';
import { TAG_FLYING } from '../data/enemies';
import { applySlow, canHit, damageEnemy, destroyBuilding, healHero } from './Combat';
import { moveUnit } from './Grid';
import { hearthLightRadius, lightAt } from './Light';
import { CENTER } from './MapGen';
import { fire } from './Projectiles';
import { forEnemiesInRange, nearestEnemy } from './Query';
import { remainingDist } from './Enemies';
import { hornActive } from './Squad';
import { type World, type BuildingX, type EnemyX, type AllyX, type HeroX, emit, newUid, boonStacks, distToRect, isTower } from './World';
import { SYN } from './Economy';

export function towerRange(w: World, b: BuildingX): number {
  const d = BUILDINGS[b.id];
  let r = d.range ? d.range[b.level - 1] : 0;
  if (b.id === 'hearth' || b.id === 'workshop') return r;
  if (b.synMask & SYN.embedded) r += BALANCE.synergy.embeddedRangeBonus;
  r += BOON_FX.hawk * boonStacks(w, 'hawk');
  return r;
}

export function towerRateMul(w: World, b: BuildingX): number {
  let m = 1 + BOON_FX.reload * boonStacks(w, 'reload');
  if (b.synMask & SYN.rally) m *= BALANCE.synergy.rallyRateMul;
  if (hornActive(w)) m *= BALANCE.horn.rateMul;
  if (w.s.buffs.shrine === 'towerRate') m *= 1.25;
  return m;
}

export function towerDamage(w: World, b: BuildingX): { base: number; bonus: number } {
  const d = BUILDINGS[b.id];
  const base = (d.dmg ?? 0) * (1 + BALANCE.build.upgradeDmgMul * (b.level - 1));
  let bonus = 0;
  if (boonStacks(w, 'mirror') && Math.hypot(b.x + b.w / 2 - CENTER, b.y + b.h / 2 - CENTER) <= hearthLightRadius(w)) bonus += BOON_FX.mirror;
  return { base, bonus };
}

/** Light rule 2: at night towers only see enemies on lit/dim tiles. */
export function towerCanSee(w: World, e: EnemyX): boolean {
  if (w.s.phase !== 'night') return true;
  return lightAt(w, e.x, e.y) >= 1;
}

export function pickTarget(w: World, b: BuildingX, range: number, hitsFlying: boolean, minRange = 0): EnemyX | null {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const reach = range + (b.w - 1) * 0.5;
  let best: EnemyX | null = null, bd = Infinity;
  forEnemiesInRange(w, cx, cy, reach, (e) => {
    if (!hitsFlying && e.tags & TAG_FLYING) return;
    if (e.id === 'mossback' && e.shell > 0) return;
    if (minRange > 0 && Math.hypot(e.x - cx, e.y - cy) < minRange) return;
    if (!towerCanSee(w, e)) return;
    const d = remainingDist(w, e);
    if (d < bd || (d === bd && best && e.uid < best.uid)) { bd = d; best = e; }
  });
  return best;
}

export function updateBuildings(w: World, dt: number): void {
  const night = w.s.phase === 'night';
  const living = boonStacks(w, 'living');
  const blds = w.s.buildings as BuildingX[];
  for (let i = 0; i < blds.length; i++) {
    const b = blds[i];
    if (b.dead) continue;
    if (b.constructing > 0) { b.constructing -= dt; if (b.constructing <= 0) { b.constructing = 0; w.lightDirty = true; w.r.snuffDirty = true; } continue; }
    if (b.offT > 0) { b.offT -= dt; if (b.offT <= 0) { b.offT = 0; w.lightDirty = true; w.r.snuffDirty = true; if (!b.snuffed) emit(w, { t: 'brazier', uid: b.uid, lit: true }); } }
    if (living && night && b.id !== 'hearth' && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * BOON_FX.living * dt);
    if (b.id === 'trap_tar' && b.lit) {
      b.burnT -= dt;
      if (b.burnT <= 0) { destroyBuilding(w, b); i--; continue; }
      continue;
    }
    if (b.id === 'workshop' && night) { workshopRepair(w, b, dt); continue; }
    if (b.id === 'tower_frost') { frostAura(w, b, dt); continue; }
    if (isTower(b.id) || b.id === 'hearth') towerFire(w, b, dt);
  }
}

function towerFire(w: World, b: BuildingX, dt: number): void {
  const d = BUILDINGS[b.id];
  b.cooldown -= dt * (b.id === 'hearth' ? (hornActive(w) ? BALANCE.horn.rateMul : 1) : towerRateMul(w, b));
  if (b.cooldown > 0) return;
  const range = towerRange(w, b);
  const t = pickTarget(w, b, range, !!d.hitsFlying, d.minRange ?? 0);
  if (!t) { b.cooldown = 0; return; }
  b.cooldown = 1 / d.rate!;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2 - (b.id === 'hearth' ? 0.6 : 0.4);
  b.aimAngle = Math.atan2(t.y - cy, t.x - cx);
  const { base, bonus } = towerDamage(w, b);
  const dmg = base * (1 + bonus);
  const flame = (b.synMask & SYN.flame) !== 0;
  switch (b.id) {
    case 'hearth':
      fire(w, { kind: 'fireball', x: cx, y: cy, target: t, dmg, dtype: 'fire', src: b.uid, srcKind: 0, speed: 9 }); break;
    case 'tower_arrow':
      fire(w, { kind: 'arrow', x: cx, y: cy, target: t, dmg, dtype: 'pierce', src: b.uid, srcKind: 0, speed: 13, flame }); break;
    case 'tower_ballista': {
      const pierce = d.pierce![b.level - 1];
      fire(w, { kind: 'bolt', x: cx, y: cy, tx: t.x, ty: t.y, dmg, dtype: 'impact', src: b.uid, srcKind: 0, speed: 15, pierce, maxDist: range + 1.5, flame, hitsFlying: false }); break;
    }
    case 'tower_mortar': {
      const dist = Math.hypot(t.x - cx, t.y - cy);
      const T = 0.8 + dist / 14;
      const px = t.x + t.vx * T, py = t.y + t.vy * T; // lands at the predicted point
      fire(w, { kind: 'mortar', x: cx, y: cy, tx: px, ty: py, dmg, dtype: 'impact', src: b.uid, srcKind: 0, speed: dist / T, flightT: T, splash: d.splash![b.level - 1], hitsFlying: false }); break;
    }
    case 'tower_spark':
      fire(w, { kind: 'spark', x: cx, y: cy, target: t, dmg, dtype: 'spark', src: b.uid, srcKind: 0, speed: 24, chain: d.chain![b.level - 1] }); break;
  }
}

function frostAura(w: World, b: BuildingX, dt: number): void {
  const d = BUILDINGS.tower_frost;
  const r = towerRange(w, b);
  const slow = d.slow![b.level - 1];
  const { base, bonus } = towerDamage(w, b);
  const dps = base * (1 + bonus) * towerRateMul(w, b);
  const cx = b.x + 0.5, cy = b.y + 0.5;
  let any = false;
  forEnemiesInRange(w, cx, cy, r, (e) => {
    if (e.id === 'mossback' && e.shell > 0) return;
    applySlow(e, slow, 0.35, true);
    e.dotFrost += dps * dt;
    any = true;
  });
  b.cooldown = any ? 1 : 0;
}

function workshopRepair(w: World, b: BuildingX, dt: number): void {
  const hps = BUILDINGS.workshop.repairHps![b.level - 1];
  const r = BUILDINGS.workshop.range![0];
  const cx = b.x + 1, cy = b.y + 1;
  let best: BuildingX | null = null;
  for (const o of w.s.buildings as BuildingX[]) {
    if (o.dead || o.id === 'hearth' || o.hp >= o.maxHp || o.id === 'trap_spikes' || o.id === 'trap_tar') continue;
    if (distToRect(cx, cy, o) > r) continue;
    if (!best || o.hp / o.maxHp < best.hp / best.maxHp) best = o;
  }
  if (best) {
    best.hp = Math.min(best.maxHp, best.hp + hps * dt);
    if (Math.abs(best.hp - best.pathHp) >= 0.2 * best.maxHp) w.r.fieldDirty = true;
  }
}

// ── allies ───────────────────────────────────────────────────────────────────
export function spawnMilitia(w: World): void {
  for (const b of w.s.buildings as BuildingX[]) {
    if (b.id !== 'barracks' || b.dead) continue;
    const n = BUILDINGS.barracks.militia![b.level - 1];
    for (let k = 0; k < n; k++) {
      const x = b.x + 1 + (k % 2 ? 1.2 : -1.2), y = b.y + 2.4 + Math.floor(k / 2) * 0.6;
      const a: AllyX = {
        uid: newUid(w), id: 'militia', x, y, px: x, py: y, facing: 1, hp: MILITIA.hp, maxHp: MILITIA.hp, anim: 'idle', animT: 0,
        status: { burn: 0, slow: 0, stun: 0, veiled: false }, owner: b.uid, ttl: -1, atkCd: 0, hx: b.x + 1, hy: b.y + 2.3,
        dmg: MILITIA.dmg, rate: MILITIA.rate, range: MILITIA.range, dead: false,
      };
      w.s.allies.push(a);
    }
  }
}

export function updateAllies(w: World, dt: number): void {
  const rateMul = hornActive(w) ? BALANCE.horn.rateMul : 1;
  for (const a of w.s.allies as AllyX[]) {
    if (a.dead) continue;
    a.animT += dt;
    if (a.ttl >= 0) { a.ttl -= dt; if (a.ttl <= 0) { a.dead = true; continue; } }
    a.atkCd -= dt * rateMul;
    if (a.id === 'turret') {
      if (a.atkCd > 0) continue;
      const e = nearestEnemy(w, a.x, a.y, a.range);
      if (!e) { a.atkCd = 0; continue; }
      a.atkCd = 1 / a.rate; a.facing = e.x >= a.x ? 1 : -1; a.anim = 'attack'; a.animT = 0;
      fire(w, { kind: 'turret', x: a.x, y: a.y - 0.3, target: e, dmg: a.dmg, dtype: 'pierce', src: a.uid, srcKind: 3, speed: 14 });
      continue;
    }
    // militia: guard within 5 tiles of the barracks
    const e = nearestEnemy(w, a.hx, a.hy, MILITIA.guard, (o) => canHit('impact', o.tags));
    if (e) {
      const d = Math.hypot(e.x - a.x, e.y - a.y);
      a.facing = e.x >= a.x ? 1 : -1;
      if (d <= a.range + e.radius) {
        if (a.atkCd <= 0) { a.atkCd = 1 / a.rate; a.anim = 'attack'; a.animT = 0; damageEnemy(w, e, a.dmg, 'impact', { src: 'ally' }); }
      } else { moveUnit(w, a, ((e.x - a.x) / d) * MILITIA.speed * dt, ((e.y - a.y) / d) * MILITIA.speed * dt, 0.3, true); a.anim = 'move'; }
    } else {
      const d = Math.hypot(a.hx - a.x, a.hy - a.y);
      if (d > 0.3) { moveUnit(w, a, ((a.hx - a.x) / d) * MILITIA.speed * dt, ((a.hy - a.y) / d) * MILITIA.speed * dt, 0.3, true); a.anim = 'move'; }
      else a.anim = 'idle';
    }
    if (a.atkCd < 0) a.atkCd = 0;
  }
  const arr = w.s.allies;
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (!(arr[i] as AllyX).dead) arr[j++] = arr[i];
  arr.length = j;
}

// ── zones (fire wall, sanctum) ───────────────────────────────────────────────
function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L)) : 0;
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

export function updateZones(w: World, dt: number): void {
  const S = SKILLS;
  for (const z of w.s.zones) {
    z.t -= dt;
    if (z.kind === 'firewall') {
      const mx = (z.x + z.x2) / 2, my = (z.y + z.y2) / 2;
      forEnemiesInRange(w, mx, my, S.fireWall.length / 2 + z.r, (e) => {
        if (segDist(e.x, e.y, z.x, z.y, z.x2, z.y2) <= z.r + e.radius) e.dotFire += S.fireWall.dps * dt;
      });
    } else {
      for (const h of w.s.heroes as HeroX[]) if (!h.dead && Math.hypot(h.x - z.x, h.y - z.y) <= z.r) healHero(w, h, S.sanctum.hps * dt, false);
    }
  }
  w.s.zones = w.s.zones.filter((z) => z.t > 0);
}

export { damageEnemy };

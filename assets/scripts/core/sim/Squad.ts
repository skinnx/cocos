// SPEC §7.1 squad: leader joystick movement, V-formation followers (steering to slots, obstacle collision),
// auto-attack, auto-cast skills, passives, XP/levels (Combat.ts), revive, harvesting, brazier relighting.
import type { HeroId } from '../api';
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { HEROES, SKILLS } from '../data/heroes';
import { TURRET } from '../data/buildings';
import { TAG_FLYING } from '../data/enemies';
import { applyStun, canHit, damageEnemy, heroDmgBonus, heroLevelMul, heroMaxHp, healHero, passLeadership } from './Combat';
import { moveUnit } from './Grid';
import { brazierBurning, lightAt } from './Light';
import { CENTER, isTreeKind } from './MapGen';
import { fire, igniteTarAt } from './Projectiles';
import { anyEnemyNear, forEnemiesInRange, nearestEnemy } from './Query';
import { rebuildTerrain } from './Grid';
import { attackablePoi, damagePoi } from './Pois';
import { type World, type HeroX, type EnemyX, type AllyX, type BuildingX, emit, newUid, boonStacks, leader, distToRect } from './World';

export const HERO_RADIUS = 0.3;

export function createHero(w: World, id: HeroId, x: number, y: number, level = 1): HeroX {
  const h: HeroX = {
    uid: newUid(w), id, x, y, px: x, py: y, facing: 1, hp: 1, maxHp: 1, anim: 'idle', animT: 0,
    status: { burn: 0, slow: 0, stun: 0, veiled: false },
    level: 1, xp: 0, skillCd: 0, skillCdMax: 0, leader: false, reviveT: 0,
    atkCd: 0, nextHitMul: 1, harvestCd: 0, relightT: 0, combatT: 99, twinT: -1, dead: false, tgt: 0, stuckT: 0,
  };
  h.level = Math.min(5, Math.max(1, level));
  if (h.level > 1) h.xp = BALANCE.squad.xp[h.level - 2];
  h.maxHp = heroMaxHp(w, h); h.hp = h.maxHp;
  h.skillCdMax = skillCdMax(w, id); h.skillCd = h.skillCdMax * 0.5;
  return h;
}

export function skillCdMax(w: World, id: HeroId): number {
  return HEROES[id].skillCd * (boonStacks(w, 'cooldown') ? BOON_FX.cooldown : 1);
}

/** Add a hero to the squad (or reserve when full). */
export function recruitHero(w: World, id: HeroId, x: number, y: number, level = 1): void {
  if (w.s.heroes.length < w.s.squadMax) {
    const h = createHero(w, id, x, y, level);
    w.s.heroes.push(h);
    if (!leader(w)) passLeadership(w);
  } else w.s.reserve.push(id);
}

export function reviveHero(w: World, h: HeroX): void {
  h.dead = false; h.hp = h.maxHp; h.reviveT = 0; h.anim = 'idle';
  h.x = CENTER + ((h.uid % 3) - 1) * 0.8; h.y = CENTER + 2.2; h.px = h.x; h.py = h.y;
  h.status.stun = 0; h.status.burn = 0;
  if (!leader(w)) passLeadership(w);
}

export function hornActive(w: World): boolean { return w.s.hornT > 0; }

export function squadOutOfCombat(w: World): boolean {
  for (const h of w.s.heroes as HeroX[]) if (!h.dead && h.combatT < 2) return false;
  return true;
}

function moveSpeed(w: World): number {
  let s = BALANCE.squad.moveSpeed * (1 + BOON_FX.swift * boonStacks(w, 'swift'));
  if ((w.s.heroes as HeroX[]).some((h) => h.id === 'rogue' && !h.dead) && squadOutOfCombat(w)) s *= SKILLS.passive.rogueSpeedMul;
  return s;
}

export function updateHeroes(w: World, dt: number): void {
  const hs = w.s.heroes as HeroX[];
  for (const h of hs) {
    h.combatT += dt; h.animT += dt;
    if (h.dead) {
      if (w.s.phase === 'night' || w.s.phase === 'day') { h.reviveT -= dt; if (h.reviveT <= 0) reviveHero(w, h); }
      continue;
    }
    if (h.status.stun > 0) { h.status.stun -= dt; continue; }
  }
  const ld = leader(w);
  const spd = moveSpeed(w);
  let heading = w.r.heading;
  // ── leader
  if (ld) {
    const inp = w.r.input;
    const mag = Math.min(1, Math.hypot(inp.x, inp.y));
    if (mag > 0.01) {
      const dx = (inp.x / Math.hypot(inp.x, inp.y)) * mag * spd * dt, dy = (inp.y / Math.hypot(inp.x, inp.y)) * mag * spd * dt;
      const moved = moveUnit(w, ld, dx, dy, HERO_RADIUS, true);
      if (Math.abs(inp.x) > 0.05) ld.facing = inp.x > 0 ? 1 : -1;
      heading = { x: inp.x / Math.hypot(inp.x, inp.y), y: inp.y / Math.hypot(inp.x, inp.y) };
      w.r.heading = heading;
      if (moved) { setAnim(ld, 'move'); w.r.tut.moved += Math.hypot(dx, dy); }
    } else {
      engageOrIdle(w, ld, spd, dt, null);
    }
  }
  // ── followers (V formation)
  let slot = 0;
  for (const h of hs) {
    if (h.dead || h === ld || h.status.stun > 0) continue;
    slot++;
    if (!ld) { engageOrIdle(w, h, spd, dt, null); continue; }
    const row = Math.ceil(slot / 2), side = slot % 2 === 1 ? -1 : 1;
    const bx = -heading.x, by = -heading.y, px = -heading.y, py = heading.x;
    const sx = ld.x + bx * 1.1 * row + px * side * 0.95 * row;
    const sy = ld.y + by * 1.1 * row + py * side * 0.95 * row;
    const dl = Math.hypot(h.x - ld.x, h.y - ld.y);
    if (dl > BALANCE.squad.teleportDist) { h.x = ld.x; h.y = ld.y; h.px = h.x; h.py = h.y; continue; }
    if (engageOrIdle(w, h, spd, dt, { sx, sy, ld })) continue;
    const ox = h.x, oy = h.y;
    steerTo(w, h, sx, sy, spd * BALANCE.squad.followCatchup, dt, hs);
    // regroup: a follower snagged behind walls/trees for 1.5 s rejoins the leader
    if (Math.hypot(h.x - ox, h.y - oy) < spd * dt * 0.2 && Math.hypot(sx - h.x, sy - h.y) > 1.5) h.stuckT += dt; else h.stuckT = 0;
    if (h.stuckT > 1.5) { h.stuckT = 0; h.x = ld.x; h.y = ld.y; h.px = h.x; h.py = h.y; emit(w, { t: 'teleport', uid: h.uid, x: h.x, y: h.y }); }
  }
  // ── attacks, skills, passives
  const rateMul = hornActive(w) ? BALANCE.horn.rateMul : 1;
  for (const h of hs) {
    if (h.dead || h.status.stun > 0) continue;
    attack(w, h, dt * rateMul);
    skills(w, h, dt);
    passives(w, h, dt);
    harvest(w, h, dt);
    if (h.anim === 'attack' && h.animT > 0.3) setAnim(h, 'idle');
  }
  relightBraziers(w, dt);
}

function setAnim(h: HeroX, a: HeroX['anim']): void { if (h.anim !== a) { h.anim = a; h.animT = 0; } }

function steerTo(w: World, h: HeroX, tx: number, ty: number, maxSpd: number, dt: number, hs: HeroX[]): void {
  let dx = tx - h.x, dy = ty - h.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.15) { if (h.anim === 'move') setAnim(h, 'idle'); return; }
  const sp = Math.min(maxSpd, d * 4); // arrive
  dx = (dx / d) * sp; dy = (dy / d) * sp;
  // separation
  for (const o of hs) {
    if (o === h || o.dead) continue;
    const ox = h.x - o.x, oy = h.y - o.y, od = Math.hypot(ox, oy);
    if (od > 0 && od < 0.7) { dx += (ox / od) * (0.7 - od) * 4; dy += (oy / od) * (0.7 - od) * 4; }
  }
  const moved = moveUnit(w, h, dx * dt, dy * dt, HERO_RADIUS, true);
  if (Math.abs(dx) > 0.05) h.facing = dx > 0 ? 1 : -1;
  if (moved) setAnim(h, 'move');
}

/** Melee heroes approach nearby enemies when idle / following. Returns true if engaged (handled movement). */
function engageOrIdle(w: World, h: HeroX, spd: number, dt: number, f: { sx: number; sy: number; ld: HeroX } | null): boolean {
  const def = HEROES[h.id];
  const R = BALANCE.squad.engageRange;
  const e = nearestEnemy(w, h.x, h.y, R, (o) => canHit(def.dtype, o.tags) && (def.melee ? !(o.tags & TAG_FLYING) || def.dtype !== 'impact' : true));
  if (!e) { if (!f && h.anim === 'move') setAnim(h, 'idle'); return false; }
  if (f && Math.hypot(e.x - f.ld.x, e.y - f.ld.y) > 6) return false;
  const d = Math.hypot(e.x - h.x, e.y - h.y);
  const want = def.melee ? def.range + e.radius - 0.15 : def.range - 0.3;
  if (d > want) {
    const dx = ((e.x - h.x) / d) * spd * dt, dy = ((e.y - h.y) / d) * spd * dt;
    moveUnit(w, h, dx, dy, HERO_RADIUS, true);
    h.facing = e.x > h.x ? 1 : -1;
    setAnim(h, 'move');
  }
  return true;
}

function attack(w: World, h: HeroX, dt: number): void {
  h.atkCd -= dt;
  if (h.atkCd > 0) return;
  const def = HEROES[h.id];
  const reach = def.range;
  const e = nearestEnemy(w, h.x, h.y, reach, (o) => canHit(def.dtype, o.tags));
  if (!e) {
    const p = attackablePoi(w, h.x, h.y, def.melee ? def.range + 0.4 : def.range);
    if (p) {
      h.atkCd = 1 / def.rate; setAnim(h, 'attack'); h.facing = p.x + 0.5 >= h.x ? 1 : -1;
      damagePoi(w, p, def.dmg * heroLevelMul(h) * (1 + heroDmgBonus(w)));
      return;
    }
    h.atkCd = 0; return;
  }
  h.atkCd = 1 / def.rate;
  h.tgt = e.uid; h.combatT = 0;
  h.facing = e.x >= h.x ? 1 : -1;
  setAnim(h, 'attack');
  let base = def.dmg * heroLevelMul(h) * h.nextHitMul;
  h.nextHitMul = 1;
  let bonus = heroDmgBonus(w);
  if (h.id === 'ranger' && w.s.phase === 'night' && lightAt(w, e.x, e.y) === 0) bonus += SKILLS.passive.rangerDarkMul - 1;
  let crit = false;
  if (def.crit && w.rng.chance(def.crit.chance)) { base *= def.crit.mul; crit = true; }
  if (def.melee) {
    damageEnemy(w, e, base, def.dtype, { bonus, src: 'hero', hero: h, crit });
  } else {
    fire(w, { kind: def.projectile!, x: h.x, y: h.y - 0.3, target: e, dmg: base * (1 + bonus), dtype: def.dtype, src: h.uid, srcKind: 1,
      speed: def.projectile === 'spark' ? 20 : def.projectile === 'fireball' ? 9 : 13, splash: def.splash, crit });
  }
}

function skills(w: World, h: HeroX, dt: number): void {
  h.skillCdMax = skillCdMax(w, h.id);
  if (h.twinT >= 0) { h.twinT -= dt; if (h.twinT < 0) castSkill(w, h); }
  h.skillCd -= dt;
  if (h.skillCd > 0) return;
  if (castSkill(w, h)) {
    h.skillCd = h.skillCdMax;
    if (boonStacks(w, 'twin')) h.twinT = 0.5;
  } else h.skillCd = 0;
}

/** Returns true if the skill was cast (needs a valid trigger). */
export function castSkill(w: World, h: HeroX): boolean {
  const S = SKILLS;
  const dmgMul = heroLevelMul(h) * (1 + heroDmgBonus(w));
  switch (HEROES[h.id].skill) {
    case 'shieldBash': {
      const e = nearestEnemy(w, h.x, h.y, S.shieldBash.range);
      if (!e) return false;
      const ang = Math.atan2(e.y - h.y, e.x - h.x);
      forEnemiesInRange(w, h.x, h.y, S.shieldBash.range, (o) => {
        let da = Math.abs(Math.atan2(o.y - h.y, o.x - h.x) - ang); if (da > Math.PI) da = 2 * Math.PI - da;
        if (da <= S.shieldBash.cone || Math.hypot(o.x - h.x, o.y - h.y) < 0.6) {
          applyStun(o, S.shieldBash.stun);
          damageEnemy(w, o, S.shieldBash.dmg * dmgMul, 'impact', { src: 'hero', hero: h });
        }
      });
      emit(w, { t: 'skill', hero: h.uid, skill: 'shieldBash', x: e.x, y: e.y });
      return true;
    }
    case 'arrowRain': {
      const e = nearestEnemy(w, h.x, h.y, S.arrowRain.range);
      if (!e) return false;
      const ang = Math.atan2(e.y - h.y, e.x - h.x);
      for (let k = 0; k < S.arrowRain.arrows; k++) {
        const a = ang + (k - (S.arrowRain.arrows - 1) / 2) * (S.arrowRain.spread / 2);
        fire(w, { kind: 'arrow', x: h.x, y: h.y - 0.3, tx: h.x + Math.cos(a) * 7, ty: h.y + Math.sin(a) * 7, dmg: HEROES.ranger.dmg * S.arrowRain.dmgMul * dmgMul,
          dtype: 'pierce', src: h.uid, srcKind: 1, speed: 13, pierce: 2, maxDist: 7 });
      }
      emit(w, { t: 'skill', hero: h.uid, skill: 'arrowRain', x: e.x, y: e.y });
      return true;
    }
    case 'fireWall': {
      const e = nearestEnemy(w, h.x, h.y, 5);
      if (!e) return false;
      const ang = Math.atan2(e.y - h.y, e.x - h.x) + Math.PI / 2;
      const L = S.fireWall.length / 2;
      const x1 = e.x - Math.cos(ang) * L, y1 = e.y - Math.sin(ang) * L, x2 = e.x + Math.cos(ang) * L, y2 = e.y + Math.sin(ang) * L;
      w.s.zones.push({ uid: newUid(w), kind: 'firewall', x: x1, y: y1, x2, y2, r: S.fireWall.width, t: S.fireWall.secs, dur: S.fireWall.secs });
      for (let k = 0; k <= 4; k++) igniteTarAt(w, x1 + ((x2 - x1) * k) / 4, y1 + ((y2 - y1) * k) / 4, 0.5);
      emit(w, { t: 'skill', hero: h.uid, skill: 'fireWall', x: e.x, y: e.y });
      return true;
    }
    case 'miniTurret': {
      if (!nearestEnemy(w, h.x, h.y, 6)) return false;
      const a: AllyX = {
        uid: newUid(w), id: 'turret', x: h.x + 0.6, y: h.y, px: h.x + 0.6, py: h.y, facing: 1, hp: TURRET.hp, maxHp: TURRET.hp, anim: 'idle', animT: 0,
        status: { burn: 0, slow: 0, stun: 0, veiled: false }, owner: h.uid, ttl: S.miniTurret.secs, atkCd: 0, hx: h.x, hy: h.y,
        dmg: TURRET.dmg * heroLevelMul(h), rate: TURRET.rate, range: TURRET.range, dead: false,
      };
      w.s.allies.push(a);
      emit(w, { t: 'skill', hero: h.uid, skill: 'miniTurret', x: a.x, y: a.y });
      return true;
    }
    case 'sanctum': {
      const hurt = (w.s.heroes as HeroX[]).some((o) => !o.dead && o.hp < o.maxHp * 0.7 && Math.hypot(o.x - h.x, o.y - h.y) < 4);
      if (!hurt && !anyEnemyNear(w, h.x, h.y, 3)) return false;
      w.s.zones.push({ uid: newUid(w), kind: 'sanctum', x: h.x, y: h.y, x2: h.x, y2: h.y, r: S.sanctum.radius, t: S.sanctum.secs, dur: S.sanctum.secs });
      emit(w, { t: 'skill', hero: h.uid, skill: 'sanctum', x: h.x, y: h.y });
      return true;
    }
    case 'shadowStep': {
      let best: EnemyX | null = null;
      forEnemiesInRange(w, h.x, h.y, S.shadowStep.range, (o) => { if (!best || o.hp > best.hp || (o.hp === best.hp && o.uid < best.uid)) best = o; });
      if (!best) return false;
      const b: EnemyX = best;
      const ang = Math.atan2(h.y - b.y, h.x - b.x);
      const ox = h.x, oy = h.y;
      h.x = b.x + Math.cos(ang) * (b.radius + 0.4); h.y = b.y + Math.sin(ang) * (b.radius + 0.4);
      if (!moveUnit(w, h, 0, 0, HERO_RADIUS, true)) { /* position validated below */ }
      if (w.terrain[Math.floor(h.y) * w.size + Math.floor(h.x)] !== 0 || w.bldAt[Math.floor(h.y) * w.size + Math.floor(h.x)]) { h.x = ox; h.y = oy; }
      h.px = h.x; h.py = h.y;
      h.nextHitMul = S.shadowStep.nextHitMul;
      h.atkCd = 0;
      emit(w, { t: 'skill', hero: h.uid, skill: 'shadowStep', x: h.x, y: h.y });
      emit(w, { t: 'teleport', uid: h.uid, x: h.x, y: h.y });
      return true;
    }
  }
  return false;
}

function passives(w: World, h: HeroX, dt: number): void {
  const P = SKILLS.passive;
  if (h.id === 'pyro') {
    for (const b of w.s.buildings as BuildingX[]) {
      if (b.id !== 'brazier' || (!b.snuffed && b.offT <= 0)) continue;
      if (distToRect(h.x, h.y, b) <= BALANCE.light.pyroRelightRange) relight(w, b);
    }
  } else if (h.id === 'tinker') {
    let best: BuildingX | null = null;
    for (const b of w.s.buildings as BuildingX[]) {
      if (b.id === 'hearth' || b.hp >= b.maxHp || b.dead) continue;
      if (distToRect(h.x, h.y, b) > P.tinkerRepairRange) continue;
      if (!best || b.hp / b.maxHp < best.hp / best.maxHp) best = b;
    }
    if (best) { best.hp = Math.min(best.maxHp, best.hp + P.tinkerRepairHps * dt); if (Math.abs(best.hp - best.pathHp) >= 0.2 * best.maxHp) w.r.fieldDirty = true; }
  } else if (h.id === 'cleric') {
    let best: HeroX | null = null;
    for (const o of w.s.heroes as HeroX[]) {
      if (o.dead || o.hp >= o.maxHp || Math.hypot(o.x - h.x, o.y - h.y) > P.clericRange) continue;
      if (!best || o.hp / o.maxHp < best.hp / best.maxHp) best = o;
    }
    if (best) healHero(w, best, P.clericHealHps * dt, false);
  }
}

export function relight(w: World, b: BuildingX): void {
  if (!b.snuffed && b.offT <= 0) return;
  b.snuffed = false; b.offT = 0; b.relightT = 0;
  w.lightDirty = true; w.r.snuffDirty = true;
  emit(w, { t: 'brazier', uid: b.uid, lit: true });
}

/** SPEC §5 rule 4: a hero standing next to a snuffed brazier for 2 s relights it. */
function relightBraziers(w: World, dt: number): void {
  for (const b of w.s.buildings as BuildingX[]) {
    if (b.id !== 'brazier' || !b.snuffed) continue;
    let near = false;
    for (const h of w.s.heroes as HeroX[]) if (!h.dead && distToRect(h.x, h.y, b) <= BALANCE.light.relightRange) { near = true; break; }
    if (near) { b.relightT += dt; if (b.relightT >= BALANCE.light.relightSeconds) relight(w, b); }
    else b.relightT = 0;
  }
}

function harvest(w: World, h: HeroX, dt: number): void {
  h.harvestCd -= dt;
  if (h.harvestCd > 0) return;
  if (anyEnemyNear(w, h.x, h.y, Math.max(HEROES[h.id].range + 0.4, 1.5))) return; // busy fighting
  const H = BALANCE.harvest;
  let best = -1, bd = Infinity;
  const cx = Math.floor(h.x), cy = Math.floor(h.y);
  for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
    if (x < 0 || y < 0 || x >= w.size || y >= w.size) continue;
    const ni = w.nodeAt[y * w.size + x]; if (!ni) continue;
    const nd = w.s.nodes[ni - 1];
    if (nd.kind === 'stump' || nd.kind === 'bush' || nd.hp <= 0) continue;
    const d = distToRect(h.x, h.y, { x, y, w: 1, h: 1 });
    if (d <= BALANCE.squad.harvestRange && d < bd) { bd = d; best = ni - 1; }
  }
  if (best < 0) return;
  const nd = w.s.nodes[best];
  h.harvestCd = BALANCE.squad.harvestInterval;
  nd.hp -= 1; nd.shakeT = 0.3;
  let res: 'wood' | 'stone' | 'gold', amount: number;
  if (isTreeKind(nd.kind)) { res = 'wood'; amount = H.treeWood; }
  else if (nd.kind === 'ore') { res = 'gold'; amount = H.oreGold; }
  else { res = 'stone'; amount = H.rockStone; }
  w.s.res[res] += amount;
  if (res === 'gold') w.s.stats.goldEarned += amount;
  h.facing = nd.x + 0.5 >= h.x ? 1 : -1;
  setAnim(h, 'attack');
  emit(w, { t: 'harvest', node: nd.uid, res, amount, x: nd.x + 0.5, y: nd.y + 0.5 });
  if (res === 'wood') w.r.tutHarvested = true;
  if (nd.hp <= 0) {
    if (isTreeKind(nd.kind)) { (nd as { kind: string }).kind = 'stump'; nd.regrowT = BALANCE.harvest.regrowDays; nd.hp = 0; }
    else w.s.nodes.splice(best, 1);
    rebuildTerrain(w);
    w.r.fieldDirty = true;
  }
}

export { brazierBurning };

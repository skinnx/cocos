// SPEC §7.2 damage types/tags, §7.5 statuses, kill rewards, building/hero damage.
import type { DamageType } from '../api';
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { BUILDINGS } from '../data/buildings';
import { HEROES } from '../data/heroes';
import { TAG_ARMORED, TAG_FLYING, TAG_SWARM, MOSSBACK } from '../data/enemies';
import { noteBuildingHp } from './FlowField';
import { type World, type EnemyX, type HeroX, type BuildingX, type AllyX, emit, boonStacks, isWallLike, liveHeroes } from './World';

export function typeMul(dtype: DamageType, tags: number): number {
  let m = 1;
  if (dtype === 'pierce' && tags & TAG_ARMORED) m *= 0.5;
  if (dtype === 'impact' && tags & TAG_ARMORED) m *= 1.25;
  if (dtype === 'fire' && tags & TAG_SWARM) m *= 1.5;
  if (dtype === 'spark' && tags & TAG_FLYING) m *= 1.5;
  return m;
}

/** Impact (melee, mortar, ballista) cannot hit flying enemies. */
export function canHit(dtype: DamageType, tags: number): boolean {
  return !(dtype === 'impact' && tags & TAG_FLYING);
}

export function finalDamage(base: number, bonus: number, dtype: DamageType, tags: number, synergyMul = 1): number {
  return Math.max(1, Math.round(base * (1 + bonus) * typeMul(dtype, tags) * synergyMul));
}

export type DmgSrc = 'tower' | 'hero' | 'ally' | 'trap' | 'aura' | 'burn' | 'hearth';

export interface DmgOpts { bonus?: number; synergyMul?: number; src: DmgSrc; hero?: HeroX | null; crit?: boolean; noShatter?: boolean }

export function damageEnemy(w: World, e: EnemyX, base: number, dtype: DamageType, o: DmgOpts): number {
  if (e.dead || e.hp <= 0) return 0;
  if (!canHit(dtype, e.tags)) return 0;
  let syn = o.synergyMul ?? 1;
  if (e.id === 'mossback' && e.shell > 0) {
    if (o.src === 'tower' || o.src === 'hearth') return 0; // withdrawn: immune to towers
    if (o.src === 'hero') syn *= MOSSBACK.heroMulInShell;
  }
  let shatter = false;
  if (dtype === 'impact' && e.frostT > 0 && !o.noShatter) { syn *= BALANCE.synergy.shatterMul; shatter = true; }
  const amt = finalDamage(base, o.bonus ?? 0, dtype, e.tags, syn);
  e.hp -= amt;
  emit(w, { t: 'hit', target: e.uid, amount: amt, dtype, crit: !!o.crit, shatter, x: e.x, y: e.y });
  if (o.hero && !o.hero.dead) {
    const leech = boonStacks(w, 'leech');
    if (leech) healHero(w, o.hero, amt * BOON_FX.leech, false);
    o.hero.combatT = 0;
  }
  if (w.s.boss && w.s.boss.uid === e.uid) w.s.boss.hp = Math.max(0, e.hp);
  if (e.hp <= 0) killEnemy(w, e);
  return amt;
}

export function killEnemy(w: World, e: EnemyX): void {
  if (e.dead) return;
  e.dead = true; e.hp = 0;
  emit(w, { t: 'death', uid: e.uid, kind: 'enemy', id: e.id, x: e.x, y: e.y });
  if (e.id === 'bomber') emit(w, { t: 'explode', x: e.x, y: e.y, radius: 0.6 }); // shot down: visual pop only
  const G = BALANCE.gold, X = BALANCE.xp;
  const boss = e.id === 'mossback' || e.id === 'unlit';
  const gold = boss ? G.boss : Math.round((G[e.id] ?? 1) * (e.elite ? G.eliteMul : 1));
  const xp = boss ? X.boss : (X[e.id] ?? 1) * (e.elite ? X.eliteMul : 1);
  w.s.res.gold += gold; w.s.stats.goldEarned += gold; w.r.nightGold += gold;
  emit(w, { t: 'gold', amount: gold, x: e.x, y: e.y });
  w.s.stats.kills++; w.r.nightKills++;
  w.s.hornCharge = Math.min(BALANCE.horn.charge, w.s.hornCharge + 1);
  grantXp(w, xp);
  if (boss) {
    w.s.stats.bosses++;
    if (w.s.boss && w.s.boss.uid === e.uid) w.s.boss.hp = 0;
  }
}

export function grantXp(w: World, xp: number): void {
  const hs = liveHeroes(w);
  if (!hs.length) return;
  const each = xp / hs.length;
  for (const h of hs) {
    h.xp += each;
    const T = BALANCE.squad.xp;
    while (h.level < 5 && h.xp >= T[h.level - 1]) levelUp(w, h);
  }
}

export function levelUp(w: World, h: HeroX): void {
  const before = h.maxHp;
  h.level++;
  h.maxHp = heroMaxHp(w, h);
  h.hp = Math.min(h.maxHp, h.hp + (h.maxHp - before));
  emit(w, { t: 'levelUp', hero: h.uid });
}

export function heroLevelMul(h: HeroX): number { return 1 + BALANCE.squad.levelMul * (h.level - 1); }
export function heroMaxHp(w: World, h: HeroX): number {
  return Math.round(HEROES[h.id].hp * heroLevelMul(h) * (1 + BOON_FX.thick * boonStacks(w, 'thick')));
}
/** Σbonus for hero damage (boons + shrine). */
export function heroDmgBonus(w: World): number {
  return BOON_FX.sharp * boonStacks(w, 'sharp') + (w.s.buffs.shrine === 'damage' ? 0.2 : 0);
}

export function healHero(w: World, h: HeroX, amt: number, evt = true): void {
  if (h.dead || h.hp >= h.maxHp) return;
  const a = Math.min(amt, h.maxHp - h.hp);
  h.hp += a;
  if (evt && a >= 1) emit(w, { t: 'heal', target: h.uid, amount: Math.round(a), x: h.x, y: h.y });
}

export function damageHero(w: World, h: HeroX, amt: number): void {
  if (h.dead) return;
  const a = Math.max(1, Math.round(amt));
  h.hp -= a; h.combatT = 0;
  emit(w, { t: 'hit', target: h.uid, amount: a, dtype: 'impact', crit: false, shatter: false, x: h.x, y: h.y });
  if (h.hp <= 0) {
    h.hp = 0; h.dead = true; h.anim = 'down'; h.animT = 0;
    h.reviveT = BALANCE.squad.reviveSeconds;
    emit(w, { t: 'death', uid: h.uid, kind: 'hero', id: h.id, x: h.x, y: h.y });
    if (h.leader) passLeadership(w);
  }
}

export function passLeadership(w: World): void {
  const hs = w.s.heroes as HeroX[];
  for (const h of hs) h.leader = false;
  const nl = hs.find((h) => !h.dead);
  if (nl) nl.leader = true;
}

export function damageAlly(w: World, a: AllyX, amt: number): void {
  if (a.dead) return;
  a.hp -= amt;
  emit(w, { t: 'hit', target: a.uid, amount: Math.round(amt), dtype: 'impact', crit: false, shatter: false, x: a.x, y: a.y });
  if (a.hp <= 0) { a.dead = true; emit(w, { t: 'death', uid: a.uid, kind: 'hero', id: a.id, x: a.x, y: a.y }); }
}

/** Damage a building. `attacker` enables thorns on walls. Returns damage dealt. */
export function damageBuilding(w: World, b: BuildingX, amt: number, attacker?: EnemyX | null): number {
  if (b.dead) return 0;
  const a = Math.max(1, Math.round(amt));
  b.hp -= a;
  emit(w, { t: 'hit', target: b.uid, amount: a, dtype: 'impact', crit: false, shatter: false, x: b.x + b.w / 2, y: b.y + b.h / 2 });
  if (attacker && isWallLike(b.id)) {
    const th = boonStacks(w, 'thorns');
    if (th) damageEnemy(w, attacker, BOON_FX.thorns, 'pierce', { src: 'trap' });
  }
  if (b.id === 'hearth') {
    if (!w.r.hearthLowWarned && b.hp < b.maxHp * 0.3) { w.r.hearthLowWarned = true; emit(w, { t: 'hearthLow' }); }
    if (b.hp <= 0) { b.hp = 0; }
    return a;
  }
  if (b.hp <= 0) destroyBuilding(w, b);
  else noteBuildingHp(w, b);
  return a;
}

export function destroyBuilding(w: World, b: BuildingX): void {
  if (b.dead) return;
  b.dead = true; b.hp = 0;
  emit(w, { t: 'death', uid: b.uid, kind: 'building', id: b.id, x: b.x + b.w / 2, y: b.y + b.h / 2 });
  w.r.fieldDirty = true; w.lightDirty = true; w.r.snuffDirty = true;
  removeBuildingNow(w, b);
}

/** Remove from state + occupancy immediately (so paths/placement see it this step). */
export function removeBuildingNow(w: World, b: BuildingX): void {
  const arr = w.s.buildings;
  const i = arr.indexOf(b);
  if (i >= 0) arr.splice(i, 1);
  w.bmap.delete(b.uid);
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    const k = y * w.size + x;
    if (w.bldAt[k] === b.uid) w.bldAt[k] = 0;
    if (w.trapAt[k] === b.uid) w.trapAt[k] = 0;
  }
  w.r.fieldDirty = true; w.lightDirty = true; w.r.snuffDirty = true;
  if (BUILDINGS[b.id].wallLike) w.wallMaskDirty = true;
}

export function applyBurn(e: EnemyX, dps: number, secs: number): void {
  if (e.dead) return;
  e.status.burn = Math.min(12, e.status.burn + secs); // durations stack
  e.burnDps = Math.max(e.burnDps, dps);              // DPS does not
}
export function applySlow(e: EnemyX, amt: number, secs: number, frost: boolean): void {
  if (amt >= e.slowAmt || e.slowT <= 0) e.slowAmt = Math.max(amt, e.slowT > 0 ? e.slowAmt : 0);
  e.slowT = Math.max(e.slowT, secs);
  if (frost) e.frostT = Math.max(e.frostT, secs);
}
export function applyStun(e: EnemyX, secs: number): void {
  if (e.dead) return;
  if (e.id === 'mossback' || e.id === 'unlit') secs *= 0.3;
  e.status.stun = Math.max(e.status.stun, secs);
}

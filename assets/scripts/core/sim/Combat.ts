// SPEC §7.2 damage types/tags, §7.5 statuses, kill rewards (gold/essence/XP scaled by beacon + moon),
// building damage → ruins (§6.6), Gloom Book damage milestones (§11.11), last stand / loopholes / thorns.
import type { DamageType, EnemyId } from '../api';
import { BALANCE } from '../data/balance';
import { BOON_FX } from '../data/boons';
import { BUILDINGS } from '../data/buildings';
import { HEROES } from '../data/heroes';
import { RESEARCH } from '../data/progression';
import { TAG_ARMORED, TAG_FLYING, TAG_SWARM, MOSSBACK, BRIARQUEEN, CHAMPION, ENEMIES, SHRIEKER } from '../data/enemies';
import { noteBuildingHp } from './FlowField';
import { grantHeroXp, grantKillXp, heroHitMul, heroAfterHit, heroIncomingDamage, heroOnDown, structureMods } from './heroBridge';
import { bountyProgress, noteKill } from './Daily';
import {
  type World, type EnemyX, type HeroX, type BuildingX, type AllyX, emit, boonStacks, isWallLike, isWall, isTower, liveHeroes, gainRes, isFloor, researchDone,
} from './World';

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

export interface DmgOpts { bonus?: number; synergyMul?: number; src: DmgSrc; hero?: HeroX | null; crit?: boolean; noShatter?: boolean; fromX?: number; fromY?: number }

/** Gloom Book milestone bonus (+2/+4/+6% at 25/250/2500 kills of that type). */
export function bookBonus(w: World, id: EnemyId): number {
  const k = w.s.gloomBook[id]?.kills ?? 0;
  return k >= 2500 ? 0.06 : k >= 250 ? 0.04 : k >= 25 ? 0.02 : 0;
}

export const isBoss = (e: EnemyX) => !!ENEMIES[e.id].boss;

export function damageEnemy(w: World, e: EnemyX, base: number, dtype: DamageType, o: DmgOpts): number {
  if (e.dead || e.hp <= 0) return 0;
  if (!canHit(dtype, e.tags)) return 0;
  if (e.id === 'burrower' && e.shell > 0) return 0;              // underground
  if (dtype === 'fire' && ENEMIES[e.id].fireImmune) return 0;
  let syn = o.synergyMul ?? 1;
  if (e.id === 'mossback' && e.shell > 0) {
    if (o.src === 'tower' || o.src === 'hearth') return 0;         // withdrawn: immune to towers
    if (o.src === 'hero') syn *= MOSSBACK.heroMulInShell;
  }
  if (e.championSkill === 'shield' && o.fromX !== undefined && o.fromY !== undefined && (o.src === 'tower' || o.src === 'hero' || o.src === 'ally')) {
    // shield blocks shots from the front arc (facing the Hearth / movement direction)
    const fx = e.vx || (48 - e.x), fy = e.vy || (48 - e.y);
    let da = Math.abs(Math.atan2(o.fromY - e.y, o.fromX - e.x) - Math.atan2(fy, fx)); if (da > Math.PI) da = 2 * Math.PI - da;
    if (da <= CHAMPION.shieldArc) { emit(w, { t: 'hit', target: e.uid, amount: 0, dtype, crit: false, shatter: false, x: e.x, y: e.y }); return 0; }
  }
  if (e.id === 'briarqueen' && dtype === 'fire') syn *= BRIARQUEEN.fireMul;
  if (dtype === 'fire' && w.s.phase === 'night' && w.s.nightEvent === 'rain') syn *= BALANCE.event.rainFireMul;
  let shatter = false;
  if (dtype === 'impact' && e.frostT > 0 && !o.noShatter) { syn *= BALANCE.synergy.shatterMul; shatter = true; }
  if (o.hero) syn *= heroHitMul(w, o.hero, e, dtype);
  const bonus = (o.bonus ?? 0) + bookBonus(w, e.id);
  const amt = dtype === 'true' ? Math.max(1, Math.round(base)) : finalDamage(base, bonus, dtype, e.tags, syn);
  e.hp -= amt;
  emit(w, { t: 'hit', target: e.uid, amount: amt, dtype, crit: !!o.crit, shatter, x: e.x, y: e.y });
  if (o.hero && !o.hero.dead) {
    const leech = boonStacks(w, 'leech');
    if (leech) healHero(w, o.hero, amt * BOON_FX.leech, false);
    o.hero.combatT = 0;
  }
  if (w.s.boss && w.s.boss.uid === e.uid) w.s.boss.hp = Math.max(0, e.hp);
  if (e.hp <= 0) killEnemy(w, e, o.src);
  if (o.hero) heroAfterHit(w, o.hero, e, amt, dtype);
  return amt;
}

/** Loot multiplier for tonight (beacon × moon/bell). */
export function lootMul(w: World): number {
  const s = w.s;
  let m = s.siege ? 1 : BALANCE.beacon[s.beacon].loot;
  if (w.r.bell) m *= BALANCE.peace.bellLootMul;
  return m;
}

export function killEnemy(w: World, e: EnemyX, src: DmgSrc = 'hero'): void {
  if (e.dead) return;
  e.dead = true; e.hp = 0;
  const s = w.s;
  emit(w, { t: 'death', uid: e.uid, kind: 'enemy', id: e.id, x: e.x, y: e.y });
  if (e.id === 'bomber') emit(w, { t: 'explode', x: e.x, y: e.y, radius: 0.6 }); // shot down: visual pop only
  const G = BALANCE.gold, X = BALANCE.xp;
  const boss = isBoss(e);
  const night = s.phase === 'night';
  let gold = boss ? G.boss : e.id === 'champion' ? G.champion : Math.round((G[e.id] ?? 1) * (e.elite ? G.eliteMul : 1));
  let ess = boss ? BALANCE.essence.boss : e.id === 'champion' ? BALANCE.essence.champion : e.elite ? BALANCE.essence.elite : BALANCE.essence.perKill;
  if (night && e.wave) {
    const lm = lootMul(w);
    gold *= lm; ess *= lm;
    if (s.moon === 'full') gold *= BALANCE.moon.fullGoldMul;
    if (s.moon === 'new') ess *= BALANCE.moon.newEssenceMul;
    gold *= 1 + BALANCE.daily.warmthGold * s.warmth + marketGoldBonus(w);
  }
  gold = Math.max(1, Math.round(gold));
  const g = gainRes(w, 'gold', gold);
  w.r.nightGold += g;
  if (ess > 0) { w.r.nightEssence += ess; gainRes(w, 'essence', ess); }
  emit(w, { t: 'loot', res: 'gold', amount: gold, x: e.x, y: e.y });
  s.stats.kills++; w.r.nightKills++;
  s.hornCharge = Math.min(BALANCE.horn.charge, s.hornCharge + 1);
  const xp = boss ? X.boss : e.id === 'champion' ? X.champion : (X[e.id] ?? 1) * (e.elite ? X.eliteMul : 1);
  grantXp(w, xp);
  noteKill(w, e.id, boss);
  bountyProgress(w, 'kills', 1);
  if (src === 'trap') bountyProgress(w, 'trapKills', 1);
  if (e.flying) bountyProgress(w, 'flyingKills', 1);
  if (e.elite || e.id === 'champion') bountyProgress(w, 'eliteKills', 1);
  if (e.id === 'shrieker') {
    // death shriek: the pack around it is stunned for 1 s
    for (const o of s.enemies as EnemyX[]) if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) <= SHRIEKER.auraRange) applyStun(o, SHRIEKER.deathStun);
  }
  if (boss) {
    s.stats.bosses++;
    if (s.boss && s.boss.uid === e.uid) s.boss.hp = 0;
  }
  if (e.id === 'champion' && s.boss && s.boss.uid === e.uid) s.boss.hp = 0;
}

function marketGoldBonus(w: World): number {
  let n = 0;
  for (const b of w.s.buildings as BuildingX[]) if (b.id === 'market' && !b.dead && b.powered) n += b.workers;
  return n * BALANCE.village.marketGoldPerWorker;
}

/** XP: the roster splits it among the squad (garrisoned heroes get their share) — core-heroes' grantKillXp. */
export function grantXp(w: World, xp: number): void { grantKillXp(w, xp); }
void grantHeroXp; void liveHeroes;

// ── hero helpers kept for the squad (stats come from the roster; these are the hold-side multipliers) ─────────
export function heroLevelMul(h: HeroX): number { return 1 + BALANCE.hero.levelMul * ((h.level ?? 1) - 1); }
export function heroMaxHp(w: World, h: HeroX): number {
  return Math.round(HEROES[h.id].hp * heroLevelMul(h) * (1 + BOON_FX.thick * boonStacks(w, 'thick')));
}
/** Σbonus for hero damage from the hold (blessing Sharp Edge, shrine, full moon). */
export function heroDmgBonus(w: World): number {
  let b = BOON_FX.sharp * boonStacks(w, 'sharp') + (w.s.buffs.shrine === 'damage' ? 0.2 : 0);
  if (w.s.phase === 'night' && w.s.moon === 'full') b += BALANCE.moon.fullHeroDmg - 1;
  return b;
}
export function levelUp(w: World, h: HeroX): void {
  const before = h.maxHp;
  h.level++;
  h.maxHp = heroMaxHp(w, h);
  h.hp = Math.min(h.maxHp, h.hp + (h.maxHp - before));
  emit(w, { t: 'levelUp', hero: h.id });
}

export function healHero(w: World, h: HeroX, amt: number, evt = true): void {
  if (h.dead || h.hp >= h.maxHp) return;
  const a = Math.min(amt, h.maxHp - h.hp);
  h.hp += a;
  if (evt && a >= 1) emit(w, { t: 'heal', target: h.uid, amount: Math.round(a), x: h.x, y: h.y });
}

export function damageHero(w: World, h: HeroX, amt: number, attacker: EnemyX | null = null): void {
  if (h.dead) return;
  amt = heroIncomingDamage(w, h, amt, attacker);
  if (!(amt > 0)) return;
  const a = Math.max(1, Math.round(amt));
  h.hp -= a; h.combatT = 0;
  emit(w, { t: 'hit', target: h.uid, amount: a, dtype: 'impact', crit: false, shatter: false, x: h.x, y: h.y });
  if (h.hp <= 0) {
    if (heroOnDown(w, h)) return;
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
  if (a.hp <= 0) { a.dead = true; emit(w, { t: 'death', uid: a.uid, kind: 'ally', id: a.id, x: a.x, y: a.y }); }
}

function towerAdjacent(w: World, b: BuildingX): boolean {
  const n = w.size;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = b.x + dx, y = b.y + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue;
    const u = w.bldAt[y * n + x]; const o = u ? w.bmap.get(u) : null;
    if (o && isTower(o.id)) return true;
  }
  return false;
}

/** Damage a building. `attacker` enables thorns / loopholes on walls. Returns damage dealt. */
export function damageBuilding(w: World, b: BuildingX, amt: number, attacker?: EnemyX | null): number {
  if (b.dead) return 0;
  if (b.shieldT > 0) return 0;
  amt *= structureMods(w, b).dmgTakenMul;
  const a = Math.max(1, Math.round(amt));
  if (b.id !== 'hearth' && b.hp - a <= 0 && w.s.phase === 'night' && researchDone(w, 0, 8) && !w.r.lastStandUsed) {
    // research "last stand": the first building about to break tonight becomes invulnerable for 5 s
    w.r.lastStandUsed = true; b.shieldT = RESEARCH.lastStandSecs; b.hp = Math.max(1, b.hp);
    return 0;
  }
  b.hp -= a;
  emit(w, { t: 'hit', target: b.uid, amount: a, dtype: 'impact', crit: false, shatter: false, x: b.x + b.w / 2, y: b.y + b.h / 2 });
  if (attacker && !attacker.dead && isWallLike(b.id)) {
    const th = boonStacks(w, 'thorns');
    if (th) damageEnemy(w, attacker, BOON_FX.thorns, 'true', { src: 'trap' });
    if (!attacker.dead && isWall(b.id) && researchDone(w, 0, 5) && towerAdjacent(w, b)) damageEnemy(w, attacker, RESEARCH.loopholeDps / Math.max(0.3, attacker.rate), 'true', { src: 'trap' });
    if (!attacker.dead && b.id === 'wall_ember') attacker.dotFire += (BUILDINGS.wall_ember.dmg ?? 2) / Math.max(0.3, attacker.rate);
  }
  if (b.id === 'hearth') {
    w.r.hearthHitT = 0;
    if (!w.r.hearthLowWarned && b.hp < b.maxHp * 0.3) { w.r.hearthLowWarned = true; emit(w, { t: 'hearthLow' }); }
    if (b.hp <= 0) b.hp = 0;
    return a;
  }
  if (b.hp <= 0) destroyBuilding(w, b);
  else noteBuildingHp(w, b);
  return a;
}

/** A building breaks: it becomes rubble in place (keeps level, garrison, module) — §6.6. Tar is consumed. */
export function destroyBuilding(w: World, b: BuildingX): void {
  if (b.dead) return;
  emit(w, { t: 'death', uid: b.uid, kind: 'building', id: b.id, x: b.x + b.w / 2, y: b.y + b.h / 2 });
  if (b.id === 'trap_tar') { b.dead = true; b.hp = 0; removeBuildingNow(w, b); return; }
  b.dead = true; b.ruined = true; b.hp = 0; b.lit = false; b.constructing = 0; b.workers = 0; b.powered = false; b.burningT = 0; b.frozenT = 0;
  if (w.s.phase === 'night') w.r.lostTonight++;
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    const k = y * w.size + x;
    if (w.bldAt[k] === b.uid) w.bldAt[k] = 0;
    if (w.trapAt[k] === b.uid) w.trapAt[k] = 0;
    w.ruinAt[k] = b.uid;
  }
  w.r.fieldDirty = true; w.lightDirty = true; w.r.snuffDirty = true;
  if (BUILDINGS[b.id].wallLike) w.wallMaskDirty = true;
}

/** Remove from state + occupancy immediately (sell / undo / clear ruin). */
export function removeBuildingNow(w: World, b: BuildingX): void {
  const arr = w.s.buildings;
  const i = arr.indexOf(b);
  if (i >= 0) arr.splice(i, 1);
  w.bmap.delete(b.uid);
  b.dead = true;
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    const k = y * w.size + x;
    if (w.bldAt[k] === b.uid) w.bldAt[k] = 0;
    if (w.trapAt[k] === b.uid) w.trapAt[k] = 0;
    if (w.ruinAt[k] === b.uid) w.ruinAt[k] = 0;
  }
  w.r.fieldDirty = true; w.lightDirty = true; w.r.snuffDirty = true;
  if (BUILDINGS[b.id].wallLike) w.wallMaskDirty = true;
  void isFloor;
}

export function applyBurn(e: EnemyX, dps: number, secs: number): void {
  if (e.dead || ENEMIES[e.id].fireImmune) return;
  e.status.burn = Math.min(12, e.status.burn + secs); // durations stack
  e.burnDps = Math.max(e.burnDps, dps);              // DPS does not
}
export function applySlow(e: EnemyX, amt: number, secs: number, frost: boolean): void {
  if (isBoss(e)) secs *= 0.3;
  if (amt >= e.slowAmt || e.slowT <= 0) e.slowAmt = Math.max(amt, e.slowT > 0 ? e.slowAmt : 0);
  e.slowT = Math.max(e.slowT, secs);
  if (frost) e.frostT = Math.max(e.frostT, secs);
}
export function applyStun(e: EnemyX, secs: number): void {
  if (e.dead) return;
  if (isBoss(e)) secs *= 0.3;
  e.status.stun = Math.max(e.status.stun, secs);
}

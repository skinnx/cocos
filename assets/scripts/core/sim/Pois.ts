// SPEC §4.3 points of interest: camps → chest (gold + 1-of-2 common boons), cages → new hero,
// shrines (one-shot buff), rift roots (−30% budget on that rift tonight), rifts.
import type { HeroId } from '../api';
import { BALANCE } from '../data/balance';
import { HERO_IDS } from '../data/heroes';
import { offerBoons } from './Boons';
import { rebuildTerrain } from './Grid';
import { CENTER } from './MapGen';
import { recruitHero } from './Squad';
import { type World, type PoiX, type HeroX, type EnemyX, emit, newUid, distToRect } from './World';

/** POIs heroes can attack (cages; roots during the day). */
export function attackablePoi(w: World, x: number, y: number, range: number): PoiX | null {
  let best: PoiX | null = null, bd = Infinity;
  for (const p of w.s.pois as PoiX[]) {
    if (!p.active || p.hp <= 0) continue;
    if (p.kind !== 'cage' && !(p.kind === 'root' && w.s.phase === 'day')) continue;
    const d = distToRect(x, y, { x: p.x, y: p.y, w: 1, h: 1 });
    if (d <= range && d < bd) { bd = d; best = p; }
  }
  return best;
}

export function damagePoi(w: World, p: PoiX, amt: number): void {
  if (!p.active || p.hp <= 0) return;
  const a = Math.max(1, Math.round(amt));
  p.hp -= a;
  emit(w, { t: 'hit', target: p.uid, amount: a, dtype: 'impact', crit: false, shatter: false, x: p.x + 0.5, y: p.y + 0.5 });
  if (p.hp > 0) return;
  p.hp = 0; p.active = false;
  if (p.kind === 'cage') {
    const owned = new Set<HeroId>([...(w.s.heroes as HeroX[]).map((h) => h.id), ...w.s.reserve]);
    let pool = w.meta.unlockedHeroes.filter((h) => !owned.has(h));
    if (!pool.length) pool = HERO_IDS.filter((h) => !owned.has(h));
    if (!pool.length) pool = HERO_IDS.slice();
    const id = pool[w.rng.int(0, pool.length - 1)];
    p.data = { ...(p.data ?? {}), hero: id };
    recruitHero(w, id, p.x + 0.5, p.y + 1.2, 1);
    emit(w, { t: 'poi', uid: p.uid, kind: 'cage', action: 'freed' });
    rebuildTerrain(w);
    w.r.fieldDirty = true;
  } else if (p.kind === 'root') {
    const r = (p.data?.rift as number) ?? 0;
    if (!w.r.rootCut.includes(r)) w.r.rootCut.push(r);
    emit(w, { t: 'poi', uid: p.uid, kind: 'root', action: 'destroyed' });
  }
}

export function updatePois(w: World): void {
  const heroes = (w.s.heroes as HeroX[]).filter((h) => !h.dead);
  const touch = BALANCE.poi.touchRange;
  // guard counts
  const counts = new Map<number, number>();
  for (const e of w.s.enemies as EnemyX[]) if (e.guard && !e.dead) counts.set(e.guard, (counts.get(e.guard) ?? 0) + 1);
  const added: PoiX[] = [];
  for (const p of w.s.pois as PoiX[]) {
    p.guards = counts.get(p.uid) ?? 0;
    if (p.kind === 'camp' && p.active && p.guards === 0) {
      p.active = false;
      w.s.stats.camps++;
      emit(w, { t: 'poi', uid: p.uid, kind: 'camp', action: 'cleared' });
      const d = Math.hypot(p.x + 0.5 - CENTER, p.y + 0.5 - CENTER);
      added.push({ uid: newUid(w), kind: 'chest', x: p.x, y: p.y, hp: 1, maxHp: 1, active: true, data: { gold: Math.round(BALANCE.poi.chestGold * (1 + (d - 10) / 15)), open: false }, guards: 0 });
    } else if (p.kind === 'chest' && p.active) {
      if (w.s.boonOffer) continue; // one choice at a time
      if (!heroes.some((h) => Math.hypot(h.x - p.x - 0.5, h.y - p.y - 0.5) <= touch)) continue;
      p.active = false; p.data = { ...(p.data ?? {}), open: true };
      const g = (p.data.gold as number) ?? BALANCE.poi.chestGold;
      w.s.res.gold += g; w.s.stats.goldEarned += g;
      emit(w, { t: 'gold', amount: g, x: p.x + 0.5, y: p.y + 0.5 });
      emit(w, { t: 'poi', uid: p.uid, kind: 'chest', action: 'opened' });
      offerBoons(w, 'chest');
    } else if (p.kind === 'shrine' && p.active) {
      if (!heroes.some((h) => Math.hypot(h.x - p.x - 0.5, h.y - p.y - 0.5) <= touch)) continue;
      p.active = false;
      const roll = w.rng.int(0, 2);
      const buff = roll === 0 ? 'damage' : roll === 1 ? 'towerRate' : 'heal';
      p.data = { ...(p.data ?? {}), used: true, buff };
      if (buff === 'heal') { w.hearth.hp = w.hearth.maxHp; w.r.hearthLowWarned = false; }
      else { w.s.buffs.shrine = buff; w.r.shrineUntil = w.s.night; }
      emit(w, { t: 'poi', uid: p.uid, kind: 'shrine', action: 'used' });
      emit(w, { t: 'shrine', buff });
    }
  }
  for (const a of added) w.s.pois.push(a);
}

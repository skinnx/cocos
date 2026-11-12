// SPEC §11.1 boon offers (weighted by rarity) and application. Effects are read where they apply
// (Combat/Economy/Light/Squad/Towers/Enemies/Phases) via boonStacks().
import type { Boon } from '../api';
import { BALANCE } from '../data/balance';
import { BOONS, BOON_BY_ID, type BoonDef, type BoonId } from '../data/boons';
import { t } from '../data/i18n';
import { TALENT_BY_ID } from '../data/talents';
import { heroMaxHp } from './Combat';
import { buildingMaxHp } from './Economy';
import { skillCdMax } from './Squad';
import { type World, type HeroX, type BuildingX, emit, boonStacks } from './World';

export function makeBoon(w: World, d: BoonDef): Boon {
  return { id: d.id, name: t(`boon.${d.id}.name`), desc: t(`boon.${d.id}.desc`), group: d.group, rarity: d.rarity, stacks: boonStacks(w, d.id), maxStacks: d.maxStacks };
}

function available(w: World, d: BoonDef): boolean {
  if (boonStacks(w, d.id) >= d.maxStacks) return false;
  if (d.id === 'ally' && w.s.squadMax >= BALANCE.squad.maxWithBoon) return false;
  return true;
}

export function rollBoons(w: World, count: number, commonOnly: boolean): Boon[] {
  const rw = w.s.night >= BALANCE.rarity.lateFromNight ? BALANCE.rarity.late : BALANCE.rarity.early;
  const out: BoonDef[] = [];
  for (let k = 0; k < count; k++) {
    const pool = BOONS.filter((d) => available(w, d) && !out.includes(d) && (!commonOnly || d.rarity === 'common'));
    if (!pool.length) break;
    let rar: BoonDef['rarity'] = 'common';
    if (!commonOnly) { const r = w.rng.weighted(rw); rar = r === 0 ? 'common' : r === 1 ? 'rare' : 'legendary'; }
    let sub = pool.filter((d) => d.rarity === rar);
    if (!sub.length) sub = pool;
    out.push(sub[w.rng.int(0, sub.length - 1)]);
  }
  return out.map((d) => makeBoon(w, d));
}

export function offerBoons(w: World, source: 'dawn' | 'chest'): void {
  const n = source === 'dawn' ? 3 : 2 + TALENT_BY_ID.chestChoice.perLevel * (w.meta.talents.chestChoice ?? 0);
  w.s.boonOffer = rollBoons(w, n, source === 'chest');
  w.s.boonSource = source;
  if (!w.s.boonOffer.length) { w.s.boonOffer = null; w.s.boonSource = null; return; }
  emit(w, { t: 'boonOffer', source });
}

export function applyBoon(w: World, id: BoonId): void {
  const d = BOON_BY_ID[id];
  let b = w.s.boons.find((x) => x.id === id);
  if (!b) { b = makeBoon(w, d); b.stacks = 0; w.s.boons.push(b); }
  if (b.stacks >= d.maxStacks) return;
  b.stacks++;
  // immediate effects
  switch (id) {
    case 'thick':
      for (const h of w.s.heroes as HeroX[]) { const before = h.maxHp; h.maxHp = heroMaxHp(w, h); if (!h.dead) h.hp += h.maxHp - before; }
      break;
    case 'ally': w.s.squadMax = Math.min(BALANCE.squad.maxWithBoon, w.s.squadMax + 1); break;
    case 'cooldown': for (const h of w.s.heroes as HeroX[]) { h.skillCdMax = skillCdMax(w, h.id); h.skillCd = Math.min(h.skillCd, h.skillCdMax); } break;
    case 'boulder':
      for (const x of w.s.buildings as BuildingX[]) if (x.id === 'wall_wood' || x.id === 'wall_stone') { const before = x.maxHp; x.maxHp = buildingMaxHp(w, x.id, x.level); x.hp += x.maxHp - before; }
      w.r.fieldDirty = true;
      break;
    case 'spikes': for (const x of w.s.buildings as BuildingX[]) if (x.id === 'trap_spikes') x.charges += 4; w.r.fieldDirty = true; break;
    case 'bigfire': case 'farlight': w.lightDirty = true; break;
    case 'embers': for (const x of w.s.buildings as BuildingX[]) if (x.id === 'brazier') x.fueled = true; w.lightDirty = true; break;
  }
}

export function pickBoon(w: World, index: number): boolean {
  const offer = w.s.boonOffer;
  if (!offer || index < 0 || index >= offer.length) return false;
  applyBoon(w, offer[index].id as BoonId);
  w.s.boonOffer = null;
  return true;
}

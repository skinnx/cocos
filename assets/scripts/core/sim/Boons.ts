// SPEC v2 §11.7 dawn gifts (1 of 3, 4 at Fierce+; blessing / resource pack / rare 10%, guaranteed at Nightmare)
// and blessings (24 boons lasting 3 nights, 3 slots / 4 from Hearth tier 5, duplicates stack + refresh, full → drop one).
// Effects are read where they apply (Combat/Economy/Light/Squad/Towers/Enemies/Phases) via boonStacks().
import type { BoonDef as ApiBoonDef, DawnGift, HeroId, ResKey } from '../api';
import { BALANCE } from '../data/balance';
import { BOONS, BOON_BY_ID, type BoonDef, type BoonId } from '../data/boons';
import { HERO_IDS } from '../data/heroes';
import { t } from '../data/i18n';
import { buildingMaxHp } from './Economy';
import { grantShards, syncSquad } from './heroBridge';
import { Rng, mixSeed } from './Rng';
import { bestShardHero, makeGear } from './Daily';
import { type World, type BuildingX, type HeroX, boonStacks, gainRes, isWall } from './World';

export function describeBoon(id: string): ApiBoonDef {
  const d = BOON_BY_ID[id as BoonId];
  return { id, name: t(`boon.${id}.name`), desc: t(`boon.${id}.desc`), group: d.group, rarity: d.rarity, maxStacks: d.maxStacks };
}

function available(w: World, d: BoonDef): boolean {
  if (boonStacks(w, d.id) >= d.maxStacks) return false;
  if (d.id === 'ally' && w.s.squadMax >= BALANCE.squad.maxWithBoon) return false;
  return true;
}

export function blessingSlots(w: World): number { return w.s.hearthTier >= 5 ? BALANCE.blessing.slotsAtTier5 : BALANCE.blessing.slots; }

/** Roll `count` distinct blessings by rarity weights (70/25/5, TR ≥ 12: 55/35/10). */
export function rollBoons(w: World, count: number, rng: Rng, exclude: string[] = []): BoonDef[] {
  const B = BALANCE.blessing;
  const rw = w.s.tr >= B.lateFromTr ? B.rarityLate : B.rarity;
  const out: BoonDef[] = [];
  for (let k = 0; k < count; k++) {
    const pool = BOONS.filter((d) => available(w, d) && !out.includes(d) && !exclude.includes(d.id));
    if (!pool.length) break;
    const r = rng.weighted(rw);
    const rar: BoonDef['rarity'] = r === 0 ? 'common' : r === 1 ? 'rare' : 'legendary';
    let sub = pool.filter((d) => d.rarity === rar);
    if (!sub.length) sub = pool;
    out.push(sub[rng.int(0, sub.length - 1)]);
  }
  return out;
}

function resourceGift(w: World, rng: Rng): DawnGift {
  const tr = w.s.tr;
  const opts: Array<[ResKey, number]> = [['wood', 60 + 15 * tr], ['stone', 45 + 12 * tr], ['iron', 10 + 3 * tr], ['essence', 20 + 5 * tr]];
  const [res, amount] = opts[rng.int(0, opts.length - 1)];
  return { kind: 'resources', res, amount: Math.round(amount) };
}

function rareGift(w: World, rng: Rng): DawnGift {
  const r = rng.int(0, 2);
  if (r === 0) {
    const squad = (w.s.heroes as HeroX[]).map((h) => h.id);
    const hero: HeroId = squad.length ? squad[rng.int(0, squad.length - 1)] : 'knight';
    return { kind: 'rare', what: 'shards', hero, amount: 5 };
  }
  if (r === 1) return { kind: 'rare', what: 'gear', amount: 1 };
  return { kind: 'rare', what: 'lore', amount: 2 };
}

/** Roll tonight's dawn gifts into state.gifts. */
export function offerGifts(w: World, salt = 0): void {
  const s = w.s;
  const rng = new Rng(mixSeed(s.seed, 41000 + s.night * 17 + salt));
  const n = 3 + (s.beacon === 'fierce' || s.beacon === 'nightmare' ? 1 : 0);
  const gifts: DawnGift[] = [];
  const used: string[] = [];
  let rareForced = s.beacon === 'nightmare' && !s.siege;
  for (let k = 0; k < n; k++) {
    const roll = rng.next();
    if (rareForced || roll < BALANCE.blessing.rareGiftChance) { gifts.push(rareGift(w, rng)); rareForced = false; continue; }
    if (roll < 0.62) {
      const b = rollBoons(w, 1, rng, used)[0];
      if (b) { used.push(b.id); gifts.push({ kind: 'blessing', boon: b.id, rarity: b.rarity }); continue; }
    }
    gifts.push(resourceGift(w, rng));
  }
  s.gifts = gifts;
  s.giftSource = 'dawn';
}

/** Apply a chosen gift. Returns false when a blessing waits for a slot (state.blessings full → dropBlessing). */
export function applyGift(w: World, g: DawnGift): boolean {
  const s = w.s;
  if (g.kind === 'resources') { gainRes(w, g.res, g.amount); return true; }
  if (g.kind === 'rare') {
    const rng = new Rng(mixSeed(s.seed, 42000 + s.night));
    if (g.what === 'shards') grantShards(s, g.hero ?? bestShardHero(w), g.amount);
    else if (g.what === 'gear') makeGear(w, 'rare', rng);
    else gainRes(w, 'lore', g.amount);
    return true;
  }
  return applyBoon(w, g.boon as BoonId);
}

export function applyBoon(w: World, id: BoonId): boolean {
  const s = w.s;
  const d = BOON_BY_ID[id];
  let b = s.blessings.find((x) => x.id === id);
  if (b) {
    b.stacks = Math.min(d.maxStacks, b.stacks + 1);
    b.nightsLeft = BALANCE.blessing.nights;
  } else {
    if (s.blessings.length >= blessingSlots(w)) { w.r.pendingBlessing = id; return false; }
    b = { id, stacks: 1, nightsLeft: BALANCE.blessing.nights };
    s.blessings.push(b);
  }
  blessingChanged(w, id);
  return true;
}

/** Re-derive state that depends on a blessing (on gain and on loss). */
export function blessingChanged(w: World, id: string): void {
  const s = w.s;
  switch (id) {
    case 'boulder':
      for (const x of s.buildings as BuildingX[]) if (isWall(x.id) && !x.dead) { const before = x.maxHp; x.maxHp = buildingMaxHp(w, x.id, x.level, x); x.hp = Math.max(1, Math.min(x.maxHp, x.hp + (x.maxHp - before))); }
      w.r.fieldDirty = true; break;
    case 'spikes':
      for (const x of s.buildings as BuildingX[]) if (x.id === 'trap_spikes' && !x.dead) x.charges = Math.max(0, x.charges + (boonStacks(w, 'spikes') > 0 ? 4 : -4));
      w.r.fieldDirty = true; break;
    case 'ally':
      s.squadMax = squadMaxOf(w);
      syncSquad(w); break;
    case 'bigfire': case 'farlight': w.lightDirty = true; break;
    case 'embers': for (const x of s.buildings as BuildingX[]) if (x.id === 'brazier') x.fueled = true; w.lightDirty = true; break;
  }
}

export function dropBlessing(w: World, id: string): boolean {
  const s = w.s;
  const i = s.blessings.findIndex((b) => b.id === id);
  if (i < 0) {
    if (w.r.pendingBlessing === id) { w.r.pendingBlessing = null; return true; } // decline the new one
    return false;
  }
  s.blessings.splice(i, 1);
  blessingChanged(w, id);
  if (w.r.pendingBlessing) { const p = w.r.pendingBlessing as BoonId; w.r.pendingBlessing = null; applyBoon(w, p); }
  return true;
}

/** DAWN: blessings age one night; expired ones are removed. */
export function ageBlessings(w: World): void {
  const s = w.s;
  for (const b of [...s.blessings]) {
    b.nightsLeft--;
    if (b.nightsLeft <= 0) { s.blessings.splice(s.blessings.indexOf(b), 1); blessingChanged(w, b.id); }
  }
}

export function squadMaxOf(w: World): number {
  return BALANCE.hero.squadMax + (w.s.unlocked.includes('squad5') ? 1 : 0) + (boonStacks(w, 'ally') > 0 ? 1 : 0);
}

export { HERO_IDS };

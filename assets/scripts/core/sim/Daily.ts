// SPEC v2 §11.10/§11.11/§2.5/§2.7: daily layer (bounties, rerolls, queue, warmth, traveler), weekly chronicle,
// Gloom Book, achievements, cosmetics, unlock list (onboarding), next goals, pacing log.
import type { BuildingId, Cost, EnemyId, GearItem, HeroId, Rarity, ResKey, TravelerOffer, UnlockKey } from '../api';
import { BALANCE } from '../data/balance';
import { GEAR_ROLLS, CHARM_IDS } from '../data/gear';
import { HERO_IDS } from '../data/heroes';
import {
  ACHIEVEMENTS, BOUNTIES, BOUNTY_REWARD, CHRONICLE_REWARDS, COSMETICS, RESEARCH, TIER_REQ, TRADE_RES, type BountyKind,
} from '../data/progression';
import { t } from '../data/i18n';
import { Rng, mixSeed } from './Rng';
import { grantShards, rollIslands } from './heroBridge';
import { type World, type BuildingX, emit, newUid, gainRes, canAfford, payCost, researchDone, STORED_KEYS } from './World';

// ── pacing / unlocks ─────────────────────────────────────────────────────────
export function logUnlock(w: World): void { w.r.unlockLog.push(w.s.night); }

export function unlock(w: World, key: UnlockKey): void {
  if (w.s.unlocked.includes(key)) return;
  w.s.unlocked.push(key);
  emit(w, { t: 'unlock', what: key });
  logUnlock(w);
}

export function noteFirstBuilt(w: World, id: BuildingId): void {
  if (w.r.firstBuilt.includes(id)) return;
  w.r.firstBuilt.push(id);
  if (id !== 'wall_wood' && id !== 'gate' && id !== 'brazier' && id !== 'tower_arrow' && id !== 'trap_spikes') logUnlock(w);
}

export function noteSeen(w: World, id: EnemyId): void {
  const b = w.s.gloomBook[id];
  if (!b) w.s.gloomBook[id] = { kills: 0, seen: true }; else b.seen = true;
}

export function noteKill(w: World, id: EnemyId, boss: boolean): void {
  const b = w.s.gloomBook[id] ?? (w.s.gloomBook[id] = { kills: 0, seen: true });
  b.kills++; b.seen = true;
  void boss;
}

// ── bounties ─────────────────────────────────────────────────────────────────
function counter(w: World, k: string, n: number): void { w.r.counters[k] = (w.r.counters[k] ?? 0) + n; }

export function bountyProgress(w: World, kind: BountyKind, n: number): void {
  if (!(n > 0)) return;
  counter(w, kind, n);
  w.s.bounties.forEach((b, i) => {
    if (b.done) return;
    const tpl = BOUNTIES.find((x) => x.id === b.template);
    if (!tpl || tpl.kind !== kind) return;
    b.progress = Math.min(b.goal, b.progress + n);
    if (b.progress >= b.goal) { b.done = true; emit(w, { t: 'bounty', index: i, done: true }); }
  });
}

function makeBounty(w: World, rng: Rng): void {
  const s = w.s;
  const have = new Set(s.bounties.map((b) => b.template));
  const pool = BOUNTIES.filter((b) => !have.has(b.id) && b.minTier <= s.hearthTier && (b.group !== 'expedition' || s.unlocked.includes('dock')));
  if (!pool.length) return;
  const tpl = pool[rng.int(0, pool.length - 1)];
  const gold = Math.round(tpl.gold * (1 + 0.05 * (s.tr - 1)));
  s.bounties.push({
    template: tpl.id, text: `bounty.${tpl.id}`, progress: 0, goal: tpl.goal, done: false, claimed: false,
    reward: { gold, ember: BOUNTY_REWARD.ember, deeds: BOUNTY_REWARD.deeds },
  });
}

export function bountiesPerDay(w: World): number {
  let n = BALANCE.daily.bounties;
  if (researchDone(w, 2, 8)) n += Math.floor(w.s.villagers.length / RESEARCH.prosperityPer);
  return n;
}

export function claimBounty(w: World, index: number): boolean {
  const b = w.s.bounties[index];
  if (!b || !b.done || b.claimed) return false;
  b.claimed = true;
  if (b.reward.gold) gainRes(w, 'gold', b.reward.gold);
  w.s.ember += b.reward.ember ?? 0;
  addDeeds(w, b.reward.deeds ?? 0);
  w.s.bounties.splice(index, 1);
  return true;
}

export function rerollBounty(w: World, index: number): boolean {
  const s = w.s;
  const b = s.bounties[index];
  if (!b || b.done || s.bountyRerolls <= 0) return false;
  s.bountyRerolls--;
  s.bounties.splice(index, 1);
  const rng = new Rng(mixSeed(s.seed, 90000 + s.clock.dayKey * 7 + s.bountyRerolls * 131 + index));
  const before = s.bounties.length;
  makeBounty(w, rng);
  if (s.bounties.length > before) { const nb = s.bounties.pop()!; s.bounties.splice(index, 0, nb); }
  return true;
}

// ── chronicle ────────────────────────────────────────────────────────────────
export function addDeeds(w: World, n: number): void {
  if (!w.s.unlocked.includes('chronicle')) return;
  w.s.chronicle.deeds += n;
}

export function claimChronicle(w: World, step: number): boolean {
  const s = w.s, c = s.chronicle;
  if (step !== c.claimed || step >= BALANCE.chronicle.steps) return false;
  if (c.deeds < BALANCE.chronicle.thresholds[step]) return false;
  const r = CHRONICLE_REWARDS[step];
  for (const k of ['wood', 'stone', 'gold', 'iron', 'essence', 'lore'] as ResKey[]) if (r[k]) gainRes(w, k, r[k]!);
  if (r.ember) s.ember += r.ember;
  if (r.shards) grantShards(s, bestShardHero(w), r.shards);
  if (r.cosmetic) grantCosmetic(w, new Rng(mixSeed(s.seed, 777 + c.week)));
  c.claimed++;
  return true;
}

/** Hero that should receive "hero of your choice" shards: first un-owned, else lowest-star owned. */
export function bestShardHero(w: World): HeroId {
  const r = w.s.roster;
  const unowned = HERO_IDS.find((h) => r[h] && !r[h].owned);
  if (unowned) return unowned;
  let best: HeroId = 'knight';
  for (const h of HERO_IDS) if (r[h] && r[h].stars < r[best].stars) best = h;
  return best;
}

export function grantCosmetic(w: World, rng: Rng): string | null {
  const owned = new Set(w.s.cosmetics.owned);
  const pool = COSMETICS.filter((c) => !owned.has(c));
  if (!pool.length) { gainRes(w, 'gold', 100); return null; }
  const c = pool[rng.int(0, pool.length - 1)];
  w.s.cosmetics.owned.push(c);
  logUnlock(w);
  return c;
}

export function setCosmetic(w: World, kind: 'flame' | 'banner' | 'wallSkin', id: string): boolean {
  const c = w.s.cosmetics;
  const key = kind === 'flame' ? (id.startsWith('flame_') ? id : `flame_${id}`) : kind === 'banner' ? (id.startsWith('banner_') ? id : `banner_${id}`) : (id.startsWith('skin_') ? id : `skin_${id}`);
  if (!c.owned.includes(key)) return false;
  const bare = key.replace(/^(flame_|skin_)/, '');
  if (kind === 'flame') c.flame = bare; else if (kind === 'banner') c.banner = key; else c.wallSkin = bare;
  return true;
}

// ── gear helper (rare gifts / traveler / boss chests) ─────────────────────────
export function makeGear(w: World, rarity: Rarity, rng: Rng): GearItem {
  const slots = ['weapon', 'armor', 'charm'] as const;
  const slot = slots[rng.int(0, 2)];
  const roll = (r: readonly number[]) => rng.int(r[0], r[1]);
  const g: GearItem = { uid: newUid(w), slot, rarity, dmgPct: 0, hpPct: 0, reducePct: 0, equippedBy: null };
  if (slot === 'weapon') {
    g.dmgPct = roll(GEAR_ROLLS.weapon.dmgPct[rarity]);
    if (rng.chance(GEAR_ROLLS.weapon.onHitChance[rarity])) g.onHit = (['burn', 'slow', 'bleed'] as const)[rng.int(0, 2)];
  } else if (slot === 'armor') {
    g.hpPct = roll(GEAR_ROLLS.armor.hpPct[rarity]); g.reducePct = roll(GEAR_ROLLS.armor.reducePct[rarity]);
  } else g.charm = CHARM_IDS[rng.int(0, CHARM_IDS.length - 1)];
  w.s.gear.push(g);
  return g;
}

// ── traveler ─────────────────────────────────────────────────────────────────
export function rollTraveler(w: World): void {
  const s = w.s;
  const rng = new Rng(mixSeed(s.seed, 31000 + s.night));
  const offers: TravelerOffer[] = [];
  const n = 2 + (researchDone(w, 2, 7) ? RESEARCH.travelerExtra : 0);
  for (let k = 0; k < n; k++) {
    const keys = TRADE_RES.filter((r) => r !== 'essence' || s.tr >= 3);
    const a = keys[rng.int(0, keys.length - 1)];
    let b = keys[rng.int(0, keys.length - 1)]; if (b === a) b = a === 'wood' ? 'stone' : 'wood';
    const amt = Math.round(40 + 6 * s.tr);
    const rate = rng.range(0.7, 1.3);
    offers.push({ give: { [a]: amt }, price: { [b]: Math.max(5, Math.round(amt * rate * (b === 'iron' || a === 'iron' ? (b === 'iron' ? 0.25 : 4) : 1))) }, bought: false });
  }
  if (rng.chance(0.5)) offers.push({ give: { shards: bestShardHero(w), amount: 8 }, price: { gold: 120 + 10 * s.tr }, bought: false });
  else offers.push({ give: { gear: rng.chance(0.25) ? 'rare' : 'common' }, price: { gold: 150 + 10 * s.tr }, bought: false });
  const owned = new Set(s.cosmetics.owned);
  const pool = COSMETICS.filter((c) => !owned.has(c));
  if (pool.length) offers.push({ give: { cosmetic: pool[rng.int(0, pool.length - 1)] }, price: { gold: 200 }, bought: false });
  s.traveler = offers;
}

export function trade(w: World, index: number): boolean {
  const s = w.s;
  const o = s.traveler?.[index];
  if (!o || o.bought || !canAfford(s.res, o.price)) return false;
  payCost(w, o.price);
  o.bought = true;
  const g = o.give as Record<string, unknown>;
  if ('shards' in g) grantShards(s, g.shards as HeroId, g.amount as number);
  else if ('gear' in g) makeGear(w, g.gear as Rarity, new Rng(mixSeed(s.seed, 32000 + s.night * 13 + index)));
  else if ('cosmetic' in g) { if (!s.cosmetics.owned.includes(g.cosmetic as string)) { s.cosmetics.owned.push(g.cosmetic as string); logUnlock(w); } }
  else for (const k in g) gainRes(w, k as ResKey, g[k] as number);
  bountyProgress(w, 'trade', 1);
  return true;
}

// ── daily rollover (§11.10, §13.7: at most one rollover however far the clock jumps) ───────────────────────────
export function dailyRollover(w: World, dayKey: number): number {
  const s = w.s;
  if (!(dayKey > s.clock.dayKey)) return 0;
  const gap = dayKey - s.clock.dayKey;
  let added = 0;
  if (s.unlocked.includes('bounties')) {
    const rng = new Rng(mixSeed(s.seed, 90000 + dayKey));
    const want = bountiesPerDay(w);
    for (let k = 0; k < want && s.bounties.length < BALANCE.daily.bountyQueueMax; k++) { const before = s.bounties.length; makeBounty(w, rng); if (s.bounties.length > before) added++; }
    s.bountyRerolls = BALANCE.daily.freeRerolls;
  }
  s.trails = Math.min(BALANCE.expedition.trailsMax, s.trails + BALANCE.expedition.trailsPerDay);
  s.islands = rollIslands(s.seed, dayKey, s.regionsOpen);
  // warmth: −1 for every whole day without a night played (never below 0)
  const idle = Math.max(0, dayKey - Math.max(w.r.lastPlayDay, s.clock.dayKey) - 1) + (w.r.lastPlayDay < s.clock.dayKey ? 1 : 0);
  if (idle > 0) s.warmth = Math.max(0, s.warmth - Math.min(idle, gap));
  const week = Math.floor(dayKey / 7);
  if (week !== s.chronicle.week) s.chronicle = { week, deeds: 0, claimed: 0 };
  s.clock.dayKey = dayKey;
  return added;
}

/** A night was played today → +1 warmth once per real day. */
export function notePlayedNight(w: World): void {
  const s = w.s;
  w.r.lastPlayDay = s.clock.dayKey;
  if (w.r.warmthDay !== s.clock.dayKey) {
    w.r.warmthDay = s.clock.dayKey;
    s.warmth = Math.min(BALANCE.daily.warmthMax, s.warmth + 1);
  }
}

// ── achievements (§11.11) ────────────────────────────────────────────────────
function achieved(w: World, id: string): boolean {
  const s = w.s, c = w.r.counters;
  const blds = s.buildings as BuildingX[];
  const live = (f: (b: BuildingX) => boolean) => blds.filter((b) => !b.dead && f(b)).length;
  switch (id) {
    case 'first_wall': return (c.walls ?? 0) >= 1;
    case 'walls_100': return (c.walls ?? 0) >= 100;
    case 'stone_ring': return (c.stoneRing ?? 0) >= 1;
    case 'towers_10': return live((b) => b.id.startsWith('tower_')) >= 10;
    case 'max_tower': return live((b) => b.id.startsWith('tower_') && b.level >= 3) >= 1;
    case 'hearth_3': return s.hearthTier >= 3;
    case 'hearth_5': return s.hearthTier >= 5;
    case 'buildings_100': return s.stats.built >= 100;
    case 'first_night': return s.stats.nightsWon >= 1;
    case 'nights_10': return s.stats.nightsWon >= 10;
    case 'nights_50': return s.stats.nightsWon >= 50;
    case 'flawless': return (c.flawless ?? 0) >= 1;
    case 'fierce_win': return (c.nightWinFierce ?? 0) >= 1;
    case 'nightmare_win': return (c.nightWinNightmare ?? 0) >= 1;
    case 'blood_moon': return (c.bloodWin ?? 0) >= 1;
    case 'kills_1000': return s.stats.kills >= 1000;
    case 'mossback': return (s.gloomBook.mossback?.kills ?? 0) >= 1;
    case 'briarqueen': return (s.gloomBook.briarqueen?.kills ?? 0) >= 1;
    case 'first_camp': return s.stats.camps >= 1;
    case 'camps_10': return s.stats.camps >= 10;
    case 'region_2': return s.regionsOpen >= 2;
    case 'region_3': return s.regionsOpen >= 3;
    case 'first_ruin': return (c.ruin ?? 0) >= 1;
    case 'first_expedition': return s.stats.expeditions >= 1;
    case 'first_villager': return s.villagers.length >= 1;
    case 'villagers_10': return s.villagers.length >= 10;
    case 'villagers_20': return s.villagers.length >= 20;
    case 'well_fed': return w.r.wellFed >= BALANCE.village.wellFedAfter;
    case 'first_research': return s.research[0] + s.research[1] + s.research[2] >= 1;
    case 'warmth_7': return s.warmth >= BALANCE.daily.warmthMax;
  }
  return false;
}

export function checkAchievements(w: World): void {
  const s = w.s;
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id) || !achieved(w, a.id)) continue;
    s.achievements.push(a.id);
    gainRes(w, 'gold', a.gold);
    s.ember += a.ember;
    emit(w, { t: 'achievement', id: a.id });
  }
}

// ── next goals (§2.5): one line each for session / day / week ─────────────────
export function tierReqMet(w: World, tier: number): boolean {
  const s = w.s;
  const r = TIER_REQ[tier - 1];
  if (!r) return false;
  switch (r.kind) {
    case 'none': return true;
    case 'nightsWon': return s.stats.nightsWon >= r.n;
    case 'villagers': return s.villagers.length >= r.n;
    case 'sealed': return s.regionsOpen > r.region;
    case 'tr': return s.tr >= r.n;
  }
}

export function updateGoals(w: World): void {
  const s = w.s;
  let session: string;
  const ruins = (s.buildings as BuildingX[]).filter((b) => b.ruined).length;
  const doneB = s.bounties.filter((b) => b.done && !b.claimed).length;
  const next = s.hearthTier + 1;
  if (ruins) session = `goal.rebuild|n=${ruins}`;
  else if (doneB) session = `goal.claimBounty|n=${doneB}`;
  else if (next <= 10 && tierReqMet(w, next)) session = `goal.hearth|tier=${next}`;
  else if (!s.villagers.length && s.unlocked.includes('house')) session = 'goal.house';
  else session = `goal.night|n=${s.night}`;
  let day: string;
  if (s.unlocked.includes('bounties')) day = `goal.bounties|done=${s.bounties.filter((b) => b.done).length}|total=${s.bounties.length}`;
  else if (next <= 10) {
    const r = TIER_REQ[next - 1];
    day = r.kind === 'nightsWon' ? `goal.winNights|have=${s.stats.nightsWon}|need=${r.n}` : r.kind === 'villagers' ? `goal.villagers|have=${s.villagers.length}|need=${r.n}`
      : r.kind === 'tr' ? `goal.threat|have=${s.tr}|need=${r.n}` : `goal.seal|region=${r.kind === 'sealed' ? r.region : 0}`;
  } else day = 'goal.deep';
  let week: string;
  if (s.unlocked.includes('chronicle') && s.chronicle.claimed < BALANCE.chronicle.steps) week = `goal.chronicle|step=${s.chronicle.claimed + 1}|deeds=${s.chronicle.deeds}|need=${BALANCE.chronicle.thresholds[s.chronicle.claimed]}`;
  else if (s.tr >= s.trCap && s.regionsOpen <= 5) week = `goal.seal|region=${s.regionsOpen}`;
  else week = `goal.threatCap|tr=${s.tr}|cap=${s.trCap}`;
  s.nextGoals = { session, day, week };
}

/** Resolve a goal string ("key|p=v|…") with t(). */
export function goalText(goal: string, lang: 'en' | 'vi' = 'en'): string {
  const [key, ...ps] = goal.split('|');
  const params: Record<string, string> = {};
  for (const p of ps) { const [k, v] = p.split('='); params[k] = v; }
  return t(key, lang, params);
}

export function storageFillFrac(w: World): number {
  let m = 0;
  for (const k of STORED_KEYS) m = Math.max(m, w.s.res[k] / Math.max(1, w.s.storageCap));
  return m;
}

export type { Cost };

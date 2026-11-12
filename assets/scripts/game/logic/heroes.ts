// Hero-screen helpers (no 'cc'): roster ordering, squad edits, star-up / skill-pick availability, gear text, scout
// trip countdowns (SPEC §11.4, §11.5).
import type { GearItem, GearSlot, HeroId, HeroRecord } from '../../core/api';
import { HERO_BAL, HERO_LIST, levelCap, starUpCost } from './catalog';

/** Owned heroes first (stars, then level), then the ones being collected (most shards first). */
export function rosterOrder(roster: Partial<Record<HeroId, HeroRecord>>): HeroId[] {
  const ids = HERO_LIST.filter((h) => roster[h]);
  return ids.sort((a, b) => {
    const A = roster[a]!, B = roster[b]!;
    if (A.owned !== B.owned) return A.owned ? -1 : 1;
    if (A.owned) return B.stars - A.stars || B.level - A.level || HERO_LIST.indexOf(a) - HERO_LIST.indexOf(b);
    return B.shards - A.shards || HERO_LIST.indexOf(a) - HERO_LIST.indexOf(b);
  });
}

export function squadOf(roster: Partial<Record<HeroId, HeroRecord>>): HeroId[] {
  return HERO_LIST.filter((h) => roster[h]?.owned && roster[h]!.status === 'squad');
}

/** New squad list after toggling `id` (leader stays first). Null when the change is not allowed. */
export function toggleSquad(squad: readonly HeroId[], id: HeroId, max: number, rec: Pick<HeroRecord, 'owned' | 'status'>): HeroId[] | null {
  if (!rec.owned) return null;
  if (squad.includes(id)) return squad.length <= 1 ? null : squad.filter((h) => h !== id);
  if (rec.status === 'dispatch') return null;
  if (squad.length >= max) return null;
  return [...squad, id];
}

export type StarUpState = { can: true; shards: number; essence: number } | { can: false; reason: 'max' | 'shards' | 'essence' | 'locked'; shards: number; essence: number };
export function starUpState(rec: Pick<HeroRecord, 'owned' | 'stars' | 'shards'>, essence: number): StarUpState {
  if (!rec.owned) return { can: false, reason: 'locked', shards: HERO_BAL.unlockShards, essence: 0 };
  const c = starUpCost(rec.stars);
  if (!c) return { can: false, reason: 'max', shards: 0, essence: 0 };
  if (rec.shards < c.shards) return { can: false, reason: 'shards', ...c };
  if (essence < c.essence) return { can: false, reason: 'essence', ...c };
  return { can: true, ...c };
}

export interface SkillRow { index: number; level: number; pick: 0 | 1 | -1; open: boolean }
/** The five skill-path rows (levels 5/10/15/20/25) with the current pick and whether the level is reached. */
export function skillRows(rec: Pick<HeroRecord, 'level' | 'skills'>): SkillRow[] {
  return HERO_BAL.skillPickLevels.map((lv, i) => ({ index: i, level: lv, pick: (rec.skills?.[i] ?? -1) as 0 | 1 | -1, open: rec.level >= lv }));
}
export function respecGold(level: number): number { return HERO_BAL.respecGoldPerLevel * level; }

export function levelText(rec: Pick<HeroRecord, 'level' | 'stars'>): { level: number; cap: number } { return { level: rec.level, cap: levelCap(rec.stars) }; }

/** Items that fit a slot, unequipped first, best rarity first. */
export function itemsForSlot(gear: readonly GearItem[], slot: GearSlot): GearItem[] {
  const rank = { epic: 0, rare: 1, common: 2 } as const;
  return gear.filter((g) => g.slot === slot).sort((a, b) => (a.equippedBy ? 1 : 0) - (b.equippedBy ? 1 : 0) || rank[a.rarity] - rank[b.rarity] || b.uid - a.uid);
}
export function itemByUid(gear: readonly GearItem[], uid: number): GearItem | null { return uid ? gear.find((g) => g.uid === uid) ?? null : null; }

/** Short stat text for an item: "+12% dmg", "+20% hp -5% taken", or the charm name key. */
export function gearStats(g: GearItem): { parts: string[]; charm: string | null } {
  const parts: string[] = [];
  if (g.dmgPct) parts.push(`+${Math.round(g.dmgPct)}% dmg`);
  if (g.hpPct) parts.push(`+${Math.round(g.hpPct)}% hp`);
  if (g.reducePct) parts.push(`-${Math.round(g.reducePct)}% taken`);
  if (g.onHit) parts.push(g.onHit);
  return { parts, charm: g.charm ? `charm.${g.charm}` : null };
}
export function gearIcon(g: Pick<GearItem, 'slot' | 'charm'>): string { return g.charm ? `icon_charm_${g.charm}` : `icon_gear_${g.slot}`; }

/** Normalise an `endsAt` stamp to ms since epoch (core stores ms; tolerate seconds). */
export function stampMs(t: number): number { return t > 1e11 ? t : t * 1000; }
/** Seconds left on a scout trip (0 when done). */
export function dispatchLeft(rec: Pick<HeroRecord, 'dispatch'>, nowMs: number): number {
  if (!rec.dispatch) return 0;
  return Math.max(0, (stampMs(rec.dispatch.endsAt) - nowMs) / 1000);
}
export function dispatchFraction(rec: Pick<HeroRecord, 'dispatch'>, nowMs: number): number {
  if (!rec.dispatch || rec.dispatch.minutes <= 0) return 0;
  return 1 - Math.min(1, dispatchLeft(rec, nowMs) / (rec.dispatch.minutes * 60));
}
export function dispatchBusy(roster: Partial<Record<HeroId, HeroRecord>>): number {
  let n = 0;
  for (const h of HERO_LIST) if (roster[h]?.status === 'dispatch') n++;
  return n;
}
export function minutesLabel(min: number): string { return min >= 60 ? `${Math.round(min / 60)}h` : `${min}m`; }

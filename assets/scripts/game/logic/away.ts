// "While you were away" panel content (no 'cc'). SPEC §2.3 / §10.5: one row per source — villagers' production, each
// returning scout trip, new bounties, the traveler, warmth change — plus the away duration in the title.
import type { AwaySummary, Cost, HeroId, ResKey } from '../../core/api';
import { abbrev, costParts, fmtDuration, resIcon } from './format';

export interface AwayRow { icon: string; key: string; params: Record<string, string | number>; items: Array<{ icon: string; text: string }> }

/** Minimum absence that shows the panel (§2.3). */
export const AWAY_MIN_SEC = 5 * 60;

function items(c: Cost | null | undefined, shards?: Partial<Record<HeroId, number>>): Array<{ icon: string; text: string }> {
  const out = costParts(c).map((p) => ({ icon: resIcon(p.res as ResKey), text: `+${abbrev(p.amount)}` }));
  if (shards) for (const h of Object.keys(shards) as HeroId[]) {
    const n = shards[h] ?? 0;
    if (n > 0) out.push({ icon: `portrait_${h}`, text: `+${n}` });
  }
  return out;
}

export function awayTitle(a: Pick<AwaySummary, 'seconds'>): { key: string; params: Record<string, string> } {
  return { key: 'away.title', params: { t: fmtDuration(a.seconds) } };
}

export function awayRows(a: AwaySummary): AwayRow[] {
  const rows: AwayRow[] = [];
  const prod = items(a.produced);
  if (prod.length) rows.push({ icon: 'icon_workers', key: 'away.villagers', params: {}, items: prod });
  for (const d of a.dispatches ?? []) {
    rows.push({ icon: `portrait_${d.hero}`, key: `away.dispatch.${d.kind}`, params: { hero: d.hero }, items: items(d.loot, d.shards) });
  }
  if (a.newBounties > 0) rows.push({ icon: 'icon_bounty', key: 'away.bounties', params: { n: a.newBounties }, items: [] });
  if (a.traveler) rows.push({ icon: 'icon_market', key: 'away.traveler', params: {}, items: [] });
  if (a.warmthDelta) {
    rows.push({ icon: a.warmthDelta > 0 ? 'icon_warmth' : 'icon_warmth_off', key: a.warmthDelta > 0 ? 'away.warmthUp' : 'away.warmthDown',
      params: { n: Math.abs(a.warmthDelta) }, items: [] });
  }
  if (!rows.length) rows.push({ icon: 'icon_clock', key: 'away.quiet', params: {}, items: [] });
  return rows;
}

/** Resource keys whose icons fly to the HUD on "Collect all" (production + dispatch loot). */
export function awayFlyRes(a: AwaySummary): ResKey[] {
  const set = new Set<ResKey>();
  for (const p of costParts(a.produced)) set.add(p.res);
  for (const d of a.dispatches ?? []) for (const p of costParts(d.loot)) set.add(p.res);
  return [...set];
}

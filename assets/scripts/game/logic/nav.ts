// Navigation rules (no 'cc'): which bottom-bar tabs / panel sections exist right now (SPEC §2.7: hidden until the
// system is unlocked — not greyed), and where a "Next goal" line leads when tapped (§2.5).
import type { GameState, Phase, UnlockKey } from '../../core/api';

export type TabId = 'build' | 'hero' | 'village' | 'book' | 'map';
export const TAB_ORDER: TabId[] = ['build', 'hero', 'village', 'book', 'map'];
export const TAB_ICON: Record<TabId, string> = {
  build: 'icon_hammer', hero: 'icon_hero', village: 'icon_village', book: 'icon_book', map: 'icon_map',
};

type Unl = readonly UnlockKey[] | readonly string[];
const has = (u: Unl, k: string) => (u as readonly string[]).includes(k);
const any = (u: Unl, pred: (k: string) => boolean) => (u as readonly string[]).some(pred);

/** Unlock test for each tab (documented in docs/DECISIONS.md). */
export function tabUnlocked(tab: TabId, u: Unl): boolean {
  switch (tab) {
    case 'build': return true;
    // second hero (session 1 cage) or any hero system
    case 'hero': return any(u, (k) => k.startsWith('hero_')) || has(u, 'garrison') || has(u, 'dispatch');
    case 'village': return has(u, 'house') || has(u, 'farm') || has(u, 'storehouse');
    case 'book': return has(u, 'bounties') || has(u, 'chronicle');
    case 'map': return has(u, 'dock') || any(u, (k) => /^region_\d+$/.test(k) && k !== 'region_1');
  }
}

/**
 * Bottom-bar tabs for the current phase. PEACE: every unlocked tab. NIGHT: the bar collapses to Build only (the
 * Horn sits next to it). DUSK: Build + Hero (squad / garrison changes are allowed at dusk). DAWN / expedition: none.
 */
export function bottomTabs(u: Unl, phase: Phase, expedition: boolean): TabId[] {
  if (expedition || phase === 'dawn') return [];
  if (phase === 'night') return ['build'];
  const open = TAB_ORDER.filter((t) => tabUnlocked(t, u));
  return phase === 'dusk' ? open.filter((t) => t === 'build' || t === 'hero') : open;
}

export type VillageSection = 'people' | 'storage' | 'forge' | 'study' | 'market';
export function villageSections(u: Unl): VillageSection[] {
  const out: VillageSection[] = ['people', 'storage'];
  if (has(u, 'forge')) out.push('forge');
  if (has(u, 'research') || has(u, 'study')) out.push('study');
  if (has(u, 'market') || has(u, 'tavern')) out.push('market');
  return out;
}
export type BookSection = 'bounties' | 'chronicle' | 'gloom' | 'achievements' | 'cosmetics';
export function bookSections(u: Unl): BookSection[] {
  const out: BookSection[] = [];
  if (has(u, 'bounties')) out.push('bounties');
  if (has(u, 'chronicle')) out.push('chronicle');
  out.push('gloom', 'achievements', 'cosmetics');
  return out;
}
export type HeroSection = 'roster' | 'squad';

/** Where tapping a next-goal line leads. Goal strings are i18n keys (optionally `key|a=1|b=x`) from core. */
export type GoalTarget = { tab: TabId; section?: string } | { screen: 'dock' | 'storage' | 'hearth' } | { world: 'bell' | 'heart' | 'explore' };
export function goalTarget(goal: string): GoalTarget {
  const k = goal.split('|')[0].toLowerCase();
  const m = (re: RegExp) => re.test(k);
  if (m(/hearth|tier/)) return { screen: 'hearth' };
  if (m(/expedition|dock|island|trail/)) return { screen: 'dock' };
  if (m(/bounty|bounties/)) return { tab: 'book', section: 'bounties' };
  if (m(/chronicle|deed|week/)) return { tab: 'book', section: 'chronicle' };
  if (m(/achiev|gloombook|cosmetic/)) return { tab: 'book', section: 'achievements' };
  if (m(/hero|star|shard|skill|gear|equip|garrison|dispatch|scout_trip|squad/)) return { tab: 'hero' };
  if (m(/research|lore|study/)) return { tab: 'village', section: 'study' };
  if (m(/forge|craft|module/)) return { tab: 'village', section: 'forge' };
  if (m(/market|trade|traveler|tavern|recruit/)) return { tab: 'village', section: 'market' };
  if (m(/(^|\.)build\b|wall|tower|brazier|place/)) return { tab: 'build' };
  if (m(/villager|worker|food|farm|house|storage|vault/)) return { tab: 'village', section: 'people' };
  if (m(/heart|siege|seal|region/)) return { world: 'heart' };
  if (m(/night|beacon|threat|dusk|bell/)) return { world: 'bell' };
  if (m(/upgrade/)) return { tab: 'build' };
  if (m(/map|explore|camp|cage|ruin|fog/)) return { tab: 'map' };
  return { world: 'explore' };
}

/** Split a goal string `key|a=1|b=two` into key + params. */
export function parseGoal(goal: string): { key: string; params: Record<string, string> } {
  const [key, ...rest] = goal.split('|');
  const params: Record<string, string> = {};
  for (const p of rest) { const i = p.indexOf('='); if (i > 0) params[p.slice(0, i)] = p.slice(i + 1); }
  return { key, params };
}

/** Modal precedence: which overlay owns the screen right now (highest first). */
export type Overlay = 'gutter' | 'expResult' | 'gifts' | 'away' | 'none';
export function activeOverlay(s: Pick<GameState, 'phase' | 'gifts' | 'away' | 'lossReport' | 'expedition'>, gutterOpen: boolean): Overlay {
  if (gutterOpen && s.lossReport) return 'gutter';
  if (s.expedition && s.expedition.result) return 'expResult';
  if (s.gifts && s.gifts.length) return 'gifts';
  if (s.away) return 'away';
  return 'none';
}

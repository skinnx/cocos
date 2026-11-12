// SPEC §11.2/§11.3 meta progression helpers (Barracks screen). All functions mutate the given MetaState
// and return whether the purchase/action succeeded; the view persists meta afterwards (key emberhold.meta.v1).
import type { BuildingId, HeroId, MetaState } from '../api';
import { BUILDINGS } from '../data/buildings';
import { HEROES, HERO_IDS } from '../data/heroes';
import { TALENTS, TALENT_BY_ID, type TalentId } from '../data/talents';

export const META_KEY = 'emberhold.meta.v1';
export const RUN_KEY = 'emberhold.run.v1';

export function defaultMeta(): MetaState {
  return {
    version: 1, ember: 0, unlockedHeroes: ['knight'], unlockedBlueprints: [], talents: {}, tutorialDone: false, starterHero: 'knight',
    settings: { music: 0.7, sfx: 0.8, haptics: true, bigText: false, lang: 'en' },
  };
}

/** Parse saved meta; corrupt/foreign data → defaults (never throws). */
export function loadMeta(json: string | null): MetaState {
  const d = defaultMeta();
  if (!json) return d;
  try {
    const o = JSON.parse(json);
    if (!o || typeof o !== 'object' || o.version !== 1) return d;
    const heroes = Array.isArray(o.unlockedHeroes) ? o.unlockedHeroes.filter((h: unknown) => HERO_IDS.includes(h as HeroId)) : d.unlockedHeroes;
    if (!heroes.includes('knight')) heroes.unshift('knight');
    const bps = Array.isArray(o.unlockedBlueprints) ? o.unlockedBlueprints.filter((b: unknown) => typeof b === 'string' && b in BUILDINGS && BUILDINGS[b as BuildingId].should) : [];
    const talents: Record<string, number> = {};
    if (o.talents && typeof o.talents === 'object') for (const t of TALENTS) { const v = Number(o.talents[t.id]); if (v > 0) talents[t.id] = Math.min(t.maxLevel, Math.floor(v)); }
    const s = o.settings ?? {};
    const num = (v: unknown, def: number) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : def);
    return {
      version: 1,
      ember: typeof o.ember === 'number' && isFinite(o.ember) ? Math.max(0, Math.floor(o.ember)) : 0,
      unlockedHeroes: heroes, unlockedBlueprints: bps, talents,
      tutorialDone: !!o.tutorialDone,
      starterHero: heroes.includes(o.starterHero) ? o.starterHero : 'knight',
      settings: { music: num(s.music, d.settings.music), sfx: num(s.sfx, d.settings.sfx), haptics: s.haptics !== false, bigText: !!s.bigText, lang: s.lang === 'vi' ? 'vi' : 'en' },
    };
  } catch { return d; }
}

export function saveMeta(meta: MetaState): string { return JSON.stringify(meta); }

export function heroUnlockCost(id: HeroId): number { return HEROES[id].unlockEmber; }
export function unlockHero(meta: MetaState, id: HeroId): boolean {
  if (meta.unlockedHeroes.includes(id)) return false;
  const c = heroUnlockCost(id);
  if (meta.ember < c) return false;
  meta.ember -= c; meta.unlockedHeroes.push(id);
  return true;
}
export function setStarterHero(meta: MetaState, id: HeroId): boolean {
  if (!meta.unlockedHeroes.includes(id)) return false;
  meta.starterHero = id; return true;
}

export function blueprintCost(id: BuildingId): number { return BUILDINGS[id].blueprintCost; }
export function buyBlueprint(meta: MetaState, id: BuildingId): boolean {
  const d = BUILDINGS[id];
  if (!d.should || meta.unlockedBlueprints.includes(id) || meta.ember < d.blueprintCost) return false;
  meta.ember -= d.blueprintCost; meta.unlockedBlueprints.push(id);
  return true;
}

export function talentLevel(meta: MetaState, id: TalentId): number { return meta.talents[id] ?? 0; }
/** Cost of the next level, or null when maxed. */
export function talentCost(meta: MetaState, id: TalentId): number | null {
  const t = TALENT_BY_ID[id]; const lv = talentLevel(meta, id);
  return lv >= t.maxLevel ? null : t.costs[lv];
}
export function buyTalent(meta: MetaState, id: TalentId): boolean {
  const c = talentCost(meta, id);
  if (c === null || meta.ember < c) return false;
  meta.ember -= c; meta.talents[id] = talentLevel(meta, id) + 1;
  return true;
}

/** Ember formula (§11.2). */
export function emberFor(stats: { nightsSurvived: number; bosses: number; camps: number }, victory: boolean): number {
  return 10 * stats.nightsSurvived + 50 * stats.bosses + 5 * stats.camps + (victory ? 100 : 0);
}

/** Bank the Ember of a finished run into meta (call once on Victory/Defeat). Returns the amount added. */
export function applyRunEmber(meta: MetaState, amount: number): number {
  const a = Math.max(0, Math.floor(amount));
  meta.ember += a;
  return a;
}

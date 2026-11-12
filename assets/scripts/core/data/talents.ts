// SPEC §11.2 — 8 talents × 3 levels (cost 30/60/120 Ember per level).
export type TalentId = 'startWood' | 'startStone' | 'hearthHp' | 'longDay' | 'heroLevel' | 'refund' | 'chestChoice' | 'hornPrecharge';

export interface TalentDef { id: TalentId; maxLevel: number; costs: [number, number, number]; perLevel: number }

export const TALENTS: TalentDef[] = [
  { id: 'startWood', maxLevel: 3, costs: [30, 60, 120], perLevel: 20 },      // +20 starting wood / level
  { id: 'startStone', maxLevel: 3, costs: [30, 60, 120], perLevel: 15 },     // +15 starting stone / level
  { id: 'hearthHp', maxLevel: 3, costs: [30, 60, 120], perLevel: 0.1 },      // +10% hearth HP / level
  { id: 'longDay', maxLevel: 3, costs: [30, 60, 120], perLevel: 8 },         // +8 s day / level
  { id: 'heroLevel', maxLevel: 3, costs: [30, 60, 120], perLevel: 1 },       // starting hero +1 level / level
  { id: 'refund', maxLevel: 3, costs: [30, 60, 120], perLevel: 0.1 },        // +10% sell refund / level
  { id: 'chestChoice', maxLevel: 3, costs: [30, 60, 120], perLevel: 1 },     // +1 chest boon choice / level
  { id: 'hornPrecharge', maxLevel: 3, costs: [30, 60, 120], perLevel: 0.5 }, // horn starts 50% / 75% / 100% charged
];

export const TALENT_BY_ID: Record<TalentId, TalentDef> = Object.fromEntries(TALENTS.map((t) => [t.id, t])) as Record<TalentId, TalentDef>;

export function hornPrecharge(level: number): number {
  return level <= 0 ? 0 : level === 1 ? 0.5 : level === 2 ? 0.75 : 1;
}

// SPEC §11.1 — 24 boons. Ids MUST match tools/art/manifest.mjs BOON_IDS (icon `boon_<id>`).
export type BoonId =
  | 'sharp' | 'thick' | 'swift' | 'leech' | 'horn' | 'ally' | 'cooldown' | 'twin'
  | 'mason' | 'boulder' | 'hawk' | 'reload' | 'spikes' | 'harvest' | 'thorns' | 'living'
  | 'bigfire' | 'embers' | 'ash' | 'farlight' | 'mirror' | 'spread' | 'rebirth' | 'falsedawn';

export interface BoonDef { id: BoonId; group: 'squad' | 'fort' | 'flame'; rarity: 'common' | 'rare' | 'legendary'; maxStacks: number }

const B = (id: BoonId, group: BoonDef['group'], rarity: BoonDef['rarity'], maxStacks = 1): BoonDef => ({ id, group, rarity, maxStacks });

export const BOONS: BoonDef[] = [
  B('sharp', 'squad', 'common', 3), B('thick', 'squad', 'common', 3), B('swift', 'squad', 'common', 2), B('leech', 'squad', 'common'),
  B('horn', 'squad', 'common'), B('ally', 'squad', 'rare'), B('cooldown', 'squad', 'rare'), B('twin', 'squad', 'legendary'),
  B('mason', 'fort', 'common', 2), B('boulder', 'fort', 'common', 3), B('hawk', 'fort', 'common', 2), B('reload', 'fort', 'common', 3),
  B('spikes', 'fort', 'common', 2), B('harvest', 'fort', 'common'), B('thorns', 'fort', 'rare'), B('living', 'fort', 'legendary'),
  B('bigfire', 'flame', 'common', 3), B('embers', 'flame', 'common'), B('ash', 'flame', 'common', 3), B('farlight', 'flame', 'common'),
  B('mirror', 'flame', 'common'), B('spread', 'flame', 'rare'), B('rebirth', 'flame', 'rare'), B('falsedawn', 'flame', 'legendary'),
];

export const BOON_BY_ID: Record<BoonId, BoonDef> = Object.fromEntries(BOONS.map((b) => [b.id, b])) as Record<BoonId, BoonDef>;

/** Effect magnitudes (per stack where stackable). */
export const BOON_FX = {
  sharp: 0.15, thick: 0.2, swift: 0.15, leech: 0.08, hornSecs: 10, cooldown: 0.75,
  mason: 0.25, boulder: 0.3, hawk: 1, reload: 0.15, spikes: 4, harvest: 0.5, thorns: 4, living: 0.01,
  bigfire: 1, ash: 1, farlight: 5, mirror: 0.2, spreadRange: 1.2, rebirth: 2, falseDawnAt: 0.25, falseDawnSecs: 8, falseDawnStun: 3,
};

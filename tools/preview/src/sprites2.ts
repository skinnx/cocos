// v2 sprite-name selection for the preview (names verbatim from tools/art/manifest.mjs, v2 block). v1 entities keep
// using the client's pure helpers (game/logic/sprites.ts); this file only adds what v2 introduced.
import type { BuildingState, EnemyState, HeroUnit, NodeKind, PoiState, ResourceNode, Villager, Beacon } from './core';
import { animFrame, ANIM_FPS, buildingSprites, enemySprite, heroSprite, nodeSprite, poiSprite } from './shared';

const STONE_IDS = new Set(['wall_stone', 'wall_ember', 'tower_arrow', 'tower_ballista', 'tower_frost', 'tower_mortar', 'tower_spark',
  'quarry', 'storehouse', 'vault', 'forge', 'study', 'watchtower', 'dawn_shrine', 'hearth', 'brazier', 'market', 'barracks', 'workshop']);

export function hearthSprite(tier: number, t: number): string {
  const f = animFrame(t, ANIM_FPS.building, 4);
  return tier <= 3 ? `bld_hearth_l${Math.max(1, tier)}_${f}` : `bld_hearth_t${Math.min(10, tier)}_${f}`;
}

/** Rubble left by a broken building (SPEC §6.6). */
export function rubbleSprite(b: Pick<BuildingState, 'id' | 'w'>): string {
  if (b.w <= 1) return 'prop_rubble_1';
  return STONE_IDS.has(b.id) ? 'prop_rubble_2_stone' : 'prop_rubble_2_wood';
}

export function building2(b: BuildingState, t: number, o: { hearthTier: number; wallSkin?: string }): { base: string; head?: string } {
  const f4 = animFrame(t, ANIM_FPS.building, 4);
  if (b.id === 'hearth') return { base: hearthSprite(o.hearthTier, t) };
  if (b.id === 'wall_ember') return { base: `bld_wall_ember_${b.wallMask & 15}` };
  if ((b.id === 'wall_wood' || b.id === 'wall_stone') && o.wallSkin && o.wallSkin !== 'default' && o.wallSkin !== 'none')
    return { base: `skin_${o.wallSkin}_${b.id === 'wall_wood' ? 'wood' : 'stone'}_${b.wallMask & 15}` };
  if (b.id === 'brazier' && b.level >= 3) return { base: b.lit ? `bld_brazier_l3_${f4}` : 'bld_brazier_l2_off' };
  if (b.id === 'dawn_shrine') return { base: 'bld_dawn_shrine_l1' };
  if (b.id === 'watchtower') return { base: `bld_watchtower_l${Math.min(2, b.level)}` };
  if (b.id.startsWith('decor_')) return { base: `bld_${b.id}` };
  return buildingSprites(b, t);
}

export function beaconFlame(beacon: Beacon, t: number): string { return `bld_beacon_${beacon}_${animFrame(t, ANIM_FPS.building, 3)}`; }

const NEW_HEROES = new Set(['beast', 'warden', 'shade', 'bomb']);
export function hero2(h: HeroUnit): string {
  if (!NEW_HEROES.has(h.id)) return heroSprite(h as never);
  switch (h.anim) {
    case 'down': return `hero_${h.id}_down`;
    case 'attack': case 'cast': return `hero_${h.id}_attack_${animFrame(h.animT, ANIM_FPS.attack, 3, false)}`;
    case 'move': return `hero_${h.id}_walk_${animFrame(h.animT, ANIM_FPS.walk, 4)}`;
    default: return `hero_${h.id}_idle_${animFrame(h.animT, ANIM_FPS.idle, 2)}`;
  }
}
export function garrisonSprite(id: string, t: number): string { return `garrison_${id}_${animFrame(t, ANIM_FPS.idle, 2)}`; }

const NEW_ENEMIES = new Set(['burrower', 'shrieker', 'hurler', 'frostwraith', 'cinderling', 'champion']);
const NEW_BOSSES: Record<string, [string, string]> = { briarqueen: ['walk', 'cast'], colossus: ['walk', 'throw'], rimefather: ['walk', 'cast'] };
export function enemy2(e: EnemyState): string {
  const nb = NEW_BOSSES[e.id];
  if (nb) {
    if (e.anim === 'attack' || e.anim === 'cast') return `boss_${e.id}_${nb[1]}_${animFrame(e.animT, ANIM_FPS.attack * 0.6, 2, false)}`;
    return `boss_${e.id}_${nb[0]}_${animFrame(e.animT, ANIM_FPS.walk * 0.6, 4)}`;
  }
  if (e.id === 'burrower' && e.anim === 'burrow') return `enemy_burrower_mound_${animFrame(e.animT, ANIM_FPS.walk, 2)}`;
  if (NEW_ENEMIES.has(e.id)) {
    if (e.anim === 'attack') return `enemy_${e.id}_attack_${animFrame(e.animT, ANIM_FPS.attack * 0.6, 2, false)}`;
    return `enemy_${e.id}_move_${animFrame(e.animT, e.anim === 'move' ? ANIM_FPS.walk : ANIM_FPS.idle, 4)}`;
  }
  return enemySprite(e as never);
}
export function isBoss2(id: string): boolean { return id === 'mossback' || id === 'unlit' || id in NEW_BOSSES; }
export function bossPortrait(id: string): string {
  if (id === 'mossback') return 'boss_mossback_walk_0';
  if (id === 'unlit') return 'boss_unlit_float_0';
  if (id in NEW_BOSSES) return `boss_${id}_walk_0`;
  return `enemy_${id}_move_0`;
}

export function allySprite(u: { id: string; anim: string; animT: number }): string {
  if (u.id === 'wolf') return u.anim === 'attack' ? `ally_wolf_attack_${animFrame(u.animT, ANIM_FPS.attack * 0.6, 2, false)}` : `ally_wolf_move_${animFrame(u.animT, ANIM_FPS.walk, 4)}`;
  if (u.id === 'turret') return 'turret_mini';
  return enemySprite({ id: 'militia', anim: u.anim, animT: u.animT } as never);
}

const JOB_ANIM: Record<string, string> = { lumber_camp: 'chop', quarry: 'mine', farm: 'farm', forge: 'forge', study: 'read', market: 'sell' };
export function villagerSprite(v: Villager, jobId: string | null): string {
  const k = v.variant;
  if (v.anim === 'flee') return `villager_${k}_flee_${animFrame(v.animT, ANIM_FPS.walk, 2)}`;
  if (v.anim === 'work' && jobId && JOB_ANIM[jobId]) return `villager_${k}_${JOB_ANIM[jobId]}_${animFrame(v.animT, ANIM_FPS.idle * 1.5, 2)}`;
  if (v.anim === 'move') return `villager_${k}_walk_${animFrame(v.animT, ANIM_FPS.walk * 0.75, 4)}`;
  return `villager_${k}_walk_0`;
}

const NODE2: Partial<Record<NodeKind, [number, string]>> = { snowpine: [2, 'snowpine'], deadtree: [2, 'deadtree'], resin: [2, 'resin'], frost: [2, 'frost'], coal: [2, 'coal'] };
export function node2(n: ResourceNode): string | null {
  const v = NODE2[n.kind];
  if (!v) return nodeSprite(n as never);
  if (n.hp <= 0) {
    if (n.kind === 'snowpine' || n.kind === 'deadtree') return 'prop_stump';
    return `prop_${v[1]}_spent`;
  }
  return `prop_${v[1]}_${n.uid % v[0]}`;
}

export function poi2(p: PoiState, t: number): string | null {
  if (p.kind === 'heart') {
    if (p.data && (p.data as Record<string, unknown>).sealed) return 'prop_heart_sealed';
    return p.active ? `prop_heart_awake_${animFrame(t, ANIM_FPS.rift, 4)}` : `prop_heart_sleep_${animFrame(t, ANIM_FPS.idle, 2)}`;
  }
  if (p.kind === 'ruin') return p.active ? 'prop_ruin_old' : 'prop_ruin_old_looted';
  if (p.kind === 'chest' && p.data && (p.data as Record<string, unknown>).expedition) return p.active ? 'prop_exp_chest_closed' : 'prop_exp_chest_open';
  return poiSprite(p as never, t);
}

export function projectile2(kind: string): string | null {
  if (kind === 'javelin' || kind === 'bomb' || kind === 'boulder' || kind === 'barrel') return `proj_${kind}`;
  return null;
}

/** Icon for a resource key (HUD / costs). */
export function resIcon(k: string): string {
  if (k === 'deeds') return 'icon_chronicle';
  if (k === 'shards') return 'icon_shard';
  return `icon_${k}`;
}

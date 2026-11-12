// Pure sprite-name selection for game entities (no 'cc'). Names are verbatim from tools/art/manifest.mjs (v1 + v2).
import type {
  AllyState, Beacon, BuildingState, EnemyState, HeroUnit, NodeKind, PoiState, ProjectileState, ResourceNode, Unit, Villager, ZoneState,
} from '../../core/api';

export const ANIM_FPS = { idle: 3, walk: 8, attack: 10, building: 6, fx: 12, water: 1.5, rift: 6, work: 4 } as const;

/** Frame index from an animation clock; `loop=false` clamps on the last frame. */
export function animFrame(t: number, fps: number, count: number, loop = true): number {
  if (count <= 1) return 0;
  const f = Math.floor(Math.max(0, t) * fps);
  return loop ? f % count : Math.min(count - 1, f);
}

export function heroSprite(h: Pick<HeroUnit, 'id' | 'anim' | 'animT'>): string {
  switch (h.anim) {
    case 'down': return `hero_${h.id}_down`;
    case 'attack': case 'cast': return `hero_${h.id}_attack_${animFrame(h.animT, ANIM_FPS.attack, 3, false)}`;
    case 'move': case 'flee': return `hero_${h.id}_walk_${animFrame(h.animT, ANIM_FPS.walk, 4)}`;
    default: return `hero_${h.id}_idle_${animFrame(h.animT, ANIM_FPS.idle, 2)}`;
  }
}

export const BOSSES = ['mossback', 'briarqueen', 'colossus', 'rimefather', 'unlit'] as const;
export function isBoss(id: string): boolean { return (BOSSES as readonly string[]).includes(id); }
/** Big units that read their HP from the HUD boss bar instead of a bar over their head. */
export function usesBossBar(id: string): boolean { return isBoss(id) || id === 'champion'; }

/** Sprite for an enemy, boss or the Blood-Moon champion. */
export function enemySprite(e: Pick<EnemyState, 'anim' | 'animT'> & { id: string }): string {
  const id = e.id;
  const atk = e.anim === 'attack' || e.anim === 'cast';
  switch (id) {
    case 'mossback':
      if (e.anim === 'shell' || e.anim === 'idle' || e.anim === 'attack') return `boss_mossback_shell_${animFrame(e.animT, ANIM_FPS.idle * 2, 2)}`;
      return `boss_mossback_walk_${animFrame(e.animT, ANIM_FPS.walk * 0.6, 4)}`;
    case 'unlit':
      return atk ? `boss_unlit_cast_${animFrame(e.animT, ANIM_FPS.attack * 0.6, 2, false)}` : `boss_unlit_float_${animFrame(e.animT, ANIM_FPS.walk * 0.6, 4)}`;
    case 'briarqueen':
      return atk ? `boss_briarqueen_cast_${animFrame(e.animT, ANIM_FPS.attack * 0.6, 2, false)}` : `boss_briarqueen_walk_${animFrame(e.animT, ANIM_FPS.walk * 0.6, 4)}`;
    case 'colossus':
      return atk ? `boss_colossus_throw_${animFrame(e.animT, ANIM_FPS.attack * 0.5, 2, false)}` : `boss_colossus_walk_${animFrame(e.animT, ANIM_FPS.walk * 0.5, 4)}`;
    case 'rimefather':
      return atk ? `boss_rimefather_cast_${animFrame(e.animT, ANIM_FPS.attack * 0.6, 2, false)}` : `boss_rimefather_walk_${animFrame(e.animT, ANIM_FPS.walk * 0.6, 4)}`;
    case 'turret': return 'turret_mini';
  }
  if (id === 'burrower' && e.anim === 'burrow') return `enemy_burrower_mound_${animFrame(e.animT, ANIM_FPS.walk * 0.5, 2)}`;
  if (atk) return `enemy_${id}_attack_${animFrame(e.animT, ANIM_FPS.attack * 0.6, 2, false)}`;
  const fps = e.anim === 'move' ? ANIM_FPS.walk : ANIM_FPS.idle;
  return `enemy_${id}_move_${animFrame(e.animT, fps, 4)}`;
}

/** Champion skill aura overlay (Blood Moon, §8.4). */
export function championAura(skill: EnemyState['championSkill'], t: number): string | null {
  return skill ? `champion_${skill}_${animFrame(t, ANIM_FPS.idle * 2, 2)}` : null;
}

export function allySprite(a: Pick<AllyState, 'id' | 'anim' | 'animT'>): string {
  if (a.id === 'turret') return 'turret_mini';
  const atk = a.anim === 'attack';
  if (a.id === 'wolf') {
    return atk ? `ally_wolf_attack_${animFrame(a.animT, ANIM_FPS.attack * 0.6, 2, false)}`
      : `ally_wolf_move_${animFrame(a.animT, a.anim === 'move' ? ANIM_FPS.walk : ANIM_FPS.idle, 4)}`;
  }
  return atk ? `enemy_militia_attack_${animFrame(a.animT, ANIM_FPS.attack * 0.6, 2, false)}`
    : `enemy_militia_move_${animFrame(a.animT, a.anim === 'move' ? ANIM_FPS.walk : ANIM_FPS.idle, 4)}`;
}

export type JobKind = 'chop' | 'mine' | 'farm' | 'forge' | 'read' | 'sell';
export function jobKindOf(buildingId: string | null | undefined): JobKind | null {
  switch (buildingId) {
    case 'lumber_camp': return 'chop';
    case 'quarry': return 'mine';
    case 'farm': return 'farm';
    case 'forge': return 'forge';
    case 'study': return 'read';
    case 'market': return 'sell';
    default: return null;
  }
}
/** Villager frame (§11.3): walk 4, work 2 per job, flee 2. Idle villagers stand on walk frame 0. */
export function villagerSprite(v: Pick<Villager, 'variant' | 'anim' | 'animT'>, job: JobKind | null): string {
  const k = ((v.variant | 0) % 4 + 4) % 4;
  switch (v.anim) {
    case 'flee': return `villager_${k}_flee_${animFrame(v.animT, ANIM_FPS.walk * 1.25, 2)}`;
    case 'work': case 'attack': return job ? `villager_${k}_${job}_${animFrame(v.animT, ANIM_FPS.work, 2)}` : `villager_${k}_walk_0`;
    case 'move': return `villager_${k}_walk_${animFrame(v.animT, ANIM_FPS.walk, 4)}`;
    default: return `villager_${k}_walk_0`;
  }
}

/** Gate orientation from the wall-connection mask (N1 E2 S4 W8): walls east/west → horizontal gate. */
export function gateOrientation(mask: number): 'h' | 'v' {
  const ew = (mask & 2) || (mask & 8), ns = (mask & 1) || (mask & 4);
  if (ns && !ew) return 'v';
  return 'h';
}

/** 8-direction index for the ballista head (0 = east, counter-clockwise on screen) from a core angle (y down). */
export function dir8(angleCore: number): number {
  const i = Math.round(-angleCore / (Math.PI / 4));
  return ((i % 8) + 8) % 8;
}

export const WALL_SKINS = ['moss', 'frost', 'gilded'] as const;
export interface BuildingLook { hearthTier: number; wallSkin: string }
export interface BuildingSprites { base: string; head?: string }

/** Hearth body for a tier 1..10 (tiers 1-3 reuse the v1 level art). */
export function hearthSprite(tier: number, f4: number): string {
  const t = Math.max(1, Math.min(10, Math.round(tier) || 1));
  return t <= 3 ? `bld_hearth_l${t}_${f4}` : `bld_hearth_t${t}_${f4}`;
}

export function rubbleSprite(b: Pick<BuildingState, 'w' | 'h'>, stone: boolean): string {
  return b.w >= 2 || b.h >= 2 ? (stone ? 'prop_rubble_2_stone' : 'prop_rubble_2_wood') : 'prop_rubble_1';
}

export function buildingSprites(b: Pick<BuildingState, 'id' | 'level' | 'lit' | 'open' | 'charges' | 'aimAngle' | 'wallMask'>, t: number,
  look: BuildingLook = { hearthTier: 1, wallSkin: '' }): BuildingSprites {
  const lv = Math.max(1, b.level);
  const f4 = animFrame(t, ANIM_FPS.building, 4);
  const skin = (WALL_SKINS as readonly string[]).includes(look.wallSkin) ? look.wallSkin : '';
  switch (b.id) {
    case 'hearth': return { base: hearthSprite(look.hearthTier || lv, f4) };
    case 'wall_wood': return { base: skin ? `skin_${skin}_wood_${b.wallMask & 15}` : `bld_wall_wood_${b.wallMask & 15}` };
    case 'wall_stone': return { base: skin ? `skin_${skin}_stone_${b.wallMask & 15}` : `bld_wall_stone_${b.wallMask & 15}` };
    case 'wall_ember': return { base: `bld_wall_ember_${b.wallMask & 15}` };
    case 'gate': return { base: `bld_gate_${gateOrientation(b.wallMask)}_${b.open ? 'open' : 'closed'}` };
    case 'brazier': {
      const l = Math.min(3, lv);
      return { base: b.lit ? `bld_brazier_l${l}_${f4}` : `bld_brazier_l${Math.min(2, l)}_off` };
    }
    case 'tower_ballista': return { base: `bld_tower_ballista_l${Math.min(3, lv)}_base`, head: `bld_ballista_head_${dir8(b.aimAngle)}` };
    case 'tower_frost': case 'tower_spark': return { base: `bld_${b.id}_l${Math.min(3, lv)}_${f4}` };
    case 'trap_spikes': return { base: `bld_trap_spikes_l${Math.min(2, lv)}_${b.charges > 0 ? 'up' : 'down'}` };
    case 'trap_tar': return { base: b.lit ? `bld_trap_tar_burning_${animFrame(t, ANIM_FPS.building * 1.5, 3)}` : 'bld_trap_tar' };
    case 'tavern': return { base: 'bld_tavern_l1' };
    case 'dawn_shrine': return { base: 'bld_dawn_shrine_l1' };
    case 'watchtower': return { base: `bld_watchtower_l${Math.min(2, lv)}` };
    default:
      if (b.id.startsWith('decor_')) return { base: `bld_${b.id}` };
      return { base: `bld_${b.id}_l${Math.min(3, lv)}` };
  }
}

/** Beacon flame atop the Hearth (§8.3), shown from dusk through the night. */
export function beaconFlame(beacon: Beacon, t: number): string { return `bld_beacon_${beacon}_${animFrame(t, ANIM_FPS.building, 3)}`; }
export const FLAME_COSMETICS = ['ember', 'azure', 'verdant', 'violet', 'gold'] as const;
/** Cosmetic Hearth flame (§11.11); null for the default look. */
export function hearthFlame(flame: string, t: number): string | null {
  return (FLAME_COSMETICS as readonly string[]).includes(flame) ? `hearth_flame_${flame}_${animFrame(t, ANIM_FPS.building, 4)}` : null;
}
/** Banner cosmetic index 0..7 from its id ("banner_3", "3" or any string). */
export function bannerIndex(id: string): number {
  const m = /(\d+)/.exec(id ?? '');
  if (m) return Math.max(0, Math.min(7, Number(m[1])));
  let h = 0;
  for (const c of id ?? '') h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 8;
}
export function bannerSprite(id: string, t: number): string { return `banner_${bannerIndex(id)}_${animFrame(t, ANIM_FPS.idle, 2)}`; }
export function garrisonSprite(hero: string, t: number): string { return `garrison_${hero}_${animFrame(t, ANIM_FPS.idle, 2)}`; }
export function moduleSprite(m: string): string { return `bld_module_${m}`; }

/** Status overlays of a building, back to front: frozen (2 levels) and burning. */
export function buildingStatus(b: Pick<BuildingState, 'frozenT' | 'burningT'>, t: number): string[] {
  const out: string[] = [];
  if (b.frozenT > 0) out.push(b.frozenT >= 1.5 ? 'bld_frozen_2' : 'bld_frozen_1');
  if (b.burningT > 0) out.push(`bld_burning_${animFrame(t, ANIM_FPS.fx, 3)}`);
  return out;
}

/** Traps and farms are drawn flat on the floor layer (under units), everything else is y-sorted. */
export function isFloorBuilding(id: string): boolean { return id === 'trap_spikes' || id === 'trap_tar'; }

const VARIANTS: Partial<Record<NodeKind, number>> = { pine: 2, oak: 2, bush: 2, ore: 2, snowpine: 2, deadtree: 2, resin: 2, frost: 2, coal: 2 };
const TREES: NodeKind[] = ['pine', 'oak', 'snowpine', 'deadtree', 'stump'];
export function nodeSprite(n: Pick<ResourceNode, 'uid' | 'kind' | 'hp'>): string | null {
  if (n.hp <= 0) {
    if (TREES.includes(n.kind)) return 'prop_stump';
    if (n.kind === 'resin' || n.kind === 'frost' || n.kind === 'coal') return `prop_${n.kind}_spent`;
    return null;
  }
  const v = VARIANTS[n.kind];
  return v ? `prop_${n.kind}_${n.uid % v}` : `prop_${n.kind}`;
}

export function nodeShadow(kind: NodeKind): string | null {
  switch (kind) {
    case 'pine': case 'oak': case 'snowpine': case 'deadtree': return 'prop_shadow_m';
    case 'rock_l': return 'prop_shadow_l';
    case 'rock_m': case 'ore': case 'frost': case 'coal': case 'resin': return 'prop_shadow_s';
    default: return null;
  }
}

/** Rift-heart look (§11.2): asleep, awake (TR at the region cap / siege), sealed. */
export function heartState(p: Pick<PoiState, 'active' | 'data' | 'hp'>): 'sleep' | 'awake' | 'sealed' {
  const st = p.data?.state;
  if (st === 'sealed' || p.data?.sealed === true) return 'sealed';
  if (st === 'awake' || st === 'sleep') return st;
  return p.active ? 'awake' : 'sleep';
}

export function poiSprite(p: Pick<PoiState, 'kind' | 'active' | 'hp' | 'data'>, t: number, expedition = false): string | null {
  switch (p.kind) {
    case 'camp': return p.active ? 'prop_camp' : null;
    case 'cage': return p.active ? 'prop_cage' : 'prop_cage_broken';
    case 'shrine': return p.active ? 'prop_shrine' : 'prop_shrine_used';
    case 'rift': return `prop_rift_${animFrame(t, ANIM_FPS.rift * (p.active ? 1 : 0.4), 4)}`;
    case 'root': return p.active && p.hp > 0 ? 'prop_root' : null;
    case 'chest':
      if (expedition) return p.active ? 'prop_exp_chest_closed' : 'prop_exp_chest_open';
      return p.active ? 'prop_chest_closed' : 'prop_chest_open';
    case 'ruin': return p.active ? 'prop_ruin_old' : 'prop_ruin_old_looted';
    case 'heart': {
      const st = heartState(p);
      if (st === 'sealed') return 'prop_heart_sealed';
      return st === 'awake' ? `prop_heart_awake_${animFrame(t, ANIM_FPS.rift, 4)}` : `prop_heart_sleep_${animFrame(t, ANIM_FPS.idle, 2)}`;
    }
  }
  return null;
}

export function projectileSprite(p: Pick<ProjectileState, 'kind'>, t: number): string {
  if (p.kind === 'fireball') return `proj_fireball_${animFrame(t, ANIM_FPS.fx, 2)}`;
  if (p.kind === 'spark') return `proj_spark_seg_${animFrame(t, ANIM_FPS.fx * 2, 2)}`;
  return `proj_${p.kind}`;
}

/** Ground-effect sprite for a skill / boss zone (firewall + sanctum are drawn as bands / rings by EntityView). */
export function zoneSprite(z: Pick<ZoneState, 'kind'>, t: number): string {
  switch (z.kind) {
    case 'firewall': return `fx_firewall_${animFrame(t, ANIM_FPS.fx, 3)}`;
    case 'sanctum': return `fx_sanctum_${animFrame(t, ANIM_FPS.idle * 2, 2)}`;
    case 'flare': return `fx_flare_${animFrame(t, ANIM_FPS.fx * 0.75, 3)}`;
    case 'thorns': return `fx_thorns_${animFrame(t, ANIM_FPS.fx * 0.5, 3)}`;
    case 'blizzard': return `fx_blizzard_${animFrame(t, ANIM_FPS.fx, 3)}`;
  }
}

/** Unit shadow size by sprite height. */
export function unitShadow(id: string): string {
  if (isBoss(id)) return 'prop_shadow_l';
  if (id === 'brute' || id === 'hurler' || id === 'champion') return 'prop_shadow_m';
  return 'prop_shadow_s';
}

/** Interpolated render position (tile units) between the previous and current fixed step. */
export function lerpPos(u: Pick<Unit, 'x' | 'y' | 'px' | 'py'>, alpha: number): { x: number; y: number } {
  const a = Math.max(0, Math.min(1, alpha));
  // teleports (rogue blink, boss rift jump, burrower surfacing) must not smear across the map
  if (Math.abs(u.x - u.px) + Math.abs(u.y - u.py) > 3) return { x: u.x, y: u.y };
  return { x: u.px + (u.x - u.px) * a, y: u.py + (u.y - u.py) * a };
}

/** Row bucket for y-sorting: the tile row of an entity's feet, clamped to the map. */
export function rowOf(feetY: number, mapSize: number): number {
  return Math.max(0, Math.min(mapSize - 1, Math.floor(feetY)));
}

/** Status-effect icon frames above a unit, in display order. */
export function statusIcons(s: { burn: number; slow: number; stun: number; frozen?: number }, t: number): string[] {
  const out: string[] = [];
  if (s.burn > 0) out.push(`fx_burn_${animFrame(t, ANIM_FPS.fx, 3)}`);
  if (s.slow > 0 || (s.frozen ?? 0) > 0) out.push(`fx_snow_${animFrame(t, ANIM_FPS.idle * 2, 2)}`);
  if (s.stun > 0) out.push(`fx_stun_${animFrame(t, ANIM_FPS.idle * 2, 2)}`);
  return out;
}

/** Crack overlay for damaged buildings (HP < 66% / < 33%). */
export function crackOverlay(hp: number, maxHp: number): string | null {
  if (maxHp <= 0) return null;
  const r = hp / maxHp;
  if (r < 0.33) return 'bld_crack_2';
  if (r < 0.66) return 'bld_crack_1';
  return null;
}

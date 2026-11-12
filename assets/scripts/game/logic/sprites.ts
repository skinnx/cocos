// Pure sprite-name selection for game entities (no 'cc'). Names are verbatim from tools/art/manifest.mjs.
import type { BuildingState, EnemyState, HeroState, NodeKind, PoiState, ProjectileState, ResourceNode, Unit } from '../../core/api';

export const ANIM_FPS = { idle: 3, walk: 8, attack: 10, building: 6, fx: 12, water: 1.5, rift: 6 } as const;

/** Frame index from an animation clock; `loop=false` clamps on the last frame. */
export function animFrame(t: number, fps: number, count: number, loop = true): number {
  if (count <= 1) return 0;
  const f = Math.floor(Math.max(0, t) * fps);
  return loop ? f % count : Math.min(count - 1, f);
}

export function heroSprite(h: Pick<HeroState, 'id' | 'anim' | 'animT'>): string {
  switch (h.anim) {
    case 'down': return `hero_${h.id}_down`;
    case 'attack': return `hero_${h.id}_attack_${animFrame(h.animT, ANIM_FPS.attack, 3, false)}`;
    case 'move': return `hero_${h.id}_walk_${animFrame(h.animT, ANIM_FPS.walk, 4)}`;
    default: return `hero_${h.id}_idle_${animFrame(h.animT, ANIM_FPS.idle, 2)}`;
  }
}

/** Sprite for an enemy (also bosses, militia and the tinker's mini turret, which travel through the enemy list). */
export function enemySprite(e: Pick<EnemyState, 'id' | 'anim' | 'animT'> & { id: string }): string {
  const id = e.id as string;
  if (id === 'mossback') {
    // shell phase: the boss stops (idle/attack anim) while retracted
    if (e.anim === 'idle' || e.anim === 'attack') return `boss_mossback_shell_${animFrame(e.animT, ANIM_FPS.idle * 2, 2)}`;
    return `boss_mossback_walk_${animFrame(e.animT, ANIM_FPS.walk * 0.6, 4)}`;
  }
  if (id === 'unlit') {
    if (e.anim === 'attack') return `boss_unlit_cast_${animFrame(e.animT, ANIM_FPS.attack * 0.6, 2, false)}`;
    return `boss_unlit_float_${animFrame(e.animT, ANIM_FPS.walk * 0.6, 4)}`;
  }
  if (id === 'turret') return 'turret_mini';
  if (e.anim === 'attack') return `enemy_${id}_attack_${animFrame(e.animT, ANIM_FPS.attack * 0.6, 2, false)}`;
  const fps = e.anim === 'move' ? ANIM_FPS.walk : ANIM_FPS.idle;
  return `enemy_${id}_move_${animFrame(e.animT, fps, 4)}`;
}

export function isBoss(id: string): boolean { return id === 'mossback' || id === 'unlit'; }

/** Gate orientation from the wall-connection mask (N1 E2 S4 W8): walls east/west → horizontal gate. */
export function gateOrientation(mask: number): 'h' | 'v' {
  const ew = (mask & 2) || (mask & 8), ns = (mask & 1) || (mask & 4);
  if (ns && !ew) return 'v';
  return 'h';
}

/** 8-direction index for the ballista head (0 = east, counter-clockwise on screen) from a core angle (y down). */
export function dir8(angleCore: number): number {
  const screen = -angleCore;
  const i = Math.round(screen / (Math.PI / 4));
  return ((i % 8) + 8) % 8;
}

export interface BuildingSprites { base: string; head?: string; }
export function buildingSprites(b: Pick<BuildingState, 'id' | 'level' | 'lit' | 'open' | 'charges' | 'aimAngle' | 'wallMask'>, t: number): BuildingSprites {
  const lv = b.level;
  const f4 = animFrame(t, ANIM_FPS.building, 4);
  switch (b.id) {
    case 'hearth': return { base: `bld_hearth_l${lv}_${f4}` };
    case 'wall_wood': return { base: `bld_wall_wood_${b.wallMask & 15}` };
    case 'wall_stone': return { base: `bld_wall_stone_${b.wallMask & 15}` };
    case 'gate': return { base: `bld_gate_${gateOrientation(b.wallMask)}_${b.open ? 'open' : 'closed'}` };
    case 'brazier': {
      const l = Math.min(2, lv);
      return { base: b.lit ? `bld_brazier_l${l}_${f4}` : `bld_brazier_l${l}_off` };
    }
    case 'tower_ballista': return { base: `bld_tower_ballista_l${lv}_base`, head: `bld_ballista_head_${dir8(b.aimAngle)}` };
    case 'tower_frost': case 'tower_spark': return { base: `bld_${b.id}_l${lv}_${f4}` };
    case 'trap_spikes': return { base: `bld_trap_spikes_l${Math.min(2, lv)}_${b.charges > 0 ? 'up' : 'down'}` };
    case 'trap_tar': return { base: b.lit ? `bld_trap_tar_burning_${animFrame(t, ANIM_FPS.building * 1.5, 3)}` : 'bld_trap_tar' };
    case 'tavern': return { base: 'bld_tavern_l1' };
    default: return { base: `bld_${b.id}_l${lv}` };
  }
}

/** Traps are drawn flat on the floor layer (under units), everything else is y-sorted. */
export function isFloorBuilding(id: string): boolean { return id === 'trap_spikes' || id === 'trap_tar'; }

const VARIANTS: Partial<Record<NodeKind, number>> = { pine: 2, oak: 2, bush: 2, ore: 2 };
export function nodeSprite(n: Pick<ResourceNode, 'uid' | 'kind' | 'hp'>): string | null {
  if (n.hp <= 0) {
    if (n.kind === 'pine' || n.kind === 'oak' || n.kind === 'stump') return 'prop_stump';
    return null;
  }
  const v = VARIANTS[n.kind];
  return v ? `prop_${n.kind}_${n.uid % v}` : `prop_${n.kind}`;
}

export function nodeShadow(kind: NodeKind): string | null {
  switch (kind) {
    case 'pine': case 'oak': return 'prop_shadow_m';
    case 'rock_l': return 'prop_shadow_l';
    case 'rock_m': case 'ore': return 'prop_shadow_s';
    default: return null;
  }
}

export function poiSprite(p: Pick<PoiState, 'kind' | 'active' | 'hp'>, t: number): string | null {
  switch (p.kind) {
    case 'camp': return p.active ? 'prop_camp' : null;
    case 'cage': return p.active ? 'prop_cage' : 'prop_cage_broken';
    case 'shrine': return p.active ? 'prop_shrine' : 'prop_shrine_used';
    case 'rift': return `prop_rift_${animFrame(t, ANIM_FPS.rift * (p.active ? 1 : 0.4), 4)}`;
    case 'root': return p.active && p.hp > 0 ? 'prop_root' : null;
    case 'chest': return p.active ? 'prop_chest_closed' : 'prop_chest_open';
  }
  return null;
}

export function projectileSprite(p: Pick<ProjectileState, 'kind'>, t: number): string {
  if (p.kind === 'fireball') return `proj_fireball_${animFrame(t, ANIM_FPS.fx, 2)}`;
  if (p.kind === 'spark') return `proj_spark_seg_${animFrame(t, ANIM_FPS.fx * 2, 2)}`;
  return `proj_${p.kind}`;
}

/** Unit shadow size by sprite height. */
export function unitShadow(id: string): string {
  if (isBoss(id)) return 'prop_shadow_l';
  if (id === 'brute') return 'prop_shadow_m';
  return 'prop_shadow_s';
}

/** Interpolated render position (tile units) between the previous and current fixed step. */
export function lerpPos(u: Pick<Unit, 'x' | 'y' | 'px' | 'py'>, alpha: number): { x: number; y: number } {
  const a = Math.max(0, Math.min(1, alpha));
  // teleports (rogue blink, boss rift jump) must not smear across the map
  if (Math.abs(u.x - u.px) + Math.abs(u.y - u.py) > 3) return { x: u.x, y: u.y };
  return { x: u.px + (u.x - u.px) * a, y: u.py + (u.y - u.py) * a };
}

/** Row bucket for y-sorting: the tile row of an entity's feet, clamped to the map. */
export function rowOf(feetY: number, mapSize: number): number {
  return Math.max(0, Math.min(mapSize - 1, Math.floor(feetY)));
}

/** Status-effect icon frames above an enemy, in display order. */
export function statusIcons(s: { burn: number; slow: number; stun: number }, t: number): string[] {
  const out: string[] = [];
  if (s.burn > 0) out.push(`fx_burn_${animFrame(t, ANIM_FPS.fx, 3)}`);
  if (s.slow > 0) out.push(`fx_snow_${animFrame(t, ANIM_FPS.idle * 2, 2)}`);
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

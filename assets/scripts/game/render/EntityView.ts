// Renders every live entity of the core state each frame (SPEC §13.3): heroes, enemies (incl. bosses), allies,
// buildings, resource nodes, POIs, projectiles and skill zones. Positions are interpolated between fixed steps with
// game.alpha(); frames come from anim/animT; facing flips horizontally; shadows sit on the floor layer; hit flash
// swaps to the white-silhouette twin for 80 ms; elites are 125% with a glowing outline; units on dark tiles are
// drawn as a pair of glowing eyes only (veiled). Entities are y-sorted into tile-row buckets (YSort).
import type { Node } from 'cc';
import type {
  AllyState, BuildingState, EnemyState, GameState, HeroState, PoiState, ProjectileState, ResourceNode, ZoneState,
} from '../../core/api';
import { TILE } from '../logic/camera';
import { bounceScale, HIT_FLASH_SEC, treeShake } from '../logic/juice';
import {
  buildingSprites, crackOverlay, enemySprite, heroSprite, isBoss, isFloorBuilding, lerpPos, nodeShadow, nodeSprite,
  poiSprite, projectileSprite, statusIcons, unitShadow, animFrame, ANIM_FPS,
} from '../logic/sprites';
import { Atlas } from './Atlas';
import { mkNode, PAL, Pool, SpriteHandle } from './Nodes';
import { YSort } from './YSort';

type Kind = 'hero' | 'enemy' | 'ally' | 'bld' | 'node' | 'poi';

/** Unit feet sit slightly below the collision centre so sprites read as standing on it. */
const FEET = 0.22;

class Bar {
  readonly under: SpriteHandle; readonly fill: SpriteHandle;
  constructor(parent: Node) {
    this.under = new SpriteHandle('barU', parent).solid(12, 3, 0, 0);
    this.under.color(PAL.k[0], PAL.k[1], PAL.k[2], 220);
    this.fill = new SpriteHandle('barF', parent);
  }
  set(x: number, y: number, w: number, frac: number, fillName: string): void {
    const f = Math.max(0, Math.min(1, frac));
    this.under.solid(w + 2, 3, 0, 0).pos(Math.round(x - w / 2 - 1), y).show(true);
    this.fill.set(fillName).size(Math.max(0, Math.round(w * f)), 1).anchor(0, 0).pos(Math.round(x - w / 2), y + 1).show(f > 0);
  }
  hide(): void { this.under.show(false); this.fill.show(false); }
}

class Ent {
  readonly root: Node;
  readonly body: SpriteHandle;
  head: SpriteHandle | null = null;     // ballista head
  embed: SpriteHandle | null = null;    // embedded-wall base (under body)
  over: SpriteHandle[] = [];            // overlays: crack, flame tip, rally flag, link
  glow: SpriteHandle[] = [];            // elite outline copies (behind body)
  shadow: SpriteHandle | null = null;
  eyes: SpriteHandle | null = null;
  status: SpriteHandle[] = [];
  bar: Bar | null = null;
  flashT = 0; bounceT = 9; seen = 0; uid = 0;
  constructor(readonly kind: Kind, parent: Node) {
    this.root = mkNode(kind, parent);
    this.body = new SpriteHandle('body', this.root);
  }
}

const SHARD_TINT: Record<string, readonly number[]> = {
  gloomling: PAL.M, skitter: PAL.m, spitter: PAL.d, brute: PAL.m, wisp: PAL.L, bomber: PAL.x, snuffer: PAL.n,
  mossback: PAL.t, unlit: PAL.L, militia: PAL.R,
};
export function shardTint(id: string): readonly number[] { return SHARD_TINT[id] ?? PAL.M; }

export class EntityView {
  private ents = new Map<number, Ent>();
  private free: Record<Kind, Ent[]> = { hero: [], enemy: [], ally: [], bld: [], node: [], poi: [] };
  private projs = new Map<number, SpriteHandle>();
  private projPool: Pool<SpriteHandle>;
  private zoneFx: SpriteHandle[] = [];
  private frame = 0;
  private t = 0;
  readonly ysort: YSort;
  /** uid → last time (s) it was attacked: drives edge arrows for buildings under attack */
  readonly attacked = new Map<number, number>();
  /** uid → view time of the last hit (HP bars show for 4 s after a hit) */
  private attackedT = new Map<number, number>();
  /** building selected in the radial menu (always shows its HP bar) */
  selectedUid = 0;

  constructor(readonly rowsLayer: Node, readonly floor: Node, readonly air: Node, readonly eyesLayer: Node,
    readonly top: Node, mapSize: number) {
    this.ysort = new YSort(rowsLayer, mapSize);
    this.projPool = new Pool(() => new SpriteHandle('proj', air), (h) => h.show(true), (h) => h.show(false));
    this.projPool.prewarm(40);
  }

  reset(): void {
    for (const [, e] of this.ents) this.release(e);
    this.ents.clear();
    for (const [, h] of this.projs) this.projPool.put(h);
    this.projs.clear();
    this.attacked.clear();
    this.attackedT.clear();
  }

  /** Hit flash (80 ms) for any entity uid. */
  flash(uid: number): void { const e = this.ents.get(uid); if (e) e.flashT = HIT_FLASH_SEC; this.attackedT.set(uid, this.t); }
  bounce(uid: number): void { const e = this.ents.get(uid); if (e) e.bounceT = 0; }
  has(uid: number): boolean { return this.ents.has(uid); }

  update(s: GameState, alpha: number, dt: number, range: { x0: number; y0: number; x1: number; y1: number }): void {
    this.frame++; this.t += dt;
    const vis = (x: number, y: number, m = 3) => x >= range.x0 - m && x <= range.x1 + m && y >= range.y0 - m && y <= range.y1 + m;
    const n = s.map.size;
    const explored = (x: number, y: number) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      return ix >= 0 && iy >= 0 && ix < n && iy < n && s.map.explored[iy * n + ix] > 0;
    };

    for (const nd of s.nodes) {
      if (!vis(nd.x, nd.y) || !explored(nd.x, nd.y)) continue;
      this.drawNode(this.get(nd.uid, 'node'), nd);
    }
    for (const p of s.pois) {
      if (!vis(p.x, p.y) || !explored(p.x, p.y)) continue;
      this.drawPoi(this.get(p.uid, 'poi'), p);
    }
    for (const b of s.buildings) {
      if (!vis(b.x, b.y, 4)) continue;
      this.drawBuilding(this.get(b.uid, 'bld'), b, dt);
    }
    for (const h of s.heroes) {
      const p = lerpPos(h, alpha);
      if (!vis(p.x, p.y)) continue;
      this.drawHero(this.get(h.uid, 'hero'), h, p, dt);
    }
    for (const a of s.allies ?? []) {
      const p = lerpPos(a, alpha);
      if (!vis(p.x, p.y)) continue;
      this.drawAlly(this.get(a.uid, 'ally'), a, p, dt);
    }
    for (const e of s.enemies) {
      const p = lerpPos(e, alpha);
      if (!vis(p.x, p.y, 5)) continue;
      this.drawEnemy(this.get(e.uid, 'enemy'), e, p, dt);
    }
    // release entities not seen this frame (dead, culled or removed)
    for (const [uid, e] of this.ents) if (e.seen !== this.frame) { this.release(e); this.ents.delete(uid); }

    this.drawProjectiles(s.projectiles, alpha, range);
    this.drawZones(s.zones ?? []);
  }

  // ── entity record management ──────────────────────────────────────────────
  private get(uid: number, kind: Kind): Ent {
    let e = this.ents.get(uid);
    if (e && e.kind !== kind) { this.release(e); e = undefined; }
    if (!e) {
      e = this.free[kind].pop() ?? new Ent(kind, this.ysort.rows[0]);
      e.root.active = true; e.flashT = 0; e.bounceT = 9; e.uid = uid;
      this.ents.set(uid, e);
    }
    e.seen = this.frame;
    return e;
  }
  private release(e: Ent): void {
    e.root.active = false;
    e.shadow?.show(false); e.eyes?.show(false); e.bar?.hide();
    for (const s of e.status) s.show(false);
    this.free[e.kind].push(e);
  }

  private shadowOf(e: Ent, name: string, x: number, y: number): void {
    const sh = e.shadow ?? (e.shadow = new SpriteHandle('shadow', this.floor));
    sh.set(name).pos(x, y).show(true);
  }
  private barOf(e: Ent): Bar { return e.bar ?? (e.bar = new Bar(this.top)); }

  // ── per-kind drawing ──────────────────────────────────────────────────────
  private drawNode(e: Ent, nd: ResourceNode): void {
    const name = nodeSprite(nd);
    if (!name) { e.root.active = false; e.shadow?.show(false); return; }
    e.root.active = true;
    const fx = nd.x + 0.5, fy = nd.y + 0.875;
    const shake = treeShake(nd.shakeT, this.t);
    e.root.setPosition(Math.round(fx * TILE) + shake, Math.round(-fy * TILE), 0);
    this.ysort.place(e.root, fy);
    e.body.set(name);
    const sh = nd.hp > 0 ? nodeShadow(nd.kind) : null;
    if (sh) this.shadowOf(e, sh, Math.round(fx * TILE), Math.round(-fy * TILE)); else e.shadow?.show(false);
  }

  private drawPoi(e: Ent, p: PoiState): void {
    const name = poiSprite(p, this.t);
    if (!name) { e.root.active = false; e.bar?.hide(); return; }
    e.root.active = true;
    const fx = p.x + 0.5, fy = p.y + 0.9;
    e.root.setPosition(Math.round(fx * TILE), Math.round(-fy * TILE), 0);
    this.ysort.place(e.root, fy);
    e.body.set(name, e.flashT > 0);
    if (e.flashT > 0) e.flashT -= 1 / 60;
    if ((p.kind === 'cage' || p.kind === 'root') && p.active && p.hp < p.maxHp && p.maxHp > 0) {
      this.barOf(e).set(Math.round(fx * TILE), Math.round(-fy * TILE) + e.body.h + 2, 14, p.hp / p.maxHp, 'ui_bar_fill_red');
    } else e.bar?.hide();
  }

  private drawBuilding(e: Ent, b: BuildingState, dt: number): void {
    const floorB = isFloorBuilding(b.id);
    const fx = b.x + b.w / 2, fy = b.y + b.h;
    const px = Math.round(fx * TILE), py = Math.round(-fy * TILE);
    if (floorB) { if (e.root.parent !== this.floor) e.root.setParent(this.floor, false); }
    else this.ysort.place(e.root, fy - 0.01);
    e.root.setPosition(px, py, 0);
    const spr = buildingSprites(b, this.t);
    const flash = e.flashT > 0;
    e.body.set(spr.base, flash);
    // ballista head rotates over the base
    if (spr.head) {
      const h = e.head ?? (e.head = new SpriteHandle('head', e.root));
      h.set(spr.head, flash).pos(0, Math.round(e.body.h * 0.5)).show(true);
    } else e.head?.show(false);
    // embedded-wall stone ring under towers (synergy 'embedded')
    const syn = b.synergies ?? [];
    if (syn.includes('embedded')) {
      if (!e.embed) { e.embed = new SpriteHandle('embed', e.root); e.embed.node.setSiblingIndex(0); }
      e.embed.set('bld_embed_base').pos(0, 0).show(true);
    } else e.embed?.show(false);
    // overlays: crack, flame tip, rally flag, tar-spike link
    let oi = 0;
    const over = (name: string, x: number, y: number) => {
      const h = e.over[oi] ?? (e.over[oi] = new SpriteHandle('over', e.root));
      oi++;
      h.set(name).pos(x, y).show(true);
    };
    const crack = b.maxHp > 1 && b.constructing <= 0 ? crackOverlay(b.hp, b.maxHp) : null;
    if (crack) over(crack, 0, Math.round(e.body.h * 0.35));
    if (syn.includes('flame')) over(`bld_flame_tip_${animFrame(this.t, ANIM_FPS.building * 1.5, 2)}`, 0, e.body.h - 2);
    if (syn.includes('rally')) over(`bld_rally_flag_${animFrame(this.t, ANIM_FPS.idle * 2, 2)}`, Math.round(e.body.w / 2) - 3, e.body.h - 4);
    if (syn.includes('tarSpike')) over('ui_link_dot', 5, 10);
    for (; oi < e.over.length; oi++) e.over[oi].show(false);
    // placement bounce 1.2 → 1.0, construction blink
    e.bounceT += dt;
    const k = bounceScale(e.bounceT);
    e.root.setScale(k, k, 1);
    const building = b.constructing > 0;
    const tint = flash && !Atlas.inst.flash(spr.base) ? 150 : 255; // no pixel access → red-ish flash tint instead
    e.body.color(255, tint, tint, building ? 140 + 60 * Math.sin(this.t * 14) : 255);
    if (flash) e.flashT -= dt;
    // HP bar when damaged (not for traps)
    const hurt = b.hp < b.maxHp - 0.5 && b.maxHp > 1;
    const recently = this.t - (this.attackedT.get(b.uid) ?? -99) < 4;
    if (!floorB && hurt && (recently || b.hp < b.maxHp * 0.5 || b.uid === this.selectedUid)) {
      this.barOf(e).set(px, py + e.body.h + 2, Math.max(10, b.w * 12), b.hp / b.maxHp, b.hp / b.maxHp < 0.33 ? 'ui_bar_fill_red' : 'ui_bar_fill_green');
    } else e.bar?.hide();
  }

  private unitCommon(e: Ent, p: { x: number; y: number }, bodyName: string, facing: number, scale: number, dt: number,
    shadowName: string, veiled: boolean, hp: number, maxHp: number, barFill: string, alwaysBar: boolean): { px: number; py: number } {
    const fy = p.y + FEET;
    const px = Math.round(p.x * TILE), py = Math.round(-fy * TILE);
    this.ysort.place(e.root, fy);
    e.root.setPosition(px, py, 0);
    const flash = e.flashT > 0;
    if (flash) e.flashT -= dt;
    e.body.set(bodyName, flash).scale(facing * scale, scale).show(!veiled);
    if (flash && !Atlas.inst.flash(bodyName)) e.body.color(255, 150, 150); else e.body.color(255, 255, 255);
    if (veiled) {
      e.shadow?.show(false);
      const ey = e.eyes ?? (e.eyes = new SpriteHandle('eyes', this.eyesLayer));
      ey.set(`enemy_eyes_veiled_${animFrame(this.t + e.uid * 0.37, 1.2, 2)}`).pos(px + facing, py + Math.round(e.body.h * scale * 0.62)).show(true);
      e.bar?.hide();
      for (const g of e.glow) g.show(false);
      return { px, py };
    }
    e.eyes?.show(false);
    this.shadowOf(e, shadowName, px, py);
    if (alwaysBar || hp < maxHp) {
      this.barOf(e).set(px, py + Math.round(e.body.h * scale) + 1, scale > 1.5 ? 24 : 10, maxHp > 0 ? hp / maxHp : 0, barFill);
    } else e.bar?.hide();
    return { px, py };
  }

  private drawHero(e: Ent, h: HeroState, p: { x: number; y: number }, dt: number): void {
    this.unitCommon(e, p, heroSprite(h), h.facing, 1, dt, 'prop_shadow_s', false, h.hp, h.maxHp,
      'ui_bar_fill_green', h.anim !== 'down');
    if (h.anim === 'down') e.bar?.hide();
    e.body.alpha(h.anim === 'down' ? 170 : 255);
    this.drawStatus(e, h.status, Math.round(e.body.h) + 5);
    for (const g of e.glow) g.show(false);
  }

  private drawAlly(e: Ent, a: AllyState, p: { x: number; y: number }, dt: number): void {
    const name = a.id === 'turret' ? 'turret_mini'
      : a.anim === 'attack' ? `enemy_militia_attack_${animFrame(a.animT, ANIM_FPS.attack * 0.6, 2, false)}`
        : `enemy_militia_move_${animFrame(a.animT, a.anim === 'move' ? ANIM_FPS.walk : ANIM_FPS.idle, 4)}`;
    this.unitCommon(e, p, name, a.facing, 1, dt, 'prop_shadow_s', false, a.hp, a.maxHp, 'ui_bar_fill_blue', false);
    for (const g of e.glow) g.show(false);
    for (const s of e.status) s.show(false);
  }

  private drawEnemy(e: Ent, en: EnemyState, p: { x: number; y: number }, dt: number): void {
    const x = en as EnemyState & { scale?: number; shell?: number };
    let anim = en.anim;
    if (en.id === 'mossback') anim = (x.shell ?? 0) > 0 ? 'idle' : 'move';
    const name = enemySprite({ id: en.id, anim, animT: en.animT });
    const scale = en.elite ? (x.scale && x.scale > 1 ? x.scale : 1.25) : 1;
    const veiled = !!en.status?.veiled && !isBoss(en.id);
    const flyLift = en.flying ? 4 + Math.round(Math.sin(this.t * 5 + en.uid) * 1.5) : 0;
    const r = this.unitCommon(e, { x: p.x, y: p.y }, name, en.facing, scale, dt, unitShadow(en.id), veiled,
      en.hp, en.maxHp, 'ui_bar_fill_red', false);
    if (flyLift && !veiled) e.body.pos(0, flyLift);
    else e.body.pos(0, 0);
    if (isBoss(en.id)) {
      e.bar?.hide(); // bosses use the big HUD bar
      // a boss in the dark stays drawn (dimmed by the overlay) and also shows its glowing eyes above the darkness
      if (en.status?.veiled) {
        const ey = e.eyes ?? (e.eyes = new SpriteHandle('eyes', this.eyesLayer));
        ey.set(`enemy_eyes_veiled_${animFrame(this.t, 1.2, 2)}`).pos(r.px + en.facing * 3, r.py + Math.round(e.body.h * 0.6)).show(true);
      }
    }
    // elite glow: four white-silhouette copies tinted gold, offset by 1 art px, behind the body
    if (en.elite && !veiled && Atlas.inst.flash(name)) {
      const offs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let i = 0; i < 4; i++) {
        let g = e.glow[i];
        if (!g) { g = e.glow[i] = new SpriteHandle('glow', e.root); g.node.setSiblingIndex(0); }
        g.set(name, true).scale(en.facing * scale, scale).color(PAL.z[0], PAL.z[1], PAL.z[2], 200)
          .pos(offs[i][0], offs[i][1] + (flyLift || 0)).show(true);
      }
    } else for (const g of e.glow) g.show(false);
    if (en.elite && !Atlas.inst.flash(name)) e.body.color(255, 240, 190); else if (e.flashT <= 0) e.body.color(255, 255, 255);
    if (!veiled) this.drawStatus(e, en.status, Math.round(e.body.h * scale) + 5 + flyLift);
    else for (const s of e.status) s.show(false);
  }

  private drawStatus(e: Ent, st: { burn: number; slow: number; stun: number } | undefined, top: number): void {
    const icons = st ? statusIcons(st, this.t) : [];
    for (let i = 0; i < Math.max(icons.length, e.status.length); i++) {
      if (i >= icons.length) { e.status[i].show(false); continue; }
      const h = e.status[i] ?? (e.status[i] = new SpriteHandle('st', e.root));
      h.set(icons[i]).pos((i - (icons.length - 1) / 2) * 7, top).show(true);
    }
  }

  private drawProjectiles(list: ProjectileState[], alpha: number, range: { x0: number; y0: number; x1: number; y1: number }): void {
    const seen = new Set<number>();
    for (const p of list) {
      const q = lerpPos(p, alpha);
      if (q.x < range.x0 - 2 || q.x > range.x1 + 2 || q.y < range.y0 - 2 || q.y > range.y1 + 2) continue;
      seen.add(p.uid);
      let h = this.projs.get(p.uid);
      if (!h) { h = this.projPool.get(); this.projs.set(p.uid, h); }
      h.set(projectileSprite(p, this.t)).pos(Math.round(q.x * TILE), Math.round(-q.y * TILE + (p.z ?? 0) * TILE + 6));
      h.angle(Math.round((-p.angle * 180) / Math.PI));
    }
    for (const [uid, h] of this.projs) if (!seen.has(uid)) { h.angle(0); this.projPool.put(h); this.projs.delete(uid); }
  }

  private drawZones(zones: ZoneState[]): void {
    let i = 0;
    const put = (name: string, x: number, y: number, a = 255) => {
      const h = this.zoneFx[i] ?? (this.zoneFx[i] = new SpriteHandle('zone', this.floor));
      i++;
      h.set(name).pos(Math.round(x * TILE), Math.round(-y * TILE)).alpha(a).show(true);
    };
    for (const z of zones) {
      const fade = z.dur > 0 ? Math.min(1, z.t / Math.min(0.5, z.dur)) : 1;
      if (z.kind === 'firewall') {
        const len = Math.hypot(z.x2 - z.x, z.y2 - z.y);
        const steps = Math.max(1, Math.round(len / 0.7));
        for (let k = 0; k <= steps; k++) {
          const u = k / steps;
          put(`fx_firewall_${animFrame(this.t + k * 0.13, ANIM_FPS.fx, 3)}`, z.x + (z.x2 - z.x) * u, z.y + (z.y2 - z.y) * u + 0.3, 255 * fade);
        }
      } else {
        const ring = Math.max(6, Math.round((2 * Math.PI * z.r) / 1.1));
        put(`fx_sanctum_${animFrame(this.t, ANIM_FPS.idle * 2, 2)}`, z.x, z.y, 230 * fade);
        for (let k = 0; k < ring; k++) {
          const a = (k / ring) * Math.PI * 2 + this.t * 0.4;
          put(`fx_sanctum_${(k + Math.floor(this.t * 4)) & 1}`, z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r, 150 * fade);
        }
      }
    }
    for (; i < this.zoneFx.length; i++) this.zoneFx[i].show(false);
  }

  /** Screen-space anchor (tile coords) of an entity's head, for floating UI. */
  headOf(uid: number): { x: number; y: number } | null {
    const e = this.ents.get(uid);
    if (!e || !e.root.active) return null;
    const p = e.root.position;
    return { x: p.x / TILE, y: -(p.y + e.body.h) / TILE };
  }
}


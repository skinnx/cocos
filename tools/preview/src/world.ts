// World renderer: tiles (+ biome edge overlays), y-sorted props/buildings/units with interpolation,
// projectiles, FX, light overlay, veiled eyes. Everything is drawn in art px on the back buffer.
import type { Atlas } from './atlas';
import type { AllyState, BuildingState, EnemyState, GameState, HeroState, PoiState, ResourceNode } from './core';
import type { Fx } from './fx';
import { LightOverlay } from './light';
import {
  edgeOverlays, materialOf, tileSprite, type Material, heroSprite, enemySprite, buildingSprites, isFloorBuilding, nodeSprite, nodeShadow,
  poiSprite, projectileSprite, unitShadow, lerpPos, statusIcons, crackOverlay, isBoss, animFrame,
} from './shared';

export const T = 16;

export interface Cam { x: number; y: number; w: number; h: number } // x,y = world art px at screen top-left

interface Drawable { y: number; draw: () => void }

export class WorldRenderer {
  light = new LightOverlay();
  edgeCache: { seed: number; size: number; pieces: string[][] } | null = null;
  /** uids of buildings hit recently (edge arrows) */
  attacked = new Map<number, number>();

  constructor(private atlas: Atlas, private fx: Fx) {}

  // ── ground: tile + biome-edge overlays via the client's pure logic (game/logic/edges.ts) ──
  private buildEdges(s: GameState) {
    const { size, biome } = s.map;
    const at = (x: number, y: number): Material => (x < 0 || y < 0 || x >= size || y >= size ? 'water' : materialOf(biome[y * size + x]));
    const pieces: string[][] = new Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) pieces[y * size + x] = edgeOverlays(x, y, at);
    this.edgeCache = { seed: s.seed, size, pieces };
  }

  drawGround(ctx: CanvasRenderingContext2D, s: GameState, cam: Cam, t: number) {
    const { size, biome, variant } = s.map;
    if (!this.edgeCache || this.edgeCache.seed !== s.seed || this.edgeCache.size !== size) this.buildEdges(s);
    const X0 = Math.floor(cam.x / T), Y0 = Math.floor(cam.y / T);
    const X1 = Math.ceil((cam.x + cam.w) / T), Y1 = Math.ceil((cam.y + cam.h) / T);
    const wf = Math.floor(t * 1.6) % 2;
    const ec = this.edgeCache!;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const inside = x >= 0 && y >= 0 && x < size && y < size;
      const name = inside ? tileSprite(biome[y * size + x], variant[y * size + x], wf + ((x + y) & 1)) : tileSprite('water', 0, wf + ((x + y) & 1));
      this.atlas.draw(ctx, name, x * T - cam.x, y * T - cam.y);
    }
    for (let y = Math.max(0, Y0); y <= Math.min(size - 1, Y1); y++) for (let x = Math.max(0, X0); x <= Math.min(size - 1, X1); x++)
      for (const p of ec.pieces[y * size + x]) this.atlas.draw(ctx, p, x * T - cam.x, y * T - cam.y);
  }

  // ── entities ────────────────────────────────────────────────────────────
  /** Feet offset (art px) of a unit below its core position (tile-centre based). */
  static FEET = 3;

  drawFloor(ctx: CanvasRenderingContext2D, s: GameState, cam: Cam, t: number) {
    const A = this.atlas;
    for (const b of s.buildings) {
      if (!isFloorBuilding(b.id)) continue;
      const x = Math.round((b.x + 0.5) * T - cam.x), y = Math.round((b.y + 1) * T - cam.y);
      if (x < -16 || y < -16 || x > cam.w + 16 || y > cam.h + 32) continue;
      const flash = this.fx.flash.has(b.uid);
      A.draw(ctx, buildingSprites(b, t).base, x, y, { alpha: b.constructing > 0 ? 0.55 : 1, tint: flash ? '#f6f2e6' : undefined, scale: this.bscale(b.uid) });
      if (b.synergies.includes('tarSpike')) A.drawC(ctx, 'ui_link_dot', x, y - 8);
    }
  }

  private bscale(uid: number) { const k = this.fx.bounceScale(uid); return k !== 1 ? k : undefined; }

  drawEntities(ctx: CanvasRenderingContext2D, s: GameState, cam: Cam, a: number, t: number) {
    const list: Drawable[] = [];
    const vis = (wx: number, wy: number, m = 48) => wx > cam.x - m && wx < cam.x + cam.w + m && wy > cam.y - m && wy < cam.y + cam.h + m * 2;
    const sx = (wx: number) => Math.round(wx - cam.x), sy = (wy: number) => Math.round(wy - cam.y);
    const night = s.phase === 'night';
    const F = WorldRenderer.FEET;

    for (const nd of s.nodes) {
      const wx = (nd.x + 0.5) * T, wy = (nd.y + 1) * T - 2;
      if (!vis(wx, wy)) continue;
      list.push({ y: wy, draw: () => this.drawNode(ctx, nd, sx(wx), sy(wy), t) });
    }
    for (const p of s.pois) {
      const wx = (p.x + 0.5) * T, wy = (p.y + 1) * T - 2;
      if (!vis(wx, wy, 64)) continue;
      list.push({ y: p.kind === 'rift' ? wy - 24 : wy, draw: () => this.drawPoi(ctx, p, sx(wx), sy(wy), t) });
    }
    for (const b of s.buildings) {
      if (isFloorBuilding(b.id)) continue;
      const wx = (b.x + b.w / 2) * T, wy = (b.y + b.h) * T;
      if (!vis(wx, wy, 64)) continue;
      list.push({ y: wy - 1, draw: () => this.drawBuilding(ctx, s, b, sx(wx), sy(wy), t) });
    }
    for (const h of s.heroes) {
      const p = lerpPos(h, a); const wx = p.x * T, wy = p.y * T + F;
      if (!vis(wx, wy)) continue;
      list.push({ y: wy, draw: () => this.drawHero(ctx, h, sx(wx), sy(wy), t) });
    }
    for (const u of s.allies ?? []) {
      if (u.hp <= 0) continue;
      const p = lerpPos(u, a); const wx = p.x * T, wy = p.y * T + F;
      if (!vis(wx, wy)) continue;
      list.push({ y: wy, draw: () => this.drawAlly(ctx, u, sx(wx), sy(wy)) });
    }
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      if (e.status.veiled && night) continue; // drawn as eyes above the light overlay
      const p = lerpPos(e, a); const wx = p.x * T, wy = p.y * T + F;
      if (!vis(wx, wy, 64)) continue;
      list.push({ y: wy, draw: () => this.drawEnemy(ctx, e, sx(wx), sy(wy), t) });
    }
    list.sort((p, q) => p.y - q.y);
    for (const d of list) d.draw();
  }

  private drawNode(ctx: CanvasRenderingContext2D, n: ResourceNode, x: number, y: number, t: number) {
    const name = nodeSprite(n);
    if (!name) return;
    const sh = n.hp > 0 ? nodeShadow(n.kind) : null;
    if (sh) this.atlas.draw(ctx, sh, x, y + 1);
    const shake = n.shakeT > 0 ? Math.round(Math.sin(t * 70)) : 0;
    this.atlas.draw(ctx, name, x + shake, y);
  }

  private drawPoi(ctx: CanvasRenderingContext2D, p: PoiState, x: number, y: number, t: number) {
    const name = poiSprite(p, t);
    if (!name) return;
    if (p.kind === 'chest' || p.kind === 'root') this.atlas.draw(ctx, 'prop_shadow_s', x, y + 1);
    this.atlas.draw(ctx, name, x, p.kind === 'rift' ? y + 8 : y);
    if (p.active && p.maxHp > 0 && p.hp > 0 && p.hp < p.maxHp && p.kind !== 'rift') this.bar(ctx, x, y - 24, p.hp / p.maxHp, 'bar_fill_red');
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, s: GameState, b: BuildingState, x: number, y: number, t: number) {
    const A = this.atlas;
    const flash = this.fx.flash.has(b.uid);
    const o = { alpha: b.constructing > 0 ? 0.6 + 0.25 * Math.sin(t * 20) : 1, scale: this.bscale(b.uid), tint: flash ? '#f6f2e6' : undefined };
    if (b.synergies.includes('embedded')) A.draw(ctx, 'bld_embed_base', x, y);
    const spr = buildingSprites(b.id === 'hearth' ? { ...b, level: s.hearthLevel } : b, t);
    A.draw(ctx, spr.base, x, y, o);
    const f = A.frames[spr.base];
    const top = f ? y - f.ay : y - 24;
    if (spr.head) A.draw(ctx, spr.head, x, y - (b.h * T) / 2 - 4, { tint: o.tint, scale: o.scale });
    const crack = b.id === 'hearth' ? null : crackOverlay(b.hp, b.maxHp);
    if (crack) A.draw(ctx, crack, x, y);
    const ft = animFrame(t, 6, 2);
    if (b.synergies.includes('flame')) A.draw(ctx, `bld_flame_tip_${ft}`, x, top + 3);
    if (b.synergies.includes('rally')) A.draw(ctx, `bld_rally_flag_${ft}`, x + 5, top + 5);
    if (b.maxHp > 0 && b.hp < b.maxHp && b.id !== 'hearth' && (this.attacked.has(b.uid) || b.hp / b.maxHp < 0.5))
      this.bar(ctx, x, top - 4, b.hp / b.maxHp, 'bar_fill_green');
  }

  private drawHero(ctx: CanvasRenderingContext2D, h: HeroState, x: number, y: number, t: number) {
    const A = this.atlas;
    A.draw(ctx, 'prop_shadow_s', x, y + 1);
    const name = heroSprite(h);
    A.draw(ctx, name, x, y, { flip: h.facing < 0, tint: this.fx.flash.has(h.uid) ? '#f6f2e6' : undefined });
    const f = A.frames[name]; const top = f ? y - f.ay : y - 16;
    if (h.anim !== 'down' && h.hp < h.maxHp) this.bar(ctx, x, top - 4, h.hp / h.maxHp, 'bar_fill_green');
    this.status(ctx, h.status, x, top - 4, t);
  }

  private drawAlly(ctx: CanvasRenderingContext2D, u: AllyState, x: number, y: number) {
    const A = this.atlas;
    A.draw(ctx, 'prop_shadow_s', x, y + 1);
    const name = enemySprite({ id: u.id === 'turret' ? 'turret' : 'militia', anim: u.anim, animT: u.animT } as any);
    A.draw(ctx, name, x, y, { flip: u.facing < 0, tint: this.fx.flash.has(u.uid) ? '#f6f2e6' : undefined });
    const f = A.frames[name]; const top = f ? y - f.ay : y - 16;
    if (u.hp < u.maxHp) this.bar(ctx, x, top - 4, u.hp / u.maxHp, 'bar_fill_green');
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyState, x: number, y: number, t: number) {
    const A = this.atlas;
    const name = enemySprite(e);
    const hover = e.flying || e.id === 'unlit' ? Math.round(Math.sin(t * 4 + e.uid) * 1.5) - 5 : 0;
    A.draw(ctx, e.elite ? 'prop_shadow_m' : unitShadow(e.id), x, y + 1);
    if (e.elite) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) A.draw(ctx, name, x + dx, y + dy + hover, { flip: e.facing < 0, tint: '#ffe27a' });
    A.draw(ctx, name, x, y + hover, { flip: e.facing < 0, tint: this.fx.flash.has(e.uid) ? '#f6f2e6' : undefined });
    const f = A.frames[name]; const top = f ? y + hover - f.ay : y - 18;
    if (!isBoss(e.id) && e.hp < e.maxHp) this.bar(ctx, x, top - 4, e.hp / e.maxHp, 'bar_fill_red');
    this.status(ctx, e.status, x, top - 4, t);
  }

  private status(ctx: CanvasRenderingContext2D, st: { burn: number; slow: number; stun: number }, x: number, y: number, t: number) {
    const icons = statusIcons(st, t);
    let ox = x - ((icons.length - 1) * 8) / 2;
    for (const n of icons) { this.atlas.drawC(ctx, n, ox, y - 4); ox += 8; }
  }

  /** Veiled enemies (dark tiles at night): only the glowing eyes, drawn AFTER the light overlay. */
  drawVeiled(ctx: CanvasRenderingContext2D, s: GameState, cam: Cam, a: number, t: number) {
    if (s.phase !== 'night') return;
    for (const e of s.enemies) {
      if (e.hp <= 0 || !e.status.veiled) continue;
      const p = lerpPos(e, a);
      const x = Math.round(p.x * T - cam.x), y = Math.round(p.y * T + WorldRenderer.FEET - cam.y);
      if (x < -16 || x > cam.w + 16 || y < -16 || y > cam.h + 32) continue;
      const blink = Math.floor(t * 1.5 + e.uid * 0.37) % 6 === 0 ? 1 : 0;
      const f = this.atlas.frames[enemySprite(e)];
      const eyeY = y - (f ? Math.round(f.h * 0.55) : 9) - (isBoss(e.id) ? 10 : 0);
      this.atlas.drawC(ctx, `enemy_eyes_veiled_${blink}`, x + (e.facing < 0 ? -1 : 1), eyeY);
    }
  }

  bar(ctx: CanvasRenderingContext2D, cx: number, y: number, r: number, fill: string) {
    const A = this.atlas;
    const w = 12, h = 3;
    const x = Math.round(cx - w / 2); y = Math.round(y);
    A.nine(ctx, 'ui_bar_frame', x, y, w, h, 1);
    const ff = A.frames[`ui_${fill}`];
    if (ff && A.img) {
      const iw = Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, r))));
      if (iw > 0) ctx.drawImage(A.img, ff.x, ff.y + Math.floor(ff.h / 2), 1, 1, x + 1, y + 1, iw, 1);
    }
  }

  /** Ground-effect zones (Ilka's firewall, Mira's sanctum) — drawn under units. */
  drawZones(ctx: CanvasRenderingContext2D, s: GameState, cam: Cam, t: number) {
    const A = this.atlas;
    for (const z of s.zones ?? []) {
      const fade = z.t < 0.4 ? z.t / 0.4 : 1;
      if (z.kind === 'firewall') {
        const len = Math.hypot(z.x2 - z.x, z.y2 - z.y);
        const n = Math.max(1, Math.round(len * 1.5));
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const wx = (z.x + (z.x2 - z.x) * u) * T, wy = (z.y + (z.y2 - z.y) * u) * T;
          A.drawC(ctx, `fx_firewall_${(Math.floor(t * 10) + i) % 3}`, wx - cam.x, wy - cam.y - 4, { alpha: fade });
        }
      } else {
        const cx = z.x * T - cam.x, cy = z.y * T - cam.y;
        const pts = Math.max(8, Math.round(z.r * 10));
        for (let i = 0; i < pts; i++) {
          const ang = (i / pts) * Math.PI * 2 + t * 0.5;
          A.drawC(ctx, 'ui_range_dot', cx + Math.cos(ang) * z.r * T, cy + Math.sin(ang) * z.r * T, { alpha: fade });
        }
        A.drawC(ctx, `fx_sanctum_${Math.floor(t * 4) % 2}`, cx, cy, { alpha: fade });
      }
    }
  }

  // ── projectiles ───────────────────────────────────────────────────────────
  drawProjectiles(ctx: CanvasRenderingContext2D, s: GameState, cam: Cam, a: number, t: number) {
    const A = this.atlas;
    for (const p of s.projectiles) {
      const pos = lerpPos(p, a);
      const x = Math.round(pos.x * T - cam.x), y = Math.round(pos.y * T - cam.y);
      if (x < -32 || y < -48 || x > cam.w + 32 || y > cam.h + 48) continue;
      const z = Math.round(p.z * T);
      if (z > 2) A.draw(ctx, 'prop_shadow_s', x, y + 2, { alpha: 0.6 });
      const name = projectileSprite(p, t);
      const rot = p.kind === 'fireball' || p.kind === 'mortar' || p.kind === 'spit' ? undefined : p.angle;
      A.drawC(ctx, name, x, y - z, { rot });
    }
  }
}

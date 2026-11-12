// In-run HUD (SPEC §10.2), laid out in UI px inside the safe area:
//   top-left Hearth bar + wood/stone/gold · top-centre phase clock (sun/moon on an arc) + "Night n/10" + enemies left
//   top-right Pause + minimap · left-middle hero portraits with HP and skill-cooldown rings · bottom-right Hammer and
//   Rally Horn (charge ring) · bottom-centre "Call night early" (DAY) / "Start night" (DUSK) · edge arrows · boss bar ·
//   banners · resources flying to the HUD · low-Hearth red vignette.
import { Sprite, Vec2, type Node } from 'cc';
import type { GameEvent, GameState, HeroId } from '../../core/api';
import type { Ctx } from '../Ctx';
import { edgeArrow } from '../logic/minimap';
import { flyPath, FLY_SEC, hudBump, lowHearthAlpha } from '../logic/juice';
import { fmtNum } from '../logic/text';
import { tr } from '../logic/strings';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';
import { BitmapText } from './BitmapText';
import { NineSlice } from './NineSlice';
import { Button, IconValue, uiInput, type Hit } from './UiKit';
import { Minimap } from './Minimap';

interface Fly { h: SpriteHandle; t: number; x0: number; y0: number; x1: number; y1: number; res: 'wood' | 'stone' | 'gold' }

export class Bar {
  readonly node: Node;
  readonly frame: NineSlice;
  readonly fill: SpriteHandle;
  constructor(parent: Node, readonly fillName: string, public w: number, public h: number) {
    this.node = mkNode('bar', parent);
    this.fill = new SpriteHandle('fill', this.node, fillName).anchor(0, 0);
    this.frame = new NineSlice(this.node, 'ui_bar_frame', w, h);
  }
  set(frac: number, fillName = this.fillName): this {
    const f = Math.max(0, Math.min(1, frac));
    const iw = this.w - 2, ih = this.h - 2;
    this.fill.set(fillName).size(Math.round(iw * f), ih).anchor(0, 0).pos(1, 1).show(f > 0);
    return this;
  }
  resize(w: number, h: number): this { this.w = w; this.h = h; this.frame.size(w, h); return this; }
  pos(x: number, y: number): this { this.node.setPosition(Math.round(x), Math.round(y), 0); return this; }
  show(v: boolean): this { if (this.node.active !== v) this.node.active = v; return this; }
}

class Portrait {
  readonly node: Node;
  readonly frame: NineSlice;
  readonly img: SpriteHandle;
  readonly cd: SpriteHandle;
  readonly bar: Bar;
  readonly lvl: BitmapText;
  id: HeroId | '' = '';
  constructor(parent: Node) {
    this.node = mkNode('portrait', parent);
    this.frame = new NineSlice(this.node, 'ui_panel_stone', 28, 28);
    this.img = new SpriteHandle('img', this.node).anchor(0, 0);
    this.cd = new SpriteHandle('cd', this.node).anchor(0, 0);
    this.bar = new Bar(this.node, 'ui_bar_fill_green', 28, 4);
    this.bar.pos(0, -5);
    this.lvl = new BitmapText(this.node, { ax: 1, ay: 0, color: PAL.z });
  }
}

export class Hud {
  readonly node: Node;
  private hearthIcon: SpriteHandle;
  private hearthBar: Bar;
  private hearthText: BitmapText;
  private res: Record<'wood' | 'stone' | 'gold', IconValue>;
  private bumpT: Record<'wood' | 'stone' | 'gold', number> = { wood: 9, stone: 9, gold: 9 };
  private arc: SpriteHandle[] = [];
  private sunMoon: SpriteHandle;
  private phaseText: BitmapText;
  private leftText: IconValue;
  readonly pause: Button;
  readonly hammer: Button;
  readonly horn: Button;
  private hornRing: SpriteHandle;
  readonly callNight: Button;
  readonly startNight: Button;
  readonly omensBtn: Button;
  private portraits: Portrait[] = [];
  private portraitHits: Hit[] = [];
  readonly minimap: Minimap;
  private arrows: SpriteHandle[] = [];
  private bossName: BitmapText;
  private bossBar: Bar;
  private banner: BitmapText;
  private bannerSub: BitmapText;
  private bannerT = 9; private bannerDur = 2.2;
  private toast: BitmapText;
  private toastT = 9;
  private vignette: SpriteHandle[] = [];
  private flies: Fly[] = [];
  private flyFree: SpriteHandle[] = [];
  private riftFlashT = 0;
  onPortrait: (squadIndex: number) => void = () => undefined;
  onOmens: () => void = () => undefined;

  constructor(parent: Node, readonly ctx: Ctx) {
    this.node = mkNode('hud', parent);
    // vignette strips first (drawn under everything else in the HUD)
    for (let i = 0; i < 4; i++) this.vignette.push(new SpriteHandle('vig', this.node).solid(1, 1).color(PAL.R[0], PAL.R[1], PAL.R[2], 0).show(false));
    this.hearthIcon = new SpriteHandle('hearthIcon', this.node, 'icon_fire').anchor(0, 0);
    this.hearthBar = new Bar(this.node, 'ui_bar_fill_red', 58, 8);
    this.hearthText = new BitmapText(this.node, { ax: 0.5, ay: 0.5, color: PAL.w });
    this.res = {
      wood: new IconValue(this.node, 'icon_wood'), stone: new IconValue(this.node, 'icon_stone'), gold: new IconValue(this.node, 'icon_gold', PAL.z),
    };
    for (let i = 0; i < 9; i++) this.arc.push(new SpriteHandle('arc', this.node, 'ui_range_dot').anchor(0.5, 0.5));
    this.sunMoon = new SpriteHandle('sun', this.node, 'icon_sun').anchor(0.5, 0.5);
    this.phaseText = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.w });
    this.leftText = new IconValue(this.node, 'icon_skull');
    this.pause = new Button(this.node, { icon: 'icon_pause', z: 20 });
    this.pause.onTap = () => { ctx.sfx('ui_click'); ctx.pause(true); };
    this.minimap = new Minimap(this.node, ctx);
    for (let i = 0; i < 5; i++) {
      const p = new Portrait(this.node);
      const idx = i;
      this.portraitHits.push(uiInput.add({
        x: 0, y: 0, w: 28, h: 33, z: 15,
        active: () => p.node.activeInHierarchy,
        onUp: (_x, _y, inside) => { if (inside) this.onPortrait(idx); },
      }));
      this.portraits.push(p);
    }
    this.hammer = new Button(this.node, { icon: 'icon_hammer', z: 20 });
    this.hammer.onTap = () => { ctx.sfx('ui_click'); ctx.cmd({ t: 'buildMode', on: true }); };
    this.horn = new Button(this.node, { icon: 'icon_horn', z: 20 });
    this.hornRing = new SpriteHandle('hornRing', this.horn.node).anchor(0.5, 0.5);
    this.horn.onTap = () => { ctx.cmd({ t: 'horn' }); };
    this.callNight = new Button(this.node, { icon: 'icon_moon', text: tr('hud.callNight'), z: 20 });
    this.callNight.onTap = () => { ctx.sfx('ui_click'); ctx.cmd({ t: 'callNight' }); };
    this.startNight = new Button(this.node, { icon: 'icon_moon', text: tr('hud.startNight'), z: 32 });
    this.startNight.onTap = () => { ctx.sfx('ui_click'); ctx.cmd({ t: 'startNight' }); };
    this.omensBtn = new Button(this.node, { icon: 'icon_skull', z: 32 });
    this.omensBtn.onTap = () => { ctx.sfx('ui_click'); this.onOmens(); };
    for (let i = 0; i < 12; i++) this.arrows.push(new SpriteHandle('arrow', this.node, 'ui_arrow_edge').anchor(0.5, 0.5).show(false));
    this.bossName = new BitmapText(this.node, { ax: 0.5, ay: 0, color: PAL.L });
    this.bossBar = new Bar(this.node, 'ui_bar_fill_red', 150, 9);
    this.banner = new BitmapText(this.node, { font: 'font7', ax: 0.5, ay: 0.5, color: PAL.z });
    this.bannerSub = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.w, align: 'center', maxWidth: 200 });
    this.toast = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.z, align: 'center', maxWidth: 200 });
    this.layout();
  }

  layout(): void {
    const L = this.ctx.layout;
    const top = L.H - L.top - 3, left = L.left + 4, right = L.W - L.right - 4, bottom = L.bottom + 6;
    this.hearthIcon.pos(left, top - 16);
    this.hearthBar.pos(left + 19, top - 12);
    this.hearthText.pos(left + 19 + 29, top - 8);
    this.res.wood.pos(left, top - 28);
    this.res.stone.pos(left, top - 45);
    this.res.gold.pos(left, top - 62);
    this.pause.layout(right - 22, top - 22, 22, 22);
    const mm = Math.round(112 / L.uiS);
    this.minimap.layout(right - mm, top - 28 - mm, mm);
    const py = Math.round(L.H * 0.66);
    this.portraits.forEach((p, i) => p.node.setPosition(left, py - i * 38, 0));
    this.portraitHits.forEach((h, i) => Object.assign(h, { x: left, y: py - i * 38 - 5 }));
    const hb = Math.max(32, Math.round(96 / L.uiS));
    this.horn.layout(right - hb, bottom, hb, hb);
    this.hornRing.pos(Math.round(hb / 2), Math.round(hb / 2));
    this.hammer.layout(right - hb * 2 - 6, bottom, hb, hb);
    this.callNight.layout(Math.round(L.W / 2) - 62, bottom + 2, 104, 26);
    this.startNight.layout(Math.round(L.W / 2) - 50, bottom + 110, 100, 26);
    this.omensBtn.layout(Math.round(L.W / 2) + 54, bottom + 110, 26, 26);
    this.bossName.pos(Math.round(L.W / 2), top - 88);
    this.bossBar.pos(Math.round(L.W / 2) - 75, top - 100);
    this.banner.pos(Math.round(L.W / 2), Math.round(L.H * 0.62));
    this.bannerSub.pos(Math.round(L.W / 2), Math.round(L.H * 0.62) - 14);
    this.toast.pos(Math.round(L.W / 2), top - 70);
    const vw = 6;
    this.vignette[0].solid(L.W, vw).pos(0, L.H - vw);
    this.vignette[1].solid(L.W, vw).pos(0, 0);
    this.vignette[2].solid(vw, L.H).pos(0, 0);
    this.vignette[3].solid(vw, L.H).pos(L.W - vw, 0);
  }

  banner_(text: string, sub = '', color: readonly number[] = PAL.z, dur = 2.2): void {
    this.banner.set(text, color); this.bannerSub.set(sub);
    this.bannerT = 0; this.bannerDur = dur;
  }
  showToast(text: string): void { this.toast.set(text); this.toastT = 0; }
  flashRifts(): void { this.riftFlashT = 1.6; }

  /** A resource icon flies from a tile position to its HUD counter, which bumps on arrival. */
  fly(res: 'wood' | 'stone' | 'gold', tx: number, ty: number): void {
    if (this.flies.length > 24) return;
    const from = this.ctx.tileToUi(tx, ty);
    const to = this.res[res].node.position;
    const h = this.flyFree.pop() ?? new SpriteHandle('fly', this.node);
    h.set(`icon_${res}`).anchor(0.5, 0.5).show(true).pos(Math.round(from.x), Math.round(from.y));
    this.flies.push({ h, t: 0, x0: from.x, y0: from.y, x1: to.x + 8, y1: to.y, res });
  }

  onEvent(e: GameEvent): void {
    switch (e.t) {
      case 'shrine': this.showToast(tr(`shrine.${e.buff}`)); break;
      case 'enrage': this.banner_(tr('banner.enrage'), '', PAL.L, 1.8); break;
      case 'buildFail': this.showToast(tr(`build.fail.${e.reason}`)); break;
      case 'hired': this.showToast(tr('cage.freed', { name: tr(`hero.${e.hero}.name`) })); break;
      case 'poi':
        if (e.kind === 'root' && e.action === 'destroyed') this.showToast(tr('root.destroyed'));
        if (e.kind === 'cage' && e.action === 'freed') this.showToast(tr('poi.cage'));
        break;
      case 'hearthLow': this.showToast(tr('hud.hearthLow')); break;
      default: break;
    }
  }

  update(s: GameState, dt: number): void {
    const ctx = this.ctx, L = ctx.layout, t = ctx.time;
    const hearth = s.buildings.find((b) => b.uid === s.hearthUid);
    const hf = hearth && hearth.maxHp > 0 ? hearth.hp / hearth.maxHp : 0;
    this.hearthBar.set(hf);
    this.hearthText.set(hearth ? `${Math.ceil(hearth.hp)}` : '0');
    for (const k of ['wood', 'stone', 'gold'] as const) {
      this.bumpT[k] += dt;
      const b = hudBump(this.bumpT[k]);
      this.res[k].set(fmtNum(s.res[k]));
      this.res[k].node.setScale(b, b, 1);
    }
    // phase clock: icon travels along a half-circle arc left → right over the phase
    const night = s.phase === 'night';
    const prog = s.phaseDur > 0 ? Math.max(0, Math.min(1, s.phaseT / s.phaseDur)) : s.phase === 'dusk' ? 1 : 0;
    const cx = Math.round(L.W / 2), cy = L.H - L.top - 26, r = 18;
    for (let i = 0; i < this.arc.length; i++) {
      const a = Math.PI * (1 - i / (this.arc.length - 1));
      this.arc[i].pos(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)).alpha(i / (this.arc.length - 1) <= prog ? 255 : 110);
    }
    const a = Math.PI * (1 - prog);
    this.sunMoon.set(night || s.phase === 'dusk' ? 'icon_moon' : 'icon_sun').pos(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r));
    const nightN = s.night;
    const title = s.endless || nightN > 10 ? tr('hud.nightEndless', { n: nightN }) : tr('hud.night', { n: nightN });
    this.phaseText.set(`${tr(`phase.${s.phase}`)} - ${title}`).pos(cx, cy - 6);
    if (night) {
      this.leftText.show(true).set(tr('hud.enemiesLeft', { n: s.enemiesLeft })).pos(cx - Math.round(this.leftText.width / 2), cy - 22);
    } else this.leftText.show(false);

    // portraits
    for (let i = 0; i < this.portraits.length; i++) {
      const p = this.portraits[i], h = s.heroes[i];
      if (!h) { p.node.active = false; continue; }
      p.node.active = true;
      if (p.id !== h.id) { p.id = h.id; p.img.set(`portrait_${h.id}`).pos(2, 2); }
      p.img.alpha(h.anim === 'down' ? 110 : 255);
      p.bar.set(h.maxHp > 0 ? h.hp / h.maxHp : 0);
      const cdf = h.skillCdMax > 0 ? Math.max(0, Math.min(1, h.skillCd / h.skillCdMax)) : 0;
      if (cdf > 0.001) {
        p.cd.set(`portrait_${h.id}`, true).pos(2, 2).color(PAL.k[0], PAL.k[1], PAL.k[2], 170).show(true)
          .fill(Sprite.FillType.RADIAL, 0.25, cdf, new Vec2(0.5, 0.5));
      } else p.cd.show(false);
      p.lvl.set(`${h.level}`).pos(27, 1);
      p.frame.setFrame(h.leader ? 'ui_panel_parchment' : 'ui_panel_stone');
    }

    // bottom buttons by phase / mode
    const inBuild = s.buildMode || s.phase === 'dusk';
    const playing = s.phase === 'day' || s.phase === 'night';
    this.hammer.show(playing && !s.buildMode);
    this.horn.show(playing && !s.buildMode);
    this.callNight.show(s.phase === 'day' && !s.buildMode);
    if (s.phase === 'day') this.callNight.setText(tr('hud.callNight'));
    this.startNight.show(s.phase === 'dusk');
    this.omensBtn.show(s.phase === 'dusk');
    void inBuild;
    const charge = Math.max(0, Math.min(1, s.hornCharge));
    this.horn.setEnabled(charge >= 1 && s.hornT <= 0);
    if (charge < 1) {
      this.hornRing.set('icon_horn', true).color(PAL.z[0], PAL.z[1], PAL.z[2], 150).show(true)
        .fill(Sprite.FillType.RADIAL, 0.25, charge, new Vec2(0.5, 0.5));
    } else {
      this.hornRing.show(s.hornT > 0);
      if (s.hornT > 0) this.hornRing.set('icon_horn', true).color(PAL.y[0], PAL.y[1], PAL.y[2], Math.round(120 + 100 * Math.sin(t * 10)));
    }

    // boss bar
    if (s.boss) {
      this.bossName.show(true).set(tr(`enemy.${s.boss.id}.name`));
      this.bossBar.show(true).set(s.boss.maxHp > 0 ? s.boss.hp / s.boss.maxHp : 0);
    } else { this.bossName.show(false); this.bossBar.show(false); }

    // banner + toast
    this.bannerT += dt;
    const ba = this.bannerT < 0.25 ? this.bannerT / 0.25 : this.bannerT > this.bannerDur - 0.4 ? Math.max(0, (this.bannerDur - this.bannerT) / 0.4) : 1;
    this.banner.show(this.bannerT < this.bannerDur).alpha(ba * 255);
    this.bannerSub.show(this.bannerT < this.bannerDur).alpha(ba * 255);
    const bs = this.bannerT < 0.25 ? 2 - this.bannerT / 0.25 : 1;
    this.banner.node.setScale(bs * 2, bs * 2, 1);
    this.toastT += dt;
    this.toast.show(this.toastT < 2.5).alpha(255 * Math.min(1, (2.5 - this.toastT) / 0.4));

    // low-Hearth vignette (+ rift flash at night start in purple)
    this.riftFlashT = Math.max(0, this.riftFlashT - dt);
    const va = lowHearthAlpha(hf, t);
    for (const v of this.vignette) {
      if (va > 0) v.show(true).color(PAL.R[0], PAL.R[1], PAL.R[2], Math.round(va * 200));
      else v.show(false);
    }

    this.updateArrows(s, t);
    this.minimap.update(s, dt);

    // flying resources
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      f.t += dt;
      const k = f.t / FLY_SEC;
      if (k >= 1) {
        f.h.show(false); this.flyFree.push(f.h); this.flies.splice(i, 1);
        this.bumpT[f.res] = 0;
        continue;
      }
      const p = flyPath(k, f.x0, f.y0, f.x1, f.y1);
      f.h.pos(Math.round(p.x), Math.round(p.y));
    }
    void L;
  }

  private updateArrows(s: GameState, t: number): void {
    const L = this.ctx.layout;
    const inset = { x: L.left + 10, y: L.bottom + 10, w: L.W - L.left - L.right - 20, h: L.H - L.top - L.bottom - 20 };
    let i = 0;
    const put = (tx: number, ty: number, tint: readonly number[], pulse: boolean) => {
      if (i >= this.arrows.length) return;
      const p = this.ctx.tileToUi(tx, ty);
      const a = edgeArrow(p, inset);
      if (a.onScreen) return;
      const h = this.arrows[i++];
      const bob = pulse ? Math.round(Math.sin(t * 8) * 1.5) : 0;
      h.show(true).pos(Math.round(a.x - Math.cos((a.angle * Math.PI) / 180) * bob), Math.round(a.y - Math.sin((a.angle * Math.PI) / 180) * bob))
        .angle(Math.round(a.angle)).color(tint[0], tint[1], tint[2], 255);
    };
    const hearth = s.buildings.find((b) => b.uid === s.hearthUid);
    if (hearth) put(hearth.x + hearth.w / 2, hearth.y + hearth.h / 2, PAL.z, false);
    if (s.phase === 'night' || s.phase === 'dusk' || this.riftFlashT > 0) {
      for (const p of s.pois) if (p.kind === 'rift' && p.active) put(p.x + 0.5, p.y + 0.5, PAL.L, true);
    }
    const now = this.ctx.time;
    for (const [uid, at] of this.ctx.ents.attacked) {
      if (now - at > 2.5) { this.ctx.ents.attacked.delete(uid); continue; }
      const b = s.buildings.find((q) => q.uid === uid);
      if (b) put(b.x + b.w / 2, b.y + b.h / 2, PAL.R, true);
    }
    for (; i < this.arrows.length; i++) this.arrows[i].show(false);
  }

  show(v: boolean): void { if (this.node.active !== v) this.node.active = v; }
}

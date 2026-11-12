// Full-screen and modal screens (SPEC §10.1): Title, Barracks (heroes / talents / blueprints), Settings, Pause,
// Dawn (night summary + boons + tavern), Victory / Defeat (stats + Ember), and the squad-swap popup.
import type { Node } from 'cc';
import type { BuildingId, GameState, HeroId } from '../../core/api';
import type { Ctx } from '../Ctx';
import {
  BLUEPRINTS, blueprintCost, buyBlueprint, buyHero, buyTalent, HERO_LIST, heroUnlockCost, previewSprite, setStarterHero,
  TALENT_LIST, talentNextCost,
} from '../logic/catalog';
import { getLang, tr } from '../logic/strings';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';
import { BitmapText } from './BitmapText';
import { BoonPicker } from './BoonPicker';
import { NineSlice } from './NineSlice';
import { blocker, Button, IconValue } from './UiKit';

abstract class Screen {
  readonly node: Node;
  protected dim: SpriteHandle;
  protected panel: NineSlice;
  constructor(parent: Node, readonly ctx: Ctx, readonly z: number, dimAlpha = 150, panelFrame = 'ui_panel_stone') {
    this.node = mkNode('screen', parent);
    this.dim = new SpriteHandle('dim', this.node).solid(1, 1).color(PAL.k[0], PAL.k[1], PAL.k[2], dimAlpha);
    this.panel = new NineSlice(this.node, panelFrame);
    blocker(this.node, z - 1, () => ({ x: 0, y: 0, w: this.ctx.layout.W, h: this.ctx.layout.H }));
    this.node.active = false;
  }
  show(v: boolean): void { if (this.node.active !== v) { this.node.active = v; if (v) { this.layout(); this.refresh(); } } }
  get shown(): boolean { return this.node.active; }
  layout(): void {
    const L = this.ctx.layout;
    this.dim.solid(L.W, L.H).pos(0, 0);
  }
  refresh(): void { /* optional */ }
  btn(opts: { icon?: string; text?: string }, onTap: () => void): Button {
    const b = new Button(this.node, { ...opts, z: this.z });
    b.onTap = () => { this.ctx.sfx('ui_click'); onTap(); };
    return b;
  }
}

// ── Title ────────────────────────────────────────────────────────────────────
export class TitleScreen extends Screen {
  private logo: SpriteHandle;
  private play: Button; private cont: Button; private barracks: Button; private settings: Button;
  private ember: IconValue;
  private hint: BitmapText;
  constructor(parent: Node, ctx: Ctx) {
    super(parent, ctx, 80, 60);
    this.panel.show(false);
    this.logo = new SpriteHandle('logo', this.node, 'logo').anchor(0.5, 0.5);
    this.play = this.btn({ icon: 'icon_play', text: tr('ui.play') }, () => ctx.startRun(false));
    this.cont = this.btn({ icon: 'icon_fire', text: tr('ui.continue') }, () => ctx.startRun(true));
    this.barracks = this.btn({ icon: 'icon_shield', text: tr('ui.barracks') }, () => ctx.go('barracks'));
    this.settings = this.btn({ icon: 'icon_settings', text: tr('ui.settings') }, () => ctx.go('settings'));
    this.ember = new IconValue(this.node, 'icon_ember', PAL.y);
    this.hint = new BitmapText(this.node, { ax: 0.5, ay: 0, color: PAL.u });
  }
  layout(): void {
    super.layout();
    const L = this.ctx.layout, cx = Math.round(L.W / 2);
    this.logo.pos(cx, Math.round(L.H * 0.72));
    const bw = 130, bh = 28, y0 = Math.round(L.H * 0.44);
    this.play.layout(cx - bw / 2, y0, bw, bh);
    this.cont.layout(cx - bw / 2, y0 - 36, bw, bh);
    this.barracks.layout(cx - bw / 2, y0 - 72, bw, bh);
    this.settings.layout(cx - bw / 2, y0 - 108, bw, bh);
    this.hint.pos(cx, L.bottom + 8);
  }
  refresh(): void {
    this.play.setText(tr('ui.play')); this.cont.setText(tr('ui.continue'));
    this.barracks.setText(tr('ui.barracks')); this.settings.setText(tr('ui.settings'));
    this.cont.show(this.ctx.hasRunSave());
    const L = this.ctx.layout;
    this.ember.set(`${this.ctx.meta.ember} ${tr('ui.ember')}`).pos(L.left + 6, L.H - L.top - 14);
    this.hint.set('v1.0');
  }
}

// ── Barracks ─────────────────────────────────────────────────────────────────
type BTab = 'heroes' | 'talents' | 'blueprints';
const TALENT_ICON: Record<string, string> = {
  startWood: 'icon_wood', startStone: 'icon_stone', hearthHp: 'icon_heart', longDay: 'icon_sun', heroLevel: 'icon_sword',
  refund: 'icon_sell', chestChoice: 'icon_gold', hornPrecharge: 'icon_horn',
};

class Line {
  readonly node: Node;
  readonly img: SpriteHandle;
  readonly title: BitmapText;
  readonly sub: BitmapText;
  readonly action: Button;
  constructor(parent: Node, z: number) {
    this.node = mkNode('line', parent);
    this.img = new SpriteHandle('img', this.node).anchor(0.5, 0.5);
    this.title = new BitmapText(this.node, { ax: 0, ay: 1, color: PAL.z, scalable: false });
    this.sub = new BitmapText(this.node, { ax: 0, ay: 1, color: PAL.w, scalable: false, maxWidth: 120 });
    this.action = new Button(this.node, { text: '', z });
  }
}

export class BarracksScreen extends Screen {
  private tabs: Button[] = [];
  private tab: BTab = 'heroes';
  private lines: Line[] = [];
  private back: Button;
  private ember: IconValue;
  private title: BitmapText;
  constructor(parent: Node, ctx: Ctx) {
    super(parent, ctx, 80, 230, 'ui_panel_stone');
    this.title = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.z });
    (['heroes', 'talents', 'blueprints'] as BTab[]).forEach((t) => {
      const b = new Button(this.node, { text: tr(`ui.${t}`), style: 'tab', z: 80 });
      b.onTap = () => { ctx.sfx('ui_click'); this.tab = t; this.refresh(); };
      this.tabs.push(b);
    });
    for (let i = 0; i < 8; i++) this.lines.push(new Line(this.node, 80));
    this.back = this.btn({ icon: 'icon_close', text: tr('ui.back') }, () => ctx.go('title'));
    this.ember = new IconValue(this.node, 'icon_ember', PAL.y);
  }
  layout(): void {
    super.layout();
    const L = this.ctx.layout;
    const top = L.H - L.top - 6, w = L.W - 12;
    this.panel.size(w, top - L.bottom - 44).pos(6, L.bottom + 40);
    this.title.pos(Math.round(L.W / 2), top - 2);
    const tw = Math.floor((w - 8) / 3);
    this.tabs.forEach((b, i) => b.layout(10 + i * tw, top - 36, tw - 2, 18));
    this.ember.pos(12, top - 22);
    this.back.layout(Math.round(L.W / 2) - 50, L.bottom + 6, 100, 26);
    const rowH = Math.min(40, Math.floor((top - 44 - (L.bottom + 46)) / 8));
    this.lines.forEach((l, i) => {
      l.node.setPosition(14, top - 42 - (i + 1) * rowH, 0);
      l.img.pos(12, Math.round(rowH / 2));
      l.title.pos(28, rowH - 3);
      l.sub.pos(28, rowH - 13);
      l.action.layout(w - 74, Math.round(rowH / 2) - 11, 64, 22).offset(14, top - 42 - (i + 1) * rowH);
    });
  }
  refresh(): void {
    const ctx = this.ctx, m = ctx.meta;
    this.title.set(tr('ui.barracks'));
    this.ember.set(`${m.ember}`);
    this.tabs.forEach((b, i) => { b.setSelected(['heroes', 'talents', 'blueprints'][i] === this.tab); });
    const rows: Array<{ img: string; title: string; sub: string; action: string; enabled: boolean; on: () => void; selected?: boolean }> = [];
    if (this.tab === 'heroes') {
      for (const id of HERO_LIST) {
        const owned = m.unlockedHeroes.includes(id);
        const starter = m.starterHero === id;
        rows.push({
          img: `portrait_${id}`, title: `${tr(`hero.${id}.name`)} - ${tr(`hero.${id}.role`)}`, sub: tr(`hero.${id}.skillDesc`),
          action: owned ? (starter ? tr('ui.starter') : tr('ui.choose')) : `${tr('ui.unlock')} ${heroUnlockCost(id)}`,
          enabled: owned ? !starter : m.ember >= heroUnlockCost(id), selected: starter,
          on: () => { if (owned) setStarterHero(m, id); else if (!buyHero(m, id)) return; else ctx.sfx('upgrade'); ctx.saveMeta(); this.refresh(); },
        });
      }
    } else if (this.tab === 'talents') {
      for (const t of TALENT_LIST) {
        const lv = m.talents[t.id] ?? 0;
        const cost = talentNextCost(m, t.id);
        rows.push({
          img: TALENT_ICON[t.id] ?? 'icon_tick', title: `${tr(`talent.${t.id}.name`)} ${lv}/${t.maxLevel}`, sub: tr(`talent.${t.id}.desc`),
          action: cost === null ? tr('ui.max') : `${cost}`, enabled: cost !== null && m.ember >= cost,
          on: () => { if (buyTalent(m, t.id)) { ctx.saveMeta(); ctx.sfx('upgrade'); this.refresh(); } },
        });
      }
    } else {
      for (const id of BLUEPRINTS) {
        const owned = m.unlockedBlueprints.includes(id);
        rows.push({
          img: previewSprite(id as BuildingId), title: tr(`bld.${id}.name`), sub: tr(`bld.${id}.desc`),
          action: owned ? tr('ui.unlocked') : `${tr('ui.unlock')} ${blueprintCost(id)}`, enabled: !owned && m.ember >= blueprintCost(id),
          on: () => { if (buyBlueprint(m, id)) { ctx.saveMeta(); ctx.sfx('upgrade'); this.refresh(); } },
        });
      }
    }
    this.lines.forEach((l, i) => {
      const r = rows[i];
      if (!r) { l.node.active = false; return; }
      l.node.active = true;
      l.img.set(r.img);
      l.img.anchor(0.5, 0.5);
      l.title.set(r.title);
      l.sub.set(r.sub);
      l.action.setText(r.action).setEnabled(r.enabled).setSelected(!!r.selected);
      l.action.onTap = () => { ctx.sfx('ui_click'); r.on(); };
    });
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────
export class SettingsScreen extends Screen {
  private title: BitmapText;
  private labels: BitmapText[] = [];
  private music = { minus: null as unknown as Button, plus: null as unknown as Button, val: null as unknown as BitmapText };
  private sfx = { minus: null as unknown as Button, plus: null as unknown as Button, val: null as unknown as BitmapText };
  private haptics: Button; private big: Button; private lang: Button; private erase: Button; private back: Button;
  private confirm: Button; private cancel: Button; private confirmText: BitmapText;
  private confirming = false;
  returnTo: 'title' | 'pause' = 'title';
  onClose: () => void = () => undefined;
  onChange: () => void = () => undefined;

  constructor(parent: Node, ctx: Ctx) {
    super(parent, ctx, 90, 200, 'ui_panel_parchment');
    this.title = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.z });
    for (let i = 0; i < 6; i++) this.labels.push(new BitmapText(this.node, { ax: 0, ay: 0.5, color: PAL.w }));
    const vol = (o: typeof this.music, key: 'music' | 'sfx') => {
      o.minus = this.btn({ text: '-' }, () => this.setVol(key, -0.1));
      o.plus = this.btn({ text: '+' }, () => this.setVol(key, 0.1));
      o.val = new BitmapText(this.node, { ax: 0.5, ay: 0.5, color: PAL.z });
    };
    vol(this.music, 'music'); vol(this.sfx, 'sfx');
    this.haptics = this.btn({ icon: 'icon_vibrate', text: '' }, () => { ctx.meta.settings.haptics = !ctx.meta.settings.haptics; this.changed(); ctx.vibrate(30); });
    this.big = this.btn({ text: '' }, () => { ctx.meta.settings.bigText = !ctx.meta.settings.bigText; this.changed(); });
    this.lang = this.btn({ text: '' }, () => { ctx.meta.settings.lang = ctx.meta.settings.lang === 'en' ? 'vi' : 'en'; this.changed(); });
    this.erase = this.btn({ icon: 'icon_skull', text: '' }, () => { this.confirming = true; this.refresh(); });
    this.back = this.btn({ icon: 'icon_close', text: '' }, () => this.onClose());
    this.confirmText = new BitmapText(this.node, { ax: 0.5, ay: 0, color: PAL.o, align: 'center', maxWidth: 180 });
    this.confirm = this.btn({ icon: 'icon_tick', text: '' }, () => { this.confirming = false; this.onErase(); });
    this.cancel = this.btn({ icon: 'icon_close', text: '' }, () => { this.confirming = false; this.refresh(); });
  }
  onErase: () => void = () => undefined;

  private setVol(key: 'music' | 'sfx', d: number): void {
    const s = this.ctx.meta.settings;
    s[key] = Math.round(Math.max(0, Math.min(1, s[key] + d)) * 10) / 10;
    this.changed();
  }
  private changed(): void { this.ctx.saveMeta(); this.onChange(); this.layout(); this.refresh(); }

  layout(): void {
    super.layout();
    const L = this.ctx.layout;
    const w = Math.min(L.W - 16, 220), h = 250, x = Math.round((L.W - w) / 2), y = Math.round((L.H - h) / 2);
    this.panel.size(w, h).pos(x, y);
    this.title.pos(x + w / 2, y + h - 8);
    const row = (i: number) => y + h - 40 - i * 30;
    this.labels.forEach((l, i) => l.pos(x + 10, row(i)));
    const vx = x + w - 92;
    [this.music, this.sfx].forEach((o, i) => {
      o.minus.layout(vx, row(i) - 11, 24, 22);
      o.val.pos(vx + 41, row(i));
      o.plus.layout(vx + 58, row(i) - 11, 24, 22);
    });
    this.haptics.layout(vx, row(2) - 11, 82, 22);
    this.big.layout(vx, row(3) - 11, 82, 22);
    this.lang.layout(vx, row(4) - 11, 82, 22);
    this.erase.layout(vx, row(5) - 11, 82, 22);
    this.back.layout(x + w / 2 - 45, y + 8, 90, 24);
    this.confirmText.pos(x + w / 2, y + 70);
    this.confirm.layout(x + w / 2 - 60, y + 40, 54, 24);
    this.cancel.layout(x + w / 2 + 6, y + 40, 54, 24);
  }
  refresh(): void {
    const s = this.ctx.meta.settings;
    this.title.set(tr('ui.settings'));
    ['ui.music', 'ui.sfx', 'ui.haptics', 'ui.bigText', 'ui.language', 'ui.resetData'].forEach((k, i) => this.labels[i].set(tr(k)));
    this.music.val.set(`${Math.round(s.music * 10)}`);
    this.sfx.val.set(`${Math.round(s.sfx * 10)}`);
    this.haptics.setText(s.haptics ? tr('ui.on') : tr('ui.off'));
    this.big.setText(s.bigText ? tr('ui.on') : tr('ui.off'));
    this.lang.setText(getLang() === 'vi' ? tr('ui.vietnamese') : tr('ui.english'));
    this.erase.setText(tr('ui.erase'));
    this.back.setText(tr('ui.back'));
    this.confirmText.set(this.confirming ? tr('ui.resetConfirm') : '');
    this.confirm.show(this.confirming).setText(tr('ui.yes'));
    this.cancel.show(this.confirming).setText(tr('ui.no'));
  }
}

// ── Pause ────────────────────────────────────────────────────────────────────
export class PauseScreen extends Screen {
  private title: BitmapText;
  private resume: Button; private settings: Button; private quit: Button;
  constructor(parent: Node, ctx: Ctx, onSettings: () => void) {
    super(parent, ctx, 85, 160, 'ui_panel_parchment');
    this.title = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.z });
    this.resume = this.btn({ icon: 'icon_play', text: tr('ui.resume') }, () => ctx.pause(false));
    this.settings = this.btn({ icon: 'icon_settings', text: tr('ui.settings') }, onSettings);
    this.quit = this.btn({ icon: 'icon_close', text: tr('ui.quit') }, () => ctx.quitToTitle());
  }
  layout(): void {
    super.layout();
    const L = this.ctx.layout;
    const w = 150, h = 140, x = Math.round((L.W - w) / 2), y = Math.round((L.H - h) / 2);
    this.panel.size(w, h).pos(x, y);
    this.title.pos(L.W / 2, y + h - 8);
    this.resume.layout(x + 12, y + 74, w - 24, 26);
    this.settings.layout(x + 12, y + 42, w - 24, 26);
    this.quit.layout(x + 12, y + 10, w - 24, 26);
  }
  refresh(): void {
    this.title.set(tr('ui.pause'));
    this.resume.setText(tr('ui.resume')); this.settings.setText(tr('ui.settings')); this.quit.setText(tr('ui.quit'));
  }
}

// ── Dawn (summary + boons + tavern) and chest picks ──────────────────────────
export class DawnScreen extends Screen {
  private title: BitmapText;
  private lines: BitmapText;
  readonly boons: BoonPicker;
  private hire: Button[] = [];
  private hireImg: SpriteHandle[] = [];
  constructor(parent: Node, ctx: Ctx) {
    super(parent, ctx, 70, 140, 'ui_panel_parchment');
    this.title = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.z });
    this.lines = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.w, align: 'center' });
    this.boons = new BoonPicker(this.node, ctx);
    for (let i = 0; i < 2; i++) {
      const b = this.btn({ icon: 'icon_gold', text: '' }, () => ctx.cmd({ t: 'hire', index: i }));
      this.hire.push(b);
      this.hireImg.push(new SpriteHandle('hireImg', this.node).anchor(0.5, 0));
    }
  }
  update(s: GameState, dt: number): void {
    const L = this.ctx.layout;
    const dawn = s.phase === 'dawn';
    const top = L.H - L.top - 40;
    if (dawn) {
      this.panel.show(true).size(L.W - 24, 70).pos(12, top - 70);
      this.title.show(true).set(tr('dawn.title')).pos(L.W / 2, top - 6);
      this.lines.show(true).set(`${tr('dawn.summary', { n: Math.max(1, s.night) })}\n${tr('dawn.kills')}: ${s.stats.kills}   ${tr('dawn.gold')}: ${s.stats.goldEarned}`)
        .pos(L.W / 2, top - 22);
    } else { this.panel.show(false); this.title.show(false); this.lines.show(false); }
    this.dim.alpha(dawn ? 140 : 90);
    this.boons.update(s.boonOffer, s.boonSource ?? (dawn ? 'dawn' : 'chest'), Math.round(L.H * 0.3), dt);
    const offer = dawn && !s.boonOffer ? s.tavernOffer : null;
    for (let i = 0; i < this.hire.length; i++) {
      const o = offer?.[i];
      if (!o) { this.hire[i].show(false); this.hireImg[i].show(false); continue; }
      const x = Math.round(L.W / 2) + (i === 0 ? -100 : 8);
      this.hireImg[i].show(true).set(`portrait_${o.hero}`).pos(x + 46, Math.round(L.H * 0.42));
      this.hire[i].show(true).layout(x, Math.round(L.H * 0.36), 92, 24).setText(tr('tavern.hire', { n: o.cost })).setEnabled(s.res.gold >= o.cost);
    }
  }
}

// ── Victory / Defeat ─────────────────────────────────────────────────────────
export class EndScreen extends Screen {
  private title: BitmapText;
  private sub: BitmapText;
  private stats: BitmapText;
  private ember: IconValue;
  private endless: Button; private toTitle: Button;
  private art: SpriteHandle;
  constructor(parent: Node, ctx: Ctx, readonly victory: boolean) {
    super(parent, ctx, 75, 170, 'ui_panel_parchment');
    this.title = new BitmapText(this.node, { font: 'font5', ax: 0.5, ay: 1, color: victory ? PAL.z : PAL.R });
    this.sub = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.w });
    this.stats = new BitmapText(this.node, { ax: 0, ay: 1, color: PAL.w });
    this.ember = new IconValue(this.node, 'icon_ember', PAL.y);
    this.art = new SpriteHandle('art', this.node, victory ? 'icon_sun' : 'icon_skull').anchor(0.5, 0.5).scale(2);
    this.endless = this.btn({ icon: 'icon_moon', text: tr('end.endless') }, () => ctx.cmd({ t: 'endless' }));
    this.toTitle = this.btn({ icon: 'icon_close', text: tr('end.title') }, () => ctx.quitToTitle());
  }
  emberEarned = 0;
  layout(): void {
    super.layout();
    const L = this.ctx.layout;
    const w = Math.min(L.W - 20, 210), h = 220, x = Math.round((L.W - w) / 2), y = Math.round((L.H - h) / 2);
    this.panel.size(w, h).pos(x, y);
    this.art.pos(L.W / 2, y + h - 22);
    this.title.pos(L.W / 2, y + h - 44);
    this.sub.pos(L.W / 2, y + h - 58);
    this.stats.pos(x + 16, y + h - 78);
    this.ember.pos(x + 16, y + 84);
    this.endless.layout(x + 12, y + 44, w - 24, 26);
    this.toTitle.layout(x + 12, y + 12, w - 24, 26);
  }
  update(s: GameState): void {
    this.title.set(tr(this.victory ? 'phase.victory' : 'phase.defeat'));
    this.title.node.setScale(2, 2, 1);
    this.sub.set(tr(this.victory ? 'end.victory' : 'end.defeat'));
    const st = s.stats;
    this.stats.set([
      `${tr('end.nights')}: ${st.nightsSurvived}`, `${tr('end.bosses')}: ${st.bosses}`, `${tr('end.camps')}: ${st.camps}`,
      `${tr('end.kills')}: ${st.kills}`, `${tr('end.built')}: ${st.built}`,
    ].join('\n'));
    this.ember.set(`${tr('end.ember')}: +${this.emberEarned}`);
    this.endless.show(this.victory).setText(tr('end.endless'));
    this.toTitle.setText(tr('end.title'));
  }
}

// ── Squad swap popup ─────────────────────────────────────────────────────────
export class SquadPopup extends Screen {
  private title: BitmapText;
  private picks: Button[] = [];
  private close: Button;
  squadIndex = 0;
  constructor(parent: Node, ctx: Ctx) {
    super(parent, ctx, 65, 120, 'ui_panel_stone');
    this.title = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.z });
    for (let i = 0; i < 6; i++) {
      const b = this.btn({ icon: 'portrait_knight' }, () => { ctx.cmd({ t: 'swapHero', reserveIndex: i, squadIndex: this.squadIndex }); this.show(false); });
      this.picks.push(b);
    }
    this.close = this.btn({ icon: 'icon_close' }, () => this.show(false));
  }
  open(squadIndex: number): void { this.squadIndex = squadIndex; this.show(true); }
  update(s: GameState): void {
    if (!this.shown) return;
    const L = this.ctx.layout;
    const n = s.reserve.length;
    if (!n || (s.phase !== 'day' && s.phase !== 'dusk' && s.phase !== 'dawn')) { this.show(false); return; }
    const w = Math.min(L.W - 20, 36 * Math.max(3, n) + 20), h = 74, x = Math.round((L.W - w) / 2), y = Math.round(L.H * 0.5);
    this.panel.size(w, h).pos(x, y);
    this.title.set(`${tr('squad.swap')}: ${tr(`hero.${s.heroes[this.squadIndex]?.id ?? 'knight'}.name`)}`).pos(L.W / 2, y + h - 6);
    this.picks.forEach((b, i) => {
      const id: HeroId | undefined = s.reserve[i];
      if (!id) { b.show(false); return; }
      b.show(true).layout(x + 10 + i * 36, y + 12, 32, 34).setIcon(`portrait_${id}`);
    });
    this.close.layout(x + w - 24, y + h - 24, 20, 20);
  }
}

// PEACE bottom bar (SPEC §10.5): Build · Heroes · Village · Book · Map — each tab appears only once its system is
// unlocked (§2.7) and pulses the first time it shows up. Above it: the Dusk Bell (ring early, +10% night loot with ≥ 60 s
// of day left). Also the "Next goal" strip under the resources (§2.5): one line, tap to unfold the session / day / week
// goals, tap a goal to go where it is done.
import type { Node } from 'cc';
import type { GameState } from '../../core/api';
import type { Ctx } from '../Ctx';
import { bottomTabs, goalTarget, parseGoal, TAB_ICON, TAB_ORDER, type TabId } from '../logic/nav';
import { hasText, tr } from '../logic/strings';
import { clip } from '../logic/format';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';
import { BitmapText } from './BitmapText';
import { NineSlice } from './NineSlice';
import { Button, uiInput, type Hit } from './UiKit';

export const BAR_H = 38;

export class BottomBar {
  readonly node: Node;
  private bg: NineSlice;
  readonly tabs: Record<TabId, Button>;
  private labels: Record<TabId, BitmapText>;
  readonly bell: Button;
  private bellSub: BitmapText;
  private seen = new Set<TabId>();
  private pulseT = new Map<TabId, number>();
  private visible: TabId[] = [];
  height = BAR_H;

  constructor(parent: Node, readonly ctx: Ctx) {
    this.node = mkNode('bottomBar', parent);
    this.bg = new NineSlice(this.node, 'ui_bottombar');
    const tabs = {} as Record<TabId, Button>, labels = {} as Record<TabId, BitmapText>;
    for (const id of TAB_ORDER) {
      const b = new Button(this.node, { icon: TAB_ICON[id], z: 22, frames: { up: 'ui_tab_icon_off', down: 'ui_tab_icon_on' } });
      b.onTap = () => this.tap(id);
      tabs[id] = b;
      labels[id] = new BitmapText(this.node, { ax: 0.5, ay: 0, color: PAL.w, scalable: false });
    }
    this.tabs = tabs; this.labels = labels;
    this.bell = new Button(this.node, { icon: 'icon_moon', text: tr('hud.bell'), z: 22 });
    this.bell.onTap = () => { ctx.sfx(['bell', 'night_horn'], 2); ctx.cmd({ t: 'ringBell' }); };
    this.bellSub = new BitmapText(this.node, { ax: 0.5, ay: 0, color: PAL.z, scalable: false });
  }

  private tap(id: TabId): void {
    this.ctx.sfx('ui_click');
    this.pulseT.delete(id);
    if (id === 'build') { this.ctx.closePanel(); this.ctx.cmd({ t: 'buildMode', on: true }); return; }
    this.ctx.open(id);
  }

  layout(): void {
    const L = this.ctx.layout;
    this.height = BAR_H + L.bottom;
    this.bg.size(L.W + 8, this.height + 2).pos(-4, -2);
    const n = Math.max(1, this.visible.length);
    const w = Math.min(46, Math.floor((L.W - L.left - L.right - 8) / n));
    const x0 = Math.round((L.W - n * w) / 2);
    this.visible.forEach((id, i) => {
      this.tabs[id].layout(x0 + i * w + 1, L.bottom + 10, w - 2, BAR_H - 12);
      this.labels[id].pos(x0 + i * w + Math.round(w / 2), L.bottom + 1);
    });
    this.bell.setText(tr('hud.bell'));
    const bw = Math.max(80, this.bell.contentWidth());
    this.bell.layout(L.left + 6, this.height + 6, bw, 24);
    this.bellSub.pos(L.left + 6 + Math.round(bw / 2), this.height + 31);
  }

  update(s: GameState, dt: number, show: boolean): void {
    this.node.active = show;
    if (!show) return;
    const tabs = bottomTabs(s.unlocked ?? [], s.phase, !!s.expedition);
    if (tabs.join() !== this.visible.join()) {
      for (const t of tabs) if (!this.seen.has(t)) { if (this.seen.size) this.pulseT.set(t, 6); this.seen.add(t); }
      this.visible = tabs;
      for (const id of TAB_ORDER) { this.tabs[id].show(tabs.includes(id)); this.labels[id].show(tabs.includes(id)); }
      this.layout();
    }
    for (const id of this.visible) {
      this.labels[id].set(tr(`tab.${id}`));
      const p = this.pulseT.get(id);
      if (p !== undefined) {
        const left = p - dt;
        if (left <= 0) this.pulseT.delete(id); else this.pulseT.set(id, left);
        const k = 1 + 0.15 * Math.max(0, Math.sin(this.ctx.time * 8));
        this.tabs[id].icon?.scale(k, k);
        this.labels[id].setColor(Math.sin(this.ctx.time * 8) > 0 ? PAL.z : PAL.w);
      } else { this.tabs[id].icon?.scale(1, 1); this.labels[id].setColor(PAL.w); }
    }
    const peace = s.phase === 'peace' && !s.buildMode && !s.expedition;
    this.bell.show(peace);
    const left = s.phaseDur - s.phaseT;
    this.bellSub.show(peace && left >= 60).set(tr('hud.bellBonus'));
  }
}

/** "Next goal" strip (§2.5 / §10.5). */
export class GoalStrip {
  readonly node: Node;
  private bg: NineSlice;
  private icon: SpriteHandle;
  private lines: BitmapText[] = [];
  private labels: BitmapText[] = [];
  private hits: Hit[] = [];
  open = false;
  private goals: string[] = ['', '', ''];
  private x = 0; private y = 0; private w = 120;

  constructor(parent: Node, readonly ctx: Ctx) {
    this.node = mkNode('goals', parent);
    this.bg = new NineSlice(this.node, 'ui_goal_strip');
    this.icon = new SpriteHandle('icon', this.node, 'icon_goal').anchor(0, 0.5);
    for (let i = 0; i < 3; i++) {
      this.labels.push(new BitmapText(this.node, { ax: 0, ay: 0.5, color: PAL.u, scalable: false }));
      this.lines.push(new BitmapText(this.node, { ax: 0, ay: 0.5, color: PAL.w, scalable: false }));
      const idx = i;
      this.hits.push(uiInput.add({
        x: 0, y: 0, w: 0, h: 0, z: 19,
        active: () => this.node.activeInHierarchy && (idx === 0 || this.open),
        onUp: (_x, _y, inside) => { if (inside) this.tap(idx); },
      }));
    }
  }

  /** Resolve a goal string: an i18n key (optionally `key|a=1`) or plain text from the core. */
  static text(goal: string): string {
    if (!goal) return '';
    const g = parseGoal(goal);
    return hasText(g.key) ? tr(g.key, g.params) : goal.includes('|') ? g.key : goal;
  }

  private tap(i: number): void {
    this.ctx.sfx('ui_click');
    if (!this.open && i === 0) { this.open = true; this.layoutLines(); return; }
    const goal = this.goals[i];
    this.open = false; this.layoutLines();
    if (!goal) return;
    const t = goalTarget(goal);
    const s = this.ctx.state();
    if ('tab' in t) {
      if (t.tab === 'build') this.ctx.cmd({ t: 'buildMode', on: true });
      else this.ctx.open(t.tab, t.section);
    } else if ('screen' in t) {
      if (t.screen === 'dock') this.ctx.open('dock');
      else if (t.screen === 'storage') this.ctx.open('village', 'storage');
      else this.ctx.open('building', String(s.hearthUid));
    } else if (t.world === 'heart') {
      const h = s.pois.find((p) => p.kind === 'heart' && p.region === s.regionsOpen) ?? s.pois.find((p) => p.kind === 'heart');
      if (h) this.ctx.focusWorld(h.x + 0.5, h.y + 0.5);
    } else if (t.world === 'bell') this.ctx.toast(tr('hud.bell'));
  }

  place(x: number, y: number, w: number): void { this.x = x; this.y = y; this.w = w; this.layoutLines(); }

  private layoutLines(): void {
    const n = this.open ? 3 : 1, lh = 12, h = n * lh + 6;
    this.bg.size(this.w, h).pos(this.x, this.y - h);
    this.icon.pos(this.x + 2, this.y - 9);
    for (let i = 0; i < 3; i++) {
      const show = i < n;
      const ly = this.y - 9 - i * lh;
      this.labels[i].show(show && this.open).set(tr(['goal.session', 'goal.day', 'goal.week'][i])).pos(this.x + 20, ly);
      const lx = this.x + 20 + (this.open ? 34 : 0);
      this.lines[i].show(show).set(clip(GoalStrip.text(this.goals[i]) || '-', Math.floor((this.w - (lx - this.x) - 4) / 5)), i === 0 ? PAL.z : PAL.w);
      this.lines[i].pos(lx, ly);
      Object.assign(this.hits[i], { x: this.x, y: ly - lh / 2, w: this.w, h: lh });
    }
  }

  update(s: GameState, show: boolean): void {
    const goals = [s.nextGoals?.session ?? '', s.nextGoals?.day ?? '', s.nextGoals?.week ?? ''];
    const any = goals.some((g) => !!g);
    this.node.active = show && any;
    if (!this.node.active) return;
    let changed = false;
    for (let i = 0; i < 3; i++) if (goals[i] !== this.goals[i]) { this.goals[i] = goals[i]; changed = true; }
    if (changed) this.layoutLines();
  }
}

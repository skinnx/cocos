// Build-mode bottom drawer (SPEC §6.2): 4 tabs (Defense / Light / Traps / Economy); each card shows the building's
// real sprite, its name, its cost (icon-letter coded, colour is never the only cue) and a lock when the blueprint is
// not unlocked. Cards page horizontally by swiping the card row. Undo + Done buttons sit on the drawer's top edge.
import type { Node } from 'cc';
import type { BuildingId, Resources } from '../../core/api';
import type { BuildTab } from '../../core/data/buildings';
import type { Ctx } from '../Ctx';
import { isLocked, previewSprite, TABS, tabItems } from '../logic/catalog';
import { tr } from '../logic/strings';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';
import { BitmapText } from './BitmapText';
import { NineSlice } from './NineSlice';
import { Button, uiInput, type Hit } from './UiKit';

export function costText(c: Resources): string {
  const parts: string[] = [];
  if (c.wood) parts.push(`${c.wood}w`);
  if (c.stone) parts.push(`${c.stone}s`);
  if (c.gold) parts.push(`${c.gold}g`);
  return parts.join(parts.length > 2 ? '' : ' ') || '0';
}
export function affordable(have: Resources, c: Resources): boolean {
  return have.wood >= c.wood && have.stone >= c.stone && have.gold >= c.gold;
}

class Card {
  readonly node: Node;
  readonly bg: NineSlice;
  readonly img: SpriteHandle;
  readonly name: BitmapText;
  readonly cost: BitmapText;
  readonly lock: SpriteHandle;
  id: BuildingId | null = null;
  x = 0; y = 0;
  constructor(parent: Node, readonly w: number, readonly h: number) {
    this.node = mkNode('card', parent);
    this.bg = new NineSlice(this.node, 'ui_card_common', w, h);
    this.img = new SpriteHandle('img', this.node).anchor(0.5, 0);
    this.name = new BitmapText(this.node, { ax: 0.5, ay: 1, align: 'center', maxWidth: w - 4, color: PAL.w, shadow: false, scalable: false });
    this.cost = new BitmapText(this.node, { ax: 0.5, ay: 0, color: PAL.w, shadow: false, scalable: false });
    this.lock = new SpriteHandle('lock', this.node, 'icon_lock').anchor(0.5, 0.5);
  }
}

export class BuildDrawer {
  readonly node: Node;
  private panel: NineSlice;
  private tabs: Button[] = [];
  private cards: Card[] = [];
  readonly undo: Button;
  readonly done: Button;
  private info: BitmapText;
  private prev: SpriteHandle;
  private next: SpriteHandle;
  tab: BuildTab = 'defense';
  selected: BuildingId | null = null;
  private page = 0;
  private perPage = 4;
  private rowHit: Hit;
  private drag: { x0: number; moved: boolean } | null = null;
  height = 104;
  onSelect: (id: BuildingId | null) => void = () => undefined;

  constructor(parent: Node, readonly ctx: Ctx) {
    this.node = mkNode('drawer', parent);
    this.panel = new NineSlice(this.node, 'ui_panel_parchment');
    TABS.forEach((t) => {
      const b = new Button(this.node, { text: tr(`build.tab.${t}`), style: 'tab', z: 41 });
      b.onTap = () => { ctx.sfx('ui_click'); this.setTab(t); };
      this.tabs.push(b);
    });
    for (let i = 0; i < 5; i++) this.cards.push(new Card(this.node, 50, 80));
    this.undo = new Button(this.node, { icon: 'icon_undo', z: 41 });
    this.undo.onTap = () => { ctx.sfx('ui_click'); ctx.cmd({ t: 'undo' }); };
    this.done = new Button(this.node, { icon: 'icon_tick', z: 41 });
    this.done.onTap = () => { ctx.sfx('ui_click'); this.select(null); if (ctx.state().phase !== 'dusk') ctx.cmd({ t: 'buildMode', on: false }); };
    this.info = new BitmapText(this.node, { ax: 0, ay: 0, color: PAL.w, maxWidth: 170 });
    this.prev = new SpriteHandle('prev', this.node, 'ui_arrow_edge').anchor(0.5, 0.5).angle(180);
    this.next = new SpriteHandle('next', this.node, 'ui_arrow_edge').anchor(0.5, 0.5);
    this.rowHit = uiInput.add({
      x: 0, y: 0, w: 0, h: 0, z: 40,
      active: () => this.node.activeInHierarchy,
      onDown: (x) => { this.drag = { x0: x, moved: false }; },
      onMove: (x) => {
        if (!this.drag) return;
        const dx = x - this.drag.x0;
        if (Math.abs(dx) > 20) {
          this.drag.moved = true; this.drag.x0 = x;
          this.setPage(this.page + (dx < 0 ? 1 : -1));
        }
      },
      onUp: (x, y, inside) => {
        const d = this.drag; this.drag = null;
        if (!inside || !d || d.moved) return;
        for (const c of this.cards) {
          if (!c.node.active || !c.id) continue;
          if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) { this.tapCard(c.id); return; }
        }
      },
    });
    this.layout();
    this.setTab('defense');
  }

  layout(): void {
    const L = this.ctx.layout;
    const W = L.W, b = L.bottom;
    this.height = 110 + b;
    this.panel.size(W + 8, this.height).pos(-4, -2);
    const tw = Math.floor((W - 8) / 4);
    this.tabs.forEach((t, i) => t.layout(4 + i * tw, b + 88, tw - 2, 18));
    const cw = 50, gap = 2;
    this.perPage = Math.max(1, Math.floor((W - 16) / (cw + gap)));
    const x0 = Math.round((W - (this.perPage * (cw + gap) - gap)) / 2);
    this.cards.forEach((c, i) => { c.x = x0 + i * (cw + gap); c.y = b + 4; c.node.setPosition(c.x, c.y, 0); });
    Object.assign(this.rowHit, { x: 0, y: b + 2, w: W, h: 84 });
    this.prev.pos(7, b + 44); this.next.pos(W - 7, b + 44);
    this.undo.layout(W - 64, b + 110, 28, 24);
    this.done.layout(W - 32, b + 110, 28, 24);
    this.info.pos(6, b + 114);
    this.refresh();
  }

  setTab(t: BuildTab): void {
    this.tab = t; this.page = 0;
    this.tabs.forEach((b, i) => b.setSelected(TABS[i] === t));
    this.refresh();
  }
  private setPage(p: number): void {
    const n = tabItems(this.tab).length;
    const maxPage = Math.max(0, n - this.perPage);
    const np = Math.max(0, Math.min(maxPage, p));
    if (np !== this.page) { this.page = np; this.ctx.sfx('ui_click'); this.refresh(); }
  }

  select(id: BuildingId | null): void {
    this.selected = id;
    this.refresh();
    this.onSelect(id);
  }

  private tapCard(id: BuildingId): void {
    const meta = this.ctx.meta;
    if (isLocked(id, meta)) { this.ctx.sfx('place_fail'); return; }
    this.ctx.sfx('ui_click');
    this.select(this.selected === id ? null : id);
  }

  refresh(): void {
    const items = tabItems(this.tab);
    const s = this.ctx.game ? this.ctx.state() : null;
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      const id = i < this.perPage ? items[this.page + i] : undefined;
      if (!id) { c.node.active = false; c.id = null; continue; }
      c.node.active = true; c.id = id;
      const locked = isLocked(id, this.ctx.meta);
      const cost = this.ctx.game ? this.ctx.game.buildingCost(id, 1) : { wood: 0, stone: 0, gold: 0 };
      const can = !!s && affordable(s.res, cost);
      c.bg.setFrame(this.selected === id ? 'ui_card_legendary' : locked ? 'ui_card_common' : can ? 'ui_card_rare' : 'ui_card_common');
      c.img.set(previewSprite(id)).pos(Math.round(c.w / 2), 13).alpha(locked ? 90 : 255);
      c.name.set(tr(`bld.${id}.name`)).pos(Math.round(c.w / 2), c.h - 6);
      c.cost.set(locked ? `${tr('ui.locked')}` : costText(cost), can || locked ? PAL.w : PAL.o).pos(Math.round(c.w / 2), 3);
      c.lock.show(locked).pos(Math.round(c.w / 2), 34);
    }
    const n = items.length;
    this.prev.show(this.page > 0);
    this.next.show(this.page + this.perPage < n);
    if (this.selected) {
      const cost = this.ctx.game ? this.ctx.game.buildingCost(this.selected, 1) : { wood: 0, stone: 0, gold: 0 };
      this.info.set(`${tr(`bld.${this.selected}.name`)}: ${costText(cost)}`);
    } else this.info.set('');
  }

  private acc = 0;
  update(dt: number): void {
    this.acc += dt;
    if (this.acc > 0.25) { this.acc = 0; this.refresh(); } // affordability changes as resources flow in
  }

  show(v: boolean): void { if (this.node.active !== v) this.node.active = v; }
}

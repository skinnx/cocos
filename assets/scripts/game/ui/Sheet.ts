// Full-height paged panel used by the v2 screens (Hero, Village, Book, Map, Dock, Storage, Building): a parchment
// sheet with a title, an optional tab row, an optional info line, an optional custom block reserved at the top,
// and a list of rows (icon · title · small icon strip · sub-line · progress bar · up to 3 buttons). Long lists page
// with ◀ ▶ buttons (no scrolling inertia to fight with one thumb). Rows are pooled; content is pushed with setRows().
import type { Node } from 'cc';
import type { Ctx } from '../Ctx';
import { tr } from '../logic/strings';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';
import { BitmapText } from './BitmapText';
import { Bar } from './Hud';
import { NineSlice } from './NineSlice';
import { blocker, Button, uiInput, type Hit } from './UiKit';

export interface SheetBtn { icon?: string; text?: string; enabled?: boolean; selected?: boolean; on: () => void }
export interface RowSpec {
  icon?: string; iconAlpha?: number; iconTint?: readonly number[];
  badge?: string; badgeColor?: readonly number[];
  strip?: string[];
  title: string; titleColor?: readonly number[];
  sub?: string; subColor?: readonly number[];
  bar?: number | null; barFill?: string;
  frame?: string;
  btns?: SheetBtn[];
  onTap?: () => void;
}
export interface TabSpec { id: string; icon?: string; text: string }

const ROW_H = 36;
const MAX_BTNS = 3;

class Row {
  readonly node: Node;
  readonly bg: NineSlice;
  readonly icon: SpriteHandle;
  readonly badge: BitmapText;
  readonly title: BitmapText;
  readonly sub: BitmapText;
  readonly strip: SpriteHandle[] = [];
  readonly bar: Bar;
  readonly btns: Button[] = [];
  readonly hit: Hit;
  onTap: (() => void) | null = null;
  x = 0; y = 0; w = 0;
  constructor(parent: Node, z: number) {
    this.node = mkNode('row', parent);
    this.bg = new NineSlice(this.node, 'ui_card_common');
    this.icon = new SpriteHandle('icon', this.node).anchor(0.5, 0.5);
    this.badge = new BitmapText(this.node, { ax: 0.5, ay: 0, color: PAL.z, scalable: false });
    this.title = new BitmapText(this.node, { ax: 0, ay: 1, color: PAL.z, scalable: false });
    this.sub = new BitmapText(this.node, { ax: 0, ay: 1, color: PAL.w, scalable: false });
    this.bar = new Bar(this.node, 'ui_progress_fill', 60, 4);
    for (let i = 0; i < MAX_BTNS; i++) this.btns.push(new Button(this.node, { text: '', z: z + 1 }));
    const self = this;
    this.hit = uiInput.add({
      x: 0, y: 0, w: 0, h: ROW_H - 2, z,
      active: () => self.node.activeInHierarchy && !!self.onTap,
      onUp: (_x, _y, inside) => { if (inside && self.onTap) self.onTap(); },
    });
  }
}

export class Sheet {
  readonly node: Node;
  private dim: SpriteHandle;
  private panel: NineSlice;
  private title: BitmapText;
  private info: BitmapText;
  readonly close: Button;
  private tabBtns: Button[] = [];
  private rows: Row[] = [];
  private prev: Button; private next: Button; private pageText: BitmapText;
  private specs: RowSpec[] = [];
  private page = 0;
  private perPage = 6;
  /** height (UI px) reserved under the tabs/info line for a screen's custom block */
  topBlock = 0;
  /** rect of the reserved block (UI px, origin bottom-left), valid after layout() */
  block = { x: 0, y: 0, w: 0, h: 0 };
  tab = '';
  onTab: (id: string) => void = () => undefined;
  onClose: () => void = () => undefined;
  private tabs: TabSpec[] = [];
  private rowsTop = 0; private rowsX = 0; private rowsW = 0;

  constructor(parent: Node, readonly ctx: Ctx, readonly z = 60) {
    this.node = mkNode('sheet', parent);
    this.dim = new SpriteHandle('dim', this.node).solid(1, 1).color(PAL.k[0], PAL.k[1], PAL.k[2], 170);
    blocker(this.node, z - 1, () => ({ x: 0, y: 0, w: this.ctx.layout.W, h: this.ctx.layout.H }));
    this.panel = new NineSlice(this.node, 'ui_panel_parchment');
    this.title = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.z });
    this.info = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.w, align: 'center', scalable: false });
    this.close = new Button(this.node, { icon: 'icon_close', z: z + 2 });
    this.close.onTap = () => { ctx.sfx('ui_click'); this.onClose(); };
    for (let i = 0; i < 5; i++) {
      const b = new Button(this.node, { text: '', style: 'tab', z: z + 1 });
      const idx = i;
      b.onTap = () => { const t = this.tabs[idx]; if (!t) return; ctx.sfx('ui_click'); this.tab = t.id; this.page = 0; this.onTab(t.id); };
      this.tabBtns.push(b);
    }
    this.prev = new Button(this.node, { icon: 'ui_arrow_edge', z: z + 1 });
    this.prev.icon?.angle(180);
    this.next = new Button(this.node, { icon: 'ui_arrow_edge', z: z + 1 });
    this.prev.onTap = () => { ctx.sfx('ui_click'); this.setPage(this.page - 1); };
    this.next.onTap = () => { ctx.sfx('ui_click'); this.setPage(this.page + 1); };
    this.pageText = new BitmapText(this.node, { ax: 0.5, ay: 0.5, color: PAL.w, scalable: false });
    for (let i = 0; i < 9; i++) this.rows.push(new Row(this.node, z + 1));
    this.node.active = false;
  }

  get shown(): boolean { return this.node.active; }
  show(v: boolean): void { if (this.node.active !== v) { this.node.active = v; if (v) this.layout(); } }

  setTitle(t: string): void { this.title.set(t); }
  setInfo(t: string, color: readonly number[] = PAL.w): void { this.info.set(t, color); }
  setTabs(tabs: TabSpec[], current: string): void {
    const changed = tabs.map((t) => t.id).join() !== this.tabs.map((t) => t.id).join();
    this.tabs = tabs;
    if (!tabs.some((t) => t.id === current)) current = tabs[0]?.id ?? '';
    if (current !== this.tab) { this.tab = current; this.page = 0; }
    this.tabBtns.forEach((b, i) => {
      const t = tabs[i];
      b.show(!!t);
      if (!t) return;
      if (t.icon) b.setIcon(t.icon);
      b.setText(t.text).setSelected(t.id === this.tab);
    });
    if (changed) this.layout();
  }

  layout(): void {
    const L = this.ctx.layout;
    this.dim.solid(L.W, L.H).pos(0, 0);
    const x = Math.round(L.left + 4), w = Math.round(L.W - L.left - L.right - 8);
    const top = Math.round(L.H - L.top - 6), bottom = Math.round(L.bottom + 6);
    this.panel.size(w, top - bottom).pos(x, bottom);
    this.title.pos(Math.round(L.W / 2), top - 6);
    this.close.layout(x + w - 26, top - 26, 22, 22);
    let y = top - 26;
    if (this.tabs.length) {
      const tw = Math.floor((w - 8) / this.tabs.length);
      this.tabBtns.forEach((b, i) => { if (i < this.tabs.length) b.layout(x + 4 + i * tw, y - 20, tw - 2, 20); });
      y -= 24;
    }
    this.info.opts.maxWidth = w - 12;
    this.info.refresh().pos(Math.round(L.W / 2), y - 2);
    y -= this.info.height > 0 ? this.info.height + 6 : 2;
    this.block = { x: x + 4, y: y - this.topBlock, w: w - 8, h: this.topBlock };
    y -= this.topBlock;
    const pagerH = 24;
    this.rowsTop = y; this.rowsX = x + 4; this.rowsW = w - 8;
    this.perPage = Math.max(1, Math.min(this.rows.length, Math.floor((y - (bottom + pagerH + 4)) / ROW_H)));
    this.prev.layout(x + 6, bottom + 4, 28, 20);
    this.next.layout(x + w - 34, bottom + 4, 28, 20);
    this.pageText.pos(Math.round(L.W / 2), bottom + 14);
    this.render();
  }

  setRows(specs: RowSpec[]): void {
    this.specs = specs;
    const pages = Math.max(1, Math.ceil(specs.length / this.perPage));
    if (this.page >= pages) this.page = pages - 1;
    this.render();
  }
  setPage(p: number): void {
    const pages = Math.max(1, Math.ceil(this.specs.length / this.perPage));
    this.page = Math.max(0, Math.min(pages - 1, p));
    this.render();
  }
  /** Jump to the page that shows row `i`. */
  reveal(i: number): void { this.setPage(Math.floor(i / this.perPage)); }

  private render(): void {
    const pages = Math.max(1, Math.ceil(this.specs.length / this.perPage));
    this.prev.show(pages > 1).setEnabled(this.page > 0);
    this.next.show(pages > 1).setEnabled(this.page < pages - 1);
    this.pageText.show(pages > 1).set(tr('ui.page', { a: this.page + 1, b: pages }));
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i];
      const spec = i < this.perPage ? this.specs[this.page * this.perPage + i] : undefined;
      if (!spec) { r.node.active = false; r.onTap = null; continue; }
      r.node.active = true;
      this.fill(r, spec, this.rowsX, this.rowsTop - (i + 1) * ROW_H, this.rowsW);
    }
  }

  private fill(r: Row, s: RowSpec, x: number, y: number, w: number): void {
    r.x = x; r.y = y; r.w = w;
    r.node.setPosition(x, y, 0);
    r.bg.setFrame(s.frame ?? 'ui_card_common').size(w, ROW_H - 2);
    const hasIcon = !!s.icon;
    if (hasIcon) {
      r.icon.set(s.icon!).show(true).pos(16, Math.round((ROW_H - 2) / 2));
      const t = s.iconTint ?? PAL.w;
      r.icon.color(s.iconTint ? t[0] : 255, s.iconTint ? t[1] : 255, s.iconTint ? t[2] : 255, s.iconAlpha ?? 255);
    } else r.icon.show(false);
    r.badge.show(!!s.badge).set(s.badge ?? '', s.badgeColor ?? PAL.z).pos(16, 1);
    const tx = hasIcon ? 33 : 6;
    // buttons right-aligned
    const btns = s.btns ?? [];
    let bx = w - 4;
    for (let i = 0; i < MAX_BTNS; i++) {
      const b = r.btns[i];
      const spec = btns[btns.length - 1 - i];
      if (!spec) { b.show(false); continue; }
      b.show(true);
      if (spec.icon) { b.setIcon(spec.icon); b.icon!.show(true); } else b.icon?.show(false);
      b.setText(spec.text ?? '');
      const bw = Math.max(24, Math.min(84, b.contentWidth()));
      bx -= bw;
      b.layout(bx, 5, bw, ROW_H - 12).offset(x, y);
      bx -= 3;
      b.setEnabled(spec.enabled !== false).setSelected(!!spec.selected);
      b.onTap = () => { this.ctx.sfx('ui_click'); spec.on(); };
    }
    const textW = Math.max(40, bx - tx - 2);
    r.title.opts.maxWidth = textW; r.sub.opts.maxWidth = textW;
    r.title.set(s.title, s.titleColor ?? PAL.z).pos(tx, ROW_H - 5);
    const strip = s.strip ?? [];
    for (let i = 0; i < Math.max(strip.length, r.strip.length); i++) {
      if (i >= strip.length) { r.strip[i].show(false); continue; }
      const h = r.strip[i] ?? (r.strip[i] = new SpriteHandle('st', r.node).anchor(0, 1));
      h.set(strip[i]).show(true).pos(Math.round(tx + Math.min(textW - 8, r.title.width + 3) + i * 9), ROW_H - 4);
    }
    r.sub.show(!!s.sub).set(s.sub ?? '', s.subColor ?? PAL.w).pos(tx, ROW_H - 16);
    if (s.bar !== undefined && s.bar !== null) r.bar.show(true).resize(Math.max(20, textW), 4).pos(tx, 3).set(s.bar, s.barFill ?? 'ui_progress_fill');
    else r.bar.show(false);
    r.onTap = s.onTap ?? null;
    Object.assign(r.hit, { x, y, w: Math.max(0, bx - 2), h: ROW_H - 2 });
  }
}

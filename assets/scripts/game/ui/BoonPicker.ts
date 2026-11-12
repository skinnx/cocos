// Boon choice (SPEC §11.1): 3 cards at dawn (2+ from chests), framed by rarity, with the boon icon, name, effect,
// group and stack count. Tapping a card sends `pickBoon`.
import type { Node } from 'cc';
import type { Boon } from '../../core/api';
import type { Ctx } from '../Ctx';
import { tr } from '../logic/strings';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';
import { BitmapText } from './BitmapText';
import { NineSlice } from './NineSlice';
import { uiInput, type Hit } from './UiKit';

const RARITY_COLOR = { common: PAL.w, rare: PAL.D, legendary: PAL.z } as const;

class BoonCard {
  readonly node: Node;
  readonly bg: NineSlice;
  readonly icon: SpriteHandle;
  readonly name: BitmapText;
  readonly desc: BitmapText;
  readonly meta: BitmapText;
  x = 0; y = 0; w = 70; h = 120; key = '';
  constructor(parent: Node) {
    this.node = mkNode('boon', parent);
    this.bg = new NineSlice(this.node, 'ui_card_common');
    this.icon = new SpriteHandle('icon', this.node).anchor(0.5, 1);
    this.name = new BitmapText(this.node, { ax: 0.5, ay: 1, align: 'center', color: PAL.z, scalable: false });
    this.desc = new BitmapText(this.node, { ax: 0.5, ay: 1, align: 'center', color: PAL.w, scalable: false });
    this.meta = new BitmapText(this.node, { ax: 0.5, ay: 0, align: 'center', color: PAL.u, scalable: false });
  }
  set(b: Boon, w: number, h: number): void {
    this.w = w; this.h = h;
    this.bg.setFrame(`ui_card_${b.rarity}`).size(w, h);
    this.icon.set(`boon_${b.id}`).pos(Math.round(w / 2), h - 12).scale(2);
    const nameKey = `boon.${b.id}.name`, descKey = `boon.${b.id}.desc`;
    const name = tr(nameKey) !== nameKey ? tr(nameKey) : b.name;
    const desc = tr(descKey) !== descKey ? tr(descKey) : b.desc;
    this.name.opts.maxWidth = w - 10; this.desc.opts.maxWidth = w - 12;
    this.name.set(name, RARITY_COLOR[b.rarity]).pos(Math.round(w / 2), h - 50);
    this.desc.set(desc).pos(Math.round(w / 2), h - 54 - Math.max(10, this.name.height));
    this.meta.set(`${tr(`boon.group.${b.group}`)} ${tr('boon.stacks', { n: b.stacks + 1, m: b.maxStacks })}`).pos(Math.round(w / 2), 8);
  }
}

export class BoonPicker {
  readonly node: Node;
  private title: BitmapText;
  private cards: BoonCard[] = [];
  private cardHits: Hit[] = [];
  private offerKey = '';
  private t = 0;

  constructor(parent: Node, readonly ctx: Ctx) {
    this.node = mkNode('boons', parent);
    this.title = new BitmapText(this.node, { ax: 0.5, ay: 0, color: PAL.z });
    for (let i = 0; i < 4; i++) {
      const c = new BoonCard(this.node);
      const idx = i;
      this.cardHits.push(uiInput.add({
        x: 0, y: 0, w: 0, h: 0, z: 70,
        active: () => c.node.activeInHierarchy,
        onUp: (_x, _y, inside) => { if (inside && this.t > 0.35) { ctx.sfx('boon_pick', 2); ctx.cmd({ t: 'pickBoon', index: idx }); } },
      }));
      this.cards.push(c);
    }
    this.node.active = false;
  }

  /** Show the current offer; `baseY` = bottom of the card row (UI px). */
  update(offer: Boon[] | null, source: 'dawn' | 'chest' | null, baseY: number, dt: number): void {
    if (!offer || !offer.length) { this.node.active = false; this.offerKey = ''; return; }
    this.node.active = true;
    const key = offer.map((b) => b.id).join(',');
    if (key !== this.offerKey) { this.offerKey = key; this.t = 0; }
    this.t += dt;
    const L = this.ctx.layout;
    const n = Math.min(this.cards.length, offer.length);
    const gap = 4;
    const w = Math.min(76, Math.floor((L.W - 12 - gap * (n - 1)) / n)), h = 128;
    const x0 = Math.round((L.W - (n * w + (n - 1) * gap)) / 2);
    this.title.set(source === 'chest' ? tr('chest.title') : tr('dawn.choose')).pos(Math.round(L.W / 2), baseY + h + 6);
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      if (i >= n) { c.node.active = false; continue; }
      c.node.active = true;
      const ck = `${key}:${w}`;
      if (c.key !== ck) { c.key = ck; c.set(offer[i], w, h); }
      // cards slide up one after another
      const k = Math.max(0, Math.min(1, (this.t - i * 0.08) / 0.25));
      const y = baseY - Math.round((1 - k * k * (3 - 2 * k)) * 40);
      c.x = x0 + i * (w + gap); c.y = y;
      c.node.setPosition(c.x, c.y, 0);
      Object.assign(this.cardHits[i], { x: c.x, y: c.y, w, h });
    }
  }
}

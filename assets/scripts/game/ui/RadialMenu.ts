// Radial menu for a tapped building (SPEC §6.1): Upgrade / Repair / Sell around the building, with costs.
import type { Node } from 'cc';
import type { BuildingState, Resources } from '../../core/api';
import { BUILDINGS } from '../../core/data/buildings';
import type { Ctx } from '../Ctx';
import { maxLevel, upgradesInto } from '../logic/catalog';
import { tr } from '../logic/strings';
import { mkNode, PAL } from '../render/Nodes';
import { BitmapText } from './BitmapText';
import { affordable, costText } from './BuildDrawer';
import { Button } from './UiKit';

export function repairCost(b: Pick<BuildingState, 'id' | 'hp' | 'maxHp'>): Resources {
  const missing = Math.max(0, b.maxHp - b.hp);
  const units = Math.ceil(missing / 15);
  return BUILDINGS[b.id].stone ? { wood: 0, stone: units, gold: 0 } : { wood: units, stone: 0, gold: 0 };
}

export class RadialMenu {
  readonly node: Node;
  private up: Button; private fix: Button; private sell: Button;
  private upCost: BitmapText; private fixCost: BitmapText; private sellCost: BitmapText;
  private title: BitmapText;
  uid = 0;

  constructor(parent: Node, readonly ctx: Ctx) {
    this.node = mkNode('radial', parent);
    this.up = new Button(this.node, { icon: 'icon_upgrade', z: 45 });
    this.fix = new Button(this.node, { icon: 'icon_wrench', z: 45 });
    this.sell = new Button(this.node, { icon: 'icon_sell', z: 45 });
    this.upCost = new BitmapText(this.node, { ax: 0.5, ay: 1 });
    this.fixCost = new BitmapText(this.node, { ax: 0.5, ay: 1 });
    this.sellCost = new BitmapText(this.node, { ax: 0.5, ay: 1 });
    this.title = new BitmapText(this.node, { ax: 0.5, ay: 0, color: PAL.z });
    this.up.onTap = () => { ctx.cmd({ t: 'upgrade', uid: this.uid }); };
    this.fix.onTap = () => { ctx.cmd({ t: 'repair', uid: this.uid }); };
    this.sell.onTap = () => { ctx.cmd({ t: 'sell', uid: this.uid }); this.close(); };
    this.node.active = false;
  }

  open(uid: number): void { this.uid = uid; this.node.active = true; }
  close(): void { this.uid = 0; this.node.active = false; }
  get isOpen(): boolean { return this.node.active; }

  update(): void {
    if (!this.uid || !this.ctx.game) return;
    const s = this.ctx.state();
    const b = s.buildings.find((q) => q.uid === this.uid);
    if (!b) { this.close(); return; }
    const c = this.ctx.tileToUi(b.x + b.w / 2, b.y + b.h / 2);
    const L = this.ctx.layout;
    const cx = Math.max(40, Math.min(L.W - 40, c.x)), cy = Math.max(L.bottom + 140, Math.min(L.H - 90, c.y));
    const R = 34, bs = 28;
    const place = (btn: Button, txt: BitmapText, ang: number) => {
      const x = cx + Math.cos(ang) * R - bs / 2, y = cy + Math.sin(ang) * R - bs / 2;
      btn.layout(x, y, bs, bs);
      txt.pos(Math.round(x + bs / 2), Math.round(y - 1));
    };
    place(this.up, this.upCost, Math.PI / 2);
    place(this.fix, this.fixCost, Math.PI / 2 + (2 * Math.PI) / 3);
    place(this.sell, this.sellCost, Math.PI / 2 - (2 * Math.PI) / 3);
    this.title.set(`${tr(`bld.${b.id}.name`)} ${tr('ui.level', { n: b.level })}`).pos(Math.round(cx), Math.round(cy + R + bs / 2 + 4));
    // upgrade
    const into = upgradesInto(b.id);
    const canUp = b.level < maxLevel(b.id) || !!into;
    if (canUp) {
      const cost = into && b.level >= maxLevel(b.id) ? this.ctx.game.buildingCost(into, 1) : this.ctx.game.buildingCost(b.id, (b.level + 1) as 2 | 3);
      const ok = affordable(s.res, cost);
      this.up.setEnabled(true);
      this.upCost.set(costText(cost), ok ? PAL.w : PAL.o);
    } else { this.up.setEnabled(false); this.upCost.set(tr('ui.max')); }
    // repair
    const rc = repairCost(b);
    const needs = b.hp < b.maxHp && b.maxHp > 1;
    this.fix.setEnabled(needs);
    this.fixCost.set(needs ? costText(rc) : '-', needs && !affordable(s.res, rc) ? PAL.o : PAL.w);
    // sell (hearth cannot be sold)
    const sellable = b.id !== 'hearth';
    this.sell.setEnabled(sellable);
    this.sellCost.set(sellable ? (s.phase === 'dusk' ? '100%' : '60%') : '-');
  }
}

// Omens panel (SPEC §8): shown at dusk (and re-openable): each enemy type tonight as its real sprite × count, elite
// count, and the rifts it comes from; plus a one-line card introducing any mechanic that is new tonight (§10.3).
// Rift directions are shown by the HUD edge arrows (purple) while this panel is up.
import type { Node } from 'cc';
import type { EnemyId, GameState } from '../../core/api';
import { ENEMIES } from '../../core/data/enemies';
import type { Ctx } from '../Ctx';
import { enemySprite } from '../logic/sprites';
import { tr } from '../logic/strings';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';
import { BitmapText } from './BitmapText';
import { NineSlice } from './NineSlice';
import { Button } from './UiKit';

export function omenRows(s: Pick<GameState, 'omens'>): Array<{ enemy: EnemyId; count: number; elite: number; rifts: number[] }> {
  const map = new Map<EnemyId, { enemy: EnemyId; count: number; elite: number; rifts: number[] }>();
  for (const o of s.omens) {
    const r = map.get(o.enemy) ?? { enemy: o.enemy, count: 0, elite: 0, rifts: [] };
    r.count += o.count; r.elite += o.elite;
    if (!r.rifts.includes(o.rift)) r.rifts.push(o.rift);
    map.set(o.enemy, r);
  }
  return [...map.values()].sort((a, b) => (ENEMIES[b.enemy]?.boss ? 1 : 0) - (ENEMIES[a.enemy]?.boss ? 1 : 0) || b.count - a.count);
}

/** Keys of the one-line intro cards for mechanics first seen tonight. */
export function introKeys(s: Pick<GameState, 'omens' | 'night'>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const o of s.omens) {
    const d = ENEMIES[o.enemy];
    if (d && d.firstNight === s.night && !seen.has(o.enemy)) { seen.add(o.enemy); out.push(`intro.${o.enemy}`); }
    if (o.elite > 0 && !seen.has('elite') && s.night === 9) { seen.add('elite'); out.push('intro.elite'); }
  }
  return out;
}

class Row {
  readonly node: Node;
  readonly img: SpriteHandle;
  readonly text: BitmapText;
  constructor(parent: Node) {
    this.node = mkNode('row', parent);
    this.img = new SpriteHandle('img', this.node).anchor(0.5, 0);
    this.text = new BitmapText(this.node, { ax: 0, ay: 0.5, color: PAL.w, scalable: false });
  }
}

export class Omens {
  readonly node: Node;
  private panel: NineSlice;
  private title: BitmapText;
  private sub: BitmapText;
  private rows: Row[] = [];
  private intro: BitmapText;
  private close: Button;
  open = false;
  private key = '';

  constructor(parent: Node, readonly ctx: Ctx) {
    this.node = mkNode('omens', parent);
    this.panel = new NineSlice(this.node, 'ui_panel_stone');
    this.title = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.L });
    this.sub = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.u, scalable: false });
    for (let i = 0; i < 9; i++) this.rows.push(new Row(this.node));
    this.intro = new BitmapText(this.node, { ax: 0.5, ay: 1, color: PAL.z, align: 'center', maxWidth: 200, scalable: false });
    this.close = new Button(this.node, { icon: 'icon_close', z: 36 });
    this.close.onTap = () => { ctx.sfx('ui_click'); this.open = false; };
    this.node.active = false;
  }

  update(s: GameState): void {
    const show = this.open && (s.phase === 'dusk' || s.phase === 'day') && s.omens.length > 0;
    this.node.active = show;
    if (!show) return;
    const rows = omenRows(s);
    const intros = introKeys(s);
    const key = `${s.night}|${rows.map((r) => `${r.enemy}${r.count}${r.elite}`).join()}|${this.ctx.layout.W}`;
    if (key === this.key) return;
    this.key = key;
    const L = this.ctx.layout;
    const w = Math.min(L.W - 12, 216), rowH = 22;
    const introH = intros.length ? intros.length * 22 + 4 : 0;
    const h = 34 + rows.length * rowH + introH + 6;
    const x = Math.round((L.W - w) / 2), top = L.H - L.top - 64;
    this.panel.size(w, h).pos(x, top - h);
    this.title.set(tr('omen.title')).pos(x + w / 2, top - 6);
    this.sub.set(tr('omen.subtitle')).pos(x + w / 2, top - 18);
    this.close.layout(x + w - 24, top - 24, 20, 20);
    rows.forEach((r, i) => {
      const row = this.rows[i];
      if (!row) return;
      row.node.active = true;
      const y = top - 34 - (i + 1) * rowH + 3;
      row.node.setPosition(x + 18, y, 0);
      const boss = !!ENEMIES[r.enemy]?.boss;
      row.img.set(boss ? 'icon_skull' : enemySprite({ id: r.enemy, anim: 'move', animT: 0 }));
      const parts = [`x${r.count}`];
      if (r.elite) parts.push(`${tr('omen.elite')} ${r.elite}`);
      if (boss) parts.push(tr('omen.boss'));
      parts.push(r.rifts.map((k) => tr('omen.rift', { n: k + 1 })).join(' '));
      row.text.set(`${tr(`enemy.${r.enemy}.name`)} ${parts.join('  ')}`).pos(14, 8);
    });
    for (let i = rows.length; i < this.rows.length; i++) this.rows[i].node.active = false;
    this.intro.set(intros.map((k) => tr(k)).join('\n')).pos(x + w / 2, top - 34 - rows.length * rowH - 4);
  }
}

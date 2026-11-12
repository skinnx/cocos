// First-run tutorial overlay (SPEC §10.3): 5 contextual steps driven by core (state.tutorial, advanced only when the
// player does the right thing). Each step = one sentence on a parchment bubble + a bobbing arrow pointing at the
// relevant thing (drag area, nearest tree, hammer button, a brazier, the start-night button). Skippable.
import type { Node } from 'cc';
import type { GameState } from '../../core/api';
import type { Ctx } from '../Ctx';
import { tr } from '../logic/strings';
import { mkNode, PAL, SpriteHandle } from '../render/Nodes';
import { BitmapText } from './BitmapText';
import type { Hud } from './Hud';
import { NineSlice } from './NineSlice';
import { Button } from './UiKit';

export class Tutorial {
  readonly node: Node;
  private bubble: NineSlice;
  private text: BitmapText;
  private arrow: SpriteHandle;
  private skip: Button;
  private step = -2;

  constructor(parent: Node, readonly ctx: Ctx, readonly hud: Hud, readonly drawerTop: () => number) {
    this.node = mkNode('tutorial', parent);
    this.bubble = new NineSlice(this.node, 'ui_panel_parchment');
    this.text = new BitmapText(this.node, { ax: 0.5, ay: 0.5, align: 'center', color: PAL.w, maxWidth: 180 });
    this.arrow = new SpriteHandle('arrow', this.node, 'ui_arrow_edge').anchor(0.5, 0.5);
    this.skip = new Button(this.node, { text: tr('tutorial.skip'), z: 50 });
    this.skip.onTap = () => {
      ctx.sfx('ui_click');
      ctx.cmd({ t: 'skipTutorial' });
      ctx.meta.tutorialDone = true; ctx.saveMeta();
      this.node.active = false;
    };
    this.node.active = false;
  }

  /** Where the arrow points (UI px), per step. */
  private target(s: GameState): { x: number; y: number } | null {
    const L = this.ctx.layout;
    const leader = s.heroes.find((h) => h.leader) ?? s.heroes[0];
    switch (this.step) {
      case 0: return { x: L.W / 2, y: L.H * 0.25 };
      case 1: {
        if (!leader) return null;
        let best = null as null | { x: number; y: number }, bd = Infinity;
        for (const n of s.nodes) {
          if ((n.kind !== 'pine' && n.kind !== 'oak') || n.hp <= 0) continue;
          const d = Math.hypot(n.x - leader.x, n.y - leader.y);
          if (d < bd) { bd = d; best = { x: n.x + 0.5, y: n.y }; }
        }
        return best ? this.ctx.tileToUi(best.x, best.y - 1) : null;
      }
      case 2:
        if (s.buildMode) return { x: 34, y: this.drawerTop() - 30 };
        return { x: this.hud.hammer.x + this.hud.hammer.w / 2, y: this.hud.hammer.y + this.hud.hammer.h + 12 };
      case 3: {
        const b = s.buildings.find((q) => q.id === 'brazier');
        return b ? this.ctx.tileToUi(b.x + 0.5, b.y - 1.2) : null;
      }
      case 4: return { x: this.hud.startNight.x + this.hud.startNight.w / 2, y: this.hud.startNight.y + this.hud.startNight.h + 12 };
      default: return null;
    }
  }

  update(s: GameState): void {
    const on = s.tutorial >= 0 && s.tutorial <= 4 && !this.ctx.meta.tutorialDone && (s.phase === 'day' || s.phase === 'dusk');
    this.node.active = on;
    if (!on) return;
    const L = this.ctx.layout;
    if (s.tutorial !== this.step) {
      this.step = s.tutorial;
      this.text.set(tr(`tutorial.${this.step}`));
      this.skip.setText(tr('tutorial.skip'));
    }
    // bubble sits under the top HUD, right of the hero portraits
    if (this.text.opts.maxWidth !== L.W - 64) { this.text.opts.maxWidth = L.W - 64; this.text.refresh(); }
    const w = Math.min(L.W - 44, this.text.width + 16), h = this.text.height + 12;
    const cx = Math.round(L.W / 2 + 18), by = Math.round(L.H - L.top - 112 - h);
    this.bubble.size(w, h).pos(Math.round(cx - w / 2), by);
    this.text.pos(cx, by + Math.round(h / 2));
    this.skip.layout(cx - 40, by - 24, 80, 20);
    const tg = this.target(s);
    if (!tg) { this.arrow.show(false); return; }
    // the arrow sprite points right (+x); rotate it to point down at the target, bobbing
    const bob = Math.round(Math.sin(this.ctx.time * 6) * 3);
    this.arrow.show(true).pos(Math.round(tg.x), Math.round(tg.y + 10 + bob)).angle(-90).color(PAL.z[0], PAL.z[1], PAL.z[2], 255);
  }
}

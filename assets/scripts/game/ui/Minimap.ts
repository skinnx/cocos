// Minimap (SPEC §10.2): 56×56 RGBA texture (1 texel per tile) refreshed ~5×/s with uploadData — island, light
// territory, buildings, active rifts, heroes, enemies at night — framed with ui_minimap_frame. Tap to enlarge,
// tap again to shrink. A camera-view marker uses the pin icon.
import { Sprite, SpriteFrame, UITransform, type Node, type Texture2D } from 'cc';
import type { GameState } from '../../core/api';
import type { Ctx } from '../Ctx';
import { fillMinimap, projectToMinimap } from '../logic/minimap';
import { makeTexture } from '../render/Atlas';
import { mkNode, SpriteHandle } from '../render/Nodes';
import { NineSlice } from './NineSlice';
import { uiInput, type Hit } from './UiKit';

export class Minimap {
  readonly node: Node;
  private img: Node;
  private ut: UITransform;
  private frame: NineSlice;
  private pin: SpriteHandle;
  private tex: Texture2D | null = null;
  private buf = new Uint8Array(0);
  private size = 0;
  private acc = 1;
  private big = false;
  private small = { x: 0, y: 0, s: 37 };
  private px = 37;
  private hit: Hit;

  constructor(parent: Node, readonly ctx: Ctx) {
    this.node = mkNode('minimap', parent);
    this.frame = new NineSlice(this.node, 'ui_minimap_frame');
    this.img = mkNode('img', this.node);
    const sp = this.img.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    this.ut = this.img.getComponent(UITransform)!;
    this.ut.setAnchorPoint(0, 0);
    this.pin = new SpriteHandle('pin', this.node, 'icon_pin').anchor(0.5, 0);
    this.hit = uiInput.add({
      x: 0, y: 0, w: 0, h: 0, z: 25,
      active: () => this.node.activeInHierarchy,
      onUp: (_x, _y, inside) => { if (inside) { this.big = !this.big; this.ctx.sfx('ui_click'); this.apply(); } },
    });
  }

  layout(x: number, y: number, s: number): void { this.small = { x, y, s }; this.apply(); }

  private apply(): void {
    const L = this.ctx.layout;
    let { x, y, s } = this.small;
    if (this.big) {
      s = Math.min(L.W - 24, 200);
      x = Math.round((L.W - s) / 2); y = Math.round((L.H - s) / 2);
    }
    this.px = s;
    this.node.setPosition(x, y, 0);
    this.ut.setContentSize(s, s);
    this.frame.size(s + 6, s + 6).pos(-3, -3);
    Object.assign(this.hit, { x: x - 3, y: y - 3, w: s + 6, h: s + 6, z: this.big ? 60 : 25 });
  }

  update(s: GameState, dt: number): void {
    const n = s.map.size;
    if (n !== this.size || !this.tex) {
      this.size = n;
      this.buf = new Uint8Array(n * n * 4);
      this.tex = makeTexture(n, n, this.buf);
      const sf = new SpriteFrame();
      sf.texture = this.tex;
      this.img.getComponent(Sprite)!.spriteFrame = sf;
      this.acc = 1;
    }
    this.acc += dt;
    if (this.acc >= 0.2) {
      this.acc = 0;
      fillMinimap(this.buf, {
        size: n, biome: s.map.biome, explored: s.map.explored, light: s.map.light, night: s.phase === 'night',
        buildings: s.buildings,
        rifts: s.pois.filter((p) => p.kind === 'rift').map((p) => ({ x: p.x, y: p.y, active: p.active })),
        pois: s.pois.filter((p) => p.kind !== 'rift' && p.active),
        heroes: s.heroes, enemies: s.enemies,
      });
      this.tex.uploadData(this.buf);
    }
    const c = projectToMinimap(this.ctx.cam.cam.x, this.ctx.cam.cam.y, n, this.px);
    this.pin.pos(Math.round(c.x), Math.round(c.y));
  }
}

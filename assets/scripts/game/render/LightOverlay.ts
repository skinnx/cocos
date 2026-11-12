// Darkness overlay (SPEC §5): a small RGBA Texture2D (1 texel = 4×4 art px) refreshed from state.map.lightAlpha with
// uploadData every frame, NEAREST-filtered so light edges are pixel stair-steps, colour #1b1b2f, fire flicker and a
// faint warm tint inside the lit area at night. Unexplored tiles stay dark (fog of war, §4.2).
import { Rect, Size, Sprite, SpriteFrame, UITransform, Vec2, type Node, type Texture2D } from 'cc';
import type { GameState } from '../../core/api';
import { fillLight, TEXELS_PER_TILE } from '../logic/light';
import { TILE } from '../logic/camera';
import { makeTexture } from './Atlas';
import { mkNode, PAL, SpriteHandle } from './Nodes';

export class LightOverlay {
  private tex: Texture2D | null = null;
  private buf: Uint8Array = new Uint8Array(0);
  private node: Node;
  private sprite: Sprite;
  private size = 0;
  /** darkness around the island (off-map water) so the night does not stop at the map edge */
  private rim: SpriteHandle[] = [];

  constructor(parent: Node) {
    this.node = mkNode('light', parent);
    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    for (let i = 0; i < 4; i++) this.rim.push(new SpriteHandle('rim', parent));
  }

  bind(state: GameState): void {
    const n = state.map.size;
    if (n === this.size && this.tex) return;
    this.size = n;
    const W = n * TEXELS_PER_TILE;
    this.buf = new Uint8Array(W * W * 4);
    this.tex = makeTexture(W, W, this.buf);
    const sf = new SpriteFrame();
    sf.reset({ texture: this.tex, rect: new Rect(0, 0, W, W), originalSize: new Size(W, W), offset: new Vec2(0, 0), isRotate: false });
    this.sprite.spriteFrame = sf;
    const ut = this.node.getComponent(UITransform)!;
    ut.setContentSize(n * TILE, n * TILE);
    ut.setAnchorPoint(0, 1);
    this.node.setPosition(0, 0, 0);
    const M = 40 * TILE, S = n * TILE; // rim width: 40 tiles of water around the map
    this.rim[0].solid(S + 2 * M, M, 0, 0).pos(-M, 0);          // north
    this.rim[1].solid(S + 2 * M, M, 0, 1).pos(-M, -S);         // south
    this.rim[2].solid(M, S, 1, 1).pos(0, 0);                  // west
    this.rim[3].solid(M, S, 0, 1).pos(S, 0);                  // east
  }

  update(state: GameState, t: number, range?: { x0: number; y0: number; x1: number; y1: number }): void {
    if (!this.tex) return;
    const night = state.phase === 'night' || state.phase === 'dusk' || (state.phase === 'defeat');
    fillLight(this.buf, { size: state.map.size, lightAlpha: state.map.lightAlpha, explored: state.map.explored, night, t }, range);
    this.tex.uploadData(this.buf);
    // ambient darkness = the (always dark-at-night, fogged-or-not) map corner's overlay alpha
    const m = state.map;
    const amb = m.explored[0] ? m.lightAlpha[0] : (night ? 0.97 : m.lightAlpha[0]);
    for (const r of this.rim) r.color(PAL.k[0], PAL.k[1], PAL.k[2], Math.round(Math.max(0, Math.min(1, amb)) * 255));
  }
}

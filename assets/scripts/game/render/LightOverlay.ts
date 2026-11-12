// Darkness overlay (SPEC §5): a small RGBA Texture2D (1 texel = 4×4 art px) refreshed from state.map.lightAlpha with
// uploadData every frame, NEAREST-filtered so light edges are pixel stair-steps, colour #1b1b2f, fire flicker and a
// faint warm tint inside the lit area at night. Unexplored tiles stay dark (fog of war, §4.2).
import { Sprite, SpriteFrame, type Node, type Texture2D } from 'cc';
import type { GameState } from '../../core/api';
import { fillLight, TEXELS_PER_TILE } from '../logic/light';
import { TILE } from '../logic/camera';
import { makeTexture } from './Atlas';
import { mkNode } from './Nodes';
import { UITransform } from 'cc';

export class LightOverlay {
  private tex: Texture2D | null = null;
  private buf: Uint8Array = new Uint8Array(0);
  private node: Node;
  private sprite: Sprite;
  private size = 0;

  constructor(parent: Node) {
    this.node = mkNode('light', parent);
    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  }

  bind(state: GameState): void {
    const n = state.map.size;
    if (n === this.size && this.tex) return;
    this.size = n;
    const W = n * TEXELS_PER_TILE;
    this.buf = new Uint8Array(W * W * 4);
    this.tex = makeTexture(W, W, this.buf);
    const sf = new SpriteFrame();
    sf.texture = this.tex;
    this.sprite.spriteFrame = sf;
    const ut = this.node.getComponent(UITransform)!;
    ut.setContentSize(n * TILE, n * TILE);
    ut.setAnchorPoint(0, 1);
    this.node.setPosition(0, 0, 0);
  }

  update(state: GameState, t: number): void {
    if (!this.tex) return;
    const night = state.phase === 'night' || state.phase === 'dusk' || (state.phase === 'defeat');
    fillLight(this.buf, { size: state.map.size, lightAlpha: state.map.lightAlpha, explored: state.map.explored, night, t });
    this.tex.uploadData(this.buf);
  }
}

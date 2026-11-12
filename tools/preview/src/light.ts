// Light / fog overlay (SPEC §5) using the client's pure texel generator (game/logic/light.ts):
// 1 texel = 4×4 art px, #1b1b2f, NEAREST upscale → stepped pixel edges, flicker, warm ring at night.
import type { GameState } from './core';
import { fillLight, TEXELS_PER_TILE } from './shared';

export class LightOverlay {
  private cv = document.createElement('canvas');
  private g = this.cv.getContext('2d')!;
  private img: ImageData | null = null;

  /** camX/camY = world art px at screen (0,0). */
  draw(ctx: CanvasRenderingContext2D, s: GameState, camX: number, camY: number, t: number) {
    const n = s.map.size, W = n * TEXELS_PER_TILE;
    if (this.cv.width !== W) { this.cv.width = W; this.cv.height = W; this.img = null; }
    if (!this.img) this.img = this.g.createImageData(W, W);
    const buf = new Uint8Array(this.img.data.buffer);
    fillLight(buf, { size: n, lightAlpha: s.map.lightAlpha, explored: s.map.explored, night: s.phase === 'night', t });
    this.g.putImageData(this.img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const k = 16 / TEXELS_PER_TILE;
    ctx.drawImage(this.cv, -camX, -camY, W * k, W * k);
  }
}

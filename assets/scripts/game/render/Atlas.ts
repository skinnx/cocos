// Loads assets/resources/art/atlas.png + atlas.json, forces NEAREST filtering (no mipmaps) and builds one SpriteFrame
// per atlas rect, cached by name (SPEC §13.3). Also builds, where the platform allows reading the image pixels, a
// white-silhouette twin texture used for the 80 ms hit flash and elite glow outlines, plus a tiny solid-white
// texture for UI fades/dims.
import { ImageAsset, JsonAsset, Rect, resources, Size, SpriteFrame, Texture2D, Vec2 } from 'cc';
import { parseAtlas, type AtlasData, type FrameRect, countFrames, frameName, nineRects } from '../logic/atlasData';

function nearest(tex: Texture2D): void {
  tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
  tex.setMipFilter(Texture2D.Filter.NONE);
  tex.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
}

function makeFrame(tex: Texture2D, x: number, y: number, w: number, h: number): SpriteFrame {
  const sf = new SpriteFrame();
  sf.reset({ texture: tex, rect: new Rect(x, y, w, h), originalSize: new Size(w, h), offset: new Vec2(0, 0), isRotate: false });
  return sf;
}

/** Create an RGBA texture from raw pixels (row 0 = top). */
export function makeTexture(w: number, h: number, data?: Uint8Array): Texture2D {
  const tex = new Texture2D();
  tex.reset({ width: w, height: h, format: Texture2D.PixelFormat.RGBA8888 });
  nearest(tex);
  if (data) tex.uploadData(data);
  return tex;
}

export class Atlas {
  static inst: Atlas;
  readonly data: AtlasData;
  private readonly frames = new Map<string, SpriteFrame>();
  private readonly flashFrames = new Map<string, SpriteFrame>();
  private readonly subFrames = new Map<string, SpriteFrame>();
  private flashTex: Texture2D | null = null;
  readonly solid: SpriteFrame;

  private constructor(readonly tex: Texture2D, json: unknown) {
    this.data = parseAtlas(json);
    nearest(tex);
    const white = new Uint8Array(4 * 4 * 4).fill(255);
    this.solid = makeFrame(makeTexture(4, 4, white), 1, 1, 2, 2);
    this.buildFlashTexture();
  }

  /** Load atlas texture + json from resources (art/atlas). */
  static load(done: (err: Error | null, atlas: Atlas | null) => void): void {
    resources.load('art/atlas', JsonAsset, (err, json) => {
      if (err || !json || !json.json) { done(err ?? new Error('atlas.json missing'), null); return; }
      const finish = (tex: Texture2D) => {
        try { Atlas.inst = new Atlas(tex, json.json); done(null, Atlas.inst); } catch (e) { done(e as Error, null); }
      };
      resources.load('art/atlas/texture', Texture2D, (e2, tex) => {
        if (!e2 && tex) { finish(tex); return; }
        // fallback: import the PNG as an ImageAsset and wrap it in a texture ourselves
        resources.load('art/atlas', ImageAsset, (e3, img) => {
          if (e3 || !img) { done(e3 ?? e2 ?? new Error('atlas.png missing'), null); return; }
          const t = new Texture2D(); t.image = img; finish(t);
        });
      });
    });
  }

  has = (name: string): boolean => this.data.frames.has(name);
  rect(name: string): FrameRect | undefined { return this.data.frames.get(name); }
  width(name: string): number { return this.data.frames.get(name)?.w ?? 0; }

  frame(name: string): SpriteFrame | null {
    let sf = this.frames.get(name);
    if (sf) return sf;
    const r = this.data.frames.get(name);
    if (!r) return null;
    sf = makeFrame(this.tex, r.x, r.y, r.w, r.h);
    this.frames.set(name, sf);
    return sf;
  }

  /** White-silhouette version of a frame (hit flash / glow), or null when pixels could not be read. */
  flash(name: string): SpriteFrame | null {
    if (!this.flashTex) return null;
    let sf = this.flashFrames.get(name);
    if (sf) return sf;
    const r = this.data.frames.get(name);
    if (!r) return null;
    sf = makeFrame(this.flashTex, r.x, r.y, r.w, r.h);
    this.flashFrames.set(name, sf);
    return sf;
  }

  /** The 9 sub-frames of a 9-slice sprite (row-major from top-left); null pieces have zero size. */
  nine(name: string): Array<SpriteFrame | null> | null {
    const r = this.data.frames.get(name);
    if (!r || !r.slice) return null;
    return nineRects(r).map((q, i) => {
      if (q.w <= 0 || q.h <= 0) return null;
      const key = `${name}#${i}`;
      let sf = this.subFrames.get(key);
      if (!sf) { sf = makeFrame(this.tex, q.x, q.y, q.w, q.h); this.subFrames.set(key, sf); }
      return sf;
    });
  }

  count(base: string): number { return countFrames(this.has, base); }
  anim(base: string, i: number): string { return frameName(this.has, base, i); }

  private buildFlashTexture(): void {
    try {
      const img = this.tex.image;
      const src = img ? img.data : null;
      const W = this.data.size[0], H = this.data.size[1];
      if (!src || !W || !H) return;
      let px: Uint8ClampedArray | Uint8Array | null = null;
      if (ArrayBuffer.isView(src)) px = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
      else if (typeof document !== 'undefined') {
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const g = c.getContext('2d');
        if (!g) return;
        g.drawImage(src as CanvasImageSource, 0, 0);
        px = g.getImageData(0, 0, W, H).data;
      }
      if (!px || px.length < W * H * 4) return;
      const out = new Uint8Array(W * H * 4);
      for (let i = 0; i < W * H; i++) {
        const a = px[i * 4 + 3];
        if (a > 0) { out[i * 4] = 255; out[i * 4 + 1] = 255; out[i * 4 + 2] = 255; out[i * 4 + 3] = a; }
      }
      this.flashTex = makeTexture(W, H, out);
    } catch {
      this.flashTex = null; // native platforms without pixel access: hit flash falls back to a colour tint
    }
  }
}

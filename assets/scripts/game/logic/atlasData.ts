// Pure atlas.json parsing (no 'cc'). Format (docs/CONTRACT.md):
//   { frames: { [name]: { x, y, w, h, ax, ay, slice?: [l, t, r, b] } }, size: [W, H] }
// (ax, ay) = anchor in art px from the sprite's top-left. Cocos anchors are normalised with +y up.
export interface FrameRect {
  name: string; x: number; y: number; w: number; h: number;
  /** anchor in art px from top-left */
  ax: number; ay: number;
  /** normalised Cocos anchor (0..1, +y up) */
  anchorX: number; anchorY: number;
  /** 9-slice insets in art px (left, top, right, bottom) */
  slice: [number, number, number, number] | null;
}
export interface AtlasData { size: [number, number]; frames: Map<string, FrameRect> }

/** Default anchor (art px from top-left) when the json omits ax/ay — CONTRACT defaults. */
export function defaultAnchor(name: string, w: number, h: number): [number, number] {
  if (/^(tile_|edge_|ui_|icon_|font|portrait_|boon_|logo)/.test(name)) return [0, 0];
  if (/^(fx_|proj_|enemy_eyes)/.test(name)) return [w / 2, h / 2];
  return [w / 2, h];
}

/** Default 9-slice insets for panel / button / card / bar sprites when the json does not provide any. */
export function defaultSlice(name: string, w: number, h: number): [number, number, number, number] | null {
  if (!/^ui_(panel|btn|tab|card|bar|minimap_frame)/.test(name)) return null;
  const ix = Math.max(1, Math.min(6, Math.floor((w - 1) / 2)));
  const iy = Math.max(1, Math.min(6, Math.floor((h - 1) / 2)));
  if (name.startsWith('ui_bar')) return [Math.min(2, ix), Math.min(2, iy), Math.min(2, ix), Math.min(2, iy)];
  return [ix, iy, ix, iy];
}

export function parseAtlas(json: unknown): AtlasData {
  if (!json || typeof json !== 'object') throw new Error('atlas.json: not an object');
  const j = json as { frames?: Record<string, any>; size?: unknown };
  if (!j.frames || typeof j.frames !== 'object') throw new Error('atlas.json: missing frames');
  const size: [number, number] = Array.isArray(j.size) && j.size.length >= 2 ? [Number(j.size[0]), Number(j.size[1])] : [0, 0];
  const frames = new Map<string, FrameRect>();
  for (const name of Object.keys(j.frames)) {
    const f = j.frames[name];
    if (!f) continue;
    const x = Number(f.x), y = Number(f.y), w = Number(f.w), h = Number(f.h);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) throw new Error(`atlas.json: bad rect for ${name}`);
    const [dax, day] = defaultAnchor(name, w, h);
    const ax = Number.isFinite(Number(f.ax)) && f.ax !== undefined ? Number(f.ax) : dax;
    const ay = Number.isFinite(Number(f.ay)) && f.ay !== undefined ? Number(f.ay) : day;
    let slice: [number, number, number, number] | null = null;
    if (Array.isArray(f.slice) && f.slice.length === 4) slice = [f.slice[0], f.slice[1], f.slice[2], f.slice[3]].map(Number) as [number, number, number, number];
    else slice = defaultSlice(name, w, h);
    frames.set(name, { name, x, y, w, h, ax, ay, anchorX: ax / w, anchorY: 1 - ay / h, slice });
    if (size[0] === 0) { size[0] = Math.max(size[0], x + w); size[1] = Math.max(size[1], y + h); }
  }
  return { size, frames };
}

/** Number of frames of an animation `<base>_0..n-1`; 1 if only `<base>` exists, 0 if neither. */
export function countFrames(has: (name: string) => boolean, base: string): number {
  let n = 0;
  while (has(`${base}_${n}`)) n++;
  if (n > 0) return n;
  return has(base) ? 1 : 0;
}

/** Name of frame i (looping) of an animation, handling single-frame names without suffix. */
export function frameName(has: (name: string) => boolean, base: string, i: number): string {
  const n = countFrames(has, base);
  if (n <= 1) return has(base) ? base : `${base}_0`;
  return `${base}_${((i % n) + n) % n}`;
}

/** The 9 sub-rects (art px, atlas space, row-major from top-left) of a 9-slice frame. */
export function nineRects(f: FrameRect): Array<{ x: number; y: number; w: number; h: number }> {
  const [l, t, r, b] = f.slice ?? [0, 0, 0, 0];
  const xs = [f.x, f.x + l, f.x + f.w - r], ws = [l, f.w - l - r, r];
  const ys = [f.y, f.y + t, f.y + f.h - b], hs = [t, f.h - t - b, b];
  const out: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) out.push({ x: xs[col], y: ys[row], w: ws[col], h: hs[row] });
  return out;
}

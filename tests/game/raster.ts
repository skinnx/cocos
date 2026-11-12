// Software compositor for the mock scene graph (tests only): walks the node tree like the Cocos 2D renderer
// (depth-first, sibling order), applies node transforms (position / scale / angle), UITransform size + anchor and
// Sprite frame/colour (incl. radial FILLED), samples textures with NEAREST filtering and writes a PNG. Lets the
// view layer's layout be looked at without the real engine.
import { inflateSync, deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import * as cc from './ccMock';

export function decodePNG(buf: Buffer): { w: number; h: number; data: Uint8Array } {
  let p = 8, w = 0, h = 0, ct = 0;
  const idat: Buffer[] = [];
  let pal: Buffer | null = null, trns: Buffer | null = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    else if (type === 'PLTE') pal = d; else if (type === 'tRNS') trns = d; else if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = new Uint8Array(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i], a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = x;
      if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1);
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (ct === 6) { out[o] = cur[x * 4]; out[o + 1] = cur[x * 4 + 1]; out[o + 2] = cur[x * 4 + 2]; out[o + 3] = cur[x * 4 + 3]; }
      else if (ct === 2) { out[o] = cur[x * 3]; out[o + 1] = cur[x * 3 + 1]; out[o + 2] = cur[x * 3 + 2]; out[o + 3] = 255; }
      else { const k = cur[x]; out[o] = pal![k * 3]; out[o + 1] = pal![k * 3 + 1]; out[o + 2] = pal![k * 3 + 2]; out[o + 3] = trns && k < trns.length ? trns[k] : 255; }
    }
    prev.set(cur);
  }
  return { w, h, data: out };
}

function crc32(b: Buffer): number {
  let c = ~0;
  for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
export function encodePNG(w: number, h: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Pixel data of textures (atlas decoded from disk, dynamic ones from their last uploadData). */
export function texData(t: cc.TextureBase | null): Uint8Array | null {
  const any = t as unknown as { data?: Uint8Array };
  return any?.data ?? null;
}

type M = [number, number, number, number, number, number]; // a b c d e f  : x' = a x + c y + e ; y' = b x + d y + f
const mul = (p: M, q: M): M => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];

/** Render the canvas node into a W×H RGBA image; `pxPerDesign` = output pixels per design unit. */
export function renderTree(canvas: cc.Node, visW: number, visH: number, pxPerDesign: number, bg = [20, 20, 34]): { w: number; h: number; data: Uint8Array; sprites: number } {
  const W = Math.round(visW * pxPerDesign), H = Math.round(visH * pxPerDesign);
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255; }
  // canvas centre = screen centre; output y flipped (screen +y up)
  const base: M = [pxPerDesign, 0, 0, -pxPerDesign, W / 2, H / 2];
  let sprites = 0;
  const visit = (n: cc.Node, m: M) => {
    if (!n.active) return;
    const a = (n.angle * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
    const local: M = [cs * n.scale.x, sn * n.scale.x, -sn * n.scale.y, cs * n.scale.y, n.position.x, n.position.y];
    const wm = mul(m, local);
    const sp = n.getComponent(cc.Sprite);
    const ut = n.getComponent(cc.UITransform);
    if (sp && ut && sp.spriteFrame && sp.spriteFrame.texture) {
      const data = texData(sp.spriteFrame.texture);
      if (data) { drawSprite(out, W, H, wm, sp, ut, data, sp.spriteFrame.texture.width); sprites++; }
    }
    for (const c of n.children) visit(c, wm);
  };
  visit(canvas, base);
  return { w: W, h: H, data: out, sprites };
}

function drawSprite(out: Uint8Array, W: number, H: number, m: M, sp: cc.Sprite, ut: cc.UITransform, tex: Uint8Array, texW: number): void {
  const w = ut.contentSize.width, h = ut.contentSize.height;
  if (w <= 0 || h <= 0) return;
  const x0 = -ut.anchorX * w, y0 = -ut.anchorY * h;
  const corners = [[x0, y0], [x0 + w, y0], [x0, y0 + h], [x0 + w, y0 + h]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
  const minX = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])))), maxX = Math.min(W - 1, Math.ceil(Math.max(...corners.map((c) => c[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])))), maxY = Math.min(H - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))));
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-9) return;
  const r = sp.spriteFrame!.rect;
  const col = sp.color;
  const radial = sp.type === cc.Sprite.Type.FILLED && sp.fillType === cc.Sprite.FillType.RADIAL;
  for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
    const dx = px + 0.5 - m[4], dy = py + 0.5 - m[5];
    const lx = (m[3] * dx - m[2] * dy) / det, ly = (-m[1] * dx + m[0] * dy) / det;
    const u = (lx - x0) / w, v = (ly - y0) / h; // v = 0 bottom
    if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
    if (radial) {
      let ang = Math.atan2(v - 0.5, u - 0.5) / (Math.PI * 2) - sp.fillStart;
      ang = ((ang % 1) + 1) % 1;
      if (ang > sp.fillRange) continue;
    }
    const tx = Math.min(r.width - 1, Math.floor(u * r.width)) + r.x, ty = Math.min(r.height - 1, Math.floor((1 - v) * r.height)) + r.y;
    const o = (ty * texW + tx) * 4;
    const a = (tex[o + 3] / 255) * (col.a / 255);
    if (a <= 0) continue;
    const q = (py * W + px) * 4;
    out[q] = out[q] * (1 - a) + ((tex[o] * col.r) / 255) * a;
    out[q + 1] = out[q + 1] * (1 - a) + ((tex[o + 1] * col.g) / 255) * a;
    out[q + 2] = out[q + 2] * (1 - a) + ((tex[o + 2] * col.b) / 255) * a;
  }
}

export function atlasPixels(): { w: number; h: number; data: Uint8Array } {
  return decodePNG(readFileSync('assets/resources/art/atlas.png'));
}
export function writeShot(path: string, img: { w: number; h: number; data: Uint8Array }): void { writeFileSync(path, encodePNG(img.w, img.h, img.data)); }

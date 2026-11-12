// Atlas builder + ui sprite module checks (owner: art-ui).
// Runs the real CLI with --allow-missing into a temp dir, then checks packing and ui completeness.
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const ROOT = resolve(__dirname, '../..');
const BUILDER = join(ROOT, 'tools/art/build-atlas.mjs');

type Frame = { x: number; y: number; w: number; h: number; ax: number; ay: number; slice?: number[]; advance?: number };
type Atlas = { size: [number, number]; frames: Record<string, Frame> };

function decodePNG(buf: Buffer) { // minimal RGBA8 decoder (filter types 0..4)
  let o = 8, w = 0, h = 0; const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); expect(data[8]).toBe(8); expect(data[9]).toBe(6); }
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * 4, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x], a = x >= 4 ? out[y * stride + x - 4] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= 4 && y ? out[(y - 1) * stride + x - 4] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      out[y * stride + x] = (v + pred) & 255;
    }
  }
  return { w, h, data: out };
}
const overlap = (a: Frame, b: Frame) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

let dir: string, atlas: Atlas, report: any, status: number | null, stderr: string;
let MANIFEST: { owner: string; kind: string; name: string }[];
let uiEntries: { name: string; px: any; kind: string; slice?: number[]; advance?: number }[];
let PALETTE: Record<string, string>;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'emberhold-atlas-'));
  const r = spawnSync(process.execPath, [BUILDER, '--allow-missing', '--out', dir, '--docs', join(dir, 'contact'), '--report', join(dir, 'report.json')], { encoding: 'utf8', cwd: ROOT });
  status = r.status; stderr = r.stderr;
  atlas = JSON.parse(readFileSync(join(dir, 'atlas.json'), 'utf8'));
  report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
  ({ MANIFEST } = await import(join(ROOT, 'tools/art/manifest.mjs')));
  ({ PALETTE } = await import(join(ROOT, 'tools/art/pixel.mjs')));
  uiEntries = (await import(join(ROOT, 'tools/art/sprites/ui.mjs'))).default();
}, 120000);

describe('build-atlas CLI', () => {
  it('only fails because of other groups (ui is clean)', () => {
    const uiErr = (report.errors as string[]).filter((e) => /\b(ui_|icon_|boon_|font[57]_|logo)/.test(e) || /sprites\/ui\.mjs/.test(e));
    expect(uiErr).toEqual([]);
    if (status !== 0) expect(report.errors.length, stderr).toBeGreaterThan(0);
  });
  it('writes atlas.png, atlas.json, font.json and the ui contact sheet', () => {
    for (const f of ['atlas.png', 'atlas.json', 'font.json', 'contact/contact-ui.png']) expect(existsSync(join(dir, f)), f).toBe(true);
  });
  it('atlas fits in 2048² and every frame is inside the texture', () => {
    const [W, H] = atlas.size;
    expect(W).toBeLessThanOrEqual(2048); expect(H).toBeLessThanOrEqual(2048);
    const png = decodePNG(readFileSync(join(dir, 'atlas.png')));
    expect([png.w, png.h]).toEqual([W, H]);
    for (const [n, f] of Object.entries(atlas.frames)) {
      expect(f.x >= 0 && f.y >= 0 && f.x + f.w <= W && f.y + f.h <= H, n).toBe(true);
    }
  });
  it('frames never overlap (incl. 1px padding / tile extrusion)', () => {
    const kind = new Map(MANIFEST.map((m) => [m.name, m.kind]));
    const rects = new Map<string, Frame>();
    for (const [n, f] of Object.entries(atlas.frames)) {
      const key = `${f.x},${f.y},${f.w},${f.h}`; if (rects.has(key)) continue; // declared alias shares a rect
      const e = kind.get(n) === 'tile' ? 1 : 0;
      rects.set(key, { ...f, x: f.x - e, y: f.y - e, w: f.w + 2 * e, h: f.h + 2 * e });
    }
    const list = [...rects.values()].sort((a, b) => a.x - b.x);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length && list[j].x < list[i].x + list[i].w + 1; j++) {
      const a = list[i], b = list[j];
      expect(overlap({ ...a, w: a.w + 1, h: a.h + 1 }, b) || overlap({ ...b, w: b.w + 1, h: b.h + 1 }, a), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`).toBe(false);
    }
  });
  it('only manifest names are emitted', () => {
    const names = new Set(MANIFEST.map((m) => m.name));
    for (const n of Object.keys(atlas.frames)) expect(names.has(n), n).toBe(true);
  });
});

describe('ui sprites', () => {
  it('build() returns every ui manifest name exactly once', () => {
    const want = MANIFEST.filter((m) => m.owner === 'ui').map((m) => m.name).sort();
    expect(want.length).toBe(186);
    expect(uiEntries.map((e) => e.name).sort()).toEqual(want);
    expect(report.byGroup.ui.status).toBe('complete');
    for (const n of want) expect(atlas.frames[n], n).toBeDefined();
  });
  it('atlas pixels match the ui sprites exactly', () => {
    const png = decodePNG(readFileSync(join(dir, 'atlas.png'))), W = atlas.size[0];
    for (const e of uiEntries) {
      const f = atlas.frames[e.name]; expect([f.w, f.h]).toEqual([e.px.w, e.px.h]);
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
        const c = e.px.d[y][x], i = ((f.y + y) * W + f.x + x) * 4, a = png.data[i + 3];
        if (c === '.') { if (a !== 0) throw new Error(`${e.name} (${x},${y}) should be transparent`); continue; }
        const hex = '#' + [0, 1, 2].map((k) => png.data[i + k].toString(16).padStart(2, '0')).join('');
        if (a !== 255 || hex !== PALETTE[c]) throw new Error(`${e.name} (${x},${y}) ${hex} != ${PALETTE[c]}`);
      }
    }
  });
  it('9-slice panels carry valid slice insets', () => {
    for (const n of ['ui_panel_parchment', 'ui_panel_stone', 'ui_btn_up', 'ui_btn_down', 'ui_btn_disabled', 'ui_tab_on', 'ui_tab_off',
      'ui_card_common', 'ui_card_rare', 'ui_card_legendary', 'ui_bar_frame', 'ui_bar_fill_red', 'ui_minimap_frame']) {
      const f = atlas.frames[n]; expect(f.slice, n).toHaveLength(4);
      const [l, t, r, b] = f.slice!; expect(l + r < f.w && t + b < f.h, n).toBe(true);
    }
  });
  it('fonts: every glyph has an advance; font5 covers ASCII 32..126, font7 digits + - !', () => {
    const font = JSON.parse(readFileSync(join(dir, 'font.json'), 'utf8'));
    for (let c = 32; c <= 126; c++) {
      const f = atlas.frames[`font5_${c}`]; expect(f.advance, String.fromCharCode(c)).toBeGreaterThan(0);
      expect(font.font5.glyphs[c].advance).toBe(f.advance);
    }
    for (const ch of '0123456789+-!') expect(atlas.frames[`font7_${ch.charCodeAt(0)}`].advance).toBeGreaterThan(0);
    // digits are tabular so counters don't jitter
    expect(new Set([...'0123456789'].map((d) => atlas.frames[`font5_${d.charCodeAt(0)}`].advance)).size).toBe(1);
    expect(new Set([...'0123456789'].map((d) => atlas.frames[`font7_${d.charCodeAt(0)}`].advance)).size).toBe(1);
  });
  it('logo is at least 160×64, icons are 16×16', () => {
    expect(atlas.frames.logo.w).toBeGreaterThanOrEqual(160); expect(atlas.frames.logo.h).toBeGreaterThanOrEqual(64);
    for (const e of uiEntries) if (/^(icon|boon)_/.test(e.name)) expect([e.px.w, e.px.h], e.name).toEqual([16, 16]);
  });
});

describe('packer', () => {
  it('packs random rects without overlap and inside bounds', async () => {
    const { pack } = await import(join(ROOT, 'tools/art/build-atlas.mjs'));
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const items = Array.from({ length: 400 }, (_, i) => ({ id: `r${i}`, w: 1 + Math.floor(rnd() * 40), h: 1 + Math.floor(rnd() * 40) }));
    const r = pack(items); expect(r).toBeTruthy();
    const placed = items.map((it) => ({ ...it, ...r.rects.get(it.id) }));
    for (const a of placed) expect(a.x >= 1 && a.y >= 1 && a.x + a.w <= r.W - 1 && a.y + a.h <= r.H - 1).toBe(true);
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++)
      expect(overlap({ ...placed[i], w: placed[i].w + 1, h: placed[i].h + 1, ax: 0, ay: 0 }, { ...placed[j], ax: 0, ay: 0 }) ||
        overlap({ ...placed[j], w: placed[j].w + 1, h: placed[j].h + 1, ax: 0, ay: 0 }, { ...placed[i], ax: 0, ay: 0 })).toBe(false);
  });
});

process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });

// Atlas builder (SPEC §9.5/§9.6, docs/CONTRACT.md). Owner: art-ui.
//   node tools/art/build-atlas.mjs [--allow-missing] [--out <dir>] [--docs <dir>] [--report <file.json>]
// Imports every sprite group, validates names against the manifest, checks palette + lint, detects
// pixel-identical duplicates, packs everything into one atlas (≤2048², 1px padding, tiles extruded 1px)
// and writes atlas.png, atlas.json, font.json and one contact sheet per group.
// Exit code ≠ 0 on any error, or if a manifest name has no sprite (unless --allow-missing).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PALETTE, lint, writePNG } from './pixel.mjs';
import { MANIFEST, NAMES } from './manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const GROUPS = ['tiles', 'props', 'buildings', 'units', 'fx', 'ui'];
export const MAX_SIZE = 2048;
const PAD = 1;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const RGB = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, hex(v)]));

// Default anchors per CONTRACT: bottom-centre for unit/building/prop/wall, centre for fx, top-left otherwise.
export function defaultAnchor(kind, w, h) {
  if (['unit', 'building', 'prop', 'wall'].includes(kind)) return [w / 2, h];
  if (kind === 'fx') return [w / 2, h / 2];
  return [0, 0];
}

// Shelf packer. items: [{ id, w, h }] (slot sizes). Returns { W, H, rects: Map(id → {x,y}) } or null.
export function packShelves(items, width, maxH = MAX_SIZE, pad = PAD) {
  const order = [...items].sort((a, b) => b.h - a.h || b.w - a.w || (a.id < b.id ? -1 : 1));
  const rects = new Map(); let x = pad, y = pad, shelfH = 0, usedW = 0;
  for (const it of order) {
    if (it.w + 2 * pad > width) return null;
    if (x + it.w + pad > width) { y += shelfH + pad; x = pad; shelfH = 0; }
    rects.set(it.id, { x, y }); x += it.w + pad; shelfH = Math.max(shelfH, it.h); usedW = Math.max(usedW, x);
  }
  const H = y + shelfH + pad;
  return H <= maxH ? { W: width, H, rects } : null;
}
export function pack(items) {
  let best = null;
  for (const w of [256, 384, 512, 640, 768, 1024, 1280, 1536, 2048]) {
    const r = packShelves(items, w);
    if (!r) continue;
    r.H = Math.ceil(r.H / 4) * 4;
    if (r.H > MAX_SIZE) continue;
    // prefer smallest area, then most square
    const score = r.W * r.H + Math.abs(r.W - r.H);
    if (!best || score < best.score) best = { ...r, score };
  }
  return best;
}

function checkPx(name, px) {
  const errs = [];
  if (!px || !Number.isInteger(px.w) || !Number.isInteger(px.h) || !Array.isArray(px.d)) return [`${name}: px is not a Px`];
  if (px.w < 1 || px.h < 1 || px.w > MAX_SIZE || px.h > MAX_SIZE) errs.push(`${name}: bad size ${px.w}×${px.h}`);
  if (px.d.length !== px.h) errs.push(`${name}: has ${px.d.length} rows, expected ${px.h}`);
  const bad = new Set();
  px.d.forEach((row, y) => {
    if (row.length !== px.w) errs.push(`${name}: row ${y} is ${row.length} wide, expected ${px.w}`);
    for (const c of row) if (c !== '.' && !RGB[c]) bad.add(c);
  });
  if (bad.size) errs.push(`${name}: colours not in PALETTE: ${[...bad].map((c) => JSON.stringify(c)).join(', ')}`);
  return errs;
}
// lint() with the two exemptions that are rectangular/empty by nature:
// 9-slice sprites (entry.slice) and font glyphs skip the "fills its bounding box" check; the space glyph may be empty.
export function lintEntry(e, kind) {
  const isSpace = kind === 'font' && e.px.d.every((r) => r.every((c) => c === '.'));
  if (isSpace) return [];
  return lint(e.name, e.px, kind).filter((m) => !((e.slice || kind === 'font') && /silhouette fills/.test(m)));
}
const pixelKey = (px) => `${px.w}x${px.h}:${px.d.map((r) => r.join('')).join('|')}`;

async function loadGroup(g) {
  const file = join(ROOT, 'tools/art/sprites', `${g}.mjs`);
  try {
    const mod = await import(pathToFileURL(file).href);
    if (typeof mod.default !== 'function') return { error: `sprites/${g}.mjs has no default export build()` };
    return { entries: await mod.default() };
  } catch (err) {
    if (err && err.code === 'ERR_MODULE_NOT_FOUND' && String(err.message).includes(`${g}.mjs`)) return { absent: true };
    return { error: `sprites/${g}.mjs failed: ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}` };
  }
}

// Contact sheet: sprites in manifest order, row-wrapped, on the neutral review background.
export function contactSheet(path, entries, { scale = 4, maxW = 360, gap = 3, bg = '#3a3f55' } = {}) {
  let x = gap, y = gap, rowH = 0; const pos = [];
  for (const e of entries) {
    if (x + e.px.w + gap > maxW && x > gap) { x = gap; y += rowH + gap; rowH = 0; }
    pos.push([x, y]); x += e.px.w + gap; rowH = Math.max(rowH, e.px.h);
  }
  const W = Math.max(...pos.map(([px], i) => px + entries[i].px.w)) + gap, H = y + rowH + gap;
  const out = Buffer.alloc(W * scale * H * scale * 4), [br, bgc, bb] = hex(bg);
  for (let i = 0; i < out.length; i += 4) out.set([br, bgc, bb, 255], i);
  entries.forEach((e, i) => {
    const [ox, oy] = pos[i];
    for (let j = 0; j < e.px.h; j++) for (let k = 0; k < e.px.w; k++) {
      const c = e.px.d[j][k]; if (c === '.') continue;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++)
        out.set([...RGB[c], 255], (((oy + j) * scale + sy) * W * scale + (ox + k) * scale + sx) * 4);
    }
  });
  writePNG(path, W * scale, H * scale, out);
}

export async function buildAtlas(opts = {}) {
  const { allowMissing = false, outDir = join(ROOT, 'assets/resources/art'), docsDir = join(ROOT, 'docs/art'), groups = GROUPS, log = () => {} } = opts;
  const errors = [], warnings = [], missing = [], absentGroups = [], byGroup = {};
  const manifestBy = new Map(MANIFEST.map((m) => [m.name, m]));
  const all = []; const seen = new Map();
  for (const g of groups) {
    const res = await loadGroup(g); const expected = MANIFEST.filter((m) => m.owner === g).map((m) => m.name);
    if (res.absent || res.error) {
      if (res.absent) absentGroups.push(g);
      if (res.error) (allowMissing ? warnings : errors).push(res.error);
      missing.push(...expected); byGroup[g] = { expected: expected.length, built: 0, status: res.absent ? 'absent' : 'error' };
      continue;
    }
    const entries = Array.isArray(res.entries) ? res.entries : [];
    if (!Array.isArray(res.entries)) errors.push(`sprites/${g}.mjs build() did not return an array`);
    const got = new Set();
    for (const e of entries) {
      const name = e && e.name;
      if (typeof name !== 'string') { errors.push(`${g}: entry without a name`); continue; }
      if (!NAMES.has(name)) { errors.push(`${g}: "${name}" is not in manifest.mjs`); continue; }
      const m = manifestBy.get(name);
      if (m.owner !== g) { errors.push(`${g}: "${name}" belongs to group "${m.owner}"`); continue; }
      if (seen.has(name)) { errors.push(`${g}: duplicate sprite name "${name}"`); continue; }
      const pxErr = checkPx(name, e.px); if (pxErr.length) { errors.push(...pxErr); continue; }
      // the module's declared kind wins (lint + default anchor); differences from the manifest are reported
      if (e.kind && e.kind !== m.kind) warnings.push(`${name}: kind "${e.kind}" overrides manifest kind "${m.kind}"`);
      if (e.slice && !(Array.isArray(e.slice) && e.slice.length === 4 && e.slice[0] + e.slice[2] < e.px.w && e.slice[1] + e.slice[3] < e.px.h))
        errors.push(`${name}: bad slice ${JSON.stringify(e.slice)} for ${e.px.w}×${e.px.h}`);
      const kind = e.kind || m.kind;
      for (const issue of lintEntry(e, kind)) errors.push(`lint ${issue}`);
      const rec = { ...e, group: g, kind }; seen.set(name, rec); all.push(rec); got.add(name);
    }
    const miss = expected.filter((n) => !got.has(n)); missing.push(...miss);
    byGroup[g] = { expected: expected.length, built: got.size, status: miss.length ? 'partial' : 'complete' };
  }
  if (missing.length) (allowMissing ? warnings : errors).push(`${missing.length} manifest sprite(s) missing${absentGroups.length ? ` (absent modules: ${absentGroups.join(', ')})` : ''}`);

  // duplicates: identical pixels pack once if declared as alias, otherwise warn
  const byKey = new Map();
  for (const e of all) {
    const k = pixelKey(e.px);
    if (byKey.has(k)) {
      const first = byKey.get(k);
      if (e.alias === first.name || first.alias === e.name) e.aliasOf = first.name;
      else warnings.push(`duplicate pixels: "${e.name}" is identical to "${first.name}" (declare alias to silence)`);
    } else byKey.set(k, e);
  }
  for (const e of all) if (e.alias && !e.aliasOf) warnings.push(`${e.name}: alias "${e.alias}" declared but pixels differ`);

  // pack
  const items = all.filter((e) => !e.aliasOf).map((e) => { const ext = e.kind === 'tile' ? 1 : 0; return { id: e.name, w: e.px.w + 2 * ext, h: e.px.h + 2 * ext, ext, e }; });
  const packed = items.length ? pack(items) : { W: 4, H: 4, rects: new Map() };
  if (!packed) { errors.push(`atlas does not fit in ${MAX_SIZE}×${MAX_SIZE}`); return { ok: false, errors, warnings, missing, byGroup }; }
  const { W, H, rects } = packed;
  const img = Buffer.alloc(W * H * 4); const frames = {};
  const putPx = (x, y, c) => { if (c !== '.') img.set([...RGB[c], 255], (y * W + x) * 4); };
  for (const it of items) {
    const { x: sx, y: sy } = rects.get(it.id), { px } = it.e, ext = it.ext, x0 = sx + ext, y0 = sy + ext;
    for (let j = -ext; j < px.h + ext; j++) for (let i = -ext; i < px.w + ext; i++) {
      const cj = Math.min(px.h - 1, Math.max(0, j)), ci = Math.min(px.w - 1, Math.max(0, i)); // clamp = extrude
      putPx(x0 + i, y0 + j, px.d[cj][ci]);
    }
    it.frame = { x: x0, y: y0, w: px.w, h: px.h };
  }
  const frameOf = new Map(items.map((it) => [it.id, it.frame]));
  for (const e of all) {
    const f = frameOf.get(e.aliasOf ?? e.name); const [dax, day] = defaultAnchor(e.kind, e.px.w, e.px.h);
    const fr = { ...f, ax: e.ax ?? dax, ay: e.ay ?? day };
    if (e.slice) fr.slice = e.slice;
    if (e.advance !== undefined) fr.advance = e.advance;
    frames[e.name] = fr;
  }
  const sorted = Object.fromEntries(MANIFEST.filter((m) => frames[m.name]).map((m) => [m.name, frames[m.name]]));

  // font metrics (glyph advance per char code) for BitmapText
  const font = {};
  for (const [id, lineHeight, cap] of [['font5', 10, 7], ['font7', 12, 9]]) {
    const glyphs = {};
    for (const [n, f] of Object.entries(sorted)) if (n.startsWith(`${id}_`)) glyphs[n.slice(id.length + 1)] = { frame: n, advance: f.advance };
    if (Object.keys(glyphs).length) font[id] = { lineHeight, capHeight: cap, outline: 1, glyphs };
  }

  mkdirSync(outDir, { recursive: true });
  writePNG(join(outDir, 'atlas.png'), W, H, img);
  writeFileSync(join(outDir, 'atlas.json'), JSON.stringify({ size: [W, H], frames: sorted }, null, 0).replace(/},"/g, '},\n"'));
  writeFileSync(join(outDir, 'font.json'), JSON.stringify(font, null, 1));
  const contact = [];
  for (const g of groups) {
    const list = MANIFEST.filter((m) => m.owner === g && seen.has(m.name)).map((m) => seen.get(m.name));
    if (!list.length) continue;
    const maxW = Math.max(...list.map((e) => e.px.w));
    const scale = g === 'ui' ? 4 : list.length > 120 ? 4 : 5;
    const file = join(docsDir, `contact-${g}.png`);
    contactSheet(file, list, { scale, maxW: Math.max(maxW + 6, g === 'ui' ? 340 : 300) });
    contact.push(file);
  }
  const used = items.reduce((s, it) => s + it.w * it.h, 0);
  log(`atlas ${W}×${H}, ${all.length} sprites (${items.length} packed), fill ${((used / (W * H)) * 100).toFixed(1)}%`);
  return { ok: errors.length === 0, errors, warnings, missing, byGroup, size: [W, H], frames: sorted, count: all.length, packed: items.length, contact };
}

// ── CLI ────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2); const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const outDir = arg('--out') ? resolve(arg('--out')) : undefined;
  const docsDir = arg('--docs') ? resolve(arg('--docs')) : outDir ? join(outDir, 'contact') : undefined;
  const r = await buildAtlas({ allowMissing: argv.includes('--allow-missing'), outDir, docsDir, log: (m) => console.log(m) });
  for (const [g, s] of Object.entries(r.byGroup)) console.log(`  ${g.padEnd(10)} ${String(s.built).padStart(4)}/${s.expected} ${s.status}`);
  if (r.missing.length) console.log(`missing (${r.missing.length}): ${r.missing.slice(0, 40).join(', ')}${r.missing.length > 40 ? ', …' : ''}`);
  for (const w of r.warnings) console.warn(`warn: ${w}`);
  for (const e of r.errors) console.error(`error: ${e}`);
  const report = arg('--report');
  if (report) { mkdirSync(dirname(resolve(report)), { recursive: true }); writeFileSync(resolve(report), JSON.stringify({ ...r, frames: undefined }, null, 1)); }
  console.log(r.ok ? 'atlas: OK' : `atlas: FAILED (${r.errors.length} error(s))`);
  process.exit(r.ok ? 0 : 1);
}

import { describe, expect, it } from 'vitest';
import {
  basePixelScale, clampCamera, designPerArtPx, lookAhead, pinchStep, screenToTile, shakeOffset, smoothFactor,
  snapToDevice, tileToScreen, worldRootPosition, zoomSteps, MAX_SHAKE_ART_PX, edgeScroll,
} from '../../assets/scripts/game/logic/camera';
import { countFrames, defaultAnchor, frameName, nineRects, parseAtlas } from '../../assets/scripts/game/logic/atlasData';
import { bresenham4, classifyDrag, footprintOrigin, isTap, paintCells, paintPlan, ringPoints } from '../../assets/scripts/game/logic/gestures';
import { edgeArrow, fillMinimap, projectToMinimap, unprojectMinimap, MINI_COLORS } from '../../assets/scripts/game/logic/minimap';
import { edgeOverlays, materialOf, tileSprite, MATERIAL_ORDER, PAIRS, type Material } from '../../assets/scripts/game/logic/edges';
import { generateMap } from '../../assets/scripts/core/sim/MapGen';
import { fillLight, sampleAlpha, TEXELS_PER_TILE } from '../../assets/scripts/game/logic/light';
import { glyphName, layoutText, toAscii, fmtNum } from '../../assets/scripts/game/logic/text';
import { crossfade, musicFor, parseAudioManifest, sfxForEvent, VoiceLimiter } from '../../assets/scripts/game/logic/audio';
import { joystickDir, knobOffset, inJoystickZone, keysDir } from '../../assets/scripts/game/logic/joystick';
import {
  animFrame, buildingSprites, dir8, enemySprite, gateOrientation, heroSprite, lerpPos, nodeSprite, poiSprite, rowOf, crackOverlay,
} from '../../assets/scripts/game/logic/sprites';
import { bounceScale, damageNumber, flyPath, lowHearthAlpha, fadeAlpha } from '../../assets/scripts/game/logic/juice';
import { validRunSnapshot, safeGet, safeSet } from '../../assets/scripts/game/logic/save';
import { tabItems, rangeRings, previewSprite, isLocked } from '../../assets/scripts/game/logic/catalog';
import { MANIFEST, NAMES, EDGE_PAIRS } from '../../tools/art/manifest.mjs';
import { readFileSync, existsSync } from 'node:fs';

describe('camera scale math (SPEC §3)', () => {
  it('n = max(2, round(deviceW/180))', () => {
    expect(basePixelScale(360)).toBe(2);
    expect(basePixelScale(1080)).toBe(6);
    expect(basePixelScale(1170)).toBe(7); // iPhone 390pt @3x
    expect(basePixelScale(200)).toBe(2);
    expect(basePixelScale(750)).toBe(4);
  });
  it('three integer zoom steps, never below 1', () => {
    expect(zoomSteps(6)).toEqual([5, 6, 7]);
    expect(zoomSteps(2)).toEqual([1, 2, 3]);
  });
  it('one art pixel covers exactly n device pixels', () => {
    for (const devW of [720, 828, 1080, 1170, 1284, 1440]) {
      const n = basePixelScale(devW);
      const s = designPerArtPx(n, devW);
      const devicePerDesign = devW / 720;
      expect(s * devicePerDesign).toBeCloseTo(n, 9);
      // ~11 tiles across (16 art px each)
      const tilesAcross = 720 / (s * 16);
      expect(tilesAcross).toBeGreaterThan(9); expect(tilesAcross).toBeLessThan(13.5);
    }
  });
  it('snaps world positions to whole device pixels', () => {
    const dpd = 1170 / 720;
    for (const v of [0.1, 13.37, -99.99, 250.5]) {
      const snapped = snapToDevice(v, dpd);
      expect(Math.abs(snapped * dpd - Math.round(snapped * dpd))).toBeLessThan(1e-9);
      expect(Math.abs(snapped - v)).toBeLessThanOrEqual(0.5 / dpd + 1e-9);
    }
    const p = worldRootPosition({ x: 28.3, y: 17.9 }, designPerArtPx(7, 1170), dpd);
    expect(Math.abs(p.x * dpd - Math.round(p.x * dpd))).toBeLessThan(1e-9);
  });
  it('tile <-> screen round-trip, +y down in tiles, +y up on screen', () => {
    const cam = { x: 28, y: 28 }, s = 2.5;
    const sc = tileToScreen(30, 27, cam, s, 720, 1280);
    expect(sc.x).toBeGreaterThan(360); expect(sc.y).toBeGreaterThan(640);
    const t = screenToTile(sc.x, sc.y, cam, s, 720, 1280);
    expect(t.x).toBeCloseTo(30); expect(t.y).toBeCloseTo(27);
  });
  it('look-ahead 1.5 tiles along the move direction; smoothing factor is frame-rate independent', () => {
    expect(lookAhead({ x: 1, y: 0 })).toEqual({ x: 1.5, y: 0 });
    expect(lookAhead({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    const half = lookAhead({ x: 0, y: 0.5 });
    expect(half.y).toBeCloseTo(0.75);
    const a = 1 - (1 - smoothFactor(1 / 60)) ** 2, b = smoothFactor(1 / 30);
    expect(a).toBeCloseTo(b, 9);
  });
  it('shake stays within 4 art px and decays to zero', () => {
    for (let t = 0; t < 2; t += 0.013) {
      const o = shakeOffset(t, 0.3, 0.5, 10);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(MAX_SHAKE_ART_PX); expect(Math.abs(o.y)).toBeLessThanOrEqual(MAX_SHAKE_ART_PX);
    }
    expect(shakeOffset(1, 0, 0.5, 4)).toEqual({ x: 0, y: 0 });
  });
  it('clamps the camera over the map and picks pinch steps', () => {
    expect(clampCamera({ x: -50, y: 100 }, 56, 11, 20).x).toBeCloseTo(-2 + 5.5);
    expect(clampCamera({ x: -50, y: 100 }, 56, 11, 20).y).toBeCloseTo(56 + 2 - 10);
    expect(pinchStep(1, 1.5)).toBe(2); expect(pinchStep(1, 0.6)).toBe(0); expect(pinchStep(1, 1.0)).toBe(1); expect(pinchStep(2, 3)).toBe(2);
  });
  it('edge scroll only near edges', () => {
    expect(edgeScroll(120, 200, 240, 400, 20, 5)).toEqual({ x: 0, y: 0 });
    expect(edgeScroll(2, 200, 240, 400, 20, 5).x).toBeLessThan(0);
    expect(edgeScroll(238, 200, 240, 400, 20, 5).x).toBeGreaterThan(0);
    expect(edgeScroll(120, 399, 240, 400, 20, 5).y).toBeLessThan(0); // top of screen → north (y-)
  });
});

describe('atlas json parsing', () => {
  const json = {
    size: [64, 32],
    frames: {
      tile_grass_0: { x: 0, y: 0, w: 16, h: 16, ax: 0, ay: 0 },
      hero_knight_idle_0: { x: 16, y: 0, w: 18, h: 18, ax: 9, ay: 18 },
      hero_knight_idle_1: { x: 34, y: 0, w: 18, h: 18, ax: 9, ay: 18 },
      ui_panel_stone: { x: 0, y: 16, w: 24, h: 24, slice: [8, 8, 8, 8] },
      fx_hit_0: { x: 40, y: 16, w: 13, h: 13 },
      font5_65: { x: 50, y: 16, w: 7, h: 11, ax: 1, ay: 1, advance: 6 },
    },
  };
  const a = parseAtlas(json);
  it('normalises anchors to Cocos (+y up)', () => {
    const h = a.frames.get('hero_knight_idle_0')!;
    expect(h.anchorX).toBeCloseTo(0.5); expect(h.anchorY).toBeCloseTo(0);
    const t = a.frames.get('tile_grass_0')!;
    expect(t.anchorX).toBe(0); expect(t.anchorY).toBe(1);
  });
  it('defaults: fx centre, slices kept, advance kept', () => {
    const f = a.frames.get('fx_hit_0')!;
    expect(f.ax).toBe(6.5); expect(f.anchorY).toBeCloseTo(0.5);
    expect(a.frames.get('ui_panel_stone')!.slice).toEqual([8, 8, 8, 8]);
    expect(a.frames.get('font5_65')!.advance).toBe(6);
    expect(defaultAnchor('prop_pine_0', 18, 26)).toEqual([9, 26]);
  });
  it('counts animation frames and 9-slice rects', () => {
    const has = (n: string) => a.frames.has(n);
    expect(countFrames(has, 'hero_knight_idle')).toBe(2);
    expect(frameName(has, 'hero_knight_idle', 3)).toBe('hero_knight_idle_1');
    expect(frameName(has, 'tile_grass_0', 5)).toBe('tile_grass_0');
    const r = nineRects(a.frames.get('ui_panel_stone')!);
    expect(r).toHaveLength(9);
    expect(r[4]).toEqual({ x: 8, y: 24, w: 8, h: 8 });
    expect(r.reduce((s, q) => s + q.w * q.h, 0)).toBe(24 * 24);
  });
  it('rejects malformed json', () => {
    expect(() => parseAtlas(null)).toThrow();
    expect(() => parseAtlas({ frames: { a: { x: 0, y: 0, w: 0, h: 1 } } })).toThrow();
  });
  it('parses the real atlas.json (when built) and every frame lies inside the texture', () => {
    const p = 'assets/resources/art/atlas.json';
    if (!existsSync(p)) return;
    const real = parseAtlas(JSON.parse(readFileSync(p, 'utf8')));
    for (const f of real.frames.values()) {
      expect(f.x + f.w).toBeLessThanOrEqual(real.size[0]);
      expect(f.y + f.h).toBeLessThanOrEqual(real.size[1]);
    }
  });
});

describe('build gestures (SPEC §6.2)', () => {
  it('axis lock from the initial drag direction', () => {
    expect(classifyDrag(5, 1)).toBe('h');
    expect(classifyDrag(-1, 6)).toBe('v');
    expect(classifyDrag(3, 3)).toBe('diag');
    expect(paintCells({ x: 2, y: 2 }, { x: 6, y: 5 }, 'h')).toEqual([2, 3, 4, 5, 6].map((x) => ({ x, y: 2 })));
    expect(paintCells({ x: 2, y: 2 }, { x: 6, y: -1 }, 'v')).toEqual([2, 1, 0, -1].map((y) => ({ x: 2, y })));
  });
  it('4-connected Bresenham: unit steps on exactly one axis, ends included', () => {
    for (const [x1, y1] of [[5, 3], [-4, 7], [6, 6], [0, -5], [-7, -2], [3, 0]]) {
      const cells = bresenham4(0, 0, x1, y1);
      expect(cells[0]).toEqual({ x: 0, y: 0 });
      expect(cells[cells.length - 1]).toEqual({ x: x1, y: y1 });
      expect(cells.length).toBe(Math.abs(x1) + Math.abs(y1) + 1);
      for (let i = 1; i < cells.length; i++) expect(Math.abs(cells[i].x - cells[i - 1].x) + Math.abs(cells[i].y - cells[i - 1].y)).toBe(1);
    }
  });
  it('places as many cells as affordable, in stroke order, skipping invalid cells', () => {
    const cells = [0, 1, 2, 3, 4].map((x) => ({ x, y: 0 }));
    const p = paintPlan(cells, (c) => c.x !== 1, { wood: 4, stone: 0, gold: 0 }, { wood: 10, stone: 0, gold: 0 });
    expect(p.ok).toEqual([true, false, true, false, false]);
    expect(p.count).toBe(2); expect(p.total.wood).toBe(8);
  });
  it('footprint origin centres a w×h ghost under the finger; taps vs drags', () => {
    expect(footprintOrigin(10.4, 10.6, 2, 2)).toEqual({ x: 9, y: 10 });
    expect(footprintOrigin(10.4, 10.6, 1, 1)).toEqual({ x: 10, y: 10 });
    expect(isTap(5, 0.2)).toBe(true); expect(isTap(40, 0.2)).toBe(false); expect(isTap(5, 1)).toBe(false);
  });
  it('range rings are circles of the requested radius', () => {
    for (const p of ringPoints(5, 5, 3)) expect(Math.hypot(p.x - 5, p.y - 5)).toBeCloseTo(3);
  });
});

describe('minimap projection + edge arrows', () => {
  it('round-trips and puts north at the top', () => {
    const p = projectToMinimap(14, 0, 56, 112);
    expect(p).toEqual({ x: 28, y: 112 });
    const t = unprojectMinimap(p.x, p.y, 56, 112);
    expect(t.x).toBeCloseTo(14); expect(t.y).toBeCloseTo(0);
  });
  it('fills an RGBA buffer with fog, biomes and markers', () => {
    const n = 4;
    const buf = new Uint8Array(n * n * 4);
    fillMinimap(buf, {
      size: n, biome: Array(16).fill('meadow'), explored: [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], light: Array(16).fill(1), night: true,
      buildings: [{ x: 2, y: 2, w: 1, h: 1, id: 'hearth' }], rifts: [], pois: [], heroes: [{ x: 0.5, y: 0.5, leader: true }], enemies: [{ x: 3.2, y: 3.9 }],
    });
    const px = (x: number, y: number) => Array.from(buf.slice((y * n + x) * 4, (y * n + x) * 4 + 3));
    expect(px(0, 1)).toEqual([...MINI_COLORS.fog]);
    expect(px(2, 2)).toEqual([...MINI_COLORS.hearth]);
    expect(px(0, 0)).toEqual([...MINI_COLORS.leader]);
    expect(px(3, 3)).toEqual([...MINI_COLORS.enemy]);
  });
  it('edge arrow clamps to the inset rect, pointing at the target', () => {
    const r = { x: 0, y: 0, w: 200, h: 400 };
    const a = edgeArrow({ x: 1000, y: 200 }, r);
    expect(a.onScreen).toBe(false); expect(a.x).toBeCloseTo(200); expect(a.y).toBeCloseTo(200); expect(a.angle).toBeCloseTo(0);
    const b = edgeArrow({ x: 100, y: -500 }, r);
    expect(b.y).toBeCloseTo(0); expect(b.angle).toBeCloseTo(-90);
    expect(edgeArrow({ x: 50, y: 50 }, r).onScreen).toBe(true);
  });
});

describe('biome edges + tiles', () => {
  const grid = (rows: string[]) => (x: number, y: number): Material => {
    const ch = rows[y]?.[x];
    return ch === 'g' ? 'grass' : ch === 'd' ? 'dirt' : ch === 's' ? 'sand' : ch === 'f' ? 'grassdark' : ch === 'r' ? 'ruins' : 'water';
  };
  it('edge pieces on the lower material from the upper neighbour side', () => {
    const at = grid(['ggg', 'ddd', 'ddd']);
    expect(edgeOverlays(1, 1, at)).toEqual(['edge_grass_dirt_n']);
    expect(edgeOverlays(1, 0, at)).toEqual([]);
  });
  it('inner and outer corners', () => {
    const inner = grid(['gg', 'gd']);
    expect(edgeOverlays(1, 1, inner)).toContain('edge_grass_dirt_inw');
    expect(edgeOverlays(1, 1, inner)).not.toContain('edge_grass_dirt_n');
    const outer = grid(['gd', 'dd']);
    expect(edgeOverlays(1, 1, outer)).toEqual(['edge_grass_dirt_nw']);
  });
  it('sand over water and grass over sand', () => {
    const at = grid(['s', 'w']);
    expect(edgeOverlays(0, 1, at)).toEqual(['edge_sand_water_n']);
    const at2 = grid(['g', 's']);
    expect(edgeOverlays(0, 1, at2)).toEqual(['edge_grass_sand_n']);
  });
  it('ruins and forest floor get their own transitions (no square cut)', () => {
    expect(edgeOverlays(0, 1, grid(['r', 'g']))).toEqual(['edge_ruins_grass_n']);
    expect(edgeOverlays(0, 1, grid(['g', 'f']))).toEqual(['edge_grass_grassdark_n']);
    expect(edgeOverlays(0, 1, grid(['f', 'd']))).toEqual(['edge_grassdark_dirt_n']);
    expect(edgeOverlays(0, 1, grid(['r', 'f']))).toEqual(['edge_ruins_grassdark_n']);
    expect(edgeOverlays(0, 1, grid(['r', 'd']))).toEqual(['edge_ruins_dirt_n']);
    expect(edgeOverlays(0, 1, grid(['d', 's']))).toEqual(['edge_dirt_sand_n']);
    expect(edgeOverlays(0, 1, grid(['r', 's']))).toEqual(['edge_ruins_sand_n']);
    expect(edgeOverlays(0, 1, grid(['d', 'r']))).toEqual([]); // the higher material never gets an overlay
    // several uppers: drawn low → high so the highest material ends on top
    expect(edgeOverlays(1, 1, grid(['.r.', 'fdg', '...']))).toEqual(['edge_grassdark_dirt_w', 'edge_grass_dirt_e', 'edge_ruins_dirt_n']);
    // land touching water directly still gets the beach rim
    expect(edgeOverlays(0, 1, grid(['f', 'w']))).toEqual(['edge_sand_water_n']);
    expect([...PAIRS]).toEqual(EDGE_PAIRS);
  });
  it('every pair of land biomes MapGen puts side by side has an overlay pair', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const m = generateMap(seed * 7919), n = m.size;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
        const a = materialOf(m.biome[y * n + x]), b = materialOf(m.biome[Y * n + X]);
        if (a === b) continue;
        const [lo, hi] = MATERIAL_ORDER.indexOf(a) < MATERIAL_ORDER.indexOf(b) ? [a, b] : [b, a];
        const pair = lo === 'water' ? 'sand_water' : `${hi}_${lo}`;
        expect(NAMES.has(`edge_${pair}_n`), `${hi} over ${lo}`).toBe(true);
      }
    }
  });
  it('every overlay / tile name exists in the manifest', () => {
    const mats: Material[] = ['grass', 'grassdark', 'dirt', 'sand', 'ruins', 'water'];
    let checked = 0;
    for (let m = 0; m < 6 ** 9; m += 211) {
      const cells: Material[] = []; let v = m;
      for (let i = 0; i < 9; i++) { cells.push(mats[v % 6]); v = Math.floor(v / 6); }
      const at = (x: number, y: number) => (x < 0 || y < 0 || x > 2 || y > 2 ? 'water' : cells[y * 3 + x]);
      for (const n of edgeOverlays(1, 1, at)) { expect(NAMES.has(n)).toBe(true); checked++; }
    }
    expect(checked).toBeGreaterThan(50);
    for (const b of ['water', 'shore', 'meadow', 'forest', 'quarry', 'ruins']) for (let v = 0; v < 16; v++) expect(NAMES.has(tileSprite(b, v, v & 1))).toBe(true);
    expect(materialOf('forest')).toBe('grassdark');
    expect(materialOf('ruins')).toBe('ruins');
  });
});

describe('light overlay texels (SPEC §5)', () => {
  it('4 texels per tile, dark colour, fog fully dark, warm tint in lit areas at night', () => {
    const n = 3;
    const la = new Float32Array([0.85, 0.85, 0.85, 0.85, 0, 0.85, 0.85, 0.85, 0.85]);
    const ex = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 0]);
    const W = n * TEXELS_PER_TILE;
    const buf = new Uint8Array(W * W * 4);
    fillLight(buf, { size: n, lightAlpha: la, explored: ex, night: true, t: 0 });
    const at = (tx: number, ty: number) => Array.from(buf.slice((ty * W + tx) * 4, (ty * W + tx) * 4 + 4));
    expect(at(6, 6)[3]).toBeLessThan(0.35 * 255); // lit centre (with ±0.25-tile flicker)
    const day = new Uint8Array(W * W * 4);
    fillLight(day, { size: n, lightAlpha: la, explored: ex, night: false, t: 0 });
    for (let ty = 5; ty < 7; ty++) for (let tx = 5; tx < 7; tx++) expect(day[(ty * W + tx) * 4 + 3]).toBe(0);
    const levels = new Set<number>(); for (let i = 0; i < W * W; i++) levels.add(day[i * 4 + 3]);
    expect([...levels].sort((p, q) => p - q)).toEqual([0, Math.round(0.85 * 255), Math.round(0.97 * 255)]); // discrete levels only

    let warm = 0;
    for (let i = 0; i < W * W; i++) if (buf[i * 4] === 0xf7 && buf[i * 4 + 3] === Math.round(0.08 * 255)) warm++;
    expect(warm).toBeGreaterThan(0); // faint warm ring inside the lit area at night
    expect(at(0, 0)).toEqual([0x1b, 0x1b, 0x2f, Math.round(0.85 * 255)]);
    expect(at(W - 1, W - 1)[3]).toBeGreaterThan(240); // unexplored
    const part = new Uint8Array(W * W * 4);
    fillLight(part, { size: n, lightAlpha: la, explored: ex, night: false, t: 0 }, { x0: 1, y0: 1, x1: 1, y1: 1 });
    expect(part[3]).toBe(0); // outside the region: untouched
    expect(part[(5 * W + 5) * 4 + 3]).toBe(day[(5 * W + 5) * 4 + 3]);
    expect(sampleAlpha({ size: n, lightAlpha: la, explored: ex, night: true, t: 0 }, 1.5, 1.5)).toBeCloseTo(0);
  });
});

describe('bitmap text', () => {
  it('picks font glyph frames; font7 only for digits/+-!', () => {
    expect(glyphName('font5', 65)).toBe('font5_65');
    expect(glyphName('font7', 48)).toBe('font7_48');
    expect(glyphName('font7', 65)).toBe('font5_65');
    expect(glyphName('font5', 0x1f600)).toBe('font5_63');
    for (let c = 32; c <= 126; c++) expect(NAMES.has(glyphName('font5', c))).toBe(true);
  });
  it('lays out with advances, wraps on spaces and centres lines', () => {
    const adv = () => 6;
    const l = layoutText('ab cd', 'font5', adv);
    expect(l.glyphs.map((g) => g.x)).toEqual([0, 6, 18, 24]);
    expect(l.width).toBe(29);
    const w = layoutText('hello world foo', 'font5', adv, 40, 'center');
    expect(w.lines).toBe(3);
    expect(w.height).toBe(2 * 10 + 7);
    expect(toAscii('Đêm tối')).toBe('Dem toi');
    expect(fmtNum(12345)).toBe('12k'); expect(fmtNum(1500)).toBe('1.5k'); expect(fmtNum(42.7)).toBe('42');
  });
});

describe('audio policy (SPEC §12)', () => {
  it('8 voices max, same sfx not retriggered within 50 ms', () => {
    const v = new VoiceLimiter(8, 50);
    expect(v.request('a', 0, 1)).toBeGreaterThanOrEqual(0);
    expect(v.request('a', 30, 1)).toBe(-1);
    expect(v.request('a', 60, 1)).toBeGreaterThanOrEqual(0);
    let ok = 0;
    for (let i = 0; i < 20; i++) if (v.request(`s${i}`, 100, 1) >= 0) ok++;
    expect(ok).toBe(6);
    expect(v.active(100)).toBe(8);
    expect(v.request('urgent', 100, 1, 2)).toBeGreaterThanOrEqual(0); // priority steals a voice
    expect(v.active(100)).toBe(8);
    expect(v.request('late', 5000, 0.1)).toBeGreaterThanOrEqual(0);
  });
  it('crossfade and track choice', () => {
    expect(crossfade(0)).toEqual([1, 0]); expect(crossfade(0.5)).toEqual([0.5, 0.5]); expect(crossfade(2)).toEqual([0, 1]);
    expect(musicFor('night', true)).toBe('music_boss'); expect(musicFor('night', false)).toBe('music_night'); expect(musicFor('day', false)).toBe('music_day');
  });
  it('maps events to clips present in audio.json', () => {
    const p = 'assets/resources/audio/audio.json';
    if (!existsSync(p)) return;
    const m = parseAudioManifest(JSON.parse(readFileSync(p, 'utf8')));
    expect(m.maxVoices).toBe(8); expect(m.retriggerMs).toBe(50);
    const names = new Set(m.entries.map((e) => e.name));
    const evs = [
      { t: 'hit', target: 1, amount: 3, dtype: 'pierce', crit: false, shatter: false, x: 0, y: 0 },
      { t: 'death', uid: 1, kind: 'enemy', id: 'gloomling', x: 0, y: 0 }, { t: 'death', uid: 1, kind: 'building', id: 'wall_wood', x: 0, y: 0 },
      ...(['arrow', 'bolt', 'fireball', 'frost_shard', 'mortar', 'spark', 'spit', 'turret'] as const).map((kind) => ({ t: 'shoot', from: 1, projectile: 2, kind })),
      { t: 'explode', x: 0, y: 0, radius: 1 }, { t: 'harvest', node: 1, res: 'wood', amount: 2, x: 0, y: 0 },
      { t: 'harvest', node: 1, res: 'stone', amount: 2, x: 0, y: 0 }, { t: 'built', uid: 1, id: 'gate', x: 0, y: 0 },
      { t: 'buildFail', reason: 'cost', x: 0, y: 0 }, { t: 'upgraded', uid: 1 }, { t: 'sold', uid: 1 }, { t: 'gold', amount: 1, x: 0, y: 0 },
      { t: 'levelUp', hero: 1 }, { t: 'phase', phase: 'night', night: 1 }, { t: 'phase', phase: 'victory', night: 10 },
      { t: 'bossIntro', id: 'unlit' }, { t: 'brazier', uid: 1, lit: true }, { t: 'horn' }, { t: 'skill', hero: 1, skill: 'x', x: 0, y: 0 },
    ];
    for (const e of evs) {
      const s = sfxForEvent(e as never, 2);
      expect(s, JSON.stringify(e)).not.toBeNull();
      expect(names.has(s!.name), s!.name).toBe(true);
    }
    for (const t of ['music_day', 'music_night', 'music_boss']) expect(names.has(t)).toBe(true);
  });
});

describe('joystick', () => {
  it('dead-zone 12%, magnitude ramps to 1, screen up = tile -y', () => {
    expect(joystickDir(2, 0, 40)).toEqual({ x: 0, y: 0 });
    const d = joystickDir(0, 40, 40);
    expect(d.x).toBeCloseTo(0); expect(d.y).toBeCloseTo(-1);
    const half = joystickDir(20, 0, 40);
    expect(half.x).toBeGreaterThan(0.3); expect(half.x).toBeLessThan(0.5);
    expect(Math.hypot(...Object.values(joystickDir(100, 100, 40)))).toBeCloseTo(1);
    expect(knobOffset(30, 40, 25)).toEqual({ x: 15, y: 20 });
    expect(inJoystickZone(100, 400)).toBe(true); expect(inJoystickZone(300, 400)).toBe(false);
    expect(keysDir(true, false, false, true).x).toBeCloseTo(Math.SQRT1_2);
  });
});

describe('sprite selection uses manifest names', () => {
  it('heroes, enemies, bosses, buildings, props, POIs', () => {
    const names: string[] = [];
    for (const id of ['knight', 'ranger', 'pyro', 'tinker', 'cleric', 'rogue'] as const)
      for (const anim of ['idle', 'move', 'attack', 'down'] as const) for (let t = 0; t < 2; t += 0.07) names.push(heroSprite({ id, anim, animT: t }));
    for (const id of ['gloomling', 'skitter', 'spitter', 'brute', 'wisp', 'bomber', 'snuffer', 'militia', 'mossback', 'unlit'])
      for (const anim of ['idle', 'move', 'attack'] as const) for (let t = 0; t < 2; t += 0.07) names.push(enemySprite({ id, anim, animT: t } as never));
    const ids = ['hearth', 'wall_wood', 'wall_stone', 'gate', 'brazier', 'tower_arrow', 'tower_ballista', 'tower_frost', 'tower_mortar', 'trap_spikes',
      'trap_tar', 'lumber_camp', 'quarry', 'tower_spark', 'barracks', 'workshop', 'tavern'] as const;
    for (const id of ids) for (const level of [1, 2, 3] as const) for (const mask of [0, 5, 10, 15]) for (const lit of [true, false]) {
      if (id === 'tavern' && level > 1) continue;
      const b = buildingSprites({ id, level, lit, open: lit, charges: lit ? 3 : 0, aimAngle: mask, wallMask: mask }, mask * 0.1);
      names.push(b.base); if (b.head) names.push(b.head);
      names.push(previewSprite(id));
    }
    for (const kind of ['pine', 'oak', 'stump', 'rock_s', 'rock_m', 'rock_l', 'ore', 'bush'] as const)
      for (const uid of [1, 2]) { const n = nodeSprite({ uid, kind, hp: 1 }); if (n) names.push(n); const d = nodeSprite({ uid, kind, hp: 0 }); if (d) names.push(d); }
    for (const kind of ['camp', 'cage', 'shrine', 'rift', 'root', 'chest'] as const)
      for (const active of [true, false]) { const n = poiSprite({ kind, active, hp: 5 }, 0.3); if (n) names.push(n); }
    for (const n of names) expect(NAMES.has(n), n).toBe(true);
    expect(MANIFEST.length).toBeGreaterThan(300);
  });
  it('helpers', () => {
    expect(gateOrientation(2 | 8)).toBe('h'); expect(gateOrientation(1 | 4)).toBe('v');
    expect(dir8(0)).toBe(0); expect(dir8(-Math.PI / 2)).toBe(2); // core y-down: up on screen = north
    expect(dir8(Math.PI)).toBe(4);
    expect(animFrame(0.5, 10, 3, false)).toBe(2); expect(animFrame(0.5, 10, 3, true)).toBe(2); expect(animFrame(0.45, 10, 4)).toBe(0);
    expect(lerpPos({ x: 2, y: 2, px: 1, py: 1 }, 0.5)).toEqual({ x: 1.5, y: 1.5 });
    expect(lerpPos({ x: 20, y: 2, px: 1, py: 1 }, 0.5)).toEqual({ x: 20, y: 2 }); // teleport: no smear
    expect(rowOf(-3, 56)).toBe(0); expect(rowOf(70, 56)).toBe(55); expect(rowOf(12.9, 56)).toBe(12);
    expect(crackOverlay(50, 100)).toBe('bld_crack_1'); expect(crackOverlay(20, 100)).toBe('bld_crack_2'); expect(crackOverlay(90, 100)).toBeNull();
  });
});

describe('juice curves (SPEC §9.8)', () => {
  it('bounce 1.2 → 1.0, numbers rise and fade, curved fly path, low-hearth vignette', () => {
    expect(bounceScale(0)).toBeCloseTo(1.2); expect(bounceScale(1)).toBe(1);
    const a = damageNumber(0.05), b = damageNumber(0.79);
    expect(a.alpha).toBe(1); expect(b.alpha).toBeLessThan(0.1); expect(b.dy).toBeGreaterThan(a.dy);
    const p0 = flyPath(0, 0, 0, 100, 0), p1 = flyPath(1, 0, 0, 100, 0), pm = flyPath(0.5, 0, 0, 100, 0);
    expect(p0).toEqual({ x: 0, y: 0 }); expect(p1.x).toBeCloseTo(100); expect(Math.abs(pm.y)).toBeGreaterThan(5);
    expect(lowHearthAlpha(0.5, 0)).toBe(0); expect(lowHearthAlpha(0.1, 0)).toBeGreaterThan(0.3);
    expect(fadeAlpha(0.25, 0.5)).toBeCloseTo(1); expect(fadeAlpha(0.6, 0.5)).toBe(0);
  });
});

describe('save + catalogue', () => {
  it('run snapshot validation and storage failures never throw', () => {
    expect(validRunSnapshot(null)).toBe(false); expect(validRunSnapshot('{oops')).toBe(false);
    expect(validRunSnapshot('{"version":2}')).toBe(false); expect(validRunSnapshot('{"version":1}')).toBe(true);
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => undefined };
    expect(safeGet(broken, 'k')).toBeNull(); expect(safeSet(broken, 'k', 'v')).toBe(false);
  });
  it('drawer tabs cover every placeable building; rings; locks', () => {
    const all = ['defense', 'light', 'traps', 'economy'].flatMap((t) => tabItems(t as never));
    expect(new Set(all).size).toBe(16);
    expect(all).not.toContain('hearth');
    expect(rangeRings('tower_mortar', 1)).toEqual([9, 4]);
    expect(rangeRings('tower_arrow', 3)).toEqual([6]);
    const meta = { unlockedBlueprints: [] } as never;
    expect(isLocked('tower_spark', meta)).toBe(true); expect(isLocked('tower_arrow', meta)).toBe(false);
  });
});

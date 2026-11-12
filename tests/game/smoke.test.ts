// Headless smoke test of the whole Cocos view layer against tests/game/ccMock.ts (a stand-in for the engine):
// boots through Boot.ts, drives Title → run → joystick → build mode paint → night (autoplay) → dawn boon → defeat →
// title with simulated touches, and checks nothing throws and the commands reach the core.
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('cc', async () => await import('./ccMock'));
vi.mock('cc/env', () => ({ EDITOR: false, DEBUG: true, PREVIEW: true, BUILD: false, DEV: true }));

import * as cc from './ccMock';
import { atlasPixels, renderTree, writeShot } from './raster';
import type { GameState } from '../../assets/scripts/core/api';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
let root: Any;
let canvas: cc.Node;
const EH = () => (globalThis as Any).__EH;

function frames(n: number, dt = 1 / 60): void { for (let i = 0; i < n; i++) root.update(dt); }
function touch(id: number, x: number, y: number, kind: 'touch-start' | 'touch-move' | 'touch-end'): void {
  cc.input.emit(kind, new cc.EventTouch(new cc.Touch(id, x, y)));
}
/** Tap at UI px (converted to design units). */
function tapUi(x: number, y: number): void {
  const s = root.layout.uiS;
  touch(1, x * s, y * s, 'touch-start'); frames(1); touch(1, x * s, y * s, 'touch-end'); frames(1);
}
function tapButton(b: Any): void { tapUi(b.hit.x + b.hit.w / 2, b.hit.y + b.hit.h / 2); }
function state(): GameState { return root.game.state; }
/** Optional screenshots of the composited mock scene: EH_SHOTS=<dir> npx vitest run tests/game/smoke.test.ts */
function shot(name: string): number {
  const v = cc.view.getVisibleSize();
  const img = renderTree(canvas, v.width, v.height, 2 / root.layout.uiS);
  const dir = process.env.EH_SHOTS;
  if (dir) writeShot(`${dir}/${name}.png`, img);
  return img.sprites;
}

describe('view layer smoke (mock engine)', () => {
  beforeAll(async () => {
    cc.setAtlasDecoder(atlasPixels);
    const scene = new cc.Scene('Main');
    canvas = new cc.Node('Canvas');
    scene.addChild(canvas);
    cc.director.scene = scene;
    await import('../../assets/scripts/game/Boot');
    cc.director.emit(cc.Director.EVENT_AFTER_SCENE_LAUNCH);
    const { GameRoot } = await import('../../assets/scripts/game/GameRoot');
    root = canvas.getComponent(GameRoot as Any);
    expect(root).toBeTruthy();
    root.onLoad();
  });

  it('boots to the title with pixel-perfect world + UI scales and NEAREST atlas', () => {
    frames(40);
    expect(root.screenId).toBe('title');
    expect(root.title.shown).toBe(true);
    // 1170 px wide device → n = round(1170/180) = 7 device px per art px
    expect(root.cam.n).toBe(7);
    expect(root.cam.s * (1170 / 720)).toBeCloseTo(7);
    expect(cc.loaded).toContain('art/atlas');
    expect(EH()).toBeTruthy();
    expect(typeof EH().fps()).toBe('number');
    expect(shot('title')).toBeGreaterThan(50);
  });

  it('starts a run from the Play button, moves with the joystick', () => {
    tapButton(root.title.play);
    frames(40);
    expect(root.screenId).toBe('game');
    expect(root.game).toBeTruthy();
    const leader = () => state().heroes.find((h) => h.leader)!;
    const p0 = { x: leader().x, y: leader().y };
    const s = root.layout.uiS;
    touch(2, 360, 300, 'touch-start');
    for (let i = 0; i < 10; i++) { touch(2, 360 + i * 8, 300, 'touch-move'); frames(1); }
    frames(60);
    expect(root.joy.node.active).toBe(true);
    shot('joystick');
    touch(2, 440, 300, 'touch-end');
    frames(5);
    const p1 = leader();
    expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeGreaterThan(0.5);
    expect(p1.x).toBeGreaterThan(p0.x);
    expect(shot('day')).toBeGreaterThan(200);
    void s;
  });

  it('opens build mode with the hammer and paints a wall line', () => {
    // first run: the tutorial overlay is up; skip it with its button
    expect(root.tutorial.node.active).toBe(true);
    tapButton(root.tutorial.skip); frames(2);
    expect(root.tutorial.node.active).toBe(false);
    expect(state().tutorial).toBe(-1);
    EH().grant({ wood: 200, stone: 100, gold: 50 });
    tapButton(root.hud.hammer);
    frames(5);
    expect(state().buildMode).toBe(true);
    expect(root.drawer.node.active).toBe(true);
    root.drawer.select('wall_wood');
    const g = root.game;
    // find a horizontal run of 4 placeable cells near the hearth
    const h = state().buildings.find((b) => b.uid === state().hearthUid)!;
    let start: { x: number; y: number } | null = null;
    for (let dy = -6; dy <= 6 && !start; dy++) for (let dx = -6; dx <= 3 && !start; dx++) {
      const x = h.x + dx, y = h.y + dy;
      if ([0, 1, 2, 3].every((k) => g.canPlace('wall_wood', x + k, y).ok)) start = { x, y };
    }
    expect(start).not.toBeNull();
    // camera focus on the cells so they are on screen
    root.cam.focus({ x: start!.x + 2, y: start!.y }, true);
    frames(2);
    const before = state().buildings.length;
    const ui = (tx: number, ty: number) => { const p = root.tileToUi(tx + 0.5, ty + 0.5); return { x: p.x * root.layout.uiS, y: p.y * root.layout.uiS }; };
    const a = ui(start!.x, start!.y), b = ui(start!.x + 3, start!.y);
    touch(3, a.x, a.y, 'touch-start'); frames(1);
    for (let k = 1; k <= 6; k++) { touch(3, a.x + ((b.x - a.x) * k) / 6, a.y, 'touch-move'); frames(1); }
    expect(root.gestures.ghostCells.length).toBe(4);
    shot('build-paint');
    touch(3, b.x, b.y, 'touch-end'); frames(3);
    expect(state().buildings.length).toBe(before + 4);
    // undo removes the last paint
    tapButton(root.drawer.undo); frames(2);
    expect(state().buildings.length).toBe(before);
  });

  it('places a tower with ghost + confirm and opens the radial menu on tap', () => {
    const g = root.game;
    root.drawer.select('tower_arrow');
    const h = state().buildings.find((b) => b.uid === state().hearthUid)!;
    let spot: { x: number; y: number } | null = null;
    for (let dy = -5; dy <= 5 && !spot; dy++) for (let dx = -5; dx <= 5 && !spot; dx++) if (g.canPlace('tower_arrow', h.x + dx, h.y + dy).ok) spot = { x: h.x + dx, y: h.y + dy };
    expect(spot).not.toBeNull();
    root.cam.focus({ x: spot!.x, y: spot!.y }, true); frames(2);
    const p = root.tileToUi(spot!.x + 0.5, spot!.y + 0.5);
    tapUi(p.x, p.y); frames(2);
    expect(root.gestures.ghost).toBeTruthy();
    shot('build-ghost');
    const before = state().buildings.length;
    tapButton(root.gestures.confirm); frames(3);
    expect(state().buildings.length).toBe(before + 1);
    expect(root.gestures.ghost).toBeNull();
    root.drawer.select(null);
    const q = root.tileToUi(spot!.x + 0.5, spot!.y + 0.5);
    tapUi(q.x, q.y); frames(2);
    expect(root.radial.isOpen).toBe(true);
    shot('radial');
    tapButton(root.drawer.done); frames(3);
    expect(state().buildMode).toBe(false);
  });

  it('runs a night on autoplay with combat FX, then dawn boons, then defeat → title', () => {
    EH().goto('night', { night: 3 });
    EH().autoplay(true); EH().speed(4);
    let maxEnemies = 0, shotTaken = false;
    for (let i = 0; i < 40 * 60 && state().phase === 'night'; i++) {
      root.update(1 / 60);
      maxEnemies = Math.max(maxEnemies, state().enemies.length);
      if (!shotTaken && state().projectiles.length > 2) {
        const h = state().buildings.find((b) => b.uid === state().hearthUid)!;
        const near = state().enemies.filter((e) => !e.status.veiled).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
        if (near && Math.hypot(near.x - h.x, near.y - h.y) < 9) {
          shotTaken = true;
          root.cam.focus({ x: (near.x + h.x) / 2, y: (near.y + h.y) / 2 }, true); root.cam.follow = false;
          root.update(1 / 60); shot('night');
        }
      }
    }
    expect(maxEnemies).toBeGreaterThan(0);
    EH().autoplay(false); EH().speed(1);
    frames(30);
    EH().goto('dawn');
    frames(40);
    expect(state().phase).toBe('dawn');
    expect(root.dawn.shown).toBe(true);
    shot('dawn');
    if (state().boonOffer) {
      const n0 = state().boons.reduce((s, b) => s + b.stacks, 0);
      const card = root.dawn.boons.cardHits[0];
      tapUi(card.x + card.w / 2, card.y + card.h / 2); frames(5);
      expect(state().boons.reduce((s, b) => s + b.stacks, 0)).toBeGreaterThan(n0);
    }
    EH().goto('defeat');
    frames(30);
    expect(root.loseS.shown).toBe(true);
    shot('defeat');
    tapButton(root.loseS.toTitle);
    frames(60);
    expect(root.screenId).toBe('title');
    expect(EH().errors).toEqual([]);
  });

  it('opens settings + barracks screens and toggles big text without errors', () => {
    tapButton(root.title.settings); frames(40);
    expect(root.settings.shown).toBe(true);
    shot('settings');
    tapButton(root.settings.big); frames(2);
    expect(root.meta.settings.bigText).toBe(true);
    tapButton(root.settings.back); frames(40);
    tapButton(root.title.barracks); frames(40);
    expect(root.barracks.shown).toBe(true);
    shot('barracks');
    for (const t of root.barracks.tabs) { tapButton(t); frames(2); }
    tapButton(root.barracks.back); frames(40);
    expect(root.screenId).toBe('title');
    expect(cc.audioLog.length).toBeGreaterThan(0); // audio unlocked after first touch and SFX played
  });

  it('boss night shows the boss bar; pause → quit; continue run restores the dawn snapshot', () => {
    tapButton(root.title.play); frames(40);
    expect(root.screenId).toBe('game');
    if (state().tutorial >= 0) { tapButton(root.tutorial.skip); frames(2); }
    EH().grant({ wood: 300, stone: 300, gold: 300 });
    EH().goto('night', { night: 5 });
    let sawBoss = false;
    EH().autoplay(true); EH().speed(3);
    for (let i = 0; i < 25 * 60 && !sawBoss; i++) {
      root.update(1 / 60);
      if (state().boss && root.hud.bossBar.node.active) {
        sawBoss = true;
        const b = state().enemies.find((e) => e.uid === state().boss!.uid);
        if (b) { root.cam.focus({ x: b.x, y: b.y }, true); root.cam.follow = false; }
        frames(20); shot('boss');
      }
    }
    EH().autoplay(false); EH().speed(1);
    expect(sawBoss).toBe(true);
    EH().goto('dawn', { night: 5 }); frames(30);
    if (state().boonOffer) { const c = root.dawn.boons.cardHits[1]; tapUi(c.x + c.w / 2, c.y + c.h / 2); frames(10); }
    expect(state().phase).toBe('day');
    const seed = state().seed, night = state().night;
    tapButton(root.hud.pause); frames(3);
    expect(root.pauseS.shown).toBe(true);
    tapButton(root.pauseS.quit); frames(60);
    expect(root.screenId).toBe('title');
    expect(root.title.cont.node.active).toBe(true);
    tapButton(root.title.cont); frames(60);
    expect(root.screenId).toBe('game');
    expect(state().seed).toBe(seed);
    expect(state().night).toBe(night);
    // minimap enlarges on tap and shrinks again
    const mm = root.hud.minimap;
    tapUi(mm.hit.x + mm.hit.w / 2, mm.hit.y + mm.hit.h / 2);
    expect(mm.big).toBe(true);
    shot('minimap');
    tapUi(mm.hit.x + mm.hit.w / 2, mm.hit.y + mm.hit.h / 2);
    expect(mm.big).toBe(false);
    expect(EH().errors).toEqual([]);
  });
});

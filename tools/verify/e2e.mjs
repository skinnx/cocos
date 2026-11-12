#!/usr/bin/env node
// E2E for the web preview (SPEC §13.6): Playwright Chromium at 390×844 (DPR 2 for the saved shots).
// Fails on any console error / pageerror / missing sprite. Drives Title → Game, touch-drag movement, Build mode
// (paint a wall line, place a tower), autoplay through 2 full nights, __EH.goto to boss night / dawn / defeat,
// barracks, continue-after-reload; saves the 9 shots to docs/shots/<name>.png; measures avg FPS with ~150 enemies.
//   --no-build   reuse tools/preview/dist      --headed  show the browser      --keep  leave server running on fail
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = join(ROOT, 'docs', 'shots');
const args = process.argv.slice(2);
const FPS_GATE = 30;
const SHOT_NAMES = ['title', 'day-explore', 'build-mode', 'dusk-omens', 'night-defense', 'boss', 'dawn-boons', 'barracks', 'defeat'];

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* not local */ }
  const groot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return createRequire(join(groot, 'noop.js'))('playwright');
}

const log = (...a) => console.log('[e2e]', ...a);
const checks = [];
function check(name, ok, detail = '') { checks.push({ name, ok: !!ok, detail }); log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); }

async function main() {
  if (!args.includes('--no-build')) { const { buildPreview } = await import('../preview/build.mjs'); await buildPreview({ quiet: true }); }
  const { startServer } = await import('../preview/serve.mjs');
  let server;
  let port = Number(process.env.E2E_PORT) || 4178;
  for (let i = 0; i < 10 && !server; i++) { try { server = await startServer(port, { quiet: true }); } catch { port++; } }
  if (!server) throw new Error('could not start the preview server');
  const SEED = Number(process.env.E2E_SEED) || 7;
  const base = `http://127.0.0.1:${port}/?debug=1&seed=${SEED}`;
  log('serving', base);

  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch(args.includes('--headed') ? { headless: false } : undefined);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  const cdp = await context.newCDPSession(page);

  // ── helpers ───────────────────────────────────────────────────────────────
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const waitFor = async (what, fn, arg, timeout = 30000, every = 100) => {
    const t0 = Date.now();
    for (;;) {
      const v = await ev(fn, arg).catch(() => null);
      if (v) return v;
      if (Date.now() - t0 > timeout) throw new Error(`timeout waiting for ${what}`);
      await page.waitForTimeout(every);
    }
  };
  const sleep = (ms) => page.waitForTimeout(ms);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id ?? 0, radiusX: 4, radiusY: 4, force: 1 })) });
  async function tap(p) { await touch('touchStart', [p]); await sleep(40); await touch('touchEnd', []); await sleep(60); }
  async function drag(from, to, { steps = 12, holdMs = 0, stepMs = 16, beforeEnd } = {}) {
    await touch('touchStart', [from]);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]); await sleep(stepMs); }
    if (holdMs) { const t0 = Date.now(); while (Date.now() - t0 < holdMs) { await touch('touchMove', [to]); await sleep(50); } }
    if (beforeEnd && (await beforeEnd()) === 'cancelled') { await sleep(60); return; }
    await touch('touchEnd', []);
    await sleep(60);
  }
  const hit = async (id) => { const p = await ev((i) => window.__EH.hit(i), id); if (!p) throw new Error(`UI element "${id}" not on screen`); return p; };
  const tapUI = async (id) => tap(await hit(id));
  const tileC = (x, y) => ev(([a, b]) => window.__EH.tileToClient(a, b), [x, y]);
  const shot = async (name) => {
    await sleep(120);
    const path = join(SHOTS, `${name}.png`);
    await page.screenshot({ path });
    log(`shot ${name}.png (${(statSync(path).size / 1024).toFixed(0)} KB)`);
  };
  const S = () => ev(() => { const s = window.__EH.state(); if (!s) return null; const L = s.heroes.find((h) => h.leader) || s.heroes[0];
    return { phase: s.phase, night: s.night, buildMode: s.buildMode, res: { ...s.res }, enemies: s.enemies.length, buildings: s.buildings.length,
      walls: s.buildings.filter((b) => b.id === 'wall_wood').length, towers: s.buildings.filter((b) => b.id === 'tower_arrow').length,
      leader: L ? { x: L.x, y: L.y } : null, boon: s.boonOffer ? s.boonOffer.length : 0, boss: s.boss, survived: s.stats.nightsSurvived,
      projectiles: s.projectiles.length, veiled: s.enemies.filter((e) => e.status.veiled).length }; });

  mkdirSync(SHOTS, { recursive: true });
  try {
    // ── 1. Title ────────────────────────────────────────────────────────────
    await page.goto(base);
    await ev(() => { try { localStorage.clear(); } catch { /* */ } });
    await page.reload();
    await waitFor('__EH + title', () => window.__EH && window.__EH.app.screen === 'title' && window.__EH.app.atlas.img);
    await sleep(900); // fade-in
    check('title screen reached', true);
    await shot('title');

    // ── 2. Title → game ─────────────────────────────────────────────────────
    await tapUI('play');
    await waitFor('game screen', () => window.__EH.app.screen === 'game' && window.__EH.state());
    await ev(() => window.__EH.cmd({ t: 'skipTutorial' }));
    let s = await S();
    check('Title → Game via Play button', s && s.phase === 'day', `phase=${s?.phase}`);

    // ── 3. touch-drag to move (floating joystick) ───────────────────────────
    const before = s.leader;
    await drag({ x: 195, y: 620 }, { x: 255, y: 640 }, { holdMs: 1400 });
    s = await S();
    const moved = Math.hypot(s.leader.x - before.x, s.leader.y - before.y);
    check('touch drag moves the squad leader', moved > 0.8, `moved ${moved.toFixed(2)} tiles`);
    // second walk: screenshot while the floating joystick is held
    await drag({ x: 195, y: 620 }, { x: 160, y: 575 }, { holdMs: 1300, beforeEnd: () => shot('day-explore') });

    // ── 4. Build mode: paint a wall line, place a tower ─────────────────────
    await ev(() => window.__EH.grant({ wood: 300, stone: 200, gold: 100 }));
    await tapUI('hammer');
    await waitFor('build mode', () => window.__EH.state().buildMode && window.__EH.app.build.open);
    check('Build mode opens from hammer button', true);
    const plan = await ev(() => {
      const app = window.__EH.app, g = app.game, s = g.state;
      const h = s.buildings.find((b) => b.uid === s.hearthUid);
      app.cam.x = (h.x + 1) * 16; app.cam.y = (h.y + 1) * 16 + 24;
      // wall line: first row south of the hearth with 5+ consecutive placeable cells
      let wall = null;
      for (let dy = 3; dy <= 5 && !wall; dy++) for (let x0 = h.x - 4; x0 <= h.x + 1 && !wall; x0++) {
        let ok = true; for (let i = 0; i < 6; i++) if (!g.canPlace('wall_wood', x0 + i, h.y + dy).ok) ok = false;
        if (ok) wall = { x0, y: h.y + dy, n: 6 };
      }
      // tower: free tile adjacent (<=2) to a lit brazier
      const br = s.buildings.find((b) => b.id === 'brazier' && b.lit) || s.buildings.find((b) => b.id === 'brazier');
      let tower = null;
      const around = br ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]] : [];
      for (const [dx, dy] of around) if (!tower && g.canPlace('tower_arrow', br.x + dx, br.y + dy).ok) tower = { x: br.x + dx, y: br.y + dy };
      if (!tower) for (let r = 2; r < 6 && !tower; r++) for (let dx = -r; dx <= r && !tower; dx++) if (g.canPlace('tower_arrow', h.x + dx, h.y - r).ok) tower = { x: h.x + dx, y: h.y - r };
      return { wall, tower, hearth: { x: h.x, y: h.y } };
    });
    check('found a placeable wall row + tower tile', plan.wall && plan.tower, JSON.stringify(plan));
    await sleep(100);
    // select the wood wall card (defense tab, card 0) then paint by drag
    const cardC = async (i) => ev((k) => window.__EH.artToClient(4 + k * 52 + 25, window.__EH.app.build.drawerTop + 16 + 6 + 30), i);
    await tap(await cardC(0));
    check('wall card selected', await ev(() => window.__EH.app.build.sel === 'wall_wood'));
    const w0 = (await S()).walls;
    const a = await tileC(plan.wall.x0 + 0.5, plan.wall.y + 0.5), b = await tileC(plan.wall.x0 + plan.wall.n - 0.5, plan.wall.y + 0.5);
    await drag(a, b, { steps: 16, stepMs: 30 });
    await sleep(200);
    const w1 = (await S()).walls;
    check('paint drag places a wall line', w1 - w0 >= 5, `${w1 - w0} walls painted`);
    await tapUI('undo');
    const wu = (await S()).walls;
    check('Undo button removes the last stroke', wu === w0, `${w1} -> ${wu}`);
    await drag(a, b, { steps: 16, stepMs: 30 });
    await sleep(200);
    // tower: select arrow tower (card 3), tap ghost, confirm ✓
    await tap(await cardC(3));
    check('arrow tower card selected', await ev(() => window.__EH.app.build.sel === 'tower_arrow'));
    await tap(await tileC(plan.tower.x + 0.5, plan.tower.y + 0.5));
    await waitFor('tower ghost', () => !!window.__EH.app.build.ghost);
    const t0n = (await S()).towers;
    await sleep(100);
    await tapUI('ghostOk');
    await sleep(200);
    check('tower placed via ghost + confirm', (await S()).towers === t0n + 1);
    // radial menu: deselect the card, tap the tower, upgrade it
    await tap(await cardC(3));
    await tap(await tileC(plan.tower.x + 0.5, plan.tower.y + 0.5));
    await waitFor('radial menu', () => window.__EH.app.build.menu !== null, undefined, 3000);
    await tapUI('menuUp');
    await sleep(150);
    const lvl = await ev((t) => window.__EH.state().buildings.find((q) => q.x === t.x && q.y === t.y).level, plan.tower);
    check('radial menu upgrades the tower', lvl === 2, `level ${lvl}`);
    await tap(await tileC(plan.tower.x - 3.5, plan.tower.y - 3.5)); // tap empty ground closes the menu
    // build-mode shot: wall card again, mid-stroke across an obstacle (green + red ghosts), tower range + synergy visible
    await tap(await cardC(0));
    // stroke along the tower's row: crosses the Hearth / brazier / tower (red) and free grass (green), ends next to the
    // tower so its range ring + flame link show
    await ev(([x, y]) => { window.__EH.app.cam.x = x * 16; window.__EH.app.cam.y = y * 16 + 40; }, [plan.tower.x - 2, plan.tower.y]);
    const c0 = await tileC(plan.tower.x - 6.5, plan.tower.y + 0.5), c1 = await tileC(plan.tower.x + 2.5, plan.tower.y + 0.5);
    await drag(c0, c1, { steps: 14, stepMs: 30, beforeEnd: async () => { await shot('build-mode'); await touch('touchCancel', []); return 'cancelled'; } });
    await ev(() => { window.__EH.app.build.paint = null; });
    await tapUI('buildDone');
    check('Build mode closes', !(await S()).buildMode);

    // ── 5. autoplay through 2 full nights ───────────────────────────────────
    await ev(() => { window.__EH.autoplay(true); window.__EH.speed(8); });
    const tA = Date.now();
    let lastLog = 0;
    for (;;) {
      s = await S();
      if (Date.now() - lastLog > 15000) { lastLog = Date.now(); log(`  autoplay: ${s.phase} night ${s.night}, ${s.enemies} enemies, ${s.buildings} buildings, fps ${(await ev(() => window.__EH.fps())).toFixed(0)}`); }
      if (!s || s.phase === 'defeat' || s.survived >= 2 || Date.now() - tA > 240000) break;
      await sleep(250);
    }
    check('autoplay survives 2 full nights', s.survived >= 2, `phase=${s.phase} night=${s.night} survived=${s.survived} in ${((Date.now() - tA) / 1000).toFixed(0)}s`);
    await ev(() => { window.__EH.autoplay(false); window.__EH.speed(1); });

    // ── 6. Dusk omens (same run: the bot's fort, explored island) ──────────
    await ev(() => window.__EH.goto('dusk'));
    await waitFor('dusk', () => window.__EH.state().phase === 'dusk' && window.__EH.app.build.open);
    await sleep(900);
    s = await S();
    check('dusk shows omens + build mode', s.phase === 'dusk' && s.buildMode);
    await shot('dusk-omens');

    // ── 7. Night defense: the bot keeps playing the night, we frame the fight ─
    await tapUI('startNight');
    await ev(() => { window.__EH.autoplay(true); });
    await waitFor('night', () => window.__EH.state().phase === 'night');
    // pinch-zoom out one integer step (n-1, SPEC §3) to frame the fort and the dark beyond it
    await ev(() => { const s = window.__EH.state(); const h = s.buildings.find((b) => b.uid === s.hearthUid); window.__EH.app.zoomIdx = 0; window.__EH.camTo(h.x + 1, h.y + 1.5); window.__EH.speed(3); });
    // wait until the fight is on screen: towers firing, damage numbers up, Gloom in the dark showing only eyes
    const view = (thr) => {
      const EH = window.__EH, s = EH.state(), a = EH.app;
      // frame the fort edge facing the nearest Gloom still in the dark
      const h = s.buildings.find((b) => b.uid === s.hearthUid), hx = h.x + 1, hy = h.y + 1;
      let near = null, nd = 1e9;
      for (const e of s.enemies) { const d = Math.hypot(e.x - hx, e.y - hy); if (e.status.veiled && d < nd) { nd = d; near = e; } }
      if (near && nd < 16) EH.camTo(hx + (near.x - hx) * 0.6, hy + (near.y - hy) * 0.6);
      const c = a.camRect();
      const on = (e) => e.x * 16 > c.x + 8 && e.x * 16 < c.x + c.w - 8 && e.y * 16 > c.y + 100 && e.y * 16 < c.y + c.h - 50;
      const v = { proj: s.projectiles.filter(on).length, veiled: s.enemies.filter((e) => e.status.veiled && on(e)).length,
        lit: s.enemies.filter((e) => !e.status.veiled && on(e)).length, nums: a.fx.nums.filter((n) => n.t < 0.45 && on({ x: n.x / 16, y: n.y / 16 })).length, phase: s.phase };
      // freeze the sim on the first frame that shows the whole fight (rendering + FX keep running)
      v.score = Math.min(v.lit, 6) + Math.min(v.veiled, 4) + Math.min(v.proj, 3);
      v.ok = v.proj > 0 && v.nums > 0 && v.veiled >= 1 && v.lit >= 1 && v.score >= thr;
      if (v.ok) EH.speed(0);
      return v;
    };
    let best = null;
    const tN = Date.now();
    while (Date.now() - tN < 60000) {
      const v = await ev(view, Math.max(4, 12 - Math.floor((Date.now() - tN) / 6000)));
      if (v.phase !== 'night') break;
      if (v.ok) { best = v; break; }
      await ev((k) => window.__EH.speed(k), v.veiled + v.lit > 0 ? 1 : 3);
      await sleep(v.veiled + v.lit > 0 ? 30 : 200);
    }
    if (best) await shot('night-defense');
    await ev(() => { window.__EH.speed(1); window.__EH.autoplay(false); });
    check('night: towers firing, damage numbers, veiled eyes on screen', best, best ? JSON.stringify(best) : 'conditions not met in 60s');
    if (!best) await shot('night-defense');

    // ── 8. Boss night ───────────────────────────────────────────────────────
    await ev(() => { window.__EH.goto('night', { night: 5 }); window.__EH.speed(4); });
    await waitFor('boss spawned', () => !!window.__EH.state().boss, undefined, 60000);
    // let Mossback walk into the light around the fort, then frame it with the fort
    await waitFor('boss near the fort', () => {
      const EH = window.__EH, s = EH.state(); const b = s.enemies.find((e) => e.uid === s.boss?.uid);
      const h = s.buildings.find((q) => q.uid === s.hearthUid);
      return b && !b.status.veiled && Math.hypot(b.x - h.x - 1, b.y - h.y - 1) < 10.5;
    }, undefined, 90000, 50);
    await ev(() => {
      const EH = window.__EH, s = EH.state(); const b = s.enemies.find((e) => e.uid === s.boss.uid); const h = s.buildings.find((q) => q.uid === s.hearthUid);
      EH.speed(1); EH.camTo((b.x + h.x + 1) / 2, (b.y + h.y + 1) / 2);
    });
    await sleep(1200);
    check('boss night: boss present with health bar', !!(await S()).boss);
    await shot('boss');

    // ── 9. Dawn boons ───────────────────────────────────────────────────────
    await ev(() => { window.__EH.camTo(null); window.__EH.app.zoomIdx = 1; window.__EH.goto('dawn', { night: 3 }); });
    await waitFor('boon offer', () => (window.__EH.state().boonOffer || []).length > 0);
    await sleep(500);
    await shot('dawn-boons');
    await tapUI('boon_0');
    await sleep(300);
    s = await S();
    check('picking a boon resolves dawn', !s.boon && s.phase === 'day', `phase=${s.phase}`);

    // ── 10. Continue run after reload ───────────────────────────────────────
    const nightBefore = s.night;
    await page.reload();
    await waitFor('title after reload', () => window.__EH && window.__EH.app.screen === 'title' && window.__EH.app.atlas.img);
    const canContinue = await ev(() => !!window.__EH.app.savedRun());
    check('run snapshot saved at dawn', canContinue);
    if (canContinue) {
      await sleep(400);
      await tapUI('continue');
      await waitFor('continued game', () => window.__EH.app.screen === 'game');
      s = await S();
      check('Continue run restores the saved night', s.night === nightBefore, `night ${s.night} vs ${nightBefore}`);
      await ev(() => window.__EH.app.toTitle());
    }

    // ── 11. Barracks ────────────────────────────────────────────────────────
    await ev(() => { const a = window.__EH.app; a.meta.ember = Math.max(a.meta.ember, 260); a.saveMeta(); a.screen = 'title'; });
    await sleep(200);
    await tapUI('barracks');
    await waitFor('barracks', () => window.__EH.app.screen === 'barracks');
    const hb = await ev(() => window.__EH.app.meta.unlockedHeroes.length);
    await tapUI('hero_ranger');
    await tapUI('tal_startWood');
    const ha = await ev(() => window.__EH.app.meta.unlockedHeroes.length);
    check('barracks: unlock a hero with Ember', ha === hb + 1, `${hb} -> ${ha}`);
    await sleep(300);
    await shot('barracks');
    await tapUI('back');

    // ── 12. Defeat → Title ──────────────────────────────────────────────────
    await ev(() => window.__EH.start(5));
    await ev(() => { window.__EH.cmd({ t: 'skipTutorial' }); window.__EH.goto('night', { night: 6 }); window.__EH.speed(2); });
    await sleep(2500);
    await ev(() => window.__EH.goto('defeat'));
    await waitFor('defeat', () => window.__EH.state().phase === 'defeat');
    await sleep(1200);
    await shot('defeat');
    await tapUI('toTitle');
    check('Defeat → Title', await ev(() => window.__EH.app.screen === 'title'));

    // ── 12b. Pause + Victory → Endless ─────────────────────────────────────
    await ev(() => window.__EH.start(9));
    await ev(() => window.__EH.cmd({ t: 'skipTutorial' }));
    await sleep(300);
    await tapUI('pause');
    check('Pause button pauses', await ev(() => window.__EH.app.paused));
    await tapUI('resume');
    check('Resume button resumes', await ev(() => !window.__EH.app.paused));
    await ev(() => window.__EH.goto('victory', { night: 10 }));
    await waitFor('victory screen', () => window.__EH.state().phase === 'victory');
    await sleep(700);
    await tapUI('endless');
    await sleep(200);
    s = await ev(() => ({ phase: window.__EH.state().phase, endless: window.__EH.state().endless }));
    check('Victory → Continue: Endless', s.endless && s.phase === 'dawn', JSON.stringify(s));

    // ── 13. FPS with ~150 enemies ───────────────────────────────────────────
    await ev(() => window.__EH.start(3));
    await ev(() => { window.__EH.cmd({ t: 'skipTutorial' }); window.__EH.goto('night', { night: 8 }); });
    const spawned = await ev(() => window.__EH.spawn ? window.__EH.spawn(150) : 0);
    await waitFor('150 enemies', () => window.__EH.state().enemies.length >= 140, undefined, 60000);
    await ev(() => { const EH = window.__EH, s = EH.state(); const e = s.enemies[Math.floor(s.enemies.length / 2)]; EH.app.cam.x = e.x * 16; EH.app.cam.y = e.y * 16; });
    const fps = await ev(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
    const nE = (await S()).enemies;
    console.log(`[e2e] avg fps ${fps.toFixed(1)} with ${nE} enemies (DPR 2, 780x1688 backing store, spawned ${spawned})`);
    check(`avg FPS >= ${FPS_GATE} with ~150 enemies`, fps >= FPS_GATE && nE >= 140, `${fps.toFixed(1)} fps, ${nE} enemies`);

    // ── final: console + sprites ────────────────────────────────────────────
    const missing = await ev(() => window.__EH.missing());
    check('no missing sprite names referenced', missing.length === 0, missing.slice(0, 12).join(', '));
    const appErrors = await ev(() => window.__EH.errors.slice());
    check('no console errors / page errors', consoleErrors.length === 0 && appErrors.length === 0, [...consoleErrors, ...appErrors].slice(0, 5).join(' | '));
  } catch (e) {
    check('e2e flow completed', false, e.message);
    try { await page.screenshot({ path: join(SHOTS, '_failure.png') }); log('failure screenshot: docs/shots/_failure.png'); } catch { /* */ }
    if (consoleErrors.length) log('console errors:', consoleErrors.slice(0, 10));
  } finally {
    await browser.close();
    server.close();
  }
  const failed = checks.filter((c) => !c.ok);
  log(`${checks.length - failed.length}/${checks.length} checks passed; shots: ${SHOT_NAMES.map((n) => n + '.png').join(' ')}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('[e2e] fatal:', e); process.exit(1); });

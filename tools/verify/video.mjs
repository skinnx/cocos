// Records a ~75 s gameplay video of the web preview (same core + atlas as the Cocos client).
// Usage: node tools/verify/video.mjs [--no-build]   → docs/video/gameplay.mp4 (+ .webm)
// Scenes: title → walk → build mode (paint walls, place tower) → day autoplay → dusk omens → night defense
//         → boss night (Mossback) → dawn boon pick.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'video');
const args = process.argv.slice(2);
const log = (...a) => console.log('[video]', ...a);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* not local */ }
  const groot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return createRequire(join(groot, 'noop.js'))('playwright');
}

async function main() {
  if (!args.includes('--no-build')) { const { buildPreview } = await import('../preview/build.mjs'); await buildPreview({ quiet: true }); }
  const { startServer } = await import('../preview/serve.mjs');
  let server, port = 4190;
  for (let i = 0; i < 10 && !server; i++) { try { server = await startServer(port, { quiet: true }); } catch { port++; } }
  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch();
  const tmp = join(OUT, '_raw');
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  const W = 390, H = 844;
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    recordVideo: { dir: tmp, size: { width: W * 2, height: H * 2 } } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const sleep = (ms) => page.waitForTimeout(ms);
  const waitFor = async (what, fn, arg, timeout = 60000) => {
    const t0 = Date.now();
    for (;;) { const v = await ev(fn, arg).catch(() => null); if (v) return v; if (Date.now() - t0 > timeout) throw new Error(`timeout: ${what}`); await sleep(100); }
  };
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 0, radiusX: 4, radiusY: 4, force: 1 })) });
  const tap = async (p) => { await touch('touchStart', [p]); await sleep(60); await touch('touchEnd', []); await sleep(120); };
  async function drag(from, to, { steps = 14, stepMs = 30, holdMs = 0 } = {}) {
    await touch('touchStart', [from]);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]); await sleep(stepMs); }
    const t0 = Date.now(); while (Date.now() - t0 < holdMs) { await touch('touchMove', [to]); await sleep(50); }
    await touch('touchEnd', []); await sleep(120);
  }
  const hit = async (id) => { const p = await ev((i) => window.__EH.hit(i), id); if (!p) throw new Error(`UI "${id}" not on screen`); return p; };
  const tapUI = async (id) => tap(await hit(id));
  const tileC = (x, y) => ev(([a, b]) => window.__EH.tileToClient(a, b), [x, y]);
  const cardC = (i) => ev((k) => window.__EH.artToClient(4 + k * 52 + 25, window.__EH.app.build.drawerTop + 16 + 6 + 30), i);
  const st = () => ev(() => { const s = window.__EH.state(); return { phase: s.phase, night: s.night, survived: s.stats.nightsSurvived, boss: !!s.boss, enemies: s.enemies.length }; });

  try {
    // 1. Title
    await page.goto(`http://127.0.0.1:${port}/?debug=1&seed=7`);
    await ev(() => { try { localStorage.clear(); } catch { /* */ } });
    await page.reload();
    await waitFor('title', () => window.__EH && window.__EH.app.screen === 'title' && window.__EH.app.atlas.img);
    log('title'); await sleep(3000);

    // 2. Play + walk around
    await tapUI('play');
    await waitFor('game', () => window.__EH.app.screen === 'game' && window.__EH.state());
    await ev(() => window.__EH.cmd({ t: 'skipTutorial' }));
    await sleep(800);
    log('walk');
    await drag({ x: 195, y: 620 }, { x: 255, y: 600 }, { holdMs: 2200 });
    await drag({ x: 195, y: 620 }, { x: 150, y: 660 }, { holdMs: 1800 });
    await drag({ x: 195, y: 620 }, { x: 200, y: 560 }, { holdMs: 1200 });

    // 3. Build mode: paint a wall line, place an arrow tower next to the brazier
    log('build');
    await ev(() => window.__EH.grant({ wood: 300, stone: 200, gold: 100 }));
    await tapUI('hammer');
    await waitFor('build mode', () => window.__EH.state().buildMode && window.__EH.app.build.open);
    const plan = await ev(() => {
      const app = window.__EH.app, g = app.game, s = g.state, h = s.buildings.find((b) => b.uid === s.hearthUid);
      app.cam.x = (h.x + 1) * 16; app.cam.y = (h.y + 1) * 16 + 24;
      let wall = null;
      for (let dy = 3; dy <= 5 && !wall; dy++) for (let x0 = h.x - 4; x0 <= h.x + 1 && !wall; x0++) {
        let ok = true; for (let i = 0; i < 6; i++) if (!g.canPlace('wall_wood', x0 + i, h.y + dy).ok) ok = false;
        if (ok) wall = { x0, y: h.y + dy, n: 6 };
      }
      const br = s.buildings.find((b) => b.id === 'brazier');
      let tower = null;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [2, 0], [-2, 0]]) if (!tower && br && g.canPlace('tower_arrow', br.x + dx, br.y + dy).ok) tower = { x: br.x + dx, y: br.y + dy };
      return { wall, tower };
    });
    await sleep(1200);
    if (plan.wall) {
      await tap(await cardC(0)); await sleep(500);
      const a = await tileC(plan.wall.x0 + 0.5, plan.wall.y + 0.5), b = await tileC(plan.wall.x0 + plan.wall.n - 0.5, plan.wall.y + 0.5);
      await drag(a, b, { steps: 20, stepMs: 60 }); await sleep(900);
    }
    if (plan.tower) {
      await tap(await cardC(3)); await sleep(500);
      await tap(await tileC(plan.tower.x + 0.5, plan.tower.y + 0.5));
      await waitFor('ghost', () => !!window.__EH.app.build.ghost, undefined, 3000).catch(() => null);
      await sleep(1200);
      await tapUI('ghostOk').catch(() => null); await sleep(1000);
    }
    await tapUI('buildDone').catch(() => null);
    await sleep(600);

    // 4. Day → dusk → night, autoplay (bot builds the fort), sped up during the day
    log('autoplay day');
    await ev(() => { window.__EH.autoplay(true); window.__EH.speed(4); });
    await waitFor('dusk', () => window.__EH.state().phase !== 'day', undefined, 90000);
    await ev(() => { const s = window.__EH.state(); const h = s.buildings.find((b) => b.uid === s.hearthUid); window.__EH.camTo(h.x + 1, h.y + 1.5); window.__EH.speed(1); });
    log('night 1');
    await waitFor('night', () => window.__EH.state().phase === 'night', undefined, 30000);
    await ev(() => window.__EH.speed(1.5));
    await sleep(14000);
    await ev(() => window.__EH.speed(4));
    await waitFor('dawn', () => window.__EH.state().phase !== 'night', undefined, 120000);
    await ev(() => window.__EH.speed(1)); await sleep(2500);

    // 5. Later night with a bigger fort: let the bot play to night 3
    log('to night 3');
    await ev(() => window.__EH.speed(8));
    await waitFor('night 3', () => { const s = window.__EH.state(); return s.phase === 'night' && s.night >= 3; }, undefined, 240000);
    await ev(() => { window.__EH.app.zoomIdx = 0; window.__EH.speed(1.5); });
    await sleep(14000);

    // 6. Boss night (Mossback)
    log('boss');
    await ev(() => { window.__EH.app.zoomIdx = 1; window.__EH.goto('night', { night: 5 }); window.__EH.speed(2); });
    await waitFor('boss', () => !!window.__EH.state().boss, undefined, 60000);
    for (let i = 0; i < 28; i++) {
      await ev(() => { const s = window.__EH.state(), b = s.enemies.find((e) => e.id === 'mossback'), h = s.buildings.find((q) => q.uid === s.hearthUid);
        if (b && h) window.__EH.camTo((b.x + h.x + 1) / 2, (b.y + h.y + 1) / 2); });
      await sleep(500);
    }

    // 7. Dawn boon pick
    log('dawn');
    await ev(() => { window.__EH.camTo(null); window.__EH.autoplay(false); window.__EH.speed(1); window.__EH.goto('dawn', { night: 5 }); });
    await sleep(3500);
    await ev(() => window.__EH.cmd({ t: 'pickBoon', index: 1 }));
    await sleep(2000);
    log('final state', JSON.stringify(await st()), 'page errors:', errors.length);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    server.close();
  }
  const raw = readdirSync(tmp).find((f) => f.endsWith('.webm'));
  mkdirSync(OUT, { recursive: true });
  renameSync(join(tmp, raw), join(OUT, "gameplay.webm"));
  rmSync(tmp, { recursive: true, force: true });
  if (existsSync('/usr/bin/ffmpeg')) {
    execSync(`ffmpeg -y -loglevel error -i "${join(OUT, 'gameplay.webm')}" -vf "scale=540:-2:flags=neighbor" -c:v libx264 -pix_fmt yuv420p -crf 30 -preset slow -tune animation -movflags +faststart "${join(OUT, 'gameplay.mp4')}"`);
  }
  if (errors.length) { console.error(errors); process.exit(1); }
  log('wrote docs/video/gameplay.webm' + (existsSync(join(OUT, 'gameplay.mp4')) ? ' + gameplay.mp4' : ''));
}
main().catch((e) => { console.error(e); process.exit(1); });

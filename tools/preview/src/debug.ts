// window.__EH debug hook (SPEC §13.4): installed with ?debug=1. Used by tools/verify/e2e.mjs.
import type { App } from './app';
import type { Command, Phase } from './core';
import { gotoPhase, spawnCrowd } from './bots';

export function installDebug(app: App) {
  const eh = {
    state: () => app.state,
    cmd: (c: Command) => app.cmd(c),
    goto: (phase: Phase, opts: { night?: number } = {}) => {
      if (!app.game) app.newRun(app.seedN);
      gotoPhase(app.game!, phase, opts.night);
      app.build.reset();
      app.lastPhase = '';
      return app.state!.phase;
    },
    grant: (r: { wood?: number; stone?: number; gold?: number }) => {
      const s = app.state; if (!s) return;
      s.res.wood += r.wood ?? 0; s.res.stone += r.stone ?? 0; s.res.gold += r.gold ?? 0;
    },
    autoplay: (on: boolean) => app.autoplay.set(!!on),
    speed: (x: number) => { app.speed = Math.max(0, x); },
    seed: (n: number) => { app.clearRun(); app.newRun(n); },
    fps: () => app.fps(),
    errors: app.errors,
    // extras (preview only)
    spawn: (n: number) => (app.game ? spawnCrowd(app.game, n) : 0),
    app,
    missing: () => [...app.atlas.missing],
    screen: (name?: string) => { if (name) (app as any).screen = name; return app.screen; },
    start: (seed?: number) => { app.clearRun(); app.newRun(seed ?? 1); },
    camTo: (tx: number, ty: number) => { app.cam.x = tx * 16; app.cam.y = ty * 16; },
    tileToClient: (tx: number, ty: number) => { const p = app.tileToScreen(tx, ty); return { x: (p.x * app.n) / app.dpr, y: (p.y * app.n) / app.dpr }; },
    artToClient: (x: number, y: number) => ({ x: ((x + 0.5) * app.n) / app.dpr, y: ((y + 0.5) * app.n) / app.dpr }),
    hit: (id: string) => { const h = app.ui.hits.find((q) => q.id === id); return h ? { x: ((h.x + h.w / 2) * app.n) / app.dpr, y: ((h.y + h.h / 2) * app.n) / app.dpr } : null; },
  };
  (window as any).__EH = eh;
}

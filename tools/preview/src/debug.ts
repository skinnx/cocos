// window.__EH debug hook (SPEC §13.4): installed with ?debug=1. Used by tools/verify/e2e.mjs and video.mjs.
//   state() cmd(c) goto(phase, {night, tr}) grant({...}) autoplay(on) speed(x) seed(n) resume(now) fps() errors[]
// plus preview extras: dayKey(n), now(), loseNight(), spawn(n), save(), camTo(), tileToClient(), hit(id), …
import type { App } from './app';
import type { Command, Phase, ResKey } from './core';
import { clearEnemies, gotoPhase, loseNight, spawnCrowd } from './bots';

export function installDebug(app: App) {
  const ensure = () => { if (!app.game) app.enterHold(); return app.game!; };
  const eh = {
    state: () => app.state,
    cmd: (c: Command) => app.cmd(c),
    goto: (phase: Phase, opts: { night?: number; tr?: number } = {}) => {
      const g = ensure();
      app.build.reset(); app.panel = null; app.unlockCards = [];
      const p = gotoPhase(g, phase, opts);
      app.lastPhase = '';
      return p;
    },
    grant: (r: Partial<Record<ResKey | 'ember', number>>) => {
      const s = app.state; if (!s) return;
      for (const [k, v] of Object.entries(r)) { if (k === 'ember') s.ember += v ?? 0; else if (k in s.res) s.res[k as ResKey] += v ?? 0; }
    },
    autoplay: (on: boolean) => app.autoplay.set(!!on),
    speed: (x: number) => { app.speed = Math.max(0, x); app.autoplay.maxSteps = Math.max(24, Math.ceil(x * 4)); },
    seed: (n: number) => { app.clearHold(); app.clock.offset = 0; app.enterHold(n); },
    /** Simulated absence: jump the real clock to `now` (ms) and settle it like a reopened app (SPEC §15.C). */
    resume: (now: number, o: { dayKey?: number } = {}) => {
      const g = ensure();
      if (o.dayKey !== undefined) app.clock.dayOverride = o.dayKey;
      app.clock.travelTo(now);
      const sum = g.resume(app.clock.now(), app.clock.dayKey());
      app.away = sum ?? null; app.awayCollected = false;
      return sum;
    },
    dayKey: (n?: number | null) => { if (n !== undefined) app.clock.dayOverride = n; return app.clock.dayKey(); },
    now: () => app.clock.now(),
    fps: () => app.fps(),
    errors: app.errors,
    // ── extras (preview only) ──
    app,
    loseNight: () => loseNight(ensure()),
    clearNight: () => clearEnemies(ensure()),
    spawn: (n: number) => (app.game ? spawnCrowd(app.game, n) : 0),
    save: () => app.saveHold(),
    saved: () => app.savedHold(),
    enter: () => app.enterHold(),
    missing: () => [...app.atlas.missing],
    start: (seed?: number) => { app.clearHold(); app.clock.offset = 0; app.enterHold(seed ?? 1); },
    camTo: (tx: number | null, ty?: number) => { app.camFocus = tx === null ? null : { x: tx, y: ty ?? 0 }; if (tx !== null) { app.cam.x = tx * 16; app.cam.y = (ty ?? 0) * 16; } },
    tileToClient: (tx: number, ty: number) => { const p = app.tileToScreen(tx, ty); return { x: (p.x * app.n) / app.dpr, y: (p.y * app.n) / app.dpr }; },
    artToClient: (x: number, y: number) => ({ x: ((x + 0.5) * app.n) / app.dpr, y: ((y + 0.5) * app.n) / app.dpr }),
    hit: (id: string) => { const h = app.ui.hits.find((q) => q.id === id); return h ? { x: ((h.x + h.w / 2) * app.n) / app.dpr, y: ((h.y + h.h / 2) * app.n) / app.dpr } : null; },
    hits: () => app.ui.hits.map((h) => h.id),
  };
  (window as any).__EH = eh;
}

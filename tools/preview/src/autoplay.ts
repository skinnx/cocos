// Bot autoplay for e2e / screenshots: the core's AutoplayBot drives the Hold through the same Command API a player
// uses. Like the headless runner (core/bots), the bot is called once before EVERY fixed step.
import type { App } from './app';
import { autoplayBot, DT } from './bots';

export class Autoplay {
  on = false;
  acc = 0;
  /** steps per frame cap (speed-up for the 12-night e2e run) */
  maxSteps = 24;
  constructor(private app: App) {}
  set(on: boolean) {
    this.on = on; this.acc = 0;
    if (on) { this.app.build.exit(); this.app.joy = null; this.app.paused = false; this.app.panel = null; this.app.unlockCards = []; }
    else this.app.cmd({ t: 'move', dir: { x: 0, y: 0 } });
  }
  /** Advances the sim by dt real seconds (× speed × timeScale) with bot decisions per step. */
  tick(dt: number) {
    const g = this.app.game;
    if (!g) return;
    const s = g.state;
    if (s.phase === 'dusk' || s.phase === 'dawn' || (s.expedition && s.expedition.result)) { autoplayBot(g); g.step(); return; }
    this.acc += Math.min(0.25, dt) * this.app.speed * Math.max(0.25, s.timeScale);
    let n = 0;
    const ph = s.phase, ex = !!s.expedition;
    // stop at a phase change so the shell sees every phase for at least one frame (dusk save, banners, shots)
    while (this.acc >= DT && n < this.maxSteps && s.phase === ph && !!s.expedition === ex) { autoplayBot(g); g.step(); this.acc -= DT; n++; }
    if (n >= this.maxSteps) this.acc = 0;
  }
  alpha() { return Math.max(0, Math.min(1, this.acc / DT)); }
}

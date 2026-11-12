// Bot autoplay for e2e / screenshots: the core's AutoplayBot drives the run through the same Command API a player
// uses. Like the headless runner (core/bots runBot), the bot is called once before EVERY fixed step.
import type { App } from './app';
import { autoplayBot, DT } from './bots';

export class Autoplay {
  on = false;
  acc = 0;
  constructor(private app: App) {}
  set(on: boolean) {
    this.on = on; this.acc = 0;
    if (on) { this.app.build.exit(); this.app.joy = null; this.app.paused = false; }
    else this.app.cmd({ t: 'move', dir: { x: 0, y: 0 } });
  }
  /** Advances the sim by dt real seconds (× speed × timeScale) with bot decisions per step. */
  tick(dt: number) {
    const g = this.app.game;
    if (!g) return;
    const s = g.state;
    if (s.phase === 'dusk' || s.phase === 'dawn') { autoplayBot(g); g.step(); return; }
    this.acc += Math.min(0.25, dt) * this.app.speed * s.timeScale;
    let n = 0;
    while (this.acc >= DT && n < 24) { autoplayBot(g); g.step(); this.acc -= DT; n++; }
    if (n >= 24) this.acc = 0;
  }
  alpha() { return Math.max(0, Math.min(1, this.acc / DT)); }
}

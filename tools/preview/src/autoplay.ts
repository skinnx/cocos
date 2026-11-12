// Bot autoplay for e2e / screenshots: drives the run with the core's BaselineBot through the same command API a
// player uses, and resolves modal choices (boons, dusk) the way the bot decides.
import type { App } from './app';
import { makeBot, type PreviewBot } from './bots';

export class Autoplay {
  on = false;
  bot: PreviewBot | null = null;
  constructor(private app: App) {}
  set(on: boolean) {
    this.on = on;
    if (on) { this.app.build.exit(); this.app.joy = null; this.bot = this.app.game ? makeBot(this.app.game) : null; }
    else { this.bot = null; this.app.cmd({ t: 'move', dir: { x: 0, y: 0 } }); }
  }
  tick(_dt: number) {
    const g = this.app.game;
    if (!g) return;
    if (!this.bot) this.bot = makeBot(g);
    this.bot.tick();
  }
}

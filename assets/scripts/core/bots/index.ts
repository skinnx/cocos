// Bots: `(game: Game) => void` controllers, called once before each fixed step. They only issue Commands.
//   NoBuildBot   — walks, chops and fights; never builds (balance gate: must lose by night 4).
//   BaselineBot  — SPEC §13.6: wall ring around the Hearth with 2 gates, arrow towers next to braziers,
//                  fixed-order upgrades, chops nearby trees by day.
//   AutoplayBot  — Baseline + frost towers, more arrow towers, repairs, Rally Horn, frees nearby cages.
//   runBot(...)  — headless runner used by balance tests, the preview's autoplay and e2e.
import type { Game, MetaState } from '../api';
import { createGame, defaultMeta } from '../sim/Game';
import { botStep } from './BotCore';

const PREF = ['reload', 'hawk', 'sharp', 'boulder', 'mirror', 'thick', 'living', 'falsedawn', 'twin', 'bigfire', 'mason', 'rebirth', 'spikes', 'ash', 'leech', 'cooldown', 'harvest', 'embers'];

export const NoBuildBot = (game: Game): void => botStep(game, { build: false, extras: false, boonPref: ['sharp', 'thick', 'leech', 'swift', 'cooldown', 'twin'] });
export const BaselineBot = (game: Game): void => botStep(game, { build: true, extras: false, boonPref: PREF });
export const AutoplayBot = (game: Game): void => botStep(game, { build: true, extras: true, boonPref: PREF });

export type Bot = (game: Game) => void;

export interface RunResult {
  seed: number; outcome: 'victory' | 'defeat' | 'timeout'; night: number; nightsSurvived: number;
  maxNightSeconds: number; steps: number; hash: string; ember: number;
}

/** Run a bot until victory, defeat, or `maxNight` is survived. */
export function runBot(seed: number, bot: Bot, opts: { maxNight?: number; meta?: MetaState; maxSteps?: number } = {}): RunResult {
  const meta = opts.meta ?? { ...defaultMeta(), tutorialDone: true };
  const g = createGame({ seed, meta });
  const maxNight = opts.maxNight ?? 10;
  const maxSteps = opts.maxSteps ?? 400000;
  let maxNightT = 0, steps = 0;
  const s = g.state;
  while (steps < maxSteps) {
    if (s.phase === 'victory' || s.phase === 'defeat') break;
    if (s.phase === 'dawn' && s.night >= maxNight) break;
    bot(g);
    g.step();
    g.drainEvents();
    steps++;
    if (s.phase === 'night' && s.nightT > maxNightT) maxNightT = s.nightT;
  }
  const outcome = s.phase === 'victory' ? 'victory' : s.phase === 'defeat' ? 'defeat' : 'timeout';
  return { seed, outcome, night: s.night, nightsSurvived: s.stats.nightsSurvived, maxNightSeconds: maxNightT, steps, hash: g.hash(), ember: g.emberEarned() };
}

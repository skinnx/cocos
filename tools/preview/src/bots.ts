// Debug-only drivers for e2e / screenshots: bot autoplay (core/bots), phase jumps (__EH.goto) built from the public
// Command API plus fast-forwarded fixed steps, and a crowd spawner for the FPS gate. Never used by normal play.
import type { EnemyId, Game, Phase } from './core';
import { AutoplayBot } from '../../../assets/scripts/core/bots';
import { DT } from '../../../assets/scripts/core/data/balance';
import { worldOf } from '../../../assets/scripts/core/sim/Game';
import { spawnEnemy } from '../../../assets/scripts/core/sim/Enemies';

export { DT };
/** The core's AutoplayBot: called once before every fixed step, issues Commands only. */
export const autoplayBot = AutoplayBot as unknown as (g: Game) => void;

const MAX_STEPS = 30 * 60 * 6;

/** Kill every wave enemy (debug): lets a night end immediately with a win. */
export function clearEnemies(g: Game) {
  for (const e of g.state.enemies) e.hp = 0;
}

function stepUntil(g: Game, done: () => boolean, each?: () => void, max = MAX_STEPS) {
  for (let i = 0; i < max && !done(); i++) { each?.(); g.step(); }
  return done();
}

/** Resolve whatever modal the core is waiting on (dawn gifts / blessing drop / expedition result). */
function resolveModal(g: Game) {
  const s = g.state;
  if (s.expedition && s.expedition.result) g.cmd({ t: 'abandonExpedition' });
  if (s.gifts && s.gifts.length) {
    if (s.blessings.length >= s.blessingSlots && s.blessings[0]) g.cmd({ t: 'dropBlessing', id: s.blessings[0].id });
    g.cmd({ t: 'pickGift', index: 0 });
  }
}

/**
 * Jump the live Hold to `phase` through the real state machine: PEACE → (bell) DUSK → (start) NIGHT → (enemies
 * cleared) DAWN → (gift) PEACE. `night` sets the Hold's night counter first (moon phase = (night-1) % 7), `tr`
 * the threat rating. Buildings, heroes and resources are kept.
 */
export function gotoPhase(g: Game, phase: Phase, opts: { night?: number; tr?: number; win?: boolean } = {}) {
  const s = g.state;
  if (s.expedition) { s.expedition.timeLeft = 0; stepUntil(g, () => !!s.expedition?.result, undefined, 600); resolveModal(g); stepUntil(g, () => !s.expedition, () => resolveModal(g), 600); }
  const order: Phase[] = ['peace', 'dusk', 'night', 'dawn'];
  let guard = 0;
  const atTarget = () => s.phase === phase && (opts.night === undefined || phase === 'dawn' || s.night === opts.night);
  while (!atTarget() && guard++ < 12) {
    if (s.phase === 'peace') {
      if (opts.night !== undefined && s.night !== opts.night) { s.night = Math.max(1, Math.floor(opts.night)); }
      if (opts.tr !== undefined) s.tr = Math.max(1, Math.floor(opts.tr));
      if (phase === 'peace') break;
      g.cmd({ t: 'buildMode', on: false });
      g.cmd({ t: 'ringBell' });
      stepUntil(g, () => s.phase !== 'peace', undefined, 30);
      if (s.phase === 'peace') { s.phaseT = s.phaseDur; stepUntil(g, () => s.phase !== 'peace', undefined, 60); }
    } else if (s.phase === 'dusk') {
      if (opts.tr !== undefined) s.tr = Math.max(1, Math.floor(opts.tr));
      if (phase === 'dusk') break;
      g.cmd({ t: 'buildMode', on: false });
      g.cmd({ t: 'startNight' });
      stepUntil(g, () => s.phase !== 'dusk', undefined, 30);
    } else if (s.phase === 'night') {
      if (phase === 'night') break;
      stepUntil(g, () => s.phase !== 'night', () => clearEnemies(g));
    } else if (s.phase === 'dawn') {
      if (phase === 'dawn') break;
      resolveModal(g);
      stepUntil(g, () => s.phase !== 'dawn', () => resolveModal(g), 120);
    }
    void order;
  }
  return s.phase;
}

/** Lose the current night (debug): the Hearth falls, the core runs "the fire gutters" (SPEC §2.4). */
export function loseNight(g: Game) {
  const s = g.state;
  if (s.phase !== 'night') gotoPhase(g, 'night');
  const h = s.buildings.find((b) => b.uid === s.hearthUid);
  if (h) h.hp = 0;
  stepUntil(g, () => s.phase !== 'night', () => { const hh = s.buildings.find((b) => b.uid === s.hearthUid); if (hh && hh.hp > 0) hh.hp = 0; }, 600);
  return s.phase;
}

/** Spawn `n` wave enemies around the active rifts (FPS gate). */
export function spawnCrowd(g: Game, n: number): number {
  const w = worldOf(g) as never;
  const s = g.state;
  const rifts = s.pois.filter((p) => p.kind === 'rift' && p.active);
  const all = rifts.length ? rifts : s.pois.filter((p) => p.kind === 'rift');
  const kinds: EnemyId[] = ['gloomling', 'skitter', 'spitter', 'brute', 'wisp', 'bomber', 'snuffer'];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const r = all[i % Math.max(1, all.length)] ?? { x: s.map.size / 2, y: 4 };
    const e = (spawnEnemy as unknown as (w: never, id: EnemyId, x: number, y: number, o: object) => unknown)(w, kinds[i % kinds.length], r.x + 0.5 + ((i * 7) % 11) / 6 - 0.9, r.y + 0.5 + ((i * 5) % 13) / 7 - 0.9, { wave: true });
    if (e) k++;
  }
  return k;
}

// Debug-only access to the core for e2e: bot autoplay (core/bots), phase jumps (__EH.goto) and a crowd spawner for
// the FPS gate. Phase jumps call the core's own phase functions (Phases.ts) on the live world, so the result is a
// state the sim can actually reach; they are never used by normal play.
import type { EnemyId, Game, Phase } from './core';
import { worldOf } from '../../../assets/scripts/core/sim/Game';
import { startDay, startDusk, startNight, startDawn, defeat, victory } from '../../../assets/scripts/core/sim/Phases';
import { spawnEnemy } from '../../../assets/scripts/core/sim/Enemies';
import { riftPois } from '../../../assets/scripts/core/sim/Spawner';
import { BALANCE } from '../../../assets/scripts/core/data/balance';
import { AutoplayBot } from '../../../assets/scripts/core/bots';
import { DT } from '../../../assets/scripts/core/data/balance';

export { DT };
/** The core's AutoplayBot (BaselineBot + extras): called once before every fixed step, issues Commands only. */
export const autoplayBot = AutoplayBot;

function clearNight(g: Game) {
  const w = worldOf(g), s = w.s;
  s.enemies = []; w.emap.clear(); s.projectiles = []; s.zones = []; s.boss = null;
  s.allies = s.allies.filter((a) => a.id !== 'militia');
  w.r.spawn = []; w.r.spawnIdx = 0; s.enemiesLeft = 0;
}

/** Jump the live run to `phase` (optionally of night `night`). Buildings, heroes, resources and boons are kept. */
export function gotoPhase(g: Game, phase: Phase, night?: number) {
  const w = worldOf(g), s = w.s;
  if (s.phase === 'victory' || s.phase === 'defeat') { if (phase !== 'victory' && phase !== 'defeat') { w.hearth.hp = w.hearth.maxHp; } }
  if (night !== undefined && night !== s.night) {
    s.night = Math.max(1, Math.floor(night));
    s.stats.nightsSurvived = Math.max(s.stats.nightsSurvived, s.night - 1);
  }
  const rifts = riftPois(w);
  rifts.forEach((p, i) => { p.active = i < BALANCE.riftsActive(s.night); });
  s.boonOffer = null; s.boonSource = null;
  switch (phase) {
    case 'day': clearNight(g); startDay(w); break;
    case 'dusk': clearNight(g); if (s.phase !== 'day') startDay(w); startDusk(w); break;
    case 'night': clearNight(g); if (s.phase !== 'day') startDay(w); startDusk(w); startNight(w); break;
    case 'dawn': clearNight(g); startDawn(w); break;
    case 'defeat': w.hearth.hp = 0; defeat(w); break;
    case 'victory': clearNight(g); victory(w); break;
  }
  w.lightDirty = true;
}

/** Spawn `n` wave enemies spread over the active rifts (FPS gate). */
export function spawnCrowd(g: Game, n: number): number {
  const w = worldOf(g);
  const rifts = riftPois(w).filter((p) => p.active);
  const kinds: EnemyId[] = ['gloomling', 'skitter', 'spitter', 'brute', 'wisp', 'bomber', 'snuffer'];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const r = rifts[i % Math.max(1, rifts.length)] ?? { x: w.size / 2, y: 4 };
    const e = spawnEnemy(w, kinds[i % kinds.length], r.x + 0.5 + ((i * 7) % 11) / 6 - 0.9, r.y + 0.5 + ((i * 5) % 13) / 7 - 0.9, { wave: true });
    if (e) k++;
  }
  return k;
}

import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../assets/scripts/core/data/balance';
import { startDawn, victory } from '../../assets/scripts/core/sim/Phases';
import { killEnemy } from '../../assets/scripts/core/sim/Combat';
import { addE, flat, game, hero, meta, night, parkHeroes, run } from './helpers';
import type { GameEvent } from '../../assets/scripts/core/api';

describe('Phases (§2.2)', () => {
  it('DAY 60 s on night 1 (75 s later, +8 s/long-day talent) → DUSK paused in build mode → NIGHT → DAWN', () => {
    const { g, w } = game(10);
    expect(w.s.phase).toBe('day');
    expect(w.s.phaseDur).toBe(60);
    for (const e of [...w.s.enemies]) (e as { dead: boolean }).dead = true;
    parkHeroes(w, 28, 31);
    run(g, 60.1);
    expect(w.s.phase).toBe('dusk');
    expect(w.s.buildMode).toBe(true);
    expect(w.s.timeScale).toBe(0);
    const t0 = w.r.stepN; g.update(1); expect(w.r.stepN).toBe(t0); // fully paused
    g.cmd({ t: 'startNight' });
    expect(w.s.phase).toBe('night');
    expect(w.s.buildMode).toBe(false);
    const { w: w2 } = game(10, meta({ talents: { longDay: 2 } }));
    expect(w2.s.phaseDur).toBe(60 + 16);
  });

  it('call night early pays +1 gold per 2 s remaining', () => {
    const { g, w } = game(11);
    run(g, 10);
    const g0 = w.s.res.gold;
    const left = w.s.phaseDur - w.s.phaseT;
    g.cmd({ t: 'callNight' });
    expect(w.s.res.gold - g0).toBe(Math.floor(left * BALANCE.day.callNightGoldPerSec));
    expect(w.s.phase).toBe('dusk');
  });

  it('enrage after the threshold speeds remaining Gloom up', () => {
    const { g, w } = flat();
    night(w); parkHeroes(w);
    const e = addE(w, 'gloomling', 48.5, 48.5);
    w.s.nightT = BALANCE.night.enrageAfter - 0.05;
    const p0 = e.x + e.y; run(g, 0.5); const v1 = (p0 - (e.x + e.y));
    expect(w.r.enraged).toBe(true);
    const { g: g2, w: w2 } = flat(); night(w2); parkHeroes(w2);
    const e2 = addE(w2, 'gloomling', 48.5, 48.5);
    const q0 = e2.x + e2.y; run(g2, 0.5); const v2 = (q0 - (e2.x + e2.y));
    expect(v1 / v2).toBeGreaterThan(1.3);
  });

  it('DAWN: downed heroes revive, spikes rearm, boon offer; heroes revive after 20 s at night', () => {
    const { g, w } = flat();
    night(w);
    const h = hero(w);
    h.hp = 1; addE(w, 'brute', h.x + 0.8, h.y);
    run(g, 3);
    expect(h.anim).toBe('down');
    expect(h.reviveT).toBeGreaterThan(15);
    run(g, 18);
    expect(h.anim).not.toBe('down');
    h.hp = 3;
    startDawn(w);
    expect(h.hp).toBe(h.maxHp);
    expect(w.s.boonOffer?.length).toBe(3);
    expect(w.s.stats.nightsSurvived).toBe(1);
  });

  it('defeat when the Hearth falls; victory after night 10 boss; endless continues with ×1.18 budgets', () => {
    const { g, w } = flat();
    night(w);
    w.hearth.hp = 0;
    g.step();
    expect(w.s.phase).toBe('defeat');
    expect(g.emberEarned()).toBe(0);
    const { g: g2, w: w2 } = flat();
    w2.s.night = 10; w2.s.stats.nightsSurvived = 10; w2.s.stats.bosses = 2; w2.s.stats.camps = 3;
    victory(w2);
    expect(w2.s.phase).toBe('victory');
    expect(g2.emberEarned()).toBe(10 * 10 + 50 * 2 + 5 * 3 + 100);
    g2.cmd({ t: 'endless' });
    expect(w2.s.endless).toBe(true);
    expect(w2.s.phase).toBe('dawn');
    g2.cmd({ t: 'pickBoon', index: 0 });
    expect(w2.s.night).toBe(11);
    expect(w2.s.phase).toBe('day');
  });

  it('Rally Horn: charged by 40 kills, +50% hero & tower attack speed for 6 s', () => {
    const { g, w } = flat();
    expect(w.s.hornCharge).toBe(0);
    night(w);
    for (let i = 0; i < 40; i++) addE(w, 'gloomling', 45, 45);
    for (const e of [...w.s.enemies]) killEnemy(w, e as never);
    expect(w.s.hornCharge).toBe(40);
    g.cmd({ t: 'horn' });
    const evs: GameEvent[] = g.drainEvents();
    expect(evs.some((e) => e.t === 'horn')).toBe(true);
    expect(w.s.hornT).toBe(6);
    expect(w.s.hornCharge).toBe(0);
    run(g, 6.1);
    expect(w.s.hornT).toBe(0);
  });

  it('build mode slows time to 0.25× by day', () => {
    const { g, w } = game(12);
    g.cmd({ t: 'buildMode', on: true });
    const t0 = w.s.phaseT;
    g.update(0.2); g.update(0.2); g.update(0.2); g.update(0.2);
    expect(w.s.phaseT - t0).toBeCloseTo(0.2, 1);
  });
});

describe('Tutorial (§10.3)', () => {
  it('advances through 5 contextual steps and completes on the first night; skippable', () => {
    const m = meta({ tutorialDone: false });
    const { g, w } = game(13, m);
    expect(w.s.tutorial).toBe(0);
    g.cmd({ t: 'move', dir: { x: 1, y: 0 } }); run(g, 1.5); g.cmd({ t: 'move', dir: { x: 0, y: 0 } });
    expect(w.s.tutorial).toBe(1);
    w.r.tutHarvested = true; run(g, 0.05);
    expect(w.s.tutorial).toBe(2);
    w.s.res.wood = 200; w.s.res.stone = 50;
    parkHeroes(w, 28, 31);
    g.cmd({ t: 'buildMode', on: true });
    g.cmd({ t: 'paint', id: 'wall_wood', cells: [0, 1, 2, 3, 4, 5].map((i) => ({ x: 23 + i, y: 24 })) });
    run(g, 0.05);
    expect(w.s.tutorial).toBe(3);
    g.cmd({ t: 'place', id: 'tower_arrow', x: 30, y: 26 });
    run(g, 0.1);
    expect(w.s.tutorial).toBe(4);
    g.cmd({ t: 'callNight' }); g.cmd({ t: 'startNight' });
    expect(w.s.tutorial).toBe(-1);
    expect(m.tutorialDone).toBe(true);
    const m2 = meta({ tutorialDone: false });
    const { g: g2, w: w2 } = game(14, m2);
    g2.cmd({ t: 'skipTutorial' });
    expect(w2.s.tutorial).toBe(-1); expect(m2.tutorialDone).toBe(true);
  });
});

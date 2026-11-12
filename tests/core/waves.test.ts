import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../assets/scripts/core/data/balance';
import { ENEMIES } from '../../assets/scripts/core/data/enemies';
import { nightBudget, planNight, riftsActive } from '../../assets/scripts/core/sim/Spawner';
import { flat, game } from './helpers';
import type { World } from '../../assets/scripts/core/sim/World';

function plan(w: World, n: number, cut: number[] = []) {
  w.s.night = n; w.r.rootCut = cut; planNight(w);
  return { plan: w.r.spawn.slice(), omens: w.s.omens.slice() };
}
const cost = (e: { enemy: string; elite: boolean }) => ENEMIES[e.enemy as keyof typeof ENEMIES].cost * (e.elite ? 2.5 : 1);

describe('Waves (§8)', () => {
  it('budget B(n) = 40 + 28n + 4n²; endless ×1.18 per night', () => {
    expect(nightBudget(1)).toBe(72); expect(nightBudget(5)).toBe(280); expect(nightBudget(10)).toBe(720);
    expect(nightBudget(12)).toBeCloseTo(720 * 1.18 * 1.18);
    expect([1, 2, 3, 5, 6, 8, 9, 10].map(riftsActive)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('spends the budget, only uses introduced types, debut type ≥ 25%, boss nights = boss + 60%', () => {
    const { w } = flat();
    for (let n = 1; n <= 10; n++) {
      const { plan: p } = plan(w, n);
      const spent = p.filter((e) => !ENEMIES[e.enemy].boss).reduce((a, e) => a + cost(e), 0);
      const B = nightBudget(n) * (n === 5 || n === 10 ? 0.6 : 1);
      expect(spent, `night ${n}`).toBeLessThanOrEqual(B + 1e-6);
      expect(spent, `night ${n}`).toBeGreaterThan(B * 0.85);
      for (const e of p) expect(ENEMIES[e.enemy].firstNight).toBeLessThanOrEqual(n);
      const debut = (['gloomling', 'skitter', 'spitter', 'brute', 'wisp', 'bomber', 'snuffer'] as const).find((id) => ENEMIES[id].firstNight === n);
      if (debut) expect(p.filter((e) => e.enemy === debut).reduce((a, e) => a + cost(e), 0)).toBeGreaterThanOrEqual(0.25 * B - 1e-6);
      if (n === 5) expect(p.filter((e) => e.enemy === 'mossback').length).toBe(1);
      if (n === 10) expect(p.filter((e) => e.enemy === 'unlit').length).toBe(1);
    }
  });

  it('elites from night 9 only, ≤ 15% of budget', () => {
    const { w } = flat();
    for (let n = 1; n <= 8; n++) expect(plan(w, n).plan.some((e) => e.elite)).toBe(false);
    for (const n of [9, 10]) {
      const p = plan(w, n).plan;
      const B = nightBudget(n) * (n === 10 ? 0.6 : 1);
      const eb = p.filter((e) => e.elite).reduce((a, e) => a + cost(e), 0);
      expect(eb).toBeGreaterThan(0);
      expect(eb).toBeLessThanOrEqual(0.15 * B + 1e-6);
    }
  });

  it('per-rift split in [0.6,1.4], pulses inside the window, last pulse holds the most expensive unit', () => {
    const { w } = flat();
    const { plan: p } = plan(w, 6);
    const W = BALANCE.night.spawnWindow(6);
    const rifts = new Set(p.map((e) => e.rift));
    expect(rifts.size).toBe(3);
    const tot = p.reduce((a, e) => a + cost(e), 0);
    for (const r of rifts) {
      const share = p.filter((e) => e.rift === r).reduce((a, e) => a + cost(e), 0) / tot;
      expect(share).toBeGreaterThan(0.6 / 3.4 - 0.05);
      expect(share).toBeLessThan(1.4 / 2.6 + 0.05);
      const mine = p.filter((e) => e.rift === r);
      const lastT = Math.max(...mine.map((e) => e.t));
      const maxCost = Math.max(...mine.map(cost));
      expect(mine.filter((e) => e.t >= lastT - 2).some((e) => cost(e) === maxCost)).toBe(true);
      for (const e of mine) expect(e.t).toBeLessThanOrEqual(W + 3);
    }
  });

  it('omens are deterministic from seed + night and match the spawn plan; a destroyed root cuts that rift by 30%', () => {
    const { w } = game(55);
    const a = plan(w, 4), b = plan(w, 4);
    expect(a.omens).toEqual(b.omens);
    const total = (o: typeof a.omens) => o.reduce((s, e) => s + e.count, 0);
    expect(total(a.omens)).toBe(a.plan.length);
    const r0 = (p: typeof a.plan, r: number) => p.filter((e) => e.rift === r).reduce((s, e) => s + cost(e), 0);
    const cut = plan(w, 4, [0]);
    expect(r0(cut.plan, 0)).toBeLessThan(r0(a.plan, 0) * 0.72 + 4);
    expect(r0(cut.plan, 0)).toBeGreaterThan(r0(a.plan, 0) * 0.6 - 4);
    const { w: w2 } = game(56);
    expect(plan(w2, 4).omens).not.toEqual(a.omens);
  });

  it('a real night spawns everything from the active rifts and ends at dawn when all are dead', () => {
    const { g, w } = game(31);
    g.cmd({ t: 'callNight' });
    expect(w.s.phase).toBe('dusk');
    expect(w.s.timeScale).toBe(0);
    expect(w.s.omens.length).toBeGreaterThan(0);
    g.cmd({ t: 'startNight' });
    const n0 = w.r.spawn.length;
    let maxWave = 0;
    for (let i = 0; i < 30 * 60; i++) { g.step(); maxWave = Math.max(maxWave, w.s.enemies.filter((e) => (e as { wave: boolean }).wave).length); }
    expect(w.r.spawnIdx).toBe(n0);
    expect(maxWave).toBeGreaterThan(5);
    for (const e of w.s.enemies) if ((e as { wave: boolean }).wave) (e as { dead: boolean }).dead = true;
    g.step(); g.step();
    expect(w.s.phase).toBe('dawn');
  });
});

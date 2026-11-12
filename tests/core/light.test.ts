import { describe, expect, it } from 'vitest';
import { smoothLightAlpha, LIGHT_ALPHA } from '../../assets/scripts/core/sim/Light';
import { startDusk } from '../../assets/scripts/core/sim/Phases';
import { addB, addE, flat, hero, night, parkHeroes, refresh, removeGift, run, setRes, C } from './helpers';

describe('Light (§5)', () => {
  it('rule 1: build only on statically lit tiles; braziers also on dim; the lantern does not count', () => {
    const { g, w } = flat();
    removeGift(w);
    setRes(w, 500, 500, 500);
    expect(g.canPlace('tower_arrow', 30, 28).ok).toBe(true);
    expect(w.staticLight[28 * 56 + 35]).toBe(1); // dim band 7..8.5
    expect(g.canPlace('tower_arrow', 35, 28).reason).toBe('dark');
    expect(g.canPlace('brazier', 35, 28).ok).toBe(true);
    expect(g.canPlace('wall_wood', 45, 28).reason).toBe('dark');
    const h = hero(w); h.x = 45.5; h.y = 30.5;
    run(g, 0.1);
    expect(w.s.map.light[28 * 56 + 45]).toBe(2); // lantern lights it…
    expect(g.canPlace('wall_wood', 45, 28).reason).toBe('dark'); // …but it is not static light
    // brazier chain extends territory
    g.cmd({ t: 'place', id: 'brazier', x: 35, y: 28 });
    expect(g.canPlace('tower_arrow', 38, 28).ok).toBe(true);
  });

  it('rule 2: at night towers ignore enemies in the dark; veiled enemies move 25% faster', () => {
    const { g, w } = flat();
    removeGift(w);
    const t = addB(w, 'tower_arrow', 34, 28);
    night(w); parkHeroes(w);
    const e = addE(w, 'gloomling', 38.9, 28.5);
    e.status.stun = 1000;
    run(g, 0.2);
    expect(e.status.veiled).toBe(true);
    let shots = 0;
    for (let i = 0; i < 60; i++) { g.step(); shots += g.drainEvents().filter((x) => x.t === 'shoot' && x.from === t.uid).length; }
    expect(shots).toBe(0);
    addB(w, 'brazier', 39, 31);
    run(g, 0.1);
    expect(e.status.veiled).toBe(false);
    for (let i = 0; i < 60; i++) { g.step(); shots += g.drainEvents().filter((x) => x.t === 'shoot' && x.from === t.uid).length; }
    expect(shots).toBeGreaterThan(0);
    // speed: veiled vs lit
    const { g: g2, w: w2 } = flat(); removeGift(w2); night(w2); parkHeroes(w2);
    const dark = addE(w2, 'gloomling', 45.5, 10.5); const lit = addE(w2, 'gloomling', 33.5, 28.5);
    const d0 = Math.hypot(dark.x - C, dark.y - C), l0 = Math.hypot(lit.x - C, lit.y - C);
    run(g2, 1);
    const dd = d0 - Math.hypot(dark.x - C, dark.y - C), ld = l0 - Math.hypot(lit.x - C, lit.y - C);
    expect(dark.status.veiled).toBe(true);
    expect(dd / ld).toBeGreaterThan(1.15);
  });

  it('rule 3: each brazier burns 1 wood at dusk; unfuelled braziers stay dark (nearest first)', () => {
    const { w } = flat();
    removeGift(w);
    const near = addB(w, 'brazier', 33, 28), far = addB(w, 'brazier', 36, 28);
    setRes(w, 1, 0, 0);
    startDusk(w);
    expect(w.s.res.wood).toBe(0);
    expect(near.fueled).toBe(true);
    expect(far.fueled).toBe(false);
    w.s.phase = 'night'; refresh(w);
    expect(far.lit).toBe(false);
    expect(near.lit).toBe(true);
    expect(w.staticLight[28 * 56 + 40]).toBe(0);
  });

  it('rule 4: a snuffed brazier goes dark; a hero standing next to it for 2 s relights it', () => {
    const { g, w } = flat();
    removeGift(w);
    const b = addB(w, 'brazier', 38, 28);
    const t = addB(w, 'tower_arrow', 34, 28);
    night(w); parkHeroes(w);
    b.snuffed = true; refresh(w);
    expect(b.lit).toBe(false);
    const e = addE(w, 'gloomling', 39.5, 30.5); e.status.stun = 1000;
    let shots = 0;
    for (let i = 0; i < 45; i++) { g.step(); shots += g.drainEvents().filter((x) => x.t === 'shoot' && x.from === t.uid).length; }
    expect(shots).toBe(0); // the tower still exists but cannot see out there
    const h = hero(w); h.x = 38.5; h.y = 29.6;
    run(g, 1);
    expect(b.lit).toBe(false);
    run(g, 1.2);
    expect(b.lit).toBe(true);
    expect(b.snuffed).toBe(false);
  });

  it('overlay alpha: lit 0 / dim 0.45 / dark 0.85 at night, fog 1, day 0; fades over ~3 s', () => {
    const { g, w } = flat();
    removeGift(w);
    parkHeroes(w, 37, 30);
    run(g, 0.2);
    parkHeroes(w, 28, 31);
    run(g, 0.2);
    smoothLightAlpha(w, 10);
    const A = w.s.map.lightAlpha;
    expect(A[28 * 56 + 30]).toBe(0);          // explored, day
    expect(A[5 * 56 + 5]).toBe(LIGHT_ALPHA.fog); // never seen
    night(w); parkHeroes(w, 6, 50); run(g, 0.1);
    smoothLightAlpha(w, 1);
    expect(A[28 * 56 + 37]).toBeGreaterThan(0.2); // fading in
    expect(A[28 * 56 + 37]).toBeLessThan(LIGHT_ALPHA.dark);
    smoothLightAlpha(w, 5);
    expect(A[28 * 56 + 29]).toBe(LIGHT_ALPHA.lit);
    expect(A[28 * 56 + 35]).toBeCloseTo(LIGHT_ALPHA.dim, 5);
    expect(A[28 * 56 + 37]).toBeCloseTo(LIGHT_ALPHA.dark, 5);
    expect(w.s.map.explored[28 * 56 + 30]).toBe(1);
  });
});

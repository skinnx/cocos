import { describe, expect, it } from 'vitest';
import { damageEnemy } from '../../assets/scripts/core/sim/Combat';
import { updateSynergies, SYN } from '../../assets/scripts/core/sim/Economy';
import { towerRange } from '../../assets/scripts/core/sim/Towers';
import { addB, addE, flat, hero, night, parkHeroes, run } from './helpers';
import type { GameEvent } from '../../assets/scripts/core/api';

function shotsFrom(g: { step(): void; drainEvents(): GameEvent[] }, uid: number, steps: number): number {
  let n = 0;
  for (let i = 0; i < steps; i++) { g.step(); n += g.drainEvents().filter((e) => e.t === 'shoot' && e.from === uid).length; }
  return n;
}

describe('Synergies (§6.4)', () => {
  it('flame arrows: arrow tower within 2 of a burning brazier sets enemies on fire and ignites tar', () => {
    const { g, w } = flat();
    const t = addB(w, 'tower_arrow', 30, 26); // gift brazier at (31,28)
    const far = addB(w, 'tower_arrow', 24, 24);
    updateSynergies(w);
    expect(t.synergies).toContain('flame');
    expect(far.synergies).not.toContain('flame');
    const tar = addB(w, 'trap_tar', 33, 24);
    night(w); parkHeroes(w);
    const e = addE(w, 'brute', 33.5, 24.5); e.status.stun = 100;
    run(g, 3);
    expect(e.status.burn).toBeGreaterThan(0);
    expect(tar.lit).toBe(true); // ignited
  });

  it('shatter: impact on a frost-slowed enemy deals +50%', () => {
    const { g, w } = flat();
    night(w); parkHeroes(w);
    const a = addE(w, 'brute', 40.5, 20.5), b = addE(w, 'brute', 40.5, 40.5);
    a.status.stun = b.status.stun = 100;
    addB(w, 'tower_frost', 40, 22);
    run(g, 0.2);
    expect(a.frostT).toBeGreaterThan(0);
    g.drainEvents();
    const da = damageEnemy(w, a, 20, 'impact', { src: 'tower' });
    const db = damageEnemy(w, b, 20, 'impact', { src: 'tower' });
    expect(da).toBe(Math.round(db * 1.5));
    expect(g.drainEvents().some((e) => e.t === 'hit' && e.shatter)).toBe(true);
  });

  it('wall-embedded: a tower touching walls on ≥2 sides gets +1 range', () => {
    const { w } = flat();
    const t = addB(w, 'tower_arrow', 30, 24);
    const r0 = towerRange(w, t);
    addB(w, 'wall_wood', 29, 24);
    updateSynergies(w);
    expect(t.synergies).not.toContain('embedded');
    addB(w, 'wall_wood', 30, 23);
    updateSynergies(w);
    expect(t.synergies).toContain('embedded');
    expect(towerRange(w, t)).toBe(r0 + 1);
  });

  it('rally: towers within 3 of the leader fire 25% faster', () => {
    const { g, w } = flat();
    const t = addB(w, 'tower_arrow', 24, 24);
    night(w);
    const e = addE(w, 'brute', 24.5, 20.5); e.status.stun = 1000; e.hp = e.maxHp = 1e6;
    parkHeroes(w, 40, 40);
    const slow = shotsFrom(g, t.uid, 600);
    const h = hero(w); h.x = 25.5; h.y = 25.5;
    run(g, 0.1);
    expect(t.synergies).toContain('rally');
    const fast = shotsFrom(g, t.uid, 600);
    expect(fast / slow).toBeGreaterThan(1.18);
    expect(fast / slow).toBeLessThan(1.32);
  });

  it('tar + spikes: slowed enemies take double spike damage', () => {
    const { g, w } = flat();
    const s1 = addB(w, 'trap_spikes', 40, 20);
    addB(w, 'trap_tar', 41, 20);
    const s2 = addB(w, 'trap_spikes', 40, 40);
    updateSynergies(w);
    expect(s1.synMask & SYN.tarSpike).toBeTruthy();
    expect(s2.synMask & SYN.tarSpike).toBeFalsy();
    night(w); parkHeroes(w);
    const a = addE(w, 'gloomling', 39.5, 20.5), b = addE(w, 'gloomling', 39.5, 40.5);
    a.slowAmt = b.slowAmt = 0.5; a.slowT = b.slowT = 100;
    a.x = 40.5; b.x = 40.5; // step onto the spikes
    a.hp = b.hp = 500;
    a.status.stun = b.status.stun = 100;
    run(g, 0.1);
    expect(500 - a.hp).toBe(2 * (500 - b.hp));
    expect(500 - b.hp).toBe(10);
  });
});

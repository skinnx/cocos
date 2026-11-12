import { describe, it, expect } from 'vitest';
import { createGame, defaultMeta, worldOf } from '../../assets/scripts/core/sim/Game';
import { BALANCE } from '../../assets/scripts/core/data/balance';

describe('regressions from the SPEC audit', () => {
  it('a building placed at night ends construction at (near) full HP', () => {
    const g = createGame({ seed: 3, meta: defaultMeta() });
    g.cmd({ t: 'skipTutorial' });
    const s = g.state, h = s.buildings.find((b) => b.uid === s.hearthUid)!;
    s.res.wood += 500; s.res.stone += 500;
    while (s.phase !== 'night') { if (s.phase === 'day') g.cmd({ t: 'callNight' }); if (s.phase === 'dusk') g.cmd({ t: 'startNight' }); g.step(); }
    let spot: { x: number; y: number } | null = null;
    for (let dy = -4; dy <= 4 && !spot; dy++) for (let dx = -4; dx <= 4 && !spot; dx++) if (g.canPlace('wall_stone', h.x + dx, h.y + dy).ok) spot = { x: h.x + dx, y: h.y + dy };
    expect(spot).not.toBeNull();
    g.cmd({ t: 'place', id: 'wall_stone', x: spot!.x, y: spot!.y });
    g.step();
    const b = s.buildings.find((q) => q.id === 'wall_stone' && q.x === spot!.x && q.y === spot!.y)!;
    expect(b.constructing).toBeGreaterThan(0);
    expect(b.hp).toBeLessThan(b.maxHp);
    for (let i = 0; i < Math.ceil(BALANCE.build.nightBuildDelay * 30) + 5; i++) g.step();
    expect(b.constructing).toBe(0);
    expect(b.hp).toBeGreaterThanOrEqual(b.maxHp - 1);
  });

  it('horn needs the full charge from BALANCE (UI must scale by it)', () => {
    const g = createGame({ seed: 4, meta: defaultMeta() });
    g.cmd({ t: 'skipTutorial' });
    g.state.hornCharge = BALANCE.horn.charge - 1; g.cmd({ t: 'horn' }); g.step();
    expect(g.state.hornT).toBe(0);
    g.state.hornCharge = BALANCE.horn.charge; g.cmd({ t: 'horn' }); g.step();
    expect(g.state.hornT).toBeGreaterThan(0);
    void worldOf;
  });
});

import { describe, expect, it } from 'vitest';
import { createGame, isValidRun } from '../../assets/scripts/core/sim/Game';
import { BaselineBot } from '../../assets/scripts/core/bots';
import { meta } from './helpers';

function advanceTo(g: ReturnType<typeof createGame>, pred: () => boolean, max = 100000) {
  for (let i = 0; i < max && !pred(); i++) { BaselineBot(g); g.step(); }
}

describe('Save / load (§11.3)', () => {
  it('round trip at DAWN: identical state hash, identical future', () => {
    const m = meta();
    const a = createGame({ seed: 4242, meta: m });
    advanceTo(a, () => a.state.phase === 'dawn' && a.state.night === 2);
    expect(a.state.phase).toBe('dawn');
    const snap = a.saveRun();
    expect(isValidRun(snap)).toBe(true);
    const b = createGame({ seed: 1, meta: m, saved: snap });
    expect(b.state.seed).toBe(4242);
    expect(b.hash()).toBe(a.hash());
    expect(b.saveRun()).toBe(snap);
    expect(b.state.boonOffer?.map((x) => x.id)).toEqual(a.state.boonOffer?.map((x) => x.id));
    // same command stream from here on (bots keep private per-game memory, so drive both identically)
    const drive = (g: typeof a) => { g.cmd({ t: 'pickBoon', index: 1 }); for (let i = 0; i < 30 * 40; i++) { g.cmd({ t: 'move', dir: { x: Math.sin(i / 50), y: Math.cos(i / 70) } }); g.step(); } g.cmd({ t: 'callNight' }); g.cmd({ t: 'startNight' }); for (let i = 0; i < 30 * 40; i++) g.step(); };
    drive(a); drive(b);
    expect(a.state.phase).toBe('night');
    expect(b.hash()).toBe(a.hash());
    expect(b.state.night).toBe(a.state.night);
  });

  it('round trip mid-NIGHT continues identically (fields restored from saved path HP)', () => {
    const m = meta();
    const a = createGame({ seed: 99, meta: m });
    advanceTo(a, () => a.state.phase === 'night' && a.state.night === 2 && a.state.nightT > 20);
    const b = createGame({ seed: 99, meta: m, saved: a.saveRun() });
    expect(b.hash()).toBe(a.hash());
    for (let i = 0; i < 30 * 30; i++) { a.step(); b.step(); }
    expect(b.hash()).toBe(a.hash());
  });

  it('snapshot contains run essentials and corrupt data falls back to a new run', () => {
    const g = createGame({ seed: 5, meta: meta() });
    const o = JSON.parse(g.saveRun());
    expect(o.version).toBe(1);
    for (const k of ['seed', 'night', 'res', 'buildings', 'heroes', 'boons', 'pois', 'nodes']) expect(o.s).toHaveProperty(k);
    const bad = createGame({ seed: 77, meta: meta(), saved: '{"version":1,"s":{"seed":3}' });
    expect(bad.state.seed).toBe(77);
    expect(bad.state.night).toBe(1);
    const wrongVer = createGame({ seed: 78, meta: meta(), saved: JSON.stringify({ ...o, version: 9 }) });
    expect(wrongVer.state.seed).toBe(78);
    expect(isValidRun('nonsense')).toBe(false);
    expect(isValidRun(null)).toBe(false);
  });
});

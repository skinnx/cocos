import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createGame } from '../../assets/scripts/core/sim/Game';
import { BaselineBot } from '../../assets/scripts/core/bots';
import { mulberry32Next, Rng } from '../../assets/scripts/core/sim/Rng';
import { meta } from './helpers';

function play(seed: number, nights: number): string[] {
  const g = createGame({ seed, meta: meta() });
  const hashes: string[] = [];
  let guard = 0;
  while (g.state.night <= nights && guard++ < 200000 && g.state.phase !== 'defeat') {
    const before = g.state.phase;
    BaselineBot(g);
    g.step();
    if (before !== g.state.phase && g.state.phase === 'dawn') hashes.push(g.hash());
  }
  hashes.push(g.hash());
  return hashes;
}

describe('determinism', () => {
  it('same seed + same bot → same hash after 3 nights', () => {
    const a = play(777, 3), b = play(777, 3);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a).toEqual(b);
  });
  it('different seeds diverge', () => {
    expect(play(778, 1)).not.toEqual(play(779, 1));
  });
  it('mulberry32 is the RNG and is reproducible', () => {
    const st = { s: 1 };
    const seq = [mulberry32Next(st), mulberry32Next(st), mulberry32Next(st)];
    const r = new Rng(1);
    expect([r.next(), r.next(), r.next()]).toEqual(seq);
    expect(seq[0]).toBeCloseTo(0.6270739405881613, 12);
  });
  it('update(dt) uses fixed steps and alpha() in [0,1)', () => {
    const g = createGame({ seed: 3, meta: meta() });
    const h0 = g.state.heroes[0].x;
    g.cmd({ t: 'move', dir: { x: 1, y: 0 } });
    g.update(0.05);
    expect(g.alpha()).toBeGreaterThanOrEqual(0);
    expect(g.alpha()).toBeLessThan(1);
    g.update(0.5);
    expect(g.state.heroes[0].x).toBeGreaterThan(h0);
  });
});

describe('core purity', () => {
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } };
  walk(join(__dirname, '../../assets/scripts/core'));
  it('no cc import, no Math.random, no Date under core/', () => {
    expect(files.length).toBeGreaterThan(15);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(/from\s+['"]cc['"]/.test(src), f).toBe(false);
      expect(/Math\.random\s*\(/.test(src), f).toBe(false);
      expect(/\bDate\s*\.|new Date\b/.test(src), f).toBe(false);
      expect(/\bTODO\b|\bstub\b/i.test(src), f).toBe(false);
    }
  });
});

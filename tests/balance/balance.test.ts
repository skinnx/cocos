// SPEC §13.6 balance gates (run with `npm run sim:balance`): 30 seeds per bot.
//   NoBuildBot  — loses before or during night 4 on ≥ 90% of seeds.
//   BaselineBot — survives night 5 on ≥ 70% of seeds, wins night 10 on ≤ 35% of seeds.
//   No night lasts longer than 150 s.
// Games run in parallel worker threads from an esbuild bundle of the core (same code, same determinism).
import { describe, expect, it, beforeAll } from 'vitest';
import { buildSync } from 'esbuild';
import { Worker } from 'node:worker_threads';
import { availableParallelism, tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SEEDS = Array.from({ length: 30 }, (_, i) => 1000 + i * 7919);
interface R { bot: string; seed: number; outcome: 'victory' | 'defeat' | 'timeout'; night: number; nightsSurvived: number; maxNightSeconds: number }

let results: R[] = [];

async function runAll(jobs: Array<{ bot: string; seed: number }>): Promise<R[]> {
  const dir = mkdtempSync(join(tmpdir(), 'emberhold-balance-'));
  const bundle = join(dir, 'core.mjs');
  buildSync({ entryPoints: [resolve(__dirname, '../../assets/scripts/core/bots/index.ts')], bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'silent' });
  const n = Math.max(1, Math.min(8, availableParallelism()));
  const queue = jobs.slice();
  const out: R[] = [];
  await Promise.all(Array.from({ length: n }, () => new Promise<void>((done, fail) => {
    const wk = new Worker(resolve(__dirname, 'worker.mjs'), { workerData: { bundle: pathToFileURL(bundle).href } });
    const next = () => { const j = queue.shift(); if (j) wk.postMessage(j); else { wk.postMessage(null); } };
    wk.on('message', (m) => { if (m.ready) return next(); out.push(m as R); next(); });
    wk.on('error', fail);
    wk.on('exit', () => done());
  })));
  return out;
}

const pct = (xs: R[], f: (r: R) => boolean) => xs.filter(f).length / xs.length;

describe('balance gates (§13.6)', () => {
  beforeAll(async () => {
    results = await runAll([...SEEDS.map((seed) => ({ bot: 'nobuild', seed })), ...SEEDS.map((seed) => ({ bot: 'baseline', seed }))]);
    const fmt = (b: string) => results.filter((r) => r.bot === b).sort((a, c) => a.seed - c.seed).map((r) => `${r.outcome[0]}${r.night}`).join(' ');
    console.log(`NoBuildBot : ${fmt('nobuild')}\nBaselineBot: ${fmt('baseline')}`);
  }, 600000);

  it('NoBuildBot loses by night 4 on ≥ 90% of seeds', () => {
    const nb = results.filter((r) => r.bot === 'nobuild');
    expect(nb.length).toBe(30);
    const p = pct(nb, (r) => r.outcome === 'defeat' && r.night <= 4);
    console.log(`NoBuildBot lost by night 4: ${(p * 100).toFixed(0)}%`);
    expect(p).toBeGreaterThanOrEqual(0.9);
  });

  it('BaselineBot survives night 5 on ≥ 70% and wins on ≤ 35% of seeds', () => {
    const b = results.filter((r) => r.bot === 'baseline');
    expect(b.length).toBe(30);
    const pass5 = pct(b, (r) => r.nightsSurvived >= 5), win = pct(b, (r) => r.outcome === 'victory');
    console.log(`BaselineBot survived night 5: ${(pass5 * 100).toFixed(0)}%, won: ${(win * 100).toFixed(0)}%`);
    expect(b.every((r) => r.outcome !== 'timeout')).toBe(true);
    expect(pass5).toBeGreaterThanOrEqual(0.7);
    expect(win).toBeLessThanOrEqual(0.35);
  });

  it('no night lasts longer than 150 s', () => {
    const worst = Math.max(...results.map((r) => r.maxNightSeconds));
    console.log(`longest night: ${worst.toFixed(1)} s`);
    expect(worst).toBeLessThanOrEqual(150);
  });
});

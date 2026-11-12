import { describe, expect, it } from 'vitest';
import { DIRS, maybeRecomputeFields, recomputeFields } from '../../assets/scripts/core/sim/FlowField';
import { damageBuilding } from '../../assets/scripts/core/sim/Combat';
import { addB, addE, flat, followField, night, parkHeroes, refresh, run } from './helpers';
import type { World } from '../../assets/scripts/core/sim/World';

function ring(w: World, weak?: { x: number; y: number }) {
  for (let x = 23; x <= 32; x++) for (const y of [23, 32]) addB(w, weak && weak.x === x && weak.y === y ? 'wall_wood' : 'wall_stone', x, y);
  for (let y = 24; y <= 31; y++) for (const x of [23, 32]) addB(w, weak && weak.x === x && weak.y === y ? 'wall_wood' : 'wall_stone', x, y);
  refresh(w);
}
const isHearth = (w: World, c: number) => w.bldAt[c] === w.hearth.uid;

describe('FlowField (§7.4)', () => {
  it('walks around a wall when there is an opening', () => {
    const { w } = flat();
    for (let y = 20; y <= 36; y++) addB(w, 'wall_stone', 35, y);
    const path = followField(w, 45, 28);
    expect(isHearth(w, path[path.length - 1])).toBe(true);
    expect(path.slice(0, -1).some((c) => w.bldAt[c])).toBe(false);
    expect(path.some((c) => Math.floor(c / 56) < 20 || Math.floor(c / 56) > 36)).toBe(true);
  });

  it('breaches the weakest wall when fully enclosed (walling in is legal)', () => {
    const { w } = flat();
    ring(w, { x: 32, y: 26 });
    for (const [sx, sy] of [[45, 28], [40, 40], [38, 16], [45, 10]]) {
      const path = followField(w, sx, sy);
      const hit = w.bmap.get(w.bldAt[path[path.length - 1]])!;
      expect(hit.id, `from ${sx},${sy}`).toBe('wall_wood');
    }
  });

  it('brutes (breacher field) prefer breaking walls where others walk around', () => {
    const { w } = flat();
    for (let y = 14; y <= 42; y++) addB(w, 'wall_stone', 35, y);
    const def = followField(w, 45, 28, 'def');
    const brk = followField(w, 45, 28, 'brk');
    expect(def.slice(0, -1).some((c) => w.bldAt[c])).toBe(false);
    expect(w.bmap.get(w.bldAt[brk[brk.length - 1]])!.id).toBe('wall_stone');
  });

  it('recomputes when a wall breaks or HP drops ≥20% (throttled ≤ 5/s), and repairs change paths', () => {
    const { w } = flat();
    ring(w, { x: 32, y: 26 });
    const out = 26 * 56 + 40;
    const d0 = w.fields.def.dist[out];
    const wood = w.bmap.get(w.bldAt[26 * 56 + 32])!;
    damageBuilding(w, wood, 30);
    expect(w.r.fieldDirty).toBe(true);
    w.r.stepN = w.r.fieldLastStep + 1;
    maybeRecomputeFields(w);
    expect(w.r.fieldDirty).toBe(true); // throttled
    w.r.stepN = w.r.fieldLastStep + 6;
    maybeRecomputeFields(w);
    expect(w.r.fieldDirty).toBe(false);
    const d1 = w.fields.def.dist[out];
    expect(d1).toBeLessThan(d0);
    damageBuilding(w, wood, 100); // destroyed
    w.r.stepN += 6; maybeRecomputeFields(w);
    const path = followField(w, 40, 26);
    expect(isHearth(w, path[path.length - 1])).toBe(true);
    expect(w.fields.def.dist[out]).toBeLessThan(d1);
  });

  it('8 directions without corner cutting', () => {
    const { w } = flat();
    ring(w, { x: 32, y: 26 });
    addB(w, 'wall_stone', 40, 20); addB(w, 'wall_stone', 41, 21);
    recomputeFields(w);
    const f = w.fields.def, n = 56;
    let diag = 0;
    for (let c = 0; c < n * n; c++) {
      const nx = f.next[c]; if (nx < 0) continue;
      const dx = (nx % n) - (c % n), dy = Math.floor(nx / n) - Math.floor(c / n);
      expect(DIRS.some((d) => d[0] === dx && d[1] === dy)).toBe(true);
      if (dx && dy) {
        diag++;
        const o1 = Math.floor(c / n) * n + (nx % n), o2 = Math.floor(nx / n) * n + (c % n);
        expect(w.bldAt[o1] || w.terrain[o1]).toBeFalsy();
        expect(w.bldAt[o2] || w.terrain[o2]).toBeFalsy();
      }
    }
    expect(diag).toBeGreaterThan(100);
  });

  it('a gloomling actually attacks the weak wall, not the stone ones', () => {
    const { g, w } = flat();
    ring(w, { x: 32, y: 26 });
    night(w);
    parkHeroes(w);
    const e = addE(w, 'gloomling', 40.5, 26.5);
    const wood = w.bmap.get(w.bldAt[26 * 56 + 32])!;
    run(g, 12);
    expect(wood.hp).toBeLessThan(wood.maxHp);
    for (const b of w.s.buildings) if (b.id === 'wall_stone') expect(b.hp).toBe(b.maxHp);
    expect(e.targetUid).toBe(wood.uid);
  });

  it('tar and spikes add path cost', () => {
    const { w } = flat();
    const before = w.fields.def.dist[28 * 56 + 40];
    for (let y = 2; y < 54; y++) addB(w, 'trap_tar', 36, y);
    expect(w.fields.def.dist[28 * 56 + 40]).toBeCloseTo(before + 1.5, 5);
  });
});

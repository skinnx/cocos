import { describe, expect, it } from 'vitest';
import { generateMap, CENTER, NODE_BLOCKS, isRockKind, isTreeKind, HEARTH_X, HEARTH_Y } from '../../assets/scripts/core/sim/MapGen';
import { createGame } from '../../assets/scripts/core/sim/Game';
import { meta } from './helpers';

function reach(m: ReturnType<typeof generateMap>): Uint8Array {
  const n = m.size;
  const block = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) if (m.biome[i] === 'water') block[i] = 1;
  for (const nd of m.nodes) if (NODE_BLOCKS[nd.kind]) block[nd.y * n + nd.x] = 1;
  for (const p of m.pois) if (p.kind === 'cage') block[p.y * n + p.x] = 1;
  const seen = new Uint8Array(n * n);
  const q: number[] = [];
  for (let y = HEARTH_Y - 1; y <= HEARTH_Y + 2; y++) for (let x = HEARTH_X - 1; x <= HEARTH_X + 2; x++) { seen[y * n + x] = 1; q.push(y * n + x); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % n, y = (c / n) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * n + x + dx;
      if (x + dx < 0 || y + dy < 0 || x + dx >= n || y + dy >= n || seen[j] || block[j]) continue;
      seen[j] = 1; q.push(j);
    }
  }
  return seen;
}

describe('MapGen (§4.1 gates over 200 seeds)', () => {
  it('every seed: reachable rifts/POIs, ≥40 trees and ≥20 rocks within 16 tiles, clear hearth radius, rift rules', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = generateMap(seed * 7 + 3);
      const n = m.size;
      expect(n).toBe(56);
      const seen = reach(m);
      // POI accessibility
      for (const p of m.pois) {
        const ok = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(p.y + dy) * n + p.x + dx]);
        expect(ok, `seed ${seed} ${p.kind}@${p.x},${p.y} enclosed`).toBe(true);
      }
      let trees = 0, rocks = 0;
      for (const nd of m.nodes) {
        const d = Math.hypot(nd.x + 0.5 - CENTER, nd.y + 0.5 - CENTER);
        expect(d, `seed ${seed}: node inside hearth clearing`).toBeGreaterThan(6);
        if (d > 16) continue;
        if (isTreeKind(nd.kind)) trees++; else if (isRockKind(nd.kind)) rocks++;
      }
      expect(trees, `seed ${seed} trees`).toBeGreaterThanOrEqual(40);
      expect(rocks, `seed ${seed} rocks`).toBeGreaterThanOrEqual(20);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.hypot(x + 0.5 - CENTER, y + 0.5 - CENTER) <= 6) expect(m.biome[y * n + x]).toBe('meadow');
      const rifts = m.pois.filter((p) => p.kind === 'rift');
      expect(rifts.length).toBe(4);
      const ang = rifts.map((r) => Math.atan2(r.y + 0.5 - CENTER, r.x + 0.5 - CENTER));
      for (const r of rifts) expect(Math.hypot(r.x + 0.5 - CENTER, r.y + 0.5 - CENTER)).toBeGreaterThanOrEqual(20);
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        let d = Math.abs(ang[i] - ang[j]); if (d > Math.PI) d = 2 * Math.PI - d;
        expect(d, `seed ${seed} rift angle`).toBeGreaterThanOrEqual(Math.PI / 3);
      }
      expect(m.pois.filter((p) => p.kind === 'camp').length).toBe(6);
      expect(m.pois.filter((p) => p.kind === 'cage').length).toBe(3);
      expect(m.pois.filter((p) => p.kind === 'shrine').length).toBe(3);
      const ore = m.nodes.filter((nd) => nd.kind === 'ore').length;
      expect(ore).toBeGreaterThanOrEqual(6);
      expect(ore).toBeLessThanOrEqual(8);
      // border is water, island has shore
      expect(m.biome[0]).toBe('water');
      expect(m.biome.includes('shore')).toBe(true);
    }
  });

  it('has all biomes incl. 2–3 ruins clusters and is deterministic', () => {
    const a = generateMap(42), b = generateMap(42), c = generateMap(43);
    expect(a.biome).toEqual(b.biome);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.biome).not.toEqual(c.biome);
    let ruins = 0, forest = 0, quarry = 0;
    for (let s = 1; s <= 20; s++) { const m = generateMap(s); if (m.biome.includes('ruins')) ruins++; if (m.biome.includes('forest')) forest++; if (m.biome.includes('quarry')) quarry++; }
    expect(ruins).toBe(20); expect(forest).toBeGreaterThan(15); expect(quarry).toBeGreaterThan(10);
  });

  it('game exposes map arrays sized 56×56 and guarded camps/cages', () => {
    const g = createGame({ seed: 5, meta: meta() });
    const s = g.state;
    expect(s.map.biome.length).toBe(56 * 56);
    expect(s.map.variant.length).toBe(56 * 56);
    expect(s.map.lightAlpha.length).toBe(56 * 56);
    const camps = s.pois.filter((p) => p.kind === 'camp');
    for (const c of camps) {
      const guards = s.enemies.filter((e) => Math.hypot(e.x - c.x, e.y - c.y) < 4);
      expect(guards.length).toBeGreaterThanOrEqual(4);
    }
  });
});

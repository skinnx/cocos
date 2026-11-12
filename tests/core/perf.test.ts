import { describe, expect, it } from 'vitest';
import { spawnBuilding } from '../../assets/scripts/core/sim/Economy';
import { createHero } from '../../assets/scripts/core/sim/Squad';
import { fire } from '../../assets/scripts/core/sim/Projectiles';
import { addE, flat, night, refresh } from './helpers';
import type { BuildingId } from '../../assets/scripts/core/api';
import type { EnemyX } from '../../assets/scripts/core/sim/World';

describe('performance (§13.3)', () => {
  it('one fixed step ≤ 4 ms at 250 enemies + 150 buildings + 60 projectiles', () => {
    const { g, w } = flat(2024);
    const Z = { wood: 0, stone: 0, gold: 0 };
    // 150 buildings: a ring of walls/gates, arrow/frost/spark towers inside, braziers
    let n = w.s.buildings.length;
    for (let x = 17; x <= 38 && n < 150; x++) for (const y of [17, 38]) { spawnBuilding(w, x % 7 === 0 ? 'gate' : 'wall_stone', x, y, Z); n++; }
    for (let y = 18; y <= 37 && n < 150; y++) for (const x of [17, 38]) { spawnBuilding(w, 'wall_wood', x, y, Z); n++; }
    const towers: BuildingId[] = ['tower_arrow', 'tower_arrow', 'tower_frost', 'tower_spark', 'brazier'];
    let k = 0;
    for (let y = 19; y <= 36 && n < 150; y += 2) for (let x = 19; x <= 36 && n < 150; x += 2) {
      if (Math.abs(x - 27.5) < 2.5 && Math.abs(y - 27.5) < 2.5) continue;
      if (w.bldAt[y * 56 + x]) continue;
      spawnBuilding(w, towers[k++ % towers.length], x, y, Z); n++;
    }
    expect(w.s.buildings.length).toBe(150);
    for (const b of w.s.buildings) if (b.id !== 'hearth') b.hp = b.maxHp = 1e6;
    refresh(w);
    for (const id of ['ranger', 'pyro', 'cleric'] as const) w.s.heroes.push(createHero(w, id, 28, 31));
    night(w);
    w.s.buffs.falseDawnT = 1e9; // light everything so every tower engages
    refresh(w);
    for (let i = 0; w.s.enemies.length < 250; i++) {
      const a = (i / 250) * Math.PI * 2 * 7, r = 12 + (i % 9);
      const e = addE(w, i % 5 === 0 ? 'brute' : i % 7 === 0 ? 'wisp' : 'gloomling', 28 + Math.cos(a) * r, 28 + Math.sin(a) * r);
      e.hp = e.maxHp = 1e7;
    }
    w.hearth.hp = w.hearth.maxHp = 1e9;
    let shell = 0;
    const topUp = () => { // keep the projectile pool at the 60 cap with long-flight mortar shells on top of tower fire
      while (w.s.projectiles.length < 60) {
        const e = w.s.enemies[shell++ % w.s.enemies.length];
        fire(w, { kind: 'mortar', x: 28, y: 28, tx: e.x, ty: e.y, dmg: 5, dtype: 'impact', src: w.hearth.uid, srcKind: 0, speed: 8, flightT: 2.5, splash: 1.5, hitsFlying: false });
      }
    };
    for (let i = 0; i < 90; i++) { topUp(); g.step(); } // warm up (JIT)
    topUp();
    expect(w.s.projectiles.length).toBe(60);
    const N = 300;
    let worst = 0;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      topUp();
      const a = performance.now();
      g.step(); g.drainEvents();
      worst = Math.max(worst, performance.now() - a);
      for (const e of w.s.enemies as EnemyX[]) if (e.hp < 1e6) e.hp = 1e7;
    }
    const avg = (performance.now() - t0) / N;
    console.log(`step avg ${avg.toFixed(3)} ms, worst ${worst.toFixed(2)} ms, enemies ${w.s.enemies.length}, buildings ${w.s.buildings.length}, projectiles ${w.s.projectiles.length}`);
    expect(w.s.enemies.length).toBeGreaterThanOrEqual(245);
    expect(w.s.buildings.length).toBe(150);
    expect(avg).toBeLessThan(4);
  });
});

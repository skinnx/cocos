import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../assets/scripts/core/data/enemies';
import { damageEnemy } from '../../assets/scripts/core/sim/Combat';
import { planNight } from '../../assets/scripts/core/sim/Spawner';
import { addB, addE, flat, hero, night, parkHeroes, removeGift, run, C } from './helpers';
import type { World } from '../../assets/scripts/core/sim/World';

function stoneRing(w: World) {
  for (let x = 23; x <= 32; x++) for (const y of [23, 32]) addB(w, 'wall_stone', x, y);
  for (let y = 24; y <= 31; y++) for (const x of [23, 32]) addB(w, 'wall_stone', x, y);
}

describe('Enemy behaviours (§7.3)', () => {
  it('gloomling follows the flow field to the Hearth and attacks it', () => {
    const { g, w } = flat();
    night(w); parkHeroes(w);
    const e = addE(w, 'gloomling', 45.5, 28.5);
    const hp0 = w.hearth.hp;
    run(g, 16);
    expect(Math.hypot(e.x - C, e.y - C)).toBeLessThan(2.2);
    expect(w.hearth.hp).toBeLessThan(hp0);
  });

  it('skitters come in packs of 5 and are a swarm (fire ×1.5)', () => {
    const { w } = flat();
    w.s.night = 2; planNight(w);
    const n = w.r.spawn.filter((s) => s.enemy === 'skitter').length;
    expect(n).toBeGreaterThan(0);
    expect(n % 5).toBe(0);
    night(w);
    const s = addE(w, 'skitter', 40, 40), gl = addE(w, 'gloomling', 40, 42);
    s.hp = gl.hp = 100;
    expect(damageEnemy(w, s, 10, 'fire', { src: 'tower' })).toBe(15);
    expect(damageEnemy(w, gl, 10, 'fire', { src: 'tower' })).toBe(10);
  });

  it('spitter stops at range and spits at towers first', () => {
    const { g, w } = flat();
    removeGift(w);
    night(w); parkHeroes(w);
    const t = addB(w, 'tower_arrow', 36, 28);
    t.hp = t.maxHp = 5000;
    const e = addE(w, 'spitter', 48.5, 28.5);
    let minD = 99;
    for (let i = 0; i < 30 * 15; i++) { g.step(); minD = Math.min(minD, Math.hypot(e.x - 36.5, e.y - 28.5)); }
    expect(t.hp).toBeLessThan(5000);
    expect(minD).toBeGreaterThan(3.2);
    expect(minD).toBeLessThan(4.6);
  });

  it('brute deals ×2 damage to buildings and breaches (breacher field)', () => {
    const { g, w } = flat();
    stoneRing(w);
    night(w); parkHeroes(w);
    const e = addE(w, 'brute', 36.5, 25.5);
    let dealt = 0, breaching = false;
    for (let i = 0; i < 30 * 12; i++) { g.step(); if (e.mode === 2) breaching = true; for (const ev of g.drainEvents()) if (ev.t === 'hit' && w.bmap.get(ev.target)?.id === 'wall_stone') dealt = ev.amount; }
    expect(dealt).toBe(ENEMIES.brute.dmg * 2);
    expect(breaching).toBe(true);
  });

  it('wisp flies straight over walls and traps to the Hearth', () => {
    const { g, w } = flat();
    stoneRing(w);
    const sp = addB(w, 'trap_spikes', 36, 28);
    night(w); parkHeroes(w);
    const e = addE(w, 'wisp', 45.5, 28.5);
    const hp0 = w.hearth.hp;
    run(g, 12);
    expect(e.flying).toBe(true);
    expect(w.hearth.hp).toBeLessThan(hp0);
    for (const b of w.s.buildings) if (b.id === 'wall_stone') expect(b.hp).toBe(b.maxHp);
    expect(sp.charges).toBe(6);
  });

  it('bomber charges the nearest building and explodes (60 to buildings); shot down → no damage', () => {
    const { g, w } = flat();
    removeGift(w);
    const walls = [addB(w, 'wall_stone', 36, 27), addB(w, 'wall_stone', 36, 28), addB(w, 'wall_stone', 36, 29)];
    night(w); parkHeroes(w);
    const e = addE(w, 'bomber', 44.5, 28.5);
    let exploded = false;
    for (let i = 0; i < 30 * 10 && !exploded; i++) { g.step(); exploded = g.drainEvents().some((ev) => ev.t === 'explode' && ev.radius === 1.5); }
    expect(exploded).toBe(true);
    expect(e.dead).toBe(true);
    expect(walls.filter((b) => b.hp === b.maxHp - 60).length).toBeGreaterThanOrEqual(2);
    const { g: g2, w: w2 } = flat(); removeGift(w2);
    const wall = addB(w2, 'wall_stone', 36, 28);
    night(w2); parkHeroes(w2);
    const b2 = addE(w2, 'bomber', 38.5, 28.5);
    damageEnemy(w2, b2, 100, 'pierce', { src: 'tower' });
    run(g2, 2);
    expect(wall.hp).toBe(wall.maxHp);
  });

  it('snuffer hunts the nearest burning brazier and puts it out; with none it goes for the Hearth', () => {
    const { g, w } = flat();
    const br = addB(w, 'brazier', 40, 20);
    night(w); parkHeroes(w);
    const e = addE(w, 'snuffer', 46.5, 14.5);
    const hp0 = w.hearth.hp;
    run(g, 12);
    expect(br.lit).toBe(false);
    expect(br.snuffed).toBe(true);
    expect(w.hearth.hp).toBe(hp0);
    run(g, 20);
    expect(Math.hypot(e.x - C, e.y - C)).toBeLessThan(Math.hypot(46.5 - C, 14.5 - C) - 5);
  });

  it('elites: ×2.5 HP, ×1.3 damage, larger', () => {
    const { w } = flat();
    const e = addE(w, 'brute', 40, 40, { elite: true });
    expect(e.maxHp).toBe(ENEMIES.brute.hp * 2.5);
    expect(e.dmg).toBeCloseTo(ENEMIES.brute.dmg * 1.3);
    expect(e.scale).toBe(1.25);
  });

  it('enemies aggro heroes within 2.5 with line of sight and give up beyond 4', () => {
    const { g, w } = flat();
    night(w);
    const h = hero(w); h.x = 40.5; h.y = 40.5;
    const e = addE(w, 'gloomling', 42.5, 40.5);
    run(g, 0.5);
    expect(e.mode).toBe(1);
    expect(e.targetUid).toBe(h.uid);
    h.x = 10; h.y = 50;
    run(g, 0.3);
    expect(e.mode).toBe(0);
  });

  it('camp guards hold position, chase heroes, then return home', () => {
    const { g, w } = flat();
    const e = addE(w, 'gloomling', 40.5, 40.5, { guard: 999 });
    parkHeroes(w);
    run(g, 2);
    expect(Math.hypot(e.x - 40.5, e.y - 40.5)).toBeLessThan(0.9);
    const h = hero(w); h.x = 43.5; h.y = 40.5; h.hp = h.maxHp = 1e5;
    run(g, 1.5);
    expect(e.mode).toBe(1);
    parkHeroes(w);
    run(g, 6);
    expect(Math.hypot(e.x - 40.5, e.y - 40.5)).toBeLessThan(1.2);
  });
});

describe('Bosses', () => {
  it('Mossback walks straight through walls crushing them, withdraws (tower-immune, ×2 from heroes) and spawns 6 gloomlings', () => {
    const { g, w } = flat();
    removeGift(w);
    night(w); parkHeroes(w);
    const m = addE(w, 'mossback', 44.5, 28.5);
    const wall = addB(w, 'wall_stone', 38, 28);
    expect(w.s.boss?.id).toBe('mossback');
    let maxDev = 0;
    // perpendicular distance from the straight line start → Hearth centre
    const lx = C - 44.5, ly = C - 28.5, L = Math.hypot(lx, ly);
    for (let i = 0; i < 30 * 7.5; i++) { g.step(); maxDev = Math.max(maxDev, Math.abs(((m.x - 44.5) * ly - (m.y - 28.5) * lx) / L)); }
    expect(maxDev).toBeLessThan(0.05); // straight line
    run(g, 1);
    expect(m.shell).toBeGreaterThan(0);
    expect(w.s.enemies.filter((e) => e.id === 'gloomling').length).toBe(6);
    expect(damageEnemy(w, m, 20, 'impact', { src: 'tower' })).toBe(0);
    expect(damageEnemy(w, m, 20, 'impact', { src: 'hero', hero: hero(w) })).toBe(50); // 20 × 1.25 armored × 2
    for (const e of [...w.s.enemies]) if (e.id === 'gloomling') (e as { dead: boolean }).dead = true;
    run(g, 60);
    expect(wall.dead || wall.hp < wall.maxHp).toBe(true);
    expect(m.x).toBeLessThan(38);
  });

  it('The Unlit: snuffs braziers + shrinks Hearth light, summons wisps, teleports at 66% with heal + elite brute', () => {
    const { g, w } = flat();
    const br = addB(w, 'brazier', 40, 30);
    night(w); parkHeroes(w);
    const u = addE(w, 'unlit', 43.5, 30.5);
    expect(u.flying).toBe(false);
    run(g, 6.5);
    expect(br.lit).toBe(false);
    expect(w.s.buffs.hearthLightMul).toBeCloseTo(0.6);
    run(g, 4);
    expect(w.s.enemies.filter((e) => e.id === 'wisp').length).toBeGreaterThanOrEqual(4);
    const x0 = u.x;
    u.hp = u.maxHp * 0.6;
    run(g, 0.1);
    expect(Math.abs(u.x - x0)).toBeGreaterThan(5);
    expect(u.hp).toBeCloseTo(u.maxHp * 0.65, 0);
    expect(w.s.enemies.some((e) => e.id === 'brute' && e.elite)).toBe(true);
    run(g, 7);
    expect(br.lit).toBe(true); // pulse wore off
  });
});

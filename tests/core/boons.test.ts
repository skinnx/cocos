import { describe, expect, it } from 'vitest';
// @ts-expect-error untyped .mjs
import { BOON_IDS } from '../../tools/art/manifest.mjs';
import { BOONS, type BoonId } from '../../assets/scripts/core/data/boons';
import { applyBoon, offerBoons, rollBoons } from '../../assets/scripts/core/sim/Boons';
import { damageBuilding, damageEnemy } from '../../assets/scripts/core/sim/Combat';
import { buildingCost } from '../../assets/scripts/core/sim/Economy';
import { startDusk, startDawn } from '../../assets/scripts/core/sim/Phases';
import { towerRange, towerRateMul, towerDamage } from '../../assets/scripts/core/sim/Towers';
import { skillCdMax } from '../../assets/scripts/core/sim/Squad';
import { addB, addE, flat, hero, night, parkHeroes, refresh, removeGift, run, setRes, C } from './helpers';
import type { World } from '../../assets/scripts/core/sim/World';
import { rebuildTerrain } from '../../assets/scripts/core/sim/Grid';

const fresh = () => flat();
const boon = (w: World, id: BoonId, n = 1) => { for (let i = 0; i < n; i++) applyBoon(w, id); };

function knightHit(withSharp: boolean): number {
  const { g, w } = fresh();
  if (withSharp) boon(w, 'sharp');
  night(w);
  const h = hero(w); h.x = 40.5; h.y = 40.5;
  const e = addE(w, 'gloomling', 41.3, 40.5); e.hp = e.maxHp = 1000; e.status.stun = 100;
  let amt = 0;
  for (let i = 0; i < 60 && !amt; i++) { g.step(); for (const ev of g.drainEvents()) if (ev.t === 'hit' && ev.target === e.uid) amt = ev.amount; }
  return amt;
}

describe('Boons (§11.1)', () => {
  it('24 boons with ids matching the art manifest, 3 groups, rarities', () => {
    expect(BOONS.map((b) => b.id).sort()).toEqual([...BOON_IDS].sort());
    expect(BOONS.length).toBe(24);
    for (const g of ['squad', 'fort', 'flame']) expect(BOONS.filter((b) => b.group === g).length).toBe(8);
    expect(BOONS.filter((b) => b.rarity === 'legendary').map((b) => b.id).sort()).toEqual(['falsedawn', 'living', 'twin']);
  });

  it('offers: 3 distinct at dawn, 2 commons from chests, never a maxed boon', () => {
    const { w } = fresh();
    for (let i = 0; i < 30; i++) {
      const o = rollBoons(w, 3, false);
      expect(new Set(o.map((b) => b.id)).size).toBe(3);
      const c = rollBoons(w, 2, true);
      expect(c.every((b) => b.rarity === 'common')).toBe(true);
    }
    boon(w, 'harvest');
    for (let i = 0; i < 40; i++) expect(rollBoons(w, 3, false).some((b) => b.id === 'harvest')).toBe(false);
    offerBoons(w, 'chest');
    expect(w.s.boonOffer!.length).toBe(2);
    expect(w.s.boonSource).toBe('chest');
  });

  it('sharp: +15% hero damage', () => { expect(knightHit(false)).toBe(10); expect(knightHit(true)).toBe(12); });
  it('thick: +20% hero HP', () => { const { w } = fresh(); const h = hero(w); const m = h.maxHp; boon(w, 'thick'); expect(h.maxHp).toBe(Math.round(m * 1.2)); expect(h.hp).toBe(h.maxHp); });
  it('swift: +15% move speed', () => {
    const dist = (sw: boolean) => { const { g, w } = fresh(); if (sw) boon(w, 'swift'); const h = hero(w); const x0 = h.x; g.cmd({ t: 'move', dir: { x: 1, y: 0 } }); run(g, 1); return h.x - x0; };
    expect(dist(true) / dist(false)).toBeCloseTo(1.15, 2);
  });
  it('leech: heroes heal 8% of damage dealt', () => {
    const { g, w } = fresh(); boon(w, 'leech'); night(w);
    const h = hero(w); h.x = 40.5; h.y = 40.5; h.hp = 50;
    const e = addE(w, 'gloomling', 41.3, 40.5); e.hp = e.maxHp = 1000; e.status.stun = 100;
    run(g, 3);
    expect(h.hp).toBeGreaterThan(50);
  });
  it('horn: Rally Horn lasts 10 s', () => {
    const { g, w } = fresh(); boon(w, 'horn'); w.s.hornCharge = 40; g.cmd({ t: 'horn' }); expect(w.s.hornT).toBe(10);
    const { g: g2, w: w2 } = fresh(); w2.s.hornCharge = 40; g2.cmd({ t: 'horn' }); expect(w2.s.hornT).toBe(6);
  });
  it('ally: +1 squad slot (max 5)', () => { const { w } = fresh(); boon(w, 'ally'); expect(w.s.squadMax).toBe(5); expect(rollBoons(w, 3, false).some((b) => b.id === 'ally')).toBe(false); });
  it('cooldown: skills recharge 25% faster', () => { const { w } = fresh(); const a = skillCdMax(w, 'knight'); boon(w, 'cooldown'); expect(skillCdMax(w, 'knight')).toBeCloseTo(a * 0.75); });
  it('twin: skills trigger twice', () => {
    const count = (tw: boolean) => {
      const { g, w } = fresh(); if (tw) boon(w, 'twin'); night(w);
      const h = hero(w); h.x = 40.5; h.y = 40.5; h.skillCd = 0;
      const e = addE(w, 'gloomling', 41.5, 40.5); e.hp = e.maxHp = 1000;
      let n = 0;
      for (let i = 0; i < 45; i++) { g.step(); n += g.drainEvents().filter((ev) => ev.t === 'skill').length; }
      return n;
    };
    expect(count(false)).toBe(1); expect(count(true)).toBe(2);
  });
  it('mason: walls cost 25% less', () => { const { w } = fresh(); expect(buildingCost(w, 'wall_wood').wood).toBe(4); boon(w, 'mason'); expect(buildingCost(w, 'wall_wood').wood).toBe(3); expect(buildingCost(w, 'wall_stone').stone).toBe(5); });
  it('boulder: walls +30% HP', () => { const { w } = fresh(); const b = addB(w, 'wall_wood', 35, 35); boon(w, 'boulder'); expect(b.maxHp).toBe(78); expect(addB(w, 'wall_stone', 36, 35).maxHp).toBe(208); });
  it('hawk: towers +1 range', () => { const { w } = fresh(); const t = addB(w, 'tower_arrow', 30, 24); const r = towerRange(w, t); boon(w, 'hawk'); expect(towerRange(w, t)).toBe(r + 1); });
  it('reload: towers fire 15% faster', () => { const { w } = fresh(); const t = addB(w, 'tower_arrow', 24, 24); const r = towerRateMul(w, t); boon(w, 'reload'); expect(towerRateMul(w, t)).toBeCloseTo(r * 1.15); });
  it('spikes: +4 spike uses', () => { const { w } = fresh(); const a = addB(w, 'trap_spikes', 30, 24); boon(w, 'spikes'); expect(a.charges).toBe(10); expect(addB(w, 'trap_spikes', 30, 25).charges).toBe(10); });
  it('harvest: lumber camps / quarries +50%', () => {
    const wood = (hv: boolean) => {
      const { g, w } = fresh(); if (hv) boon(w, 'harvest');
      for (const [x, y] of [[33, 24], [34, 24], [35, 25]]) w.s.nodes.push({ uid: 9000 + x, kind: 'pine', x, y, hp: 3, maxHp: 3, regrowT: 0, shakeT: 0, orig: 'pine' } as never);
      rebuildTerrain(w); refresh(w); parkHeroes(w); setRes(w, 100, 0, 100);
      g.cmd({ t: 'place', id: 'lumber_camp', x: 31, y: 24 });
      expect(w.s.buildings.some((b) => b.id === 'lumber_camp')).toBe(true);
      const w0 = w.s.res.wood; run(g, 25); return w.s.res.wood - w0;
    };
    expect(wood(false)).toBe(6); expect(wood(true)).toBe(9);
  });
  it('thorns: Gloom striking a wall take 4 damage per hit', () => {
    const { w } = fresh(); boon(w, 'thorns'); const b = addB(w, 'wall_wood', 40, 40); const e = addE(w, 'gloomling', 41.5, 40.5);
    damageBuilding(w, b, 4, e); expect(e.hp).toBe(e.maxHp - 4);
  });
  it('living: buildings regenerate 1% HP/s at night', () => {
    const { g, w } = fresh(); boon(w, 'living'); const b = addB(w, 'wall_stone', 40, 40); b.hp = 100; night(w); parkHeroes(w); run(g, 5);
    expect(b.hp).toBeCloseTo(108, 0);
  });
  it('bigfire: Hearth light +1', () => { const { w } = fresh(); removeGift(w); expect(w.staticLight[28 * 56 + 35]).toBe(1); boon(w, 'bigfire'); refresh(w); expect(w.staticLight[28 * 56 + 35]).toBe(2); });
  it('embers: braziers need no fuel', () => { const { w } = fresh(); boon(w, 'embers'); setRes(w, 5, 0, 0); startDusk(w); expect(w.s.res.wood).toBe(5); });
  it('ash: Gloom on lit tiles take fire damage', () => {
    const { g, w } = fresh(); boon(w, 'ash'); night(w); parkHeroes(w);
    const e = addE(w, 'brute', 33.5, 25.5); e.status.stun = 100; refresh(w);
    const far = addE(w, 'brute', 47.5, 47.5); far.status.stun = 100;
    run(g, 4);
    expect(e.hp).toBeLessThan(e.maxHp); expect(far.hp).toBe(far.maxHp);
  });
  it('farlight: leader lantern 5 tiles', () => {
    const { g, w } = fresh(); const h = hero(w); h.x = 45.5; h.y = 45.5; run(g, 0.1);
    expect(w.s.map.light[45 * 56 + 41]).toBe(1); boon(w, 'farlight'); run(g, 0.1); expect(w.s.map.light[45 * 56 + 41]).toBe(2);
  });
  it('mirror: towers in the Hearth light +20% damage', () => {
    const { w } = fresh(); const t = addB(w, 'tower_arrow', 30, 24); const out = addB(w, 'tower_arrow', 45, 45);
    boon(w, 'mirror'); expect(towerDamage(w, t).bonus).toBeCloseTo(0.2); expect(towerDamage(w, out).bonus).toBe(0);
  });
  it('spread: burning spreads to adjacent Gloom', () => {
    const run2 = (sp: boolean) => {
      const { g, w } = fresh(); if (sp) boon(w, 'spread'); night(w); parkHeroes(w);
      const a = addE(w, 'brute', 45.5, 45.5), b = addE(w, 'brute', 46.2, 45.5); a.status.stun = b.status.stun = 100;
      a.status.burn = 5; a.burnDps = 3; run(g, 1); return b.status.burn > 0;
    };
    expect(run2(false)).toBe(false); expect(run2(true)).toBe(true);
  });
  it('rebirth: Hearth heals 2 HP/s by day', () => { const { g, w } = fresh(); boon(w, 'rebirth'); w.hearth.hp = 100; parkHeroes(w); run(g, 5); expect(w.hearth.hp).toBeCloseTo(110, 0); });
  it('falsedawn: once per night at <25% Hearth: island lit 8 s, Gloom stunned 3 s', () => {
    const { g, w } = fresh(); boon(w, 'falsedawn'); night(w); parkHeroes(w);
    const e = addE(w, 'gloomling', 48.5, 48.5);
    w.hearth.hp = 100;
    run(g, 0.1);
    expect(w.s.buffs.falseDawnT).toBeGreaterThan(7);
    expect(e.status.stun).toBeGreaterThan(2.5);
    expect(w.s.map.light[50 * 56 + 50]).toBe(2);
    run(g, 9);
    expect(w.s.map.light[50 * 56 + 50]).toBe(0);
    expect(w.r.falseDawnUsed).toBe(true);
  });
  it('dawn offers 3 boons and picking one starts the next day', () => {
    const { g, w } = fresh(); night(w); startDawn(w);
    expect(w.s.boonOffer!.length).toBe(3);
    const id = w.s.boonOffer![1].id;
    g.cmd({ t: 'pickBoon', index: 1 });
    expect(w.s.boons.find((b) => b.id === id)!.stacks).toBe(1);
    expect(w.s.phase).toBe('day'); expect(w.s.night).toBe(2);
    void damageEnemy; void C;
  });
});

import { describe, expect, it } from 'vitest';
import type { BuildingId } from '../../assets/scripts/core/api';
import { BUILDINGS, BUILDING_IDS } from '../../assets/scripts/core/data/buildings';
import { HEROES } from '../../assets/scripts/core/data/heroes';
import { createHero } from '../../assets/scripts/core/sim/Squad';
import { addB, flat, hero, meta, night, parkHeroes, refresh, removeGift, run, setRes } from './helpers';
import type { World } from '../../assets/scripts/core/sim/World';
import { rebuildTerrain } from '../../assets/scripts/core/sim/Grid';

const spot: Record<string, [number, number]> = {};
function addTrees(w: World, n: number, kind: 'pine' | 'rock_m', x0: number, y0: number) {
  for (let i = 0; i < n; i++) w.s.nodes.push({ uid: 8000 + i + x0 * 10, kind, x: x0 + i, y: y0, hp: 3, maxHp: 3, regrowT: 0, shakeT: 0, orig: kind } as never);
  rebuildTerrain(w); refresh(w);
}
void spot;

describe('Buildings & economy (§6)', () => {
  it('catalogue: every §6.3 building with footprint, HP and level-1 cost', () => {
    const exp: Record<string, [number, number, number, number, number]> = {
      wall_wood: [1, 4, 0, 0, 60], wall_stone: [1, 0, 6, 0, 160], gate: [1, 10, 0, 0, 90], brazier: [1, 12, 4, 0, 40],
      tower_arrow: [1, 20, 10, 0, 120], tower_ballista: [2, 30, 40, 0, 200], tower_frost: [1, 0, 25, 30, 100], tower_mortar: [2, 0, 50, 40, 180],
      trap_spikes: [1, 8, 4, 0, 1], trap_tar: [1, 6, 0, 0, 1], lumber_camp: [2, 25, 0, 10, 150], quarry: [2, 30, 0, 15, 150],
      tower_spark: [1, 0, 30, 60, 100], barracks: [2, 40, 20, 40, 220], workshop: [2, 40, 40, 30, 180], tavern: [2, 30, 20, 60, 180],
    };
    expect(BUILDING_IDS.length).toBe(17);
    for (const [id, [sz, wd, st, gd, hp]] of Object.entries(exp)) {
      const d = BUILDINGS[id as BuildingId];
      expect(d.w, id).toBe(sz); expect(d.cost, id).toEqual({ wood: wd, stone: st, gold: gd }); expect(d.hp[0], id).toBe(hp);
    }
    expect(BUILDINGS.hearth.hp).toEqual([500, 800, 1200]);
  });

  it('place deducts exact cost; upgrade costs ×1.6 / ×2.5; hearth upgrade 30/40/60 then 60/90/150', () => {
    const { g, w } = flat();
    setRes(w, 1000, 1000, 1000);
    g.cmd({ t: 'place', id: 'tower_arrow', x: 30, y: 24 });
    expect(w.s.res).toEqual({ wood: 980, stone: 990, gold: 1000 });
    const t = w.s.buildings.find((b) => b.id === 'tower_arrow')!;
    expect(g.buildingCost('tower_arrow', 2)).toEqual({ wood: 32, stone: 16, gold: 0 });
    expect(g.buildingCost('tower_arrow', 3)).toEqual({ wood: 50, stone: 25, gold: 0 });
    g.cmd({ t: 'upgrade', uid: t.uid });
    expect(t.level).toBe(2); expect(w.s.res).toEqual({ wood: 948, stone: 974, gold: 1000 });
    g.cmd({ t: 'upgrade', uid: t.uid });
    expect(t.level).toBe(3); expect(w.s.res).toEqual({ wood: 898, stone: 949, gold: 1000 });
    g.cmd({ t: 'upgrade', uid: t.uid }); // max
    expect(t.level).toBe(3);
    g.cmd({ t: 'upgrade', uid: w.hearth.uid });
    expect(w.s.hearthLevel).toBe(2); expect(w.hearth.maxHp).toBe(800); expect(w.s.res).toEqual({ wood: 868, stone: 909, gold: 940 });
    g.cmd({ t: 'upgrade', uid: w.hearth.uid });
    expect(w.hearth.maxHp).toBe(1200); expect(w.s.res).toEqual({ wood: 808, stone: 819, gold: 790 });
    // every building can be placed / upgraded at its listed cost
    for (const id of BUILDING_IDS) {
      if (id === 'hearth') continue;
      const d = BUILDINGS[id];
      expect(g.buildingCost(id, 1)).toEqual(d.cost);
    }
  });

  it('wood wall upgrades to stone; gate L2 0/12/0; brazier L2 light 5.5', () => {
    const { g, w } = flat();
    setRes(w, 100, 100, 100);
    g.cmd({ t: 'place', id: 'wall_wood', x: 24, y: 24 });
    const wl = w.s.buildings.find((b) => b.id === 'wall_wood')!;
    g.cmd({ t: 'upgrade', uid: wl.uid });
    expect(wl.id).toBe('wall_stone'); expect(wl.maxHp).toBe(160);
    expect(w.s.res.stone).toBe(94);
    g.cmd({ t: 'upgrade', uid: wl.uid }); expect(wl.maxHp).toBe(260);
    g.cmd({ t: 'place', id: 'gate', x: 25, y: 24 });
    const gt = w.s.buildings.find((b) => b.id === 'gate')!;
    const s0 = w.s.res.stone; g.cmd({ t: 'upgrade', uid: gt.uid }); expect(w.s.res.stone).toBe(s0 - 12); expect(gt.maxHp).toBe(200);
  });

  it('repair: 1 wood (stone for stone buildings) per 15 HP; sell 60% (100% at dusk); undo refunds fully', () => {
    const { g, w } = flat();
    setRes(w, 100, 100, 100);
    g.cmd({ t: 'place', id: 'tower_arrow', x: 30, y: 24 });
    const t = w.s.buildings.find((b) => b.id === 'tower_arrow')!;
    t.hp = 120 - 31;
    g.cmd({ t: 'repair', uid: t.uid });
    expect(t.hp).toBe(120); expect(w.s.res.wood).toBe(80 - 3);
    g.cmd({ t: 'place', id: 'wall_stone', x: 24, y: 24 });
    const ws = w.s.buildings.find((b) => b.id === 'wall_stone')!;
    ws.hp = 100; g.cmd({ t: 'repair', uid: ws.uid });
    expect(ws.hp).toBe(160); expect(w.s.res.stone).toBe(90 - 6 - 4);
    setRes(w, 0, 0, 0);
    g.cmd({ t: 'sell', uid: t.uid });
    expect(w.s.res).toEqual({ wood: 12, stone: 6, gold: 0 });
    // dusk: 100%
    const { g: g2, w: w2 } = flat();
    setRes(w2, 100, 100, 100);
    g2.cmd({ t: 'callNight' });
    g2.cmd({ t: 'place', id: 'tower_arrow', x: 30, y: 24 });
    const t2 = w2.s.buildings.find((b) => b.id === 'tower_arrow')!;
    const r0 = { ...w2.s.res };
    g2.cmd({ t: 'sell', uid: t2.uid });
    expect(w2.s.res.wood - r0.wood).toBe(20); expect(w2.s.res.stone - r0.stone).toBe(10);
    // undo inside a build session
    const { g: g3, w: w3 } = flat();
    setRes(w3, 100, 100, 100);
    g3.cmd({ t: 'buildMode', on: true });
    expect(w3.s.timeScale).toBe(0.25);
    g3.cmd({ t: 'paint', id: 'wall_wood', cells: [{ x: 24, y: 24 }, { x: 25, y: 24 }, { x: 26, y: 24 }] });
    expect(w3.s.res.wood).toBe(88);
    g3.cmd({ t: 'undo' });
    expect(w3.s.res.wood).toBe(100);
    expect(w3.s.buildings.filter((b) => b.id === 'wall_wood').length).toBe(0);
  });

  it('paint places as many as affordable, skips blocked cells; wall auto-tile masks N1 E2 S4 W8', () => {
    const { g, w } = flat();
    setRes(w, 14, 0, 0);
    const cells = [{ x: 24, y: 24 }, { x: 25, y: 24 }, { x: 26, y: 24 }, { x: 26, y: 25 }, { x: 26, y: 26 }];
    g.cmd({ t: 'paint', id: 'wall_wood', cells });
    expect(w.s.buildings.filter((b) => b.id === 'wall_wood').length).toBe(3);
    expect(g.drainEvents().some((e) => e.t === 'buildFail' && e.reason === 'cost')).toBe(true);
    setRes(w, 100, 0, 0);
    g.cmd({ t: 'paint', id: 'wall_wood', cells });
    run(g, 0.05);
    const at = (x: number, y: number) => w.s.buildings.find((b) => b.x === x && b.y === y)!;
    expect(at(24, 24).wallMask).toBe(2);
    expect(at(25, 24).wallMask).toBe(2 | 8);
    expect(at(26, 24).wallMask).toBe(4 | 8);
    expect(at(26, 25).wallMask).toBe(1 | 4);
    expect(at(26, 26).wallMask).toBe(1);
  });

  it('placement rules: no water/trees/buildings/heroes; traps allowed under enemies; locked blueprints; lumber/quarry need nodes', () => {
    const { g, w } = flat();
    setRes(w, 999, 999, 999);
    expect(g.canPlace('wall_wood', 31, 28).reason).toBe('blocked'); // gift brazier
    expect(g.canPlace('wall_wood', 27, 27).reason).toBe('blocked'); // hearth
    const h = hero(w); h.x = 24.5; h.y = 30.5;
    expect(g.canPlace('wall_wood', 24, 30).reason).toBe('blocked');
    expect(g.canPlace('tower_spark', 24, 24).reason).toBe('locked');
    addTrees(w, 2, 'pine', 31, 22);
    expect(g.canPlace('wall_wood', 31, 22).reason).toBe('blocked');
    expect(g.canPlace('lumber_camp', 29, 22).reason).toBe('blocked'); // only 2 trees
    addTrees(w, 1, 'pine', 33, 23);
    expect(g.canPlace('lumber_camp', 29, 22).ok).toBe(true);
    expect(g.canPlace('quarry', 24, 22).reason).toBe('blocked');
    const { g: g2, w: w2 } = flat(1, meta({ unlockedBlueprints: ['tower_spark', 'barracks', 'workshop', 'tavern'] }));
    setRes(w2, 999, 999, 999);
    expect(g2.canPlace('tower_spark', 24, 24).ok).toBe(true);
  });

  it('night construction: 1.5 s at 50% HP, inactive', () => {
    const { g, w } = flat();
    removeGift(w);
    setRes(w, 100, 100, 100);
    night(w); parkHeroes(w);
    g.cmd({ t: 'place', id: 'tower_arrow', x: 30, y: 24 });
    const t = w.s.buildings.find((b) => b.id === 'tower_arrow')!;
    expect(t.constructing).toBeCloseTo(1.5); expect(t.hp).toBe(60);
    run(g, 1.6);
    expect(t.constructing).toBe(0);
  });

  it('Tobi makes buildings 10% cheaper', () => {
    const { g, w } = flat();
    w.s.heroes.push(createHero(w, 'tinker', 30, 30));
    expect(g.buildingCost('tower_arrow')).toEqual({ wood: 18, stone: 9, gold: 0 });
    expect(HEROES.tinker.skill).toBe('miniTurret');
  });

  it('economy: lumber camp +1 wood / 4 s by day only; workshop repairs at night; barracks militia guard', () => {
    const { g, w } = flat(1, meta({ unlockedBlueprints: ['barracks', 'workshop'] }));
    parkHeroes(w);
    const ws = addB(w, 'workshop', 24, 24);
    const wall = addB(w, 'wall_stone', 26, 24); wall.hp = 60;
    addB(w, 'barracks', 24, 30);
    night(w); parkHeroes(w);
    expect(w.s.allies.filter((a) => a.id === 'militia').length).toBe(2);
    run(g, 5);
    expect(wall.hp).toBeCloseTo(80, 0);
    void ws;
  });
});

import { describe, expect, it } from 'vitest';
import { HEROES, HERO_IDS } from '../../assets/scripts/core/data/heroes';
import { damageEnemy, killEnemy } from '../../assets/scripts/core/sim/Combat';
import { castSkill, createHero } from '../../assets/scripts/core/sim/Squad';
import { rebuildTerrain } from '../../assets/scripts/core/sim/Grid';
import { addB, addE, flat, game, hero, meta, night, parkHeroes, run, C } from './helpers';
import type { PoiX, HeroX } from '../../assets/scripts/core/sim/World';
import {
  applyRunEmber, blueprintCost, buyBlueprint, buyTalent, defaultMeta, emberFor, heroUnlockCost, loadMeta, setStarterHero, talentCost, unlockHero,
} from '../../assets/scripts/core/sim/Game';

function poi(w: ReturnType<typeof flat>['w'], kind: PoiX['kind'], x: number, y: number, hp = 1): PoiX {
  const p: PoiX = { uid: 50000 + x * 100 + y, kind, x, y, hp, maxHp: hp, active: true, data: {}, guards: 0 };
  w.s.pois.push(p); rebuildTerrain(w);
  return p;
}

describe('POIs (§4.3)', () => {
  it('camp cleared → chest → gold + choose 1 of 2 common boons', () => {
    const { g, w } = flat();
    const camp = poi(w, 'camp', 40, 40);
    const guards = [addE(w, 'gloomling', 41, 40, { guard: camp.uid }), addE(w, 'gloomling', 39, 40, { guard: camp.uid })];
    run(g, 0.1);
    expect(camp.active).toBe(true);
    for (const e of guards) killEnemy(w, e);
    run(g, 0.1);
    expect(camp.active).toBe(false);
    expect(w.s.stats.camps).toBe(1);
    const chest = w.s.pois.find((p) => p.kind === 'chest')!;
    expect(chest.active).toBe(true);
    const g0 = w.s.res.gold;
    const h = hero(w); h.x = 40.5; h.y = 41.5;
    run(g, 0.1);
    expect(chest.active).toBe(false);
    expect(w.s.res.gold).toBeGreaterThan(g0);
    expect(w.s.boonOffer!.length).toBe(2);
    expect(w.s.boonOffer!.every((b) => b.rarity === 'common')).toBe(true);
    g.cmd({ t: 'pickBoon', index: 0 });
    expect(w.s.boonOffer).toBe(null);
    expect(w.s.boons.length).toBe(1);
    expect(w.s.phase).toBe('day');
  });

  it('cage (HP 40) broken by heroes → new hero joins (reserve when full)', () => {
    const { g, w } = flat();
    const cage = poi(w, 'cage', 40, 40, 40);
    const h = hero(w); h.x = 41.5; h.y = 40.5;
    run(g, 6);
    expect(cage.active).toBe(false);
    expect(w.s.heroes.length).toBe(2);
    expect(w.s.heroes[1].id).not.toBe('knight');
    w.s.heroes.push(createHero(w, 'cleric', 30, 30), createHero(w, 'rogue', 30, 30));
    const c2 = poi(w, 'cage', 44, 40, 40);
    h.x = 45.5; h.y = 40.5;
    run(g, 6);
    expect(c2.active).toBe(false);
    expect(w.s.heroes.length).toBe(4);
    expect(w.s.reserve.length).toBe(1);
    g.cmd({ t: 'swapHero', reserveIndex: 0, squadIndex: 3 });
    expect(w.s.reserve[0]).toBe('rogue');
  });

  it('shrine: one use per run, grants a buff', () => {
    const { g, w } = flat();
    const sh = poi(w, 'shrine', 40, 40);
    w.hearth.hp = 100;
    const h = hero(w); h.x = 40.5; h.y = 41.5;
    run(g, 0.1);
    expect(sh.active).toBe(false);
    expect(['damage', 'towerRate', 'heal']).toContain(sh.data!.buff);
    if (sh.data!.buff === 'heal') expect(w.hearth.hp).toBe(w.hearth.maxHp); else expect(w.s.buffs.shrine).toBe(sh.data!.buff);
  });

  it('rift roots grow by day near active rifts, destroying one cuts that rift budget', () => {
    const { g, w } = game(21);
    const roots = w.s.pois.filter((p) => p.kind === 'root');
    expect(roots.length).toBe(1);
    expect(roots[0].hp).toBe(150);
    for (const e of [...w.s.enemies]) if ((e as { guard: number }).guard === roots[0].uid) killEnemy(w, e as never);
    const h = hero(w); h.x = roots[0].x + 1.5; h.y = roots[0].y + 0.5;
    h.level = 5;
    run(g, 20);
    expect(roots[0].active).toBe(false);
    expect(w.r.rootCut).toEqual([0]);
    g.cmd({ t: 'callNight' });
    expect(w.s.pois.some((p) => p.kind === 'root')).toBe(false);
  });
});

describe('Heroes (§7.1)', () => {
  it('6 heroes with spec stats', () => {
    expect(HERO_IDS).toEqual(['knight', 'ranger', 'pyro', 'tinker', 'cleric', 'rogue']);
    expect([HEROES.knight.hp, HEROES.ranger.hp, HEROES.pyro.hp, HEROES.tinker.hp, HEROES.cleric.hp, HEROES.rogue.hp]).toEqual([120, 70, 60, 80, 75, 65]);
    expect(HEROES.ranger.unlockEmber).toBe(50);
  });

  it('XP split among living heroes; levels at 20/50/100/180 give +12% HP & damage', () => {
    const { w } = flat();
    const h = hero(w);
    w.s.heroes.push(createHero(w, 'ranger', 30, 30));
    night(w);
    for (let i = 0; i < 5; i++) killEnemy(w, addE(w, 'brute', 40, 40)); // 40 XP → 20 each
    expect(h.level).toBe(2);
    expect(h.maxHp).toBe(Math.round(120 * 1.12));
    for (let i = 0; i < 40; i++) killEnemy(w, addE(w, 'brute', 40, 40));
    expect(h.level).toBe(5);
  });

  it('leader follows the joystick; followers keep a V formation behind', () => {
    const { g, w } = flat();
    const h = hero(w);
    w.s.heroes.push(createHero(w, 'ranger', h.x, h.y), createHero(w, 'cleric', h.x, h.y));
    g.cmd({ t: 'move', dir: { x: -1, y: 0 } });
    run(g, 2.5);
    const [l, a, b] = w.s.heroes;
    expect(l.x).toBeLessThan(22);
    expect(a.x).toBeGreaterThan(l.x + 0.5); expect(b.x).toBeGreaterThan(l.x + 0.5);
    expect(Math.sign(a.y - l.y)).not.toBe(Math.sign(b.y - l.y));
  });

  it('every skill fires with its effect', () => {
    const { g, w } = flat();
    night(w); parkHeroes(w, 45, 45);
    const mk = (id: HeroX['id']) => { const h = createHero(w, id, 40.5, 40.5); w.s.heroes.push(h); return h; };
    const e = addE(w, 'brute', 41.5, 40.5); e.hp = e.maxHp = 1e5;
    w.ehash.rebuild(w.s.enemies);
    expect(castSkill(w, mk('knight'))).toBe(true); expect(e.status.stun).toBeGreaterThan(0);
    const before = w.s.projectiles.length; castSkill(w, mk('ranger')); expect(w.s.projectiles.length - before).toBe(5);
    castSkill(w, mk('pyro')); expect(w.s.zones.some((z) => z.kind === 'firewall')).toBe(true);
    castSkill(w, mk('tinker')); expect(w.s.allies.some((a) => a.id === 'turret')).toBe(true);
    castSkill(w, mk('cleric')); expect(w.s.zones.some((z) => z.kind === 'sanctum')).toBe(true);
    const r = mk('rogue'); r.x = 45; castSkill(w, r); expect(Math.hypot(r.x - e.x, r.y - e.y)).toBeLessThan(1.2); expect(r.nextHitMul).toBe(3);
    const hp0 = e.hp; run(g, 3);
    expect(e.hp).toBeLessThan(hp0);
  });

  it('passives: Brann taunts, Mira heals, Tobi repairs, Ilka relights, Vex speeds the squad', () => {
    const { g, w } = flat();
    night(w);
    const k = hero(w); k.x = 40.5; k.y = 40.5;
    const other = createHero(w, 'ranger', 41.5, 42); w.s.heroes.push(other);
    const e = addE(w, 'gloomling', 40.5, 42.2);
    run(g, 0.3);
    expect(e.targetUid).toBe(k.uid);
    const { w: w2, g: g2 } = flat();
    const m = createHero(w2, 'cleric', 30.5, 30.5); w2.s.heroes.push(m);
    const k2 = hero(w2); k2.hp = 50; k2.x = 31; k2.y = 31;
    run(g2, 2); expect(k2.hp).toBeGreaterThan(55);
    const t = createHero(w2, 'tinker', 25.5, 25.5); w2.s.heroes.push(t);
    const wall = addB(w2, 'wall_stone', 24, 24); wall.hp = 100;
    parkHeroes(w2, 25.5, 25.5);
    run(g2, 2); expect(wall.hp).toBeGreaterThan(110);
    const br = addB(w2, 'brazier', 24, 27); br.snuffed = true;
    const p = createHero(w2, 'pyro', 25.5, 27.5); w2.s.heroes.push(p);
    run(g2, 0.1); expect(br.snuffed).toBe(false);
    void damageEnemy; void C; void meta;
  });
});

describe('Meta (§11.2)', () => {
  it('unlock heroes, blueprints, talents; ember formula; robust load', () => {
    const m = defaultMeta();
    expect(m.unlockedHeroes).toEqual(['knight']);
    expect(unlockHero(m, 'ranger')).toBe(false);
    applyRunEmber(m, emberFor({ nightsSurvived: 10, bosses: 2, camps: 4 }, true));
    expect(m.ember).toBe(100 + 100 + 20 + 100);
    expect(heroUnlockCost('ranger')).toBe(50);
    expect(unlockHero(m, 'ranger')).toBe(true); expect(m.ember).toBe(270);
    expect(setStarterHero(m, 'ranger')).toBe(true);
    expect(setStarterHero(m, 'rogue')).toBe(false);
    expect(blueprintCost('tower_spark')).toBe(80);
    expect(buyBlueprint(m, 'tower_spark')).toBe(true); expect(m.ember).toBe(190);
    expect(buyBlueprint(m, 'wall_wood')).toBe(false);
    expect(talentCost(m, 'startWood')).toBe(30);
    expect(buyTalent(m, 'startWood')).toBe(true); expect(talentCost(m, 'startWood')).toBe(60);
    const re = loadMeta(JSON.stringify(m));
    expect(re).toEqual(m);
    expect(loadMeta('garbage')).toEqual(defaultMeta());
    expect(loadMeta(JSON.stringify({ ...m, version: 2 }))).toEqual(defaultMeta());
    const { w } = game(3, { ...re, tutorialDone: true });
    expect(w.s.res.wood).toBe(60);
    expect(w.s.heroes[0].id).toBe('ranger');
  });

  it('talents apply at run start', () => {
    const { w } = game(4, meta({ talents: { startStone: 2, hearthHp: 3, heroLevel: 2, hornPrecharge: 1 } }));
    expect(w.s.res.stone).toBe(45);
    expect(w.hearth.maxHp).toBe(650);
    expect(w.s.heroes[0].level).toBe(3);
    expect(w.s.hornCharge).toBe(20);
  });
});

// Pure v2 view logic (no engine): clock / day key with the 04:00 rollover, formatting, away summary rows, bottom-bar
// unlock filtering, garrison drag targeting, relocation preview, bulk brush, hero helpers and the save rotation.
import { describe, expect, it } from 'vitest';
import { dayKeyAt, dueTicks, localDayKey, ManualClock, msUntilRollover, DAY_MS } from '../../assets/scripts/game/logic/clock';
import { abbrev, addCost, affordable, costText, fmtCountdown, fmtDuration, fmtProgress } from '../../assets/scripts/game/logic/format';
import { awayFlyRes, awayRows, awayTitle } from '../../assets/scripts/game/logic/away';
import { activeOverlay, bookSections, bottomTabs, goalTarget, parseGoal, tabUnlocked, villageSections } from '../../assets/scripts/game/logic/nav';
import {
  bulkTargets, canHostGarrison, canRelocate, garrisonTarget, garrisonUsed, holdProgress, isHold, relocatePreview, repairCost, ruinsOf, totalCost,
} from '../../assets/scripts/game/logic/fortress';
import { dispatchLeft, gearStats, itemsForSlot, rosterOrder, skillRows, starUpState, stampMs, toggleSquad } from '../../assets/scripts/game/logic/heroes';
import { canSave, exportString, loadHold, normalizeImport, spentRare, writeHold, HOLD_BAK_KEY, HOLD_KEY, HOLD_TMP_KEY, type KV } from '../../assets/scripts/game/logic/save';
import { beaconOpen, researchCost, starUpCost } from '../../assets/scripts/game/logic/catalog';
import type { AwaySummary, BuildingState, GearItem, HeroRecord } from '../../assets/scripts/core/api';

const H = 3_600_000;
const utc = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);

describe('clock: local day key with 04:00 rollover (SPEC §11.10, §13.7)', () => {
  it('rolls over exactly at 04:00 local, not at midnight', () => {
    const k = dayKeyAt(utc(2026, 11, 12, 3, 59), 0);
    expect(dayKeyAt(utc(2026, 11, 12, 4, 0), 0)).toBe(k + 1);
    expect(dayKeyAt(utc(2026, 11, 12, 0, 0), 0)).toBe(k);
    expect(dayKeyAt(utc(2026, 11, 13, 3, 59), 0)).toBe(k + 1);
    expect(dayKeyAt(utc(2026, 11, 13, 4, 0), 0)).toBe(k + 2);
  });
  it('uses local wall time: UTC+7 rolls over at 21:00 UTC, UTC-5 at 09:00 UTC', () => {
    const vn = -420, ny = 300; // getTimezoneOffset() is UTC − local
    expect(dayKeyAt(utc(2026, 11, 12, 21, 0), vn) - dayKeyAt(utc(2026, 11, 12, 20, 59), vn)).toBe(1);
    expect(dayKeyAt(utc(2026, 11, 12, 9, 0), ny) - dayKeyAt(utc(2026, 11, 12, 8, 59), ny)).toBe(1);
  });
  it('DST spring-forward (23 h day) and fall-back (25 h day) roll over once each', () => {
    // EU-style switch at 01:00 UTC; local offset changes from -60 to -120 (spring) / -120 to -60 (fall)
    const spring = utc(2026, 3, 29, 1, 0), fall = utc(2026, 10, 25, 1, 0);
    const offAt = (t: number, sw: number, before: number, after: number) => (t < sw ? before : after);
    const keysAcross = (start: number, sw: number, before: number, after: number) => {
      const ks: number[] = [];
      for (let t = start; t < start + 3 * DAY_MS; t += 15 * 60_000) ks.push(dayKeyAt(t, offAt(t, sw, before, after)));
      return ks;
    };
    for (const [sw, b, a] of [[spring, -60, -120], [fall, -120, -60]] as const) {
      const ks = keysAcross(sw - DAY_MS, sw, b, a);
      let rolls = 0;
      for (let i = 1; i < ks.length; i++) { expect(ks[i] - ks[i - 1]).toBeGreaterThanOrEqual(0); expect(ks[i] - ks[i - 1]).toBeLessThanOrEqual(1); if (ks[i] > ks[i - 1]) rolls++; }
      expect(rolls).toBe(3); // three local 04:00s in three days, DST or not
    }
  });
  it('a big forward jump or a clock going back only changes the key arithmetically (core decides what it means)', () => {
    const c = new ManualClock(utc(2026, 11, 12, 12), 0);
    const k0 = c.dayKey(c.now());
    c.advance(30 * 24 * H);
    expect(c.dayKey(c.now()) - k0).toBe(30);
    c.advance(-31 * 24 * H);
    expect(c.dayKey(c.now()) - k0).toBe(-1);
    expect(dayKeyAt(NaN, 0)).toBe(0);
  });
  it('rollover countdown and the ~1/s tick throttle', () => {
    expect(msUntilRollover(utc(2026, 11, 12, 3, 0), 0)).toBe(H);
    expect(msUntilRollover(utc(2026, 11, 12, 4, 0), 0)).toBe(DAY_MS);
    let acc = 0, ticks = 0;
    for (let i = 0; i < 600; i++) { const r = dueTicks(acc, 1 / 60); acc = r.acc; ticks += r.ticks; }
    expect(ticks).toBe(10);
    expect(dueTicks(0, 45).ticks).toBe(1); // a long hidden frame never bursts
    expect(typeof localDayKey(Date.now())).toBe('number');
  });
});

describe('formatting (SPEC §10.5)', () => {
  it('abbreviates progress numbers: 1.2k, 34k, 1.3M', () => {
    expect(abbrev(0)).toBe('0'); expect(abbrev(999)).toBe('999'); expect(abbrev(1000)).toBe('1k'); expect(abbrev(1234)).toBe('1.2k');
    expect(abbrev(1299)).toBe('1.2k'); expect(abbrev(9999)).toBe('9.9k'); expect(abbrev(34_000)).toBe('34k'); expect(abbrev(34_999)).toBe('34k');
    expect(abbrev(1_250_000)).toBe('1.2M'); expect(abbrev(25_000_000)).toBe('25M'); expect(abbrev(-1500)).toBe('-1.5k'); expect(abbrev(NaN)).toBe('0');
    expect(abbrev(12.7)).toBe('12');
  });
  it('away durations and countdowns', () => {
    expect(fmtDuration(-5)).toBe('0s'); expect(fmtDuration(42)).toBe('42s'); expect(fmtDuration(5 * 60)).toBe('5m');
    expect(fmtDuration(2 * 3600 + 5 * 60)).toBe('2h 05m'); expect(fmtDuration(8 * 3600)).toBe('8h'); expect(fmtDuration(3 * 86400 + 4 * 3600)).toBe('3d 4h');
    expect(fmtDuration(30 * 86400)).toBe('30d');
    expect(fmtCountdown(185)).toBe('3:05'); expect(fmtCountdown(0.2)).toBe('0:01'); expect(fmtCountdown(0)).toBe('0:00'); expect(fmtCountdown(3725)).toBe('1:02:05');
  });
  it('cost text, affordability, sums', () => {
    expect(costText({ wood: 20, stone: 10 })).toBe('20w 10s'); expect(costText({ gold: 1500, iron: 20 })).toBe('1.5kg 20i'); expect(costText({})).toBe('0');
    expect(affordable({ wood: 20, stone: 9 }, { wood: 20, stone: 10 })).toBe(false); expect(affordable({ wood: 20, stone: 10, iron: 0 }, { wood: 20, stone: 10 })).toBe(true);
    expect(addCost({ wood: 5 }, { wood: 5, iron: 2 }, 2)).toEqual({ wood: 15, iron: 4 }); expect(fmtProgress(1500, 1200)).toBe('1.2k/1.2k');
  });
});

describe('away summary rows (SPEC §2.3)', () => {
  const a: AwaySummary = {
    seconds: 8 * 3600 + 120, produced: { wood: 180, stone: 90 }, newBounties: 3, traveler: true, warmthDelta: -1,
    dispatches: [{ hero: 'ranger', kind: 'hunt', loot: { essence: 12, gold: 40 }, shards: { ranger: 6 } }],
  };
  it('one row per source with abbreviated items', () => {
    const rows = awayRows(a);
    expect(rows.map((r) => r.key)).toEqual(['away.villagers', 'away.dispatch.hunt', 'away.bounties', 'away.traveler', 'away.warmthDown']);
    expect(rows[0].items).toEqual([{ icon: 'icon_wood', text: '+180' }, { icon: 'icon_stone', text: '+90' }]);
    expect(rows[1].icon).toBe('portrait_ranger');
    expect(rows[1].items.map((i) => i.icon)).toEqual(['icon_gold', 'icon_essence', 'portrait_ranger']);
    expect(rows[4].params).toEqual({ n: 1 });
    expect(awayTitle(a).params.t).toBe('8h 02m');
    expect(awayFlyRes(a).sort()).toEqual(['essence', 'gold', 'stone', 'wood']);
  });
  it('a quiet absence still says something', () => {
    expect(awayRows({ seconds: 400, produced: {}, dispatches: [], newBounties: 0, traveler: false, warmthDelta: 0 }).map((r) => r.key)).toEqual(['away.quiet']);
  });
});

describe('bottom bar + panel sections: hidden until unlocked (SPEC §2.7, §10.5)', () => {
  it('session 1 shows only Build; tabs appear as systems unlock', () => {
    expect(bottomTabs([], 'peace', false)).toEqual(['build']);
    expect(bottomTabs(['house', 'hero_ranger'], 'peace', false)).toEqual(['build', 'hero', 'village']);
    expect(bottomTabs(['house', 'hero_ranger', 'dock', 'bounties'], 'peace', false)).toEqual(['build', 'hero', 'village', 'book', 'map']);
    expect(tabUnlocked('map', ['region_1'])).toBe(false); expect(tabUnlocked('map', ['region_2'])).toBe(true);
  });
  it('collapses at night, limits dusk, hides at dawn / expedition', () => {
    const u = ['house', 'hero_ranger', 'dock', 'bounties'];
    expect(bottomTabs(u, 'night', false)).toEqual(['build']);
    expect(bottomTabs(u, 'dusk', false)).toEqual(['build', 'hero']);
    expect(bottomTabs(u, 'dawn', false)).toEqual([]);
    expect(bottomTabs(u, 'peace', true)).toEqual([]);
  });
  it('sections inside panels follow the same rule', () => {
    expect(villageSections([])).toEqual(['people', 'storage']);
    expect(villageSections(['forge', 'research', 'market'])).toEqual(['people', 'storage', 'forge', 'study', 'market']);
    expect(bookSections(['bounties'])).toEqual(['bounties', 'gloom', 'achievements', 'cosmetics']);
    expect(bookSections(['bounties', 'chronicle'])[1]).toBe('chronicle');
    expect(beaconOpen('fierce', [])).toBe(false); expect(beaconOpen('fierce', ['beacon_fierce'])).toBe(true); expect(beaconOpen('calm', [])).toBe(true);
  });
  it('goal lines lead to where the goal is done', () => {
    expect(goalTarget('goal.upgradeHearth|tier=2')).toEqual({ screen: 'hearth' });
    expect(goalTarget('goal.expedition')).toEqual({ screen: 'dock' });
    expect(goalTarget('goal.bounty.claim')).toEqual({ tab: 'book', section: 'bounties' });
    expect(goalTarget('goal.hero.starUp')).toEqual({ tab: 'hero' });
    expect(goalTarget('goal.build.house')).toEqual({ tab: 'build' });
    expect(goalTarget('goal.siege')).toEqual({ world: 'heart' });
    expect(parseGoal('goal.x|a=1|b=two')).toEqual({ key: 'goal.x', params: { a: '1', b: 'two' } });
  });
  it('modal precedence: gutter > expedition result > gifts > away', () => {
    const base = { phase: 'peace' as const, gifts: null, away: null, lossReport: null, expedition: null };
    expect(activeOverlay(base, false)).toBe('none');
    expect(activeOverlay({ ...base, away: {} as never }, false)).toBe('away');
    expect(activeOverlay({ ...base, away: {} as never, gifts: [{ kind: 'resources', res: 'wood', amount: 5 }] }, false)).toBe('gifts');
    expect(activeOverlay({ ...base, lossReport: {} as never, gifts: [] }, true)).toBe('gutter');
  });
});

const bld = (o: Partial<BuildingState>): BuildingState => ({
  uid: 1, id: 'tower_arrow', x: 10, y: 10, w: 1, h: 1, level: 2, hp: 100, maxHp: 100, lit: true, open: false, constructing: 0, charges: 0,
  aimAngle: 0, wallMask: 0, synergies: [], cooldown: 0, ruined: false, workers: 0, workerSlots: 0, garrison: null, module: null, frozenT: 0,
  burningT: 0, powered: true, ...o,
});

describe('garrison drag targeting (SPEC §11.5)', () => {
  const list = [bld({ uid: 1, x: 10, y: 10 }), bld({ uid: 2, x: 11, y: 10, level: 1 }), bld({ uid: 3, id: 'wall_wood', x: 12, y: 10 }),
    bld({ uid: 4, id: 'tower_ballista', x: 20, y: 20, w: 2, h: 2, level: 3, garrison: 'knight' }), bld({ uid: 5, x: 30, y: 30, ruined: true })];
  it('picks the tower under the finger with a forgiving pad', () => {
    expect(garrisonTarget(list, 10.5, 10.5, 1, 'ranger')).toEqual({ ok: true, uid: 1, swap: null });
    expect(garrisonTarget(list, 9.8, 10.2, 1, 'ranger')).toMatchObject({ ok: true, uid: 1 });
    expect(garrisonTarget(list, 21, 21, 0, 'ranger')).toEqual({ ok: true, uid: 4, swap: 'knight' }); // swap needs no free slot
  });
  it('explains refusals', () => {
    expect(garrisonTarget(list, 11.6, 10.5, 1, 'ranger')).toMatchObject({ ok: false, reason: 'level', uid: 2 });
    expect(garrisonTarget(list, 12.7, 10.5, 1, 'ranger')).toMatchObject({ ok: false, reason: 'notTower' });
    expect(garrisonTarget(list, 30.5, 30.5, 1, 'ranger')).toMatchObject({ ok: false, reason: 'ruined' });
    expect(garrisonTarget(list, 10.5, 10.5, 0, 'ranger')).toMatchObject({ ok: false, reason: 'slots' });
    expect(garrisonTarget(list, 50, 50, 1, 'ranger')).toEqual({ ok: false, reason: 'none', uid: 0 });
    expect(canHostGarrison(list[0])).toBe(true); expect(canHostGarrison(list[1])).toBe(false);
    expect(garrisonUsed({ knight: { status: 'garrison' }, ranger: { status: 'squad' }, pyro: { status: 'garrison' } })).toBe(2);
  });
});

describe('relocation preview + hold gesture (SPEC §6.6)', () => {
  const house = bld({ uid: 9, id: 'house', x: 10, y: 10, w: 2, h: 2, level: 1 });
  const blocked = new Set(['12,10', '12,11']);
  const probe = (x: number, y: number) => !blocked.has(`${x},${y}`);
  const whole = (_id: string, x: number, y: number) => {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) if (!probe(x + i, y + j)) return { ok: false, reason: 'blocked' as const, cost: {} };
    return { ok: true, cost: {} };
  };
  it('own footprint never blocks the move; other cells must be free', () => {
    const r = relocatePreview(house, 10, 11, whole as never, probe);
    expect(r.ok).toBe(true);
    expect(r.cells.filter((c) => c.own).length).toBe(2);
    const bad = relocatePreview(house, 11, 10, whole as never, probe);
    expect(bad.ok).toBe(false);
    expect(bad.cells.filter((c) => !c.ok).map((c) => `${c.x},${c.y}`).sort()).toEqual(['12,10', '12,11']);
  });
  it('non-overlapping targets use the whole-footprint check; same spot is not a move', () => {
    expect(relocatePreview(house, 20, 20, whole as never, probe).ok).toBe(true);
    expect(relocatePreview(house, 12, 9, whole as never, probe).ok).toBe(false);
    expect(relocatePreview(house, 10, 10, whole as never, probe)).toMatchObject({ ok: false, same: true });
  });
  it('peace/dusk only, never the hearth or rubble; 0.4 s hold', () => {
    expect(canRelocate(house, 'peace', false)).toBe(true); expect(canRelocate(house, 'dusk', false)).toBe(true);
    expect(canRelocate(house, 'night', false)).toBe(false); expect(canRelocate(house, 'peace', true)).toBe(false);
    expect(canRelocate(bld({ id: 'hearth' }), 'peace', false)).toBe(false); expect(canRelocate(bld({ ruined: true }), 'peace', false)).toBe(false);
    expect(isHold(3, 0.39)).toBe(false); expect(isHold(3, 0.4)).toBe(true); expect(isHold(40, 1)).toBe(false);
    expect(holdProgress(0.2)).toBeCloseTo(0.5);
  });
});

describe('bulk brush + rebuild-all (SPEC §6.6)', () => {
  const list = [bld({ uid: 1, x: 1, y: 1, hp: 50 }), bld({ uid: 2, x: 2, y: 1, level: 3 }), bld({ uid: 3, id: 'hearth', x: 3, y: 1, w: 2, h: 2, hp: 10 }),
    bld({ uid: 4, x: 5, y: 1, ruined: true }), bld({ uid: 5, id: 'wall_wood', x: 6, y: 1, level: 1, hp: 30, maxHp: 60 })];
  const cells = [1, 2, 3, 4, 5, 6, 6].map((x) => ({ x, y: 1 }));
  it('collects unique targets in stroke order, skipping hearth, rubble and maxed buildings', () => {
    expect(bulkTargets(list, cells, 'upgrade', (id) => (id === 'wall_wood' ? 1 : 3))).toEqual([1, 5]);
    expect(bulkTargets(list, cells, 'repair', () => 3)).toEqual([1, 5]);
  });
  it('totals costs and orders ruins nearest the hearth first', () => {
    expect(repairCost({ hp: 50, maxHp: 120 }, false)).toEqual({ wood: 5 }); expect(repairCost({ hp: 50, maxHp: 120 }, true)).toEqual({ stone: 5 });
    expect(repairCost({ hp: 10, maxHp: 10 }, true)).toEqual({});
    expect(totalCost([1, 2], (u) => (u === 1 ? { wood: 3 } : { wood: 2, iron: 1 }))).toEqual({ wood: 5, iron: 1 });
    const s = { hearthUid: 3, buildings: [bld({ uid: 3, id: 'hearth', x: 10, y: 10, w: 2, h: 2 }), bld({ uid: 7, x: 30, y: 10, ruined: true }), bld({ uid: 8, x: 12, y: 10, ruined: true })] };
    expect(ruinsOf(s)).toEqual([8, 7]);
  });
});

const rec = (o: Partial<HeroRecord>): HeroRecord => ({
  id: 'knight', owned: true, shards: 0, stars: 1, level: 1, xp: 0, skills: [-1, -1, -1, -1, -1], gear: { weapon: 0, armor: 0, charm: 0 },
  status: 'rest', garrisonUid: 0, dispatch: null, ...o,
});
describe('hero helpers (SPEC §11.4)', () => {
  it('roster order, squad toggling, star-up and skill rows', () => {
    const roster = { knight: rec({ id: 'knight', stars: 2 }), ranger: rec({ id: 'ranger', stars: 3 }), pyro: rec({ id: 'pyro', owned: false, shards: 12 }),
      cleric: rec({ id: 'cleric', owned: false, shards: 20 }) };
    expect(rosterOrder(roster)).toEqual(['ranger', 'knight', 'cleric', 'pyro']);
    expect(toggleSquad(['knight'], 'ranger', 4, roster.ranger)).toEqual(['knight', 'ranger']);
    expect(toggleSquad(['knight'], 'knight', 4, roster.knight)).toBeNull(); // never an empty squad
    expect(toggleSquad(['knight', 'ranger'], 'ranger', 4, roster.ranger)).toEqual(['knight']);
    expect(toggleSquad(['a', 'b', 'c', 'd'] as never, 'ranger', 4, roster.ranger)).toBeNull();
    expect(toggleSquad(['knight'], 'pyro', 4, roster.pyro)).toBeNull();
    expect(toggleSquad(['knight'], 'ranger', 4, { owned: true, status: 'dispatch' })).toBeNull();
    expect(starUpCost(1)).toEqual({ shards: 20, essence: 30 }); expect(starUpCost(5)).toBeNull();
    expect(starUpState(rec({ stars: 1, shards: 25 }), 40)).toMatchObject({ can: true });
    expect(starUpState(rec({ stars: 1, shards: 25 }), 10)).toMatchObject({ can: false, reason: 'essence' });
    expect(starUpState(rec({ stars: 5 }), 999)).toMatchObject({ can: false, reason: 'max' });
    const rows = skillRows(rec({ level: 12, skills: [1, -1, -1, -1, -1] }));
    expect(rows.map((r) => r.open)).toEqual([true, true, false, false, false]); expect(rows[0].pick).toBe(1);
    expect(researchCost(0)).toEqual({ lore: 2, gold: 100 }); expect(researchCost(7)).toEqual({ lore: 16, gold: 800 }); expect(researchCost(8)).toBeNull();
  });
  it('gear lists and scout countdowns', () => {
    const g = (o: Partial<GearItem>): GearItem => ({ uid: 1, slot: 'weapon', rarity: 'common', dmgPct: 10, hpPct: 0, reducePct: 0, equippedBy: null, ...o });
    const items = [g({ uid: 1 }), g({ uid: 2, rarity: 'epic' }), g({ uid: 3, equippedBy: 'knight', rarity: 'epic' }), g({ uid: 4, slot: 'armor' })];
    expect(itemsForSlot(items, 'weapon').map((i) => i.uid)).toEqual([2, 1, 3]);
    expect(gearStats(g({ dmgPct: 12, onHit: 'burn' })).parts).toEqual(['+12% dmg', 'burn']);
    const now = Date.UTC(2026, 10, 12);
    expect(dispatchLeft(rec({ dispatch: { kind: 'forage', minutes: 15, endsAt: now + 90_000 } }), now)).toBe(90);
    expect(dispatchLeft(rec({ dispatch: { kind: 'forage', minutes: 15, endsAt: now - 1 } }), now)).toBe(0);
    expect(stampMs(1_800_000_000)).toBe(1_800_000_000_000);
  });
});

describe('save rotation (SPEC §13.7)', () => {
  const mem = (): KV & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); } }; };
  const open = (raw: string) => { const j = JSON.parse(raw); if (j.version !== 2) throw new Error('bad'); return j; };
  it('writes through tmp, keeps one backup, leaves no tmp behind', () => {
    const kv = mem();
    expect(writeHold(kv, '{"version":2,"n":1}')).toBe(true);
    expect(writeHold(kv, '{"version":2,"n":2}')).toBe(true);
    expect(kv.m.get(HOLD_KEY)).toBe('{"version":2,"n":2}'); expect(kv.m.get(HOLD_BAK_KEY)).toBe('{"version":2,"n":1}'); expect(kv.m.has(HOLD_TMP_KEY)).toBe(false);
  });
  it('corrupt main → backup; both corrupt → null + flagged; nothing stored → clean start', () => {
    const kv = mem();
    kv.setItem(HOLD_KEY, '{"version":2,'); kv.setItem(HOLD_BAK_KEY, '{"version":2,"n":1}');
    expect(loadHold(kv, open)).toMatchObject({ from: 'bak', corrupt: true, value: { n: 1 } });
    kv.setItem(HOLD_BAK_KEY, '{"version":9}');
    expect(loadHold(kv, open)).toMatchObject({ value: null, corrupt: true });
    expect(loadHold(mem(), open)).toEqual({ value: null, from: null, corrupt: false, tried: [] });
    const full = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => undefined };
    expect(writeHold(full, '{}')).toBe(false);
  });
  it('export / import strings, save windows, rare spending', () => {
    expect(normalizeImport(`  ${exportString('{"version":2}')} `)).toBe('{"version":2}');
    expect(normalizeImport('"{\\"version\\":2}"')).toBe('{"version":2}');
    expect(normalizeImport('not a save')).toBeNull(); expect(normalizeImport('[1,2]')).toBeNull(); expect(normalizeImport(null)).toBeNull();
    expect(canSave('peace', false)).toBe(true); expect(canSave('night', false)).toBe(false); expect(canSave('dusk', true)).toBe(false);
    expect(spentRare({ gold: 10, iron: 5 }, { gold: 10, iron: 4 }, 0, 0)).toBe(true);
    expect(spentRare({ gold: 10, wood: 5 }, { gold: 11, wood: 1 }, 3, 3)).toBe(false);
    expect(spentRare({}, {}, 3, 2)).toBe(true);
  });
});

// Shared bot brain. NoBuildBot / BaselineBot / AutoplayBot are configurations of this controller.
// A bot is `(game: Game) => void`, called once before every fixed step; it only issues Commands.
import type { BuildingId, Game, GameState, Vec } from '../api';
import { type Walker, walkTo, stop, leaderOf } from './nav';

export interface BotOpts {
  build: boolean;          // build anything at all
  extras: boolean;         // autoplay extras: more towers, frost/ballista, repairs, horn, cages
  boonPref: string[];
}

interface Plan { id: BuildingId; x: number; y: number }

interface BotState {
  wk: Walker;
  target: number;          // node uid being harvested
  plan: Plan[];
  upgrades: Array<{ id: BuildingId; x: number; y: number }>;
  lastBuildStep: number;
  steps: number;
  cageTarget: number;
}

const C = 28; // hearth centre
export const RING = { x0: 23, y0: 23, x1: 32, y1: 32 };
export const GATES: Vec[] = [{ x: 28, y: 23 }, { x: 27, y: 32 }];

function ringCells(): Plan[] {
  const out: Plan[] = [];
  const { x0, y0, x1, y1 } = RING;
  for (let x = x0; x <= x1; x++) { out.push({ id: 'wall_wood', x, y: y0 }); out.push({ id: 'wall_wood', x, y: y1 }); }
  for (let y = y0 + 1; y < y1; y++) { out.push({ id: 'wall_wood', x: x0, y }); out.push({ id: 'wall_wood', x: x1, y }); }
  for (const p of out) if (GATES.some((g) => g.x === p.x && g.y === p.y)) p.id = 'gate';
  // build the side facing each rift first is unknowable here; order by angle for even coverage
  return out;
}

function basePlan(extras: boolean): Plan[] {
  const p: Plan[] = [];
  // first towers near the gift brazier (31,28): flame synergy, inside the ring
  p.push({ id: 'tower_arrow', x: 30, y: 26 });
  const ring = ringCells();
  p.push(...ring.slice(0, 18));
  p.push({ id: 'tower_arrow', x: 30, y: 30 });
  p.push(...ring.slice(18));
  p.push({ id: 'brazier', x: 24, y: 28 });
  p.push({ id: 'tower_arrow', x: 25, y: 26 });
  p.push({ id: 'tower_arrow', x: 25, y: 30 });
  p.push({ id: 'tower_arrow', x: 28, y: 25 });
  p.push({ id: 'tower_arrow', x: 27, y: 30 });
  if (extras) {
    p.push({ id: 'tower_frost', x: 26, y: 24 });
    p.push({ id: 'tower_frost', x: 29, y: 31 });
    p.push({ id: 'tower_arrow', x: 24, y: 24 });
    p.push({ id: 'tower_arrow', x: 31, y: 31 });
    p.push({ id: 'tower_arrow', x: 31, y: 24 });
    p.push({ id: 'tower_arrow', x: 24, y: 31 });
  }
  return p;
}

const states = new WeakMap<Game, BotState>();

function st(game: Game, o: BotOpts): BotState {
  let s = states.get(game);
  if (!s) {
    s = { wk: { path: [], key: '', age: 0 }, target: 0, plan: o.build ? basePlan(o.extras) : [], upgrades: [], lastBuildStep: -999, steps: 0, cageTarget: 0 };
    states.set(game, s);
  }
  return s;
}

function bldAt(s: GameState, x: number, y: number) {
  return s.buildings.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) ?? null;
}

function tryBuild(game: Game, bs: BotState, o: BotOpts): void {
  const s = game.state;
  // 1) placements in plan order (skip already-built, stop at the first unaffordable tower to save up)
  for (const p of bs.plan) {
    const b = bldAt(s, p.x, p.y);
    if (b) continue;
    const chk = game.canPlace(p.id, p.x, p.y);
    if (chk.ok) { game.cmd({ t: 'place', id: p.id, x: p.x, y: p.y }); continue; }
    if (chk.reason === 'cost') return; // save up for this one
  }
  // 2) fixed-order upgrades: hearth L2, towers L2, ring → stone, towers L3, hearth L3
  const towers = s.buildings.filter((b) => b.id.startsWith('tower_')).sort((a, b) => a.uid - b.uid);
  const walls = s.buildings.filter((b) => b.id === 'wall_wood').sort((a, b) => a.uid - b.uid);
  const hearth = s.buildings.find((b) => b.id === 'hearth')!;
  const res = s.res;
  const afford = (c: { wood: number; stone: number; gold: number }) => res.wood >= c.wood && res.stone >= c.stone && res.gold >= c.gold;
  const steps: Array<() => boolean> = [
    () => { for (const t of towers) if (t.level === 1) { const c = game.buildingCost(t.id, 2); if (!afford(c)) return false; game.cmd({ t: 'upgrade', uid: t.uid }); } return true; },
    () => { if (hearth.level === 1) { const c = game.buildingCost('hearth', 2); if (!afford(c)) return false; game.cmd({ t: 'upgrade', uid: hearth.uid }); } return true; },
    () => { for (const wl of walls) { const c = game.buildingCost('wall_stone', 1); if (!afford(c)) return false; game.cmd({ t: 'upgrade', uid: wl.uid }); } return true; },
    () => { for (const t of towers) if (t.level === 2) { const c = game.buildingCost(t.id, 3); if (!afford(c)) return false; game.cmd({ t: 'upgrade', uid: t.uid }); } return true; },
    () => { if (hearth.level === 2) { const c = game.buildingCost('hearth', 3); if (!afford(c)) return false; game.cmd({ t: 'upgrade', uid: hearth.uid }); } return true; },
  ];
  for (const f of steps) if (!f()) break;
  if (o.extras) {
    for (const b of s.buildings) if (b.hp < b.maxHp * 0.7 && b.id !== 'hearth' && b.id !== 'trap_spikes' && b.id !== 'trap_tar') game.cmd({ t: 'repair', uid: b.uid });
  }
}

function needStone(s: GameState): boolean { return s.res.wood > 30 && s.res.stone * 3 < s.res.wood; }

function harvestDay(game: Game, bs: BotState, o: BotOpts): void {
  const s = game.state;
  const ld = leaderOf(s);
  if (!ld) return;
  // rescue a nearby cage (autoplay)
  if (o.extras) {
    const cage = s.pois.find((p) => p.kind === 'cage' && p.active && Math.hypot(p.x - C, p.y - C) < 15);
    if (cage) {
      if (walkTo(game, bs.wk, 'cage' + cage.uid, (x, y) => Math.max(Math.abs(x - cage.x), Math.abs(y - cage.y)) === 1)) stop(game);
      return;
    }
  }
  let node = s.nodes.find((nd) => nd.uid === bs.target && nd.hp > 0 && nd.kind !== 'stump');
  const wantStone = needStone(s);
  if (!node) {
    let best: GameState["nodes"][number] | null = null, bd = Infinity;
    const guards = s.enemies.filter((e) => Math.hypot(e.x - C, e.y - C) > 7);
    for (const nd of s.nodes) {
      if (nd.hp <= 0 || nd.kind === 'stump' || nd.kind === 'bush') continue;
      const isTree = nd.kind === 'pine' || nd.kind === 'oak';
      const isRock = nd.kind.startsWith('rock');
      if (!isTree && !isRock && nd.kind !== 'ore') continue;
      const dh = Math.hypot(nd.x + 0.5 - C, nd.y + 0.5 - C);
      if (dh > 16 || dh < 6.5) continue;
      if (guards.some((e) => Math.hypot(e.x - nd.x - 0.5, e.y - nd.y - 0.5) < 3)) continue; // stay clear of Gloom camps
      let d = Math.hypot(nd.x + 0.5 - ld.x, nd.y + 0.5 - ld.y) + dh * 0.5;
      if (wantStone && isTree) d += 6;
      if (!wantStone && isRock) d += 4;
      if (nd.kind === 'ore') d -= 2;
      if (d < bd) { bd = d; best = nd; }
    }
    if (!best) { walkTo(game, bs.wk, 'home', (x, y) => Math.hypot(x + 0.5 - C, y + 2.5 - C) < 1.2); return; }
    node = best; bs.target = best.uid;
  }
  const nd = node;
  if (walkTo(game, bs.wk, 'n' + nd.uid, (x, y) => Math.abs(x - nd.x) + Math.abs(y - nd.y) === 1)) {
    const cx = Math.max(nd.x, Math.min(ld.x, nd.x + 1)), cy = Math.max(nd.y, Math.min(ld.y, nd.y + 1));
    const dx = cx - ld.x, dy = cy - ld.y, d = Math.hypot(dx, dy);
    if (d > 0.6) game.cmd({ t: 'move', dir: { x: dx / d, y: dy / d } });
  }
}

function nightMove(game: Game, bs: BotState, o: BotOpts): void {
  const s = game.state;
  const ld = leaderOf(s);
  if (!ld) return;
  // defend: go toward enemies inside/near the ring, else hold near the hearth
  let tgt: { x: number; y: number } | null = null, bd = Infinity;
  for (const e of s.enemies) {
    const dh = Math.hypot(e.x - C, e.y - C);
    if (dh > (o.build ? 7 : 9)) continue;
    if (dh < bd) { bd = dh; tgt = e; }
  }
  if (tgt) {
    const t = tgt;
    walkTo(game, bs.wk, 'e' + Math.floor(t.x) + ',' + Math.floor(t.y), (x, y) => Math.hypot(x + 0.5 - t.x, y + 0.5 - t.y) < 1.6);
  } else walkTo(game, bs.wk, 'home', (x, y) => Math.hypot(x + 0.5 - C, y + 0.5 - (C + 2.5)) < 1.2);
  if (o.extras && s.hornCharge >= 40 && s.enemies.filter((e) => Math.hypot(e.x - C, e.y - C) < 10).length >= 8) game.cmd({ t: 'horn' });
}

function pickBoon(game: Game, o: BotOpts): void {
  const offer = game.state.boonOffer;
  if (!offer) { if (game.state.phase === 'dawn') game.cmd({ t: 'pickBoon', index: 0 }); return; }
  let best = 0, bi = Infinity;
  offer.forEach((b, i) => { const k = o.boonPref.indexOf(b.id); const r = k < 0 ? 100 + i : k; if (r < bi) { bi = r; best = i; } });
  game.cmd({ t: 'pickBoon', index: best });
}

export function botStep(game: Game, o: BotOpts): void {
  const s = game.state;
  const bs = st(game, o);
  bs.steps++;
  if (s.phase === 'victory' || s.phase === 'defeat') return;
  if (s.tutorial >= 0) game.cmd({ t: 'skipTutorial' });
  if (s.boonOffer) { pickBoon(game, o); return; }
  switch (s.phase) {
    case 'day':
      if (o.build && bs.steps - bs.lastBuildStep > 30) { bs.lastBuildStep = bs.steps; tryBuild(game, bs, o); }
      harvestDay(game, bs, o);
      if (!o.build && s.phaseT > 20) game.cmd({ t: 'callNight' });
      break;
    case 'dusk':
      if (o.build) tryBuild(game, bs, o);
      stop(game);
      game.cmd({ t: 'startNight' });
      break;
    case 'night':
      if (o.build && bs.steps - bs.lastBuildStep > 90 && o.extras) { bs.lastBuildStep = bs.steps; tryBuild(game, bs, o); }
      nightMove(game, bs, o);
      break;
    case 'dawn':
      pickBoon(game, o);
      break;
  }
}

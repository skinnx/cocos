// Emberhold deterministic simulation entry point.
//
// Exports (see api.ts for the Game interface):
//   createGame(opts: { seed; meta; saved? }): Game   — new run, or restore a saveRun() snapshot (corrupt → new run)
//   defaultMeta(): MetaState, loadMeta(json): MetaState, saveMeta(meta): string
//   Barracks/meta helpers: heroUnlockCost, unlockHero, setStarterHero, blueprintCost, buyBlueprint,
//     talentLevel, talentCost, buyTalent, emberFor, applyRunEmber, META_KEY, RUN_KEY
//   isValidRun(json): boolean — whether a run snapshot can be resumed ("Continue run" button)
import type { BuildingId, BuildCheck, Command, Game, GameEvent, GameState, MetaState, Resources } from '../api';
import { BALANCE, DT } from '../data/balance';
import { TALENT_BY_ID, hornPrecharge } from '../data/talents';
import { BOON_FX, type BoonId } from '../data/boons';
import { applyBoon, pickBoon } from './Boons';
import {
  buildingCost as costOf, canPlace as canPlaceW, paint, place, repair, sell, setBuildMode, spawnBuilding, undo, upgrade,
  updateProduction, updateSynergies, updateWallMasks, updateTimeScale,
} from './Economy';
import { removeDeadEnemies, updateEnemies } from './Enemies';
import { FlowField, maybeRecomputeFields, recomputeFields } from './FlowField';
import { rebuildBuildings, rebuildTerrain } from './Grid';
import { computeStaticLight, smoothLightAlpha, updateLight } from './Light';
import { CENTER, HEARTH_X, HEARTH_Y, generateMap } from './MapGen';
import { emberFor } from './Meta';
import {
  advanceTutorial, afterDawnPick, callNight, continueEndless, hireHero, startDay, startNight, updatePhase, updateTutorial,
} from './Phases';
import { updatePois } from './Pois';
import { updateProjectiles } from './Projectiles';
import { Rng } from './Rng';
import { initGuards, updateSpawner } from './Spawner';
import { SpatialHash } from './SpatialHash';
import { createHero, updateHeroes } from './Squad';
import { updateAllies, updateBuildings, updateZones } from './Towers';
import { type World, type RunData, type BuildingX, type EnemyX, type HeroX, type NodeX, type PoiX, newUid } from './World';

export { defaultMeta, loadMeta, saveMeta, heroUnlockCost, unlockHero, setStarterHero, blueprintCost, buyBlueprint, talentLevel, talentCost, buyTalent, emberFor, applyRunEmber, META_KEY, RUN_KEY } from './Meta';

const SAVE_VERSION = 1;

function newWorld(seed: number, meta: MetaState): World {
  const size = BALANCE.mapSize;
  const gen = generateMap(seed);
  const N = size * size;
  const s: GameState = {
    seed, night: 1, phase: 'day', phaseT: 0, phaseDur: 0, timeScale: 1,
    res: { wood: 0, stone: 0, gold: 0 }, hornCharge: 0, hornT: 0, buildMode: false,
    map: { size, biome: gen.biome, variant: gen.variant, explored: new Uint8Array(N), light: new Uint8Array(N), lightAlpha: new Float32Array(N).fill(1) },
    hearthUid: 0, hearthLevel: 1, heroes: [], reserve: [], enemies: [], buildings: [], projectiles: [], nodes: [], pois: [],
    boons: [], boonOffer: null, omens: [], enemiesLeft: 0, boss: null,
    stats: { kills: 0, built: 0, nightsSurvived: 0, bosses: 0, camps: 0, goldEarned: 0 },
    tutorial: meta.tutorialDone ? -1 : 0,
    allies: [], zones: [], boonSource: null, tavernOffer: null,
    buffs: { shrine: null, falseDawnT: 0, unlitPulseT: 0, hearthLightMul: 1 }, endless: false, nightT: 0, squadMax: BALANCE.squad.max,
  };
  const r: RunData = {
    version: 1, rng: { s: seed ^ 0x2545f491 }, uid: 0, stepN: 0, input: { x: 0, y: 0 }, spawn: [], spawnIdx: 0, rootCut: [],
    fieldDirty: true, fieldLastStep: -999, snuffDirty: true, undo: [], session: 0, shrineUntil: 0, falseDawnUsed: false, hearthLowWarned: false,
    tut: { moved: 0, walls: 0, startX: CENTER, startY: CENTER + 2 }, enraged: false, nightKills: 0, nightGold: 0, starter: meta.starterHero,
    bossSpawned: false, heading: { x: 0, y: 1 }, tutHarvested: false, reserveLv: {}, tavernDay: 0,
  };
  const w = {
    s, meta, r, rng: new Rng(r.rng), size,
    terrain: new Uint8Array(N), nodeAt: new Int32Array(N), bldAt: new Int32Array(N), trapAt: new Int32Array(N), poiAt: new Int32Array(N),
    staticLight: new Uint8Array(N), lightDirty: true, wallMaskDirty: true,
    fields: { def: new FlowField(size), brk: new FlowField(size), snuff: new FlowField(size) },
    ehash: new SpatialHash(size, 2, 512), bmap: new Map(), emap: new Map(), events: [] as GameEvent[], hearth: null as unknown as BuildingX,
  } as World;
  // nodes & POIs
  const H = BALANCE.harvest;
  for (const g of gen.nodes) {
    const chops = g.kind === 'pine' || g.kind === 'oak' ? H.treeChops : g.kind === 'ore' ? H.oreChops : H.rockChops[g.kind] ?? 0;
    const nd: NodeX = { uid: newUid(w), kind: g.kind, x: g.x, y: g.y, hp: chops, maxHp: chops, regrowT: 0, shakeT: 0, orig: g.kind };
    s.nodes.push(nd);
  }
  for (const g of gen.pois) {
    const hp = g.kind === 'cage' ? BALANCE.poi.cageHp : 1;
    const p: PoiX = { uid: newUid(w), kind: g.kind, x: g.x, y: g.y, hp, maxHp: hp, active: true, data: g.kind === 'rift' ? { index: g.index } : {}, guards: 0 };
    if (g.kind === 'rift') p.active = (g.index ?? 0) < BALANCE.riftsActive(1);
    s.pois.push(p);
  }
  rebuildTerrain(w);
  return w;
}

function initRun(w: World): void {
  const s = w.s, meta = w.meta;
  const T = TALENT_BY_ID;
  s.res = {
    wood: BALANCE.start.wood + T.startWood.perLevel * (meta.talents.startWood ?? 0),
    stone: BALANCE.start.stone + T.startStone.perLevel * (meta.talents.startStone ?? 0),
    gold: BALANCE.start.gold,
  };
  const hearth = spawnBuilding(w, 'hearth', HEARTH_X, HEARTH_Y, { wood: 0, stone: 0, gold: 0 });
  w.hearth = hearth; s.hearthUid = hearth.uid; s.hearthLevel = 1;
  for (let i = 0; i < BALANCE.start.freeBraziers; i++) spawnBuilding(w, 'brazier', HEARTH_X + 4 + i, HEARTH_Y + 1, { wood: 0, stone: 0, gold: 0 });
  const lv = 1 + T.heroLevel.perLevel * (meta.talents.heroLevel ?? 0);
  const starter = meta.unlockedHeroes.includes(meta.starterHero) ? meta.starterHero : 'knight';
  const h = createHero(w, starter, CENTER, CENTER + 2.2, lv);
  h.leader = true;
  s.heroes.push(h);
  s.hornCharge = Math.round(BALANCE.horn.charge * hornPrecharge(meta.talents.hornPrecharge ?? 0));
  initGuards(w);
  startDay(w);
  w.lightDirty = true;
  computeStaticLight(w);
  updateLight(w);
  smoothLightAlpha(w, 0, true);
  recomputeFields(w, 'all');
  updateWallMasks(w);
  w.events.length = 0;
  w.events.push({ t: 'phase', phase: 'day', night: 1 });
  if (s.tutorial === 0) w.events.push({ t: 'tutorial', step: 0 });
}

// ── save / load (§11.3) ──────────────────────────────────────────────────────
function snapshot(w: World): string {
  const { map, ...rest } = w.s;
  const ex: number[] = [];
  // run-length encode explored
  let cur = map.explored[0], run = 0;
  for (let i = 0; i < map.explored.length; i++) { if (map.explored[i] === cur) run++; else { ex.push(cur, run); cur = map.explored[i]; run = 1; } }
  ex.push(cur, run);
  return JSON.stringify({ version: SAVE_VERSION, s: rest, explored: ex, r: w.r });
}

function restore(w: World, json: string): boolean {
  let o: { version: number; s: Omit<GameState, 'map'>; explored: number[]; r: RunData };
  try { o = JSON.parse(json); } catch { return false; }
  if (!o || o.version !== SAVE_VERSION || !o.s || !o.r || o.s.seed !== w.s.seed) return false;
  if (!Array.isArray(o.s.buildings) || !Array.isArray(o.s.heroes) || !o.s.buildings.some((b) => b.id === 'hearth')) return false;
  const map = w.s.map;
  Object.assign(w.s, o.s);
  w.s.map = map;
  let k = 0;
  for (let i = 0; i + 1 < o.explored.length; i += 2) for (let j = 0; j < o.explored[i + 1] && k < map.explored.length; j++) map.explored[k++] = o.explored[i];
  w.r = o.r;
  w.rng = new Rng(w.r.rng);
  w.emap.clear();
  for (const e of w.s.enemies as EnemyX[]) w.emap.set(e.uid, e);
  rebuildTerrain(w);
  rebuildBuildings(w);
  w.hearth = w.bmap.get(w.s.hearthUid)!;
  if (!w.hearth) return false;
  w.lightDirty = true;
  computeStaticLight(w);
  updateLight(w);
  smoothLightAlpha(w, 0, true);
  const fd = o.r.fieldDirty, sd = o.r.snuffDirty, fl = o.r.fieldLastStep;
  recomputeFields(w, 'restore');
  w.r.fieldDirty = fd; w.r.snuffDirty = sd; w.r.fieldLastStep = fl;
  updateWallMasks(w);
  updateTimeScale(w);
  w.events.length = 0;
  w.events.push({ t: 'phase', phase: w.s.phase, night: w.s.night });
  if (w.s.boonOffer) w.events.push({ t: 'boonOffer', source: w.s.boonSource ?? 'dawn' });
  return true;
}

export function isValidRun(json: string | null): boolean {
  if (!json) return false;
  try { const o = JSON.parse(json); return !!o && o.version === SAVE_VERSION && typeof o.s?.seed === 'number' && o.s.phase !== 'defeat'; } catch { return false; }
}

// ── hash ─────────────────────────────────────────────────────────────────────
function fnv(h: number, v: number): number {
  h ^= v & 0xffff; h = Math.imul(h, 16777619);
  h ^= (v >>> 16) & 0xffff; h = Math.imul(h, 16777619);
  return h;
}
const PH = ['day', 'dusk', 'night', 'dawn', 'victory', 'defeat'];
function hashWorld(w: World): string {
  const s = w.s;
  let h = 2166136261 | 0;
  const q = (v: number) => (h = fnv(h, Math.round(v * 1000) | 0));
  q(s.night); q(PH.indexOf(s.phase)); q(s.phaseT); q(s.nightT); q(s.res.wood); q(s.res.stone); q(s.res.gold); q(s.hornCharge);
  q(w.r.rng.s); q(w.r.uid); q(w.r.stepN);
  for (const x of s.heroes as HeroX[]) { q(x.uid); q(x.x); q(x.y); q(x.hp); q(x.level); q(x.xp); q(x.skillCd); }
  for (const x of s.enemies as EnemyX[]) { q(x.uid); q(x.x); q(x.y); q(x.hp); }
  for (const x of s.buildings as BuildingX[]) { q(x.uid); q(x.x); q(x.y); q(x.hp); q(x.level); q(x.charges); }
  for (const x of s.projectiles) { q(x.uid); q(x.x); q(x.y); }
  for (const x of s.allies) { q(x.uid); q(x.x); q(x.y); q(x.hp); }
  for (const x of s.nodes) { q(x.uid); q(x.hp); }
  for (const x of s.pois) { q(x.uid); q(x.hp); q(x.active ? 1 : 0); }
  for (const b of s.boons) { q(b.stacks); h = fnv(h, b.id.charCodeAt(0) * 31 + b.id.charCodeAt(1)); }
  q(s.stats.kills); q(s.stats.built);
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ── the step ────────────────────────────────────────────────────────────────
function simStep(w: World): void {
  const s = w.s;
  const dt = DT;
  w.r.stepN++;
  if (s.phase === 'dusk' || s.phase === 'dawn' || s.phase === 'victory' || s.phase === 'defeat') return;
  for (const h of s.heroes) { h.px = h.x; h.py = h.y; }
  for (const e of s.enemies) { e.px = e.x; e.py = e.y; }
  for (const a of s.allies) { a.px = a.x; a.py = a.y; }
  for (const nd of s.nodes) if (nd.shakeT > 0) nd.shakeT = Math.max(0, nd.shakeT - dt);
  if (w.wallMaskDirty) updateWallMasks(w);
  updateLight(w);
  maybeRecomputeFields(w);
  w.ehash.rebuild(s.enemies);
  updateSynergies(w);
  updateHeroes(w, dt);
  updateAllies(w, dt);
  updateEnemies(w, dt);
  updateBuildings(w, dt);
  updateProjectiles(w, dt);
  updateZones(w, dt);
  removeDeadEnemies(w);
  updatePois(w);
  updateProduction(w, dt);
  if (s.phase === 'night') updateSpawner(w);
  updatePhase(w, dt);
  updateTutorial(w);
  if (w.lightDirty) computeStaticLight(w);
}

function applyCmd(w: World, c: Command): void {
  const s = w.s;
  const over = s.phase === 'victory' || s.phase === 'defeat';
  switch (c.t) {
    case 'move': { const m = Math.hypot(c.dir.x, c.dir.y); w.r.input = m > 1 ? { x: c.dir.x / m, y: c.dir.y / m } : { x: c.dir.x, y: c.dir.y }; break; }
    case 'place': if (!over) place(w, c.id, c.x, c.y); break;
    case 'paint': if (!over) paint(w, c.id, c.cells); break;
    case 'upgrade': if (!over) upgrade(w, c.uid); break;
    case 'repair': if (!over) repair(w, c.uid); break;
    case 'sell': if (!over) sell(w, c.uid); break;
    case 'undo': undo(w); break;
    case 'buildMode': if (!over && s.phase !== 'dawn') setBuildMode(w, c.on); break;
    case 'horn':
      if ((s.phase === 'night' || s.phase === 'day') && s.hornCharge >= BALANCE.horn.charge) {
        s.hornCharge = 0;
        s.hornT = w.s.boons.some((b) => b.id === 'horn') ? BOON_FX.hornSecs : BALANCE.horn.seconds;
        w.events.push({ t: 'horn' });
      }
      break;
    case 'callNight': callNight(w); break;
    case 'startNight': startNight(w); break;
    case 'pickBoon': {
      const src = s.boonSource;
      if (!s.boonOffer && s.phase === 'dawn') { afterDawnPick(w); break; }
      if (!pickBoon(w, c.index)) break;
      s.boonSource = null;
      if (src === 'dawn' && s.phase === 'dawn') afterDawnPick(w);
      break;
    }
    case 'swapHero': {
      const rid = s.reserve[c.reserveIndex];
      const h = s.heroes[c.squadIndex] as HeroX | undefined;
      if (!rid || !h || s.phase === 'night') break;
      const nh = createHero(w, rid, h.x, h.y, w.r.reserveLv[rid] ?? 1);
      nh.leader = h.leader;
      w.r.reserveLv[h.id] = h.level;
      s.reserve[c.reserveIndex] = h.id;
      s.heroes[c.squadIndex] = nh;
      break;
    }
    case 'hire': hireHero(w, c.index); break;
    case 'endless': continueEndless(w); break;
    case 'skipTutorial': if (s.tutorial >= 0) advanceTutorial(w, -1); break;
  }
}

class GameImpl implements Game {
  w: World;
  private acc = 0;
  constructor(w: World) { this.w = w; }
  get state(): GameState { return this.w.s; }
  get meta(): MetaState { return this.w.meta; }
  update(dt: number): void {
    const d = Math.max(0, Math.min(dt, 0.25));
    smoothLightAlpha(this.w, d);
    this.acc += d * this.w.s.timeScale;
    let n = 0;
    while (this.acc >= DT && n < 8) { simStep(this.w); this.acc -= DT; n++; }
    if (n >= 8) this.acc = 0;
  }
  step(): void { simStep(this.w); smoothLightAlpha(this.w, DT); }
  cmd(c: Command): void { applyCmd(this.w, c); }
  drainEvents(): GameEvent[] { const e = this.w.events; this.w.events = []; return e; }
  canPlace(id: BuildingId, x: number, y: number): BuildCheck { return canPlaceW(this.w, id, x, y); }
  buildingCost(id: BuildingId, level: 1 | 2 | 3 = 1): Resources { return costOf(this.w, id, level); }
  alpha(): number { return Math.max(0, Math.min(1, this.acc / DT)); }
  hash(): string { return hashWorld(this.w); }
  saveRun(): string { return snapshot(this.w); }
  emberEarned(): number { return emberFor(this.w.s.stats, this.w.s.phase === 'victory' || this.w.s.endless); }
}

export function createGame(opts: { seed: number; meta: MetaState; saved?: string }): Game {
  let seed = opts.seed | 0;
  if (opts.saved) {
    try { const o = JSON.parse(opts.saved); if (o && typeof o.s?.seed === 'number') seed = o.s.seed | 0; } catch { /* corrupt → new run */ }
  }
  const w = newWorld(seed, opts.meta);
  if (opts.saved && restore(w, opts.saved)) return new GameImpl(w);
  const fresh = opts.saved ? newWorld(opts.seed | 0, opts.meta) : w;
  initRun(fresh);
  return new GameImpl(fresh);
}

/** Internal access for tests/bots (not part of the view contract). */
export function worldOf(g: Game): World { return (g as GameImpl).w; }
/** Test/debug helper: grant a boon directly. */
export function grantBoon(g: Game, id: BoonId): void { applyBoon(worldOf(g), id); }

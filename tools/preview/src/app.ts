// Preview application shell (v2 "persistent Hold"): canvas + pixel scale, main loop, real-time clock, Hold
// persistence (SPEC §13.7), camera, input routing, event → juice/audio.
import { Atlas } from './atlas';
import { Audio } from './audio';
import {
  createHold, defaultSettings, loadSettings, saveSettings, HOLD_KEY, HOLD_BAK_KEY, SETTINGS_KEY,
  type AwaySummary, type Command, type Game, type GameEvent, type GameState, type Settings,
} from './core';
import { BitmapFont, COL } from './font';
import { Fx } from './fx';
import { BuildUI } from './build';
import { drawHud, hudResTarget } from './hud';
import { drawScreens } from './screens';
import { basePixelScale, smoothFactor, lookAhead, clampCamera, zoomSteps, pinchStep } from './shared';
import { UI } from './ui';
import { T, WorldRenderer, type Cam } from './world';
import { tr as trs, setLang } from './strings';
import { Autoplay } from './autoplay';
import { Clock } from './clock';
import { resIcon } from './sprites2';

export type Screen = 'loading' | 'title' | 'settings' | 'game';
export type Panel = 'hero' | 'village' | 'forge' | 'study' | 'market' | 'storage' | 'book' | 'map' | 'dock' | 'building' | 'pause';

interface Pointer { id: number; x: number; y: number; sx: number; sy: number; t0: number; moved: boolean; role: 'joy' | 'ui' | 'build' | 'pan' | 'none'; hitId?: string }

const LEGACY_META_KEY = 'emberhold.meta.v1';
const PEACE_SAVE_SEC = 20;

export class App {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  buf = document.createElement('canvas');
  b: CanvasRenderingContext2D;
  n = 2; zoomIdx = 1; W = 195; H = 422; dpr = 1;
  safe = { t: 0, b: 0, l: 0, r: 0 };
  atlas = new Atlas();
  font: BitmapFont;
  fx: Fx;
  world: WorldRenderer;
  ui: UI;
  audio = new Audio();
  build: BuildUI;
  autoplay: Autoplay;
  clock = new Clock();

  screen: Screen = 'loading';
  settingsFrom: Screen = 'title';
  panel: Panel | null = null;
  panelArg: number | string | null = null;
  paused = false;
  game: Game | null = null;
  settings: Settings;
  seedN = 1;
  speed = 1;
  time = 0;
  cam = { x: 0, y: 0 }; // world art px at screen centre
  moveDir = { x: 0, y: 0 };
  sentDir = { x: 0, y: 0 };
  keys = new Set<string>();
  pointers = new Map<number, Pointer>();
  joy: { ox: number; oy: number; kx: number; ky: number } | null = null;
  pinch: { d0: number; idx0: number } | null = null;
  tutorialHidden = false;
  omensOpen = true;
  goalsOpen = false;
  errors: string[] = [];
  frameTimes: number[] = [];
  lastPhase = '';
  lastExp = false;
  bossIntro: { name: string; t: number } | null = null;
  /** away summary shown after Title (SPEC §2.3) */
  away: AwaySummary | null = null;
  awayCollected = false;
  /** unlock cards queued (SPEC §10.5 "one card per new system") */
  unlockCards: string[] = [];
  /** dusk garrison assignment: selected hero waiting for a tower tap */
  garrisonPick: string | null = null;
  /** debug/e2e camera override (tile units) */
  camFocus: { x: number; y: number } | null = null;
  /** title backdrop */
  backdrop: Game | null = null;
  tickAcc = 0;
  saveAcc = 0;
  savedAt = 0;
  storageFullT = 0;
  expTickLast = -1;
  musicDay = 0;
  lastSave: string | null = null;
  /** the loss report the player already closed (the core keeps it on the state until the next night) */
  gutterSeen: unknown = null;

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.b = this.buf.getContext('2d')!;
    this.font = new BitmapFont(this.atlas);
    this.fx = new Fx(this.atlas, this.font);
    this.world = new WorldRenderer(this.atlas, this.fx);
    this.ui = new UI(this.atlas, this.font, this.b);
    this.build = new BuildUI(this);
    this.autoplay = new Autoplay(this);
    this.settings = this.readSettings();
    setLang(this.settings.lang);
  }

  get state(): GameState | null { return this.game ? this.game.state : null; }
  tr(key: string, params?: Record<string, string | number>) { return trs(key, params); }
  unlocked(k: string): boolean { const s = this.state; return !!s && (s.unlocked as string[]).includes(k); }

  // ── persistence (SPEC §13.7) ─────────────────────────────────────────────
  private ls(): Storage | null { try { return window.localStorage; } catch { return null; } }
  readSettings(): Settings {
    let raw: string | null = null;
    try { raw = this.ls()?.getItem(SETTINGS_KEY) ?? null; } catch { /* blocked */ }
    try { return raw ? loadSettings(raw) : defaultSettings(); } catch { return defaultSettings(); }
  }
  saveSettingsNow() { try { this.ls()?.setItem(SETTINGS_KEY, saveSettings(this.settings)); } catch { /* ignore */ } setLang(this.settings.lang); this.audio.setVolumes(this.settings.music, this.settings.sfx); }
  savedHold(): string | null { try { return this.ls()?.getItem(HOLD_KEY) ?? null; } catch { return null; } }
  /** Write-then-swap with one backup (SPEC §13.7). Never during NIGHT (last save = that night's DUSK) or on an expedition. */
  saveHold(force = false) {
    const g = this.game; if (!g) return false;
    const s = g.state;
    if (!force && (s.phase === 'night' || s.expedition)) return false;
    let json: string;
    try { json = g.save(); } catch (e) { this.reportError(e); return false; }
    const ls = this.ls(); if (!ls) return false;
    try {
      const prev = ls.getItem(HOLD_KEY);
      ls.setItem(HOLD_KEY + '.tmp', json);
      if (prev) ls.setItem(HOLD_BAK_KEY, prev);
      ls.setItem(HOLD_KEY, json);
      ls.removeItem(HOLD_KEY + '.tmp');
      this.lastSave = json; this.savedAt = this.time; this.saveAcc = 0;
      return true;
    } catch { return false; }
  }
  clearHold() { const ls = this.ls(); try { ls?.removeItem(HOLD_KEY); ls?.removeItem(HOLD_BAK_KEY); ls?.removeItem(HOLD_KEY + '.tmp'); } catch { /* ignore */ } }

  /** Title line: "Night N · Threat X · Hearth tier Y" from the saved Hold (no full load needed). */
  holdSummary(): { night: number; tr: number; tier: number } | null {
    const raw = this.savedHold(); if (!raw) return null;
    try {
      const j = JSON.parse(raw);
      const s = j.state ?? j.s ?? j;
      const night = s.night ?? j.night, tr = s.tr ?? j.tr, tier = s.hearthTier ?? j.hearthTier;
      if (typeof night === 'number') return { night, tr: tr ?? 1, tier: tier ?? 1 };
    } catch { /* corrupt: fall through */ }
    return this.game ? { night: this.game.state.night, tr: this.game.state.tr, tier: this.game.state.hearthTier } : null;
  }

  // ── lifecycle ───────────────────────────────────────────────────────────
  async boot() {
    await this.atlas.load('resources');
    this.audio.init('resources').then(() => this.audio.setVolumes(this.settings.music, this.settings.sfx)).catch(() => undefined);
    this.screen = 'title';
    this.fx.fade = 1;
    // title backdrop: the player's own Hold when one is saved, else a fresh island
    try { this.backdrop = this.makeHold(this.savedHold() ?? undefined, 7).game; } catch { try { this.backdrop = this.makeHold(undefined, 7).game; } catch (e) { this.reportError(e); } }
    if (this.backdrop) this.centerOnHearth(this.backdrop.state);
  }

  private makeHold(saved: string | undefined, seed: number): { game: Game; restored: boolean } {
    const now = this.clock.now(), dayKey = this.clock.dayKey();
    let legacy: string | null = null;
    try { legacy = this.ls()?.getItem(LEGACY_META_KEY) ?? null; } catch { /* ignore */ }
    if (saved) {
      try { return { game: createHold({ seed, saved, now, dayKey, legacyMeta: legacy }), restored: true }; }
      catch (e) { console.warn('[preview] Hold save unreadable, trying the backup:', (e as Error).message); }
      let bak: string | null = null;
      try { bak = this.ls()?.getItem(HOLD_BAK_KEY) ?? null; } catch { /* ignore */ }
      if (bak) try { return { game: createHold({ seed, saved: bak, now, dayKey, legacyMeta: legacy }), restored: true }; } catch { /* both broken */ }
      this.fx.banner('Save damaged - a new Hold was started', undefined, COL.red, 4);
    }
    return { game: createHold({ seed, now, dayKey, legacyMeta: legacy }), restored: false };
  }

  /** "Enter the Hold": load (or found) the Hold, settle the time away, show the away summary when ≥ 5 min. */
  enterHold(seed?: number) {
    const urlSeed = /[?&]seed=(\d+)/.exec(location.search);
    const sd = seed ?? (urlSeed ? Number(urlSeed[1]) : (Date.now() % 100000));
    const saved = seed !== undefined ? undefined : this.savedHold() ?? undefined;
    const { game, restored } = this.makeHold(saved, sd);
    this.attach(game);
    if (restored) {
      const sum = game.resume(this.clock.now(), this.clock.dayKey());
      this.away = sum ?? game.state.away ?? null;
      this.awayCollected = false;
    } else this.away = null;
    this.saveHold();
  }

  attach(game: Game) {
    this.game = game;
    this.seedN = game.state.seed;
    this.screen = 'game'; this.paused = false; this.panel = null; this.lastPhase = ''; this.lastExp = !!game.state.expedition;
    this.build.reset(); this.camFocus = null; this.garrisonPick = null; this.unlockCards = [];
    this.fx = Object.assign(this.fx, new Fx(this.atlas, this.font));
    this.world.attacked.clear();
    this.centerOnHearth(game.state);
    this.fx.fade = 1;
    this.playPhaseMusic();
  }

  centerOnHearth(s: GameState) {
    const h = s.buildings.find((b) => b.uid === s.hearthUid);
    if (h) { this.cam.x = (h.x + h.w / 2) * T; this.cam.y = (h.y + h.h / 2) * T; }
  }

  toTitle() {
    this.saveHold();
    this.backdrop = this.game ?? this.backdrop;
    this.game = null; this.camFocus = null; this.screen = 'title'; this.paused = false; this.panel = null; this.autoplay.on = false; this.fx.fade = 1;
    this.build.reset();
    this.audio.music('day');
  }

  cmd(c: Command) { this.game?.cmd(c); }
  alpha() { return this.autoplay.on ? this.autoplay.alpha() : this.game ? this.game.alpha() : 0; }
  openPanel(p: Panel | null, arg: number | string | null = null) {
    this.panel = p; this.panelArg = arg;
    if (p && p !== 'building' && this.build.open && this.state?.phase !== 'dusk') this.build.exit();
    this.joy = null; this.cmd({ t: 'move', dir: { x: 0, y: 0 } }); this.sentDir = { x: 0, y: 0 };
  }

  playPhaseMusic() {
    const s = this.state; if (!s) { this.audio.music('day'); return; }
    if (s.expedition && !s.expedition.result) this.audio.music('expedition');
    else if (s.phase === 'night') this.audio.music(s.boss ? 'boss' : 'night');
    else this.audio.music(s.night % 2 === 0 ? 'day2' : 'day'); // two day loops alternate (SPEC §12 v2)
  }

  // ── layout ──────────────────────────────────────────────────────────────
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round(window.innerWidth * dpr)), ch = Math.max(1, Math.round(window.innerHeight * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    this.dpr = dpr;
    // in the world: the player's pinch step; full-screen panels / title / settings use the n-1 step (more room)
    const full = this.screen !== 'game' || (!!this.panel && this.panel !== 'building' && this.panel !== 'pause');
    const n = zoomSteps(basePixelScale(cw))[full ? 0 : this.zoomIdx];
    this.n = n;
    const W = Math.ceil(cw / n), H = Math.ceil(ch / n);
    if (this.buf.width !== W || this.buf.height !== H) { this.buf.width = W; this.buf.height = H; }
    this.W = W; this.H = H;
    const el = document.getElementById('safe');
    if (el) {
      const r = el.getBoundingClientRect();
      const k = dpr / n;
      this.safe = { t: Math.ceil(r.top * k), l: Math.ceil(r.left * k), b: Math.ceil((window.innerHeight - r.bottom) * k), r: Math.ceil((window.innerWidth - r.right) * k) };
    }
  }
  toArt(cx: number, cy: number): [number, number] { return [Math.floor((cx * this.dpr) / this.n), Math.floor((cy * this.dpr) / this.n)]; }
  camRect(): Cam { return { x: Math.round(this.cam.x - this.W / 2), y: Math.round(this.cam.y - this.H / 2), w: this.W, h: this.H }; }
  screenToTile(px: number, py: number) { const c = this.camRect(); return { x: (px + c.x) / T, y: (py + c.y) / T }; }
  tileToScreen(tx: number, ty: number) { const c = this.camRect(); return { x: tx * T - c.x, y: ty * T - c.y }; }

  // ── main loop ───────────────────────────────────────────────────────────
  private last = 0;
  frame = (now: number) => {
    requestAnimationFrame(this.frame);
    const dtReal = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.frameTimes.push(dtReal); if (this.frameTimes.length > 90) this.frameTimes.shift();
    try { this.tick(dtReal); this.render(); }
    catch (e) { this.reportError(e); }
  };
  reportError(e: unknown) {
    const msg = (e as Error)?.stack || String(e);
    if (this.errors.length < 50) this.errors.push(msg);
    console.error('[preview]', msg);
  }
  fps(): number { const s = this.frameTimes.reduce((a, b) => a + b, 0); return s > 0 ? this.frameTimes.length / s : 0; }

  /** True while a modal stops world time (SPEC §2.2: PEACE pauses in menus). */
  modal(): boolean {
    const s = this.state;
    return this.paused || (!!this.panel && this.panel !== 'building') || (!!this.away && !this.awayCollected) || this.unlockCards.length > 0
      || !!(s && ((s.gifts && s.gifts.length) || (s.lossReport && this.gutterSeen !== s.lossReport) || (s.expedition && s.expedition.result)));
  }

  tick(dt: number) {
    this.resize();
    this.time += dt;
    this.fx.update(dt);
    if (this.screen === 'title' && this.backdrop) { this.backdrop.drainEvents(); return; }
    if (this.screen !== 'game' || !this.game) return;
    const g = this.game, s = g.state;
    // real-time tick ~1/s (dispatch completion, daily rollover)
    this.tickAcc += dt;
    if (this.tickAcc >= 1) { this.tickAcc = 0; try { g.tick(this.clock.now(), this.clock.dayKey()); } catch (e) { this.reportError(e); } }
    if (!this.autoplay.on) this.updateMove();
    const frozen = this.modal() && !this.autoplay.on;
    if (!frozen) {
      if (this.fx.hitStop > 0) this.fx.hitStop -= dt;
      else if (this.autoplay.on) this.autoplay.tick(dt);
      else g.update(dt * this.speed);
    }
    for (const ev of g.drainEvents()) { try { this.onEvent(ev); } catch (e) { this.reportError(e); } }
    for (const [k, v] of this.world.attacked) { if (v - dt <= 0) this.world.attacked.delete(k); else this.world.attacked.set(k, v - dt); }
    if (s.phase !== this.lastPhase) this.onPhase(s.phase, this.lastPhase);
    this.lastPhase = s.phase;
    const inExp = !!s.expedition;
    if (inExp !== this.lastExp) { this.lastExp = inExp; this.onExpedition(inExp); }
    if (s.phase === 'dusk' && !s.expedition && !this.build.open && !this.autoplay.on && !this.panel) this.build.enter();
    if ((s.phase === 'dawn' || s.expedition) && this.build.open) this.build.exit();
    // autosave: every 20 s of PEACE (SPEC §13.7)
    if (s.phase === 'peace' && !s.expedition) { this.saveAcc += dt; if (this.saveAcc >= PEACE_SAVE_SEC) this.saveHold(); }
    // expedition: last-30-s clock ticks
    if (s.expedition && !s.expedition.result) {
      const left = Math.ceil(s.expedition.timeLeft);
      if (left <= 30 && left !== this.expTickLast) { this.expTickLast = left; this.audio.sfx('timer_tick', 0.8); }
    }
    this.updateCamera(dt);
    this.build.tick(dt);
    if (this.bossIntro) { this.bossIntro.t += dt; if (this.bossIntro.t > 1.8) this.bossIntro = null; }
    this.storageFullT = Math.max(0, this.storageFullT - dt);
  }

  updateMove() {
    let dx = 0, dy = 0;
    if (this.joy) {
      const r = 22;
      const jx = (this.joy.kx - this.joy.ox) / r, jy = (this.joy.ky - this.joy.oy) / r;
      const m = Math.hypot(jx, jy);
      if (m > 0.12) { const k = Math.min(1, m) / m; dx = jx * k; dy = jy * k; }
    } else {
      if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
      if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    }
    if ((this.build.open && this.state?.phase === 'dusk') || this.modal()) { dx = 0; dy = 0; }
    this.moveDir = { x: dx, y: dy };
    if (Math.abs(dx - this.sentDir.x) > 0.02 || Math.abs(dy - this.sentDir.y) > 0.02) {
      this.sentDir = { x: dx, y: dy };
      this.cmd({ t: 'move', dir: { x: dx, y: dy } });
    }
  }

  updateCamera(dt: number) {
    const s = this.state!;
    let tx: number, ty: number;
    const hearth = s.expedition ? null : s.buildings.find((b) => b.uid === s.hearthUid);
    const leader = s.heroes.find((h) => h.leader) ?? s.heroes[0];
    if (this.build.open && this.build.freeCam) return;
    if (this.camFocus) { tx = this.camFocus.x * T; ty = this.camFocus.y * T; }
    else if ((s.phase === 'dusk' || !leader) && hearth) { tx = (hearth.x + hearth.w / 2) * T; ty = (hearth.y + hearth.h / 2) * T; }
    else if (leader) {
      const la = lookAhead(this.moveDir);
      const a = this.alpha();
      tx = (leader.px + (leader.x - leader.px) * a + la.x) * T; ty = (leader.py + (leader.y - leader.py) * a + la.y) * T;
    } else return;
    const k = smoothFactor(dt);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    this.clampCam();
  }
  clampCam() {
    const s = this.state; if (!s) return;
    const c = clampCamera({ x: this.cam.x / T, y: this.cam.y / T }, s.map.size, this.W / T, this.H / T, 2);
    this.cam.x = c.x * T; this.cam.y = c.y * T;
  }

  // ── phases ──────────────────────────────────────────────────────────────
  onPhase(p: string, prev: string) {
    const s = this.state!;
    if (p === 'night') {
      const blood = s.moon === 'blood';
      this.fx.banner(blood ? this.tr('banner.blood') : this.tr('banner.night', { n: s.night }), undefined, blood ? COL.red : COL.purple);
      this.audio.sfx('horn_night'); if (blood) this.audio.sfx('blood_moon');
      this.playPhaseMusic();
      this.garrisonPick = null;
    }
    if (p === 'dusk') { this.omensOpen = true; this.fx.banners = []; if (prev) this.saveHold(); }
    if (p === 'dawn') { this.playPhaseMusic(); this.saveHold(); } // SPEC §13.7: save every DAWN
    if (p === 'peace' && prev) {
      this.playPhaseMusic();
      if (prev === 'dawn') { this.fx.banner(this.tr('banner.day', { n: s.night }), undefined, COL.gold, 1.6); this.saveHold(); }
    }
    this.fx.fade = Math.max(this.fx.fade, prev ? 0.6 : 0);
  }

  onExpedition(on: boolean) {
    this.fx.fade = 1; this.expTickLast = -1; this.camFocus = null;
    this.panel = null; this.build.reset();
    const s = this.state!;
    const leader = s.heroes.find((h) => h.leader) ?? s.heroes[0];
    if (leader) { this.cam.x = leader.x * T; this.cam.y = leader.y * T; }
    else this.centerOnHearth(s);
    this.playPhaseMusic();
    if (!on) this.saveHold();
  }

  onEvent(ev: GameEvent) {
    const fx = this.fx, au = this.audio;
    const W = (x: number, y: number) => ({ x: x * T, y: y * T });
    const vib = (ms: number) => { if (this.settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* ignore */ } };
    const s = this.state!;
    const onScreen = (x: number, y: number) => { const c = this.camRect(); return x * T > c.x - 16 && x * T < c.x + c.w + 16 && y * T > c.y - 16 && y * T < c.y + c.h + 16; };
    switch (ev.t) {
      case 'hit': {
        fx.hit(ev.target);
        const p = W(ev.x, ev.y);
        const col = ev.shatter ? COL.ice : ev.crit ? COL.gold : ev.dtype === 'fire' ? COL.fire : ev.dtype === 'frost' ? COL.ice : ev.dtype === 'spark' ? COL.purple : COL.white;
        if (s.buildings.some((b) => b.uid === ev.target)) { this.world.attacked.set(ev.target, 3); if (ev.target === s.hearthUid) vib(20); }
        else {
          const big = ev.crit || ev.shatter;
          fx.number(String(Math.round(ev.amount)) + (big ? '!' : ''), p.x, p.y - 12, col, 7);
          fx.anim('fx_hit', p.x, p.y - 6, 20);
        }
        if (ev.crit) fx.stop(0.04);
        au.sfx('enemy_hit', 0.5);
        break;
      }
      case 'death': {
        const p = W(ev.x, ev.y);
        if (ev.kind === 'enemy') {
          fx.shatter(this.atlas.pick(`enemy_${ev.id}_move_0`, `boss_${ev.id}_walk_0`, `boss_${ev.id}_float_0`), p.x, p.y + 3, 4 + (ev.x * 7 | 0) % 3);
          fx.anim('fx_smoke', p.x, p.y - 4, 12);
          au.sfx('enemy_die', 0.7);
          if (s.boss && ev.uid === s.boss.uid) { fx.shake(4, 0.6); fx.stop(0.08); }
        } else if (ev.kind === 'building') {
          const stone = ev.id.includes('stone') || ev.id.startsWith('tower') || ev.id === 'quarry';
          for (let i = 0; i < 3; i++) fx.anim(stone ? 'fx_chip_stone' : 'fx_chip_wood', p.x + (i - 1) * 5, p.y - 4 - i * 2, 10);
          fx.anim('fx_smoke', p.x, p.y - 6, 10); fx.anim('fx_dust', p.x, p.y, 12);
          fx.shake(2, 0.2); au.sfx('wall_break'); vib(30);
        } else { fx.anim('fx_dust', p.x, p.y, 10); au.sfx('hero_down'); }
        break;
      }
      case 'shoot': au.sfx(`shoot_${ev.kind}`, 0.45); break;
      case 'explode': { const p = W(ev.x, ev.y); fx.anim('fx_explosion', p.x, p.y - 6, 16); fx.shake(ev.radius >= 1.5 ? 3 : 2, 0.25); if (ev.radius >= 1.5) fx.stop(0.04); au.sfx('explode'); vib(25); break; }
      case 'harvest': {
        const p = W(ev.x, ev.y);
        fx.anim(ev.res === 'wood' ? 'fx_chip_wood' : 'fx_chip_stone', p.x, p.y - 8, 12);
        const c = this.camRect(); const [hx, hy] = hudResTarget(this, ev.res);
        fx.fly(resIcon(ev.res), p.x - c.x, p.y - 10 - c.y, hx, hy, 0, () => fx.pulse(ev.res));
        au.sfx(ev.res === 'wood' ? 'chop' : ev.res === 'stone' || ev.res === 'iron' ? 'mine' : 'coin', 0.6);
        break;
      }
      case 'loot': {
        const p = W(ev.x, ev.y), c = this.camRect(); const [hx, hy] = hudResTarget(this, ev.res);
        for (let i = 0; i < Math.min(5, Math.max(1, Math.round(ev.amount / 3))); i++) fx.fly(resIcon(ev.res), p.x - c.x + (i - 2) * 3, p.y - 8 - c.y, hx, hy, i * 0.06, () => fx.pulse(ev.res));
        if (ev.res === 'gold') fx.anim('fx_coin', p.x, p.y - 8, 16, 2);
        au.sfx('coin', 0.5);
        break;
      }
      case 'built': { const p = W(ev.x, ev.y); fx.bounce.set(ev.uid, 0); fx.anim('fx_dust', p.x + 8, p.y + 14, 14); au.sfx('place', 0.8); vib(10); break; }
      case 'buildFail': { const p = W(ev.x, ev.y); fx.number(this.tr(`build.fail.${ev.reason}`), p.x + 8, p.y, COL.red, 5); au.sfx('fail'); break; }
      case 'upgraded': case 'rebuilt': case 'relocated': {
        fx.bounce.set(ev.uid, 0); const b = s.buildings.find((q) => q.uid === ev.uid);
        if (b) { fx.anim(ev.t === 'upgraded' ? 'fx_levelup' : 'fx_dust', (b.x + b.w / 2) * T, (b.y + b.h) * T - 8, 12); }
        au.sfx(ev.t === 'upgraded' ? 'upgrade' : 'place'); break;
      }
      case 'repaired': { const b = s.buildings.find((q) => q.uid === ev.uid); if (b) fx.anim('fx_heal', (b.x + b.w / 2) * T, (b.y + b.h / 2) * T, 8, 2); au.sfx('repair'); break; }
      case 'sold': au.sfx('sell'); break;
      case 'levelUp': { const h = s.heroes.find((q) => q.id === ev.hero); if (h) { fx.anim('fx_levelup', h.x * T, h.y * T - 6, 12, 2); fx.number('LV UP', h.x * T, h.y * T - 18, COL.gold, 5); } au.sfx('levelup'); break; }
      case 'skill': {
        const p = W(ev.x, ev.y);
        const m: Record<string, string> = { shieldBash: 'fx_slash', shadowStep: 'fx_blink', arrowRain: 'fx_hit', miniTurret: 'fx_dust', sanctum: 'fx_heal', fireWall: 'fx_burn', flare: 'fx_flare', barrel: 'fx_barrel_fuse', packCall: 'fx_dust', holdFast: 'fx_levelup' };
        fx.anim(this.atlas.count(m[ev.skill] ?? 'fx_hit') ? (m[ev.skill] ?? 'fx_hit') : 'fx_hit', p.x, p.y - 6, 14);
        au.sfx(`skill_${ev.skill}`, 0.8);
        break;
      }
      case 'phase': break; // handled by onPhase (state-driven)
      case 'bossIntro': this.bossIntro = { name: this.tr(`enemy.${ev.id}.name`), t: 0 }; fx.shake(4, 1.0); au.sfx('boss_roar'); au.music('boss'); vib(200); break;
      case 'brazier': au.sfx(ev.lit ? 'brazier_on' : 'brazier_off'); break;
      case 'horn': au.sfx('horn_rally'); fx.banner(this.tr('hud.horn'), undefined, COL.gold, 1.2); for (const h of s.heroes) fx.anim('fx_levelup', h.x * T, h.y * T - 6, 14); break;
      case 'poi': {
        const p = s.pois.find((q) => q.uid === ev.uid);
        if (p) fx.anim('fx_explosion', (p.x + 0.5) * T, (p.y + 0.5) * T, 16);
        if (ev.action === 'freed' && p?.data?.hero) fx.banner(this.tr('cage.freed', { name: this.tr(`hero.${String(p.data.hero)}.name`) }), undefined, COL.gold);
        if (ev.kind === 'root' && ev.action === 'destroyed') fx.banner(this.tr('root.destroyed'), undefined, COL.purple, 2.4);
        if (ev.kind === 'heart' && ev.action === 'woke') fx.banner(this.tr('dusk.siege'), undefined, COL.purple, 2.4);
        au.sfx('poi');
        break;
      }
      case 'hearthLow': fx.banner(this.tr('hud.hearthLow'), undefined, COL.red, 1.6); vib(100); break;
      case 'tutorial': this.tutorialHidden = false; break;
      case 'falseDawn': fx.banner(this.tr('boon.falsedawn.name'), undefined, COL.gold); fx.shake(3, 0.4); break;
      case 'pulse': { const p = W(ev.x, ev.y); fx.anim('fx_explosion', p.x, p.y, 10); fx.shake(3, 0.4); au.sfx('pulse'); break; }
      case 'teleport': { const p = W(ev.x, ev.y); fx.anim('fx_blink', p.x, p.y - 6, 14); break; }
      case 'heal': { const p = W(ev.x, ev.y); if (ev.amount >= 1) fx.number('+' + Math.round(ev.amount), p.x, p.y - 14, COL.green, 5); fx.anim('fx_heal', p.x, p.y - 8, 8, 1); break; }
      case 'enrage': fx.banner(this.tr('banner.enrage'), undefined, COL.red); break;
      // ── v2 ──
      case 'frozen': { const b = s.buildings.find((q) => q.uid === ev.uid); if (b && onScreen(b.x, b.y)) au.sfx('tower_frozen'); break; }
      case 'burrow': { const p = W(ev.x, ev.y); fx.anim('fx_dust', p.x, p.y, 12); if (ev.up) { fx.anim('fx_chip_stone', p.x, p.y - 4, 10); if (onScreen(ev.x, ev.y)) au.sfx('burrow'); } break; }
      case 'ignite': { const b = s.buildings.find((q) => q.uid === ev.uid); if (b) fx.anim('fx_burn', (b.x + b.w / 2) * T, (b.y + b.h / 2) * T, 12, 2); break; }
      case 'gutter': au.sfx('defeat'); fx.fade = 1; fx.shake(4, 0.5); vib(300); break;
      case 'regionSealed': fx.banner(this.tr('map.sealed') + ': ' + this.tr(`region.${ev.region}`), undefined, COL.gold, 3); au.sfx('region_sealed'); fx.shake(3, 0.6); break;
      case 'hearthTier': {
        const h = s.buildings.find((b) => b.uid === s.hearthUid);
        if (h) fx.anim('fx_tier_up', (h.x + 1) * T, (h.y + 2) * T - 10, 10);
        fx.banner(this.tr('panel.tierUp') + ' ' + ev.tier, undefined, COL.fire, 2.4); au.sfx('hearth_tier'); fx.shake(2, 0.4); break;
      }
      case 'unlock': if (!this.autoplay.on) this.unlockCards.push(ev.what); au.sfx('boon_pick', 0.6); break;
      case 'villager': {
        const v = s.villagers.find((q) => q.uid === ev.uid);
        if (ev.action === 'work' && v && onScreen(v.x, v.y)) au.sfx(`villager_work_${1 + (ev.uid % 3)}`, 0.5);
        break;
      }
      case 'storageFull': if (this.storageFullT <= 0) { this.storageFullT = 2; au.sfx('storage_full', 0.6); } break;
      case 'bounty': if (ev.done) { fx.banner(this.tr('book.bounties') + ' +1', undefined, COL.gold, 1.6); au.sfx('coin'); } break;
      case 'achievement': fx.banner(this.tr(`ach.${ev.id}.name`) === `ach.${ev.id}.name` ? this.tr('book.achievements') : this.tr(`ach.${ev.id}.name`), undefined, COL.gold, 2); au.sfx('level_up', 0.7); break;
      case 'expedition': {
        if (ev.action === 'extract') au.sfx('extract_ok');
        else if (ev.action === 'timeout' || ev.action === 'wiped') au.sfx('extract_fail');
        else if (ev.action === 'chest') au.sfx('boon_pick');
        else if (ev.action === 'bossDown') { au.sfx('victory', 0.6); fx.shake(3, 0.4); }
        else if (ev.action === 'start') au.sfx('horn_rally', 0.6);
        break;
      }
    }
  }

  dismissGutter() { const s = this.state; if (s) this.gutterSeen = s.lossReport; this.saveHold(); }

  /** Collect the away summary: resources fly to the HUD (SPEC §10.5). */
  collectAway() {
    const a = this.away; this.awayCollected = true;
    this.cmd({ t: 'collectAway' });
    this.audio.sfx('collect_away');
    if (a) {
      let i = 0;
      for (const [k, v] of Object.entries(a.produced)) {
        if (!v) continue;
        const [hx, hy] = hudResTarget(this, k as never);
        for (let j = 0; j < 3; j++) this.fx.fly(resIcon(k), this.W / 2 + (j - 1) * 8, this.H / 2, hx, hy, (i++) * 0.05, () => this.fx.pulse(k));
      }
    }
    this.away = null;
    this.saveHold();
  }

  // ── render ──────────────────────────────────────────────────────────────
  render() {
    const g = this.b;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = COL.ink; g.fillRect(0, 0, this.W, this.H);
    this.ui.begin();
    const shown = this.screen === 'game' ? this.game : this.screen === 'loading' ? null : this.backdrop;
    if (shown) this.renderWorld(shown, this.screen !== 'game');
    if (this.screen === 'game' && this.game) { this.build.drawWorldOverlay(); drawHud(this); this.build.drawUI(); }
    drawScreens(this);
    if (this.fx.fade > 0) { g.globalAlpha = Math.min(1, this.fx.fade); g.fillStyle = COL.ink; g.fillRect(0, 0, this.W, this.H); g.globalAlpha = 1; }
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.buf, 0, 0, this.W * this.n, this.H * this.n);
  }

  renderWorld(game: Game, demo: boolean) {
    const s = game.state, g = this.b;
    if (demo) {
      const h = s.buildings.find((b) => b.uid === s.hearthUid);
      if (h) { this.cam.x = (h.x + 1) * T + Math.sin(this.time * 0.07) * 40; this.cam.y = (h.y + 1) * T + Math.cos(this.time * 0.05) * 30 - 30; }
    }
    const [shx, shy] = this.fx.shakeOffset(this.time);
    const base = this.camRect();
    const cam: Cam = { ...base, x: base.x + shx, y: base.y + shy };
    const a = game === this.game ? this.alpha() : game.alpha();
    this.world.drawGround(g, s, cam, this.time);
    this.world.drawVeil(g, s, cam, this.time);
    this.world.drawFloor(g, s, cam, this.time);
    this.world.drawZones(g, s, cam, this.time);
    if (!demo) this.build.drawGroundOverlay(cam);
    g.save(); g.translate(-cam.x, -cam.y); this.fx.drawWorld(g, false); g.restore();
    this.world.drawEntities(g, s, cam, a, this.time);
    this.world.drawProjectiles(g, s, cam, a, this.time);
    g.save(); g.translate(-cam.x, -cam.y); this.fx.drawWorld(g, true); g.restore();
    this.world.light.draw(g, s, cam.x, cam.y, this.time);
    this.world.drawVeiled(g, s, cam, a, this.time);
    g.save(); g.translate(-cam.x, -cam.y); this.fx.drawNumbers(g); g.restore();
  }

  // ── input ───────────────────────────────────────────────────────────────
  installInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => { e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ } this.audio.unlock(); this.onDown(e); });
    c.addEventListener('pointermove', (e) => { e.preventDefault(); this.onMove(e); });
    c.addEventListener('pointerup', (e) => { e.preventDefault(); this.onUp(e, false); });
    c.addEventListener('pointercancel', (e) => { this.onUp(e, true); });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomIdx = Math.max(0, Math.min(2, this.zoomIdx + (e.deltaY < 0 ? 1 : -1))); }, { passive: false });
    window.addEventListener('keydown', (e) => { this.audio.unlock(); this.keys.add(e.key.toLowerCase()); this.onKey(e.key.toLowerCase()); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    // SPEC §13.7: save when the page hides (never mid-NIGHT: the DUSK save stands)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.saveHold(); });
    window.addEventListener('pagehide', () => this.saveHold());
  }

  onKey(k: string) {
    const s = this.state;
    if (this.screen !== 'game' || !s) return;
    if (k === 'escape') { if (this.panel) this.panel = null; else this.paused = !this.paused; }
    if (k === 'b') this.build.toggle();
    if (k === 'h') this.cmd({ t: 'horn' });
    if (k === 'n') this.cmd(s.phase === 'dusk' ? { t: 'startNight' } : { t: 'ringBell' });
    if (k >= '1' && k <= '4' && s.gifts) this.cmd({ t: 'pickGift', index: Number(k) - 1 });
  }

  onDown(e: PointerEvent) {
    const [x, y] = this.toArt(e.clientX, e.clientY);
    const p: Pointer = { id: e.pointerId, x, y, sx: x, sy: y, t0: performance.now(), moved: false, role: 'none' };
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2 && this.screen === 'game' && !this.modal()) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, idx0: this.zoomIdx };
      this.joy = null; this.build.cancelGesture();
      for (const q of this.pointers.values()) q.role = 'pan';
      return;
    }
    const hit = this.ui.at(x, y);
    if (hit) {
      p.role = 'ui'; p.hitId = hit.id; this.ui.pressed = hit.id;
      hit.onDown?.(x, y);
      return;
    }
    if (this.screen !== 'game' || !this.game || this.modal()) return;
    if (this.build.open) { p.role = 'build'; this.build.down(x, y); return; }
    if (this.autoplay.on) return;
    // tap on a building outside build mode opens its panel (SPEC §10.5); otherwise the floating joystick
    if (y > this.H * 0.35) { p.role = 'joy'; this.joy = { ox: x, oy: y, kx: x, ky: y }; }
    else p.role = 'pan';
  }

  onMove(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const [x, y] = this.toArt(e.clientX, e.clientY);
    const dx = x - p.x, dy = y - p.y;
    p.x = x; p.y = y;
    if (Math.hypot(x - p.sx, y - p.sy) > 3) p.moved = true;
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoomIdx = pinchStep(this.pinch.idx0, d / this.pinch.d0);
      if (this.build.open) { this.cam.x -= dx / 2; this.cam.y -= dy / 2; this.clampCam(); }
      return;
    }
    if (p.role === 'joy' && this.joy) {
      const r = 22, ox = x - this.joy.ox, oy = y - this.joy.oy, m = Math.hypot(ox, oy);
      if (m > r) { this.joy.kx = this.joy.ox + (ox / m) * r; this.joy.ky = this.joy.oy + (oy / m) * r; } else { this.joy.kx = x; this.joy.ky = y; }
    } else if (p.role === 'build') this.build.move(x, y, dx, dy);
    else if (p.role === 'ui') { const h = this.ui.hits.find((q) => q.id === p.hitId); if (h?.onDrag) h.onDrag(dx, dy, x, y); }
  }

  onUp(e: PointerEvent, cancel: boolean) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (!p) return;
    if (p.role === 'ui') {
      const hit = this.ui.at(p.x, p.y);
      const wasDrag = !!this.ui.hits.find((q) => q.id === p.hitId)?.onDrag && p.moved;
      this.ui.tapX = p.x; this.ui.tapY = p.y;
      if (!cancel && hit && hit.id === p.hitId && hit.onTap && !wasDrag) { this.audio.sfx('ui_click', 0.6); hit.onTap(); }
      this.ui.pressed = null;
    } else if (p.role === 'joy' || p.role === 'pan') {
      this.joy = null;
      if (!cancel && !p.moved && performance.now() - p.t0 < 350) this.tapWorld(p.x, p.y);
    } else if (p.role === 'build') this.build.up(p.x, p.y, !p.moved || cancel ? 'tap' : 'drag', cancel);
  }

  /** A short tap on the world (outside build mode): open the building panel / dock (SPEC §10.5). */
  tapWorld(x: number, y: number) {
    const s = this.state; if (!s || s.expedition) return;
    const t = this.screenToTile(x, y);
    const b = s.buildings.find((q) => t.x >= q.x && t.y >= q.y - (q.h > 1 ? 1 : 0.6) && t.x < q.x + q.w && t.y < q.y + q.h);
    if (!b) return;
    if (this.garrisonPick && b.id.startsWith('tower')) { this.cmd({ t: 'garrison', hero: this.garrisonPick as never, uid: b.uid }); this.garrisonPick = null; return; }
    this.openPanel(b.id === 'dock' && !b.ruined ? 'dock' : 'building', b.uid);
  }
}

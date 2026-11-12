// Preview application shell: canvas + pixel scale, main loop, camera, input routing, event → juice/audio.
import { Atlas } from './atlas';
import { Audio } from './audio';
import { applyRunEmber, META_KEY, RUN_KEY } from '../../../assets/scripts/core/sim/Game';
import { createGame, defaultMeta, loadMeta, type Command, type Game, type GameEvent, type GameState, type MetaState } from './core';
import { BitmapFont, COL } from './font';
import { Fx } from './fx';
import { BuildUI } from './build';
import { drawHud } from './hud';
import { drawScreens } from './screens';
import { basePixelScale, smoothFactor, lookAhead, clampCamera, zoomSteps, pinchStep } from './shared';
import { UI } from './ui';
import { T, WorldRenderer, type Cam } from './world';
import { t as tr, type Lang } from '../../../assets/scripts/core/data/i18n';
import { Autoplay } from './autoplay';

export type Screen = 'loading' | 'title' | 'barracks' | 'settings' | 'game';

interface Pointer { id: number; x: number; y: number; sx: number; sy: number; t0: number; moved: boolean; role: 'joy' | 'ui' | 'build' | 'pan' | 'none'; hitId?: string }

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

  screen: Screen = 'loading';
  settingsFrom: Screen = 'title';
  paused = false;
  game: Game | null = null;
  demo: Game | null = null; // title background
  meta: MetaState;
  seedN = 1;
  speed = 1;
  time = 0;
  cam = { x: 0, y: 0 }; // world art px at screen centre
  camVel = { x: 0, y: 0 };
  moveDir = { x: 0, y: 0 };
  sentDir = { x: 0, y: 0 };
  keys = new Set<string>();
  pointers = new Map<number, Pointer>();
  joy: { ox: number; oy: number; kx: number; ky: number } | null = null;
  pinch: { d0: number; idx0: number } | null = null;
  emberCredited = false;
  tutorialHidden = false;
  omensOpen = true;
  errors: string[] = [];
  frameTimes: number[] = [];
  lastPhase = '';
  hearthLowT = 0;
  minimapBig = false;
  bossIntro: { name: string; t: number } | null = null;
  /** debug/e2e camera override (tile units) */
  camFocus: { x: number; y: number } | null = null;

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
    this.meta = this.readMeta();
  }

  get state(): GameState | null { return this.game ? this.game.state : null; }
  get lang(): Lang { return (this.meta.settings.lang as Lang) || 'en'; }
  tr(key: string, params?: Record<string, string | number>) { return tr(key, this.lang, params); }

  // ── persistence ─────────────────────────────────────────────────────────
  readMeta(): MetaState {
    let raw: string | null = null;
    try { raw = localStorage.getItem(META_KEY); } catch { /* storage blocked */ }
    try { return loadMeta(raw); } catch { return defaultMeta(); }
  }
  saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); } catch { /* ignore */ } }
  savedRun(): string | null { try { return localStorage.getItem(RUN_KEY); } catch { return null; } }
  saveRun() { if (!this.game) return; try { localStorage.setItem(RUN_KEY, this.game.saveRun()); } catch { /* ignore */ } }
  clearRun() { try { localStorage.removeItem(RUN_KEY); } catch { /* ignore */ } }

  // ── lifecycle ───────────────────────────────────────────────────────────
  async boot() {
    await this.atlas.load('resources');
    this.audio.init('resources').catch(() => undefined);
    this.demo = createGame({ seed: 7, meta: defaultMeta() });
    this.screen = 'title';
    this.fx.fade = 1;
  }

  newRun(seed?: number, saved?: string) {
    this.seedN = seed ?? (Date.now() % 100000);
    let game: Game;
    try {
      game = createGame({ seed: this.seedN, meta: this.meta, saved: saved ?? undefined });
    } catch (e) {
      if (!saved) throw e;
      console.warn('[preview] saved run unreadable, starting fresh:', (e as Error).message);
      this.clearRun(); game = createGame({ seed: this.seedN, meta: this.meta });
    }
    this.game = game;
    this.seedN = game.state.seed;
    this.screen = 'game'; this.paused = false; this.emberCredited = false; this.lastPhase = '';
    this.build.reset(); this.camFocus = null;
    this.fx = Object.assign(this.fx, new Fx(this.atlas, this.font));
    this.world.attacked.clear();
    const s = game.state;
    const h = s.buildings.find((b) => b.uid === s.hearthUid);
    if (h) { this.cam.x = (h.x + h.w / 2) * T; this.cam.y = (h.y + h.h / 2) * T; }
    this.fx.fade = 1;
    this.audio.music('day');
  }

  toTitle() {
    this.game = null; this.camFocus = null; this.screen = 'title'; this.paused = false; this.autoplay.on = false; this.fx.fade = 1;
    this.build.reset();
    this.audio.music('day');
  }

  cmd(c: Command) { this.game?.cmd(c); }
  alpha() { return this.autoplay.on ? this.autoplay.alpha() : this.game ? this.game.alpha() : 0; }

  // ── layout ──────────────────────────────────────────────────────────────
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round(window.innerWidth * dpr)), ch = Math.max(1, Math.round(window.innerHeight * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    this.dpr = dpr;
    // title/meta screens use the n-1 zoom step so the 204-px logo and menus fit; in-run uses the player's pinch step
    const n = zoomSteps(basePixelScale(cw))[this.screen === 'game' ? this.zoomIdx : 0];
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
  /** world art px → screen art px */
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

  tick(dt: number) {
    this.resize();
    this.time += dt;
    this.fx.update(dt);
    if (this.screen === 'title' && this.demo) {
      this.demo.update(dt);
      this.demo.drainEvents();
    }
    if (this.screen !== 'game' || !this.game) return;
    const g = this.game, s = g.state;
    if (!this.autoplay.on) this.updateMove();
    if (!this.paused) {
      if (this.fx.hitStop > 0) this.fx.hitStop -= dt;
      else if (this.autoplay.on) this.autoplay.tick(dt);
      else g.update(dt * this.speed);
    }
    for (const ev of g.drainEvents()) this.onEvent(ev);
    for (const [k, v] of this.world.attacked) { if (v - dt <= 0) this.world.attacked.delete(k); else this.world.attacked.set(k, v - dt); }
    // phase transitions not signalled by events
    if (s.phase !== this.lastPhase) this.onPhase(s.phase, this.lastPhase);
    this.lastPhase = s.phase;
    // dusk forces build mode
    if (s.phase === 'dusk' && !this.build.open && !this.autoplay.on) this.build.enter();
    if ((s.phase === 'dawn' || s.phase === 'victory' || s.phase === 'defeat') && this.build.open) this.build.exit();
    if (s.phase === 'defeat' || s.phase === 'victory') this.creditEmber();
    this.updateCamera(dt);
    this.build.tick(dt);
    if (this.bossIntro) { this.bossIntro.t += dt; if (this.bossIntro.t > 1.8) this.bossIntro = null; }
    const hearth = s.buildings.find((b) => b.uid === s.hearthUid);
    this.hearthLowT = hearth && hearth.hp / hearth.maxHp < 0.3 ? this.hearthLowT + dt : 0;
  }

  creditEmber() {
    if (this.emberCredited || !this.game) return;
    this.emberCredited = true;
    applyRunEmber(this.meta, this.game.emberEarned());
    this.saveMeta();
    this.clearRun();
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
    if (this.build.open && this.state?.phase === 'dusk') { dx = 0; dy = 0; }
    this.moveDir = { x: dx, y: dy };
    if (Math.abs(dx - this.sentDir.x) > 0.02 || Math.abs(dy - this.sentDir.y) > 0.02) {
      this.sentDir = { x: dx, y: dy };
      this.cmd({ t: 'move', dir: { x: dx, y: dy } });
    }
  }

  updateCamera(dt: number) {
    const s = this.state!;
    let tx: number, ty: number;
    const hearth = s.buildings.find((b) => b.uid === s.hearthUid);
    const leader = s.heroes.find((h) => h.leader) ?? s.heroes[0];
    if (this.build.open && this.build.freeCam) return; // build mode pans freely
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

  // ── events → juice + audio ──────────────────────────────────────────────
  onPhase(p: string, prev: string) {
    const s = this.state!;
    if (p === 'night') { this.fx.banner(this.tr('banner.night', { n: s.night }), undefined, COL.purple); this.audio.sfx('horn_night'); this.audio.music(s.boss ? 'boss' : 'night'); }
    if (p === 'day' && prev === 'dawn') this.saveRun(); // SPEC §2.2: auto-save once the dawn boon is chosen
    if (p === 'day' && prev) { this.audio.music('day'); this.fx.banner(this.tr('phase.day') + ' ' + s.night, undefined, COL.gold, 1.6); }
    if (p === 'dusk') { this.omensOpen = true; this.fx.banners = []; }
    if (p === 'dawn') this.audio.music('day');
    if (p === 'victory') { this.audio.sfx('victory'); this.fx.fade = 1; }
    if (p === 'defeat') { this.audio.sfx('defeat'); this.fx.fade = 1; }
    this.fx.fade = Math.max(this.fx.fade, 0.6);
  }

  hudTarget(res: 'wood' | 'stone' | 'gold'): [number, number] {
    const y0 = this.safe.t + 16;
    return [this.safe.l + 11, y0 + (res === 'wood' ? 0 : res === 'stone' ? 11 : 22) + 5];
  }

  onEvent(ev: GameEvent) {
    const fx = this.fx, au = this.audio;
    const W = (x: number, y: number) => ({ x: x * T, y: y * T });
    const vib = (ms: number) => { if (this.meta.settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* ignore */ } };
    const s = this.state!;
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
          if (ev.id === 'mossback' || ev.id === 'unlit') { fx.shake(4, 0.6); fx.stop(0.08); }
        } else if (ev.kind === 'building') {
          const stone = ev.id.includes('stone') || ev.id.startsWith('tower') || ev.id === 'quarry';
          for (let i = 0; i < 3; i++) fx.anim(stone ? 'fx_chip_stone' : 'fx_chip_wood', p.x + (i - 1) * 5, p.y - 4 - i * 2, 10);
          fx.anim('fx_smoke', p.x, p.y - 6, 10); fx.anim('fx_dust', p.x, p.y, 12);
          fx.shatter(this.atlas.pick(`bld_${ev.id}_l1`, `bld_${ev.id}_0`, 'bld_wall_wood_0'), p.x, p.y + 8, 6);
          fx.shake(2, 0.2); au.sfx('wall_break'); vib(30);
        } else { fx.anim('fx_dust', p.x, p.y, 10); au.sfx('hero_down'); }
        break;
      }
      case 'shoot': au.sfx(`shoot_${ev.kind}`, 0.45); break;
      case 'explode': { const p = W(ev.x, ev.y); fx.anim('fx_explosion', p.x, p.y - 6, 16); fx.shake(ev.radius >= 1.5 ? 3 : 2, 0.25); if (ev.radius >= 1.5) fx.stop(0.04); au.sfx('explode'); vib(25); break; }
      case 'harvest': {
        const p = W(ev.x, ev.y);
        fx.anim(ev.res === 'wood' ? 'fx_chip_wood' : 'fx_chip_stone', p.x, p.y - 8, 12);
        const c = this.camRect();
        const [hx, hy] = this.hudTarget(ev.res);
        fx.fly(`icon_${ev.res}`, p.x - c.x, p.y - 10 - c.y, hx, hy, 0, () => fx.pulse(ev.res));
        au.sfx(ev.res === 'wood' ? 'chop' : ev.res === 'stone' ? 'mine' : 'coin', 0.6);
        break;
      }
      case 'gold': {
        const p = W(ev.x, ev.y), c = this.camRect(); const [hx, hy] = this.hudTarget('gold');
        for (let i = 0; i < Math.min(5, Math.max(1, Math.round(ev.amount))); i++) fx.fly('icon_gold', p.x - c.x + (i - 2) * 3, p.y - 8 - c.y, hx, hy, i * 0.06, () => fx.pulse('gold'));
        fx.anim('fx_coin', p.x, p.y - 8, 16, 2);
        au.sfx('coin', 0.5);
        break;
      }
      case 'built': { const p = W(ev.x, ev.y); fx.bounce.set(ev.uid, 0); fx.anim('fx_dust', p.x + 8, p.y + 14, 14); au.sfx('place', 0.8); vib(10); break; }
      case 'buildFail': { const p = W(ev.x, ev.y); fx.number(this.tr(`build.fail.${ev.reason}`), p.x + 8, p.y, COL.red, 5); au.sfx('fail'); break; }
      case 'upgraded': { fx.bounce.set(ev.uid, 0); const b = s.buildings.find((q) => q.uid === ev.uid); if (b) fx.anim('fx_levelup', (b.x + b.w / 2) * T, (b.y + b.h) * T - 8, 12); au.sfx('upgrade'); break; }
      case 'repaired': { const b = s.buildings.find((q) => q.uid === ev.uid); if (b) fx.anim('fx_heal', (b.x + b.w / 2) * T, (b.y + b.h / 2) * T, 8, 2); au.sfx('repair'); break; }
      case 'sold': au.sfx('sell'); break;
      case 'levelUp': { const h = s.heroes.find((q) => q.uid === ev.hero); if (h) { fx.anim('fx_levelup', h.x * T, h.y * T - 6, 12, 2); fx.number('LV UP', h.x * T, h.y * T - 18, COL.gold, 5); } au.sfx('levelup'); break; }
      case 'skill': {
        const p = W(ev.x, ev.y);
        const m: Record<string, string> = { shieldBash: 'fx_slash', shadowStep: 'fx_blink', arrowRain: 'fx_hit', miniTurret: 'fx_dust', sanctum: 'fx_heal', fireWall: 'fx_burn' };
        fx.anim(m[ev.skill] ?? 'fx_hit', p.x, p.y - 6, 14);
        au.sfx(`skill_${ev.skill}`, 0.8);
        break;
      }
      case 'phase': break; // handled by onPhase (state-driven)
      case 'bossIntro': this.bossIntro = { name: this.tr(`enemy.${ev.id}.name`), t: 0 }; fx.shake(4, 1.0); au.sfx('boss_roar'); au.music('boss'); vib(200); break;
      case 'brazier': au.sfx(ev.lit ? 'brazier_on' : 'brazier_off'); break;
      case 'horn': au.sfx('horn_rally'); fx.banner(this.tr('hud.horn'), undefined, COL.gold, 1.2); for (const h of s.heroes) fx.anim('fx_levelup', h.x * T, h.y * T - 6, 14); break;
      case 'poi': {
        const p = s.pois.find((q) => q.uid === ev.uid);
        if (p) { fx.anim('fx_explosion', (p.x + 0.5) * T, (p.y + 0.5) * T, 16); }
        if (ev.action === 'freed' && p?.data?.hero) fx.banner(this.tr('cage.freed', { name: this.tr(`hero.${String(p.data.hero)}.name`) }), undefined, COL.gold);
        if (ev.kind === 'root' && ev.action === 'destroyed') fx.banner(this.tr('root.destroyed'), undefined, COL.purple, 2.4);
        au.sfx('poi');
        break;
      }
      case 'shrine': fx.banner(this.tr(`shrine.${ev.buff}`), undefined, COL.gold, 2.4); au.sfx('levelup'); break;
      case 'boonOffer': au.sfx('ui_open'); break;
      case 'hearthLow': fx.banner(this.tr('hud.hearthLow'), undefined, COL.red, 1.6); vib(100); break;
      case 'tutorial': this.tutorialHidden = false; break;
      case 'falseDawn': fx.banner(this.tr('boon.falsedawn.name'), undefined, COL.gold); fx.shake(3, 0.4); break;
      case 'pulse': { const p = W(ev.x, ev.y); fx.anim('fx_explosion', p.x, p.y, 10); fx.shake(3, 0.4); au.sfx('pulse'); break; }
      case 'teleport': { const p = W(ev.x, ev.y); fx.anim('fx_blink', p.x, p.y - 6, 14); break; }
      case 'heal': { const p = W(ev.x, ev.y); if (ev.amount >= 1) fx.number('+' + Math.round(ev.amount), p.x, p.y - 14, COL.green, 5); fx.anim('fx_heal', p.x, p.y - 8, 8, 1); break; }
      case 'hired': au.sfx('levelup'); break;
      case 'enrage': fx.banner(this.tr('banner.enrage'), undefined, COL.red); break;
    }
  }

  // ── render ──────────────────────────────────────────────────────────────
  render() {
    const g = this.b;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = COL.ink; g.fillRect(0, 0, this.W, this.H);
    this.ui.begin();
    const shown = this.screen === 'game' ? this.game : this.screen === 'loading' ? null : this.demo;
    if (shown) this.renderWorld(shown, this.screen !== 'game');
    if (this.screen === 'game' && this.game) { this.build.drawWorldOverlay(); drawHud(this); this.build.drawUI(); }
    drawScreens(this);
    if (this.fx.fade > 0) { g.globalAlpha = Math.min(1, this.fx.fade); g.fillStyle = COL.ink; g.fillRect(0, 0, this.W, this.H); g.globalAlpha = 1; }
    // present: integer upscale with NEAREST
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.buf, 0, 0, this.W * this.n, this.H * this.n);
  }

  renderWorld(game: Game, demo: boolean) {
    const s = game.state, g = this.b;
    if (demo) {
      // slow drift around the hearth for the title backdrop
      const h = s.buildings.find((b) => b.uid === s.hearthUid);
      if (h) { this.cam.x = (h.x + 1) * T + Math.sin(this.time * 0.07) * 40; this.cam.y = (h.y + 1) * T + Math.cos(this.time * 0.05) * 30 - 30; }
    }
    const [shx, shy] = this.fx.shakeOffset(this.time);
    const base = this.camRect();
    const cam: Cam = { ...base, x: base.x + shx, y: base.y + shy };
    const a = game === this.game ? this.alpha() : game.alpha();
    this.world.drawGround(g, s, cam, this.time);
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
  }

  onKey(k: string) {
    const s = this.state;
    if (this.screen !== 'game' || !s) return;
    if (k === 'escape') this.paused = !this.paused;
    if (k === 'b') this.build.toggle();
    if (k === 'h') this.cmd({ t: 'horn' });
    if (k === 'n') this.cmd(s.phase === 'dusk' ? { t: 'startNight' } : { t: 'callNight' });
    if (k >= '1' && k <= '3' && s.boonOffer) this.cmd({ t: 'pickBoon', index: Number(k) - 1 });
  }

  onDown(e: PointerEvent) {
    const [x, y] = this.toArt(e.clientX, e.clientY);
    const p: Pointer = { id: e.pointerId, x, y, sx: x, sy: y, t0: performance.now(), moved: false, role: 'none' };
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2 && this.screen === 'game') {
      // second finger: pinch zoom / pan — cancel the joystick
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
    if (this.screen !== 'game' || !this.game || this.paused || this.game.state.boonOffer) return;
    if (this.build.open) { p.role = 'build'; this.build.down(x, y); return; }
    if (this.autoplay.on) return;
    if (y > this.H * 0.35) { p.role = 'joy'; this.joy = { ox: x, oy: y, kx: x, ky: y }; }
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
    } else if (p.role === 'joy') { this.joy = null; }
    else if (p.role === 'build') this.build.up(p.x, p.y, !p.moved || cancel ? 'tap' : 'drag', cancel);
  }
}

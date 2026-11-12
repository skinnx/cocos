// Root component (added to the scene's Canvas by Boot.ts). Owns the core Game instance (createGame from
// core/sim/Game), builds the whole node tree in code, runs the frame loop
//   input → game.update(dt) (hit-stop / pause / speed / autoplay) → drainEvents() → FX/SFX/UI → render
// and drives the screen flow Title → Barracks / Settings → Game (Pause, Dawn, Victory, Defeat) → Title.
import { _decorator, Component, KeyCode, ResolutionPolicy, screen, sys, view, type Node } from 'cc';
import type { BuildingId, Command, Game, GameEvent, GameState, MetaState, Phase, Resources } from '../core/api';
import { BUILDINGS } from '../core/data/buildings';
import { createGame, worldOf } from '../core/sim/Game';
import { defeat, startDawn, startDay, startDusk, startNight, victory } from '../core/sim/Phases';
import { applyRunEmber } from '../core/sim/Meta';
import { AutoplayBot } from '../core/bots';
import { DT } from '../core/data/balance';
import { Music } from './audio/Music';
import { Sfx } from './audio/Sfx';
import type { Ctx, Layout, ScreenId } from './Ctx';
import { debugErrors, installDebug } from './Debug';
import { BuildGestures } from './input/BuildGestures';
import { InputRouter } from './input/InputRouter';
import { Joystick } from './input/Joystick';
import { musicFor, sfxForEvent } from './logic/audio';
import { DESIGN_H, DESIGN_W } from './logic/camera';
import { fadeAlpha, HIT_STOP_SEC } from './logic/juice';
import { newSeed } from './logic/save';
import { setLang, tr } from './logic/strings';
import { Atlas } from './render/Atlas';
import { CameraRig } from './render/CameraRig';
import { EntityView, shardTint } from './render/EntityView';
import { FxPool } from './render/FxPool';
import { LightOverlay } from './render/LightOverlay';
import { mkNode, PAL, SpriteHandle } from './render/Nodes';
import { TileView } from './render/TileView';
import { Save } from './Save';
import { BitmapText } from './ui/BitmapText';
import { BuildDrawer } from './ui/BuildDrawer';
import { BuildOverlay } from './ui/BuildOverlay';
import { Hud } from './ui/Hud';
import { Omens } from './ui/Omens';
import { RadialMenu } from './ui/RadialMenu';
import { BarracksScreen, DawnScreen, EndScreen, PauseScreen, SettingsScreen, SquadPopup, TitleScreen } from './ui/Screens';
import { Tutorial } from './ui/Tutorial';
import { UiInput } from './ui/UiKit';

const { ccclass } = _decorator;
const FADE_SEC = 0.5;

@ccclass('GameRoot')
export class GameRoot extends Component implements Ctx {
  game: Game | null = null;
  private backdrop: Game | null = null;
  meta!: MetaState;
  layout: Layout = { W: 240, H: 427, top: 0, bottom: 0, left: 0, right: 0, uiS: 3 };
  cam!: CameraRig;
  fx!: FxPool;
  ents!: EntityView;
  time = 0;

  private screenId: ScreenId = 'loading';
  private pendingScreen: ScreenId | null = null;
  private fadeT = -1;
  private _paused = false;
  private hitStop = 0;
  private speed = 1;
  private autoplay = false;
  private autoAcc = 0;
  private forcedSeed: number | undefined;
  private bankedEmber = 0;
  private fpsAvg = 60;
  private pendingBounce: number[] = [];
  private buildingUids = new Set<number>();
  private lastPhase: Phase | null = null;
  private lastBuild = false;

  // nodes / views
  private worldRoot!: Node;
  private uiRoot!: Node;
  private tiles!: TileView;
  private light!: LightOverlay;
  private sfxP!: Sfx;
  private music!: Music;
  private hud!: Hud;
  private drawer!: BuildDrawer;
  private overlay!: BuildOverlay;
  private radial!: RadialMenu;
  private gestures!: BuildGestures;
  private joy!: Joystick;
  private router!: InputRouter;
  private omens!: Omens;
  private tutorial!: Tutorial;
  private title!: TitleScreen;
  private barracks!: BarracksScreen;
  private settings!: SettingsScreen;
  private pauseS!: PauseScreen;
  private dawn!: DawnScreen;
  private winS!: EndScreen;
  private loseS!: EndScreen;
  private squad!: SquadPopup;
  private fade!: SpriteHandle;
  private fpsText: BitmapText | null = null;
  private ready = false;

  // ── lifecycle ─────────────────────────────────────────────────────────────
  protected onLoad(): void {
    view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);
    this.meta = Save.loadMeta();
    setLang(this.meta.settings.lang);
    BitmapText.bigText = this.meta.settings.bigText;
    installDebug({
      state: () => this.game?.state ?? null,
      cmd: (c) => this.cmd(c),
      goto: (p, n) => this.debugGoto(p, n),
      grant: (r) => this.debugGrant(r),
      setAutoplay: (on) => { this.autoplay = on; },
      setSpeed: (x) => { this.speed = Math.max(0.1, Math.min(16, x || 1)); },
      setSeed: (n) => { this.forcedSeed = n; },
      fps: () => Math.round(this.fpsAvg),
      screen: () => this.screenId,
      start: (cont) => this.startRun(!!cont),
    });
    Atlas.load((err) => {
      if (err) { debugErrors.push(`atlas: ${err.message}`); return; }
      try { this.build(); } catch (e) { debugErrors.push(`build: ${(e as Error).message}`); throw e; }
    });
  }

  protected onDestroy(): void { this.router?.destroy(); }

  private build(): void {
    const root = this.node;
    this.worldRoot = mkNode('World', root);
    const ground = mkNode('ground', this.worldRoot);
    const edges = mkNode('edges', this.worldRoot);
    const floor = mkNode('floor', this.worldRoot);
    const rows = mkNode('rows', this.worldRoot);
    const air = mkNode('air', this.worldRoot);
    const lightLayer = mkNode('lightLayer', this.worldRoot);
    const eyes = mkNode('eyes', this.worldRoot);
    const top = mkNode('worldUi', this.worldRoot);
    this.cam = new CameraRig(this.worldRoot);
    this.tiles = new TileView(ground, edges);
    this.ents = new EntityView(rows, floor, air, eyes, top, 56);
    this.light = new LightOverlay(lightLayer);
    this.overlay = new BuildOverlay(top);
    this.fx = new FxPool(air, floor, top);

    this.uiRoot = mkNode('UI', root);
    this.sfxP = new Sfx(root);
    this.music = new Music(root);
    this.sfxP.onManifest = () => this.music.setEntries(this.sfxP.musicEntries);
    this.measure();
    this.joy = new Joystick(this.uiRoot, this);
    this.hud = new Hud(this.uiRoot, this);
    this.radial = new RadialMenu(this.uiRoot, this);
    this.drawer = new BuildDrawer(this.uiRoot, this);
    this.gestures = new BuildGestures(this.uiRoot, this, this.drawer, this.overlay, this.radial);
    this.omens = new Omens(this.uiRoot, this);
    this.tutorial = new Tutorial(this.uiRoot, this, this.hud, () => this.drawer.height + 20);
    this.dawn = new DawnScreen(this.uiRoot, this);
    this.winS = new EndScreen(this.uiRoot, this, true);
    this.loseS = new EndScreen(this.uiRoot, this, false);
    this.squad = new SquadPopup(this.uiRoot, this);
    this.pauseS = new PauseScreen(this.uiRoot, this, () => { this.settings.returnTo = 'pause'; this.settings.show(true); });
    this.title = new TitleScreen(this.uiRoot, this);
    this.barracks = new BarracksScreen(this.uiRoot, this);
    this.settings = new SettingsScreen(this.uiRoot, this);
    this.settings.onClose = () => { this.settings.show(false); if (this.screenId === 'settings') this.go('title'); };
    this.settings.onChange = () => this.applySettings();
    this.settings.onErase = () => {
      Save.eraseAll();
      this.meta = Save.loadMeta();
      this.applySettings();
      this.settings.show(false);
      this.go('title');
    };
    this.fade = new SpriteHandle('fade', this.uiRoot).solid(1, 1).color(PAL.k[0], PAL.k[1], PAL.k[2], 0).show(false);
    this.hud.onPortrait = (i) => { if (this.game && this.game.state.reserve.length) this.squad.open(i); };
    this.hud.onOmens = () => { this.omens.open = !this.omens.open; };
    this.router = new InputRouter(this, this.joy, this.gestures,
      () => this.screenId === 'game' && !!this.game && !this._paused && !this.modalOpen(),
      () => !!this.game && (this.game.state.buildMode || this.game.state.phase === 'dusk'));
    this.router.onFirstInput = () => { this.sfxP.unlocked = true; this.music.unlocked = true; };
    this.router.onKey = (k) => this.hotkey(k);
    if (/(^|[?&])fps=1(&|$)/.test(((globalThis as { location?: { search?: string } }).location?.search) ?? '')) {
      this.fpsText = new BitmapText(this.uiRoot, { ax: 1, ay: 0, color: PAL.d });
    }
    this.applySettings();
    this.relayout();
    this.ready = true;
    this.makeBackdrop();
    this.setScreen('title');
  }

  // ── layout ────────────────────────────────────────────────────────────────
  private measure(): boolean {
    const vis = view.getVisibleSize();
    const devW = Math.max(1, screen.windowSize.width);
    const uiN = Math.max(2, Math.round(devW / 240));
    const uiS = (uiN * vis.width) / devW;
    let safe = { x: 0, y: 0, width: vis.width, height: vis.height };
    try { const r = sys.getSafeAreaRect(); if (r && r.width > 0 && r.height > 0) safe = r; } catch { /* no safe-area info */ }
    const L: Layout = {
      W: vis.width / uiS, H: vis.height / uiS, uiS,
      left: Math.max(0, safe.x / uiS), bottom: Math.max(0, safe.y / uiS),
      right: Math.max(0, (vis.width - safe.x - safe.width) / uiS), top: Math.max(0, (vis.height - safe.y - safe.height) / uiS),
    };
    const changed = Math.abs(L.W - this.layout.W) > 0.01 || Math.abs(L.H - this.layout.H) > 0.01 || L.uiS !== this.layout.uiS
      || L.top !== this.layout.top || L.bottom !== this.layout.bottom;
    this.layout = L;
    UiInput.minTouch = 88 / uiS;
    this.uiRoot?.setScale(uiS, uiS, 1);
    this.uiRoot?.setPosition(-vis.width / 2, -vis.height / 2, 0);
    return changed;
  }

  private relayout(): void {
    this.hud.layout(); this.drawer.layout(); this.gestures.layout();
    for (const s of [this.title, this.barracks, this.settings, this.pauseS, this.dawn, this.winS, this.loseS, this.squad]) if (s.shown) s.layout();
    this.fade.solid(Math.ceil(this.layout.W) + 2, Math.ceil(this.layout.H) + 2).pos(-1, -1);
    this.fpsText?.pos(Math.round(this.layout.W - 4), 2);
  }

  private applySettings(): void {
    const s = this.meta.settings;
    setLang(s.lang);
    BitmapText.bigText = s.bigText;
    this.sfxP.volume = s.sfx;
    this.music.volume = s.music;
    if (this.ready) {
      this.title.refresh(); this.barracks.refresh(); this.settings.refresh(); this.pauseS.refresh();
      this.relayout();
    }
  }

  // ── Ctx ───────────────────────────────────────────────────────────────────
  state(): GameState { return (this.game ?? this.backdrop)!.state; }
  cmd(c: Command): void { this.game?.cmd(c); }
  sfx(name: string, priority = 0): void { this.sfxP?.play(name, priority); }
  vibrate(ms: number): void {
    if (!this.meta.settings.haptics) return;
    try { const nav = (globalThis as { navigator?: { vibrate?: (p: number) => boolean } }).navigator; nav?.vibrate?.(ms); } catch { /* unsupported */ }
  }
  saveMeta(): void { Save.saveMeta(this.meta); }
  go(s: ScreenId): void {
    if (s === this.screenId && this.fadeT < 0) return;
    this.pendingScreen = s; this.fadeT = 0;
  }
  tileToUi(tx: number, ty: number): { x: number; y: number } {
    const p = this.cam.toScreen(tx, ty);
    return { x: p.x / this.layout.uiS, y: p.y / this.layout.uiS };
  }
  uiToTile(x: number, y: number): { x: number; y: number } { return this.cam.toTile(x * this.layout.uiS, y * this.layout.uiS); }
  hasRunSave(): boolean { return Save.hasRun(); }
  get paused(): boolean { return this._paused; }
  pause(on: boolean): void {
    if (!this.game) return;
    this._paused = on;
    this.router.cancelAll();
    if (!on) this.settings.show(false);
  }

  startRun(cont: boolean): void {
    const saved = cont ? Save.loadRun() : null;
    if (!cont) Save.clearRun();
    this.game = createGame({ seed: newSeed(this.forcedSeed), meta: this.meta, saved: saved ?? undefined });
    this.bankedEmber = 0;
    this.lastPhase = null;
    this._paused = false;
    this.go('game'); // the world is re-bound at the fade's midpoint (setScreen)
  }

  quitToTitle(): void {
    if (this.game && this.game.state.phase !== 'defeat' && this.game.state.phase !== 'victory') {
      // keep the dawn snapshot (Continue run); nothing else to persist mid-day
    }
    this._paused = false;
    this.router.cancelAll();
    this.pendingQuit = true;
    this.go('title');
  }
  private pendingQuit = false;

  private modalOpen(): boolean {
    const s = this.game?.state;
    return !!s && (s.phase === 'dawn' || s.phase === 'victory' || s.phase === 'defeat' || !!s.boonOffer || this.squad.shown);
  }

  private makeBackdrop(): void {
    const meta: MetaState = { ...this.meta, tutorialDone: true };
    this.backdrop = createGame({ seed: 1337, meta });
    this.tiles.bind(this.backdrop.state); this.light.bind(this.backdrop.state);
    const h = this.hearthCenter(this.backdrop.state);
    if (h) this.cam.focus(h, true);
  }

  private hearthCenter(s: GameState): { x: number; y: number } | null {
    const b = s.buildings.find((q) => q.uid === s.hearthUid);
    return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null;
  }

  private setScreen(s: ScreenId): void {
    this.screenId = s;
    if (s === 'title' && this.pendingQuit) {
      this.pendingQuit = false;
      this.game = null;
      if (this.backdrop) { this.tiles.bind(this.backdrop.state); this.light.bind(this.backdrop.state); this.ents.reset(); this.fx.clear(); }
    }
    if (s !== 'game' && this.game && s === 'title') this.game = null;
    if (s === 'game' && this.game) {
      this.ents.reset(); this.fx.clear();
      this.tiles.bind(this.game.state); this.light.bind(this.game.state);
      this.gestures.reset(); this.drawer.select(null); this.joy.reset();
      const h = this.hearthCenter(this.game.state);
      if (h) this.cam.focus(h, true);
      this.cam.follow = true;
    }
    this.title.show(s === 'title');
    this.barracks.show(s === 'barracks');
    if (s === 'settings') { this.settings.returnTo = 'title'; this.settings.show(true); }
    else if (s !== 'game') this.settings.show(false);
    this.router?.cancelAll();
  }

  // ── debug helpers ─────────────────────────────────────────────────────────
  private debugGoto(phase: Phase, night?: number): void {
    if (!this.game) this.startRun(false);
    const w = worldOf(this.game!);
    if (typeof night === 'number' && night >= 1) w.s.night = Math.floor(night);
    switch (phase) {
      case 'day': startDay(w); break;
      case 'dusk': startDusk(w); break;
      case 'night': if (w.s.phase !== 'dusk') startDusk(w); startNight(w); break;
      case 'dawn': startDawn(w); break;
      case 'victory': victory(w); break;
      case 'defeat': defeat(w); break;
    }
  }
  private debugGrant(r: Partial<Resources>): void {
    if (!this.game) return;
    const res = this.game.state.res as Resources;
    res.wood += r.wood ?? 0; res.stone += r.stone ?? 0; res.gold += r.gold ?? 0;
  }

  private hotkey(k: KeyCode): void {
    if (!this.game || this.screenId !== 'game') return;
    const s = this.game.state;
    if (k === KeyCode.ESCAPE) this.pause(!this._paused);
    else if (k === KeyCode.KEY_B) this.cmd({ t: 'buildMode', on: !s.buildMode });
    else if (k === KeyCode.KEY_H) this.cmd({ t: 'horn' });
    else if (k === KeyCode.SPACE) this.cmd(s.phase === 'dusk' ? { t: 'startNight' } : { t: 'callNight' });
    else if (k === KeyCode.KEY_Z) this.cmd({ t: 'undo' });
  }

  // ── frame loop ────────────────────────────────────────────────────────────
  protected update(dtRaw: number): void {
    if (!this.ready) return;
    const dt = Math.min(0.1, Math.max(0, dtRaw));
    this.time += dt;
    if (dt > 0) this.fpsAvg += (1 / Math.max(dt, 1e-3) - this.fpsAvg) * 0.05;
    if (this.measure()) this.relayout();
    if (this.cam.measure()) { /* zoom metrics refreshed */ }
    this.sfxP.tick(dt);

    // screen fade transitions
    if (this.fadeT >= 0) {
      const before = this.fadeT;
      this.fadeT += dt;
      if (before < FADE_SEC / 2 && this.fadeT >= FADE_SEC / 2 && this.pendingScreen) { this.setScreen(this.pendingScreen); this.pendingScreen = null; }
      const a = fadeAlpha(this.fadeT, FADE_SEC);
      this.fade.show(a > 0).alpha(a * 255);
      if (this.fadeT >= FADE_SEC) { this.fadeT = -1; this.fade.show(false); }
    }

    const inGame = this.screenId === 'game' && !!this.game;
    const g = inGame ? this.game! : this.backdrop;
    if (!g) return;

    // simulation
    if (inGame) {
      if (this.hitStop > 0) this.hitStop -= dt;
      else if (!this._paused) this.stepGame(g, dt);
      for (const e of g.drainEvents()) this.onEvent(e, g.state);
    } else {
      g.update(dt);
      g.drainEvents();
    }
    const s = g.state;
    this.buildingUids.clear();
    for (const b of s.buildings) this.buildingUids.add(b.uid);

    // camera
    const buildActive = inGame && (s.buildMode || s.phase === 'dusk');
    if (buildActive !== this.lastBuild) { this.lastBuild = buildActive; this.cam.follow = !buildActive; if (!buildActive) this.drawer.select(null); }
    if (this.joy.active) this.cam.follow = true;
    const leader = s.heroes.find((h) => h.leader && h.anim !== 'down') ?? s.heroes[0];
    if (!inGame) {
      const h = this.hearthCenter(s);
      if (h) this.cam.focus({ x: h.x + Math.sin(this.time * 0.07) * 6, y: h.y + Math.cos(this.time * 0.05) * 5 });
    } else if (this.cam.follow && leader && !buildActive) {
      const a = g.alpha();
      this.cam.track({ x: leader.px + (leader.x - leader.px) * a, y: leader.py + (leader.y - leader.py) * a }, this.joy.dir);
    }
    this.cam.update(dt);

    // world render
    const range = this.cam.tileRange(2);
    this.tiles.update(range, this.time);
    this.ents.update(s, g.alpha(), dt, range);
    for (const uid of this.pendingBounce) this.ents.bounce(uid);
    this.pendingBounce.length = 0;
    this.light.update(s, this.time, range);
    this.fx.update(dt);

    // UI
    const phase = s.phase;
    const hudOn = inGame && phase !== 'victory' && phase !== 'defeat';
    this.hud.show(hudOn);
    if (hudOn) this.hud.update(s, dt);
    this.drawer.show(buildActive && hudOn && !this.modalOpen());
    if (buildActive) this.drawer.update(dt);
    this.gestures.update(s, dt, buildActive && hudOn && !this.modalOpen() && !this._paused);
    if (!buildActive) this.radial.close();
    this.ents.selectedUid = this.radial.isOpen ? this.radial.uid : 0;
    this.omens.update(inGame ? s : { ...s, omens: [] });
    if (inGame) this.tutorial.update(s); else this.tutorial.node.active = false;
    const dawnOn = inGame && (phase === 'dawn' || !!s.boonOffer);
    this.dawn.show(dawnOn);
    if (dawnOn) this.dawn.update(s, dt);
    this.winS.show(inGame && phase === 'victory');
    this.loseS.show(inGame && phase === 'defeat');
    if (this.winS.shown) { this.winS.emberEarned = this.bankedEmber; this.winS.update(s); }
    if (this.loseS.shown) { this.loseS.emberEarned = this.bankedEmber; this.loseS.update(s); }
    this.squad.update(s);
    this.pauseS.show(inGame && this._paused);
    this.joy.node.active = this.joy.active && inGame && !buildActive;

    // music
    if (this.screenId === 'game' && this.game) this.music.play(musicFor(phase, !!s.boss));
    else this.music.play('music_day');
    this.music.update(dt);
    if (this.fpsText) this.fpsText.set(`${Math.round(this.fpsAvg)} fps`);
    this.lastPhase = phase;
  }

  private stepGame(g: Game, dt: number): void {
    if (this.autoplay) {
      // the bot is called once before each fixed step (core/bots contract)
      this.autoAcc += dt * this.speed;
      let n = 0;
      while (this.autoAcc >= DT && n < 240) {
        AutoplayBot(g); g.step(); this.autoAcc -= DT; n++;
        if (g.state.phase === 'victory' || g.state.phase === 'defeat') { this.autoAcc = 0; break; }
      }
      return;
    }
    let left = dt * this.speed;
    while (left > 0) { const d = Math.min(0.1, left); g.update(d); left -= d; }
  }

  // ── events → juice / sfx / ui ─────────────────────────────────────────────
  private heroVariant = 1;
  private onEvent(e: GameEvent, s: GameState): void {
    this.heroVariant = (this.heroVariant % 3) + 1;
    const snd = sfxForEvent(e, this.heroVariant);
    if (snd) this.sfx(snd.name, snd.priority);
    this.hud.onEvent(e);
    const fx = this.fx;
    switch (e.t) {
      case 'hit': {
        this.ents.flash(e.target);
        fx.anim('fx_hit', e.x, e.y, { dy: 6 });
        const isBld = this.buildingUids.has(e.target);
        const isHero = s.heroes.some((h) => h.uid === e.target);
        if (isBld) this.ents.attacked.set(e.target, this.time);
        const amt = `${Math.round(e.amount)}`;
        if (e.shatter) { fx.number(amt, e.x, e.y, PAL.D, true); fx.anim('fx_shatter', e.x, e.y, { dy: 6 }); }
        else if (e.crit) { fx.number(`${amt}!`, e.x, e.y, PAL.z, true); this.hitStop = Math.max(this.hitStop, HIT_STOP_SEC); }
        else fx.number(amt, e.x, e.y, isHero || isBld ? PAL.R : e.dtype === 'fire' ? PAL.y : e.dtype === 'frost' ? PAL.E : PAL.w);
        break;
      }
      case 'death':
        if (e.kind === 'enemy') {
          fx.shards(e.x, e.y, shardTint(e.id), 4 + (e.x * 7 + e.y * 13 > 0 ? Math.floor((e.x * 7 + e.y * 13) % 3) : 0));
          fx.anim('fx_smoke', e.x, e.y, { dy: 4 });
          if (e.id === 'mossback' || e.id === 'unlit') { this.cam.shake(4, 0.8); this.vibrate(250); }
        } else if (e.kind === 'building') {
          const stone = e.id in BUILDINGS && BUILDINGS[e.id as BuildingId].stone;
          fx.shards(e.x, e.y, [255, 255, 255], 6, stone ? 'fx_chip_stone' : 'fx_chip_wood');
          fx.anim('fx_dust', e.x, e.y, {}); fx.anim('fx_smoke', e.x, e.y, { dy: 8 });
          this.cam.shake(2, 0.25);
        } else {
          fx.anim('fx_smoke', e.x, e.y, { dy: 4 });
          this.vibrate(60);
        }
        break;
      case 'explode': {
        const big = e.radius >= 1.5;
        fx.anim('fx_explosion', e.x, e.y, { scale: big ? 2 : 1, fps: 14 });
        this.cam.shake(big ? 4 : 2, big ? 0.35 : 0.2);
        if (big) this.hitStop = Math.max(this.hitStop, HIT_STOP_SEC);
        this.vibrate(big ? 40 : 15);
        break;
      }
      case 'harvest': {
        const chip = e.res === 'wood' ? 'fx_chip_wood' : e.res === 'stone' ? 'fx_chip_stone' : 'fx_coin';
        fx.shards(e.x, e.y - 0.4, [255, 255, 255], 3, chip);
        this.hud.fly(e.res, e.x, e.y - 0.5);
        fx.number(`+${e.amount}`, e.x, e.y - 0.6, e.res === 'gold' ? PAL.z : e.res === 'wood' ? PAL.i : PAL.v);
        break;
      }
      case 'gold':
        fx.anim('fx_coin', e.x, e.y, { dy: 8, loop: true, life: 0.4 });
        this.hud.fly('gold', e.x, e.y - 0.3);
        break;
      case 'built':
        this.pendingBounce.push(e.uid);
        fx.anim('fx_dust', e.x + 0.5, e.y + 0.9, {});
        this.vibrate(12);
        break;
      case 'upgraded': {
        this.pendingBounce.push(e.uid);
        const b = s.buildings.find((q) => q.uid === e.uid);
        if (b) fx.anim('fx_levelup', b.x + b.w / 2, b.y + b.h / 2, {});
        break;
      }
      case 'repaired': {
        const b = s.buildings.find((q) => q.uid === e.uid);
        if (b) fx.anim('fx_heal', b.x + b.w / 2, b.y + b.h / 2, { vy: 20, life: 0.6, fade: true });
        break;
      }
      case 'sold': {
        const b = s.buildings.find((q) => q.uid === e.uid);
        if (b) { fx.anim('fx_dust', b.x + b.w / 2, b.y + b.h, {}); fx.anim('fx_coin', b.x + b.w / 2, b.y, { loop: true, life: 0.5, vy: 30 }); }
        break;
      }
      case 'buildFail':
        fx.anim('fx_smoke', e.x + 0.5, e.y + 0.5, { alpha: 0.7 });
        this.vibrate(25);
        break;
      case 'levelUp': {
        const h = s.heroes.find((q) => q.uid === e.hero);
        if (h) fx.anim('fx_levelup', h.x, h.y, { dy: 8 });
        break;
      }
      case 'skill': {
        const name = e.skill === 'shadowStep' ? 'fx_blink' : e.skill === 'shieldBash' ? 'fx_slash' : e.skill === 'miniTurret' ? 'fx_dust'
          : e.skill === 'arrowRain' ? 'fx_hit' : e.skill === 'sanctum' ? 'fx_heal' : 'fx_burn';
        fx.anim(name, e.x, e.y, { dy: 6 });
        break;
      }
      case 'phase': this.onPhase(e.phase, e.night, s); break;
      case 'bossIntro':
        this.hud.banner_(tr(`enemy.${e.id}.name`), tr('banner.boss'), PAL.L, 1.5);
        this.cam.shake(4, 1.5);
        this.vibrate(300);
        break;
      case 'brazier': {
        const b = s.buildings.find((q) => q.uid === e.uid);
        if (b) fx.anim(e.lit ? 'fx_burn' : 'fx_smoke', b.x + 0.5, b.y + 0.5, { dy: 10 });
        break;
      }
      case 'horn':
        for (const h of s.heroes) fx.anim('fx_levelup', h.x, h.y, { dy: 8 });
        this.vibrate(80);
        break;
      case 'poi': {
        const p = s.pois.find((q) => q.uid === e.uid);
        if (!p) break;
        if (e.action === 'opened') fx.shards(p.x + 0.5, p.y + 0.5, [255, 255, 255], 6, 'fx_coin');
        else if (e.action === 'freed' || e.action === 'used') fx.anim('fx_levelup', p.x + 0.5, p.y + 0.5, { dy: 8 });
        else fx.shards(p.x + 0.5, p.y + 0.5, PAL.M, 6);
        this.cam.shake(1, 0.15);
        break;
      }
      case 'hearthLow': this.vibrate(150); break;
      case 'falseDawn':
        this.hud.banner_(tr('boon.falsedawn.name'), tr('boon.falsedawn.desc'), PAL.z, 2.5);
        this.cam.shake(3, 0.5);
        break;
      case 'pulse':
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          fx.anim('fx_smoke', e.x + Math.cos(a) * e.radius * 0.5, e.y + Math.sin(a) * e.radius * 0.5, { vx: Math.cos(a) * 60, vy: -Math.sin(a) * 60, fade: true, life: 0.8 });
        }
        this.cam.shake(3, 0.4);
        break;
      case 'teleport': fx.anim('fx_blink', e.x, e.y, { dy: 8 }); break;
      case 'heal': fx.number(`+${Math.round(e.amount)}`, e.x, e.y, PAL.d); break;
      case 'enrage': this.cam.shake(2, 0.4); break;
      default: break;
    }
  }

  private onPhase(phase: Phase, night: number, s: GameState): void {
    switch (phase) {
      case 'night':
        this.hud.banner_(tr('banner.night', { n: night }), '', PAL.L, 2.2);
        this.hud.flashRifts();
        this.omens.open = false;
        break;
      case 'dusk': {
        const h = this.hearthCenter(s);
        if (h) this.cam.focus(h);
        this.cam.follow = false;
        this.omens.open = true;
        break;
      }
      case 'day':
        if (this.lastPhase !== null) this.hud.banner_(tr('phase.day'), tr('hud.night', { n: night }), PAL.z, 1.6);
        if (this.game) Save.saveRun(this.game.saveRun());
        break;
      case 'dawn':
        if (this.game) Save.saveRun(this.game.saveRun());
        break;
      case 'victory':
      case 'defeat': {
        if (this.game) {
          const total = this.game.emberEarned();
          const add = Math.max(0, total - this.bankedEmber);
          if (add > 0) { applyRunEmber(this.meta, add); this.bankedEmber = total; }
          this.saveMeta();
          if (phase === 'defeat') Save.clearRun();
          if (!this.meta.tutorialDone) { this.meta.tutorialDone = true; this.saveMeta(); }
        }
        this.vibrate(phase === 'victory' ? 200 : 400);
        break;
      }
    }
  }
}

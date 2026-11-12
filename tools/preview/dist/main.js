"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // assets/scripts/game/logic/atlasData.ts
  function defaultAnchor(name, w, h) {
    if (/^(tile_|edge_|ui_|icon_|font|portrait_|boon_|logo)/.test(name)) return [0, 0];
    if (/^(fx_|proj_|enemy_eyes)/.test(name)) return [w / 2, h / 2];
    return [w / 2, h];
  }
  function defaultSlice(name, w, h) {
    if (!/^ui_(panel|btn|tab|card|bar|minimap_frame)/.test(name)) return null;
    const ix = Math.max(1, Math.min(6, Math.floor((w - 1) / 2)));
    const iy = Math.max(1, Math.min(6, Math.floor((h - 1) / 2)));
    if (name.startsWith("ui_bar")) return [Math.min(2, ix), Math.min(2, iy), Math.min(2, ix), Math.min(2, iy)];
    return [ix, iy, ix, iy];
  }

  // tools/preview/src/atlas.ts
  var Atlas = class {
    constructor() {
      this.img = null;
      this.frames = {};
      this.missing = /* @__PURE__ */ new Set();
      this.tintCache = /* @__PURE__ */ new Map();
    }
    async load(base) {
      try {
        const res = await fetch(`${base}/art/atlas.json`, { cache: "no-store" });
        if (!res.ok) throw new Error(`atlas.json ${res.status}`);
        const json = await res.json();
        this.frames = json.frames || {};
        for (const [name, f] of Object.entries(this.frames)) {
          if (f.ax === void 0 || f.ay === void 0) {
            const [ax, ay] = defaultAnchor(name, f.w, f.h);
            f.ax ?? (f.ax = ax);
            f.ay ?? (f.ay = ay);
          }
          if (!Array.isArray(f.slice)) f.slice = defaultSlice(name, f.w, f.h);
        }
        const img = new Image();
        img.src = `${base}/art/atlas.png?v=${Date.now()}`;
        await img.decode();
        this.img = img;
      } catch (e) {
        console.warn("[preview] atlas not available yet:", e.message);
      }
    }
    has(name) {
      return !!this.frames[name];
    }
    get(name) {
      const f = this.frames[name];
      if (!f) {
        if (this.img && !this.missing.has(name)) {
          this.missing.add(name);
          console.warn(`[preview] missing sprite: ${name}`);
        }
        return null;
      }
      return f;
    }
    /** Picks the first existing name (no warning for the fallbacks that miss). */
    pick(...names) {
      for (const n of names) if (this.frames[n]) return n;
      return names[0];
    }
    /** Number of frames available for an animated base name (name_0..name_n-1). */
    count(base) {
      let n = 0;
      while (this.frames[`${base}_${n}`]) n++;
      return n;
    }
    /** Sprite (or its single-colour silhouette) as a drawable source rect. */
    source(name, f, tint, recolor, noOutline) {
      if ((recolor || noOutline) && !tint) return [this.recolored(name, f, recolor, noOutline), 0, 0];
      if (!tint) return [this.img, f.x, f.y];
      const key = name + "|" + tint;
      let c = this.tintCache.get(key);
      if (!c) {
        c = document.createElement("canvas");
        c.width = f.w;
        c.height = f.h;
        const g = c.getContext("2d");
        g.drawImage(this.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
        g.globalCompositeOperation = "source-in";
        g.fillStyle = tint;
        g.fillRect(0, 0, f.w, f.h);
        this.tintCache.set(key, c);
      }
      return [c, 0, 0];
    }
    recolored(name, f, color, noOutline = false) {
      const key = name + "#" + (color ?? "") + (noOutline ? "!" : "");
      let c = this.tintCache.get(key);
      if (c) return c;
      c = document.createElement("canvas");
      c.width = f.w;
      c.height = f.h;
      const g = c.getContext("2d");
      g.drawImage(this.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      const d = g.getImageData(0, 0, f.w, f.h);
      const r = color ? parseInt(color.slice(1, 3), 16) : -1, gg = color ? parseInt(color.slice(3, 5), 16) : 0, b = color ? parseInt(color.slice(5, 7), 16) : 0;
      for (let i = 0; i < d.data.length; i += 4) {
        if (d.data[i + 3] === 0) continue;
        if (d.data[i] === 27 && d.data[i + 1] === 27 && d.data[i + 2] === 47) {
          if (noOutline) d.data[i + 3] = 0;
          continue;
        }
        if (r >= 0) {
          d.data[i] = r;
          d.data[i + 1] = gg;
          d.data[i + 2] = b;
        }
      }
      g.putImageData(d, 0, 0);
      this.tintCache.set(key, c);
      return c;
    }
    /** Draws `name` with its anchor at art-px (x, y). */
    draw(ctx, name, x, y, o = {}) {
      const f = this.get(name);
      if (!f || !this.img) return f;
      const [src, sx, sy] = this.source(name, f, o.tint, o.recolor, o.noOutline);
      const a = o.alpha ?? 1;
      if (a <= 0) return f;
      const simple = !o.flip && !o.scale && !o.rot;
      if (a !== 1) ctx.globalAlpha = a;
      if (simple) ctx.drawImage(src, sx, sy, f.w, f.h, Math.round(x - f.ax), Math.round(y - f.ay), f.w, f.h);
      else {
        ctx.save();
        ctx.translate(Math.round(x - f.ax) + f.ax, Math.round(y - f.ay) + f.ay);
        if (o.rot) ctx.rotate(o.rot);
        const s = o.scale ?? 1;
        ctx.scale(o.flip ? -s : s, s);
        ctx.drawImage(src, sx, sy, f.w, f.h, -f.ax, -f.ay, f.w, f.h);
        ctx.restore();
      }
      if (a !== 1) ctx.globalAlpha = 1;
      return f;
    }
    /** Draws the sprite's top-left at (x, y) ignoring the anchor (UI layout). */
    drawTL(ctx, name, x, y, o = {}) {
      const f = this.get(name);
      if (!f) return null;
      return this.draw(ctx, name, x + f.ax, y + f.ay, o);
    }
    /** Draws the sprite centred on (x, y) ignoring the anchor (icons, flyers). */
    drawC(ctx, name, x, y, o = {}) {
      const f = this.get(name);
      if (!f) return null;
      return this.draw(ctx, name, Math.round(x - f.w / 2) + f.ax, Math.round(y - f.h / 2) + f.ay, o);
    }
    /** Draws a sub-rectangle of a sprite (debris shards, partial fills). */
    drawPart(ctx, name, sx, sy, w, h, dx, dy, alpha = 1) {
      const f = this.get(name);
      if (!f || !this.img) return;
      if (alpha !== 1) ctx.globalAlpha = alpha;
      ctx.drawImage(this.img, f.x + sx, f.y + sy, w, h, Math.round(dx), Math.round(dy), w, h);
      if (alpha !== 1) ctx.globalAlpha = 1;
    }
    /** 9-slice a panel/button sprite to w×h at (x, y). Insets from atlas.json `slice` (or CONTRACT defaults);
     *  `border` overrides all four. Edges and centre are TILED (never stretched) so the pixel texture is preserved. */
    nine(ctx, name, x, y, w, h, border, alpha = 1) {
      const f = this.get(name);
      if (!f || !this.img) return;
      let [l, t2, r, b] = border !== void 0 ? [border, border, border, border] : f.slice ?? [3, 3, 3, 3];
      x = Math.round(x);
      y = Math.round(y);
      w = Math.round(w);
      h = Math.round(h);
      if (w < l + r) {
        l = Math.floor(w / 2);
        r = w - l;
      }
      if (h < t2 + b) {
        t2 = Math.floor(h / 2);
        b = h - t2;
      }
      const im = this.img;
      const cw = f.w - l - r, ch = f.h - t2 - b, iw = w - l - r, ih = h - t2 - b;
      if (alpha !== 1) ctx.globalAlpha = alpha;
      const part = (sx, sy, sw, sh, dx, dy) => {
        if (sw > 0 && sh > 0) ctx.drawImage(im, f.x + sx, f.y + sy, sw, sh, dx, dy, sw, sh);
      };
      part(0, 0, l, t2, x, y);
      part(f.w - r, 0, r, t2, x + w - r, y);
      part(0, f.h - b, l, b, x, y + h - b);
      part(f.w - r, f.h - b, r, b, x + w - r, y + h - b);
      if (cw > 0) for (let dx = 0; dx < iw; dx += cw) {
        const ww = Math.min(cw, iw - dx);
        part(l, 0, ww, t2, x + l + dx, y);
        part(l, f.h - b, ww, b, x + l + dx, y + h - b);
      }
      if (ch > 0) for (let dy = 0; dy < ih; dy += ch) {
        const hh = Math.min(ch, ih - dy);
        part(0, t2, l, hh, x, y + t2 + dy);
        part(f.w - r, t2, r, hh, x + w - r, y + t2 + dy);
        if (cw > 0) for (let dx = 0; dx < iw; dx += cw) part(l, t2, Math.min(cw, iw - dx), hh, x + l + dx, y + t2 + dy);
      }
      if (alpha !== 1) ctx.globalAlpha = 1;
    }
  };

  // tools/preview/src/audio.ts
  var ALIAS = {
    horn_night: "night_horn",
    horn_rally: "rally_horn",
    explode: "explosion",
    fail: "place_fail",
    levelup: "level_up",
    shoot_arrow: "arrow",
    shoot_bolt: "ballista",
    shoot_mortar: "mortar_fire",
    shoot_frost_shard: "frost",
    shoot_spark: "spark",
    shoot_fireball: "hero_hit_2",
    shoot_turret: "arrow",
    shoot_spit: "hero_hit_3",
    repair: "upgrade",
    hero_down: "hero_hit_3",
    poi: "coin",
    pulse: "boss_roar",
    ui_open: "ui_click",
    skill_shieldBash: "hero_hit_1",
    skill_arrowRain: "arrow",
    skill_fireWall: "explosion",
    skill_miniTurret: "place",
    skill_sanctum: "level_up",
    skill_shadowStep: "hero_hit_2"
  };
  var Audio = class {
    constructor() {
      this.ctx = null;
      this.files = {};
      this.buffers = /* @__PURE__ */ new Map();
      this.base = "resources";
      this.voices = 0;
      this.maxVoices = 8;
      this.retriggerMs = 50;
      this.fadeSec = 1;
      this.lastPlay = /* @__PURE__ */ new Map();
      this.sfxGain = null;
      this.musicGain = null;
      this.current = null;
      this.wantMusic = null;
      this.volumes = { music: 0.6, sfx: 0.8 };
      this.muted = false;
    }
    async init(base) {
      this.base = base;
      try {
        const r = await fetch(`${base}/audio/audio.json`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        this.files = j.files || {};
        const pb = j.playback || {};
        this.maxVoices = pb.maxSfxVoices ?? 8;
        this.retriggerMs = pb.sfxRetriggerMs ?? 50;
        this.fadeSec = pb.musicCrossfadeSec ?? 1;
      } catch {
      }
    }
    /** Must be called from a user gesture (autoplay policy). */
    unlock() {
      if (this.ctx || this.muted) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.ctx.destination);
        this.setVolumes(this.volumes.music, this.volumes.sfx);
        for (const name of Object.keys(this.files)) this.load(name);
        if (this.wantMusic) this.music(this.wantMusic);
      } catch {
        this.ctx = null;
      }
    }
    setVolumes(music, sfx) {
      this.volumes = { music, sfx };
      if (this.musicGain) this.musicGain.gain.value = music;
      if (this.sfxGain) this.sfxGain.gain.value = sfx;
    }
    async load(name) {
      if (this.buffers.has(name)) return this.buffers.get(name);
      const f = this.files[name];
      if (!f || !this.ctx) return null;
      try {
        const r = await fetch(`${this.base}/audio/${f.file}`);
        if (!r.ok) return null;
        const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
        this.buffers.set(name, buf);
        return buf;
      } catch {
        return null;
      }
    }
    sfx(key, vol = 1) {
      const name = this.files[key] ? key : ALIAS[key];
      if (!name || !this.ctx || !this.sfxGain) return;
      const buf = this.buffers.get(name);
      if (!buf) return;
      const now = performance.now();
      if (now - (this.lastPlay.get(name) ?? -1e9) < this.retriggerMs) return;
      if (this.voices >= this.maxVoices) return;
      this.lastPlay.set(name, now);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol * (this.files[name].volume ?? 1);
      src.connect(g);
      g.connect(this.sfxGain);
      this.voices++;
      src.onended = () => {
        this.voices--;
      };
      src.start();
    }
    music(kind) {
      const name = `music_${kind}`;
      this.wantMusic = kind;
      if (!this.ctx || !this.musicGain || this.current && this.current.name === name) return;
      const buf = this.buffers.get(name);
      if (!buf) {
        this.load(name).then((b) => {
          if (b && this.wantMusic === kind) this.music(kind);
        });
        return;
      }
      const t2 = this.ctx.currentTime;
      if (this.current) {
        const old = this.current;
        old.gain.gain.setValueAtTime(old.gain.gain.value, t2);
        old.gain.gain.linearRampToValueAtTime(0, t2 + this.fadeSec);
        old.src.stop(t2 + this.fadeSec + 0.05);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t2);
      g.gain.linearRampToValueAtTime(this.files[name].volume ?? 0.55, t2 + this.fadeSec);
      src.connect(g);
      g.connect(this.musicGain);
      src.start();
      this.current = { name, src, gain: g };
    }
  };

  // assets/scripts/core/data/balance.ts
  var BALANCE = {
    tile: 16,
    mapSize: 56,
    simHz: 30,
    day: { seconds: 75, firstDaySeconds: 60, callNightGoldPerSec: 0.5, buildTimeScale: 0.25 },
    night: { hpScale: (n) => 1 + 0.4 * Math.max(0, n - 5), enrageAfter: 120, enrageSpeedMul: 1.5, enrageDmgMul: 2, spawnWindow: (n) => Math.min(70, 35 + 4 * n), pulseMin: 6, pulseMax: 8 },
    budget: (n) => 40 + 28 * n + 4 * n * n,
    bossBudgetMul: 0.6,
    endlessMul: 1.18,
    riftsActive: (n) => n <= 2 ? 1 : n <= 5 ? 2 : n <= 8 ? 3 : 4,
    rootBudgetCut: 0.3,
    light: { hearth: [7, 9, 11], brazier: [4, 5.5], leader: 3, leaderFar: 5, dimBand: 1.5, veiledSpeedMul: 1.25, brazierFuelWood: 1, relightSeconds: 2, relightRange: 1.6, pyroRelightRange: 3, fogRadius: 5, fadeSeconds: 3 },
    path: { breachDiv: 8, breachDivBrute: 20, tarCost: 1.5, spikeCost: 0.5, recomputeMaxHz: 5, hpChangeFrac: 0.2, aggroRange: 2.5, leashRange: 4 },
    build: { sellRefund: 0.6, upgradeCostMul: [1, 1.6, 2.5], upgradeDmgMul: 0.4, repairHpPerUnit: 15, nightBuildDelay: 1.5, undoDepth: 20 },
    synergy: { flameRange: 2, flameDps: 3, flameSecs: 3, shatterMul: 1.5, embeddedRangeBonus: 1, rallyRange: 3, rallyRateMul: 1.25, tarSpikeMul: 2 },
    squad: { max: 4, maxWithBoon: 5, harvestRange: 1.2, harvestInterval: 0.6, reviveSeconds: 20, xp: [20, 50, 100, 180], levelMul: 0.12, moveSpeed: 3.2, engageRange: 3.5, followCatchup: 1.35, teleportDist: 12 },
    horn: { charge: 40, seconds: 6, boonSeconds: 10, rateMul: 1.5 },
    start: { wood: 40, stone: 15, gold: 0, freeBraziers: 1 },
    gold: { gloomling: 1, skitter: 1, spitter: 3, brute: 6, wisp: 2, bomber: 3, snuffer: 5, eliteMul: 3, boss: 80 },
    xp: { gloomling: 1, skitter: 1, spitter: 3, brute: 8, wisp: 2, bomber: 3, snuffer: 5, eliteMul: 3, boss: 60 },
    ember: { perNight: 10, perBoss: 50, perCamp: 5, victory: 100 },
    caps: { enemies: 250, projectiles: 60, buildings: 150 },
    elite: { fromNight: 9, maxBudgetFrac: 0.15, hpMul: 2.5, dmgMul: 1.3, costMul: 2.5, scale: 1.25 },
    harvest: { treeChops: 3, treeWood: 2, rockChops: { rock_s: 2, rock_m: 4, rock_l: 7 }, rockStone: 2, oreChops: 5, oreGold: 3, regrowDays: 2 },
    poi: { camps: 6, cages: 3, shrines: 3, rifts: 4, cageHp: 40, rootHp: 150, chestGold: 25, campGuardsMin: 4, campGuardsMax: 8, touchRange: 1.4 },
    rarity: { early: [70, 25, 5], late: [55, 35, 10], lateFromNight: 6 },
    boss: { mossbackHp: 1500, unlitHp: 4e3 },
    speedEnemyMul: 1
  };
  var DT = 1 / BALANCE.simHz;

  // assets/scripts/core/data/talents.ts
  var TALENTS = [
    { id: "startWood", maxLevel: 3, costs: [30, 60, 120], perLevel: 20 },
    // +20 starting wood / level
    { id: "startStone", maxLevel: 3, costs: [30, 60, 120], perLevel: 15 },
    // +15 starting stone / level
    { id: "hearthHp", maxLevel: 3, costs: [30, 60, 120], perLevel: 0.1 },
    // +10% hearth HP / level
    { id: "longDay", maxLevel: 3, costs: [30, 60, 120], perLevel: 8 },
    // +8 s day / level
    { id: "heroLevel", maxLevel: 3, costs: [30, 60, 120], perLevel: 1 },
    // starting hero +1 level / level
    { id: "refund", maxLevel: 3, costs: [30, 60, 120], perLevel: 0.1 },
    // +10% sell refund / level
    { id: "chestChoice", maxLevel: 3, costs: [30, 60, 120], perLevel: 1 },
    // +1 chest boon choice / level
    { id: "hornPrecharge", maxLevel: 3, costs: [30, 60, 120], perLevel: 0.5 }
    // horn starts 50% / 75% / 100% charged
  ];
  var TALENT_BY_ID = Object.fromEntries(TALENTS.map((t2) => [t2.id, t2]));
  function hornPrecharge(level) {
    return level <= 0 ? 0 : level === 1 ? 0.5 : level === 2 ? 0.75 : 1;
  }

  // assets/scripts/core/data/boons.ts
  var B = (id, group, rarity, maxStacks = 1) => ({ id, group, rarity, maxStacks });
  var BOONS = [
    B("sharp", "squad", "common", 3),
    B("thick", "squad", "common", 3),
    B("swift", "squad", "common", 2),
    B("leech", "squad", "common"),
    B("horn", "squad", "common"),
    B("ally", "squad", "rare"),
    B("cooldown", "squad", "rare"),
    B("twin", "squad", "legendary"),
    B("mason", "fort", "common", 2),
    B("boulder", "fort", "common", 3),
    B("hawk", "fort", "common", 2),
    B("reload", "fort", "common", 3),
    B("spikes", "fort", "common", 2),
    B("harvest", "fort", "common"),
    B("thorns", "fort", "rare"),
    B("living", "fort", "legendary"),
    B("bigfire", "flame", "common", 3),
    B("embers", "flame", "common"),
    B("ash", "flame", "common", 3),
    B("farlight", "flame", "common"),
    B("mirror", "flame", "common"),
    B("spread", "flame", "rare"),
    B("rebirth", "flame", "rare"),
    B("falsedawn", "flame", "legendary")
  ];
  var BOON_BY_ID = Object.fromEntries(BOONS.map((b) => [b.id, b]));
  var BOON_FX = {
    sharp: 0.15,
    thick: 0.2,
    swift: 0.15,
    leech: 0.08,
    hornSecs: 10,
    cooldown: 0.75,
    mason: 0.25,
    boulder: 0.3,
    hawk: 1,
    reload: 0.15,
    spikes: 4,
    harvest: 0.5,
    thorns: 4,
    living: 0.01,
    bigfire: 1,
    ash: 1,
    farlight: 5,
    mirror: 0.2,
    spreadRange: 1.2,
    rebirth: 2,
    falseDawnAt: 0.25,
    falseDawnSecs: 8,
    falseDawnStun: 3
  };

  // assets/scripts/core/data/strings.en.ts
  var STRINGS_EN = {
    // ── Title / meta screens
    "game.title": "Emberhold",
    "ui.play": "Play",
    "ui.continue": "Continue run",
    "ui.barracks": "Barracks",
    "ui.settings": "Settings",
    "ui.back": "Back",
    "ui.pause": "Paused",
    "ui.resume": "Resume",
    "ui.quit": "Quit to title",
    "ui.music": "Music",
    "ui.sfx": "Sound effects",
    "ui.haptics": "Vibration",
    "ui.bigText": "Large text",
    "ui.language": "Language",
    "ui.resetData": "Erase all data",
    "ui.resetConfirm": "Erase all progress? This cannot be undone.",
    "ui.on": "On",
    "ui.off": "Off",
    "ui.ember": "Ember",
    "ui.unlock": "Unlock",
    "ui.unlocked": "Unlocked",
    "ui.locked": "Locked",
    "ui.starter": "Starting hero",
    "ui.choose": "Choose",
    "ui.heroes": "Heroes",
    "ui.talents": "Talents",
    "ui.blueprints": "Blueprints",
    "ui.level": "Lv {n}",
    "ui.max": "Max",
    "ui.cost": "Cost",
    // ── HUD
    "hud.night": "Night {n}/10",
    "hud.nightEndless": "Night {n}",
    "hud.enemiesLeft": "{n} left",
    "hud.callNight": "Call night early",
    "hud.callNightGold": "+{n} gold",
    "hud.startNight": "Start night",
    "hud.horn": "Rally Horn",
    "hud.build": "Build",
    "hud.hearthLow": "The Hearth is fading!",
    "phase.day": "Day",
    "phase.dusk": "Dusk",
    "phase.night": "Night",
    "phase.dawn": "Dawn",
    "phase.victory": "Victory",
    "phase.defeat": "Defeat",
    "banner.night": "NIGHT {n}",
    "banner.boss": "A great shadow approaches",
    "banner.enrage": "The Gloom grows restless!",
    // ── Build mode
    "build.tab.defense": "Defense",
    "build.tab.light": "Light",
    "build.tab.traps": "Traps",
    "build.tab.economy": "Economy",
    "build.upgrade": "Upgrade",
    "build.repair": "Repair",
    "build.sell": "Sell",
    "build.undo": "Undo",
    "build.exit": "Done",
    "build.confirm": "Place",
    "build.cancel": "Cancel",
    "build.fail.cost": "Not enough resources",
    "build.fail.blocked": "Something is in the way",
    "build.fail.dark": "Too dark to build here",
    "build.fail.locked": "Blueprint locked",
    "build.needTrees": "Needs 3 trees nearby",
    "build.needRocks": "Needs 2 rocks nearby",
    "build.synergy.flame": "Flame arrows",
    "build.synergy.embedded": "Wall-embedded: +1 range",
    "build.synergy.rally": "Rallied: +25% fire rate",
    "build.synergy.tarSpike": "Tar + spikes: double spike damage",
    "build.shatter": "Shatter!",
    // ── Dusk / omens
    "omen.title": "Omens",
    "omen.subtitle": "Tonight the Gloom brings:",
    "omen.rift": "Rift {n}",
    "omen.elite": "Elite",
    "omen.boss": "Boss",
    "omen.new": "New foe",
    "omen.rootCut": "Rift root destroyed: -30% here",
    "omen.fuel": "Braziers burn {n} wood tonight",
    "omen.unfueled": "{n} brazier(s) unlit: no wood",
    // ── Dawn / boons
    "dawn.title": "Dawn breaks",
    "dawn.summary": "Night {n} survived",
    "dawn.kills": "Gloom slain",
    "dawn.gold": "Gold earned",
    "dawn.choose": "Choose a boon",
    "chest.title": "Gloom chest",
    "chest.choose": "Choose one",
    "boon.group.squad": "Squad",
    "boon.group.fort": "Fortress",
    "boon.group.flame": "Flame",
    "boon.rarity.common": "Common",
    "boon.rarity.rare": "Rare",
    "boon.rarity.legendary": "Legendary",
    "boon.stacks": "{n}/{m}",
    // ── End screens
    "end.victory": "The Hearth endures",
    "end.defeat": "The Hearth has gone out",
    "end.nights": "Nights survived",
    "end.bosses": "Bosses slain",
    "end.camps": "Camps cleared",
    "end.kills": "Gloom slain",
    "end.built": "Structures built",
    "end.ember": "Ember earned",
    "end.endless": "Continue: Endless",
    "end.title": "Return to title",
    // ── Tavern / squad
    "tavern.title": "Tavern",
    "tavern.hire": "Hire for {n} gold",
    "squad.reserve": "Reserve",
    "squad.swap": "Swap",
    "squad.down": "Down",
    "squad.full": "Squad full: sent to reserve",
    // ── Tutorial (SPEC §10.3)
    "tutorial.0": "Drag anywhere to lead your squad.",
    "tutorial.1": "Stand next to a tree to chop wood.",
    "tutorial.2": "Tap the hammer and paint 6 wall tiles.",
    "tutorial.3": "Place an arrow tower next to a brazier for flame arrows.",
    "tutorial.4": "Read the omens, then start the night.",
    "tutorial.skip": "Skip tutorial",
    // ── New-mechanic cards at dusk
    "intro.gloomling": "Gloomlings march to the Hearth along the cheapest path.",
    "intro.skitter": "Skitters come in packs and squeeze through gaps.",
    "intro.spitter": "Spitters stop at range and spit at your towers.",
    "intro.brute": "Brutes would rather smash a wall than walk around it.",
    "intro.wisp": "Wisps fly straight over walls and traps.",
    "intro.bomber": "Bombers rush the nearest building and explode.",
    "intro.snuffer": "Snuffers hunt your braziers. Stand near one to relight it.",
    "intro.mossback": "Mossback walks straight through your walls.",
    "intro.unlit": "The Unlit King smothers every light around him.",
    "intro.elite": "Elite Gloom: tougher, stronger, glowing.",
    // ── Buildings
    "bld.hearth.name": "Hearth",
    "bld.hearth.desc": "The heart of your hold. Lights 7 tiles and spits weak fire. If it goes out, the run ends.",
    "bld.wall_wood.name": "Wooden Wall",
    "bld.wall_wood.desc": "Cheap obstacle. Paint in lines. Upgrades to stone.",
    "bld.wall_stone.name": "Stone Wall",
    "bld.wall_stone.desc": "Sturdy obstacle. Paint in lines.",
    "bld.gate.name": "Gate",
    "bld.gate.desc": "Your heroes walk through; the Gloom treats it as a wall.",
    "bld.brazier.name": "Brazier",
    "bld.brazier.desc": "Lights 4 tiles so you can build further. Burns 1 wood per night.",
    "bld.tower_arrow.name": "Arrow Tower",
    "bld.tower_arrow.desc": "Range 5, single target, hits flyers.",
    "bld.tower_ballista.name": "Ballista",
    "bld.tower_ballista.desc": "Range 8, heavy bolt pierces up to 4 foes. Cannot hit flyers.",
    "bld.tower_frost.name": "Frost Tower",
    "bld.tower_frost.desc": "Aura slows foes within 3 tiles by 40% and chills them.",
    "bld.tower_mortar.name": "Mortar",
    "bld.tower_mortar.desc": "Range 4-9, explosive shells. Cannot hit flyers.",
    "bld.trap_spikes.name": "Spikes",
    "bld.trap_spikes.desc": "Stabs each foe that steps on it, 6 times. Rearms at dawn.",
    "bld.trap_tar.name": "Tar Pit",
    "bld.trap_tar.desc": "Slows foes by 50%. Fire ignites it for 4 seconds.",
    "bld.lumber_camp.name": "Lumber Camp",
    "bld.lumber_camp.desc": "Needs 3 trees nearby. Produces wood during the day.",
    "bld.quarry.name": "Quarry",
    "bld.quarry.desc": "Needs 2 rocks nearby. Produces stone during the day.",
    "bld.tower_spark.name": "Spark Tower",
    "bld.tower_spark.desc": "Lightning that jumps between 3 foes. Hits flyers.",
    "bld.barracks.name": "Barracks",
    "bld.barracks.desc": "Each night, 2 militia guard the area around it.",
    "bld.workshop.name": "Workshop",
    "bld.workshop.desc": "At night, repairs buildings within 5 tiles for free.",
    "bld.tavern.name": "Tavern",
    "bld.tavern.desc": "Each dawn, offers a hero for hire.",
    // ── Heroes
    "hero.knight.name": "Brann",
    "hero.knight.role": "Guardian",
    "hero.knight.skill": "Shield Bash",
    "hero.knight.skillDesc": "Stuns foes in a cone for 1 s.",
    "hero.knight.passive": "Nearby Gloom attack Brann first.",
    "hero.ranger.name": "Wren",
    "hero.ranger.role": "Archer",
    "hero.ranger.skill": "Arrow Rain",
    "hero.ranger.skillDesc": "Fires a fan of 5 arrows.",
    "hero.ranger.passive": "+25% damage to foes in the dark.",
    "hero.pyro.name": "Ilka",
    "hero.pyro.role": "Firecaller",
    "hero.pyro.skill": "Fire Wall",
    "hero.pyro.skillDesc": "A 4-tile wall of flame for 4 s.",
    "hero.pyro.passive": "Relights nearby braziers instantly; ignites tar.",
    "hero.tinker.name": "Tobi",
    "hero.tinker.role": "Tinkerer",
    "hero.tinker.skill": "Mini Turret",
    "hero.tinker.skillDesc": "Deploys a turret for 8 s.",
    "hero.tinker.passive": "Repairs nearby buildings; building costs -10%.",
    "hero.cleric.name": "Mira",
    "hero.cleric.role": "Healer",
    "hero.cleric.skill": "Sanctum",
    "hero.cleric.skillDesc": "Holy ground heals allies and weakens foes.",
    "hero.cleric.passive": "Heals the most wounded ally nearby.",
    "hero.rogue.name": "Vex",
    "hero.rogue.role": "Assassin",
    "hero.rogue.skill": "Shadow Step",
    "hero.rogue.skillDesc": "Blinks to the toughest foe; next hit x3.",
    "hero.rogue.passive": "Squad moves 30% faster out of combat.",
    // ── Enemies
    "enemy.gloomling.name": "Gloomling",
    "enemy.skitter.name": "Skitter",
    "enemy.spitter.name": "Spitter",
    "enemy.brute.name": "Brute",
    "enemy.wisp.name": "Wisp",
    "enemy.bomber.name": "Bomber",
    "enemy.snuffer.name": "Snuffer",
    "enemy.mossback.name": "Mossback",
    "enemy.unlit.name": "The Unlit",
    "enemy.militia.name": "Militia",
    // ── POIs
    "poi.camp": "Gloom camp",
    "poi.cage": "Hero cage",
    "poi.shrine": "Shrine",
    "poi.rift": "Rift",
    "poi.root": "Rift root",
    "poi.chest": "Chest",
    "shrine.damage": "Shrine: heroes +20% damage until the next dawn",
    "shrine.towerRate": "Shrine: towers +25% fire rate until the next dawn",
    "shrine.heal": "Shrine: the Hearth is fully restored",
    "cage.freed": "{name} joins your squad!",
    "root.destroyed": "Rift root destroyed: fewer Gloom from this rift tonight",
    // ── Boons
    "boon.sharp.name": "Keen Edge",
    "boon.sharp.desc": "Heroes deal +15% damage.",
    "boon.thick.name": "Thick Hide",
    "boon.thick.desc": "Heroes have +20% HP.",
    "boon.swift.name": "Quick Feet",
    "boon.swift.desc": "Squad moves 15% faster.",
    "boon.leech.name": "Bloodthirst",
    "boon.leech.desc": "Heroes heal 8% of damage dealt.",
    "boon.horn.name": "Echoing Horn",
    "boon.horn.desc": "Rally Horn lasts 10 s instead of 6.",
    "boon.ally.name": "Comrades",
    "boon.ally.desc": "+1 squad slot (max 5).",
    "boon.cooldown.name": "Quickening",
    "boon.cooldown.desc": "Skills recharge 25% faster.",
    "boon.twin.name": "Twinned Souls",
    "boon.twin.desc": "Hero skills trigger twice.",
    "boon.mason.name": "Master Mason",
    "boon.mason.desc": "Walls cost 25% less.",
    "boon.boulder.name": "Bedrock",
    "boon.boulder.desc": "Walls have +30% HP.",
    "boon.hawk.name": "Hawk Eye",
    "boon.hawk.desc": "Towers +1 range.",
    "boon.reload.name": "Quick Reload",
    "boon.reload.desc": "Towers fire 15% faster.",
    "boon.spikes.name": "Double Spikes",
    "boon.spikes.desc": "Spike traps +4 uses.",
    "boon.harvest.name": "Bountiful Harvest",
    "boon.harvest.desc": "Lumber camps and quarries produce 50% more.",
    "boon.thorns.name": "Thorned Walls",
    "boon.thorns.desc": "Gloom striking a wall take 4 damage per hit.",
    "boon.living.name": "Living Fortress",
    "boon.living.desc": "Buildings regenerate 1% HP/s at night.",
    "boon.bigfire.name": "Roaring Fire",
    "boon.bigfire.desc": "Hearth light radius +1.",
    "boon.embers.name": "Everglow",
    "boon.embers.desc": "Braziers need no fuel.",
    "boon.ash.name": "Hot Ash",
    "boon.ash.desc": "Gloom on lit ground take 1 fire damage per second.",
    "boon.farlight.name": "Far Lantern",
    "boon.farlight.desc": "Leader lantern reaches 5 tiles.",
    "boon.mirror.name": "Mirrorshine",
    "boon.mirror.desc": "Towers in the Hearth light deal +20% damage.",
    "boon.spread.name": "Wildfire",
    "boon.spread.desc": "Burning spreads to adjacent Gloom.",
    "boon.rebirth.name": "Rekindle",
    "boon.rebirth.desc": "The Hearth heals 2 HP/s during the day.",
    "boon.falsedawn.name": "False Dawn",
    "boon.falsedawn.desc": "Once per night at <25% Hearth HP: light the whole island for 8 s and stun all Gloom for 3 s.",
    // ── Talents
    "talent.startWood.name": "Woodpile",
    "talent.startWood.desc": "+20 starting wood per level.",
    "talent.startStone.name": "Stockpile",
    "talent.startStone.desc": "+15 starting stone per level.",
    "talent.hearthHp.name": "Stout Hearth",
    "talent.hearthHp.desc": "Hearth +10% HP per level.",
    "talent.longDay.name": "Long Days",
    "talent.longDay.desc": "Days last 8 s longer per level.",
    "talent.heroLevel.name": "Veteran",
    "talent.heroLevel.desc": "Starting hero +1 level per level.",
    "talent.refund.name": "Thrift",
    "talent.refund.desc": "Selling refunds +10% per level.",
    "talent.chestChoice.name": "Treasure Sense",
    "talent.chestChoice.desc": "Chests offer +1 boon choice per level.",
    "talent.hornPrecharge.name": "Ready Horn",
    "talent.hornPrecharge.desc": "Rally Horn starts 50/75/100% charged."
  };

  // assets/scripts/core/data/strings.vi.ts
  var STRINGS_VI = {
    "game.title": "Emberhold",
    "ui.play": "Ch\u01A1i",
    "ui.continue": "Ti\u1EBFp t\u1EE5c run",
    "ui.barracks": "Doanh tr\u1EA1i",
    "ui.settings": "C\xE0i \u0111\u1EB7t",
    "ui.back": "Quay l\u1EA1i",
    "ui.pause": "T\u1EA1m d\u1EEBng",
    "ui.resume": "Ti\u1EBFp t\u1EE5c",
    "ui.quit": "V\u1EC1 m\xE0n h\xECnh ch\xEDnh",
    "ui.music": "Nh\u1EA1c",
    "ui.sfx": "Hi\u1EC7u \u1EE9ng \xE2m thanh",
    "ui.haptics": "Rung",
    "ui.bigText": "Ch\u1EEF to",
    "ui.language": "Ng\xF4n ng\u1EEF",
    "ui.resetData": "X\xF3a d\u1EEF li\u1EC7u",
    "ui.resetConfirm": "X\xF3a to\xE0n b\u1ED9 ti\u1EBFn tr\xECnh? Kh\xF4ng th\u1EC3 ho\xE0n t\xE1c.",
    "ui.on": "B\u1EADt",
    "ui.off": "T\u1EAFt",
    "ui.ember": "Ember",
    "ui.unlock": "M\u1EDF kh\xF3a",
    "ui.unlocked": "\u0110\xE3 m\u1EDF",
    "ui.locked": "\u0110ang kh\xF3a",
    "ui.starter": "Hero kh\u1EDFi \u0111\u1EA7u",
    "ui.choose": "Ch\u1ECDn",
    "ui.heroes": "Anh h\xF9ng",
    "ui.talents": "Thi\xEAn ph\xFA",
    "ui.blueprints": "B\u1EA3n v\u1EBD",
    "ui.level": "C\u1EA5p {n}",
    "ui.max": "T\u1ED1i \u0111a",
    "ui.cost": "Gi\xE1",
    "hud.night": "\u0110\xEAm {n}/10",
    "hud.nightEndless": "\u0110\xEAm {n}",
    "hud.enemiesLeft": "C\xF2n {n}",
    "hud.callNight": "G\u1ECDi \u0111\xEAm s\u1EDBm",
    "hud.callNightGold": "+{n} v\xE0ng",
    "hud.startNight": "B\u1EAFt \u0111\u1EA7u \u0111\xEAm",
    "hud.horn": "T\xF9 v\xE0",
    "hud.build": "X\xE2y",
    "hud.hearthLow": "L\xF2 L\u1EEDa s\u1EAFp t\u1EAFt!",
    "phase.day": "Ng\xE0y",
    "phase.dusk": "Ho\xE0ng h\xF4n",
    "phase.night": "\u0110\xEAm",
    "phase.dawn": "B\xECnh minh",
    "phase.victory": "Chi\u1EBFn th\u1EAFng",
    "phase.defeat": "Th\u1EA5t b\u1EA1i",
    "banner.night": "\u0110\xCAM {n}",
    "banner.boss": "M\u1ED9t b\xF3ng \u0111en kh\u1ED5ng l\u1ED3 \u0111ang t\u1EDBi",
    "banner.enrage": "B\xF3ng t\u1ED1i n\u1ED5i gi\u1EADn!",
    "build.tab.defense": "Ph\xF2ng th\u1EE7",
    "build.tab.light": "\xC1nh s\xE1ng",
    "build.tab.traps": "B\u1EABy",
    "build.tab.economy": "Kinh t\u1EBF",
    "build.upgrade": "N\xE2ng c\u1EA5p",
    "build.repair": "S\u1EEDa",
    "build.sell": "B\xE1n",
    "build.undo": "Ho\xE0n t\xE1c",
    "build.exit": "Xong",
    "build.confirm": "\u0110\u1EB7t",
    "build.cancel": "H\u1EE7y",
    "build.fail.cost": "Kh\xF4ng \u0111\u1EE7 t\xE0i nguy\xEAn",
    "build.fail.blocked": "C\xF3 v\u1EADt c\u1EA3n",
    "build.fail.dark": "Qu\xE1 t\u1ED1i \u0111\u1EC3 x\xE2y",
    "build.fail.locked": "Ch\u01B0a m\u1EDF b\u1EA3n v\u1EBD",
    "build.needTrees": "C\u1EA7n 3 c\xE2y g\u1EA7n \u0111\xF3",
    "build.needRocks": "C\u1EA7n 2 t\u1EA3ng \u0111\xE1 g\u1EA7n \u0111\xF3",
    "build.synergy.flame": "T\xEAn l\u1EEDa",
    "build.synergy.embedded": "\xC2m t\u01B0\u1EDDng: +1 t\u1EA7m",
    "build.synergy.rally": "Hi\u1EC7u tri\u1EC7u: +25% t\u1ED1c b\u1EAFn",
    "build.synergy.tarSpike": "H\u1EAFc \xEDn + ch\xF4ng: ch\xF4ng \xD72",
    "build.shatter": "V\u1EE1 b\u0103ng!",
    "omen.title": "\u0110i\u1EC1m b\xE1o",
    "omen.subtitle": "\u0110\xEAm nay b\xF3ng t\u1ED1i mang t\u1EDBi:",
    "omen.rift": "Khe n\u1EE9t {n}",
    "omen.elite": "Tinh nhu\u1EC7",
    "omen.boss": "Tr\xF9m",
    "omen.new": "K\u1EBB th\xF9 m\u1EDBi",
    "omen.rootCut": "R\u1EC5 khe n\u1EE9t \u0111\xE3 nh\u1ED5: -30% \u1EDF \u0111\xE2y",
    "omen.fuel": "L\xF2 than \u0111\u1ED1t {n} g\u1ED7 \u0111\xEAm nay",
    "omen.unfueled": "{n} l\xF2 than t\u1EAFt: thi\u1EBFu g\u1ED7",
    "dawn.title": "B\xECnh minh",
    "dawn.summary": "\u0110\xE3 s\u1ED1ng s\xF3t \u0111\xEAm {n}",
    "dawn.kills": "Qu\xE1i b\u1ECB h\u1EA1",
    "dawn.gold": "V\xE0ng nh\u1EADn \u0111\u01B0\u1EE3c",
    "dawn.choose": "Ch\u1ECDn m\u1ED9t boon",
    "chest.title": "R\u01B0\u01A1ng b\xF3ng t\u1ED1i",
    "chest.choose": "Ch\u1ECDn m\u1ED9t",
    "boon.group.squad": "\u0110\u1ED9i",
    "boon.group.fort": "Ph\xE1o \u0111\xE0i",
    "boon.group.flame": "L\u1EEDa",
    "boon.rarity.common": "Th\u01B0\u1EDDng",
    "boon.rarity.rare": "Hi\u1EBFm",
    "boon.rarity.legendary": "Huy\u1EC1n tho\u1EA1i",
    "boon.stacks": "{n}/{m}",
    "end.victory": "L\xF2 L\u1EEDa v\u1EABn ch\xE1y",
    "end.defeat": "L\xF2 L\u1EEDa \u0111\xE3 t\u1EAFt",
    "end.nights": "S\u1ED1 \u0111\xEAm s\u1ED1ng s\xF3t",
    "end.bosses": "Tr\xF9m \u0111\xE3 h\u1EA1",
    "end.camps": "\u1ED4 qu\xE1i \u0111\xE3 d\u1ECDn",
    "end.kills": "Qu\xE1i b\u1ECB h\u1EA1",
    "end.built": "C\xF4ng tr\xECnh \u0111\xE3 x\xE2y",
    "end.ember": "Ember nh\u1EADn \u0111\u01B0\u1EE3c",
    "end.endless": "Ti\u1EBFp t\u1EE5c: V\xF4 t\u1EADn",
    "end.title": "V\u1EC1 m\xE0n h\xECnh ch\xEDnh",
    "tavern.title": "Qu\xE1n tr\u1ECD",
    "tavern.hire": "Thu\xEA v\u1EDBi {n} v\xE0ng",
    "squad.reserve": "D\u1EF1 b\u1ECB",
    "squad.swap": "\u0110\u1ED5i",
    "squad.down": "G\u1EE5c",
    "squad.full": "\u0110\u1ED9i \u0111\xE3 \u0111\u1EE7: chuy\u1EC3n v\u1EC1 d\u1EF1 b\u1ECB",
    "tutorial.0": "K\xE9o \u1EDF b\u1EA5t k\u1EF3 \u0111\xE2u \u0111\u1EC3 d\u1EABn \u0111\u1ED9i.",
    "tutorial.1": "\u0110\u1EE9ng c\u1EA1nh c\xE2y \u0111\u1EC3 ch\u1EB7t g\u1ED7.",
    "tutorial.2": "B\u1EA5m B\xFAa v\xE0 s\u01A1n 6 \xF4 t\u01B0\u1EDDng.",
    "tutorial.3": "\u0110\u1EB7t th\xE1p cung c\u1EA1nh l\xF2 than \u0111\u1EC3 c\xF3 t\xEAn l\u1EEDa.",
    "tutorial.4": "\u0110\u1ECDc \u0110i\u1EC1m b\xE1o r\u1ED3i b\u1EAFt \u0111\u1EA7u \u0111\xEAm.",
    "tutorial.skip": "B\u1ECF qua h\u01B0\u1EDBng d\u1EABn",
    "intro.gloomling": "Gloomling \u0111i t\u1EDBi L\xF2 L\u1EEDa theo con \u0111\u01B0\u1EDDng r\u1EBB nh\u1EA5t.",
    "intro.skitter": "Skitter \u0111i theo b\u1EA7y v\xE0 len qua khe h\u1EDF.",
    "intro.spitter": "Spitter d\u1EEBng \u1EDF t\u1EA7m xa v\xE0 nh\u1ED5 v\xE0o th\xE1p c\u1EE7a b\u1EA1n.",
    "intro.brute": "Brute th\xEDch \u0111\u1EADp t\u01B0\u1EDDng h\u01A1n l\xE0 \u0111i v\xF2ng.",
    "intro.wisp": "Wisp bay th\u1EB3ng qua t\u01B0\u1EDDng v\xE0 b\u1EABy.",
    "intro.bomber": "Bomber lao v\xE0o c\xF4ng tr\xECnh g\u1EA7n nh\u1EA5t r\u1ED3i ph\xE1t n\u1ED5.",
    "intro.snuffer": "Snuffer s\u0103n l\xF2 than. \u0110\u1EE9ng c\u1EA1nh l\xF2 \u0111\u1EC3 th\u1EAFp l\u1EA1i.",
    "intro.mossback": "Mossback \u0111i th\u1EB3ng xuy\xEAn qua t\u01B0\u1EDDng.",
    "intro.unlit": "Vua Kh\xF4ng \u0110\xE8n d\u1EADp t\u1EAFt m\u1ECDi \xE1nh s\xE1ng quanh h\u1EAFn.",
    "intro.elite": "Qu\xE1i tinh nhu\u1EC7: tr\xE2u h\u01A1n, m\u1EA1nh h\u01A1n, ph\xE1t s\xE1ng.",
    "bld.hearth.name": "L\xF2 L\u1EEDa",
    "bld.hearth.desc": "Tr\xE1i tim ph\xE1o \u0111\xE0i. Chi\u1EBFu s\xE1ng 7 \xF4 v\xE0 phun l\u1EEDa y\u1EBFu. T\u1EAFt l\xE0 thua.",
    "bld.wall_wood.name": "T\u01B0\u1EDDng g\u1ED7",
    "bld.wall_wood.desc": "V\u1EADt c\u1EA3n r\u1EBB. S\u01A1n th\xE0nh \u0111\u01B0\u1EDDng. N\xE2ng l\xEAn t\u01B0\u1EDDng \u0111\xE1.",
    "bld.wall_stone.name": "T\u01B0\u1EDDng \u0111\xE1",
    "bld.wall_stone.desc": "V\u1EADt c\u1EA3n ch\u1EAFc ch\u1EAFn. S\u01A1n th\xE0nh \u0111\u01B0\u1EDDng.",
    "bld.gate.name": "C\u1ED5ng",
    "bld.gate.desc": "Hero \u0111i xuy\xEAn qua; qu\xE1i coi nh\u01B0 t\u01B0\u1EDDng.",
    "bld.brazier.name": "L\xF2 than",
    "bld.brazier.desc": "Chi\u1EBFu s\xE1ng 4 \xF4 \u0111\u1EC3 x\xE2y xa h\u01A1n. \u0110\u1ED1t 1 g\u1ED7 m\u1ED7i \u0111\xEAm.",
    "bld.tower_arrow.name": "Th\xE1p cung",
    "bld.tower_arrow.desc": "T\u1EA7m 5, \u0111\u01A1n m\u1EE5c ti\xEAu, b\u1EAFn \u0111\u01B0\u1EE3c qu\xE1i bay.",
    "bld.tower_ballista.name": "N\u1ECF l\u1EDBn",
    "bld.tower_ballista.desc": "T\u1EA7m 8, m\u0169i n\u1ECF xuy\xEAn t\u1ED1i \u0111a 4 qu\xE1i. Kh\xF4ng b\u1EAFn qu\xE1i bay.",
    "bld.tower_frost.name": "Th\xE1p b\u0103ng",
    "bld.tower_frost.desc": "H\xE0o quang l\xE0m ch\u1EADm 40% qu\xE1i trong 3 \xF4.",
    "bld.tower_mortar.name": "C\u1ED1i",
    "bld.tower_mortar.desc": "T\u1EA7m 4-9, \u0111\u1EA1n n\u1ED5. Kh\xF4ng b\u1EAFn qu\xE1i bay.",
    "bld.trap_spikes.name": "Ch\xF4ng",
    "bld.trap_spikes.desc": "\u0110\xE2m m\u1ED7i qu\xE1i b\u01B0\u1EDBc l\xEAn, 6 l\u1EA7n. N\u1EA1p l\u1EA1i l\xFAc b\xECnh minh.",
    "bld.trap_tar.name": "H\u1EAFc \xEDn",
    "bld.trap_tar.desc": "L\xE0m ch\u1EADm 50%. G\u1EB7p l\u1EEDa th\xEC ch\xE1y 4 gi\xE2y.",
    "bld.lumber_camp.name": "Tr\u1EA1i g\u1ED7",
    "bld.lumber_camp.desc": "C\u1EA7n 3 c\xE2y g\u1EA7n \u0111\xF3. Sinh g\u1ED7 ban ng\xE0y.",
    "bld.quarry.name": "M\u1ECF \u0111\xE1",
    "bld.quarry.desc": "C\u1EA7n 2 t\u1EA3ng \u0111\xE1 g\u1EA7n \u0111\xF3. Sinh \u0111\xE1 ban ng\xE0y.",
    "bld.tower_spark.name": "Th\xE1p s\xE9t",
    "bld.tower_spark.desc": "Tia s\xE9t n\u1EA3y gi\u1EEFa 3 qu\xE1i. B\u1EAFn \u0111\u01B0\u1EE3c qu\xE1i bay.",
    "bld.barracks.name": "Tr\u1EA1i l\xEDnh",
    "bld.barracks.desc": "M\u1ED7i \u0111\xEAm 2 d\xE2n binh canh g\xE1c quanh tr\u1EA1i.",
    "bld.workshop.name": "X\u01B0\u1EDFng",
    "bld.workshop.desc": "Ban \u0111\xEAm t\u1EF1 s\u1EEDa c\xF4ng tr\xECnh trong 5 \xF4.",
    "bld.tavern.name": "Qu\xE1n tr\u1ECD",
    "bld.tavern.desc": "M\u1ED7i b\xECnh minh c\xF3 m\u1ED9t hero \u0111\u1EC3 thu\xEA.",
    "hero.knight.name": "Brann",
    "hero.knight.role": "H\u1ED9 v\u1EC7",
    "hero.knight.skill": "Khi\xEAn \u0110\u1EADp",
    "hero.knight.skillDesc": "Cho\xE1ng qu\xE1i h\xECnh n\xF3n trong 1 gi\xE2y.",
    "hero.knight.passive": "Qu\xE1i g\u1EA7n \u01B0u ti\xEAn \u0111\xE1nh Brann.",
    "hero.ranger.name": "Wren",
    "hero.ranger.role": "Cung th\u1EE7",
    "hero.ranger.skill": "M\u01B0a T\xEAn",
    "hero.ranger.skillDesc": "B\u1EAFn 5 m\u0169i t\xEAn h\xECnh qu\u1EA1t.",
    "hero.ranger.passive": "+25% s\xE1t th\u01B0\u01A1ng l\xEAn qu\xE1i trong b\xF3ng t\u1ED1i.",
    "hero.pyro.name": "Ilka",
    "hero.pyro.role": "Ph\xE1p s\u01B0 l\u1EEDa",
    "hero.pyro.skill": "T\u01B0\u1EDDng L\u1EEDa",
    "hero.pyro.skillDesc": "V\u1EC7t l\u1EEDa 4 \xF4 trong 4 gi\xE2y.",
    "hero.pyro.passive": "Th\u1EAFp l\u1EA1i l\xF2 than g\u1EA7n \u0111\xF3; ch\xE2m h\u1EAFc \xEDn.",
    "hero.tinker.name": "Tobi",
    "hero.tinker.role": "Th\u1EE3 m\xE1y",
    "hero.tinker.skill": "Th\xE1p Mini",
    "hero.tinker.skillDesc": "\u0110\u1EB7t \u1EE5 s\xFAng trong 8 gi\xE2y.",
    "hero.tinker.passive": "S\u1EEDa c\xF4ng tr\xECnh g\u1EA7n \u0111\xF3; gi\xE1 x\xE2y -10%.",
    "hero.cleric.name": "Mira",
    "hero.cleric.role": "Tr\u1ECB li\u1EC7u",
    "hero.cleric.skill": "Th\xE1nh \u0110\u1ECBa",
    "hero.cleric.skillDesc": "V\xF9ng th\xE1nh h\u1ED3i m\xE1u \u0111\u1ED3ng \u0111\u1ED9i, l\xE0m y\u1EBFu qu\xE1i.",
    "hero.cleric.passive": "H\u1ED3i m\xE1u cho \u0111\u1ED3ng \u0111\u1ED9i y\u1EBFu nh\u1EA5t g\u1EA7n \u0111\xF3.",
    "hero.rogue.name": "Vex",
    "hero.rogue.role": "S\xE1t th\u1EE7",
    "hero.rogue.skill": "B\u01B0\u1EDBc B\xF3ng",
    "hero.rogue.skillDesc": "D\u1ECBch chuy\u1EC3n t\u1EDBi qu\xE1i tr\xE2u nh\u1EA5t; \u0111\xF2n k\u1EBF \xD73.",
    "hero.rogue.passive": "C\u1EA3 \u0111\u1ED9i ch\u1EA1y nhanh 30% khi kh\xF4ng giao tranh.",
    "enemy.gloomling.name": "Gloomling",
    "enemy.skitter.name": "Skitter",
    "enemy.spitter.name": "Spitter",
    "enemy.brute.name": "Brute",
    "enemy.wisp.name": "Wisp",
    "enemy.bomber.name": "Bomber",
    "enemy.snuffer.name": "Snuffer",
    "enemy.mossback.name": "Mossback",
    "enemy.unlit.name": "Vua Kh\xF4ng \u0110\xE8n",
    "enemy.militia.name": "D\xE2n binh",
    "poi.camp": "\u1ED4 b\xF3ng t\u1ED1i",
    "poi.cage": "L\u1ED3ng hero",
    "poi.shrine": "\u0110i\u1EC7n th\u1EDD",
    "poi.rift": "Khe n\u1EE9t",
    "poi.root": "R\u1EC5 khe n\u1EE9t",
    "poi.chest": "R\u01B0\u01A1ng",
    "shrine.damage": "\u0110i\u1EC7n th\u1EDD: hero +20% s\xE1t th\u01B0\u01A1ng t\u1EDBi b\xECnh minh k\u1EBF",
    "shrine.towerRate": "\u0110i\u1EC7n th\u1EDD: th\xE1p +25% t\u1ED1c b\u1EAFn t\u1EDBi b\xECnh minh k\u1EBF",
    "shrine.heal": "\u0110i\u1EC7n th\u1EDD: L\xF2 L\u1EEDa h\u1ED3i \u0111\u1EA7y m\xE1u",
    "cage.freed": "{name} gia nh\u1EADp \u0111\u1ED9i!",
    "root.destroyed": "\u0110\xE3 nh\u1ED5 r\u1EC5: khe n\xE0y \xEDt qu\xE1i h\u01A1n \u0111\xEAm nay",
    "boon.sharp.name": "L\u01B0\u1EE1i S\u1EAFc",
    "boon.sharp.desc": "Hero +15% s\xE1t th\u01B0\u01A1ng.",
    "boon.thick.name": "Da D\xE0y",
    "boon.thick.desc": "Hero +20% HP.",
    "boon.swift.name": "Nhanh Ch\xE2n",
    "boon.swift.desc": "+15% t\u1ED1c ch\u1EA1y.",
    "boon.leech.name": "H\xFAt M\xE1u",
    "boon.leech.desc": "Hero h\u1ED3i 8% s\xE1t th\u01B0\u01A1ng g\xE2y ra.",
    "boon.horn.name": "T\xF9 V\xE0 Vang",
    "boon.horn.desc": "T\xF9 v\xE0 k\xE9o d\xE0i 10 gi\xE2y thay v\xEC 6.",
    "boon.ally.name": "Chi\u1EBFn H\u1EEFu",
    "boon.ally.desc": "+1 ch\u1ED7 trong \u0111\u1ED9i (t\u1ED1i \u0111a 5).",
    "boon.cooldown.name": "H\u1ED3i Chi\xEAu",
    "boon.cooldown.desc": "Skill h\u1ED3i nhanh h\u01A1n 25%.",
    "boon.twin.name": "Song Sinh",
    "boon.twin.desc": "Skill hero k\xEDch ho\u1EA1t 2 l\u1EA7n.",
    "boon.mason.name": "Th\u1EE3 X\xE2y",
    "boon.mason.desc": "T\u01B0\u1EDDng r\u1EBB h\u01A1n 25%.",
    "boon.boulder.name": "\u0110\xE1 T\u1EA3ng",
    "boon.boulder.desc": "T\u01B0\u1EDDng +30% HP.",
    "boon.hawk.name": "M\u1EAFt Di\u1EC1u H\xE2u",
    "boon.hawk.desc": "Th\xE1p +1 t\u1EA7m.",
    "boon.reload.name": "N\u1EA1p Nhanh",
    "boon.reload.desc": "Th\xE1p +15% t\u1ED1c b\u1EAFn.",
    "boon.spikes.name": "B\u1EABy K\xE9p",
    "boon.spikes.desc": "Ch\xF4ng +4 l\u1EA7n d\xF9ng.",
    "boon.harvest.name": "M\xF9a B\u1ED9i Thu",
    "boon.harvest.desc": "Tr\u1EA1i g\u1ED7 v\xE0 m\u1ECF \u0111\xE1 +50%.",
    "boon.thorns.name": "Gai T\u01B0\u1EDDng",
    "boon.thorns.desc": "Qu\xE1i \u0111\xE1nh t\u01B0\u1EDDng ch\u1ECBu 4 s\xE1t th\u01B0\u01A1ng m\u1ED7i \u0111\xF2n.",
    "boon.living.name": "Ph\xE1o \u0110\xE0i S\u1ED1ng",
    "boon.living.desc": "C\xF4ng tr\xECnh t\u1EF1 h\u1ED3i 1% HP/gi\xE2y ban \u0111\xEAm.",
    "boon.bigfire.name": "L\u1EEDa L\u1EDBn",
    "boon.bigfire.desc": "B\xE1n k\xEDnh s\xE1ng c\u1EE7a L\xF2 L\u1EEDa +1.",
    "boon.embers.name": "Than H\u1ED3ng",
    "boon.embers.desc": "L\xF2 than kh\xF4ng t\u1ED1n nhi\xEAn li\u1EC7u.",
    "boon.ash.name": "Tro N\xF3ng",
    "boon.ash.desc": "Qu\xE1i trong v\xF9ng s\xE1ng ch\u1ECBu 1 s\xE1t th\u01B0\u01A1ng l\u1EEDa m\u1ED7i gi\xE2y.",
    "boon.farlight.name": "\u0110\xE8n Xa",
    "boon.farlight.desc": "\u0110\xE8n tr\u01B0\u1EDFng nh\xF3m s\xE1ng 5 \xF4.",
    "boon.mirror.name": "Ph\u1EA3n Chi\u1EBFu",
    "boon.mirror.desc": "Th\xE1p trong v\xF9ng s\xE1ng c\u1EE7a L\xF2 L\u1EEDa +20% s\xE1t th\u01B0\u01A1ng.",
    "boon.spread.name": "B\xF9ng Ch\xE1y",
    "boon.spread.desc": "Ch\xE1y lan sang qu\xE1i k\u1EC1 b\xEAn.",
    "boon.rebirth.name": "T\xE1i Sinh",
    "boon.rebirth.desc": "L\xF2 L\u1EEDa h\u1ED3i 2 HP/gi\xE2y ban ng\xE0y.",
    "boon.falsedawn.name": "B\xECnh Minh Gi\u1EA3",
    "boon.falsedawn.desc": "1 l\u1EA7n/\u0111\xEAm khi L\xF2 L\u1EEDa < 25%: s\xE1ng to\xE0n \u0111\u1EA3o 8 gi\xE2y, qu\xE1i cho\xE1ng 3 gi\xE2y.",
    "talent.startWood.name": "\u0110\u1ED1ng G\u1ED7",
    "talent.startWood.desc": "+20 g\u1ED7 kh\u1EDFi \u0111\u1EA7u m\u1ED7i c\u1EA5p.",
    "talent.startStone.name": "Kho \u0110\xE1",
    "talent.startStone.desc": "+15 \u0111\xE1 kh\u1EDFi \u0111\u1EA7u m\u1ED7i c\u1EA5p.",
    "talent.hearthHp.name": "L\xF2 V\u1EEFng",
    "talent.hearthHp.desc": "L\xF2 L\u1EEDa +10% HP m\u1ED7i c\u1EA5p.",
    "talent.longDay.name": "Ng\xE0y D\xE0i",
    "talent.longDay.desc": "Ng\xE0y d\xE0i th\xEAm 8 gi\xE2y m\u1ED7i c\u1EA5p.",
    "talent.heroLevel.name": "L\xE3o Luy\u1EC7n",
    "talent.heroLevel.desc": "Hero kh\u1EDFi \u0111\u1EA7u +1 c\u1EA5p m\u1ED7i c\u1EA5p.",
    "talent.refund.name": "T\u1EB1n Ti\u1EC7n",
    "talent.refund.desc": "B\xE1n ho\xE0n th\xEAm 10% m\u1ED7i c\u1EA5p.",
    "talent.chestChoice.name": "M\u0169i S\u0103n B\xE1u",
    "talent.chestChoice.desc": "R\u01B0\u01A1ng th\xEAm 1 l\u1EF1a ch\u1ECDn m\u1ED7i c\u1EA5p.",
    "talent.hornPrecharge.name": "T\xF9 V\xE0 S\u1EB5n S\xE0ng",
    "talent.hornPrecharge.desc": "T\xF9 v\xE0 n\u1EA1p s\u1EB5n 50/75/100%."
  };

  // assets/scripts/core/data/i18n.ts
  var TABLES = { en: STRINGS_EN, vi: STRINGS_VI };
  function t(key, lang = "en", params) {
    let s = TABLES[lang]?.[key] ?? STRINGS_EN[key] ?? key;
    if (params) for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
    return s;
  }

  // assets/scripts/core/data/buildings.ts
  var R = (wood, stone, gold) => ({ wood, stone, gold });
  var BUILDINGS = {
    hearth: {
      id: "hearth",
      w: 2,
      h: 2,
      cost: R(0, 0, 0),
      upgradeCost: [R(30, 40, 60), R(60, 90, 150)],
      maxLevel: 3,
      hp: [500, 800, 1200],
      blocks: true,
      paintable: false,
      stone: true,
      tab: "light",
      should: false,
      blueprintCost: 0,
      wallLike: false,
      range: [4, 4, 4],
      dmg: 5,
      rate: 1,
      dtype: "fire",
      hitsFlying: true,
      light: [7, 9, 11]
    },
    wall_wood: { id: "wall_wood", w: 1, h: 1, cost: R(4, 0, 0), maxLevel: 1, upgradeTo: "wall_stone", hp: [60, 60, 60], blocks: true, paintable: true, stone: false, tab: "defense", should: false, blueprintCost: 0, wallLike: true },
    wall_stone: { id: "wall_stone", w: 1, h: 1, cost: R(0, 6, 0), maxLevel: 2, hp: [160, 260, 260], blocks: true, paintable: true, stone: true, tab: "defense", should: false, blueprintCost: 0, wallLike: true },
    gate: { id: "gate", w: 1, h: 1, cost: R(10, 0, 0), upgradeCost: [R(0, 12, 0), null], maxLevel: 2, hp: [90, 200, 200], blocks: true, paintable: false, stone: false, tab: "defense", should: false, blueprintCost: 0, wallLike: true },
    brazier: { id: "brazier", w: 1, h: 1, cost: R(12, 4, 0), maxLevel: 2, hp: [40, 80, 80], blocks: true, paintable: false, stone: false, tab: "light", should: false, blueprintCost: 0, wallLike: false, light: [4, 5.5, 5.5] },
    tower_arrow: {
      id: "tower_arrow",
      w: 1,
      h: 1,
      cost: R(20, 10, 0),
      maxLevel: 3,
      hp: [120, 170, 230],
      blocks: true,
      paintable: false,
      stone: false,
      tab: "defense",
      should: false,
      blueprintCost: 0,
      wallLike: false,
      range: [5, 5, 6],
      dmg: 8,
      rate: 1,
      dtype: "pierce",
      hitsFlying: true
    },
    tower_ballista: {
      id: "tower_ballista",
      w: 2,
      h: 2,
      cost: R(30, 40, 0),
      maxLevel: 3,
      hp: [200, 280, 380],
      blocks: true,
      paintable: false,
      stone: true,
      tab: "defense",
      should: false,
      blueprintCost: 0,
      wallLike: false,
      range: [8, 8, 8],
      dmg: 30,
      rate: 0.4,
      dtype: "impact",
      hitsFlying: false,
      pierce: [4, 4, 6]
    },
    tower_frost: {
      id: "tower_frost",
      w: 1,
      h: 1,
      cost: R(0, 25, 30),
      maxLevel: 3,
      hp: [100, 140, 190],
      blocks: true,
      paintable: false,
      stone: true,
      tab: "defense",
      should: false,
      blueprintCost: 0,
      wallLike: false,
      range: [3, 3, 4],
      dmg: 2,
      rate: 1,
      dtype: "frost",
      hitsFlying: true,
      slow: [0.4, 0.5, 0.5]
    },
    tower_mortar: {
      id: "tower_mortar",
      w: 2,
      h: 2,
      cost: R(0, 50, 40),
      maxLevel: 3,
      hp: [180, 250, 340],
      blocks: true,
      paintable: false,
      stone: true,
      tab: "defense",
      should: false,
      blueprintCost: 0,
      wallLike: false,
      range: [9, 9, 9],
      minRange: 4,
      dmg: 24,
      rate: 0.33,
      dtype: "impact",
      hitsFlying: false,
      splash: [1.5, 1.5, 2]
    },
    trap_spikes: {
      id: "trap_spikes",
      w: 1,
      h: 1,
      cost: R(8, 4, 0),
      maxLevel: 2,
      hp: [1, 1, 1],
      blocks: false,
      paintable: true,
      stone: false,
      tab: "traps",
      should: false,
      blueprintCost: 0,
      wallLike: false,
      dmg: 10,
      charges: [6, 9, 9]
    },
    trap_tar: {
      id: "trap_tar",
      w: 1,
      h: 1,
      cost: R(6, 0, 0),
      maxLevel: 1,
      hp: [1, 1, 1],
      blocks: false,
      paintable: true,
      stone: false,
      tab: "traps",
      should: false,
      blueprintCost: 0,
      wallLike: false,
      slow: [0.5, 0.5, 0.5],
      dmg: 6
    },
    lumber_camp: { id: "lumber_camp", w: 2, h: 2, cost: R(25, 0, 10), maxLevel: 3, hp: [150, 210, 280], blocks: true, paintable: false, stone: false, tab: "economy", should: false, blueprintCost: 0, wallLike: false, produce: [4, 3, 2] },
    quarry: { id: "quarry", w: 2, h: 2, cost: R(30, 0, 15), maxLevel: 3, hp: [150, 210, 280], blocks: true, paintable: false, stone: false, tab: "economy", should: false, blueprintCost: 0, wallLike: false, produce: [5, 4, 3] },
    tower_spark: {
      id: "tower_spark",
      w: 1,
      h: 1,
      cost: R(0, 30, 60),
      maxLevel: 3,
      hp: [100, 140, 190],
      blocks: true,
      paintable: false,
      stone: true,
      tab: "defense",
      should: true,
      blueprintCost: 80,
      wallLike: false,
      range: [4.5, 4.5, 4.5],
      dmg: 10,
      rate: 0.7,
      dtype: "spark",
      hitsFlying: true,
      chain: [3, 3, 5]
    },
    barracks: { id: "barracks", w: 2, h: 2, cost: R(40, 20, 40), maxLevel: 3, hp: [220, 300, 400], blocks: true, paintable: false, stone: false, tab: "defense", should: true, blueprintCost: 100, wallLike: false, militia: [2, 3, 4] },
    workshop: { id: "workshop", w: 2, h: 2, cost: R(40, 40, 30), maxLevel: 3, hp: [180, 250, 330], blocks: true, paintable: false, stone: false, tab: "economy", should: true, blueprintCost: 100, wallLike: false, repairHps: [4, 6, 9], range: [5, 5, 5] },
    tavern: { id: "tavern", w: 2, h: 2, cost: R(30, 20, 60), maxLevel: 1, hp: [180, 180, 180], blocks: true, paintable: false, stone: false, tab: "economy", should: true, blueprintCost: 120, wallLike: false }
  };
  var BUILDING_IDS = Object.keys(BUILDINGS);
  var MILITIA = { hp: 50, dmg: 6, rate: 1, range: 1.1, speed: 2.2, guard: 5 };
  var TURRET = { dmg: 5, rate: 2, range: 5, ttl: 8, hp: 60 };
  var TAVERN = { goldPerHero: 40 };

  // assets/scripts/core/data/heroes.ts
  var HEROES = {
    knight: { id: "knight", hp: 120, dmg: 10, rate: 1.2, range: 1.1, melee: true, dtype: "impact", hitsFlying: false, skill: "shieldBash", skillCd: 8, unlockEmber: 0 },
    ranger: { id: "ranger", hp: 70, dmg: 7, rate: 1.5, range: 5, melee: false, dtype: "pierce", projectile: "arrow", hitsFlying: true, skill: "arrowRain", skillCd: 10, unlockEmber: 50 },
    pyro: { id: "pyro", hp: 60, dmg: 14, rate: 0.6, range: 4, melee: false, dtype: "fire", projectile: "fireball", splash: 1.2, hitsFlying: true, skill: "fireWall", skillCd: 14, unlockEmber: 120 },
    tinker: { id: "tinker", hp: 80, dmg: 6, rate: 1, range: 1.1, melee: true, dtype: "impact", hitsFlying: false, skill: "miniTurret", skillCd: 16, unlockEmber: 120 },
    cleric: { id: "cleric", hp: 75, dmg: 4, rate: 1, range: 3, melee: false, dtype: "spark", projectile: "spark", hitsFlying: true, skill: "sanctum", skillCd: 18, unlockEmber: 200 },
    rogue: { id: "rogue", hp: 65, dmg: 6, rate: 2.5, range: 1.1, melee: true, dtype: "pierce", hitsFlying: true, crit: { chance: 0.25, mul: 2.5 }, skill: "shadowStep", skillCd: 9, unlockEmber: 200 }
  };
  var HERO_IDS = ["knight", "ranger", "pyro", "tinker", "cleric", "rogue"];
  var SKILLS = {
    shieldBash: { range: 2, stun: 1, dmg: 10, cone: Math.PI / 2.2 },
    arrowRain: { arrows: 5, spread: 0.5, dmgMul: 1.4, range: 6 },
    fireWall: { length: 4, dps: 8, secs: 4, width: 0.8 },
    miniTurret: { secs: 8 },
    sanctum: { radius: 2.5, secs: 5, hps: 10, enemyDmgMul: 0.8 },
    shadowStep: { range: 6, nextHitMul: 3 },
    passive: { tauntRange: 2, rangerDarkMul: 1.25, tinkerRepairHps: 8, tinkerRepairRange: 3, tinkerCostMul: 0.9, clericHealHps: 6, clericRange: 4, rogueSpeedMul: 1.3 }
  };

  // assets/scripts/core/data/enemies.ts
  var TAG_ARMORED = 1;
  var TAG_SWARM = 2;
  var TAG_FLYING = 4;
  var ENEMIES = {
    gloomling: { id: "gloomling", hp: 20, speed: 1.6, dmg: 4, rate: 1, range: 0.9, bldMul: 1, tags: 0, field: "default", cost: 4, firstNight: 1, radius: 0.3, weight: 3 },
    skitter: { id: "skitter", hp: 12, speed: 2.8, dmg: 3, rate: 1.5, range: 0.8, bldMul: 1, tags: TAG_SWARM, field: "default", cost: 3, firstNight: 2, radius: 0.22, weight: 2, pack: 5 },
    spitter: { id: "spitter", hp: 30, speed: 1.3, dmg: 6, rate: 0.8, range: 4, bldMul: 1, tags: 0, field: "default", cost: 9, firstNight: 3, radius: 0.3, weight: 2 },
    brute: { id: "brute", hp: 120, speed: 0.9, dmg: 18, rate: 0.7, range: 1, bldMul: 2, tags: TAG_ARMORED, field: "breacher", cost: 22, firstNight: 4, radius: 0.42, weight: 1.2 },
    wisp: { id: "wisp", hp: 18, speed: 1.8, dmg: 5, rate: 1, range: 0.9, bldMul: 1, tags: TAG_FLYING, field: "straight", cost: 7, firstNight: 6, radius: 0.25, weight: 1.5 },
    bomber: { id: "bomber", hp: 25, speed: 2, dmg: 60, rate: 1, range: 0.9, bldMul: 1, tags: 0, field: "default", cost: 10, firstNight: 7, radius: 0.3, weight: 1.2 },
    snuffer: { id: "snuffer", hp: 60, speed: 1.2, dmg: 8, rate: 1, range: 0.9, bldMul: 1, tags: 0, field: "snuff", cost: 16, firstNight: 8, radius: 0.34, weight: 1 },
    mossback: { id: "mossback", hp: 1e3, speed: 0.5, dmg: 40, rate: 1, range: 1.6, bldMul: 1, tags: TAG_ARMORED, field: "straight", cost: 0, firstNight: 5, radius: 1.1, weight: 0, boss: true },
    unlit: { id: "unlit", hp: 6e3, speed: 0.7, dmg: 25, rate: 1, range: 1.3, bldMul: 1, tags: 0, field: "default", cost: 0, firstNight: 10, radius: 0.45, weight: 0, boss: true },
    militia: { id: "militia", hp: 50, speed: 2.2, dmg: 6, rate: 1, range: 1.1, bldMul: 1, tags: 0, field: "default", cost: 0, firstNight: 99, radius: 0.3, weight: 0 }
  };
  var WAVE_ENEMIES = ["gloomling", "skitter", "spitter", "brute", "wisp", "bomber", "snuffer"];
  var BOMBER = { radius: 1.5, bldDmg: 60, heroDmg: 15, seek: 6 };
  var SNUFFER = { snuffSeconds: 1.5 };
  var MOSSBACK = { crushDps: 40, shellEvery: 8, shellSecs: 3, shellSpawn: 6, heroMulInShell: 2, enrageFrac: 0.3, enrageSpeed: 0.8 };
  var UNLIT = { pulseEvery: 12, pulseRadius: 8, pulseSecs: 6, hearthLightMul: 0.6, summonEvery: 10, summonWisps: 4, teleportAt: [0.66, 0.33], healFrac: 0.05 };

  // assets/scripts/core/sim/Rng.ts
  function mulberry32Next(st2) {
    let t2 = st2.s = st2.s + 1831565813 | 0;
    t2 = Math.imul(t2 ^ t2 >>> 15, t2 | 1);
    t2 ^= t2 + Math.imul(t2 ^ t2 >>> 7, t2 | 61);
    return ((t2 ^ t2 >>> 14) >>> 0) / 4294967296;
  }
  var Rng = class {
    constructor(seed) {
      __publicField(this, "st");
      this.st = typeof seed === "number" ? { s: seed | 0 } : seed;
    }
    next() {
      return mulberry32Next(this.st);
    }
    range(a, b) {
      return a + (b - a) * this.next();
    }
    int(a, bInclusive) {
      return a + Math.floor(this.next() * (bInclusive - a + 1));
    }
    chance(p) {
      return this.next() < p;
    }
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const t2 = arr[i];
        arr[i] = arr[j];
        arr[j] = t2;
      }
      return arr;
    }
    weighted(weights) {
      let tot = 0;
      for (const w of weights) tot += w;
      let r = this.next() * tot;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1;
    }
  };
  function mixSeed(a, b) {
    let h = a ^ 2654435769 | 0;
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = h + Math.imul(b | 0, 3266489909) | 0;
    h = Math.imul(h ^ h >>> 13, 668265263);
    return h ^ h >>> 16 | 0;
  }
  function hash2(x, y, seed) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return (h ^ h >>> 16) >>> 0 & 255;
  }

  // assets/scripts/core/sim/MapGen.ts
  var HEARTH_X = 27;
  var HEARTH_Y = 27;
  var CENTER = 28;
  var NODE_BLOCKS = { pine: true, oak: true, stump: false, rock_s: false, rock_m: false, rock_l: true, ore: true, bush: false };
  var isTreeKind = (k) => k === "pine" || k === "oak";
  var isRockKind = (k) => k === "rock_s" || k === "rock_m" || k === "rock_l";
  function valueNoise(rng, size, cell) {
    const n = Math.ceil(size / cell) + 2;
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rng.next();
    const sm = (t2) => t2 * t2 * (3 - 2 * t2);
    return (x, y) => {
      const fx = x / cell, fy = y / cell;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = sm(fx - ix), ty = sm(fy - iy);
      const a = g[iy * n + ix], b = g[iy * n + ix + 1], c = g[(iy + 1) * n + ix], d = g[(iy + 1) * n + ix + 1];
      return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    };
  }
  function noise2(rng, size) {
    const a = valueNoise(rng, size, 9), b = valueNoise(rng, size, 4);
    return (x, y) => a(x, y) * 0.68 + b(x, y) * 0.32;
  }
  function generateMap(seed) {
    const size = BALANCE.mapSize;
    const rng = new Rng(mixSeed(seed, 20973));
    const nEdge = noise2(rng, size), nMoist = noise2(rng, size), nStone = noise2(rng, size);
    const biome = new Array(size * size);
    const dc = (x, y) => Math.hypot(x + 0.5 - CENTER, y + 0.5 - CENTER);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = dc(x, y);
      const edge = d / (size / 2) + (nEdge(x, y) - 0.5) * 0.3;
      let b;
      if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2 || edge > 0.93) b = "water";
      else if (edge > 0.83) b = "shore";
      else if (d <= 6.5) b = "meadow";
      else {
        const s = nStone(x, y), m = nMoist(x, y);
        b = s > 0.6 ? "quarry" : m > 0.53 ? "forest" : "meadow";
      }
      biome[y * size + x] = b;
    }
    const land = (x, y) => x >= 0 && y >= 0 && x < size && y < size && biome[y * size + x] !== "water";
    const ruinCount = rng.int(2, 3);
    const ruinCenters = [];
    for (let k = 0, tries = 0; k < ruinCount && tries < 400; tries++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(10, 19);
      const x = Math.floor(CENTER + Math.cos(a) * r), y = Math.floor(CENTER + Math.sin(a) * r);
      if (!land(x, y) || biome[y * size + x] === "shore") continue;
      if (ruinCenters.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 10)) continue;
      ruinCenters.push([x, y]);
      k++;
      const rr = rng.range(2, 3.2);
      for (let yy = Math.floor(y - rr); yy <= y + rr; yy++) for (let xx = Math.floor(x - rr); xx <= x + rr; xx++)
        if (land(xx, yy) && Math.hypot(xx - x, yy - y) <= rr && biome[yy * size + xx] !== "shore") biome[yy * size + xx] = "ruins";
    }
    const nodeGrid = new Int8Array(size * size).fill(-1);
    const nodes = [];
    const kindAt = /* @__PURE__ */ new Map();
    const put2 = (x, y, kind) => {
      const i = y * size + x;
      if (kindAt.has(i)) return;
      kindAt.set(i, kind);
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const b = biome[y * size + x];
      if (b === "water" || dc(x, y) <= 6.8) continue;
      const r = rng.next();
      const tree = () => rng.chance(0.6) ? "pine" : "oak";
      if (b === "forest") {
        if (r < 0.36) put2(x, y, tree());
        else if (r < 0.4) put2(x, y, "bush");
        else if (r < 0.42) put2(x, y, "rock_s");
      } else if (b === "meadow") {
        if (r < 0.05) put2(x, y, tree());
        else if (r < 0.1) put2(x, y, "bush");
        else if (r < 0.125) put2(x, y, "rock_s");
        else if (r < 0.135) put2(x, y, "rock_m");
      } else if (b === "quarry") {
        if (r < 0.08) put2(x, y, "rock_s");
        else if (r < 0.15) put2(x, y, "rock_m");
        else if (r < 0.19) put2(x, y, "rock_l");
        else if (r < 0.21) put2(x, y, tree());
      } else if (b === "shore") {
        if (r < 0.02) put2(x, y, "rock_s");
        else if (r < 0.04) put2(x, y, "bush");
      } else if (b === "ruins") {
        if (r < 0.04) put2(x, y, "rock_m");
      }
    }
    const pois = [];
    const clear = (x, y, r) => {
      for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++)
        if (Math.hypot(xx - x, yy - y) <= r) kindAt.delete(yy * size + xx);
    };
    const a0 = rng.range(0, Math.PI * 2);
    for (let k = 0; k < BALANCE.poi.rifts; k++) {
      const a = a0 + k * Math.PI / 2 + rng.range(-0.2, 0.2);
      let best = -1;
      for (let r2 = 20; r2 < size / 2; r2 += 0.5) {
        const x2 = Math.floor(CENTER + Math.cos(a) * r2), y2 = Math.floor(CENTER + Math.sin(a) * r2);
        if (land(x2, y2) && x2 >= 3 && y2 >= 3 && x2 < size - 3 && y2 < size - 3) best = r2;
        else if (best > 0) break;
      }
      if (best < 0) best = 20.5;
      const r = Math.max(20.5, best - 1);
      const x = Math.floor(CENTER + Math.cos(a) * r), y = Math.floor(CENTER + Math.sin(a) * r);
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (biome[yy * size + xx] === "water") biome[yy * size + xx] = "shore";
      clear(x + 0.5, y + 0.5, 2.5);
      pois.push({ kind: "rift", x, y, index: k });
    }
    const farFromPois = (x, y, d) => pois.every((p) => Math.hypot(p.x - x, p.y - y) >= d);
    const placePois = (kind, n, dmin, dmax, sep, preferRuins) => {
      let placed = 0;
      for (let tries = 0; placed < n && tries < 6e3; tries++) {
        let x, y;
        if (preferRuins && placed < ruinCenters.length && tries < 50) {
          [x, y] = ruinCenters[placed];
          x += rng.int(-1, 1);
          y += rng.int(-1, 1);
        } else {
          const a = rng.range(0, Math.PI * 2), r = rng.range(dmin, dmax);
          x = Math.floor(CENTER + Math.cos(a) * r);
          y = Math.floor(CENTER + Math.sin(a) * r);
        }
        const d = dc(x, y);
        if (!land(x, y) || x < 3 || y < 3 || x >= size - 3 || y >= size - 3) continue;
        if (biome[y * size + x] === "shore" && tries < 3e3) continue;
        if (d < dmin - 0.5 || d > dmax + 1) continue;
        if (!farFromPois(x, y, tries < 4e3 ? sep : sep * 0.6)) continue;
        clear(x + 0.5, y + 0.5, 1.8);
        pois.push({ kind, x, y });
        placed++;
      }
    };
    placePois("shrine", BALANCE.poi.shrines, 8, 21, 6, true);
    placePois("cage", BALANCE.poi.cages, 9, 21, 6, false);
    placePois("camp", BALANCE.poi.camps, 10, 23, 6, false);
    const count = () => {
      let t2 = 0, r = 0;
      for (const [i, k] of kindAt) {
        const x = i % size, y = i / size | 0;
        if (dc(x, y) > 16) continue;
        if (isTreeKind(k)) t2++;
        else if (isRockKind(k)) r++;
      }
      return [t2, r];
    };
    let [trees, rocks] = count();
    for (let tries = 0; (trees < 44 || rocks < 22) && tries < 2e4; tries++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(8, 15.5);
      const x = Math.floor(CENTER + Math.cos(a) * r), y = Math.floor(CENTER + Math.sin(a) * r);
      const i = y * size + x;
      if (!land(x, y) || kindAt.has(i) || dc(x, y) <= 6.8 || !farFromPois(x, y, 2.5)) continue;
      if (trees < 44) {
        kindAt.set(i, rng.chance(0.6) ? "pine" : "oak");
        if (biome[i] === "meadow" && rng.chance(0.5)) biome[i] = "forest";
        trees++;
      } else {
        kindAt.set(i, rng.chance(0.5) ? "rock_s" : "rock_m");
        rocks++;
      }
    }
    const blocked = (i) => biome[i] === "water" || kindAt.has(i) && NODE_BLOCKS[kindAt.get(i)];
    const reach = () => {
      const seen = new Uint8Array(size * size);
      const q = [];
      for (let y = HEARTH_Y - 1; y <= HEARTH_Y + 2; y++) for (let x = HEARTH_X - 1; x <= HEARTH_X + 2; x++) {
        const i = y * size + x;
        seen[i] = 1;
        q.push(i);
      }
      for (let h = 0; h < q.length; h++) {
        const i = q[h], x = i % size, y = i / size | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const j = ny * size + nx;
          if (seen[j] || blocked(j)) continue;
          seen[j] = 1;
          q.push(j);
        }
      }
      return seen;
    };
    for (let pass = 0; pass < 3; pass++) {
      const seen = reach();
      let ok = true;
      for (const p of pois) {
        const ring = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
        if (ring.some(([dx, dy]) => seen[(p.y + dy) * size + p.x + dx])) continue;
        ok = false;
        const steps = Math.ceil(Math.hypot(p.x - CENTER, p.y - CENTER) * 2);
        for (let s = 0; s <= steps; s++) {
          const x = Math.floor(p.x + 0.5 + (CENTER - p.x - 0.5) * s / steps), y = Math.floor(p.y + 0.5 + (CENTER - p.y - 0.5) * s / steps);
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
            const i = (y + dy) * size + x + dx;
            if (biome[i] === "water") biome[i] = "shore";
            if (kindAt.has(i) && NODE_BLOCKS[kindAt.get(i)]) kindAt.delete(i);
          }
        }
      }
      if (ok) break;
    }
    const oreN = rng.int(6, 8);
    for (let k = 0, tries = 0; k < oreN && tries < 4e3; tries++) {
      const x = rng.int(3, size - 4), y = rng.int(3, size - 4);
      const i = y * size + x;
      const b = biome[i];
      if (!land(x, y) || dc(x, y) < 9 || b === "shore" || kindAt.has(i) || !farFromPois(x, y, 2.5)) continue;
      if (b !== "quarry" && tries < 2e3) continue;
      kindAt.set(i, "ore");
      const seen = reach();
      if (pois.every((p) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(p.y + dy) * size + p.x + dx]))) k++;
      else kindAt.delete(i);
    }
    const keys = [...kindAt.keys()].sort((a, b) => a - b);
    for (const i of keys) nodes.push({ kind: kindAt.get(i), x: i % size, y: i / size | 0 });
    const variant = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) variant[y * size + x] = hash2(x, y, seed);
    return { size, biome, variant, nodes, pois };
  }

  // assets/scripts/core/sim/World.ts
  var EMODE = { path: 0, chase: 1, attackBld: 2, snuff: 3, ret: 4, idle: 5 };
  function newUid(w) {
    return ++w.r.uid;
  }
  function emit(w, e) {
    if (w.events.length > 4e3) w.events.splice(0, 1e3);
    w.events.push(e);
  }
  var inMap = (w, x, y) => x >= 0 && y >= 0 && x < w.size && y < w.size;
  function canAfford(have, cost) {
    return have.wood >= cost.wood && have.stone >= cost.stone && have.gold >= cost.gold;
  }
  function payRes(w, cost) {
    w.s.res.wood -= cost.wood;
    w.s.res.stone -= cost.stone;
    w.s.res.gold -= cost.gold;
  }
  function boonStacks(w, id) {
    for (const b of w.s.boons) if (b.id === id) return b.stacks;
    return 0;
  }
  function distToRect(px, py, b) {
    const cx = Math.max(b.x, Math.min(px, b.x + b.w));
    const cy = Math.max(b.y, Math.min(py, b.y + b.h));
    return Math.hypot(px - cx, py - cy);
  }
  function liveHeroes(w) {
    return w.s.heroes.filter((h) => !h.dead);
  }
  function leader(w) {
    for (const h of w.s.heroes) if (h.leader && !h.dead) return h;
    return null;
  }
  var isTower = (id) => id === "tower_arrow" || id === "tower_ballista" || id === "tower_frost" || id === "tower_mortar" || id === "tower_spark";
  var isWallLike = (id) => id === "wall_wood" || id === "wall_stone" || id === "gate";
  var isTrap = (id) => id === "trap_spikes" || id === "trap_tar";

  // assets/scripts/core/sim/Light.ts
  var LIGHT_ALPHA = { lit: 0, dim: 0.45, dark: 0.85, fog: 1 };
  function hearthLightRadius(w) {
    const base = BALANCE.light.hearth[w.s.hearthLevel - 1] + boonStacks(w, "bigfire") * BOON_FX.bigfire;
    return base * w.s.buffs.hearthLightMul;
  }
  function brazierRadius(b) {
    return BALANCE.light.brazier[b.level >= 2 ? 1 : 0];
  }
  function brazierBurning(w, b) {
    if (b.id !== "brazier" || b.dead) return false;
    if (b.snuffed || b.offT > 0 || b.constructing > 0) return false;
    if (w.s.phase === "night" && !b.fueled) return false;
    return true;
  }
  function stamp(arr, size, cx, cy, r) {
    const R2 = r + BALANCE.light.dimBand;
    const x0 = Math.max(0, Math.floor(cx - R2)), x1 = Math.min(size - 1, Math.floor(cx + R2));
    const y0 = Math.max(0, Math.floor(cy - R2)), y1 = Math.min(size - 1, Math.floor(cy + R2));
    const r2 = r * r, R22 = R2 * R2;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
      const i = y * size + x;
      if (d2 <= r2) arr[i] = 2;
      else if (d2 <= R22 && arr[i] < 1) arr[i] = 1;
    }
  }
  function computeStaticLight(w) {
    const sl = w.staticLight;
    if (w.s.buffs.falseDawnT > 0) {
      sl.fill(2);
      w.lightDirty = false;
      return;
    }
    sl.fill(0);
    stamp(sl, w.size, CENTER, CENTER, hearthLightRadius(w));
    for (const b of w.s.buildings) {
      const burning = b.id === "brazier" ? brazierBurning(w, b) : false;
      if (b.id === "brazier") {
        if (b.lit !== burning) {
          b.lit = burning;
        }
        if (burning) stamp(sl, w.size, b.x + 0.5, b.y + 0.5, brazierRadius(b));
      }
    }
    w.lightDirty = false;
  }
  function updateLight(w) {
    if (w.lightDirty) computeStaticLight(w);
    const L = w.s.map.light, ex = w.s.map.explored, sl = w.staticLight, n = w.size;
    L.set(sl);
    for (let i = 0; i < n * n; i++) if (sl[i] > 0) ex[i] = 1;
    const ld = leader(w);
    if (ld) {
      const r = boonStacks(w, "farlight") ? BALANCE.light.leaderFar : BALANCE.light.leader;
      stamp(L, n, ld.x, ld.y, r);
      const fr = Math.max(BALANCE.light.fogRadius, r);
      const x0 = Math.max(0, Math.floor(ld.x - fr)), x1 = Math.min(n - 1, Math.floor(ld.x + fr));
      const y0 = Math.max(0, Math.floor(ld.y - fr)), y1 = Math.min(n - 1, Math.floor(ld.y + fr));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - ld.x, dy = y + 0.5 - ld.y;
        if (dx * dx + dy * dy <= fr * fr) ex[y * n + x] = 1;
      }
    }
  }
  function isNightVisual(w) {
    const p = w.s.phase;
    return p === "night" || p === "dusk" || p === "defeat";
  }
  function smoothLightAlpha(w, dt, instant = false) {
    const A = w.s.map.lightAlpha, L = w.s.map.light, ex = w.s.map.explored;
    const night = isNightVisual(w);
    const rate = LIGHT_ALPHA.dark / BALANCE.light.fadeSeconds * dt;
    for (let i = 0; i < A.length; i++) {
      let target;
      if (!ex[i]) target = LIGHT_ALPHA.fog;
      else if (!night) target = 0;
      else target = L[i] === 2 ? LIGHT_ALPHA.lit : L[i] === 1 ? LIGHT_ALPHA.dim : LIGHT_ALPHA.dark;
      const a = A[i];
      if (instant) A[i] = target;
      else if (a < target) A[i] = Math.min(target, a + (target === LIGHT_ALPHA.fog ? 1 : rate));
      else if (a > target) A[i] = Math.max(target, a - (a === LIGHT_ALPHA.fog ? Math.max(rate, 0.12) : rate));
    }
  }
  function lightAt(w, x, y) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= w.size || cy >= w.size) return 0;
    return w.s.map.light[cy * w.size + cx];
  }

  // assets/scripts/core/sim/FlowField.ts
  var DIRS = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, -1, Math.SQRT2]
  ];
  var Heap = class {
    constructor() {
      __publicField(this, "k", new Float64Array(16384));
      __publicField(this, "v", new Int32Array(16384));
      __publicField(this, "n", 0);
    }
    push(key, val) {
      if (this.n >= this.k.length) {
        const k = new Float64Array(this.n * 2);
        k.set(this.k);
        this.k = k;
        const v = new Int32Array(this.n * 2);
        v.set(this.v);
        this.v = v;
      }
      let i = this.n++;
      while (i > 0) {
        const p = i - 1 >> 1;
        if (this.k[p] <= key) break;
        this.k[i] = this.k[p];
        this.v[i] = this.v[p];
        i = p;
      }
      this.k[i] = key;
      this.v[i] = val;
    }
    pop() {
      const top = this.v[0];
      const key = this.k[--this.n], val = this.v[this.n];
      let i = 0;
      for (; ; ) {
        let c = 2 * i + 1;
        if (c >= this.n) break;
        if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++;
        if (this.k[c] >= key) break;
        this.k[i] = this.k[c];
        this.v[i] = this.v[c];
        i = c;
      }
      this.k[i] = key;
      this.v[i] = val;
      return top;
    }
    topKey() {
      return this.k[0];
    }
  };
  var FlowField = class {
    constructor(size) {
      __publicField(this, "size");
      __publicField(this, "dist");
      __publicField(this, "next");
      // next cell index toward the goal (-1 = none / goal)
      __publicField(this, "valid", false);
      __publicField(this, "heap", new Heap());
      __publicField(this, "done");
      this.size = size;
      this.dist = new Float64Array(size * size).fill(Infinity);
      this.next = new Int32Array(size * size).fill(-1);
      this.done = new Uint8Array(size * size);
    }
    /** enterCost: Infinity = impassable. obstacle(i) = cell blocks corner-cutting. */
    compute(sources, enterCost, obstacle) {
      const n = this.size, dist = this.dist, next = this.next, done = this.done, heap = this.heap;
      dist.fill(Infinity);
      next.fill(-1);
      done.fill(0);
      heap.n = 0;
      for (const s of sources) {
        dist[s] = 0;
        heap.push(0, s);
      }
      while (heap.n > 0) {
        const d = heap.topKey();
        const b = heap.pop();
        if (done[b]) continue;
        done[b] = 1;
        if (d > dist[b]) continue;
        const bx = b % n, by = b / n | 0;
        const cb = enterCost[b];
        for (let k = 0; k < 8; k++) {
          const dir = DIRS[k];
          const ax = bx - dir[0], ay = by - dir[1];
          if (ax < 0 || ay < 0 || ax >= n || ay >= n) continue;
          const a = ay * n + ax;
          if (done[a] || enterCost[a] === Infinity) continue;
          if (dir[2] !== 1) {
            if (obstacle[ay * n + bx] || obstacle[by * n + ax]) continue;
          }
          const nd = d + dir[2] * cb;
          if (nd < dist[a]) {
            dist[a] = nd;
            next[a] = b;
            heap.push(nd, a);
          }
        }
      }
      this.valid = true;
    }
  };
  var scratch = { cost: new Float32Array(0), costB: new Float32Array(0), obst: new Uint8Array(0) };
  function hearthSources(w) {
    const out = [];
    for (let y = HEARTH_Y; y < HEARTH_Y + 2; y++) for (let x = HEARTH_X; x < HEARTH_X + 2; x++) out.push(y * w.size + x);
    return out;
  }
  function recomputeFields(w, which = "all") {
    const n = w.size, N2 = n * n;
    if (scratch.cost.length !== N2) {
      scratch.cost = new Float32Array(N2);
      scratch.costB = new Float32Array(N2);
      scratch.obst = new Uint8Array(N2);
    }
    const cost = scratch.cost, costB = scratch.costB, obst = scratch.obst;
    const P = BALANCE.path;
    for (let i = 0; i < N2; i++) {
      if (w.terrain[i] !== 0 || w.poiAt[i] !== 0) {
        cost[i] = Infinity;
        costB[i] = Infinity;
        obst[i] = 1;
        continue;
      }
      obst[i] = 0;
      cost[i] = 1;
      costB[i] = 1;
    }
    for (const b of w.s.buildings) {
      if (b.dead) continue;
      if (isTrap(b.id)) {
        const extra = b.id === "trap_tar" ? P.tarCost : b.charges > 0 ? P.spikeCost : 0;
        const i = b.y * n + b.x;
        cost[i] += extra;
        costB[i] += extra;
        continue;
      }
      if (which === "all") b.pathHp = b.hp;
      const hp = b.pathHp;
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        const i = y * n + x;
        obst[i] = 1;
        cost[i] = 1 + hp / P.breachDiv;
        costB[i] = 1 + hp / P.breachDivBrute;
      }
    }
    const hs = hearthSources(w);
    for (const i of hs) {
      cost[i] = 1;
      costB[i] = 1;
    }
    if (which !== "snuff") {
      w.fields.def.compute(hs, cost, obst);
      w.fields.brk.compute(hs, costB, obst);
    }
    const bs = [];
    for (const b of w.s.buildings) if (b.id === "brazier" && brazierBurning(w, b)) bs.push(b.y * n + b.x);
    if (bs.length) {
      for (const i of bs) cost[i] = 1;
      w.fields.snuff.compute(bs, cost, obst);
    } else w.fields.snuff.valid = false;
    w.r.fieldDirty = false;
    w.r.snuffDirty = false;
    w.r.fieldLastStep = w.r.stepN;
  }
  function maybeRecomputeFields(w, force = false) {
    if (!w.r.fieldDirty && !w.r.snuffDirty && !force) return;
    const minSteps = Math.round(BALANCE.simHz / BALANCE.path.recomputeMaxHz);
    if (!force && w.r.stepN - w.r.fieldLastStep < minSteps) return;
    recomputeFields(w, force || w.r.fieldDirty ? "all" : "snuff");
  }
  function noteBuildingHp(w, b) {
    if (Math.abs(b.hp - b.pathHp) >= BALANCE.path.hpChangeFrac * b.maxHp) w.r.fieldDirty = true;
  }

  // assets/scripts/core/sim/Combat.ts
  function typeMul(dtype, tags) {
    let m = 1;
    if (dtype === "pierce" && tags & TAG_ARMORED) m *= 0.5;
    if (dtype === "impact" && tags & TAG_ARMORED) m *= 1.25;
    if (dtype === "fire" && tags & TAG_SWARM) m *= 1.5;
    if (dtype === "spark" && tags & TAG_FLYING) m *= 1.5;
    return m;
  }
  function canHit(dtype, tags) {
    return !(dtype === "impact" && tags & TAG_FLYING);
  }
  function finalDamage(base, bonus, dtype, tags, synergyMul = 1) {
    return Math.max(1, Math.round(base * (1 + bonus) * typeMul(dtype, tags) * synergyMul));
  }
  function damageEnemy(w, e, base, dtype, o) {
    if (e.dead || e.hp <= 0) return 0;
    if (!canHit(dtype, e.tags)) return 0;
    let syn = o.synergyMul ?? 1;
    if (e.id === "mossback" && e.shell > 0) {
      if (o.src === "tower" || o.src === "hearth") return 0;
      if (o.src === "hero") syn *= MOSSBACK.heroMulInShell;
    }
    let shatter = false;
    if (dtype === "impact" && e.frostT > 0 && !o.noShatter) {
      syn *= BALANCE.synergy.shatterMul;
      shatter = true;
    }
    const amt = finalDamage(base, o.bonus ?? 0, dtype, e.tags, syn);
    e.hp -= amt;
    emit(w, { t: "hit", target: e.uid, amount: amt, dtype, crit: !!o.crit, shatter, x: e.x, y: e.y });
    if (o.hero && !o.hero.dead) {
      const leech = boonStacks(w, "leech");
      if (leech) healHero(w, o.hero, amt * BOON_FX.leech, false);
      o.hero.combatT = 0;
    }
    if (w.s.boss && w.s.boss.uid === e.uid) w.s.boss.hp = Math.max(0, e.hp);
    if (e.hp <= 0) killEnemy(w, e);
    return amt;
  }
  function killEnemy(w, e) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    emit(w, { t: "death", uid: e.uid, kind: "enemy", id: e.id, x: e.x, y: e.y });
    if (e.id === "bomber") emit(w, { t: "explode", x: e.x, y: e.y, radius: 0.6 });
    const G = BALANCE.gold, X = BALANCE.xp;
    const boss = e.id === "mossback" || e.id === "unlit";
    const gold = boss ? G.boss : Math.round((G[e.id] ?? 1) * (e.elite ? G.eliteMul : 1));
    const xp = boss ? X.boss : (X[e.id] ?? 1) * (e.elite ? X.eliteMul : 1);
    w.s.res.gold += gold;
    w.s.stats.goldEarned += gold;
    w.r.nightGold += gold;
    emit(w, { t: "gold", amount: gold, x: e.x, y: e.y });
    w.s.stats.kills++;
    w.r.nightKills++;
    w.s.hornCharge = Math.min(BALANCE.horn.charge, w.s.hornCharge + 1);
    grantXp(w, xp);
    if (boss) {
      w.s.stats.bosses++;
      if (w.s.boss && w.s.boss.uid === e.uid) w.s.boss.hp = 0;
    }
  }
  function grantXp(w, xp) {
    const hs = liveHeroes(w);
    if (!hs.length) return;
    const each = xp / hs.length;
    for (const h of hs) {
      h.xp += each;
      const T2 = BALANCE.squad.xp;
      while (h.level < 5 && h.xp >= T2[h.level - 1]) levelUp(w, h);
    }
  }
  function levelUp(w, h) {
    const before = h.maxHp;
    h.level++;
    h.maxHp = heroMaxHp(w, h);
    h.hp = Math.min(h.maxHp, h.hp + (h.maxHp - before));
    emit(w, { t: "levelUp", hero: h.uid });
  }
  function heroLevelMul(h) {
    return 1 + BALANCE.squad.levelMul * (h.level - 1);
  }
  function heroMaxHp(w, h) {
    return Math.round(HEROES[h.id].hp * heroLevelMul(h) * (1 + BOON_FX.thick * boonStacks(w, "thick")));
  }
  function heroDmgBonus(w) {
    return BOON_FX.sharp * boonStacks(w, "sharp") + (w.s.buffs.shrine === "damage" ? 0.2 : 0);
  }
  function healHero(w, h, amt, evt = true) {
    if (h.dead || h.hp >= h.maxHp) return;
    const a = Math.min(amt, h.maxHp - h.hp);
    h.hp += a;
    if (evt && a >= 1) emit(w, { t: "heal", target: h.uid, amount: Math.round(a), x: h.x, y: h.y });
  }
  function damageHero(w, h, amt) {
    if (h.dead) return;
    const a = Math.max(1, Math.round(amt));
    h.hp -= a;
    h.combatT = 0;
    emit(w, { t: "hit", target: h.uid, amount: a, dtype: "impact", crit: false, shatter: false, x: h.x, y: h.y });
    if (h.hp <= 0) {
      h.hp = 0;
      h.dead = true;
      h.anim = "down";
      h.animT = 0;
      h.reviveT = BALANCE.squad.reviveSeconds;
      emit(w, { t: "death", uid: h.uid, kind: "hero", id: h.id, x: h.x, y: h.y });
      if (h.leader) passLeadership(w);
    }
  }
  function passLeadership(w) {
    const hs = w.s.heroes;
    for (const h of hs) h.leader = false;
    const nl = hs.find((h) => !h.dead);
    if (nl) nl.leader = true;
  }
  function damageAlly(w, a, amt) {
    if (a.dead) return;
    a.hp -= amt;
    emit(w, { t: "hit", target: a.uid, amount: Math.round(amt), dtype: "impact", crit: false, shatter: false, x: a.x, y: a.y });
    if (a.hp <= 0) {
      a.dead = true;
      emit(w, { t: "death", uid: a.uid, kind: "hero", id: a.id, x: a.x, y: a.y });
    }
  }
  function damageBuilding(w, b, amt, attacker) {
    if (b.dead) return 0;
    const a = Math.max(1, Math.round(amt));
    b.hp -= a;
    emit(w, { t: "hit", target: b.uid, amount: a, dtype: "impact", crit: false, shatter: false, x: b.x + b.w / 2, y: b.y + b.h / 2 });
    if (attacker && isWallLike(b.id)) {
      const th = boonStacks(w, "thorns");
      if (th) damageEnemy(w, attacker, BOON_FX.thorns, "pierce", { src: "trap" });
    }
    if (b.id === "hearth") {
      if (!w.r.hearthLowWarned && b.hp < b.maxHp * 0.3) {
        w.r.hearthLowWarned = true;
        emit(w, { t: "hearthLow" });
      }
      if (b.hp <= 0) {
        b.hp = 0;
      }
      return a;
    }
    if (b.hp <= 0) destroyBuilding(w, b);
    else noteBuildingHp(w, b);
    return a;
  }
  function destroyBuilding(w, b) {
    if (b.dead) return;
    b.dead = true;
    b.hp = 0;
    emit(w, { t: "death", uid: b.uid, kind: "building", id: b.id, x: b.x + b.w / 2, y: b.y + b.h / 2 });
    w.r.fieldDirty = true;
    w.lightDirty = true;
    w.r.snuffDirty = true;
    removeBuildingNow(w, b);
  }
  function removeBuildingNow(w, b) {
    const arr = w.s.buildings;
    const i = arr.indexOf(b);
    if (i >= 0) arr.splice(i, 1);
    w.bmap.delete(b.uid);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const k = y * w.size + x;
      if (w.bldAt[k] === b.uid) w.bldAt[k] = 0;
      if (w.trapAt[k] === b.uid) w.trapAt[k] = 0;
    }
    w.r.fieldDirty = true;
    w.lightDirty = true;
    w.r.snuffDirty = true;
    if (BUILDINGS[b.id].wallLike) w.wallMaskDirty = true;
  }
  function applyBurn(e, dps, secs) {
    if (e.dead) return;
    e.status.burn = Math.min(12, e.status.burn + secs);
    e.burnDps = Math.max(e.burnDps, dps);
  }
  function applySlow(e, amt, secs, frost) {
    if (amt >= e.slowAmt || e.slowT <= 0) e.slowAmt = Math.max(amt, e.slowT > 0 ? e.slowAmt : 0);
    e.slowT = Math.max(e.slowT, secs);
    if (frost) e.frostT = Math.max(e.frostT, secs);
  }
  function applyStun(e, secs) {
    if (e.dead) return;
    if (e.id === "mossback" || e.id === "unlit") secs *= 0.3;
    e.status.stun = Math.max(e.status.stun, secs);
  }

  // assets/scripts/core/sim/Economy.ts
  var ZERO = { wood: 0, stone: 0, gold: 0 };
  function scaleRes(r, m) {
    return { wood: Math.ceil(r.wood * m - 1e-9), stone: Math.ceil(r.stone * m - 1e-9), gold: Math.ceil(r.gold * m - 1e-9) };
  }
  function tinkerInSquad(w) {
    return w.s.heroes.some((h) => h.id === "tinker");
  }
  function buildingCost(w, id, level = 1) {
    const d = BUILDINGS[id];
    let c;
    if (level === 1) c = d.cost;
    else {
      const ex = d.upgradeCost?.[level - 2];
      c = ex ?? scaleRes(d.cost, BALANCE.build.upgradeCostMul[level - 1]);
    }
    let m = 1;
    if (id === "wall_wood" || id === "wall_stone") m *= Math.max(0, 1 - BOON_FX.mason * boonStacks(w, "mason"));
    if (tinkerInSquad(w) && id !== "hearth") m *= SKILLS.passive.tinkerCostMul;
    return m === 1 ? { ...c } : scaleRes(c, m);
  }
  function upgradeCostOf(w, b) {
    const d = BUILDINGS[b.id];
    if (d.upgradeTo) return buildingCost(w, d.upgradeTo, 1);
    if (b.level >= d.maxLevel) return null;
    return buildingCost(w, b.id, b.level + 1);
  }
  function buildingMaxHp(w, id, level) {
    const d = BUILDINGS[id];
    let hp = d.hp[level - 1];
    if (id === "wall_wood" || id === "wall_stone") hp *= 1 + BOON_FX.boulder * boonStacks(w, "boulder");
    if (id === "hearth") hp *= 1 + TALENT_BY_ID.hearthHp.perLevel * (w.meta.talents.hearthHp ?? 0);
    return Math.round(hp);
  }
  function countNear(w, rect, pred, r) {
    let n = 0;
    for (const nd of w.s.nodes) {
      if (!pred(nd.kind)) continue;
      if (distToRect(nd.x + 0.5, nd.y + 0.5, rect) <= r) n++;
    }
    return n;
  }
  function canPlace(w, id, x, y, extraCost = ZERO) {
    const d = BUILDINGS[id];
    const cost = buildingCost(w, id, 1);
    if (w.lightDirty) computeStaticLight(w);
    if (id === "hearth") return { ok: false, reason: "blocked", cost };
    if (d.should && !w.meta.unlockedBlueprints.includes(id)) return { ok: false, reason: "locked", cost };
    if (w.s.phase === "victory" || w.s.phase === "defeat") return { ok: false, reason: "blocked", cost };
    if (w.s.buildings.length >= BALANCE.caps.buildings) return { ok: false, reason: "blocked", cost };
    const n = w.size;
    const trap = isTrap(id);
    let dark = false;
    for (let cy = y; cy < y + d.h; cy++) for (let cx = x; cx < x + d.w; cx++) {
      if (cx < 0 || cy < 0 || cx >= n || cy >= n) return { ok: false, reason: "blocked", cost };
      const i = cy * n + cx;
      if (w.terrain[i] !== 0 || w.bldAt[i] || w.trapAt[i]) return { ok: false, reason: "blocked", cost };
      const ni = w.nodeAt[i];
      if (ni) {
        const k = w.s.nodes[ni - 1].kind;
        if (k !== "stump" && k !== "bush") return { ok: false, reason: "blocked", cost };
      }
      for (const p of w.s.pois) if (p.x === cx && p.y === cy && (p.active || p.kind === "rift" || p.kind === "chest")) return { ok: false, reason: "blocked", cost };
      const L = w.staticLight[i];
      if (id === "brazier" ? L < 1 : L < 2) dark = true;
    }
    const rect = { x, y, w: d.w, h: d.h };
    for (const h of w.s.heroes) if (!h.dead && distToRect(h.x, h.y, rect) < 0.3) return { ok: false, reason: "blocked", cost };
    if (!trap) {
      for (const e of w.s.enemies) if (distToRect(e.x, e.y, rect) < 0.25 && !e.flying) return { ok: false, reason: "blocked", cost };
    }
    for (const a of w.s.allies) if (distToRect(a.x, a.y, rect) < 0.25 && !trap) return { ok: false, reason: "blocked", cost };
    if (dark) return { ok: false, reason: "dark", cost };
    if (id === "lumber_camp" && countNear(w, rect, (k) => k === "pine" || k === "oak", 3) < 3) return { ok: false, reason: "blocked", cost };
    if (id === "quarry" && countNear(w, rect, (k) => isRockKind(k), 3) < 2) return { ok: false, reason: "blocked", cost };
    const need = { wood: cost.wood + extraCost.wood, stone: cost.stone + extraCost.stone, gold: cost.gold + extraCost.gold };
    if (!canAfford(w.s.res, need)) return { ok: false, reason: "cost", cost };
    return { ok: true, cost };
  }
  function inBuildSession(w) {
    return w.s.buildMode || w.s.phase === "dusk";
  }
  function spawnBuilding(w, id, x, y, invested, opts = {}) {
    const d = BUILDINGS[id];
    const level = opts.level ?? 1;
    const maxHp = buildingMaxHp(w, id, level);
    const constructing = opts.night ? BALANCE.build.nightBuildDelay : 0;
    const b = {
      uid: newUid(w),
      id,
      x,
      y,
      w: d.w,
      h: d.h,
      level,
      hp: constructing ? Math.round(maxHp * 0.5) : maxHp,
      maxHp,
      lit: id === "brazier",
      open: false,
      constructing,
      charges: d.charges ? d.charges[level - 1] + (id === "trap_spikes" ? BOON_FX.spikes * boonStacks(w, "spikes") : 0) : 0,
      aimAngle: 0,
      wallMask: 0,
      synergies: [],
      cooldown: 0,
      pathHp: 0,
      invested: { ...invested },
      session: inBuildSession(w) ? w.r.session : -1,
      produceT: 0,
      snuffed: false,
      offT: 0,
      fueled: true,
      relightT: 0,
      burnT: 0,
      dead: false,
      dusk: w.s.phase === "dusk",
      synMask: 0
    };
    b.pathHp = b.hp;
    w.s.buildings.push(b);
    w.bmap.set(b.uid, b);
    for (let cy = y; cy < y + d.h; cy++) for (let cx = x; cx < x + d.w; cx++) {
      if (isTrap(id)) w.trapAt[cy * w.size + cx] = b.uid;
      else w.bldAt[cy * w.size + cx] = b.uid;
    }
    w.r.fieldDirty = true;
    w.lightDirty = true;
    w.r.snuffDirty = true;
    if (d.wallLike) w.wallMaskDirty = true;
    return b;
  }
  function place(w, id, x, y, group) {
    const chk = canPlace(w, id, x, y);
    if (!chk.ok) {
      emit(w, { t: "buildFail", reason: chk.reason, x, y });
      return null;
    }
    payRes(w, chk.cost);
    const b = spawnBuilding(w, id, x, y, chk.cost, { night: w.s.phase === "night" });
    w.s.stats.built++;
    emit(w, { t: "built", uid: b.uid, id, x, y });
    if (group) group.push(b.uid);
    else pushUndo(w, [b.uid], chk.cost);
    if (isWallLike(id)) w.r.tut.walls++;
    return b;
  }
  function pushUndo(w, uids, cost) {
    if (!inBuildSession(w) || !uids.length) return;
    w.r.undo.push({ uids, cost, session: w.r.session });
    if (w.r.undo.length > BALANCE.build.undoDepth) w.r.undo.shift();
  }
  function paint(w, id, cells) {
    const d = BUILDINGS[id];
    if (!d.paintable) {
      emit(w, { t: "buildFail", reason: "blocked", x: cells[0]?.x ?? 0, y: cells[0]?.y ?? 0 });
      return 0;
    }
    const group = [];
    const total = { wood: 0, stone: 0, gold: 0 };
    let failedCost = false;
    const seen = /* @__PURE__ */ new Set();
    for (const c of cells) {
      const k = c.y * w.size + c.x;
      if (seen.has(k)) continue;
      seen.add(k);
      const chk = canPlace(w, id, c.x, c.y);
      if (!chk.ok) {
        if (chk.reason === "cost") failedCost = true;
        continue;
      }
      payRes(w, chk.cost);
      total.wood += chk.cost.wood;
      total.stone += chk.cost.stone;
      total.gold += chk.cost.gold;
      const b = spawnBuilding(w, id, c.x, c.y, chk.cost, { night: w.s.phase === "night" });
      w.s.stats.built++;
      if (isWallLike(id)) w.r.tut.walls++;
      emit(w, { t: "built", uid: b.uid, id, x: c.x, y: c.y });
      group.push(b.uid);
    }
    if (failedCost && cells.length) emit(w, { t: "buildFail", reason: "cost", x: cells[cells.length - 1].x, y: cells[cells.length - 1].y });
    pushUndo(w, group, total);
    return group.length;
  }
  function upgrade(w, uid) {
    const b = w.bmap.get(uid);
    if (!b || b.dead) return false;
    const d = BUILDINGS[b.id];
    const cost = upgradeCostOf(w, b);
    if (!cost) {
      emit(w, { t: "buildFail", reason: "blocked", x: b.x, y: b.y });
      return false;
    }
    if (!canAfford(w.s.res, cost)) {
      emit(w, { t: "buildFail", reason: "cost", x: b.x, y: b.y });
      return false;
    }
    payRes(w, cost);
    b.invested = { wood: b.invested.wood + cost.wood, stone: b.invested.stone + cost.stone, gold: b.invested.gold + cost.gold };
    if (d.upgradeTo) {
      const frac = b.hp / b.maxHp;
      b.id = d.upgradeTo;
      b.level = 1;
      b.maxHp = buildingMaxHp(w, b.id, 1);
      b.hp = Math.max(1, Math.round(b.maxHp * Math.max(frac, 1)));
    } else {
      const before = b.maxHp;
      b.level = b.level + 1;
      b.maxHp = buildingMaxHp(w, b.id, b.level);
      b.hp = Math.min(b.maxHp, b.hp + (b.maxHp - before));
      if (b.id === "trap_spikes") b.charges = d.charges[b.level - 1] + BOON_FX.spikes * boonStacks(w, "spikes");
      if (b.id === "hearth") w.s.hearthLevel = b.level;
    }
    w.r.fieldDirty = true;
    w.lightDirty = true;
    w.r.snuffDirty = true;
    emit(w, { t: "upgraded", uid });
    return true;
  }
  function repair(w, uid) {
    const b = w.bmap.get(uid);
    if (!b || b.dead || b.id === "hearth" || isTrap(b.id) || b.hp >= b.maxHp) return false;
    const stone = BUILDINGS[b.id].stone;
    const need = Math.ceil((b.maxHp - b.hp) / BALANCE.build.repairHpPerUnit);
    const have = Math.floor(stone ? w.s.res.stone : w.s.res.wood);
    const units = Math.min(need, have);
    if (units <= 0) {
      emit(w, { t: "buildFail", reason: "cost", x: b.x, y: b.y });
      return false;
    }
    if (stone) w.s.res.stone -= units;
    else w.s.res.wood -= units;
    b.hp = Math.min(b.maxHp, b.hp + units * BALANCE.build.repairHpPerUnit);
    if (Math.abs(b.hp - b.pathHp) >= BALANCE.path.hpChangeFrac * b.maxHp) w.r.fieldDirty = true;
    emit(w, { t: "repaired", uid });
    return true;
  }
  function refundRate(w) {
    if (w.s.phase === "dusk") return 1;
    return Math.min(1, BALANCE.build.sellRefund + TALENT_BY_ID.refund.perLevel * (w.meta.talents.refund ?? 0));
  }
  function sell(w, uid) {
    const b = w.bmap.get(uid);
    if (!b || b.dead || b.id === "hearth") return false;
    const rate = refundRate(w);
    w.s.res.wood += Math.floor(b.invested.wood * rate);
    w.s.res.stone += Math.floor(b.invested.stone * rate);
    w.s.res.gold += Math.floor(b.invested.gold * rate);
    b.dead = true;
    removeBuildingNow(w, b);
    emit(w, { t: "sold", uid });
    return true;
  }
  function undo(w) {
    while (w.r.undo.length) {
      const u = w.r.undo.pop();
      if (u.session !== w.r.session) continue;
      let any = false;
      for (const uid of u.uids) {
        const b = w.bmap.get(uid);
        if (!b || b.dead) continue;
        w.s.res.wood += b.invested.wood;
        w.s.res.stone += b.invested.stone;
        w.s.res.gold += b.invested.gold;
        b.dead = true;
        removeBuildingNow(w, b);
        w.s.stats.built = Math.max(0, w.s.stats.built - 1);
        emit(w, { t: "sold", uid });
        any = true;
      }
      if (any) return true;
    }
    return false;
  }
  function setBuildMode(w, on) {
    if (w.s.phase === "dusk") on = true;
    if (on && !w.s.buildMode) {
      w.r.session++;
      w.r.undo = [];
    }
    if (!on && w.s.buildMode) w.r.undo = [];
    w.s.buildMode = on;
    updateTimeScale(w);
  }
  function updateTimeScale(w) {
    const p = w.s.phase;
    if (p === "dusk" || p === "dawn" || p === "victory" || p === "defeat") w.s.timeScale = 0;
    else w.s.timeScale = w.s.buildMode ? BALANCE.day.buildTimeScale : 1;
  }
  function updateWallMasks(w) {
    const n = w.size;
    const wl = (x, y) => {
      if (x < 0 || y < 0 || x >= n || y >= n) return false;
      const u = w.bldAt[y * n + x];
      if (!u) return false;
      const o = w.bmap.get(u);
      return !!o && isWallLike(o.id);
    };
    for (const b of w.s.buildings) {
      if (!isWallLike(b.id)) continue;
      b.wallMask = (wl(b.x, b.y - 1) ? 1 : 0) | (wl(b.x + 1, b.y) ? 2 : 0) | (wl(b.x, b.y + 1) ? 4 : 0) | (wl(b.x - 1, b.y) ? 8 : 0);
    }
    w.wallMaskDirty = false;
  }
  var SYN = { flame: 1, embedded: 2, rally: 4, tarSpike: 8 };
  var SYN_NAMES = ["flame", "embedded", "rally", "tarSpike"];
  function cheb(a, x, y) {
    const dx = Math.max(a.x - x, 0, x - (a.x + a.w - 1));
    const dy = Math.max(a.y - y, 0, y - (a.y + a.h - 1));
    return Math.max(dx, dy);
  }
  function updateSynergies(w) {
    const n = w.size;
    const ld = leader(w);
    const S2 = BALANCE.synergy;
    let braziers = null;
    for (const b of w.s.buildings) {
      let m = 0;
      if (isTower(b.id)) {
        if (b.id === "tower_arrow" || b.id === "tower_ballista") {
          if (!braziers) braziers = w.s.buildings.filter((o) => o.id === "brazier" && brazierBurning(w, o));
          for (const o of braziers) if (cheb(b, o.x, o.y) <= S2.flameRange) {
            m |= SYN.flame;
            break;
          }
        }
        let sides = 0;
        const touch = (x, y) => {
          if (x < 0 || y < 0 || x >= n || y >= n) return false;
          const u = w.bldAt[y * n + x];
          const o = u ? w.bmap.get(u) : null;
          return !!o && isWallLike(o.id);
        };
        let t2 = false;
        for (let x = b.x; x < b.x + b.w; x++) if (touch(x, b.y - 1)) t2 = true;
        if (t2) sides++;
        t2 = false;
        for (let x = b.x; x < b.x + b.w; x++) if (touch(x, b.y + b.h)) t2 = true;
        if (t2) sides++;
        t2 = false;
        for (let y = b.y; y < b.y + b.h; y++) if (touch(b.x - 1, y)) t2 = true;
        if (t2) sides++;
        t2 = false;
        for (let y = b.y; y < b.y + b.h; y++) if (touch(b.x + b.w, y)) t2 = true;
        if (t2) sides++;
        if (sides >= 2) m |= SYN.embedded;
        if (ld && Math.hypot(ld.x - (b.x + b.w / 2), ld.y - (b.y + b.h / 2)) <= S2.rallyRange) m |= SYN.rally;
      } else if (b.id === "trap_tar" || b.id === "trap_spikes") {
        const other = b.id === "trap_tar" ? "trap_spikes" : "trap_tar";
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = b.x + dx, y = b.y + dy;
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          const u = w.trapAt[y * n + x];
          const o = u ? w.bmap.get(u) : null;
          if (o && o.id === other) {
            m |= SYN.tarSpike;
            break;
          }
        }
      }
      if (m !== b.synMask) {
        b.synMask = m;
        b.synergies = SYN_NAMES.filter((_, i) => m & 1 << i);
      }
    }
  }
  function updateProduction(w, dt) {
    if (w.s.phase !== "day") return;
    const mul = 1 + BOON_FX.harvest * boonStacks(w, "harvest");
    for (const b of w.s.buildings) {
      if (b.id !== "lumber_camp" && b.id !== "quarry") continue;
      const period = BUILDINGS[b.id].produce[b.level - 1] / mul;
      b.produceT += dt;
      if (b.produceT >= period) {
        b.produceT -= period;
        const res = b.id === "lumber_camp" ? "wood" : "stone";
        w.s.res[res] += 1;
        emit(w, { t: "harvest", node: b.uid, res, amount: 1, x: b.x + 1, y: b.y + 1 });
      }
    }
  }

  // assets/scripts/core/sim/Grid.ts
  function rebuildTerrain(w) {
    const n = w.size;
    w.terrain.fill(0);
    w.nodeAt.fill(0);
    w.poiAt.fill(0);
    for (let i = 0; i < n * n; i++) if (w.s.map.biome[i] === "water") w.terrain[i] = 2;
    w.s.nodes.forEach((nd, k) => {
      const i = nd.y * n + nd.x;
      w.nodeAt[i] = k + 1;
      if (NODE_BLOCKS[nd.kind]) w.terrain[i] = 1;
    });
    for (const p of w.s.pois) if (p.kind === "cage" && p.active) w.poiAt[p.y * n + p.x] = p.uid;
  }
  function rebuildBuildings(w) {
    w.bldAt.fill(0);
    w.trapAt.fill(0);
    w.bmap.clear();
    for (const b of w.s.buildings) {
      w.bmap.set(b.uid, b);
      const trap = isTrap(b.id);
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        if (trap) w.trapAt[y * w.size + x] = b.uid;
        else w.bldAt[y * w.size + x] = b.uid;
      }
    }
  }
  function hardBlocked(w, cx, cy) {
    if (!inMap(w, cx, cy)) return true;
    const i = cy * w.size + cx;
    return w.terrain[i] !== 0 || w.poiAt[i] !== 0;
  }
  function cellBlocks(w, cx, cy, hero) {
    if (hardBlocked(w, cx, cy)) return true;
    const u = w.bldAt[cy * w.size + cx];
    if (!u) return false;
    if (hero) {
      const b = w.bmap.get(u);
      if (b && b.id === "gate") return false;
    }
    return true;
  }
  function posFree(w, x, y, r, hero) {
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      if (!cellBlocks(w, cx, cy, hero)) continue;
      const nx = Math.max(cx, Math.min(x, cx + 1)), ny = Math.max(cy, Math.min(y, cy + 1));
      if ((nx - x) * (nx - x) + (ny - y) * (ny - y) < r * r) return false;
    }
    return true;
  }
  function moveUnit(w, u, dx, dy, r, hero) {
    const ox = u.x, oy = u.y;
    if (!posFree(w, u.x, u.y, r, hero)) {
      u.x += dx;
      u.y += dy;
      clampMap(w, u);
      return true;
    }
    if (dx !== 0 && posFree(w, u.x + dx, u.y, r, hero)) u.x += dx;
    if (dy !== 0 && posFree(w, u.x, u.y + dy, r, hero)) u.y += dy;
    clampMap(w, u);
    return u.x !== ox || u.y !== oy;
  }
  function clampMap(w, u) {
    const m = w.size - 0.01;
    if (u.x < 0.01) u.x = 0.01;
    else if (u.x > m) u.x = m;
    if (u.y < 0.01) u.y = 0.01;
    else if (u.y > m) u.y = m;
  }
  function hasLOS(w, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 0.4);
    for (let s = 1; s < steps; s++) {
      const t2 = s / steps;
      const cx = Math.floor(x0 + (x1 - x0) * t2), cy = Math.floor(y0 + (y1 - y0) * t2);
      if (!inMap(w, cx, cy)) return false;
      const i = cy * w.size + cx;
      if (w.terrain[i] === 1 || w.bldAt[i]) return false;
    }
    return true;
  }

  // assets/scripts/core/sim/Query.ts
  function forEnemiesInRange(w, x, y, r, fn) {
    const arr = w.s.enemies;
    const r2 = r * r;
    w.ehash.query(x, y, r + 1.2, (i) => {
      const e = arr[i];
      if (!e || e.dead) return;
      const rr = r + e.radius;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= Math.max(r2, rr * rr)) fn(e);
    });
  }
  function nearestEnemy(w, x, y, r, pred) {
    let best = null, bd = Infinity;
    forEnemiesInRange(w, x, y, r, (e) => {
      if (pred && !pred(e)) return;
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bd || d === bd && best && e.uid < best.uid) {
        bd = d;
        best = e;
      }
    });
    return best;
  }
  function anyEnemyNear(w, x, y, r) {
    let found = false;
    forEnemiesInRange(w, x, y, r, () => {
      found = true;
    });
    return found;
  }

  // assets/scripts/core/sim/Projectiles.ts
  function fire(w, s) {
    const tx = s.tx ?? s.target?.x ?? s.x, ty = s.ty ?? s.target?.y ?? s.y;
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
    if (w.s.projectiles.length >= BALANCE.caps.projectiles) {
      instantHit(w, s);
      return;
    }
    const T2 = s.flightT ?? d / s.speed;
    const p = {
      uid: newUid(w),
      kind: s.kind,
      x: s.x,
      y: s.y,
      px: s.x,
      py: s.y,
      z: 0,
      angle: Math.atan2(dy, dx),
      sx: s.x,
      sy: s.y,
      tx,
      ty,
      vx: dx / d * s.speed,
      vy: dy / d * s.speed,
      speed: s.speed,
      t: 0,
      T: Math.max(0.05, T2),
      target: s.targetUid ?? s.target?.uid ?? 0,
      dmg: s.dmg,
      dtype: s.dtype,
      src: s.src,
      srcKind: s.srcKind,
      pierce: s.pierce ?? 1,
      hit: [],
      splash: s.splash ?? 0,
      chain: s.chain ?? 0,
      flame: !!s.flame,
      crit: !!s.crit,
      hitsFlying: s.hitsFlying ?? true,
      dead: false,
      maxDist: s.maxDist ?? 0
    };
    w.s.projectiles.push(p);
    emit(w, { t: "shoot", from: s.src, projectile: p.uid, kind: s.kind });
  }
  function srcType(p) {
    return p.srcKind === 0 ? "tower" : p.srcKind === 1 ? "hero" : "ally";
  }
  function heroOf(w, p) {
    if (p.srcKind !== 1) return null;
    for (const h of w.s.heroes) if (h.uid === p.src) return h;
    return null;
  }
  function instantHit(w, s) {
    const fake = {
      uid: 0,
      kind: s.kind,
      x: s.tx ?? s.target?.x ?? s.x,
      y: s.ty ?? s.target?.y ?? s.y,
      target: s.targetUid ?? s.target?.uid ?? 0,
      dmg: s.dmg,
      dtype: s.dtype,
      src: s.src,
      srcKind: s.srcKind,
      splash: s.splash ?? 0,
      chain: s.chain ?? 0,
      flame: !!s.flame,
      crit: !!s.crit,
      hitsFlying: s.hitsFlying ?? true,
      hit: []
    };
    if (s.kind === "bolt") {
      const p = fake;
      const ang = Math.atan2((s.ty ?? s.y) - s.y, (s.tx ?? s.x) - s.x);
      const len = s.maxDist ?? 8;
      let left = s.pierce ?? 1;
      for (let k = 0.5; k <= len && left > 0; k += 0.5) {
        const x = s.x + Math.cos(ang) * k, y = s.y + Math.sin(ang) * k;
        forEnemiesInRange(w, x, y, 0.45, (e) => {
          if (left <= 0 || p.hit.includes(e.uid) || e.tags & TAG_FLYING) return;
          p.hit.push(e.uid);
          left--;
          hitEnemy(w, p, e);
        });
      }
      return;
    }
    resolveArrival(w, fake);
  }
  function enemyByUid(w, uid) {
    const e = w.emap.get(uid);
    return e && !e.dead ? e : null;
  }
  function hitEnemy(w, p, e) {
    const h = heroOf(w, p);
    damageEnemy(w, e, p.dmg, p.dtype, { src: srcType(p), hero: h, crit: p.crit });
    if (p.flame && !e.dead) {
      applyBurn(e, BALANCE.synergy.flameDps, BALANCE.synergy.flameSecs);
      igniteTarAt(w, e.x, e.y, 0.5);
    }
  }
  function igniteTarAt(w, x, y, r) {
    const n = w.size;
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(n - 1, Math.floor(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(n - 1, Math.floor(y + r));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const u = w.trapAt[cy * n + cx];
      if (!u) continue;
      const b = w.bmap.get(u);
      if (b && b.id === "trap_tar" && !b.lit) {
        b.lit = true;
        b.burnT = 4;
        emit(w, { t: "brazier", uid: b.uid, lit: true });
      }
    }
  }
  function resolveArrival(w, p) {
    if (p.srcKind === 2) {
      const b = w.bmap.get(p.target);
      if (b && !b.dead) {
        damageBuilding(w, b, p.dmg, null);
        return;
      }
      const h = w.s.heroes.find((o) => o.uid === p.target);
      if (h && !h.dead) {
        if (Math.hypot(h.x - p.x, h.y - p.y) < 1.2) damageHero(w, h, p.dmg);
        return;
      }
      const a = w.s.allies.find((o) => o.uid === p.target);
      if (a && !a.dead && Math.hypot(a.x - p.x, a.y - p.y) < 1.2) damageAlly(w, a, p.dmg);
      return;
    }
    if (p.kind === "mortar" || p.kind === "fireball" && p.splash > 0) {
      emit(w, { t: "explode", x: p.x, y: p.y, radius: p.splash });
      const h = heroOf(w, p);
      const hitList = [];
      forEnemiesInRange(w, p.x, p.y, p.splash, (e2) => {
        if (p.hitsFlying || !(e2.tags & TAG_FLYING)) hitList.push(e2);
      });
      for (const e2 of hitList) damageEnemy(w, e2, p.dmg, p.dtype, { src: srcType(p), hero: h });
      if (p.dtype === "fire") igniteTarAt(w, p.x, p.y, p.splash);
      return;
    }
    const e = enemyByUid(w, p.target);
    if (!e) return;
    hitEnemy(w, p, e);
    if (p.kind === "fireball") igniteTarAt(w, e.x, e.y, 0.5);
    if (p.chain > 1) {
      const hit = [e.uid];
      let cur = e;
      for (let k = 1; k < p.chain; k++) {
        let best = null, bd = Infinity;
        forEnemiesInRange(w, cur.x, cur.y, 2.5, (o) => {
          if (hit.includes(o.uid)) return;
          const d = Math.hypot(o.x - cur.x, o.y - cur.y);
          if (d < bd) {
            bd = d;
            best = o;
          }
        });
        if (!best) break;
        const nb = best;
        hit.push(nb.uid);
        emit(w, { t: "shoot", from: cur.uid, projectile: 0, kind: "spark" });
        damageEnemy(w, nb, p.dmg, p.dtype, { src: srcType(p), hero: heroOf(w, p) });
        cur = nb;
      }
    }
  }
  function updateProjectiles(w, dt) {
    for (const p of w.s.projectiles) {
      if (p.dead) continue;
      p.px = p.x;
      p.py = p.y;
      p.t += dt;
      if (p.kind === "mortar") {
        const k = Math.min(1, p.t / p.T);
        p.x = p.sx + (p.tx - p.sx) * k;
        p.y = p.sy + (p.ty - p.sy) * k;
        p.z = 4 * 2.5 * k * (1 - k);
        if (k >= 1) {
          p.dead = true;
          resolveArrival(w, p);
        }
        continue;
      }
      if (p.kind === "bolt" || p.kind === "arrow" && p.maxDist > 0) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        forEnemiesInRange(w, p.x, p.y, 0.45, (e) => {
          if (p.dead || p.hit.includes(e.uid)) return;
          if (!p.hitsFlying && e.tags & TAG_FLYING) return;
          p.hit.push(e.uid);
          hitEnemy(w, p, e);
          if (p.hit.length >= p.pierce) p.dead = true;
        });
        if (Math.hypot(p.x - p.sx, p.y - p.sy) >= p.maxDist) p.dead = true;
        continue;
      }
      let tx = p.tx, ty = p.ty;
      if (p.srcKind === 2) {
        const b = w.bmap.get(p.target);
        if (b) {
          tx = b.x + b.w / 2;
          ty = b.y + b.h / 2;
        } else {
          const h = w.s.heroes.find((o) => o.uid === p.target) ?? w.s.allies.find((o) => o.uid === p.target);
          if (h) {
            tx = h.x;
            ty = h.y;
          }
        }
      } else {
        const e = enemyByUid(w, p.target);
        if (e) {
          tx = e.x;
          ty = e.y;
        }
      }
      p.tx = tx;
      p.ty = ty;
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step + 0.15) {
        p.x = tx;
        p.y = ty;
        p.dead = true;
        resolveArrival(w, p);
        continue;
      }
      p.x += dx / d * step;
      p.y += dy / d * step;
      p.angle = Math.atan2(dy, dx);
      if (p.t > 4) p.dead = true;
    }
    let j = 0;
    const arr = w.s.projectiles;
    for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
    arr.length = j;
  }

  // assets/scripts/core/sim/Pois.ts
  function attackablePoi(w, x, y, range) {
    let best = null, bd = Infinity;
    for (const p of w.s.pois) {
      if (!p.active || p.hp <= 0) continue;
      if (p.kind !== "cage" && !(p.kind === "root" && w.s.phase === "day")) continue;
      const d = distToRect(x, y, { x: p.x, y: p.y, w: 1, h: 1 });
      if (d <= range && d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }
  function damagePoi(w, p, amt) {
    if (!p.active || p.hp <= 0) return;
    const a = Math.max(1, Math.round(amt));
    p.hp -= a;
    emit(w, { t: "hit", target: p.uid, amount: a, dtype: "impact", crit: false, shatter: false, x: p.x + 0.5, y: p.y + 0.5 });
    if (p.hp > 0) return;
    p.hp = 0;
    p.active = false;
    if (p.kind === "cage") {
      const owned = /* @__PURE__ */ new Set([...w.s.heroes.map((h) => h.id), ...w.s.reserve]);
      let pool = w.meta.unlockedHeroes.filter((h) => !owned.has(h));
      if (!pool.length) pool = HERO_IDS.filter((h) => !owned.has(h));
      if (!pool.length) pool = HERO_IDS.slice();
      const id = pool[w.rng.int(0, pool.length - 1)];
      p.data = { ...p.data ?? {}, hero: id };
      recruitHero(w, id, p.x + 0.5, p.y + 1.2, 1);
      emit(w, { t: "poi", uid: p.uid, kind: "cage", action: "freed" });
      rebuildTerrain(w);
      w.r.fieldDirty = true;
    } else if (p.kind === "root") {
      const r = p.data?.rift ?? 0;
      if (!w.r.rootCut.includes(r)) w.r.rootCut.push(r);
      emit(w, { t: "poi", uid: p.uid, kind: "root", action: "destroyed" });
    }
  }
  function updatePois(w) {
    const heroes = w.s.heroes.filter((h) => !h.dead);
    const touch = BALANCE.poi.touchRange;
    const counts = /* @__PURE__ */ new Map();
    for (const e of w.s.enemies) if (e.guard && !e.dead) counts.set(e.guard, (counts.get(e.guard) ?? 0) + 1);
    const added = [];
    for (const p of w.s.pois) {
      p.guards = counts.get(p.uid) ?? 0;
      if (p.kind === "camp" && p.active && p.guards === 0) {
        p.active = false;
        w.s.stats.camps++;
        emit(w, { t: "poi", uid: p.uid, kind: "camp", action: "cleared" });
        const d = Math.hypot(p.x + 0.5 - CENTER, p.y + 0.5 - CENTER);
        added.push({ uid: newUid(w), kind: "chest", x: p.x, y: p.y, hp: 1, maxHp: 1, active: true, data: { gold: Math.round(BALANCE.poi.chestGold * (1 + (d - 10) / 15)), open: false }, guards: 0 });
      } else if (p.kind === "chest" && p.active) {
        if (w.s.boonOffer) continue;
        if (!heroes.some((h) => Math.hypot(h.x - p.x - 0.5, h.y - p.y - 0.5) <= touch)) continue;
        p.active = false;
        p.data = { ...p.data ?? {}, open: true };
        const g = p.data.gold ?? BALANCE.poi.chestGold;
        w.s.res.gold += g;
        w.s.stats.goldEarned += g;
        emit(w, { t: "gold", amount: g, x: p.x + 0.5, y: p.y + 0.5 });
        emit(w, { t: "poi", uid: p.uid, kind: "chest", action: "opened" });
        offerBoons(w, "chest");
      } else if (p.kind === "shrine" && p.active) {
        if (!heroes.some((h) => Math.hypot(h.x - p.x - 0.5, h.y - p.y - 0.5) <= touch)) continue;
        p.active = false;
        const roll = w.rng.int(0, 2);
        const buff = roll === 0 ? "damage" : roll === 1 ? "towerRate" : "heal";
        p.data = { ...p.data ?? {}, used: true, buff };
        if (buff === "heal") {
          w.hearth.hp = w.hearth.maxHp;
          w.r.hearthLowWarned = false;
        } else {
          w.s.buffs.shrine = buff;
          w.r.shrineUntil = w.s.night;
        }
        emit(w, { t: "poi", uid: p.uid, kind: "shrine", action: "used" });
        emit(w, { t: "shrine", buff });
      }
    }
    for (const a of added) w.s.pois.push(a);
  }

  // assets/scripts/core/sim/Squad.ts
  var HERO_RADIUS = 0.3;
  function createHero(w, id, x, y, level = 1) {
    const h = {
      uid: newUid(w),
      id,
      x,
      y,
      px: x,
      py: y,
      facing: 1,
      hp: 1,
      maxHp: 1,
      anim: "idle",
      animT: 0,
      status: { burn: 0, slow: 0, stun: 0, veiled: false },
      level: 1,
      xp: 0,
      skillCd: 0,
      skillCdMax: 0,
      leader: false,
      reviveT: 0,
      atkCd: 0,
      nextHitMul: 1,
      harvestCd: 0,
      relightT: 0,
      combatT: 99,
      twinT: -1,
      dead: false,
      tgt: 0
    };
    h.level = Math.min(5, Math.max(1, level));
    if (h.level > 1) h.xp = BALANCE.squad.xp[h.level - 2];
    h.maxHp = heroMaxHp(w, h);
    h.hp = h.maxHp;
    h.skillCdMax = skillCdMax(w, id);
    h.skillCd = h.skillCdMax * 0.5;
    return h;
  }
  function skillCdMax(w, id) {
    return HEROES[id].skillCd * (boonStacks(w, "cooldown") ? BOON_FX.cooldown : 1);
  }
  function recruitHero(w, id, x, y, level = 1) {
    if (w.s.heroes.length < w.s.squadMax) {
      const h = createHero(w, id, x, y, level);
      w.s.heroes.push(h);
      if (!leader(w)) passLeadership(w);
    } else w.s.reserve.push(id);
  }
  function reviveHero(w, h) {
    h.dead = false;
    h.hp = h.maxHp;
    h.reviveT = 0;
    h.anim = "idle";
    h.x = CENTER + (h.uid % 3 - 1) * 0.8;
    h.y = CENTER + 2.2;
    h.px = h.x;
    h.py = h.y;
    h.status.stun = 0;
    h.status.burn = 0;
    if (!leader(w)) passLeadership(w);
  }
  function hornActive(w) {
    return w.s.hornT > 0;
  }
  function squadOutOfCombat(w) {
    for (const h of w.s.heroes) if (!h.dead && h.combatT < 2) return false;
    return true;
  }
  function moveSpeed(w) {
    let s = BALANCE.squad.moveSpeed * (1 + BOON_FX.swift * boonStacks(w, "swift"));
    if (w.s.heroes.some((h) => h.id === "rogue" && !h.dead) && squadOutOfCombat(w)) s *= SKILLS.passive.rogueSpeedMul;
    return s;
  }
  function updateHeroes(w, dt) {
    const hs = w.s.heroes;
    for (const h of hs) {
      h.combatT += dt;
      h.animT += dt;
      if (h.dead) {
        if (w.s.phase === "night" || w.s.phase === "day") {
          h.reviveT -= dt;
          if (h.reviveT <= 0) reviveHero(w, h);
        }
        continue;
      }
      if (h.status.stun > 0) {
        h.status.stun -= dt;
        continue;
      }
    }
    const ld = leader(w);
    const spd = moveSpeed(w);
    let heading = w.r.heading;
    if (ld) {
      const inp = w.r.input;
      const mag = Math.min(1, Math.hypot(inp.x, inp.y));
      if (mag > 0.01) {
        const dx = inp.x / Math.hypot(inp.x, inp.y) * mag * spd * dt, dy = inp.y / Math.hypot(inp.x, inp.y) * mag * spd * dt;
        const moved = moveUnit(w, ld, dx, dy, HERO_RADIUS, true);
        if (Math.abs(inp.x) > 0.05) ld.facing = inp.x > 0 ? 1 : -1;
        heading = { x: inp.x / Math.hypot(inp.x, inp.y), y: inp.y / Math.hypot(inp.x, inp.y) };
        w.r.heading = heading;
        if (moved) {
          setAnim(ld, "move");
          w.r.tut.moved += Math.hypot(dx, dy);
        }
      } else {
        engageOrIdle(w, ld, spd, dt, null);
      }
    }
    let slot = 0;
    for (const h of hs) {
      if (h.dead || h === ld || h.status.stun > 0) continue;
      slot++;
      if (!ld) {
        engageOrIdle(w, h, spd, dt, null);
        continue;
      }
      const row = Math.ceil(slot / 2), side = slot % 2 === 1 ? -1 : 1;
      const bx = -heading.x, by = -heading.y, px = -heading.y, py = heading.x;
      const sx = ld.x + bx * 1.1 * row + px * side * 0.95 * row;
      const sy = ld.y + by * 1.1 * row + py * side * 0.95 * row;
      const dl = Math.hypot(h.x - ld.x, h.y - ld.y);
      if (dl > BALANCE.squad.teleportDist) {
        h.x = ld.x;
        h.y = ld.y;
        h.px = h.x;
        h.py = h.y;
        continue;
      }
      if (engageOrIdle(w, h, spd, dt, { sx, sy, ld })) continue;
      steerTo(w, h, sx, sy, spd * BALANCE.squad.followCatchup, dt, hs);
    }
    const rateMul = hornActive(w) ? BALANCE.horn.rateMul : 1;
    for (const h of hs) {
      if (h.dead || h.status.stun > 0) continue;
      attack(w, h, dt * rateMul);
      skills(w, h, dt);
      passives(w, h, dt);
      harvest(w, h, dt);
      if (h.anim === "attack" && h.animT > 0.3) setAnim(h, "idle");
    }
    relightBraziers(w, dt);
  }
  function setAnim(h, a) {
    if (h.anim !== a) {
      h.anim = a;
      h.animT = 0;
    }
  }
  function steerTo(w, h, tx, ty, maxSpd, dt, hs) {
    let dx = tx - h.x, dy = ty - h.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.15) {
      if (h.anim === "move") setAnim(h, "idle");
      return;
    }
    const sp = Math.min(maxSpd, d * 4);
    dx = dx / d * sp;
    dy = dy / d * sp;
    for (const o of hs) {
      if (o === h || o.dead) continue;
      const ox = h.x - o.x, oy = h.y - o.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < 0.7) {
        dx += ox / od * (0.7 - od) * 4;
        dy += oy / od * (0.7 - od) * 4;
      }
    }
    const moved = moveUnit(w, h, dx * dt, dy * dt, HERO_RADIUS, true);
    if (Math.abs(dx) > 0.05) h.facing = dx > 0 ? 1 : -1;
    if (moved) setAnim(h, "move");
  }
  function engageOrIdle(w, h, spd, dt, f) {
    const def = HEROES[h.id];
    const R2 = BALANCE.squad.engageRange;
    const e = nearestEnemy(w, h.x, h.y, R2, (o) => canHit(def.dtype, o.tags) && (def.melee ? !(o.tags & TAG_FLYING) || def.dtype !== "impact" : true));
    if (!e) {
      if (!f && h.anim === "move") setAnim(h, "idle");
      return false;
    }
    if (f && Math.hypot(e.x - f.ld.x, e.y - f.ld.y) > 6) return false;
    const d = Math.hypot(e.x - h.x, e.y - h.y);
    const want = def.melee ? def.range + e.radius - 0.15 : def.range - 0.3;
    if (d > want) {
      const dx = (e.x - h.x) / d * spd * dt, dy = (e.y - h.y) / d * spd * dt;
      moveUnit(w, h, dx, dy, HERO_RADIUS, true);
      h.facing = e.x > h.x ? 1 : -1;
      setAnim(h, "move");
    }
    return true;
  }
  function attack(w, h, dt) {
    h.atkCd -= dt;
    if (h.atkCd > 0) return;
    const def = HEROES[h.id];
    const reach = def.range;
    const e = nearestEnemy(w, h.x, h.y, reach, (o) => canHit(def.dtype, o.tags));
    if (!e) {
      const p = attackablePoi(w, h.x, h.y, def.melee ? def.range + 0.4 : def.range);
      if (p) {
        h.atkCd = 1 / def.rate;
        setAnim(h, "attack");
        h.facing = p.x + 0.5 >= h.x ? 1 : -1;
        damagePoi(w, p, def.dmg * heroLevelMul(h) * (1 + heroDmgBonus(w)));
        return;
      }
      h.atkCd = 0;
      return;
    }
    h.atkCd = 1 / def.rate;
    h.tgt = e.uid;
    h.combatT = 0;
    h.facing = e.x >= h.x ? 1 : -1;
    setAnim(h, "attack");
    let base = def.dmg * heroLevelMul(h) * h.nextHitMul;
    h.nextHitMul = 1;
    let bonus = heroDmgBonus(w);
    if (h.id === "ranger" && w.s.phase === "night" && lightAt(w, e.x, e.y) === 0) bonus += SKILLS.passive.rangerDarkMul - 1;
    let crit = false;
    if (def.crit && w.rng.chance(def.crit.chance)) {
      base *= def.crit.mul;
      crit = true;
    }
    if (def.melee) {
      damageEnemy(w, e, base, def.dtype, { bonus, src: "hero", hero: h, crit });
    } else {
      fire(w, {
        kind: def.projectile,
        x: h.x,
        y: h.y - 0.3,
        target: e,
        dmg: base * (1 + bonus),
        dtype: def.dtype,
        src: h.uid,
        srcKind: 1,
        speed: def.projectile === "spark" ? 20 : def.projectile === "fireball" ? 9 : 13,
        splash: def.splash,
        crit
      });
    }
  }
  function skills(w, h, dt) {
    h.skillCdMax = skillCdMax(w, h.id);
    if (h.twinT >= 0) {
      h.twinT -= dt;
      if (h.twinT < 0) castSkill(w, h);
    }
    h.skillCd -= dt;
    if (h.skillCd > 0) return;
    if (castSkill(w, h)) {
      h.skillCd = h.skillCdMax;
      if (boonStacks(w, "twin")) h.twinT = 0.5;
    } else h.skillCd = 0;
  }
  function castSkill(w, h) {
    const S2 = SKILLS;
    const dmgMul = heroLevelMul(h) * (1 + heroDmgBonus(w));
    switch (HEROES[h.id].skill) {
      case "shieldBash": {
        const e = nearestEnemy(w, h.x, h.y, S2.shieldBash.range);
        if (!e) return false;
        const ang = Math.atan2(e.y - h.y, e.x - h.x);
        forEnemiesInRange(w, h.x, h.y, S2.shieldBash.range, (o) => {
          let da = Math.abs(Math.atan2(o.y - h.y, o.x - h.x) - ang);
          if (da > Math.PI) da = 2 * Math.PI - da;
          if (da <= S2.shieldBash.cone || Math.hypot(o.x - h.x, o.y - h.y) < 0.6) {
            applyStun(o, S2.shieldBash.stun);
            damageEnemy(w, o, S2.shieldBash.dmg * dmgMul, "impact", { src: "hero", hero: h });
          }
        });
        emit(w, { t: "skill", hero: h.uid, skill: "shieldBash", x: e.x, y: e.y });
        return true;
      }
      case "arrowRain": {
        const e = nearestEnemy(w, h.x, h.y, S2.arrowRain.range);
        if (!e) return false;
        const ang = Math.atan2(e.y - h.y, e.x - h.x);
        for (let k = 0; k < S2.arrowRain.arrows; k++) {
          const a = ang + (k - (S2.arrowRain.arrows - 1) / 2) * (S2.arrowRain.spread / 2);
          fire(w, {
            kind: "arrow",
            x: h.x,
            y: h.y - 0.3,
            tx: h.x + Math.cos(a) * 7,
            ty: h.y + Math.sin(a) * 7,
            dmg: HEROES.ranger.dmg * S2.arrowRain.dmgMul * dmgMul,
            dtype: "pierce",
            src: h.uid,
            srcKind: 1,
            speed: 13,
            pierce: 2,
            maxDist: 7
          });
        }
        emit(w, { t: "skill", hero: h.uid, skill: "arrowRain", x: e.x, y: e.y });
        return true;
      }
      case "fireWall": {
        const e = nearestEnemy(w, h.x, h.y, 5);
        if (!e) return false;
        const ang = Math.atan2(e.y - h.y, e.x - h.x) + Math.PI / 2;
        const L = S2.fireWall.length / 2;
        const x1 = e.x - Math.cos(ang) * L, y1 = e.y - Math.sin(ang) * L, x2 = e.x + Math.cos(ang) * L, y2 = e.y + Math.sin(ang) * L;
        w.s.zones.push({ uid: newUid(w), kind: "firewall", x: x1, y: y1, x2, y2, r: S2.fireWall.width, t: S2.fireWall.secs, dur: S2.fireWall.secs });
        for (let k = 0; k <= 4; k++) igniteTarAt(w, x1 + (x2 - x1) * k / 4, y1 + (y2 - y1) * k / 4, 0.5);
        emit(w, { t: "skill", hero: h.uid, skill: "fireWall", x: e.x, y: e.y });
        return true;
      }
      case "miniTurret": {
        if (!nearestEnemy(w, h.x, h.y, 6)) return false;
        const a = {
          uid: newUid(w),
          id: "turret",
          x: h.x + 0.6,
          y: h.y,
          px: h.x + 0.6,
          py: h.y,
          facing: 1,
          hp: TURRET.hp,
          maxHp: TURRET.hp,
          anim: "idle",
          animT: 0,
          status: { burn: 0, slow: 0, stun: 0, veiled: false },
          owner: h.uid,
          ttl: S2.miniTurret.secs,
          atkCd: 0,
          hx: h.x,
          hy: h.y,
          dmg: TURRET.dmg * heroLevelMul(h),
          rate: TURRET.rate,
          range: TURRET.range,
          dead: false
        };
        w.s.allies.push(a);
        emit(w, { t: "skill", hero: h.uid, skill: "miniTurret", x: a.x, y: a.y });
        return true;
      }
      case "sanctum": {
        const hurt = w.s.heroes.some((o) => !o.dead && o.hp < o.maxHp * 0.7 && Math.hypot(o.x - h.x, o.y - h.y) < 4);
        if (!hurt && !anyEnemyNear(w, h.x, h.y, 3)) return false;
        w.s.zones.push({ uid: newUid(w), kind: "sanctum", x: h.x, y: h.y, x2: h.x, y2: h.y, r: S2.sanctum.radius, t: S2.sanctum.secs, dur: S2.sanctum.secs });
        emit(w, { t: "skill", hero: h.uid, skill: "sanctum", x: h.x, y: h.y });
        return true;
      }
      case "shadowStep": {
        let best = null;
        forEnemiesInRange(w, h.x, h.y, S2.shadowStep.range, (o) => {
          if (!best || o.hp > best.hp || o.hp === best.hp && o.uid < best.uid) best = o;
        });
        if (!best) return false;
        const b = best;
        const ang = Math.atan2(h.y - b.y, h.x - b.x);
        const ox = h.x, oy = h.y;
        h.x = b.x + Math.cos(ang) * (b.radius + 0.4);
        h.y = b.y + Math.sin(ang) * (b.radius + 0.4);
        if (!moveUnit(w, h, 0, 0, HERO_RADIUS, true)) {
        }
        if (w.terrain[Math.floor(h.y) * w.size + Math.floor(h.x)] !== 0 || w.bldAt[Math.floor(h.y) * w.size + Math.floor(h.x)]) {
          h.x = ox;
          h.y = oy;
        }
        h.px = h.x;
        h.py = h.y;
        h.nextHitMul = S2.shadowStep.nextHitMul;
        h.atkCd = 0;
        emit(w, { t: "skill", hero: h.uid, skill: "shadowStep", x: h.x, y: h.y });
        emit(w, { t: "teleport", uid: h.uid, x: h.x, y: h.y });
        return true;
      }
    }
    return false;
  }
  function passives(w, h, dt) {
    const P = SKILLS.passive;
    if (h.id === "pyro") {
      for (const b of w.s.buildings) {
        if (b.id !== "brazier" || !b.snuffed && b.offT <= 0) continue;
        if (distToRect(h.x, h.y, b) <= BALANCE.light.pyroRelightRange) relight(w, b);
      }
    } else if (h.id === "tinker") {
      let best = null;
      for (const b of w.s.buildings) {
        if (b.id === "hearth" || b.hp >= b.maxHp || b.dead) continue;
        if (distToRect(h.x, h.y, b) > P.tinkerRepairRange) continue;
        if (!best || b.hp / b.maxHp < best.hp / best.maxHp) best = b;
      }
      if (best) {
        best.hp = Math.min(best.maxHp, best.hp + P.tinkerRepairHps * dt);
        if (Math.abs(best.hp - best.pathHp) >= 0.2 * best.maxHp) w.r.fieldDirty = true;
      }
    } else if (h.id === "cleric") {
      let best = null;
      for (const o of w.s.heroes) {
        if (o.dead || o.hp >= o.maxHp || Math.hypot(o.x - h.x, o.y - h.y) > P.clericRange) continue;
        if (!best || o.hp / o.maxHp < best.hp / best.maxHp) best = o;
      }
      if (best) healHero(w, best, P.clericHealHps * dt, false);
    }
  }
  function relight(w, b) {
    if (!b.snuffed && b.offT <= 0) return;
    b.snuffed = false;
    b.offT = 0;
    b.relightT = 0;
    w.lightDirty = true;
    w.r.snuffDirty = true;
    emit(w, { t: "brazier", uid: b.uid, lit: true });
  }
  function relightBraziers(w, dt) {
    for (const b of w.s.buildings) {
      if (b.id !== "brazier" || !b.snuffed) continue;
      let near = false;
      for (const h of w.s.heroes) if (!h.dead && distToRect(h.x, h.y, b) <= BALANCE.light.relightRange) {
        near = true;
        break;
      }
      if (near) {
        b.relightT += dt;
        if (b.relightT >= BALANCE.light.relightSeconds) relight(w, b);
      } else b.relightT = 0;
    }
  }
  function harvest(w, h, dt) {
    h.harvestCd -= dt;
    if (h.harvestCd > 0) return;
    if (anyEnemyNear(w, h.x, h.y, Math.max(HEROES[h.id].range, 2.5))) return;
    const H = BALANCE.harvest;
    let best = -1, bd = Infinity;
    const cx = Math.floor(h.x), cy = Math.floor(h.y);
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
      if (x < 0 || y < 0 || x >= w.size || y >= w.size) continue;
      const ni = w.nodeAt[y * w.size + x];
      if (!ni) continue;
      const nd2 = w.s.nodes[ni - 1];
      if (nd2.kind === "stump" || nd2.kind === "bush" || nd2.hp <= 0) continue;
      const d = distToRect(h.x, h.y, { x, y, w: 1, h: 1 });
      if (d <= BALANCE.squad.harvestRange && d < bd) {
        bd = d;
        best = ni - 1;
      }
    }
    if (best < 0) return;
    const nd = w.s.nodes[best];
    h.harvestCd = BALANCE.squad.harvestInterval;
    nd.hp -= 1;
    nd.shakeT = 0.3;
    let res, amount;
    if (isTreeKind(nd.kind)) {
      res = "wood";
      amount = H.treeWood;
    } else if (nd.kind === "ore") {
      res = "gold";
      amount = H.oreGold;
    } else {
      res = "stone";
      amount = H.rockStone;
    }
    w.s.res[res] += amount;
    if (res === "gold") w.s.stats.goldEarned += amount;
    h.facing = nd.x + 0.5 >= h.x ? 1 : -1;
    setAnim(h, "attack");
    emit(w, { t: "harvest", node: nd.uid, res, amount, x: nd.x + 0.5, y: nd.y + 0.5 });
    if (res === "wood") w.r.tutHarvested = true;
    if (nd.hp <= 0) {
      if (isTreeKind(nd.kind)) {
        nd.kind = "stump";
        nd.regrowT = BALANCE.harvest.regrowDays;
        nd.hp = 0;
      } else w.s.nodes.splice(best, 1);
      rebuildTerrain(w);
      w.r.fieldDirty = true;
    }
  }

  // assets/scripts/core/sim/Boons.ts
  function makeBoon(w, d) {
    return { id: d.id, name: t(`boon.${d.id}.name`), desc: t(`boon.${d.id}.desc`), group: d.group, rarity: d.rarity, stacks: boonStacks(w, d.id), maxStacks: d.maxStacks };
  }
  function available(w, d) {
    if (boonStacks(w, d.id) >= d.maxStacks) return false;
    if (d.id === "ally" && w.s.squadMax >= BALANCE.squad.maxWithBoon) return false;
    return true;
  }
  function rollBoons(w, count, commonOnly) {
    const rw = w.s.night >= BALANCE.rarity.lateFromNight ? BALANCE.rarity.late : BALANCE.rarity.early;
    const out = [];
    for (let k = 0; k < count; k++) {
      const pool = BOONS.filter((d) => available(w, d) && !out.includes(d) && (!commonOnly || d.rarity === "common"));
      if (!pool.length) break;
      let rar = "common";
      if (!commonOnly) {
        const r = w.rng.weighted(rw);
        rar = r === 0 ? "common" : r === 1 ? "rare" : "legendary";
      }
      let sub = pool.filter((d) => d.rarity === rar);
      if (!sub.length) sub = pool;
      out.push(sub[w.rng.int(0, sub.length - 1)]);
    }
    return out.map((d) => makeBoon(w, d));
  }
  function offerBoons(w, source) {
    const n = source === "dawn" ? 3 : 2 + TALENT_BY_ID.chestChoice.perLevel * (w.meta.talents.chestChoice ?? 0);
    w.s.boonOffer = rollBoons(w, n, source === "chest");
    w.s.boonSource = source;
    if (!w.s.boonOffer.length) {
      w.s.boonOffer = null;
      w.s.boonSource = null;
      return;
    }
    emit(w, { t: "boonOffer", source });
  }
  function applyBoon(w, id) {
    const d = BOON_BY_ID[id];
    let b = w.s.boons.find((x) => x.id === id);
    if (!b) {
      b = makeBoon(w, d);
      b.stacks = 0;
      w.s.boons.push(b);
    }
    if (b.stacks >= d.maxStacks) return;
    b.stacks++;
    switch (id) {
      case "thick":
        for (const h of w.s.heroes) {
          const before = h.maxHp;
          h.maxHp = heroMaxHp(w, h);
          if (!h.dead) h.hp += h.maxHp - before;
        }
        break;
      case "ally":
        w.s.squadMax = Math.min(BALANCE.squad.maxWithBoon, w.s.squadMax + 1);
        break;
      case "cooldown":
        for (const h of w.s.heroes) {
          h.skillCdMax = skillCdMax(w, h.id);
          h.skillCd = Math.min(h.skillCd, h.skillCdMax);
        }
        break;
      case "boulder":
        for (const x of w.s.buildings) if (x.id === "wall_wood" || x.id === "wall_stone") {
          const before = x.maxHp;
          x.maxHp = buildingMaxHp(w, x.id, x.level);
          x.hp += x.maxHp - before;
        }
        w.r.fieldDirty = true;
        break;
      case "spikes":
        for (const x of w.s.buildings) if (x.id === "trap_spikes") x.charges += 4;
        w.r.fieldDirty = true;
        break;
      case "bigfire":
      case "farlight":
        w.lightDirty = true;
        break;
      case "embers":
        for (const x of w.s.buildings) if (x.id === "brazier") x.fueled = true;
        w.lightDirty = true;
        break;
    }
  }
  function pickBoon(w, index) {
    const offer = w.s.boonOffer;
    if (!offer || index < 0 || index >= offer.length) return false;
    applyBoon(w, offer[index].id);
    w.s.boonOffer = null;
    return true;
  }

  // assets/scripts/core/sim/Enemies.ts
  function spawnEnemy(w, id, x, y, o = {}) {
    if (w.s.enemies.length >= BALANCE.caps.enemies && !ENEMIES[id].boss) return null;
    const d = ENEMIES[id];
    const E2 = BALANCE.elite;
    const elite = !!o.elite;
    const hp = Math.round(d.hp * (elite ? E2.hpMul : 1) * (o.hpMul ?? 1));
    const e = {
      uid: newUid(w),
      id,
      x,
      y,
      px: x,
      py: y,
      facing: 1,
      hp,
      maxHp: hp,
      anim: "move",
      animT: 0,
      status: { burn: 0, slow: 0, stun: 0, veiled: false },
      elite,
      flying: !!(d.tags & TAG_FLYING),
      targetUid: 0,
      spd: d.speed,
      dmg: d.dmg * (elite ? E2.dmgMul : 1),
      rate: d.rate,
      range: d.range,
      radius: Math.min(0.36, d.radius * (elite ? E2.scale : 1)),
      tags: d.tags,
      atkCd: 0.3,
      wave: o.wave ?? !o.guard,
      guard: o.guard ?? 0,
      hx: x,
      hy: y,
      mode: o.guard ? EMODE.idle : EMODE.path,
      burnDps: 0,
      slowAmt: 0,
      slowT: 0,
      frostT: 0,
      snuffT: 0,
      lastCell: -1,
      gold: 0,
      xp: 0,
      t1: 0,
      t2: 0,
      t3: 0,
      flags: 0,
      shell: 0,
      dead: false,
      scale: elite ? E2.scale : 1,
      vx: 0,
      vy: 0,
      dotFire: 0,
      dotFrost: 0,
      stuckT: 0
    };
    if (id === "mossback") {
      e.t1 = MOSSBACK.shellEvery;
    }
    if (id === "unlit") {
      e.t1 = UNLIT.pulseEvery * 0.5;
      e.t2 = UNLIT.summonEvery;
    }
    w.s.enemies.push(e);
    w.emap.set(e.uid, e);
    if (d.boss) {
      w.s.boss = { id, hp: e.hp, maxHp: e.maxHp, uid: e.uid };
      emit(w, { t: "bossIntro", id });
    }
    return e;
  }
  function fieldFor(w, e) {
    const f = ENEMIES[e.id].field;
    if (f === "breacher") return w.fields.brk;
    if (f === "snuff" && w.fields.snuff.valid) return w.fields.snuff;
    return w.fields.def;
  }
  function remainingDist(w, e) {
    if (e.flying || e.id === "mossback") return Math.hypot(e.x - CENTER, e.y - CENTER);
    const c = Math.floor(e.y) * w.size + Math.floor(e.x);
    const d = w.fields.def.dist[c];
    return d === Infinity ? 999 + Math.hypot(e.x - CENTER, e.y - CENTER) : d;
  }
  var hearthRect = { x: HEARTH_X, y: HEARTH_Y, w: 2, h: 2 };
  function inSanctum(w, x, y) {
    for (const z of w.s.zones) if (z.kind === "sanctum" && Math.hypot(z.x - x, z.y - y) <= z.r) return true;
    return false;
  }
  function enemyDmg(w, e) {
    let d = e.dmg;
    if (inSanctum(w, e.x, e.y)) d *= 0.8;
    return d;
  }
  function findFoe(w, e, range, los) {
    let best = null, bd = Infinity;
    for (const h of w.s.heroes) {
      if (h.dead) continue;
      let d = Math.hypot(h.x - e.x, h.y - e.y);
      if (d > range) continue;
      if (h.id === "knight" && d <= 2) d -= 100;
      if (d < bd && (!los || hasLOS(w, e.x, e.y, h.x, h.y))) {
        bd = d;
        best = { kind: "hero", u: h };
      }
    }
    for (const a of w.s.allies) {
      if (a.dead) continue;
      const d = Math.hypot(a.x - e.x, a.y - e.y);
      if (d <= range && d < bd && (!los || hasLOS(w, e.x, e.y, a.x, a.y))) {
        bd = d;
        best = { kind: "ally", u: a };
      }
    }
    return best;
  }
  function foeByUid(w, uid) {
    for (const h of w.s.heroes) if (h.uid === uid) return h.dead ? null : { kind: "hero", u: h };
    for (const a of w.s.allies) if (a.uid === uid) return a.dead ? null : { kind: "ally", u: a };
    return null;
  }
  function hitFoe(w, f, amt) {
    if (f.kind === "hero") damageHero(w, f.u, amt);
    else damageAlly(w, f.u, amt);
  }
  function separation(w, e, out) {
    const arr = w.s.enemies;
    w.ehash.query(e.x, e.y, 1, (i) => {
      const o = arr[i];
      if (!o || o === e || o.dead || o.flying !== e.flying) return;
      const dx = e.x - o.x, dy = e.y - o.y;
      const rr = e.radius + o.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) return;
      const d = Math.sqrt(d2);
      if (d < 1e-4) {
        const a = (e.uid * 2654435761 >>> 0) / 4294967296 * Math.PI * 2;
        out.x += Math.cos(a) * 0.5;
        out.y += Math.sin(a) * 0.5;
        return;
      }
      const push = (rr - d) / rr;
      out.x += dx / d * push * 2.2;
      out.y += dy / d * push * 2.2;
    });
  }
  function speedOf(w, e) {
    let s = e.spd;
    if (e.id === "mossback" && e.hp < e.maxHp * MOSSBACK.enrageFrac) s = MOSSBACK.enrageSpeed;
    s *= 1 - e.slowAmt;
    if (e.status.veiled) s *= BALANCE.light.veiledSpeedMul;
    if (w.r.enraged && e.wave) s *= BALANCE.night.enrageSpeedMul;
    return s;
  }
  function attackReady(e, dt) {
    e.atkCd -= dt;
    if (e.atkCd > 0) return false;
    e.atkCd = 1 / e.rate;
    if (e.anim !== "attack") {
      e.anim = "attack";
      e.animT = 0;
    }
    return true;
  }
  function bldDamage(w, e) {
    let d = enemyDmg(w, e) * ENEMIES[e.id].bldMul;
    if (w.r.enraged && e.wave) d *= BALANCE.night.enrageDmgMul;
    return d;
  }
  function hitBuilding(w, e, b) {
    e.targetUid = b.uid;
    if (e.id === "spitter") {
      fire(w, { kind: "spit", x: e.x, y: e.y - 0.2, targetUid: b.uid, tx: b.x + b.w / 2, ty: b.y + b.h / 2, dmg: bldDamage(w, e), dtype: "impact", src: e.uid, srcKind: 2, speed: 7 });
    } else damageBuilding(w, b, bldDamage(w, e), e);
  }
  function updateEnemies(w, dt) {
    const night = w.s.phase === "night";
    const tick = w.r.stepN % 15 === 0;
    const arr = w.s.enemies;
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e.dead) continue;
      e.animT += dt;
      statuses(w, e, dt, night, tick);
      if (e.dead) continue;
      if (e.status.stun > 0) {
        e.status.stun -= dt;
        e.vx = 0;
        e.vy = 0;
        continue;
      }
      if (e.id === "mossback") {
        mossback(w, e, dt);
        continue;
      }
      if (e.id === "unlit") unlitAbilities(w, e, dt);
      if (e.dead) continue;
      if (e.flying) {
        wisp(w, e, dt);
        continue;
      }
      if (e.guard) {
        guard(w, e, dt);
        continue;
      }
      ground(w, e, dt);
    }
  }
  function statuses(w, e, dt, night, tick) {
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slowAmt = 0;
    }
    if (e.frostT > 0) e.frostT -= dt;
    const cell = Math.floor(e.y) * w.size + Math.floor(e.x);
    if (!e.flying && e.id !== "mossback") {
      const tu = w.trapAt[cell];
      if (tu) {
        const b = w.bmap.get(tu);
        if (b && b.id === "trap_tar") {
          applySlow(e, BUILDINGS.trap_tar.slow[0], 0.25, false);
          if (b.lit) e.dotFire += BUILDINGS.trap_tar.dmg * dt;
        } else if (b && b.id === "trap_spikes" && e.lastCell !== cell && b.charges > 0 && b.constructing <= 0) {
          const base = b.level >= 2 ? 18 : BUILDINGS.trap_spikes.dmg;
          const syn = b.synMask & 8 && e.slowAmt > 0 ? BALANCE.synergy.tarSpikeMul : 1;
          b.charges--;
          if (b.charges <= 0) w.r.fieldDirty = true;
          damageEnemy(w, e, base, "pierce", { src: "trap", synergyMul: syn });
          if (e.dead) return;
        }
      }
    }
    e.lastCell = cell;
    e.status.slow = e.slowAmt;
    e.status.veiled = night && lightAt(w, e.x, e.y) === 0;
    if (e.status.burn > 0) {
      e.status.burn -= dt;
      e.dotFire += e.burnDps * dt;
      if (e.status.burn <= 0) {
        e.status.burn = 0;
        e.burnDps = 0;
      }
    }
    const ash = boonStacks(w, "ash");
    if (ash && night && lightAt(w, e.x, e.y) === 2) e.dotFire += BOON_FX.ash * ash * dt;
    if (tick) {
      if (e.status.burn > 0 && boonStacks(w, "spread")) {
        forEnemiesInRange(w, e.x, e.y, BOON_FX.spreadRange, (o) => {
          if (o !== e && o.status.burn <= 0) applyBurn(o, e.burnDps, 2);
        });
      }
      if (e.dotFire >= 0.5) {
        const a = e.dotFire;
        e.dotFire = 0;
        damageEnemy(w, e, a, "fire", { src: "burn" });
      }
      if (!e.dead && e.dotFrost >= 0.5) {
        const a = e.dotFrost;
        e.dotFrost = 0;
        damageEnemy(w, e, a, "frost", { src: "aura" });
      }
    }
  }
  function moveToward(w, e, tx, ty, dt, stopDist = 0) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    const sp = speedOf(w, e);
    const sep = { x: 0, y: 0 };
    if (e.stuckT < 0.5) separation(w, e, sep);
    let vx = 0, vy = 0, wx = 0, wy = 0;
    if (d > stopDist + 0.02) {
      vx = wx = dx / d * sp;
      vy = wy = dy / d * sp;
      if (e.anim !== "move" && e.animT > 0.25) {
        e.anim = "move";
        e.animT = 0;
      }
    }
    vx += sep.x * sp * 0.6;
    vy += sep.y * sp * 0.6;
    e.vx = vx;
    e.vy = vy;
    if (Math.abs(vx) > 0.05) e.facing = vx > 0 ? 1 : -1;
    if (e.flying) {
      e.x += vx * dt;
      e.y += vy * dt;
      clampMap(w, e);
    } else if (!moveUnit(w, e, vx * dt, vy * dt, e.radius, false) && (wx || wy)) moveUnit(w, e, wx * dt, wy * dt, e.radius, false);
  }
  function chaseFoe(w, e, f, dt) {
    const d = Math.hypot(f.u.x - e.x, f.u.y - e.y);
    e.targetUid = f.u.uid;
    if (d <= e.range + 0.3) {
      e.vx = 0;
      e.vy = 0;
      e.facing = f.u.x >= e.x ? 1 : -1;
      if (attackReady(e, dt)) {
        if (e.id === "spitter") fire(w, { kind: "spit", x: e.x, y: e.y - 0.2, targetUid: f.u.uid, tx: f.u.x, ty: f.u.y, dmg: enemyDmg(w, e), dtype: "impact", src: e.uid, srcKind: 2, speed: 7 });
        else if (e.id === "bomber") explode(w, e);
        else hitFoe(w, f, enemyDmg(w, e));
      }
    } else moveToward(w, e, f.u.x, f.u.y, dt, e.range * 0.8);
  }
  function ground(w, e, dt) {
    const P = BALANCE.path;
    if (e.mode === EMODE.chase) {
      const f = foeByUid(w, e.targetUid);
      if (!f || Math.hypot(f.u.x - e.x, f.u.y - e.y) > P.leashRange) e.mode = EMODE.path;
      else {
        chaseFoe(w, e, f, dt);
        return;
      }
    }
    if (e.id !== "wisp") {
      const f = findFoe(w, e, e.id === "spitter" ? 0 : P.aggroRange, true);
      if (f) {
        e.mode = EMODE.chase;
        chaseFoe(w, e, f, dt);
        return;
      }
    }
    if (e.id === "spitter") {
      let tgt = null, bd = Infinity;
      for (const b of w.s.buildings) {
        if (!isTower(b.id) || b.dead) continue;
        const d = distToRect(e.x, e.y, b);
        if (d <= e.range && d < bd) {
          bd = d;
          tgt = b;
        }
      }
      if (tgt) {
        e.vx = 0;
        e.vy = 0;
        e.facing = tgt.x + tgt.w / 2 >= e.x ? 1 : -1;
        if (attackReady(e, dt)) hitBuilding(w, e, tgt);
        return;
      }
      const f = findFoe(w, e, e.range, false);
      if (f) {
        e.targetUid = f.u.uid;
        e.vx = 0;
        e.vy = 0;
        if (attackReady(e, dt)) fire(w, { kind: "spit", x: e.x, y: e.y - 0.2, targetUid: f.u.uid, tx: f.u.x, ty: f.u.y, dmg: enemyDmg(w, e), dtype: "impact", src: e.uid, srcKind: 2, speed: 7 });
        return;
      }
      if (distToRect(e.x, e.y, hearthRect) <= e.range) {
        e.vx = 0;
        e.vy = 0;
        if (attackReady(e, dt)) hitBuilding(w, e, w.hearth);
        return;
      }
    }
    if (e.id === "bomber") {
      let tgt = null, bd = Infinity;
      for (const b of w.s.buildings) {
        if (isTrap(b.id) || b.dead) continue;
        const d = distToRect(e.x, e.y, b);
        if (d <= 2.5 && d < bd) {
          bd = d;
          tgt = b;
        }
      }
      if (tgt) {
        e.targetUid = tgt.uid;
        if (bd <= e.radius + 0.35) {
          explode(w, e);
          return;
        }
        moveToward(w, e, tgt.x + tgt.w / 2, tgt.y + tgt.h / 2, dt);
        return;
      }
    }
    const field = fieldFor(w, e);
    const n = w.size;
    const cell = Math.floor(e.y) * n + Math.floor(e.x);
    let nx = field.next[cell];
    if (nx < 0 && field.dist[cell] !== 0) {
      moveToward(w, e, CENTER, CENTER, dt);
      return;
    }
    if (nx < 0) nx = cell;
    const bu = w.bldAt[nx];
    if (bu) {
      const b = w.bmap.get(bu);
      if (b && !b.dead) {
        const d = distToRect(e.x, e.y, b);
        if (d <= e.range + 0.05 || e.id === "spitter" && d <= e.range) {
          e.vx = 0;
          e.vy = 0;
          e.facing = b.x + b.w / 2 >= e.x ? 1 : -1;
          if (e.id === "snuffer" && b.id === "brazier" && b.lit) {
            e.mode = EMODE.snuff;
            e.targetUid = b.uid;
            e.snuffT += dt;
            if (e.anim !== "attack") {
              e.anim = "attack";
              e.animT = 0;
            }
            if (e.snuffT >= SNUFFER.snuffSeconds) {
              e.snuffT = 0;
              b.snuffed = true;
              b.lit = false;
              w.lightDirty = true;
              w.r.snuffDirty = true;
              emit(w, { t: "brazier", uid: b.uid, lit: false });
            }
            return;
          }
          e.snuffT = 0;
          e.mode = EMODE.attackBld;
          if (e.id === "bomber") {
            explode(w, e);
            return;
          }
          if (attackReady(e, dt)) hitBuilding(w, e, b);
          return;
        }
      }
    }
    e.mode = EMODE.path;
    e.snuffT = 0;
    let tx = nx % n + 0.5, ty = Math.floor(nx / n) + 0.5;
    if (e.stuckT > 0.5) {
      tx = cell % n + 0.5;
      ty = Math.floor(cell / n) + 0.5;
      if (Math.hypot(e.x - tx, e.y - ty) < 0.1) e.stuckT = 0;
    }
    const ox = e.x, oy = e.y;
    moveToward(w, e, tx, ty, dt);
    if (Math.hypot(e.x - ox, e.y - oy) < speedOf(w, e) * dt * 0.25) e.stuckT += dt;
    else if (e.stuckT <= 0.5) e.stuckT = 0;
  }
  function explode(w, e) {
    if (e.dead) return;
    emit(w, { t: "explode", x: e.x, y: e.y, radius: BOMBER.radius });
    const hits = [];
    for (const b of w.s.buildings) if (!isTrap(b.id) && distToRect(e.x, e.y, b) <= BOMBER.radius) hits.push(b);
    const mul = e.elite ? BALANCE.elite.dmgMul : 1;
    for (const b of hits) damageBuilding(w, b, BOMBER.bldDmg * mul, null);
    for (const h of w.s.heroes) if (!h.dead && Math.hypot(h.x - e.x, h.y - e.y) <= BOMBER.radius) damageHero(w, h, BOMBER.heroDmg * mul);
    for (const a of w.s.allies) if (!a.dead && Math.hypot(a.x - e.x, a.y - e.y) <= BOMBER.radius) damageAlly(w, a, BOMBER.heroDmg * mul);
    e.dead = true;
    e.hp = 0;
    emit(w, { t: "death", uid: e.uid, kind: "enemy", id: e.id, x: e.x, y: e.y });
  }
  function wisp(w, e, dt) {
    const d = distToRect(e.x, e.y, hearthRect);
    if (d <= e.range) {
      e.vx = 0;
      e.vy = 0;
      e.targetUid = w.hearth.uid;
      if (attackReady(e, dt)) damageBuilding(w, w.hearth, bldDamage(w, e), e);
      return;
    }
    if (e.guard) {
      guard(w, e, dt);
      return;
    }
    moveToward(w, e, CENTER, CENTER, dt);
  }
  function guard(w, e, dt) {
    const home = Math.hypot(e.x - e.hx, e.y - e.hy);
    if (e.mode === EMODE.chase) {
      const f2 = foeByUid(w, e.targetUid);
      if (!f2 || home > 7 || Math.hypot(f2.u.x - e.x, f2.u.y - e.y) > 6) {
        e.mode = EMODE.ret;
      } else {
        chaseFoe(w, e, f2, dt);
        return;
      }
    }
    const f = findFoe(w, e, Math.max(4, e.range), !e.flying);
    if (f && home < 6) {
      e.mode = EMODE.chase;
      chaseFoe(w, e, f, dt);
      return;
    }
    if (home > 0.8) {
      moveToward(w, e, e.hx, e.hy, dt);
      if (home < 1) e.mode = EMODE.idle;
    } else {
      e.vx = 0;
      e.vy = 0;
      e.mode = EMODE.idle;
      if (e.anim !== "idle") {
        e.anim = "idle";
        e.animT = 0;
      }
    }
  }
  function mossback(w, e, dt) {
    const M = MOSSBACK;
    if (e.shell > 0) {
      e.shell -= dt;
      e.vx = 0;
      e.vy = 0;
      if (e.shell <= 0) {
        e.shell = 0;
        e.t1 = M.shellEvery;
        e.anim = "move";
      }
      return;
    }
    e.t1 -= dt;
    if (e.t1 <= 0) {
      e.shell = M.shellSecs;
      e.anim = "attack";
      e.animT = 0;
      for (let k = 0; k < M.shellSpawn; k++) {
        const a = k / M.shellSpawn * Math.PI * 2;
        const g = spawnEnemy(w, "gloomling", e.x + Math.cos(a) * 1.4, e.y + Math.sin(a) * 1.4, { wave: true });
        if (g && !posOk(w, g)) {
          g.x = e.x;
          g.y = e.y;
        }
      }
      emit(w, { t: "skill", hero: e.uid, skill: "shell", x: e.x, y: e.y });
      return;
    }
    const dx = CENTER - e.x, dy = CENTER - e.y, d = Math.hypot(dx, dy);
    const sp = speedOf(w, e);
    const nx = d > 0.01 ? e.x + dx / d * sp * dt : e.x, ny = d > 0.01 ? e.y + dy / d * sp * dt : e.y;
    const touching = [];
    for (const b of w.s.buildings) if (!isTrap(b.id) && !b.dead && distToRect(nx, ny, b) < ENEMIES.mossback.radius) touching.push(b);
    if (distToRect(nx, ny, hearthRect) < ENEMIES.mossback.radius && !touching.includes(w.hearth)) touching.push(w.hearth);
    if (touching.length) {
      e.vx = 0;
      e.vy = 0;
      e.t3 += dt;
      if (e.anim !== "attack") {
        e.anim = "attack";
        e.animT = 0;
      }
      if (e.t3 >= 0.5) {
        e.t3 -= 0.5;
        for (const b of touching) damageBuilding(w, b, M.crushDps * 0.5, null);
      }
      return;
    }
    e.vx = (nx - e.x) / dt;
    e.vy = (ny - e.y) / dt;
    e.facing = dx >= 0 ? 1 : -1;
    e.x = nx;
    e.y = ny;
    if (e.anim !== "move") {
      e.anim = "move";
      e.animT = 0;
    }
  }
  function posOk(w, e) {
    const cx = Math.floor(e.x), cy = Math.floor(e.y);
    if (cx < 0 || cy < 0 || cx >= w.size || cy >= w.size) return false;
    const i = cy * w.size + cx;
    return w.terrain[i] === 0 && !w.bldAt[i];
  }
  function unlitAbilities(w, e, dt) {
    const U = UNLIT;
    e.t1 -= dt;
    e.t2 -= dt;
    if (e.t1 <= 0) {
      e.t1 = U.pulseEvery;
      for (const b of w.s.buildings) {
        if (b.id === "brazier" && distToRect(e.x, e.y, b) <= U.pulseRadius) {
          b.offT = U.pulseSecs;
          if (b.lit) emit(w, { t: "brazier", uid: b.uid, lit: false });
        }
      }
      w.s.buffs.unlitPulseT = U.pulseSecs;
      w.s.buffs.hearthLightMul = U.hearthLightMul;
      w.lightDirty = true;
      w.r.snuffDirty = true;
      emit(w, { t: "pulse", x: e.x, y: e.y, radius: U.pulseRadius });
      e.anim = "attack";
      e.animT = 0;
    }
    if (e.t2 <= 0) {
      e.t2 = U.summonEvery;
      for (let k = 0; k < U.summonWisps; k++) {
        const a = k / U.summonWisps * Math.PI * 2 + 0.4;
        spawnEnemy(w, "wisp", e.x + Math.cos(a) * 1.2, e.y + Math.sin(a) * 1.2, { wave: true });
      }
    }
    for (let k = 0; k < U.teleportAt.length; k++) {
      if (e.flags & 1 << k) continue;
      if (e.hp > e.maxHp * U.teleportAt[k]) continue;
      e.flags |= 1 << k;
      const rifts = w.s.pois.filter((p) => p.kind === "rift");
      let best = rifts[0], bd = -1;
      for (const r of rifts) {
        const d = Math.hypot(r.x + 0.5 - e.x, r.y + 0.5 - e.y);
        if (d > bd) {
          bd = d;
          best = r;
        }
      }
      if (best) {
        e.x = best.x + 0.5;
        e.y = best.y + 0.5;
        e.px = e.x;
        e.py = e.y;
        e.mode = EMODE.path;
        emit(w, { t: "teleport", uid: e.uid, x: e.x, y: e.y });
      }
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * U.healFrac);
      if (w.s.boss) w.s.boss.hp = e.hp;
      spawnEnemy(w, "brute", e.x + 1, e.y, { elite: true, wave: true });
    }
  }
  function removeDeadEnemies(w) {
    const arr = w.s.enemies;
    let j = 0;
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e.dead) {
        w.emap.delete(e.uid);
        continue;
      }
      arr[j++] = e;
    }
    arr.length = j;
  }

  // assets/scripts/core/sim/Meta.ts
  var META_KEY = "emberhold.meta.v1";
  var RUN_KEY = "emberhold.run.v1";
  function defaultMeta() {
    return {
      version: 1,
      ember: 0,
      unlockedHeroes: ["knight"],
      unlockedBlueprints: [],
      talents: {},
      tutorialDone: false,
      starterHero: "knight",
      settings: { music: 0.7, sfx: 0.8, haptics: true, bigText: false, lang: "en" }
    };
  }
  function loadMeta(json) {
    const d = defaultMeta();
    if (!json) return d;
    try {
      const o = JSON.parse(json);
      if (!o || typeof o !== "object" || o.version !== 1) return d;
      const heroes = Array.isArray(o.unlockedHeroes) ? o.unlockedHeroes.filter((h) => HERO_IDS.includes(h)) : d.unlockedHeroes;
      if (!heroes.includes("knight")) heroes.unshift("knight");
      const bps = Array.isArray(o.unlockedBlueprints) ? o.unlockedBlueprints.filter((b) => typeof b === "string" && b in BUILDINGS && BUILDINGS[b].should) : [];
      const talents = {};
      if (o.talents && typeof o.talents === "object") for (const t2 of TALENTS) {
        const v = Number(o.talents[t2.id]);
        if (v > 0) talents[t2.id] = Math.min(t2.maxLevel, Math.floor(v));
      }
      const s = o.settings ?? {};
      const num = (v, def) => typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(1, v)) : def;
      return {
        version: 1,
        ember: typeof o.ember === "number" && isFinite(o.ember) ? Math.max(0, Math.floor(o.ember)) : 0,
        unlockedHeroes: heroes,
        unlockedBlueprints: bps,
        talents,
        tutorialDone: !!o.tutorialDone,
        starterHero: heroes.includes(o.starterHero) ? o.starterHero : "knight",
        settings: { music: num(s.music, d.settings.music), sfx: num(s.sfx, d.settings.sfx), haptics: s.haptics !== false, bigText: !!s.bigText, lang: s.lang === "vi" ? "vi" : "en" }
      };
    } catch {
      return d;
    }
  }
  function heroUnlockCost(id) {
    return HEROES[id].unlockEmber;
  }
  function unlockHero(meta, id) {
    if (meta.unlockedHeroes.includes(id)) return false;
    const c = heroUnlockCost(id);
    if (meta.ember < c) return false;
    meta.ember -= c;
    meta.unlockedHeroes.push(id);
    return true;
  }
  function setStarterHero(meta, id) {
    if (!meta.unlockedHeroes.includes(id)) return false;
    meta.starterHero = id;
    return true;
  }
  function buyBlueprint(meta, id) {
    const d = BUILDINGS[id];
    if (!d.should || meta.unlockedBlueprints.includes(id) || meta.ember < d.blueprintCost) return false;
    meta.ember -= d.blueprintCost;
    meta.unlockedBlueprints.push(id);
    return true;
  }
  function talentLevel(meta, id) {
    return meta.talents[id] ?? 0;
  }
  function talentCost(meta, id) {
    const t2 = TALENT_BY_ID[id];
    const lv = talentLevel(meta, id);
    return lv >= t2.maxLevel ? null : t2.costs[lv];
  }
  function buyTalent(meta, id) {
    const c = talentCost(meta, id);
    if (c === null || meta.ember < c) return false;
    meta.ember -= c;
    meta.talents[id] = talentLevel(meta, id) + 1;
    return true;
  }
  function emberFor(stats, victory2) {
    return 10 * stats.nightsSurvived + 50 * stats.bosses + 5 * stats.camps + (victory2 ? 100 : 0);
  }
  function applyRunEmber(meta, amount) {
    const a = Math.max(0, Math.floor(amount));
    meta.ember += a;
    return a;
  }

  // assets/scripts/core/sim/Spawner.ts
  function nightBudget(n) {
    if (n <= 10) return BALANCE.budget(n);
    return BALANCE.budget(10) * Math.pow(BALANCE.endlessMul, n - 10);
  }
  var isBossNight = (n) => n === 5 || n === 10;
  var bossOf = (n) => n === 5 ? "mossback" : n === 10 ? "unlit" : null;
  function riftsActive(n) {
    return BALANCE.riftsActive(n);
  }
  function compose(rng, n, budget) {
    const avail = WAVE_ENEMIES.filter((id) => ENEMIES[id].firstNight <= n);
    const picks = [];
    let left = budget;
    const unitCost = (id) => ENEMIES[id].cost * (ENEMIES[id].pack ?? 1);
    const add = (id, elite) => {
      const pk = ENEMIES[id].pack ?? 1;
      const c = unitCost(id) * (elite ? BALANCE.elite.costMul : 1);
      picks.push({ enemy: id, elite, count: elite ? 1 : pk, cost: c });
      left -= c;
    };
    const debut = avail.find((id) => ENEMIES[id].firstNight === n);
    if (debut) {
      const target = budget * 0.25;
      let spent = 0;
      do {
        add(debut, false);
        spent += unitCost(debut);
      } while (spent < target && left >= unitCost(debut));
    }
    if (n >= BALANCE.elite.fromNight) {
      let eb = budget * BALANCE.elite.maxBudgetFrac;
      const eligible = avail.filter((id) => !ENEMIES[id].pack);
      for (let tries = 0; tries < 20; tries++) {
        const id = eligible[rng.int(0, eligible.length - 1)];
        const c = ENEMIES[id].cost * BALANCE.elite.costMul;
        if (c > eb || c > left) continue;
        add(id, true);
        eb -= c;
      }
    }
    const weights = avail.map((id) => ENEMIES[id].weight);
    for (let guard2 = 0; guard2 < 400 && left > 0; guard2++) {
      const fit = avail.map((id, i) => unitCost(id) <= left ? weights[i] : 0);
      if (fit.every((x) => x === 0)) break;
      add(avail[rng.weighted(fit)], false);
    }
    return picks;
  }
  function planNight(w) {
    const n = w.s.night;
    const rng = new Rng(mixSeed(w.s.seed, 1e3 + n));
    const B2 = nightBudget(n) * (isBossNight(n) ? BALANCE.bossBudgetMul : 1);
    const k = riftsActive(n);
    const ws = [];
    for (let i = 0; i < k; i++) ws.push(rng.range(0.6, 1.4));
    const tot = ws.reduce((a, b) => a + b, 0);
    const W2 = BALANCE.night.spawnWindow(n);
    const plan = [];
    const omens = [];
    for (let r = 0; r < k; r++) {
      let share = B2 * ws[r] / tot;
      if (w.r.rootCut.includes(r)) share *= 1 - BALANCE.rootBudgetCut;
      const picks = compose(rng, n, share);
      const times = [];
      for (let t2 = 2 + rng.range(0, 2); t2 <= W2; t2 += rng.range(BALANCE.night.pulseMin, BALANCE.night.pulseMax)) times.push(t2);
      if (!times.length) times.push(2);
      picks.sort((a, b) => a.cost - b.cost);
      const last = picks.pop();
      const P = times.length;
      const pulses = times.map(() => []);
      picks.forEach((p, i) => pulses[Math.min(P - 1, Math.floor(i * P / Math.max(1, picks.length + 1)))].push(p));
      if (last) pulses[P - 1].push(last);
      pulses.forEach((ps, pi) => {
        let dt = 0;
        for (const p of ps) for (let c = 0; c < p.count; c++) {
          plan.push({ t: times[pi] + dt, rift: r, enemy: p.enemy, elite: p.elite });
          dt += 0.12;
        }
      });
      const agg = /* @__PURE__ */ new Map();
      for (const ps of pulses) for (const p of ps) {
        const key = p.enemy;
        const o = agg.get(key) ?? { enemy: p.enemy, count: 0, rift: r, elite: 0 };
        o.count += p.count;
        if (p.elite) o.elite += 1;
        agg.set(key, o);
      }
      for (const id of WAVE_ENEMIES) {
        const o = agg.get(id);
        if (o) omens.push(o);
      }
    }
    const boss = bossOf(n);
    if (boss && !(w.s.endless && n > 10)) {
      plan.push({ t: 3, rift: 0, enemy: boss, elite: false });
      omens.unshift({ enemy: boss, count: 1, rift: 0, elite: 0 });
    }
    plan.sort((a, b) => a.t - b.t || a.rift - b.rift);
    w.r.spawn = plan;
    w.r.spawnIdx = 0;
    w.s.omens = omens;
    w.s.enemiesLeft = plan.length;
  }
  function riftPois(w) {
    return w.s.pois.filter((p) => p.kind === "rift").sort((a, b) => a.data.index - b.data.index);
  }
  function updateSpawner(w) {
    const plan = w.r.spawn;
    const rifts = riftPois(w);
    while (w.r.spawnIdx < plan.length && plan[w.r.spawnIdx].t <= w.s.nightT) {
      const sp = plan[w.r.spawnIdx];
      const rf = rifts[sp.rift] ?? rifts[0];
      const boss = ENEMIES[sp.enemy].boss;
      if (!boss && w.s.enemies.length >= BALANCE.caps.enemies) break;
      const jx = w.rng.range(-0.8, 0.8), jy = w.rng.range(-0.8, 0.8);
      spawnEnemy(w, sp.enemy, rf.x + 0.5 + jx, rf.y + 0.5 + jy, { elite: sp.elite, wave: true, hpMul: boss ? 1 : BALANCE.night.hpScale(w.s.night) });
      w.r.spawnIdx++;
    }
    let alive = 0;
    for (const e of w.s.enemies) if (e.wave && !e.dead) alive++;
    w.s.enemiesLeft = alive + (plan.length - w.r.spawnIdx);
  }
  function spawnGuards(w, p, count, types, hpMul, rng) {
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2 + rng.range(0, 0.6);
      const r = 1.3 + rng.range(0, 0.8);
      let x = p.x + 0.5 + Math.cos(a) * r, y = p.y + 0.5 + Math.sin(a) * r;
      const cx = Math.floor(x), cy = Math.floor(y);
      if (cx < 0 || cy < 0 || cx >= w.size || cy >= w.size || w.terrain[cy * w.size + cx] !== 0) {
        x = p.x + 0.5;
        y = p.y + 1.5;
      }
      const e = spawnEnemy(w, types[i % types.length], x, y, { guard: p.uid, wave: false, hpMul });
      if (e) e.anim = "idle";
    }
    p.guards = count;
  }
  function initGuards(w) {
    const rng = new Rng(mixSeed(w.s.seed, 77));
    for (const p of w.s.pois) {
      const d = Math.hypot(p.x + 0.5 - CENTER, p.y + 0.5 - CENTER);
      if (p.kind === "camp") {
        const n = Math.max(BALANCE.poi.campGuardsMin, Math.min(BALANCE.poi.campGuardsMax, 4 + Math.floor((d - 10) / 3.5)));
        const types = d < 14 ? ["gloomling", "gloomling", "skitter"] : d < 18 ? ["gloomling", "spitter", "skitter"] : ["gloomling", "spitter", "brute"];
        spawnGuards(w, p, n, types, 1 + Math.max(0, d - 10) / 30, rng);
      } else if (p.kind === "cage") {
        spawnGuards(w, p, rng.int(2, 3), d < 15 ? ["gloomling"] : ["gloomling", "spitter"], 1, rng);
      }
    }
  }
  function spawnRoots(w) {
    w.s.pois = w.s.pois.filter((p) => p.kind !== "root");
    for (const e of w.s.enemies) if (e.guard && !w.s.pois.some((p) => p.uid === e.guard)) e.dead = true;
    const rng = new Rng(mixSeed(w.s.seed, 5e3 + w.s.night));
    const k = riftsActive(w.s.night);
    const types = WAVE_ENEMIES.filter((id) => ENEMIES[id].firstNight <= Math.max(1, w.s.night) && !(ENEMIES[id].tags & 4) && id !== "bomber" && id !== "snuffer");
    for (const rf of riftPois(w)) {
      const idx = rf.data.index;
      rf.active = idx < k;
      if (!rf.active) continue;
      const dx = CENTER - (rf.x + 0.5), dy = CENTER - (rf.y + 0.5), d = Math.hypot(dx, dy);
      let x = Math.floor(rf.x + 0.5 + dx / d * 2.5), y = Math.floor(rf.y + 0.5 + dy / d * 2.5);
      if (w.terrain[y * w.size + x] !== 0 || w.bldAt[y * w.size + x]) {
        x = rf.x;
        y = rf.y + 1;
      }
      const root = { uid: newUid(w), kind: "root", x, y, hp: BALANCE.poi.rootHp, maxHp: BALANCE.poi.rootHp, active: true, data: { rift: idx }, guards: 0 };
      w.s.pois.push(root);
      spawnGuards(w, root, rng.int(3, 5), types.length ? types : ["gloomling"], 1 + w.s.night * 0.08, rng);
    }
  }

  // assets/scripts/core/sim/Towers.ts
  function towerRange(w, b) {
    const d = BUILDINGS[b.id];
    let r = d.range ? d.range[b.level - 1] : 0;
    if (b.id === "hearth" || b.id === "workshop") return r;
    if (b.synMask & SYN.embedded) r += BALANCE.synergy.embeddedRangeBonus;
    r += BOON_FX.hawk * boonStacks(w, "hawk");
    return r;
  }
  function towerRateMul(w, b) {
    let m = 1 + BOON_FX.reload * boonStacks(w, "reload");
    if (b.synMask & SYN.rally) m *= BALANCE.synergy.rallyRateMul;
    if (hornActive(w)) m *= BALANCE.horn.rateMul;
    if (w.s.buffs.shrine === "towerRate") m *= 1.25;
    return m;
  }
  function towerDamage(w, b) {
    const d = BUILDINGS[b.id];
    const base = (d.dmg ?? 0) * (1 + BALANCE.build.upgradeDmgMul * (b.level - 1));
    let bonus = 0;
    if (boonStacks(w, "mirror") && Math.hypot(b.x + b.w / 2 - CENTER, b.y + b.h / 2 - CENTER) <= hearthLightRadius(w)) bonus += BOON_FX.mirror;
    return { base, bonus };
  }
  function towerCanSee(w, e) {
    if (w.s.phase !== "night") return true;
    return lightAt(w, e.x, e.y) >= 1;
  }
  function pickTarget(w, b, range, hitsFlying, minRange = 0) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const reach = range + (b.w - 1) * 0.5;
    let best = null, bd = Infinity;
    forEnemiesInRange(w, cx, cy, reach, (e) => {
      if (!hitsFlying && e.tags & TAG_FLYING) return;
      if (e.id === "mossback" && e.shell > 0) return;
      if (minRange > 0 && Math.hypot(e.x - cx, e.y - cy) < minRange) return;
      if (!towerCanSee(w, e)) return;
      const d = remainingDist(w, e);
      if (d < bd || d === bd && best && e.uid < best.uid) {
        bd = d;
        best = e;
      }
    });
    return best;
  }
  function updateBuildings(w, dt) {
    const night = w.s.phase === "night";
    const living = boonStacks(w, "living");
    const blds = w.s.buildings;
    for (let i = 0; i < blds.length; i++) {
      const b = blds[i];
      if (b.dead) continue;
      if (b.constructing > 0) {
        b.constructing -= dt;
        if (b.constructing <= 0) {
          b.constructing = 0;
          w.lightDirty = true;
          w.r.snuffDirty = true;
        }
        continue;
      }
      if (b.offT > 0) {
        b.offT -= dt;
        if (b.offT <= 0) {
          b.offT = 0;
          w.lightDirty = true;
          w.r.snuffDirty = true;
          if (!b.snuffed) emit(w, { t: "brazier", uid: b.uid, lit: true });
        }
      }
      if (living && night && b.id !== "hearth" && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * BOON_FX.living * dt);
      if (b.id === "trap_tar" && b.lit) {
        b.burnT -= dt;
        if (b.burnT <= 0) {
          destroyBuilding(w, b);
          i--;
          continue;
        }
        continue;
      }
      if (b.id === "workshop" && night) {
        workshopRepair(w, b, dt);
        continue;
      }
      if (b.id === "tower_frost") {
        frostAura(w, b, dt);
        continue;
      }
      if (isTower(b.id) || b.id === "hearth") towerFire(w, b, dt);
    }
  }
  function towerFire(w, b, dt) {
    const d = BUILDINGS[b.id];
    b.cooldown -= dt * (b.id === "hearth" ? hornActive(w) ? BALANCE.horn.rateMul : 1 : towerRateMul(w, b));
    if (b.cooldown > 0) return;
    const range = towerRange(w, b);
    const t2 = pickTarget(w, b, range, !!d.hitsFlying, d.minRange ?? 0);
    if (!t2) {
      b.cooldown = 0;
      return;
    }
    b.cooldown = 1 / d.rate;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2 - (b.id === "hearth" ? 0.6 : 0.4);
    b.aimAngle = Math.atan2(t2.y - cy, t2.x - cx);
    const { base, bonus } = towerDamage(w, b);
    const dmg = base * (1 + bonus);
    const flame = (b.synMask & SYN.flame) !== 0;
    switch (b.id) {
      case "hearth":
        fire(w, { kind: "fireball", x: cx, y: cy, target: t2, dmg, dtype: "fire", src: b.uid, srcKind: 0, speed: 9 });
        break;
      case "tower_arrow":
        fire(w, { kind: "arrow", x: cx, y: cy, target: t2, dmg, dtype: "pierce", src: b.uid, srcKind: 0, speed: 13, flame });
        break;
      case "tower_ballista": {
        const pierce = d.pierce[b.level - 1];
        fire(w, { kind: "bolt", x: cx, y: cy, tx: t2.x, ty: t2.y, dmg, dtype: "impact", src: b.uid, srcKind: 0, speed: 15, pierce, maxDist: range + 1.5, flame, hitsFlying: false });
        break;
      }
      case "tower_mortar": {
        const dist = Math.hypot(t2.x - cx, t2.y - cy);
        const T2 = 0.8 + dist / 14;
        const px = t2.x + t2.vx * T2, py = t2.y + t2.vy * T2;
        fire(w, { kind: "mortar", x: cx, y: cy, tx: px, ty: py, dmg, dtype: "impact", src: b.uid, srcKind: 0, speed: dist / T2, flightT: T2, splash: d.splash[b.level - 1], hitsFlying: false });
        break;
      }
      case "tower_spark":
        fire(w, { kind: "spark", x: cx, y: cy, target: t2, dmg, dtype: "spark", src: b.uid, srcKind: 0, speed: 24, chain: d.chain[b.level - 1] });
        break;
    }
  }
  function frostAura(w, b, dt) {
    const d = BUILDINGS.tower_frost;
    const r = towerRange(w, b);
    const slow = d.slow[b.level - 1];
    const { base, bonus } = towerDamage(w, b);
    const dps = base * (1 + bonus) * towerRateMul(w, b);
    const cx = b.x + 0.5, cy = b.y + 0.5;
    let any = false;
    forEnemiesInRange(w, cx, cy, r, (e) => {
      if (e.id === "mossback" && e.shell > 0) return;
      applySlow(e, slow, 0.35, true);
      e.dotFrost += dps * dt;
      any = true;
    });
    b.cooldown = any ? 1 : 0;
  }
  function workshopRepair(w, b, dt) {
    const hps = BUILDINGS.workshop.repairHps[b.level - 1];
    const r = BUILDINGS.workshop.range[0];
    const cx = b.x + 1, cy = b.y + 1;
    let best = null;
    for (const o of w.s.buildings) {
      if (o.dead || o.id === "hearth" || o.hp >= o.maxHp || o.id === "trap_spikes" || o.id === "trap_tar") continue;
      if (distToRect(cx, cy, o) > r) continue;
      if (!best || o.hp / o.maxHp < best.hp / best.maxHp) best = o;
    }
    if (best) {
      best.hp = Math.min(best.maxHp, best.hp + hps * dt);
      if (Math.abs(best.hp - best.pathHp) >= 0.2 * best.maxHp) w.r.fieldDirty = true;
    }
  }
  function spawnMilitia(w) {
    for (const b of w.s.buildings) {
      if (b.id !== "barracks" || b.dead) continue;
      const n = BUILDINGS.barracks.militia[b.level - 1];
      for (let k = 0; k < n; k++) {
        const x = b.x + 1 + (k % 2 ? 1.2 : -1.2), y = b.y + 2.4 + Math.floor(k / 2) * 0.6;
        const a = {
          uid: newUid(w),
          id: "militia",
          x,
          y,
          px: x,
          py: y,
          facing: 1,
          hp: MILITIA.hp,
          maxHp: MILITIA.hp,
          anim: "idle",
          animT: 0,
          status: { burn: 0, slow: 0, stun: 0, veiled: false },
          owner: b.uid,
          ttl: -1,
          atkCd: 0,
          hx: b.x + 1,
          hy: b.y + 2.3,
          dmg: MILITIA.dmg,
          rate: MILITIA.rate,
          range: MILITIA.range,
          dead: false
        };
        w.s.allies.push(a);
      }
    }
  }
  function updateAllies(w, dt) {
    const rateMul = hornActive(w) ? BALANCE.horn.rateMul : 1;
    for (const a of w.s.allies) {
      if (a.dead) continue;
      a.animT += dt;
      if (a.ttl >= 0) {
        a.ttl -= dt;
        if (a.ttl <= 0) {
          a.dead = true;
          continue;
        }
      }
      a.atkCd -= dt * rateMul;
      if (a.id === "turret") {
        if (a.atkCd > 0) continue;
        const e2 = nearestEnemy(w, a.x, a.y, a.range);
        if (!e2) {
          a.atkCd = 0;
          continue;
        }
        a.atkCd = 1 / a.rate;
        a.facing = e2.x >= a.x ? 1 : -1;
        a.anim = "attack";
        a.animT = 0;
        fire(w, { kind: "turret", x: a.x, y: a.y - 0.3, target: e2, dmg: a.dmg, dtype: "pierce", src: a.uid, srcKind: 3, speed: 14 });
        continue;
      }
      const e = nearestEnemy(w, a.hx, a.hy, MILITIA.guard, (o) => canHit("impact", o.tags));
      if (e) {
        const d = Math.hypot(e.x - a.x, e.y - a.y);
        a.facing = e.x >= a.x ? 1 : -1;
        if (d <= a.range + e.radius) {
          if (a.atkCd <= 0) {
            a.atkCd = 1 / a.rate;
            a.anim = "attack";
            a.animT = 0;
            damageEnemy(w, e, a.dmg, "impact", { src: "ally" });
          }
        } else {
          moveUnit(w, a, (e.x - a.x) / d * MILITIA.speed * dt, (e.y - a.y) / d * MILITIA.speed * dt, 0.3, true);
          a.anim = "move";
        }
      } else {
        const d = Math.hypot(a.hx - a.x, a.hy - a.y);
        if (d > 0.3) {
          moveUnit(w, a, (a.hx - a.x) / d * MILITIA.speed * dt, (a.hy - a.y) / d * MILITIA.speed * dt, 0.3, true);
          a.anim = "move";
        } else a.anim = "idle";
      }
      if (a.atkCd < 0) a.atkCd = 0;
    }
    const arr = w.s.allies;
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
    arr.length = j;
  }
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    const t2 = L > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L)) : 0;
    return Math.hypot(px - (x1 + dx * t2), py - (y1 + dy * t2));
  }
  function updateZones(w, dt) {
    const S2 = SKILLS;
    for (const z of w.s.zones) {
      z.t -= dt;
      if (z.kind === "firewall") {
        const mx = (z.x + z.x2) / 2, my = (z.y + z.y2) / 2;
        forEnemiesInRange(w, mx, my, S2.fireWall.length / 2 + z.r, (e) => {
          if (segDist(e.x, e.y, z.x, z.y, z.x2, z.y2) <= z.r + e.radius) e.dotFire += S2.fireWall.dps * dt;
        });
      } else {
        for (const h of w.s.heroes) if (!h.dead && Math.hypot(h.x - z.x, h.y - z.y) <= z.r) healHero(w, h, S2.sanctum.hps * dt, false);
      }
    }
    w.s.zones = w.s.zones.filter((z) => z.t > 0);
  }

  // assets/scripts/core/sim/Phases.ts
  function dayDuration(w) {
    const base = w.s.night <= 1 ? BALANCE.day.firstDaySeconds : BALANCE.day.seconds;
    return base + TALENT_BY_ID.longDay.perLevel * (w.meta.talents.longDay ?? 0);
  }
  function startDay(w) {
    const s = w.s;
    s.phase = "day";
    s.phaseT = 0;
    s.phaseDur = dayDuration(w);
    s.nightT = 0;
    s.boonSource = null;
    w.r.rootCut = [];
    w.r.enraged = false;
    for (const b of s.buildings) if (b.id === "brazier") {
      b.snuffed = false;
      b.offT = 0;
      b.fueled = true;
      b.relightT = 0;
    }
    let changed = false;
    for (const nd of s.nodes) {
      if (nd.kind !== "stump") continue;
      nd.regrowT -= 1;
      if (nd.regrowT <= 0 && !w.bldAt[nd.y * w.size + nd.x] && !w.trapAt[nd.y * w.size + nd.x]) {
        const blockedByUnit = s.heroes.some((h) => distToRect(h.x, h.y, { x: nd.x, y: nd.y, w: 1, h: 1 }) < 0.35);
        if (!blockedByUnit) {
          nd.kind = nd.orig;
          nd.hp = BALANCE.harvest.treeChops;
          nd.maxHp = nd.hp;
          nd.regrowT = 0;
          changed = true;
        }
      }
    }
    if (changed) {
      rebuildTerrain(w);
      w.r.fieldDirty = true;
    }
    spawnRoots(w);
    w.lightDirty = true;
    setBuildMode(w, false);
    updateTimeScale(w);
    emit(w, { t: "phase", phase: "day", night: s.night });
  }
  function callNight(w) {
    if (w.s.phase !== "day") return;
    const left = Math.max(0, w.s.phaseDur - w.s.phaseT);
    const g = Math.floor(left * BALANCE.day.callNightGoldPerSec);
    if (g > 0) {
      w.s.res.gold += g;
      w.s.stats.goldEarned += g;
      emit(w, { t: "gold", amount: g, x: CENTER, y: CENTER });
    }
    startDusk(w);
  }
  function startDusk(w) {
    const s = w.s;
    s.phase = "dusk";
    s.phaseT = 0;
    s.phaseDur = 0;
    s.pois = s.pois.filter((p) => p.kind !== "root");
    for (const e of s.enemies) if (e.guard && !s.pois.some((p) => p.uid === e.guard)) e.dead = true;
    const braziers = s.buildings.filter((b) => b.id === "brazier").sort((a, b) => Math.hypot(a.x + 0.5 - CENTER, a.y + 0.5 - CENTER) - Math.hypot(b.x + 0.5 - CENTER, b.y + 0.5 - CENTER) || a.uid - b.uid);
    const free = boonStacks(w, "embers") > 0;
    for (const b of braziers) {
      if (free) {
        b.fueled = true;
        continue;
      }
      if (s.res.wood >= BALANCE.light.brazierFuelWood) {
        s.res.wood -= BALANCE.light.brazierFuelWood;
        b.fueled = true;
      } else b.fueled = false;
    }
    w.lightDirty = true;
    w.r.snuffDirty = true;
    planNight(w);
    setBuildMode(w, true);
    updateTimeScale(w);
    emit(w, { t: "phase", phase: "dusk", night: s.night });
  }
  function startNight(w) {
    const s = w.s;
    if (s.phase !== "dusk") return;
    s.phase = "night";
    s.phaseT = 0;
    s.nightT = 0;
    s.phaseDur = BALANCE.night.spawnWindow(s.night);
    w.r.nightKills = 0;
    w.r.nightGold = 0;
    w.r.bossSpawned = false;
    w.r.falseDawnUsed = false;
    w.r.enraged = false;
    setBuildMode(w, false);
    spawnMilitia(w);
    w.lightDirty = true;
    maybeRecomputeFields(w, true);
    if (s.tutorial === 4) advanceTutorial(w, -1);
    updateTimeScale(w);
    emit(w, { t: "phase", phase: "night", night: s.night });
    emit(w, { t: "horn" });
  }
  function startDawn(w) {
    const s = w.s;
    s.phase = "dawn";
    s.phaseT = 0;
    s.nightT = 0;
    s.stats.nightsSurvived = Math.max(s.stats.nightsSurvived, s.night);
    if (s.boonOffer && s.boonSource === "chest") pickBoon(w, 0);
    for (const h of s.heroes) {
      if (h.dead) reviveHero(w, h);
      h.hp = h.maxHp;
    }
    for (const b of s.buildings) {
      if (b.id === "trap_spikes") b.charges = BUILDINGS.trap_spikes.charges[b.level - 1] + BOON_FX.spikes * boonStacks(w, "spikes");
    }
    s.allies = s.allies.filter((a) => a.id !== "militia");
    s.zones = [];
    s.projectiles = [];
    if (s.buffs.shrine && s.night >= w.r.shrineUntil) s.buffs.shrine = null;
    s.buffs.unlitPulseT = 0;
    s.buffs.hearthLightMul = 1;
    s.buffs.falseDawnT = 0;
    w.r.hearthLowWarned = w.hearth.hp < w.hearth.maxHp * 0.3;
    w.r.enraged = false;
    s.boss = null;
    w.r.fieldDirty = true;
    w.lightDirty = true;
    s.tavernOffer = null;
    if (s.buildings.some((b) => b.id === "tavern")) {
      const owned = /* @__PURE__ */ new Set([...s.heroes.map((h) => h.id), ...s.reserve]);
      const pool = HERO_IDS.filter((h) => !owned.has(h));
      const opts = [];
      for (let k = 0; k < 2 && pool.length; k++) opts.push(pool.splice(w.rng.int(0, pool.length - 1), 1)[0]);
      const pick = opts.length ? opts[w.rng.int(0, opts.length - 1)] : null;
      if (pick) s.tavernOffer = [{ hero: pick, cost: TAVERN.goldPerHero * (s.heroes.length + s.reserve.length) }];
    }
    setBuildMode(w, false);
    updateTimeScale(w);
    emit(w, { t: "phase", phase: "dawn", night: s.night });
    offerBoons(w, "dawn");
  }
  function hireHero(w, index) {
    const o = w.s.tavernOffer?.[index];
    if (!o || w.s.res.gold < o.cost) return false;
    w.s.res.gold -= o.cost;
    recruitHero(w, o.hero, CENTER, CENTER + 2.2, 1);
    w.s.tavernOffer = null;
    emit(w, { t: "hired", hero: o.hero });
    return true;
  }
  function victory(w) {
    w.s.phase = "victory";
    w.s.stats.nightsSurvived = Math.max(w.s.stats.nightsSurvived, w.s.night);
    setBuildMode(w, false);
    updateTimeScale(w);
    emit(w, { t: "phase", phase: "victory", night: w.s.night });
  }
  function defeat(w) {
    if (w.s.phase === "defeat") return;
    w.s.phase = "defeat";
    setBuildMode(w, false);
    updateTimeScale(w);
    emit(w, { t: "phase", phase: "defeat", night: w.s.night });
  }
  function continueEndless(w) {
    if (w.s.phase !== "victory") return;
    w.s.endless = true;
    startDawn(w);
  }
  function afterDawnPick(w) {
    w.s.night++;
    startDay(w);
  }
  function updatePhase(w, dt) {
    const s = w.s;
    if (s.hornT > 0) {
      s.hornT -= dt;
      if (s.hornT < 0) s.hornT = 0;
    }
    if (s.buffs.unlitPulseT > 0) {
      s.buffs.unlitPulseT -= dt;
      if (s.buffs.unlitPulseT <= 0) {
        s.buffs.unlitPulseT = 0;
        s.buffs.hearthLightMul = 1;
        w.lightDirty = true;
        w.r.snuffDirty = true;
      }
    }
    if (s.buffs.falseDawnT > 0) {
      s.buffs.falseDawnT -= dt;
      if (s.buffs.falseDawnT <= 0) {
        s.buffs.falseDawnT = 0;
        w.lightDirty = true;
      }
    }
    if (w.hearth.hp <= 0) {
      defeat(w);
      return;
    }
    if (s.phase === "day") {
      s.phaseT += dt;
      if (boonStacks(w, "rebirth")) w.hearth.hp = Math.min(w.hearth.maxHp, w.hearth.hp + BOON_FX.rebirth * dt);
      if (s.phaseT >= s.phaseDur) startDusk(w);
      return;
    }
    if (s.phase !== "night") return;
    s.phaseT += dt;
    s.nightT += dt;
    if (!w.r.enraged && s.nightT >= BALANCE.night.enrageAfter) {
      w.r.enraged = true;
      emit(w, { t: "enrage" });
    }
    if (boonStacks(w, "falsedawn") && !w.r.falseDawnUsed && w.hearth.hp < w.hearth.maxHp * BOON_FX.falseDawnAt) {
      w.r.falseDawnUsed = true;
      s.buffs.falseDawnT = BOON_FX.falseDawnSecs;
      for (const e of s.enemies) applyStun(e, BOON_FX.falseDawnStun);
      w.lightDirty = true;
      emit(w, { t: "falseDawn" });
    }
    if (s.enemiesLeft === 0 && w.r.spawnIdx >= w.r.spawn.length) {
      if (s.night === 10 && !s.endless) victory(w);
      else startDawn(w);
    }
  }
  function advanceTutorial(w, step) {
    w.s.tutorial = step;
    if (step < 0) w.meta.tutorialDone = true;
    emit(w, { t: "tutorial", step });
  }
  function updateTutorial(w) {
    const s = w.s;
    if (s.tutorial < 0) return;
    if (s.tutorial === 0 && w.r.tut.moved >= 3) advanceTutorial(w, 1);
    else if (s.tutorial === 1 && w.r.tutHarvested) advanceTutorial(w, 2);
    else if (s.tutorial === 2 && w.r.tut.walls >= 6) advanceTutorial(w, 3);
    else if (s.tutorial === 3 && s.buildings.some((b) => b.id === "tower_arrow" && b.synMask & 1)) advanceTutorial(w, 4);
  }

  // assets/scripts/core/sim/SpatialHash.ts
  var SpatialHash = class {
    constructor(size, cell = 2, cap = 1024) {
      __publicField(this, "cell");
      __publicField(this, "n");
      __publicField(this, "head");
      __publicField(this, "next");
      this.cell = cell;
      this.n = Math.ceil(size / cell);
      this.head = new Int32Array(this.n * this.n).fill(-1);
      this.next = new Int32Array(cap);
    }
    rebuild(items) {
      this.head.fill(-1);
      if (this.next.length < items.length) this.next = new Int32Array(items.length * 2);
      const n = this.n, c = this.cell;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        let cx = Math.floor(it.x / c), cy = Math.floor(it.y / c);
        if (cx < 0) cx = 0;
        else if (cx >= n) cx = n - 1;
        if (cy < 0) cy = 0;
        else if (cy >= n) cy = n - 1;
        const k = cy * n + cx;
        this.next[i] = this.head[k];
        this.head[k] = i;
      }
    }
    /** Calls fn(index) for every item whose cell intersects the query circle's bounding box (caller filters by distance). */
    query(x, y, r, fn) {
      const n = this.n, c = this.cell;
      const x0 = Math.max(0, Math.floor((x - r) / c)), x1 = Math.min(n - 1, Math.floor((x + r) / c));
      const y0 = Math.max(0, Math.floor((y - r) / c)), y1 = Math.min(n - 1, Math.floor((y + r) / c));
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        for (let i = this.head[cy * n + cx]; i !== -1; i = this.next[i]) fn(i);
      }
    }
  };

  // assets/scripts/core/sim/Game.ts
  var SAVE_VERSION = 1;
  function newWorld(seed, meta) {
    const size = BALANCE.mapSize;
    const gen = generateMap(seed);
    const N2 = size * size;
    const s = {
      seed,
      night: 1,
      phase: "day",
      phaseT: 0,
      phaseDur: 0,
      timeScale: 1,
      res: { wood: 0, stone: 0, gold: 0 },
      hornCharge: 0,
      hornT: 0,
      buildMode: false,
      map: { size, biome: gen.biome, variant: gen.variant, explored: new Uint8Array(N2), light: new Uint8Array(N2), lightAlpha: new Float32Array(N2).fill(1) },
      hearthUid: 0,
      hearthLevel: 1,
      heroes: [],
      reserve: [],
      enemies: [],
      buildings: [],
      projectiles: [],
      nodes: [],
      pois: [],
      boons: [],
      boonOffer: null,
      omens: [],
      enemiesLeft: 0,
      boss: null,
      stats: { kills: 0, built: 0, nightsSurvived: 0, bosses: 0, camps: 0, goldEarned: 0 },
      tutorial: meta.tutorialDone ? -1 : 0,
      allies: [],
      zones: [],
      boonSource: null,
      tavernOffer: null,
      buffs: { shrine: null, falseDawnT: 0, unlitPulseT: 0, hearthLightMul: 1 },
      endless: false,
      nightT: 0,
      squadMax: BALANCE.squad.max
    };
    const r = {
      version: 1,
      rng: { s: seed ^ 625341585 },
      uid: 0,
      stepN: 0,
      input: { x: 0, y: 0 },
      spawn: [],
      spawnIdx: 0,
      rootCut: [],
      fieldDirty: true,
      fieldLastStep: -999,
      snuffDirty: true,
      undo: [],
      session: 0,
      shrineUntil: 0,
      falseDawnUsed: false,
      hearthLowWarned: false,
      tut: { moved: 0, walls: 0, startX: CENTER, startY: CENTER + 2 },
      enraged: false,
      nightKills: 0,
      nightGold: 0,
      starter: meta.starterHero,
      bossSpawned: false,
      heading: { x: 0, y: 1 },
      tutHarvested: false,
      reserveLv: {},
      tavernDay: 0
    };
    const w = {
      s,
      meta,
      r,
      rng: new Rng(r.rng),
      size,
      terrain: new Uint8Array(N2),
      nodeAt: new Int32Array(N2),
      bldAt: new Int32Array(N2),
      trapAt: new Int32Array(N2),
      poiAt: new Int32Array(N2),
      staticLight: new Uint8Array(N2),
      lightDirty: true,
      wallMaskDirty: true,
      fields: { def: new FlowField(size), brk: new FlowField(size), snuff: new FlowField(size) },
      ehash: new SpatialHash(size, 2, 512),
      bmap: /* @__PURE__ */ new Map(),
      emap: /* @__PURE__ */ new Map(),
      events: [],
      hearth: null
    };
    const H = BALANCE.harvest;
    for (const g of gen.nodes) {
      const chops = g.kind === "pine" || g.kind === "oak" ? H.treeChops : g.kind === "ore" ? H.oreChops : H.rockChops[g.kind] ?? 0;
      const nd = { uid: newUid(w), kind: g.kind, x: g.x, y: g.y, hp: chops, maxHp: chops, regrowT: 0, shakeT: 0, orig: g.kind };
      s.nodes.push(nd);
    }
    for (const g of gen.pois) {
      const hp = g.kind === "cage" ? BALANCE.poi.cageHp : 1;
      const p = { uid: newUid(w), kind: g.kind, x: g.x, y: g.y, hp, maxHp: hp, active: true, data: g.kind === "rift" ? { index: g.index } : {}, guards: 0 };
      if (g.kind === "rift") p.active = (g.index ?? 0) < BALANCE.riftsActive(1);
      s.pois.push(p);
    }
    rebuildTerrain(w);
    return w;
  }
  function initRun(w) {
    const s = w.s, meta = w.meta;
    const T2 = TALENT_BY_ID;
    s.res = {
      wood: BALANCE.start.wood + T2.startWood.perLevel * (meta.talents.startWood ?? 0),
      stone: BALANCE.start.stone + T2.startStone.perLevel * (meta.talents.startStone ?? 0),
      gold: BALANCE.start.gold
    };
    const hearth = spawnBuilding(w, "hearth", HEARTH_X, HEARTH_Y, { wood: 0, stone: 0, gold: 0 });
    w.hearth = hearth;
    s.hearthUid = hearth.uid;
    s.hearthLevel = 1;
    for (let i = 0; i < BALANCE.start.freeBraziers; i++) spawnBuilding(w, "brazier", HEARTH_X + 4 + i, HEARTH_Y + 1, { wood: 0, stone: 0, gold: 0 });
    const lv = 1 + T2.heroLevel.perLevel * (meta.talents.heroLevel ?? 0);
    const starter = meta.unlockedHeroes.includes(meta.starterHero) ? meta.starterHero : "knight";
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
    recomputeFields(w, "all");
    updateWallMasks(w);
    w.events.length = 0;
    w.events.push({ t: "phase", phase: "day", night: 1 });
    if (s.tutorial === 0) w.events.push({ t: "tutorial", step: 0 });
  }
  function snapshot(w) {
    const { map, ...rest } = w.s;
    const ex = [];
    let cur = map.explored[0], run = 0;
    for (let i = 0; i < map.explored.length; i++) {
      if (map.explored[i] === cur) run++;
      else {
        ex.push(cur, run);
        cur = map.explored[i];
        run = 1;
      }
    }
    ex.push(cur, run);
    return JSON.stringify({ version: SAVE_VERSION, s: rest, explored: ex, r: w.r });
  }
  function restore(w, json) {
    let o;
    try {
      o = JSON.parse(json);
    } catch {
      return false;
    }
    if (!o || o.version !== SAVE_VERSION || !o.s || !o.r || o.s.seed !== w.s.seed) return false;
    if (!Array.isArray(o.s.buildings) || !Array.isArray(o.s.heroes) || !o.s.buildings.some((b) => b.id === "hearth")) return false;
    const map = w.s.map;
    Object.assign(w.s, o.s);
    w.s.map = map;
    let k = 0;
    for (let i = 0; i + 1 < o.explored.length; i += 2) for (let j = 0; j < o.explored[i + 1] && k < map.explored.length; j++) map.explored[k++] = o.explored[i];
    w.r = o.r;
    w.rng = new Rng(w.r.rng);
    w.emap.clear();
    for (const e of w.s.enemies) w.emap.set(e.uid, e);
    rebuildTerrain(w);
    rebuildBuildings(w);
    w.hearth = w.bmap.get(w.s.hearthUid);
    if (!w.hearth) return false;
    w.lightDirty = true;
    computeStaticLight(w);
    updateLight(w);
    smoothLightAlpha(w, 0, true);
    recomputeFields(w, "restore");
    w.r.fieldLastStep = o.r.fieldLastStep;
    updateWallMasks(w);
    updateTimeScale(w);
    w.events.length = 0;
    w.events.push({ t: "phase", phase: w.s.phase, night: w.s.night });
    if (w.s.boonOffer) w.events.push({ t: "boonOffer", source: w.s.boonSource ?? "dawn" });
    return true;
  }
  function isValidRun(json) {
    if (!json) return false;
    try {
      const o = JSON.parse(json);
      return !!o && o.version === SAVE_VERSION && typeof o.s?.seed === "number" && o.s.phase !== "defeat";
    } catch {
      return false;
    }
  }
  function fnv(h, v) {
    h ^= v & 65535;
    h = Math.imul(h, 16777619);
    h ^= v >>> 16 & 65535;
    h = Math.imul(h, 16777619);
    return h;
  }
  var PH = ["day", "dusk", "night", "dawn", "victory", "defeat"];
  function hashWorld(w) {
    const s = w.s;
    let h = 2166136261 | 0;
    const q = (v) => h = fnv(h, Math.round(v * 1e3) | 0);
    q(s.night);
    q(PH.indexOf(s.phase));
    q(s.phaseT);
    q(s.nightT);
    q(s.res.wood);
    q(s.res.stone);
    q(s.res.gold);
    q(s.hornCharge);
    q(w.r.rng.s);
    q(w.r.uid);
    q(w.r.stepN);
    for (const x of s.heroes) {
      q(x.uid);
      q(x.x);
      q(x.y);
      q(x.hp);
      q(x.level);
      q(x.xp);
      q(x.skillCd);
    }
    for (const x of s.enemies) {
      q(x.uid);
      q(x.x);
      q(x.y);
      q(x.hp);
    }
    for (const x of s.buildings) {
      q(x.uid);
      q(x.x);
      q(x.y);
      q(x.hp);
      q(x.level);
      q(x.charges);
    }
    for (const x of s.projectiles) {
      q(x.uid);
      q(x.x);
      q(x.y);
    }
    for (const x of s.allies) {
      q(x.uid);
      q(x.x);
      q(x.y);
      q(x.hp);
    }
    for (const x of s.nodes) {
      q(x.uid);
      q(x.hp);
    }
    for (const x of s.pois) {
      q(x.uid);
      q(x.hp);
      q(x.active ? 1 : 0);
    }
    for (const b of s.boons) {
      q(b.stacks);
      h = fnv(h, b.id.charCodeAt(0) * 31 + b.id.charCodeAt(1));
    }
    q(s.stats.kills);
    q(s.stats.built);
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function simStep(w) {
    const s = w.s;
    const dt = DT;
    w.r.stepN++;
    if (s.phase === "dusk" || s.phase === "dawn" || s.phase === "victory" || s.phase === "defeat") return;
    for (const h of s.heroes) {
      h.px = h.x;
      h.py = h.y;
    }
    for (const e of s.enemies) {
      e.px = e.x;
      e.py = e.y;
    }
    for (const a of s.allies) {
      a.px = a.x;
      a.py = a.y;
    }
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
    if (s.phase === "night") updateSpawner(w);
    updatePhase(w, dt);
    updateTutorial(w);
    if (w.lightDirty) computeStaticLight(w);
  }
  function applyCmd(w, c) {
    const s = w.s;
    const over = s.phase === "victory" || s.phase === "defeat";
    switch (c.t) {
      case "move": {
        const m = Math.hypot(c.dir.x, c.dir.y);
        w.r.input = m > 1 ? { x: c.dir.x / m, y: c.dir.y / m } : { x: c.dir.x, y: c.dir.y };
        break;
      }
      case "place":
        if (!over) place(w, c.id, c.x, c.y);
        break;
      case "paint":
        if (!over) paint(w, c.id, c.cells);
        break;
      case "upgrade":
        if (!over) upgrade(w, c.uid);
        break;
      case "repair":
        if (!over) repair(w, c.uid);
        break;
      case "sell":
        if (!over) sell(w, c.uid);
        break;
      case "undo":
        undo(w);
        break;
      case "buildMode":
        if (!over && s.phase !== "dawn") setBuildMode(w, c.on);
        break;
      case "horn":
        if ((s.phase === "night" || s.phase === "day") && s.hornCharge >= BALANCE.horn.charge) {
          s.hornCharge = 0;
          s.hornT = w.s.boons.some((b) => b.id === "horn") ? BOON_FX.hornSecs : BALANCE.horn.seconds;
          w.events.push({ t: "horn" });
        }
        break;
      case "callNight":
        callNight(w);
        break;
      case "startNight":
        startNight(w);
        break;
      case "pickBoon": {
        const src = s.boonSource;
        if (!s.boonOffer && s.phase === "dawn") {
          afterDawnPick(w);
          break;
        }
        if (!pickBoon(w, c.index)) break;
        s.boonSource = null;
        if (src === "dawn" && s.phase === "dawn") afterDawnPick(w);
        break;
      }
      case "swapHero": {
        const rid = s.reserve[c.reserveIndex];
        const h = s.heroes[c.squadIndex];
        if (!rid || !h || s.phase === "night") break;
        const nh = createHero(w, rid, h.x, h.y, w.r.reserveLv[rid] ?? 1);
        nh.leader = h.leader;
        w.r.reserveLv[h.id] = h.level;
        s.reserve[c.reserveIndex] = h.id;
        s.heroes[c.squadIndex] = nh;
        break;
      }
      case "hire":
        hireHero(w, c.index);
        break;
      case "endless":
        continueEndless(w);
        break;
      case "skipTutorial":
        if (s.tutorial >= 0) advanceTutorial(w, -1);
        break;
    }
  }
  var GameImpl = class {
    constructor(w) {
      __publicField(this, "w");
      __publicField(this, "acc", 0);
      this.w = w;
    }
    get state() {
      return this.w.s;
    }
    get meta() {
      return this.w.meta;
    }
    update(dt) {
      const d = Math.max(0, Math.min(dt, 0.25));
      smoothLightAlpha(this.w, d);
      this.acc += d * this.w.s.timeScale;
      let n = 0;
      while (this.acc >= DT && n < 8) {
        simStep(this.w);
        this.acc -= DT;
        n++;
      }
      if (n >= 8) this.acc = 0;
    }
    step() {
      simStep(this.w);
      smoothLightAlpha(this.w, DT);
    }
    cmd(c) {
      applyCmd(this.w, c);
    }
    drainEvents() {
      const e = this.w.events;
      this.w.events = [];
      return e;
    }
    canPlace(id, x, y) {
      return canPlace(this.w, id, x, y);
    }
    buildingCost(id, level = 1) {
      return buildingCost(this.w, id, level);
    }
    alpha() {
      return Math.max(0, Math.min(1, this.acc / DT));
    }
    hash() {
      return hashWorld(this.w);
    }
    saveRun() {
      return snapshot(this.w);
    }
    emberEarned() {
      return emberFor(this.w.s.stats, this.w.s.phase === "victory" || this.w.s.endless);
    }
  };
  function createGame(opts) {
    let seed = opts.seed | 0;
    if (opts.saved) {
      try {
        const o = JSON.parse(opts.saved);
        if (o && typeof o.s?.seed === "number") seed = o.s.seed | 0;
      } catch {
      }
    }
    const w = newWorld(seed, opts.meta);
    if (opts.saved && restore(w, opts.saved)) return new GameImpl(w);
    const fresh = opts.saved ? newWorld(opts.seed | 0, opts.meta) : w;
    initRun(fresh);
    return new GameImpl(fresh);
  }
  function worldOf(g) {
    return g.w;
  }

  // assets/scripts/game/logic/edges.ts
  var PAIRS = ["grass_dirt", "grass_sand", "sand_water"];
  function materialOf(b) {
    switch (b) {
      case "water":
        return "water";
      case "shore":
        return "sand";
      case "quarry":
        return "dirt";
      case "ruins":
        return "ruins";
      default:
        return "grass";
    }
  }
  function overlayPair(upper, lower) {
    const lo = lower === "ruins" ? "dirt" : lower;
    const key = `${upper}_${lo}`;
    return PAIRS.includes(key) ? key : null;
  }
  function tileSprite(b, variant, waterFrame = 0) {
    switch (b) {
      case "water":
        return `tile_water_${waterFrame & 1}`;
      case "shore":
        return `tile_sand_${variant % 3}`;
      case "quarry":
        return `tile_dirt_${variant % 3}`;
      case "ruins":
        return `tile_ruins_${variant % 3}`;
      case "forest":
        return `tile_grass_dark_${variant % 3}`;
      default: {
        const v = variant % 8;
        return v >= 6 ? `tile_grass_flower_${v - 6}` : `tile_grass_${v % 4}`;
      }
    }
  }
  var N = 0;
  var E = 1;
  var S = 2;
  var W = 3;
  function edgeOverlays(x, y, at) {
    const me = at(x, y);
    const out = [];
    const uppers = ["sand", "grass"];
    for (const up of uppers) {
      if (up === me) continue;
      const pair = overlayPair(up, me);
      if (!pair) continue;
      const isUp = (dx, dy) => {
        const m = at(x + dx, y + dy);
        return m === up || up === "sand" && m === "grass" && me === "water";
      };
      const o = [isUp(0, -1), isUp(1, 0), isUp(0, 1), isUp(-1, 0)];
      const corners = [
        ["ne", N, E, 1, -1],
        ["se", S, E, 1, 1],
        ["sw", S, W, -1, 1],
        ["nw", N, W, -1, -1]
      ];
      const covered = [false, false, false, false];
      for (const [c, a, b] of corners) if (o[a] && o[b]) {
        out.push(`edge_${pair}_i${c}`);
        covered[a] = covered[b] = true;
      }
      const sides = ["n", "e", "s", "w"];
      for (let k = 0; k < 4; k++) if (o[k] && !covered[k]) out.push(`edge_${pair}_${sides[k]}`);
      for (const [c, a, b, dx, dy] of corners) if (!o[a] && !o[b] && isUp(dx, dy)) out.push(`edge_${pair}_${c}`);
    }
    return out;
  }

  // assets/scripts/game/logic/light.ts
  var TEXELS_PER_TILE = 4;
  var DARK_RGB = [27, 27, 47];
  var WARM_RGB = [247, 169, 59];
  var WARM_ALPHA = 0.08;
  var FOG_ALPHA = 0.97;
  function hash22(x, y) {
    let h = x * 374761393 + y * 668265263 | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  }
  function sampleAlpha(inp, tx, ty, stepped = false) {
    const n = inp.size;
    const fx = tx - 0.5, fy = ty - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const ux = fx - x0, uy = fy - y0;
    const get = (x, y) => {
      if (x < 0 || y < 0 || x >= n || y >= n) return inp.night ? 0.85 : 0;
      const i = y * n + x;
      return inp.explored[i] ? inp.lightAlpha[i] : FOG_ALPHA;
    };
    const c00 = get(x0, y0), c10 = get(x0 + 1, y0), c01 = get(x0, y0 + 1), c11 = get(x0 + 1, y0 + 1);
    const a = c00 * (1 - ux) + c10 * ux;
    const b = c01 * (1 - ux) + c11 * ux;
    const v = a * (1 - uy) + b * uy;
    if (!stepped) return v;
    let best = c00;
    for (const c of [c10, c01, c11]) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
    return best;
  }
  function fillLight(buf, inp, region) {
    const n = inp.size, T2 = TEXELS_PER_TILE, W2 = n * T2;
    const tx0 = region ? Math.max(0, region.x0 * T2) : 0, tx1 = region ? Math.min(W2 - 1, (region.x1 + 1) * T2 - 1) : W2 - 1;
    const ty0 = region ? Math.max(0, region.y0 * T2) : 0, ty1 = region ? Math.min(W2 - 1, (region.y1 + 1) * T2 - 1) : W2 - 1;
    const fl = (u, v) => 0.25 * (0.6 * Math.sin(inp.t * 6.1 + u * 0.9) + 0.4 * Math.sin(inp.t * 9.7 + v * 1.3 + hash22(u | 0, v | 0)));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const o = (ty * W2 + tx) * 4;
        const cx = (tx + 0.5) / T2, cy = (ty + 0.5) / T2;
        const ti = Math.floor(cy) * n + Math.floor(cx);
        let a;
        if (!inp.explored[ti]) a = FOG_ALPHA;
        else {
          const j = inp.night ? fl(cx, cy) : 0;
          a = sampleAlpha(inp, cx + j, cy - j * 0.5, true);
        }
        if (inp.night && a < WARM_ALPHA && inp.explored[ti]) {
          buf[o] = WARM_RGB[0];
          buf[o + 1] = WARM_RGB[1];
          buf[o + 2] = WARM_RGB[2];
          buf[o + 3] = Math.round(WARM_ALPHA * 255);
        } else {
          buf[o] = DARK_RGB[0];
          buf[o + 1] = DARK_RGB[1];
          buf[o + 2] = DARK_RGB[2];
          buf[o + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
        }
      }
    }
  }

  // assets/scripts/game/logic/minimap.ts
  var MINI_COLORS = {
    water: [42, 74, 138],
    shore: [185, 138, 86],
    meadow: [76, 154, 74],
    forest: [47, 107, 58],
    quarry: [138, 90, 60],
    ruins: [115, 121, 140],
    fog: [27, 27, 47],
    lit: [247, 169, 59],
    building: [214, 218, 227],
    hearth: [255, 226, 122],
    rift: [208, 139, 232],
    hero: [246, 242, 230],
    leader: [255, 226, 122],
    enemy: [209, 75, 75],
    poi: [242, 198, 154]
  };
  function put(buf, size, x, y, c, a = 255) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= size || iy >= size) return;
    const o = (iy * size + ix) * 4;
    buf[o] = c[0];
    buf[o + 1] = c[1];
    buf[o + 2] = c[2];
    buf[o + 3] = a;
  }
  function fillMinimap(buf, m) {
    const n = m.size;
    for (let i = 0; i < n * n; i++) {
      const o = i * 4;
      let c;
      if (!m.explored[i]) c = MINI_COLORS.fog;
      else {
        const b = m.biome[i];
        c = MINI_COLORS[b] ?? MINI_COLORS.meadow;
        if (m.light[i] === 2 && b !== "water") {
          c = [Math.min(255, c[0] * 3 + MINI_COLORS.lit[0] >> 2), Math.min(255, c[1] * 3 + MINI_COLORS.lit[1] >> 2), Math.min(255, c[2] * 3 + MINI_COLORS.lit[2] >> 2)];
        } else if (m.night && m.light[i] === 0) {
          c = [c[0] >> 1, c[1] >> 1, c[2] >> 1];
        }
      }
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
      buf[o + 3] = 255;
    }
    for (const p of m.pois) if (m.explored[Math.floor(p.y) * n + Math.floor(p.x)]) put(buf, n, p.x, p.y, MINI_COLORS.poi);
    for (const b of m.buildings) for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) put(buf, n, b.x + x, b.y + y, b.id === "hearth" ? MINI_COLORS.hearth : MINI_COLORS.building);
    for (const r of m.rifts) if (r.active) {
      put(buf, n, r.x, r.y, MINI_COLORS.rift);
      put(buf, n, r.x + 1, r.y, MINI_COLORS.rift);
      put(buf, n, r.x, r.y + 1, MINI_COLORS.rift);
      put(buf, n, r.x + 1, r.y + 1, MINI_COLORS.rift);
    }
    if (m.night) for (const e of m.enemies) put(buf, n, e.x, e.y, MINI_COLORS.enemy);
    for (const h of m.heroes) put(buf, n, h.x, h.y, h.leader ? MINI_COLORS.leader : MINI_COLORS.hero);
  }

  // assets/scripts/game/logic/gestures.ts
  function classifyDrag(dx, dy) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const t2 = Math.tan(Math.PI / 8);
    if (ay <= ax * t2) return "h";
    if (ax <= ay * t2) return "v";
    return "diag";
  }
  function bresenham4(x0, y0, x1, y1) {
    const out = [];
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = 0, x = x0, y = y0;
    out.push({ x, y });
    for (let i = 0; i < dx + dy; i++) {
      const ex = e + dy, ey = e - dx;
      if (Math.abs(ex) < Math.abs(ey)) {
        x += sx;
        e = ex;
      } else {
        y += sy;
        e = ey;
      }
      out.push({ x, y });
    }
    return out;
  }
  function paintCells(start, cur, mode) {
    if (mode === "h") {
      const out = [];
      const s = cur.x >= start.x ? 1 : -1;
      for (let x = start.x; ; x += s) {
        out.push({ x, y: start.y });
        if (x === cur.x) break;
      }
      return out;
    }
    if (mode === "v") {
      const out = [];
      const s = cur.y >= start.y ? 1 : -1;
      for (let y = start.y; ; y += s) {
        out.push({ x: start.x, y });
        if (y === cur.y) break;
      }
      return out;
    }
    return bresenham4(start.x, start.y, cur.x, cur.y);
  }
  function footprintOrigin(tx, ty, w, h) {
    return { x: Math.round(tx - w / 2), y: Math.round(ty - h / 2) };
  }
  function paintPlan(cells, valid, cost, have) {
    const total = { wood: 0, stone: 0, gold: 0 };
    const ok = [];
    let count = 0;
    for (const c of cells) {
      let good = valid(c);
      if (good) {
        const nw = total.wood + cost.wood, ns = total.stone + cost.stone, ng = total.gold + cost.gold;
        if (nw > have.wood || ns > have.stone || ng > have.gold) good = false;
        else {
          total.wood = nw;
          total.stone = ns;
          total.gold = ng;
          count++;
        }
      }
      ok.push(good);
    }
    return { ok, total, count };
  }
  function ringPoints(cx, cy, r, spacing = 0.5) {
    const n = Math.max(8, Math.round(2 * Math.PI * r / spacing));
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return out;
  }
  function dottedLine(x0, y0, x1, y1, spacing = 0.4) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(d / spacing));
    const out = [];
    for (let i = 0; i <= n; i++) out.push({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n });
    return out;
  }

  // assets/scripts/game/logic/camera.ts
  var LOOK_AHEAD_TILES = 1.5;
  var SMOOTH_SECONDS = 0.15;
  function basePixelScale(deviceWidthPx) {
    return Math.max(2, Math.round(deviceWidthPx / 180));
  }
  function zoomSteps(n) {
    return [Math.max(1, n - 1), n, n + 1];
  }
  function smoothFactor(dt, tau = SMOOTH_SECONDS) {
    if (tau <= 0) return 1;
    return 1 - Math.exp(-dt / tau);
  }
  function lookAhead(dir, tiles = LOOK_AHEAD_TILES) {
    const m = Math.hypot(dir.x, dir.y);
    if (m < 1e-4) return { x: 0, y: 0 };
    const k = Math.min(1, m) / m;
    return { x: dir.x * k * tiles, y: dir.y * k * tiles };
  }
  function clampCamera(cam, mapSize, viewTilesW, viewTilesH, margin = 2) {
    const clampAxis = (c, half) => {
      const lo = -margin + half, hi = mapSize + margin - half;
      return lo > hi ? mapSize / 2 : Math.min(hi, Math.max(lo, c));
    };
    return { x: clampAxis(cam.x, viewTilesW / 2), y: clampAxis(cam.y, viewTilesH / 2) };
  }
  function pinchStep(startIndex, ratio) {
    let i = startIndex;
    if (ratio > 1.35) i = startIndex + 1;
    if (ratio > 1.9) i = startIndex + 2;
    if (ratio < 0.74) i = startIndex - 1;
    if (ratio < 0.52) i = startIndex - 2;
    return Math.max(0, Math.min(2, i));
  }

  // assets/scripts/game/logic/sprites.ts
  var ANIM_FPS = { idle: 3, walk: 8, attack: 10, building: 6, fx: 12, water: 1.5, rift: 6 };
  function animFrame(t2, fps, count, loop = true) {
    if (count <= 1) return 0;
    const f = Math.floor(Math.max(0, t2) * fps);
    return loop ? f % count : Math.min(count - 1, f);
  }
  function heroSprite(h) {
    switch (h.anim) {
      case "down":
        return `hero_${h.id}_down`;
      case "attack":
        return `hero_${h.id}_attack_${animFrame(h.animT, ANIM_FPS.attack, 3, false)}`;
      case "move":
        return `hero_${h.id}_walk_${animFrame(h.animT, ANIM_FPS.walk, 4)}`;
      default:
        return `hero_${h.id}_idle_${animFrame(h.animT, ANIM_FPS.idle, 2)}`;
    }
  }
  function enemySprite(e) {
    const id = e.id;
    if (id === "mossback") {
      if (e.anim === "idle" || e.anim === "attack") return `boss_mossback_shell_${animFrame(e.animT, ANIM_FPS.idle * 2, 2)}`;
      return `boss_mossback_walk_${animFrame(e.animT, ANIM_FPS.walk * 0.6, 4)}`;
    }
    if (id === "unlit") {
      if (e.anim === "attack") return `boss_unlit_cast_${animFrame(e.animT, ANIM_FPS.attack * 0.6, 2, false)}`;
      return `boss_unlit_float_${animFrame(e.animT, ANIM_FPS.walk * 0.6, 4)}`;
    }
    if (id === "turret") return "turret_mini";
    if (e.anim === "attack") return `enemy_${id}_attack_${animFrame(e.animT, ANIM_FPS.attack * 0.6, 2, false)}`;
    const fps = e.anim === "move" ? ANIM_FPS.walk : ANIM_FPS.idle;
    return `enemy_${id}_move_${animFrame(e.animT, fps, 4)}`;
  }
  function isBoss(id) {
    return id === "mossback" || id === "unlit";
  }
  function gateOrientation(mask) {
    const ew = mask & 2 || mask & 8, ns = mask & 1 || mask & 4;
    if (ns && !ew) return "v";
    return "h";
  }
  function dir8(angleCore) {
    const screen = -angleCore;
    const i = Math.round(screen / (Math.PI / 4));
    return (i % 8 + 8) % 8;
  }
  function buildingSprites(b, t2) {
    const lv = b.level;
    const f4 = animFrame(t2, ANIM_FPS.building, 4);
    switch (b.id) {
      case "hearth":
        return { base: `bld_hearth_l${lv}_${f4}` };
      case "wall_wood":
        return { base: `bld_wall_wood_${b.wallMask & 15}` };
      case "wall_stone":
        return { base: `bld_wall_stone_${b.wallMask & 15}` };
      case "gate":
        return { base: `bld_gate_${gateOrientation(b.wallMask)}_${b.open ? "open" : "closed"}` };
      case "brazier": {
        const l = Math.min(2, lv);
        return { base: b.lit ? `bld_brazier_l${l}_${f4}` : `bld_brazier_l${l}_off` };
      }
      case "tower_ballista":
        return { base: `bld_tower_ballista_l${lv}_base`, head: `bld_ballista_head_${dir8(b.aimAngle)}` };
      case "tower_frost":
      case "tower_spark":
        return { base: `bld_${b.id}_l${lv}_${f4}` };
      case "trap_spikes":
        return { base: `bld_trap_spikes_l${Math.min(2, lv)}_${b.charges > 0 ? "up" : "down"}` };
      case "trap_tar":
        return { base: b.lit ? `bld_trap_tar_burning_${animFrame(t2, ANIM_FPS.building * 1.5, 3)}` : "bld_trap_tar" };
      case "tavern":
        return { base: "bld_tavern_l1" };
      default:
        return { base: `bld_${b.id}_l${lv}` };
    }
  }
  function isFloorBuilding(id) {
    return id === "trap_spikes" || id === "trap_tar";
  }
  var VARIANTS = { pine: 2, oak: 2, bush: 2, ore: 2 };
  function nodeSprite(n) {
    if (n.hp <= 0) {
      if (n.kind === "pine" || n.kind === "oak" || n.kind === "stump") return "prop_stump";
      return null;
    }
    const v = VARIANTS[n.kind];
    return v ? `prop_${n.kind}_${n.uid % v}` : `prop_${n.kind}`;
  }
  function nodeShadow(kind) {
    switch (kind) {
      case "pine":
      case "oak":
        return "prop_shadow_m";
      case "rock_l":
        return "prop_shadow_l";
      case "rock_m":
      case "ore":
        return "prop_shadow_s";
      default:
        return null;
    }
  }
  function poiSprite(p, t2) {
    switch (p.kind) {
      case "camp":
        return p.active ? "prop_camp" : null;
      case "cage":
        return p.active ? "prop_cage" : "prop_cage_broken";
      case "shrine":
        return p.active ? "prop_shrine" : "prop_shrine_used";
      case "rift":
        return `prop_rift_${animFrame(t2, ANIM_FPS.rift * (p.active ? 1 : 0.4), 4)}`;
      case "root":
        return p.active && p.hp > 0 ? "prop_root" : null;
      case "chest":
        return p.active ? "prop_chest_closed" : "prop_chest_open";
    }
    return null;
  }
  function projectileSprite(p, t2) {
    if (p.kind === "fireball") return `proj_fireball_${animFrame(t2, ANIM_FPS.fx, 2)}`;
    if (p.kind === "spark") return `proj_spark_seg_${animFrame(t2, ANIM_FPS.fx * 2, 2)}`;
    return `proj_${p.kind}`;
  }
  function unitShadow(id) {
    if (isBoss(id)) return "prop_shadow_l";
    if (id === "brute") return "prop_shadow_m";
    return "prop_shadow_s";
  }
  function lerpPos(u, alpha) {
    const a = Math.max(0, Math.min(1, alpha));
    if (Math.abs(u.x - u.px) + Math.abs(u.y - u.py) > 3) return { x: u.x, y: u.y };
    return { x: u.px + (u.x - u.px) * a, y: u.py + (u.y - u.py) * a };
  }
  function statusIcons(s, t2) {
    const out = [];
    if (s.burn > 0) out.push(`fx_burn_${animFrame(t2, ANIM_FPS.fx, 3)}`);
    if (s.slow > 0) out.push(`fx_snow_${animFrame(t2, ANIM_FPS.idle * 2, 2)}`);
    if (s.stun > 0) out.push(`fx_stun_${animFrame(t2, ANIM_FPS.idle * 2, 2)}`);
    return out;
  }
  function crackOverlay(hp, maxHp) {
    if (maxHp <= 0) return null;
    const r = hp / maxHp;
    if (r < 0.33) return "bld_crack_2";
    if (r < 0.66) return "bld_crack_1";
    return null;
  }

  // assets/scripts/game/logic/text.ts
  var FONT7_CHARS = new Set([..."0123456789+-!"].map((c) => c.charCodeAt(0)));
  function toAscii(s) {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\x20-\x7e\n]/g, "?");
  }
  function fmtNum(n) {
    const v = Math.floor(n);
    if (Math.abs(v) >= 1e4) return `${Math.round(v / 1e3)}k`;
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
    return String(v);
  }

  // tools/preview/src/font.ts
  var COL = {
    white: "#f6f2e6",
    ink: "#1b1b2f",
    gold: "#ffe27a",
    fire: "#f7a93b",
    red: "#d14b4b",
    green: "#7cc45a",
    ice: "#7fd0f0",
    grey: "#a3a9b8",
    wood: "#e2c48a",
    stone: "#d6dae3",
    purple: "#d08be8",
    dim: "#73798c",
    pink: "#e86a92",
    brown: "#5a3a2e",
    plum: "#4b2a6b",
    wine: "#8c2f39"
  };
  var FONT7 = new Set([..."0123456789+-!"].map((c) => c.charCodeAt(0)));
  var BitmapFont = class {
    constructor(atlas) {
      this.atlas = atlas;
      this.lineHeight = { 5: 10, 7: 12 };
    }
    glyph(code, size) {
      if (size === 7 && FONT7.has(code)) return `font7_${code}`;
      if (code < 32 || code > 126) code = 63;
      return `font5_${code}`;
    }
    adv(code, size) {
      const g = this.glyph(code, size);
      const f = g ? this.atlas.frames[g] : void 0;
      if (f) return f.advance ?? f.w - 1;
      return code === 32 ? 4 : size === 7 ? 8 : 6;
    }
    lineH(size = 5) {
      return this.lineHeight[size];
    }
    width(text, size = 5) {
      text = toAscii(text);
      let w = 0;
      for (let i = 0; i < text.length; i++) w += this.adv(text.charCodeAt(i), size);
      return Math.max(0, w - 1);
    }
    /** Greedy word wrap to maxW art px. */
    wrap(text, maxW, size = 5) {
      const out = [];
      for (const para of toAscii(text).split("\n")) {
        let line = "";
        for (const word of para.split(" ")) {
          const t2 = line ? line + " " + word : word;
          if (this.width(t2, size) <= maxW || !line) line = t2;
          else {
            out.push(line);
            line = word;
          }
        }
        out.push(line);
      }
      return out;
    }
    /** (x, y) = top-left of the ink box of the first glyph (after alignment). */
    draw(ctx, text, x, y, o = {}) {
      const size = o.size ?? 5;
      text = toAscii(text);
      const w = this.width(text, size);
      let cx = Math.round(o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x);
      y = Math.round(y);
      const color = o.color && o.color !== COL.white ? o.color : void 0;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code !== 32) {
          const g = this.glyph(code, size);
          this.atlas.draw(ctx, g, cx, size === 7 && !FONT7.has(code) ? y + 1 : y, { recolor: color, noOutline: o.shadow === null, alpha: o.alpha });
        }
        cx += this.adv(code, size);
      }
      return w;
    }
    drawLines(ctx, lines, x, y, o = {}) {
      const lh = this.lineH(o.size ?? 5);
      lines.forEach((l, i) => this.draw(ctx, l, x, y + i * lh, o));
      return lines.length * lh;
    }
  };

  // tools/preview/src/fx.ts
  var Fx = class {
    constructor(atlas, font) {
      this.atlas = atlas;
      this.font = font;
      this.sprites = [];
      this.debris = [];
      this.nums = [];
      this.flyers = [];
      this.banners = [];
      this.flash = /* @__PURE__ */ new Map();
      // uid -> seconds left (white flash)
      this.bounce = /* @__PURE__ */ new Map();
      // building uid -> seconds since placed
      this.shakeT = 0;
      this.shakeAmp = 0;
      this.hitStop = 0;
      this.fade = 0;
      // screen fade-in (1 -> 0)
      this.hudPulse = {};
    }
    anim(base, x, y, fps = 14, loop = 1, extra = {}) {
      const n = Math.max(1, this.atlas.count(base));
      if (!this.atlas.count(base)) this.atlas.get(`${base}_0`);
      if (this.sprites.length > 400) this.sprites.shift();
      this.sprites.push({ base, n, fps, x, y, t: 0, loop, ...extra });
    }
    number(text, x, y, color = COL.white, size = 7) {
      if (this.nums.length > 120) this.nums.shift();
      this.nums.push({ text, color, size, x, y, t: 0, life: 0.8, dx: (Math.random() - 0.5) * 8 });
    }
    shake(amp, dur = 0.25) {
      this.shakeAmp = Math.min(4, Math.max(this.shakeAmp, amp));
      this.shakeT = Math.max(this.shakeT, dur);
    }
    stop(sec) {
      this.hitStop = Math.max(this.hitStop, sec);
    }
    hit(uid) {
      this.flash.set(uid, 0.08);
    }
    banner(text, sub, color = COL.white, life = 2.2) {
      this.banners.push({ text, sub, t: 0, life, color });
    }
    /** Breaks a sprite into 4–6 shards of its own pixels. */
    shatter(name, x, y, count = 5) {
      const f = this.atlas.frames[name];
      if (!f) return;
      for (let i = 0; i < count; i++) {
        const w = 3 + (Math.random() * 3 | 0), h = 3 + (Math.random() * 3 | 0);
        const sx = Math.random() * Math.max(1, f.w - w) | 0, sy = Math.random() * Math.max(1, f.h - h) | 0;
        const a = Math.random() * Math.PI * 2, sp = 15 + Math.random() * 30;
        if (this.debris.length > 500) this.debris.shift();
        this.debris.push({ name, sx, sy, w, h, x: x - f.ax + sx, y: y - f.ay + sy, z: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 40 + Math.random() * 40, t: 0, life: 0.6 + Math.random() * 0.3 });
      }
    }
    fly(icon, x0, y0, x1, y1, delay = 0, onArrive) {
      if (this.flyers.length > 80) return;
      this.flyers.push({ icon, x0, y0, x1, y1, t: 0, dur: 0.55 + Math.random() * 0.2, delay, onArrive, arc: 20 + Math.random() * 20 });
    }
    pulse(key) {
      this.hudPulse[key] = 0.25;
    }
    update(dt) {
      for (const s of this.sprites) s.t += dt;
      this.sprites = this.sprites.filter((s) => s.loop <= 0 || s.t * s.fps < s.n * s.loop);
      for (const d of this.debris) {
        d.t += dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vz -= 220 * dt;
        d.z = Math.max(0, d.z + d.vz * dt);
        if (d.z === 0) {
          d.vx *= 0.8;
          d.vy *= 0.8;
        }
      }
      this.debris = this.debris.filter((d) => d.t < d.life);
      for (const n of this.nums) n.t += dt;
      this.nums = this.nums.filter((n) => n.t < n.life);
      for (const f of this.flyers) {
        f.t += dt;
        if (f.t - f.delay >= f.dur && f.onArrive) {
          f.onArrive();
          f.onArrive = void 0;
        }
      }
      this.flyers = this.flyers.filter((f) => f.t - f.delay < f.dur);
      for (const b of this.banners) b.t += dt;
      this.banners = this.banners.filter((b) => b.t < b.life);
      for (const [k, v] of this.flash) {
        if (v - dt <= 0) this.flash.delete(k);
        else this.flash.set(k, v - dt);
      }
      for (const [k, v] of this.bounce) {
        if (v + dt > 0.4) this.bounce.delete(k);
        else this.bounce.set(k, v + dt);
      }
      this.shakeT = Math.max(0, this.shakeT - dt);
      if (!this.shakeT) this.shakeAmp = 0;
      this.fade = Math.max(0, this.fade - dt * 2.5);
      for (const k in this.hudPulse) this.hudPulse[k] = Math.max(0, this.hudPulse[k] - dt);
    }
    shakeOffset(t2) {
      if (!this.shakeT) return [0, 0];
      const a = this.shakeAmp * Math.min(1, this.shakeT / 0.15);
      return [Math.round(Math.sin(t2 * 91) * a), Math.round(Math.cos(t2 * 77) * a)];
    }
    bounceScale(uid) {
      const t2 = this.bounce.get(uid);
      if (t2 === void 0) return 1;
      return 1 + 0.2 * Math.max(0, 1 - t2 / 0.25);
    }
    /** World-space FX (camera transform already applied). */
    drawWorld(ctx, above) {
      for (const s of this.sprites) {
        if (!!s.above !== above) continue;
        let i = Math.floor(s.t * s.fps);
        if (s.loop <= 0) i %= s.n;
        else i = Math.min(s.n - 1, i % s.n);
        const p = s.follow ? s.follow() : null;
        if (s.follow && !p) continue;
        const x = p ? p.x : s.x, y = p ? p.y : s.y;
        this.atlas.draw(ctx, s.n > 1 || this.atlas.has(`${s.base}_0`) ? `${s.base}_${i}` : s.base, x, y, { flip: s.flip, alpha: s.alpha });
      }
      if (!above) return;
      for (const d of this.debris) this.atlas.drawPart(ctx, d.name, d.sx, d.sy, d.w, d.h, d.x, d.y - d.z, d.t > d.life - 0.2 ? (d.life - d.t) / 0.2 : 1);
    }
    drawNumbers(ctx) {
      for (const n of this.nums) {
        const k = n.t / n.life;
        const rise = n.t < 0.15 ? n.t / 0.15 * 10 : 10 + (n.t - 0.15) * 6;
        this.font.draw(ctx, n.text, n.x + n.dx * k, n.y - rise, { color: n.color, size: n.size, align: "center", alpha: k > 0.6 ? (1 - k) / 0.4 : 1 });
      }
    }
    /** Screen-space flyers: curved path to the HUD. */
    drawFlyers(ctx) {
      for (const f of this.flyers) {
        const u = Math.max(0, (f.t - f.delay) / f.dur);
        if (f.t < f.delay) continue;
        const e = u * u * (3 - 2 * u);
        const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * u) * f.arc;
        this.atlas.drawC(ctx, f.icon, x, y);
      }
    }
  };

  // tools/preview/src/info.ts
  function buildingIcon(id, level = 1) {
    switch (id) {
      case "hearth":
        return `bld_hearth_l${level}_0`;
      case "wall_wood":
        return "bld_wall_wood_0";
      case "wall_stone":
        return "bld_wall_stone_0";
      case "gate":
        return "bld_gate_h_closed";
      case "brazier":
        return `bld_brazier_l${Math.min(2, level)}_0`;
      case "tower_ballista":
        return `bld_tower_ballista_l${level}_base`;
      case "tower_frost":
        return `bld_tower_frost_l${level}_0`;
      case "tower_spark":
        return `bld_tower_spark_l${level}_0`;
      case "trap_spikes":
        return `bld_trap_spikes_l${Math.min(2, level)}_up`;
      case "trap_tar":
        return "bld_trap_tar";
      case "tavern":
        return "bld_tavern_l1";
      default:
        return `bld_${id}_l${level}`;
    }
  }

  // tools/preview/src/light.ts
  var LightOverlay = class {
    constructor() {
      this.cv = document.createElement("canvas");
      this.g = this.cv.getContext("2d");
      this.img = null;
    }
    /** camX/camY = world art px at screen (0,0). */
    draw(ctx, s, camX, camY, t2) {
      const n = s.map.size, W2 = n * TEXELS_PER_TILE;
      if (this.cv.width !== W2) {
        this.cv.width = W2;
        this.cv.height = W2;
        this.img = null;
      }
      if (!this.img) this.img = this.g.createImageData(W2, W2);
      const buf = new Uint8Array(this.img.data.buffer);
      fillLight(buf, { size: n, lightAlpha: s.map.lightAlpha, explored: s.map.explored, night: s.phase === "night", t: t2 });
      this.g.putImageData(this.img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const k = 16 / TEXELS_PER_TILE;
      ctx.drawImage(this.cv, -camX, -camY, W2 * k, W2 * k);
    }
  };

  // tools/preview/src/world.ts
  var T = 16;
  var _WorldRenderer = class _WorldRenderer {
    constructor(atlas, fx) {
      this.atlas = atlas;
      this.fx = fx;
      this.light = new LightOverlay();
      this.edgeCache = null;
      /** uids of buildings hit recently (edge arrows) */
      this.attacked = /* @__PURE__ */ new Map();
    }
    // ── ground: tile + biome-edge overlays via the client's pure logic (game/logic/edges.ts) ──
    buildEdges(s) {
      const { size, biome } = s.map;
      const at = (x, y) => x < 0 || y < 0 || x >= size || y >= size ? "water" : materialOf(biome[y * size + x]);
      const pieces = new Array(size * size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) pieces[y * size + x] = edgeOverlays(x, y, at);
      this.edgeCache = { seed: s.seed, size, pieces };
    }
    drawGround(ctx, s, cam, t2) {
      const { size, biome, variant } = s.map;
      if (!this.edgeCache || this.edgeCache.seed !== s.seed || this.edgeCache.size !== size) this.buildEdges(s);
      const X0 = Math.floor(cam.x / T), Y0 = Math.floor(cam.y / T);
      const X1 = Math.ceil((cam.x + cam.w) / T), Y1 = Math.ceil((cam.y + cam.h) / T);
      const wf = Math.floor(t2 * 1.6) % 2;
      const ec = this.edgeCache;
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
        const inside = x >= 0 && y >= 0 && x < size && y < size;
        const name = inside ? tileSprite(biome[y * size + x], variant[y * size + x], wf + (x + y & 1)) : tileSprite("water", 0, wf + (x + y & 1));
        this.atlas.draw(ctx, name, x * T - cam.x, y * T - cam.y);
      }
      for (let y = Math.max(0, Y0); y <= Math.min(size - 1, Y1); y++) for (let x = Math.max(0, X0); x <= Math.min(size - 1, X1); x++)
        for (const p of ec.pieces[y * size + x]) this.atlas.draw(ctx, p, x * T - cam.x, y * T - cam.y);
    }
    drawFloor(ctx, s, cam, t2) {
      const A = this.atlas;
      for (const b of s.buildings) {
        if (!isFloorBuilding(b.id)) continue;
        const x = Math.round((b.x + 0.5) * T - cam.x), y = Math.round((b.y + 1) * T - cam.y);
        if (x < -16 || y < -16 || x > cam.w + 16 || y > cam.h + 32) continue;
        const flash = this.fx.flash.has(b.uid);
        A.draw(ctx, buildingSprites(b, t2).base, x, y, { alpha: b.constructing > 0 ? 0.55 : 1, tint: flash ? "#f6f2e6" : void 0, scale: this.bscale(b.uid) });
        if (b.synergies.includes("tarSpike")) A.drawC(ctx, "ui_link_dot", x, y - 8);
      }
    }
    bscale(uid) {
      const k = this.fx.bounceScale(uid);
      return k !== 1 ? k : void 0;
    }
    drawEntities(ctx, s, cam, a, t2) {
      const list = [];
      const vis = (wx, wy, m = 48) => wx > cam.x - m && wx < cam.x + cam.w + m && wy > cam.y - m && wy < cam.y + cam.h + m * 2;
      const sx = (wx) => Math.round(wx - cam.x), sy = (wy) => Math.round(wy - cam.y);
      const night = s.phase === "night";
      const F = _WorldRenderer.FEET;
      for (const nd of s.nodes) {
        const wx = (nd.x + 0.5) * T, wy = (nd.y + 1) * T - 2;
        if (!vis(wx, wy)) continue;
        list.push({ y: wy, draw: () => this.drawNode(ctx, nd, sx(wx), sy(wy), t2) });
      }
      for (const p of s.pois) {
        const wx = (p.x + 0.5) * T, wy = (p.y + 1) * T - 2;
        if (!vis(wx, wy, 64)) continue;
        list.push({ y: p.kind === "rift" ? wy - 24 : wy, draw: () => this.drawPoi(ctx, p, sx(wx), sy(wy), t2) });
      }
      for (const b of s.buildings) {
        if (isFloorBuilding(b.id)) continue;
        const wx = (b.x + b.w / 2) * T, wy = (b.y + b.h) * T;
        if (!vis(wx, wy, 64)) continue;
        list.push({ y: wy - 1, draw: () => this.drawBuilding(ctx, s, b, sx(wx), sy(wy), t2) });
      }
      for (const h of s.heroes) {
        const p = lerpPos(h, a);
        const wx = p.x * T, wy = p.y * T + F;
        if (!vis(wx, wy)) continue;
        list.push({ y: wy, draw: () => this.drawHero(ctx, h, sx(wx), sy(wy), t2) });
      }
      for (const u of s.allies ?? []) {
        if (u.hp <= 0) continue;
        const p = lerpPos(u, a);
        const wx = p.x * T, wy = p.y * T + F;
        if (!vis(wx, wy)) continue;
        list.push({ y: wy, draw: () => this.drawAlly(ctx, u, sx(wx), sy(wy)) });
      }
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        if (e.status.veiled && night) continue;
        const p = lerpPos(e, a);
        const wx = p.x * T, wy = p.y * T + F;
        if (!vis(wx, wy, 64)) continue;
        list.push({ y: wy, draw: () => this.drawEnemy(ctx, e, sx(wx), sy(wy), t2) });
      }
      list.sort((p, q) => p.y - q.y);
      for (const d of list) d.draw();
    }
    drawNode(ctx, n, x, y, t2) {
      const name = nodeSprite(n);
      if (!name) return;
      const sh = n.hp > 0 ? nodeShadow(n.kind) : null;
      if (sh) this.atlas.draw(ctx, sh, x, y + 1);
      const shake = n.shakeT > 0 ? Math.round(Math.sin(t2 * 70)) : 0;
      this.atlas.draw(ctx, name, x + shake, y);
    }
    drawPoi(ctx, p, x, y, t2) {
      const name = poiSprite(p, t2);
      if (!name) return;
      if (p.kind === "chest" || p.kind === "root") this.atlas.draw(ctx, "prop_shadow_s", x, y + 1);
      this.atlas.draw(ctx, name, x, p.kind === "rift" ? y + 8 : y);
      if (p.active && p.maxHp > 0 && p.hp > 0 && p.hp < p.maxHp && p.kind !== "rift") this.bar(ctx, x, y - 24, p.hp / p.maxHp, "bar_fill_red");
    }
    drawBuilding(ctx, s, b, x, y, t2) {
      const A = this.atlas;
      const flash = this.fx.flash.has(b.uid);
      const o = { alpha: b.constructing > 0 ? 0.6 + 0.25 * Math.sin(t2 * 20) : 1, scale: this.bscale(b.uid), tint: flash ? "#f6f2e6" : void 0 };
      if (b.synergies.includes("embedded")) A.draw(ctx, "bld_embed_base", x, y);
      const spr = buildingSprites(b.id === "hearth" ? { ...b, level: s.hearthLevel } : b, t2);
      A.draw(ctx, spr.base, x, y, o);
      const f = A.frames[spr.base];
      const top = f ? y - f.ay : y - 24;
      if (spr.head) A.draw(ctx, spr.head, x, y - b.h * T / 2 - 4, { tint: o.tint, scale: o.scale });
      const crack = b.id === "hearth" ? null : crackOverlay(b.hp, b.maxHp);
      if (crack) A.draw(ctx, crack, x, y);
      const ft = animFrame(t2, 6, 2);
      if (b.synergies.includes("flame")) A.draw(ctx, `bld_flame_tip_${ft}`, x, top + 3);
      if (b.synergies.includes("rally")) A.draw(ctx, `bld_rally_flag_${ft}`, x + 5, top + 5);
      if (b.maxHp > 0 && b.hp < b.maxHp && b.id !== "hearth" && (this.attacked.has(b.uid) || b.hp / b.maxHp < 0.5))
        this.bar(ctx, x, top - 4, b.hp / b.maxHp, "bar_fill_green");
    }
    drawHero(ctx, h, x, y, t2) {
      const A = this.atlas;
      A.draw(ctx, "prop_shadow_s", x, y + 1);
      const name = heroSprite(h);
      A.draw(ctx, name, x, y, { flip: h.facing < 0, tint: this.fx.flash.has(h.uid) ? "#f6f2e6" : void 0 });
      const f = A.frames[name];
      const top = f ? y - f.ay : y - 16;
      if (h.anim !== "down" && h.hp < h.maxHp) this.bar(ctx, x, top - 4, h.hp / h.maxHp, "bar_fill_green");
      this.status(ctx, h.status, x, top - 4, t2);
    }
    drawAlly(ctx, u, x, y) {
      const A = this.atlas;
      A.draw(ctx, "prop_shadow_s", x, y + 1);
      const name = enemySprite({ id: u.id === "turret" ? "turret" : "militia", anim: u.anim, animT: u.animT });
      A.draw(ctx, name, x, y, { flip: u.facing < 0, tint: this.fx.flash.has(u.uid) ? "#f6f2e6" : void 0 });
      const f = A.frames[name];
      const top = f ? y - f.ay : y - 16;
      if (u.hp < u.maxHp) this.bar(ctx, x, top - 4, u.hp / u.maxHp, "bar_fill_green");
    }
    drawEnemy(ctx, e, x, y, t2) {
      const A = this.atlas;
      const name = enemySprite(e);
      const hover = e.flying || e.id === "unlit" ? Math.round(Math.sin(t2 * 4 + e.uid) * 1.5) - 5 : 0;
      A.draw(ctx, e.elite ? "prop_shadow_m" : unitShadow(e.id), x, y + 1);
      if (e.elite) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) A.draw(ctx, name, x + dx, y + dy + hover, { flip: e.facing < 0, tint: "#ffe27a" });
      A.draw(ctx, name, x, y + hover, { flip: e.facing < 0, tint: this.fx.flash.has(e.uid) ? "#f6f2e6" : void 0 });
      const f = A.frames[name];
      const top = f ? y + hover - f.ay : y - 18;
      if (!isBoss(e.id) && e.hp < e.maxHp) this.bar(ctx, x, top - 4, e.hp / e.maxHp, "bar_fill_red");
      this.status(ctx, e.status, x, top - 4, t2);
    }
    status(ctx, st2, x, y, t2) {
      const icons = statusIcons(st2, t2);
      let ox = x - (icons.length - 1) * 8 / 2;
      for (const n of icons) {
        this.atlas.drawC(ctx, n, ox, y - 4);
        ox += 8;
      }
    }
    /** Veiled enemies (dark tiles at night): only the glowing eyes, drawn AFTER the light overlay. */
    drawVeiled(ctx, s, cam, a, t2) {
      if (s.phase !== "night") return;
      for (const e of s.enemies) {
        if (e.hp <= 0 || !e.status.veiled) continue;
        const p = lerpPos(e, a);
        const x = Math.round(p.x * T - cam.x), y = Math.round(p.y * T + _WorldRenderer.FEET - cam.y);
        if (x < -16 || x > cam.w + 16 || y < -16 || y > cam.h + 32) continue;
        const blink = Math.floor(t2 * 1.5 + e.uid * 0.37) % 6 === 0 ? 1 : 0;
        const f = this.atlas.frames[enemySprite(e)];
        const eyeY = y - (f ? Math.round(f.h * 0.55) : 9) - (isBoss(e.id) ? 10 : 0);
        this.atlas.drawC(ctx, `enemy_eyes_veiled_${blink}`, x + (e.facing < 0 ? -1 : 1), eyeY);
      }
    }
    bar(ctx, cx, y, r, fill) {
      const A = this.atlas;
      const w = 12, h = 3;
      const x = Math.round(cx - w / 2);
      y = Math.round(y);
      A.nine(ctx, "ui_bar_frame", x, y, w, h, 1);
      const ff = A.frames[`ui_${fill}`];
      if (ff && A.img) {
        const iw = Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, r))));
        if (iw > 0) ctx.drawImage(A.img, ff.x, ff.y + Math.floor(ff.h / 2), 1, 1, x + 1, y + 1, iw, 1);
      }
    }
    /** Ground-effect zones (Ilka's firewall, Mira's sanctum) — drawn under units. */
    drawZones(ctx, s, cam, t2) {
      const A = this.atlas;
      for (const z of s.zones ?? []) {
        const fade = z.t < 0.4 ? z.t / 0.4 : 1;
        if (z.kind === "firewall") {
          const len = Math.hypot(z.x2 - z.x, z.y2 - z.y);
          const n = Math.max(1, Math.round(len * 1.5));
          for (let i = 0; i <= n; i++) {
            const u = i / n;
            const wx = (z.x + (z.x2 - z.x) * u) * T, wy = (z.y + (z.y2 - z.y) * u) * T;
            A.drawC(ctx, `fx_firewall_${(Math.floor(t2 * 10) + i) % 3}`, wx - cam.x, wy - cam.y - 4, { alpha: fade });
          }
        } else {
          const cx = z.x * T - cam.x, cy = z.y * T - cam.y;
          const pts = Math.max(8, Math.round(z.r * 10));
          for (let i = 0; i < pts; i++) {
            const ang = i / pts * Math.PI * 2 + t2 * 0.5;
            A.drawC(ctx, "ui_range_dot", cx + Math.cos(ang) * z.r * T, cy + Math.sin(ang) * z.r * T, { alpha: fade });
          }
          A.drawC(ctx, `fx_sanctum_${Math.floor(t2 * 4) % 2}`, cx, cy, { alpha: fade });
        }
      }
    }
    // ── projectiles ───────────────────────────────────────────────────────────
    drawProjectiles(ctx, s, cam, a, t2) {
      const A = this.atlas;
      for (const p of s.projectiles) {
        const pos = lerpPos(p, a);
        const x = Math.round(pos.x * T - cam.x), y = Math.round(pos.y * T - cam.y);
        if (x < -32 || y < -48 || x > cam.w + 32 || y > cam.h + 48) continue;
        const z = Math.round(p.z * T);
        if (z > 2) A.draw(ctx, "prop_shadow_s", x, y + 2, { alpha: 0.6 });
        const name = projectileSprite(p, t2);
        const rot = p.kind === "fireball" || p.kind === "mortar" || p.kind === "spit" ? void 0 : p.angle;
        A.drawC(ctx, name, x, y - z, { rot });
      }
    }
  };
  // ── entities ────────────────────────────────────────────────────────────
  /** Feet offset (art px) of a unit below its core position (tile-centre based). */
  _WorldRenderer.FEET = 3;
  var WorldRenderer = _WorldRenderer;

  // tools/preview/src/build.ts
  var TABS = ["defense", "light", "traps", "economy"];
  var CARD_W = 50;
  var CARD_H = 76;
  var TAB_H = 16;
  var BuildUI = class {
    constructor(app2) {
      this.app = app2;
      this.open = false;
      this.freeCam = false;
      this.tab = 0;
      this.sel = null;
      this.scroll = 0;
      this.paint = null;
      this.ghost = null;
      this.ghostDrag = false;
      this.pan = false;
      this.menu = null;
      this.edgeVel = { x: 0, y: 0 };
      this.gridCache = null;
    }
    get drawerTop() {
      return this.app.H - this.app.safe.b - (TAB_H + CARD_H + 8);
    }
    reset() {
      this.open = false;
      this.freeCam = false;
      this.sel = null;
      this.paint = null;
      this.ghost = null;
      this.menu = null;
    }
    enter() {
      if (this.open || !this.app.game) return;
      const s = this.app.game.state;
      if (s.phase !== "day" && s.phase !== "night" && s.phase !== "dusk") return;
      this.open = true;
      this.freeCam = true;
      this.menu = null;
      this.app.cmd({ t: "buildMode", on: true });
      this.app.joy = null;
      this.app.cmd({ t: "move", dir: { x: 0, y: 0 } });
      this.app.sentDir = { x: 0, y: 0 };
      this.app.audio.sfx("ui_click");
    }
    exit() {
      if (!this.open) return;
      this.open = false;
      this.freeCam = false;
      this.sel = null;
      this.paint = null;
      this.ghost = null;
      this.menu = null;
      this.app.cmd({ t: "buildMode", on: false });
    }
    toggle() {
      this.open ? this.exit() : this.enter();
    }
    cancelGesture() {
      this.paint = null;
      this.ghostDrag = false;
      this.pan = false;
    }
    ids() {
      return Object.keys(BUILDINGS).filter((id) => id !== "hearth" && BUILDINGS[id].tab === TABS[this.tab]);
    }
    locked(id) {
      return BUILDINGS[id].should && !this.app.meta.unlockedBlueprints.includes(id);
    }
    cost(id) {
      return this.app.game.buildingCost(id, 1);
    }
    affordable(c) {
      const r = this.app.state.res;
      return r.wood >= c.wood && r.stone >= c.stone && r.gold >= c.gold;
    }
    select(id) {
      if (this.locked(id)) {
        this.app.audio.sfx("fail");
        return;
      }
      this.sel = this.sel === id ? null : id;
      this.ghost = null;
      this.menu = null;
    }
    tick(dt) {
      if (!this.open) return;
      if ((this.paint || this.ghostDrag) && (this.edgeVel.x || this.edgeVel.y)) {
        this.app.cam.x += this.edgeVel.x * dt * 90;
        this.app.cam.y += this.edgeVel.y * dt * 90;
        this.app.clampCam();
      }
    }
    cellAt(x, y) {
      const t2 = this.app.screenToTile(x, y);
      return { x: Math.floor(t2.x), y: Math.floor(t2.y) };
    }
    buildingAt(c) {
      const s = this.app.state;
      for (const b of s.buildings) if (c.x >= b.x && c.y >= b.y && c.x < b.x + b.w && c.y < b.y + b.h) return b;
      return null;
    }
    setEdge(x, y) {
      const W2 = this.app.W, band = 14;
      let vx = 0, vy = 0;
      if (x < band) vx = -1;
      else if (x > W2 - band) vx = 1;
      if (y < this.app.safe.t + band) vy = -1;
      else if (y > this.drawerTop - 6 && y < this.drawerTop + 4) vy = 1;
      this.edgeVel = { x: vx, y: vy };
    }
    // ── pointer (world area only; UI widgets are handled by the UI layer first) ─────────────
    down(x, y) {
      if (this.menu !== null) {
        this.menu = null;
        return;
      }
      const c = this.cellAt(x, y);
      if (this.sel && BUILDINGS[this.sel].paintable) {
        this.paint = { start: c, cur: c, mode: null, cells: [c], px: x, py: y };
      } else if (this.sel) {
        const d = BUILDINGS[this.sel];
        if (this.ghost && c.x >= this.ghost.x && c.y >= this.ghost.y && c.x < this.ghost.x + d.w && c.y < this.ghost.y + d.h) this.ghostDrag = true;
        else {
          const t2 = this.app.screenToTile(x, y);
          this.ghost = footprintOrigin(t2.x, t2.y, d.w, d.h);
          this.ghostDrag = true;
        }
      } else this.pan = true;
    }
    move(x, y, dx, dy) {
      if (this.paint) {
        const c = this.cellAt(x, y);
        this.paint.cur = c;
        if (!this.paint.mode && (c.x !== this.paint.start.x || c.y !== this.paint.start.y)) this.paint.mode = classifyDrag(c.x - this.paint.start.x, c.y - this.paint.start.y);
        this.paint.cells = this.paint.mode ? paintCells(this.paint.start, c, this.paint.mode) : [this.paint.start];
        this.paint.px = x;
        this.paint.py = y;
        this.setEdge(x, y);
      } else if (this.ghostDrag && this.sel) {
        const d = BUILDINGS[this.sel];
        const t2 = this.app.screenToTile(x, y);
        this.ghost = footprintOrigin(t2.x, t2.y, d.w, d.h);
        this.setEdge(x, y);
      } else if (this.pan) {
        this.app.cam.x -= dx;
        this.app.cam.y -= dy;
        this.app.clampCam();
      }
    }
    up(x, y, kind, cancel) {
      this.edgeVel = { x: 0, y: 0 };
      if (this.paint) {
        const p = this.paint;
        this.paint = null;
        if (!cancel && this.sel) this.app.cmd({ t: "paint", id: this.sel, cells: p.cells });
      } else if (this.ghostDrag) this.ghostDrag = false;
      else if (this.pan) {
        this.pan = false;
        if (kind === "tap") {
          const b = this.buildingAt(this.cellAt(x, y));
          this.menu = b ? b.uid : null;
        }
      }
    }
    // ── drawing ───────────────────────────────────────────────────────────────
    /** Grid on buildable tiles + hatching on dark tiles (world layer, under entities). */
    drawGroundOverlay(cam) {
      if (!this.open || !this.app.game) return;
      const g = this.app.b, A = this.app.atlas, game = this.app.game, s = game.state;
      const x0 = Math.max(0, Math.floor(cam.x / T)), y0 = Math.max(0, Math.floor(cam.y / T));
      const x1 = Math.min(s.map.size - 1, Math.ceil((cam.x + cam.w) / T)), y1 = Math.min(s.map.size - 1, Math.ceil((cam.y + cam.h) / T));
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      let gc = this.gridCache;
      if (!gc || this.app.time - gc.t > 0.2 || gc.x0 !== x0 || gc.y0 !== y0 || gc.w !== w || gc.h !== h) {
        const ok = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const r = game.canPlace("trap_tar", x0 + x, y0 + y);
          ok[y * w + x] = r.ok || r.reason === "cost" ? 1 : r.reason === "dark" && s.map.biome[(y0 + y) * s.map.size + x0 + x] !== "water" ? 2 : 0;
        }
        gc = this.gridCache = { t: this.app.time, ok, x0, y0, w, h };
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = gc.ok[y * w + x];
        const sx = (x0 + x) * T - cam.x, sy = (y0 + y) * T - cam.y;
        if (v === 1) A.draw(g, "ui_grid_cell", sx, sy, { alpha: 0.55 });
        else if (v === 2) hatch(g, sx, sy);
      }
    }
    /** Ghosts, range rings, synergy links, paint costs, radial menu (above the world + light). */
    drawWorldOverlay() {
      if (!this.open || !this.app.game) return;
      const app2 = this.app, g = app2.b, A = app2.atlas, game = app2.game, s = game.state;
      const cam = app2.camRect();
      const S2 = (tx, ty) => ({ x: Math.round(tx * T - cam.x), y: Math.round(ty * T - cam.y) });
      for (const b of s.buildings) {
        const d = BUILDINGS[b.id];
        if (!b.id.startsWith("tower") || !d.range) continue;
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        const sc = S2(cx, cy);
        if (sc.x < -160 || sc.y < -160 || sc.x > app2.W + 160 || sc.y > app2.H + 160) continue;
        const range = d.range[b.level - 1] + (b.synergies.includes("embedded") ? BALANCE.synergy.embeddedRangeBonus : 0);
        for (const p of ringPoints(cx, cy, range, 0.6)) {
          const q = S2(p.x, p.y);
          A.drawC(g, "ui_range_dot", q.x, q.y, { alpha: 0.85 });
        }
        if (b.synergies.includes("flame")) {
          const br = s.buildings.filter((o) => o.id === "brazier" && o.lit && Math.hypot(o.x + 0.5 - cx, o.y + 0.5 - cy) <= BALANCE.synergy.flameRange + (b.w + 1) / 2);
          for (const o of br) for (const p of dottedLine(cx, cy, o.x + 0.5, o.y + 0.5, 0.35)) {
            const q = S2(p.x, p.y);
            A.drawC(g, "ui_link_dot", q.x, q.y);
          }
        }
      }
      if (this.paint && this.sel) {
        const id = this.sel, cost = this.cost(id);
        const plan = paintPlan(this.paint.cells, (c) => {
          const r = game.canPlace(id, c.x, c.y);
          return r.ok || r.reason === "cost";
        }, cost, s.res);
        this.paint.cells.forEach((c, i) => {
          const p = S2(c.x, c.y);
          A.draw(g, buildingIcon(id), p.x + 8, p.y + 16, { alpha: plan.ok[i] ? 0.7 : 0.35 });
          A.draw(g, plan.ok[i] ? "ui_build_ok" : "ui_build_bad", p.x, p.y);
        });
        costTag(app2, plan.total, this.paint.px, this.paint.py - 22, plan.count);
      }
      if (this.ghost && this.sel) {
        const id = this.sel, d = BUILDINGS[id];
        const chk = game.canPlace(id, this.ghost.x, this.ghost.y);
        const cx = this.ghost.x + d.w / 2, cy = this.ghost.y + d.h / 2;
        this.rings(id, cx, cy, this.ghost);
        for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
          const p = S2(this.ghost.x + x, this.ghost.y + y);
          A.draw(g, chk.ok ? "ui_build_ok" : "ui_build_bad", p.x, p.y);
        }
        const base = S2(cx, this.ghost.y + d.h);
        A.draw(g, buildingIcon(id), base.x, base.y, { alpha: 0.75 });
        const top = S2(cx, this.ghost.y);
        if (!chk.ok && chk.reason) app2.font.draw(g, app2.tr(`build.fail.${chk.reason}`), top.x, top.y - 38, { align: "center", color: COL.red });
        const bx = Math.round(base.x + d.w * T / 2 + 2), by = Math.round(top.y - 12);
        app2.ui.iconButton("ghostOk", bx, by, 22, "icon_tick", () => {
          if (this.ghost && this.sel) {
            app2.cmd({ t: "place", id: this.sel, x: this.ghost.x, y: this.ghost.y });
            this.ghost = null;
          }
        }, { disabled: !chk.ok });
        app2.ui.iconButton("ghostNo", bx, by + 24, 22, "icon_close", () => {
          this.ghost = null;
        });
      }
      if (this.menu !== null) {
        const b = s.buildings.find((q) => q.uid === this.menu);
        if (!b) this.menu = null;
        else this.radial(b);
      }
    }
    rings(id, cx, cy, at) {
      const app2 = this.app, g = app2.b, A = app2.atlas, s = app2.state, d = BUILDINGS[id];
      const cam = app2.camRect();
      const S2 = (tx, ty) => ({ x: Math.round(tx * T - cam.x), y: Math.round(ty * T - cam.y) });
      const near = (b, r) => Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy) <= r + (b.w + d.w) / 4;
      let adj = 0;
      if (id.startsWith("tower")) {
        for (const b of s.buildings) if (BUILDINGS[b.id].wallLike) {
          const touchX = b.x + b.w === at.x || b.x === at.x + d.w, touchY = b.y + b.h === at.y || b.y === at.y + d.h;
          const overlapY = b.y < at.y + d.h && b.y + b.h > at.y, overlapX = b.x < at.x + d.w && b.x + b.w > at.x;
          if (touchX && overlapY || touchY && overlapX) adj++;
        }
      }
      const embedded = adj >= 2;
      let range = d.range ? d.range[0] : d.light ? d.light[0] : id === "lumber_camp" || id === "quarry" ? 3 : 0;
      if (embedded && d.range) range += BALANCE.synergy.embeddedRangeBonus;
      if (range > 0) for (const p of ringPoints(cx, cy, range, 0.45)) A.drawC(g, "ui_range_dot", S2(p.x, p.y).x, S2(p.x, p.y).y);
      if (d.minRange) for (const p of ringPoints(cx, cy, d.minRange, 0.6)) A.drawC(g, "ui_range_dot", S2(p.x, p.y).x, S2(p.x, p.y).y, { alpha: 0.5 });
      if (embedded) {
        const p = S2(cx, at.y + d.h);
        A.draw(g, "bld_embed_base", p.x, p.y);
      }
      const labels = [];
      const link = (b) => {
        for (const p of dottedLine(cx, cy, b.x + b.w / 2, b.y + b.h / 2, 0.35)) {
          const q = S2(p.x, p.y);
          A.drawC(g, "ui_link_dot", q.x, q.y);
        }
      };
      if (id === "tower_arrow" || id === "tower_ballista") {
        const lit = s.buildings.filter((b) => b.id === "brazier" && b.lit && near(b, BALANCE.synergy.flameRange));
        lit.forEach(link);
        if (lit.length) labels.push(app2.tr("build.synergy.flame"));
      }
      if (id === "brazier") s.buildings.filter((b) => (b.id === "tower_arrow" || b.id === "tower_ballista") && near(b, BALANCE.synergy.flameRange)).forEach(link);
      if (id === "trap_tar" || id === "trap_spikes") {
        const other = id === "trap_tar" ? "trap_spikes" : "trap_tar";
        const n = s.buildings.filter((b) => b.id === other && Math.abs(b.x - at.x) + Math.abs(b.y - at.y) === 1);
        n.forEach(link);
        if (n.length) labels.push(app2.tr("build.synergy.tarSpike"));
      }
      if (id.startsWith("tower")) {
        const leader2 = s.heroes.find((h) => h.leader);
        if (leader2 && Math.hypot(leader2.x - cx, leader2.y - cy) <= BALANCE.synergy.rallyRange) {
          for (const p of dottedLine(cx, cy, leader2.x, leader2.y, 0.35)) {
            const q = S2(p.x, p.y);
            A.drawC(g, "ui_link_dot", q.x, q.y, { alpha: 0.7 });
          }
          labels.push(app2.tr("build.synergy.rally"));
        }
      }
      if (embedded) labels.push(app2.tr("build.synergy.embedded"));
      const top = S2(cx, at.y);
      labels.forEach((l, i) => app2.font.draw(g, l, top.x, top.y - 30 - i * 9, { align: "center", color: COL.fire }));
    }
    radial(b) {
      const app2 = this.app, g = app2.b, ui = app2.ui, game = app2.game, s = game.state, d = BUILDINGS[b.id];
      const cam = app2.camRect();
      const cx = Math.round((b.x + b.w / 2) * T - cam.x), cy = Math.round((b.y + b.h / 2) * T - cam.y);
      const name = app2.tr(`bld.${b.id}.name`);
      app2.font.draw(g, `${name} ${app2.tr("ui.level", { n: b.level })}`, cx, cy - 40, { align: "center", color: COL.gold });
      const r = 24;
      const items = [];
      const canUp = d.upgradeTo !== void 0 || b.level < d.maxLevel;
      if (b.id === "hearth" || canUp) {
        const c = d.upgradeTo ? game.buildingCost(d.upgradeTo, 1) : game.buildingCost(b.id, Math.min(3, b.level + 1));
        items.push({ id: "menuUp", icon: "icon_upgrade", onTap: () => {
          app2.cmd({ t: "upgrade", uid: b.uid });
        }, disabled: !canUp || !this.affordable(c), cost: c });
      }
      if (b.maxHp > 1) items.push({ id: "menuRepair", icon: "icon_wrench", onTap: () => app2.cmd({ t: "repair", uid: b.uid }), disabled: b.hp >= b.maxHp });
      if (b.id !== "hearth") items.push({ id: "menuSell", icon: "icon_sell", onTap: () => {
        app2.cmd({ t: "sell", uid: b.uid });
        this.menu = null;
      }, disabled: false });
      items.forEach((it, i) => {
        const a = -Math.PI / 2 + (i - (items.length - 1) / 2) * 1.1;
        const bx = Math.round(cx + Math.cos(a) * r - 12), by = Math.round(cy + Math.sin(a) * r - 12);
        ui.iconButton(it.id, bx, by, 24, it.icon, it.onTap, { disabled: it.disabled });
        if (it.cost) costTag(app2, it.cost, bx + 12, by - 10);
      });
    }
    /** Drawer + undo/done + blueprint frame (screen space). */
    drawUI() {
      if (!this.open || !this.app.game) return;
      const app2 = this.app, g = app2.b, A = app2.atlas, ui = app2.ui, f = app2.font;
      const { W: W2, H, safe } = app2;
      const fr = A.frames["ui_blueprint_corner"];
      if (fr) {
        const m = 2, top2 = safe.t + m, bot = this.drawerTop - 2;
        A.drawC(g, "ui_blueprint_corner", m + fr.w / 2, top2 + fr.h / 2);
        A.drawC(g, "ui_blueprint_corner", W2 - m - fr.w / 2, top2 + fr.h / 2, { rot: Math.PI / 2 });
        A.drawC(g, "ui_blueprint_corner", W2 - m - fr.w / 2, bot - fr.h / 2, { rot: Math.PI });
        A.drawC(g, "ui_blueprint_corner", m + fr.w / 2, bot - fr.h / 2, { rot: -Math.PI / 2 });
        for (let x = m + fr.w + 4; x < W2 - m - fr.w - 2; x += 6) {
          A.drawC(g, "ui_range_dot", x, top2 + 1, { alpha: 0.6 });
          A.drawC(g, "ui_range_dot", x, bot - 1, { alpha: 0.6 });
        }
        for (let y = top2 + fr.h + 4; y < bot - fr.h - 2; y += 6) {
          A.drawC(g, "ui_range_dot", m + 1, y, { alpha: 0.6 });
          A.drawC(g, "ui_range_dot", W2 - m - 1, y, { alpha: 0.6 });
        }
      }
      const top = this.drawerTop;
      A.nine(g, "ui_panel_stone", 0, top, W2, H - top + 4);
      ui.block(0, top, W2, H - top, "drawer");
      const tw = Math.floor((W2 - safe.l - safe.r - 8) / 4);
      TABS.forEach((tb, i) => {
        const x = safe.l + 4 + i * tw, y = top + 3;
        A.nine(g, i === this.tab ? "ui_tab_on" : "ui_tab_off", x, y, tw - 1, TAB_H);
        f.draw(g, app2.tr(`build.tab.${tb}`), x + (tw - 1) / 2, y + 5, { align: "center", color: i === this.tab ? COL.gold : COL.grey });
        ui.add({ x, y, w: tw - 1, h: TAB_H, id: `tab_${tb}`, block: true, onTap: () => {
          this.tab = i;
          this.scroll = 0;
        } });
      });
      const ids = this.ids();
      const cy = top + TAB_H + 6;
      const maxScroll = Math.max(0, ids.length * (CARD_W + 2) - (W2 - 8));
      this.scroll = Math.max(0, Math.min(maxScroll, this.scroll));
      g.save();
      g.beginPath();
      g.rect(2, cy - 1, W2 - 4, CARD_H + 2);
      g.clip();
      ids.forEach((id, i) => {
        const x = Math.round(4 + i * (CARD_W + 2) - this.scroll);
        if (x > W2 || x + CARD_W < 0) return;
        this.card(id, x, cy);
      });
      g.restore();
      ui.add({
        x: 0,
        y: cy,
        w: W2,
        h: CARD_H,
        id: "cards",
        block: true,
        onDrag: (dx) => {
          this.scroll -= dx;
        },
        onTap: () => {
          const i = Math.floor((app2.ui.tapX - 4 + this.scroll) / (CARD_W + 2));
          if (i >= 0 && i < ids.length) this.select(ids[i]);
        }
      });
      const bx = W2 - safe.r - 28;
      ui.iconButton("undo", bx - 28, top - 28, 24, "icon_undo", () => app2.cmd({ t: "undo" }));
      if (app2.state.phase !== "dusk") ui.iconButton("buildDone", bx, top - 28, 24, "icon_close", () => this.exit());
      const r = app2.state.res;
      let lx = safe.l + 4;
      for (const [k, c] of [["wood", COL.wood], ["stone", COL.stone], ["gold", COL.gold]]) {
        A.drawTL(g, `icon_${k}`, lx, top - 20);
        f.draw(g, String(Math.floor(r[k])), lx + 17, top - 15, { color: c });
        lx += 17 + f.width(String(Math.floor(r[k]))) + 6;
      }
    }
    card(id, x, y) {
      const app2 = this.app, g = app2.b, A = app2.atlas, f = app2.font;
      const sel = this.sel === id, locked = this.locked(id);
      A.nine(g, sel ? "ui_card_rare" : "ui_card_common", x, y, CARD_W, CARD_H);
      g.save();
      g.beginPath();
      g.rect(x + 2, y + 2, CARD_W - 4, 44);
      g.clip();
      const icon = buildingIcon(id);
      const fr = A.frames[icon];
      const by = fr && fr.h > 40 ? y + 46 : y + 42;
      A.draw(g, icon, x + CARD_W / 2, by, { alpha: locked ? 0.4 : 1 });
      g.restore();
      if (locked) A.drawC(g, "icon_lock", x + CARD_W / 2, y + 24);
      const lines = f.wrap(app2.tr(`bld.${id}.name`), CARD_W - 4).slice(0, 2);
      f.drawLines(g, lines, x + CARD_W / 2, y + 47, { align: "center", color: sel ? COL.gold : COL.white });
      const c = this.cost(id), r = app2.state.res;
      const parts = [];
      if (c.wood) parts.push([c.wood, COL.wood, r.wood >= c.wood]);
      if (c.stone) parts.push([c.stone, COL.stone, r.stone >= c.stone]);
      if (c.gold) parts.push([c.gold, COL.gold, r.gold >= c.gold]);
      const txt = parts.map((p) => String(p[0]));
      const totalW = txt.reduce((a, t2) => a + f.width(t2), 0) + (txt.length - 1) * 4;
      let cx = Math.round(x + CARD_W / 2 - totalW / 2);
      parts.forEach((p, i) => {
        f.draw(g, txt[i], cx, y + CARD_H - 10, { color: p[2] ? p[1] : COL.red });
        cx += f.width(txt[i]) + 4;
      });
    }
  };
  function costTag(app2, c, x, y, count) {
    const g = app2.b, A = app2.atlas, f = app2.font;
    const parts = ["wood", "stone", "gold"].filter((k) => c[k] > 0);
    const label = count !== void 0 ? `x${count}` : "";
    const widths = parts.map((k) => 15 + f.width(String(c[k])));
    const w = widths.reduce((a, b) => a + b, 0) + (label ? f.width(label) + 4 : 0) + 6;
    const x0 = Math.round(x - w / 2);
    A.nine(g, "ui_panel_stone", x0, Math.round(y), Math.max(14, w), 16);
    let cx = x0 + 3;
    if (label) {
      f.draw(g, label, cx, y + 5, { color: COL.white });
      cx += f.width(label) + 4;
    }
    parts.forEach((k, i) => {
      A.drawTL(g, `icon_${k}`, cx - 2, Math.round(y));
      f.draw(g, String(c[k]), cx + 13, y + 5, { color: app2.state.res[k] >= c[k] ? COL.white : COL.red });
      cx += widths[i];
    });
  }
  function hatch(g, x, y) {
    g.fillStyle = "#1b1b2f";
    g.globalAlpha = 0.45;
    for (let i = 0; i < 16; i++) for (let k = 0; k < 16; k += 4) {
      const px = (i + k) % 16;
      g.fillRect(x + px, y + i, 1, 1);
    }
    g.globalAlpha = 1;
  }

  // tools/preview/src/hud.ts
  var miniCv = null;
  var miniT = -1;
  function drawHud(app2) {
    const s = app2.state;
    const g = app2.b;
    const A = app2.atlas;
    const ui = app2.ui;
    const f = app2.font;
    const { W: W2, H, safe } = app2;
    const L = safe.l + 3, Tp = safe.t + 3, R2 = W2 - safe.r - 3, B2 = H - safe.b - 3;
    const hearth = s.buildings.find((b) => b.uid === s.hearthUid);
    if (hearth && hearth.hp / hearth.maxHp < 0.3 && s.phase === "night") {
      g.globalAlpha = 0.25 + 0.2 * Math.sin(app2.time * 6);
      g.fillStyle = COL.red;
      g.fillRect(0, 0, W2, 3);
      g.fillRect(0, H - 3, W2, 3);
      g.fillRect(0, 0, 3, H);
      g.fillRect(W2 - 3, 0, 3, H);
      g.globalAlpha = 1;
    }
    edgeArrows(app2);
    A.drawTL(g, "icon_fire", L, Tp);
    if (hearth) {
      ui.bar(L + 17, Tp + 3, 44, 10, hearth.hp / hearth.maxHp, "bar_fill_red");
      f.draw(g, fmtNum(hearth.hp), L + 17 + 22, Tp + 14, { align: "center", color: COL.white });
    }
    const res = [["wood", COL.wood], ["stone", COL.stone], ["gold", COL.gold]];
    res.forEach(([k], i) => {
      const y = Tp + 22 + i * 13;
      const pulse = app2.fx.hudPulse[k] > 0 ? -1 : 0;
      A.drawTL(g, `icon_${k}`, L, y + pulse);
      f.draw(g, fmtNum(s.res[k]), L + 18, y + 5 + pulse, { color: pulse ? COL.gold : COL.white });
    });
    const cx = Math.round(W2 / 2), cy = Tp + 20, r = 16;
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + i / 8 * Math.PI;
      A.drawC(g, "ui_range_dot", cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85, { alpha: 0.9 });
    }
    const frac = s.phaseDur > 0 ? Math.max(0, Math.min(1, s.phaseT / s.phaseDur)) : s.phase === "night" ? Math.min(1, s.nightT / 90) : 1;
    const ang = Math.PI + frac * Math.PI;
    const isNight = s.phase === "night" || s.phase === "dusk";
    A.drawC(g, isNight ? "icon_moon" : "icon_sun", cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.85);
    const label = s.phase === "day" ? `${app2.tr("phase.day")} ${s.night}` : s.endless ? app2.tr("hud.nightEndless", { n: s.night }) : app2.tr("hud.night", { n: s.night });
    f.draw(g, label, cx, cy + 3, { align: "center", color: isNight ? COL.purple : COL.gold });
    if (s.phase === "night") {
      const t2 = app2.tr("hud.enemiesLeft", { n: s.enemiesLeft });
      const tw = f.width(t2) + 12;
      A.drawTL(g, "icon_skull", cx - tw / 2 - 3, cy + 10);
      f.draw(g, t2, cx - tw / 2 + 13, cy + 14, { color: COL.white });
    } else if (s.phase === "day") {
      const left = Math.max(0, Math.ceil(s.phaseDur - s.phaseT));
      f.draw(g, `${left}s`, cx, cy + 13, { align: "center", color: COL.white });
    }
    ui.iconButton("pause", R2 - 24, Tp, 24, "icon_pause", () => {
      app2.paused = true;
    });
    drawMinimap(app2, R2, Tp + 27);
    if (s.boss && s.boss.hp > 0) {
      const bw = W2 - safe.l - safe.r - 24, bx = safe.l + 12, by = Tp + 92;
      f.draw(g, app2.tr(`enemy.${s.boss.id}.name`), W2 / 2, by - 9, { align: "center", color: COL.purple });
      ui.bar(bx, by, bw, 10, s.boss.hp / s.boss.maxHp, "bar_fill_red");
    }
    const py0 = Math.round(H * 0.3);
    s.heroes.forEach((h, i) => {
      const x = L, y = py0 + i * 34;
      A.nine(g, "ui_panel_stone", x - 1, y - 1, 26, 26);
      A.drawTL(g, `portrait_${h.id}`, x, y, { alpha: h.anim === "down" ? 0.45 : 1 });
      if (h.skillCdMax > 0 && h.skillCd > 0) {
        const k = Math.min(1, h.skillCd / h.skillCdMax);
        g.globalAlpha = 0.55;
        g.fillStyle = COL.ink;
        g.fillRect(x, y, 24, Math.round(24 * k));
        g.globalAlpha = 1;
      }
      if (h.leader) A.drawTL(g, "icon_pin", x + 14, y - 5);
      f.draw(g, String(h.level), x + 1, y + 16, { color: COL.gold });
      ui.bar(x - 1, y + 25, 26, 8, h.hp / h.maxHp, h.anim === "down" ? "bar_fill_blue" : "bar_fill_green");
      if (h.anim === "down" && h.reviveT > 0) f.draw(g, `${Math.ceil(h.reviveT)}`, x + 12, y + 8, { align: "center", color: COL.white });
    });
    if (!app2.build.open) {
      const hb = 30;
      const hx = R2 - hb, hy = B2 - hb;
      ui.iconButton("horn", hx, hy, hb, "icon_horn", () => app2.cmd({ t: "horn" }), { disabled: s.hornCharge < 1 && s.hornT <= 0 });
      const n = 12, lit = Math.floor(Math.min(1, s.hornCharge) * n);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i / n * Math.PI * 2;
        A.drawC(g, "ui_range_dot", hx + hb / 2 + Math.cos(a) * (hb / 2 + 3), hy + hb / 2 + Math.sin(a) * (hb / 2 + 3), { alpha: i < lit || s.hornT > 0 ? 1 : 0.25 });
      }
      ui.iconButton("hammer", hx - hb - 8, hy, hb, "icon_hammer", () => app2.build.enter());
      if (s.phase === "day") {
        const left = Math.max(0, s.phaseDur - s.phaseT);
        const gold = Math.floor(left / 2);
        const lbl = app2.tr("hud.callNight");
        const bw = Math.min(hx - hb - 14 - L, app2.font.width(lbl) + 30);
        ui.button("callNight", L, B2 - 24, bw, 24, lbl, () => app2.cmd({ t: "callNight" }), { icon: "icon_moon" });
        f.draw(g, app2.tr("hud.callNightGold", { n: gold }), L + bw / 2, B2 - 34, { align: "center", color: COL.gold });
      }
    }
    if (s.tutorial >= 0 && s.tutorial <= 4 && !app2.tutorialHidden && s.phase !== "dawn") {
      const msg = app2.tr(`tutorial.${s.tutorial}`);
      const lines = f.wrap(msg, W2 - 24 - safe.l - safe.r);
      const ph = lines.length * 9 + 18;
      const py = app2.build.open ? Tp + 100 : B2 - 72 - ph;
      A.nine(g, "ui_panel_parchment", safe.l + 6, py, W2 - 12 - safe.l - safe.r, ph);
      f.drawLines(g, lines, W2 / 2, py + 5, { align: "center", color: COL.ink, shadow: null });
      ui.add({ x: safe.l + 6, y: py, w: W2 - 12, h: ph, id: "tut", block: true });
      ui.button("tutSkip", W2 - safe.r - 58, py + ph - 3, 50, 14, app2.tr("tutorial.skip").split(" ")[0], () => app2.cmd({ t: "skipTutorial" }));
    }
    if (s.phase === "dusk") drawOmens(app2);
    for (const bn of app2.fx.banners) {
      const k = bn.t / bn.life;
      const alpha = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
      const y = Math.round(H * 0.46 - (k < 0.15 ? (1 - k / 0.15) * 10 : 0));
      const big = /^[0-9A-Z !-]+$/.test(bn.text) && bn.text.length <= 14;
      const tw = f.width(bn.text, 5) * (big ? 2 : 1);
      const bw = Math.min(W2 - 8, tw + 20);
      A.nine(g, "ui_panel_stone", W2 / 2 - bw / 2, y - 6, bw, big ? 26 : 19, void 0, alpha);
      if (big) {
        drawBig(app2, bn.text, W2 / 2, y, bn.color, alpha);
      } else f.draw(g, bn.text, W2 / 2, y, { align: "center", color: bn.color, alpha });
    }
    if (app2.bossIntro) {
      const k = app2.bossIntro.t / 1.8, alpha = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
      g.globalAlpha = 0.6 * alpha;
      g.fillStyle = COL.ink;
      g.fillRect(0, H * 0.42 - 20, W2, 44);
      g.globalAlpha = 1;
      drawBig(app2, app2.bossIntro.name.toUpperCase(), W2 / 2, H * 0.42 - 10, COL.purple, alpha);
      f.draw(g, app2.tr("banner.boss"), W2 / 2, H * 0.42 + 10, { align: "center", color: COL.white, alpha });
    }
    app2.fx.drawFlyers(g);
    if (app2.joy) {
      A.draw(g, "ui_joy_base", app2.joy.ox, app2.joy.oy, { alpha: 0.85 });
      A.draw(g, "ui_joy_knob", app2.joy.kx, app2.joy.ky);
    }
  }
  var bigCv = document.createElement("canvas");
  function drawBig(app2, text, cx, y, color, alpha = 1) {
    const w = app2.font.width(text) + 2, h = 10;
    bigCv.width = w;
    bigCv.height = h;
    const bg = bigCv.getContext("2d");
    bg.imageSmoothingEnabled = false;
    bg.clearRect(0, 0, w, h);
    app2.font.draw(bg, text, 0, 0, { color });
    const g = app2.b;
    g.imageSmoothingEnabled = false;
    g.globalAlpha = alpha;
    g.drawImage(bigCv, Math.round(cx - w), Math.round(y), w * 2, h * 2);
    g.globalAlpha = 1;
  }
  function drawMinimap(app2, right, top) {
    const s = app2.state;
    const g = app2.b;
    const n = s.map.size;
    if (!miniCv) {
      miniCv = document.createElement("canvas");
    }
    if (miniCv.width !== n) {
      miniCv.width = n;
      miniCv.height = n;
      miniT = -1;
    }
    if (app2.time - miniT > 0.25 || miniT < 0) {
      miniT = app2.time;
      const mg = miniCv.getContext("2d");
      const img = mg.createImageData(n, n);
      fillMinimap(new Uint8Array(img.data.buffer), {
        size: n,
        biome: s.map.biome,
        explored: s.map.explored,
        light: s.map.light,
        night: s.phase === "night",
        buildings: s.buildings,
        rifts: s.pois.filter((p) => p.kind === "rift").map((p) => ({ x: p.x, y: p.y, active: p.active })),
        pois: s.pois.filter((p) => p.kind !== "rift" && p.active),
        heroes: s.heroes,
        enemies: s.enemies
      });
      mg.putImageData(img, 0, 0);
    }
    const k = app2.minimapBig ? 2 : 1;
    const sz = n * k;
    const x = right - sz - 2, y = top;
    app2.atlas.nine(g, "ui_minimap_frame", x - 2, y - 2, sz + 4, sz + 4);
    g.drawImage(miniCv, x, y, sz, sz);
    const c = app2.camRect();
    const rx = x + Math.round(c.x / T * k), ry = y + Math.round(c.y / T * k);
    const rw = Math.round(c.w / T * k), rh = Math.round(c.h / T * k);
    g.fillStyle = COL.white;
    g.globalAlpha = 0.7;
    for (const [px, py] of [[rx, ry], [rx + rw - 2, ry], [rx, ry + rh - 2], [rx + rw - 2, ry + rh - 2]]) {
      const qx = Math.max(x, Math.min(x + sz - 2, px)), qy = Math.max(y, Math.min(y + sz - 2, py));
      g.fillRect(qx, qy, 2, 1);
      g.fillRect(qx, qy, 1, 2);
    }
    g.globalAlpha = 1;
    app2.ui.add({ x: x - 2, y: y - 2, w: sz + 4, h: sz + 4, id: "minimap", block: true, onTap: () => {
      app2.minimapBig = !app2.minimapBig;
    } });
  }
  function edgeArrows(app2) {
    const s = app2.state;
    const g = app2.b;
    const { W: W2, H, safe } = app2;
    const box = { x: safe.l + 12, y: safe.t + 104, w: W2 - safe.l - safe.r - 24, h: H - safe.t - safe.b - 104 - 52 };
    const targets = [];
    const hearth = s.buildings.find((b) => b.uid === s.hearthUid);
    if (hearth) targets.push({ tx: hearth.x + 1, ty: hearth.y + 1, icon: "icon_fire", pulse: false });
    if (s.phase === "night" || s.phase === "dusk") {
      for (const p of s.pois) if (p.kind === "rift" && p.active) targets.push({ tx: p.x + 0.5, ty: p.y + 0.5, icon: "icon_skull", pulse: true });
    }
    for (const uid of app2.world.attacked.keys()) {
      const b = s.buildings.find((q) => q.uid === uid);
      if (b && b.uid !== s.hearthUid) targets.push({ tx: b.x + b.w / 2, ty: b.y + b.h / 2, pulse: true });
    }
    if (hearth && app2.world.attacked.has(hearth.uid)) targets[0].pulse = true;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    for (const t2 of targets) {
      const p = app2.tileToScreen(t2.tx, t2.ty);
      if (p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) continue;
      const dx = p.x - cx, dy = p.y - cy;
      const k = Math.min(Math.abs(box.w / 2 / (dx || 1e-6)), Math.abs(box.h / 2 / (dy || 1e-6)));
      const ax = cx + dx * k, ay = cy + dy * k;
      const ang = Math.atan2(dy, dx);
      const alpha = t2.pulse ? 0.6 + 0.4 * Math.sin(app2.time * 8) : 1;
      app2.atlas.drawC(g, "ui_arrow_edge", ax, ay, { rot: ang, alpha });
      if (t2.icon) app2.atlas.drawC(g, t2.icon, ax - Math.cos(ang) * 13, ay - Math.sin(ang) * 13, { alpha });
    }
  }
  function drawOmens(app2) {
    const s = app2.state;
    const g = app2.b;
    const A = app2.atlas;
    const f = app2.font;
    const ui = app2.ui;
    const { W: W2, H, safe } = app2;
    const by = /* @__PURE__ */ new Map();
    for (const o of s.omens) {
      const e = by.get(o.enemy) ?? { count: 0, elite: 0, rifts: /* @__PURE__ */ new Set() };
      e.count += o.count;
      e.elite += o.elite;
      e.rifts.add(o.rift);
      by.set(o.enemy, e);
    }
    const rows = [...by.entries()];
    const pw = W2 - safe.l - safe.r - 16, px = safe.l + 8, py = safe.t + 92;
    const rowH = 22, cols = 2;
    const ph = app2.omensOpen ? 30 + Math.ceil(rows.length / cols) * rowH + 4 : 18;
    A.nine(g, "ui_panel_parchment", px, py, pw, ph);
    ui.add({ x: px, y: py, w: pw, h: ph, id: "omens", block: true, onTap: () => {
      app2.omensOpen = !app2.omensOpen;
    } });
    f.draw(g, `${app2.tr("omen.title")} - ${app2.tr("hud.night", { n: s.night })}`, px + pw / 2, py + 5, { align: "center", color: COL.ink, shadow: null });
    if (!app2.omensOpen) return;
    f.draw(g, app2.tr("omen.subtitle"), px + pw / 2, py + 16, { align: "center", color: COL.brown, shadow: null });
    rows.forEach(([id, e], i) => {
      const cx = px + 8 + i % cols * Math.floor((pw - 16) / cols), cy = py + 30 + Math.floor(i / cols) * rowH;
      const spr = id === "mossback" ? "boss_mossback_walk_0" : id === "unlit" ? "boss_unlit_float_0" : `enemy_${id}_move_0`;
      const fr = A.frames[spr];
      if (fr && fr.h > 22) {
        A.drawPart(g, spr, Math.max(0, Math.round(fr.w / 2 - 10)), Math.max(0, fr.h - 22), 20, 20, cx - 2, cy - 2);
      } else A.draw(g, spr, cx + 10, cy + 19);
      f.draw(g, `x${e.count}`, cx + 24, cy + 2, { color: COL.ink, shadow: null });
      const tag = ENEMIES[id] && (id === "mossback" || id === "unlit") ? app2.tr("omen.boss") : e.elite ? `${app2.tr("omen.elite")} ${e.elite}` : [...e.rifts].map((r) => `R${r + 1}`).join(" ");
      f.draw(g, tag, cx + 24, cy + 11, { color: e.elite || id === "mossback" || id === "unlit" ? COL.wine : COL.plum, shadow: null });
    });
    const lbl = app2.tr("hud.startNight");
    const bw = f.width(lbl) + 32;
    ui.button("startNight", W2 / 2 - bw / 2, py + ph + 4, bw, 24, lbl, () => {
      app2.build.exit();
      app2.cmd({ t: "startNight" });
    }, { icon: "icon_moon" });
  }

  // tools/preview/src/screens.ts
  function drawScreens(app2) {
    const s = app2.state;
    if (app2.screen === "loading") {
      app2.font.draw(app2.b, "Loading...", app2.W / 2, app2.H / 2, { align: "center" });
      return;
    }
    if (app2.screen === "title") return title(app2);
    if (app2.screen === "barracks") return barracks(app2);
    if (app2.screen === "settings") return settings(app2);
    if (!s) return;
    if (s.phase === "victory" || s.phase === "defeat") return endScreen(app2);
    if (s.boonOffer && s.boonOffer.length) return boonPicker(app2);
    if (s.tavernOffer && s.tavernOffer.length && (s.phase === "day" || s.phase === "dawn") && !app2.build.open) tavern(app2);
    if (app2.paused) pause(app2);
  }
  function dim(app2, a = 0.6) {
    const g = app2.b;
    g.globalAlpha = a;
    g.fillStyle = COL.ink;
    g.fillRect(0, 0, app2.W, app2.H);
    g.globalAlpha = 1;
  }
  function blockAll(app2) {
    app2.ui.block(0, 0, app2.W, app2.H, "modal");
  }
  function title(app2) {
    const { W: W2, H, safe } = app2;
    const A = app2.atlas;
    const ui = app2.ui;
    const f = app2.font;
    dim(app2, 0.35);
    blockAll(app2);
    const logo = A.frames["logo"];
    const ly = safe.t + Math.round(H * 0.12);
    if (logo) A.drawTL(app2.b, "logo", Math.round(W2 / 2 - logo.w / 2), ly);
    else A.get("logo");
    const bw = 120, bh = 26, x = Math.round(W2 / 2 - bw / 2);
    let y = Math.round(H * 0.5);
    ui.button("play", x, y, bw, bh, app2.tr("ui.play"), () => {
      app2.clearRun();
      app2.newRun();
    }, { icon: "icon_play" });
    y += bh + 6;
    const saved = app2.savedRun();
    const canContinue = isValidRun(saved);
    ui.button("continue", x, y, bw, bh, app2.tr("ui.continue"), () => app2.newRun(void 0, saved), { disabled: !canContinue, icon: "icon_fire" });
    y += bh + 6;
    ui.button("barracks", x, y, bw, bh, app2.tr("ui.barracks"), () => {
      app2.screen = "barracks";
    }, { icon: "icon_shield" });
    y += bh + 6;
    ui.button("settings", x, y, bw, bh, app2.tr("ui.settings"), () => {
      app2.settingsFrom = "title";
      app2.screen = "settings";
    }, { icon: "icon_settings" });
    A.drawTL(app2.b, "icon_ember", W2 / 2 - 22, H - safe.b - 26);
    f.draw(app2.b, String(app2.meta.ember), W2 / 2 - 4, H - safe.b - 21, { color: COL.fire });
    f.draw(app2.b, "web preview", W2 / 2, H - safe.b - 10, { align: "center", color: COL.dim });
  }
  function header(app2, text, y) {
    const f = app2.font, g = app2.b;
    f.draw(g, text, app2.W / 2, y, { align: "center", color: COL.gold });
  }
  function barracks(app2) {
    const { W: W2, H, safe } = app2;
    const A = app2.atlas;
    const ui = app2.ui;
    const f = app2.font;
    const g = app2.b;
    const m = app2.meta;
    dim(app2, 0.5);
    blockAll(app2);
    const px = safe.l + 4, pw = W2 - safe.l - safe.r - 8, py = safe.t + 4, ph = H - safe.t - safe.b - 8;
    A.nine(g, "ui_panel_stone", px, py, pw, ph);
    drawBig(app2, app2.tr("ui.barracks").toUpperCase(), W2 / 2, py + 6, COL.gold);
    A.drawTL(g, "icon_ember", px + pw - 46, py + 4);
    f.draw(g, String(m.ember), px + pw - 28, py + 9, { color: COL.fire });
    let y = py + 30;
    header(app2, app2.tr("ui.heroes"), y);
    y += 11;
    const cw = Math.floor((pw - 8) / 3), ch = 46;
    HERO_IDS.forEach((id, i) => {
      const cx = px + 4 + i % 3 * cw, cy = y + Math.floor(i / 3) * (ch + 2);
      const unlocked = m.unlockedHeroes.includes(id), starter = m.starterHero === id;
      const cost = HEROES[id].unlockEmber;
      A.nine(g, starter ? "ui_card_legendary" : unlocked ? "ui_card_rare" : "ui_card_common", cx, cy, cw - 2, ch);
      A.drawTL(g, `portrait_${id}`, cx + Math.round((cw - 2) / 2 - 12), cy + 3, { alpha: unlocked ? 1 : 0.4 });
      if (!unlocked) A.drawC(g, "icon_lock", cx + (cw - 2) / 2 + 10, cy + 22);
      f.draw(g, app2.tr(`hero.${id}.name`), cx + (cw - 2) / 2, cy + 28, { align: "center", color: starter ? COL.gold : COL.white });
      f.draw(g, starter ? app2.tr("ui.starter").split(" ")[0] : unlocked ? app2.tr("ui.unlocked") : String(cost), cx + (cw - 2) / 2, cy + 37, { align: "center", color: unlocked ? COL.green : m.ember >= cost ? COL.fire : COL.red });
      ui.add({ x: cx, y: cy, w: cw - 2, h: ch, id: `hero_${id}`, block: true, onTap: () => {
        if (unlocked) setStarterHero(m, id);
        else if (unlockHero(m, id)) app2.audio.sfx("levelup");
        else {
          app2.audio.sfx("fail");
          return;
        }
        app2.saveMeta();
      } });
    });
    y += 2 * (ch + 2) + 4;
    header(app2, app2.tr("ui.talents"), y);
    y += 11;
    const rowH = 15;
    for (const t2 of TALENTS) {
      const lv = m.talents[t2.id] ?? 0;
      const cost = talentCost(m, t2.id) ?? 0;
      f.draw(g, app2.tr(`talent.${t2.id}.name`), px + 6, y + 4, { color: COL.white });
      for (let i = 0; i < t2.maxLevel; i++) A.drawC(g, "ui_range_dot", px + pw - 70 + i * 6, y + 7, { alpha: i < lv ? 1 : 0.3 });
      if (lv < t2.maxLevel) ui.button(`tal_${t2.id}`, px + pw - 48, y, 42, 14, String(cost), () => {
        if (!buyTalent(m, t2.id)) {
          app2.audio.sfx("fail");
          return;
        }
        app2.saveMeta();
        app2.audio.sfx("upgrade");
      }, { disabled: m.ember < cost });
      else f.draw(g, app2.tr("ui.max"), px + pw - 27, y + 4, { align: "center", color: COL.green });
      y += rowH;
    }
    y += 3;
    header(app2, app2.tr("ui.blueprints"), y);
    y += 11;
    const bps = Object.keys(BUILDINGS).filter((id) => BUILDINGS[id].should);
    const bw = Math.floor((pw - 8) / bps.length);
    bps.forEach((id, i) => {
      const cx = px + 4 + i * bw, unlocked = m.unlockedBlueprints.includes(id), cost = BUILDINGS[id].blueprintCost;
      A.nine(g, unlocked ? "ui_card_rare" : "ui_card_common", cx, y, bw - 2, 58);
      g.save();
      g.beginPath();
      g.rect(cx + 2, y + 2, bw - 6, 36);
      g.clip();
      A.draw(g, buildingIcon(id), cx + (bw - 2) / 2, y + 40, { alpha: unlocked ? 1 : 0.45 });
      g.restore();
      f.draw(g, unlocked ? app2.tr("ui.unlocked").slice(0, 7) : String(cost), cx + (bw - 2) / 2, y + 46, { align: "center", color: unlocked ? COL.green : m.ember >= cost ? COL.fire : COL.red });
      ui.add({ x: cx, y, w: bw - 2, h: 58, id: `bp_${id}`, block: true, onTap: () => {
        if (!buyBlueprint(m, id)) {
          app2.audio.sfx("fail");
          return;
        }
        app2.saveMeta();
        app2.audio.sfx("upgrade");
      } });
    });
    ui.button("back", W2 / 2 - 40, py + ph - 30, 80, 24, app2.tr("ui.back"), () => {
      app2.screen = "title";
    });
  }
  function settings(app2) {
    const { W: W2, H, safe } = app2;
    const A = app2.atlas;
    const ui = app2.ui;
    const f = app2.font;
    const g = app2.b;
    const st2 = app2.meta.settings;
    dim(app2, 0.55);
    blockAll(app2);
    const pw = Math.min(W2 - 16, 180), px = Math.round(W2 / 2 - pw / 2), ph = 200, py = Math.round(H / 2 - ph / 2);
    A.nine(g, "ui_panel_parchment", px, py, pw, ph);
    f.draw(g, app2.tr("ui.settings"), W2 / 2, py + 7, { align: "center", color: COL.ink, shadow: null });
    let y = py + 24;
    const row = (label, value, minus, plus, id) => {
      f.draw(g, label, px + 8, y + 6, { color: COL.ink, shadow: null });
      if (minus) ui.button(`${id}-`, px + pw - 74, y, 20, 18, "-", minus);
      f.draw(g, value, px + pw - 42, y + 6, { align: "center", color: "#5a3a2e", shadow: null });
      ui.button(`${id}+`, px + pw - 28, y, 20, 18, minus ? "+" : "*", plus);
      y += 22;
    };
    const vol = (k, d) => {
      st2[k] = Math.max(0, Math.min(1, Math.round((st2[k] + d) * 10) / 10));
      app2.audio.setVolumes(st2.music, st2.sfx);
      app2.saveMeta();
    };
    row(app2.tr("ui.music"), `${Math.round(st2.music * 10)}`, () => vol("music", -0.1), () => vol("music", 0.1), "music");
    row(app2.tr("ui.sfx"), `${Math.round(st2.sfx * 10)}`, () => vol("sfx", -0.1), () => vol("sfx", 0.1), "sfx");
    row(app2.tr("ui.haptics"), st2.haptics ? app2.tr("ui.on") : app2.tr("ui.off"), null, () => {
      st2.haptics = !st2.haptics;
      app2.saveMeta();
    }, "hap");
    row(app2.tr("ui.bigText"), st2.bigText ? app2.tr("ui.on") : app2.tr("ui.off"), null, () => {
      st2.bigText = !st2.bigText;
      app2.saveMeta();
    }, "big");
    row(app2.tr("ui.language"), st2.lang.toUpperCase(), null, () => {
      st2.lang = st2.lang === "en" ? "vi" : "en";
      app2.saveMeta();
    }, "lang");
    ui.button("reset", px + 8, y + 2, pw - 16, 20, app2.tr("ui.resetData"), () => {
      if (window.confirm(app2.tr("ui.resetConfirm"))) {
        try {
          localStorage.clear();
        } catch {
        }
        app2.meta = app2.readMeta();
      }
    }, { color: COL.red });
    ui.button("settingsBack", W2 / 2 - 40, py + ph - 30, 80, 24, app2.tr("ui.back"), () => {
      app2.screen = app2.settingsFrom;
    });
  }
  function pause(app2) {
    const { W: W2, H } = app2;
    const ui = app2.ui;
    const g = app2.b;
    dim(app2, 0.55);
    blockAll(app2);
    const pw = 140, ph = 120, px = Math.round(W2 / 2 - pw / 2), py = Math.round(H / 2 - ph / 2);
    app2.atlas.nine(g, "ui_panel_stone", px, py, pw, ph);
    app2.font.draw(g, app2.tr("ui.pause"), W2 / 2, py + 8, { align: "center", color: COL.gold });
    ui.button("resume", px + 10, py + 24, pw - 20, 24, app2.tr("ui.resume"), () => {
      app2.paused = false;
    }, { icon: "icon_play" });
    ui.button("pauseSettings", px + 10, py + 52, pw - 20, 24, app2.tr("ui.settings"), () => {
      app2.settingsFrom = "game";
      app2.screen = "settings";
    }, { icon: "icon_settings" });
    ui.button("quit", px + 10, py + 80, pw - 20, 24, app2.tr("ui.quit"), () => {
      app2.saveRun();
      app2.toTitle();
    });
  }
  var RARITY_COL = { common: COL.white, rare: COL.ice, legendary: COL.gold };
  function boonPicker(app2) {
    const s = app2.state;
    const { W: W2, H, safe } = app2;
    const A = app2.atlas;
    const ui = app2.ui;
    const f = app2.font;
    const g = app2.b;
    dim(app2, 0.6);
    blockAll(app2);
    const offer = s.boonOffer;
    const dawn = s.boonSource !== "chest";
    const pw = W2 - safe.l - safe.r - 12, px = safe.l + 6;
    const cardH = 54;
    const headH = dawn ? 67 : 36;
    const ph = headH + offer.length * (cardH + 4) + 4;
    const py = Math.max(safe.t + 6, Math.round(H / 2 - ph / 2));
    A.nine(g, "ui_panel_stone", px, py, pw, ph);
    drawBig(app2, (dawn ? app2.tr("dawn.title") : app2.tr("chest.title")).toUpperCase(), W2 / 2, py + 6, COL.gold);
    let y = py + 28;
    if (dawn) {
      f.draw(g, app2.tr("dawn.summary", { n: s.night }), W2 / 2, y, { align: "center", color: COL.white });
      y += 11;
      const kills = `${s.stats.kills}`, gold = `${s.stats.goldEarned}`;
      const rowW = 16 + 2 + f.width(kills) + 10 + 16 + 2 + f.width(gold);
      let rx = Math.round(W2 / 2 - rowW / 2);
      A.drawTL(g, "icon_skull", rx, y - 4);
      rx += 18;
      f.draw(g, kills, rx, y + 1, { color: COL.white });
      rx += f.width(kills) + 10;
      A.drawTL(g, "icon_gold", rx, y - 4);
      rx += 18;
      f.draw(g, gold, rx, y + 1, { color: COL.gold });
      y += 16;
      f.draw(g, app2.tr("dawn.choose"), W2 / 2, y, { align: "center", color: COL.fire });
      y += 12;
    } else {
      f.draw(g, app2.tr("chest.choose"), W2 / 2, y - 2, { align: "center", color: COL.fire });
      y += 8;
    }
    offer.forEach((b, i) => {
      const cy = y + i * (cardH + 4);
      A.nine(g, `ui_card_${b.rarity}`, px + 4, cy, pw - 8, cardH);
      A.drawTL(g, `boon_${b.id}`, px + 10, cy + 6);
      f.draw(g, b.name, px + 32, cy + 6, { color: RARITY_COL[b.rarity] });
      f.draw(g, `${app2.tr(`boon.group.${b.group}`)} - ${app2.tr(`boon.rarity.${b.rarity}`)}`, px + 32, cy + 15, { color: COL.grey });
      if (b.maxStacks > 1) f.draw(g, app2.tr("boon.stacks", { n: b.stacks, m: b.maxStacks }), px + pw - 12, cy + 6, { align: "right", color: COL.grey });
      const lines = f.wrap(b.desc, pw - 22).slice(0, 3);
      f.drawLines(g, lines, px + 10, cy + 26, { color: COL.white });
      ui.add({ x: px + 4, y: cy, w: pw - 8, h: cardH, id: `boon_${i}`, block: true, onTap: () => {
        app2.audio.sfx("boon_pick");
        app2.cmd({ t: "pickBoon", index: i });
      } });
    });
  }
  function tavern(app2) {
    const s = app2.state;
    const { W: W2, H, safe } = app2;
    const ui = app2.ui;
    const f = app2.font;
    const g = app2.b;
    const A = app2.atlas;
    const offer = s.tavernOffer;
    const pw = 150, ph = 22 + offer.length * 28, px = Math.round(W2 / 2 - pw / 2), py = H - safe.b - 80 - ph;
    A.nine(g, "ui_panel_parchment", px, py, pw, ph);
    f.draw(g, app2.tr("tavern.title"), W2 / 2, py + 6, { align: "center", color: COL.ink, shadow: null });
    offer.forEach((o, i) => {
      const y = py + 18 + i * 28;
      A.drawTL(g, `portrait_${o.hero}`, px + 6, y);
      ui.button(`hire_${i}`, px + 34, y + 2, pw - 40, 20, app2.tr("tavern.hire", { n: o.cost }), () => app2.cmd({ t: "hire", index: i }), { disabled: s.res.gold < o.cost });
    });
  }
  function endScreen(app2) {
    const s = app2.state;
    const { W: W2, H, safe } = app2;
    const A = app2.atlas;
    const ui = app2.ui;
    const f = app2.font;
    const g = app2.b;
    dim(app2, 0.7);
    blockAll(app2);
    const win = s.phase === "victory";
    const pw = W2 - safe.l - safe.r - 16, px = safe.l + 8, ph = 210, py = Math.round(H / 2 - ph / 2);
    A.nine(g, win ? "ui_panel_parchment" : "ui_panel_stone", px, py, pw, ph);
    drawBig(app2, app2.tr(win ? "phase.victory" : "phase.defeat").toUpperCase(), W2 / 2, py + 8, win ? COL.gold : COL.red);
    f.draw(g, app2.tr(win ? "end.victory" : "end.defeat"), W2 / 2, py + 32, { align: "center", color: win ? COL.ink : COL.white, shadow: win ? null : void 0 });
    const rows = [
      ["icon_moon", "end.nights", s.stats.nightsSurvived],
      ["icon_skull", "end.bosses", s.stats.bosses],
      ["icon_shield", "end.camps", s.stats.camps],
      ["icon_sword", "end.kills", s.stats.kills],
      ["icon_hammer", "end.built", s.stats.built],
      ["icon_ember", "end.ember", `+${app2.game.emberEarned()}`]
    ];
    rows.forEach(([icon, key, v], i) => {
      const y = py + 46 + i * 17;
      A.drawTL(g, icon, px + 12, y);
      const c = win ? COL.ink : COL.white;
      f.draw(g, app2.tr(key), px + 32, y + 5, { color: c, shadow: win ? null : void 0 });
      f.draw(g, String(v), px + pw - 12, y + 5, { align: "right", color: key === "end.ember" ? COL.fire : c, shadow: win ? null : void 0 });
    });
    const by = py + ph - 32;
    if (win) {
      ui.button("endless", px + 8, by - 28, pw - 16, 24, app2.tr("end.endless"), () => app2.cmd({ t: "endless" }), { icon: "icon_moon" });
    }
    ui.button("toTitle", px + 8, by, pw - 16, 24, app2.tr("end.title"), () => app2.toTitle(), { icon: "icon_play" });
  }

  // tools/preview/src/ui.ts
  var UI = class {
    constructor(atlas, font, ctx) {
      this.atlas = atlas;
      this.font = font;
      this.ctx = ctx;
      this.hits = [];
      this.pressed = null;
      this.tapX = 0;
      this.tapY = 0;
    }
    begin() {
      this.hits = [];
    }
    add(h) {
      this.hits.push(h);
    }
    /** Area that swallows input (panels). */
    block(x, y, w, h, id = "block") {
      this.hits.push({ x, y, w, h, id, block: true });
    }
    at(px, py) {
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const h = this.hits[i];
        if (px >= h.x && py >= h.y && px < h.x + h.w && py < h.y + h.h) return h;
      }
      return null;
    }
    panel(x, y, w, h, kind = "parchment", alpha = 1) {
      this.atlas.nine(this.ctx, `ui_panel_${kind}`, x, y, w, h, void 0, alpha);
    }
    /** Button: 9-slice btn sprite + optional icon + label. Returns the rect. Touch targets ≥ 24 art px (≈88 design px). */
    button(id, x, y, w, h, label, onTap, o = {}) {
      x = Math.round(x);
      y = Math.round(y);
      const down = this.pressed === id;
      const spr = o.disabled ? "ui_btn_disabled" : down ? "ui_btn_down" : "ui_btn_up";
      this.atlas.nine(this.ctx, spr, x, y, w, h);
      const off = down ? 1 : 0;
      const tw = label ? this.font.width(label) : 0;
      const iw = o.icon ? 16 : 0;
      const gap = o.icon && label ? 2 : 0;
      let cx = Math.round(x + (w - tw - iw - gap) / 2);
      if (o.icon) {
        this.atlas.drawTL(this.ctx, o.icon, cx, Math.round(y + (h - 16) / 2) + off, { alpha: o.disabled ? 0.5 : 1 });
        cx += iw + gap;
      }
      if (label) this.font.draw(this.ctx, label, cx, Math.round(y + (h - 7) / 2) + off, { color: o.disabled ? COL.dim : o.color ?? COL.white, ...o.textOpts });
      this.add({ x, y, w, h, id, onTap: o.disabled ? void 0 : onTap, block: true });
      return { x, y, w, h };
    }
    iconButton(id, x, y, size, icon, onTap, o = {}) {
      return this.button(id, x, y, size, size, "", onTap, { icon, disabled: o.disabled });
    }
    text(t2, x, y, o) {
      return this.font.draw(this.ctx, t2, x, y, o);
    }
    /** Horizontal bar: ui_bar_frame 9-slice + ui_bar_fill_* 9-slice inside the frame's insets. h >= 8 recommended. */
    bar(x, y, w, h, r, fill) {
      const A = this.atlas;
      const fr = A.frames["ui_bar_frame"];
      const [l, t2, rr, b] = fr?.slice ?? [2, 2, 2, 2];
      const k = h < t2 + b + 2 ? 1 : 0;
      const L = k ? 1 : l, T2 = k ? 1 : t2, R2 = k ? 1 : rr, B2 = k ? 1 : b;
      A.nine(this.ctx, "ui_bar_frame", x, y, w, h, k ? 1 : void 0);
      const iw = Math.round((w - L - R2) * Math.max(0, Math.min(1, r)));
      const ih = h - T2 - B2;
      if (iw <= 0 || ih <= 0) return;
      const ff = A.frames[`ui_${fill}`];
      if (!ff) {
        A.get(`ui_${fill}`);
        return;
      }
      const [fl, ft, fr2, fb] = ff.slice ?? [1, 1, 1, 1];
      if (iw >= fl + fr2 + 1 && ih >= ft + fb + 2) A.nine(this.ctx, `ui_${fill}`, x + L, y + T2, iw, ih);
      else this.ctx.drawImage(A.img, ff.x + fl, ff.y + ft, 1, Math.max(1, ff.h - ft - fb), x + L, y + T2, iw, ih);
    }
  };

  // assets/scripts/core/bots/nav.ts
  var BLOCK_NODES = /* @__PURE__ */ new Set(["pine", "oak", "rock_l", "ore"]);
  function walkGrid(s) {
    const n = s.map.size;
    const g = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) if (s.map.biome[i] === "water") g[i] = 1;
    for (const nd of s.nodes) if (BLOCK_NODES.has(nd.kind)) g[nd.y * n + nd.x] = 1;
    for (const b of s.buildings) {
      if (b.id === "gate" || b.id === "trap_spikes" || b.id === "trap_tar") continue;
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) g[y * n + x] = 1;
    }
    for (const p of s.pois) if (p.kind === "cage" && p.active) g[p.y * n + p.x] = 1;
    return g;
  }
  function bfs(s, grid, sx, sy, goal, maxNodes = 4e3) {
    const n = s.map.size;
    const start = sy * n + sx;
    const prev = new Int32Array(n * n).fill(-2);
    const q = [start];
    prev[start] = -1;
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let h = 0; h < q.length && h < maxNodes; h++) {
      const c = q[h], x = c % n, y = c / n | 0;
      if (c !== start && goal(x, y)) {
        const path = [];
        for (let k = c; k !== start; k = prev[k]) path.push(k);
        return path.reverse();
      }
      for (const [dx, dy] of D) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx;
        if (prev[j] !== -2 || grid[j]) continue;
        if (dx && dy && (grid[y * n + nx] || grid[ny * n + x])) continue;
        prev[j] = c;
        q.push(j);
      }
    }
    if (goal(sx, sy)) return [];
    return null;
  }
  function leaderOf(s) {
    return s.heroes.find((h) => h.leader && h.anim !== "down" && h.hp > 0) ?? null;
  }
  function walkTo(game, wk, key, goal) {
    const s = game.state;
    const ld = leaderOf(s);
    if (!ld) return false;
    const n = s.map.size;
    const cx = Math.floor(ld.x), cy = Math.floor(ld.y);
    if (goal(cx, cy)) {
      game.cmd({ t: "move", dir: { x: 0, y: 0 } });
      wk.path = [];
      return true;
    }
    wk.age++;
    if (wk.key !== key || wk.age > 45 || !wk.path.length) {
      const p = bfs(s, walkGrid(s), cx, cy, goal);
      wk.path = p ?? [];
      wk.key = key;
      wk.age = 0;
      if (!p) {
        game.cmd({ t: "move", dir: { x: 0, y: 0 } });
        return false;
      }
    }
    while (wk.path.length && wk.path[0] === cy * n + cx) wk.path.shift();
    if (!wk.path.length) {
      game.cmd({ t: "move", dir: { x: 0, y: 0 } });
      return goal(cx, cy);
    }
    const c = wk.path[0];
    const tx = c % n + 0.5, ty = (c / n | 0) + 0.5;
    const dx = tx - ld.x, dy = ty - ld.y, d = Math.hypot(dx, dy);
    if (d < 0.25) {
      wk.path.shift();
    }
    const dir = d > 0 ? { x: dx / d, y: dy / d } : { x: 0, y: 0 };
    game.cmd({ t: "move", dir });
    return false;
  }
  function stop(game) {
    game.cmd({ t: "move", dir: { x: 0, y: 0 } });
  }

  // assets/scripts/core/bots/BotCore.ts
  var C = 28;
  var RING = { x0: 23, y0: 23, x1: 32, y1: 32 };
  var GATES = [{ x: 28, y: 23 }, { x: 27, y: 32 }];
  function ringCells() {
    const out = [];
    const { x0, y0, x1, y1 } = RING;
    for (let x = x0; x <= x1; x++) {
      out.push({ id: "wall_wood", x, y: y0 });
      out.push({ id: "wall_wood", x, y: y1 });
    }
    for (let y = y0 + 1; y < y1; y++) {
      out.push({ id: "wall_wood", x: x0, y });
      out.push({ id: "wall_wood", x: x1, y });
    }
    for (const p of out) if (GATES.some((g) => g.x === p.x && g.y === p.y)) p.id = "gate";
    return out;
  }
  function basePlan(extras) {
    const p = [];
    p.push({ id: "tower_arrow", x: 30, y: 26 });
    const ring = ringCells();
    p.push(...ring.slice(0, 18));
    p.push({ id: "tower_arrow", x: 30, y: 30 });
    p.push(...ring.slice(18));
    p.push({ id: "brazier", x: 24, y: 28 });
    p.push({ id: "tower_arrow", x: 25, y: 26 });
    p.push({ id: "tower_arrow", x: 25, y: 30 });
    p.push({ id: "tower_arrow", x: 28, y: 25 });
    p.push({ id: "tower_arrow", x: 27, y: 30 });
    if (extras) {
      p.push({ id: "tower_frost", x: 26, y: 24 });
      p.push({ id: "tower_frost", x: 29, y: 31 });
      p.push({ id: "tower_arrow", x: 24, y: 24 });
      p.push({ id: "tower_arrow", x: 31, y: 31 });
      p.push({ id: "tower_arrow", x: 31, y: 24 });
      p.push({ id: "tower_arrow", x: 24, y: 31 });
    }
    return p;
  }
  var states = /* @__PURE__ */ new WeakMap();
  function st(game, o) {
    let s = states.get(game);
    if (!s) {
      s = { wk: { path: [], key: "", age: 0 }, target: 0, plan: o.build ? basePlan(o.extras) : [], upgrades: [], lastBuildStep: -999, steps: 0, cageTarget: 0 };
      states.set(game, s);
    }
    return s;
  }
  function bldAt(s, x, y) {
    return s.buildings.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) ?? null;
  }
  function tryBuild(game, bs, o) {
    const s = game.state;
    for (const p of bs.plan) {
      const b = bldAt(s, p.x, p.y);
      if (b) continue;
      const chk = game.canPlace(p.id, p.x, p.y);
      if (chk.ok) {
        game.cmd({ t: "place", id: p.id, x: p.x, y: p.y });
        continue;
      }
      if (chk.reason === "cost") return;
    }
    const towers = s.buildings.filter((b) => b.id.startsWith("tower_")).sort((a, b) => a.uid - b.uid);
    const walls = s.buildings.filter((b) => b.id === "wall_wood").sort((a, b) => a.uid - b.uid);
    const hearth = s.buildings.find((b) => b.id === "hearth");
    const res = s.res;
    const afford = (c) => res.wood >= c.wood && res.stone >= c.stone && res.gold >= c.gold;
    const steps = [
      () => {
        for (const t2 of towers) if (t2.level === 1) {
          const c = game.buildingCost(t2.id, 2);
          if (!afford(c)) return false;
          game.cmd({ t: "upgrade", uid: t2.uid });
        }
        return true;
      },
      () => {
        if (hearth.level === 1) {
          const c = game.buildingCost("hearth", 2);
          if (!afford(c)) return false;
          game.cmd({ t: "upgrade", uid: hearth.uid });
        }
        return true;
      },
      () => {
        for (const wl of walls) {
          const c = game.buildingCost("wall_stone", 1);
          if (!afford(c)) return false;
          game.cmd({ t: "upgrade", uid: wl.uid });
        }
        return true;
      },
      () => {
        for (const t2 of towers) if (t2.level === 2) {
          const c = game.buildingCost(t2.id, 3);
          if (!afford(c)) return false;
          game.cmd({ t: "upgrade", uid: t2.uid });
        }
        return true;
      },
      () => {
        if (hearth.level === 2) {
          const c = game.buildingCost("hearth", 3);
          if (!afford(c)) return false;
          game.cmd({ t: "upgrade", uid: hearth.uid });
        }
        return true;
      }
    ];
    for (const f of steps) if (!f()) break;
    if (o.extras) {
      for (const b of s.buildings) if (b.hp < b.maxHp * 0.7 && b.id !== "hearth" && b.id !== "trap_spikes" && b.id !== "trap_tar") game.cmd({ t: "repair", uid: b.uid });
    }
  }
  function needStone(s) {
    return s.res.wood > 30 && s.res.stone * 3 < s.res.wood;
  }
  function harvestDay(game, bs, o) {
    const s = game.state;
    const ld = leaderOf(s);
    if (!ld) return;
    if (o.extras) {
      const cage = s.pois.find((p) => p.kind === "cage" && p.active && Math.hypot(p.x - C, p.y - C) < 15);
      if (cage) {
        if (walkTo(game, bs.wk, "cage" + cage.uid, (x, y) => Math.max(Math.abs(x - cage.x), Math.abs(y - cage.y)) === 1)) stop(game);
        return;
      }
    }
    let node = s.nodes.find((nd2) => nd2.uid === bs.target && nd2.hp > 0 && nd2.kind !== "stump");
    const wantStone = needStone(s);
    if (!node) {
      let best = null, bd = Infinity;
      for (const nd2 of s.nodes) {
        if (nd2.hp <= 0 || nd2.kind === "stump" || nd2.kind === "bush") continue;
        const isTree = nd2.kind === "pine" || nd2.kind === "oak";
        const isRock = nd2.kind.startsWith("rock");
        if (!isTree && !isRock && nd2.kind !== "ore") continue;
        const dh = Math.hypot(nd2.x + 0.5 - C, nd2.y + 0.5 - C);
        if (dh > 16 || dh < 6.5) continue;
        let d = Math.hypot(nd2.x + 0.5 - ld.x, nd2.y + 0.5 - ld.y) + dh * 0.5;
        if (wantStone && isTree) d += 6;
        if (!wantStone && isRock) d += 4;
        if (nd2.kind === "ore") d -= 2;
        if (d < bd) {
          bd = d;
          best = nd2;
        }
      }
      if (!best) {
        walkTo(game, bs.wk, "home", (x, y) => Math.hypot(x + 0.5 - C, y + 2.5 - C) < 1.2);
        return;
      }
      node = best;
      bs.target = best.uid;
    }
    const nd = node;
    if (walkTo(game, bs.wk, "n" + nd.uid, (x, y) => Math.abs(x - nd.x) + Math.abs(y - nd.y) === 1)) {
      const cx = Math.max(nd.x, Math.min(ld.x, nd.x + 1)), cy = Math.max(nd.y, Math.min(ld.y, nd.y + 1));
      const dx = cx - ld.x, dy = cy - ld.y, d = Math.hypot(dx, dy);
      if (d > 0.6) game.cmd({ t: "move", dir: { x: dx / d, y: dy / d } });
    }
  }
  function nightMove(game, bs, o) {
    const s = game.state;
    const ld = leaderOf(s);
    if (!ld) return;
    let tgt = null, bd = Infinity;
    for (const e of s.enemies) {
      const dh = Math.hypot(e.x - C, e.y - C);
      if (dh > (o.build ? 7 : 9)) continue;
      if (dh < bd) {
        bd = dh;
        tgt = e;
      }
    }
    if (tgt) {
      const t2 = tgt;
      walkTo(game, bs.wk, "e" + Math.floor(t2.x) + "," + Math.floor(t2.y), (x, y) => Math.hypot(x + 0.5 - t2.x, y + 0.5 - t2.y) < 1.6);
    } else walkTo(game, bs.wk, "home", (x, y) => Math.hypot(x + 0.5 - C, y + 0.5 - (C + 2.5)) < 1.2);
    if (o.extras && s.hornCharge >= 40 && s.enemies.filter((e) => Math.hypot(e.x - C, e.y - C) < 10).length >= 8) game.cmd({ t: "horn" });
  }
  function pickBoon2(game, o) {
    const offer = game.state.boonOffer;
    if (!offer) {
      if (game.state.phase === "dawn") game.cmd({ t: "pickBoon", index: 0 });
      return;
    }
    let best = 0, bi = Infinity;
    offer.forEach((b, i) => {
      const k = o.boonPref.indexOf(b.id);
      const r = k < 0 ? 100 + i : k;
      if (r < bi) {
        bi = r;
        best = i;
      }
    });
    game.cmd({ t: "pickBoon", index: best });
  }
  function botStep(game, o) {
    const s = game.state;
    const bs = st(game, o);
    bs.steps++;
    if (s.phase === "victory" || s.phase === "defeat") return;
    if (s.tutorial >= 0) game.cmd({ t: "skipTutorial" });
    if (s.boonOffer) {
      pickBoon2(game, o);
      return;
    }
    switch (s.phase) {
      case "day":
        if (o.build && bs.steps - bs.lastBuildStep > 30) {
          bs.lastBuildStep = bs.steps;
          tryBuild(game, bs, o);
        }
        harvestDay(game, bs, o);
        if (!o.build && s.phaseT > 20) game.cmd({ t: "callNight" });
        break;
      case "dusk":
        if (o.build) tryBuild(game, bs, o);
        stop(game);
        game.cmd({ t: "startNight" });
        break;
      case "night":
        if (o.build && bs.steps - bs.lastBuildStep > 90 && o.extras) {
          bs.lastBuildStep = bs.steps;
          tryBuild(game, bs, o);
        }
        nightMove(game, bs, o);
        break;
      case "dawn":
        pickBoon2(game, o);
        break;
    }
  }

  // assets/scripts/core/bots/index.ts
  var PREF = ["reload", "hawk", "sharp", "boulder", "mirror", "thick", "living", "falsedawn", "twin", "bigfire", "mason", "rebirth", "spikes", "ash", "leech", "cooldown", "harvest", "embers"];
  var AutoplayBot = (game) => botStep(game, { build: true, extras: true, boonPref: PREF });

  // tools/preview/src/bots.ts
  var autoplayBot = AutoplayBot;
  function clearNight(g) {
    const w = worldOf(g), s = w.s;
    s.enemies = [];
    w.emap.clear();
    s.projectiles = [];
    s.zones = [];
    s.boss = null;
    s.allies = s.allies.filter((a) => a.id !== "militia");
    w.r.spawn = [];
    w.r.spawnIdx = 0;
    s.enemiesLeft = 0;
  }
  function gotoPhase(g, phase, night) {
    const w = worldOf(g), s = w.s;
    if (s.phase === "victory" || s.phase === "defeat") {
      if (phase !== "victory" && phase !== "defeat") {
        w.hearth.hp = w.hearth.maxHp;
      }
    }
    if (night !== void 0 && night !== s.night) {
      s.night = Math.max(1, Math.floor(night));
      s.stats.nightsSurvived = Math.max(s.stats.nightsSurvived, s.night - 1);
    }
    const rifts = riftPois(w);
    rifts.forEach((p, i) => {
      p.active = i < BALANCE.riftsActive(s.night);
    });
    s.boonOffer = null;
    s.boonSource = null;
    switch (phase) {
      case "day":
        clearNight(g);
        startDay(w);
        break;
      case "dusk":
        clearNight(g);
        if (s.phase !== "day") startDay(w);
        startDusk(w);
        break;
      case "night":
        clearNight(g);
        if (s.phase !== "day") startDay(w);
        startDusk(w);
        startNight(w);
        break;
      case "dawn":
        clearNight(g);
        startDawn(w);
        break;
      case "defeat":
        w.hearth.hp = 0;
        defeat(w);
        break;
      case "victory":
        clearNight(g);
        victory(w);
        break;
    }
    w.lightDirty = true;
  }
  function spawnCrowd(g, n) {
    const w = worldOf(g);
    const rifts = riftPois(w).filter((p) => p.active);
    const kinds = ["gloomling", "skitter", "spitter", "brute", "wisp", "bomber", "snuffer"];
    let k = 0;
    for (let i = 0; i < n; i++) {
      const r = rifts[i % Math.max(1, rifts.length)] ?? { x: w.size / 2, y: 4 };
      const e = spawnEnemy(w, kinds[i % kinds.length], r.x + 0.5 + i * 7 % 11 / 6 - 0.9, r.y + 0.5 + i * 5 % 13 / 7 - 0.9, { wave: true });
      if (e) k++;
    }
    return k;
  }

  // tools/preview/src/autoplay.ts
  var Autoplay = class {
    constructor(app2) {
      this.app = app2;
      this.on = false;
      this.acc = 0;
    }
    set(on) {
      this.on = on;
      this.acc = 0;
      if (on) {
        this.app.build.exit();
        this.app.joy = null;
        this.app.paused = false;
      } else this.app.cmd({ t: "move", dir: { x: 0, y: 0 } });
    }
    /** Advances the sim by dt real seconds (× speed × timeScale) with bot decisions per step. */
    tick(dt) {
      const g = this.app.game;
      if (!g) return;
      const s = g.state;
      if (s.phase === "dusk" || s.phase === "dawn") {
        autoplayBot(g);
        g.step();
        return;
      }
      this.acc += Math.min(0.25, dt) * this.app.speed * s.timeScale;
      let n = 0;
      while (this.acc >= DT && n < 24) {
        autoplayBot(g);
        g.step();
        this.acc -= DT;
        n++;
      }
      if (n >= 24) this.acc = 0;
    }
    alpha() {
      return Math.max(0, Math.min(1, this.acc / DT));
    }
  };

  // tools/preview/src/app.ts
  var App = class {
    constructor() {
      this.buf = document.createElement("canvas");
      this.n = 2;
      this.zoomIdx = 1;
      this.W = 195;
      this.H = 422;
      this.dpr = 1;
      this.safe = { t: 0, b: 0, l: 0, r: 0 };
      this.atlas = new Atlas();
      this.audio = new Audio();
      this.screen = "loading";
      this.settingsFrom = "title";
      this.paused = false;
      this.game = null;
      this.demo = null;
      this.seedN = 1;
      this.speed = 1;
      this.time = 0;
      this.cam = { x: 0, y: 0 };
      // world art px at screen centre
      this.camVel = { x: 0, y: 0 };
      this.moveDir = { x: 0, y: 0 };
      this.sentDir = { x: 0, y: 0 };
      this.keys = /* @__PURE__ */ new Set();
      this.pointers = /* @__PURE__ */ new Map();
      this.joy = null;
      this.pinch = null;
      this.emberCredited = false;
      this.tutorialHidden = false;
      this.omensOpen = true;
      this.errors = [];
      this.frameTimes = [];
      this.lastPhase = "";
      this.hearthLowT = 0;
      this.minimapBig = false;
      this.bossIntro = null;
      /** debug/e2e camera override (tile units) */
      this.camFocus = null;
      // ── main loop ───────────────────────────────────────────────────────────
      this.last = 0;
      this.frame = (now) => {
        requestAnimationFrame(this.frame);
        const dtReal = this.last ? Math.min(0.1, (now - this.last) / 1e3) : 1 / 60;
        this.last = now;
        this.frameTimes.push(dtReal);
        if (this.frameTimes.length > 90) this.frameTimes.shift();
        try {
          this.tick(dtReal);
          this.render();
        } catch (e) {
          this.reportError(e);
        }
      };
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d", { alpha: false });
      this.b = this.buf.getContext("2d");
      this.font = new BitmapFont(this.atlas);
      this.fx = new Fx(this.atlas, this.font);
      this.world = new WorldRenderer(this.atlas, this.fx);
      this.ui = new UI(this.atlas, this.font, this.b);
      this.build = new BuildUI(this);
      this.autoplay = new Autoplay(this);
      this.meta = this.readMeta();
    }
    get state() {
      return this.game ? this.game.state : null;
    }
    get lang() {
      return this.meta.settings.lang || "en";
    }
    tr(key, params) {
      return t(key, this.lang, params);
    }
    // ── persistence ─────────────────────────────────────────────────────────
    readMeta() {
      let raw = null;
      try {
        raw = localStorage.getItem(META_KEY);
      } catch {
      }
      try {
        return loadMeta(raw);
      } catch {
        return defaultMeta();
      }
    }
    saveMeta() {
      try {
        localStorage.setItem(META_KEY, JSON.stringify(this.meta));
      } catch {
      }
    }
    savedRun() {
      try {
        return localStorage.getItem(RUN_KEY);
      } catch {
        return null;
      }
    }
    saveRun() {
      if (!this.game) return;
      try {
        localStorage.setItem(RUN_KEY, this.game.saveRun());
      } catch {
      }
    }
    clearRun() {
      try {
        localStorage.removeItem(RUN_KEY);
      } catch {
      }
    }
    // ── lifecycle ───────────────────────────────────────────────────────────
    async boot() {
      await this.atlas.load("resources");
      this.audio.init("resources").catch(() => void 0);
      this.demo = createGame({ seed: 7, meta: defaultMeta() });
      this.screen = "title";
      this.fx.fade = 1;
    }
    newRun(seed, saved) {
      this.seedN = seed ?? Date.now() % 1e5;
      let game;
      try {
        game = createGame({ seed: this.seedN, meta: this.meta, saved: saved ?? void 0 });
      } catch (e) {
        if (!saved) throw e;
        console.warn("[preview] saved run unreadable, starting fresh:", e.message);
        this.clearRun();
        game = createGame({ seed: this.seedN, meta: this.meta });
      }
      this.game = game;
      this.seedN = game.state.seed;
      this.screen = "game";
      this.paused = false;
      this.emberCredited = false;
      this.lastPhase = "";
      this.build.reset();
      this.camFocus = null;
      this.fx = Object.assign(this.fx, new Fx(this.atlas, this.font));
      this.world.attacked.clear();
      const s = game.state;
      const h = s.buildings.find((b) => b.uid === s.hearthUid);
      if (h) {
        this.cam.x = (h.x + h.w / 2) * T;
        this.cam.y = (h.y + h.h / 2) * T;
      }
      this.fx.fade = 1;
      this.audio.music("day");
    }
    toTitle() {
      this.game = null;
      this.camFocus = null;
      this.screen = "title";
      this.paused = false;
      this.autoplay.on = false;
      this.fx.fade = 1;
      this.build.reset();
      this.audio.music("day");
    }
    cmd(c) {
      this.game?.cmd(c);
    }
    alpha() {
      return this.autoplay.on ? this.autoplay.alpha() : this.game ? this.game.alpha() : 0;
    }
    // ── layout ──────────────────────────────────────────────────────────────
    resize() {
      const dpr = window.devicePixelRatio || 1;
      const cw = Math.max(1, Math.round(window.innerWidth * dpr)), ch = Math.max(1, Math.round(window.innerHeight * dpr));
      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw;
        this.canvas.height = ch;
      }
      this.dpr = dpr;
      const n = zoomSteps(basePixelScale(cw))[this.screen === "game" ? this.zoomIdx : 0];
      this.n = n;
      const W2 = Math.ceil(cw / n), H = Math.ceil(ch / n);
      if (this.buf.width !== W2 || this.buf.height !== H) {
        this.buf.width = W2;
        this.buf.height = H;
      }
      this.W = W2;
      this.H = H;
      const el = document.getElementById("safe");
      if (el) {
        const r = el.getBoundingClientRect();
        const k = dpr / n;
        this.safe = { t: Math.ceil(r.top * k), l: Math.ceil(r.left * k), b: Math.ceil((window.innerHeight - r.bottom) * k), r: Math.ceil((window.innerWidth - r.right) * k) };
      }
    }
    toArt(cx, cy) {
      return [Math.floor(cx * this.dpr / this.n), Math.floor(cy * this.dpr / this.n)];
    }
    /** world art px → screen art px */
    camRect() {
      return { x: Math.round(this.cam.x - this.W / 2), y: Math.round(this.cam.y - this.H / 2), w: this.W, h: this.H };
    }
    screenToTile(px, py) {
      const c = this.camRect();
      return { x: (px + c.x) / T, y: (py + c.y) / T };
    }
    tileToScreen(tx, ty) {
      const c = this.camRect();
      return { x: tx * T - c.x, y: ty * T - c.y };
    }
    reportError(e) {
      const msg = e?.stack || String(e);
      if (this.errors.length < 50) this.errors.push(msg);
      console.error("[preview]", msg);
    }
    fps() {
      const s = this.frameTimes.reduce((a, b) => a + b, 0);
      return s > 0 ? this.frameTimes.length / s : 0;
    }
    tick(dt) {
      this.resize();
      this.time += dt;
      this.fx.update(dt);
      if (this.screen === "title" && this.demo) {
        this.demo.update(dt);
        this.demo.drainEvents();
      }
      if (this.screen !== "game" || !this.game) return;
      const g = this.game, s = g.state;
      if (!this.autoplay.on) this.updateMove();
      if (!this.paused) {
        if (this.fx.hitStop > 0) this.fx.hitStop -= dt;
        else if (this.autoplay.on) this.autoplay.tick(dt);
        else g.update(dt * this.speed);
      }
      for (const ev of g.drainEvents()) this.onEvent(ev);
      for (const [k, v] of this.world.attacked) {
        if (v - dt <= 0) this.world.attacked.delete(k);
        else this.world.attacked.set(k, v - dt);
      }
      if (s.phase !== this.lastPhase) this.onPhase(s.phase, this.lastPhase);
      this.lastPhase = s.phase;
      if (s.phase === "dusk" && !this.build.open && !this.autoplay.on) this.build.enter();
      if ((s.phase === "dawn" || s.phase === "victory" || s.phase === "defeat") && this.build.open) this.build.exit();
      if (s.phase === "defeat" || s.phase === "victory") this.creditEmber();
      this.updateCamera(dt);
      this.build.tick(dt);
      if (this.bossIntro) {
        this.bossIntro.t += dt;
        if (this.bossIntro.t > 1.8) this.bossIntro = null;
      }
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
        if (m > 0.12) {
          const k = Math.min(1, m) / m;
          dx = jx * k;
          dy = jy * k;
        }
      } else {
        if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= 1;
        if (this.keys.has("d") || this.keys.has("arrowright")) dx += 1;
        if (this.keys.has("w") || this.keys.has("arrowup")) dy -= 1;
        if (this.keys.has("s") || this.keys.has("arrowdown")) dy += 1;
        const m = Math.hypot(dx, dy);
        if (m > 1) {
          dx /= m;
          dy /= m;
        }
      }
      if (this.build.open && this.state?.phase === "dusk") {
        dx = 0;
        dy = 0;
      }
      this.moveDir = { x: dx, y: dy };
      if (Math.abs(dx - this.sentDir.x) > 0.02 || Math.abs(dy - this.sentDir.y) > 0.02) {
        this.sentDir = { x: dx, y: dy };
        this.cmd({ t: "move", dir: { x: dx, y: dy } });
      }
    }
    updateCamera(dt) {
      const s = this.state;
      let tx, ty;
      const hearth = s.buildings.find((b) => b.uid === s.hearthUid);
      const leader2 = s.heroes.find((h) => h.leader) ?? s.heroes[0];
      if (this.build.open && this.build.freeCam) return;
      if (this.camFocus) {
        tx = this.camFocus.x * T;
        ty = this.camFocus.y * T;
      } else if ((s.phase === "dusk" || !leader2) && hearth) {
        tx = (hearth.x + hearth.w / 2) * T;
        ty = (hearth.y + hearth.h / 2) * T;
      } else if (leader2) {
        const la = lookAhead(this.moveDir);
        const a = this.alpha();
        tx = (leader2.px + (leader2.x - leader2.px) * a + la.x) * T;
        ty = (leader2.py + (leader2.y - leader2.py) * a + la.y) * T;
      } else return;
      const k = smoothFactor(dt);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
      this.clampCam();
    }
    clampCam() {
      const s = this.state;
      if (!s) return;
      const c = clampCamera({ x: this.cam.x / T, y: this.cam.y / T }, s.map.size, this.W / T, this.H / T, 2);
      this.cam.x = c.x * T;
      this.cam.y = c.y * T;
    }
    // ── events → juice + audio ──────────────────────────────────────────────
    onPhase(p, prev) {
      const s = this.state;
      if (p === "night") {
        this.fx.banner(this.tr("banner.night", { n: s.night }), void 0, COL.purple);
        this.audio.sfx("horn_night");
        this.audio.music(s.boss ? "boss" : "night");
      }
      if (p === "day" && prev === "dawn") this.saveRun();
      if (p === "day" && prev) {
        this.audio.music("day");
        this.fx.banner(this.tr("phase.day") + " " + s.night, void 0, COL.gold, 1.6);
      }
      if (p === "dusk") this.omensOpen = true;
      if (p === "dawn") this.audio.music("day");
      if (p === "victory") {
        this.audio.sfx("victory");
        this.fx.fade = 1;
      }
      if (p === "defeat") {
        this.audio.sfx("defeat");
        this.fx.fade = 1;
      }
      this.fx.fade = Math.max(this.fx.fade, 0.6);
    }
    hudTarget(res) {
      const y0 = this.safe.t + 16;
      return [this.safe.l + 11, y0 + (res === "wood" ? 0 : res === "stone" ? 11 : 22) + 5];
    }
    onEvent(ev) {
      const fx = this.fx, au = this.audio;
      const W2 = (x, y) => ({ x: x * T, y: y * T });
      const vib = (ms) => {
        if (this.meta.settings.haptics && navigator.vibrate) try {
          navigator.vibrate(ms);
        } catch {
        }
      };
      const s = this.state;
      switch (ev.t) {
        case "hit": {
          fx.hit(ev.target);
          const p = W2(ev.x, ev.y);
          const col = ev.shatter ? COL.ice : ev.crit ? COL.gold : ev.dtype === "fire" ? COL.fire : ev.dtype === "frost" ? COL.ice : ev.dtype === "spark" ? COL.purple : COL.white;
          if (s.buildings.some((b) => b.uid === ev.target)) {
            this.world.attacked.set(ev.target, 3);
            if (ev.target === s.hearthUid) vib(20);
          } else {
            const big = ev.crit || ev.shatter;
            fx.number(String(Math.round(ev.amount)) + (big ? "!" : ""), p.x, p.y - 12, col, big || ev.amount >= 10 ? 7 : 5);
            fx.anim("fx_hit", p.x, p.y - 6, 20);
          }
          if (ev.crit) fx.stop(0.04);
          au.sfx("enemy_hit", 0.5);
          break;
        }
        case "death": {
          const p = W2(ev.x, ev.y);
          if (ev.kind === "enemy") {
            fx.shatter(this.atlas.pick(`enemy_${ev.id}_move_0`, `boss_${ev.id}_walk_0`, `boss_${ev.id}_float_0`), p.x, p.y + 3, 4 + (ev.x * 7 | 0) % 3);
            fx.anim("fx_smoke", p.x, p.y - 4, 12);
            au.sfx("enemy_die", 0.7);
            if (ev.id === "mossback" || ev.id === "unlit") {
              fx.shake(4, 0.6);
              fx.stop(0.08);
            }
          } else if (ev.kind === "building") {
            const stone = ev.id.includes("stone") || ev.id.startsWith("tower") || ev.id === "quarry";
            for (let i = 0; i < 3; i++) fx.anim(stone ? "fx_chip_stone" : "fx_chip_wood", p.x + (i - 1) * 5, p.y - 4 - i * 2, 10);
            fx.anim("fx_smoke", p.x, p.y - 6, 10);
            fx.anim("fx_dust", p.x, p.y, 12);
            fx.shatter(this.atlas.pick(`bld_${ev.id}_l1`, `bld_${ev.id}_0`, "bld_wall_wood_0"), p.x, p.y + 8, 6);
            fx.shake(2, 0.2);
            au.sfx("wall_break");
            vib(30);
          } else {
            fx.anim("fx_dust", p.x, p.y, 10);
            au.sfx("hero_down");
          }
          break;
        }
        case "shoot":
          au.sfx(`shoot_${ev.kind}`, 0.45);
          break;
        case "explode": {
          const p = W2(ev.x, ev.y);
          fx.anim("fx_explosion", p.x, p.y - 6, 16);
          fx.shake(ev.radius >= 1.5 ? 3 : 2, 0.25);
          if (ev.radius >= 1.5) fx.stop(0.04);
          au.sfx("explode");
          vib(25);
          break;
        }
        case "harvest": {
          const p = W2(ev.x, ev.y);
          fx.anim(ev.res === "wood" ? "fx_chip_wood" : "fx_chip_stone", p.x, p.y - 8, 12);
          const c = this.camRect();
          const [hx, hy] = this.hudTarget(ev.res);
          fx.fly(`icon_${ev.res}`, p.x - c.x, p.y - 10 - c.y, hx, hy, 0, () => fx.pulse(ev.res));
          au.sfx(ev.res === "wood" ? "chop" : ev.res === "stone" ? "mine" : "coin", 0.6);
          break;
        }
        case "gold": {
          const p = W2(ev.x, ev.y), c = this.camRect();
          const [hx, hy] = this.hudTarget("gold");
          for (let i = 0; i < Math.min(5, Math.max(1, Math.round(ev.amount))); i++) fx.fly("icon_gold", p.x - c.x + (i - 2) * 3, p.y - 8 - c.y, hx, hy, i * 0.06, () => fx.pulse("gold"));
          fx.anim("fx_coin", p.x, p.y - 8, 16, 2);
          au.sfx("coin", 0.5);
          break;
        }
        case "built": {
          const p = W2(ev.x, ev.y);
          fx.bounce.set(ev.uid, 0);
          fx.anim("fx_dust", p.x + 8, p.y + 14, 14);
          au.sfx("place", 0.8);
          vib(10);
          break;
        }
        case "buildFail": {
          const p = W2(ev.x, ev.y);
          fx.number(this.tr(`build.fail.${ev.reason}`), p.x + 8, p.y, COL.red, 5);
          au.sfx("fail");
          break;
        }
        case "upgraded": {
          fx.bounce.set(ev.uid, 0);
          const b = s.buildings.find((q) => q.uid === ev.uid);
          if (b) fx.anim("fx_levelup", (b.x + b.w / 2) * T, (b.y + b.h) * T - 8, 12);
          au.sfx("upgrade");
          break;
        }
        case "repaired": {
          const b = s.buildings.find((q) => q.uid === ev.uid);
          if (b) fx.anim("fx_heal", (b.x + b.w / 2) * T, (b.y + b.h / 2) * T, 8, 2);
          au.sfx("repair");
          break;
        }
        case "sold":
          au.sfx("sell");
          break;
        case "levelUp": {
          const h = s.heroes.find((q) => q.uid === ev.hero);
          if (h) {
            fx.anim("fx_levelup", h.x * T, h.y * T - 6, 12, 2);
            fx.number("LV UP", h.x * T, h.y * T - 18, COL.gold, 5);
          }
          au.sfx("levelup");
          break;
        }
        case "skill": {
          const p = W2(ev.x, ev.y);
          const m = { shieldBash: "fx_slash", shadowStep: "fx_blink", arrowRain: "fx_hit", miniTurret: "fx_dust", sanctum: "fx_heal", fireWall: "fx_burn" };
          fx.anim(m[ev.skill] ?? "fx_hit", p.x, p.y - 6, 14);
          au.sfx(`skill_${ev.skill}`, 0.8);
          break;
        }
        case "phase":
          break;
        // handled by onPhase (state-driven)
        case "bossIntro":
          this.bossIntro = { name: this.tr(`enemy.${ev.id}.name`), t: 0 };
          fx.shake(4, 1);
          au.sfx("boss_roar");
          au.music("boss");
          vib(200);
          break;
        case "brazier":
          au.sfx(ev.lit ? "brazier_on" : "brazier_off");
          break;
        case "horn":
          au.sfx("horn_rally");
          fx.banner(this.tr("hud.horn"), void 0, COL.gold, 1.2);
          for (const h of s.heroes) fx.anim("fx_levelup", h.x * T, h.y * T - 6, 14);
          break;
        case "poi": {
          const p = s.pois.find((q) => q.uid === ev.uid);
          if (p) {
            fx.anim("fx_explosion", (p.x + 0.5) * T, (p.y + 0.5) * T, 16);
          }
          if (ev.action === "freed" && p?.data?.hero) fx.banner(this.tr("cage.freed", { name: this.tr(`hero.${String(p.data.hero)}.name`) }), void 0, COL.gold);
          if (ev.kind === "root" && ev.action === "destroyed") fx.banner(this.tr("root.destroyed"), void 0, COL.purple, 2.4);
          au.sfx("poi");
          break;
        }
        case "shrine":
          fx.banner(this.tr(`shrine.${ev.buff}`), void 0, COL.gold, 2.4);
          au.sfx("levelup");
          break;
        case "boonOffer":
          au.sfx("ui_open");
          break;
        case "hearthLow":
          fx.banner(this.tr("hud.hearthLow"), void 0, COL.red, 1.6);
          vib(100);
          break;
        case "tutorial":
          this.tutorialHidden = false;
          break;
        case "falseDawn":
          fx.banner(this.tr("boon.falsedawn.name"), void 0, COL.gold);
          fx.shake(3, 0.4);
          break;
        case "pulse": {
          const p = W2(ev.x, ev.y);
          fx.anim("fx_explosion", p.x, p.y, 10);
          fx.shake(3, 0.4);
          au.sfx("pulse");
          break;
        }
        case "teleport": {
          const p = W2(ev.x, ev.y);
          fx.anim("fx_blink", p.x, p.y - 6, 14);
          break;
        }
        case "heal": {
          const p = W2(ev.x, ev.y);
          if (ev.amount >= 1) fx.number("+" + Math.round(ev.amount), p.x, p.y - 14, COL.green, 5);
          fx.anim("fx_heal", p.x, p.y - 8, 8, 1);
          break;
        }
        case "hired":
          au.sfx("levelup");
          break;
        case "enrage":
          fx.banner(this.tr("banner.enrage"), void 0, COL.red);
          break;
      }
    }
    // ── render ──────────────────────────────────────────────────────────────
    render() {
      const g = this.b;
      g.imageSmoothingEnabled = false;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = COL.ink;
      g.fillRect(0, 0, this.W, this.H);
      this.ui.begin();
      const shown = this.screen === "game" ? this.game : this.screen === "loading" ? null : this.demo;
      if (shown) this.renderWorld(shown, this.screen !== "game");
      if (this.screen === "game" && this.game) {
        this.build.drawWorldOverlay();
        drawHud(this);
        this.build.drawUI();
      }
      drawScreens(this);
      if (this.fx.fade > 0) {
        g.globalAlpha = Math.min(1, this.fx.fade);
        g.fillStyle = COL.ink;
        g.fillRect(0, 0, this.W, this.H);
        g.globalAlpha = 1;
      }
      const c = this.ctx;
      c.imageSmoothingEnabled = false;
      c.drawImage(this.buf, 0, 0, this.W * this.n, this.H * this.n);
    }
    renderWorld(game, demo) {
      const s = game.state, g = this.b;
      if (demo) {
        const h = s.buildings.find((b) => b.uid === s.hearthUid);
        if (h) {
          this.cam.x = (h.x + 1) * T + Math.sin(this.time * 0.07) * 40;
          this.cam.y = (h.y + 1) * T + Math.cos(this.time * 0.05) * 30 - 30;
        }
      }
      const [shx, shy] = this.fx.shakeOffset(this.time);
      const base = this.camRect();
      const cam = { ...base, x: base.x + shx, y: base.y + shy };
      const a = game === this.game ? this.alpha() : game.alpha();
      this.world.drawGround(g, s, cam, this.time);
      this.world.drawFloor(g, s, cam, this.time);
      this.world.drawZones(g, s, cam, this.time);
      if (!demo) this.build.drawGroundOverlay(cam);
      g.save();
      g.translate(-cam.x, -cam.y);
      this.fx.drawWorld(g, false);
      g.restore();
      this.world.drawEntities(g, s, cam, a, this.time);
      this.world.drawProjectiles(g, s, cam, a, this.time);
      g.save();
      g.translate(-cam.x, -cam.y);
      this.fx.drawWorld(g, true);
      g.restore();
      this.world.light.draw(g, s, cam.x, cam.y, this.time);
      this.world.drawVeiled(g, s, cam, a, this.time);
      g.save();
      g.translate(-cam.x, -cam.y);
      this.fx.drawNumbers(g);
      g.restore();
    }
    // ── input ───────────────────────────────────────────────────────────────
    installInput() {
      const c = this.canvas;
      c.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        try {
          c.setPointerCapture(e.pointerId);
        } catch {
        }
        this.audio.unlock();
        this.onDown(e);
      });
      c.addEventListener("pointermove", (e) => {
        e.preventDefault();
        this.onMove(e);
      });
      c.addEventListener("pointerup", (e) => {
        e.preventDefault();
        this.onUp(e, false);
      });
      c.addEventListener("pointercancel", (e) => {
        this.onUp(e, true);
      });
      c.addEventListener("contextmenu", (e) => e.preventDefault());
      c.addEventListener("wheel", (e) => {
        e.preventDefault();
        this.zoomIdx = Math.max(0, Math.min(2, this.zoomIdx + (e.deltaY < 0 ? 1 : -1)));
      }, { passive: false });
      window.addEventListener("keydown", (e) => {
        this.audio.unlock();
        this.keys.add(e.key.toLowerCase());
        this.onKey(e.key.toLowerCase());
      });
      window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
      window.addEventListener("blur", () => this.keys.clear());
    }
    onKey(k) {
      const s = this.state;
      if (this.screen !== "game" || !s) return;
      if (k === "escape") this.paused = !this.paused;
      if (k === "b") this.build.toggle();
      if (k === "h") this.cmd({ t: "horn" });
      if (k === "n") this.cmd(s.phase === "dusk" ? { t: "startNight" } : { t: "callNight" });
      if (k >= "1" && k <= "3" && s.boonOffer) this.cmd({ t: "pickBoon", index: Number(k) - 1 });
    }
    onDown(e) {
      const [x, y] = this.toArt(e.clientX, e.clientY);
      const p = { id: e.pointerId, x, y, sx: x, sy: y, t0: performance.now(), moved: false, role: "none" };
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 2 && this.screen === "game") {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, idx0: this.zoomIdx };
        this.joy = null;
        this.build.cancelGesture();
        for (const q of this.pointers.values()) q.role = "pan";
        return;
      }
      const hit = this.ui.at(x, y);
      if (hit) {
        p.role = "ui";
        p.hitId = hit.id;
        this.ui.pressed = hit.id;
        hit.onDown?.(x, y);
        return;
      }
      if (this.screen !== "game" || !this.game || this.paused || this.game.state.boonOffer) return;
      if (this.build.open) {
        p.role = "build";
        this.build.down(x, y);
        return;
      }
      if (this.autoplay.on) return;
      if (y > this.H * 0.35) {
        p.role = "joy";
        this.joy = { ox: x, oy: y, kx: x, ky: y };
      }
    }
    onMove(e) {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const [x, y] = this.toArt(e.clientX, e.clientY);
      const dx = x - p.x, dy = y - p.y;
      p.x = x;
      p.y = y;
      if (Math.hypot(x - p.sx, y - p.sy) > 3) p.moved = true;
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomIdx = pinchStep(this.pinch.idx0, d / this.pinch.d0);
        if (this.build.open) {
          this.cam.x -= dx / 2;
          this.cam.y -= dy / 2;
          this.clampCam();
        }
        return;
      }
      if (p.role === "joy" && this.joy) {
        const r = 22, ox = x - this.joy.ox, oy = y - this.joy.oy, m = Math.hypot(ox, oy);
        if (m > r) {
          this.joy.kx = this.joy.ox + ox / m * r;
          this.joy.ky = this.joy.oy + oy / m * r;
        } else {
          this.joy.kx = x;
          this.joy.ky = y;
        }
      } else if (p.role === "build") this.build.move(x, y, dx, dy);
      else if (p.role === "ui") {
        const h = this.ui.hits.find((q) => q.id === p.hitId);
        if (h?.onDrag) h.onDrag(dx, dy, x, y);
      }
    }
    onUp(e, cancel) {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (!p) return;
      if (p.role === "ui") {
        const hit = this.ui.at(p.x, p.y);
        const wasDrag = !!this.ui.hits.find((q) => q.id === p.hitId)?.onDrag && p.moved;
        this.ui.tapX = p.x;
        this.ui.tapY = p.y;
        if (!cancel && hit && hit.id === p.hitId && hit.onTap && !wasDrag) {
          this.audio.sfx("ui_click", 0.6);
          hit.onTap();
        }
        this.ui.pressed = null;
      } else if (p.role === "joy") {
        this.joy = null;
      } else if (p.role === "build") this.build.up(p.x, p.y, !p.moved || cancel ? "tap" : "drag", cancel);
    }
  };

  // tools/preview/src/debug.ts
  function installDebug(app2) {
    const eh = {
      state: () => app2.state,
      cmd: (c) => app2.cmd(c),
      goto: (phase, opts = {}) => {
        if (!app2.game) app2.newRun(app2.seedN);
        gotoPhase(app2.game, phase, opts.night);
        app2.build.reset();
        app2.lastPhase = "";
        return app2.state.phase;
      },
      grant: (r) => {
        const s = app2.state;
        if (!s) return;
        s.res.wood += r.wood ?? 0;
        s.res.stone += r.stone ?? 0;
        s.res.gold += r.gold ?? 0;
      },
      autoplay: (on) => app2.autoplay.set(!!on),
      speed: (x) => {
        app2.speed = Math.max(0, x);
      },
      seed: (n) => {
        app2.clearRun();
        app2.newRun(n);
      },
      fps: () => app2.fps(),
      errors: app2.errors,
      // extras (preview only)
      spawn: (n) => app2.game ? spawnCrowd(app2.game, n) : 0,
      app: app2,
      missing: () => [...app2.atlas.missing],
      screen: (name) => {
        if (name) app2.screen = name;
        return app2.screen;
      },
      start: (seed) => {
        app2.clearRun();
        app2.newRun(seed ?? 1);
      },
      /** pin the camera on a tile point (null = follow the leader again) */
      camTo: (tx, ty) => {
        app2.camFocus = tx === null ? null : { x: tx, y: ty ?? 0 };
        if (tx !== null) {
          app2.cam.x = tx * 16;
          app2.cam.y = (ty ?? 0) * 16;
        }
      },
      tileToClient: (tx, ty) => {
        const p = app2.tileToScreen(tx, ty);
        return { x: p.x * app2.n / app2.dpr, y: p.y * app2.n / app2.dpr };
      },
      artToClient: (x, y) => ({ x: (x + 0.5) * app2.n / app2.dpr, y: (y + 0.5) * app2.n / app2.dpr }),
      hit: (id) => {
        const h = app2.ui.hits.find((q) => q.id === id);
        return h ? { x: (h.x + h.w / 2) * app2.n / app2.dpr, y: (h.y + h.h / 2) * app2.n / app2.dpr } : null;
      }
    };
    window.__EH = eh;
  }

  // tools/preview/src/main.ts
  var app = new App();
  var debug = /[?&]debug=1/.test(location.search);
  window.addEventListener("error", (e) => app.reportError(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => app.reportError(e.reason));
  if (debug) installDebug(app);
  app.installInput();
  app.resize();
  requestAnimationFrame(app.frame);
  app.boot().then(() => {
    const m = /[?&]seed=(\d+)/.exec(location.search);
    if (/[?&]autostart=1/.test(location.search)) app.newRun(m ? Number(m[1]) : 1);
  }).catch((e) => app.reportError(e));
})();
//# sourceMappingURL=main.js.map

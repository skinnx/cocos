// Web Audio playback of assets/resources/audio/*.wav per audio.json (SPEC §12): max 8 SFX voices, same SFX not
// retriggered within 50 ms, 1 s music crossfade, starts only after the first user gesture. Silent if files missing.
const ALIAS: Record<string, string> = {
  horn_night: 'night_horn', horn_rally: 'rally_horn', explode: 'explosion', fail: 'place_fail', levelup: 'level_up',
  shoot_arrow: 'arrow', shoot_bolt: 'ballista', shoot_mortar: 'mortar_fire', shoot_frost_shard: 'frost', shoot_spark: 'spark',
  shoot_fireball: 'hero_hit_2', shoot_turret: 'arrow', shoot_spit: 'hero_hit_3', repair: 'upgrade', hero_down: 'hero_hit_3',
  poi: 'coin', pulse: 'boss_roar', ui_open: 'ui_click',
  skill_shieldBash: 'hero_hit_1', skill_arrowRain: 'arrow', skill_fireWall: 'explosion', skill_miniTurret: 'place',
  skill_sanctum: 'level_up', skill_shadowStep: 'hero_hit_2',
};

interface FileInfo { file: string; category: 'sfx' | 'music'; volume?: number; loop?: boolean }

export class Audio {
  ctx: AudioContext | null = null;
  files: Record<string, FileInfo> = {};
  buffers = new Map<string, AudioBuffer>();
  base = 'resources';
  voices = 0; maxVoices = 8; retriggerMs = 50; fadeSec = 1;
  lastPlay = new Map<string, number>();
  sfxGain: GainNode | null = null; musicGain: GainNode | null = null;
  current: { name: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  wantMusic: string | null = null;
  volumes = { music: 0.6, sfx: 0.8 };
  muted = false;

  async init(base: string) {
    this.base = base;
    try {
      const r = await fetch(`${base}/audio/audio.json`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      this.files = j.files || {};
      const pb = j.playback || {};
      this.maxVoices = pb.maxSfxVoices ?? 8; this.retriggerMs = pb.sfxRetriggerMs ?? 50; this.fadeSec = pb.musicCrossfadeSec ?? 1;
    } catch { /* audio is optional */ }
  }

  /** Must be called from a user gesture (autoplay policy). */
  unlock() {
    if (this.ctx || this.muted) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.sfxGain = this.ctx!.createGain(); this.sfxGain.connect(this.ctx!.destination);
      this.musicGain = this.ctx!.createGain(); this.musicGain.connect(this.ctx!.destination);
      this.setVolumes(this.volumes.music, this.volumes.sfx);
      for (const name of Object.keys(this.files)) this.load(name);
      if (this.wantMusic) this.music(this.wantMusic);
    } catch { this.ctx = null; }
  }

  setVolumes(music: number, sfx: number) {
    this.volumes = { music, sfx };
    if (this.musicGain) this.musicGain.gain.value = music;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
  }

  private async load(name: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(name)) return this.buffers.get(name)!;
    const f = this.files[name];
    if (!f || !this.ctx) return null;
    try {
      const r = await fetch(`${this.base}/audio/${f.file}`);
      if (!r.ok) return null;
      const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
      this.buffers.set(name, buf);
      return buf;
    } catch { return null; }
  }

  sfx(key: string, vol = 1) {
    const name = this.files[key] ? key : ALIAS[key];
    if (!name || !this.ctx || !this.sfxGain) return;
    const buf = this.buffers.get(name);
    if (!buf) return;
    const now = performance.now();
    if (now - (this.lastPlay.get(name) ?? -1e9) < this.retriggerMs) return;
    if (this.voices >= this.maxVoices) return;
    this.lastPlay.set(name, now);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol * (this.files[name].volume ?? 1);
    src.connect(g); g.connect(this.sfxGain);
    this.voices++;
    src.onended = () => { this.voices--; };
    src.start();
  }

  music(kind: string) {
    const name = `music_${kind}`;
    this.wantMusic = kind;
    if (!this.ctx || !this.musicGain || (this.current && this.current.name === name)) return;
    const buf = this.buffers.get(name);
    if (!buf) { this.load(name).then((b) => { if (b && this.wantMusic === kind) this.music(kind); }); return; }
    const t = this.ctx.currentTime;
    if (this.current) {
      const old = this.current;
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + this.fadeSec);
      old.src.stop(t + this.fadeSec + 0.05);
    }
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(this.files[name].volume ?? 0.55, t + this.fadeSec);
    src.connect(g); g.connect(this.musicGain);
    src.start();
    this.current = { name, src, gain: g };
  }
}

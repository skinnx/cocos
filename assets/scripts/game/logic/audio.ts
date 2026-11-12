// Pure audio policy (no 'cc'). SPEC §12: max 8 simultaneous SFX voices, the same SFX never retriggers within 50 ms,
// music crossfades over 1 s. Also maps game events to SFX names (assets/resources/audio/audio.json).
import type { GameEvent, Phase } from '../../core/api';

export const MAX_VOICES = 8;
export const RETRIGGER_MS = 50;
export const CROSSFADE_SEC = 1;

export interface AudioEntry { name: string; path: string; category: 'sfx' | 'music'; duration: number; volume: number; loop: boolean }

/** Parse assets/resources/audio/audio.json ({ files: { name: { path, category, duration, volume, loop } } }). */
export function parseAudioManifest(json: unknown): { entries: AudioEntry[]; maxVoices: number; retriggerMs: number; crossfade: number } {
  const j = (json ?? {}) as { files?: Record<string, any>; playback?: Record<string, any> };
  const entries: AudioEntry[] = [];
  for (const name of Object.keys(j.files ?? {})) {
    const f = j.files![name];
    entries.push({
      name, path: typeof f.path === 'string' ? f.path : `audio/${name}`,
      category: f.category === 'music' ? 'music' : 'sfx', duration: Number(f.duration) || 0.2,
      volume: Number.isFinite(Number(f.volume)) ? Number(f.volume) : 1, loop: !!f.loop,
    });
  }
  const p = j.playback ?? {};
  return {
    entries,
    maxVoices: Number(p.maxSfxVoices) || MAX_VOICES,
    retriggerMs: Number(p.sfxRetriggerMs) || RETRIGGER_MS,
    crossfade: Number(p.musicCrossfadeSec) || CROSSFADE_SEC,
  };
}

/** Voice allocation: returns the voice index to use, or -1 when the request must be dropped. */
export class VoiceLimiter {
  private endAt: number[];
  private voiceName: string[];
  private lastPlay = new Map<string, number>();
  constructor(public readonly voices = MAX_VOICES, public readonly retriggerMs = RETRIGGER_MS) {
    this.endAt = new Array(voices).fill(0);
    this.voiceName = new Array(voices).fill('');
  }
  /** nowMs = monotonic ms; duration in seconds. */
  request(name: string, nowMs: number, duration: number, priority = 0): number {
    const last = this.lastPlay.get(name);
    if (last !== undefined && nowMs - last < this.retriggerMs) return -1;
    let idx = -1;
    for (let i = 0; i < this.voices; i++) if (this.endAt[i] <= nowMs) { idx = i; break; }
    if (idx < 0) {
      if (priority <= 0) return -1;
      // steal the voice that ends soonest
      idx = 0;
      for (let i = 1; i < this.voices; i++) if (this.endAt[i] < this.endAt[idx]) idx = i;
    }
    this.endAt[idx] = nowMs + Math.max(0.03, duration) * 1000;
    this.voiceName[idx] = name;
    this.lastPlay.set(name, nowMs);
    return idx;
  }
  active(nowMs: number): number { return this.endAt.filter((e) => e > nowMs).length; }
}

/** Music crossfade volumes for (outgoing, incoming) at time t since the switch. */
export function crossfade(t: number, dur = CROSSFADE_SEC): [number, number] {
  const k = dur <= 0 ? 1 : Math.max(0, Math.min(1, t / dur));
  return [1 - k, k];
}

/** Which music track a phase wants. */
export function musicFor(phase: Phase, bossAlive: boolean): string | null {
  if (bossAlive && phase === 'night') return 'music_boss';
  if (phase === 'night') return 'music_night';
  if (phase === 'victory' || phase === 'defeat') return null;
  return 'music_day';
}

/** SFX for a game event (null = silent). `heroHitVariant` picks one of the 3 hero attack sounds. */
export function sfxForEvent(e: GameEvent, heroHitVariant = 1): { name: string; priority: number } | null {
  switch (e.t) {
    case 'hit': return { name: e.dtype === 'frost' ? 'frost' : 'enemy_hit', priority: 0 };
    case 'death':
      if (e.kind === 'building') return { name: 'wall_break', priority: 1 };
      if (e.kind === 'hero') return { name: 'defeat', priority: 1 };
      return { name: 'enemy_die', priority: 0 };
    case 'shoot':
      switch (e.kind) {
        case 'arrow': case 'turret': return { name: 'arrow', priority: 0 };
        case 'bolt': return { name: 'ballista', priority: 0 };
        case 'mortar': return { name: 'mortar_fire', priority: 0 };
        case 'frost_shard': return { name: 'frost', priority: 0 };
        case 'spark': return { name: 'spark', priority: 0 };
        case 'fireball': return { name: `hero_hit_${heroHitVariant}`, priority: 0 };
        case 'spit': return { name: 'enemy_hit', priority: 0 };
      }
      return null;
    case 'explode': return { name: 'explosion', priority: 1 };
    case 'harvest': return { name: e.res === 'wood' ? 'chop' : e.res === 'stone' ? 'mine' : 'coin', priority: 0 };
    case 'built': return { name: 'place', priority: 1 };
    case 'buildFail': return { name: 'place_fail', priority: 1 };
    case 'upgraded': return { name: 'upgrade', priority: 1 };
    case 'repaired': return { name: 'upgrade', priority: 0 };
    case 'sold': return { name: 'sell', priority: 1 };
    case 'gold': return { name: 'coin', priority: 0 };
    case 'levelUp': return { name: 'level_up', priority: 1 };
    case 'skill': return { name: `hero_hit_${heroHitVariant}`, priority: 1 };
    case 'phase':
      if (e.phase === 'night') return { name: 'night_horn', priority: 2 };
      if (e.phase === 'victory') return { name: 'victory', priority: 2 };
      if (e.phase === 'defeat') return { name: 'defeat', priority: 2 };
      return null;
    case 'bossIntro': return { name: 'boss_roar', priority: 2 };
    case 'brazier': return { name: e.lit ? 'brazier_on' : 'brazier_off', priority: 1 };
    case 'horn': return { name: 'rally_horn', priority: 2 };
    case 'poi': return { name: e.action === 'opened' ? 'coin' : e.action === 'used' ? 'level_up' : 'wall_break', priority: 1 };
    case 'boonOffer': return null;
    case 'hearthLow': return { name: 'brazier_off', priority: 2 };
    case 'shrine': return { name: 'level_up', priority: 1 };
    case 'falseDawn': return { name: 'night_horn', priority: 2 };
    case 'pulse': return { name: 'brazier_off', priority: 1 };
    case 'teleport': return { name: 'spark', priority: 1 };
    case 'heal': return null;
    case 'hired': return { name: 'boon_pick', priority: 1 };
    case 'enrage': return { name: 'boss_roar', priority: 1 };
    default: return null;
  }
}

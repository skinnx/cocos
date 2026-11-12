// Pure audio policy (no 'cc'). SPEC §12: max 8 simultaneous SFX voices, the same SFX never retriggers within 50 ms,
// music crossfades over 1 s. Maps game events to SFX names (assets/resources/audio/audio.json). v2 sounds (§12 "Hold
// bền vững") are listed as candidates ahead of a v1 fallback: the first name present in the loaded audio.json plays,
// so newly synthesised clips are picked up automatically and a missing one never fails.
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
    if (!f || typeof f !== 'object') continue;
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
  private lastPlay = new Map<string, number>();
  constructor(public readonly voices = MAX_VOICES, public readonly retriggerMs = RETRIGGER_MS) {
    this.endAt = new Array(voices).fill(0);
  }
  /** nowMs = monotonic ms; duration in seconds. */
  request(name: string, nowMs: number, duration: number, priority = 0): number {
    const last = this.lastPlay.get(name);
    if (last !== undefined && nowMs - last < this.retriggerMs) return -1;
    let idx = -1;
    for (let i = 0; i < this.voices; i++) if (this.endAt[i] <= nowMs) { idx = i; break; }
    if (idx < 0) {
      if (priority <= 0) return -1;
      idx = 0; // steal the voice that ends soonest
      for (let i = 1; i < this.voices; i++) if (this.endAt[i] < this.endAt[idx]) idx = i;
    }
    this.endAt[idx] = nowMs + Math.max(0.03, duration) * 1000;
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

/** First candidate the manifest has (null when none). Without `has`, the last (v1 fallback) candidate is used. */
export function pick(cands: readonly string[], has?: (n: string) => boolean): string | null {
  if (!cands.length) return null;
  if (!has) return cands[cands.length - 1];
  for (const c of cands) if (has(c)) return c;
  return null;
}

/**
 * Music track candidates. Day alternates between two loops by night parity (§12 v2), expeditions get their own
 * urgent loop, bosses and sieges the boss track.
 */
export function musicCandidates(phase: Phase, bossAlive: boolean, expedition: boolean, night = 1): string[] {
  if (expedition) return ['music_expedition', 'music_night'];
  if (bossAlive && phase === 'night') return ['music_boss'];
  if (phase === 'night') return ['music_night'];
  return night % 2 === 0 ? ['music_day2', 'music_day'] : ['music_day'];
}
export function musicFor(phase: Phase, bossAlive: boolean, expedition = false, night = 1, has?: (n: string) => boolean): string | null {
  return pick(musicCandidates(phase, bossAlive, expedition, night), has);
}

type Snd = { cands: string[]; priority: number };
const S = (priority: number, ...cands: string[]): Snd => ({ cands, priority });

/** SFX candidates for a game event (null = silent). `heroHitVariant` picks one of the 3 hero attack sounds. */
export function sfxCandidates(e: GameEvent, heroHitVariant = 1): Snd | null {
  switch (e.t) {
    case 'hit': return S(0, e.dtype === 'frost' ? 'frost' : 'enemy_hit');
    case 'death':
      if (e.kind === 'building') return S(1, 'wall_break');
      if (e.kind === 'hero') return S(1, 'hero_down', 'defeat');
      return S(0, 'enemy_die');
    case 'shoot':
      switch (e.kind) {
        case 'arrow': case 'turret': return S(0, 'arrow');
        case 'bolt': return S(0, 'ballista');
        case 'mortar': case 'boulder': return S(0, 'mortar_fire');
        case 'frost_shard': return S(0, 'frost');
        case 'spark': return S(0, 'spark');
        case 'fireball': case 'javelin': case 'bomb': case 'barrel': return S(0, `hero_hit_${heroHitVariant}`);
        case 'spit': return S(0, 'enemy_hit');
      }
      return null;
    case 'explode': return S(1, 'explosion');
    case 'harvest': return S(0, e.res === 'wood' ? 'chop' : e.res === 'gold' ? 'coin' : 'mine');
    case 'built': return S(1, 'place');
    case 'buildFail': return S(1, 'place_fail');
    case 'upgraded': return S(1, 'upgrade');
    case 'repaired': return S(0, 'upgrade');
    case 'rebuilt': return S(1, 'place');
    case 'relocated': return S(1, 'place');
    case 'sold': return S(1, 'sell');
    case 'loot': return S(0, 'coin');
    case 'levelUp': return S(1, 'level_up');
    case 'skill': return S(1, `hero_hit_${heroHitVariant}`);
    case 'phase':
      if (e.phase === 'night') return S(2, 'night_horn');
      if (e.phase === 'dusk') return S(2, 'bell', 'night_horn');
      if (e.phase === 'dawn') return S(2, 'victory');
      return null;
    case 'bossIntro': return S(2, 'boss_roar');
    case 'brazier': return S(1, e.lit ? 'brazier_on' : 'brazier_off');
    case 'horn': return S(2, 'rally_horn');
    case 'poi':
      if (e.kind === 'heart' && e.action === 'sealed') return S(2, 'region_sealed', 'victory');
      if (e.kind === 'heart' && e.action === 'woke') return S(2, 'boss_roar');
      return S(1, e.action === 'opened' ? 'coin' : e.action === 'used' || e.action === 'freed' ? 'level_up' : 'wall_break');
    case 'hearthLow': return S(2, 'brazier_off');
    case 'falseDawn': return S(2, 'night_horn');
    case 'pulse': return S(1, 'brazier_off');
    case 'teleport': return S(1, 'spark');
    case 'frozen': return S(1, 'tower_frozen', 'frost');
    case 'burrow': return e.up ? S(1, 'burrow', 'mine') : null;
    case 'ignite': return S(1, 'brazier_on');
    case 'gutter': return S(2, 'fire_gutters', 'defeat');
    case 'regionSealed': return S(2, 'region_sealed', 'victory');
    case 'hearthTier': return S(2, 'hearth_tier', 'level_up');
    case 'unlock': return S(1, 'unlock', 'boon_pick');
    case 'villager':
      if (e.action === 'work') return S(0, `villager_work_${heroHitVariant}`, 'chop');
      if (e.action === 'flee') return S(0, 'step');
      return null;
    case 'storageFull': return S(1, 'storage_full', 'place_fail');
    case 'bounty': return e.done ? S(1, 'bounty_done', 'boon_pick') : null;
    case 'achievement': return S(2, 'achievement', 'level_up');
    case 'expedition':
      switch (e.action) {
        case 'start': return S(2, 'expedition_start', 'night_horn');
        case 'chest': return S(1, 'coin');
        case 'bossDown': return S(2, 'boss_roar');
        case 'extract': return S(2, 'extract_ok', 'victory');
        case 'timeout': case 'wiped': return S(2, 'extract_fail', 'defeat');
      }
      return null;
    default: return null;
  }
}

/** Resolved SFX for an event, picking the first clip the manifest has. */
export function sfxForEvent(e: GameEvent, heroHitVariant = 1, has?: (n: string) => boolean): { name: string; priority: number } | null {
  const s = sfxCandidates(e, heroHitVariant);
  if (!s) return null;
  const name = pick(s.cands, has);
  return name ? { name, priority: s.priority } : null;
}

/** UI sounds that are not tied to a core event. */
export const UI_SFX = {
  click: ['ui_click'], bell: ['bell', 'night_horn'], collect: ['collect_away', 'coin'], gift: ['boon_pick'],
  tick: ['timer_tick', 'ui_click'], bloodMoon: ['blood_moon', 'boss_roar'], fail: ['place_fail'], upgrade: ['upgrade'],
} as const;

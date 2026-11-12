// SFX playback (SPEC §12): clips listed in assets/resources/audio/audio.json, 8 AudioSource voices, the same sound is
// not retriggered within 50 ms, and nothing plays before the first touch (browser autoplay policy).
import { AudioClip, AudioSource, JsonAsset, resources, type Node } from 'cc';
import { parseAudioManifest, VoiceLimiter, type AudioEntry } from '../logic/audio';
import { mkNode } from '../render/Nodes';

export class Sfx {
  readonly node: Node;
  private voices: AudioSource[] = [];
  private clips = new Map<string, AudioClip>();
  private entries = new Map<string, AudioEntry>();
  private limiter = new VoiceLimiter();
  private clock = 0;
  unlocked = false;
  volume = 1;
  /** Music entries discovered in the manifest, handed to Music. */
  musicEntries: AudioEntry[] = [];
  onManifest: () => void = () => undefined;

  constructor(parent: Node) {
    this.node = mkNode('sfx', parent);
    resources.load('audio/audio', JsonAsset, (err, json) => {
      if (err || !json || !json.json) return;
      const m = parseAudioManifest(json.json);
      this.limiter = new VoiceLimiter(m.maxVoices, m.retriggerMs);
      for (let i = 0; i < m.maxVoices; i++) {
        const src = this.node.addComponent(AudioSource);
        src.playOnAwake = false; src.loop = false;
        this.voices.push(src);
      }
      for (const e of m.entries) {
        this.entries.set(e.name, e);
        if (e.category === 'music') { this.musicEntries.push(e); continue; }
        resources.load(e.path, AudioClip, (e2, clip) => { if (!e2 && clip) this.clips.set(e.name, clip); });
      }
      this.onManifest();
    });
  }

  tick(dt: number): void { this.clock += dt * 1000; }

  play(name: string, priority = 0): void {
    if (!this.unlocked || this.volume <= 0) return;
    const clip = this.clips.get(name), e = this.entries.get(name);
    if (!clip || !e || !this.voices.length) return;
    const v = this.limiter.request(name, this.clock, e.duration, priority);
    if (v < 0) return;
    const src = this.voices[v];
    src.stop();
    src.clip = clip;
    src.volume = Math.max(0, Math.min(1, e.volume * this.volume));
    src.play();
  }
}

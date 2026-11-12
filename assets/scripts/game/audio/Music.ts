// Music (SPEC §12): looping day / night / boss tracks with a 1 s crossfade between two AudioSources.
import { AudioClip, AudioSource, resources, type Node } from 'cc';
import { crossfade, CROSSFADE_SEC, type AudioEntry } from '../logic/audio';
import { mkNode } from '../render/Nodes';

export class Music {
  readonly node: Node;
  private a: AudioSource; private b: AudioSource;
  private cur: AudioSource; private prev: AudioSource | null = null;
  private clips = new Map<string, AudioClip>();
  private entries = new Map<string, AudioEntry>();
  private want: string | null = null;
  private playing: string | null = null;
  private fadeT = 0;
  private prevVol = 0;
  volume = 0.6;
  unlocked = false;

  constructor(parent: Node) {
    this.node = mkNode('music', parent);
    this.a = this.node.addComponent(AudioSource);
    this.b = this.node.addComponent(AudioSource);
    for (const s of [this.a, this.b]) { s.loop = true; s.playOnAwake = false; s.volume = 0; }
    this.cur = this.a;
  }

  setEntries(list: AudioEntry[]): void {
    for (const e of list) {
      this.entries.set(e.name, e);
      resources.load(e.path, AudioClip, (err, clip) => { if (!err && clip) { this.clips.set(e.name, clip); } });
    }
  }

  /** Request a track (null = silence); the switch crossfades over 1 s. */
  play(name: string | null): void { this.want = name; }

  update(dt: number): void {
    if (!this.unlocked) return;
    if (this.want !== this.playing && (this.want === null || this.clips.has(this.want))) {
      const next = this.cur === this.a ? this.b : this.a;
      this.prev = this.playing ? this.cur : null;
      this.prevVol = this.prev ? this.prev.volume : 0;
      if (this.want) {
        next.stop();
        next.clip = this.clips.get(this.want)!;
        next.loop = true;
        next.volume = 0;
        next.play();
      }
      this.cur = next;
      this.playing = this.want;
      this.fadeT = 0;
    }
    this.fadeT += dt;
    const [out, inn] = crossfade(this.fadeT, CROSSFADE_SEC);
    if (this.playing) this.cur.volume = (this.entries.get(this.playing)?.volume ?? 0.6) * this.volume * inn;
    if (this.prev) {
      this.prev.volume = this.prevVol * out;
      if (out <= 0) { this.prev.stop(); this.prev = null; }
    }
  }
}

// Tiny deterministic chiptune tracker: 2 pulse + triangle + noise percussion.
// Renders into a CIRCULAR buffer of exactly `bars` bars: every note's release/echo tail that
// runs past the loop end wraps around to the start, and every oscillator restarts its phase at
// note-on. The result is perfectly periodic, so the loop point is as smooth as any other sample.
import { SR, noteHz, oscSample, rng } from './sfxr.mjs';

/**
 * Pattern text → tokens. Whitespace separated; '|' is a visual bar line (ignored).
 *  'C4' note-on, 'E4+G4+B4' arpeggiated chord, '-' hold previous, '.' rest / note-off.
 *  Drum lanes use single letters: k kick, s snare, h closed hat, o open hat, t low tom, c crash, '.' rest.
 */
export function parse(text) {
  return text.split(/\s+/).filter((t) => t && t !== '|');
}

/** Song length in samples — exactly `bars` bars at `bpm`. */
export function songLength(song) {
  return Math.round((song.bars * song.beatsPerBar * 60 * SR) / song.bpm);
}

function events(tokens, totalSteps, L) {
  if (tokens.length !== totalSteps) throw new Error(`pattern has ${tokens.length} steps, expected ${totalSteps}`);
  const pos = (k) => Math.round((k * L) / totalSteps);
  const ev = [];
  for (let k = 0; k < totalSteps; k++) {
    const t = tokens[k];
    if (t === '-' || t === '.') continue;
    let e = k + 1;
    while (e < totalSteps && tokens[e] === '-') e++;
    ev.push({ token: t, start: pos(k), len: pos(e) - pos(k), step: k });
  }
  return ev;
}

// ── melodic channels ─────────────────────────────────────────────────────────
function renderMelodic(out, ch, ev, L) {
  const inst = { a: 0.004, d: 0.12, s: 0.65, r: 0.03, gate: 0.9, ...ch.inst };
  for (const e of ev) {
    const notes = e.token.split('+').map(noteHz);
    const gateN = Math.max(Math.round(e.len * inst.gate), Math.round(inst.a * SR) + 1);
    const relN = Math.round(inst.r * SR), total = gateN + relN;
    let p = 0;
    for (let i = 0; i < total; i++) {
      const t = i / SR;
      // arpeggio: cycle chord tones at arpRate Hz
      let f = notes.length > 1 ? notes[Math.floor(t * (inst.arpRate ?? 50)) % notes.length] : notes[0];
      if (inst.vib && t > inst.vib.delay) {
        const ramp = Math.min(1, (t - inst.vib.delay) / 0.15);
        f *= Math.pow(2, (ramp * inst.vib.depth * Math.sin(2 * Math.PI * inst.vib.rate * (t - inst.vib.delay))) / 12);
      }
      if (inst.bend && t < inst.bend.time) f *= Math.pow(2, (inst.bend.semis * (1 - t / inst.bend.time)) / 12);
      const dt = f / SR;
      let v = oscSample(ch.wave, p, dt, inst.duty ?? 0.5);
      if (ch.wave === 'triangle' && inst.steps) v = Math.round(v * inst.steps) / inst.steps; // NES-ish 4-bit stair
      p += dt; if (p >= 1) p -= 1;
      // envelope
      let env;
      if (t < inst.a) env = t / inst.a;
      else if (t < inst.a + inst.d) env = 1 - (1 - inst.s) * ((t - inst.a) / inst.d);
      else env = inst.s;
      if (i >= gateN) {
        const gEnvT = gateN / SR; // level at gate time
        let gl = gEnvT < inst.a ? gEnvT / inst.a : gEnvT < inst.a + inst.d ? 1 - (1 - inst.s) * ((gEnvT - inst.a) / inst.d) : inst.s;
        env = gl * (1 - (i - gateN) / relN);
      }
      out[(e.start + i) % L] += v * env * (ch.gain ?? 0.3);
    }
  }
}

// ── drums ────────────────────────────────────────────────────────────────────
function drumVoice(kind, seed) {
  const r = rng(seed);
  const n = Math.round(SR * { k: 0.16, s: 0.16, h: 0.04, o: 0.16, t: 0.2, c: 0.6 }[kind]);
  const out = new Float32Array(n);
  let p = 0, lp = 0, hpPrev = 0, hpOut = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    if (kind === 'k') {
      const f = 45 + 110 * Math.exp(-t / 0.025);
      p += f / SR; v = Math.sin(2 * Math.PI * p) * Math.exp(-t / 0.06);
      v += (r() * 2 - 1) * 0.15 * Math.exp(-t / 0.004);
    } else if (kind === 't') {
      const f = 90 + 60 * Math.exp(-t / 0.05);
      p += f / SR; v = Math.sin(2 * Math.PI * p) * Math.exp(-t / 0.08);
    } else {
      const w = r() * 2 - 1;
      // one-pole high-pass on noise → hiss for hats; snare keeps more body
      hpOut = 0.7 * (hpOut + w - hpPrev); hpPrev = w;
      lp += 0.5 * (w - lp);
      if (kind === 's') {
        p += 185 / SR;
        v = lp * 0.8 * Math.exp(-t / 0.05) + Math.sin(2 * Math.PI * p) * 0.5 * Math.exp(-t / 0.03);
      } else if (kind === 'h') v = hpOut * Math.exp(-t / 0.012) * 0.7;
      else if (kind === 'o') v = hpOut * Math.exp(-t / 0.05) * 0.6;
      else if (kind === 'c') v = hpOut * Math.exp(-t / 0.18) * 0.6;
    }
    out[i] = v * Math.min(1, i / 8); // 8-sample attack ramp: no clicks
  }
  // tiny release so the tail ends at zero
  const rel = Math.min(64, n);
  for (let i = 0; i < rel; i++) out[n - 1 - i] *= i / rel;
  return out;
}

function renderDrums(out, ch, ev, L, seedBase) {
  const g = ch.gain ?? 0.3, levels = { k: 1, s: 0.8, h: 0.45, o: 0.5, t: 0.9, c: 0.6, ...(ch.levels ?? {}) };
  for (const e of ev) {
    for (const kind of e.token) {
      if (!(kind in levels)) throw new Error(`unknown drum '${kind}'`);
      const v = drumVoice(kind, seedBase * 1000 + e.step * 7 + kind.charCodeAt(0));
      for (let i = 0; i < v.length; i++) out[(e.start + i) % L] += v[i] * g * levels[kind];
    }
  }
}

// ── circular effects ─────────────────────────────────────────────────────────
function circularEcho(x, delaySec, fb, wet) {
  const L = x.length, d = Math.round(delaySec * SR) % L;
  const e = new Float32Array(L);
  for (let pass = 0; pass < 8; pass++) // converge the wrapped feedback (fb^8 is negligible)
    for (let i = 0; i < L; i++) { const j = (i - d + L) % L; e[i] = x[j] + fb * e[j]; }
  const y = new Float32Array(L);
  for (let i = 0; i < L; i++) y[i] = x[i] + wet * e[i];
  return y;
}

function circularLowpass(x, hz) {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / SR), L = x.length, y = new Float32Array(L);
  let s = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < L; i++) { s += a * (x[i] - s); y[i] = s; }
  return y;
}

/**
 * song = { bpm, beatsPerBar, stepsPerBeat, bars, channels: [{ wave: 'square'|'triangle'|'noise', gain,
 *          pattern: string, inst?, echo?: {delay, fb, wet}, lowpass?: Hz }] }
 */
export function renderSong(song) {
  const L = songLength(song);
  const totalSteps = song.bars * song.beatsPerBar * song.stepsPerBeat;
  const mixBuf = new Float32Array(L);
  song.channels.forEach((ch, ci) => {
    let buf = new Float32Array(L);
    const ev = events(parse(ch.pattern), totalSteps, L);
    if (ch.wave === 'noise') renderDrums(buf, ch, ev, L, ci + 1);
    else renderMelodic(buf, ch, ev, L);
    if (ch.lowpass) buf = circularLowpass(buf, ch.lowpass);
    if (ch.echo) buf = circularEcho(buf, ch.echo.delay, ch.echo.fb, ch.echo.wet);
    for (let i = 0; i < L; i++) mixBuf[i] += buf[i];
  });
  return mixBuf;
}

// ── composition helpers ──────────────────────────────────────────────────────
const CHORD_SHAPES = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], dim: [0, 3, 6], 5: [0, 7, 12] };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const ROOTS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const midiName = (m) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
/** chord('Am', 4) → ['A4','C5','E5'] (root placed in the given octave). */
export function chord(sym, octave) {
  const m = /^([A-G][#b]?)(.*)$/.exec(sym);
  const root = ROOTS[m[1]] + (octave + 1) * 12;
  const shape = CHORD_SHAPES[m[2]];
  if (!shape) throw new Error(`chord shape ${m[2]}`);
  return shape.map((i) => midiName(root + i));
}
/** Build a pattern by applying `fn(chordSym, barIndex) → tokens[]` for every bar of a progression. */
export function perBar(progression, fn) {
  return progression.map((c, b) => fn(c, b).join(' ')).join(' | ');
}

// sfxr-style synthesis toolkit. Zero dependencies, fully deterministic (seeded PRNG).
// All buffers are mono Float32Array at SR Hz, nominal range [-1, 1].
export const SR = 22050;

// ── PRNG ─────────────────────────────────────────────────────────────────────
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────
export const len = (sec) => Math.max(1, Math.round(sec * SR));
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C4' 'F#3' 'Bb5' → midi number */
export function noteMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}
export const noteHz = (name) => midiHz(noteMidi(name));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// PolyBLEP residual for band-limited discontinuities (keeps square/saw from harsh aliasing).
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

// ── oscillators ──────────────────────────────────────────────────────────────
/** One sample of waveform `wave` at phase p∈[0,1) with phase increment dt. */
export function oscSample(wave, p, dt, duty = 0.5) {
  switch (wave) {
    case 'sine': return Math.sin(2 * Math.PI * p);
    case 'triangle': return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    case 'saw': return 2 * p - 1 - blep(p, dt);
    case 'square': {
      let v = p < duty ? 1 : -1;
      v += blep(p, dt);
      let q = p - duty; if (q < 0) q += 1;
      v -= blep(q, dt);
      return v - (2 * duty - 1); // remove DC for narrow duty
    }
    default: throw new Error(`unknown wave ${wave}`);
  }
}

/**
 * Pitch track: frequency (Hz) at time t (s).
 * f0 → f1 slide (exp or lin), optional slide delay, vibrato {rate, depth (semitones), delay},
 * arpeggio [[tSec, ratio], ...] (ratio multiplies after time t; sfxr "change amount"),
 * jitter {rate, depth (semitones), seed} random stepped pitch (zaps).
 */
function pitchFn(o, dur) {
  const f0 = o.f0, f1 = o.f1 ?? o.f0;
  const sd = o.slideDelay ?? 0, st = o.slideTime ?? dur - sd;
  const arp = o.arp ? [...o.arp].sort((a, b) => a[0] - b[0]) : null;
  const jit = o.jitter ? { ...o.jitter, r: rng(o.jitter.seed ?? 7), cur: 0, next: 0 } : null;
  return (t) => {
    let k = clamp((t - sd) / Math.max(st, 1e-6), 0, 1);
    let f = o.slide === 'lin' ? f0 + (f1 - f0) * k : f0 * Math.pow(f1 / f0, k);
    if (arp) for (const [at, ratio] of arp) if (t >= at) f = (o.arpAbs ? f0 : f) * ratio;
    if (o.vib) {
      const vd = o.vib.delay ?? 0;
      if (t > vd) {
        const ramp = clamp((t - vd) / 0.08, 0, 1);
        f *= Math.pow(2, (ramp * o.vib.depth * Math.sin(2 * Math.PI * o.vib.rate * (t - vd))) / 12);
      }
    }
    if (jit) {
      if (t >= jit.next) { jit.cur = (jit.r() * 2 - 1) * jit.depth; jit.next = t + 1 / jit.rate; }
      f *= Math.pow(2, jit.cur / 12);
    }
    return Math.max(1, f);
  };
}

// ── envelopes ────────────────────────────────────────────────────────────────
/**
 * env: {a, d, s, r, curve}  ADSR in seconds, s = sustain level; release ends at `dur`.
 *  or  {a, decay}            percussive: linear attack then exponential decay with time const `decay`.
 *  or  {a, hold, decay}      attack, hold at 1, then exp decay.
 */
export function envelope(env, dur) {
  const n = len(dur), out = new Float32Array(n);
  const a = Math.max(env.a ?? 0.002, 1 / SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v;
    if (env.decay !== undefined) {
      const h = env.hold ?? 0;
      v = t < a ? t / a : t < a + h ? 1 : Math.exp(-(t - a - h) / env.decay);
    } else {
      const d = env.d ?? 0.05, s = env.s ?? 0.7, r = env.r ?? 0.05;
      const rs = Math.max(a + d, dur - r);
      if (t < a) v = t / a;
      else if (t < a + d) v = 1 - (1 - s) * ((t - a) / d);
      else v = s;
      if (t >= rs) v *= Math.max(0, 1 - (t - rs) / r);
      if (env.curve) v = Math.pow(v, env.curve);
    }
    out[i] = v;
  }
  return out;
}

// ── filters (RBJ biquads, time-varying cutoff) ────────────────────────────────
/** spec: {type:'lp'|'hp'|'bp', f0, f1?, q?}; cutoff sweeps exponentially f0→f1 over buffer. */
export function filter(buf, spec) {
  const n = buf.length, out = new Float32Array(n);
  const q = spec.q ?? 0.707, f0 = spec.f0, f1 = spec.f1 ?? spec.f0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) {
      const fc = clamp(f0 * Math.pow(f1 / f0, i / Math.max(1, n - 1)), 20, SR * 0.45);
      const w = (2 * Math.PI * fc) / SR, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
      const a0 = 1 + al;
      if (spec.type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
      else if (spec.type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
      else { b0 = al; b1 = 0; b2 = -al; } // band-pass, 0 dB peak
      b0 /= a0; b1 /= a0; b2 /= a0; a1 = (-2 * cw) / a0; a2 = (1 - al) / a0;
    }
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

// ── voice generator ──────────────────────────────────────────────────────────
/**
 * tone(o): the sfxr "voice".
 *  wave: square|triangle|saw|sine|noise|pnoise   (pnoise = sfxr sample&hold noise pitched by f0)
 *  dur, f0, f1, slide, slideDelay, slideTime, vib, arp, arpAbs, jitter
 *  duty, duty1 (duty sweep), env, filters: [{type,f0,f1,q}], gain, seed, am:{rate, depth}
 */
export function tone(o) {
  const dur = o.dur, n = len(dur), out = new Float32Array(n);
  const wave = o.wave ?? 'square';
  const pf = pitchFn({ f0: 440, ...o }, dur);
  const r = rng(o.seed ?? 1);
  let p = 0, held = r() * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = pf(t), dt = Math.min(0.5, f / SR);
    let v;
    if (wave === 'noise') v = r() * 2 - 1;
    else if (wave === 'pnoise') {
      // sample-and-hold noise, re-sampled 2x per cycle (sfxr style)
      const np = p + dt * 2;
      if (np >= 1) held = r() * 2 - 1;
      v = held;
      p = np % 1;
      out[i] = v;
      continue;
    } else {
      const duty = o.duty1 !== undefined ? o.duty + (o.duty1 - o.duty) * (i / n) : o.duty ?? 0.5;
      v = oscSample(wave, p, dt, duty);
    }
    p += dt; if (p >= 1) p -= 1;
    out[i] = v;
  }
  let res = out;
  for (const f of o.filters ?? []) res = filter(res, f);
  const env = envelope(o.env ?? { a: 0.002, d: 0.05, s: 0.6, r: 0.05 }, dur);
  const g = o.gain ?? 1;
  for (let i = 0; i < n; i++) {
    let v = res[i] * env[i] * g;
    if (o.am) v *= 1 - o.am.depth * 0.5 * (1 + Math.sin(2 * Math.PI * o.am.rate * (i / SR)));
    res[i] = v;
  }
  return res;
}

/** Granular crackle: sparse random impulses of filtered noise (fire, rubble). */
export function crackle({ dur, density = 40, seed = 3, decay = 0.006, lp = 4000, hp = 600, env }) {
  const n = len(dur), out = new Float32Array(n), r = rng(seed);
  const dl = len(decay * 6);
  let t = 0;
  while (true) {
    t += (-Math.log(1 - r() * 0.999) / density);
    const i0 = Math.floor(t * SR);
    if (i0 >= n) break;
    const amp = 0.3 + 0.7 * r();
    for (let k = 0; k < dl && i0 + k < n; k++) out[i0 + k] += (r() * 2 - 1) * amp * Math.exp(-k / SR / decay);
  }
  let res = filter(filter(out, { type: 'lp', f0: lp }), { type: 'hp', f0: hp });
  if (env) { const e = envelope(env, dur); for (let i = 0; i < n; i++) res[i] *= e[i]; }
  return res;
}

// ── mixing & mastering ───────────────────────────────────────────────────────
/** layers: [[buf, offsetSec = 0, gain = 1], ...] → summed buffer (length = longest end). */
export function mix(layers, minDur = 0) {
  let n = len(minDur);
  for (const [b, off = 0] of layers) n = Math.max(n, Math.round(off * SR) + b.length);
  const out = new Float32Array(n);
  for (const [b, off = 0, g = 1] of layers) {
    const o = Math.round(off * SR);
    for (let i = 0; i < b.length; i++) out[o + i] += b[i] * g;
  }
  return out;
}

export function concat(...bufs) {
  const out = new Float32Array(bufs.reduce((s, b) => s + b.length, 0));
  let o = 0; for (const b of bufs) { out.set(b, o); o += b.length; }
  return out;
}

export function softClip(buf, drive = 1) {
  const k = Math.tanh(drive);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * drive) / k;
  return buf;
}

export function removeDC(buf) {
  let m = 0; for (const v of buf) m += v; m /= buf.length || 1;
  for (let i = 0; i < buf.length; i++) buf[i] -= m;
  return buf;
}

export function normalize(buf, peakDb = -1) {
  let pk = 0; for (const v of buf) pk = Math.max(pk, Math.abs(v));
  if (pk > 0) { const g = Math.pow(10, peakDb / 20) / pk; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}

export function fade(buf, inSec = 0.002, outSec = 0.01) {
  const a = len(inSec), b = len(outSec), n = buf.length;
  for (let i = 0; i < a && i < n; i++) buf[i] *= i / a;
  for (let i = 0; i < b && i < n; i++) buf[n - 1 - i] *= i / b;
  return buf;
}

/** Trim trailing near-silence (below thresholdDb relative to peak), keeping a short pad. */
export function trimTail(buf, thresholdDb = -60, padSec = 0.01) {
  let pk = 0; for (const v of buf) pk = Math.max(pk, Math.abs(v));
  const th = pk * Math.pow(10, thresholdDb / 20);
  let end = buf.length - 1;
  while (end > 0 && Math.abs(buf[end]) < th) end--;
  return buf.slice(0, Math.min(buf.length, end + 1 + len(padSec)));
}

/** Standard one-shot mastering chain. */
export function master(buf, { drive = 1.2, peakDb = -1, fadeIn = 0.002, fadeOut = 0.012, trim = true } = {}) {
  let b = removeDC(buf);
  normalize(b, 0);
  softClip(b, drive);
  if (trim) b = trimTail(b);
  fade(b, fadeIn, fadeOut);
  return normalize(b, peakDb);
}

// ── WAV I/O ──────────────────────────────────────────────────────────────────
export function encodeWav(buf, sr = SR) {
  const n = buf.length, out = Buffer.alloc(44 + n * 2);
  out.write('RIFF', 0); out.writeUInt32LE(36 + n * 2, 4); out.write('WAVE', 8);
  out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(sr, 24); out.writeUInt32LE(sr * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) out.writeInt16LE(Math.round(clamp(buf[i], -1, 1) * 32767), 44 + i * 2);
  return out;
}

/** Parse a PCM WAV buffer → { sr, channels, bits, samples: Float32Array } (throws on malformed). */
export function decodeWav(b) {
  if (b.length < 44 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not RIFF/WAVE');
  if (b.readUInt32LE(4) !== b.length - 8) throw new Error('RIFF size mismatch');
  let o = 12, fmt = null, data = null;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(o + 8), channels: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), byteRate: b.readUInt32LE(o + 16), align: b.readUInt16LE(o + 20), bits: b.readUInt16LE(o + 22) };
    if (id === 'data') data = { off: o + 8, size: sz };
    o += 8 + sz + (sz & 1);
  }
  if (!fmt || !data) throw new Error('missing fmt/data chunk');
  if (data.off + data.size > b.length) throw new Error('data chunk truncated');
  if (fmt.format !== 1 || fmt.bits !== 16) throw new Error('not 16-bit PCM');
  if (fmt.byteRate !== fmt.sr * fmt.channels * 2 || fmt.align !== fmt.channels * 2) throw new Error('inconsistent byteRate/align');
  const n = data.size / 2, s = new Float32Array(n), raw = new Int16Array(n);
  for (let i = 0; i < n; i++) { raw[i] = b.readInt16LE(data.off + i * 2); s[i] = raw[i] / 32768; }
  return { ...fmt, samples: s, raw };
}

// Numeric analysis of rendered audio ("listen proxy"): RMS, peak, spectral centroid, flatness,
// zero-crossing rate, envelope shape and a coarse pitch track. Used by synth.mjs and verify.mjs.
import { SR } from './sfxr.mjs';

export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const h = size >> 1, ang = (-2 * Math.PI) / size;
    for (let s = 0; s < n; s += size)
      for (let k = 0; k < h; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ar = re[s + k + h], ai = im[s + k + h];
        const tr = ar * wr - ai * wi, ti = ar * wi + ai * wr;
        re[s + k + h] = re[s + k] - tr; im[s + k + h] = im[s + k] - ti;
        re[s + k] += tr; im[s + k] += ti;
      }
  }
}

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);

/** Power spectrum of a Hann-windowed frame of size N starting at `off` (zero-padded). */
function spectrum(x, off, N) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const v = off + i < x.length ? x[off + i] : 0;
    re[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  fft(re, im);
  const p = new Float64Array(N / 2);
  for (let k = 0; k < N / 2; k++) p[k] = re[k] * re[k] + im[k] * im[k];
  return p;
}

/** Dominant frequency per frame (energy-gated), Hz or null. */
export function pitchTrack(x, frameSec = 0.03, N = 2048) {
  const hop = Math.max(1, Math.round(frameSec * SR)), out = [];
  let gmax = 0; for (const v of x) gmax = Math.max(gmax, Math.abs(v));
  for (let off = 0; off + hop <= x.length; off += hop) {
    let e = 0; for (let i = 0; i < hop; i++) e = Math.max(e, Math.abs(x[off + i]));
    if (e < gmax * 0.2) { out.push(null); continue; }
    const seg = x.subarray(off, Math.min(x.length, off + hop));
    const p = spectrum(seg, 0, N);
    let bk = 2; for (let k = 3; k < N / 2 - 1; k++) if (p[k] > p[bk]) bk = k;
    // parabolic interpolation
    const a = Math.log(p[bk - 1] + 1e-20), b = Math.log(p[bk] + 1e-20), c = Math.log(p[bk + 1] + 1e-20);
    const d = (a - 2 * b + c) === 0 ? 0 : (0.5 * (a - c)) / (a - 2 * b + c);
    out.push(((bk + d) * SR) / N);
  }
  return out;
}

export function analyse(x) {
  const n = x.length;
  let pk = 0, ss = 0, zc = 0, nan = 0;
  for (let i = 0; i < n; i++) {
    const v = x[i];
    if (!Number.isFinite(v)) { nan++; continue; }
    pk = Math.max(pk, Math.abs(v)); ss += v * v;
    if (i && (v >= 0) !== (x[i - 1] >= 0)) zc++;
  }
  const rms = Math.sqrt(ss / Math.max(1, n));
  // spectral centroid + flatness: energy-weighted over 1024-sample frames
  const N = 1024;
  let cw = 0, ce = 0, fw = 0;
  for (let off = 0; off < n; off += N / 2) {
    const p = spectrum(x, off, N);
    let e = 0, num = 0, pmax = 0;
    for (let k = 1; k < N / 2; k++) { e += p[k]; num += p[k] * ((k * SR) / N); pmax = Math.max(pmax, p[k]); }
    if (e < 1e-9) continue;
    // flatness (Wiener entropy) over 150 Hz – 9 kHz, floored at −80 dB re frame max: ~0 tone, →1 white noise
    const k0 = Math.ceil((150 * N) / SR), k1 = Math.floor((9000 * N) / SR), floor = pmax * 1e-8;
    let lsum = 0, asum = 0;
    for (let k = k0; k <= k1; k++) { const v = Math.max(p[k], floor); lsum += Math.log(v); asum += v; }
    const nb = k1 - k0 + 1, flat = Math.exp(lsum / nb) / (asum / nb);
    cw += num; ce += e; fw += flat * e;
  }
  // 10 ms RMS envelope
  const hop = Math.round(0.01 * SR), env = [];
  for (let off = 0; off < n; off += hop) {
    let s = 0, m = 0; for (let i = off; i < Math.min(n, off + hop); i++) { s += x[i] * x[i]; m++; }
    env.push(Math.sqrt(s / Math.max(1, m)));
  }
  let ePk = 0; for (let i = 1; i < env.length; i++) if (env[i] > env[ePk]) ePk = i;
  const thr = env[ePk] * 0.1; // -20 dB
  let dEnd = ePk; while (dEnd < env.length - 1 && env[dEnd] > thr) dEnd++;
  // sustained energy: fraction of frames above -12 dB of peak
  const sustained = env.filter((v) => v > env[ePk] * 0.25).length / Math.max(1, env.length);
  return {
    samples: n, dur: n / SR, peak: pk, peakDb: db(pk), rms, rmsDb: db(rms), nan,
    zcr: (zc / Math.max(1, n)) * SR / 2, // ≈ Hz for a pure tone
    centroid: ce ? cw / ce : 0, flatness: ce ? fw / ce : 0,
    env, attack: ePk * 0.01, decay20: (dEnd - ePk) * 0.01, sustained,
  };
}

const finite = (a) => a.filter((v) => v != null && Number.isFinite(v));
const median = (a) => { const s = finite(a).sort((p, q) => p - q); return s.length ? s[s.length >> 1] : NaN; };
/** median pitch over a time window [t0, t1) in seconds */
export function pitchAt(track, t0, t1, frameSec = 0.03) {
  return median(track.slice(Math.floor(t0 / frameSec), Math.ceil(t1 / frameSec)));
}

/**
 * Intent checks (listen proxy): each returns [ok, description]. Thresholds are deliberately
 * loose; they catch a sound that is structurally wrong (tonal vs noisy, rising vs falling, short vs long).
 */
export const INTENT = {
  step: (a) => [a.dur < 0.15 && a.centroid < 2500, 'very short, soft/dull (low centroid)'],
  chop: (a) => [a.dur < 0.3 && a.attack <= 0.02, 'short percussive thock'],
  mine: (a) => [a.dur < 0.3 && a.centroid > 1200 && a.attack <= 0.02, 'short bright clink'],
  coin: (a, pt) => { const p1 = pitchAt(pt, 0.0, 0.06), p2 = pitchAt(pt, 0.08, 0.16); return [p2 > p1 * 1.15 && a.flatness < 0.2, `two rising tones (${p1 | 0}→${p2 | 0} Hz), tonal`]; },
  place: (a) => [a.dur < 0.3 && a.attack <= 0.02, 'short solid thump'],
  place_fail: (a, pt) => { const p1 = pitchAt(pt, 0, 0.1), p2 = pitchAt(pt, 0.13, 0.24); return [p2 < p1 && a.flatness < 0.25, `falling buzz (${p1 | 0}→${p2 | 0} Hz)`]; },
  upgrade: (a, pt) => { const p1 = pitchAt(pt, 0, 0.08), p2 = pitchAt(pt, 0.2, 0.35); return [p2 > p1 * 1.4, `rising arpeggio (${p1 | 0}→${p2 | 0} Hz)`]; },
  sell: (a, pt) => { const p1 = pitchAt(pt, 0, 0.06), p2 = pitchAt(pt, 0.12, 0.22); return [p2 < p1 && a.flatness < 0.25, `descending chime (${p1 | 0}→${p2 | 0} Hz)`]; },
  arrow: (a) => [a.dur < 0.3 && a.flatness > 0.05, 'short airy whoosh (noisy)'],
  ballista: (a) => [a.dur < 0.4 && a.centroid < 2500, 'heavier, darker than arrow'],
  mortar_fire: (a) => [a.centroid < 1200 && a.attack <= 0.03, 'low boom with fast attack'],
  explosion: (a) => [a.flatness > 0.08 && a.decay20 >= 0.2 && a.attack <= 0.03, `noise + long decay (decay20=${a.decay20.toFixed(2)}s)`],
  frost: (a) => [a.centroid > 1500 && a.dur >= 0.25, 'bright crystalline shimmer'],
  spark: (a) => [a.centroid > 1200 && a.dur < 0.4, 'bright electric zap'],
  hero_hit_1: (a) => [a.dur < 0.2 && a.attack <= 0.03, 'short hit (slash)'],
  hero_hit_2: (a) => [a.dur < 0.2 && a.attack <= 0.03, 'short hit (blunt)'],
  hero_hit_3: (a) => [a.dur < 0.25 && a.attack <= 0.03, 'short hit (heavy)'],
  enemy_hit: (a) => [a.dur < 0.16 && a.attack <= 0.02, 'very short squish'],
  enemy_die: (a, pt) => { const p1 = pitchAt(pt, 0, 0.06), p2 = pitchAt(pt, 0.12, 0.22); return [p2 < p1, `falling poof (${p1 | 0}→${p2 | 0} Hz)`]; },
  wall_break: (a) => [a.flatness > 0.05 && a.dur >= 0.3, 'noisy crunch with debris tail'],
  brazier_on: (a) => [a.attack >= 0.05 && a.flatness > 0.05, `swelling ignite (attack=${a.attack.toFixed(2)}s)`],
  brazier_off: (a) => [a.attack <= 0.05 && a.flatness > 0.05, 'hiss that fades out'],
  night_horn: (a, pt) => { const p = pitchAt(pt, 0.2, 0.8); return [a.dur >= 0.9 && p < 400 && a.sustained > 0.4, `long low horn (${p | 0} Hz, sustained ${(a.sustained * 100) | 0}%)`]; },
  rally_horn: (a, pt) => { const p1 = pitchAt(pt, 0.05, 0.2), p2 = pitchAt(pt, 0.35, 0.6); return [a.dur >= 0.6 && p2 > p1, `two-note rising call (${p1 | 0}→${p2 | 0} Hz)`]; },
  boon_pick: (a, pt) => { const p1 = pitchAt(pt, 0, 0.08), p2 = pitchAt(pt, 0.15, 0.3); return [p2 > p1 && a.centroid > 1000, `rising sparkle (${p1 | 0}→${p2 | 0} Hz)`]; },
  level_up: (a, pt) => { const p1 = pitchAt(pt, 0, 0.06), p2 = pitchAt(pt, 0.25, 0.45); return [p2 > p1 * 1.4 && a.dur >= 0.4, `fanfare arpeggio up (${p1 | 0}→${p2 | 0} Hz)`]; },
  ui_click: (a) => [a.dur <= 0.08, 'tiny blip'],
  victory: (a, pt) => { const p1 = pitchAt(pt, 0, 0.2), p2 = pitchAt(pt, 0.6, 1.0); return [a.dur >= 1 && p2 > p1, `triumphant rising fanfare (${p1 | 0}→${p2 | 0} Hz)`]; },
  defeat: (a, pt) => { const p1 = pitchAt(pt, 0, 0.25), p2 = pitchAt(pt, 0.7, 1.1); return [a.dur >= 1 && p2 < p1, `slow descending lament (${p1 | 0}→${p2 | 0} Hz)`]; },
  // v2 additions
  bell: (a) => [a.dur >= 0.8 && a.attack <= 0.03 && a.flatness < 0.2 && a.decay20 >= 0.3, `struck bell: fast attack, tonal, long ring (decay20=${a.decay20.toFixed(2)}s)`],
  collect_away: (a, pt) => { const p1 = pitchAt(pt, 0, 0.1), p2 = pitchAt(pt, 0.25, 0.4); return [p2 > p1 && a.dur >= 0.4, `rising coin cascade (${p1 | 0}→${p2 | 0} Hz)`]; },
  villager_work_1: (a) => [a.dur < 0.2 && a.attack <= 0.02, 'short soft knock (hatchet)'],
  villager_work_2: (a) => [a.dur < 0.3 && a.centroid > 900 && a.attack <= 0.02, 'short metallic tink (anvil)'],
  villager_work_3: (a) => [a.dur < 0.3 && a.flatness > 0.05, 'short scrape (hoe)'],
  storage_full: (a, pt) => { const p1 = pitchAt(pt, 0.1, 0.22), p2 = pitchAt(pt, 0.26, 0.4); return [p2 < p1 && a.centroid < 1500, `dull falling bonk (${p1 | 0}→${p2 | 0} Hz)`]; },
  hearth_tier: (a, pt) => { const p1 = pitchAt(pt, 0.1, 0.22), p2 = pitchAt(pt, 0.5, 0.9); return [a.dur >= 0.9 && p2 > p1 * 1.4, `big rising fanfare (${p1 | 0}→${p2 | 0} Hz)`]; },
  region_sealed: (a) => [a.dur >= 1 && a.sustained > 0.25 && a.attack <= 0.05, `gong + blooming chord (sustained ${(a.sustained * 100) | 0}%)`],
  extract_ok: (a, pt) => { const p1 = pitchAt(pt, 0, 0.1), p2 = pitchAt(pt, 0.4, 0.55); return [p2 > p1 * 1.5, `rising success jingle (${p1 | 0}→${p2 | 0} Hz)`]; },
  extract_fail: (a, pt) => { const p1 = pitchAt(pt, 0, 0.2), p2 = pitchAt(pt, 0.72, 1.0); return [a.dur >= 0.9 && p2 < p1, `sinking descent (${p1 | 0}→${p2 | 0} Hz)`]; },
  timer_tick: (a) => [a.dur <= 0.08 && a.attack <= 0.01, 'tiny dry tick'],
  blood_moon: (a) => [a.dur >= 1 && a.centroid < 1500 && a.attack >= 0.0 && a.sustained > 0.3, `low ominous swell (centroid ${a.centroid | 0} Hz)`],
  tower_frozen: (a) => [a.dur < 0.6 && a.centroid > 2500 && a.attack <= 0.02, 'sharp bright ice crack'],
  burrow: (a) => [a.dur >= 0.3 && a.centroid < 2000 && a.attack >= 0.05, `rumble rising from below (attack=${a.attack.toFixed(2)}s)`],
  boss_roar: (a) => [a.dur >= 0.8 && a.centroid < 1500 && a.attack >= 0.05, 'long low growl that swells'],
};

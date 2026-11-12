#!/usr/bin/env node
// Emberhold audio generator (SPEC §12). Zero dependencies, deterministic.
//   node tools/audio/synth.mjs [--quiet]
// Writes mono 22050 Hz 16-bit WAVs + audio.json into assets/resources/audio/.
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, tone, crackle, mix, master, encodeWav, noteHz as n, normalize, removeDC } from './sfxr.mjs';
import { renderSong, songLength, chord, perBar } from './tracker.mjs';
import { analyse, pitchTrack, INTENT } from './analyze.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_DIR = join(ROOT, 'assets', 'resources', 'audio');

// ═════════════════════════════════════════════════════════════════════════════
// SFX — each returns a raw Float32Array; master() trims, soft-clips, fades, normalises to −1 dBFS.
// ═════════════════════════════════════════════════════════════════════════════
const perc = (decay, a = 0.002, hold = 0) => ({ a, hold, decay });

export const SFX = {
  // footstep on grass/dirt: dull sample&hold noise tap + tiny low thump
  step: { vol: 0.35, make: () => mix([
    [tone({ wave: 'pnoise', dur: 0.06, f0: 700, filters: [{ type: 'lp', f0: 1100 }], env: perc(0.012) })],
    [tone({ wave: 'sine', dur: 0.05, f0: 120, f1: 60, env: perc(0.014) }), 0, 0.6],
  ]) },

  // axe into wood: hollow triangle knock + woody band of noise, small second knock
  chop: { vol: 0.6, make: () => mix([
    [tone({ wave: 'triangle', dur: 0.12, f0: 340, f1: 170, env: perc(0.03) })],
    [tone({ wave: 'noise', dur: 0.06, filters: [{ type: 'bp', f0: 1900, q: 1.2 }], env: perc(0.015), seed: 11 }), 0, 0.9],
    [tone({ wave: 'triangle', dur: 0.06, f0: 260, f1: 150, env: perc(0.018) }), 0.045, 0.35],
  ]) },

  // pick on stone: inharmonic metallic clink + grit + low body
  mine: { vol: 0.55, make: () => mix([
    [tone({ wave: 'square', dur: 0.14, f0: 1650, duty: 0.5, env: perc(0.035) }), 0, 0.5],
    [tone({ wave: 'square', dur: 0.1, f0: 2490, duty: 0.5, env: perc(0.022) }), 0, 0.3],
    [tone({ wave: 'noise', dur: 0.04, filters: [{ type: 'hp', f0: 2500 }], env: perc(0.008), seed: 12 }), 0, 0.7],
    [tone({ wave: 'sine', dur: 0.06, f0: 170, f1: 90, env: perc(0.02) }), 0, 0.5],
  ]) },

  // classic pickup: B5 then E6 (two rising tones)
  coin: { vol: 0.5, make: () => mix([
    [tone({ wave: 'square', dur: 0.22, f0: n('B5'), duty: 0.5, arp: [[0.07, n('E6') / n('B5')]], env: { a: 0.002, hold: 0.07, decay: 0.05 } }), 0, 0.7],
    [tone({ wave: 'triangle', dur: 0.22, f0: n('B5') * 2, arp: [[0.07, n('E6') / n('B5')]], env: { a: 0.002, hold: 0.07, decay: 0.04 } }), 0, 0.25],
  ]) },

  // building placed: soft wooden thump + click
  place: { vol: 0.6, make: () => mix([
    [tone({ wave: 'sine', dur: 0.16, f0: 210, f1: 95, env: perc(0.045) })],
    [tone({ wave: 'noise', dur: 0.05, filters: [{ type: 'lp', f0: 1400 }], env: perc(0.014), seed: 21 }), 0, 0.6],
    [tone({ wave: 'square', dur: 0.04, f0: 660, duty: 0.5, env: perc(0.012) }), 0.012, 0.22],
  ]) },

  // can't place: two descending buzzes (A3 → E3), gently low-passed
  place_fail: { vol: 0.5, make: () => tone({ wave: 'square', dur: 0.26, f0: 220, duty: 0.35, arp: [[0.125, 0.75]],
    vib: { rate: 28, depth: 0.25 }, filters: [{ type: 'lp', f0: 1600 }], env: { a: 0.003, d: 0.04, s: 0.75, r: 0.05 } }) },

  // upgrade: quick C-E-G-C arpeggio with octave-lower triangle body
  upgrade: { vol: 0.55, make: () => {
    const arp = [[0.065, 1.26], [0.13, 1.498], [0.195, 2]];
    return mix([
      [tone({ wave: 'square', dur: 0.4, f0: n('C5'), duty: 0.25, arp, arpAbs: true, env: { a: 0.002, hold: 0.22, decay: 0.07 } }), 0, 0.6],
      [tone({ wave: 'triangle', dur: 0.4, f0: n('C4'), arp, arpAbs: true, env: { a: 0.002, hold: 0.22, decay: 0.07 } }), 0, 0.5],
    ]);
  } },

  // sell: descending three-note chime (E6 B5 G5)
  sell: { vol: 0.5, make: () => mix([
    [tone({ wave: 'triangle', dur: 0.26, f0: n('E6'), arp: [[0.06, n('B5') / n('E6')], [0.12, n('G5') / n('E6')]], arpAbs: true, env: { a: 0.002, hold: 0.12, decay: 0.05 } })],
    [tone({ wave: 'square', dur: 0.26, f0: n('E6'), duty: 0.5, arp: [[0.06, n('B5') / n('E6')], [0.12, n('G5') / n('E6')]], arpAbs: true, env: { a: 0.002, hold: 0.12, decay: 0.04 } }), 0, 0.25],
  ]) },

  // arrow: bow-string twang + airy band-passed whoosh sweeping down
  arrow: { vol: 0.4, make: () => mix([
    [tone({ wave: 'noise', dur: 0.18, filters: [{ type: 'bp', f0: 3200, f1: 900, q: 1.4 }], env: { a: 0.01, hold: 0.02, decay: 0.04 }, seed: 31 })],
    [tone({ wave: 'triangle', dur: 0.08, f0: 520, f1: 380, env: perc(0.02) }), 0, 0.45],
  ]) },

  // ballista: heavy low twang (low-passed saw) + wooden thunk + darker whoosh
  ballista: { vol: 0.55, make: () => mix([
    [tone({ wave: 'saw', dur: 0.2, f0: 170, f1: 70, filters: [{ type: 'lp', f0: 900 }], env: perc(0.05) })],
    [tone({ wave: 'noise', dur: 0.05, filters: [{ type: 'lp', f0: 1100 }], env: perc(0.015), seed: 41 }), 0, 0.8],
    [tone({ wave: 'noise', dur: 0.22, filters: [{ type: 'bp', f0: 1500, f1: 450, q: 1.2 }], env: { a: 0.015, decay: 0.06 }, seed: 42 }), 0.02, 0.5],
  ]) },

  // mortar launch: deep thump with pitch-drop and smoky noise
  mortar_fire: { vol: 0.65, make: () => mix([
    [tone({ wave: 'sine', dur: 0.32, f0: 130, f1: 40, env: perc(0.08) })],
    [tone({ wave: 'noise', dur: 0.3, filters: [{ type: 'lp', f0: 900, f1: 200 }], env: perc(0.06), seed: 51 }), 0, 0.8],
    [tone({ wave: 'square', dur: 0.05, f0: 90, duty: 0.5, filters: [{ type: 'lp', f0: 600 }], env: perc(0.015) }), 0, 0.4],
  ]) },

  // explosion: noise with sweeping low-pass and a long exponential tail, sub drop, debris crackle
  explosion: { vol: 0.7, drive: 2, make: () => mix([
    [tone({ wave: 'noise', dur: 0.58, filters: [{ type: 'lp', f0: 4500, f1: 160, q: 0.8 }], env: { a: 0.002, hold: 0.02, decay: 0.16 }, seed: 61 })],
    [tone({ wave: 'sine', dur: 0.4, f0: 85, f1: 30, env: perc(0.12) }), 0, 0.9],
    [crackle({ dur: 0.5, density: 70, seed: 62, lp: 3000, hp: 400, env: { a: 0.001, hold: 0.04, decay: 0.12 } }), 0.01, 0.5],
  ]) },

  // frost: staggered crystalline sine chimes + cold descending hiss
  frost: { vol: 0.5, make: () => mix([
    ...[n('C7'), n('E7'), n('G6'), n('B6')].map((f, i) => [tone({ wave: 'sine', dur: 0.24, f0: f, vib: { rate: 11, depth: 0.15 }, env: perc(0.07) }), i * 0.035, 0.45]),
    [tone({ wave: 'noise', dur: 0.34, filters: [{ type: 'hp', f0: 5000, f1: 2500 }], env: { a: 0.01, hold: 0.04, decay: 0.08 }, am: { rate: 30, depth: 0.5 }, seed: 71 }), 0, 0.5],
  ]) },

  // spark: jittery zap square + high crackle
  spark: { vol: 0.5, make: () => mix([
    [tone({ wave: 'square', dur: 0.24, f0: 1100, duty: 0.3, jitter: { rate: 140, depth: 8, seed: 81 }, env: perc(0.06) }), 0, 0.6],
    [crackle({ dur: 0.24, density: 160, seed: 82, lp: 9000, hp: 2500, decay: 0.002, env: perc(0.07) }), 0, 1],
    [tone({ wave: 'noise', dur: 0.03, filters: [{ type: 'hp', f0: 3000 }], env: perc(0.006), seed: 83 }), 0, 0.6],
  ]) },

  // hero hits — three distinct variations: slash / blunt / heavy
  hero_hit_1: { vol: 0.5, make: () => mix([
    [tone({ wave: 'noise', dur: 0.1, filters: [{ type: 'bp', f0: 1500, f1: 4200, q: 1.3 }], env: { a: 0.004, decay: 0.025 }, seed: 91 })],
    [tone({ wave: 'square', dur: 0.06, f0: 340, f1: 160, duty: 0.5, env: perc(0.018) }), 0.01, 0.45],
  ]) },
  hero_hit_2: { vol: 0.55, make: () => mix([
    [tone({ wave: 'sine', dur: 0.11, f0: 190, f1: 70, env: perc(0.035) })],
    [tone({ wave: 'noise', dur: 0.05, filters: [{ type: 'lp', f0: 1000 }], env: perc(0.015), seed: 92 }), 0, 0.8],
    [tone({ wave: 'triangle', dur: 0.06, f0: 420, f1: 300, env: perc(0.012) }), 0, 0.3],
  ]) },
  hero_hit_3: { vol: 0.55, drive: 1.8, make: () => mix([
    [tone({ wave: 'saw', dur: 0.14, f0: 280, f1: 85, filters: [{ type: 'lp', f0: 2200 }], env: perc(0.045) })],
    [tone({ wave: 'noise', dur: 0.08, filters: [{ type: 'bp', f0: 900, q: 0.9 }], env: perc(0.025), seed: 93 }), 0, 0.8],
    [tone({ wave: 'square', dur: 0.03, f0: 1600, f1: 1000, duty: 0.5, env: perc(0.008) }), 0, 0.25],
  ]) },

  // enemy hit: squishy short pluck
  enemy_hit: { vol: 0.45, make: () => mix([
    [tone({ wave: 'square', dur: 0.08, f0: 520, f1: 210, duty: 0.25, env: perc(0.022) })],
    [tone({ wave: 'noise', dur: 0.04, filters: [{ type: 'lp', f0: 2400 }], env: perc(0.01), seed: 101 }), 0, 0.6],
  ]) },

  // enemy dies: falling wobbly tone + shadowy puff
  enemy_die: { vol: 0.5, make: () => mix([
    [tone({ wave: 'square', dur: 0.28, f0: 700, f1: 110, duty: 0.5, vib: { rate: 17, depth: 0.8 }, filters: [{ type: 'lp', f0: 2500 }], env: { a: 0.002, d: 0.06, s: 0.55, r: 0.12 } }), 0, 0.7],
    [tone({ wave: 'noise', dur: 0.24, filters: [{ type: 'lp', f0: 1600, f1: 400 }], env: { a: 0.02, decay: 0.06 }, seed: 111 }), 0.02, 0.35],
  ]) },

  // wall breaks: crunch + rubble crackle + thud
  wall_break: { vol: 0.65, drive: 1.6, make: () => mix([
    [tone({ wave: 'noise', dur: 0.44, filters: [{ type: 'lp', f0: 2600, f1: 380 }], env: { a: 0.002, hold: 0.02, decay: 0.1 }, seed: 121 })],
    [crackle({ dur: 0.44, density: 45, seed: 122, lp: 3200, hp: 300, decay: 0.008, env: { a: 0.001, hold: 0.08, decay: 0.12 } }), 0.02, 0.8],
    [tone({ wave: 'sine', dur: 0.15, f0: 95, f1: 45, env: perc(0.05) }), 0, 0.8],
    [tone({ wave: 'noise', dur: 0.12, filters: [{ type: 'lp', f0: 1500 }], env: perc(0.03), seed: 123 }), 0.09, 0.5],
  ]) },

  // brazier lights: swelling whoosh + fire crackle + warm fwoomp
  brazier_on: { vol: 0.5, make: () => mix([
    [tone({ wave: 'noise', dur: 0.38, filters: [{ type: 'bp', f0: 350, f1: 2600, q: 0.9 }], env: { a: 0.14, d: 0.06, s: 0.7, r: 0.16 }, seed: 131 })],
    [crackle({ dur: 0.36, density: 60, seed: 132, lp: 5000, hp: 900, env: { a: 0.12, d: 0.05, s: 0.7, r: 0.15 } }), 0.02, 0.6],
    [tone({ wave: 'sine', dur: 0.32, f0: 160, f1: 260, env: { a: 0.12, d: 0.05, s: 0.5, r: 0.15 } }), 0, 0.3],
  ]) },

  // brazier snuffed: short puff then a fading hiss + falling tone
  brazier_off: { vol: 0.5, make: () => mix([
    [tone({ wave: 'noise', dur: 0.34, filters: [{ type: 'lp', f0: 6000, f1: 350 }, { type: 'hp', f0: 300 }], env: { a: 0.006, decay: 0.09 }, seed: 141 })],
    [tone({ wave: 'sine', dur: 0.2, f0: 420, f1: 150, env: perc(0.06) }), 0, 0.3],
  ]) },

  // night horn: deep ominous horn (A2 + E3 fifth + sub), slow swell, bend-in, gentle vibrato
  night_horn: { vol: 0.7, make: () => {
    const env = { a: 0.2, d: 0.2, s: 0.8, r: 0.35 }, vib = { rate: 4.5, depth: 0.15, delay: 0.35 };
    const lp = [{ type: 'lp', f0: 500, f1: 800, q: 0.9 }];
    return mix([
      [tone({ wave: 'saw', dur: 1.08, f0: 104, f1: 110, slideTime: 0.18, vib, filters: lp, env })],
      [tone({ wave: 'saw', dur: 1.04, f0: 156, f1: 165, slideTime: 0.18, vib, filters: lp, env }), 0.03, 0.5],
      [tone({ wave: 'square', dur: 1.08, f0: 55, duty: 0.5, filters: [{ type: 'lp', f0: 300 }], env }), 0, 0.3],
    ]);
  } },

  // rally horn: bright heroic two-note call (D4 → A4)
  rally_horn: { vol: 0.65, make: () => {
    const lp = [{ type: 'lp', f0: 2200, q: 0.8 }];
    const v = (f, dur, env, vib) => mix([
      [tone({ wave: 'saw', dur, f0: f * 0.97, f1: f, slideTime: 0.04, filters: lp, env, vib })],
      [tone({ wave: 'square', dur, f0: f * 0.97, f1: f, slideTime: 0.04, duty: 0.25, filters: lp, env, vib }), 0, 0.3],
    ]);
    return mix([
      [v(n('D4'), 0.26, { a: 0.03, d: 0.05, s: 0.85, r: 0.04 })],
      [v(n('A4'), 0.55, { a: 0.02, d: 0.1, s: 0.8, r: 0.25 }, { rate: 5.5, depth: 0.2, delay: 0.15 }), 0.24],
    ]);
  } },

  // boon pick: magical rising sparkle E5 G#5 B5 E6 with a high shimmer
  boon_pick: { vol: 0.55, make: () => {
    const arp = [[0.05, 1.26], [0.1, 1.498], [0.15, 2]];
    return mix([
      [tone({ wave: 'sine', dur: 0.45, f0: n('E5'), arp, arpAbs: true, env: { a: 0.002, hold: 0.2, decay: 0.08 } })],
      [tone({ wave: 'triangle', dur: 0.45, f0: n('E6'), arp, arpAbs: true, env: { a: 0.002, hold: 0.2, decay: 0.07 } }), 0, 0.35],
      [tone({ wave: 'sine', dur: 0.3, f0: n('E7'), am: { rate: 22, depth: 0.8 }, env: { a: 0.04, decay: 0.08 } }), 0.15, 0.25],
    ]);
  } },

  // level up: square fanfare arpeggio C5 E5 G5 C6, held top note with vibrato, triangle harmony
  level_up: { vol: 0.6, make: () => mix([
    [tone({ wave: 'square', dur: 0.55, f0: n('C5'), duty: 0.5, arp: [[0.06, 1.26], [0.12, 1.498], [0.18, 2]], arpAbs: true,
      vib: { rate: 6, depth: 0.2, delay: 0.25 }, env: { a: 0.002, d: 0.1, s: 0.7, r: 0.2 } }), 0, 0.6],
    [tone({ wave: 'triangle', dur: 0.4, f0: n('G5'), env: { a: 0.01, d: 0.1, s: 0.6, r: 0.2 } }), 0.18, 0.4],
    [tone({ wave: 'triangle', dur: 0.4, f0: n('C4'), env: { a: 0.01, d: 0.1, s: 0.6, r: 0.2 } }), 0.18, 0.45],
  ]) },

  // ui click: tiny bright blip
  ui_click: { vol: 0.4, make: () => mix([
    [tone({ wave: 'square', dur: 0.035, f0: 1400, duty: 0.5, env: perc(0.007) }), 0, 0.6],
    [tone({ wave: 'sine', dur: 0.025, f0: 2800, env: perc(0.004) }), 0, 0.4],
  ]) },

  // victory: "ta-ta-ta-taaa, ta-ta-TAAA" fanfare in C major with harmony and bass
  victory: { vol: 0.7, make: () => {
    const lead = [['G4', 0, 0.11], ['C5', 0.12, 0.11], ['E5', 0.24, 0.11], ['G5', 0.36, 0.24], ['E5', 0.62, 0.1], ['G5', 0.74, 0.1], ['C6', 0.86, 0.38]];
    const harm = [['E4', 0.36, 0.24], ['C5', 0.62, 0.1], ['E5', 0.74, 0.1], ['G5', 0.86, 0.38]];
    const bass = [['C3', 0, 0.34], ['G2', 0.36, 0.48], ['C3', 0.86, 0.38]];
    const L = [];
    for (const [nm, t, d] of lead) L.push([tone({ wave: 'square', dur: d, f0: n(nm), duty: 0.5, vib: d > 0.3 ? { rate: 6, depth: 0.2, delay: 0.15 } : undefined, env: { a: 0.004, d: 0.06, s: 0.75, r: Math.min(0.12, d * 0.4) } }), t, 0.5]);
    for (const [nm, t, d] of harm) L.push([tone({ wave: 'square', dur: d, f0: n(nm), duty: 0.25, env: { a: 0.004, d: 0.06, s: 0.7, r: Math.min(0.12, d * 0.4) } }), t, 0.22]);
    for (const [nm, t, d] of bass) L.push([tone({ wave: 'triangle', dur: d, f0: n(nm), env: { a: 0.004, d: 0.05, s: 0.9, r: 0.06 } }), t, 0.5]);
    L.push([tone({ wave: 'noise', dur: 0.4, filters: [{ type: 'hp', f0: 4000 }], env: perc(0.12), seed: 151 }), 0.86, 0.15]);
    return mix(L);
  } },

  // defeat: slow chromatic descent E4 D#4 D4 C#4 over a low A, saw through a soft low-pass
  defeat: { vol: 0.65, make: () => {
    const lead = [['E4', 0, 0.3], ['D#4', 0.32, 0.3], ['D4', 0.64, 0.3], ['C#4', 0.96, 0.34]];
    const L = lead.map(([nm, t, d], i) => [tone({ wave: 'saw', dur: d, f0: n(nm), filters: [{ type: 'lp', f0: 1400 }],
      vib: i === 3 ? { rate: 5, depth: 0.3, delay: 0.1 } : undefined, env: { a: 0.02, d: 0.08, s: 0.7, r: i === 3 ? 0.3 : 0.06 } }), t, 0.5]);
    L.push([tone({ wave: 'triangle', dur: 1.3, f0: n('A2'), env: { a: 0.05, d: 0.2, s: 0.7, r: 0.4 } }), 0, 0.22]);
    return mix(L);
  } },

  // boss roar: swelling low growl — saw with AM + vibrato, rumbling noise and a sub square
  boss_roar: { vol: 0.75, drive: 2.5, make: () => {
    const env = { a: 0.22, d: 0.2, s: 0.75, r: 0.45 };
    return mix([
      [tone({ wave: 'saw', dur: 1.0, f0: 95, f1: 55, slideDelay: 0.25, vib: { rate: 7, depth: 1.2 }, am: { rate: 31, depth: 0.6 }, filters: [{ type: 'lp', f0: 1400, f1: 500 }], env })],
      [tone({ wave: 'noise', dur: 1.0, filters: [{ type: 'lp', f0: 1100, f1: 300 }], am: { rate: 23, depth: 0.5 }, env, seed: 161 }), 0, 0.6],
      [tone({ wave: 'square', dur: 1.0, f0: 48, f1: 36, duty: 0.5, filters: [{ type: 'lp', f0: 250 }], env }), 0, 0.4],
    ]);
  } },
};

// ═════════════════════════════════════════════════════════════════════════════
// MUSIC
// ═════════════════════════════════════════════════════════════════════════════
const lowOct = (sym) => (/^(A|Bb|B)/.test(sym) ? 2 : 3);

// Day — F major waltz, 3/4 @ 90 BPM, 12 bars = 24.0 s. Lyrical lead with echo, broken-chord pulse,
// waltz bass (root – fifth), brushed percussion.
const DAY_PROG = ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C', 'Dm', 'Bb', 'Gm', 'C'];
const day = {
  name: 'music_day', bpm: 90, beatsPerBar: 3, stepsPerBeat: 2, bars: 12,
  channels: [
    { wave: 'square', gain: 0.24, lowpass: 3200, echo: { delay: (60 / 90) * 1.5, fb: 0.3, wet: 0.3 },
      inst: { duty: 0.5, a: 0.012, d: 0.25, s: 0.55, r: 0.09, gate: 0.92, vib: { rate: 5, depth: 0.15, delay: 0.25 } },
      pattern: `A4 - - - C5 - | D5 - - C5 A4 - | Bb4 - - D5 - C5 | G4 - - - - . |
                A4 - - - C5 - | E5 - - C5 A4 C5 | D5 - - F5 - D5 | C5 - - - - . |
                F5 - - E5 D5 - | D5 - - C5 Bb4 - | A4 - - G4 Bb4 - | G4 - - E4 - .` },
    { wave: 'square', gain: 0.1, lowpass: 2600, inst: { duty: 0.25, a: 0.006, d: 0.15, s: 0.4, r: 0.06, gate: 0.85 },
      pattern: perBar(DAY_PROG, (c) => { const [r, t, f] = chord(c, lowOct(c)); const r2 = chord(c, lowOct(c) + 1)[0]; return [r, t, f, r2, f, t]; }) },
    { wave: 'triangle', gain: 0.4, inst: { a: 0.005, d: 0.1, s: 0.8, r: 0.05, gate: 0.9, steps: 8 },
      pattern: perBar(DAY_PROG, (c) => { const [r, , f] = chord(c, 2); return [r, '-', '-', '-', f, '-']; }) },
    { wave: 'noise', gain: 0.16, levels: { h: 0.35 },
      pattern: perBar(DAY_PROG, (c, b) => (b % 4 === 3 ? ['k', '.', 'h', '.', 'h', 'h'] : ['k', '.', 'h', '.', 'h', '.'])) },
  ],
};

// Night — A minor, 3/4 @ 135 BPM, 12 bars = 16.0 s. Galloping eighth-note bass pedal,
// off-beat stabs, harmonic-minor lead (G#), insistent drums with fills.
const NIGHT_PROG = ['Am', 'Am', 'F', 'E', 'Am', 'Am', 'Dm', 'E', 'F', 'G', 'E', 'E'];
const night = {
  name: 'music_night', bpm: 135, beatsPerBar: 3, stepsPerBeat: 2, bars: 12,
  channels: [
    { wave: 'square', gain: 0.22, lowpass: 4000, echo: { delay: (60 / 135) * 0.75, fb: 0.2, wet: 0.18 },
      inst: { duty: 0.25, a: 0.006, d: 0.12, s: 0.6, r: 0.05, gate: 0.9, vib: { rate: 6, depth: 0.12, delay: 0.2 } },
      pattern: `A4 - - B4 C5 - | E5 - - D5 C5 B4 | C5 - - A4 - - | B4 - - G#4 - E4 |
                A4 - - B4 C5 - | E5 - - F5 E5 D5 | F5 - - E5 D5 - | E5 - - - G#4 - |
                A4 - C5 - F5 - | G5 - F5 - D5 - | E5 - - B4 - G#4 | B4 - - - - .` },
    { wave: 'square', gain: 0.1, lowpass: 3000, inst: { duty: 0.125, a: 0.003, d: 0.06, s: 0.4, r: 0.03, gate: 0.5 },
      pattern: perBar(NIGHT_PROG, (c) => { const [, t, f] = chord(c, 4); return ['.', t, '.', f, '.', t]; }) },
    { wave: 'triangle', gain: 0.42, inst: { a: 0.004, d: 0.08, s: 0.85, r: 0.03, gate: 0.8, steps: 8 },
      pattern: perBar(NIGHT_PROG, (c) => { const [r, , f] = chord(c, 2); const r3 = chord(c, 3)[0]; return [r, r, r3, r, f, r3]; }) },
    { wave: 'noise', gain: 0.2,
      pattern: perBar(NIGHT_PROG, (c, b) => (b === 11 ? ['k', 's', 's', 't', 't', 's'] : b % 4 === 3 ? ['k', 'h', 's', 'h', 's', 's'] : ['k', 'h', 's', 'h', 'k', 's'])) },
  ],
};

// Boss — E minor with a phrygian F, 4/4 @ 150 BPM, 10 bars = 16.0 s (8-bar riff + 2-bar turnaround
// on Am – B7). Driving octave bass, fast chord arpeggios, rock beat with fills and crash on the downbeat.
const BOSS_PROG = ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B', 'Am', 'B7'];
const boss = {
  name: 'music_boss', bpm: 150, beatsPerBar: 4, stepsPerBeat: 2, bars: 10,
  channels: [
    { wave: 'square', gain: 0.22, lowpass: 4500,
      inst: { duty: 0.25, a: 0.004, d: 0.1, s: 0.7, r: 0.04, gate: 0.92, vib: { rate: 7, depth: 0.15, delay: 0.18 } },
      pattern: `E5 - B4 - E5 F5 G5 - | F5 - E5 - D5 - B4 - | C5 - E5 - G5 - E5 - | F#5 - - - D5 - A4 - |
                E5 - B4 - E5 F5 G5 - | A5 - G5 - F5 - E5 - | G5 - - E5 C5 - E5 - | D#5 - - - F#5 - B5 - |
                A5 - - - E5 - C5 - | B4 - D#5 - F#5 - A5 -` },
    { wave: 'square', gain: 0.09, lowpass: 3500, inst: { duty: 0.25, a: 0.003, d: 0.08, s: 0.6, r: 0.03, gate: 0.85, arpRate: 36 },
      pattern: perBar(BOSS_PROG, (c) => { const t = chord(c.replace('7', ''), c.startsWith('B') ? 3 : 4).join('+'); return [t, '-', t, '-', t, '-', t, '-']; }) },
    { wave: 'triangle', gain: 0.45, inst: { a: 0.003, d: 0.06, s: 0.85, r: 0.02, gate: 0.75, steps: 8 },
      pattern: perBar(BOSS_PROG, (c) => { const r = chord(c.replace('7', ''), 2)[0], r3 = chord(c.replace('7', ''), 3)[0]; return [r, r3, r, r3, r, r3, r, r3]; }) },
    { wave: 'noise', gain: 0.22,
      pattern: perBar(BOSS_PROG, (c, b) => b === 0 ? ['kc', 'h', 's', 'h', 'k', 'k', 's', 'h']
        : b === 7 ? ['k', 'h', 's', 'h', 's', 's', 's', 's']
        : b === 9 ? ['k', 's', 'k', 's', 't', 't', 's', 's']
        : ['k', 'h', 's', 'h', 'k', 'k', 's', 'o']) },
  ],
};

export const SONGS = [day, night, boss];

// ═════════════════════════════════════════════════════════════════════════════
// build
// ═════════════════════════════════════════════════════════════════════════════
function renderMusic(song) {
  const b = removeDC(renderSong(song));
  return normalize(b, -1); // no fades: the buffer is circular, so the loop seam is already continuous
}

function main() {
  const quiet = process.argv.includes('--quiet');
  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of readdirSync(OUT_DIR)) if (f.endsWith('.wav')) unlinkSync(join(OUT_DIR, f));

  const manifest = {
    version: 1, sampleRate: SR, channels: 1, bitsPerSample: 16,
    note: 'Generated by tools/audio/synth.mjs — do not edit. Load with resources.load(`audio/${name}`, AudioClip).',
    playback: { maxSfxVoices: 8, sfxRetriggerMs: 50, musicCrossfadeSec: 1.0, startAfterFirstTouch: true },
    files: {},
  };
  const rows = [];
  let total = 0;

  const emit = (name, buf, meta) => {
    const wav = encodeWav(buf);
    writeFileSync(join(OUT_DIR, `${name}.wav`), wav);
    total += wav.length;
    manifest.files[name] = { file: `${name}.wav`, path: `audio/${name}`, bytes: wav.length, ...meta };
    const a = analyse(buf);
    const intent = INTENT[name]?.(a, pitchTrack(buf));
    rows.push({ name, a, intent, bytes: wav.length });
  };

  for (const [name, def] of Object.entries(SFX)) {
    const buf = master(def.make(), { drive: def.drive ?? 1.2 });
    emit(name, buf, { category: 'sfx', duration: +(buf.length / SR).toFixed(3), samples: buf.length, volume: def.vol, loop: false });
  }
  for (const song of SONGS) {
    const buf = renderMusic(song);
    const L = songLength(song);
    if (buf.length !== L) throw new Error('song length mismatch');
    emit(song.name, buf, { category: 'music', duration: +(L / SR).toFixed(3), samples: L, volume: 0.55, loop: true,
      loopStart: 0, loopEnd: L, bpm: song.bpm, beatsPerBar: song.beatsPerBar, bars: song.bars });
  }
  manifest.totalBytes = total;
  writeFileSync(join(OUT_DIR, 'audio.json'), JSON.stringify(manifest, null, 2) + '\n');

  if (!quiet) {
    const pad = (s, w) => String(s).padEnd(w);
    const num = (v, w, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-').padStart(w);
    console.log(`${pad('name', 13)}${'dur s'.padStart(7)}${'peak dB'.padStart(9)}${'rms dB'.padStart(8)}${'cent Hz'.padStart(9)}${'zcr Hz'.padStart(8)}${'flat'.padStart(6)}${'atk s'.padStart(7)}${'dec20'.padStart(7)}  intent`);
    for (const { name, a, intent } of rows) {
      console.log(`${pad(name, 13)}${num(a.dur, 7)}${num(a.peakDb, 9)}${num(a.rmsDb, 8, 1)}${num(a.centroid, 9, 0)}${num(a.zcr, 8, 0)}${num(a.flatness, 6)}${num(a.attack, 7)}${num(a.decay20, 7)}  ${intent ? `${intent[0] ? 'OK ' : 'BAD'} ${intent[1]}` : '(music)'}`);
    }
    console.log(`\n${rows.length} files, ${total} bytes (${(total / 1048576).toFixed(3)} MiB) → ${OUT_DIR}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

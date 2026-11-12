#!/usr/bin/env node
// Verifies generated audio. Exit code 1 on any failure.
//   node tools/audio/verify.mjs
// Checks: manifest ↔ files, WAV header validity (RIFF/PCM/mono/22050/16-bit), duration matches manifest,
// no NaN / no clipped samples, peak within [-3, -0.5] dBFS, audible RMS, click-free SFX edges,
// music loops exactly N bars with a continuous seam, music durations per SPEC, total size < 5 MB,
// and the per-SFX "listen proxy" intent checks from analyze.mjs.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, decodeWav } from './sfxr.mjs';
import { analyse, pitchTrack, INTENT } from './analyze.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'assets', 'resources', 'audio');
const MAX_TOTAL = 5_000_000; // bytes ("5 MB" per SPEC §12 v2, decimal — stricter than 5 MiB)

const REQUIRED_SFX = ['step', 'chop', 'mine', 'coin', 'place', 'place_fail', 'upgrade', 'sell', 'arrow', 'ballista',
  'mortar_fire', 'explosion', 'frost', 'spark', 'hero_hit_1', 'hero_hit_2', 'hero_hit_3', 'enemy_hit', 'enemy_die',
  'wall_break', 'brazier_on', 'brazier_off', 'night_horn', 'rally_horn', 'boon_pick', 'level_up', 'ui_click',
  'victory', 'defeat', 'boss_roar',
  // v2 (SPEC §12 "Hold" additions)
  'bell', 'collect_away', 'villager_work_1', 'villager_work_2', 'villager_work_3', 'storage_full', 'hearth_tier',
  'region_sealed', 'extract_ok', 'extract_fail', 'timer_tick', 'blood_moon', 'tower_frozen', 'burrow'];
const MUSIC = { music_day: [16, 32], music_night: [16, 32], music_boss: [16, 32], music_expedition: [16, 32], music_day2: [16, 32] }; // loops of 16–32 s (SPEC §12)

const errors = [];
const fail = (name, msg) => errors.push(`${name}: ${msg}`);

const manPath = join(DIR, 'audio.json');
if (!existsSync(manPath)) { console.error('audio.json missing — run `npm run audio` first'); process.exit(1); }
const man = JSON.parse(readFileSync(manPath, 'utf8'));
const files = man.files ?? {};

for (const n of [...REQUIRED_SFX, ...Object.keys(MUSIC)]) if (!files[n]) fail(n, 'missing from audio.json');
const sfxCount = Object.values(files).filter((f) => f.category === 'sfx').length;
if (sfxCount < 44) fail('audio.json', `only ${sfxCount} SFX (need ≥ 44: v1 30 + v2 14)`);
const onDisk = readdirSync(DIR).filter((f) => f.endsWith('.wav'));
for (const f of onDisk) if (!Object.values(files).some((e) => e.file === f)) fail(f, 'WAV not listed in audio.json');

let total = 0, checked = 0;
const lines = [];
for (const [name, meta] of Object.entries(files)) {
  const p = join(DIR, meta.file);
  if (!existsSync(p)) { fail(name, `file ${meta.file} missing`); continue; }
  const buf = readFileSync(p);
  total += buf.length;
  let w;
  try { w = decodeWav(buf); } catch (e) { fail(name, `bad WAV: ${e.message}`); continue; }
  if (w.channels !== 1) fail(name, `channels=${w.channels}`);
  if (w.sr !== SR) fail(name, `sampleRate=${w.sr}`);
  if (w.bits !== 16) fail(name, `bits=${w.bits}`);
  const x = w.samples, n = x.length;
  if (n === 0) { fail(name, 'empty'); continue; }
  if (Math.abs(n / SR - meta.duration) > 0.001) fail(name, `duration ${n / SR} ≠ manifest ${meta.duration}`);
  if (!(meta.volume > 0 && meta.volume <= 1)) fail(name, `bad suggested volume ${meta.volume}`);
  if (!['sfx', 'music'].includes(meta.category)) fail(name, `bad category ${meta.category}`);

  let clipped = 0, nan = 0;
  for (let i = 0; i < n; i++) { if (!Number.isFinite(x[i])) nan++; if (w.raw[i] >= 32767 || w.raw[i] <= -32767) clipped++; }
  if (nan) fail(name, `${nan} NaN samples`);
  if (clipped) fail(name, `${clipped} clipped samples`);
  const a = analyse(x);
  if (a.peakDb > -0.5 || a.peakDb < -3) fail(name, `peak ${a.peakDb.toFixed(2)} dBFS outside [-3, -0.5]`);
  if (a.rmsDb < -30) fail(name, `too quiet: rms ${a.rmsDb.toFixed(1)} dBFS`);

  let extra = '';
  if (meta.category === 'sfx') {
    if (Math.abs(x[0]) > 0.01 || Math.abs(x[n - 1]) > 0.01) fail(name, `edge not silent (first=${x[0].toFixed(3)}, last=${x[n - 1].toFixed(3)}) → click`);
    if (a.dur > 1.6) fail(name, `SFX too long (${a.dur.toFixed(2)} s)`);
    const check = INTENT[name];
    if (check) { const [ok, why] = check(a, pitchTrack(x)); extra = `${ok ? 'OK ' : 'BAD'} ${why}`; if (!ok) fail(name, `intent check failed: ${why}`); }
  } else {
    if (!meta.loop) fail(name, 'music must be loop:true');
    const range = MUSIC[name];
    if (range && (a.dur < range[0] - 1e-6 || a.dur > range[1] + 1e-6)) fail(name, `duration ${a.dur.toFixed(2)} s outside ${range[0]}–${range[1]} s`);
    // whole number of bars
    const expect = Math.round((meta.bars * meta.beatsPerBar * 60 * SR) / meta.bpm);
    if (n !== expect || meta.loopEnd !== n || meta.loopStart !== 0) fail(name, `loop not on bar boundary: ${n} samples, expected ${expect}`);
    // seam continuity: jump and slope-prediction error across end→start vs. the interior distribution
    const d = [], e2 = [];
    for (let i = 2; i < n; i++) { d.push(Math.abs(x[i] - x[i - 1])); e2.push(Math.abs(x[i] - (2 * x[i - 1] - x[i - 2]))); }
    d.sort((p, q) => p - q); e2.sort((p, q) => p - q);
    const p999 = (arr) => arr[Math.floor(arr.length * 0.999)];
    const seamJump = Math.abs(x[0] - x[n - 1]);
    const seamPred = Math.abs(x[0] - (2 * x[n - 1] - x[n - 2]));
    const seamPred2 = Math.abs(x[1] - (2 * x[0] - x[n - 1]));
    if (seamJump > p999(d)) fail(name, `loop seam jump ${seamJump.toFixed(4)} > interior p99.9 ${p999(d).toFixed(4)}`);
    if (Math.max(seamPred, seamPred2) > p999(e2)) fail(name, `loop seam slope break ${Math.max(seamPred, seamPred2).toFixed(4)} > interior p99.9 ${p999(e2).toFixed(4)}`);
    extra = `loop ${meta.bars} bars @ ${meta.bpm} BPM, seam Δ=${seamJump.toFixed(4)} (interior p99.9 ${p999(d).toFixed(4)})`;
  }
  lines.push(`${name.padEnd(13)}${meta.category.padEnd(6)}${a.dur.toFixed(3).padStart(7)} s${a.peakDb.toFixed(2).padStart(7)} dB${a.rmsDb.toFixed(1).padStart(7)} dB${String(Math.round(a.centroid)).padStart(6)} Hz  ${extra}`);
  checked++;
}
if (total >= MAX_TOTAL) fail('total', `${total} bytes ≥ ${MAX_TOTAL}`);

console.log(lines.join('\n'));
console.log(`\n${checked} files, total ${total} bytes (${(total / 1e6).toFixed(3)} MB / limit ${(MAX_TOTAL / 1e6).toFixed(1)} MB)`);
if (errors.length) {
  console.error(`\nAUDIO VERIFY FAILED (${errors.length}):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('AUDIO VERIFY OK');

#!/usr/bin/env node
// `npm run verify` — the Definition-of-Done pipeline (SPEC §13.5 / §15.A). Runs every gate in order, prints a
// PASS/FAIL table and exits non-zero on any failure.
//   --allow-blocked   a BLOCKED step (cocos-cli not installable here) is reported as a warning instead of a failure
//   --only a,b        run only these step ids          --skip a,b   skip these step ids
//   --verbose         stream every step's output
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const listArg = (f) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1].split(',') : null; };
const ONLY = listArg('--only'), SKIP = listArg('--skip') || [];
const VERBOSE = flag('--verbose'), ALLOW_BLOCKED = flag('--allow-blocked');
const LOG_DIR = join(tmpdir(), 'emberhold-verify');
mkdirSync(LOG_DIR, { recursive: true });

function run(cmd, cmdArgs, { env = {}, timeout = 30 * 60_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ...env }, shell: false });
    let out = '';
    const onData = (d) => { out += d; if (VERBOSE) process.stdout.write(d); };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    const timer = setTimeout(() => { out += `\n[verify] TIMEOUT after ${timeout / 1000}s\n`; child.kill('SIGKILL'); }, timeout);
    child.on('error', (e) => { out += `\n[verify] spawn error: ${e.message}\n`; });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, out: out.replace(/\x1b\[[0-9;]*m/g, '') }); });
  });
}
const npm = (script) => run('npm', ['run', '--silent', script]);
const node = (...a) => run(process.execPath, a);

function walk(dir, ext, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, ext, acc); else if (p.endsWith(ext)) acc.push(p);
  }
  return acc;
}
function onPath(bin) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim().split('\n')[0] : null;
}

// ── steps ───────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'art', name: 'Art: build atlas + lint + manifest', fn: () => npm('art') },
  { id: 'audio', name: 'Audio: synth + verify', fn: async () => {
    const a = await npm('audio');
    if (a.code !== 0) return a;
    if (!existsSync(join(ROOT, 'tools/audio/verify.mjs'))) return { code: 1, out: a.out + '\ntools/audio/verify.mjs missing' };
    const b = await node('tools/audio/verify.mjs');
    return { code: b.code, out: a.out + b.out };
  } },
  { id: 'typecheck', name: 'Typecheck (core + game)', fn: () => npm('typecheck') },
  { id: 'test', name: 'Unit tests (vitest)', fn: () => npm('test') },
  { id: 'balance', name: 'Balance gates (sim:balance)', fn: () => npm('sim:balance') },
  { id: 'grep', name: "Grep gates (core !'cc', game Graphics only in debug)", fn: async () => {
    const bad = [];
    const ccImport = /(?:from\s*['"]cc(?:\/[^'"]*)?['"])|(?:import\s*['"]cc(?:\/[^'"]*)?['"])|(?:require\(\s*['"]cc(?:\/[^'"]*)?['"]\s*\))|(?:import\(\s*['"]cc(?:\/[^'"]*)?['"]\s*\))/;
    const coreFiles = walk(join(ROOT, 'assets/scripts/core'), '.ts');
    for (const f of coreFiles) {
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (ccImport.test(l)) bad.push(`${relative(ROOT, f)}:${i + 1}: imports 'cc': ${l.trim()}`); });
    }
    const gameFiles = walk(join(ROOT, 'assets/scripts/game'), '.ts');
    for (const f of gameFiles) {
      if (/debug/i.test(relative(join(ROOT, 'assets/scripts/game'), f))) continue;
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        const code = l.replace(/\/\/.*$/, '');
        if (/\bGraphics\b/.test(code)) bad.push(`${relative(ROOT, f)}:${i + 1}: uses Graphics outside a debug file: ${l.trim()}`);
      });
    }
    const out = `core files: ${coreFiles.length}, game files: ${gameFiles.length}\n` + (bad.length ? bad.join('\n') : 'no violations');
    if (!coreFiles.length) return { code: 1, out: out + '\nno core sources found' };
    return { code: bad.length ? 1 : 0, out };
  } },
  { id: 'cocos', name: 'cocos build --platform web-mobile', fn: async () => {
    const bin = onPath('cocos');
    if (!bin) return { code: 0, blocked: true, out: 'cocos binary not on PATH' };
    return run(bin, ['--no-interactive', 'build', '--project', ROOT, '--platform', 'web-mobile']);
  } },
  { id: 'preview', name: 'Preview: typecheck + esbuild bundle', fn: async () => {
    const tsc = join(ROOT, 'node_modules/typescript/bin/tsc');
    const a = await node(tsc, '-p', 'tools/preview/tsconfig.json');
    if (a.code !== 0) return a;
    const b = await node('tools/preview/build.mjs');
    return { code: b.code, out: a.out + b.out };
  } },
  { id: 'e2e', name: 'E2E (Playwright, 390x844, 9 shots, fps)', fn: () => node('tools/verify/e2e.mjs', '--no-build') },
];

// ── main ────────────────────────────────────────────────────────────────────
const results = [];
const t0 = Date.now();
for (const s of STEPS) {
  if ((ONLY && !ONLY.includes(s.id)) || SKIP.includes(s.id)) { results.push({ ...s, status: 'SKIP', ms: 0, note: 'skipped by flag' }); continue; }
  process.stdout.write(`▶ ${s.name} ... `);
  const st = Date.now();
  let r;
  try { r = await s.fn(); } catch (e) { r = { code: 1, out: String(e?.stack || e) }; }
  const ms = Date.now() - st;
  const status = r.blocked ? 'BLOCKED' : r.code === 0 ? 'PASS' : 'FAIL';
  const log = join(LOG_DIR, `${s.id}.log`);
  writeFileSync(log, r.out || '');
  let note = '';
  if (status === 'BLOCKED') note = 'BLOCKED (cocos-cli not installable here)';
  else if (s.id === 'e2e') { const m = /avg fps[^\n]*/i.exec(r.out || ''); note = m ? m[0].trim() : ''; }
  else if (status === 'PASS') { const m = /Tests\s+(\d+ passed[^\n]*)/.exec(r.out || ''); note = m ? `${m[1].trim()} tests` : ''; }
  results.push({ ...s, status, ms, note, log });
  console.log(`${status} (${(ms / 1000).toFixed(1)}s)`);
  if (status === 'FAIL') {
    const lines = (r.out || '').trimEnd().split('\n');
    console.log(lines.slice(-40).map((l) => `    │ ${l}`).join('\n'));
    console.log(`    └ full log: ${log}`);
  }
}

const pad = (s, n) => String(s).padEnd(n);
const w = Math.max(...results.map((r) => r.name.length)) + 2;
console.log('\n' + pad('STEP', w) + pad('RESULT', 10) + pad('TIME', 9) + 'NOTE');
console.log('-'.repeat(w + 19 + 40));
for (const r of results) {
  const st = r.status === 'BLOCKED' && ALLOW_BLOCKED ? 'WARN' : r.status;
  console.log(pad(r.name, w) + pad(st, 10) + pad(r.ms ? `${(r.ms / 1000).toFixed(1)}s` : '-', 9) + (r.note || ''));
}
const failed = results.filter((r) => r.status === 'FAIL' || (r.status === 'BLOCKED' && !ALLOW_BLOCKED));
console.log('-'.repeat(w + 19 + 40));
console.log(`${failed.length ? 'VERIFY FAILED' : 'VERIFY PASSED'}: ${results.filter((r) => r.status === 'PASS').length} pass, ` +
  `${results.filter((r) => r.status === 'FAIL').length} fail, ${results.filter((r) => r.status === 'BLOCKED').length} blocked` +
  `${ALLOW_BLOCKED ? ' (allowed)' : ''}, ${results.filter((r) => r.status === 'SKIP').length} skipped in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(failed.length ? 1 : 0);

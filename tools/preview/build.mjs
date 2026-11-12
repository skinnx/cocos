// Bundles the Canvas2D web preview (debug/verification tool, see docs/DECISIONS.md) into tools/preview/dist/.
// Usage: node tools/preview/build.mjs [--watch]
import { build, context } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');

export async function buildPreview({ watch = false, quiet = false } = {}) {
  mkdirSync(dist, { recursive: true });
  copyFileSync(join(here, 'index.html'), join(dist, 'index.html'));
  const opts = {
    entryPoints: [join(here, 'src/main.ts')],
    outfile: join(dist, 'main.js'),
    bundle: true,
    format: 'iife',
    target: 'es2020',
    sourcemap: true,
    logLevel: quiet ? 'error' : 'info',
    // the shipping engine must never leak into the preview bundle
    external: ['cc', 'cc/env'],
  };
  if (watch) { const ctx = await context(opts); await ctx.watch(); return ctx; }
  return build(opts);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildPreview({ watch: process.argv.includes('--watch') }).catch((e) => { console.error(e.message || e); process.exit(1); });
}

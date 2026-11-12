// Zero-dependency static server for the web preview.
//   /            -> tools/preview/dist/   (index.html, main.js)
//   /resources/  -> assets/resources/     (art/atlas.png, art/atlas.json, audio/*.wav, audio/audio.json)
// Usage: npm run preview   (builds the bundle first; PORT env overrides 4177; --no-build skips bundling)
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
export const DEFAULT_PORT = 4177;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.map': 'application/json',
  '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.css': 'text/css', '.ico': 'image/x-icon',
};
const MOUNTS = [
  ['/resources/', join(root, 'assets/resources')],
  ['/', join(here, 'dist')],
];

function resolvePath(urlPath) {
  for (const [prefix, dir] of MOUNTS) {
    if (!urlPath.startsWith(prefix)) continue;
    let rel = decodeURIComponent(urlPath.slice(prefix.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const p = normalize(join(dir, rel));
    if (!p.startsWith(dir)) return null;
    return p;
  }
  return null;
}

export function startServer(port = Number(process.env.PORT) || DEFAULT_PORT, { quiet = false } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    const p = resolvePath(url.pathname);
    if (!p || !existsSync(p) || !statSync(p).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(p).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => {
      if (!quiet) console.log(`Emberhold preview: http://127.0.0.1:${port}/  (add ?debug=1 for window.__EH)`);
      ok(server);
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  (async () => {
    if (!process.argv.includes('--no-build')) {
      const { buildPreview } = await import('./build.mjs');
      await buildPreview();
    }
    await startServer();
  })().catch((e) => { console.error(e.message || e); process.exit(1); });
}

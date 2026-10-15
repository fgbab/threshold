// A small static server for dist/ that behaves like the CDN: folders serve their index.html (with a trailing-slash
// redirect), unknown paths get 404.html with a 404, hashed assets are immutable, and every response carries the
// production headers (infra/site.yaml): the CSP for this build (infra/csp.mjs: its inline scripts by hash), the
// Permissions-Policy (no camera, microphone or location), nosniff, the frame and referrer rules. So the lab tests the
// page under the same rules as threshold.gazum.ai. Local only (127.0.0.1).
// /_phone shows the English and Spanish pages side by side in two phone-sized frames; /_frame?w=1440&h=900&src=/es/
// shows one page at an exact size (both load the pages with ?frame, the one case where framing is allowed).
//   node scripts/serve.mjs              → http://127.0.0.1:8975
//   PORT=9000 node scripts/serve.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { policy, hashesOf } from '../infra/csp.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'dist');
const PORT = Number(process.env.PORT || 8975);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2'
};
const PERMISSIONS = 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()';
// production's policy, less upgrade-insecure-requests: the preview is plain http, and WebKit would move every request
// to https://127.0.0.1 (Chromium exempts localhost); the live site is https, where the directive changes nothing
const csp = framed => { const p = policy(hashesOf(ROOT).sort().join(' ')).replace(/; upgrade-insecure-requests/, ''); return framed ? p.replace(/frame-ancestors 'none'; /, '') : p; };

const PHONE = `<!doctype html><meta charset="utf-8"><title>THRESHOLD · phones</title><style>
body{margin:0;min-height:100vh;display:flex;gap:48px;justify-content:center;align-items:flex-start;padding:32px;background:#1b1d20;font:13px system-ui;color:#9FB0B8}
figure{margin:0}iframe{display:block;width:390px;height:844px;border:0;border-radius:40px;background:#000;box-shadow:0 0 0 10px #050505,0 24px 60px #000}
figcaption{margin-top:20px;text-align:center;letter-spacing:.2em}</style>
<figure><iframe src="/?frame"></iframe><figcaption>ENGLISH</figcaption></figure><figure><iframe src="/es/?frame"></iframe><figcaption>ESPAÑOL</figcaption></figure>`;
const frame = q => {
  const w = Math.min(3000, Number(q.get('w')) || 1440), h = Math.min(3000, Number(q.get('h')) || 900);
  const src = /^\/[\w\-/]*$/.test(q.get('src') || '') ? q.get('src') : '/';
  return `<!doctype html><meta charset="utf-8"><title>THRESHOLD · ${w}×${h}</title><style>body{margin:0;background:#1b1d20}iframe{display:block;width:${w}px;height:${h}px;border:0}</style><iframe src="${src}?frame"></iframe>`;
};

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://local'), p = decodeURIComponent(u.pathname), framed = u.searchParams.has('frame');
  if (p === '/_phone') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(PHONE); return; }
  if (p === '/_frame') { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(frame(u.searchParams)); return; }
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { location: p + '/' }); res.end(); return; }
    file = path.join(file, 'index.html');
  }
  const headers = {
    'content-security-policy': csp(framed), 'permissions-policy': PERMISSIONS, 'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin', 'cross-origin-opener-policy': 'same-origin',
    ...(framed ? {} : { 'x-frame-options': 'DENY' })
  };
  if (!fs.existsSync(file)) { res.writeHead(404, { ...headers, 'content-type': TYPES['.html'] }); fs.createReadStream(path.join(ROOT, '404.html')).pipe(res); return; }
  res.writeHead(200, {
    ...headers,
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    'cache-control': p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`THRESHOLD landing: http://127.0.0.1:${PORT}`));

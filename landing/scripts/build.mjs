// Builds dist/: English at /, Spanish at /es/, the privacy pages, the 404, /play/ (a door to the web prototype, so the
// QR code and any printed address read threshold.gazum.ai/play), and every asset under /assets/ with a content hash in
// its name (the CDN caches those for a year). Also the favicons (the app icon's arch in a circle), the share images (one
// per language: the hallway through the viewfinder, its far door traced in gold), the wordmark at fixed addresses for the
// waitlist's pages and emails, robots.txt and sitemap.xml.
//   node scripts/build.mjs                              (a preview build: the sign-up form only pretends)
//   SIGNUP_ENDPOINT=https://… node scripts/build.mjs   (the production build)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import opentype from 'opentype.js';
import qrcode from 'qrcode-generator';
import { page, privacyPage, notFoundPage, SITE, DOOR, TALL, STROKES } from '../src/page.mjs';
import en from '../src/i18n/en.mjs';
import es from '../src/i18n/es.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src'), DIST = path.join(ROOT, 'dist');
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
const write = (rel, data) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const urls = new Map();
const emit = (rel, buf) => {
  const ext = path.extname(rel), hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
  const out = `assets/${path.basename(rel, ext)}.${hash}${ext}`;
  write(out, buf);
  return '/' + out;
};
const url = rel => { if (!urls.has(rel)) urls.set(rel, emit(rel, fs.readFileSync(path.join(SRC, rel)))); return urls.get(rel); };
const fill = text => text.replace(/\{\{asset:([^}]+)\}\}/g, (_, rel) => url(rel));
const css = emit('threshold.css', Buffer.from(fill(['css/fonts.css', 'css/threshold.css'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n'))));
const js = [emit('threshold.js', fs.readFileSync(path.join(SRC, 'js/threshold.js')))];
url('js/score.js');   // loaded by the page on the first press of Sound
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'img/manifest.json'), 'utf8'));

// An image as a <picture> (AVIF and WebP, a JPEG last; WebP and PNG when transparent). The hero's loads first, at high
// priority; everything else is lazy (the reveals only change opacity, so lazy images still start in time).
const sources = (name, sizes, media = '') => {
  const m = manifest[name], fmts = m.formats, set = fmt => m.widths.map(w => `${url(`img/${name}-${w}.${fmt}`)} ${w}w`).join(', ');
  return { m, fmts, set, html: fmts.slice(0, -1).map(f => `<source${media ? ` media="${media}"` : ''} type="image/${f}" srcset="${set(f)}" sizes="${sizes}">`).join('') };
};
const img = (name, { alt, sizes, cls, eager, set, last, m }) => {
  const w = m.widths[m.widths.length - 1], h = Math.round(w * m.height / m.width), mid = m.widths[Math.min(1, m.widths.length - 1)];
  return `<img${cls ? ` class="${cls}"` : ''} src="${url(`img/${name}-${mid}.${last}`)}" srcset="${set(last)}" sizes="${sizes}" width="${w}" height="${h}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}>`;
};
function pic(name, { alt = '', sizes = '100vw', cls = '', eager = false } = {}) {
  if (!manifest[name]) { console.warn('missing image', name); return ''; }
  const s = sources(name, sizes);
  return `<picture>${s.html}${img(name, { alt, sizes, cls, eager, set: s.set, last: s.fmts[s.fmts.length - 1], m: s.m })}</picture>`;
}
// a wide picture with its 9:16 crop for portrait screens (the same media query as the CSS)
function art(wide, tall, { alt = '', cls = '', eager = false } = {}) {
  if (!manifest[wide] || !manifest[tall]) { console.warn('missing image', wide, tall); return ''; }
  const t = sources(tall, '100vw', TALL), s = sources(wide, '100vw');
  const tallLast = t.fmts[t.fmts.length - 1];
  return `<picture>${t.html}<source media="${TALL}" srcset="${t.set(tallLast)}" sizes="100vw">${s.html}${img(wide, { alt, sizes: '100vw', cls, eager, set: s.set, last: s.fmts[s.fmts.length - 1], m: s.m })}</picture>`;
}
const size = rel => { const s = fs.readFileSync(path.join(SRC, rel), 'utf8'); return [+/\swidth="(\d+)"/.exec(s)[1], +/\sheight="(\d+)"/.exec(s)[1]]; };
// the faces the first screen needs; the rest load when used
const preload = ['fonts/cormorant-garamond-latin.woff2', 'fonts/cormorant-garamond-italic-latin.woff2', 'fonts/dm-mono-400-latin.woff2'];

// the QR code for threshold.gazum.ai/play: one path of dark modules (rows merged into runs)
const qr = (() => {
  const q = qrcode(0, 'M'); q.addData(`${SITE}/play`); q.make();
  const n = q.getModuleCount(); let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!q.isDark(y, x)) continue;
    let w = 1; while (x + w < n && q.isDark(y, x + w)) w++;
    d += `M${x} ${y}h${w}v1h-${w}z`; x += w - 1;
  }
  return { n, d };
})();

const A = { url, css, js, pic, art, size, preload, qr, signup: process.env.SIGNUP_ENDPOINT || '' };
write('index.html', page(en, A));
write('es/index.html', page(es, A));
write('privacy/index.html', privacyPage(en, A));
write('es/privacy/index.html', privacyPage(es, A));
write('404.html', notFoundPage(en, A));
write('play/index.html', fs.readFileSync(path.join(SRC, 'play/index.html')));

// favicons: the arch in a circle, gold on night (traced from the app icon); the touch icon is the app icon itself
const icon = fs.readFileSync(path.join(SRC, 'img/brand/threshold-icon.svg'));
write('favicon.svg', icon);
write('favicon-32.png', await sharp(icon, { density: 144 }).resize(32, 32).png().toBuffer());
write('apple-touch-icon.png', await sharp(path.join(ROOT, '..', 'assets', 'icon-only.png')).resize(180, 180).png().toBuffer());

// the wordmark at fixed addresses for the waitlist's pages (/brand/wordmark.svg) and emails (a PNG: mail apps block SVG)
const mark = fs.readFileSync(path.join(SRC, 'img/brand/threshold-title.svg'));
write('brand/wordmark.svg', mark);
write('brand/wordmark-email.png', await sharp(mark, { density: 160 }).resize({ width: 600 }).png().toBuffer());

// ── the share images (1200 × 630, one per language): the hallway graded cold, its far door traced in gold and open,
//    the viewfinder's brackets, REC ● and the clock, the exposure, the title in ivory and the line in DM Mono
const mono = (() => { const b = fs.readFileSync(path.join(ROOT, 'art/fonts/dm-mono-400.ttf')); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); })();
// glyph outlines as path data (written here: opentype.js's own toPathData can print NaN for some coordinates)
const f2 = v => v.toFixed(2);
const pathData = cmds => cmds.map(c => c.type === 'M' || c.type === 'L' ? `${c.type}${f2(c.x)} ${f2(c.y)}`
  : c.type === 'Q' ? `Q${f2(c.x1)} ${f2(c.y1)} ${f2(c.x)} ${f2(c.y)}`
  : c.type === 'C' ? `C${f2(c.x1)} ${f2(c.y1)} ${f2(c.x2)} ${f2(c.y2)} ${f2(c.x)} ${f2(c.y)}` : 'Z').join('');
const textPath = (s, x, y, px, track = 0, anchor = 'start') => {
  const adv = ch => mono.charToGlyph(ch).advanceWidth * px / mono.unitsPerEm;
  const width = [...s].reduce((a, ch) => a + adv(ch) + track, -track);
  let cx = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x, d = '';
  for (const ch of s) { d += pathData(mono.charToGlyph(ch).getPath(cx, y, px).commands); cx += adv(ch) + track; }
  if (/NaN/.test(d)) throw new Error('bad outline for ' + s);
  return d;
};
// the crop: the far door in the middle (the hallway is 1536 × 1024; the door's box is DOOR.wide, in shares of it)
// the crop is centred on the door, so the hallway runs on into darkness past its right edge (the vignette hides it)
const CW = 1200, CH = 630, K = 1200 / CW, PAD = 200;
const doorL = DOOR.wide.left / 100 * 1536, doorT = DOOR.wide.top / 100 * 1024, doorH = DOOR.wide.h / 100 * 1024, doorW = doorH * 2 / 3;
const cx0 = Math.round(doorL + doorW / 2 - CW / 2), cy0 = Math.round(Math.min(1024 - CH, Math.max(0, doorT - 70)));
const wider = await sharp(path.join(SRC, 'img/hero-wide-1536.jpg')).extend({ right: PAD, background: '#05070A' }).toBuffer();
const hall = await sharp(wider).extract({ left: cx0, top: cy0, width: CW, height: CH }).resize(1200, 630).modulate({ brightness: .92 }).toBuffer();
const dx = (doorL - cx0) * K, dy = (doorT - cy0) * K, ds = doorH * K / 300;
const strokes = (w, color) => STROKES.map(([, thin, d]) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${thin ? w * .62 : w}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
const titleSvg = fs.readFileSync(path.join(SRC, 'img/brand/threshold-title.svg'), 'utf8');
const titleInner = /<g fill="#F2EAD9"[\s\S]*<\/g>/.exec(titleSvg)[0];
for (const t of [en, es]) {
  const tw = 470, ts = tw / 1159, tx = 600 - tw / 2, ty = 490;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="v" cx=".5" cy=".46" r=".72"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".78"/></radialGradient>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1A404A" stop-opacity=".2"/><stop offset="1" stop-color="#081A22" stop-opacity=".3"/></linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#05070A" stop-opacity="0"/><stop offset="1" stop-color="#05070A" stop-opacity=".92"/></linearGradient>
    <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/><rect width="1200" height="630" fill="url(#v)"/><rect width="1200" height="630" fill="url(#b)"/>
  <g transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)}) scale(${ds.toFixed(4)})">
    <path d="M59 262V114a41 41 0 0 1 82 0v148Z" fill="#010102" opacity=".94"/>
    <g filter="url(#blur)" opacity=".9">${strokes(16, 'rgba(255,168,80,.32)')}</g>
    ${strokes(7, 'rgba(255,190,100,.36)')}
    ${strokes(2.1, '#FFEBC0')}
  </g>
  <g fill="none" stroke="#F2EAD9" stroke-opacity=".75" stroke-width="2"><path d="M26 56V26H56M1144 26H1174V56M26 574V604H56M1144 604H1174V574"/></g>
  <circle cx="54" cy="57" r="6" fill="#E0453A"/>
  <g fill="#F2EAD9" fill-opacity=".9"><path d="${textPath('REC', 70, 63, 17, 3.4)}"/><path d="${textPath('03:03:07', 1146, 63, 17, 3.4, 'end')}"/></g>
  <g fill="#F2EAD9" fill-opacity=".66"><path d="${textPath('ISO 3200 · 1/30 · F1.8', 54, 588, 15, 3)}"/><path d="${textPath(t.hud.door, 1146, 588, 15, 3, 'end')}"/></g>
  <g transform="translate(${tx.toFixed(1)} ${ty}) scale(${ts.toFixed(5)})">${titleInner}</g>
  <path d="${textPath(t.hero.line.toUpperCase(), 600, 562, 13, 2.9, 'middle')}" fill="#9FB0B8"/>
</svg>`;
  const og = await sharp(hall).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  write(`og-${t.lang}.jpg`, og);
}

write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
const alt = `<xhtml:link rel="alternate" hreflang="en" href="${SITE}/"/><xhtml:link rel="alternate" hreflang="es" href="${SITE}/es/"/>`;
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>${SITE}/</loc>${alt}</url>
  <url><loc>${SITE}/es/</loc>${alt}</url>
  <url><loc>${SITE}/privacy/</loc></url>
  <url><loc>${SITE}/es/privacy/</loc></url>
</urlset>
`);

const total = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? total(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`built dist/ · ${urls.size + 2} assets · ${(total(DIST) / 1e6).toFixed(1)} MB · QR ${qr.n}×${qr.n} · sign-up: ${A.signup || 'PREVIEW (nothing is sent)'}`);

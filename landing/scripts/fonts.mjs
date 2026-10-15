// THRESHOLD's two faces (SIL Open Font License), self-hosted, Latin and Latin Extended, the same as the app's:
//   Cormorant Garamond, roman and italic (weights 400 to 600, one variable file each): the titles and Lena's lines;
//   DM Mono 400 and 500: the camera's HUD, labels, buttons and captions.
// Writes src/fonts/*.woff2 and src/css/fonts.css (with the build's asset placeholders), and art/fonts/dm-mono-400.ttf,
// which scripts/build.mjs turns into outlines for the share images (an SVG rasterizer can't load web fonts).
// Run once, or to update.
//   node scripts/fonts.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const API = 'https://fonts.googleapis.com/css2';
const FAMILIES = ['Cormorant+Garamond:ital,wght@0,400..600;1,400..600', 'DM+Mono:wght@400;500'];
const get = async (url, headers = {}) => { const r = await fetch(url, { headers }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r; };

const css = await (await get(`${API}?${FAMILIES.map(f => 'family=' + f).join('&')}&display=swap`, { 'User-Agent': UA })).text();
const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]+)\}/g)].filter(([, subset]) => subset === 'latin' || subset === 'latin-ext');
fs.mkdirSync(path.join(ROOT, 'src/fonts'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'src/css'), { recursive: true });
let out = '/* Cormorant Garamond and DM Mono (SIL OFL 1.1), self-hosted by scripts/fonts.mjs: Latin, and Latin Extended only when a page needs it */\n';
for (const [, subset, body] of blocks) {
  const fam = /font-family: '([^']+)'/.exec(body)[1], style = /font-style: (\w+)/.exec(body)[1], weight = /font-weight: ([\d ]+);/.exec(body)[1];
  const url = /url\((https:[^)]+)\)/.exec(body)[1], range = /unicode-range: ([^;]+);/.exec(body)[1];
  const file = `${fam.toLowerCase().replace(/ /g, '-')}-${style === 'italic' ? 'italic-' : ''}${weight.includes(' ') ? '' : weight + '-'}${subset}.woff2`;
  fs.writeFileSync(path.join(ROOT, 'src/fonts', file), Buffer.from(await (await get(url)).arrayBuffer()));
  out += `@font-face { font-family: '${fam}'; font-style: ${style}; font-weight: ${weight}; font-display: swap; src: url({{asset:fonts/${file}}}) format('woff2'); unicode-range: ${range}; }\n`;
  console.log(file);
}
fs.writeFileSync(path.join(ROOT, 'src/css/fonts.css'), out);

// DM Mono 400 as TrueType (an older browser's request gets TTF) for the share images' HUD text
const ttfCss = await (await get(`${API}?family=DM+Mono:wght@400`, { 'User-Agent': 'Mozilla/4.0' })).text();
const ttf = /url\((https:[^)]+\.ttf)\)/.exec(ttfCss);
if (!ttf) throw new Error('no TTF for DM Mono');
fs.mkdirSync(path.join(ROOT, 'art/fonts'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'art/fonts/dm-mono-400.ttf'), Buffer.from(await (await get(ttf[1])).arrayBuffer()));
console.log(blocks.length, 'web font files · art/fonts/dm-mono-400.ttf');

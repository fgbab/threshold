// Web copies of the generated art (art/generated/) into src/img/, graded like the app's camera (src/gfx.js, BG_FS):
// colour drained, a film curve with deep blacks, shadows pushed cold (×.8, .95, 1.06) and only the highlights warm
// (×1.14, .96, .74). Photos get AVIF + WebP + JPEG at a few widths, plus a 9:16 crop for phones where a section needs
// one; the smoke figure becomes a transparent WebP + PNG (its white background turned into alpha). Also the grain tile
// (one 256 px noise image, about 13 KB, that every grainy layer reuses). Writes src/img/manifest.json, which the build reads.
//
//   node scripts/images.mjs            (everything)
//   node scripts/images.mjs church     (only the names containing "church")
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'art', 'generated');
const OUT = path.join(ROOT, 'src', 'img');

// name: { from, widths, crop: [left, top, width, height] in the original's pixels (optional), grade, alpha }
const SETS = {
  'hero-wide': { from: 'hero-wide', widths: [768, 1152, 1536] },
  'hero-tall': { from: 'hero-tall', widths: [540, 720, 864], crop: [80, 0, 864, 1536] },        // 9:16
  church: { from: 'church', widths: [768, 1152, 1536] },
  'church-tall': { from: 'church', widths: [576], crop: [488, 0, 576, 1024] },                 // 9:16, the phone on the floor
  mirror: { from: 'mirror', widths: [512, 768, 1024] },
  valpo: { from: 'valpo', widths: [768, 1152, 1536] },
  'valpo-tall': { from: 'valpo', widths: [576], crop: [380, 0, 576, 1024] },                   // 9:16, the stairs and the port
  smoke: { from: 'smoke', widths: [256, 512], alpha: true }
};

/* the app's camera grade, per pixel, on 8-bit sRGB (the shader works on the camera's values the same way) */
const SAT = .3, EXPOSURE = .86;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function grade(buf) {
  for (let i = 0; i < buf.length; i += 3) {
    const r = buf[i] / 255, g = buf[i + 1] / 255, b = buf[i + 2] / 255, l = .299 * r + .587 * g + .114 * b;
    const k = smooth(.1, .72, l), tint = [.8 + .34 * k, .95 + .01 * k, 1.06 - .32 * k];
    [r, g, b].forEach((c, j) => {
      let v = (l + (c - l) * SAT) * EXPOSURE;
      v = v / (v + .5) * 1.5;
      v = Math.pow(Math.max(v, 0), 1.42) * tint[j];
      buf[i + j] = Math.max(0, Math.min(255, Math.round(v * 255)));
    });
  }
  return buf;
}
/* black smoke on white → near-black smoke with alpha (soft edges kept) */
function smokeAlpha(buf, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const l = (.299 * buf[p * 3] + .587 * buf[p * 3 + 1] + .114 * buf[p * 3 + 2]) / 255;
    const a = Math.pow(smooth(.04, .93, 1 - l), .9);
    out[p * 4] = 3; out[p * 4 + 1] = 5; out[p * 4 + 2] = 8; out[p * 4 + 3] = Math.round(a * 255);
  }
  return out;
}

const only = process.argv[2] || '';
const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
fs.mkdirSync(OUT, { recursive: true });

for (const [name, set] of Object.entries(SETS)) {
  if (only && !name.includes(only)) continue;
  const src = path.join(SRC, set.from + '.jpg');
  if (!fs.existsSync(src)) { console.log(name, 'missing'); continue; }
  let img = sharp(src).removeAlpha();
  if (set.crop) { const [left, top, width, height] = set.crop; img = img.extract({ left, top, width, height }); }
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const base = set.alpha
    ? sharp(smokeAlpha(data, info.width, info.height), { raw: { width: info.width, height: info.height, channels: 4 } })
    : sharp(grade(data), { raw: { width: info.width, height: info.height, channels: 3 } });
  const master = await base.png().toBuffer();   // a lossless master, resized below
  const list = set.widths.filter(w => w <= info.width);
  for (const w of list) {
    const out = path.join(OUT, `${name}-${w}`), sized = () => sharp(master).resize({ width: w });
    if (set.alpha) {
      await sized().webp({ quality: 70, alphaQuality: 62, effort: 6 }).toFile(out + '.webp');
      await sized().png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(out + '.png');
    } else {
      await sized().avif({ quality: 50, effort: 4 }).toFile(out + '.avif');
      await sized().webp({ quality: 74, effort: 5 }).toFile(out + '.webp');
      await sized().jpeg({ quality: 78, mozjpeg: true }).toFile(out + '.jpg');
    }
  }
  manifest[name] = { width: info.width, height: info.height, alpha: !!set.alpha, widths: list, formats: set.alpha ? ['webp', 'png'] : ['avif', 'webp', 'jpg'] };
  console.log(name, set.alpha ? 'webp+png' : 'avif+webp+jpg', info.width + '×' + info.height, list.join(' '));
}

// the grain: one 256 px tile of sensor noise (light and dark specks, a third of it clear), lossless WebP: a lossy one
// smears noise into swirls. Every grainy layer reuses it.
if (!only || 'grain'.includes(only)) {
  const N = 256, px = Buffer.alloc(N * N * 4);
  let s = 3303;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let p = 0; p < N * N; p++) {
    const v = rnd();
    if (v < .36) { px[p * 4] = px[p * 4 + 1] = px[p * 4 + 2] = 236; px[p * 4 + 3] = 110; }
    else if (v < .72) { px[p * 4] = px[p * 4 + 1] = px[p * 4 + 2] = 4; px[p * 4 + 3] = 130; }
  }
  await sharp(px, { raw: { width: N, height: N, channels: 4 } }).webp({ lossless: true, effort: 6 }).toFile(path.join(OUT, 'grain-256.webp'));
  console.log('grain-256.webp', fs.statSync(path.join(OUT, 'grain-256.webp')).size, 'bytes');
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

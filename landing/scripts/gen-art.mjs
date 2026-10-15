// THRESHOLD's landing art, generated with the OpenAI image model: real phone photos taken at 3 AM. Cold, grainy, almost
// dark; one weak warm light at most; never a person, never text. The gold door is never in a picture: the page draws it
// live, on top, the way the game does.
// The key is read at runtime from ~/.openai-key and never printed, logged or written anywhere.
// Every call is logged with its usage and cost in art/costs.json; the run stops before the budget would be passed.
// Originals are kept in art/generated/ (JPEG); scripts/images.mjs grades them like the app's camera and makes the web
// copies.
//
//   node scripts/gen-art.mjs             (generates whatever in PLAN is missing)
//   node scripts/gen-art.mjs church      (only the names containing "church"; FORCE=1 to redo)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'art', 'generated');
const LOG = path.join(ROOT, 'art', 'costs.json');
const BUDGET = 3.0;
const API = 'https://api.openai.com/v1';
// $ per token (OpenAI pricing, Oct 2026; the same table the gazum.ai site and the other landings use)
const PRICE = { text: 5e-6, image: 8e-6, out: 30e-6 };
const MAX_CALL = 0.35; // a generous upper bound for one high-quality image, for the budget check
const PARALLEL = 3;

const STYLE = 'A real phone photo taken at 3 AM: high-ISO noise, cold blue-grey, deep blacks that still keep a little detail, one weak warm practical light at most. Photoreal, shot handheld on a phone camera in near darkness, slightly soft, a little motion in the grain.';
const NO = 'No people, no faces, no hands, no text, no letters, no numbers, no logos, no watermark, no frame or border. No glowing door, no gold light, no magic.';
const HALL = 'A long, narrow apartment hallway at 3 AM, seen from one end at standing eye level: old wooden floorboards, bare plaster walls, a radiator, one empty picture hook. At the far end of the hallway, a closed plain interior door. The only light is the cold white glow of a smartphone lying face-up on the floorboards in the foreground, lighting the floor from below, and a weak warm thread of light under a side door. The middle of the hallway floor is empty and clear.';

// [name, size, prompt]
const PLAN = [
  ['hero-wide', '1536x1024', `${HALL} The hallway recedes toward a vanishing point a little right of centre; the left third of the frame falls into near-total darkness. ${STYLE} ${NO}`],
  ['hero-tall', '1024x1536', `${HALL} Vertical framing: the hallway recedes straight ahead to a vanishing point in the middle of the frame; the far door sits a little above the centre; the glowing phone is near the bottom edge. ${STYLE} ${NO}`],
  ['church', '1536x1024', `The empty nave of an old church in Valparaíso, Chile, at night: dark wooden pews, a worn stone floor, tall arched windows with faint cold moonlight. In the foreground, on the stone floor of the central aisle, a smartphone lies face-up with its screen still on, glowing cold white and lighting the stones around it. Nobody is there. ${STYLE} ${NO}`],
  ['mirror', '1024x1536', `A small old bathroom at 3 AM with the lights off: a dark mirror above a white porcelain sink, white tiles, a towel on a hook. The mirror shows only the dark, empty room behind the camera, no reflection of anyone. A smartphone lies face-up on the edge of the sink, its cold glow the only light. ${STYLE} ${NO}`],
  ['valpo', '1536x1024', `Valparaíso, Chile, at 3 AM, seen from high on one of its hills: steep stairways and narrow lanes climbing between old houses whose painted colours are almost lost in the dark, a few weak warm street lamps, electric cables overhead, the port far below, and the sea completely black to the horizon. ${STYLE} ${NO}`],
  ['smoke', '1024x1536', 'A tall, thin, dark humanoid figure made only of thick black smoke, standing still with its arms hanging, no face and no features, its outline dissolving into wisps at the edges and the feet. Centered, full length, isolated on a plain pure white background, high contrast, soft edges. No text, no logos, no frame or border.']
];

const only = process.argv[2] || '';
fs.mkdirSync(OUT, { recursive: true });
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { budgetUSD: BUDGET, price: PRICE, calls: [], totalUSD: 0 };
const save = () => {
  log.budgetUSD = BUDGET;
  log.totalUSD = +log.calls.reduce((s, c) => s + (c.costUSD || 0), 0).toFixed(4);
  log.remainingUSD = +(BUDGET - log.totalUSD).toFixed(4);
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n');
};
const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

const KEY = fs.readFileSync(path.join(os.homedir(), '.openai-key'), 'utf8').trim();
const AUTH = { Authorization: 'Bearer ' + KEY };
const ids = (await (await fetch(API + '/models', { headers: AUTH })).json()).data.map(m => m.id);
const MODEL = ['gpt-image-2.5-sunburst', 'gpt-image-2', 'gpt-image-1.5', 'gpt-image-1'].find(id => ids.includes(id));
if (!MODEL) throw new Error('no image model available');
const costOf = u => {
  const d = (u && u.input_tokens_details) || {};
  return +((d.text_tokens ?? (u?.input_tokens || 0)) * PRICE.text + (d.image_tokens || 0) * PRICE.image + (u?.output_tokens || 0) * PRICE.out).toFixed(4);
};

async function make([name, size, prompt]) {
  save();
  if (log.totalUSD + MAX_CALL > BUDGET) { console.log(name, 'skipped: budget', log.totalUSD, 'of', BUDGET); return; }
  const t = Date.now();
  let r, j;
  for (let attempt = 0; attempt < 5; attempt++) {
    r = await fetch(API + '/images/generations', {
      method: 'POST', headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, size, quality: 'high', output_format: 'png' })
    });
    j = await r.json().catch(() => ({}));
    if (r.ok || !(r.status === 429 || r.status >= 500)) break;
    await new Promise(res => setTimeout(res, 8000 * (attempt + 1)));
  }
  const entry = { at: new Date().toISOString(), name, model: MODEL, size, quality: 'high', status: r.status, seconds: +((Date.now() - t) / 1000).toFixed(1), usage: j.usage || null, costUSD: costOf(j.usage) };
  log.calls.push(entry); save();
  if (!r.ok) { console.log(name, 'failed', r.status, (j.error && j.error.message) || ''); return; }
  const png = Buffer.from(j.data[0].b64_json, 'base64');
  await sharp(png).flatten({ background: '#fff' }).jpeg({ quality: 93, mozjpeg: true }).toFile(path.join(OUT, name + '.jpg'));
  manifest[name] = { model: MODEL, size, quality: 'high', prompt, at: entry.at };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(name, 'ok', entry.seconds + 's', '$' + entry.costUSD);
}

const exists = name => fs.existsSync(path.join(OUT, name + '.jpg'));
const jobs = PLAN.filter(([name]) => (!only || name.includes(only)) && (process.env.FORCE || !exists(name)));
console.log('model', MODEL, '·', jobs.length, 'images');
const queue = [...jobs];
await Promise.all(Array.from({ length: PARALLEL }, async () => { while (queue.length) await make(queue.shift()); }));
save();
console.log('total $' + log.totalUSD, 'of $' + BUDGET);

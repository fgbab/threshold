/* Threshold toolkit for objectives: objects that belong to the objective being played, hints that arrive late,
   the self-test's pauses, the things you hear (with captions), and the room maze builder. */
import * as C from './core.js';
import { S, AUTO, TEST, SPEED, wait, until, clamp, audio, voice, instruct, MO, pen, W, H, grab } from './core.js';
import * as G from './gfx.js';

const made = new Set();
export function keep(obj, layer) { G.add(obj, layer); made.add(obj); return obj; }   // removed when the objective ends
export function drop(obj) { if (obj) { made.delete(obj); G.remove(obj); } }
export function sweep() {                    // leave nothing behind for the next objective
  made.forEach(o => G.remove(o)); made.clear();
  S.stage = null; S.tapHook = null; MO.onStep = MO.onKnock = null; pen.on = false; pen.strokes = []; C.MIC.wantPitch = false; S.override = null;
  ['whisper', 'static', 'sea', 'rumble'].forEach(b => audio.bed(b, null));
  G.glass.water(0, 600); G.glass.dread(.12, 1200); G.mazeView({ on: false }); G.ghostLayer(null, { on: false });
}
export function hints(o) {                   // cryptic help that only comes when someone is stuck
  S.easy = 0; if (AUTO || !o.hints) return () => {};
  const at = o.hintAt || [80, 170, 260];
  const t = o.hints.map((h, i) => setTimeout(() => { S.easy = i + 1; instruct(h[0], h[1]); audio.whisper(0, .9, .04); }, at[i] * 1000));
  return () => t.forEach(clearTimeout);
}
export async function holdShot(ms = 2600) {  // self-test screenshots stop the action here
  if (TEST.obj && TEST.door === S.doorN && TEST.obj === S.objIndex + 1) { await wait(ms); if (S.report) S.report(); S.shotHold = true; await new Promise(() => {}); }
}
export const sim = (ms, fn) => { if (AUTO) setTimeout(fn, ms); };   // the self-test does what a player would
export const lerpTo = (v, to, k) => v + (to - v) * k;

/* ===================================================================== */
/* THINGS YOU HEAR, with captions on the glass                            */
/* ===================================================================== */
const say1 = (t, o) => voice.say(t, o);
export const CLIPS = {
  memo: { dur: 7.6, cc: [[0, '[breathing]'], [1.2, '[a fingertip taps the lens]'], [2.3, '[tap]'], [3.4, '[tap]'], [4.3, '[tap tap]'], [5.6, '[someone else is whispering]']],
    play() { audio.breath(0, .05, 1.8, 900); [1.2, 2.3, 3.4, 4.3, 4.55].forEach(t => audio.tap(t, .3)); audio.breath(4.9, .05, 1.4, 800); audio.whisper(5.6, 1.7, .065, -.3); } },
  radio13: { dur: 9, cc: [[0, '[static]'], [1.6, '“Thirteen.”'], [4, '“Thirteen.”'], [6.4, '“Never look back.”']],
    play() { audio.bed('static', .05); setTimeout(() => say1('thirteen'), 1600); setTimeout(() => say1('thirteen'), 4000); setTimeout(() => say1('never look back', { rate: .5 }), 6400); setTimeout(() => audio.bed('static', null), 8800); } },
  nato: { dur: 10, cc: [[0, '[static]'], [1.4, '“Lima.”'], [3.4, '“Echo.”'], [5.4, '“November.”'], [7.4, '“Alpha.”']],
    play() { audio.bed('static', .05); ['lima', 'echo', 'november', 'alpha'].forEach((w, i) => setTimeout(() => say1(w), 1400 + i * 2000)); setTimeout(() => audio.bed('static', null), 9800); } },
  child: { dur: 8.5, cc: [[0, '“One…”'], [1.6, '“Two…”'], [3.2, '“Three…”'], [5, '“Ready or not.”']],
    play() { ['one', 'two', 'three'].forEach((w, i) => setTimeout(() => say1(w, { pitch: 1.7, rate: .8 }), i * 1600)); setTimeout(() => say1('ready or not', { pitch: 1.6, rate: .7 }), 5000); audio.whisper(7, 1.2, .05, .6); } },
  behind: { dur: 9, cc: [[0, '[breathing on the other side]'], [2.2, '“It comes at three…”'], [5.2, '“…and three.”']],
    play() { audio.breath(0, .06, 2, 600); setTimeout(() => say1('it comes at three', { rate: .45 }), 2200); setTimeout(() => say1('and three', { rate: .45 }), 5200); audio.breath(6.8, .06, 2, 600); } },
  bells: { dur: 10, cc: [[0, '[a bell]'], [3, '[two bells, close together]'], [6.2, '[a bell]']],
    play() { audio.toll(0); audio.toll(3); audio.toll(3.6); audio.toll(6.2); } },
  box: { dur: 4.2, cc: [[0, '[a music box: three notes… and it stops]']], play() { audio.box([554.4, 659.3, 830.6]); } },
  boxfull: { dur: 5.2, cc: [[0, '[the music box plays four notes]'], [2, '[the last one is low]']], play() { audio.box([554.4, 659.3, 830.6, 220], 0, .6); } },
  three05: { dur: 11, cc: [[0, '[static]'], [1.8, '“Three.”'], [3.6, '“Zero.”'], [5.4, '“Five.”'], [7.6, '“…don’t let it see you move.”']],
    play() { audio.bed('static', .05); audio.breath(.4, .06, 1.4, 700); ['three', 'zero', 'five'].forEach((w, i) => setTimeout(() => say1(w, { rate: .5, pitch: .05 }), 1800 + i * 1800)); audio.whisper(7.6, 2, .08); setTimeout(() => audio.bed('static', null), 10500); } },
  years: { dur: 14, cc: [[0, '[static]'], [1.6, '“Tomás. Nineteen eighty-seven.”'], [4.6, '“Amalia. Nineteen ninety-nine.”'], [7.6, '“Ari. Twenty eleven.”'], [10.6, '“Lena. Twenty twenty-three.”']],
    play() { audio.bed('static', .045); [['Tomás. Nineteen eighty seven.', 1.6], ['Amalia. Nineteen ninety nine.', 4.6], ['Ari. Twenty eleven.', 7.6], ['Lena. Twenty twenty three.', 10.6]].forEach(([w, t]) => setTimeout(() => say1(w, { rate: .55 }), t * 1000)); setTimeout(() => audio.bed('static', null), 13800); } },
  lena: { dur: 22, cc: [[0, '[static, then her voice]'], [1.5, '“You found me.”'], [4.5, '“I made the doors. Someone has to, from in here.”'], [9.5, '“The one who stays behind the glass builds them for the next.”'], [14.5, '“I chose you because you weren’t afraid of the dark part.”'], [19, '“Come to the last door. Then decide.”']],
    play() { audio.bed('static', .04); [['You found me.', 1.5], ['I made the doors. Someone has to, from in here.', 4.5], ['The one who stays behind the glass builds them for the next.', 9.5], ['I chose you because you were not afraid of the dark part.', 14.5], ['Come to the last door. Then decide.', 19]].forEach(([w, t]) => setTimeout(() => say1(w, { rate: .7, pitch: .9 }), t * 1000)); setTimeout(() => audio.bed('static', null), 21800); } }
};
export async function playClip(name, captions = true) {   // plays a clip and shows its captions; resolves when it ends
  const c = CLIPS[name]; if (!c) return;
  c.play();
  const timers = captions ? c.cc.map(([t, text]) => setTimeout(() => instruct(text), t * 1000 * (AUTO ? .1 : 1))) : [];
  await wait(c.dur * 1000 * (AUTO ? .1 : 1));
  timers.forEach(clearTimeout);
}

/* ===================================================================== */
/* THE ROOM MAZE: the camera's real edges become walls                    */
/* ===================================================================== */
export const BR = 2;                          // the ember's radius, in grid cells
export let MZ = null;
export const setMZ = m => { MZ = m; };
function blur(src, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += src[yy * w + xx]; n++; } }
    out[y * w + x] = s / n;
  }
  return out;
}
function dilate(m, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < w && yy < h) out[yy * w + xx] = 1; }
  }
  return out;
}
function clearance(block, w, h) {             // chessboard distance to the nearest wall (two-pass)
  const d = new Float32Array(w * h), INF = 1e6;
  for (let i = 0; i < w * h; i++) d[i] = block[i] ? 0 : INF;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue; let v = d[i]; if (x) v = Math.min(v, d[i - 1] + 1); if (y) { v = Math.min(v, d[i - w] + 1); if (x) v = Math.min(v, d[i - w - 1] + 1); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 1); } d[i] = v; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; let v = d[i]; if (x < w - 1) v = Math.min(v, d[i + 1] + 1); if (y < h - 1) { v = Math.min(v, d[i + w] + 1); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 1); if (x) v = Math.min(v, d[i + w - 1] + 1); } d[i] = v; }
  return d;
}
export function bfs(ok, w, h, start) {
  const dist = new Int32Array(w * h).fill(-1), prev = new Int32Array(w * h).fill(-1), q = new Int32Array(w * h);
  let head = 0, tail = 0; dist[start] = 0; q[tail++] = start; let far = start;
  while (head < tail) {
    const i = q[head++], x = i % w, y = (i - x) / w;
    if (dist[i] > dist[far]) far = i;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx; if (dist[j] >= 0 || !ok[j]) continue; dist[j] = dist[i] + 1; prev[j] = i; q[tail++] = j;
    }
  }
  return { dist, prev, far, count: tail };
}
function components(ok, w, h) {               // label open areas; returns the label grid and the biggest label
  const lab = new Int32Array(w * h).fill(-1), q = new Int32Array(w * h); let next = 0, bestL = -1, bestN = 0;
  for (let s = 0; s < w * h; s++) {
    if (!ok[s] || lab[s] >= 0) continue;
    let head = 0, tail = 0; q[tail++] = s; lab[s] = next;
    while (head < tail) {
      const i = q[head++], x = i % w, y = (i - x) / w;
      if (x > 0 && ok[i - 1] && lab[i - 1] < 0) { lab[i - 1] = next; q[tail++] = i - 1; }
      if (x < w - 1 && ok[i + 1] && lab[i + 1] < 0) { lab[i + 1] = next; q[tail++] = i + 1; }
      if (y > 0 && ok[i - w] && lab[i - w] < 0) { lab[i - w] = next; q[tail++] = i - w; }
      if (y < h - 1 && ok[i + w] && lab[i + w] < 0) { lab[i + w] = next; q[tail++] = i + w; }
    }
    if (tail > bestN) { bestN = tail; bestL = next; }
    next++;
  }
  return { lab, bestL, bestN };
}
function sobel(img, w, h) {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = img[i - w + 1] + 2 * img[i + 1] + img[i + w + 1] - img[i - w - 1] - 2 * img[i - 1] - img[i + w - 1];
    const gy = img[i + w - 1] + 2 * img[i + w] + img[i + w + 1] - img[i - w - 1] - 2 * img[i - w] - img[i - w + 1];
    mag[i] = Math.hypot(gx, gy);
  }
  return mag;
}
function filigree(edge, w, h, top, bottom, seed) {   // arcs with gaps, for rooms with too little in them
  let s = 1234 + seed * 97; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cx = w / 2, cy = (top + bottom) / 2;
  for (let k = 0; k < 4; k++) {
    const rad = (k + 1) * Math.min(w, bottom - top) / 9, gap = r() * Math.PI * 2;
    for (let a = 0; a < Math.PI * 2; a += .02) {
      if (Math.abs(((a - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < .45) continue;
      const x = Math.round(cx + Math.cos(a) * rad), y = Math.round(cy + Math.sin(a) * rad * 1.25);
      if (x > 0 && y > top && x < w - 1 && y < bottom) edge[y * w + x] = 1;
    }
  }
}
export async function readRoom(extraSeed = 0) {   // average a few frames, find the strongest edges, keep the longest route
  const gw = 96, gh = Math.round(96 * H / W), N = gw * gh, acc = new Float32Array(N); let n = 0;
  for (let k = 0; k < 6; k++) {
    const d = grab(gw, gh);
    if (d) { for (let i = 0, j = 0; i < N; i++, j += 4) acc[i] += d.data[j] * .299 + d.data[j + 1] * .587 + d.data[j + 2] * .114; n++; }
    await wait(60);
  }
  if (!n) return false;
  for (let i = 0; i < N; i++) acc[i] /= n;
  const mag = sobel(blur(blur(acc, gw, gh), gw, gh), gw, gh), sorted = Float32Array.from(mag).sort();
  const sat = parseFloat(getComputedStyle(document.body).getPropertyValue('padding-top')) || 0;
  const top = Math.ceil((sat + 112) / H * gh), bottom = gh - Math.ceil(150 / H * gh), play = (bottom - top) * (gw - 2), target = (gw + gh) * .5;
  const build = (frac, fil) => {
    const thr = Math.max(sorted[Math.min(N - 1, Math.floor(N * frac))], 12);
    let edge = new Uint8Array(N); for (let i = 0; i < N; i++) edge[i] = mag[i] > thr ? 1 : 0;
    edge = dilate(edge, gw, gh); if (fil) filigree(edge, gw, gh, top, bottom, fil + extraSeed);
    const block = new Uint8Array(N);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x; block[i] = edge[i] || y < top || y >= bottom || x < 1 || x >= gw - 1 ? 1 : 0; }
    const clear = clearance(block, gw, gh), ok = new Uint8Array(N); for (let i = 0; i < N; i++) ok[i] = clear[i] >= BR ? 1 : 0;
    const comp = components(ok, gw, gh); if (comp.bestN < play * .22) return null;
    let start = -1, bd = 1e9;
    for (let y = top; y < bottom; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x; if (comp.lab[i] !== comp.bestL) continue; const d = Math.hypot(x - gw / 2, (y - (bottom - 6)) * 1.4); if (d < bd) { bd = d; start = i; } }
    const r = bfs(ok, gw, gh, start);
    return { gw, gh, edge, block, ok, start, goal: r.far, prev: r.prev, dist: r.dist, len: r.dist[r.far], top, bottom };
  };
  let best = null;
  for (const frac of [.95, .93, .91, .89, .965, .975, .985]) { const m = build(frac, 0); if (m && (!best || m.len > best.len)) best = m; if (best && best.len >= target * 1.4) break; }
  if (!best || best.len < target) for (const fil of [1, 2, 3]) { const m = build(.965, fil); if (m && (!best || m.len > best.len)) best = m; if (best && best.len >= target) break; }
  if (!best) return false;
  MZ = best; G.mazeWalls(best.block, best.gw, best.gh);
  return true;
}
export function farCells(count, minDist = 14, fromFrac = .35) {   // cells far from the start and from each other (for things to find)
  const { gw, dist, len } = MZ, out = [MZ.goal], cand = [];
  for (let i = 0; i < dist.length; i++) if (dist[i] >= len * fromFrac) cand.push(i);
  while (out.length < count) {
    let bi = -1, bd = minDist;
    for (const i of cand) { const x = i % gw, y = (i - x) / gw; let md = 1e9; for (const d of out) { const dx = d % gw; md = Math.min(md, Math.hypot(x - dx, y - (d - dx) / gw)); } if (md > bd) { bd = md; bi = i; } }
    if (bi < 0) break; out.push(bi);
  }
  return out.map(i => { const x = i % gw; return { x, y: (i - x) / gw, i }; });
}
export const cellPx = (x, y) => [(x + .5) * W / MZ.gw, (y + .5) * H / MZ.gh];

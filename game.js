'use strict';
(() => {
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const MODE = location.hash.slice(1);                  // '', 'demo' (no camera), 'auto' / 'shot1..3' (self-test)
const AUTO = /^(auto|shot\d)$/.test(MODE);
const SPEED = AUTO ? .12 : 1;                          // narration pace
const store = {
  get(k, d) { try { const v = localStorage.getItem('threshold:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('threshold:' + k, JSON.stringify(v)); } catch (e) {} }
};
const extraCss = document.createElement('style');
extraCss.textContent = '#still.live{opacity:1;filter:grayscale(1) sepia(.38) contrast(1.18) brightness(.74)}body.dark #still.live{filter:grayscale(1) sepia(.3) contrast(1.4) brightness(.35)}';
document.head.appendChild(extraCss);

/* ===================================================================== */
/* CANVAS + FILM GRAIN                                                    */
/* ===================================================================== */
const fx = $('fx'), g = fx.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() { W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2); fx.width = Math.round(W * DPR); fx.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0); }
addEventListener('resize', resize); resize();
(() => {
  const c = document.createElement('canvas'); c.width = c.height = 180; const x = c.getContext('2d'), d = x.createImageData(180, 180);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); $('grain').style.backgroundImage = 'url(' + c.toDataURL() + ')';
})();

/* ===================================================================== */
/* SOUND: drone, breath, bells, heartbeat (all synthesized)               */
/* ===================================================================== */
const audio = (() => {
  let ac = null, master = null, drone = null;
  const ctx = () => {
    try {
      if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = .8; const comp = ac.createDynamicsCompressor(); master.connect(comp).connect(ac.destination); }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
    return ac;
  };
  function bell(f, t0 = 0, vol = .1, dur = 2.8) {
    if (!ctx()) return; const t = ac.currentTime + t0;
    const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), out = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f * 2.76;
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(1, t + dur);
    mod.connect(mg).connect(car.frequency);
    out.gain.setValueAtTime(.0001, t); out.gain.exponentialRampToValueAtTime(vol, t + .012); out.gain.exponentialRampToValueAtTime(.0001, t + dur);
    car.connect(out).connect(master); car.start(t); mod.start(t); car.stop(t + dur + .1); mod.stop(t + dur + .1);
  }
  function breath(t0 = 0, vol = .04, dur = 1.6, freq = 2800) {
    if (!ctx()) return; const t = ac.currentTime + t0, len = Math.ceil(ac.sampleRate * dur), b = ac.createBuffer(1, len, ac.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), out = ac.createGain();
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.2;
    out.gain.setValueAtTime(.0001, t); out.gain.linearRampToValueAtTime(vol, t + dur * .4); out.gain.linearRampToValueAtTime(.0001, t + dur);
    s.connect(f).connect(out).connect(master); s.start(t);
  }
  function thump(t0 = 0, vol = .4) {
    if (!ctx()) return; const t = ac.currentTime + t0, o = ac.createOscillator(), out = ac.createGain();
    o.frequency.setValueAtTime(72, t); o.frequency.exponentialRampToValueAtTime(38, t + .25);
    out.gain.setValueAtTime(vol, t); out.gain.exponentialRampToValueAtTime(.0001, t + .32); o.connect(out).connect(master); o.start(t); o.stop(t + .36);
  }
  let lastTick = 0;
  function tick(vol = .04) {
    if (!ctx()) return; const now = performance.now(); if (now - lastTick < 90) return; lastTick = now;
    const t = ac.currentTime, o = ac.createOscillator(), out = ac.createGain(); o.type = 'triangle'; o.frequency.value = 1700 + Math.random() * 500;
    out.gain.setValueAtTime(vol, t); out.gain.exponentialRampToValueAtTime(.0001, t + .05); o.connect(out).connect(master); o.start(t); o.stop(t + .06);
  }
  return {
    start: ctx,
    droneOn() {
      if (!ctx() || drone) return;
      const out = ac.createGain(); out.gain.value = 0; out.gain.linearRampToValueAtTime(.14, ac.currentTime + 5); out.connect(master);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 3; f.connect(out);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .06; lg.gain.value = 160; lfo.connect(lg).connect(f.frequency); lfo.start();
      [55, 55.4, 82.4, 110.3].forEach((fr, i) => { const o = ac.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'sine'; o.frequency.value = fr; const og = ac.createGain(); og.gain.value = i < 2 ? .2 : .1; o.connect(og).connect(f); o.start(); });
      drone = { out, f };
    },
    drone(level, bright, t = 1.6) { if (!drone) return; drone.out.gain.linearRampToValueAtTime(level, ac.currentTime + t); if (bright) drone.f.frequency.linearRampToValueAtTime(bright, ac.currentTime + t); },
    bell, breath, thump, tick,
    chord() { [440, 554.4, 659.3, 880].forEach((f, i) => bell(f, i * .13, .08, 3.4)); },
    open() { [329.6, 392, 493.9, 659.3, 987.8].forEach((f, i) => bell(f, i * .17, .09, 4)); breath(.25, .035, 2.4, 2000); },
    heartbeat() { thump(0, .45); thump(.27, .32); }
  };
})();
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

/* ===================================================================== */
/* CAMERA (or the sample room on computers)                               */
/* ===================================================================== */
const cam = $('cam'), still = $('still');
let camOK = false, room = null;
async function startCamera() {
  if (MODE !== 'demo' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      cam.srcObject = stream; await cam.play().catch(() => {});
      for (let i = 0; i < 40 && !cam.videoWidth; i++) await wait(50);
      camOK = !!cam.videoWidth; if (camOK) return true;
    } catch (e) { /* refused or no camera: fall through to the sample room */ }
  }
  room = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'room.jpg'; });
  cam.hidden = true; paintStill(); still.classList.add('live');
  return false;
}
const srcEl = () => camOK ? cam : room;
const srcDims = () => camOK ? [cam.videoWidth, cam.videoHeight] : room ? [room.naturalWidth, room.naturalHeight] : [0, 0];
function coverRect() {                      // the part of the source the player actually sees (object-fit: cover)
  const [sw, sh] = srcDims(); if (!sw) return null;
  const s = Math.max(W / sw, H / sh), vw = W / s, vh = H / s;
  return [(sw - vw) / 2, (sh - vh) / 2, vw, vh];
}
const work = document.createElement('canvas'), wctx = work.getContext('2d', { willReadFrequently: true });
function grab(w, h) {
  const r = coverRect(); if (!r) return null;
  work.width = w; work.height = h; wctx.drawImage(srcEl(), r[0], r[1], r[2], r[3], 0, 0, w, h);
  return wctx.getImageData(0, 0, w, h);
}
function paintStill() {
  const r = coverRect(); if (!r) return;
  still.width = Math.round(W * DPR); still.height = Math.round(H * DPR);
  still.getContext('2d').drawImage(srcEl(), r[0], r[1], r[2], r[3], 0, 0, still.width, still.height);
}
function freeze() { if (camOK) { paintStill(); still.classList.add('on'); } else still.classList.add('on'); }
function unfreeze() { still.classList.remove('on'); }
let override = null;                        // self-test: pretend the camera sees light or darkness
function luminance() {
  if (override) return override;
  const w = 24, h = Math.round(24 * H / W), d = grab(w, h); if (!d) return { center: 0, mean: 0 };
  let sum = 0, csum = 0, cn = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, l = d.data[i] * .299 + d.data[i + 1] * .587 + d.data[i + 2] * .114; sum += l;
    if (Math.hypot((x - w / 2) / w, (y - h / 2) / w) < .2) { csum += l; cn++; }
  }
  return { center: cn ? csum / cn : 0, mean: sum / (w * h) };
}

/* ===================================================================== */
/* MOTION: tilt for the maze, orientation for the alignment               */
/* ===================================================================== */
const sensor = { has: false, alpha: 0, beta: 45, gamma: 0 };
function onOrient(e) { if (e.beta == null) return; sensor.has = true; sensor.alpha = e.alpha || 0; sensor.beta = e.beta; sensor.gamma = e.gamma || 0; }
async function startMotion() {
  try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false; } }
  catch (e) { return false; }
  addEventListener('deviceorientation', onOrient);
  return true;
}
const keys = {}, manual = { x: 0, y: 0 }, bot = { x: 0, y: 0 };
addEventListener('keydown', e => { keys[e.key] = 1; });
addEventListener('keyup', e => { keys[e.key] = 0; });
let drag = null;
fx.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; hold.on = true; });
addEventListener('pointermove', e => { if (drag) { manual.x = clamp((e.clientX - drag.x) / 110, -1, 1); manual.y = clamp((e.clientY - drag.y) / 110, -1, 1); } });
addEventListener('pointerup', () => { drag = null; manual.x = manual.y = 0; hold.on = false; });
const hold = { on: false };
function tilt(base) {
  if (sensor.has && !AUTO) return { x: clamp(sensor.gamma / 26, -1, 1), y: clamp((sensor.beta - base) / 26, -1, 1) };
  const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ky = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
  return { x: kx || manual.x || bot.x, y: ky || manual.y || bot.y };
}

/* ===================================================================== */
/* NARRATION + HUD                                                        */
/* ===================================================================== */
async function say(lines) {
  const box = $('story');
  for (const l of lines) {
    const text = typeof l === 'string' ? l : l.t;
    box.innerHTML = ''; const p = document.createElement('p'); if (l.small) p.className = 'small'; p.textContent = text; box.appendChild(p);
    requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on')));
    audio.breath(0, .022, 1.5, 2400 + Math.random() * 800);
    await wait(((l.hold) || 2200 + text.length * 38) * SPEED);
  }
}
function instruct(text) {
  const box = $('story'); box.innerHTML = ''; if (!text) return;
  const p = document.createElement('p'); p.textContent = text; box.appendChild(p);
  requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on')));
}
function hud(on, label) { $('hud').hidden = !on; if (label) $('doorLabel').textContent = label; $('timer').textContent = ''; $('reread').hidden = true; }
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

/* ===================================================================== */
/* THE MARKS (five sigils, drawn in a 100 x 100 box)                      */
/* ===================================================================== */
const MARKS = [
  [{ c: [50, 50, 40] }, { l: [50, 10, 84.6, 70] }, { l: [84.6, 70, 15.4, 70] }, { l: [15.4, 70, 50, 10] }, { l: [50, 10, 50, 90] }, { c: [50, 56.7, 13.3] }],
  [{ c: [50, 50, 11] }, ...Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return { l: [50 + Math.cos(a) * 20, 50 + Math.sin(a) * 20, 50 + Math.cos(a) * (i % 2 ? 32 : 40), 50 + Math.sin(a) * (i % 2 ? 32 : 40)] }; }), { a: [50, 50, 46, -2.6, -.55] }],
  [{ c: [38, 50, 24] }, { c: [62, 50, 24] }, { l: [8, 50, 92, 50] }, { l: [50, 32, 58, 50] }, { l: [58, 50, 50, 68] }, { l: [50, 68, 42, 50] }, { l: [42, 50, 50, 32] }],
  [{ l: [50, 10, 90, 50] }, { l: [90, 50, 50, 90] }, { l: [50, 90, 10, 50] }, { l: [10, 50, 50, 10] }, { c: [50, 50, 18] }],
  [{ c: [50, 50, 40] }, { c: [50, 50, 26] }, { c: [50, 50, 12] }, { l: [50, 4, 50, 96] }, { l: [4, 50, 96, 50] }]
];
function markSVG(i, locked) {
  return '<svg viewBox="0 0 100 100" class="' + (locked ? 'locked' : '') + '" aria-hidden="true">' + MARKS[i].map(p =>
    p.c ? '<circle cx="' + p.c[0] + '" cy="' + p.c[1] + '" r="' + p.c[2] + '"/>' :
    p.l ? '<line x1="' + p.l[0] + '" y1="' + p.l[1] + '" x2="' + p.l[2] + '" y2="' + p.l[3] + '"/>' :
    '<path d="M' + (p.a[0] + Math.cos(p.a[3]) * p.a[2]) + ' ' + (p.a[1] + Math.sin(p.a[3]) * p.a[2]) + ' A' + p.a[2] + ' ' + p.a[2] + ' 0 0 1 ' + (p.a[0] + Math.cos(p.a[4]) * p.a[2]) + ' ' + (p.a[1] + Math.sin(p.a[4]) * p.a[2]) + '"/>').join('') + '</svg>';
}
// draws one primitive of a mark, centered at (cx, cy) with size s; offset/rotation let fragments drift apart
function drawPrim(p, cx, cy, s, dx = 0, dy = 0, rot = 0) {
  const k = s / 100;
  g.save(); g.translate(cx + dx, cy + dy); g.rotate(rot); g.beginPath();
  if (p.c) g.arc((p.c[0] - 50) * k, (p.c[1] - 50) * k, p.c[2] * k, 0, Math.PI * 2);
  else if (p.l) { g.moveTo((p.l[0] - 50) * k, (p.l[1] - 50) * k); g.lineTo((p.l[2] - 50) * k, (p.l[3] - 50) * k); }
  else g.arc((p.a[0] - 50) * k, (p.a[1] - 50) * k, p.a[2] * k, p.a[3], p.a[4]);
  g.stroke(); g.restore();
}
function drawMark(i, cx, cy, s, alpha = 1, glow = 14) {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = '#E3C07A'; g.lineWidth = 1.6; g.lineCap = 'round'; g.shadowColor = 'rgba(255, 210, 140, .9)'; g.shadowBlur = glow;
  for (const p of MARKS[i]) drawPrim(p, cx, cy, s);
  g.restore();
}


/* ===================================================================== */
/* DOOR I: THE MAZE (the room's real edges become the walls)              */
/* ===================================================================== */
const BR = 2;                                   // the ember's radius, in grid cells
let MZ = null;
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
function clearance(block, w, h) {               // chessboard distance to the nearest wall (two-pass)
  const d = new Float32Array(w * h), INF = 1e6;
  for (let i = 0; i < w * h; i++) d[i] = block[i] ? 0 : INF;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue; let v = d[i]; if (x) v = Math.min(v, d[i - 1] + 1); if (y) { v = Math.min(v, d[i - w] + 1); if (x) v = Math.min(v, d[i - w - 1] + 1); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 1); } d[i] = v; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; let v = d[i]; if (x < w - 1) v = Math.min(v, d[i + 1] + 1); if (y < h - 1) { v = Math.min(v, d[i + w] + 1); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 1); if (x) v = Math.min(v, d[i + w - 1] + 1); } d[i] = v; }
  return d;
}
function bfs(ok, w, h, start) {
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
function components(ok, w, h) {                 // label open areas; returns the label grid and the biggest label
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
async function readRoom(extraSeed = 0) {
  const gw = 96, gh = Math.round(96 * H / W), N = gw * gh;
  const acc = new Float32Array(N); let n = 0;
  for (let k = 0; k < 6; k++) {                 // average a few frames to calm the sensor noise
    const d = grab(gw, gh);
    if (d) { for (let i = 0, j = 0; i < N; i++, j += 4) acc[i] += d.data[j] * .299 + d.data[j + 1] * .587 + d.data[j + 2] * .114; n++; }
    await wait(60);
  }
  if (!n) return false;
  for (let i = 0; i < N; i++) acc[i] /= n;
  const img = blur(blur(acc, gw, gh), gw, gh), mag = new Float32Array(N);
  for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
    const i = y * gw + x;
    const gx = img[i - gw + 1] + 2 * img[i + 1] + img[i + gw + 1] - img[i - gw - 1] - 2 * img[i - 1] - img[i + gw - 1];
    const gy = img[i + gw - 1] + 2 * img[i + gw] + img[i + gw + 1] - img[i - gw - 1] - 2 * img[i - gw] - img[i - gw + 1];
    mag[i] = Math.hypot(gx, gy);
  }
  const sorted = Float32Array.from(mag).sort();
  const sat = parseFloat(getComputedStyle(document.body).getPropertyValue('padding-top')) || 0;
  const top = Math.ceil((sat + 104) / H * gh), bottom = gh - Math.ceil(150 / H * gh), play = (bottom - top) * (gw - 2);
  const target = (gw + gh) * .5;
  const build = (frac, fil) => {                // walls from the strongest edges, then find the longest route
    const thr = Math.max(sorted[Math.min(N - 1, Math.floor(N * frac))], 12);
    let edge = new Uint8Array(N);
    for (let i = 0; i < N; i++) edge[i] = mag[i] > thr ? 1 : 0;
    edge = dilate(edge, gw, gh);
    if (fil) filigree(edge, gw, gh, top, bottom, fil + extraSeed);
    const block = new Uint8Array(N);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x; block[i] = edge[i] || y < top || y >= bottom || x < 1 || x >= gw - 1 ? 1 : 0; }
    const clear = clearance(block, gw, gh), ok = new Uint8Array(N);
    for (let i = 0; i < N; i++) ok[i] = clear[i] >= BR ? 1 : 0;
    const comp = components(ok, gw, gh);
    if (comp.bestN < play * .22) return null;   // too cluttered: the ember would be boxed in
    let start = -1, bd = 1e9;
    for (let y = top; y < bottom; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x; if (comp.lab[i] !== comp.bestL) continue; const d = Math.hypot(x - gw / 2, (y - (bottom - 6)) * 1.4); if (d < bd) { bd = d; start = i; } }
    const r = bfs(ok, gw, gh, start);
    return { gw, gh, edge, block, clear, ok, start, goal: r.far, prev: r.prev, len: r.dist[r.far] };
  };
  let best = null;
  for (const frac of [.95, .93, .91, .89, .965, .975, .985]) {
    const m = build(frac, 0);
    if (m && (!best || m.len > best.len)) best = m;
    if (best && best.len >= target * 1.4) break;
  }
  if (!best || best.len < target) {             // a bare room: keep its real edges and add gold arcs to wander through
    for (const fil of [1, 2, 3]) { const m = build(.965, fil); if (m && (!best || m.len > best.len)) best = m; if (best && best.len >= target) break; }
  }
  if (!best) return false;
  const path = []; for (let i = best.goal; i >= 0; i = best.prev[i]) path.push(i); path.reverse();
  // the visible walls: the room's real contours traced at higher resolution, drawn as thin gold lines
  const vw = 240, vh = Math.round(240 * H / W), vd = grab(vw, vh), vg = new Float32Array(vw * vh);
  if (vd) for (let i = 0, j = 0; i < vg.length; i++, j += 4) vg[i] = vd.data[j] * .299 + vd.data[j + 1] * .587 + vd.data[j + 2] * .114;
  const vb = blur(vg, vw, vh), vm = new Float32Array(vw * vh);
  for (let y = 1; y < vh - 1; y++) for (let x = 1; x < vw - 1; x++) {
    const i = y * vw + x;
    const gx = vb[i - vw + 1] + 2 * vb[i + 1] + vb[i + vw + 1] - vb[i - vw - 1] - 2 * vb[i - 1] - vb[i + vw - 1];
    const gy = vb[i + vw - 1] + 2 * vb[i + vw] + vb[i + vw + 1] - vb[i - vw - 1] - 2 * vb[i - vw] - vb[i - vw + 1];
    vm[i] = Math.hypot(gx, gy);
  }
  const vs = Float32Array.from(vm).sort(), vthr = Math.max(vs[Math.floor(vm.length * .9)], 10);
  const wc = document.createElement('canvas'); wc.width = vw; wc.height = vh;
  const wx = wc.getContext('2d'), id = wx.createImageData(vw, vh), vt = Math.round(top / gh * vh), vbtm = Math.round(bottom / gh * vh);
  for (let y = 0; y < vh; y++) for (let x = 0; x < vw; x++) {
    const i = y * vw + x, a = clamp((vm[i] - vthr * .85) / (vthr * .9), 0, 1) * (y < vt || y >= vbtm ? .35 : 1);
    if (a > 0) { id.data[i * 4] = 240; id.data[i * 4 + 1] = 204; id.data[i * 4 + 2] = 134; id.data[i * 4 + 3] = Math.round(a * 255); }
  }
  wx.putImageData(id, 0, 0);
  const sx = best.start % best.gw, sy = (best.start - sx) / best.gw, gx = best.goal % best.gw, gy = (best.goal - gx) / best.gw;
  MZ = { ...best, path, wc, ball: { x: sx, y: sy, vx: 0, vy: 0 }, gx, gy, t0: 0, reveal: performance.now(), done: false, base: sensor.beta, trail: [] };
  return true;
}
function filigree(edge, w, h, top, bottom, seed) {   // arcs and lines with gaps, for rooms with too little in them
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
const cellW = () => W / MZ.gw, cellH = () => H / MZ.gh;
function freeAt(x, y) { const ix = Math.round(x), iy = Math.round(y); return ix >= 0 && iy >= 0 && ix < MZ.gw && iy < MZ.gh && MZ.ok[iy * MZ.gw + ix] === 1; }
function stepBall(dt) {
  const b = MZ.ball, t = tilt(MZ.base);
  b.vx += t.x * 48 * dt; b.vy += t.y * 48 * dt;
  const f = Math.pow(.3, dt); b.vx *= f; b.vy *= f;
  const sp = Math.hypot(b.vx, b.vy); if (sp > 28) { b.vx *= 28 / sp; b.vy *= 28 / sp; }
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt / .35));
  for (let s = 0; s < steps; s++) {
    const nx = b.x + b.vx * dt / steps, ny = b.y + b.vy * dt / steps;
    if (freeAt(nx, ny)) { b.x = nx; b.y = ny; }
    else if (freeAt(nx, b.y)) { b.x = nx; if (Math.abs(b.vy) > 4) audio.tick(.03); b.vy *= -.2; }
    else if (freeAt(b.x, ny)) { b.y = ny; if (Math.abs(b.vx) > 4) audio.tick(.03); b.vx *= -.2; }
    else { if (sp > 4) { audio.tick(.04); buzz(8); } b.vx *= -.25; b.vy *= -.25; break; }
  }
  MZ.trail.push([b.x, b.y]); if (MZ.trail.length > 26) MZ.trail.shift();
  if (Math.hypot(b.x - MZ.gx, b.y - MZ.gy) < 3.2) MZ.done = true;
}
function botSteer() {                            // self-test pilot: follow the solved path
  if (!MZ || !MZ.path.length) return;
  const b = MZ.ball; let best = 0, bd = 1e9;
  MZ.path.forEach((i, k) => { const x = i % MZ.gw, y = (i - x) / MZ.gw, d = Math.hypot(x - b.x, y - b.y); if (d < bd) { bd = d; best = k; } });
  const t = MZ.path[Math.min(MZ.path.length - 1, best + 5)], tx = t % MZ.gw, ty = (t - tx) / MZ.gw;
  const dx = tx - b.x, dy = ty - b.y, m = Math.hypot(dx, dy) || 1;
  bot.x = clamp(dx / m * .9 - b.vx * .03, -1, 1); bot.y = clamp(dy / m * .9 - b.vy * .03, -1, 1);
}
function drawMaze(now) {
  const cw = cellW(), ch = cellH(), rev = clamp((now - MZ.reveal) / 1400, 0, 1), scanY = rev * H;
  g.save();
  if (rev < 1) { g.beginPath(); g.rect(0, 0, W, scanY); g.clip(); }
  g.imageSmoothingEnabled = true; g.globalCompositeOperation = 'lighter';
  g.globalAlpha = .34; g.drawImage(MZ.wc, -cw * 1.2, -ch * 1.2, W + cw * 2.4, H + ch * 2.4);
  g.globalAlpha = 1; g.drawImage(MZ.wc, 0, 0, W, H);
  g.restore();
  if (rev < 1) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, scanY - 40, 0, scanY); gr.addColorStop(0, 'rgba(255,214,150,0)'); gr.addColorStop(1, 'rgba(255,214,150,.55)'); g.fillStyle = gr; g.fillRect(0, scanY - 40, W, 40); g.restore(); return; }
  const gx = (MZ.gx + .5) * cw, gy = (MZ.gy + .5) * ch, pulse = .75 + .25 * Math.sin(now / 420);
  const glowG = g.createRadialGradient(gx, gy, 0, gx, gy, 46); glowG.addColorStop(0, 'rgba(255, 210, 140, .28)'); glowG.addColorStop(1, 'rgba(255, 210, 140, 0)');
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = glowG; g.beginPath(); g.arc(gx, gy, 46, 0, Math.PI * 2); g.fill(); g.restore();
  g.save(); g.translate(gx, gy); g.rotate(now / 4000); drawMark(0, 0, 0, 50 * pulse + 12, 1, 24); g.restore();
  g.save(); g.globalCompositeOperation = 'lighter';
  MZ.trail.forEach(([x, y], i) => { const a = i / MZ.trail.length; g.fillStyle = 'rgba(255, 196, 120,' + (a * .35) + ')'; g.beginPath(); g.arc((x + .5) * cw, (y + .5) * ch, 2 + a * 5, 0, Math.PI * 2); g.fill(); });
  const bx = (MZ.ball.x + .5) * cw, by = (MZ.ball.y + .5) * ch, r = BR * cw * 1.3;
  const halo = g.createRadialGradient(bx, by, 0, bx, by, r * 3.6); halo.addColorStop(0, 'rgba(255, 230, 190, .95)'); halo.addColorStop(.25, 'rgba(255, 190, 110, .55)'); halo.addColorStop(1, 'rgba(255, 160, 80, 0)');
  g.fillStyle = halo; g.beginPath(); g.arc(bx, by, r * 3.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFF4E0'; g.beginPath(); g.arc(bx, by, r * .62, 0, Math.PI * 2); g.fill();
  g.restore();
}


/* ===================================================================== */
/* DOOR II: THE LIGHT (find the brightest thing, then close the eye)      */
/* ===================================================================== */
const TAU = Math.PI * 2;
const L = { phase: 'light', prog: 0, lt: 0, lum: { center: 0, mean: 128 }, doneLight: false, doneDark: false, hit: false };
function drawLight(now, dt) {
  if (now - L.lt > 90) { L.lt = now; L.lum = luminance(); }
  const cx = W / 2, cy = H * .45, R = Math.min(W, H) * .22;
  if (L.phase === 'light') {
    L.hit = (!camOK && hold.on) || L.lum.center > Math.max(180, L.lum.mean + 45);
    L.prog = clamp(L.prog + (L.hit ? dt / 2.2 : -dt * .45), 0, 1);
    audio.drone(.12 + L.prog * .1, 300 + L.prog * 900, .3);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(227, 192, 122, .28)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
    g.strokeStyle = '#E3C07A'; g.lineWidth = 2.6; g.shadowColor = 'rgba(255, 210, 140, .95)'; g.shadowBlur = 18;
    g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * L.prog); g.stroke();
    if (L.hit) for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + now / 1800, r1 = R * (1.15 + .25 * ((now / 600 + i * .37) % 1)), r0 = R * 1.06;
      g.globalAlpha = .55; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.stroke();
    }
    g.restore();
    if (L.prog >= 1) L.doneLight = true;
  } else {
    const dark = (!camOK && hold.on) || L.lum.mean < 26;
    L.prog = clamp(L.prog + (dark ? dt / 2 : -dt * .35), 0, 1);
    const a = ease(L.prog);
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(232, 200, 135,' + a + ')'; g.shadowColor = 'rgba(255, 200, 120, .85)'; g.shadowBlur = 22 * a;
    g.font = 'italic 500 ' + Math.round(Math.min(W, 520) / 13) + 'px "Cormorant Garamond", Georgia, serif';
    g.fillText('The doors are not a game.', cx, cy - 24); g.fillText('They are a map.', cx, cy + 22);
    g.restore();
    if (L.prog >= 1) L.doneDark = true;
  }
}

/* ===================================================================== */
/* DOOR III: THE ALIGNMENT (pieces of a mark, anchored in the room)       */
/* ===================================================================== */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };
const AL = { target: null, frags: [], stars: [], locked: false, hold: 0, yaw: 0, pitch: 0, k: 0 };
function basis() {
  if (sensor.has && !AUTO) {                      // W3C device orientation: R = Rz(alpha) Rx(beta) Ry(gamma)
    const r = Math.PI / 180, a = sensor.alpha * r, b = sensor.beta * r, c = sensor.gamma * r;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(c), sg = Math.sin(c);
    const R = [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg, sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg, -cb * sg, sb, cb * cg];
    const right = [R[0], R[3], R[6]], up = [R[1], R[4], R[7]], back = [R[2], R[5], R[8]];
    return { right, up, fwd: [-back[0], -back[1], -back[2]] };
  }
  const cy = Math.cos(AL.yaw), sy = Math.sin(AL.yaw), cp = Math.cos(AL.pitch), sp = Math.sin(AL.pitch);
  const fwd = [sy * cp, cy * cp, sp], right = [cy, -sy, 0];
  return { right, up: cross(right, fwd), fwd };
}
function project(v, B) {
  const X = dot(v, B.right), Y = dot(v, B.up), Z = dot(v, B.fwd);
  if (Z < .06) return null;
  const f = (W / 2) / Math.tan(27 * Math.PI / 180);
  return [W / 2 + X / Z * f, H / 2 - Y / Z * f, Z];
}
function setupAlign() {
  const B = basis(), f = B.fwd, az0 = Math.atan2(f[0], f[1]);
  AL.yaw = az0; AL.pitch = 0;
  const az = az0 + 2.1, el = .1;
  AL.target = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
  AL.frags = MARKS[2].map((p, i) => ({ p, dx: (Math.random() - .5) * 320, dy: (Math.random() - .5) * 420, rot: (Math.random() - .5) * 2.4 }));
  AL.stars = Array.from({ length: 80 }, () => norm([Math.random() * 2 - 1, Math.random() * 2 - 1, (Math.random() * 2 - 1) * .7]));
  AL.locked = false; AL.hold = 0; AL.k = 0;
}
function drawAlign(now, dt) {
  if (!sensor.has || AUTO) {                       // computers and the self-test steer a virtual camera
    const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ky = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
    if (AUTO && !AL.locked) {
      const taz = Math.atan2(AL.target[0], AL.target[1]); let d = ((taz - AL.yaw + Math.PI * 3) % TAU) - Math.PI;
      AL.yaw += clamp(d, -1.1 * dt, 1.1 * dt); AL.pitch += clamp(Math.asin(AL.target[2]) - AL.pitch, -.5 * dt, .5 * dt);
    } else { AL.yaw += (kx || manual.x) * dt * 1.6; AL.pitch = clamp(AL.pitch + (ky || -manual.y) * dt * 1.1, -1.2, 1.2); }
  }
  const B = basis();
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const s of AL.stars) { const p = project(s, B); if (!p) continue; g.fillStyle = 'rgba(255, 215, 150,' + (.18 + .3 * p[2]) + ')'; g.beginPath(); g.arc(p[0], p[1], 1 + p[2] * 1.4, 0, TAU); g.fill(); }
  g.restore();
  const ang = Math.acos(clamp(dot(B.fwd, AL.target), -1, 1));
  const upW = [0, 0, 1], upP = norm([upW[0] - dot(upW, B.fwd) * B.fwd[0], upW[1] - dot(upW, B.fwd) * B.fwd[1], upW[2] - dot(upW, B.fwd) * B.fwd[2]]);
  const roll = Math.acos(clamp(dot(upP, B.up), -1, 1));
  const kTarget = AL.locked ? 1 : clamp(1 - ang / (32 * Math.PI / 180), 0, 1) * Math.sqrt(clamp(1 - roll / (55 * Math.PI / 180), 0, 1));
  AL.k += (kTarget - AL.k) * Math.min(1, dt * 4);
  const c = project(AL.target, B);
  if (c) {
    const k = ease(AL.k), s = Math.min(W, H) * .42;
    g.save(); g.strokeStyle = '#E3C07A'; g.lineWidth = 1.6 + k; g.lineCap = 'round'; g.shadowColor = 'rgba(255, 210, 140, .95)'; g.shadowBlur = 8 + 22 * k;
    for (const fr of AL.frags) drawPrim(fr.p, c[0], c[1], s, fr.dx * (1 - k), fr.dy * (1 - k), fr.rot * (1 - k));
    g.restore();
  } else {                                          // the mark is behind you: a faint chevron shows the way
    const X = dot(AL.target, B.right), Y = dot(AL.target, B.up), a = Math.atan2(-Y, X);
    const ex = W / 2 + Math.cos(a) * (W / 2 - 36), ey = H / 2 + Math.sin(a) * (H / 2 - 120);
    g.save(); g.translate(ex, ey); g.rotate(a); g.strokeStyle = 'rgba(227, 192, 122,' + (.45 + .35 * Math.sin(now / 300)) + ')'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-8, -12); g.lineTo(6, 0); g.lineTo(-8, 12); g.stroke(); g.restore();
  }
  if (!AL.locked) {
    if (AL.k > .93) { AL.hold += dt; if (AL.hold > .9) { AL.locked = true; } } else AL.hold = Math.max(0, AL.hold - dt);
    if (AL.k > .6 && Math.random() < dt * 3) audio.tick(.02 + AL.k * .03);
  }
}

/* ===================================================================== */
/* AMBIENT MOTES + THE LOOP                                               */
/* ===================================================================== */
let scene = 'none', last = performance.now();
const motes = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), v: .004 + Math.random() * .012, r: .6 + Math.random() * 1.6, p: Math.random() * TAU }));
function drawMotes(now, dt) {
  if (scene === 'align') return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const m of motes) { m.y -= m.v * dt; if (m.y < -.02) { m.y = 1.02; m.x = Math.random(); } const a = .12 + .12 * Math.sin(now / 900 + m.p); g.fillStyle = 'rgba(255, 214, 150,' + a + ')'; g.beginPath(); g.arc(m.x * W + Math.sin(now / 2400 + m.p) * 8, m.y * H, m.r, 0, TAU); g.fill(); }
  g.restore();
}
function drawScan(now) {
  const y = ((now / 1300) % 1) * H;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createLinearGradient(0, y - 60, 0, y); gr.addColorStop(0, 'rgba(255,214,150,0)'); gr.addColorStop(1, 'rgba(255,214,150,.35)');
  g.fillStyle = gr; g.fillRect(0, y - 60, W, 60); g.fillStyle = 'rgba(255, 226, 180, .8)'; g.fillRect(0, y, W, 1.2);
  g.restore();
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  g.clearRect(0, 0, W, H);
  if (scene === 'scan') drawScan(now);
  else if (scene === 'maze' && MZ) {
    if (MZ.play && !MZ.done) { if (AUTO && !shotHold) botSteer(); stepBall(dt); $('timer').textContent = fmtTime((now - MZ.t0) / 1000); }
    drawMaze(now);
  }
  else if (scene === 'light') drawLight(now, dt);
  else if (scene === 'align') drawAlign(now, dt);
  drawMotes(now, dt);
}
requestAnimationFrame(frame);

/* ===================================================================== */
/* THE NIGHT: splash, three doors, interludes, ending                     */
/* ===================================================================== */
const until = async fn => { while (!fn()) await wait(50); };
let shotHold = false;
const shot = async (name, ms) => { if (MODE === name) { await wait(ms); report(); shotHold = true; await new Promise(() => {}); } };
function reveal(container) { [...container.querySelectorAll('.line')].forEach((el, i) => setTimeout(() => el.classList.add('on'), 250 + i * 900 * SPEED)); }
function clickWhenReady(id) { return new Promise(res => { const b = $(id); b.onclick = () => res(); if (AUTO) setTimeout(() => res(), 1600 * SPEED + 300); }); }
async function door1() {
  scene = 'none'; hud(true, 'Door I · The Maze'); unfreeze();
  await say(['Every room hides a maze.', 'Hold still. Let it read yours.']);
  scene = 'scan'; await wait(900 * SPEED);
  if (!await readRoom()) { instruct('The room is too dark to read. Turn on a light.'); await until(() => false); }
  freeze(); scene = 'maze'; MZ.reveal = performance.now(); audio.bell(196, 0, .12, 3.4); audio.breath(.2, .03, 2, 1800);
  await wait(1600 * SPEED);
  instruct(sensor.has ? 'Tilt the glass. Guide the ember to the mark.' : 'Drag or use the arrow keys. Guide the ember to the mark.');
  $('reread').hidden = false; MZ.base = clamp(sensor.beta, 15, 75); MZ.t0 = performance.now(); MZ.play = true;
  await shot('shot1', 2500);
  await until(() => MZ.done);
  const secs = (performance.now() - MZ.t0) / 1000; MZ.play = false; $('reread').hidden = true; instruct('');
  audio.open(); buzz([30, 60, 30]);
  const best = store.get('best', null); if (!best || secs < best) store.set('best', secs);
  await wait(1500 * SPEED); unfreeze(); scene = 'none'; $('timer').textContent = '';
  await say(['It took Player Four eleven minutes.', 'You took ' + fmtTime(secs) + '.']);
}
$('reread').addEventListener('click', async () => {
  if (!MZ || MZ.done || !MZ.play) return;
  const t0 = MZ.t0; MZ.play = false; unfreeze(); scene = 'scan'; instruct('Hold still.');
  await wait(800); await readRoom(Math.floor(Math.random() * 9) + 1);
  freeze(); scene = 'maze'; MZ.reveal = performance.now(); MZ.t0 = t0; MZ.base = clamp(sensor.beta, 15, 75); MZ.play = true;
  instruct(sensor.has ? 'Tilt the glass. Guide the ember to the mark.' : 'Drag or use the arrow keys. Guide the ember to the mark.');
});
async function door2() {
  hud(true, 'Door II · The Light'); unfreeze(); scene = 'none';
  await say(['Find the brightest thing in this room.', 'Look at it until it looks back.']);
  L.phase = 'light'; L.prog = 0; L.doneLight = false; scene = 'light';
  instruct(camOK ? 'Hold the light inside the circle.' : 'Press and hold to look at the light.');
  if (AUTO) override = { center: 240, mean: 120 };
  await shot('shot2', 1500);
  await until(() => L.doneLight);
  audio.chord(); buzz(40); scene = 'none'; override = null;
  await say(['It saw you.', 'Now close its eye.']);
  L.phase = 'dark'; L.prog = 0; L.doneDark = false; document.body.classList.add('dark'); scene = 'light';
  instruct(camOK ? 'Cover the camera with your hand.' : 'Press and hold to close the eye.');
  if (AUTO) override = { center: 4, mean: 6 };
  await until(() => L.doneDark);
  instruct(''); audio.heartbeat(); await wait(2600 * SPEED); audio.heartbeat(); await wait(1400 * SPEED);
  document.body.classList.remove('dark'); override = null; scene = 'none';
  await say(['Most people are afraid of the dark part.', 'You weren’t.']);
}
async function door3() {
  hud(true, 'Door III · The Alignment'); scene = 'none';
  await say(['Something is scattered around you.', 'Turn slowly. When the pieces become one, stop.']);
  setupAlign(); scene = 'align';
  instruct(sensor.has ? 'Turn slowly until the pieces meet.' : 'Drag to look around until the pieces meet.');
  await shot('shot3', 2200);
  await until(() => AL.locked);
  instruct(''); audio.open(); buzz([40, 40, 80]);
  await wait(2400 * SPEED); scene = 'none';
  await say(['That is the third mark.', 'Keep it.']);
}
async function interlude(html, btn) {
  hud(false); instruct('');
  const s = $('interlude'), col = $('interCol');
  col.innerHTML = html + '<button class="go line" id="nextDoor" type="button">' + btn + '</button>';
  s.hidden = false; reveal(col); audio.breath(0, .03, 2.4, 2000);
  await clickWhenReady('nextDoor'); s.hidden = true;
}
function ending() {
  hud(false); scene = 'none'; instruct('');
  const col = $('endCol');
  col.innerHTML = '<p class="eyebrow line">Three of five</p><p class="lead line">Three doors in one night.</p><p class="lead line">You are faster than she was.</p>' +
    '<div class="marks line">' + [0, 1, 2, 3, 4].map(i => markSVG(i, i > 2)).join('') + '</div>' +
    '<p class="fine line">The fourth door opens tomorrow at 3:03 AM.</p><p class="fine line">Don’t tell anyone about the doors. They choose who they open for.</p>' +
    '<button class="go line" id="again" type="button">Begin again</button>';
  $('end').hidden = false; reveal(col); audio.drone(.08, 260, 3);
  $('again').onclick = () => location.reload();
}
async function night() {
  reveal($('splash'));
  await clickWhenReady('begin');
  audio.start(); audio.droneOn();
  $('splash').hidden = true; $('perm').hidden = false;
  await new Promise(res => {
    $('allow').onclick = async () => {
      const motion = startMotion();                 // must start inside the tap for iOS to ask
      const camera = startCamera();
      const [m, c] = await Promise.all([motion, camera]);
      if (!c) { $('permNote').hidden = false; $('permNote').textContent = 'No camera, so the doors will use a photograph of a room instead.'; await wait(2200 * SPEED); }
      res();
    };
    if (AUTO) setTimeout(() => $('allow').click(), 600);
  });
  $('perm').hidden = true;
  await door1();
  await interlude('<p class="eyebrow line">Player Four</p><p class="lead line">Lena Ostrova was the first to reach the fifth door.</p>' +
    '<p class="fine line">She was nineteen. She played every night at 3 AM, in the bathroom, with the lights off.</p>' +
    '<p class="fine line">They found her phone on the floor of an empty church in Valparaíso, screen still on, camera still open.</p><p class="lead line">Nobody found Lena.</p>', 'Open the second door');
  await door2();
  await interlude('<p class="eyebrow line">Her last message</p><p class="lead line">“The doors are not a game. They are a map.”</p>' +
    '<p class="fine line">She sent it to a number that no longer exists. The reply came anyway.</p><p class="lead line">“Then follow it.”</p>', 'Open the third door');
  await door3();
  ending();
  report();
}

/* ===================================================================== */
/* SELF-TEST (#auto plays the whole night; #shot1-3 stop at each door)   */
/* ===================================================================== */
let report = () => {};
if (AUTO) {
  const out = document.createElement('pre'); out.id = 'selftest'; out.hidden = true; document.body.appendChild(out);
  const errors = [];
  addEventListener('error', e => errors.push(String(e.message))); addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
  report = () => { out.textContent = JSON.stringify({ scene, camOK, ball: MZ && { x: Math.round((MZ.ball.x + .5) * W / MZ.gw), y: Math.round((MZ.ball.y + .5) * H / MZ.gh), gx: Math.round((MZ.gx + .5) * W / MZ.gw), gy: Math.round((MZ.gy + .5) * H / MZ.gh), done: MZ.done, play: MZ.play }, ended: !$('end').hidden, maze: MZ && { gw: MZ.gw, gh: MZ.gh, len: MZ.len, path: MZ.path.length, edges: MZ.edge.reduce((a, b) => a + b, 0) }, align: AL.locked, errors }); };
  setInterval(report, 500);
}
night();
})();

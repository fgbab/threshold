'use strict';
(() => {
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async fn => { while (!fn()) await wait(50); };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TAU = Math.PI * 2;
const MODE = location.hash.slice(1);       // '' | 'demo' (a photo instead of the camera) | 'unlock' (open the next door now) | self-tests: auto, auto2, auto3, shot1-8, shotw
const AUTO = /^(auto[23]?|shot[1-8w])$/.test(MODE);
const SPEED = AUTO ? .12 : 1;              // narration pace
const NATIVE = window.TH_NATIVE || null;   // the iPhone app's bridge (native.js); null on the web
const SITE = 'https://fgbab.github.io/threshold/';
const memory = {};                         // the self-test never touches real progress
const store = {
  get(k, d) { try { const v = AUTO ? memory[k] : localStorage.getItem('threshold:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) {
    const s = JSON.stringify(v);
    if (AUTO) { memory[k] = s; return; }
    try { localStorage.setItem('threshold:' + k, s); } catch (e) {}
    if (NATIVE) NATIVE.save('threshold:' + k, s);   // the app also keeps a copy that iOS won't clear
  }
};
const cards = {                            // small pictures of the doors, kept for sharing
  get(k) { try { return AUTO ? memory['card-' + k] : localStorage.getItem('threshold:card-' + k); } catch (e) { return null; } },
  set(k, v) { try { if (AUTO) memory['card-' + k] = v; else localStorage.setItem('threshold:card-' + k, v); } catch (e) {} },
  clear() { for (const k of ['maze', 'door', 'glass']) { delete memory['card-' + k]; try { localStorage.removeItem('threshold:card-' + k); } catch (e) {} } }
};
let SETTINGS = { tilt: 1, sound: true }, P = null;
const saveP = () => store.set('player', P);

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
/* SOUND: drone, breath, bells, knocks, footsteps (all synthesized)       */
/* ===================================================================== */
const audio = (() => {
  let ac = null, master = null, drone = null, hall = null, masterLevel = .8;
  const ctx = () => {
    try {
      if (!ac) {
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}   // iPhone: play even with the ringer on silent
        ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = masterLevel;
        const comp = ac.createDynamicsCompressor(); master.connect(comp).connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
    return ac;
  };
  const noise = dur => { const len = Math.ceil(ac.sampleRate * dur), b = ac.createBuffer(1, len, ac.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1; return b; };
  function hallway() {                      // a long dark room, for whatever answers from the other side
    if (hall) return hall;
    const len = Math.ceil(ac.sampleRate * 2.8), b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = b.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
    hall = ac.createConvolver(); hall.buffer = b; hall.connect(master); return hall;
  }
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
    if (!ctx()) return; const t = ac.currentTime + t0;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), out = ac.createGain();
    s.buffer = noise(dur); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.2;
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
  function knock(t0 = 0, vol = .5, wet = 0) {
    if (!ctx()) return; const t = ac.currentTime + t0, bus = ac.createGain(); bus.connect(master);
    if (wet) { const w = ac.createGain(); w.gain.value = wet; bus.connect(w).connect(hallway()); }
    const o = ac.createOscillator(), og = ac.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(62, t + .1);
    og.gain.setValueAtTime(vol, t); og.gain.exponentialRampToValueAtTime(.0001, t + .18);
    o.connect(og).connect(bus); o.start(t); o.stop(t + .2);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), sg = ac.createGain();
    s.buffer = noise(.06); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.2;
    sg.gain.setValueAtTime(vol * .8, t); sg.gain.exponentialRampToValueAtTime(.0001, t + .06);
    s.connect(f).connect(sg).connect(bus); s.start(t);
  }
  function step(t0 = 0, vol = .1, pan = 0) {
    if (!ctx()) return; const t = ac.currentTime + t0;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), sg = ac.createGain();
    s.buffer = noise(.16); f.type = 'lowpass'; f.frequency.value = 480;
    sg.gain.setValueAtTime(.0001, t); sg.gain.exponentialRampToValueAtTime(vol, t + .015); sg.gain.exponentialRampToValueAtTime(.0001, t + .15);
    s.connect(f).connect(sg);
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; sg.connect(p).connect(master); } else sg.connect(master);
    s.start(t); thump(t0, vol * 1.3);
  }
  let lastGlitch = 0;
  function glitch(vol = .04) {
    if (!ctx()) return; const now = performance.now(); if (now - lastGlitch < 600) return; lastGlitch = now;
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), sg = ac.createGain();
    s.buffer = noise(.13); f.type = 'highpass'; f.frequency.value = 2400;
    for (let i = 0; i < 7; i++) sg.gain.setValueAtTime(i % 2 ? .0001 : vol, t + i * .018);
    sg.gain.setValueAtTime(.0001, t + .13);
    s.connect(f).connect(sg).connect(master); s.start(t);
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
    duck(to, t = .4) { if (!ac) return; const p = master.gain, n = ac.currentTime; p.cancelScheduledValues(n); p.setValueAtTime(p.value, n); p.linearRampToValueAtTime(Math.max(.0001, to * masterLevel), n + t); },
    mute(on) { masterLevel = on ? 0 : .8; if (master) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.value = masterLevel; } },
    bell, breath, thump, tick, knock, step, glitch,
    chord() { [440, 554.4, 659.3, 880].forEach((f, i) => bell(f, i * .13, .08, 3.4)); },
    open() { [329.6, 392, 493.9, 659.3, 987.8].forEach((f, i) => bell(f, i * .17, .09, 4)); breath(.25, .035, 2.4, 2000); },
    heartbeat() { thump(0, .45); thump(.27, .32); }
  };
})();
function buzz(p) {                         // haptics: the app's engine on iPhone, vibration on Android browsers
  try {
    if (NATIVE) { let t = 0; (Array.isArray(p) ? p : [p]).forEach((d, i) => { if (i % 2 === 0) setTimeout(() => NATIVE.impact(d >= 60 ? 'heavy' : d >= 25 ? 'medium' : 'light'), t); t += d; }); return; }
    if (navigator.vibrate) navigator.vibrate(p);
  } catch (e) {}
}
let wake = null;                           // keep the screen on while a door is open
async function keepAwake() { try { if (navigator.wakeLock && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {} }

/* ===================================================================== */
/* CAMERA (or the sample room on computers)                               */
/* ===================================================================== */
const cam = $('cam'), still = $('still');
let camOK = false, room = null, stream = null, facing = 'environment', playing = false;
const loadImage = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
function stopCamera() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
async function startCamera(face = 'environment') {
  facing = face; stopCamera(); camOK = false;
  if (MODE !== 'demo' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: face }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      cam.srcObject = stream; await cam.play().catch(() => {});
      for (let i = 0; i < 40 && !cam.videoWidth; i++) await wait(50);
      camOK = !!cam.videoWidth;
    } catch (e) { /* refused or no camera: fall through to the sample room */ }
  }
  document.body.classList.toggle('selfie', camOK && face === 'user');
  if (camOK) { cam.hidden = false; still.classList.remove('live'); return true; }
  if (!room) room = await loadImage('room.jpg');
  cam.hidden = true; paintStill(); still.classList.add('live');
  return false;
}
document.addEventListener('visibilitychange', () => {   // coming back from the home screen mid-door
  if (document.visibilityState !== 'visible' || !playing) return;
  keepAwake();
  if (stream && stream.getVideoTracks().some(t => t.readyState === 'ended')) startCamera(facing);
  else if (camOK && cam.paused) cam.play().catch(() => {});
});
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
  work.width = w; work.height = h; wctx.imageSmoothingEnabled = true; wctx.imageSmoothingQuality = 'high';
  wctx.drawImage(srcEl(), r[0], r[1], r[2], r[3], 0, 0, w, h);
  return wctx.getImageData(0, 0, w, h);
}
function paintStill() {
  const r = coverRect(); if (!r) return;
  still.width = Math.round(W * DPR); still.height = Math.round(H * DPR);
  still.getContext('2d').drawImage(srcEl(), r[0], r[1], r[2], r[3], 0, 0, still.width, still.height);
}
function freeze() { if (camOK) paintStill(); still.classList.add('on'); }
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
/* MOTION: tilt, orientation, footsteps and knocks                        */
/* ===================================================================== */
const sensor = { has: false, alpha: 0, beta: 45, gamma: 0 };
function onOrient(e) { if (e.beta == null) return; sensor.has = true; sensor.alpha = e.alpha || 0; sensor.beta = e.beta; sensor.gamma = e.gamma || 0; }
const MO = { lp: 9.81, prev: 9.81, jerk: .2, lastStep: 0, lastKnock: 0, onStep: null, onKnock: null };
function onMotion(e) {
  const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
  const m = Math.hypot(a.x, a.y, a.z), now = performance.now(), j = Math.abs(m - MO.prev);
  MO.prev = m; MO.lp += (m - MO.lp) * .06;
  if (MO.onStep && m - MO.lp > 1.3 && now - MO.lastStep > 340) { MO.lastStep = now; MO.onStep(); }
  if (MO.onKnock && j > Math.max(.7, MO.jerk * 6) && now - MO.lastKnock > 240) { MO.lastKnock = now; MO.onKnock(); }
  MO.jerk += (j - MO.jerk) * .03;
}
function startMotion() {                    // must be called inside a tap: that's the only time iOS asks
  const ask = E => { try { return E && E.requestPermission ? E.requestPermission().catch(() => 'denied') : Promise.resolve('granted'); } catch (e) { return Promise.resolve('denied'); } };
  return Promise.all([ask(window.DeviceOrientationEvent), ask(window.DeviceMotionEvent)]).then(([ro, rm]) => {
    if (ro === 'granted') addEventListener('deviceorientation', onOrient);
    if (ro === 'granted' || rm === 'granted') addEventListener('devicemotion', onMotion);
    return ro === 'granted';
  });
}
const keys = {}, manual = { x: 0, y: 0 }, bot = { x: 0, y: 0 }, hold = { on: false };
addEventListener('keydown', e => { keys[e.key] = 1; if (e.key === ' ') hold.on = true; });
addEventListener('keyup', e => { keys[e.key] = 0; if (e.key === ' ') hold.on = false; });
let drag = null, tapHook = null;
fx.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; hold.on = true; if (tapHook) tapHook(); });
addEventListener('pointermove', e => { if (drag) { manual.x = clamp((e.clientX - drag.x) / 110, -1, 1); manual.y = clamp((e.clientY - drag.y) / 110, -1, 1); } });
const release = () => { drag = null; manual.x = manual.y = 0; hold.on = false; };
addEventListener('pointerup', release); addEventListener('pointercancel', release);
function tilt(base) {
  const sens = 26 / (SETTINGS.tilt || 1);
  if (sensor.has && !AUTO) return { x: clamp(sensor.gamma / sens, -1, 1), y: clamp((sensor.beta - base) / sens, -1, 1) };
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
function instruct(text, small) {
  const box = $('story'); box.innerHTML = ''; if (!text) return;
  const ps = [text, small].filter(Boolean).map((t, i) => { const p = document.createElement('p'); if (i) p.className = 'small'; p.textContent = t; box.appendChild(p); return p; });
  requestAnimationFrame(() => requestAnimationFrame(() => ps.forEach(p => p.classList.add('on'))));
}
function hud(on, label) { $('hud').hidden = !on; if (label) $('doorLabel').textContent = label; $('timer').textContent = ''; $('reread').hidden = true; }
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

/* ===================================================================== */
/* THE MARKS (five sigils, drawn in a 100 x 100 box)                      */
/* ===================================================================== */
const MARKS = [
  [{ c: [50, 50, 40] }, { l: [35, 76, 35, 46] }, { a: [50, 46, 15, Math.PI, TAU] }, { l: [65, 46, 65, 76] }, { l: [12, 76, 88, 76] }, { c: [50, 58, 5] }],   // the door
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
// draws one primitive of a mark, centered at (cx, cy) with size s; offset/rotation let fragments drift apart, f < 1 draws part of it
function drawPrim(p, cx, cy, s, dx = 0, dy = 0, rot = 0, f = 1, c = g) {
  const k = s / 100;
  c.save(); c.translate(cx + dx, cy + dy); c.rotate(rot); c.beginPath();
  if (p.c) c.arc((p.c[0] - 50) * k, (p.c[1] - 50) * k, p.c[2] * k, -Math.PI / 2, -Math.PI / 2 + TAU * f);
  else if (p.l) { c.moveTo((p.l[0] - 50) * k, (p.l[1] - 50) * k); c.lineTo((p.l[0] + (p.l[2] - p.l[0]) * f - 50) * k, (p.l[1] + (p.l[3] - p.l[1]) * f - 50) * k); }
  else c.arc((p.a[0] - 50) * k, (p.a[1] - 50) * k, p.a[2] * k, p.a[3], p.a[3] + (p.a[4] - p.a[3]) * f);
  c.stroke(); c.restore();
}
function drawMark(i, cx, cy, s, alpha = 1, glow = 14, f = 1, c = g) {   // f < 1 writes the mark stroke by stroke
  const parts = MARKS[i], n = parts.length;
  c.save(); c.globalAlpha = alpha; c.strokeStyle = '#E3C07A'; c.lineWidth = Math.max(1.6, s / 90); c.lineCap = 'round'; c.shadowColor = 'rgba(255, 210, 140, .9)'; c.shadowBlur = glow;
  parts.forEach((p, j) => { const pf = clamp(f * n - j, 0, 1); if (pf > 0) drawPrim(p, cx, cy, s, 0, 0, 0, pf, c); });
  c.restore();
}

/* ===================================================================== */
/* DOOR I: THE MAZE (the room's real edges become the walls)              */
/* ===================================================================== */
const BR = 2;                                   // the ember's radius, in grid cells
let MZ = null, lastMaze = 0;
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
  const mag = sobel(blur(blur(acc, gw, gh), gw, gh), gw, gh);
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
  const sx = best.start % best.gw, sy = (best.start - sx) / best.gw, gx = best.goal % best.gw, gy = (best.goal - gx) / best.gw;
  MZ = { ...best, path, wc: traceLines(top / gh, bottom / gh), ball: { x: sx, y: sy, vx: 0, vy: 0 }, gx, gy, t0: 0, reveal: performance.now(), done: false, base: sensor.beta, trail: [] };
  return true;
}
// the scene's real contours traced at higher resolution, as thin gold lines (dimmer outside the play area)
function traceLines(dimTop = 0, dimBottom = 1) {
  const vw = 240, vh = Math.round(240 * H / W), vd = grab(vw, vh), vg = new Float32Array(vw * vh);
  if (vd) for (let i = 0, j = 0; i < vg.length; i++, j += 4) vg[i] = vd.data[j] * .299 + vd.data[j + 1] * .587 + vd.data[j + 2] * .114;
  const vm = sobel(blur(vg, vw, vh), vw, vh), vs = Float32Array.from(vm).sort(), vthr = Math.max(vs[Math.floor(vm.length * .9)], 10);
  const wc = document.createElement('canvas'); wc.width = vw; wc.height = vh;
  const wx = wc.getContext('2d'), id = wx.createImageData(vw, vh), vt = Math.round(dimTop * vh), vb = Math.round(dimBottom * vh);
  for (let y = 0; y < vh; y++) for (let x = 0; x < vw; x++) {
    const i = y * vw + x, a = clamp((vm[i] - vthr * .85) / (vthr * .9), 0, 1) * (y < vt || y >= vb ? .35 : 1);
    if (a > 0) { id.data[i * 4] = 240; id.data[i * 4 + 1] = 204; id.data[i * 4 + 2] = 134; id.data[i * 4 + 3] = Math.round(a * 255); }
  }
  wx.putImageData(id, 0, 0);
  return wc;
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
function drawLines(wc, now, t0, dur = 1400) {   // gold contours, revealed by a falling scan line; returns the reveal progress
  const rev = clamp((now - t0) / dur, 0, 1), scanY = rev * H, b = W / 80;
  g.save();
  if (rev < 1) { g.beginPath(); g.rect(0, 0, W, scanY); g.clip(); }
  g.imageSmoothingEnabled = true; g.globalCompositeOperation = 'lighter';
  g.globalAlpha = .34; g.drawImage(wc, -b, -b, W + b * 2, H + b * 2);
  g.globalAlpha = 1; g.drawImage(wc, 0, 0, W, H);
  g.restore();
  if (rev < 1) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, scanY - 40, 0, scanY); gr.addColorStop(0, 'rgba(255,214,150,0)'); gr.addColorStop(1, 'rgba(255,214,150,.55)'); g.fillStyle = gr; g.fillRect(0, scanY - 40, W, 40); g.restore(); }
  return rev;
}
function drawMaze(now) {
  if (drawLines(MZ.wc, now, MZ.reveal) < 1) return;
  const cw = cellW(), ch = cellH(), gx = (MZ.gx + .5) * cw, gy = (MZ.gy + .5) * ch, pulse = .75 + .25 * Math.sin(now / 420);
  const glowG = g.createRadialGradient(gx, gy, 0, gx, gy, 46); glowG.addColorStop(0, 'rgba(255, 210, 140, .28)'); glowG.addColorStop(1, 'rgba(255, 210, 140, 0)');
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = glowG; g.beginPath(); g.arc(gx, gy, 46, 0, TAU); g.fill(); g.restore();
  g.save(); g.translate(gx, gy); g.rotate(now / 4000); drawMark(0, 0, 0, 50 * pulse + 12, 1, 24); g.restore();
  g.save(); g.globalCompositeOperation = 'lighter';
  MZ.trail.forEach(([x, y], i) => { const a = i / MZ.trail.length; g.fillStyle = 'rgba(255, 196, 120,' + (a * .35) + ')'; g.beginPath(); g.arc((x + .5) * cw, (y + .5) * ch, 2 + a * 5, 0, TAU); g.fill(); });
  const bx = (MZ.ball.x + .5) * cw, by = (MZ.ball.y + .5) * ch, r = BR * cw * 1.3;
  const halo = g.createRadialGradient(bx, by, 0, bx, by, r * 3.6); halo.addColorStop(0, 'rgba(255, 230, 190, .95)'); halo.addColorStop(.25, 'rgba(255, 190, 110, .55)'); halo.addColorStop(1, 'rgba(255, 160, 80, 0)');
  g.fillStyle = halo; g.beginPath(); g.arc(bx, by, r * 3.6, 0, TAU); g.fill();
  g.fillStyle = '#FFF4E0'; g.beginPath(); g.arc(bx, by, r * .62, 0, TAU); g.fill();
  g.restore();
}

/* ===================================================================== */
/* DOOR II: THE LIGHT (find the brightest thing, then close the eye)      */
/* ===================================================================== */
const L = { phase: 'light', prog: 0, lt: 0, lum: { center: 0, mean: 128 }, doneLight: false, doneDark: false, hit: false, assist: false };
function drawLight(now, dt) {
  if (now - L.lt > 90) { L.lt = now; L.lum = luminance(); }
  const cx = W / 2, cy = H * .45, R = Math.min(W, H) * .22, touch = (!camOK || L.assist) && hold.on;
  if (L.phase === 'light') {
    L.hit = touch || L.lum.center > Math.max(180, L.lum.mean + 45);
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
    const dark = touch || L.lum.mean < 26;
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
const AL = { target: null, frags: [], stars: [], locked: false, hold: 0, yaw: 0, pitch: 0, k: 0, easy: false };
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
  AL.frags = MARKS[2].map(p => ({ p, dx: (Math.random() - .5) * 320, dy: (Math.random() - .5) * 420, rot: (Math.random() - .5) * 2.4 }));
  AL.stars = Array.from({ length: 80 }, () => norm([Math.random() * 2 - 1, Math.random() * 2 - 1, (Math.random() * 2 - 1) * .7]));
  AL.locked = false; AL.hold = 0; AL.k = 0; AL.easy = false;
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
  const roll = Math.acos(clamp(dot(upP, B.up), -1, 1)), tol = (AL.easy ? 48 : 32) * Math.PI / 180, rollTol = (AL.easy ? 85 : 55) * Math.PI / 180;
  const kTarget = AL.locked ? 1 : clamp(1 - ang / tol, 0, 1) * Math.sqrt(clamp(1 - roll / rollTol, 0, 1));
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
/* DOOR IV: THE THRESHOLD (a real door: press the glass to it and knock)  */
/* ===================================================================== */
const DR = { phase: 'none', prog: 0, lum: { center: 0, mean: 128 }, lt: 0, base: 0, assist: false, hb: 0, knocks: [], rings: [], lines: null, t0: 0 };
function knockIn(onGlass) {
  if (DR.phase !== 'knock') return;
  const now = performance.now(), prev = DR.knocks[DR.knocks.length - 1];
  if (prev && now - prev < 200) return;
  if (prev && now - prev > 2600) DR.knocks = [];             // too slow: the door forgets
  DR.knocks.push(now); DR.rings.push({ t: now, big: false });
  if (onGlass) audio.knock(0, .2);                           // a tap on the glass should sound like a knock
  buzz(12);
  if (DR.knocks.length >= 3) DR.phase = 'listen';
}
function drawDoorway(a) {
  if (a <= 0) return;
  const w = Math.min(W * .52, 240), h = H * .58, x = W / 2 - w / 2, y = H * .15;
  g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(227, 192, 122,' + a + ')'; g.lineWidth = 1.4; g.lineCap = 'round';
  g.shadowColor = 'rgba(255, 210, 140, .8)'; g.shadowBlur = 12;
  g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.stroke();
  g.beginPath(); g.arc(x + w - 18, y + h * .55, 3.5, 0, TAU); g.stroke();
  g.restore();
}
function drawDoor(now, dt) {
  if (now - DR.lt > 100) { DR.lt = now; DR.lum = luminance(); }
  const cx = W / 2, cy = H * .45, R = Math.min(W, H), m = DR.lum.mean;
  if (DR.phase === 'seek') {                                  // the lens goes dark when it's pressed flat against something
    const covered = (camOK && m < Math.max(6, Math.min(26, DR.base * .45))) || ((DR.assist || !camOK) && hold.on);
    if (!covered) DR.base = DR.base ? DR.base + (m - DR.base) * .03 : m;
    DR.prog = clamp(DR.prog + (covered ? dt / 2.2 : -dt * .7), 0, 1);
    if (DR.prog > .25 && now - DR.hb > 1100 - DR.prog * 400) { DR.hb = now; audio.heartbeat(); }
    if (DR.prog >= 1) DR.phase = 'pressed';
    drawDoorway((.2 + .16 * Math.sin(now / 700)) * (1 - DR.prog));
  }
  g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#E3C07A'; g.fillStyle = '#E3C07A'; g.shadowColor = 'rgba(255, 210, 140, .9)'; g.shadowBlur = 14;
  if (DR.phase === 'seek' || DR.phase === 'pressed') {
    for (let i = 0; i < 4; i++) { const k = (now / 1700 + i / 4) % 1; g.globalAlpha = (1 - k) * DR.prog * .6; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, 18 + k * R * .55, 0, TAU); g.stroke(); }
    if (DR.prog > 0) { g.globalAlpha = 1; g.lineWidth = 2.4; g.beginPath(); g.arc(cx, cy, R * .2, -Math.PI / 2, -Math.PI / 2 + TAU * DR.prog); g.stroke(); }
  }
  if (DR.phase === 'knock' || DR.phase === 'listen' || DR.phase === 'answer') {
    const n = DR.phase === 'knock' ? DR.knocks.length : 3;
    for (let i = 0; i < 3; i++) { g.globalAlpha = i < n ? 1 : .35; g.lineWidth = 1.2; g.beginPath(); g.arc(cx + (i - 1) * 24, cy + R * .3, 4.5, 0, TAU); if (i < n) g.fill(); else g.stroke(); }
    g.globalAlpha = .25 + .1 * Math.sin(now / 500); g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R * .2, 0, TAU); g.stroke();
  }
  DR.rings = DR.rings.filter(r => now - r.t < (r.big ? 1700 : 1000));
  for (const r of DR.rings) { const k = (now - r.t) / (r.big ? 1700 : 1000); g.globalAlpha = (1 - k) * (r.big ? .9 : .6); g.lineWidth = r.big ? 3 : 1.6; g.beginPath(); g.arc(cx, cy, 16 + ease(k) * R * (r.big ? .75 : .4), 0, TAU); g.stroke(); }
  g.restore();
  if (DR.phase === 'reveal') {
    if (DR.lines) drawLines(DR.lines, now, DR.t0, 1800); else drawDoorway(.9 * clamp((now - DR.t0) / 1500, 0, 1));
    const k = clamp((now - DR.t0 - 1300) / 1900, 0, 1);
    if (k > 0) drawMark(3, cx, H * .42, R * .42 * (1.25 - .25 * ease(k)), ease(k), 26);
  }
}

/* ===================================================================== */
/* DOOR V: THE GLASS (the camera turns around; your reflection stays)     */
/* ===================================================================== */
const ghost = $('ghost'), ghx = ghost.getContext('2d');
const MR = { armed: false, prog: 0, diff: 0, floor: 3, prev: null, mt: 0, still: false, shown: 0, frozen: false, moved: false, moveT: 0, markT: 0, buf: [], bi: 0, n: 0, need: 7, face: null };
function setupMirror() {
  const w = Math.round(W / 2), h = Math.round(H / 2);
  ghost.width = w; ghost.height = h; ghx.clearRect(0, 0, w, h);
  MR.buf = Array.from({ length: 14 }, () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
  Object.assign(MR, { armed: false, prog: 0, diff: 0, floor: 3, prev: null, mt: 0, still: false, shown: 0, frozen: false, moved: false, moveT: 0, markT: 0, bi: 0, n: 0, need: AUTO ? 2.2 : 7, face: null });
}
function sampleMirror(now) {                 // ten times a second: keep a frame for the late reflection, and measure movement
  if (now - MR.mt < 100) return; MR.mt = now;
  const r = coverRect(); if (!r) return;
  if (!MR.frozen) {
    const c = MR.buf[MR.bi]; c.getContext('2d').drawImage(srcEl(), r[0], r[1], r[2], r[3], 0, 0, c.width, c.height);
    MR.bi = (MR.bi + 1) % MR.buf.length; MR.n = Math.min(MR.buf.length, MR.n + 1);
    ghx.drawImage(MR.buf[MR.n < MR.buf.length ? 0 : MR.bi], 0, 0, ghost.width, ghost.height);   // the oldest frame, about 1.4 s late
  }
  const w = 32, h = Math.round(32 * H / W), d = grab(w, h); if (!d) return;
  const cur = new Float32Array(w * h); let mean = 0;
  for (let i = 0, j = 0; i < cur.length; i++, j += 4) { cur[i] = d.data[j] * .299 + d.data[j + 1] * .587 + d.data[j + 2] * .114; mean += cur[i]; }
  mean /= cur.length;
  for (let i = 0; i < cur.length; i++) cur[i] -= mean;      // ignore the camera re-exposing
  if (MR.prev && MR.prev.length === cur.length) {
    let s = 0; for (let i = 0; i < cur.length; i++) s += Math.abs(cur[i] - MR.prev[i]);
    MR.diff = s / cur.length; MR.floor = Math.min(MR.floor * 1.003 + .003, MR.diff);
  }
  MR.prev = cur;
}
function drawMirror(now, dt) {
  sampleMirror(now);
  const cx = W / 2, cy = H * .43, rx = Math.min(W * .36, 200), ry = rx * 1.34;
  let flick = 1;
  if (MR.armed && !MR.frozen) {
    MR.still = camOK ? MR.diff < Math.max(2.4, MR.floor * 2.2 + .8) : hold.on;
    const before = MR.prog;
    MR.prog = clamp(MR.prog + (MR.still ? dt / MR.need : -dt * .16), 0, 1);
    if (!MR.still) { flick = .3 + Math.random() * .45; if (MR.prog > 0) audio.glitch(.035); }
    for (let k = 1; k <= 4; k++) if (before < k / 4 && MR.prog >= k / 4 && MR.shown < k) { MR.shown = k; audio.bell([392, 440, 493.9, 587.3][k - 1], 0, .1, 3.2); buzz(25); }
  } else if (!MR.moved) {
    const moving = camOK ? MR.diff > Math.max(4, MR.floor * 3 + 2) : !hold.on;
    MR.moveT = moving ? MR.moveT + dt : 0;
    if (MR.moveT > .35) MR.moved = true;
  }
  g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = '#E3C07A'; g.lineCap = 'round';
  g.globalAlpha = .26 * flick; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke();
  if (MR.prog > 0) { g.globalAlpha = flick; g.lineWidth = 2.2; g.shadowColor = 'rgba(255, 210, 140, .95)'; g.shadowBlur = 16; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + TAU * MR.prog); g.stroke(); }
  g.restore();
  for (let k = 0; k < MR.shown; k++) { const a = -Math.PI / 2 + k * Math.PI / 2; drawMark(k, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 40, .95 * flick, 16); }
  if (MR.markT) drawMark(4, cx, cy - ry * .06, rx * 1.15, 1, 26, clamp((now - MR.markT) / 2600, 0, 1));
}

/* ===================================================================== */
/* AMBIENT MOTES, SPARKS + THE LOOP                                       */
/* ===================================================================== */
let scene = 'none', last = performance.now();
const motes = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), v: .004 + Math.random() * .012, r: .6 + Math.random() * 1.6, p: Math.random() * TAU }));
function drawMotes(now, dt) {
  if (scene === 'align') return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const m of motes) { m.y -= m.v * dt; if (m.y < -.02) { m.y = 1.02; m.x = Math.random(); } const a = .12 + .12 * Math.sin(now / 900 + m.p); g.fillStyle = 'rgba(255, 214, 150,' + a + ')'; g.beginPath(); g.arc(m.x * W + Math.sin(now / 2400 + m.p) * 8, m.y * H, m.r, 0, TAU); g.fill(); }
  g.restore();
}
const sparks = [];
function burst(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 40 + Math.random() * 170; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 1.4 + Math.random() * 1.8, t: 0, r: .8 + Math.random() * 1.8 }); } }
function drawSparks(dt) {
  if (!sparks.length) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.t += dt; if (s.t > s.life) { sparks.splice(i, 1); continue; }
    s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= .985; s.vy = s.vy * .985 - 8 * dt;
    g.fillStyle = 'rgba(255, 214, 150,' + (.8 * (1 - s.t / s.life)) + ')'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
  }
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
  else if (scene === 'door') drawDoor(now, dt);
  else if (scene === 'mirror') drawMirror(now, dt);
  drawSparks(dt);
  drawMotes(now, dt);
}
requestAnimationFrame(frame);

/* ===================================================================== */
/* PLAYER, NIGHTS, INVITATIONS                                            */
/* ===================================================================== */
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const check = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 36; return B36[h]; };
const inviteCode = () => { const b = P.num.toString(36); return b + check(b); };
function nextUnlock() { const d = new Date(); d.setHours(3, 3, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); return d.getTime(); }
const nightOpen = () => Date.now() >= (P.unlockAt || 0);
function untilText() { const tm = Math.max(1, Math.ceil((P.unlockAt - Date.now()) / 6e4)), h = Math.floor(tm / 60), m = tm % 60; return 'in ' + (h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min'); }
function complete(n) { if (P.nights < n) { P.nights = n; P.unlockAt = n < 3 ? nextUnlock() : 0; } saveP(); }
function loadState() {
  SETTINGS = Object.assign({ tilt: 1, sound: true }, store.get('settings', {}));
  P = Object.assign({ num: 5 + Math.floor(Math.random() * 995), name: '', nights: 0, unlockAt: 0, invitedBy: null, times: {}, choice: null }, store.get('player', {}));
  if (/^(auto2|shot[46])$/.test(MODE)) Object.assign(P, { nights: 1, unlockAt: 0, times: { maze: 95 } });
  if (/^(auto3|shot[578])$/.test(MODE)) Object.assign(P, { nights: 2, unlockAt: 0, times: { maze: 95 } });
  if (MODE === 'shotw') Object.assign(P, { nights: 1, unlockAt: Date.now() + 5.2 * 3.6e6 });
  if (MODE === 'unlock' && P.nights >= 1 && P.nights < 3) P.unlockAt = 0;
  const q = new URLSearchParams(location.search), c = (q.get('d') || '').toLowerCase().replace(/[^0-9a-z]/g, '');
  if (c.length >= 2 && check(c.slice(0, -1)) === c.slice(-1)) {                 // a door someone opened for this player
    const num = parseInt(c.slice(0, -1), 36);
    if (num !== P.num && !P.invitedBy) P.invitedBy = { num, name: (q.get('n') || '').replace(/[<>&"]/g, '').trim().slice(0, 20), t: clamp(parseInt(q.get('t'), 10) || 0, 0, 36000) };
  }
  saveP();
}
function inviteURL() {
  const base = NATIVE || !/^https?:$/.test(location.protocol) ? SITE : location.origin + location.pathname;
  const q = new URLSearchParams({ d: inviteCode() });
  if (P.name) q.set('n', P.name);
  if (P.times.maze) q.set('t', Math.round(P.times.maze));
  return base + '?' + q;
}
function forget() { P = { num: P.num, name: P.name, invitedBy: P.invitedBy, nights: 0, unlockAt: 0, times: {}, choice: null }; saveP(); cards.clear(); }

/* ===================================================================== */
/* SETTINGS, TOAST, SHARING                                               */
/* ===================================================================== */
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.tm); toast.tm = setTimeout(() => el.classList.remove('on'), 2600); }
function twice(btn, label, fn) { let armed = false; btn.onclick = () => { if (armed) return fn(); armed = true; btn.textContent = label; }; }
const isCancel = e => e && (e.name === 'AbortError' || /cancel/i.test(String(e.message || e)));
const gear = document.createElement('button'); gear.id = 'gear'; gear.type = 'button'; gear.hidden = true; gear.setAttribute('aria-label', 'Settings');
gear.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>';
document.body.appendChild(gear);
const showGear = on => { gear.hidden = !on; };
gear.onclick = () => {
  const s = document.createElement('div'); s.id = 'sheet';
  s.innerHTML = '<div class="pane"><p class="eyebrow">Player ' + P.num + '</p>' +
    '<label>Tilt sensitivity<input id="sTilt" type="range" min="0.5" max="1.8" step="0.05" value="' + SETTINGS.tilt + '"></label>' +
    '<label>Your name on invitations<input id="sName" type="text" maxlength="20" autocomplete="nickname" placeholder="Optional" value="' + esc(P.name) + '"></label>' +
    '<div class="row"><button class="go" id="sSound" type="button">Sound ' + (SETTINGS.sound ? 'on' : 'off') + '</button><button class="go danger" id="sReset" type="button">Erase progress</button></div>' +
    '<button class="go" id="sDone" type="button">Done</button></div>';
  document.body.appendChild(s);
  const close = () => { SETTINGS.tilt = +$('sTilt').value; P.name = $('sName').value.replace(/[<>&"]/g, '').trim().slice(0, 20); store.set('settings', SETTINGS); saveP(); s.remove(); };
  s.addEventListener('click', e => { if (e.target === s) close(); });
  $('sDone').onclick = close;
  $('sSound').onclick = () => { SETTINGS.sound = !SETTINGS.sound; audio.mute(!SETTINGS.sound); $('sSound').textContent = 'Sound ' + (SETTINGS.sound ? 'on' : 'off'); };
  twice($('sReset'), 'Tap again to erase', () => { forget(); location.replace(location.pathname); });
};
async function shareInvite() {
  const url = inviteURL(), text = 'A door was opened for you. Play at night. Alone, if you can.';
  try {
    if (NATIVE) { await NATIVE.shareText(text, url); return; }
    if (navigator.share) { await navigator.share({ text, url }); return; }
  } catch (e) { if (isCancel(e)) return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast('Invitation copied'); } catch (e) { toast(url); }
}
function grade(x, w, h) {                   // the same old-film look as the camera, baked into a picture
  x.save();
  x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgb(220, 190, 150)'; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(5, 4, 4, .45)'; x.fillRect(0, 0, w, h);
  x.restore();
}
function bakeCard(kind, lines, mark) {      // a small graded picture of this door, kept for sharing later
  try {
    const c = document.createElement('canvas'); c.width = 720; c.height = 1280; const x = c.getContext('2d');
    const s = Math.max(720 / W, 1280 / H), dw = W * s, dh = H * s, ox = (720 - dw) / 2, oy = (1280 - dh) / 2;
    const src = kind === 'glass' ? MR.face : still;
    x.fillStyle = '#050404'; x.fillRect(0, 0, 720, 1280);
    if (src && src.width) {
      x.save(); if (kind === 'glass' && document.body.classList.contains('selfie')) { x.translate(720, 0); x.scale(-1, 1); }
      x.drawImage(src, ox, oy, dw, dh); x.restore(); grade(x, 720, 1280);
    }
    if (lines) { x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .35; x.drawImage(lines, ox - 9, oy - 9, dw + 18, dh + 18); x.globalAlpha = 1; x.drawImage(lines, ox, oy, dw, dh); x.restore(); }
    if (mark != null) drawMark(mark, 360, oy + dh * .42, 250, 1, 24, 1, x);
    cards.set(kind, c.toDataURL('image/jpeg', .84));
  } catch (e) {}
}
function spaced(x, text, cx, y, sp) {       // letter-spaced text, the same in every browser
  const chars = [...text], ws = chars.map(ch => x.measureText(ch).width);
  let px = cx - (ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)) / 2;
  x.save(); x.textAlign = 'left'; chars.forEach((ch, i) => { x.fillText(ch, px, y); px += ws[i] + sp; }); x.restore();
}
function shareText(kind) {
  const n = 'PLAYER ' + P.num;
  if (kind === 'maze') return { line: 'My room became a maze.', sub: 'DOOR I · ' + fmtTime(P.times.maze || 0) + ' · ' + n };
  if (kind === 'door') return { line: 'I knocked. Something knocked back.', sub: 'DOOR IV · ' + n };
  return { line: P.choice === 'close' ? 'I let the last door close.' : 'I took her place.', sub: 'DOOR V · ' + n };
}
async function composeShare(kind) {         // the 1080 x 1920 picture people post
  try { await Promise.all(['500 60px "Cormorant Garamond"', 'italic 400 60px "Cormorant Garamond"', '400 30px "DM Mono"'].map(f => document.fonts.load(f))); } catch (e) {}
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d');
  x.fillStyle = '#050404'; x.fillRect(0, 0, 1080, 1920);
  const data = cards.get(kind), im = data && await loadImage(data);
  if (im) x.drawImage(im, 0, 0, 1080, 1920);
  const v = x.createRadialGradient(540, 860, 320, 540, 960, 1180); v.addColorStop(0, 'rgba(5,4,4,0)'); v.addColorStop(1, 'rgba(5,4,4,.94)'); x.fillStyle = v; x.fillRect(0, 0, 1080, 1920);
  const top = x.createLinearGradient(0, 0, 0, 420); top.addColorStop(0, 'rgba(5,4,4,.85)'); top.addColorStop(1, 'rgba(5,4,4,0)'); x.fillStyle = top; x.fillRect(0, 0, 1080, 420);
  const low = x.createLinearGradient(0, 1300, 0, 1920); low.addColorStop(0, 'rgba(5,4,4,0)'); low.addColorStop(.45, 'rgba(5,4,4,.84)'); low.addColorStop(1, 'rgba(5,4,4,.97)'); x.fillStyle = low; x.fillRect(0, 1300, 1080, 620);
  const t = shareText(kind), lit = [0, 3, 4, 5][P.nights] || 0;
  x.textAlign = 'center'; x.fillStyle = '#F2EAD9'; x.font = '500 92px "Cormorant Garamond", Georgia, serif'; spaced(x, 'THRESHOLD', 540, 240, 22);
  x.font = 'italic 400 64px "Cormorant Garamond", Georgia, serif'; x.fillText(t.line, 540, 1560);
  x.fillStyle = '#E3C07A'; x.font = '400 30px "DM Mono", monospace'; spaced(x, t.sub, 540, 1644, 6);
  for (let i = 0; i < 5; i++) drawMark(i, 540 + (i - 2) * 96, 1752, 64, i < lit ? 1 : .2, i < lit ? 12 : 0, 1, x);
  x.fillStyle = 'rgba(242, 234, 217, .55)'; x.font = '400 22px "DM Mono", monospace'; spaced(x, 'THE DOORS CHOOSE WHO THEY OPEN FOR', 540, 1862, 5);
  return c;
}
const prepared = {};                        // built ahead, so the share sheet opens straight from the tap
function prepareShare(kind) { return (prepared[kind] = composeShare(kind).then(c => new Promise(r => c.toBlob(b => r({ c, b }), 'image/png')))); }
async function shareCard(kind) {
  const { c, b } = await (prepared[kind] || prepareShare(kind)), text = shareText(kind).line + ' ' + inviteURL();
  try {
    if (NATIVE) { await NATIVE.shareImage(c.toDataURL('image/png'), text); return; }
    const file = new File([b], 'threshold.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'threshold-' + kind + '.png'; document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { if (!isCancel(e)) toast('Could not share'); }
}
async function remind() {                   // the app only: a quiet nudge in the evening, never at 3 AM
  const at = new Date(P.unlockAt); at.setHours(21, 3, 0, 0);
  const ok = await NATIVE.remind(at.getTime(), 'Threshold', 'The ' + (P.nights === 1 ? 'fourth' : 'last') + ' door is open. Play tonight, alone.').catch(() => false);
  toast(ok ? 'Reminder set for 9:03 PM' : 'Notifications are off');
}

/* ===================================================================== */
/* THE NIGHTS: splash, doors, interludes, endings                         */
/* ===================================================================== */
let shotHold = false;
const shot = async (name, ms) => { if (MODE === name) { await wait(ms); report(); shotHold = true; await new Promise(() => {}); } };
function reveal(container) { const ls = [...container.querySelectorAll('.line')], step = Math.min(900, 6400 / Math.max(1, ls.length)); ls.forEach((el, i) => setTimeout(() => el.classList.add('on'), (250 + i * step) * SPEED)); }
function clickWhenReady(id, onTap) { return new Promise(res => { const b = $(id); b.onclick = () => { b.onclick = null; if (onTap) onTap(); res(); }; if (AUTO) setTimeout(() => b.click(), 1600 * SPEED + 300); }); }
const SIGIL = '<svg class="sigil-big" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40"/><path d="M35 76 V46 A15 15 0 0 1 65 46 V76"/><line x1="12" y1="76" x2="88" y2="76"/><circle cx="50" cy="58" r="5"/></svg>';
function setSplash(eyebrow, lead, fines, button) {
  const col = $('splash').querySelector('.col');
  col.innerHTML = SIGIL + '<p class="eyebrow line">' + esc(eyebrow) + '</p><h1 class="title line">Threshold</h1><p class="lead line">' + esc(lead) + '</p>' +
    fines.map(f => '<p class="fine line">' + esc(f) + '</p>').join('') + '<button class="go line" id="begin" type="button">' + esc(button) + '</button>';
  $('splash').hidden = false; showGear(true); reveal(col);
}
const marksRow = n => '<div class="marks line">' + [0, 1, 2, 3, 4].map(i => markSVG(i, i >= n)).join('') + '</div>';
async function interlude(html, btn, shotName) {
  hud(false); instruct('');
  const s = $('interlude'), col = $('interCol');
  col.innerHTML = html + '<button class="go line" id="nextDoor" type="button">' + btn + '</button>';
  s.hidden = false; reveal(col); audio.breath(0, .03, 2.4, 2000);
  if (shotName) await shot(shotName, 2600);
  await clickWhenReady('nextDoor'); s.hidden = true;
}
function endScreen(html, buttons) {
  playing = false; hud(false); scene = 'none'; instruct(''); stopCamera(); ghost.className = '';
  document.body.classList.remove('selfie', 'dark');
  const col = $('endCol');
  col.innerHTML = html + '<div class="actions line">' + buttons.map(b => '<button class="' + (b.cls || 'go') + '" id="' + b.id + '" type="button">' + esc(b.label) + '</button>').join('') + '</div>';
  buttons.forEach(b => { if (b.twice) twice($(b.id), b.twice, b.fn); else $(b.id).onclick = b.fn; });
  $('interlude').hidden = true; $('splash').hidden = true; $('end').hidden = false; showGear(true); reveal(col); audio.drone(.08, 260, 3);
  for (const k of ['maze', 'door', 'glass']) if (cards.get(k)) prepareShare(k);
}
const replayNight1 = () => { try { sessionStorage.setItem('threshold:replay', '1'); } catch (e) {} location.reload(); };
function nightButtons() {
  const kind = P.nights === 1 ? 'maze' : 'door', b = [{ id: 'bInvite', label: 'Open a door for someone', fn: shareInvite }];
  if (cards.get(kind)) b.push({ id: 'bShare', label: P.nights === 1 ? 'Share your maze' : 'Share your door', fn: () => shareCard(kind), cls: 'go dim' });
  if (NATIVE) b.push({ id: 'bRemind', label: 'Tell me when it opens', fn: remind, cls: 'go dim' });
  b.push({ id: 'bReplay', label: 'Play the first night again', fn: replayNight1, cls: 'ghost' });
  return b;
}
function tickCount() {                      // the countdown, and the door opening while the screen is up
  clearInterval(tickCount.iv);
  tickCount.iv = setInterval(() => { if (nightOpen()) { clearInterval(tickCount.iv); location.reload(); } else if ($('count')) $('count').textContent = untilText(); }, 15000);
}
const countdown = () => '<p class="count line" id="count">' + untilText() + '</p>';
function ending1() {
  endScreen('<p class="eyebrow line">Three of five</p><p class="lead line">Three doors in one night.</p>' +
    '<p class="lead line">' + (lastMaze < 660 ? 'You are faster than she was.' : 'She was faster. She had more nights.') + '</p>' + marksRow(3) +
    '<p class="fine line">The fourth door opens at 3:03 AM.</p>' + countdown() +
    '<p class="fine line">Don’t tell anyone about the doors. If you must, open one for a single person.</p>', nightButtons());
  tickCount();
}
function ending2() {
  endScreen('<p class="eyebrow line">Four of five</p><p class="lead line">Something knows where your door is now.</p>' + marksRow(4) +
    '<p class="fine line">The last door opens at 3:03 AM.</p>' + countdown() + '<p class="fine line">Come alone. Bring nothing but the glass.</p>', nightButtons());
  tickCount();
}
function waiting() {
  const n = P.nights;
  endScreen('<p class="eyebrow line">' + (n === 1 ? 'Three' : 'Four') + ' of five</p><p class="lead line">The ' + (n === 1 ? 'fourth' : 'last') + ' door is still closed.</p>' +
    marksRow(n === 1 ? 3 : 4) + '<p class="fine line">It opens at 3:03 AM.</p>' + countdown(), nightButtons());
  tickCount();
}
function finale() {
  const stay = P.choice !== 'close';
  endScreen('<p class="eyebrow line">Five of five</p>' +
    (stay ? '<p class="lead line">You took her place.</p><p class="fine line">At 3:07 AM, a girl walked out of an empty church in Valparaíso. She asked what year it was.</p>'
      : '<p class="lead line">You let the last door close.</p><p class="fine line">In an empty church in Valparaíso, a phone lit up on the floor. Then it went dark.</p>') +
    marksRow(5) + '<p class="fine line">' + (stay ? 'You are behind the glass now. The doors open for whoever you choose.' : 'Lena is still behind the glass. The doors will look for someone braver.') + '</p>',
    [{ id: 'bInvite', label: stay ? 'Open a door for someone' : 'Find someone braver', fn: shareInvite },
      ...(cards.get('glass') ? [{ id: 'bShare', label: 'Share what you saw', fn: () => shareCard('glass'), cls: 'go dim' }] : []),
      { id: 'bAgain', label: 'Begin again', fn: () => { forget(); location.replace(location.pathname); }, cls: 'ghost', twice: 'Tap again to forget everything' }]);
}

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
  lastMaze = secs; if (!P.times.maze || secs < P.times.maze) { P.times.maze = Math.round(secs); saveP(); }
  bakeCard('maze', MZ.wc);
  await wait(1500 * SPEED); unfreeze(); scene = 'none'; $('timer').textContent = '';
  const lines = ['It took Player Four eleven minutes.', 'You took ' + fmtTime(secs) + '.'], by = P.invitedBy;
  if (by && by.t) lines.push((by.name || 'Player ' + by.num) + ' took ' + fmtTime(by.t) + '.');
  await say(lines);
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
  L.phase = 'light'; L.prog = 0; L.doneLight = false; L.assist = false; scene = 'light';
  instruct(camOK ? 'Hold the light inside the circle.' : 'Press and hold to look at the light.');
  let help = setTimeout(() => { L.assist = true; instruct('Point at a lamp or a window.', 'Or hold your finger on the screen'); }, 35000);
  if (AUTO) override = { center: 240, mean: 120 };
  await shot('shot2', 1500);
  await until(() => L.doneLight); clearTimeout(help);
  audio.chord(); buzz(40); scene = 'none'; override = null;
  await say(['It saw you.', 'Now close its eye.']);
  L.phase = 'dark'; L.prog = 0; L.doneDark = false; L.assist = false; document.body.classList.add('dark'); scene = 'light';
  instruct(camOK ? 'Cover the camera with your hand.' : 'Press and hold to close the eye.');
  help = setTimeout(() => { L.assist = true; instruct('Cover the lens completely.', 'Or hold your finger on the screen'); }, 30000);
  if (AUTO) override = { center: 4, mean: 6 };
  await until(() => L.doneDark); clearTimeout(help);
  instruct(''); audio.heartbeat(); await wait(2600 * SPEED); audio.heartbeat(); await wait(1400 * SPEED);
  document.body.classList.remove('dark'); override = null; scene = 'none';
  await say(['Most people are afraid of the dark part.', 'You weren’t.']);
}
async function door3() {
  hud(true, 'Door III · The Alignment'); scene = 'none';
  await say(['Something is scattered around you.', 'Turn slowly. When the pieces become one, stop.']);
  setupAlign(); scene = 'align';
  instruct(sensor.has ? 'Turn slowly until the pieces meet.' : 'Drag to look around until the pieces meet.');
  const help = setTimeout(() => { AL.easy = true; }, 50000);
  await shot('shot3', 2200);
  await until(() => AL.locked); clearTimeout(help);
  instruct(''); audio.open(); buzz([40, 40, 80]);
  await wait(2400 * SPEED); scene = 'none';
  await say(['That is the third mark.', 'Keep it.']);
}
async function door4() {
  hud(true, 'Door IV · The Threshold'); scene = 'none'; unfreeze();
  await say(['The fourth door is a real one.', 'Find a door near you. One that closes.']);
  Object.assign(DR, { phase: 'seek', prog: 0, base: 0, assist: false, hb: 0, knocks: [], rings: [], lines: null });
  scene = 'door';
  let steps = 0, told = false;
  MO.onStep = () => { steps++; audio.step(.17 + Math.random() * .05, .09, (Math.random() - .5) * .7); };   // something walks with you
  instruct('Walk to it. Slowly.');
  const t0 = performance.now();
  if (AUTO) setTimeout(() => { override = { center: 3, mean: 3 }; }, 1400 * SPEED + 400);
  await until(() => {
    const t = performance.now() - t0;
    if (!told && (t > 7000 * SPEED || steps >= 8)) { told = true; instruct(camOK ? 'Press the glass flat against the door.' : 'Press and hold the screen.'); }
    if (!DR.assist && t > 32000) { DR.assist = true; instruct('Press the glass against the door.', 'And keep your hand on the screen'); }
    return DR.phase === 'pressed';
  });
  MO.onStep = null; audio.drone(.06, 200, 1.2); buzz(30);
  DR.phase = 'knock'; DR.knocks = [];
  instruct('Knock three times.', 'On the door, or on the glass');
  MO.onKnock = () => knockIn(false); tapHook = () => knockIn(true);
  if (AUTO) [500, 1100, 1700].forEach((ms, i) => setTimeout(() => { if (MODE !== 'shot4' || i === 0) knockIn(true); }, ms));
  await shot('shot4', 2400);
  await until(() => DR.phase === 'listen');
  MO.onKnock = null; tapHook = null; instruct('');
  audio.duck(.05, .5);                                       // everything goes quiet
  await wait(2600);
  DR.phase = 'answer'; audio.duck(1, .15);
  for (let i = 0; i < 3; i++) {                              // three knocks from the other side
    audio.knock(0, .9, .9); buzz(70); DR.rings.push({ t: performance.now(), big: true }); quake();
    await wait(720);
  }
  await wait(1400);
  override = null;
  await say(['Someone knocked back.']);
  instruct('Step back. Look at the door.');
  DR.phase = 'back';
  const tb = performance.now(); let seen = 0;
  await until(() => { seen = DR.lum.mean > Math.max(16, DR.base * .55) ? seen + 1 : 0; return seen > 8 || performance.now() - tb > 9000; });
  instruct('');
  freeze(); DR.lines = DR.lum.mean > 18 ? traceLines() : null; DR.t0 = performance.now(); DR.phase = 'reveal';
  audio.bell(164.8, 0, .12, 3.6); audio.breath(.2, .03, 2.2, 1600);
  await wait(3400 * Math.max(SPEED, .5));
  audio.open(); buzz([40, 40, 80]); bakeCard('door', DR.lines, 3);
  await wait(2600 * SPEED);
  unfreeze(); scene = 'none'; DR.phase = 'none';
  await say(['That is the fourth mark.', 'Lena heard the knocks too.', 'She thought they came from the other side of the door.']);
}
function quake() { document.body.classList.remove('quake'); void document.body.offsetWidth; document.body.classList.add('quake'); }
async function door5() {
  hud(true, 'Door V · The Glass'); scene = 'none'; unfreeze();
  await say(['The last door was never in your room.', 'Turn the glass toward yourself.']);
  document.body.classList.add('blink'); await wait(450);    // the glass turns around
  await startCamera('user');
  setupMirror(); scene = 'mirror'; ghost.className = 'on';
  await wait(600); document.body.classList.remove('blink');
  await say(['Behind the last door is whoever made them.']);
  instruct(camOK ? 'Hold still. Look into the glass.' : 'Press and hold. Don’t let go.'); MR.armed = true;
  await shot('shot5', 1500);
  await until(() => MR.prog >= 1);
  instruct(''); audio.duck(0, .3); buzz(60);                 // everything stops
  await wait(1600 * Math.max(SPEED, .4));
  MR.frozen = true; MR.face = MR.buf[(MR.bi + MR.buf.length - 1) % MR.buf.length];
  ghx.drawImage(MR.face, 0, 0, ghost.width, ghost.height); ghost.className = 'frozen';
  audio.duck(1, 1.4); audio.bell(110, 0, .14, 5); audio.breath(.1, .04, 3, 900);
  await wait(1000 * Math.max(SPEED, .5));
  instruct(camOK ? 'Now move.' : 'Now let go.');
  if (AUTO) setTimeout(() => { MR.moved = true; }, 900);
  const tm = performance.now();
  await until(() => MR.moved || performance.now() - tm > 7000);
  instruct('');
  await wait(1500 * Math.max(SPEED, .5));                    // it stayed
  MR.markT = performance.now(); audio.open(); buzz([40, 40, 80]);
  await wait(2900 * Math.max(SPEED, .4));
  bakeCard('glass', null, 4);
  ghost.className = 'gone'; burst(W / 2, H * .4, 80);
  await wait(3000 * Math.max(SPEED, .4));
  scene = 'none'; MR.markT = 0;
  await say(['For a moment, it was you.']);
}
function choose() {
  return new Promise(res => {
    hud(false); instruct('');
    const s = $('interlude'), col = $('interCol');
    col.innerHTML = '<p class="eyebrow line">Player Four</p>' +
      '<p class="lead line">“Someone has to stay behind the glass, or the doors can’t open.”</p>' +
      '<p class="fine line">“I stayed for three years. I made the doors so someone would find me. I chose you, because you weren’t afraid of the dark part.”</p>' +
      '<p class="lead line">“Take my place, and I can go home. Or let the door close, and I stay.”</p>' +
      '<div class="actions line"><button class="go" id="cStay" type="button">Take her place</button><button class="go dim" id="cClose" type="button">Let it close</button></div>';
    s.hidden = false; reveal(col); audio.breath(0, .03, 2.4, 1600);
    $('cStay').onclick = () => { s.hidden = true; res('stay'); };
    $('cClose').onclick = () => { s.hidden = true; res('close'); };
    if (AUTO && MODE !== 'shot8') setTimeout(() => $('cStay').click(), 2400 * SPEED + 400);
  });
}
function beginTap() {                       // nights two and three: one tap starts sound, motion and camera
  return new Promise(res => {
    $('begin').onclick = async () => {
      $('begin').onclick = null;
      audio.start(); audio.droneOn(); keepAwake(); showGear(false);
      const m = startMotion(), c = startCamera('environment');
      $('splash').hidden = true; playing = true;
      await Promise.all([m, c]); res();
    };
    if (AUTO) setTimeout(() => $('begin').click(), 1600 * SPEED + 300);
  });
}
const finish = kind => { report(); if (AUTO) composeShare(kind).then(c => { window.__cardData = c.toDataURL('image/png'); }); };
async function night1() {
  const by = P.invitedBy;
  setSplash(by ? 'A door was opened for you' : 'A game that finds you', by ? (by.name || 'Player ' + by.num) + ' chose you.' : 'You weren’t supposed to find this.',
    ['There are five doors. They only appear through glass. Behind the last one is whoever made them.', 'Play at night. Alone, if you can. Sound on.'], 'Open the first door');
  await clickWhenReady('begin', () => { audio.start(); audio.droneOn(); keepAwake(); });
  showGear(false); $('splash').hidden = true; $('perm').hidden = false;
  await new Promise(res => {
    $('allow').onclick = async () => {
      $('allow').onclick = null;
      const motion = startMotion(), camera = startCamera();       // must start inside the tap for iOS to ask
      const [, c] = await Promise.all([motion, camera]);
      if (!c) { $('permNote').hidden = false; $('permNote').textContent = 'No camera, so the doors will use a photograph of a room instead.'; await wait(2200 * SPEED); }
      res();
    };
    if (AUTO) setTimeout(() => $('allow').click(), 600);
  });
  $('perm').hidden = true; playing = true;
  await door1();
  await interlude('<p class="eyebrow line">Player Four</p><p class="lead line">Lena Ostrova was the first to reach the fifth door.</p>' +
    '<p class="fine line">She was nineteen. She played every night at 3 AM, in the bathroom, with the lights off.</p>' +
    '<p class="fine line">They found her phone on the floor of an empty church in Valparaíso, screen still on, camera still open.</p><p class="lead line">Nobody found Lena.</p>', 'Open the second door');
  await door2();
  await interlude('<p class="eyebrow line">Her last message</p><p class="lead line">“The doors are not a game. They are a map.”</p>' +
    '<p class="fine line">She sent it to a number that no longer exists. The reply came anyway.</p><p class="lead line">“Then follow it.”</p>', 'Open the third door');
  await door3();
  complete(1);
  if (P.nights === 1) ending1(); else if (!nightOpen()) waiting(); else return location.reload();   // a replay after night two
  finish('maze');
}
async function night2() {
  setSplash('Night two', 'The fourth door is open.', ['It opened at 3:03 AM. It has been waiting for you.', 'Find a quiet place with a door that closes. Sound on.'], 'I’m alone');
  await beginTap();
  await interlude('<p class="eyebrow line">Night two</p><p class="lead line">Lena kept a note on her phone. It was called “Doors”.</p>' +
    '<p class="note line">1. Every room hides a maze.\n2. The light looks back.\n3. Turn slowly. Stop when it’s whole.\n4. Find a door that closes. Knock.\n5.</p>' +
    '<p class="fine line">The fifth line was empty.</p>', 'Open the fourth door', 'shot6');
  await door4();
  complete(2); ending2(); finish('door');
}
async function night3() {
  setSplash('Night three', 'The last door is open.', ['Behind it is whoever made them.', 'Alone. Sound on. Somewhere you can see your own face.'], 'I’m alone');
  await beginTap();
  await interlude('<p class="eyebrow line">Her last messages</p><div class="msgs line">' +
    [['03:03', 'I knocked.'], ['03:03', 'Something knocked back.'], ['03:04', 'It isn’t behind the door.'], ['03:04', 'It’s behind the glass.'], ['03:05', 'It has my face.']]
      .map(([t, m]) => '<p><time>' + t + '</time><span>' + m + '</span></p>').join('') + '</div><p class="fine line">Then nothing.</p>', 'Open the last door', 'shot7');
  await door5();
  P.choice = await choose(); complete(3); finale(); finish('glass');
}

/* ===================================================================== */
/* SELF-TEST (#auto, #auto2, #auto3 play a night; #shot1-8 stop on a screen) */
/* ===================================================================== */
let report = () => {};
if (AUTO) {
  const out = document.createElement('pre'); out.id = 'selftest'; out.hidden = true; document.body.appendChild(out);
  const errors = [];
  addEventListener('error', e => errors.push(String(e.message))); addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
  report = () => { out.textContent = JSON.stringify({ mode: MODE, scene, camOK, nights: P && P.nights, choice: P && P.choice, ended: !$('end').hidden,
    maze: MZ && { len: MZ.len, path: MZ.path.length }, align: AL.locked, door: { phase: DR.phase, knocks: DR.knocks.length, lines: !!DR.lines },
    glass: { prog: +MR.prog.toFixed(2), frozen: MR.frozen, moved: MR.moved }, cards: ['maze', 'door', 'glass'].filter(k => cards.get(k)), errors }); };
  setInterval(report, 500);
  window.__card = () => window.__cardData || '';
}

async function boot() {
  if (NATIVE) { try { await NATIVE.restore(['threshold:player', 'threshold:settings']); } catch (e) {} }
  loadState(); audio.mute(!SETTINGS.sound);
  if (NATIVE) NATIVE.ready();
  let replay = false; try { replay = sessionStorage.getItem('threshold:replay') === '1'; sessionStorage.removeItem('threshold:replay'); } catch (e) {}
  if (replay || P.nights === 0) return night1();
  if (P.nights >= 3) return finale();
  if (!nightOpen()) return waiting();
  return P.nights === 1 ? night2() : night3();
}
boot();
})();

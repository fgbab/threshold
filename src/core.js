/* Threshold core: helpers, saved state, sound and voice, the camera and what it sees, motion, the microphone, touch,
   narration, the marks and the math of the AR view. Mutable state shared between modules lives in S. */

export const $ = id => document.getElementById(id);
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const until = async fn => { while (!fn()) await wait(50); };
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const TAU = Math.PI * 2, DEG = Math.PI / 180;
export const wrapPi = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];

/* modes: '' | 'demo' (a photo instead of the camera) | 'unlock' (open the next door now) | 'door=N' (play door N now)
   self-tests: 'auto' or 'auto=N' plays a door by itself; 'shot=N.K' stops on objective K of door N;
   'shotw' (waiting), 'shote' (her phone), 'shotc' (a call), 'shots' (a scare), 'shotm' (the splash) stop on one screen */
export const MODE = decodeURIComponent(location.hash.slice(1));
const mAuto = MODE.match(/^auto(?:=(\d+)(?:\.(\d+))?)?$/), mShot = MODE.match(/^shot=(\d+)\.(\d+)$/), mJump = MODE.match(/^door=(\d+)$/);
export const TEST = { door: mAuto ? +(mAuto[1] || 1) : mShot ? +mShot[1] : 0, obj: mShot ? +mShot[2] : 0, start: mAuto && mAuto[2] ? +mAuto[2] : mShot ? +mShot[2] : 0, screen: (MODE.match(/^shot([wecsm])$/) || [])[1] || '' };
export const AUTO = !!(mAuto || mShot || TEST.screen);
export const JUMP = mJump ? clamp(+mJump[1], 1, 13) : 0;
export const SPEED = AUTO ? .12 : 1;              // narration pace
export const NATIVE = window.TH_NATIVE || null;   // the iPhone app's bridge (native.js); null on the web
export const SITE = 'https://fgbab.github.io/threshold/';

/* everything other modules may change */
export const S = {
  P: null, SETTINGS: { tilt: 1, sound: true },
  playing: false,            // a door is open: sample the camera, allow haunting
  stage: null,               // what the current objective draws each frame: { draw(now, dt) }
  easy: 0,                   // how much help the current objective has given (hints)
  evOpen: false,             // her phone is open over the game
  shotHold: false,           // a self-test screenshot is holding the action still
  tapHook: null,             // what a tap on the view does right now
  override: null             // self-test: pretend the world looks like { lum, diff, color, face, mic, pitch }
};

const memory = {};                                 // the self-test never touches real progress
export const store = {
  get(k, d) { try { const v = AUTO ? memory[k] : localStorage.getItem('threshold:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) {
    const s = JSON.stringify(v);
    if (AUTO) { memory[k] = s; return; }
    try { localStorage.setItem('threshold:' + k, s); } catch (e) {}
    if (NATIVE) NATIVE.save('threshold:' + k, s);   // the app also keeps a copy that iOS won't clear
  }
};
export const CARD_KINDS = ['room', 'maze', 'door', 'glass'];
export const cards = {                             // small pictures of the doors, kept for sharing and for her phone
  get(k) { try { return AUTO ? memory['card-' + k] : localStorage.getItem('threshold:card-' + k); } catch (e) { return null; } },
  set(k, v) { try { if (AUTO) memory['card-' + k] = v; else localStorage.setItem('threshold:card-' + k, v); } catch (e) {} },
  clear() { for (const k of CARD_KINDS) { delete memory['card-' + k]; try { localStorage.removeItem('threshold:card-' + k); } catch (e) {} } }
};
export const saveP = () => store.set('player', S.P);
export function seeded(n) {                        // the same "random" for this player every time, so codes differ between players
  let a = ((S.P ? S.P.num : 1) * 7919 + n * 104729) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ===================================================================== */
/* THE 2D LAYER: lines, numbers and words, composited into the 3D view     */
/* ===================================================================== */
export const fx = document.createElement('canvas'), g = fx.getContext('2d');
export let W = 0, H = 0, DPR = 1, PR = 1;          // PR: the 2D layer's own pixel ratio, kept low so it uploads fast
function resize() { W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2); PR = Math.min(devicePixelRatio || 1, 1.5); fx.width = Math.round(W * PR); fx.height = Math.round(H * PR); g.setTransform(PR, 0, 0, PR, 0, 0); }
addEventListener('resize', resize); resize();

/* ===================================================================== */
/* SOUND: all synthesized                                                 */
/* ===================================================================== */
export const audio = (() => {
  let ac = null, master = null, drone = null, hall = null, masterLevel = .8;
  const beds = {};
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
  const out = pan => { if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(master); return p; } return master; };
  function hallway() {                      // a long dark room, for whatever answers from the other side
    if (hall) return hall;
    const len = Math.ceil(ac.sampleRate * 2.8), b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = b.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
    hall = ac.createConvolver(); hall.buffer = b; hall.connect(master); return hall;
  }
  function bell(f, t0 = 0, vol = .1, dur = 2.8, pan = 0) {
    if (!ctx()) return; const t = ac.currentTime + t0;
    const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), o = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f * 2.76;
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(1, t + dur);
    mod.connect(mg).connect(car.frequency);
    o.gain.setValueAtTime(.0001, t); o.gain.exponentialRampToValueAtTime(vol, t + .012); o.gain.exponentialRampToValueAtTime(.0001, t + dur);
    car.connect(o).connect(out(pan)); car.start(t); mod.start(t); car.stop(t + dur + .1); mod.stop(t + dur + .1);
  }
  function breath(t0 = 0, vol = .04, dur = 1.6, freq = 2800, pan = 0) {
    if (!ctx()) return; const t = ac.currentTime + t0;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), o = ac.createGain();
    s.buffer = noise(dur); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2.2;
    o.gain.setValueAtTime(.0001, t); o.gain.linearRampToValueAtTime(vol, t + dur * .4); o.gain.linearRampToValueAtTime(.0001, t + dur);
    s.connect(f).connect(o).connect(out(pan)); s.start(t);
  }
  function thump(t0 = 0, vol = .4) {
    if (!ctx()) return; const t = ac.currentTime + t0, o = ac.createOscillator(), og = ac.createGain();
    o.frequency.setValueAtTime(72, t); o.frequency.exponentialRampToValueAtTime(38, t + .25);
    og.gain.setValueAtTime(vol, t); og.gain.exponentialRampToValueAtTime(.0001, t + .32); o.connect(og).connect(master); o.start(t); o.stop(t + .36);
  }
  let lastTick = 0;
  function tick(vol = .04) {
    if (!ctx()) return; const now = performance.now(); if (now - lastTick < 90) return; lastTick = now;
    const t = ac.currentTime, o = ac.createOscillator(), og = ac.createGain(); o.type = 'triangle'; o.frequency.value = 1700 + Math.random() * 500;
    og.gain.setValueAtTime(vol, t); og.gain.exponentialRampToValueAtTime(.0001, t + .05); o.connect(og).connect(master); o.start(t); o.stop(t + .06);
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
    s.connect(f).connect(sg).connect(out(pan)); s.start(t); thump(t0, vol * 1.3);
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
  function tap(t0 = 0, vol = .25) {          // a fingertip on the lens
    if (!ctx()) return; const t = ac.currentTime + t0;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), sg = ac.createGain();
    s.buffer = noise(.03); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 2;
    sg.gain.setValueAtTime(vol, t); sg.gain.exponentialRampToValueAtTime(.0001, t + .03);
    s.connect(f).connect(sg).connect(master); s.start(t);
    const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = 1150;
    og.gain.setValueAtTime(vol * .25, t); og.gain.exponentialRampToValueAtTime(.0001, t + .06); o.connect(og).connect(master); o.start(t); o.stop(t + .07);
  }
  function whisper(t0 = 0, dur = 1.6, vol = .05, pan = 0) {   // syllables nobody can quite make out
    if (!ctx()) return; let t = ac.currentTime + t0; const end = t + dur, o = ac.createGain(); o.gain.value = vol; o.connect(out(pan));
    while (t < end) {
      const d = .09 + Math.random() * .16, s = ac.createBufferSource(), f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), sg = ac.createGain();
      s.buffer = noise(d); f1.type = f2.type = 'bandpass'; f1.frequency.value = 400 + Math.random() * 600; f1.Q.value = 6; f2.frequency.value = 1300 + Math.random() * 1500; f2.Q.value = 8;
      sg.gain.setValueAtTime(.0001, t); sg.gain.linearRampToValueAtTime(1, t + d * .3); sg.gain.linearRampToValueAtTime(.0001, t + d);
      s.connect(f1).connect(sg); s.connect(f2).connect(sg); sg.connect(o); s.start(t);
      t += d + (Math.random() < .25 ? .15 + Math.random() * .2 : .02);
    }
  }
  function shriek(vol = .3) {
    if (!ctx()) return; const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), sg = ac.createGain();
    s.buffer = noise(.5); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(3200, t + .35);
    sg.gain.setValueAtTime(vol, t); sg.gain.exponentialRampToValueAtTime(.0001, t + .5); s.connect(f).connect(sg).connect(master); s.start(t);
    [880, 933, 1244].forEach((fr, i) => {
      const o = ac.createOscillator(), og = ac.createGain(), v = ac.createOscillator(), vg = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = fr; v.frequency.value = 23 + i * 7; vg.gain.value = 40; v.connect(vg).connect(o.frequency);
      og.gain.setValueAtTime(vol * .12, t); og.gain.exponentialRampToValueAtTime(.0001, t + .45); o.connect(og).connect(master); o.start(t); v.start(t); o.stop(t + .5); v.stop(t + .5);
    });
    thump(0, .5);
  }
  function toll(t0 = 0, vol = .16) {         // a church bell, far away
    if (!ctx()) return; const t = ac.currentTime + t0;
    [[110, 1], [220.5, .5], [264, .35], [330.7, .25], [440.2, .18], [587, .1]].forEach(([f, a]) => {
      const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = f;
      og.gain.setValueAtTime(.0001, t); og.gain.exponentialRampToValueAtTime(vol * a, t + .02); og.gain.exponentialRampToValueAtTime(.0001, t + 5.5);
      o.connect(og); og.connect(master); og.connect(hallway()); o.start(t); o.stop(t + 5.6);
    });
  }
  function creak(t0 = 0, vol = .08, dur = 1.6) {   // a door on old hinges
    if (!ctx()) return; const t = ac.currentTime + t0, o = ac.createOscillator(), f = ac.createBiquadFilter(), og = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(190, t + dur);
    lfo.frequency.value = 23; lg.gain.value = 30; lfo.connect(lg).connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 6;
    og.gain.setValueAtTime(.0001, t); og.gain.linearRampToValueAtTime(vol, t + .2); og.gain.linearRampToValueAtTime(vol * .6, t + dur * .8); og.gain.linearRampToValueAtTime(.0001, t + dur);
    o.connect(f).connect(og).connect(master); o.start(t); lfo.start(t); o.stop(t + dur + .05); lfo.stop(t + dur + .05);
  }
  const loopN = () => { const s = ac.createBufferSource(); s.buffer = noise(2); s.loop = true; s.start(); return s; };
  const filt = (type, freq, q) => { const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
  const flutter = (rate, depth) => { const am = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = rate; lg.gain.value = depth; am.gain.value = 1 - depth; lfo.connect(lg).connect(am.gain); lfo.start(); return { am, lfo }; };
  const BEDS = {                              // continuous sounds that fade in and out
    whisper: () => { const n = loopN(), f = filt('bandpass', 1700, 4), fl = flutter(5.5, .5); n.connect(f).connect(fl.am); return { src: [n, fl.lfo], out: fl.am }; },
    static: () => { const n = loopN(), f = filt('bandpass', 1800, .6); n.connect(f); return { src: [n], out: f }; },
    sea: () => { const n = loopN(), f = filt('lowpass', 520, .7), fl = flutter(.11, .45); n.connect(f).connect(fl.am); return { src: [n, fl.lfo], out: fl.am }; },
    rumble: () => { const n = loopN(), f = filt('lowpass', 150, 1); n.connect(f); return { src: [n], out: f }; }
  };
  function bed(name, level) {
    if (!ctx()) return;
    const b = beds[name];
    if (level == null) { if (b) { delete beds[name]; b.g.gain.setTargetAtTime(0, ac.currentTime, .2); setTimeout(() => b.src.forEach(s => { try { s.stop(); } catch (e) {} }), 1200); } return; }
    if (!b) { const made = BEDS[name](), gn = ac.createGain(); gn.gain.value = 0; made.out.connect(gn).connect(master); beds[name] = { src: made.src, g: gn }; }
    beds[name].g.gain.setTargetAtTime(Math.max(0, level), ac.currentTime, .15);
  }
  return {
    start: ctx, context: () => ctx(),
    droneOn() {
      if (!ctx() || drone) return;
      const o = ac.createGain(); o.gain.value = 0; o.gain.linearRampToValueAtTime(.14, ac.currentTime + 5); o.connect(master);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 3; f.connect(o);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .06; lg.gain.value = 160; lfo.connect(lg).connect(f.frequency); lfo.start();
      [55, 55.4, 82.4, 110.3].forEach((fr, i) => { const os = ac.createOscillator(); os.type = i < 2 ? 'sawtooth' : 'sine'; os.frequency.value = fr; const og = ac.createGain(); og.gain.value = i < 2 ? .2 : .1; os.connect(og).connect(f); os.start(); });
      drone = { o, f };
    },
    drone(level, bright, t = 1.6) { if (!drone) return; drone.o.gain.linearRampToValueAtTime(level, ac.currentTime + t); if (bright) drone.f.frequency.linearRampToValueAtTime(bright, ac.currentTime + t); },
    duck(to, t = .4) { if (!ac) return; const p = master.gain, n = ac.currentTime; p.cancelScheduledValues(n); p.setValueAtTime(p.value, n); p.linearRampToValueAtTime(Math.max(.0001, to * masterLevel), n + t); },
    mute(on) { masterLevel = on ? 0 : .8; if (master) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.value = masterLevel; } },
    bell, breath, thump, tick, knock, step, glitch, tap, whisper, shriek, toll, creak, bed,
    quiet() { Object.keys(beds).forEach(k => bed(k, null)); },
    chord() { [440, 554.4, 659.3, 880].forEach((f, i) => bell(f, i * .13, .08, 3.4)); },
    open() { [329.6, 392, 493.9, 659.3, 987.8].forEach((f, i) => bell(f, i * .17, .09, 4)); breath(.25, .035, 2.4, 2000); },
    heartbeat() { thump(0, .45); thump(.27, .32); },
    ring() { bell(659.3, 0, .07, 1.1); bell(523.3, .22, .07, 1.1); bell(659.3, .44, .06, 1.1); },
    box(notes, t0 = 0, gap = .55) { notes.forEach((f, i) => bell(f, t0 + i * gap, .07, 2.2)); return notes.length * gap + 1.6; }
  };
})();
export const voice = (() => {                // the phone's own speech, slowed and lowered; captions always show the words too
  const ok = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  let unlocked = false;
  return {
    unlock() { if (!ok || unlocked || AUTO) return; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); unlocked = true; } catch (e) {} },
    say(text, o = {}) {
      return new Promise(res => {
        if (!ok || AUTO || !S.SETTINGS.sound) return setTimeout(res, AUTO ? 120 : 700 + text.length * 60);
        try {
          const u = new SpeechSynthesisUtterance(text); u.rate = o.rate || .6; u.pitch = o.pitch == null ? .1 : o.pitch; u.volume = o.volume || .9;
          const v = speechSynthesis.getVoices().find(x => /^en/i.test(x.lang)); if (v) u.voice = v;
          let done = false; const fin = () => { if (!done) { done = true; res(); } };
          u.onend = fin; u.onerror = fin; setTimeout(fin, 1500 + text.length * 180); speechSynthesis.speak(u);
        } catch (e) { res(); }
      });
    }
  };
})();
export function buzz(p) {                  // haptics: the app's engine on iPhone, vibration on Android browsers
  try {
    if (NATIVE) { let t = 0; (Array.isArray(p) ? p : [p]).forEach((d, i) => { if (i % 2 === 0) setTimeout(() => NATIVE.impact(d >= 60 ? 'heavy' : d >= 25 ? 'medium' : 'light'), t); t += d; }); return; }
    if (navigator.vibrate) navigator.vibrate(p);
  } catch (e) {}
}
let wake = null;                           // keep the screen on while a door is open
export async function keepAwake() { try { if (navigator.wakeLock && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {} }
export function letSleep() { if (wake) { wake.release().catch(() => {}); wake = null; } }

/* ===================================================================== */
/* CAMERA (or the sample room on computers)                               */
/* ===================================================================== */
export const cam = $('cam'), still = document.createElement('canvas');
export let camOK = false, room = null, facing = 'environment', frozen = false;
let stream = null;
export const loadImage = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
export function stopCamera() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
export async function startCamera(face = 'environment') {
  facing = face; stopCamera(); camOK = false;
  if (MODE !== 'demo' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: face }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      cam.srcObject = stream; await cam.play().catch(() => {});
      for (let i = 0; i < 40 && !cam.videoWidth; i++) await wait(50);
      camOK = !!cam.videoWidth;
    } catch (e) { /* refused or no camera: fall through to the sample room */ }
  }
  vis.prev = null;
  if (!camOK && !room) room = await loadImage('room.jpg');
  return camOK;
}
document.addEventListener('visibilitychange', () => {   // coming back from the home screen mid-door
  if (document.visibilityState !== 'visible' || !S.playing) return;
  keepAwake();
  if (stream && stream.getVideoTracks().some(t => t.readyState === 'ended')) startCamera(facing);
  else if (camOK && cam.paused) cam.play().catch(() => {});
});
export const mirrored = () => camOK && facing === 'user';
export const srcEl = () => camOK ? cam : room;
const srcDims = () => camOK ? [cam.videoWidth, cam.videoHeight] : room ? [room.naturalWidth, room.naturalHeight] : [0, 0];
export function coverRect() {               // the part of the source the player actually sees (object-fit: cover)
  const [sw, sh] = srcDims(); if (!sw) return null;
  const s = Math.max(W / sw, H / sh), vw = W / s, vh = H / s;
  return [(sw - vw) / 2, (sh - vh) / 2, vw, vh];
}
const work = document.createElement('canvas'), wctx = work.getContext('2d', { willReadFrequently: true });
export function grab(w, h, crop) {          // crop: [x, y, w, h] as fractions of the visible view
  const r = coverRect(); if (!r) return null;
  const c = crop || [0, 0, 1, 1];
  work.width = w; work.height = h; wctx.imageSmoothingEnabled = true; wctx.imageSmoothingQuality = 'high';
  wctx.drawImage(srcEl(), r[0] + r[2] * c[0], r[1] + r[3] * c[1], r[2] * c[2], r[3] * c[3], 0, 0, w, h);
  return wctx.getImageData(0, 0, w, h);
}
export function paintStill() {              // keeps the current view as a picture (the frozen room, the door, your face)
  const r = coverRect(); if (!r) return;
  still.width = Math.round(W * DPR); still.height = Math.round(H * DPR);
  still.getContext('2d').drawImage(srcEl(), r[0], r[1], r[2], r[3], 0, 0, still.width, still.height);
  still.stamp = performance.now();
}
export function freeze(repaint = true) { if (repaint) paintStill(); frozen = true; }
export function unfreeze() { frozen = false; }

/* what the camera sees, sampled ten times a second while a door is open */
export const vis = { lum: { center: 0, mean: 128 }, diff: 0, floor: 3, prev: null, color: { h: 0, s: 0, v: 0, name: 'none' }, t: 0 };
function luminance() {
  const w = 24, h = Math.round(24 * H / W), d = grab(w, h); if (!d) return { center: 0, mean: 0 };
  let sum = 0, csum = 0, cn = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, l = d.data[i] * .299 + d.data[i + 1] * .587 + d.data[i + 2] * .114; sum += l;
    if (Math.hypot((x - w / 2) / w, (y - h / 2) / w) < .2) { csum += l; cn++; }
  }
  return { center: cn ? csum / cn : 0, mean: sum / (w * h) };
}
function frameDiff() {                      // how much the picture changed since the last sample (movement), ignoring re-exposure
  const w = 32, h = Math.round(32 * H / W), d = grab(w, h); if (!d) return;
  const cur = new Float32Array(w * h); let mean = 0;
  for (let i = 0, j = 0; i < cur.length; i++, j += 4) { cur[i] = d.data[j] * .299 + d.data[j + 1] * .587 + d.data[j + 2] * .114; mean += cur[i]; }
  mean /= cur.length;
  for (let i = 0; i < cur.length; i++) cur[i] -= mean;
  if (vis.prev && vis.prev.length === cur.length) {
    let s = 0; for (let i = 0; i < cur.length; i++) s += Math.abs(cur[i] - vis.prev[i]);
    vis.diff = s / cur.length; vis.floor = Math.min(vis.floor * 1.003 + .003, vis.diff);
  }
  vis.prev = cur;
}
function colorName(h, s, v) {
  if (v > .68 && s < .16) return 'white';
  if (v < .14) return 'black';
  if ((h < 14 || h > 338) && s > .42 && v > .2) return 'red';
  if (h >= 185 && h < 258 && s > .26 && v > .16) return 'blue';
  if (h >= 75 && h < 165 && s > .24 && v > .16) return 'green';
  if (h >= 42 && h < 70 && s > .4 && v > .3) return 'yellow';
  return 'none';
}
function centerColor() {                    // the average color in the middle of the view
  const d = grab(12, 12, [.35, .3, .3, .3 * W / H]); if (!d) return vis.color;
  let r = 0, gg = 0, b = 0; for (let i = 0; i < d.data.length; i += 4) { r += d.data[i]; gg += d.data[i + 1]; b += d.data[i + 2]; }
  const n = d.data.length / 4; r /= n * 255; gg /= n * 255; b /= n * 255;
  const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn; let h = 0;
  if (dl) { h = mx === r ? ((gg - b) / dl) % 6 : mx === gg ? (b - r) / dl + 2 : (r - gg) / dl + 4; h *= 60; if (h < 0) h += 360; }
  const s = mx ? dl / mx : 0; return { h, s, v: mx, name: colorName(h, s, mx) };
}
export function sampleVision(now) {
  if (now - vis.t < 100) return; vis.t = now;
  const o = S.override || {};
  vis.lum = o.lum || luminance();
  if (o.diff != null) vis.diff = o.diff; else frameDiff();
  vis.color = o.color ? { h: 0, s: 1, v: 1, name: o.color } : centerColor();
}
export const stillThr = () => Math.max(2.4, vis.floor * 2.2 + .8);
export const lensCovered = () => vis.lum.mean < 30 || vis.lum.center < 46;
export const COLOR_RGB = { red: '200,64,52', blue: '70,118,210', green: '78,160,98', white: '238,234,224', yellow: '230,200,76', none: '242,234,217', black: '20,20,20' };

/* ===================================================================== */
/* MOTION: orientation, compass, steps, knocks, stillness                 */
/* ===================================================================== */
export const sensor = { has: false, absolute: false, alpha: 0, beta: 45, gamma: 0, heading: null, accuracy: null };
function onOrient(e) {
  if (e.beta == null || sensor.absolute) return; sensor.has = true; sensor.alpha = e.alpha || 0; sensor.beta = e.beta; sensor.gamma = e.gamma || 0;
  if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {   // iPhone: smoothed, with its accuracy
    const h = e.webkitCompassHeading * DEG, k = sensor.heading == null ? 1 : .2;
    sensor.hx = (sensor.hx || 0) * (1 - k) + Math.cos(h) * k; sensor.hy = (sensor.hy || 0) * (1 - k) + Math.sin(h) * k;
    sensor.heading = ((Math.atan2(sensor.hy, sensor.hx) / DEG) + 360) % 360; sensor.accuracy = e.webkitCompassAccuracy;
  }
}
function onAbsolute(e) { if (e.beta == null || e.alpha == null) return; sensor.absolute = true; sensor.has = true; sensor.alpha = e.alpha; sensor.beta = e.beta; sensor.gamma = e.gamma || 0; }   // Android: already relative to north
export const MO = { has: false, lp: 9.81, prev: 9.81, jerk: .2, level: 0, lastStep: 0, lastKnock: 0, onStep: null, onKnock: null };
function onMotion(e) {
  const a = e.accelerationIncludingGravity; if (!a || a.x == null) return;
  MO.has = true;
  const m = Math.hypot(a.x, a.y, a.z), now = performance.now(), j = Math.abs(m - MO.prev);
  MO.prev = m; MO.lp += (m - MO.lp) * .06; MO.level += (j - MO.level) * .1;
  if (MO.onStep && m - MO.lp > 1.3 && now - MO.lastStep > 340) { MO.lastStep = now; MO.onStep(); }
  if (MO.onKnock && j > Math.max(.7, MO.jerk * 6) && now - MO.lastKnock > 240) { MO.lastKnock = now; MO.onKnock(); }
  MO.jerk += (j - MO.jerk) * .03;
}
export function startMotion() {             // must be called inside a tap: that's the only time iOS asks
  const ask = E => { try { return E && E.requestPermission ? E.requestPermission().catch(() => 'denied') : Promise.resolve('granted'); } catch (e) { return Promise.resolve('denied'); } };
  return Promise.all([ask(window.DeviceOrientationEvent), ask(window.DeviceMotionEvent)]).then(([ro, rm]) => {
    if (ro === 'granted') { addEventListener('deviceorientation', onOrient); addEventListener('deviceorientationabsolute', onAbsolute); }
    if (ro === 'granted' || rm === 'granted') addEventListener('devicemotion', onMotion);
    return ro === 'granted';
  });
}
export const faceDown = () => S.override && S.override.face != null ? S.override.face : sensor.has && !AUTO ? Math.abs(sensor.beta) > 150 : hold.on;
export const shaken = () => MO.has && MO.level > .35;

/* ===================================================================== */
/* MICROPHONE (only for the doors that listen)                            */
/* ===================================================================== */
export const MIC = { stream: null, an: null, buf: null, ok: false, level: 0, pitch: 0, wantPitch: false, t: 0 };
export async function startMic() {
  if (MIC.ok) return true;
  if (AUTO) { MIC.ok = true; return true; }
  if (MODE === 'demo' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  try {
    MIC.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    const ac = audio.context(); if (!ac) return false;
    const src = ac.createMediaStreamSource(MIC.stream); MIC.an = ac.createAnalyser(); MIC.an.fftSize = 1024; src.connect(MIC.an);
    MIC.buf = new Float32Array(MIC.an.fftSize); MIC.ok = true; return true;
  } catch (e) { return false; }
}
export function stopMic() { if (MIC.stream) MIC.stream.getTracks().forEach(t => t.stop()); MIC.stream = null; MIC.an = null; MIC.ok = false; MIC.level = 0; MIC.pitch = 0; }
function detectPitch(buf, sr) {             // autocorrelation, trimmed to the loud part, refined between samples
  const n = buf.length; let r1 = 0, r2 = n - 1;
  for (let i = 0; i < n / 2; i++) if (Math.abs(buf[i]) < .2) { r1 = i; break; }
  for (let i = 1; i < n / 2; i++) if (Math.abs(buf[n - i]) < .2) { r2 = n - i; break; }
  const b = buf.subarray(r1, r2), m = b.length, maxLag = Math.min(m - 1, Math.ceil(sr / 70)), c = new Float32Array(maxLag + 1);
  for (let i = 0; i <= maxLag; i++) { let s = 0; for (let j = 0; j < m - i; j++) s += b[j] * b[j + i]; c[i] = s; }
  let d = 0; while (d < maxLag && c[d] > c[d + 1]) d++;
  let mx = -1, T = -1; for (let i = d; i <= maxLag; i++) if (c[i] > mx) { mx = c[i]; T = i; }
  if (T <= 0 || T >= maxLag) return 0;
  const x1 = c[T - 1], x2 = c[T], x3 = c[T + 1], a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
  const t = a ? T - bb / (2 * a) : T, f = sr / t; return f > 70 && f < 1100 ? f : 0;
}
export function sampleMic(now) {
  if (now - MIC.t < 60) return; MIC.t = now;
  if (S.override && S.override.mic != null) { MIC.level = S.override.mic; MIC.pitch = S.override.pitch || 0; return; }
  if (!MIC.ok || !MIC.an) { MIC.level = 0; MIC.pitch = 0; return; }
  MIC.an.getFloatTimeDomainData(MIC.buf); let s = 0; for (let i = 0; i < MIC.buf.length; i++) s += MIC.buf[i] * MIC.buf[i];
  MIC.level = Math.sqrt(s / MIC.buf.length);
  MIC.pitch = MIC.wantPitch && MIC.level > .008 ? detectPitch(MIC.buf, audio.context().sampleRate) : 0;
}

/* ===================================================================== */
/* TOUCH AND KEYS                                                         */
/* ===================================================================== */
export const keys = {}, manual = { x: 0, y: 0 }, bot = { x: 0, y: 0 }, hold = { on: false };
export const pen = { on: false, strokes: [], cur: null, last: 0 };   // drawing on the glass
addEventListener('keydown', e => { keys[e.key] = 1; if (e.key === ' ') hold.on = true; });
addEventListener('keyup', e => { keys[e.key] = 0; if (e.key === ' ') hold.on = false; });
let drag = null;
export function bindTouch(el) {             // the 3D view's canvas receives the touches
  el.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY }; hold.on = true;
    if (pen.on) { pen.cur = [[e.clientX, e.clientY]]; pen.strokes.push(pen.cur); pen.last = performance.now(); }
    if (S.tapHook) S.tapHook(e);
  });
}
addEventListener('pointermove', e => {
  if (drag && !pen.on) { manual.x = clamp((e.clientX - drag.x) / 110, -1, 1); manual.y = clamp((e.clientY - drag.y) / 110, -1, 1); }
  if (pen.on && pen.cur) { const l = pen.cur[pen.cur.length - 1]; if (Math.hypot(e.clientX - l[0], e.clientY - l[1]) > 2) pen.cur.push([e.clientX, e.clientY]); pen.last = performance.now(); }
});
const release = () => { drag = null; manual.x = manual.y = 0; hold.on = false; pen.cur = null; };
addEventListener('pointerup', release); addEventListener('pointercancel', release);
export function tilt(base) {
  const sens = 26 / (S.SETTINGS.tilt || 1);
  if (sensor.has && !AUTO) return { x: clamp(sensor.gamma / sens, -1, 1), y: clamp((sensor.beta - base) / sens, -1, 1) };
  const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ky = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
  return { x: kx || manual.x || bot.x, y: ky || manual.y || bot.y };
}

/* ===================================================================== */
/* NARRATION + HUD                                                        */
/* ===================================================================== */
export async function say(lines) {
  const box = $('story');
  for (const l of lines || []) {
    const text = typeof l === 'string' ? l : l.t;
    box.innerHTML = ''; const p = document.createElement('p'); if (l.small) p.className = 'small'; p.textContent = text; box.appendChild(p);
    requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on')));
    audio.breath(0, .022, 1.5, 2400 + Math.random() * 800);
    await wait(((l.hold) || 2200 + text.length * 38) * SPEED);
  }
}
export function instruct(text, small) {
  const box = $('story'); box.innerHTML = ''; if (!text) return;
  const ps = [text, small].filter(Boolean).map((t, i) => { const p = document.createElement('p'); if (i) p.className = 'small'; p.textContent = t; box.appendChild(p); return p; });
  requestAnimationFrame(() => requestAnimationFrame(() => ps.forEach(p => p.classList.add('on'))));
}
export function hud(on) { $('hud').hidden = !on; $('objTitle').hidden = !on; $('timer').textContent = ''; $('reread').hidden = true; }
export function hudObj(n, k, title) {
  $('doorLabel').textContent = 'Door ' + ROMAN[n - 1];
  $('pips').innerHTML = Array.from({ length: 7 }, (_, i) => '<i class="' + (i < k ? 'done' : i === k ? 'now' : '') + '"></i>').join('');
  $('objTitle').textContent = (k + 1) + ' of 7 · ' + title;
}
export const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

/* ===================================================================== */
/* THE MARKS: one sigil per door, in a 100 x 100 box                      */
/* ===================================================================== */
const star5 = () => { const pts = Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + i * TAU / 5; return [50 + Math.cos(a) * 30, 50 + Math.sin(a) * 30]; }); return [0, 2, 4, 1, 3].map((k, i, a) => { const p = pts[k], q = pts[a[(i + 1) % 5]]; return { l: [p[0], p[1], q[0], q[1]] }; }); };
export const MARKS = [
  [{ c: [50, 50, 40] }, { l: [35, 76, 35, 46] }, { a: [50, 46, 15, Math.PI, TAU] }, { l: [65, 46, 65, 76] }, { l: [12, 76, 88, 76] }, { c: [50, 58, 5] }],            // I the door
  [{ c: [50, 50, 11] }, ...Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return { l: [50 + Math.cos(a) * 20, 50 + Math.sin(a) * 20, 50 + Math.cos(a) * (i % 2 ? 32 : 40), 50 + Math.sin(a) * (i % 2 ? 32 : 40)] }; }), { a: [50, 50, 46, -2.6, -.55] }],   // II the eye
  [{ c: [38, 50, 24] }, { c: [62, 50, 24] }, { l: [8, 50, 92, 50] }, { l: [50, 32, 58, 50] }, { l: [58, 50, 50, 68] }, { l: [50, 68, 42, 50] }, { l: [42, 50, 50, 32] }],   // III the water
  [{ l: [50, 10, 90, 50] }, { l: [90, 50, 50, 90] }, { l: [50, 90, 10, 50] }, { l: [10, 50, 50, 10] }, { c: [50, 50, 18] }],                                             // IV the threshold
  [{ c: [50, 50, 40] }, { c: [50, 50, 26] }, { c: [50, 50, 12] }, { l: [50, 4, 50, 96] }, { l: [4, 50, 96, 50] }],                                                       // V the glass
  [{ c: [50, 50, 40] }, { l: [24, 70, 38, 70] }, { l: [38, 70, 38, 57] }, { l: [38, 57, 51, 57] }, { l: [51, 57, 51, 44] }, { l: [51, 44, 64, 44] }, { l: [64, 44, 64, 31] }, { l: [64, 31, 76, 31] }],   // VI the stairs
  [{ c: [50, 50, 40] }, { l: [30, 62, 70, 62] }, { l: [50, 26, 50, 80] }, { c: [36, 42, 3] }, { c: [64, 42, 3] }],                                                       // VII the silence
  [{ c: [50, 50, 40] }, { a: [50, 50, 6, 0, Math.PI] }, { a: [47, 50, 9, Math.PI, TAU] }, { a: [50, 50, 12, 0, Math.PI] }, { a: [47, 50, 15, Math.PI, TAU] }, { a: [50, 50, 18, 0, Math.PI] }, { a: [47, 50, 21, Math.PI, TAU] }],   // VIII the thread
  [{ c: [50, 50, 40] }, { a: [46, 52, 20, 1.75, 5.4] }, { a: [56, 47, 15, 2.35, 4.75] }, { c: [68, 30, 3] }, { c: [74, 22, 2.4] }, { c: [79, 15, 1.8] }],             // IX the sleep
  [{ c: [50, 50, 40] }, ...star5()],                                                                                                                                    // X the sky
  [{ c: [50, 50, 40] }, { c: [50, 27, 7] }, { c: [73, 50, 7] }, { c: [50, 73, 7] }, { c: [27, 50, 7] }, { c: [50, 50, 3] }],                                             // XI the names
  [{ c: [50, 50, 40] }, { a: [50, 42, 14, Math.PI, TAU] }, { l: [36, 42, 31, 64] }, { l: [64, 42, 69, 64] }, { l: [27, 64, 73, 64] }, { c: [50, 71, 4] }],               // XII the bells
  [{ c: [50, 50, 40] }, { l: [29, 78, 29, 46] }, { a: [50, 46, 21, Math.PI, TAU] }, { l: [71, 46, 71, 78] }, { l: [39, 78, 39, 50] }, { a: [50, 50, 11, Math.PI, TAU] }, { l: [61, 50, 61, 78] }, { c: [50, 63, 3] }]   // XIII the maker
];
export const GLYPH = {                       // shapes that aren't door marks
  tri: [{ l: [50, 20, 80, 72] }, { l: [80, 72, 20, 72] }, { l: [20, 72, 50, 20] }],
  ring: [{ c: [50, 50, 28] }],
  diamond: [{ l: [50, 18, 80, 50] }, { l: [80, 50, 50, 82] }, { l: [50, 82, 20, 50] }, { l: [20, 50, 50, 18] }],
  radio: [{ l: [26, 44, 74, 44] }, { l: [74, 44, 74, 80] }, { l: [74, 80, 26, 80] }, { l: [26, 80, 26, 44] }, { c: [40, 62, 8] }, { l: [56, 56, 66, 56] }, { l: [56, 66, 66, 66] }, { l: [36, 44, 64, 16] }],
  brush: [{ l: [28, 78, 66, 26] }, { l: [66, 26, 74, 20] }, { c: [26, 80, 6] }, { a: [70, 30, 12, -2.2, .6] }],
  chalk: [{ a: [50, 50, 6, 0, Math.PI] }, { a: [47, 50, 12, Math.PI, TAU] }, { a: [52, 50, 18, 0, Math.PI] }, { a: [45, 50, 26, Math.PI, TAU] }, { l: [19, 50, 19, 60] }],
  door: MARKS[0],
  phone: [{ l: [34, 12, 66, 12] }, { l: [66, 12, 66, 88] }, { l: [66, 88, 34, 88] }, { l: [34, 88, 34, 12] }, { l: [44, 78, 56, 78] }, { l: [44, 20, 56, 20] }],
  box: [{ l: [24, 42, 74, 42] }, { l: [74, 42, 74, 80] }, { l: [74, 80, 24, 80] }, { l: [24, 80, 24, 42] }, { l: [24, 42, 36, 28] }, { l: [36, 28, 84, 28] }, { l: [84, 28, 74, 42] }, { l: [74, 60, 84, 60] }, { c: [88, 60, 4] }],
  top: [{ l: [50, 14, 50, 26] }, { a: [50, 50, 24, -Math.PI, 0] }, { l: [26, 50, 50, 86] }, { l: [74, 50, 50, 86] }, { l: [30, 50, 70, 50] }],
  star: [{ l: [50, 16, 58, 42] }, { l: [58, 42, 84, 42] }, { l: [84, 42, 62, 58] }, { l: [62, 58, 70, 84] }, { l: [70, 84, 50, 68] }, { l: [50, 68, 30, 84] }, { l: [30, 84, 38, 58] }, { l: [38, 58, 16, 42] }, { l: [16, 42, 42, 42] }, { l: [42, 42, 50, 16] }]
};
export const GLYPH_CHAR = { tri: '▲', ring: '●', diamond: '◆' };
export const shape = i => Array.isArray(i) ? i : typeof i === 'string' ? GLYPH[i] : MARKS[i];
export function markSVG(i, locked) {
  return '<svg viewBox="0 0 100 100" class="' + (locked ? 'locked' : '') + '" aria-hidden="true">' + shape(i).map(p =>
    p.c ? '<circle cx="' + p.c[0] + '" cy="' + p.c[1] + '" r="' + p.c[2] + '"/>' :
    p.l ? '<line x1="' + p.l[0].toFixed(1) + '" y1="' + p.l[1].toFixed(1) + '" x2="' + p.l[2].toFixed(1) + '" y2="' + p.l[3].toFixed(1) + '"/>' :
    '<path d="M' + (p.a[0] + Math.cos(p.a[3]) * p.a[2]).toFixed(1) + ' ' + (p.a[1] + Math.sin(p.a[3]) * p.a[2]).toFixed(1) + ' A' + p.a[2] + ' ' + p.a[2] + ' 0 ' + (p.a[4] - p.a[3] > Math.PI ? 1 : 0) + ' 1 ' + (p.a[0] + Math.cos(p.a[4]) * p.a[2]).toFixed(1) + ' ' + (p.a[1] + Math.sin(p.a[4]) * p.a[2]).toFixed(1) + '"/>').join('') + '</svg>';
}
export function markPoints(i, n = 3) {      // a mark as a list of points along its strokes (for drawing and matching)
  const pts = [];
  for (const p of shape(i)) {
    if (p.c) for (let k = 0; k < 24 * n; k++) { const a = k / (24 * n) * TAU; pts.push([p.c[0] + Math.cos(a) * p.c[2], p.c[1] + Math.sin(a) * p.c[2]]); }
    else if (p.l) { const len = Math.hypot(p.l[2] - p.l[0], p.l[3] - p.l[1]), m = Math.max(2, Math.round(len / 4 * n)); for (let k = 0; k <= m; k++) pts.push([p.l[0] + (p.l[2] - p.l[0]) * k / m, p.l[1] + (p.l[3] - p.l[1]) * k / m]); }
    else { const m = Math.max(4, Math.round(Math.abs(p.a[4] - p.a[3]) * p.a[2] / 4 * n)); for (let k = 0; k <= m; k++) { const a = p.a[3] + (p.a[4] - p.a[3]) * k / m; pts.push([p.a[0] + Math.cos(a) * p.a[2], p.a[1] + Math.sin(a) * p.a[2]]); } }
  }
  return pts;
}
// one primitive of a mark on the 2D layer, centered at (cx, cy) with size s; f < 1 draws part of it
function drawPrim(p, cx, cy, s, f = 1, c = g) {
  const k = s / 100;
  c.beginPath();
  if (p.c) c.arc(cx + (p.c[0] - 50) * k, cy + (p.c[1] - 50) * k, p.c[2] * k, -Math.PI / 2, -Math.PI / 2 + TAU * f);
  else if (p.l) { c.moveTo(cx + (p.l[0] - 50) * k, cy + (p.l[1] - 50) * k); c.lineTo(cx + (p.l[0] + (p.l[2] - p.l[0]) * f - 50) * k, cy + (p.l[1] + (p.l[3] - p.l[1]) * f - 50) * k); }
  else c.arc(cx + (p.a[0] - 50) * k, cy + (p.a[1] - 50) * k, p.a[2] * k, p.a[3], p.a[3] + (p.a[4] - p.a[3]) * f);
  c.stroke();
}
export function drawMark(i, cx, cy, s, alpha = 1, glow = 14, f = 1, c = g, color = '#F0CB86') {   // f < 1 writes the mark stroke by stroke
  const parts = shape(i), n = parts.length;
  c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = Math.max(1.6, s / 80); c.lineCap = 'round'; c.shadowColor = 'rgba(255, 200, 120, .95)'; c.shadowBlur = glow;
  parts.forEach((p, j) => { const pf = clamp(f * n - j, 0, 1); if (pf > 0) drawPrim(p, cx, cy, s, pf, c); });
  c.restore();
}
export function glowText(text, x, y, size, alpha = 1, font = 'italic 500', color = '240, 206, 140') {
  g.save(); g.globalAlpha = alpha; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgb(' + color + ')';
  g.shadowColor = 'rgba(255, 200, 120, .85)'; g.shadowBlur = 18; g.font = font + ' ' + size + 'px "Cormorant Garamond", Georgia, serif';
  g.fillText(text, x, y); g.restore();
}
export function monoText(text, x, y, size = 11, alpha = 1, color = '232, 196, 126') {
  g.save(); g.globalAlpha = alpha; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgb(' + color + ')'; g.font = '400 ' + size + 'px "DM Mono", monospace';
  g.fillText(text.split('').join(String.fromCharCode(8202)), x, y); g.restore();
}
export function ring(x, y, r, f, alpha = 1, width = 2.4, color = '240, 203, 134') {   // a progress ring on the 2D layer
  g.save(); g.lineCap = 'round'; g.strokeStyle = 'rgba(' + color + ',' + (.22 * alpha) + ')'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  if (f > 0) { g.strokeStyle = 'rgba(' + color + ',' + alpha + ')'; g.lineWidth = width; g.shadowColor = 'rgba(255, 205, 130, .95)'; g.shadowBlur = 16; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(f, 0, 1)); g.stroke(); }
  g.restore();
}

/* ===================================================================== */
/* THE AR VIEW: where the phone points                                    */
/* ===================================================================== */
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = a => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };
export const dirOf = (az, el = 0) => [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
export const view = { yaw: 0, pitch: 0, roll: 0 };   // a virtual camera for computers and the self-test
export const virtual = () => !sensor.has || AUTO;
export function viewTick(dt) {
  if (!virtual() || AUTO) return;
  const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ky = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
  view.yaw += (kx || (pen.on ? 0 : manual.x)) * dt * 1.6; view.pitch = clamp(view.pitch + (ky || (pen.on ? 0 : -manual.y)) * dt * 1.1, -1.5, 1.5);
  view.roll = clamp(view.roll + ((keys.e ? 1 : 0) - (keys.q ? 1 : 0)) * dt * 1.2, -1.6, 1.6);
}
export function aim(az, el, dt, sp = 1.2) { // the self-test turns the virtual camera like a player would
  view.yaw += clamp(wrapPi(az - view.yaw), -sp * dt, sp * dt);
  view.pitch += clamp(el - view.pitch, -.7 * dt, .7 * dt);
}
export function basis() {
  if (!virtual()) {                          // W3C device orientation: R = Rz(alpha) Rx(beta) Ry(gamma)
    const a = sensor.alpha * DEG, b = sensor.beta * DEG, c = sensor.gamma * DEG;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(c), sg = Math.sin(c);
    const R = [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg, sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg, -cb * sg, sb, cb * cg];
    const right = [R[0], R[3], R[6]], up = [R[1], R[4], R[7]], back = [R[2], R[5], R[8]];
    return { right, up, fwd: [-back[0], -back[1], -back[2]] };
  }
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const fwd = [sy * cp, cy * cp, sp], right0 = [cy, -sy, 0], up0 = cross(right0, fwd);
  const cr = Math.cos(view.roll), sr = Math.sin(view.roll);
  return { fwd, right: [right0[0] * cr + up0[0] * sr, right0[1] * cr + up0[1] * sr, right0[2] * cr + up0[2] * sr], up: [up0[0] * cr - right0[0] * sr, up0[1] * cr - right0[1] * sr, up0[2] * cr - right0[2] * sr] };
}
export const FOCAL = () => (W / 2) / Math.tan(27 * DEG);   // the view's focal length in CSS pixels (shared with the 3D camera)
export function project(v, B) {
  const X = dot(v, B.right), Y = dot(v, B.up), Z = dot(v, B.fwd);
  if (Z < .06) return null;
  const f = FOCAL();
  return [W / 2 + X / Z * f, H / 2 - Y / Z * f, Z];
}
export const fwdAz = B => Math.atan2(B.fwd[0], B.fwd[1]);
export const pitchOf = B => Math.asin(clamp(B.fwd[2], -1, 1));
export const angTo = (B, d) => Math.acos(clamp(dot(B.fwd, d), -1, 1));
export function signedRoll(B) {              // how far the glass is turned like a steering wheel
  if (virtual()) return view.roll;
  const f = B.fwd, k = f[2], p = norm([-k * f[0], -k * f[1], 1 - k * f[2]]);
  return Math.atan2(dot(p, B.right), dot(p, B.up));
}
export function compass() {                  // turns a compass direction (degrees from north) into the AR view's frame
  const az0 = fwdAz(basis());
  if (!virtual() && sensor.absolute) return deg => deg * DEG;
  if (!virtual() && sensor.heading != null) { const h = sensor.heading; return deg => az0 + (deg - h) * DEG; }
  return deg => az0 + deg * DEG;            // no compass: the way the player faced first counts as north
}
export function chevron(B, d, now, alpha = .6) {   // a faint arrow at the edge, toward something off screen
  const X = dot(d, B.right), Y = dot(d, B.up), a = Math.atan2(-Y, X);
  const ex = W / 2 + Math.cos(a) * (W / 2 - 36), ey = H / 2 + Math.sin(a) * (H / 2 - 120);
  g.save(); g.translate(ex, ey); g.rotate(a); g.strokeStyle = 'rgba(240, 203, 134,' + (alpha * (.6 + .4 * Math.sin(now / 300))) + ')'; g.lineWidth = 2; g.shadowColor = 'rgba(255, 205, 130, .9)'; g.shadowBlur = 10;
  g.beginPath(); g.moveTo(-8, -12); g.lineTo(6, 0); g.lineTo(-8, 12); g.stroke(); g.restore();
}

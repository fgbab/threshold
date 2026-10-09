/* Objectives that listen: silence while it searches, breath that clears frost from the glass, a note you hum back.
   The microphone is only opened for these, and closed again right after. */
import * as C from './core.js';
import { S, AUTO, SPEED, wait, until, clamp, ease, TAU, audio, buzz, instruct, g, W, H, hold, ring, monoText, glowText, MIC, startMic, stopMic, pen } from './core.js';
import * as G from './gfx.js';
import { hints, holdShot, sim } from './kit.js';

async function ensureMic() {                 // ask once, at the door that needs it
  if (MIC.ok) return true;
  instruct('This door listens.', 'Allow the microphone when your phone asks');
  const ok = await startMic(); await wait(700);
  return ok;
}
async function floorLevel() {                // how loud the room is when nobody makes a sound
  const xs = []; for (let i = 0; i < 18; i++) { await wait(80); xs.push(MIC.level); }
  xs.sort((a, b) => a - b); return Math.max(.002, xs[Math.floor(xs.length / 2)]);
}

/* --------------------------------------------------------------------- */
/* silence while it searches the room. { secs }                                                                     */
export async function silence(o = {}) {
  C.unfreeze();
  const mic = await ensureMic();
  if (AUTO) S.override = { mic: .002 };
  const floor = mic ? await floorLevel() : 0, thr = Math.max(floor * 2.4, .014);
  let p = 0, strikes = 0, heard = 0, near = 0, flare = 0;
  const need = (o.secs || 12) * (AUTO ? .2 : 1);
  S.stage = { draw(now, dt) {
    const loud = mic ? MIC.level > thr : hold.on === false && false;
    if (!loud) { p = clamp(p + dt / need, 0, 1); near = Math.max(0, near - dt * .1); }
    else if (now - heard > 1500) {
      heard = now; flare = now; p = Math.max(0, p - .45); strikes++; near = Math.min(1, near + .35);
      instruct('It heard you.', strikes >= 2 ? 'Not a sound' : 'Quiet'); audio.step(0, .18, (Math.random() - .5) * 1.2);
      if (strikes % 3 === 0) G.glass.scare();
    }
    if (Math.random() < dt * (.25 + near)) audio.step(0, .06 + near * .12, Math.sin(now / 900) * .9);
    G.glass.dread(.2 + near * .6, 300);
    const cx = W / 2, cy = H * .46, R = Math.min(W, H) * .32;
    g.save(); g.strokeStyle = 'rgba(240,203,134,1)'; g.shadowColor = 'rgba(255,205,130,.9)'; g.shadowBlur = 12;
    for (let i = 0; i < 5; i++) { const k = ((now / 2200) + i / 5) % 1, rr = R * (1 - k); g.globalAlpha = (now - flare < 800 ? .9 : .35) * k; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke(); }
    g.restore(); ring(cx, cy, 24, p, .9);
    if (mic) { const lv = clamp(MIC.level / (thr * 2), 0, 1); g.save(); g.fillStyle = 'rgba(240,203,134,' + (.25 + lv * .6) + ')'; g.fillRect(cx - 40, cy + R + 26, 80 * lv, 2); g.restore(); }
  } };
  instruct(o.text || 'Don’t make a sound.', o.small || 'It hunts by sound');
  const stop = hints(o);
  await holdShot(3000);
  await until(() => p >= 1);
  stop(); if (!o.keepMic) stopMic(); G.glass.dread(.12, 1500); instruct('');
  await wait(1000 * Math.max(SPEED, .4));
  return { strikes };
}

/* --------------------------------------------------------------------- */
/* breathe on the glass to clear the frost; words are written underneath. { lines, small }                         */
export async function breath(o = {}) {
  C.unfreeze();
  const mic = await ensureMic();
  if (AUTO) S.override = { mic: .002 };
  const floor = mic ? await floorLevel() : 0, thr = Math.max(floor * 4, .05);
  G.glass.frost(1, 1200); audio.bed('rumble', .05);
  let blown = 0, read = 0, wipe = false;
  const lastPen = { x: 0, y: 0 };
  S.stage = { draw(now, dt) {
    const blowing = mic && MIC.level > thr;
    if (blowing) { blown += dt; G.glass.clearAt(.5 + (Math.random() - .5) * .5, .45 + (Math.random() - .5) * .4, .38, .1); if (Math.random() < dt * 6) audio.breath(0, .02, .4, 900); }
    if ((wipe || !mic || S.easy >= 1) && C.hold.on && C.manual) {   // or wipe it with a finger
      const pts = C.pen.cur; if (pts && pts.length) { const q = pts[pts.length - 1]; G.glass.clearAt(q[0] / W, q[1] / H, .22, .25); blown += dt * .5; }
    }
    if (blown > 2.8) { read += dt; if (read < .1) G.glass.frost(0, 2000); }
    const size = Math.round(Math.min(W, 520) / 13.5);
    o.lines.forEach((l, i) => glowText(l, W / 2, H * .44 + (i - (o.lines.length - 1) / 2) * size * 1.35, size, .95));
    if (o.small) monoText(o.small.toUpperCase(), W / 2, H * .44 + o.lines.length * size * .7 + 32, 11, .8);
  } };
  pen.on = true;                             // a finger on the glass leaves a clear trail
  instruct(o.text || 'Breathe on the glass.', o.hint || 'Slowly. Close to the bottom of the phone');
  setTimeout(() => { wipe = true; }, 45000);
  sim(800, () => { S.override = { mic: .2 }; });
  const stop = hints(o);
  await holdShot(3200);
  await until(() => read > (AUTO ? .3 : 3));
  stop(); pen.on = false; if (!o.keepMic) stopMic(); audio.bed('rumble', null); instruct('');
  await wait(800 * Math.max(SPEED, .4));
  return { lines: o.lines };
}

/* --------------------------------------------------------------------- */
/* hum a note back to it. { note: 'A' (any octave counts) }                                                          */
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export async function hum(o = {}) {
  C.unfreeze();
  const mic = await ensureMic(); MIC.wantPitch = true;
  const want = NOTES.indexOf(o.note || 'A'), refHz = 220 * Math.pow(2, (want - 9) / 12);
  let p = 0, cur = -1, cents = 0, ref = 0;
  S.stage = { draw(now, dt) {
    const f = MIC.pitch;
    if (f) { const midi = 69 + 12 * Math.log2(f / 440), r = Math.round(midi); cur = ((r % 12) + 12) % 12; cents = (midi - r) * 100; } else cur = -1;
    const on = cur === want && Math.abs(cents) < 50;
    p = clamp(p + (on ? dt / 2 : -dt * .35), 0, 1);
    if (S.easy >= 1 && now > ref) { ref = now + 6000; audio.bell(refHz * 2, 0, .05, 1.6); }
    const cx = W / 2, cy = H * .46, R = Math.min(W, H) * .26;
    g.save(); g.shadowColor = 'rgba(255,205,130,.9)'; g.shadowBlur = 14;
    for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + i / 12 * TAU, lit = i === cur; g.fillStyle = lit ? (on ? '#FFE3A8' : 'rgba(240,203,134,.9)') : 'rgba(242,234,217,.18)'; g.beginPath(); g.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, lit ? 6 : 3, 0, TAU); g.fill(); }
    if (cur >= 0) { const a = -Math.PI / 2 + (cur + cents / 100) / 12 * TAU; g.strokeStyle = 'rgba(240,203,134,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R * .8, cy + Math.sin(a) * R * .8); g.stroke(); }
    g.restore(); ring(cx, cy, R + 22, p, 1);
  } };
  instruct(o.text || 'Give it back its note.', o.small || 'Hum it. Hold it');
  sim(800, () => { S.override = { mic: .2, pitch: refHz }; });
  const stop = hints(o);
  await holdShot(3200);
  await until(() => p >= 1);
  stop(); MIC.wantPitch = false; stopMic(); audio.bell(refHz * 2, 0, .1, 3); audio.bell(refHz * 3, .2, .08, 3); instruct('');
  await wait(1000 * Math.max(SPEED, .4));
  return {};
}

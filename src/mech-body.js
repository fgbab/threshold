/* Objectives played with your body: walking (and counting), the phone face down while you listen, knocking a code,
   balancing a drop of light on the glass. */
import * as C from './core.js';
import { S, AUTO, SPEED, wait, until, clamp, ease, TAU, DEG, wrapPi, audio, buzz, instruct, say, g, W, H, hold, ring, monoText, glowText, MO, basis, fwdAz, dirOf, angTo, aim, view, compass } from './core.js';
import * as G from './gfx.js';
import { keep, drop, hints, holdShot, sim, playClip } from './kit.js';
import { snap } from './share.js';

/* --------------------------------------------------------------------- */
/* walk. { steps (at least), exact (n ± 1, then stop), noTurn (degrees you may turn), back: 'door' (turn round to find it) } */
export async function walk(o = {}) {
  C.unfreeze();
  const az0 = fwdAz(basis());
  let steps = 0, lastStep = performance.now(), stillT = 0, turned = false, done = false, tapSteps = false;
  MO.onStep = () => { steps++; lastStep = performance.now(); audio.step(.16 + Math.random() * .06, .09, (Math.random() - .5) * .7); };   // something walks with you
  const fallback = setTimeout(() => { if (!MO.has && !AUTO) { tapSteps = true; instruct('Tap once for every step.', o.small); } }, 6000);
  S.tapHook = () => { if (tapSteps) MO.onStep(); };
  S.stage = { draw(now, dt) {
    const B = basis();
    if (o.noTurn && !turned && Math.abs(wrapPi(fwdAz(B) - az0)) > o.noTurn * DEG && steps > 0) {
      turned = true; G.glass.scare(); instruct('You looked back.', 'Start again from where you are'); steps = 0;
      setTimeout(() => { turned = false; instruct(o.text, o.small); }, 2600);
    }
    stillT = now - lastStep > 1500 ? stillT + dt : 0;
    const ok = o.exact ? Math.abs(steps - o.exact) <= 1 && stillT > 2.5 : steps >= (o.steps || 6) && stillT > .3;
    if (ok && !turned) done = true;
    if (!o.exact) ring(W / 2, H * .5, 26, steps / (o.steps || 6), .55);
  } };
  instruct(o.text || 'Walk.', o.small);
  if (AUTO) (async () => { const n = o.exact || o.steps || 6; for (let i = 0; i < n; i++) { await wait(180); MO.onStep(); } })();
  const stop = hints(o);
  await holdShot(3000);
  await until(() => done);
  stop(); clearTimeout(fallback); MO.onStep = null; S.tapHook = null; audio.thump(0, .3);
  if (o.back === 'door') {                    // now look back: the door was behind you the whole time
    instruct('Now look back.');
    const d = keep(G.doorway(2)), az = az0 + Math.PI, dir = dirOf(az, -.3); G.placeAt(d.group, az, -.3, 3.2); G.faceViewer(d.group); d.alpha(.95); d.open(.4);
    let t = 0; S.stage = { draw(now, dt) { const B = basis(); t = angTo(B, dir) < .3 ? t + dt : 0; if (AUTO) aim(az, -.3, dt, 2.4); } };
    await until(() => t > 1); d.open(1); audio.open(); G.glass.flash([1, .9, .7], 900, .4);
    await wait(1600 * Math.max(SPEED, .4));
  }
  instruct('');
  return { steps };
}

/* --------------------------------------------------------------------- */
/* the phone face down while you listen. { secs, script: 'door'|'sleep', bells: true (turn it over on the third bell) } */
const SCRIPTS = {
  door: [[.5, () => audio.creak(0, .09, 2.2)], [3, () => audio.step(0, .12, -.4)], [3.8, () => audio.step(0, .14, -.2)], [4.6, () => audio.step(0, .16, 0)], [6, () => audio.breath(0, .08, 2.4, 520)], [9, () => audio.step(0, .12, .4)], [10.5, () => audio.creak(0, .08, 1.6)], [12.4, () => audio.knock(0, .7, .8)]],
  sleep: [[1, () => audio.breath(0, .05, 2.2, 600)], [4, () => audio.whisper(0, 1.6, .06, .6)], [7, () => audio.step(0, .1, -.5)], [9, () => audio.breath(0, .07, 2.2, 520, .4)]]
};
export async function facedown(o = {}) {
  C.unfreeze();
  let p = 0, down = false, broke = 0, started = 0, timers = [], bells = 0, bellT = 0, flipped = false, early = 0;
  const run = () => { timers.forEach(clearTimeout); timers = (SCRIPTS[o.script] || []).map(([t, f]) => setTimeout(f, t * 1000 * (AUTO ? .1 : 1))); };
  const ringBells = () => {                   // three bells, never evenly; turn it over on the third
    bells = 0; const gaps = [2.5 + Math.random() * 2, 3 + Math.random() * 3, 2 + Math.random() * 4];
    let t = 0; timers.push(...gaps.map(gp => { t += gp; return setTimeout(() => { bells++; bellT = performance.now(); audio.toll(0, .14); }, t * 1000 * (AUTO ? .15 : 1)); }));
  };
  const need = (o.secs || 13) * (AUTO ? .1 : 1);
  S.stage = { draw(now, dt) {
    const fd = C.faceDown();
    if (fd && !down) { down = true; started = now; if (o.bells) ringBells(); else run(); }
    if (!fd && down) {
      down = false;
      if (o.bells) { if (bells >= 3 && now - bellT < 1700) flipped = true; else { timers.forEach(clearTimeout); if (now - early > 3000) { early = now; G.glass.scare(); instruct(bells < 3 ? 'Too early.' : 'Too late.', 'Face down. Start again'); } } }
      else if (p < 1) { timers.forEach(clearTimeout); p = 0; if (now - broke > 3000) { broke = now; G.glass.scare(); instruct('You looked.', 'Face down. Start again'); } }
    }
    if (down && !o.bells) p = clamp(p + dt / need, 0, 1);
    g.fillStyle = 'rgba(0,0,0,' + (down ? .7 : 0) + ')'; g.fillRect(0, 0, W, H);
    if (!down && !flipped && p < 1) monoText('FACE DOWN', W / 2, H * .5, 11, .5 + .3 * Math.sin(now / 400));
  } };
  instruct(o.text || 'Put the glass face down.', o.small || 'Don’t turn it over until it’s over');
  if (AUTO) (async () => { S.override = { face: true }; if (o.bells) await until(() => bells >= 3); else await until(() => p >= 1); await wait(200); S.override = { face: false }; })();
  const stop = hints(o);
  await holdShot(3000);
  await until(() => o.bells ? flipped : p >= 1 && !C.faceDown());
  stop(); timers.forEach(clearTimeout); S.override = null; audio.heartbeat(); instruct('');
  return {};
}

/* --------------------------------------------------------------------- */
/* knock a code. { pattern: [3, 3], facing (degrees from north) }; wrong knocks crack the glass and worse          */
export async function knock(o = {}) {
  C.unfreeze();
  const want = o.pattern || [3, 3], toAz = compass(), faceAz = o.facing != null ? toAz(o.facing) : null;
  let knocks = [], fails = 0, phase = 'knock', lockP = 0, rings = [];
  const GAP = AUTO ? 1500 : 900, END = AUTO ? 3600 : 2400;   // the self-test's timers drift under load, so it gets wider margins
  const groups = ks => ks.reduce((gs, t, i) => { if (!i || t - ks[i - 1] > GAP) gs.push(1); else gs[gs.length - 1]++; return gs; }, []);
  const hit = glassTap => { if (phase !== 'knock') return; const now = performance.now(), prev = knocks[knocks.length - 1]; if (prev && now - prev < 180) return; knocks.push(now); rings.push({ t: now, big: false }); buzz(12); if (glassTap) audio.knock(0, .22); };
  MO.onKnock = () => hit(false); S.tapHook = () => hit(true);
  S.stage = { draw(now, dt) {
    const cx = W / 2, cy = H * .45, R = Math.min(W, H);
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = g.fillStyle = '#F0CB86'; g.shadowColor = 'rgba(255,205,130,.9)'; g.shadowBlur = 14;
    const gs = phase === 'knock' ? groups(knocks) : want; let total = 0; gs.forEach((n, i) => { total += n * 18 + (i ? 24 : 0); });
    let x = cx - total / 2 + 9; gs.forEach((n, gi) => { if (gi) x += 24; for (let k = 0; k < n; k++) { g.beginPath(); g.arc(x, cy + R * .3, 4.5, 0, TAU); g.fill(); x += 18; } });
    rings = rings.filter(r => now - r.t < (r.big ? 1700 : 1000));
    for (const r of rings) { const k = (now - r.t) / (r.big ? 1700 : 1000); g.globalAlpha = (1 - k) * (r.big ? .9 : .6); g.lineWidth = r.big ? 3 : 1.6; g.beginPath(); g.arc(cx, cy, 16 + ease(k) * R * (r.big ? .75 : .4), 0, TAU); g.stroke(); }
    g.restore();
    if (phase === 'lock') ring(cx, cy, R * .2, lockP, .8);
    if (AUTO && faceAz != null) aim(faceAz, 0, dt, 2);
  } };
  if (o.before) { await wait(600); for (let k = 0; k < o.before; k++) { audio.knock(0, .8, .7); buzz(60); rings.push({ t: performance.now(), big: true }); await wait(600); } await wait(500); }
  instruct(o.text || 'Knock.', o.small || 'On the door, or on the glass');
  if (AUTO) setTimeout(() => {               // the self-test knocks with exact timing (real timers drift when rendering in software)
    const span = want.reduce((t, n) => t + n * 300, 0) + (want.length - 1) * 2200; let t = performance.now() - span - END - 100; knocks = [];
    want.forEach((n, gi) => { if (gi) t += 2200; for (let k = 0; k < n; k++) { knocks.push(t); t += 300; } }); rings.push({ t: performance.now(), big: false }); audio.knock(0, .22);
  }, 700);
  const stop = hints(o);
  for (;;) {
    await until(() => phase === 'knock' && knocks.length && performance.now() - knocks[knocks.length - 1] > END);
    const gs = groups(knocks), facingOK = faceAz == null || angTo(basis(), dirOf(faceAz, 0)) < (S.easy ? 50 : 35) * DEG;
    if (gs.length === want.length && gs.every((n, i) => n === want[i]) && facingOK) break;
    fails++; knocks = [];
    audio.knock(0, 1, .6); buzz(90); document.body.classList.remove('quake'); void document.body.offsetWidth; document.body.classList.add('quake'); rings.push({ t: performance.now(), big: true });
    if (fails === 1) { G.glass.crack(true); instruct(facingOK ? 'No.' : 'Not facing that way.', o.small); await holdShot(1600); }
    else if (fails === 2) { audio.whisper(0, 1.6, .08, .5); instruct(o.wrong2 || 'That isn’t how it knocks.', o.small); }
    else {                                    // it's right there: don't move
      phase = 'lock'; lockP = 0; instruct('Don’t move.', 'It’s right there'); audio.duck(.25, .5);
      const need = AUTO ? 1.5 : 18; let t = 0, last = 0;
      while (t < need) { await wait(100); if (C.shaken() || (C.camOK && !C.lensCovered() && C.vis.diff > C.stillThr() + 4)) { t = 0; if (performance.now() - last > 4000) { last = performance.now(); G.glass.scare(); } } else t += .1; lockP = t / need; if (Math.random() < .03) audio.breath(0, .06, 1.6, 500); }
      audio.duck(1, .6); phase = 'knock'; instruct(o.text || 'Knock.', o.small);
    }
  }
  stop(); phase = 'listen'; MO.onKnock = null; S.tapHook = null; instruct('');
  audio.duck(.05, .5); await wait(2600 * Math.max(SPEED, .3));
  phase = 'answer'; audio.duck(1, .15);
  for (let gi = 0; gi < want.length; gi++) { if (gi) await wait(1400 * Math.max(SPEED, .3)); for (let k = 0; k < want[gi]; k++) { audio.knock(0, .9, .9); buzz(70); rings.push({ t: performance.now(), big: true }); document.body.classList.remove('quake'); void document.body.offsetWidth; document.body.classList.add('quake'); await wait(520 * Math.max(SPEED, .3)); } }
  G.glass.crack(false);
  await wait(1200 * Math.max(SPEED, .3));
  return { fails };
}

/* --------------------------------------------------------------------- */
/* balance a drop of light inside the ring, the glass held flat. { secs }                                           */
export async function level(o = {}) {
  C.unfreeze();
  const drop1 = keep(G.ember(10), G.screen), ballP = { x: 0, y: 0, vx: 0, vy: 0 };
  let p = 0, out = 0, gust = 0, gx = 0, gy = 0;
  const need = (o.secs || 10) * (AUTO ? .25 : 1), R = Math.min(W, H) * .2;
  S.stage = { draw(now, dt) {
    if (now > gust) { gust = now + 2500 + Math.random() * 2500; const a = Math.random() * TAU; gx = Math.cos(a) * 140; gy = Math.sin(a) * 140; audio.whisper(0, .7, .05, Math.cos(a)); }
    gx *= Math.pow(.2, dt); gy *= Math.pow(.2, dt);
    let tx = 0, ty = 0;
    if (C.sensor.has && !AUTO) { tx = clamp(C.sensor.gamma / 20, -1.5, 1.5); ty = clamp(C.sensor.beta / 20, -1.5, 1.5); }
    else if (AUTO) { tx = clamp(-ballP.x / 60 - ballP.vx * .01, -1, 1); ty = clamp(-ballP.y / 60 - ballP.vy * .01, -1, 1); }
    else { tx = (C.keys.ArrowRight ? 1 : 0) - (C.keys.ArrowLeft ? 1 : 0) || C.manual.x; ty = (C.keys.ArrowDown ? 1 : 0) - (C.keys.ArrowUp ? 1 : 0) || C.manual.y; }
    ballP.vx += (tx * 260 + gx) * dt; ballP.vy += (ty * 260 + gy) * dt; ballP.vx *= Math.pow(.4, dt); ballP.vy *= Math.pow(.4, dt);
    ballP.x = clamp(ballP.x + ballP.vx * dt, -W / 2 + 20, W / 2 - 20); ballP.y = clamp(ballP.y + ballP.vy * dt, -H / 2 + 20, H / 2 - 20);
    const inside = Math.hypot(ballP.x, ballP.y) < R;
    if (inside) { p = clamp(p + dt / need, 0, 1); out = 0; } else { out += dt; if (out > 1.5) p = Math.max(0, p - dt * .2); }
    drop1.at(W / 2 + ballP.x, H / 2 + ballP.y);
    ring(W / 2, H / 2, R, p, inside ? 1 : .4, 2.4);
  } };
  instruct(o.text || 'Hold the glass flat.', o.small || 'Keep the light inside the ring');
  const stop = hints(o);
  await holdShot(3000);
  await until(() => p >= 1);
  stop(); audio.bell(660, 0, .1, 2.6); instruct('');
  await wait(800 * Math.max(SPEED, .4));
  return {};
}

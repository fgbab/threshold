/* Objectives anchored in your room (AR): things to find around you, a mark that only comes together facing one way,
   writing on the ceiling or the floor, a wisp to follow, a figure you must not look at, turning around, sounds to track,
   stars to join in order, kneeling. Directions are angles around you, measured from where you faced when it began. */
import * as C from './core.js';
import { S, AUTO, SPEED, wait, until, clamp, ease, TAU, DEG, wrapPi, audio, buzz, instruct, g, W, H, hold, ring, monoText, glowText, basis, project, dirOf, angTo, fwdAz, pitchOf, aim, view, compass, chevron } from './core.js';
import * as G from './gfx.js';
import { keep, drop, hints, holdShot, playClip } from './kit.js';

const TOL = () => (S.easy >= 2 ? 15 : 10) * DEG;
function makeThing(it, scale = 1) {          // a glyph, a door mark, a word or a framed painting, floating in the room
  if (it.kind === 'label') return G.label(it.text, { size: 96, worldHeight: .3 * scale });
  if (it.kind === 'door') return G.doorway(1.9 * scale);
  if (it.kind === 'frame') {
    const grp = new G.THREEjs.Group(), fr = G.sigil([{ l: [10, 6, 90, 6] }, { l: [90, 6, 90, 94] }, { l: [90, 94, 10, 94] }, { l: [10, 94, 10, 6] }, { l: [18, 14, 82, 14] }, { l: [82, 14, 82, 86] }, { l: [82, 86, 18, 86] }, { l: [18, 86, 18, 14] }], .62 * scale, { sparks: false, glow: 1.2 });
    const art = G.sigil(it.glyph, .34 * scale, { sparkCount: 40, glow: 1.6 }); grp.add(fr.group, art.group);
    return { group: grp, alpha(a) { fr.alpha(a); art.alpha(a); }, burst: n => art.burst(n) };
  }
  return G.sigil(it.glyph != null ? it.glyph : it.mark, .42 * scale, { sparkCount: 60 });
}

/* --------------------------------------------------------------------- */
/* find things floating around you. { items: [{ kind, glyph|mark|text, az, el, dist, reveal }], compass: bool }   */
export async function anchor(o = {}) {
  C.unfreeze();
  const B0 = basis(), az0 = o.fromDoor && S.doorAz0 != null ? S.doorAz0 : fwdAz(B0), toAz = o.compass ? compass() : (deg => az0 + deg * DEG);
  const things = o.items.map(it => {
    const obj = keep(makeThing(it, it.scale || 1)), az = toAz(it.az), el = (it.el || 0) * DEG, dist = it.dist || 2.8;
    G.placeAt(obj.group, az, el, dist); if (it.kind === 'label') G.billboard(obj); else G.faceViewer(obj.group);
    if (obj.alpha) obj.alpha(.9);
    return { ...it, obj, az, el, dist, d: dirOf(az, el), t: 0, got: false };
  });
  let done = false, count = 0, fig = null;
  if (o.figure) { fig = keep(G.figure(1.8)); fig.at(az0 + Math.PI, -.08, 3.4); G.billboard(fig); G.hazy(fig); fig.alpha(.9); }
  S.stage = { draw(now, dt) {
    const B = basis(), tol = TOL();
    things.forEach(t => {
      if (t.got) return;
      const a = angTo(B, t.d);
      t.t = a < tol ? t.t + dt : Math.max(0, t.t - dt * 2);
      if (t.obj.group.rotation && t.kind !== 'label' && t.kind !== 'door') t.obj.group.rotation.z = Math.sin(now / 1100 + t.az) * .2;
      if (a < tol * 2.4) { const p = project(t.d, B); if (p) ring(p[0], p[1], 40, t.t / .8, .9); }
      if (t.t > .8) {
        t.got = true; count++; audio.bell(392 + count * 80, 0, .1, 3); buzz(30); if (t.obj.burst) t.obj.burst(110);
        if (t.reveal) { const lb = keep(G.label(t.reveal, { size: 96, worldHeight: .26 })); G.placeAt(lb.group, t.az, t.el - .2, t.dist * .96); G.billboard(lb); }
        if (o.onFind) o.onFind(t, count);
        if (count >= (o.need || things.length)) done = true;
      }
    });
    if (fig && angTo(B, dirOf(az0 + Math.PI, 0)) < .3 && now - (fig.seen || 0) > 4000) { fig.seen = now; G.glass.glitch(300); audio.whisper(0, 1, .07); }
    if (S.easy >= 2) { const n = things.find(t => !t.got); if (n && !project(n.d, B)) chevron(B, n.d, now, .5); }
    if (AUTO && !done) { const n = things.find(t => !t.got); if (n) aim(n.az, n.el, dt, 1.6); }
  } };
  instruct(o.text || 'Look around you.', o.small || 'Center each one until it answers');
  const stop = hints(o);
  await holdShot(3200);
  await until(() => done);
  stop(); instruct('');
  await wait(1600 * Math.max(SPEED, .4));
  return { found: things.map(t => t.reveal || t.text) };
}

/* --------------------------------------------------------------------- */
/* a mark that only comes together facing one way. { bearing (degrees from north), mark, hold, figure }            */
export async function align(o = {}) {
  C.unfreeze();
  const toAz = compass(), az = toAz(o.bearing == null ? 270 : o.bearing), el = (o.el || 4) * DEG, d = dirOf(az, el);
  const s = keep(G.sigil(o.mark, .9, { sparkCount: 120 })); G.placeAt(s.group, az, el, 3); G.faceViewer(s.group); s.set(0);
  let fig = null; if (o.figure !== false) { fig = keep(G.figure(1.85)); fig.at(az + Math.PI, -.06, 2.6); G.billboard(fig); G.hazy(fig); fig.alpha(.9); }
  let k = 0, holdT = 0, done = false, figGone = 0;
  S.stage = { draw(now, dt) {
    const B = basis(), ang = angTo(B, d), up = [0, 0, 1], f = B.fwd, kk = dot3(up, f), pu = norm3([-kk * f[0], -kk * f[1], 1 - kk * f[2]]), roll = Math.acos(clamp(dot3(pu, B.up), -1, 1));
    const tol = (S.easy ? 40 : 26) * DEG, rollTol = (S.easy ? 80 : 55) * DEG;
    const want = done ? 1 : clamp(1 - ang / tol, 0, 1) * Math.sqrt(clamp(1 - roll / rollTol, 0, 1));
    k += (want - k) * Math.min(1, dt * 4); s.set(ease(k)); s.glow(1.2 + k * 1.4);
    if (!done) audio.bed('whisper', .012 + .1 * Math.pow(1 - ang / Math.PI, 4));
    if (!done) { if (k > .9) { holdT += dt; if (holdT > (o.hold || 3)) done = true; } else holdT = Math.max(0, holdT - dt * 2); }
    if (fig && now > figGone) { const fa = angTo(B, dirOf(az + Math.PI, 0)); if (fa < .25) { figGone = now + 6000; G.glass.glitch(260); audio.whisper(0, .9, .07); fig.alpha(0); setTimeout(() => fig.alpha(.9), 5500); } }
    if (k > .9 && fig) G.glass.dread(.2 + holdT / (o.hold || 3) * .5, 200);
    if (S.easy > 1 && !project(d, B)) chevron(B, d, now, .35);
    if (AUTO && !done) aim(az, el, dt, 1.1);
  } };
  const noCompass = !C.virtual() && C.sensor.heading == null && !C.sensor.absolute;   // some browsers hide the compass
  if (noCompass) S.easy = 1;
  instruct(o.text || 'Turn slowly.', noCompass ? 'This browser hides the compass: open the sensor check in settings' : (C.sensor.accuracy != null && (C.sensor.accuracy < 0 || C.sensor.accuracy > 30)) ? 'Move the phone in a figure-eight to wake the compass' : (o.small || 'It comes together only one way'));
  const stop = hints(o);
  await holdShot(3200);
  await until(() => done);
  stop(); audio.bed('whisper', null); audio.whisper(0, 1.4, .09, .8); audio.open(); buzz([40, 40, 80]); s.burst(160); G.glass.dread(.12, 1500);
  await wait(2200 * Math.max(SPEED, .4));
  return {};
}
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm3 = a => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };

/* --------------------------------------------------------------------- */
/* writing on the ceiling or the floor. { dir: 'up'|'down', lines, effect: 'stars'|'bells'|'chalk'|'pin' }        */
export async function look(o = {}) {
  C.unfreeze();
  const up = o.dir !== 'down', az0 = fwdAz(basis()), el = (up ? 76 : -72) * DEG, objs = [];
  o.lines.forEach((l, i) => { const lb = keep(G.label(l, { size: 92, worldHeight: .22 })); G.placeAt(lb.group, az0, el + (up ? -1 : 1) * i * .1, 2.4); G.billboard(lb); lb.alpha(0); objs.push(lb); });
  if (o.effect === 'stars') { const st = keep({ group: G.particles({ count: 380, at: () => { const a = Math.random() * TAU, e = (40 + Math.random() * 50) * DEG, d = dirOf(a, e); return [d[0] * 5, d[1] * 5, d[2] * 5]; }, drift: () => [0, 0, 0], size: 2.4, life: 6, alpha: 1, boost: 2.2, color: [1, .9, .75] }) }); objs.push({ alpha() {} }); }
  if (o.effect === 'bells') [-.5, .5].forEach(dx => { const b = keep(G.sigil(11, .8, { sparkCount: 50 })); G.placeAt(b.group, az0 + dx, 70 * DEG, 3); G.faceViewer(b.group); b.alpha(0); objs.push(b); b.swing = dx; });
  if (o.effect === 'chalk' || o.effect === 'mark') { const m = keep(G.sigil(o.glyph || 'chalk', .8, { sparkCount: 50, glow: 1.4 })); G.placeAt(m.group, az0, -78 * DEG, 2.2); G.faceViewer(m.group); m.alpha(0); objs.push(m); }
  if (o.effect === 'pin') { const m = keep(G.sigil(2, .5, { sparkCount: 40 })); G.placeAt(m.group, az0, -60 * DEG, 2.2); G.faceViewer(m.group); m.alpha(0); objs.push(m); }
  let p = 0, read = 0;
  S.stage = { draw(now, dt) {
    const B = basis(), pt = pitchOf(B), ok = up ? pt > 55 * DEG : pt < -50 * DEG;
    p = clamp(p + (ok || (S.easy >= 2 && hold.on) ? dt / 1.4 : -dt * .4), 0, 1); if (p >= 1) read += dt;
    objs.forEach((ob, i) => { if (ob.alpha) ob.alpha(clamp(p * 1.6 - i * .2, 0, 1)); if (ob.swing && ob.group) ob.group.rotation.z = Math.sin(now / 700 + ob.swing * 3) * .25; });
    if (!ok && p < .1) { const arrow = up ? -1 : 1; monoText(up ? '↑' : '↓', W / 2, H / 2 + arrow * H * .3, 22, .4 + .3 * Math.sin(now / 300)); }
    if (AUTO) aim(az0, up ? 1.35 : -1.3, dt, 1.4);
  } };
  instruct(o.text || (up ? 'Look up.' : 'Look at the floor.'), o.small);
  const stop = hints(o);
  await holdShot(3400);
  await until(() => read > (AUTO ? .3 : (o.read || 3.2)));
  stop(); audio.bell(up ? 880 : 196, 0, .1, 3); instruct('');
  await wait(900 * Math.max(SPEED, .4));
  return { lines: o.lines };
}

/* --------------------------------------------------------------------- */
/* follow the wisp as it circles you. { secs, speed (rad/s), el }                                                    */
export async function orbit(o = {}) {
  C.unfreeze();
  const az0 = fwdAz(basis()), wisp = keep(G.glow(.32, [3, 2.1, 1.1], .3)); G.billboard(wisp);
  const trail = keep({ group: G.particles({ count: 80, at: () => [0, 0, 0], drift: () => [(Math.random() - .5) * .2, (Math.random() - .5) * .2, -Math.random() * .2], spread: .4, size: 3, life: 1.2, boost: 2.6 }) });
  const fig = keep(G.figure(1.8)); G.billboard(fig); G.hazy(fig); fig.alpha(0);
  let t = 0, p = 0, lost = 0, waz = az0 + .4, wel = 0;
  const need = (o.secs || 12) * (AUTO ? .25 : 1);
  S.stage = { draw(now, dt) {
    const B = basis(), d = dirOf(waz, wel), a = angTo(B, d), on = a < (S.easy ? 20 : 13) * DEG;
    if (on || lost < 4) t += dt;
    waz = az0 + .4 + t * (o.speed || .55) * (1 + .25 * Math.sin(t * .7)); wel = ((o.el || 8) + 10 * Math.sin(t * .9)) * DEG;
    G.placeAt(wisp.group, waz, wel, 2.6); trail.group.position.copy(wisp.group.position);
    if (on) { p = clamp(p + dt / need, 0, 1); lost = 0; } else { lost += dt; p = Math.max(0, p - dt * .05); }
    fig.at(waz + .25, -.08, 3); fig.alpha(lost > 4 ? Math.min(.9, (lost - 4) * .5) : Math.max(0, fig.mat.uniforms.alpha.value - dt));
    if (lost > 4 && Math.random() < dt * .4) audio.whisper(0, .8, .06);
    const pp = project(d, B); if (pp) ring(pp[0], pp[1], 30, p, .9); else chevron(B, d, now, .7);
    if (AUTO) aim(waz, wel, dt, 2.2);
  } };
  instruct(o.text || 'Follow the light.', o.small || 'Keep it in the middle');
  const stop = hints(o);
  await holdShot(3200);
  await until(() => p >= 1);
  stop(); audio.bell(784, 0, .1, 2.6); instruct('');
  await wait(700 * Math.max(SPEED, .4));
  return {};
}

/* --------------------------------------------------------------------- */
/* don't look at it: keep the figure out of view while it moves around you. { secs }                               */
export async function avoid(o = {}) {
  C.unfreeze();
  const az0 = fwdAz(basis()), fig = keep(G.figure(1.85)); G.billboard(fig); G.hazy(fig); fig.alpha(.92);
  let faz = az0 + Math.PI * .7, next = 0, p = 0, caught = 0;
  const need = (o.secs || 15) * (AUTO ? .2 : 1);
  S.stage = { draw(now, dt) {
    const B = basis(), d = dirOf(faz, 0), a = angTo(B, d);
    if (now > next) { next = now + 2600 + Math.random() * 2400; const cur = fwdAz(B); faz = cur + (Math.random() < .5 ? 1 : -1) * (.9 + Math.random() * 1.6); G.glass.glitch(160); audio.whisper(0, 1, .06, Math.sin(wrapPi(faz - cur))); }
    fig.at(faz, -.06, 3);
    if (a > 34 * DEG) p = clamp(p + dt / need, 0, 1);
    if (a < 17 * DEG && now - caught > 2600) { caught = now; p = Math.max(0, p - .5); G.glass.scare(); instruct('You looked.', 'Don’t look at it'); }
    G.glass.dread(.25 + .5 * clamp(1 - a / Math.PI, 0, 1), 300);
    ring(W / 2, H * .5, 26, p, .7);
    if (AUTO) aim(faz + Math.PI, 0, dt, 2.5);
  } };
  instruct(o.text || 'Don’t look at it.', o.small || 'It moves when you aren’t looking');
  const stop = hints(o);
  await holdShot(3200);
  await until(() => p >= 1);
  stop(); fig.dissolve(1); G.glass.dread(.12, 1500); instruct('');
  await wait(900 * Math.max(SPEED, .4));
  return {};
}

/* --------------------------------------------------------------------- */
/* turn around in place. { turns: 3 }                                                                               */
export async function turn(o = {}) {
  C.unfreeze();
  let lastAz = fwdAz(basis()), acc = 0, flash = 0, fazF = 0;
  const need = (o.turns || 3) * TAU, fig = keep(G.figure(1.8)); G.billboard(fig); fig.alpha(0);
  S.stage = { draw(now, dt) {
    const B = basis(), az = fwdAz(B), dA = wrapPi(az - lastAz); lastAz = az; acc += dA;
    const f = clamp(Math.abs(acc) / need, 0, 1), n = Math.floor(Math.abs(acc) / TAU);
    if (now > flash && Math.random() < dt * .6) { flash = now + 2000; fazF = az + (Math.random() < .5 ? 1 : -1) * .45; fig.at(fazF, -.06, 2.6); fig.alpha(.9); setTimeout(() => fig.alpha(0), 160); audio.breath(0, .05, 1, 700); }
    g.save(); g.strokeStyle = 'rgba(240,203,134,.9)'; g.lineWidth = 3; g.shadowColor = 'rgba(255,205,130,.9)'; g.shadowBlur = 14; g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * .42, -Math.PI / 2, -Math.PI / 2 + TAU * f); g.stroke(); g.restore();
    monoText(n + ' / ' + (o.turns || 3), W / 2, H / 2, 14, .85);
    if (AUTO) view.yaw += dt * 3.2;
  } };
  instruct(o.text || 'Turn around ' + (o.turns || 3) + ' times.', o.small || 'Don’t stop');
  const stop = hints(o);
  await holdShot(3200);
  await until(() => Math.abs(acc) >= need);
  stop(); audio.thump(0, .5); buzz(40); instruct('');
  await wait(900 * Math.max(SPEED, .4));
  return {};
}

/* --------------------------------------------------------------------- */
/* something in the room is making a sound: find it, look at it, listen. { clip, glyph, az, el, bed }             */
export async function listen(o = {}) {
  C.unfreeze();
  const az0 = fwdAz(basis()), az = az0 + (o.az == null ? 140 : o.az) * DEG, el = (o.el || 0) * DEG, d = dirOf(az, el);
  const src = keep(G.sigil(o.glyph || 'radio', .5, { sparkCount: 70, glow: 1.5 })); G.placeAt(src.group, az, el, 2.6); G.faceViewer(src.group);
  let t = 0, playing = false;
  S.stage = { draw(now, dt) {
    const B = basis(), a = angTo(B, d);
    if (!playing) { audio.bed(o.bed || 'static', .006 + .07 * Math.pow(1 - a / Math.PI, 3)); t = a < TOL() * 1.3 ? t + dt : Math.max(0, t - dt * 2); }
    const p = project(d, B); if (p && !playing) ring(p[0], p[1], 44, t / 1.2, .9);
    src.group.rotation.z = Math.sin(now / 500) * .06;
    if (S.easy >= 2 && !p) chevron(B, d, now, .5);
    if (AUTO && !playing) aim(az, el, dt, 1.6);
  } };
  instruct(o.text || 'Something in the room is making a sound.', o.small || 'Find it');
  const stop = hints(o);
  await holdShot(3200);
  await until(() => t > 1.2);
  stop(); playing = true; audio.bed(o.bed || 'static', null); src.burst(60);
  await playClip(o.clip);
  instruct(''); await wait(600);
  return { clip: o.clip };
}

/* --------------------------------------------------------------------- */
/* stars to join in order. { items: [{ text, az, el }], order: ['L','E','N','A'] }                                  */
export async function sequence(o = {}) {
  C.unfreeze();
  const az0 = o.fromDoor && S.doorAz0 != null ? S.doorAz0 : fwdAz(basis());
  const stars = o.items.map(it => {
    const az = az0 + it.az * DEG, el = it.el * DEG, gl = keep(G.glow(.3, [3, 2.4, 1.6], .5)); G.placeAt(gl.group, az, el, 3); G.billboard(gl);
    const lb = keep(G.label(it.text, { size: 90, worldHeight: .2 })); G.placeAt(lb.group, az, el - .09, 2.95); G.billboard(lb); lb.alpha(.85);
    return { ...it, az, el, d: dirOf(az, el), t: 0 };
  });
  let k = 0, done = false; const joined = [];
  S.stage = { draw(now, dt) {
    const B = basis(), tol = TOL();
    stars.forEach(s => { const a = angTo(B, s.d); s.t = a < tol ? s.t + dt : 0;
      if (s.t > .8 && !done) { s.t = -2; if (s.text === o.order[k]) { joined.push(s); k++; audio.bell(440 + k * 120, 0, .1, 2.6); buzz(25); if (k >= o.order.length) done = true; } else if (!joined.includes(s)) { k = 0; joined.length = 0; G.glass.glitch(300); audio.whisper(0, 1, .08); instruct('Wrong star.', 'Start again'); } } });
    g.save(); g.strokeStyle = 'rgba(240,203,134,.95)'; g.lineWidth = 2; g.shadowColor = 'rgba(255,205,130,.95)'; g.shadowBlur = 16; g.beginPath();
    joined.forEach((s, i) => { const p = project(s.d, B); if (p) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); } }); g.stroke(); g.restore();
    stars.forEach(s => { if (s.t > 0) { const p = project(s.d, B); if (p) ring(p[0], p[1], 26, s.t / .8, .9); } });
    if (AUTO && !done) { const want = stars.find(s => s.text === o.order[k]); if (want) aim(want.az, want.el, dt, 1.8); }
  } };
  instruct(o.text || 'Join her stars.', o.small || 'Look at each one, in order');
  const stop = hints(o);
  await holdShot(3400);
  await until(() => done);
  stop(); audio.open(); G.glass.flash([1, .9, .7], 900, .35); instruct('');
  await wait(1600 * Math.max(SPEED, .4));
  return {};
}

/* --------------------------------------------------------------------- */
/* kneel: the glass close to the floor, looking down, perfectly still. { secs }                                     */
export async function kneel(o = {}) {
  C.unfreeze();
  let p = 0;
  const need = (o.secs || 8) * (AUTO ? .2 : 1);
  S.stage = { draw(now, dt) {
    const B = basis(), down = pitchOf(B) < -50 * DEG || (S.easy >= 2 && hold.on), still = AUTO || (C.camOK ? C.vis.diff < C.stillThr() + 2 : true) && !C.shaken();
    p = clamp(p + (down && still ? dt / need : -dt * .3), 0, 1);
    if (down && Math.random() < dt * .3) audio.whisper(0, 1.2, .04 + p * .05, (Math.random() - .5) * 2);
    ring(W / 2, H / 2, Math.min(W, H) * .16, p, .8);
    if (AUTO) aim(fwdAz(B), -1.2, dt, 1.4);
  } };
  instruct(o.text || 'Kneel.', o.small || 'Glass to the floor. Still');
  const stop = hints(o);
  await holdShot(3000);
  await until(() => p >= 1);
  stop(); audio.toll(0, .12); instruct('');
  await wait(1200 * Math.max(SPEED, .4));
  return {};
}

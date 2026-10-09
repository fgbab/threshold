/* Objectives you play with the camera's eye: reading the room, the room maze, the eye in the light, blinking, darkness that
   shows words, colors, the lights going out, a real door's frame, pressing the glass to something, hiding, standing still. */
import * as C from './core.js';
import { S, AUTO, SPEED, wait, until, clamp, ease, TAU, audio, buzz, instruct, say, g, W, H, hold, ring, glowText, monoText, drawMark, GLYPH_CHAR, MO, basis, fwdAz, bot, tilt } from './core.js';
import * as G from './gfx.js';
import { keep, drop, hints, holdShot, sim, readRoom, MZ, BR, bfs, farCells, cellPx, playClip } from './kit.js';
import { snap } from './share.js';

const covered = () => ((!C.camOK || S.easy >= 1) && hold.on) || C.lensCovered();

/* --------------------------------------------------------------------- */
export async function scan(o = {}) {         // hold still while it reads your room; the room turns into a maze of gold
  C.unfreeze(); G.mazeView({ on: false });
  let p = 0;
  S.stage = { draw(now, dt) {
    const ok = !C.camOK || AUTO || C.vis.diff < C.stillThr() + (S.easy ? 3 : 0);
    p = clamp(p + (ok ? dt / (o.secs || 2.4) : -dt * .5), 0, 1);
    const y = ((now / 1500) % 1) * H, gr = g.createLinearGradient(0, y - 110, 0, y);
    gr.addColorStop(0, 'rgba(255,214,150,0)'); gr.addColorStop(1, 'rgba(255,214,150,.3)'); g.fillStyle = gr; g.fillRect(0, y - 110, W, 110);
    g.fillStyle = 'rgba(255,232,196,.95)'; g.fillRect(0, y, W, 1.2);
    ring(W / 2, H / 2, 30, p, .95);
  } };
  instruct(o.text || 'Hold the glass still.', o.small || 'Let it read your room');
  if (!o.internal) await holdShot(1800);
  await until(() => p >= 1);
  S.stage = null;
  if (!await readRoom(o.seed || 0)) { instruct('It can’t see anything. Turn on a light.'); await until(() => false); }
  C.freeze(); snap('room', true);
  G.mazeView({ on: true, lantern: [W / 2, H / 2], r: 3, scan: 0, gain: .8 });
  audio.bell(196, 0, .12, 3.4); audio.breath(.2, .03, 2, 1800); instruct('');
  const t0 = performance.now(); S.stage = { draw(now) { G.mazeView({ scan: clamp((now - t0) / 1700, 0, 1.2) }); } };
  await wait(2100 * Math.max(SPEED, .4));
  return {};
}

/* --------------------------------------------------------------------- */
/* the room maze: { collect: [{ glyph, label }], door: bool, fakes: n, hunter: bool, delay: s, speed, fog }       */
export async function maze(o = {}) {
  if (!MZ) await scan({ internal: true });
  C.freeze(false); G.mazeView({ on: true, scan: 2, r: o.fog || .26, gain: 1.25 });
  const items = o.collect || [], nDoors = (o.door ? 1 : 0) + (o.fakes || 0);
  const spots = farCells(items.length + nDoors, 13);
  const sx = MZ.start % MZ.gw, ball = { x: sx, y: (MZ.start - sx) / MZ.gw, vx: 0, vy: 0 }, home = { ...ball };
  const em = keep(G.ember(9), G.screen);
  let si = 0;
  const doors = [];
  if (o.door) doors.push({ ...spots[si++], real: true });
  for (let k = 0; k < (o.fakes || 0); k++) doors.push({ ...spots[si++], real: false, spin: (k % 2 ? -1 : 1) * (.5 + Math.random() * .4) });
  const things = items.map(it => ({ ...it, ...spots[si++], got: false }));
  doors.forEach(d => { d.obj = keep(G.sigil(0, 46, { thick: .026, sparkSize: 1.6, glow: 1.5 }), G.screen); d.obj.group.position.copy(G.px(...cellPx(d.x, d.y))); });
  things.forEach(t => { t.obj = keep(G.sigil(t.glyph, 30, { thick: .034, sparkSize: 1.5, glow: 1.6 }), G.screen); t.obj.group.position.copy(G.px(...cellPx(t.x, t.y))); });
  let hunter = null, field = null, ft = 0, rest = 0, beat = 0, gotN = 0, done = false, tm = null;
  const t0 = performance.now(), wakeAt = t0 + (o.delay || 25) * 1000 * (AUTO ? .1 : 1);
  const free = (x, y) => { const ix = Math.round(x), iy = Math.round(y); return ix >= 0 && iy >= 0 && ix < MZ.gw && iy < MZ.gh && MZ.ok[iy * MZ.gw + ix] === 1; };
  const wakeHunter = (x, y, boost = 0) => {
    if (!o.hunter) return;
    if (!hunter) { hunter = { x, y, sx: x, sy: y, speed: AUTO ? 3 : (o.speed || 6.5), obj: keep(G.blob(78), G.screen) }; hunter.obj.alpha(1); audio.breath(0, .07, 2.2, 450); audio.whisper(.4, 1.2, .07); }
    hunter.speed = Math.min(hunter.speed + boost, AUTO ? 3 : 11.5);
  };
  let path = [], pathFor = -1, pathT = 0;
  const target = () => { const t = things.find(q => !q.got); if (t) return t; const d = doors.find(q => q.real); return d || null; };
  function steer(now) {                      // the self-test's pilot follows the shortest route to the next thing
    const t = target(); if (!t) return;
    const key = t.y * MZ.gw + t.x;
    if (pathFor !== key || now - pathT > 1200) {
      const s = Math.round(ball.y) * MZ.gw + Math.round(ball.x), r = bfs(MZ.ok, MZ.gw, MZ.gh, MZ.ok[s] ? s : MZ.start);
      path = []; for (let i = key; i >= 0 && r.dist[i] >= 0; i = r.prev[i]) path.push(i); path.reverse(); pathFor = key; pathT = now;
    }
    if (!path.length) return;
    let bi = 0, bd = 1e9; path.forEach((i, k) => { const x = i % MZ.gw, y = (i - x) / MZ.gw, d = Math.hypot(x - ball.x, y - ball.y); if (d < bd) { bd = d; bi = k; } });
    const n = path[Math.min(path.length - 1, bi + 5)], tx = n % MZ.gw, ty = (n - tx) / MZ.gw, dx = tx - ball.x, dy = ty - ball.y, m = Math.hypot(dx, dy) || 1;
    bot.x = clamp(dx / m - ball.vx * .012, -1, 1); bot.y = clamp(dy / m - ball.vy * .012, -1, 1);
  }
  const base = clamp(C.sensor.beta, 15, 75);
  function step(dt, now) {
    const t = tilt(base);
    const acc = AUTO ? 110 : 48, vmax = AUTO ? 60 : 28;                     // the self-test's pilot is quicker than a hand
    ball.vx += t.x * acc * dt; ball.vy += t.y * acc * dt;
    const f = Math.pow(.3, dt); ball.vx *= f; ball.vy *= f;
    const sp = Math.hypot(ball.vx, ball.vy); if (sp > vmax) { ball.vx *= vmax / sp; ball.vy *= vmax / sp; }
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) * dt / .35));
    for (let s = 0; s < steps; s++) {
      const nx = ball.x + ball.vx * dt / steps, ny = ball.y + ball.vy * dt / steps;
      if (free(nx, ny)) { ball.x = nx; ball.y = ny; }
      else if (free(nx, ball.y)) { ball.x = nx; if (Math.abs(ball.vy) > 4) audio.tick(.03); ball.vy *= -.2; }
      else if (free(ball.x, ny)) { ball.y = ny; if (Math.abs(ball.vx) > 4) audio.tick(.03); ball.vx *= -.2; }
      else { if (sp > 4) { audio.tick(.04); buzz(8); } ball.vx *= -.25; ball.vy *= -.25; break; }
    }
    for (const t2 of things) if (!t2.got && Math.hypot(ball.x - t2.x, ball.y - t2.y) < 3.4) {
      t2.got = true; gotN++; audio.bell(523.3 + gotN * 98, 0, .1, 2.8); buzz(25); t2.obj.burst(90);
      if (t2.label != null) { const lb = keep(G.label(String(t2.label), { size: 84 }), G.screen); lb.group.position.copy(G.px(...cellPx(t2.x, t2.y))).add(new G.THREEjs.Vector3(0, 46, 0)); t2.lb = lb; }
      if (o.onCollect) o.onCollect(t2, gotN);
    }
    for (const d of doors) {
      if (d.gone || Math.hypot(ball.x - d.x, ball.y - d.y) > 3.2) continue;
      if (d.real) { if (things.every(q => q.got)) done = true; else if (now - (d.warned || 0) > 4000) { d.warned = now; instruct('Not yet.', 'Gather everything first'); } continue; }
      d.gone = now; audio.whisper(0, 1.2, .08, d.x < MZ.gw / 2 ? -.6 : .6); audio.thump(0, .4); buzz([40, 30, 40]); G.glass.glitch(260);
      instruct('Not that one.', o.lineHint || ''); wakeHunter(d.x, d.y, 1.5); d.obj.burst(60); setTimeout(() => drop(d.obj), 500);
    }
    if (!o.door && things.length && things.every(q => q.got)) done = true;
  }
  function hunt(dt, now) {
    if (!hunter || now < rest) return;
    if (!field || now - ft > 220) { const s = Math.round(ball.y) * MZ.gw + Math.round(ball.x); if (MZ.ok[s]) field = bfs(MZ.ok, MZ.gw, MZ.gh, s).dist; ft = now; }
    const cx = Math.round(hunter.x), cy = Math.round(hunter.y); let bd = field ? field[cy * MZ.gw + cx] : -1, best = null;
    if (bd < 0) { const dx = ball.x - hunter.x, dy = ball.y - hunter.y, m = Math.hypot(dx, dy) || 1; hunter.x += dx / m * hunter.speed * dt; hunter.y += dy / m * hunter.speed * dt; }
    else { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= MZ.gw || y >= MZ.gh) continue; const v = field[y * MZ.gw + x]; if (v >= 0 && v < bd) { bd = v; best = [x, y]; } }
      if (best) { const dx = best[0] - hunter.x, dy = best[1] - hunter.y, m = Math.hypot(dx, dy) || 1, st = Math.min(m, hunter.speed * dt); hunter.x += dx / m * st; hunter.y += dy / m * st; } }
    const d = Math.hypot(ball.x - hunter.x, ball.y - hunter.y);
    if (d < 18 && now - beat > 1300) { beat = now; audio.heartbeat(); }
    G.glass.dread(clamp(1 - d / 40, 0, .8) * .8, 400);
    if (d < 3.4 && !AUTO) {                  // it found you
      G.glass.scare(); Object.assign(ball, home, { vx: 0, vy: 0 }); hunter.x = hunter.sx; hunter.y = hunter.sy; rest = now + 2600; field = null;
      instruct('It found you.', 'Back to the start'); clearTimeout(tm); tm = setTimeout(() => instruct(o.text, o.small), 3200);
    }
  }
  S.stage = { draw(now, dt) {
    if (dt > 0 && !S.shotHold) { if (AUTO) steer(now); step(dt, now); if (!hunter && now > wakeAt) { const src = doors.find(q => !q.real) || things.find(q => !q.got) || doors[0]; if (src) wakeHunter(src.x, src.y); } hunt(dt, now); }
    const bp = cellPx(ball.x, ball.y); em.at(...bp); G.mazeView({ lantern: bp });
    doors.forEach(d => { if (!d.gone && d.spin) d.obj.group.rotation.z = d.spin * now / 1000; });
    things.forEach((t2, k) => { if (!t2.got) t2.obj.group.rotation.z = Math.sin(now / 900 + k) * .3; else t2.obj.alpha(Math.max(.25, 1 - (now - (t2.gt || (t2.gt = now))) / 1500)); if (t2.lb) t2.lb.alpha(clamp(1 - (now - t2.gt - 1800) / 1200, .0, 1)); });
    if (hunter) hunter.obj.at(...cellPx(hunter.x, hunter.y));
    C.$('timer').textContent = C.fmtTime((now - t0) / 1000);
  } };
  instruct(o.text, o.small);
  const stop = hints(o);
  await holdShot(o.shotMs || 4200);
  await until(() => done);
  stop(); clearTimeout(tm); C.$('timer').textContent = '';
  audio.open(); buzz([30, 60, 30]); G.glass.dread(.12, 1200);
  const secs = (performance.now() - t0) / 1000;
  snap('maze');
  await wait(1400 * Math.max(SPEED, .5));
  return { got: things.map(t2 => t2.label), glyphs: things.map(t2 => t2.glyph), secs };
}

/* --------------------------------------------------------------------- */
/* the eye in the light: { hold, show: [glyphs] (the eye shows them one by one), small }                          */
export async function light(o = {}) {
  C.unfreeze();
  const ew = Math.min(W * .8, 340), cy = H * .45, e = keep(G.eye(ew), G.screen); e.at(W / 2, cy);
  let p = 0, open = 0, done = false;
  S.stage = { draw(now, dt) {
    const touch = (!C.camOK || S.easy >= 1) && hold.on, hit = touch || C.vis.lum.center > Math.max(176, C.vis.lum.mean + 40);
    if (!done) p = clamp(p + (hit ? dt / (o.hold || 2.4) : -dt * .4), 0, 1);
    open += ((done ? 1 : p * .3) - open) * Math.min(1, dt * 3);
    e.u.open.value = open; e.u.alpha.value = Math.max(clamp(p * 2.4, 0, 1), done ? 1 : 0); e.u.dilate.value = .2 + .4 * (1 - p);
    e.u.look.value.set(Math.sin(now / 1300) * .3 * (done ? 0 : 1), Math.cos(now / 1700) * .15 * (done ? 0 : 1));
    if (!done) ring(W / 2, cy, Math.min(W, H) * .21, p, .85);
    audio.drone(.1 + p * .1, 300 + p * 800, .3);
  } };
  instruct(C.camOK ? 'Hold the brightest thing in the circle.' : 'Press and hold.', o.small || 'Until it looks back');
  sim(500, () => { S.override = { lum: { center: 240, mean: 120 } }; });
  const stop = hints(o);
  await holdShot(3000);
  await until(() => p >= 1);
  stop(); done = true; audio.chord(); buzz(40); G.glass.flash([1, .82, .55], 700, .3); instruct('');
  if (o.show) {                              // it looks at each of them in turn
    for (let rep = 0; rep < 2; rep++) for (const gl of o.show) {
      const s = keep(G.sigil(gl, 56, { thick: .04, sparkSize: 2, glow: 2 }), G.screen); s.group.position.copy(G.px(W / 2, cy - ew * .55));
      audio.bell(660, 0, .08, 1.6); e.u.look.value.set((Math.random() - .5) * .6, .2);
      await wait(1150 * Math.max(SPEED, .3)); drop(s); await wait(250 * Math.max(SPEED, .3));
    }
  }
  await wait(900 * Math.max(SPEED, .4));
  return { shown: o.show };
}

/* --------------------------------------------------------------------- */
/* blink the eye: cover and uncover the lens in a rhythm; S = long (≥ .7 s), F = quick. { pattern: 'SSSFF' }       */
export async function blink(o = {}) {
  C.unfreeze();
  const ew = Math.min(W * .8, 340), cy = H * .45, e = keep(G.eye(ew), G.screen); e.at(W / 2, cy);
  let phase = 'find', pf = 0, refC = 200, cov = false, covT = 0, lastT = 0, seq = [], fails = 0, done = false, flare = 0;
  S.stage = { draw(now, dt) {
    const c = C.vis.lum.center, touch = (!C.camOK || S.easy >= 2) && hold.on;
    if (phase === 'find') {
      const hit = touch || c > Math.max(170, C.vis.lum.mean + 38); pf = clamp(pf + (hit ? dt / 1.2 : -dt * .5), 0, 1);
      e.u.open.value = pf; e.u.alpha.value = Math.max(.12, pf); ring(W / 2, cy, Math.min(W, H) * .21, pf, .8);
      if (pf >= 1) { phase = 'blink'; refC = Math.max(150, c); instruct(o.text || 'Make it blink.', o.small || 'The way she did'); }
      return;
    }
    const isCov = touch || (cov ? c < refC * .6 : c < refC * .45);
    if (isCov && !cov) { cov = true; covT = now; }
    else if (!isCov && cov) { cov = false; const d = now - covT; if (d > 110) { seq.push(d >= (AUTO ? 1100 : 700) ? 'S' : 'F'); lastT = now; audio.tick(.05); if (seq.length > 9) seq.shift(); } }
    if (!cov && seq.length && now - lastT > (AUTO ? 3600 : 2200) && !done) {
      if (seq.join('') === o.pattern) done = true;
      else { fails++; flare = now + 1100; seq = []; audio.whisper(0, 1, .08); audio.thump(0, .45); buzz([50, 40, 50]); G.glass.glitch(280); if (fails === 2 && o.hint2) instruct(o.hint2[0], o.hint2[1]); }
    }
    e.u.open.value += ((cov ? .02 : 1) - e.u.open.value) * Math.min(1, dt * 14); e.u.alpha.value = 1;
    e.u.anger.value = now < flare ? 1 : Math.max(0, e.u.anger.value - dt);
    const n = seq.length, sp = 26, x0 = W / 2 - (n - 1) * sp / 2, y = cy + ew * .42;
    g.save(); g.strokeStyle = g.fillStyle = '#F0CB86'; g.lineWidth = 3; g.lineCap = 'round'; g.shadowColor = 'rgba(255,205,130,.95)'; g.shadowBlur = 12;
    seq.forEach((s, i) => { const x = x0 + i * sp; if (s === 'S') { g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x + 8, y); g.stroke(); } else { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); } });
    g.restore();
  } };
  instruct(C.camOK ? 'Find the eye again.' : 'Press and hold.', 'Look at the light');
  if (AUTO) (async () => {                   // the self-test blinks like Lena did
    S.override = { lum: { center: 240, mean: 120 } }; await until(() => phase === 'blink'); await wait(400);
    seq = o.pattern.split(''); lastT = performance.now() - 5000;     // blinks with exact timing (timers drift in software rendering)
  })();
  const stop = hints(o);
  await holdShot(4200);
  await until(() => done);
  stop(); audio.open(); buzz([30, 40, 30]); G.glass.flash([1, .85, .6], 800, .4);
  await wait(1200 * Math.max(SPEED, .4));
  return { fails };
}

/* --------------------------------------------------------------------- */
/* cover the lens: words surface in the dark. { lines, small, text }                                              */
export async function dark(o = {}) {
  C.unfreeze();
  let p = 0, read = 0;
  S.stage = { draw(now, dt) {
    p = clamp(p + (covered() ? dt / 2.2 : -dt * .5), 0, 1); if (p >= 1) read += dt;
    const a = ease(p), size = Math.round(Math.min(W, 520) / 13.5);
    g.fillStyle = 'rgba(0,0,0,' + (a * .6) + ')'; g.fillRect(0, 0, W, H);
    o.lines.forEach((l, i) => glowText(l, W / 2, H * .42 + (i - (o.lines.length - 1) / 2) * size * 1.35, size, clamp(a * 1.5 - i * .3, 0, 1)));
    if (o.small) monoText(o.small.toUpperCase(), W / 2, H * .42 + o.lines.length * size * .68 + 34, 11, clamp(a * 1.6 - .9, 0, 1));
  } };
  instruct(C.camOK ? (o.text || 'Cover the camera with your hand.') : 'Press and hold.', o.hint);
  sim(500, () => { S.override = { lum: { center: 4, mean: 5 } }; });
  const stop = hints(o);
  await holdShot(3000);
  await until(() => read > (AUTO ? .3 : 2.8));
  stop(); audio.heartbeat(); instruct('');
  if (o.clip) await playClip(o.clip);
  await wait(1600 * Math.max(SPEED, .3));
  return { lines: o.lines };
}

/* --------------------------------------------------------------------- */
/* show it a color. { color: 'red', hold, effect: 'sea'|'bleed'|'none', reveal: [lines] }                          */
export async function color(o = {}) {
  C.unfreeze();
  let p = 0, done = false, rv = 0;
  S.stage = { draw(now, dt) {
    const name = C.vis.color.name, hit = !done && (name === o.color || (S.easy >= 2 && hold.on));
    if (!done) p = clamp(p + (hit ? dt / (o.hold || 2) : -dt * .6), 0, 1); else rv += dt;
    const R = Math.min(W, H) * .2, rgb = C.COLOR_RGB[name] || C.COLOR_RGB.none;
    if (!done) {
      g.save(); g.strokeStyle = 'rgba(' + rgb + ',' + (name === 'none' ? .3 : .9) + ')'; g.lineWidth = 1.5; g.shadowColor = 'rgba(' + rgb + ',.8)'; g.shadowBlur = 14; g.beginPath(); g.arc(W / 2, H / 2, R, 0, TAU); g.stroke(); g.restore();
      ring(W / 2, H / 2, R + 12, p, 1);
      if (name !== 'none' && name !== 'black') monoText(name.toUpperCase(), W / 2, H / 2 + R + 38, 11, .8, rgb);
    } else if (o.reveal) {
      const size = Math.round(Math.min(W, 520) / 14);
      o.reveal.forEach((l, i) => glowText(l, W / 2, H * .44 + (i - (o.reveal.length - 1) / 2) * size * 1.35, size, clamp(rv * .8 - i * .35, 0, 1)));
    }
  } };
  instruct(o.text || ('Show it something ' + o.color + '.'), o.small || 'Fill the circle with it');
  sim(600, () => { S.override = { color: o.color }; });
  const stop = hints(o);
  await holdShot(3000);
  await until(() => p >= 1);
  stop(); done = true; buzz(40); instruct('');
  if (o.effect === 'sea') { G.glass.water(1, 1800); audio.bed('sea', .12); G.glass.ripple(.5, .5, 1, 900); }
  else if (o.effect === 'bleed') { G.glass.flash([.9, .12, .08], 1200, .55); audio.shriek(.12); }
  else audio.chord();
  await wait((o.reveal ? 5200 : 1800) * Math.max(SPEED, .3));
  return {};
}

/* show it colors, in order. { colors: ['blue', 'red', 'white'] }                                                   */
export async function colorseq(o = {}) {
  C.unfreeze();
  let k = 0, p = 0, wrong = 0, done = false;
  S.stage = { draw(now, dt) {
    const name = C.vis.color.name, want = o.colors[k];
    if (!done) {
      if (name === want) { p = clamp(p + dt / 1.2, 0, 1); wrong = 0; if (p >= 1) { k++; p = 0; audio.bell(440 + k * 110, 0, .1, 2.4); buzz(30); if (k >= o.colors.length) done = true; } }
      else { p = Math.max(0, p - dt); if (k > 0 && name !== 'none' && name !== 'black' && name !== o.colors[k - 1]) { wrong += dt; if (wrong > 1.2) { k = 0; wrong = 0; G.glass.glitch(300); audio.whisper(0, 1, .08); instruct('Wrong.', 'Start again'); } } }
    }
    const R = Math.min(W, H) * .2, rgb = C.COLOR_RGB[name] || C.COLOR_RGB.none;
    g.save(); g.strokeStyle = 'rgba(' + rgb + ',' + (name === 'none' ? .3 : .9) + ')'; g.lineWidth = 1.5; g.shadowColor = 'rgba(' + rgb + ',.8)'; g.shadowBlur = 14; g.beginPath(); g.arc(W / 2, H / 2, R, 0, TAU); g.stroke(); g.restore();
    ring(W / 2, H / 2, R + 12, p, 1);
    for (let i = 0; i < o.colors.length; i++) { const x = W / 2 + (i - (o.colors.length - 1) / 2) * 30, y = H / 2 + R + 42; g.save(); g.fillStyle = i < k ? 'rgba(' + C.COLOR_RGB[o.colors[i]] + ',1)' : 'rgba(242,234,217,.2)'; g.shadowColor = 'rgba(255,205,130,.8)'; g.shadowBlur = i < k ? 12 : 0; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.restore(); }
  } };
  instruct(o.text || 'Show it her colors.', o.small || 'In the order she hung them');
  if (AUTO) (async () => { for (const c of o.colors) { S.override = { color: c }; const k0 = k; await until(() => k > k0); } })();
  const stop = hints(o);
  await holdShot(3000);
  await until(() => done);
  stop(); audio.open(); G.glass.flash([1, .85, .6], 800, .35);
  await wait(1500 * Math.max(SPEED, .4));
  return {};
}

/* --------------------------------------------------------------------- */
/* turn the room's lights off, then on: { times, show: 'figure'|'numerals', items: [{ az, el, text }] }            */
export async function flicker(o = {}) {
  C.unfreeze();
  const B0 = basis(), az0 = o.fromDoor && S.doorAz0 != null ? S.doorAz0 : fwdAz(B0);
  const fig = keep(G.figure(1.8)); fig.at(az0 + (o.figureAz || 0), -.08, 3.2); G.billboard(fig); G.hazy(fig); fig.alpha(0);
  const marks = (o.items || []).map(it => { const l = keep(G.label(it.text, { size: 90, worldHeight: .32 })); G.placeAt(l.group, az0 + it.az * C.DEG, it.el * C.DEG, 2.7); G.billboard(l); l.alpha(0); return l; });
  let base = 0, off = false, offT = 0, n = 0, done = false, warned = false;
  const need = o.times || 1;
  S.stage = { draw(now, dt) {
    const m = C.vis.lum.mean, touch = (!C.camOK || S.easy >= 1) && hold.on;
    if (!base) base = Math.max(1, m);
    if (base < 28 && !warned && !touch) { warned = true; instruct('Turn on a light first.', 'Then turn it off'); }
    if (!off) {
      base += (m - base) * .03;
      if (touch || (base >= 28 && m < Math.min(40, base * .35))) { if (!offT) offT = now; if (now - offT > 500) { off = true; offT = 0; audio.heartbeat(); if (o.show === 'figure') { fig.alpha(.95); audio.breath(0, .07, 2, 500); } marks.forEach(l => l.alpha(1)); } } else offT = 0;
    } else {
      if ((touch ? false : m > Math.max(30, base * .6)) || (!touch && !C.camOK)) { off = false; n++; fig.alpha(0); marks.forEach(l => l.alpha(0)); audio.tick(.06); if (n >= need) done = true; else instruct('Again.'); }
    }
  } };
  instruct(o.text || 'Turn off the lights in your room.', o.small || 'Then turn them back on');
  if (AUTO) (async () => { for (let i = 0; i < need; i++) { S.override = { lum: { center: 120, mean: 110 } }; await wait(700); S.override = { lum: { center: 5, mean: 6 } }; await until(() => off); S.override = { lum: { center: 120, mean: 110 } }; await until(() => !off); } })();
  const stop = hints(o);
  await holdShot(3000);
  await until(() => done);
  stop(); instruct('');
  await wait(900 * Math.max(SPEED, .4));
  return {};
}

/* --------------------------------------------------------------------- */
/* frame a real door: two strong vertical edges with the opening between them                                      */
function doorEdges() {
  const w = 64, h = Math.round(64 * H / W), d = C.grab(w, h); if (!d) return null;
  const L = new Float32Array(w * h); for (let i = 0, j = 0; i < L.length; i++, j += 4) L[i] = d.data[j] * .299 + d.data[j + 1] * .587 + d.data[j + 2] * .114;
  const col = new Float32Array(w), y0 = Math.round(h * .15), y1 = Math.round(h * .85);
  for (let y = y0; y < y1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; col[x] += Math.abs(L[i + 1] - L[i - 1]); }
  let mean = 0; for (const v of col) mean += v; mean /= w; let sd = 0; for (const v of col) sd += (v - mean) ** 2; sd = Math.sqrt(sd / w);
  let best = null, bs = 0;
  for (let a = 3; a < w * .48; a++) for (let b = Math.ceil(w * .52); b < w - 3; b++) {
    if (b - a < w * .22 || b - a > w * .8) continue;
    const s = Math.min(col[a], col[b]); if (s > mean + 1.4 * sd && s > bs) { bs = s; best = [a / w, b / w]; }
  }
  return best;
}
export async function frame(o = {}) {
  C.unfreeze();
  let p = 0, cur = null, t = 0;
  S.stage = { draw(now, dt) {
    t += dt; if (t > .15) { t = 0; const e = doorEdges() || (S.easy >= 2 ? [.2, .8] : null); cur = e ? (cur ? [cur[0] + (e[0] - cur[0]) * .4, cur[1] + (e[1] - cur[1]) * .4] : e) : null; }
    p = clamp(p + (cur ? dt / 1.6 : -dt * .5), 0, 1);
    if (cur) {
      const xa = cur[0] * W, xb = cur[1] * W, top = H * .14, bot2 = H * .86, a = .35 + .65 * ease(p);
      g.save(); g.strokeStyle = 'rgba(240,203,134,' + a + ')'; g.lineWidth = 2.2; g.shadowColor = 'rgba(255,205,130,.95)'; g.shadowBlur = 16;
      g.beginPath(); g.moveTo(xa, bot2); g.lineTo(xa, top); g.lineTo(xb, top); g.lineTo(xb, bot2); g.stroke();
      g.globalAlpha = a * .5; g.lineWidth = 1; g.beginPath(); g.moveTo(xa + 10, bot2); g.lineTo(xa + 10, top + 10); g.lineTo(xb - 10, top + 10); g.lineTo(xb - 10, bot2); g.stroke(); g.restore();
    }
    ring(W / 2, H / 2, 26, p, .9);
  } };
  instruct(o.text || 'Frame the door.', o.small || 'Both sides of it, top to bottom');
  if (AUTO) S.easy = 2;
  const stop = hints(o);
  await holdShot(3000);
  await until(() => p >= 1);
  stop(); audio.bell(220, 0, .12, 3.2); buzz(30); G.glass.flash([1, .85, .6], 600, .25);
  await wait(1200 * Math.max(SPEED, .4));
  return {};
}

/* --------------------------------------------------------------------- */
/* press the glass flat against something (dark and still): { secs, text, small }                                  */
export async function press(o = {}) {
  C.unfreeze();
  let p = 0, hb = 0;
  S.stage = { draw(now, dt) {
    const ok = covered() && !C.shaken();
    p = clamp(p + (ok ? dt / (o.secs || 2.6) : -dt * .7), 0, 1);
    if (p > .25 && now - hb > 1100 - p * 400) { hb = now; audio.heartbeat(); }
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(240,203,134,1)'; g.shadowColor = 'rgba(255,205,130,.9)'; g.shadowBlur = 14;
    for (let i = 0; i < 4; i++) { const k = (now / 1700 + i / 4) % 1; g.globalAlpha = (1 - k) * p * .6; g.lineWidth = 1.2; g.beginPath(); g.arc(W / 2, H * .45, 18 + k * Math.min(W, H) * .55, 0, TAU); g.stroke(); }
    g.restore(); ring(W / 2, H * .45, Math.min(W, H) * .2, p, 1);
  } };
  instruct(o.text || 'Press the glass flat against it.', o.small || 'Keep it there');
  sim(500, () => { S.override = { lum: { center: 3, mean: 3 } }; });
  const stop = hints(o);
  await holdShot(3000);
  await until(() => p >= 1);
  stop(); buzz(30); instruct('');
  if (o.clip) await playClip(o.clip);
  return {};
}

/* hide: cover the camera and don't move while it searches. { secs }                                               */
export async function hide(o = {}) {
  C.unfreeze();
  let p = 0, found = 0, steps = 0;
  const need = (o.secs || 12) * (AUTO ? .2 : 1);
  S.stage = { draw(now, dt) {
    const ok = covered() && !C.shaken();
    if (ok) p = clamp(p + dt / need, 0, 1);
    else if (p > .08 && now - found > 3000) { found = now; p = 0; G.glass.scare(); instruct('It saw you.', 'Hide again'); }
    if (ok && Math.random() < dt * 1.4) { steps++; if (o.sound === 'rattle') { if (steps % 3 === 0) audio.creak(0, .05, .5); else audio.knock(0, .12 + p * .15, .3); } else audio.step(0, .1 + p * .1, Math.sin(steps) * .8); }
    if (ok && Math.random() < dt * .25) audio.breath(0, .05 + p * .05, 1.6, 600, (Math.random() - .5) * 1.6);
    g.fillStyle = 'rgba(0,0,0,' + (ok ? .55 : 0) + ')'; g.fillRect(0, 0, W, H);
    ring(W / 2, H * .45, Math.min(W, H) * .18, p, .5);
  } };
  instruct(o.text || 'Hide.', o.small || 'Cover the glass. Don’t move');
  sim(500, () => { S.override = { lum: { center: 3, mean: 3 } }; });
  const stop = hints(o);
  await holdShot(3000);
  await until(() => p >= 1);
  stop(); audio.duck(.1, .3); await wait(1400 * Math.max(SPEED, .3)); audio.duck(1, 1); instruct('');
  return {};
}

/* --------------------------------------------------------------------- */
/* don't move: something walks toward you and only sees movement. { secs }                                         */
export async function still(o = {}) {
  C.unfreeze();
  const B0 = basis(), az0 = fwdAz(B0), fig = keep(G.figure(1.8)); G.billboard(fig); G.hazy(fig);
  let p = 0, lunge = 0, side = Math.random() < .5 ? -1 : 1;
  const need = (o.secs || 9) * (AUTO ? .2 : 1);
  S.stage = { draw(now, dt) {
    const ok = AUTO || (C.camOK ? C.vis.diff < C.stillThr() + (S.easy ? 2 : 0) : !hold.on) && !C.shaken();
    if (ok) p = clamp(p + dt / need, 0, 1);
    else if (p > .05 && now - lunge > 2500) { lunge = now; p = 0; G.glass.scare(); instruct('It saw you move.'); setTimeout(() => instruct(o.text || 'Don’t move.', o.small), 2000); }
    const dist = 6 - 4.6 * ease(clamp(p * 1.15, 0, 1)), pass = clamp((p - .87) / .13, 0, 1);
    fig.at(az0 + side * pass * .9, -.06, dist); fig.alpha(.95 * (1 - pass * .9));
    G.glass.dread(.15 + .6 * p * (1 - pass), 300);
    if (Math.random() < dt * (.3 + p)) audio.step(0, .05 + p * .12, side * pass);
  } };
  instruct(o.text || 'Don’t move.', o.small || 'It only sees what moves');
  const stop = hints(o);
  await holdShot(3000);
  await until(() => p >= 1);
  stop(); G.glass.dread(.12, 1500); instruct('');
  await wait(900 * Math.max(SPEED, .4));
  return {};
}

/* --------------------------------------------------------------------- */
/* step back and look: the room's edges in gold, and words gouged into the door. { lines }                         */
export async function scratch(o = {}) {
  C.unfreeze();
  let ok = 0;
  S.stage = { draw(now, dt) { const bright = C.vis.lum.mean > 18 && !C.lensCovered(), stl = AUTO || C.vis.diff < C.stillThr() + 3; ok = bright && stl ? ok + dt : 0; } };
  instruct(o.text || 'Step back. Look at the door.', o.small || 'Hold it in the glass');
  sim(400, () => { S.override = null; });
  await until(() => ok > 1);
  C.freeze(); G.mazeView({ on: true, lantern: [W / 2, H / 2], r: 3, scan: 0, gain: .7 }); audio.bell(164.8, 0, .12, 3.6); audio.breath(.2, .03, 2.2, 1600); instruct('');
  const t0 = performance.now(), jit = o.lines.map(() => [Math.random() * 6.28, Math.random() * 6.28]);
  S.stage = { draw(now) {
    G.mazeView({ scan: clamp((now - t0) / 1800, 0, 1.2) });
    const a = clamp((now - t0 - 1500) / 1600, 0, 1), size = Math.round(Math.min(W, 520) / 8.5);
    o.lines.forEach((l, i) => { for (let k = 0; k < 3; k++) glowText(l, W / 2 + Math.sin(jit[i][0] + k) * 1.6, H * .42 + (i - (o.lines.length - 1) / 2) * size * 1.1 + Math.cos(jit[i][1] + k) * 1.4, size, a * (k ? .35 : .9), 'italic 600', '246, 214, 150'); });
  } };
  await holdShot(3600);
  await wait(4200 * Math.max(SPEED, .4));
  snap('door'); audio.open(); buzz([40, 40, 80]);
  await wait(1800 * Math.max(SPEED, .4));
  return { lines: o.lines };
}

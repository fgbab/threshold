/* The doors that turn the glass toward you: a reflection that runs a little late, the reflection that stays when you
   move, and the calls that come from her phone. */
import * as C from './core.js';
import { S, AUTO, SPEED, wait, until, clamp, ease, TAU, audio, voice, buzz, instruct, say, g, W, H, hold, ring, drawMark, $ } from './core.js';
import * as G from './gfx.js';
import { keep, drop, hints, holdShot, sim, CLIPS } from './kit.js';
import { snap } from './share.js';

/* the late reflection: frames kept for 1.4 s and laid back over the live view; persists across objectives */
let R = null;
export function reflect(on) {
  if (!on) { if (R) { G.remove(R); R = null; } G.ghostLayer(null, { on: false, zoom: 1 }); return; }
  if (R) return R;
  const w = Math.round(W / 2), h = Math.round(H / 2), mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  R = { buf: Array.from({ length: 14 }, mk), ghost: mk(), bi: 0, n: 0, t: 0, frozen: false, twitch: 0,
    update(now) {
      if (this.frozen) { if (this.twitch && now > this.twitch) { this.twitch = now + 900 + Math.random() * 2600; G.ghostLayer(null, { off: [(Math.random() - .5) * .02, (Math.random() - .5) * .015], zoom: G.bgUniforms.ghostZoom.value + .012, ms: 90 }); setTimeout(() => G.ghostLayer(null, { off: [0, 0] }), 90); } return; }
      if (now - this.t < 100) return; this.t = now;
      const r = C.coverRect(); if (!r) return;
      const c = this.buf[this.bi]; c.getContext('2d').drawImage(C.srcEl(), r[0], r[1], r[2], r[3], 0, 0, w, h);
      this.bi = (this.bi + 1) % this.buf.length; this.n = Math.min(this.buf.length, this.n + 1);
      this.ghost.getContext('2d').drawImage(this.buf[this.n < this.buf.length ? 0 : this.bi], 0, 0);
      G.ghostLayer(this.ghost);
    } };
  G.add(R); G.ghostLayer(R.ghost, { on: true, alpha: .34, zoom: 1 });
  return R;
}

/* --------------------------------------------------------------------- */
/* look into the glass and hold still. { secs, overlay: 'behind' (someone over your shoulder) | 'mark' (a mark on you), mark } */
export async function mirror(o = {}) {
  reflect(true);
  const cx = W / 2, cy = H * .43, rx = Math.min(W * .36, 200), ry = rx * 1.34;
  let p = 0, shown = 0, last = 0;
  const need = (o.secs || 8) * (AUTO ? .25 : 1);
  let fig = null, mk = null;
  if (o.overlay === 'behind') { fig = keep(G.figure(H * .7), G.screen); fig.group.position.copy(G.px(W * .16, H * .5)); fig.alpha(0); }
  if (o.overlay === 'mark') { mk = keep(G.sigil(o.mark == null ? 12 : o.mark, Math.min(W, H) * .16, { sparkCount: 50, thick: .02 }), G.screen); mk.group.position.copy(G.px(W / 2, H * .3)); mk.alpha(0); }
  S.stage = { draw(now, dt) {
    const still = AUTO || (C.camOK ? C.vis.diff < C.stillThr() + (S.easy ? 2 : 0) : hold.on) && !C.shaken(), before = p;
    p = clamp(p + (still ? dt / need : -dt * .3), 0, 1);
    if (!still && p > 0 && now - last > 600) { last = now; audio.glitch(.035); }
    for (let k = 1; k <= 4; k++) if (before < k / 4 && p >= k / 4 && shown < k) { shown = k; audio.bell([392, 440, 493.9, 587.3][k - 1], 0, .1, 3.2); buzz(25); }
    const flick = still ? 1 : .35 + Math.random() * .4;
    g.save(); g.strokeStyle = '#F0CB86'; g.lineCap = 'round'; g.shadowColor = 'rgba(255,205,130,.95)'; g.shadowBlur = 16;
    g.globalAlpha = .26 * flick; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke();
    if (p > 0) { g.globalAlpha = flick; g.lineWidth = 2.4; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + TAU * p); g.stroke(); }
    g.restore();
    for (let k = 0; k < shown; k++) { const a = -Math.PI / 2 + k * Math.PI / 2; drawMark(k, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 40, .95 * flick, 16); }
    if (fig) fig.alpha(clamp(p * 1.3 - .25, 0, .75) * (.85 + .15 * Math.sin(now / 300)));
    if (mk) mk.alpha(clamp(p * 1.5 - .4, 0, 1));
  } };
  instruct(o.text || (C.camOK ? 'Hold still. Look into the glass.' : 'Press and hold.'), o.small || 'Your reflection is a little late');
  const stop = hints(o);
  await holdShot(3200);
  await until(() => p >= 1);
  stop(); instruct('');
  if (fig) { audio.breath(0, .08, 2, 500, -.6); await wait(900); fig.alpha(0); }
  await wait(600 * Math.max(SPEED, .4));
  return {};
}

/* --------------------------------------------------------------------- */
/* the reflection stays: freeze it, then make the player move and watch it not follow                               */
export async function freeze(o = {}) {
  reflect(true);
  if (!R.n) await wait(1600);
  instruct(''); audio.duck(0, .3); buzz(60);
  await wait(1500 * Math.max(SPEED, .4));
  R.frozen = true; R.ghost.getContext('2d').drawImage(R.buf[(R.bi + R.buf.length - 1) % R.buf.length], 0, 0); G.ghostLayer(R.ghost, { alpha: .68 });
  audio.duck(1, 1.4); audio.bell(110, 0, .14, 5); audio.breath(.1, .04, 3, 900);
  await wait(1000 * Math.max(SPEED, .5));
  instruct(C.camOK ? 'Now move.' : 'Now let go.');
  let mt = 0, moved = false;
  S.stage = { draw(now, dt) { const mv = AUTO ? now % 3000 > 1500 : C.camOK ? C.vis.diff > Math.max(4, C.vis.floor * 3 + 2) : !hold.on; mt = mv ? mt + dt : 0; if (mt > .35) moved = true; } };
  const t0 = performance.now();
  await holdShot(2600);
  await until(() => moved || performance.now() - t0 > 7000);
  S.stage = null; instruct('');
  await wait(1300 * Math.max(SPEED, .5));
  snap('glass');
  await say(o.after || ['It stayed.']);
  R.twitch = performance.now() + 1500; G.ghostLayer(null, { zoom: 1.06, ms: 6000 });   // and now it comes closer
  return {};
}

/* --------------------------------------------------------------------- */
/* her phone calls yours. { clip, who }                                                                               */
export async function call(o = {}) {
  const s = $('call'), st = $('callState'), cc = $('callCC'), btns = $('callBtns');
  $('callWho').textContent = o.who || 'Player Four';
  s.hidden = false; st.textContent = 'Incoming call'; cc.textContent = ''; btns.hidden = false;
  let tries = 0, iv = null, result = null;
  const ringNow = () => { audio.ring(); buzz([300, 200, 300]); };
  const startRing = () => { ringNow(); iv = setInterval(ringNow, 2400); };
  const stopRing = () => clearInterval(iv);
  const listenTo = async () => {             // the call itself: captions on the call screen
    const c = CLIPS[o.clip]; btns.hidden = true; voice.unlock(); let sec = 0;
    const tm = setInterval(() => { sec++; st.textContent = '00:' + String(sec).padStart(2, '0'); }, 1000);
    c.play(); const timers = c.cc.map(([t, text]) => setTimeout(() => { cc.textContent = text; }, t * 1000 * (AUTO ? .1 : 1)));
    await wait(c.dur * 1000 * (AUTO ? .1 : 1)); timers.forEach(clearTimeout); clearInterval(tm); st.textContent = 'Call ended';
    await wait(1400 * Math.max(SPEED, .3));
  };
  await new Promise(res => {
    startRing();
    $('callYes').onclick = async () => { stopRing(); result = 'answered'; await listenTo(); res(); };
    $('callNo').onclick = async () => { stopRing(); tries++; st.textContent = 'Declined'; if (tries < 2) { await wait(1800); st.textContent = 'Incoming call'; startRing(); } else { result = 'voicemail'; st.textContent = '1 new voicemail'; await wait(1400); res(); } };
    if (AUTO && C.TEST.screen !== 'c') setTimeout(() => $('callYes').click(), 900);
  });
  s.hidden = true;
  return { call: result };
}

/* Locks you work with your hands: a dial you turn by turning the phone, a ring of numbers you touch, marks you draw on
   the glass (traced, from memory, in sequence, or your own). */
import * as C from './core.js';
import { S, AUTO, SPEED, wait, until, clamp, ease, TAU, DEG, audio, buzz, instruct, g, W, H, hold, ring, monoText, glowText, drawMark, markPoints, pen, basis, signedRoll, view } from './core.js';
import * as G from './gfx.js';
import { keep, drop, hints, holdShot, sim } from './kit.js';

/* --------------------------------------------------------------------- */
/* turn the glass like a dial; hold still on each number. { code: '174' }                                           */
export async function dial(o = {}) {
  C.unfreeze();
  const code = String(o.code), entered = [];
  let cur = 5, holdT = 0, fails = 0, done = false, flash = 0;
  S.stage = { draw(now, dt) {
    const roll = signedRoll(basis()), d = clamp(Math.round((roll / DEG + 90) / 20), 0, 9);
    if (d !== cur) { cur = d; holdT = 0; audio.tick(.04); } else holdT += dt;
    if (holdT > 1.3 && !done) {
      entered.push(cur); holdT = -1.2; audio.bell(330 + cur * 40, 0, .1, 2); buzz(25);
      if (entered.length === code.length) {
        if (entered.join('') === code) done = true;
        else { fails++; entered.length = 0; flash = now + 900; G.glass.glitch(320); audio.thump(0, .5); audio.whisper(0, 1.2, .08); instruct(fails >= 2 && o.hint2 ? o.hint2[0] : 'No.', fails >= 2 && o.hint2 ? o.hint2[1] : o.small); }
      }
    }
    const cx = W / 2, cy = H * .5, R = Math.min(W, H) * .34;
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '500 30px "Cormorant Garamond", Georgia, serif';
    for (let i = 0; i < 10; i++) {
      const a = Math.PI + (i / 9) * Math.PI, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * .9, on = i === cur;
      g.fillStyle = on ? (now < flash ? '#E26A55' : '#FFE0A0') : 'rgba(242,234,217,.35)'; g.shadowColor = 'rgba(255,205,130,.95)'; g.shadowBlur = on ? 22 : 0; g.fillText(String(i), x, y);
    }
    const a = Math.PI + (cur / 9) * Math.PI; g.strokeStyle = 'rgba(240,203,134,.9)'; g.lineWidth = 2; g.shadowBlur = 14; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R * .72, cy + Math.sin(a) * R * .72 * .9); g.stroke();
    g.restore();
    ring(cx, cy, 20, clamp(holdT / 1.3, 0, 1), .9);
    for (let i = 0; i < code.length; i++) { const x = cx + (i - (code.length - 1) / 2) * 34, y = cy + 70; glowText(entered[i] != null ? String(entered[i]) : '·', x, y, 30, entered[i] != null ? 1 : .35, '500'); }
    if (AUTO && !done) { const want = +code[entered.length]; view.roll += clamp((want * 20 - 90) * DEG - view.roll, -2 * dt, 2 * dt); }
  } };
  instruct(o.text || 'Turn the glass like a dial.', o.small || 'Hold still on each number');
  const stop = hints(o);
  await holdShot(3400);
  await until(() => done);
  stop(); view.roll = 0; audio.open(); G.glass.flash([1, .88, .6], 900, .45); buzz([40, 40, 80]); instruct('');
  await wait(1400 * Math.max(SPEED, .4));
  return { fails };
}

/* --------------------------------------------------------------------- */
/* a ring of numbers you touch. { code: '0305', ring: 'oval' (around a face) }                                      */
export async function code(o = {}) {
  C.unfreeze(false);
  const want = String(o.code); let entered = '', fails = 0, done = false, flash = 0;
  const cx = W / 2, cy = H * (o.ring === 'oval' ? .43 : .48), rx = Math.min(W * .36, 200) + 34, ry = o.ring === 'oval' ? rx * 1.34 : rx;
  const pos = i => { const a = -Math.PI / 2 + i / 10 * TAU; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; };
  const press = d => {
    if (done) return; entered += d; audio.tick(.06); buzz(12);
    if (entered.length === want.length) {
      if (entered === want) done = true;
      else { fails++; entered = ''; flash = performance.now() + 900; G.glass.scare(); if (o.onWrong) o.onWrong(fails); if (fails === 2 && o.hint2) instruct(o.hint2[0], o.hint2[1]); }
    }
  };
  S.tapHook = e => { for (let i = 0; i < 10; i++) { const [x, y] = pos(i); if (Math.hypot(e.clientX - x, e.clientY - y) < 28) { press(String(i)); break; } } };
  S.stage = { draw(now, dt) {
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '500 26px "Cormorant Garamond", Georgia, serif';
    for (let i = 0; i < 10; i++) { const [x, y] = pos(i); g.strokeStyle = 'rgba(240,203,134,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 20, 0, TAU); g.stroke(); g.fillStyle = now < flash ? '#E26A55' : '#F6D394'; g.shadowColor = 'rgba(255,205,130,.95)'; g.shadowBlur = 14; g.fillText(String(i), x, y + 1); }
    g.restore();
    for (let i = 0; i < want.length; i++) glowText(entered[i] || '_', cx + (i - (want.length - 1) / 2) * 30, cy + ry + 64, 28, entered[i] ? 1 : .4, '500');
  } };
  instruct(o.text || 'Open it.', o.small);
  if (AUTO) (async () => { await wait(800); for (const ch of want) { press(ch); await wait(300); } })();
  const stop = hints(o);
  await holdShot(3000);
  await until(() => done);
  stop(); S.tapHook = null; audio.open(); G.glass.flash([1, .9, .7], 1000, .5); buzz([40, 40, 80]); instruct('');
  await wait(1000 * Math.max(SPEED, .4));
  return { fails };
}

/* --------------------------------------------------------------------- */
/* drawing on the glass                                                                                              */
function resample(pts, n = 64) {             // evenly spaced points along a path
  if (pts.length < 2) return pts.slice();
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const step = len / (n - 1), out = [pts[0]]; let acc = 0, prev = pts[0];
  for (let i = 1; i < pts.length && out.length < n; i++) {
    let cur = pts[i], d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (acc + d >= step && out.length < n) { const t = (step - acc) / d, q = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]; out.push(q); prev = q; d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]); acc = 0; }
    acc += d; prev = cur;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}
function normalize(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const s = Math.max(x1 - x0, y1 - y0) || 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return pts.map(([x, y]) => [(x - cx) / s, (y - cy) / s]);
}
function chamfer(a, b) { const near = (p, set) => { let m = 1e9; for (const q of set) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])); return m; }; let s = 0; for (const p of a) s += near(p, b); for (const q of b) s += near(q, a); return s / (a.length + b.length); }
function strokesPts(strokes) { const all = []; for (const s of strokes) { const r = resample(s, Math.max(8, Math.round(64 * s.length / Math.max(1, strokes.reduce((n, t) => n + t.length, 0))))); all.push(...r); } return all; }
export function compare(strokes, mark) {     // how far a drawing is from a mark (0 = the same), size and position don't matter
  const a = normalize(strokesPts(strokes)), b = normalize(resample(markPoints(mark, 2), 96));
  return chamfer(resample(a, 96), b);
}
function drawStrokes(now) {
  g.save(); g.strokeStyle = '#F6D394'; g.lineWidth = 3; g.lineCap = g.lineJoin = 'round'; g.shadowColor = 'rgba(255,205,130,.95)'; g.shadowBlur = 16;
  for (const s of pen.strokes) { g.beginPath(); s.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
  g.restore();
}
/* draw a mark. { mark, show: true (faint guide) | false (from memory), free: true (your own mark), at: [x, y] (fractions), size } */
export async function draw(o = {}) {
  C.unfreeze(false);
  pen.on = true; pen.strokes = [];
  const cx = W * (o.at ? o.at[0] : .5), cy = H * (o.at ? o.at[1] : .45), size = Math.min(W, H) * (o.size || .62);
  let done = false, fails = 0, result = null, flash = 0;
  S.stage = { draw(now, dt) {
    if (o.show && !o.free) drawMark(o.mark, cx, cy, size, .22 + .08 * Math.sin(now / 600), 6);
    drawStrokes(now);
    if (now < flash) { g.fillStyle = 'rgba(180,40,30,' + (.25 * (flash - now) / 600) + ')'; g.fillRect(0, 0, W, H); }
    const lift = pen.strokes.length && !pen.cur && now - pen.last > (o.free ? 2200 : 1200);
    if (lift && !done) {
      const len = pen.strokes.reduce((n, s) => n + s.length, 0);
      if (o.free) { if (len > 40) { done = true; result = pen.strokes.map(s => s.map(([x, y]) => [Math.round((x - cx) / size * 100 + 50), Math.round((y - cy) / size * 100 + 50)])); } }
      else {
        const d = compare(pen.strokes, o.mark);
        if (d < (o.show ? .085 : .11) + S.easy * .02) done = true;
        else { fails++; flash = now + 600; pen.strokes = []; audio.whisper(0, .8, .06); G.glass.glitch(200); instruct(fails >= 3 && o.hint3 ? o.hint3[0] : 'Not that.', fails >= 3 && o.hint3 ? o.hint3[1] : o.small); }
      }
    }
  } };
  instruct(o.text || (o.free ? 'Make your mark.' : 'Draw the mark.'), o.small || (o.free ? 'Anything. It will be yours' : 'With one finger'));
  if (AUTO) (async () => { await wait(600); const pts = markPoints(o.free ? 0 : o.mark, 1).map(([x, y]) => [cx + (x - 50) / 100 * size, cy + (y - 50) / 100 * size]); pen.strokes = [pts]; pen.last = performance.now(); })();
  const stop = hints(o);
  await holdShot(3200);
  await until(() => done);
  stop(); pen.on = false; audio.open(); buzz([30, 40, 30]);
  if (!o.free) { const lit = keep(G.sigil(o.mark, size, { thick: .012, sparkCount: 90 }), G.screen); lit.group.position.copy(G.px(cx, cy)); lit.burst(120); }
  pen.strokes = []; S.stage = { draw() {} };
  await wait(1500 * Math.max(SPEED, .4));
  return { strokes: result };
}
/* draw several marks, one after another, in order. { marks: ['radio', 'brush', 'chalk', 'door'] }               */
export async function drawseq(o = {}) {
  C.unfreeze(false);
  pen.on = true; pen.strokes = [];
  const cx = W / 2, cy = H * .45, size = Math.min(W, H) * .56; let k = 0, done = false, flash = 0;
  S.stage = { draw(now, dt) {
    drawStrokes(now);
    for (let i = 0; i < o.marks.length; i++) { const x = W / 2 + (i - (o.marks.length - 1) / 2) * 30, y = cy + size * .62; g.save(); g.fillStyle = i < k ? '#F6D394' : 'rgba(242,234,217,.2)'; g.shadowColor = 'rgba(255,205,130,.9)'; g.shadowBlur = i < k ? 12 : 0; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); g.restore(); }
    if (now < flash) { g.fillStyle = 'rgba(180,40,30,' + (.25 * (flash - now) / 600) + ')'; g.fillRect(0, 0, W, H); }
    if (pen.strokes.length && !pen.cur && now - pen.last > 1400 && !done) {
      const scores = o.marks.map(m => compare(pen.strokes, m)), best = scores.indexOf(Math.min(...scores));
      if (best === k && scores[k] < .12 + S.easy * .02) { k++; audio.bell(440 + k * 110, 0, .1, 2.4); buzz(25); pen.strokes = []; if (k >= o.marks.length) done = true; }
      else { k = 0; pen.strokes = []; flash = now + 600; G.glass.glitch(260); audio.whisper(0, 1, .07); instruct('Not in that order.', o.small); }
    }
  } };
  instruct(o.text || 'Draw their marks.', o.small || 'In the order they were taken');
  if (AUTO) (async () => { for (const m of o.marks) { await wait(500); pen.strokes = [markPoints(m, 1).map(([x, y]) => [cx + (x - 50) / 100 * size, cy + (y - 50) / 100 * size])]; pen.last = performance.now(); await until(() => !pen.strokes.length || done); } })();
  const stop = hints(o);
  await holdShot(3200);
  await until(() => done);
  stop(); pen.on = false; pen.strokes = []; audio.open(); G.glass.flash([1, .9, .7], 900, .4); instruct('');
  await wait(1200 * Math.max(SPEED, .4));
  return {};
}

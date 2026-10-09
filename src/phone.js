/* Her phone: everything the player has found, kept where they can read it again. Her note (one line per door),
   the keyring (what each objective revealed), her voice memo, her last location, the last photo, her messages, calls. */
import { S, $, esc, saveP, ROMAN, AUTO, audio, voice, clamp, TAU, cards } from './core.js';
import { NOTE, DOORS } from './doors.js';
import { CLIPS } from './kit.js';
import { toast } from './share.js';

const TABS = { note: 'Note', keys: 'Keyring', memo: 'Voice memo', where: 'Location', photo: 'Photos', msgs: 'Messages', calls: 'Calls' };
const ORDER = ['note', 'keys', 'memo', 'where', 'photo', 'msgs', 'calls'];
export function found(id) {
  if (S.P.found.includes(id)) return;
  S.P.found.push(id); saveP(); $('evBtn').classList.add('new');
  if (!AUTO && id !== 'note') toast('Added to her phone: ' + TABS[id]);
}
export function addFrag(n, text) { if (!text) return; const f = S.P.frags[n] || (S.P.frags[n] = []); if (!f.includes(text)) { f.push(text); saveP(); $('evBtn').classList.add('new'); found('keys'); } }
export function addCall(clip, who, how) { if (!S.P.calls.find(c => c.clip === clip)) { S.P.calls.push({ clip, who, how }); saveP(); } found('calls'); }
export function flash(tab) { S.P.evHint = tab; const b = $('evBtn'); b.classList.add('new', 'flash'); setTimeout(() => b.classList.remove('flash'), 3200); }

const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const redact = s => [...s].map((c, i) => c === ' ' ? ' ' : i % 9 === 4 ? esc(c) : '▒░▓'[(i * 7 + c.charCodeAt(0)) % 3]).join('');
function noteHTML() {
  const open = clamp(S.doorN || S.P.door + 1, 1, 13);
  return '<div class="note">' + NOTE.map((t, i) => '<p><b>' + (i + 1) + '</b><span' + (i < open ? '>' + esc(t) : ' class="redact">' + redact(t)) + '</span></p>').join('') + '</div>';
}
function keysHTML() {
  const doors = Object.keys(S.P.frags).map(Number).sort((a, b) => b - a);
  if (!doors.length) return '<p class="fine">Nothing yet. What you find behind each door is kept here.</p>';
  return doors.map(n => '<div class="keyring"><p class="eyebrow">Door ' + ROMAN[n - 1] + ' · ' + esc(DOORS[n - 1].name) + '</p>' + S.P.frags[n].map(f => '<p class="frag">' + esc(f) + '</p>').join('') + '</div>').join('');
}
export const memoHTML = (cls = '') => '<div class="memo ' + cls + '" data-w="memo"><button class="play" type="button" aria-label="Play the voice memo">' + PLAY + '</button><div><canvas width="600" height="76"></canvas><div class="meta"><span>Voice memo · 03:01</span><button type="button" class="ccb">CC</button></div></div><p class="cc" hidden>[breathing] [tap] … [tap] … [tap] [tap tap] [someone else whispers]</p></div>';
export const whereHTML = (cls = '') => '<div class="map ' + cls + '" data-w="map"><canvas width="600" height="450"></canvas></div><p class="cap ' + cls + '">Last location · Valparaíso, Chile · 03:04</p>';
function photoHTML() { const d = new Date(); d.setFullYear(d.getFullYear() - 3); return '<figure class="photo"><img src="' + (cards.get('room') || 'room.jpg') + '" alt="The last photo on her phone"><figcaption class="cap">03:03 · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + '</figcaption></figure>'; }
function msgsHTML() {
  const door = S.doorN || S.P.door + 1, m = [['me', '02:58', 'The doors are not a game. They are a map.'], ['them', '02:59', 'Then follow it.']];
  if (door >= 4) m.push(['me', '03:03', 'I knocked.'], ['me', '03:03', 'Something knocked back.']);
  if (door >= 5) m.push(['me', '03:04', 'It isn’t behind the door.'], ['me', '03:04', 'It’s behind the glass.'], ['me', '03:05', 'It has my face.']);
  if (door >= 13) m.push(['them', '03:06', 'Your turn.']);
  return '<div class="bubbles">' + m.map(([who, t, s]) => '<p class="bubble ' + who + '">' + esc(s) + '<time>' + t + '</time></p>').join('') + '</div>';
}
function callsHTML() {
  if (!S.P.calls.length) return '<p class="fine">No calls.</p>';
  return S.P.calls.map((c, i) => '<div class="call-row"><span>' + esc(c.who) + '</span><span>' + (c.how === 'voicemail' ? 'Voicemail' : 'Answered') + '</span></div><div class="memo" data-w="rec" data-clip="' + c.clip + '"><button class="play" type="button" aria-label="Play the recording">' + PLAY + '</button><div><canvas width="600" height="76"></canvas><div class="meta"><span>Recording</span><span></span></div></div><p class="cc" hidden></p></div>').join('');
}
function bodyHTML(id) { return id === 'note' ? noteHTML() : id === 'keys' ? keysHTML() : id === 'memo' ? memoHTML() : id === 'where' ? whereHTML() : id === 'photo' ? photoHTML() : id === 'msgs' ? msgsHTML() : callsHTML(); }

/* waveforms and the map */
function drawWave(cv, p, kind) {
  const x = cv.getContext('2d'), w = cv.width, h = cv.height, n = 70; x.clearRect(0, 0, w, h);
  let s = 3; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n; let amp = .12 + .18 * r();
    if (kind === 'memo') { const sec = t * 7.6; for (const tt of [1.2, 2.3, 3.4, 4.3, 4.55]) amp += Math.exp(-Math.pow((sec - tt) / .06, 2)) * .9; if (sec > 5.6 && sec < 7.3) amp += .25 * r(); }
    else amp += .3 * r();
    const a = Math.min(1, amp) * h * .45, xx = t * w; x.fillStyle = t < p ? '#E3C07A' : 'rgba(242,234,217,.25)'; x.fillRect(xx - 2.5, h / 2 - a, 5, a * 2);
  }
}
function playWave(cv, dur, kind) { const t0 = performance.now(), step = () => { const p = (performance.now() - t0) / (dur * 1000); drawWave(cv, Math.min(1, p), kind); if (p < 1) requestAnimationFrame(step); }; step(); }
function drawMap(cv) {
  const x = cv.getContext('2d'), w = cv.width, h = cv.height; x.clearRect(0, 0, w, h); x.lineCap = x.lineJoin = 'round';
  const coast = [[262, 0], [270, 60], [254, 118], [232, 168], [218, 214], [238, 250], [272, 266], [300, 300], [304, 360], [292, 450]];
  const xAt = y => { for (let i = 1; i < coast.length; i++) if (coast[i][1] >= y) { const [x0, y0] = coast[i - 1], [x1, y1] = coast[i]; return x0 + (x1 - x0) * (y - y0) / (y1 - y0); } return coast[coast.length - 1][0]; };
  x.strokeStyle = 'rgba(227,192,122,.16)'; x.lineWidth = 1.2;
  for (let y = 18; y < h; y += 20) { x.beginPath(); for (let px = 16; px < xAt(y) - 22; px += 8) x.lineTo(px, y + Math.sin(px / 16 + y) * 2.4); x.stroke(); }
  x.strokeStyle = 'rgba(242,234,217,.1)'; for (let k = 1; k <= 6; k++) { x.beginPath(); x.ellipse(470, 210, 34 + k * 30, 26 + k * 24, .3, 0, TAU); x.stroke(); }
  x.shadowColor = 'rgba(255,205,130,.9)'; x.shadowBlur = 10; x.strokeStyle = 'rgba(240,203,134,.95)'; x.lineWidth = 2.2; x.beginPath(); coast.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke();
  x.fillStyle = '#F2EAD9'; x.beginPath(); x.arc(312, 256, 5, 0, TAU); x.fill();
  x.shadowBlur = 0; x.font = '400 19px "DM Mono", monospace'; x.fillStyle = 'rgba(242,234,217,.85)'; x.fillText('VALPARAÍSO', 326, 262);
  x.strokeStyle = '#F0CB86'; x.lineWidth = 2; x.shadowBlur = 12; x.beginPath(); x.arc(272, 226, 10, 0, TAU); x.stroke(); x.globalAlpha = .4; x.beginPath(); x.arc(272, 226, 22, 0, TAU); x.stroke(); x.globalAlpha = 1;
  x.shadowBlur = 0; x.fillStyle = '#F0CB86'; x.font = '400 15px "DM Mono", monospace'; x.fillText('LAST SIGNAL 03:04', 296, 206);
  x.fillStyle = 'rgba(227,192,122,.55)'; x.fillText('PACIFIC', 56, 380);
  const rx = 528, ry = 74; x.strokeStyle = 'rgba(242,234,217,.7)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(rx, ry - 34); x.lineTo(rx, ry + 34); x.moveTo(rx - 34, ry); x.lineTo(rx + 34, ry); x.stroke();
  x.fillStyle = '#F2EAD9'; x.font = '400 17px "DM Mono", monospace'; x.textAlign = 'center'; x.fillText('N', rx, ry - 42); x.fillText('W', rx - 50, ry + 6); x.fillText('E', rx + 50, ry + 6); x.fillText('S', rx, ry + 56); x.textAlign = 'start';
}
export function bindWidgets(root) {
  root.querySelectorAll('[data-w="memo"]').forEach(el => {
    const cv = el.querySelector('canvas'); drawWave(cv, 0, 'memo');
    el.querySelector('.play').onclick = () => { audio.start(); CLIPS.memo.play(); playWave(cv, CLIPS.memo.dur, 'memo'); };
    el.querySelector('.ccb').onclick = () => { const cc = el.querySelector('.cc'); cc.hidden = !cc.hidden; };
  });
  root.querySelectorAll('[data-w="map"]').forEach(el => drawMap(el.querySelector('canvas')));
  root.querySelectorAll('[data-w="rec"]').forEach(el => {
    const cv = el.querySelector('canvas'), cc = el.querySelector('.cc'), clip = CLIPS[el.dataset.clip]; drawWave(cv, 0, 'rec');
    el.querySelector('.play').onclick = () => { audio.start(); voice.unlock(); cc.hidden = false; clip.play(); playWave(cv, clip.dur, 'rec'); clip.cc.forEach(([t, text]) => setTimeout(() => { cc.textContent = text; }, t * 1000)); };
  });
}

/* the overlay */
export function openPhone(tab) {
  const ids = ORDER.filter(id => S.P.found.includes(id)); if (!ids.length) { toast('Nothing on her phone yet'); return; }
  tab = ids.includes(tab) ? tab : ids.includes(S.P.evHint) ? S.P.evHint : ids[0]; S.P.evHint = null;
  $('evTabs').innerHTML = ids.map(id => '<button type="button" role="tab" data-ev="' + id + '" aria-selected="' + (id === tab) + '">' + TABS[id] + '</button>').join('');
  $('evTabs').querySelectorAll('button').forEach(b => { b.onclick = () => openPhone(b.dataset.ev); });
  $('evBody').innerHTML = bodyHTML(tab); bindWidgets($('evBody'));
  $('evidence').hidden = false; S.evOpen = true; $('evBtn').classList.remove('new');
}
$('evClose').onclick = () => { $('evidence').hidden = true; S.evOpen = false; };
$('evBtn').onclick = () => openPhone();

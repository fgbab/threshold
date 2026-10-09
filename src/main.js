/* Threshold: the nights. Boot, the splash, a door's seven objectives in a row (resumable), the end of each night,
   waiting for 3:03 AM, the last choice, the things that haunt you between, and the self-test. */
import * as C from './core.js';
import { S, AUTO, TEST, JUMP, MODE, NATIVE, SPEED, $, wait, until, clamp, esc, ROMAN, store, saveP, cards, audio, voice, buzz, keepAwake, letSleep, startMotion, startCamera, stopCamera, say, instruct, hud, hudObj, markSVG, basis, fwdAz, fmtTime, W, H, glowText, pick } from './core.js';
import * as G from './gfx.js';
import { DOORS, NOTE, keysFor } from './doors.js';
import { sweep } from './kit.js';
import * as sight from './mech-sight.js';
import * as world from './mech-world.js';
import * as body from './mech-body.js';
import * as listens from './mech-voice.js';
import * as touch from './mech-touch.js';
import * as glassy from './mech-glass.js';
import { found, addFrag, addCall, openPhone, flash } from './phone.js';
import { openSensors, browserNote } from './sensors.js';
import { toast, twice, check, shareInvite, shareCard, prepareShare, remind, showGear, forget, composeForTest } from './share.js';

const M = { ...sight, ...world, ...body, ...listens, ...touch, ...glassy };
C.bindTouch(document.getElementById('gl'));

/* ===================================================================== */
/* STATE                                                                  */
/* ===================================================================== */
const ALL_FOUND = ['note', 'keys', 'memo', 'where', 'photo', 'msgs', 'calls'];
function loadState() {
  S.SETTINGS = Object.assign({ tilt: 1, sound: true }, store.get('settings', {}));
  const P = S.P = Object.assign({ num: 5 + Math.floor(Math.random() * 995), name: '', door: 0, obj: 0, unlockAt: 0, invitedBy: null, times: {}, frags: {}, found: [], calls: [], choice: null, mark: null, warned: false }, store.get('player', {}));
  if (P.nights != null && P.version !== 13) Object.assign(P, { door: 0, obj: 0, unlockAt: 0, frags: {}, found: [], calls: [], choice: null }), delete P.nights;   // the five-door version: start over
  P.version = 13;
  if (TEST.door) Object.assign(P, { door: TEST.door - 1, obj: TEST.start ? TEST.start - 1 : 0, unlockAt: 0, warned: true, found: ALL_FOUND.slice() });
  if (TEST.screen === 'w') Object.assign(P, { door: 3, obj: 0, unlockAt: Date.now() + 5.2 * 3.6e6, warned: true });
  if (TEST.screen === 'e') Object.assign(P, { door: 5, found: ALL_FOUND.slice(), frags: { 1: ['Embers: ▲ 4 · ● 1 · ◆ 7', 'The eye looked at: ● then ◆ then ▲'], 2: ['When it saw red: — — —, the long ones first'] }, calls: [{ clip: 'three05', who: 'Player Four', how: 'answered' }] });
  if (MODE === 'unlock' && P.door < 13) P.unlockAt = 0;
  if (JUMP) Object.assign(P, { door: JUMP - 1, obj: 0, unlockAt: 0, warned: true });
  const q = new URLSearchParams(location.search), c = (q.get('d') || '').toLowerCase().replace(/[^0-9a-z]/g, '');
  if (c.length >= 2 && check(c.slice(0, -1)) === c.slice(-1)) {           // a door someone opened for this player
    const num = parseInt(c.slice(0, -1), 36);
    if (num !== P.num && !P.invitedBy) P.invitedBy = { num, name: (q.get('n') || '').replace(/[<>&"]/g, '').trim().slice(0, 20), t: clamp(parseInt(q.get('t'), 10) || 0, 0, 36000) };
  }
  saveP();
}
function nextUnlock() { const d = new Date(); d.setHours(3, 3, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); return d.getTime(); }
const nightOpen = () => Date.now() >= (S.P.unlockAt || 0);
function untilText() { const tm = Math.max(1, Math.ceil((S.P.unlockAt - Date.now()) / 6e4)), h = Math.floor(tm / 60), m = tm % 60; return 'in ' + (h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min'); }
function clockText() { const d = new Date(); let h = d.getHours(); const m = d.getMinutes(), ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; }
const isNight = () => { const h = new Date().getHours(); return h >= 21 || h < 6; };

/* ===================================================================== */
/* THE MENU SCENE: the next door's mark, forged in the void               */
/* ===================================================================== */
let menuObj = null;
function menuScene(mark) {
  if (menuObj) { G.remove(menuObj); menuObj = null; }
  if (mark == null) return;
  const s = G.sigil(mark, .95, { write: 0, sparkCount: 150, glow: 1.6 }); G.placeAt(s.group, 0, .34, 3.2); G.faceViewer(s.group);
  const t0 = performance.now(); s.update = now => { s.write(clamp((now - t0) / 2800, 0, 1)); s.group.rotation.z = Math.sin(now / 3200) * .05; };
  G.add(s); menuObj = s;
}

/* ===================================================================== */
/* HAUNTING: small things, now and then, more often the deeper you go     */
/* ===================================================================== */
const HA = { next: Infinity, every: 50, edge: null, text: '', textT: 0, tx: 0, ty: 0 };
function hauntFrom(now, door) { HA.every = Math.max(14, 56 - door * 3); HA.next = AUTO ? Infinity : now + (HA.every * .7 + Math.random() * HA.every) * 1000; }
function haunt(now) {
  HA.next = now + (HA.every * .7 + Math.random() * HA.every) * 1000;
  const r = Math.random();
  if (r < .35) audio.whisper(0, 1.4, .06, Math.random() < .5 ? -.8 : .8);
  else if (r < .6) {                          // someone at the edge of the glass, for a moment
    if (!HA.edge) { HA.edge = G.keepAlways(G.figure(H * .8)); G.add(HA.edge, G.screen); }
    const side = Math.random() < .5 ? -1 : 1; HA.edge.group.position.copy(G.px(side > 0 ? W - W * .06 : W * .06, H * .52)); HA.edge.alpha(.7);
    audio.breath(0, .05, 1.2, 700); setTimeout(() => HA.edge && HA.edge.alpha(0), 170);
  } else if (r < .85) { HA.textT = now + 140; HA.text = pick(['behind you', 'it sees you', 'don’t stop', 'player ' + S.P.num, 'it’s closer']); HA.tx = W * (.2 + Math.random() * .6); HA.ty = H * (.25 + Math.random() * .5); }
  else G.glass.glitch(220);
}

/* ===================================================================== */
/* THE LOOP                                                                */
/* ===================================================================== */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(AUTO ? .25 : .05, (now - last) / 1000); last = now;
  if (S.playing) { C.sampleVision(now); C.sampleMic(now); }
  C.viewTick(dt);
  C.g.clearRect(0, 0, W, H);
  if (S.stage && S.stage.draw) S.stage.draw(now, S.evOpen || S.shotHold ? 0 : dt);
  if (S.playing && S.stage && !S.evOpen && now > HA.next) haunt(now);
  if (now < HA.textT) glowText(HA.text, HA.tx, HA.ty, 20, .6, 'italic 400', '242, 234, 217');
  G.render(now, dt);
}
requestAnimationFrame(frame);

/* ===================================================================== */
/* SCREENS                                                                 */
/* ===================================================================== */
function reveal(container) { const ls = [...container.querySelectorAll('.line')], step = Math.min(900, 6400 / Math.max(1, ls.length)); ls.forEach((el, i) => setTimeout(() => el.classList.add('on'), (250 + i * step) * SPEED)); }
function clickWhenReady(id, onTap) { return new Promise(res => { const b = $(id); b.onclick = () => { b.onclick = null; if (onTap) onTap(); res(); }; if (AUTO) setTimeout(() => b.click(), 1600 * SPEED + 300); }); }
function setSplash(eyebrow, lead, fines, button) {
  const col = $('splash').querySelector('.col');
  col.innerHTML = '<div class="sigil-space"></div><p class="eyebrow line">' + esc(eyebrow) + '</p><h1 class="title line">Threshold</h1><p class="lead line">' + esc(lead) + '</p>' +
    fines.map(f => '<p class="fine line">' + esc(f) + '</p>').join('') + (browserNote() ? '<p class="warnline line">' + esc(browserNote()) + '</p>' : '') + '<button class="go line" id="begin" type="button">' + esc(button) + '</button>';
  $('splash').hidden = false; showGear(true); reveal(col);
  setTimeout(() => { const t = col.querySelector('.title'); if (t) t.classList.add('flicker'); }, 4500);
}
const marksRow = n => '<div class="marks line">' + DOORS.map((d, i) => markSVG(d.mark, i >= n)).join('') + '</div>';
async function interlude(html, btn) {
  hud(false); instruct('');
  const s = $('interlude'), col = $('interCol');
  col.innerHTML = html + '<button class="go line" id="nextDoor" type="button">' + btn + '</button>';
  s.hidden = false; reveal(col); audio.breath(0, .03, 2.4, 2000);
  const photoImg = col.querySelector('.photo img'); if (photoImg) audio.whisper(1.2, 1.4, .05);
  await clickWhenReady('nextDoor'); s.hidden = true;
}
function endScreen(html, buttons) {
  S.playing = false; hud(false); S.stage = null; instruct(''); stopCamera(); letSleep(); glassy.reflect(false); HA.next = Infinity;
  G.setMenu(true); G.clearAll(); menuScene(DOORS[Math.min(12, S.P.door)].mark);
  const col = $('endCol');
  col.innerHTML = html + '<div class="actions line">' + buttons.map(b => '<button class="' + (b.cls || 'go') + '" id="' + b.id + '" type="button">' + esc(b.label) + '</button>').join('') + '</div>';
  buttons.forEach(b => { if (b.twice) twice($(b.id), b.twice, b.fn); else $(b.id).onclick = b.fn; });
  $('interlude').hidden = true; $('splash').hidden = true; $('end').hidden = false; showGear(true); reveal(col); audio.drone(.08, 260, 3);
  for (const k of ['maze', 'door', 'glass']) if (cards.get(k)) prepareShare(k);
}
const shareKind = () => S.P.door >= 5 && cards.get('glass') ? 'glass' : S.P.door >= 4 && cards.get('door') ? 'door' : cards.get('maze') ? 'maze' : null;
function nightButtons() {
  const kind = shareKind(), b = [{ id: 'bInvite', label: 'Open a door for someone', fn: shareInvite }, { id: 'bPhone', label: 'Her phone', fn: () => openPhone(), cls: 'go dim' }];
  if (kind) b.push({ id: 'bShare', label: 'Share what you saw', fn: () => shareCard(kind), cls: 'go dim' });
  if (NATIVE) b.push({ id: 'bRemind', label: 'Tell me when it opens', fn: remind, cls: 'go dim' });
  return b;
}
function tickCount() { clearInterval(tickCount.iv); tickCount.iv = setInterval(() => { if (nightOpen()) { clearInterval(tickCount.iv); location.reload(); } else if ($('count')) $('count').textContent = untilText(); }, 15000); }
const countdown = () => '<p class="count line" id="count">' + untilText() + '</p>';
function doorEnd(n) {
  endScreen('<p class="eyebrow line">Door ' + ROMAN[n - 1] + ' of XIII</p><p class="lead line">' + esc(DOORS[n - 1].name) + ' is open.</p>' + marksRow(n) +
    '<p class="fine line">Door ' + ROMAN[n] + ' opens at 3:03 AM.</p>' + countdown() + '<p class="fine line">Don’t tell anyone about the doors. If you must, open one for a single person.</p>', nightButtons());
  tickCount();
}
function waiting() {
  const n = S.P.door;
  endScreen('<p class="eyebrow line">' + n + ' of XIII</p><p class="lead line">Door ' + ROMAN[n] + ' is still closed.</p>' + marksRow(n) + '<p class="fine line">It opens at 3:03 AM.</p>' + countdown(), nightButtons());
  tickCount();
}
function finale() {
  const stay = S.P.choice !== 'close';
  endScreen('<p class="eyebrow line">XIII of XIII</p>' +
    (stay ? '<p class="lead line">You took her place.</p><p class="fine line">At 3:07 AM, a girl walked out of an empty church in Valparaíso. She asked what year it was.</p>'
      : '<p class="lead line">You let the last door close.</p><p class="fine line">In an empty church in Valparaíso, a phone lit up on the floor. Then it went dark.</p>') +
    marksRow(13) + '<p class="fine line">' + (stay ? 'You are behind the glass now. The doors open for whoever you choose.' : 'Lena is still behind the glass. The doors will look for someone braver.') + '</p>',
    [{ id: 'bInvite', label: stay ? 'Open a door for someone' : 'Find someone braver', fn: shareInvite },
      { id: 'bShare', label: 'Share what you saw', fn: () => shareCard('final'), cls: 'go dim' },
      { id: 'bAgain', label: 'Begin again', fn: () => { forget(); location.replace(location.pathname); }, cls: 'ghost', twice: 'Tap again to forget everything' }]);
}
function choose() {
  return new Promise(res => {
    hud(false); instruct('');
    const s = $('interlude'), col = $('interCol');
    col.innerHTML = '<p class="eyebrow line">Player Four</p><p class="lead line">“Someone has to stay behind the glass, or the doors can’t open.”</p>' +
      '<p class="fine line">“I stayed for three years. I made the doors so someone would find me. I chose you, because you weren’t afraid of the dark part.”</p>' +
      '<p class="lead line">“Take my place, and I can go home. Or let the door close, and I stay.”</p>' +
      '<div class="actions line"><button class="go" id="cStay" type="button">Take her place</button><button class="go dim" id="cClose" type="button">Let it close</button></div>';
    s.hidden = false; reveal(col); audio.breath(0, .03, 2.4, 1600);
    $('cStay').onclick = () => { s.hidden = true; res('stay'); };
    $('cClose').onclick = () => { s.hidden = true; res('close'); };
    if (AUTO) setTimeout(() => $('cStay').click(), 2400 * SPEED + 400);
  });
}

/* ===================================================================== */
/* A DOOR: seven objectives in a row                                       */
/* ===================================================================== */
async function ensureCam(face) {
  if (C.facing === face && (C.camOK || C.room)) return;
  G.glass.fade(1, 250); await wait(280); await startCamera(face); await wait(150); G.glass.fade(0, 450);
}
const RESOLVE = ['collect', 'show', 'code', 'items', 'colors'];
async function recap(n) {                    // before a lock: everything found behind this door, in one place
  const fr = S.P.frags[n] || []; if (!fr.length) return;
  hud(false); instruct('');
  const s = $('interlude'), col = $('interCol');
  col.innerHTML = '<p class="eyebrow line">What you found behind this door</p><div class="keyring line">' + fr.map(f => '<p class="frag">' + esc(f) + '</p>').join('') + '</div>' +
    '<div class="note line"><p><b>' + n + '</b><span>' + esc(NOTE[n - 1]) + '</span></p></div><p class="cap line">It stays in her phone, under Keyring</p>' +
    '<button class="go line" id="toLock" type="button">Face the lock</button>';
  s.hidden = false; reveal(col); audio.breath(0, .03, 2, 1800);
  await clickWhenReady('toLock'); s.hidden = true; hud(true); flash('keys');
}
async function playDoor(n) {
  const d = DOORS[n - 1], keys = keysFor(n), P = S.P;
  S.doorN = n; S.playing = true; hud(true); G.setMenu(false); G.glass.dread(.12, 1500);
  hauntFrom(performance.now(), n);
  S.doorAz0 = fwdAz(basis());
  const t0 = performance.now();
  for (let k = P.obj || 0; k < 7; k++) {
    const o = { ...d.obj[k] }; for (const key of RESOLVE) if (typeof o[key] === 'function') o[key] = o[key](keys);
    if (k === 6 && o.type !== 'choice') { await recap(n); o.hintAt = o.hintAt || [45, 110, 200]; }   // the lock: show what you found first, help sooner
    S.objIndex = k; hudObj(n, k, o.title);
    await ensureCam(o.cam || 'environment');
    if (o.cam !== 'user') glassy.reflect(false);
    if (o.say) await say(o.say);
    const res = o.type === 'choice' ? { choice: await choose() } : (await M[o.type](o)) || {};
    sweep();
    if (o.type === 'maze' && n === 1 && res.secs && (!P.times.maze || res.secs < P.times.maze)) P.times.maze = Math.round(res.secs);
    if (o.type === 'call') addCall(o.clip, o.who, res.call);
    if (o.type === 'draw' && o.free && res.strokes) P.mark = res.strokes;
    if (o.type === 'choice') P.choice = res.choice;
    if (o.frag) addFrag(n, o.frag(res, keys));
    if (o.unlock) found(o.unlock);
    P.obj = k + 1; saveP();
    if (o.after) await say(o.after);
  }
  glassy.reflect(false); hud(false);
  return { secs: (performance.now() - t0) / 1000 };
}
async function doorOpening(mark) {          // the door you just unlocked, standing in your room: it writes itself in light, then opens
  const az = fwdAz(basis()), dw = G.doorway(2.15), crest = G.sigil(mark, .46, { write: 0, sparkCount: 80 });
  G.placeAt(dw.group, az, -.26, 3.5); G.faceViewer(dw.group); G.placeAt(crest.group, az, .2, 3.4); G.faceViewer(crest.group);
  dw.alpha(1); dw.write(0); dw.open(0); G.add(dw); G.add(crest); instruct('');
  const t0 = performance.now(), anim = { update(now) { const t = (now - t0) / 1000 / Math.max(SPEED, .35); dw.write(clamp(t / 1.8, 0, 1)); crest.write(clamp((t - .6) / 1.4, 0, 1)); dw.open(clamp((t - 2.2) / 1.4, 0, 1)); } };
  G.add(anim); audio.bell(196, 0, .1, 4); audio.breath(.3, .04, 2.4, 1400);
  await wait(2200 * Math.max(SPEED, .35)); audio.open(); crest.burst(140); G.glass.flash([1, .88, .62], 1400, .35); buzz([40, 60, 120]);
  await wait(2400 * Math.max(SPEED, .35)); G.glass.fade(1, 1100); await wait(1200 * Math.max(SPEED, .35));
  G.remove(anim); G.remove(dw); G.remove(crest); G.glass.fade(0, 900);
}
function complete(n) { const P = S.P; if (P.door < n) { P.door = n; P.unlockAt = n < 13 ? nextUnlock() : 0; } P.obj = 0; saveP(); }

/* ===================================================================== */
/* A NIGHT                                                                 */
/* ===================================================================== */
async function night(n) {
  const P = S.P, d = DOORS[n - 1], resume = P.obj > 0, first = n === 1 && !resume;
  G.setMenu(true); menuScene(d.mark);
  if (first && !P.warned && !AUTO) {        // a horror game should say so
    $('splash').hidden = true; $('warn').hidden = false; showGear(false);
    await new Promise(r => { $('warnOk').onclick = r; }); $('warn').hidden = true; P.warned = true; saveP();
  }
  const by = P.invitedBy;
  if (resume) setSplash('Door ' + ROMAN[n - 1], 'You left in the middle of a door.', ['It kept your place. It kept everything.', 'Alone. Sound on.'], 'Go back in');
  else if (first) setSplash(by ? 'A door was opened for you' : 'A game that finds you', by ? (by.name || 'Player ' + by.num) + ' chose you.' : 'You weren’t supposed to find this.',
    ['There are thirteen doors. They only appear through glass. Behind the last one is whoever made them.', 'One opens each night. Play alone. Sound on.'], 'Open the first door');
  else setSplash('Night ' + n, 'Door ' + ROMAN[n - 1] + ' is open.', ['It opened at 3:03 AM. It has been waiting for you.', 'Alone. Sound on.'], 'I’m alone');
  await new Promise(res => {                 // one tap starts sound, motion and camera (iOS only asks inside a tap)
    $('begin').onclick = async () => {
      $('begin').onclick = null; audio.start(); audio.droneOn(); keepAwake(); voice.unlock(); showGear(false);
      let m, c;
      if (first) {                             // the permission screen: the asking has to happen inside this second tap
        $('splash').hidden = true; $('perm').hidden = false;
        await new Promise(r => { $('allow').onclick = () => { $('allow').onclick = null; m = startMotion(); c = startCamera('environment'); r(); }; if (AUTO) setTimeout(() => $('allow').click(), 500); });
      } else { m = startMotion(); c = startCamera('environment'); }
      $('splash').hidden = true;
      const [, cam] = await Promise.all([m, c]);
      if (first && !cam) { $('permNote').hidden = false; $('permNote').textContent = 'No camera, so the doors will use a photograph of a room instead.'; await wait(2200 * SPEED); }
      $('perm').hidden = true; res();
    };
    if (AUTO) setTimeout(() => $('begin').click(), 1600 * SPEED + 300);
  });
  menuScene(null); G.setMenu(false); S.playing = true;
  if (!resume) {
    await say(isNight() ? ['It’s ' + clockText() + '.', n === 1 ? 'Lena always started at 3:03.' : 'You came back.'] : ['It’s ' + clockText() + '. Too bright for the doors.', 'They’ll open anyway. They see you better in the light.']);
    if (d.unlock) found(d.unlock);
    found('note'); if (n >= 3) found('msgs');
    await interlude(d.intro(), 'Open door ' + ROMAN[n - 1]);
  }
  const res = await playDoor(n);
  complete(n);
  if (n < 13) await doorOpening(d.mark);
  if (n === 13) { finale(); return finish('final'); }
  const lines = d.outro.slice(); if (n === 1) { lines.push('You took ' + fmtTime(res.secs) + '.'); if (by && by.t) lines.push((by.name || 'Player ' + by.num) + ' took ' + fmtTime(by.t) + ' on the maze.'); }
  audio.open(); await say(lines);
  doorEnd(n); finish(n === 1 ? 'maze' : n === 4 ? 'door' : n === 5 ? 'glass' : 'maze');
}

/* ===================================================================== */
/* SELF-TEST                                                               */
/* ===================================================================== */
const finish = kind => { if (S.report) S.report(); if (AUTO) composeForTest(kind).then(u => { window.__cardData = u; }); };
if (AUTO) {
  const out = document.createElement('pre'); out.id = 'selftest'; out.hidden = true; document.body.appendChild(out);
  const errors = []; addEventListener('error', e => errors.push(String(e.message))); addEventListener('unhandledrejection', e => errors.push(String(e.reason && (e.reason.stack || e.reason))));
  S.report = () => { const P = S.P || {}; out.textContent = JSON.stringify({ mode: MODE, door: S.doorN, obj: S.objIndex, playing: S.playing, ended: !$('end').hidden, doors: P.door, inDoor: P.obj, choice: P.choice, frags: P.frags && P.frags[S.doorN], calls: (P.calls || []).length, cards: ['room', 'maze', 'door', 'glass'].filter(k => cards.get(k)), errors }); };
  setInterval(S.report, 500);
  window.__card = () => window.__cardData || '';
}

async function boot() {
  if (NATIVE) { try { await NATIVE.restore(['threshold:player', 'threshold:settings']); } catch (e) {} }
  loadState(); audio.mute(!S.SETTINGS.sound);
  if (NATIVE) NATIVE.ready();
  if (TEST.screen === 'e') { G.setMenu(true); $('splash').hidden = true; return openPhone('keys'); }
  if (TEST.screen === 'c') { $('splash').hidden = true; G.setMenu(true); return glassy.call({ clip: 'three05', who: 'Player Four' }); }
  if (TEST.screen === 's') { $('splash').hidden = true; G.setMenu(false); await startCamera(); G.glass.scare(60000); return; }
  if (MODE === 'sensors') { G.setMenu(true); $('splash').hidden = true; return openSensors(); }
  if (TEST.screen === 'm') { G.setMenu(true); menuScene(0); setSplash('A game that finds you', 'You weren’t supposed to find this.', ['There are thirteen doors. They only appear through glass. Behind the last one is whoever made them.', 'One opens each night. Play alone. Sound on.'], 'Open the first door'); return; }
  const P = S.P;
  if (P.door >= 13) { G.setMenu(true); return finale(); }
  const n = P.door + 1;
  if (P.obj > 0 || nightOpen() || n === 1) return night(n);
  G.setMenu(true); return waiting();
}
boot();

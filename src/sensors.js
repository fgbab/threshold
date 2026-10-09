/* The sensor check: live readings from this phone (compass, tilt, steps, knocks, face down, microphone), so a player can
   see whether the doors can feel the phone here, and what to change if not. Open it from settings or with #sensors. */
import * as C from './core.js';
import { S, $, DEG, clamp, MO, MIC, sensor, startMotion, startMic, stopMic, sampleMic, faceDown, basis, fwdAz, NATIVE } from './core.js';

export function browserNote() {            // in-app browsers (and some others on iPhone) can't reach the motion sensors
  if (NATIVE) return null;
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (/FBAN|FBAV|Instagram|Line\/|GSA\/|Twitter|LinkedInApp|Snapchat|TikTok|musical_ly|WhatsApp|Messenger/i.test(ua)) return 'This link opened inside another app, whose browser can’t feel the phone. Open it in Safari.';
  if (ios && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return 'For the compass and motion to work, open this page in Safari.';
  return null;
}
const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function heading() {                // degrees from north the camera faces, or null
  if (sensor.heading != null) return sensor.heading;
  if (sensor.absolute) return ((fwdAz(basis()) / DEG) + 360) % 360;
  return null;
}
let raf = 0, saved = null, micOn = false;
export function openSensors() {
  let el = $('sensors');
  if (!el) { el = document.createElement('section'); el.id = 'sensors'; el.className = 'screen ev'; document.body.appendChild(el); }
  const note = browserNote();
  el.innerHTML = '<div class="ev-wrap">' +
    '<div class="ev-head"><p class="eyebrow">Sensor check</p><button class="ghost" id="snClose" type="button">Close</button></div>' +
    (note ? '<p class="warnline">' + note + '</p>' : '') +
    '<div class="sn-row"><span>Motion and orientation</span><b id="snPerm">not asked yet</b></div>' +
    '<button class="go" id="snAllow" type="button">Allow motion</button>' +
    '<div class="sn-grid">' +
    '<div class="sn-card"><p class="cap">Compass</p><svg id="snDial" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44"/><g id="snNeedle"><path d="M50 12 L56 50 L50 58 L44 50 Z" class="n"/><path d="M50 88 L56 50 L50 42 L44 50 Z"/></g></svg><p class="sn-big" id="snHead">—</p><p class="cap" id="snAcc"></p></div>' +
    '<div class="sn-card"><p class="cap">Tilt</p><div class="sn-level"><i id="snBubble"></i></div><p class="sn-small" id="snAngles">—</p></div>' +
    '<div class="sn-card"><p class="cap">Steps</p><p class="sn-big" id="snSteps">0</p><p class="cap">Walk a few steps</p></div>' +
    '<div class="sn-card"><p class="cap">Knocks</p><p class="sn-big" id="snKnocks">0</p><p class="cap">Tap the back of the phone</p></div>' +
    '<div class="sn-card"><p class="cap">Face down</p><p class="sn-big" id="snFace">no</p><p class="cap">Lay it screen-down</p></div>' +
    '<div class="sn-card"><p class="cap">Microphone</p><div class="sn-meter"><i id="snMic"></i></div><button class="ghost" id="snMicBtn" type="button">Test it</button></div>' +
    '</div><p class="fine">The compass needle should keep pointing north as you turn. If it drifts or jumps, move the phone in a slow figure-eight, away from metal and speakers.</p></div>';
  el.hidden = false; S.evOpen = true;
  let steps = 0, knocks = 0, perm = sensor.has ? 'working' : 'not asked yet';
  saved = { step: MO.onStep, knock: MO.onKnock };
  MO.onStep = () => { steps++; }; MO.onKnock = () => { knocks++; };
  $('snAllow').onclick = () => { $('snPerm').textContent = 'asking…'; startMotion().then(ok => { perm = ok ? 'allowed' : 'denied'; if (!ok) $('snPerm').textContent = 'denied: close this tab and open the link again'; }); };
  $('snMicBtn').onclick = async () => { $('snMicBtn').textContent = 'listening'; micOn = await startMic(); if (!micOn) $('snMicBtn').textContent = 'not allowed'; };
  $('snClose').onclick = closeSensors;
  const loop = now => {
    raf = requestAnimationFrame(loop);
    const h = heading();
    if (sensor.has) perm = 'working';
    $('snPerm').textContent = perm === 'working' ? 'working' : perm;
    $('snAllow').hidden = sensor.has;
    if (h != null) { $('snNeedle').setAttribute('transform', 'rotate(' + (-h).toFixed(1) + ' 50 50)'); $('snHead').textContent = Math.round(h) + '° ' + CARD[Math.round(h / 45) % 8]; }
    else $('snHead').textContent = sensor.has ? 'no compass' : '—';
    const acc = sensor.accuracy; $('snAcc').textContent = acc == null ? '' : acc < 0 ? 'needs calibrating' : 'within ' + Math.round(acc) + '°';
    $('snAngles').textContent = sensor.has ? 'β ' + Math.round(sensor.beta) + '°  γ ' + Math.round(sensor.gamma) + '°' : '—';
    $('snBubble').style.transform = 'translate(' + clamp(sensor.gamma / 45, -1, 1) * 34 + 'px,' + clamp((sensor.beta > 90 ? 180 - sensor.beta : sensor.beta) / 45 - 1, -1, 1) * 34 + 'px)';
    $('snSteps').textContent = steps; $('snKnocks').textContent = knocks; $('snFace').textContent = sensor.has && faceDown() ? 'yes' : 'no';
    if (micOn) { sampleMic(now); $('snMic').style.width = (clamp(MIC.level * 9, 0, 1) * 100).toFixed(0) + '%'; }
  };
  raf = requestAnimationFrame(loop);
}
export function closeSensors() {
  cancelAnimationFrame(raf); const el = $('sensors'); if (el) el.hidden = true; S.evOpen = false;
  if (saved) { MO.onStep = saved.step; MO.onKnock = saved.knock; saved = null; }
  if (micOn) { stopMic(); micOn = false; }
}

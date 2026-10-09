/* Threshold, sharing and small UI: pictures of moments (kept for her phone and for posting), invitations, the
   1080 x 1920 picture people post, the evening reminder, settings, toasts. */
import * as C from './core.js';
import { S, AUTO, NATIVE, SITE, $, esc, cards, store, saveP, fmtTime, W, H, drawMark, TAU, clamp, audio, loadImage, ROMAN } from './core.js';
import * as G from './gfx.js';
import { openSensors } from './sensors.js';

export function snap(kind, raw) {            // raw: the camera's own picture (your room); otherwise the rendered moment
  if (raw) { try { const w = 540, c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * H / W); c.getContext('2d').drawImage(C.still, 0, 0, c.width, c.height); cards.set(kind, c.toDataURL('image/jpeg', .82)); } catch (e) {} return; }
  G.capture(url => cards.set(kind, url));
}
export function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.tm); toast.tm = setTimeout(() => el.classList.remove('on'), 2600); }
export function twice(btn, label, fn) { let armed = false; btn.onclick = () => { if (armed) return fn(); armed = true; btn.textContent = label; }; }
const isCancel = e => e && (e.name === 'AbortError' || /cancel/i.test(String(e.message || e)));

/* invitations: your player number with a check letter, your name and your maze time */
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
export const check = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 36; return B36[h]; };
const inviteCode = () => { const b = S.P.num.toString(36); return b + check(b); };
export function inviteURL() {
  const base = NATIVE || !/^https?:$/.test(location.protocol) ? SITE : location.origin + location.pathname;
  const q = new URLSearchParams({ d: inviteCode() }); if (S.P.name) q.set('n', S.P.name); if (S.P.times.maze) q.set('t', Math.round(S.P.times.maze));
  return base + '?' + q;
}
export async function shareInvite() {
  const url = inviteURL(), text = 'A door was opened for you. Play at night. Alone, if you can.';
  try { if (NATIVE) { await NATIVE.shareText(text, url); return; } if (navigator.share) { await navigator.share({ text, url }); return; } } catch (e) { if (isCancel(e)) return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast('Invitation copied'); } catch (e) { toast(url); }
}

/* the picture people post */
function spaced(x, text, cx, y, sp) { const chars = [...text], ws = chars.map(ch => x.measureText(ch).width); let px = cx - (ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1)) / 2; x.save(); x.textAlign = 'left'; chars.forEach((ch, i) => { x.fillText(ch, px, y); px += ws[i] + sp; }); x.restore(); }
export function shareText(kind) {
  const n = 'PLAYER ' + S.P.num;
  if (kind === 'maze') return { line: 'My room became a maze.', sub: 'DOOR I · ' + n };
  if (kind === 'door') return { line: 'I knocked. Something knocked back.', sub: 'DOOR IV · ' + n };
  if (kind === 'glass') return { line: 'It stayed in the glass.', sub: 'DOOR V · ' + n };
  return { line: S.P.choice === 'close' ? 'I let the last door close.' : 'I took her place.', sub: 'DOOR XIII · ' + n };
}
async function composeShare(kind) {
  try { await Promise.all(['500 60px "Cormorant Garamond"', 'italic 400 60px "Cormorant Garamond"', '400 30px "DM Mono"'].map(f => document.fonts.load(f))); } catch (e) {}
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d');
  x.fillStyle = '#050404'; x.fillRect(0, 0, 1080, 1920);
  const data = cards.get(kind) || cards.get('maze'), im = data && await loadImage(data);
  if (im) { const s = Math.max(1080 / im.width, 1920 / im.height), w = im.width * s, h = im.height * s; x.drawImage(im, (1080 - w) / 2, (1920 - h) / 2, w, h); }
  const v = x.createRadialGradient(540, 860, 320, 540, 960, 1180); v.addColorStop(0, 'rgba(5,4,4,0)'); v.addColorStop(1, 'rgba(5,4,4,.94)'); x.fillStyle = v; x.fillRect(0, 0, 1080, 1920);
  const top = x.createLinearGradient(0, 0, 0, 420); top.addColorStop(0, 'rgba(5,4,4,.85)'); top.addColorStop(1, 'rgba(5,4,4,0)'); x.fillStyle = top; x.fillRect(0, 0, 1080, 420);
  const low = x.createLinearGradient(0, 1300, 0, 1920); low.addColorStop(0, 'rgba(5,4,4,0)'); low.addColorStop(.45, 'rgba(5,4,4,.84)'); low.addColorStop(1, 'rgba(5,4,4,.97)'); x.fillStyle = low; x.fillRect(0, 1300, 1080, 620);
  const t = shareText(kind), lit = S.P.door;
  x.textAlign = 'center'; x.fillStyle = '#F2EAD9'; x.font = '500 92px "Cormorant Garamond", Georgia, serif'; spaced(x, 'THRESHOLD', 540, 240, 22);
  x.font = 'italic 400 64px "Cormorant Garamond", Georgia, serif'; x.fillText(t.line, 540, 1530);
  x.fillStyle = '#E3C07A'; x.font = '400 30px "DM Mono", monospace'; spaced(x, t.sub, 540, 1612, 6);
  for (let i = 0; i < 13; i++) { const row = i < 7 ? 0 : 1, col = row ? i - 7 : i, nInRow = row ? 6 : 7; drawMark(i, 540 + (col - (nInRow - 1) / 2) * 92, 1700 + row * 86, 58, i < lit ? 1 : .18, i < lit ? 12 : 0, 1, x); }
  x.fillStyle = 'rgba(242, 234, 217, .55)'; x.font = '400 22px "DM Mono", monospace'; spaced(x, 'THE DOORS CHOOSE WHO THEY OPEN FOR', 540, 1872, 5);
  return c;
}
const prepared = {};
export function prepareShare(kind) { return (prepared[kind] = composeShare(kind).then(c => new Promise(r => c.toBlob(b => r({ c, b }), 'image/png')))); }
export async function shareCard(kind) {
  const { c, b } = await (prepared[kind] || prepareShare(kind)), text = shareText(kind).line + ' ' + inviteURL();
  try {
    if (NATIVE) { await NATIVE.shareImage(c.toDataURL('image/png'), text); return; }
    const file = new File([b], 'threshold.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'threshold-' + kind + '.png'; document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { if (!isCancel(e)) toast('Could not share'); }
}
export async function composeForTest(kind) { return (await composeShare(kind)).toDataURL('image/png'); }
export async function remind() {             // the app only: a quiet nudge in the evening, never at 3 AM
  const at = new Date(S.P.unlockAt); at.setHours(21, 3, 0, 0);
  const ok = await NATIVE.remind(at.getTime(), 'Threshold', 'Door ' + ROMAN[S.P.door] + ' is open. Play tonight, alone.').catch(() => false);
  toast(ok ? 'Reminder set for 9:03 PM' : 'Notifications are off');
}

/* settings */
export function forget() { S.P = { num: S.P.num, name: S.P.name, invitedBy: S.P.invitedBy, warned: S.P.warned, door: 0, obj: 0, unlockAt: 0, times: {}, frags: {}, found: [], calls: [], choice: null, mark: null }; saveP(); cards.clear(); }
const gear = document.createElement('button'); gear.id = 'gear'; gear.type = 'button'; gear.hidden = true; gear.setAttribute('aria-label', 'Settings');
gear.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>';
document.body.appendChild(gear);
export const showGear = on => { gear.hidden = !on; };
gear.onclick = () => {
  const s = document.createElement('div'); s.id = 'sheet';
  s.innerHTML = '<div class="pane"><p class="eyebrow">Player ' + S.P.num + '</p>' +
    '<label>Tilt sensitivity<input id="sTilt" type="range" min="0.5" max="1.8" step="0.05" value="' + S.SETTINGS.tilt + '"></label>' +
    '<label>Your name on invitations<input id="sName" type="text" maxlength="20" autocomplete="nickname" placeholder="Optional" value="' + esc(S.P.name) + '"></label>' +
    '<div class="row"><button class="go" id="sSound" type="button">Sound ' + (S.SETTINGS.sound ? 'on' : 'off') + '</button><button class="go danger" id="sReset" type="button">Erase progress</button></div>' +
    '<button class="go dim" id="sSensors" type="button">Check the sensors</button><button class="go" id="sDone" type="button">Done</button></div>';
  document.body.appendChild(s);
  const close = () => { S.SETTINGS.tilt = +$('sTilt').value; S.P.name = $('sName').value.replace(/[<>&"]/g, '').trim().slice(0, 20); store.set('settings', S.SETTINGS); saveP(); s.remove(); };
  s.addEventListener('click', e => { if (e.target === s) close(); });
  $('sDone').onclick = close;
  $('sSensors').onclick = () => { close(); openSensors(); };
  $('sSound').onclick = () => { S.SETTINGS.sound = !S.SETTINGS.sound; audio.mute(!S.SETTINGS.sound); $('sSound').textContent = 'Sound ' + (S.SETTINGS.sound ? 'on' : 'off'); };
  twice($('sReset'), 'Tap again to erase', () => { forget(); location.replace(location.pathname); });
};

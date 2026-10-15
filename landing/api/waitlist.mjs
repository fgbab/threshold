/* THRESHOLD's launch waitlist: the same list as every GAZUM game's (ALCHEMIKA's server/waitlist.mjs: the double opt-in,
   signed links, limits and pages, which follow ELSEWHERE's), as one AWS Lambda behind CloudFront
   (threshold.gazum.ai/api/*) with DynamoDB.
     POST /api/waitlist { email, lang, source }   → 201 { ok } (new) · 200 { ok, already: true } (already listed) ·
                                                    400 bad_request (not an email; a bad source) · 429 limit
     GET  /api/waitlist/confirm?t=<token>         the confirmation email's link: a page with a button (a GET changes
                                                    nothing: mail scanners open links); "you're on the list" once
                                                    confirmed; 410 for a link that is unknown or faded (7 days)
     POST /api/waitlist/confirm?t=<token>         confirms (the page's button) → 303 back to the link
     GET  /api/waitlist/unsubscribe?t=<token>     the link in every email after the confirmation: a page with a button
     POST /api/waitlist/unsubscribe?t=<token>     leaves the list (the address is deleted): the page's button (→ 303), or a
                                                    mail app's one-click unsubscribe (RFC 8058 → 200)
   - Only CloudFront may call it: the X-Origin-Verify header it adds. The visitor is CloudFront-Viewer-Address: an IPv4
     address, or an IPv6 address's /64 (one home, one phone).
   - A faded link answers 410, never 404: CloudFront swaps every 403 and 404 for the site's 404 page.
   - The confirmation email: to a new address, or a listed one not yet confirmed and not emailed in the last 10
     minutes; in its language; from THRESHOLD <hello@email.gazum.ai> through Resend. The Resend key and the signing
     secret live in Secrets Manager (SECRET_ARN: { resend, signing }).
   - The emails and pages wear THRESHOLD's night camera: a viewfinder (REC, 03:03:07, corner brackets, ISO 3200),
     Cormorant for the words that matter, DM Mono for the camera, a thin gold line for the door's light, crimson only
     for REC (and for leaving). The wordmark is the site's, at fixed addresses: /brand/wordmark.svg (the pages) and
     /brand/wordmark-email.png (mail apps block SVG). The pages carry their own CSP (their one <style>, by hash).
   - Forgetting: DynamoDB's TTL deletes an address never confirmed 30 days after its last confirmation email.
   - Limits per visitor (hashed): 5 sign-ups a minute, 30 a day.
   Items: e#<email> { email, lang, source, createdAt, mailedAt?, confirmedAt?, ttl? } · rl#<scope>#<visitor>#<window> { n, ttl } */
import crypto from 'node:crypto';
import { domainToASCII } from 'node:url';

export const FROM = 'THRESHOLD <hello@email.gazum.ai>', REPLY_TO = 'support@gazum.ai';
export const LINK_DAYS = 7, RESEND_GAP_MS = 10 * 60_000, UNCONFIRMED_DAYS = 30, PER_MINUTE = 5, PER_DAY = 30, SEND_TIMEOUT_MS = 4000;
const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}$/, LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/, TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const INVISIBLE = /\p{Default_Ignorable_Code_Point}/gu, SOURCE = /^[a-z0-9-]{1,32}$/;

/* an email as the list keeps it (lower case, its domain in ASCII), or null */
export function emailOf(v) {
  if (typeof v !== 'string' || v.length > 1024) return null;
  const s = v.replace(INVISIBLE, '').normalize('NFC').trim().toLowerCase(), at = s.indexOf('@');
  if (at < 1 || at !== s.lastIndexOf('@')) return null;
  const local = s.slice(0, at), domain = domainToASCII(s.slice(at + 1)), labels = domain.split('.');
  if (!LOCAL.test(local) || /^\.|\.$|\.\./.test(local) || labels.length < 2 || !labels.every(l => LABEL.test(l)) || !TLD.test(labels[labels.length - 1])) return null;
  const email = `${local}@${domain}`;
  return email.length <= 254 ? email : null;
}
const mask = e => e.replace(/^(.).*?@/, '$1***@');
const hashKey = (s, pepper = '') => crypto.createHash('sha256').update(pepper + s).digest('base64url').slice(0, 16);

/* ---------- the visitor, for the limits: CloudFront-Viewer-Address is "<ip>:<port>" ---------- */
function hextets(s) {   // an IPv6 address as its eight groups, or null
  if (!/^[0-9a-f:]+$/.test(s) || s.split('::').length > 2) return null;
  const [a, b] = s.split('::'), head = a ? a.split(':') : [], tail = b === undefined ? null : b ? b.split(':') : [];
  if (tail && head.length + tail.length > 7) return null;
  const g = tail ? [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail] : head;
  return g.length === 8 && g.every(x => /^[0-9a-f]{1,4}$/.test(x)) ? g : null;
}
export function visitorOf(address) {
  let s = String(address || '').trim().toLowerCase();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(s);
  if (bracketed) s = bracketed[1];
  else if (/\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(s) || (/:\d+$/.test(s) && hextets(s.replace(/:\d+$/, '')))) s = s.replace(/:\d+$/, '');
  const v4 = /(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);   // also an IPv4-mapped IPv6 address
  if (v4) return v4[1];
  const g = hextets(s);
  return g ? `${g.slice(0, 4).map(x => parseInt(x, 16).toString(16)).join(':')}::/64` : s || 'unknown';
}

/* ---------- signed tokens: base64url(payload) + '.' + HMAC (the same as ALCHEMIKA's) ---------- */
const sign = (secret, use, payload) => crypto.createHmac('sha256', secret).update(`${use}:${payload}`).digest('base64url').slice(0, 32);
function open(secret, use, token) {
  const m = /^([A-Za-z0-9_-]{4,600})\.([A-Za-z0-9_-]{32})$/.exec(String(token || ''));
  if (!m) return null;
  const want = Buffer.from(sign(secret, use, m[1])), got = Buffer.from(m[2]);
  return crypto.timingSafeEqual(want, got) ? Buffer.from(m[1], 'base64url').toString('utf8') : null;
}
export function tokenFor(secret, email, now = Date.now()) {
  const payload = Buffer.from(`${email}|${Math.floor(now / 1000) + LINK_DAYS * 86400}`).toString('base64url');
  return `${payload}.${sign(secret, 'waitlist', payload)}`;
}
export function emailFromToken(secret, token, now = Date.now()) {
  const p = open(secret, 'waitlist', token);
  if (!p) return null;
  const i = p.lastIndexOf('|'), email = p.slice(0, i), exp = Number(p.slice(i + 1));   // an address may hold a '|'
  return i > 0 && exp * 1000 >= now ? email : null;
}
export function unsubscribeToken(secret, email) {
  const payload = Buffer.from(email).toString('base64url');
  return `${payload}.${sign(secret, 'waitlist-unsubscribe', payload)}`;
}
export const emailFromUnsubscribe = (secret, token) => open(secret, 'waitlist-unsubscribe', token);

/* ---------- words ---------- */
const WORDS = {
  en: {
    subject: 'Confirm your place on the THRESHOLD list',
    lead: 'Thirteen doors. They only appear through glass. Someone asked to hear when they open, and left this address.',
    ask: 'Confirm it is you, and we will write to you about THRESHOLD: one email when the app reaches the stores, and a few on the way.',
    button: 'Confirm my place',
    notYou: 'If you didn’t ask for this, ignore this email: an address that is never confirmed is deleted within 30 days.',
    pageTitle: 'Confirm your place', pageAsk: 'One tap, and your place on the list is kept.', pageDone: 'You’re on the list.',
    pageDoneText: 'One email when the app reaches the stores, and a few on the way. Until then, one door opens each night at 3:03 AM.',
    faded: 'This link has expired.', fadedText: 'Join again on threshold.gazum.ai, and a new one will come.',
    footer: 'You get this email because you joined the THRESHOLD list.', leave: 'Leave the list',
    leaveAsk: 'Leave the list?', leaveAskText: 'We will stop writing to you and delete your address.',
    left: 'You’re off the list.', leftText: 'We deleted your address. You can join again any time on threshold.gazum.ai.',
    unknown: 'This link isn’t one of ours.', unknownText: 'To leave the list, write to support@gazum.ai.',
    back: 'Back to THRESHOLD', hud: 'Door I'
  },
  es: {
    subject: 'Confirma tu lugar en la lista de THRESHOLD',
    lead: 'Trece puertas. Solo aparecen a través del vidrio. Alguien pidió saber cuándo se abren y dejó esta dirección.',
    ask: 'Confirma que eres tú y te escribiremos sobre THRESHOLD: un correo cuando la app llegue a las tiendas y algunos más en el camino.',
    button: 'Confirmar mi lugar',
    notYou: 'Si no lo pediste, ignora este correo: una dirección que nunca se confirma se borra en 30 días.',
    pageTitle: 'Confirma tu lugar', pageAsk: 'Un toque y tu lugar en la lista queda guardado.', pageDone: 'Ya estás en la lista.',
    pageDoneText: 'Un correo cuando la app llegue a las tiendas y algunos más en el camino. Mientras tanto, cada noche se abre una puerta a las 3:03 de la madrugada.',
    faded: 'Este enlace venció.', fadedText: 'Vuelve a unirte en threshold.gazum.ai y te llegará uno nuevo.',
    footer: 'Recibes este correo porque te uniste a la lista de THRESHOLD.', leave: 'Dejar la lista',
    leaveAsk: '¿Dejar la lista?', leaveAskText: 'Dejaremos de escribirte y borraremos tu dirección.',
    left: 'Ya no estás en la lista.', leftText: 'Borramos tu dirección. Puedes volver a unirte cuando quieras en threshold.gazum.ai.',
    unknown: 'Este enlace no es nuestro.', unknownText: 'Para dejar la lista, escríbenos a support@gazum.ai.',
    back: 'Volver a THRESHOLD', hud: 'Puerta I'
  }
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const langOf = v => /^es\b/i.test(String(v || '')) ? 'es' : /^en\b/i.test(String(v || '')) ? 'en' : null;

/* ---------- the emails: the viewfinder on night black (hex colours and tables: mail apps know little else) ---------- */
const C = { night: '#05070A', ivory: '#F2EAD9', text: '#CFC8BA', cold: '#9FB0B8', hud: '#BDB6A8', bracket: '#8F8A80', dim: '#6E7B82', gold: '#E3C07A', rec: '#E0453A' };
const SERIF = "'Cormorant Garamond','Iowan Old Style',Garamond,Georgia,serif", MONO = "'DM Mono',ui-monospace,Menlo,Consolas,monospace";
const corner = sides => `<td width="18" height="18" style="width:18px;height:18px;${sides.map(s => `border-${s}:1px solid ${C.bracket}`).join(';')};font-size:0;line-height:0">&nbsp;</td>`;
const gap = '<td style="font-size:0;line-height:0">&nbsp;</td>';
const hudRow = (left, right) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${[left, right].map((s, i) => `<td${i ? ' align="right"' : ''} style="font:500 11px/1 ${MONO};letter-spacing:.2em;text-transform:uppercase;color:${C.hud}">${s}</td>`).join('')}</tr></table>`;

function frame(origin, lang, inner, foot = '', preview = '') {
  const w = WORDS[lang] || WORDS.en;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>THRESHOLD</title></head>
<body style="margin:0;padding:0;background:${C.night};color:${C.ivory}">${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preview)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.night}"><tr><td align="center" style="padding:36px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px">
<tr>${corner(['top', 'left'])}${gap}${corner(['top', 'right'])}</tr>
<tr><td colspan="3" style="padding:2px 26px">
${hudRow(`<span style="color:${C.rec}">&#9679;</span>&nbsp;&nbsp;REC`, '03:03:07')}
<p style="margin:34px 0 32px"><img src="${esc(origin)}/brand/wordmark-email.png" width="260" alt="THRESHOLD" style="display:block;border:0;width:260px;max-width:100%;height:auto;color:${C.ivory};font:500 28px/1.2 ${SERIF};letter-spacing:.24em"></p>
${inner}
<div style="height:34px;line-height:34px;font-size:0">&nbsp;</div>
${hudRow('ISO 3200 &middot; 1/30 &middot; F1.8', esc(w.hud))}
</td></tr>
<tr>${corner(['bottom', 'left'])}${gap}${corner(['bottom', 'right'])}</tr>
</table>
<p style="max-width:540px;margin:22px auto 0;font:12px/1.7 ${MONO};letter-spacing:.03em;color:${C.dim}">GAZUM Corp. &middot; threshold.gazum.ai${foot}</p>
</td></tr></table></body></html>`;
}
const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 30px"><tr><td style="border:1px solid ${C.gold};border-radius:2px;background:#0D0B08"><a href="${esc(href)}" style="display:inline-block;padding:17px 24px;font:500 13px/1 ${MONO};letter-spacing:.18em;text-transform:uppercase;color:${C.ivory};text-decoration:none"><span style="color:${C.rec}">&#9679;</span>&nbsp;&nbsp;${esc(label.toUpperCase())}</a></td></tr></table>`;

export function confirmEmail(origin, token, lang) {
  const w = WORDS[lang] || WORDS.en, link = `${origin}/api/waitlist/confirm?t=${encodeURIComponent(token)}`;
  const html = frame(origin, lang, `<p style="margin:0 0 18px;font:italic 400 24px/1.3 ${SERIF};color:${C.ivory}">${esc(w.lead)}</p>
<p style="margin:0 0 30px;font:16px/1.65 ${SERIF};color:${C.text}">${esc(w.ask)}</p>
${button(link, w.button)}<p style="margin:0;font:13px/1.6 ${SERIF};color:${C.cold}">${esc(w.notYou)}</p>`, '', w.pageAsk);
  return { subject: w.subject, html, text: `THRESHOLD\n\n${w.lead}\n\n${w.ask}\n\n${w.button}: ${link}\n\n${w.notYou}\n` };
}

/* an email to a confirmed address (the launch emails): the unsubscribe link at the foot and the List-Unsubscribe
   headers (RFC 2369, and RFC 8058's one-click). message: { subject, html (the inner part), text, preview? } */
export function listEmail(origin, secret, email, lang, message) {
  const w = WORDS[lang] || WORDS.en;
  const link = `${origin}/api/waitlist/unsubscribe?t=${encodeURIComponent(unsubscribeToken(secret, email))}`;
  return {
    to: email, subject: message.subject,
    html: frame(origin, lang, message.html, ` &middot; <a href="${esc(link)}" style="color:${C.cold}">${esc(w.leave)}</a><br>${esc(w.footer)}`, message.preview || ''),
    text: `${message.text}\n\n${w.footer}\n${w.leave}: ${link}\n`,
    headers: { 'List-Unsubscribe': `<${link}>, <mailto:${REPLY_TO}?subject=unsubscribe>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
  };
}

/* ---------- the confirmation and unsubscribe pages: the viewfinder over a cold, graded night, one gold-lit key ---------- */
const PAGE_CSS = `*{box-sizing:border-box}html{color-scheme:dark;background:#05070A}
body{margin:0;min-height:100vh;min-height:100svh;display:grid;place-items:center;padding:20px;color:#F2EAD9;background:radial-gradient(110% 80% at 50% 38%,rgba(38,70,82,.26),rgba(5,7,10,0) 64%),#05070A;font:16px/1.65 "DM Mono",ui-monospace,Menlo,monospace}
body::after{content:"";position:fixed;inset:-60px;pointer-events:none;opacity:.12;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");animation:grain .6s steps(3,end) infinite}
main{position:relative;width:100%;max-width:480px;padding:66px 34px 64px;text-align:center}
.c{position:absolute;width:22px;height:22px;border:0 solid rgba(242,234,217,.66)}
.tl{left:0;top:0;border-left-width:1px;border-top-width:1px}.tr{right:0;top:0;border-right-width:1px;border-top-width:1px}
.bl{left:0;bottom:0;border-left-width:1px;border-bottom-width:1px}.br{right:0;bottom:0;border-right-width:1px;border-bottom-width:1px}
.hud{position:absolute;left:18px;right:18px;top:16px;margin:0;display:flex;justify-content:space-between;gap:12px;font:500 10.5px/1 "DM Mono",ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;font-variant-numeric:tabular-nums;color:rgba(242,234,217,.78)}
.hud.low{top:auto;bottom:16px;color:rgba(242,234,217,.5)}
.rec b{display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;background:#E0453A;box-shadow:0 0 8px rgba(224,69,58,.9);animation:rec 1.6s steps(1,end) infinite}
.tc b{font-weight:inherit;animation:colon 1s steps(1,end) infinite}
.mark{display:inline-block;margin:4px 0 34px;color:#F2EAD9;text-decoration:none}
.mark img{display:block;width:230px;max-width:62vw;height:auto;font:500 22px/1.2 "Cormorant Garamond","Iowan Old Style",Garamond,Georgia,serif;letter-spacing:.3em}
h1{margin:0 0 12px;font:italic 500 clamp(30px,8vw,40px)/1.08 "Cormorant Garamond","Iowan Old Style",Garamond,Georgia,serif;letter-spacing:.005em}
.say{margin:0 auto 30px;max-width:34ch;font-size:13.5px;line-height:1.75;color:#9FB0B8}
form{margin:0}
button{display:inline-flex;align-items:center;gap:12px;height:52px;padding:0 24px;border:1px solid rgba(227,192,122,.72);border-radius:2px;background:rgba(227,192,122,.06);color:#F2EAD9;font:500 12px/1 "DM Mono",ui-monospace,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;cursor:pointer;box-shadow:0 0 28px -6px rgba(227,192,122,.35);transition:background .3s,border-color .3s,box-shadow .3s}
button b{width:7px;height:7px;border-radius:50%;background:#E0453A;box-shadow:0 0 8px rgba(224,69,58,.9)}
button:hover{border-color:#E3C07A;background:rgba(227,192,122,.12);box-shadow:0 0 36px -4px rgba(227,192,122,.5)}
button.danger{border-color:rgba(224,69,58,.7);background:rgba(224,69,58,.06);box-shadow:0 0 28px -6px rgba(224,69,58,.35)}
button.danger:hover{border-color:#E0453A;background:rgba(224,69,58,.12)}
:focus-visible{outline:1px solid #E3C07A;outline-offset:4px}
a.back{display:inline-block;padding:0 0 5px;border-bottom:1px solid rgba(227,192,122,.45);color:#E3C07A;font:500 12px/1 "DM Mono",ui-monospace,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;text-decoration:none}
a.back:hover{border-color:#E3C07A}
@keyframes rec{50%{opacity:.15}}@keyframes colon{50%{opacity:.2}}
@keyframes grain{0%{transform:translate(0,0)}33%{transform:translate(-18px,12px)}66%{transform:translate(14px,-16px)}}
@media (max-width:600px){main{min-height:calc(100svh - 40px);display:grid;align-content:center}}
@media (max-width:420px){main{padding:62px 22px 58px}.hud{left:14px;right:14px;font-size:9.5px;letter-spacing:.16em}}
@media (prefers-reduced-motion:reduce){*,::after{animation:none!important;transition:none!important}}`;
const PAGE_CSP = `default-src 'none'; style-src 'sha256-${crypto.createHash('sha256').update(PAGE_CSS).digest('base64')}'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`;

function page(lang, title, body, { form = null, label = null, danger = false } = {}) {
  const w = WORDS[lang] || WORDS.en, home = lang === 'es' ? '/es/' : '/';
  const act = form ? `<form method="post" action="${esc(form)}"><button type="submit"${danger ? ' class="danger"' : ''}><b></b>${esc(label || w.button)}</button></form>`
    : `<a class="back" href="${home}">${esc(w.back)}</a>`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#05070A"><title>${esc(title)} · THRESHOLD</title><style>${PAGE_CSS}</style></head>
<body><main><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
<p class="hud"><span class="rec"><b></b>REC</span><span class="tc">03<b>:</b>03<b>:</b>07</span></p>
<a class="mark" href="${home}"><img src="/brand/wordmark.svg" width="230" alt="THRESHOLD"></a>
<h1>${esc(title)}</h1><p class="say">${esc(body)}</p>${act}
<p class="hud low"><span>ISO 3200 · 1/30 · F1.8</span><span>${esc(w.hud)}</span></p></main></body></html>`;
}
const PAGE_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': PAGE_CSP, 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' };
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
const html = (statusCode, body) => ({ statusCode, headers: PAGE_HEADERS, body });
const redirect = location => ({ statusCode: 303, headers: { location, 'cache-control': 'no-store' }, body: '' });
// RFC 8058: the one-click POST's body is List-Unsubscribe=One-Click, form-encoded or as a multipart form
const oneClick = r => /List-Unsubscribe=One-Click/i.test(r.body || '')
  || (/multipart\/form-data/i.test(r.headers['content-type'] || '') && /name="?List-Unsubscribe"?[\s\S]*?One-Click/i.test(r.body || ''));

/* ---------- the app: deps = { db, send, secrets: { signing }, now, cfg: { origin, originVerify }, log } ---------- */
export function makeApp({ db, send, secrets, now = () => Date.now(), cfg, log = console.log }) {
  const verified = h => {
    if (!cfg.originVerify) return true;   // only local use; the Lambda never runs without it (configFromEnv)
    const a = Buffer.from(String(h['x-origin-verify'] || '')), b = Buffer.from(cfg.originVerify);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  const minute = t => new Date(t).toISOString().slice(0, 16), day = t => new Date(t).toISOString().slice(0, 10);

  async function join(r) {
    let body;
    try { body = JSON.parse(r.body || '{}'); } catch { return json(400, { error: 'bad_request', message: 'The body is JSON: { email, lang, source }.' }); }
    if (!body || typeof body !== 'object') return json(400, { error: 'bad_request', message: 'The body is JSON: { email, lang, source }.' });
    const email = emailOf(body.email);
    if (!email) return json(400, { error: 'bad_request', message: 'That doesn\'t look like an email address.' });
    const source = body.source == null || body.source === '' ? 'landing'
      : typeof body.source === 'string' && SOURCE.test(body.source.trim().toLowerCase()) ? body.source.trim().toLowerCase() : null;
    if (!source) return json(400, { error: 'bad_request', message: 'source is a short tag, like "landing".' });
    const lang = langOf(body.lang) || langOf(r.headers['accept-language']) || 'en';
    const t = now(), who = hashKey(r.visitor, secrets.signing);
    if (await db.bump(`minute#${who}`, minute(t), PER_MINUTE, t) || await db.bump(`day#${who}`, day(t), PER_DAY, t)) {
      return json(429, { error: 'limit', message: 'Too many sign-ups from here. Try again later.' });
    }
    const isNew = await db.create(email, lang, source, t);
    // one email: to a new address, or a listed one not yet confirmed and not emailed in the last 10 minutes
    const due = await db.markMailed(email, t, RESEND_GAP_MS);
    if (due) {
      const msg = confirmEmail(cfg.origin, tokenFor(secrets.signing, email, t), due);
      try {
        await send({ to: email, ...msg }, { key: `confirm-${hashKey(email + ':' + Math.floor(t / RESEND_GAP_MS))}` });
        log(`waitlist: confirmation sent to ${mask(email)}`);
      } catch (e) { log(`waitlist: could not email ${mask(email)}: ${e.message}`); }
    }
    return isNew ? json(201, { ok: true }) : json(200, { ok: true, already: true });
  }

  async function confirm(r) {
    const token = r.query.t || '', lang0 = langOf(r.query.lang);
    const email = emailFromToken(secrets.signing, token, now());
    const row = email ? await db.get(email) : null;
    const lang = lang0 || (row && row.lang) || 'en', w = WORDS[lang] || WORDS.en;
    if (!row) return html(410, page(lang, w.faded, w.fadedText));   // 410, not 404: CloudFront swaps 404s for the site's page
    const self = `/api/waitlist/confirm?t=${encodeURIComponent(token)}`;
    if (r.method === 'POST') { await db.confirm(email, now()); return redirect(self); }
    if (row.confirmedAt) return html(200, page(lang, w.pageDone, w.pageDoneText));
    return html(200, page(lang, w.pageTitle, w.pageAsk, { form: self, label: w.button }));
  }

  async function unsubscribe(r) {
    const token = r.query.t || '', lang0 = langOf(r.query.lang);
    const email = emailFromUnsubscribe(secrets.signing, token);
    const row = email ? await db.get(email) : null;
    const lang = lang0 || (row && row.lang) || 'en', w = WORDS[lang] || WORDS.en;
    if (!email) return html(410, page(lang, w.unknown, w.unknownText));
    if (r.method === 'POST') {
      if (await db.remove(email)) log(`waitlist: ${mask(email)} left the list`);
      // a mail app's one-click unsubscribe (RFC 8058) wants no page, only a 2xx
      if (oneClick(r)) return { statusCode: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }, body: 'ok\n' };
      return redirect(`/api/waitlist/unsubscribe?t=${encodeURIComponent(token)}${lang0 ? `&lang=${lang0}` : ''}`);
    }
    if (!row) return html(200, page(lang, w.left, w.leftText));
    return html(200, page(lang, w.leaveAsk, w.leaveAskText, { form: `/api/waitlist/unsubscribe?t=${encodeURIComponent(token)}`, label: w.leave, danger: true }));
  }

  const ROUTES = { 'POST /api/waitlist': join, 'GET /api/waitlist/confirm': confirm, 'POST /api/waitlist/confirm': confirm, 'GET /api/waitlist/unsubscribe': unsubscribe, 'POST /api/waitlist/unsubscribe': unsubscribe };

  /* a Lambda function URL event (payload 2.0) → { statusCode, headers, body } */
  return async function handle(event) {
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    if (!verified(headers)) return json(403, { error: 'forbidden' });
    const method = event.requestContext?.http?.method || 'GET', path = (event.rawPath || '/').replace(/\/+$/, '') || '/';
    const route = ROUTES[`${method} ${path}`];
    if (!route) return json(path.startsWith('/api/waitlist') ? 405 : 404, { error: path.startsWith('/api/waitlist') ? 'method_not_allowed' : 'not_found' });
    let body = event.body || '';
    if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf8');
    if (body.length > 4096) return json(413, { error: 'too_large' });
    try {
      return await route({ method, headers, body, query: event.queryStringParameters || {}, visitor: visitorOf(headers['cloudfront-viewer-address']) });
    } catch (e) {
      log(`waitlist: ${method} ${path} failed: ${e.message}`);
      return json(500, { error: 'server', message: 'Something went wrong. Please try again.' });
    }
  };
}

/* ---------- AWS: DynamoDB (the low-level client: always in the Lambda runtime), Secrets Manager, Resend ---------- */
export function dynamo(client, sdk, table) {
  const key = email => ({ pk: { S: `e#${email}` } });
  const expires = t => ({ N: String(Math.floor(t / 1000) + UNCONFIRMED_DAYS * 86400) });
  const gone = e => e && e.name === 'ConditionalCheckFailedException';
  return {
    async get(email) {
      const it = (await client.send(new sdk.GetItemCommand({ TableName: table, Key: key(email), ConsistentRead: true }))).Item;
      return it ? { email: it.email.S, lang: it.lang.S, confirmedAt: it.confirmedAt ? Number(it.confirmedAt.N) : null } : null;
    },
    async create(email, lang, source, t) {
      try {
        await client.send(new sdk.PutItemCommand({ TableName: table, ConditionExpression: 'attribute_not_exists(pk)',
          Item: { ...key(email), email: { S: email }, lang: { S: lang }, source: { S: source }, createdAt: { N: String(t) }, ttl: expires(t) } }));
        return true;
      } catch (e) { if (gone(e)) return false; throw e; }
    },
    async markMailed(email, t, gapMs) {
      try {
        const r = await client.send(new sdk.UpdateItemCommand({ TableName: table, Key: key(email), ReturnValues: 'ALL_NEW',
          UpdateExpression: 'SET #m = :t, #ttl = :ttl',
          ConditionExpression: 'attribute_exists(pk) AND attribute_not_exists(#c) AND (attribute_not_exists(#m) OR #m < :since)',
          ExpressionAttributeNames: { '#m': 'mailedAt', '#c': 'confirmedAt', '#ttl': 'ttl' },
          ExpressionAttributeValues: { ':t': { N: String(t) }, ':since': { N: String(t - gapMs) }, ':ttl': expires(t) } }));
        return r.Attributes.lang.S;
      } catch (e) { if (gone(e)) return null; throw e; }
    },
    async confirm(email, t) {
      try {
        await client.send(new sdk.UpdateItemCommand({ TableName: table, Key: key(email), ConditionExpression: 'attribute_exists(pk)',
          UpdateExpression: 'SET #c = if_not_exists(#c, :t) REMOVE #ttl',
          ExpressionAttributeNames: { '#c': 'confirmedAt', '#ttl': 'ttl' }, ExpressionAttributeValues: { ':t': { N: String(t) } } }));
      } catch (e) { if (!gone(e)) throw e; }
    },
    async remove(email) {
      return !!(await client.send(new sdk.DeleteItemCommand({ TableName: table, Key: key(email), ReturnValues: 'ALL_OLD' }))).Attributes;
    },
    async bump(name, window, limit, t) {
      const r = await client.send(new sdk.UpdateItemCommand({ TableName: table, Key: { pk: { S: `rl#${name}#${window}` } }, ReturnValues: 'UPDATED_NEW',
        UpdateExpression: 'ADD #n :one SET #ttl = if_not_exists(#ttl, :ttl)',
        ExpressionAttributeNames: { '#n': 'n', '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':one': { N: '1' }, ':ttl': { N: String(Math.floor(t / 1000) + 2 * 86400) } } }));
      return Number(r.Attributes.n.N) > limit;
    }
  };
}

/* Resend: retries a 429 or a 5xx (twice); each attempt gives up after SEND_TIMEOUT_MS, so the sign-up still answers
   within the page's 9 s even when mail is slow (the address is kept, and the log says the email failed) */
export function resend(apiKey, fetchFn = fetch, timeoutMs = SEND_TIMEOUT_MS) {
  return async function send({ to, subject, html, text, headers }, { key } = {}) {
    for (let attempt = 0; ; attempt++) {
      const r = await fetchFn('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
        body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html, text, ...(headers ? { headers } : {}) })
      });
      if (r.ok) return (await r.json()).id;
      if ((r.status !== 429 && r.status < 500) || attempt >= 2) throw new Error(`Resend answered ${r.status}`);
      await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
    }
  };
}

/* the Lambda's settings (infra/site.yaml): all four, or it refuses to start (never open to calls without CloudFront) */
export function configFromEnv(env = process.env) {
  const missing = ['TABLE', 'SECRET_ARN', 'PUBLIC_ORIGIN', 'ORIGIN_VERIFY'].filter(k => !env[k]);
  if (missing.length) throw new Error(`the waitlist needs ${missing.join(', ')} (infra/site.yaml)`);
  return { table: env.TABLE, secretArn: env.SECRET_ARN, origin: env.PUBLIC_ORIGIN.replace(/\/+$/, ''), originVerify: env.ORIGIN_VERIFY };
}

let app = null;
export async function handler(event) {
  if (!app) {
    const env = configFromEnv();
    const ddb = await import('@aws-sdk/client-dynamodb'), sm = await import('@aws-sdk/client-secrets-manager');
    const secret = JSON.parse((await new sm.SecretsManagerClient({}).send(new sm.GetSecretValueCommand({ SecretId: env.secretArn }))).SecretString);
    if (!secret.signing || !secret.resend) throw new Error('the secret needs { resend, signing } (infra/deploy.sh secrets)');
    app = makeApp({
      db: dynamo(new ddb.DynamoDBClient({}), ddb, env.table),
      send: resend(secret.resend),
      secrets: { signing: secret.signing },
      cfg: { origin: env.origin, originVerify: env.originVerify }
    });
  }
  return app(event);
}

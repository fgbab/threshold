// The waitlist's routes and rules, with an in-memory list in place of DynamoDB and a fake mailer.
//   node --test api/test/*.test.mjs        (not node --test api/test/: Node 25 loads a bare folder as a module, and fails)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { makeApp, tokenFor, unsubscribeToken, emailOf, resend, visitorOf, confirmEmail, listEmail, configFromEnv, RESEND_GAP_MS, PER_MINUTE, FROM } from '../waitlist.mjs';

const VERIFY = 'cloudfront-only', ORIGIN = 'https://threshold.gazum.ai', SECRET = 'test-signing-secret';
function setup(start = Date.UTC(2026, 9, 15, 3, 3, 7)) {
  let t = start;
  const rows = new Map(), counters = new Map(), sent = [], logs = [];
  const db = {
    async get(email) { const r = rows.get(email); return r ? { ...r } : null; },
    async create(email, lang, source, at) { if (rows.has(email)) return false; rows.set(email, { email, lang, source, createdAt: at, mailedAt: null, confirmedAt: null }); return true; },
    async markMailed(email, at, gap) { const r = rows.get(email); if (!r || r.confirmedAt || (r.mailedAt && r.mailedAt >= at - gap)) return null; r.mailedAt = at; return r.lang; },
    async confirm(email, at) { const r = rows.get(email); if (r && !r.confirmedAt) r.confirmedAt = at; },
    async remove(email) { return rows.delete(email); },
    async bump(name, window, limit) { const k = `${name}#${window}`, n = (counters.get(k) || 0) + 1; counters.set(k, n); return n > limit; }
  };
  const app = makeApp({
    db, secrets: { signing: SECRET }, now: () => t, log: s => logs.push(s),
    send: async m => { sent.push(m); return 'id'; },
    cfg: { origin: ORIGIN, originVerify: VERIFY }
  });
  const call = (method, path, { body, query, headers = {}, ip = '203.0.113.7:443' } = {}) => app({
    rawPath: path, requestContext: { http: { method } }, queryStringParameters: query,
    headers: { 'x-origin-verify': VERIFY, 'cloudfront-viewer-address': ip, ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  return { app, call, rows, sent, logs, tick: ms => { t += ms; }, now: () => t };
}
const linkOf = mail => decodeURIComponent(/\/api\/waitlist\/confirm\?t=([^"\s]+)/.exec(mail.text)[1]);
const OTHER_GAMES = /L[O]CKED IN|l[o]ckedin|W[a]rden|ELSEWHERE|LEYLIGHT|TIMEWRIGHT|ALCHEMIKA/i;

test('emails are normalized like every GAZUM list\'s', () => {
  assert.equal(emailOf('  Hunter@Example.COM '), 'hunter@example.com');
  assert.equal(emailOf('a@b'), null);
  assert.equal(emailOf('no-at-sign.com'), null);
  assert.equal(emailOf('x@münchen.de'), 'x@xn--mnchen-3ya.de');
});

test('a new address: 201, one confirmation email in THRESHOLD\'s voice with a working link', async () => {
  const s = setup();
  const r = await s.call('POST', '/api/waitlist', { body: { email: 'Hunter@Example.com', lang: 'en', source: 'landing' } });
  assert.equal(r.statusCode, 201);
  assert.deepEqual(JSON.parse(r.body), { ok: true });
  assert.equal(s.sent.length, 1);
  const m = s.sent[0];
  assert.equal(m.to, 'hunter@example.com');
  assert.equal(m.subject, 'Confirm your place on the THRESHOLD list');
  assert.match(m.html, /Thirteen doors\. They only appear through glass\./);
  assert.match(m.html, /REC/);
  assert.match(m.html, /03:03:07</);
  assert.match(m.html, /src="https:\/\/threshold\.gazum\.ai\/brand\/wordmark-email\.png"[^>]*alt="THRESHOLD"/);
  assert.match(m.html, />&#9679;<\/span>&nbsp;&nbsp;CONFIRM MY PLACE<\/a>/);
  assert.match(m.text, /https:\/\/threshold\.gazum\.ai\/api\/waitlist\/confirm\?t=/);
  assert.equal(m.headers, undefined, 'the confirmation is not a list email: no List-Unsubscribe yet');
  assert.equal(s.rows.get('hunter@example.com').source, 'landing');
  assert.deepEqual(s.logs, ['waitlist: confirmation sent to h***@example.com']);
});

test('the same address again: 200 already, and no second email within 10 minutes', async () => {
  const s = setup();
  await s.call('POST', '/api/waitlist', { body: { email: 'a@example.com' } });
  const r = await s.call('POST', '/api/waitlist', { body: { email: 'A@example.com' } });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(JSON.parse(r.body), { ok: true, already: true });
  assert.equal(s.sent.length, 1);
  s.tick(RESEND_GAP_MS + 1000);
  await s.call('POST', '/api/waitlist', { body: { email: 'a@example.com' } });
  assert.equal(s.sent.length, 2, 'a fresh email after the gap, while unconfirmed');
});

test('Spanish: from the body, else from Accept-Language', async () => {
  const s = setup();
  await s.call('POST', '/api/waitlist', { body: { email: 'b@example.com', lang: 'es' } });
  await s.call('POST', '/api/waitlist', { body: { email: 'c@example.com' }, headers: { 'accept-language': 'es-AR,es;q=0.9' } });
  assert.equal(s.sent[0].subject, 'Confirma tu lugar en la lista de THRESHOLD');
  assert.equal(s.sent[1].subject, 'Confirma tu lugar en la lista de THRESHOLD');
  assert.match(s.sent[0].html, /<html lang="es">/);
  assert.match(s.sent[0].html, /Trece puertas\. Solo aparecen a través del vidrio\./);
  assert.match(s.sent[0].html, /CONFIRMAR MI LUGAR/);
  assert.match(s.sent[0].html, /Puerta I/);
  assert.equal(s.rows.get('c@example.com').lang, 'es');
});

test('bad input: 400', async () => {
  const s = setup();
  assert.equal((await s.call('POST', '/api/waitlist', { body: { email: 'nope' } })).statusCode, 400);
  assert.equal((await s.call('POST', '/api/waitlist', { body: '{bad json' })).statusCode, 400);
  assert.equal((await s.call('POST', '/api/waitlist', { body: { email: 'd@example.com', source: 'Not A Tag!' } })).statusCode, 400);
  assert.equal((await s.call('POST', '/api/waitlist', { body: 'x'.repeat(5000) })).statusCode, 413);
  assert.equal(s.sent.length, 0);
});

test('only through CloudFront: a missing or wrong X-Origin-Verify is 403', async () => {
  const s = setup();
  const r = await s.app({ rawPath: '/api/waitlist', requestContext: { http: { method: 'POST' } }, headers: {}, body: '{"email":"e@example.com"}' });
  assert.equal(r.statusCode, 403);
  const r2 = await s.call('POST', '/api/waitlist', { body: { email: 'e@example.com' }, headers: { 'x-origin-verify': 'guess' } });
  assert.equal(r2.statusCode, 403);
  assert.equal(s.rows.size, 0);
});

test('the Lambda refuses to start without its settings (never open to calls that skip CloudFront)', () => {
  const env = { TABLE: 't', SECRET_ARN: 'arn:aws:secretsmanager:us-east-1:1:secret:s', PUBLIC_ORIGIN: 'https://threshold.gazum.ai/', ORIGIN_VERIFY: 'v'.repeat(43) };
  assert.deepEqual(configFromEnv(env), { table: 't', secretArn: env.SECRET_ARN, origin: 'https://threshold.gazum.ai', originVerify: env.ORIGIN_VERIFY });
  assert.throws(() => configFromEnv({ ...env, ORIGIN_VERIFY: '' }), /ORIGIN_VERIFY/);
  assert.throws(() => configFromEnv({}), /TABLE, SECRET_ARN, PUBLIC_ORIGIN, ORIGIN_VERIFY/);
});

test('the visitor: CloudFront-Viewer-Address without its port; an IPv6 address counts as its /64', () => {
  assert.equal(visitorOf('203.0.113.7:46532'), '203.0.113.7');
  assert.equal(visitorOf('2001:db8:85a3:0000:0000:8a2e:0370:7334:46532'), '2001:db8:85a3:0::/64');
  assert.equal(visitorOf('2001:db8::1:443'), '2001:db8:0:0::/64');
  assert.equal(visitorOf('[2001:DB8::abcd]:443'), '2001:db8:0:0::/64');
  assert.equal(visitorOf('2001:db8::1'), '2001:db8:0:0::/64', 'no port: the last group stays an address');
  assert.equal(visitorOf('::ffff:198.51.100.4:443'), '198.51.100.4');
  assert.equal(visitorOf(''), 'unknown');
  assert.equal(visitorOf(undefined), 'unknown');
});

test('limits: more than 5 sign-ups a minute from one visitor is 429; another visitor is fine', async () => {
  const s = setup();
  for (let i = 0; i < PER_MINUTE; i++) assert.equal((await s.call('POST', '/api/waitlist', { body: { email: `p${i}@example.com` } })).statusCode, 201);
  assert.equal((await s.call('POST', '/api/waitlist', { body: { email: 'p9@example.com' } })).statusCode, 429);
  assert.equal((await s.call('POST', '/api/waitlist', { body: { email: 'q@example.com' }, ip: '198.51.100.4:443' })).statusCode, 201);
});

test('limits: a phone that hops between IPv6 addresses of its /64 is still one visitor', async () => {
  const s = setup();
  for (let i = 0; i < PER_MINUTE; i++) {
    assert.equal((await s.call('POST', '/api/waitlist', { body: { email: `v${i}@example.com` }, ip: `2001:db8:aa:bb:${i + 1}::7:${40000 + i}` })).statusCode, 201);
  }
  assert.equal((await s.call('POST', '/api/waitlist', { body: { email: 'v9@example.com' }, ip: '2001:db8:aa:bb:ffff::1:50000' })).statusCode, 429);
  assert.equal((await s.call('POST', '/api/waitlist', { body: { email: 'w@example.com' }, ip: '2001:db8:aa:cc::1:50001' })).statusCode, 201);
});

test('confirming: GET shows a button and changes nothing; POST confirms and redirects; then "you\'re on the list"', async () => {
  const s = setup();
  await s.call('POST', '/api/waitlist', { body: { email: 'f@example.com' } });
  const t = linkOf(s.sent[0]);
  const g = await s.call('GET', '/api/waitlist/confirm', { query: { t } });
  assert.equal(g.statusCode, 200);
  assert.match(g.body, /<form method="post" action="\/api\/waitlist\/confirm\?t=/);
  assert.match(g.body, /<h1>Confirm your place<\/h1>/);
  assert.equal(s.rows.get('f@example.com').confirmedAt, null);
  const p = await s.call('POST', '/api/waitlist/confirm', { query: { t } });
  assert.equal(p.statusCode, 303);
  assert.equal(p.headers.location, `/api/waitlist/confirm?t=${encodeURIComponent(t)}`);
  assert.ok(s.rows.get('f@example.com').confirmedAt);
  const after = await s.call('GET', '/api/waitlist/confirm', { query: { t } });
  assert.match(after.body, /You’re on the list\./);
  assert.match(after.body, /one door opens each night at 3:03 AM/);
  // a confirmed address gets no more confirmation emails
  s.tick(RESEND_GAP_MS * 2);
  await s.call('POST', '/api/waitlist', { body: { email: 'f@example.com' } });
  assert.equal(s.sent.length, 1);
});

test('an address with a "|" (allowed before the @) confirms too', async () => {
  const s = setup();
  await s.call('POST', '/api/waitlist', { body: { email: 'night|owl@example.com' } });
  const t = linkOf(s.sent[0]);
  assert.equal((await s.call('POST', '/api/waitlist/confirm', { query: { t } })).statusCode, 303);
  assert.ok(s.rows.get('night|owl@example.com').confirmedAt);
});

test('a faded or forged confirmation link: 410 (never 404, which CloudFront would swap for the site\'s page)', async () => {
  const s = setup();
  await s.call('POST', '/api/waitlist', { body: { email: 'g@example.com' } });
  const t = linkOf(s.sent[0]);
  s.tick(8 * 86400 * 1000);
  const faded = await s.call('GET', '/api/waitlist/confirm', { query: { t } });
  assert.equal(faded.statusCode, 410);
  assert.match(faded.body, /This link has expired\./);
  assert.equal((await s.call('POST', '/api/waitlist/confirm', { query: { t } })).statusCode, 410, 'nor can a faded link confirm');
  const forged = tokenFor('another-secret', 'g@example.com', s.now());
  assert.equal((await s.call('GET', '/api/waitlist/confirm', { query: { t: forged } })).statusCode, 410);
  assert.equal((await s.call('GET', '/api/waitlist/confirm', { query: { t: 'x.y' } })).statusCode, 410);
});

test('leaving: the page\'s button deletes the address; a mail app\'s one-click gets a plain 200', async () => {
  const s = setup();
  await s.call('POST', '/api/waitlist', { body: { email: 'h@example.com' } });
  await s.call('POST', '/api/waitlist', { body: { email: 'i@example.com' } });
  const t = unsubscribeToken(SECRET, 'h@example.com');
  const g = await s.call('GET', '/api/waitlist/unsubscribe', { query: { t } });
  assert.match(g.body, /Leave the list/);
  assert.match(g.body, /<button type="submit" class="danger">/);
  assert.equal((await s.call('POST', '/api/waitlist/unsubscribe', { query: { t } })).statusCode, 303);
  assert.equal(s.rows.has('h@example.com'), false);
  assert.match((await s.call('GET', '/api/waitlist/unsubscribe', { query: { t } })).body, /off the list/);
  const t2 = unsubscribeToken(SECRET, 'i@example.com');
  const one = await s.call('POST', '/api/waitlist/unsubscribe', { query: { t: t2 }, body: 'List-Unsubscribe=One-Click', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(one.statusCode, 200);
  assert.equal(one.body, 'ok\n');
  assert.equal(s.rows.has('i@example.com'), false);
  assert.equal((await s.call('GET', '/api/waitlist/unsubscribe', { query: { t: 'x.y' } })).statusCode, 410);
});

test('one-click as a multipart form (RFC 8058 allows it) is a plain 200 too', async () => {
  const s = setup();
  await s.call('POST', '/api/waitlist', { body: { email: 'j@example.com' } });
  const body = '--b\r\nContent-Disposition: form-data; name="List-Unsubscribe"\r\n\r\nOne-Click\r\n--b--\r\n';
  const r = await s.call('POST', '/api/waitlist/unsubscribe', { query: { t: unsubscribeToken(SECRET, 'j@example.com') }, body, headers: { 'content-type': 'multipart/form-data; boundary=b' } });
  assert.deepEqual([r.statusCode, r.body], [200, 'ok\n']);
  assert.equal(s.rows.has('j@example.com'), false);
});

test('the list\'s emails: the unsubscribe link at the foot and RFC 8058\'s headers', () => {
  const m = listEmail(ORIGIN, SECRET, 'k@example.com', 'es', { subject: 'La primera puerta', html: '<p>Hola</p>', text: 'Hola' });
  const link = `${ORIGIN}/api/waitlist/unsubscribe?t=${encodeURIComponent(unsubscribeToken(SECRET, 'k@example.com'))}`;
  assert.equal(m.to, 'k@example.com');
  assert.ok(m.html.includes(`href="${link}"`));
  assert.match(m.html, /Dejar la lista<\/a><br>Recibes este correo porque te uniste a la lista de THRESHOLD\./);
  assert.ok(m.text.endsWith(`Dejar la lista: ${link}\n`));
  assert.deepEqual(m.headers, { 'List-Unsubscribe': `<${link}>, <mailto:support@gazum.ai?subject=unsubscribe>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
});

test('the pages carry their own CSP: nothing runs, and their one <style> is allowed by its hash', async () => {
  const s = setup();
  await s.call('POST', '/api/waitlist', { body: { email: 'l@example.com', lang: 'es' } });
  const r = await s.call('GET', '/api/waitlist/confirm', { query: { t: linkOf(s.sent[0]) } });
  const csp = r.headers['content-security-policy'], css = /<style>([\s\S]*?)<\/style>/.exec(r.body)[1];
  assert.match(csp, /^default-src 'none'; /);
  assert.ok(csp.includes(`style-src 'sha256-${crypto.createHash('sha256').update(css).digest('base64')}'`));
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(r.body, /<script|\sstyle="|\son[a-z]+=/i, 'no script, no style attribute, no inline handler');
  assert.equal(r.headers['referrer-policy'], 'no-referrer', 'the token never leaves in a Referer');
  assert.match(r.body, /<html lang="es">/);
  assert.match(r.body, /<img src="\/brand\/wordmark\.svg" width="230" alt="THRESHOLD">/);
  assert.match(r.body, /<a class="mark" href="\/es\/">/);
});

test('every email and page is THRESHOLD\'s, in English and Spanish, with nothing of another game', async () => {
  const s = setup();
  for (const lang of ['en', 'es']) {
    const mail = confirmEmail(ORIGIN, tokenFor(SECRET, 'm@example.com', s.now()), lang);
    await s.call('POST', '/api/waitlist', { body: { email: `n-${lang}@example.com`, lang } });
    const t = linkOf(s.sent[s.sent.length - 1]), u = unsubscribeToken(SECRET, `n-${lang}@example.com`);
    const pages = [
      (await s.call('GET', '/api/waitlist/confirm', { query: { t } })).body,
      (await s.call('GET', '/api/waitlist/unsubscribe', { query: { t: u } })).body,
      (await s.call('GET', '/api/waitlist/confirm', { query: { t: 'x.y', lang } })).body
    ];
    for (const out of [mail.subject, mail.html, mail.text, ...pages]) {
      assert.match(out, /THRESHOLD/);
      assert.doesNotMatch(out, OTHER_GAMES);
    }
    for (const p of pages) assert.match(p, /REC[\s\S]*03<b>:<\/b>03<b>:<\/b>07<[\s\S]*ISO 3200 · 1\/30 · F1\.8/, 'the viewfinder');
  }
});

test('unknown routes and methods', async () => {
  const s = setup();
  assert.equal((await s.call('GET', '/api/nothing')).statusCode, 404);
  assert.equal((await s.call('GET', '/api/waitlist')).statusCode, 405);
});

test('Resend: the sender, the idempotency key, a time limit, and retries only on 429/5xx', async () => {
  const calls = [];
  let answers = [{ ok: false, status: 503 }, { ok: true, status: 200, json: async () => ({ id: 'em_1' }) }];
  const send = resend('re_test', async (url, init) => { calls.push({ url, init }); return answers.shift(); });
  assert.equal(await send({ to: 'j@example.com', subject: 's', html: '<p>h</p>', text: 't' }, { key: 'k1' }), 'em_1');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'k1');
  assert.ok(calls[0].init.signal instanceof AbortSignal, 'each attempt gives up in time');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.from, 'THRESHOLD <hello@email.gazum.ai>');
  assert.equal(FROM, body.from);
  assert.equal(body.reply_to, 'support@gazum.ai');
  assert.deepEqual(body.to, ['j@example.com']);
  answers = [{ ok: false, status: 422 }];
  await assert.rejects(() => send({ to: 'k@example.com', subject: 's', html: 'h', text: 't' }), /422/);
});

test('a failed email still keeps the sign-up (and says so in the log, with the address masked)', async () => {
  const s = setup();
  const app = makeApp({
    db: { get: async () => null, create: async () => true, markMailed: async () => 'en', confirm: async () => {}, remove: async () => true, bump: async () => false },
    send: async () => { throw new Error('Resend answered 500'); }, secrets: { signing: SECRET }, now: s.now, log: l => s.logs.push(l),
    cfg: { origin: ORIGIN, originVerify: VERIFY }
  });
  const r = await app({ rawPath: '/api/waitlist', requestContext: { http: { method: 'POST' } }, headers: { 'x-origin-verify': VERIFY }, body: '{"email":"o@example.com"}' });
  assert.equal(r.statusCode, 201);
  assert.deepEqual(s.logs, ['waitlist: could not email o***@example.com: Resend answered 500']);
});

// The browser lab: THRESHOLD's page in WebKit (Safari's engine, and every iPhone browser's) and Chromium, desktop and
// iPhone, in English and Spanish, under the production headers (scripts/serve.mjs sends the CSP and the
// Permissions-Policy). It checks what the page promises, saves screenshots, and exits 1 on any failure:
//   - no page errors, console errors or failed requests;
//   - the viewfinder: REC and a running clock; the door draws itself and the clock jumps to 03:03;
//   - the countdown to the next 3:03; the wall's 13 doors (only the first and last lines of her note readable);
//   - the six camera moments by keyboard and pointer; holding still; the waitlist (a bad address, then a good one: REC
//     becomes SAVED);
//   - after scrolling through: nothing left hidden, every image loaded, no sideways scroll (also at 390 and 320 px);
//   - reduced motion: no animation left running, the door already drawn;
//   - sound: browsers keep audio suspended until a gesture, which headless browsers don't. An init script makes every
//     AudioContext behave like a phone's (suspended unless resume() runs inside a trusted click, key or touch), then:
//     a saved "on" shows "paused" and a stray tap does not wake it; the Sound control does, and the mood follows the page.
// Run it before every publish (the GAZUM rule since 14 Oct 2026). Take the shared browser lock first.
//   node scripts/lab.mjs <base-url> <out-dir> [engines=webkit,chromium]      (ONLY=reduced: just the reduced-motion checks)
// (the owner's screenshots: scripts/review.mjs)
import { webkit, chromium, devices } from 'playwright';
import fs from 'node:fs';

const [, , BASE = 'http://127.0.0.1:8975', OUT = './lab', ENG = 'webkit,chromium'] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const engines = { webkit, chromium };
const fails = [], report = {};
const check = (ok, what) => { if (!ok) fails.push(what); return ok; };
const browsers = [];
const shutAll = () => Promise.all(browsers.map(b => b.close().catch(() => {})));
process.on('SIGINT', () => shutAll().then(() => process.exit(130)));
process.on('SIGTERM', () => shutAll().then(() => process.exit(143)));

// a phone's audio rules, in a headless browser
const AUDIO_SHIM = `(() => {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  let trusted = 0;
  for (const t of ['click', 'keydown', 'pointerup', 'touchend']) addEventListener(t, e => { if (e.isTrusted) { trusted++; setTimeout(() => trusted--, 0); } }, true);
  const resume = AC.prototype.resume;
  AC.prototype.resume = function () { return trusted ? resume.call(this) : Promise.reject(new DOMException('not allowed', 'NotAllowedError')); };
  const Shim = function (...a) { const c = new AC(...a); if (!trusted) c.suspend(); return c; };
  Shim.prototype = AC.prototype;
  window.AudioContext = Shim; if (window.webkitAudioContext) window.webkitAudioContext = Shim;
})();`;

const scrollTo = (page, id, off = 0) => page.evaluate(([s, o]) => { const el = document.getElementById(s); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - o, behavior: 'instant' }); }, [id, off]);
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

async function visit(browser, name, label, opts, lang) {
  const tag = `${name}-${label}-${lang}`, path = lang === 'es' ? '/es/' : '/';
  const ctx = await browser.newContext(opts), page = await ctx.newPage();
  await page.addInitScript(AUDIO_SHIM);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 240)); });
  page.on('requestfailed', r => { if (!/fgbab\.github\.io/.test(r.url())) errors.push('failed: ' + r.url().slice(-70) + ' ' + (r.failure() || {}).errorText); });
  const r = {};
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  await shot(page, `${tag}-hero-1`);
  await page.waitForTimeout(3800);
  await shot(page, `${tag}-hero-2`);
  r.hero = await page.evaluate(() => ({ lab: window.__thLab(), th: !!window.__th, js: document.documentElement.classList.contains('js'), lens: document.documentElement.classList.contains('lens-on') }));
  check(r.hero.th && r.hero.js, `${tag}: script ran`);
  check(r.hero.lab.drawn, `${tag}: the door drew itself`);
  check(/^03:0[3-9]:\d\d$/.test(r.hero.lab.tc), `${tag}: the clock jumped to 03:03 (${r.hero.lab.tc})`);
  check(r.hero.lab.rec === 'REC', `${tag}: REC`);

  // sound: the hero's Sound control, under a phone's rules
  await page.click('[data-sound="hero"]');
  await page.waitForTimeout(2200);
  r.sound = await page.evaluate(() => ({ s: window.__thSound(), pressed: document.querySelector('[data-sound="bar"]').getAttribute('aria-pressed'), state: document.querySelector('[data-sound-state]').textContent }));
  check(r.sound.s.state === 'running' && r.sound.s.on && r.sound.pressed === 'true', `${tag}: Sound starts the score (${JSON.stringify(r.sound)})`);

  // 02 · 03:03
  await scrollTo(page, 'clock'); await page.waitForTimeout(1700);
  await shot(page, `${tag}-clock`);
  r.count = await page.evaluate(() => document.querySelector('[data-count-v]').textContent);
  check(/^\d\d:\d\d:\d\d$/.test(r.count), `${tag}: the countdown (${r.count})`);
  // 03 · her phone
  await scrollTo(page, 'phone'); await page.waitForTimeout(1700);
  await shot(page, `${tag}-phone`);
  await page.click('[data-memo]'); await page.waitForTimeout(900);
  r.memo = await page.evaluate(() => ({ pressed: document.querySelector('[data-memo]').getAttribute('aria-pressed'), lit: document.querySelectorAll('.wave i.on').length }));
  check(r.memo.pressed === 'true', `${tag}: her voice memo plays`);
  await page.evaluate(() => document.querySelector('.lock').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(900);
  await page.click('[data-memo]');
  // 04 · through the glass
  await scrollTo(page, 'glass'); await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('.tiles').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(1500);
  const tilt = page.locator('[data-ctl="tilt"]');
  await tilt.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const tiltText = await tilt.getAttribute('aria-valuetext');
  const cover = page.locator('[data-ctl="cover"]');
  await cover.focus(); await page.keyboard.down('Space'); await page.waitForTimeout(1900);
  await shot(page, `${tag}-glass`);
  const covered = await page.evaluate(() => document.querySelector('[data-tile="cover"]').classList.contains('covered'));
  await page.keyboard.up('Space');
  await page.click('[data-ctl="knock"]'); await page.waitForTimeout(2700);
  const knocked = await page.evaluate(() => document.querySelector('[data-tiles-live]').textContent);
  const hum = page.locator('[data-ctl="hum"]');
  await hum.focus(); await page.keyboard.down('Enter'); await page.waitForTimeout(1500);
  const notes = await page.evaluate(() => document.querySelectorAll('.notes circle.on').length);
  await page.keyboard.up('Enter');
  const mir = page.locator('[data-ctl="mirror"]');
  await mir.focus(); await page.keyboard.press('ArrowLeft');
  const mirText = await mir.getAttribute('aria-valuetext');
  r.tiles = { tiltText, covered, knocked, notes, mirText };
  check(tiltText && tiltText !== (lang === 'es' ? 'Nivelado' : 'Level'), `${tag}: tilt by keyboard`);
  check(covered, `${tag}: cover the lens by holding Space`);
  check(/once|una vez/.test(knocked), `${tag}: one knock answers (${knocked})`);
  check(notes === 3, `${tag}: the music box plays three notes, not four (${notes})`);
  check(!!mirText, `${tag}: the reflection moves by keyboard`);
  // holding still: keep still for six seconds, then move during a second try
  await page.evaluate(() => document.querySelector('[data-still]').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(900);
  await page.click('[data-still-go]');
  await page.waitForTimeout(3600);
  await shot(page, `${tag}-still`);
  await page.waitForTimeout(3200);
  const stillDone = await page.evaluate(() => window.__thStill());
  await page.click('[data-still-go]'); await page.waitForTimeout(1200);
  if (label === 'iphone') await page.evaluate(() => window.scrollBy(0, 3)); else await page.mouse.move(40, 40), await page.mouse.move(400, 300);
  await page.waitForTimeout(500);
  const stillMoved = await page.evaluate(() => window.__thStill());
  r.still = { stillDone, stillMoved };
  check(/passed|pasó de largo/.test(stillDone.msg), `${tag}: holding still lets it pass (${stillDone.msg})`);
  check(/moved|moviste/.test(stillMoved.msg), `${tag}: moving makes it vanish (${stillMoved.msg})`);
  // 05 · the doors
  await scrollTo(page, 'doors'); await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('.wall').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(1500);
  await shot(page, `${tag}-doors`);
  r.doors = await page.evaluate(async () => {
    const b = [...document.querySelectorAll('[data-door]')], out = { n: b.length };
    b[5].click(); await new Promise(r => setTimeout(r, 200));
    out.six = { mech: document.querySelector('[data-p-mech]').textContent, redacted: document.querySelectorAll('[data-p-note] .rd').length };
    b[12].click(); await new Promise(r => setTimeout(r, 200));
    out.last = document.querySelector('[data-p-note]').textContent;
    b[0].click(); await new Promise(r => setTimeout(r, 200));
    out.first = document.querySelector('[data-p-note]').textContent;
    return out;
  });
  check(r.doors.n === 13, `${tag}: thirteen doors`);
  check(r.doors.six.redacted > 5 && /WALK|CAMINAR/.test(r.doors.six.mech), `${tag}: door VI: its mechanic, its line still dark`);
  check(/Behind the last door|Detrás de la última/.test(r.doors.last), `${tag}: door XIII's line`);
  check(/maze|laberinto/i.test(r.doors.first), `${tag}: door I's line`);
  // the waitlist: a bad address, then a good one (a preview build only pretends)
  await scrollTo(page, 'join', 40); await page.waitForTimeout(1500);
  await page.fill('#email', 'not-an-email'); await page.click('[data-join] button[type="submit"]'); await page.waitForTimeout(300);
  const invalid = await page.evaluate(() => document.querySelector('#email').getAttribute('aria-invalid'));
  await page.fill('#email', 'night@example.com'); await page.click('[data-join] button[type="submit"]'); await page.waitForTimeout(1300);
  r.join = await page.evaluate(() => ({ msg: document.querySelector('[data-msg]').textContent, rec: document.querySelector('[data-rec-label]').textContent, scene: window.__thSound().scene }));
  await shot(page, `${tag}-join`);
  check(invalid === 'true', `${tag}: a bad address is marked invalid`);
  check(/inbox|correo/.test(r.join.msg) && /SAVED|GUARDADO/.test(r.join.rec), `${tag}: joining turns REC into SAVED (${JSON.stringify(r.join)})`);
  check(r.join.scene === 'join', `${tag}: the score's mood follows the page (${r.join.scene})`);
  // after scrolling through: nothing hidden, every image loaded, no sideways scroll
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * .6) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 120)); } });
  await page.waitForTimeout(2600);
  r.probe = await page.evaluate(() => ({
    hidden: [...document.querySelectorAll('.rv')].filter(n => !n.classList.contains('in') || +getComputedStyle(n).opacity < .99).map(n => n.className.split(' ')[0]),
    images: [...document.images].filter(i => !(i.complete && i.naturalWidth > 0)).map(i => (i.currentSrc || i.src).split('/').pop()),
    overflowX: document.documentElement.scrollWidth - innerWidth
  }));
  check(!r.probe.hidden.length, `${tag}: nothing left hidden (${r.probe.hidden.join(', ')})`);
  check(!r.probe.images.length, `${tag}: every image loaded (${r.probe.images.join(', ')})`);
  check(r.probe.overflowX <= 0, `${tag}: no sideways scroll (${r.probe.overflowX})`);
  await shot(page, `${tag}-foot`);
  // a saved "on": paused until the Sound control is pressed; a stray tap doesn't wake it
  await page.goto(BASE + path, { waitUntil: 'load' }); await page.waitForTimeout(1200);
  const saved = await page.evaluate(() => ({ pressed: document.querySelector('[data-sound="hero"]').getAttribute('aria-pressed'), paused: document.querySelector('[data-sound="hero"]').hasAttribute('data-sound-paused'), state: document.querySelector('[data-sound-state]').textContent }));
  if (opts.hasTouch) await page.touchscreen.tap(30, 300); else await page.mouse.click(30, 300);
  await page.waitForTimeout(700);
  const afterTap = await page.evaluate(() => window.__thSound());
  await page.click('[data-sound="hero"]'); await page.waitForTimeout(1500);
  const afterPress = await page.evaluate(() => window.__thSound());
  r.saved = { saved, afterTap, afterPress };
  check(saved.pressed === 'false' && saved.paused, `${tag}: a saved "on" shows paused (${JSON.stringify(saved)})`);
  check(afterTap.state !== 'running', `${tag}: a stray tap doesn't start the sound (${afterTap.state})`);
  check(afterPress.state === 'running' && afterPress.on, `${tag}: the Sound control resumes it (${afterPress.state})`);
  r.errors = errors;
  check(!errors.length, `${tag}: no errors (${errors.join(' | ')})`);
  await ctx.close();
  return r;
}

try {
  for (const name of ENG.split(',')) {
    const browser = await engines[name].launch({ headless: true });
    browsers.push(browser);
    for (const [label, opts] of [['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }], ['iphone', devices['iPhone 15']]]) {
      if (label === 'iphone' && name !== 'webkit') continue;
      if (process.env.ONLY !== 'reduced') for (const lang of ['en', 'es']) report[`${name}-${label}-${lang}`] = await visit(browser, name, label, opts, lang);
    }
    if (name === 'chromium' && process.env.ONLY !== 'reduced') {
      // narrow phones: no sideways scroll at 390 and 320
      for (const w of [390, 320]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: w === 320 ? 640 : 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        await page.goto(BASE + '/es/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
        await shot(page, `chromium-${w}-es-hero`);
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * .7) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 90)); } });
        await page.waitForTimeout(1200);
        const ox = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        await scrollTo(page, 'doors'); await page.waitForTimeout(900); await shot(page, `chromium-${w}-es-doors`);
        report[`chromium-${w}`] = { overflowX: ox };
        check(ox <= 0, `chromium ${w}px: no sideways scroll (${ox})`);
        await ctx.close();
      }
    }
    // reduced motion: nothing loops, the door is already drawn; every reveal happens, and what is on screen is fully there
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' }); await page.waitForTimeout(1500);
    const rm = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms)), name = n => n.className.split(' ')[0];
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight * .6) { window.scrollTo({ top: y, behavior: 'instant' }); await sleep(100); }
      const notIn = [...document.querySelectorAll('.rv:not(.in)')].map(name), dim = [];
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight * .8) {
        window.scrollTo({ top: y, behavior: 'instant' }); await sleep(450);
        document.querySelectorAll('.rv').forEach(n => { const r = n.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight && +getComputedStyle(n).opacity < .99) dim.push(name(n)); });
      }
      window.scrollTo({ top: 0, behavior: 'instant' }); await sleep(300);
      return {
        loops: document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map(a => a.animationName || a.id || 'anim'),
        drawn: window.__thLab().drawn, tc: window.__thLab().tc, notIn, dim
      };
    });
    await shot(page, `${name}-reduced-hero`);
    report[`${name}-reduced`] = rm;
    check(!rm.loops.length, `${name} reduced motion: nothing loops (${rm.loops.join(', ')})`);
    check(rm.drawn && rm.tc === '03:03:07', `${name} reduced motion: the door drawn, the still clock (${rm.tc})`);
    check(!rm.notIn.length && !rm.dim.length, `${name} reduced motion: every reveal happens, nothing on screen left faint (${rm.notIn.concat(rm.dim).join(', ')})`);
    await ctx.close();
    await browser.close();
  }
} finally { await shutAll(); }
console.log(JSON.stringify(report, null, 1));
console.log(fails.length ? `\n${fails.length} FAILED:\n- ${fails.join('\n- ')}` : '\nALL CHECKS PASSED');
process.exit(fails.length ? 1 : 0);

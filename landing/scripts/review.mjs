// The owner's screenshots (JPEG, quality 85) of a running preview, in WebKit (Safari's engine), English:
//   desktop 1440×900: the hero, Lena, the players, the camera, the doors, join; iPhone 15: the hero and the doors.
// Take the shared browser lock first.
//   node scripts/review.mjs http://127.0.0.1:8975 ./review
import { webkit, devices } from 'playwright';
import fs from 'node:fs';

const [, , BASE = 'http://127.0.0.1:8975', OUT = './review'] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const browser = await webkit.launch({ headless: true });
const close = () => browser.close().catch(() => {});
process.on('SIGINT', () => close().then(() => process.exit(130)));
const wait = ms => new Promise(r => setTimeout(r, ms));
// a still frame: the title between flickers, the REC dot lit
const still = page => page.evaluate(() => ['.hero__title img', '.vf__rec .dot'].forEach(s => document.querySelectorAll(s).forEach(el => el.getAnimations().forEach(a => { a.currentTime = 0; a.pause(); }))));
const top = (page, sel, off = 0) => page.evaluate(([s, o]) => { const el = document.querySelector(s); window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - o, behavior: 'instant' }); }, [sel, off]);
const shot = async (page, name) => { await still(page); await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 85 }); console.log(name); };
try {
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  let page = await desk.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await wait(5600);
  await shot(page, 'desktop-1-hero');
  await top(page, '#phone'); await wait(4400);
  await shot(page, 'desktop-2-lena');
  await page.evaluate(() => document.querySelector('.lock').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.click('[data-memo]'); await wait(2600);
  await shot(page, 'desktop-3-players');
  await page.click('[data-memo]');
  await top(page, '#glass'); await wait(4400);
  // a knock (its answer comes back while the lens is covered), then the cover held down by the keyboard
  await page.click('[data-ctl="knock"]'); await wait(150);
  await page.locator('[data-ctl="cover"]').focus(); await page.keyboard.down('Space'); await wait(1900);
  await shot(page, 'desktop-4-camera');
  await page.keyboard.up('Space');
  await page.mouse.move(8, 8);
  await top(page, '#doors', -95); await wait(5200);
  await shot(page, 'desktop-5-doors');
  await top(page, '#join'); await wait(1500);
  await page.fill('#email', 'night@example.com'); await page.click('[data-join] button[type="submit"]'); await wait(1500);
  await shot(page, 'desktop-6-join');
  await desk.close();
  const phone = await browser.newContext(devices['iPhone 15']);
  page = await phone.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await wait(5600);
  await shot(page, 'iphone-1-hero');
  await top(page, '.wall-wrap', 40); await wait(4400);
  await shot(page, 'iphone-2-doors');
  await phone.close();
} finally { await close(); }

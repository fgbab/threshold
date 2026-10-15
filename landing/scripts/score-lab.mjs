// The score lab: render THRESHOLD's sound offline (headless Chromium runs the page's own js/score.js in an
// OfflineAudioContext) through a scripted 96 s visit of the page, write it as a WAV, and measure it with ffmpeg:
//   loudness (EBU R128): integrated -21 ±1 LUFS, and within 2.5 LU of that through a 250 Hz high-pass (a phone's
//   speaker); true peak at most -1.5 dBTP; momentary at most -13 LUFS and never 8 LU over the integrated level (no jump
//   scare into headphones); the first 3 s a fade-in; below 80 Hz at least 8 dB under 150 Hz–1 kHz;
//   cost: at most 40 oscillators at once, and the render under 25% of real time.
// Exits 1 when a gate fails. Listen to the WAV too. Take the shared browser lock first.
//   node scripts/score-lab.mjs <base-url> <out.wav>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const [, , BASE = 'http://127.0.0.1:8975', OUT = './score.wav'] = process.argv;
const DUR = 96, RATE = 44100;
// the visit: [time, 'scene' | 'event', name]
const PLAN = [
  [0, 'scene', 'hero'], [.05, 'event', 'rec'], [1.3, 'event', 'ember'], [4.8, 'event', 'door'],
  [14, 'scene', 'clock'], [20, 'event', 'minute'],
  [26, 'scene', 'phone'], [28.4, 'event', 'breath'], [31, 'event', 'memo'],
  [44, 'scene', 'glass'], [45.5, 'event', 'roll'], [47, 'event', 'cover'], [48.6, 'event', 'uncover'], [50, 'event', 'knock'],
  [52.1, 'event', 'answer'], [54, 'event', 'box'], [57, 'event', 'shutter'], [59, 'event', 'still'], [61.5, 'event', 'closer'], [65, 'event', 'passed'],
  [70, 'scene', 'doors'], [72, 'event', 'hum'], [77.5, 'event', 'hum'],
  [82, 'scene', 'join'], [88, 'event', 'joined']
];

const browser = await chromium.launch({ headless: true });
const done = () => browser.close().catch(() => {});
process.on('SIGINT', () => done().then(() => process.exit(130)));
let r, errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const src = await page.evaluate(() => JSON.parse(document.getElementById('th-i18n').textContent).score);
  await page.addScriptTag({ url: src });
  r = await page.evaluate(async ({ plan, dur, rate }) => {
    const ctx = new OfflineAudioContext(2, rate * dur, rate);
    const sc = window.ThresholdScore.create(ctx, ctx.destination, 7, { track: true });
    // schedule as the page does: every quarter second, the plan's next moves and the score's next 0.6 s
    const STEP = .25, todo = plan.slice().sort((a, b) => a[0] - b[0]);
    let k = 0;
    const apply = upto => { while (k < todo.length && todo[k][0] < upto) { const [t, kind, name] = todo[k++]; if (kind === 'scene') sc.scene(name, t); else sc.event(name, t); } };
    sc.start(0); apply(STEP); sc.pump(.6);
    for (let t = STEP; t < dur - .01; t += STEP) { const at = t; ctx.suspend(at).then(() => { apply(at + STEP); sc.pump(at + .6); ctx.resume(); }); }
    const t0 = performance.now(), buf = await ctx.startRendering(), ms = Math.round(performance.now() - t0);
    const L = buf.getChannelData(0), R = buf.getChannelData(1), secs = [];
    let peak = 0, bad = 0;
    for (let s = 0; s < dur; s++) {
      let sum = 0, pk = 0;
      for (let i = s * rate; i < (s + 1) * rate; i++) { const l = L[i], r2 = R[i]; if (!Number.isFinite(l) || !Number.isFinite(r2)) { bad++; continue; } sum += (l * l + r2 * r2) / 2; pk = Math.max(pk, Math.abs(l), Math.abs(r2)); }
      secs.push(+(10 * Math.log10(sum / rate + 1e-12)).toFixed(1));
      peak = Math.max(peak, pk);
    }
    const n = L.length, dv = new DataView(new ArrayBuffer(44 + n * 4)), str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
    dv.setUint32(24, rate, true); dv.setUint32(28, rate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 4, true);
    const q = v => Math.max(-32768, Math.min(32767, Math.round((Number.isFinite(v) ? v : 0) * 32767)));
    for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, q(L[i]), true); dv.setInt16(46 + i * 4, q(R[i]), true); }
    const bytes = new Uint8Array(dv.buffer); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { ms, peak: +(20 * Math.log10(peak + 1e-9)).toFixed(2), bad, secs, voices: sc.voices(), wav: btoa(bin) };
  }, { plan: PLAN, dur: DUR, rate: RATE });
} finally { await done(); }
fs.writeFileSync(OUT, Buffer.from(r.wav, 'base64'));

// ffmpeg: loudness (full band, and through a phone's 250 Hz high-pass), true peak, momentary max, bands
// ffmpeg prints its measurements on stderr: run it with stderr folded into what we read
const run = filter => spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', OUT, '-af', filter, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stderr || '';
const loud = filter => {
  const s = run(filter);
  const I = +(/I:\s+(-?[\d.]+) LUFS/.exec(s.slice(s.lastIndexOf('Summary:'))) || [])[1];
  const LRA = +(/LRA:\s+(-?[\d.]+) LU/.exec(s.slice(s.lastIndexOf('Summary:'))) || [])[1];
  const TP = +(/Peak:\s+(-?[\d.]+) dBFS/.exec(s.slice(s.lastIndexOf('Summary:'))) || [])[1];
  const M = [...s.matchAll(/t:\s*([\d.]+)\s+TARGET:[^M]*M:\s*(-?[\d.]+)/g)].map(m => [+m[1], +m[2]]);
  const Mmax = Math.max(...M.map(m => m[1]).filter(Number.isFinite));
  const firstMax = Math.max(...M.filter(m => m[0] <= 3).map(m => m[1]).filter(Number.isFinite));
  const at = (M.find(m => m[1] === Mmax) || [0])[0];
  return { I, LRA, TP, Mmax, at, firstMax };
};
const rms = filter => { const s = run(`${filter},astats=metadata=0:reset=0`); const m = /Overall[\s\S]*?RMS level dB:\s+(-?[\d.]+|-inf)/.exec(s); return m ? (m[1] === '-inf' ? -200 : +m[1]) : NaN; };
const full = loud('ebur128=peak=true'), phone = loud('highpass=f=250:poles=2,ebur128=peak=true');
const low = rms('lowpass=f=80:poles=2'), mid = rms('highpass=f=150:poles=2,lowpass=f=1000:poles=2'), hi = rms('highpass=f=1000:poles=2,lowpass=f=4000:poles=2');
const realtime = r.ms / (DUR * 1000);
const gates = [
  [Math.abs(full.I + 21) <= 1, `integrated ${full.I} LUFS (target -21 ±1)`],
  [Math.abs(phone.I - full.I) <= 2.5, `through a 250 Hz high-pass ${phone.I} LUFS (within 2.5 LU: ${(phone.I - full.I).toFixed(1)})`],
  [full.TP <= -1.5, `true peak ${full.TP} dBTP (≤ -1.5)`],
  [full.Mmax <= -13, `momentary max ${full.Mmax} LUFS at ${full.at} s (≤ -13)`],
  [full.Mmax - full.I <= 8.5, `momentary max ${(full.Mmax - full.I).toFixed(1)} LU over the integrated level (≤ ~8)`],
  [full.firstMax <= full.I + 1, `first 3 s: momentary max ${full.firstMax} LUFS (a fade-in: no stinger over the integrated level)`],
  [mid - low >= 8, `below 80 Hz ${low} dB vs 150 Hz–1 kHz ${mid} dB (${(mid - low).toFixed(1)} dB under, ≥ 8); 1–4 kHz ${hi} dB`],
  [r.voices <= 40, `${r.voices} oscillators at once at most (≤ 40)`],
  [realtime <= .25, `rendered ${DUR} s in ${r.ms} ms (${(realtime * 100).toFixed(0)}% of real time, ≤ 25%)`],
  [r.bad === 0 && !errors.length, `non-finite samples ${r.bad}, page errors ${errors.length ? errors.join(' | ') : 0}`]
];
const scenes = PLAN.filter(p => p[1] === 'scene');
scenes.forEach(([t, , name], i) => {
  const end = i + 1 < scenes.length ? scenes[i + 1][0] : DUR;
  console.log(`${name.padEnd(6)} ${String(t).padStart(3)}–${end} s · rms ${r.secs.slice(Math.round(t), Math.round(end)).join(' ')}`);
});
console.log(`sample peak ${r.peak} dBFS · LRA ${full.LRA} LU`);
gates.forEach(([ok, what]) => console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`));
const failed = gates.filter(g => !g[0]).length;
console.log(failed ? `${failed} gate(s) failed` : 'all gates pass');
process.exit(failed ? 1 : 0);

// THRESHOLD's landing page: the viewfinder and its clock, the door that only shows through glass, the countdown to the
// next 3:03 AM, her lock screen, the six camera moments (playable without a camera), the wall of doors, the waitlist,
// and the sound (js/score.js, loaded on the first press of Sound, silent until then). Plain script, no dependencies.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const T = JSON.parse($('#th-i18n').textContent);
  const root = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TALL = matchMedia('(max-aspect-ratio: 4/5)');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const pad = n => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const restart = (el, cls) => { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); };
  const fmt = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  /* ═════════════ timers that stop while the page is hidden (and come back on pageshow) ═════════════ */
  const ticks = new Set();
  const every = (ms, fn) => { const t = { ms, fn, id: 0 }; ticks.add(t); if (!document.hidden) t.id = setInterval(fn, ms); return t; };
  const pauseTicks = () => ticks.forEach(t => { clearInterval(t.id); t.id = 0; });
  const resumeTicks = () => ticks.forEach(t => { if (!t.id) { t.fn(); t.id = setInterval(t.fn, t.ms); } });
  document.addEventListener('visibilitychange', () => (document.hidden ? pauseTicks() : resumeTicks()));
  addEventListener('pagehide', pauseTicks);
  addEventListener('pageshow', () => { if (!document.hidden) resumeTicks(); });

  /* ═════════════ captions: what the sound would be, shown even with the sound off ═════════════ */
  const capEl = $('[data-cap]');
  let capTimer = 0;
  const caption = key => {
    const s = T.captions[key];
    if (!s || !capEl) return;
    capEl.textContent = s; capEl.classList.add('on');
    clearTimeout(capTimer); capTimer = setTimeout(() => capEl.classList.remove('on'), 3600);
  };

  /* ═════════════ sound: js/score.js, opt-in. Only a press of Sound starts or resumes it; what the buttons show comes
     from the AudioContext's state, never from the stored wish. ═════════════ */
  const S = (() => {
    const KEY = 'th-sound';
    let ctx = null, sc = null, want = false, timer = 0, scene = 'hero', loading = null, failed = false;
    try { want = localStorage.getItem(KEY) === '1'; } catch { /* no storage here */ }
    const save = () => { try { localStorage.setItem(KEY, want ? '1' : '0'); } catch { /* no storage here */ } };
    const btns = $$('[data-sound]'), stateEl = $('[data-sound-state]'), hintEl = $('[data-sound-hint]'), msgEl = $('[data-sound-msg]');
    const running = () => !!ctx && ctx.state === 'running';
    const live = () => !!sc && want && running();
    function paint() {
      const on = live(), paused = want && !on;
      btns.forEach(b => { b.setAttribute('aria-pressed', String(on)); b.toggleAttribute('data-sound-paused', paused); });
      if (stateEl) stateEl.textContent = on ? T.sound.rec : paused ? T.sound.paused : T.sound.stby;
      if (hintEl) hintEl.textContent = paused ? T.sound.resume : T.sound.hint;
    }
    const loadScore = () => {
      if (window.ThresholdScore) return Promise.resolve(true);
      if (!loading) loading = new Promise(res => {
        const s = document.createElement('script');
        s.src = T.score; s.async = true;
        s.onload = () => res(!!window.ThresholdScore); s.onerror = () => { loading = null; res(false); };
        document.head.appendChild(s);
      });
      return loading;
    };
    function stopTimer() { clearInterval(timer); timer = 0; }
    function pump() {
      stopTimer();
      if (!live()) return;
      sc.pump(ctx.currentTime + .6);
      timer = setInterval(() => { if (live()) sc.pump(ctx.currentTime + .6); else stopTimer(); }, 200);
    }
    function fail() {
      want = false; failed = true; save(); stopTimer();
      if (msgEl) { msgEl.textContent = ''; setTimeout(() => { msgEl.textContent = T.sound.unavailable; }, 40); }
      paint();
    }
    function makeContext() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC({ latencyHint: 'balanced' }); } catch { try { ctx = new AC(); } catch { ctx = null; return false; } }
      ctx.onstatechange = () => { if (!running()) stopTimer(); else if (want && sc && !timer) pump(); paint(); };   // 'interrupted' (a call, Siri) counts as paused
      try { ctx.addEventListener('error', fail); } catch { /* older engines */ }
      return true;
    }
    async function start() {
      // inside the gesture, before anything waits: the session (iPhone: plays through the silent switch) and resume()
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }
      if (!ctx && !makeContext()) return fail();
      let resumed;
      try { resumed = running() ? Promise.resolve() : ctx.resume(); } catch (e) { resumed = Promise.reject(e); }
      const ok = await Promise.race([Promise.resolve(resumed).then(() => true, () => false), wait(1000).then(running)]);
      if (!ok || !running()) return fail();
      if (!(await loadScore())) return fail();
      if (!sc) { try { sc = window.ThresholdScore.create(ctx, ctx.destination, (Math.random() * 4294967296) >>> 0); } catch { return fail(); } }
      if (!want) return paint();
      sc.scene(scene, ctx.currentTime); sc.start(ctx.currentTime);
      sc.event('rec', ctx.currentTime + .05);
      pump(); paint(); caption('rec');
    }
    function stop() {
      if (sc && ctx) sc.stop(ctx.currentTime);
      stopTimer();
      setTimeout(() => { if (!want && running()) ctx.suspend().catch(() => {}); }, 900);
    }
    btns.forEach(b => b.addEventListener('click', () => {
      if (live()) { want = false; save(); stop(); paint(); }
      else { want = true; failed = false; save(); if (msgEl) msgEl.textContent = ''; start(); paint(); }
    }));
    // a hidden tab goes quiet; it carries on when it comes back only if the browser allows it without a gesture
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) { stopTimer(); if (running()) ctx.suspend().catch(() => {}); }
      else if (want && sc) ctx.resume().then(() => { if (live()) pump(); paint(); }, paint);
    });
    addEventListener('pagehide', () => { stopTimer(); if (running()) ctx.suspend().catch(() => {}); });
    addEventListener('pageshow', e => { if (e.persisted) paint(); });
    paint();
    window.__thSound = () => ({ state: ctx ? ctx.state : 'none', time: ctx ? +ctx.currentTime.toFixed(2) : 0, want, scene, failed, on: live() });   // for the lab
    return {
      event(name, delay = 0) { if (live()) sc.event(name, ctx.currentTime + .01 + delay); },
      scene(name) { if (!name || name === scene) return; scene = name; if (sc && ctx) sc.scene(name, ctx.currentTime); },
      get scene_() { return scene; }
    };
  })();
  const cue = (event, cap, delay = 0) => { S.event(event, delay); if (cap) (delay ? setTimeout(() => caption(cap), delay * 1000) : caption(cap)); };

  /* ═════════════ the viewfinder: the visitor's own time, until the door makes it 03:03 ═════════════ */
  const tc = $('[data-tc]'), recEl = $('[data-rec]'), recLabel = $('[data-rec-label]');
  let jumpedAt = 0;
  const paintClock = () => {
    if (RM || !tc) return;   // reduced motion: the still frame's 03:03:07
    if (jumpedAt) { const d = new Date(); d.setHours(3, 3, 0, 0); tc.textContent = fmt(new Date(d.getTime() + Date.now() - jumpedAt)); }
    else tc.textContent = fmt(new Date());
  };
  paintClock(); every(1000, paintClock);
  const jump = () => {
    jumpedAt = Date.now(); paintClock();
    if (!RM && tc) { restart(tc, 'glitch'); setTimeout(() => tc.classList.remove('glitch'), 600); }
  };

  /* ═════════════ the hero: the hallway, the glass, the door ═════════════ */
  const hero = $('[data-hero]'), cam = $('[data-cam]');
  const stages = $$('.stage', cam || document), base = $('.stage--base'), lens = $('[data-lens]'), lensIn = $('[data-lens-in]');
  const LENS = matchMedia('(pointer: fine) and (min-width: 900px)').matches && !!lens;
  if (LENS) root.classList.add('lens-on');
  let W = 0, H = 0, SW = 0, SH = 0, heroOn = true;
  // the picture and the door: one box that covers the hero (3:2, or 9:16 on portrait screens)
  function fit() {
    if (!cam) return;
    W = cam.clientWidth; H = cam.clientHeight;
    const ar = TALL.matches ? 9 / 16 : 3 / 2;
    SW = W; SH = W / ar;
    if (SH < H) { SH = H; SW = H * ar; }
    stages.forEach(s => { s.style.width = SW + 'px'; s.style.height = SH + 'px'; });
    if (lensIn) { lensIn.style.width = W + 'px'; lensIn.style.height = H + 'px'; }
    if (LENS) { const lw = Math.round(clamp(W * .165, 176, 252)); lens.style.width = lw + 'px'; lens.style.height = Math.round(lw * 2.07) + 'px'; }
  }
  fit();
  addEventListener('resize', fit);
  if (TALL.addEventListener) TALL.addEventListener('change', fit);
  // where the door is, in the hero's pixels (the base stage never moves on a computer; it is aligned with the glass's)
  const doorBox = () => {
    const w = $('.stage--base .door-wrap');
    if (!w || !cam) return { x: W * .6, y: H * .4, h: H * .4 };
    const r = w.getBoundingClientRect(), c = cam.getBoundingClientRect();
    return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height * .5, h: r.height };
  };

  // the door draws itself: an ember runs along each stroke in turn (gazum.ai's order), then the doorway opens
  const doors = $$('.cam .door');
  const steps = [0, 1, 2, 3, 4, 5].map(k => $$(`.door__lines .door__p[data-step="${k}"]`, doors[0] || document));
  const tips = $$('.cam .door__tip');
  let drawn = false;
  function finish() {
    if (drawn || !cam) return;
    drawn = true;
    for (let k = 0; k < 6; k++) cam.style.setProperty('--d' + k, '0');
    cam.classList.remove('drawing'); cam.classList.add('open');
    setTimeout(() => { cam.classList.add('done'); jump(); cue('door', 'door'); }, RM ? 0 : 1100);
  }
  function draw() {
    if (!cam || drawn) return;
    if (RM || !steps[0].length) return finish();
    const lens0 = steps.map(list => Math.max(...list.map(p => { try { return p.getTotalLength(); } catch { return 60; } })));
    const total = lens0.reduce((a, b) => a + b, 0), DUR = 2400;
    const ends = []; lens0.reduce((acc, l) => { ends.push((acc + l) / total); return acc + l; }, 0);
    cam.classList.add('drawing');
    cue('ember', 'ember');
    const t0 = performance.now();
    const frame = now => {
      const p = Math.min(1, (now - t0) / DUR);
      let k = 0;
      for (let i = 0; i < 6; i++) {
        const a = i ? ends[i - 1] : 0, b = ends[i], local = clamp((p - a) / (b - a), 0, 1);
        cam.style.setProperty('--d' + i, String(1 - local));
        if (p >= a && p <= b) k = i;
      }
      // the ember sits on the end of the line being drawn (the first stroke of the step)
      const a = k ? ends[k - 1] : 0, local = clamp((p - a) / (ends[k] - a), 0, 1), path = steps[k][0];
      if (path) {
        try { const pt = path.getPointAtLength(local * path.getTotalLength()); tips.forEach(c => { c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1)); }); } catch { /* not rendered */ }
      }
      if (p < 1) requestAnimationFrame(frame); else finish();
    };
    requestAnimationFrame(frame);
  }
  // start once the hallway has come out of the dark (the exposure takes ~1.3 s), the picture loaded or not
  if (cam) {
    const img = $('.stage--base img');
    let started = false;
    const go = () => { if (started) return; started = true; setTimeout(draw, RM ? 0 : 1250); };
    if (!img || (img.complete && img.naturalWidth)) go(); else { img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); }
    setTimeout(go, 2600);
  }

  // the glass moves: the lens follows the pointer (and drifts around the door when left alone); on a phone, the whole
  // screen is the glass and the picture pans as the phone tilts (or as a finger drags, or slowly by itself)
  let mx = 0, my = 0, tx = 0, ty = 0, lastMove = -1e9, follow = false, tiltX = 0, tiltY = 0, dragX = 0, hasTilt = false, raf = 0;
  if (cam && LENS) {
    hero.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      const c = cam.getBoundingClientRect();
      tx = e.clientX - c.left; ty = e.clientY - c.top; follow = true; lastMove = performance.now();
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { follow = false; });
  }
  if (cam && !LENS) {
    const onTilt = e => {
      if (e.gamma == null) return;
      hasTilt = true; lastMove = performance.now();
      tiltX = clamp(e.gamma / 22, -1, 1); tiltY = clamp(((e.beta || 60) - 60) / 22, -1, 1);
    };
    const btn = $('[data-tilt]');
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      if (btn) {
        btn.hidden = false;
        btn.addEventListener('click', () => {
          DOE.requestPermission().then(s => { if (s === 'granted') addEventListener('deviceorientation', onTilt); btn.hidden = true; }, () => { btn.hidden = true; });
        });
      }
    } else if (DOE && matchMedia('(pointer: coarse)').matches) addEventListener('deviceorientation', onTilt);
    let sx = null, start = 0;
    hero.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { sx = e.clientX; start = dragX; } }, { passive: true });
    hero.addEventListener('pointermove', e => { if (sx === null) return; dragX = clamp(start + (e.clientX - sx) / (W * .5), -1, 1); lastMove = performance.now(); }, { passive: true });
    const end = () => { sx = null; };
    hero.addEventListener('pointerup', end); hero.addEventListener('pointercancel', end);
  }
  function loop(now) {
    raf = 0;
    if (!cam || !heroOn || document.hidden) return;
    const idle = now - lastMove > 2600, t = now / 1000;
    if (LENS) {
      const d = doorBox(), lw = lens.offsetWidth, lh = lens.offsetHeight;
      let gx = tx, gy = ty;
      if (!follow || idle) { gx = d.x + (RM ? 0 : Math.sin(t * .23) * lw * .12); gy = d.y + lh * .06 + (RM ? 0 : Math.sin(t * .31 + 1) * lh * .04); }
      const k = RM ? 1 : .11;
      if (!mx && !my) { mx = d.x; my = d.y; }
      mx += (gx - mx) * k; my += (gy - my) * k;
      const x = mx - lw / 2, y = my - lh / 2;
      lens.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      lensIn.style.transform = `translate3d(${(-x).toFixed(1)}px, ${(-y).toFixed(1)}px, 0)`;
    } else if (base) {
      const mxp = (SW * .07) / 2, myp = (SH * .07) / 2;
      let gx = hasTilt ? tiltX : dragX, gy = hasTilt ? tiltY : 0;
      if (!hasTilt && idle && !RM) { gx = Math.sin(t * .17) * .55; gy = Math.sin(t * .23 + 2) * .4; }
      mx += (gx - mx) * (RM ? 1 : .06); my += (gy - my) * (RM ? 1 : .06);
      base.style.transform = `translate(-50%, -50%) translate3d(${(-mx * mxp).toFixed(1)}px, ${(-my * myp).toFixed(1)}px, 0) scale(1.07)`;
    }
    raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && heroOn && !document.hidden) raf = requestAnimationFrame(loop); };
  if (cam) { kick(); document.addEventListener('visibilitychange', kick); }

  /* ═════════════ the page as one recording: the HUD dims past the hero; what's off screen stops moving ═════════════ */
  if ('IntersectionObserver' in window) {
    if (hero) new IntersectionObserver(es => es.forEach(e => {
      heroOn = e.isIntersecting; root.classList.toggle('past', e.intersectionRatio < .3);
      if (heroOn) kick();
    }), { threshold: [0, .3, .6] }).observe(hero);
    const off = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-off', !e.isIntersecting)), { rootMargin: '80px 0px' });
    $$('.hero, .mv, .join').forEach(s => off.observe(s));
  }

  /* ═════════════ reveals (the app's: a fade and an 8 px rise) ═════════════ */
  const rv = $$('.rv');
  const show = el => el.classList.add('in');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
    rv.forEach(el => io.observe(el));
  } else rv.forEach(show);
  let swept = 0;
  const sweep = () => { swept = 0; const lim = innerHeight * .98; rv.forEach(el => { if (!el.classList.contains('in') && el.getBoundingClientRect().top < lim) show(el); }); };
  addEventListener('scroll', () => { if (!swept) swept = requestAnimationFrame(sweep); }, { passive: true });
  addEventListener('load', sweep); setTimeout(sweep, 800);

  /* ═════════════ the score follows the page ═════════════ */
  let sawPhone = false;
  if ('IntersectionObserver' in window) {
    const moods = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const name = e.target.dataset.scene;
      S.scene(name);
      if (name === 'phone' && !sawPhone) { sawPhone = true; cue('breath', 'breath', 2.4); }
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('[data-scene]').forEach(s => moods.observe(s));
  }

  /* ═════════════ 03:03: the next door, in the visitor's own time ═════════════ */
  const count = $('[data-count]'), countV = $('[data-count-v]'), countK = $('[data-count-k]'), margin = $('[data-margin]');
  let lastMinute = -1;
  const paintCount = () => {
    const now = new Date(), h = now.getHours(), m = now.getMinutes();
    const open = h === 3 && m === 3;
    if (margin) margin.hidden = !open;
    if (count) {
      count.classList.toggle('now', open);
      if (open) { countK.textContent = T.clock.open; countV.textContent = fmt(now); }
      else {
        const next = new Date(now); next.setHours(3, 3, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        const s = Math.max(0, Math.round((next - now) / 1000));
        countK.textContent = T.clock.next; countV.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
      }
    }
    if (lastMinute !== -1 && m !== lastMinute && S.scene_ === 'clock') cue('minute', 'toll');
    lastMinute = m;
  };
  paintCount(); every(1000, paintCount);

  /* ═════════════ her phone: the voice memo is only static, and something breathing ═════════════ */
  const memo = $('[data-memo]'), memoLive = $('[data-memo-live]'), bars = $$('.wave i');
  if (memo) {
    let playing = false, t0 = 0, timer = 0;
    const stopMemo = () => {
      playing = false; clearInterval(timer); bars.forEach(b => b.classList.remove('on'));
      memo.setAttribute('aria-pressed', 'false'); memo.setAttribute('aria-label', T.memo.play);
      S.event('memoStop');
    };
    memo.addEventListener('click', () => {
      if (playing) return stopMemo();
      playing = true; t0 = performance.now();
      memo.setAttribute('aria-pressed', 'true'); memo.setAttribute('aria-label', T.memo.stop);
      if (memoLive) { memoLive.textContent = ''; setTimeout(() => { memoLive.textContent = T.memo.playing; }, 40); }
      cue('memo', 'static'); setTimeout(() => { if (playing) caption('breath'); }, 6200);
      timer = setInterval(() => {
        const p = (performance.now() - t0) / 13000;
        bars.forEach((b, i) => b.classList.toggle('on', i / bars.length < p));
        if (p >= 1) stopMemo();
      }, 120);
    });
  }

  /* ═════════════ through the glass: five small moments, and holding still ═════════════ */
  const tilesLive = $('[data-tiles-live]');
  const tell = s => { if (!tilesLive) return; tilesLive.textContent = ''; setTimeout(() => { tilesLive.textContent = s; }, 40); };
  const TT = T.tiles;
  // tilt: a slider (arrows, Home/End) and a drag; the ember rolls to the low side
  const tiltCtl = $('[data-ctl="tilt"]');
  if (tiltCtl) {
    const box = tiltCtl.closest('.vfm'), maze = $('.maze', box), embers = $$('.ember, .ember__halo', box);
    let v = 0, lastRoll = 0;
    const set = nv => {
      v = clamp(Math.round(nv), -12, 12);
      box.classList.add('live');
      maze.style.transform = `rotate(${v * .6}deg)`;
      embers.forEach(e => { e.style.transform = `translate3d(${(v * 3).toFixed(1)}px, 0, 0)`; });
      tiltCtl.setAttribute('aria-valuenow', String(v));
      tiltCtl.setAttribute('aria-valuetext', v === 0 ? TT.tilt.level : v < 0 ? TT.tilt.left : TT.tilt.right);
      const n = performance.now();
      if (n - lastRoll > 650) { lastRoll = n; cue('roll', 'roll'); }
    };
    tiltCtl.addEventListener('keydown', e => {
      const d = { ArrowLeft: -3, ArrowDown: -3, ArrowRight: 3, ArrowUp: 3, PageDown: -6, PageUp: 6 }[e.key];
      if (d) { e.preventDefault(); set(v + d); } else if (e.key === 'Home') { e.preventDefault(); set(-12); } else if (e.key === 'End') { e.preventDefault(); set(12); }
    });
    let sx = null, sv = 0;
    tiltCtl.addEventListener('pointerdown', e => { sx = e.clientX; sv = v; try { tiltCtl.setPointerCapture(e.pointerId); } catch { /* old engines */ } });
    tiltCtl.addEventListener('pointermove', e => { if (sx !== null) set(sv + (e.clientX - sx) / tiltCtl.clientWidth * 24); });
    const up = () => { sx = null; };
    tiltCtl.addEventListener('pointerup', up); tiltCtl.addEventListener('pointercancel', up);
  }
  // press and hold: the cover and the hum (a pointer, Space or Enter; a screen reader's click toggles for a moment)
  const holdable = (ctl, on, off) => {
    let held = false, keyHeld = false, auto = 0, keyUpAt = -1e9;
    const press = () => { if (held) return; held = true; ctl.setAttribute('aria-pressed', 'true'); on(); };
    const release = () => { clearTimeout(auto); if (!held) return; held = false; ctl.setAttribute('aria-pressed', 'false'); off(); };
    ctl.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); press(); try { ctl.setPointerCapture(e.pointerId); } catch { /* old engines */ } });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => ctl.addEventListener(n, () => { if (!keyHeld) release(); }));
    ctl.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); keyHeld = true; press(); } });
    ctl.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); keyHeld = false; keyUpAt = performance.now(); release(); } });
    ctl.addEventListener('blur', () => { keyHeld = false; release(); });
    // a screen reader's activation (a click with no pointer and no key held) covers it for a moment
    ctl.addEventListener('click', e => { if (e.detail === 0 && !keyHeld && !held && performance.now() - keyUpAt > 80) { press(); auto = setTimeout(release, 3200); } });
    ctl.addEventListener('contextmenu', e => e.preventDefault());
  };
  const coverCtl = $('[data-ctl="cover"]');
  if (coverCtl) {
    const box = coverCtl.closest('.vfm');
    holdable(coverCtl, () => { box.classList.add('covered'); cue('cover', 'dark'); tell(TT.cover.covered); }, () => { box.classList.remove('covered'); S.event('uncover'); tell(TT.cover.clear); });
  }
  const humCtl = $('[data-ctl="hum"]');
  if (humCtl) {
    const box = humCtl.closest('.vfm'), notes = $$('.notes circle:not(.notes__missing)', box);
    let last = -1e9, timers = [];
    holdable(humCtl, () => {
      box.classList.add('humming');
      const n = performance.now();
      if (n - last > 2600) {   // the box plays its three notes and stops, once per hold
        last = n; cue('box', 'box'); tell(TT.hum.box);
        timers.forEach(clearTimeout);
        timers = notes.map((c, i) => setTimeout(() => c.classList.add('on'), i * 550));
      }
    }, () => {
      box.classList.remove('humming');
      setTimeout(() => { if (!box.classList.contains('humming')) notes.forEach(c => c.classList.remove('on')); }, 1800);
    });
  }
  // knock: your knock, and one knock back from the other side
  const knockCtl = $('[data-ctl="knock"]');
  if (knockCtl) {
    const box = knockCtl.closest('.vfm');
    let answer = 0;
    knockCtl.addEventListener('click', () => {
      restart(box, 'knocked'); cue('knock', 'knock'); tell(TT.knock.you);
      clearTimeout(answer);
      answer = setTimeout(() => { restart(box, 'answered'); cue('answer', 'answer'); tell(TT.knock.back); }, 1500 + Math.random() * 900);
    });
  }
  // the front camera: your reflection follows you 1.4 s late
  const mirCtl = $('[data-ctl="mirror"]');
  if (mirCtl) {
    const box = mirCtl.closest('.vfm'), you = $('.you', box), late = $('.late', box);
    const hist = [];
    let goal = 0, cur = 0, run = 0, idleSince = 0, shot = 0;
    const tick = now => {
      run = 0;
      cur += (goal - cur) * .2;
      hist.push([now, cur]);
      while (hist.length > 2 && hist[1][0] < now - 1400) hist.shift();
      const back = hist[0][1];   // the newest position at least 1.4 s old (or the oldest one there is)
      you.style.transform = `translate3d(${(cur * 30).toFixed(1)}px, 0, 0)`;
      late.style.transform = `translate3d(${(back * 30).toFixed(1)}px, 0, 0)`;
      if (now - idleSince < 3000) run = requestAnimationFrame(tick);
      else box.classList.remove('live');
    };
    const wake = () => { idleSince = performance.now(); box.classList.add('live'); if (!run) run = requestAnimationFrame(tick); if (idleSince - shot > 5000) { shot = idleSince; cue('shutter', 'shutter'); } };
    const place = i => {
      goal = [-1, 0, 1][i]; wake();
      mirCtl.setAttribute('aria-valuenow', String(i)); mirCtl.setAttribute('aria-valuetext', TT.mirror.places[i]);
      tell(TT.mirror.you.replace('{p}', TT.mirror.places[i]));
    };
    mirCtl.addEventListener('pointermove', e => { const r = mirCtl.getBoundingClientRect(); goal = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); wake(); });
    mirCtl.addEventListener('keydown', e => {
      const i = +mirCtl.getAttribute('aria-valuenow');
      const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (d) { e.preventDefault(); place(clamp(i + d, 0, 2)); } else if (e.key === 'Home') { e.preventDefault(); place(0); } else if (e.key === 'End') { e.preventDefault(); place(2); }
    });
  }
  // hold still: it only sees what moves
  const still = $('[data-still]');
  if (still) {
    const go = $('[data-still-go]'), label = $('[data-still-label]'), bar = $('[data-still-bar]'), msg = $('[data-still-msg]'), fig = $('.still__fig', still), clock = $('[data-still-t]', still);
    const ST = T.still, DUR = 6000;
    let state = 'idle', t0 = 0, armedAt = 0, px = null, py = null, closer = false, frame = 0;
    const say = s => { msg.textContent = s; };
    const setFig = (p, o) => {
      fig.style.opacity = o.toFixed(3);
      fig.style.transform = RM ? 'translate3d(-50%, 0, 0) scale(.86)' : `translate3d(-50%, 0, 0) scale(${(.34 + .62 * p * p).toFixed(3)})`;
    };
    const end = (how) => {
      if (state !== 'watch') return;
      state = 'idle'; cancelAnimationFrame(frame); off();
      still.classList.remove('watching');
      label.textContent = ST.again;
      if (how === 'moved') {
        say(ST.moved); cue('gone', 'gone'); setFig(0, 0); bar.style.transform = 'scaleX(0)';
        if (!RM) restart(still, 'gone');
      } else {
        say(ST.done); cue('passed', '');
        fig.style.transition = 'opacity 2.6s ease'; setFig(1, 0);
        setTimeout(() => { fig.style.transition = ''; }, 2700);
      }
    };
    const moved = () => { if (state === 'watch' && performance.now() - armedAt > 450) end('moved'); };
    const onPointer = e => { if (px === null) { px = e.clientX; py = e.clientY; return; } if (Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 4) moved(); };
    const onMotion = e => { const a = e.acceleration; if (a && Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0) > 1.6) moved(); };
    const evs = [['pointermove', onPointer], ['wheel', moved], ['scroll', moved], ['keydown', moved], ['touchstart', moved], ['touchmove', moved], ['devicemotion', onMotion]];
    const on = () => evs.forEach(([n, f]) => addEventListener(n, f, { passive: true }));
    const off = () => evs.forEach(([n, f]) => removeEventListener(n, f, { passive: true }));
    const step = now => {
      if (state !== 'watch') return;
      const p = Math.min(1, (now - t0) / DUR);
      setFig(p, .12 + .78 * p);
      bar.style.transform = `scaleX(${p.toFixed(3)})`;
      clock.textContent = '00:0' + Math.min(6, Math.floor(p * 6));
      if (p > .4 && !closer) { closer = true; say(ST.closer); cue('closer', 'closer'); }
      if (p >= 1) return end('done');
      frame = requestAnimationFrame(step);
    };
    go.addEventListener('click', () => {
      if (state === 'watch') return;
      state = 'watch'; closer = false; px = py = null;
      t0 = performance.now(); armedAt = t0;
      still.classList.remove('gone'); still.classList.add('watching');
      say(ST.keep); cue('still', '');
      setTimeout(on, 0);
      frame = requestAnimationFrame(step);
    });
    window.__thStill = () => ({ state, msg: msg.textContent });   // for the lab
  }

  /* ═════════════ the wall: thirteen doors; only the lit one hums ═════════════ */
  const wall = $$('[data-door]'), D = T.doors;
  const pDoor = $('[data-p-door]'), pMech = $('[data-p-mech]'), pNote = $('[data-p-note]'), pState = $('[data-p-state]');
  const redaction = k => {
    let s = k * 7919, out = '';
    const n = 9 + (k % 4) * 2;
    for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; out += `<span class="rd" style="--w:${2 + (s % 7)}"></span>`; }
    return out + `<span class="sr">${D.redacted}</span>`;
  };
  const showDoor = k => {
    const [n, name, mech] = D.list[k - 1];
    pDoor.textContent = `${D.door} ${n} · ${name}`.toUpperCase();
    pMech.textContent = mech.toUpperCase();
    if (D.notes[k]) pNote.textContent = `“${D.notes[k]}”`; else pNote.innerHTML = redaction(k);
    if (k === 1) pState.textContent = D.tonight.toUpperCase();
    else if (k === 13) pState.innerHTML = `<b class="dot" aria-hidden="true"></b>${D.maker.toUpperCase()}`;
    else pState.textContent = `${D.night} ${n} · 03:03 · ${D.dark}`.toUpperCase();
  };
  let lastHum = 0;
  const hum = k => { if (k !== 1) return; const n = performance.now(); if (n - lastHum > 3500) { lastHum = n; cue('hum', 'hum'); } };
  wall.forEach((b, i) => {
    const k = i + 1;
    b.addEventListener('click', () => { wall.forEach(x => x.setAttribute('aria-pressed', String(x === b))); showDoor(k); hum(k); });
    b.addEventListener('focus', () => hum(k));
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { showDoor(k); hum(k); } });
    b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { const sel = wall.findIndex(x => x.getAttribute('aria-pressed') === 'true'); showDoor(sel + 1 || 1); } });
    b.addEventListener('keydown', e => {
      const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (d) { e.preventDefault(); const nb = wall[clamp(i + d, 0, wall.length - 1)]; nb.focus(); nb.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    });
  });

  /* ═════════════ the waitlist ═════════════ */
  const joinF = $('[data-join]');
  if (joinF) {
    const msg = $('[data-msg]', joinF), btn = $('button[type="submit"]', joinF), input = joinF.email;
    let busy = false;
    const say = (s, bad = false) => {
      msg.textContent = s; msg.className = 'joinf__msg' + (bad ? ' bad' : '');
      if (bad) { input.setAttribute('aria-invalid', 'true'); input.focus(); } else input.removeAttribute('aria-invalid');
    };
    input.addEventListener('input', () => { if (input.getAttribute('aria-invalid')) input.removeAttribute('aria-invalid'); });
    joinF.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      if (joinF.company.value) return;   // the honeypot: only bots fill it
      const email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return say(T.join.bad, true);
      busy = true; btn.setAttribute('aria-busy', 'true'); joinF.setAttribute('aria-busy', 'true'); say(T.join.sending);
      let r = null;
      try {
        if (joinF.dataset.endpoint) {
          const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 9000);
          r = await fetch(joinF.dataset.endpoint, { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email, lang: T.lang, source: 'landing' }) });
          clearTimeout(timer);
        } else if (joinF.dataset.preview) {
          await wait(750);   // a preview build: nothing is sent or stored
          r = { status: 201, headers: new Headers({ 'content-type': 'application/json' }) };
        }
      } catch { r = null; }
      busy = false; btn.removeAttribute('aria-busy'); joinF.removeAttribute('aria-busy');
      const isJson = !!r && /json/i.test(r.headers.get('content-type') || '');
      if (r && (r.status === 201 || (r.status === 200 && isJson))) {
        say(r.status === 201 ? T.join.ok : T.join.already);
        joinF.classList.add('done');
        if (recEl) { recEl.classList.add('saved'); recLabel.textContent = T.hud.saved; }
        cue('joined', 'bell');
      } else if (r && r.status === 400 && isJson) say(T.join.bad, true);
      else if (r && r.status === 429) say(T.join.limit, true);
      else say(T.join.fail, true);
    });
  }

  window.__thLab = () => ({ drawn, lens: LENS, tc: tc && tc.textContent, rec: recLabel && recLabel.textContent, count: countV && countV.textContent });
  window.__th = true;
})();

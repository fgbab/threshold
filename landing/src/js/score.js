// THRESHOLD's score and sound, synthesized live with Web Audio: no audio files, no voices. Built from the game's own
// instruments (src/core.js): the drone (55 / 55.4 / 82.4 / 110.3 Hz through a slowly moving lowpass, doubled an octave
// up so a phone's speaker carries it), the church toll, the creak, the breath, the whisper, the FM bell and the static
// bed. Around them, the found footage: a microphone's hiss that swells and dips the way a phone's auto-gain does, a
// camcorder's REC beep, a shutter. The music is cold glass: slow bowed-glass chords over the drone, and single far
// bell tones, in C♯ minor over the drone's A (a sharp eleventh, D♯, for the unease).
// Hard rules: never the game's recorded clips (kit.js) and never speech; the music box plays C♯5, E5 and G♯5 and stops,
// never a fourth note; bells never ring one-two-one (the glass tones are single, at least 2.5 s apart); knocks are one
// at a time, never three and three.
// One engine for the page and for offline renders (scripts/score-lab.mjs):
//   const sc = ThresholdScore.create(ctx, destination, seed, { track })   // an AudioContext or an OfflineAudioContext
//   sc.start(at) · sc.stop(at) · sc.scene(name, at) · sc.event(name, at) · sc.pump(until) · sc.voices() (with track)
// pump(until) schedules the score up to that time: the page calls it every 200 ms, a render as it goes.
(function () {
  'use strict';
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // how loud each layer is in each part of the page
  const SCENES = {
    hero: { hiss: 1, drone: .9, pads: .75, glass: .7, stat: 0 },
    clock: { hiss: .85, drone: .75, pads: .9, glass: 1, stat: 0 },
    phone: { hiss: .65, drone: .55, pads: .55, glass: .45, stat: .7 },
    glass: { hiss: .9, drone: .6, pads: .6, glass: .6, stat: 0 },
    doors: { hiss: .8, drone: .65, pads: .85, glass: .85, stat: 0 },
    join: { hiss: .5, drone: .14, pads: .2, glass: .25, stat: 0 }   // it thins almost to silence
  };
  // bowed-glass chords over the drone's A (MIDI notes), voiced above 200 Hz so a phone's speaker plays them
  const CHORDS = [
    [57, 64, 68, 73],   // A3 E4 G♯4 C♯5: the drone's chord, a major seventh, cold
    [54, 61, 64, 69],   // F♯3 C♯4 E4 A4: F♯ minor seventh
    [57, 63, 68, 71],   // A3 D♯4 G♯4 B4: the sharp eleventh, the unease
    [61, 68, 73, 76]    // C♯4 G♯4 C♯5 E5: C♯ minor, high and thin
  ];
  const GLASS = [71, 73, 75, 76, 78, 80, 83, 85];   // B4 C♯5 D♯5 E5 F♯5 G♯5 B5 C♯6: single far tones
  const BOX = [73, 76, 80];                          // C♯5 E5 G♯5, and nothing after
  const LEVEL = .82;   // the whole score's level: about -21 LUFS on a visit (scripts/score-lab.mjs measures it)

  function create(ctx, dest, seed, opts) {
    const track = !!(opts && opts.track);
    let st = (seed || 7) >>> 0;
    const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const now = () => ctx.currentTime;
    const spans = [];   // [start, stop] of every oscillator, for the lab's voice count
    const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const filter = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; };
    const pan = v => { if (!ctx.createStereoPanner) return ctx.createGain(); const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, v)); return p; };
    // a one-shot source: start, stop, count it, and let go of its nodes when it ends
    const play = (src, t, dur, ...nodes) => {
      src.start(t); src.stop(t + dur);
      if (track && src.frequency) spans.push([t, t + dur]);
      src.onended = () => { src.disconnect(); nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* gone */ } }); };
      return src;
    };
    const hit = (param, t, peak, a, d) => { param.setValueAtTime(.0001, t); param.exponentialRampToValueAtTime(peak, t + a); param.exponentialRampToValueAtTime(.0001, t + a + d); };
    const keep = [];   // sources that run for as long as the score does

    // ── the chain: the layers → the master → a soft ceiling (tanh) → out; one dark room shared by everything
    const shaper = ctx.createWaveShaper();
    shaper.curve = (() => { const n = 2048, c = new Float32Array(n), k = .78; for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = k * Math.tanh(x / k); } return c; })();
    shaper.oversample = '2x';
    shaper.connect(dest);
    const master = gain(0); master.connect(shaper);
    const muffle = filter('lowpass', 18000, .5); muffle.connect(master);   // a hand over the lens
    const NOISE = (() => { const len = ctx.sampleRate * 3, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1; return b; })();
    const noise = (t, dur) => { const n = ctx.createBufferSource(); n.buffer = NOISE; n.loop = true; n.start(t, rnd() * 2.5); n.stop(t + dur + .05); n.onended = () => n.disconnect(); return n; };
    const room = ctx.createConvolver();
    room.buffer = (() => {   // 2.4 s: a long dark room that loses its highs as it fades
      const sr = ctx.sampleRate, len = Math.floor(sr * 2.4), pre = Math.floor(sr * .025), b = ctx.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c); let lp = 0;
        for (let i = pre; i < len; i++) { const x = (i - pre) / (len - pre); lp += (rnd() * 2 - 1 - lp) * (.36 - .3 * x); d[i] = lp * Math.pow(1 - x, 2.2); }
      }
      return b;
    })();
    const roomOut = gain(.7); room.connect(roomOut).connect(muffle);
    const send = (node, amount) => node.connect(gain(amount)).connect(room);
    const lfo = (f, depth, param) => { const o = osc('sine', f), g = gain(depth); o.connect(g).connect(param); keep.push(o); return o; };
    const layer = wet => { const g = gain(0); g.connect(muffle); if (wet) send(g, wet); return g; };
    const L = { hiss: layer(0), drone: layer(.12), pads: layer(.7), glass: layer(1.1), stat: layer(.05) };
    const fx = gain(1); fx.connect(muffle); send(fx, .28);   // the page's moments
    const far = gain(.75); far.connect(muffle); send(far, 1.2);  // things on the other side

    // ── the hiss of a phone's microphone in an empty room; its auto-gain breathes it up and down
    const hissSrc = ctx.createBufferSource(); hissSrc.buffer = NOISE; hissSrc.loop = true; keep.push(hissSrc);
    const agc = gain(.06);
    hissSrc.connect(filter('highpass', 380, .6)).connect(filter('lowpass', 6800, .5)).connect(filter('peaking', 2400, .8)).connect(agc).connect(L.hiss);
    lfo(.071, .016, agc.gain);

    // ── the drone (core.js: 55 / 55.4 / 82.4 / 110.3 through a slowly moving lowpass), and its octave above
    const droneLp = filter('lowpass', 380, 3); droneLp.connect(filter('highpass', 92, .7)).connect(L.drone);
    lfo(.06, 160, droneLp.frequency);
    [[55, 'sawtooth', .06], [55.4, 'sawtooth', .06], [82.4, 'sine', .02], [110.3, 'sine', .06]].forEach(([f, type, v]) => { const o = osc(type, f); o.connect(gain(v)).connect(droneLp); keep.push(o); });
    const upLp = filter('lowpass', 1050, .9); upLp.connect(L.drone);
    lfo(.043, 260, upLp.frequency);
    [[110, 'sawtooth', .065, -.3], [110.8, 'sawtooth', .065, .3], [164.8, 'triangle', .08, 0], [220.6, 'sine', .08, 0], [330.9, 'sine', .045, .2], [441.2, 'sine', .022, -.2]].forEach(([f, type, v, p]) => { const o = osc(type, f); o.connect(gain(v)).connect(pan(p)).connect(upLp); keep.push(o); });

    // ── the static bed (core.js), for her phone
    const statSrc = ctx.createBufferSource(); statSrc.buffer = NOISE; statSrc.loop = true; keep.push(statSrc);
    const statG = gain(.12); statSrc.connect(filter('bandpass', 1800, .6)).connect(statG).connect(L.stat);
    lfo(.37, .04, statG.gain);
    const memoG = gain(0); statSrc.connect(filter('bandpass', 2200, .9)).connect(memoG).connect(fx);

    // ── bowed glass: each note of a chord swells in on its own, holds, and fades as the next chord comes; one slow
    //    tremolo per chord (a triangle per note: hollow, glassy, cheap)
    let ci = 0;
    function chord(notes, t) {
      const dur = 15 + rnd() * 3, cg = gain(1), trem = osc('sine', 3.1 + rnd() * 1.4), tg = gain(.07);
      trem.connect(tg).connect(cg.gain); cg.connect(L.pads);
      play(trem, t, dur + 7, tg, cg);
      notes.forEach((m, i) => {
        const at = t + i * (.7 + rnd() * 1.3), d = dur - i * .8, f = hz(m) * Math.pow(2, (rnd() * 10 - 5) / 1200);
        const g = gain(0), p = pan((i / (notes.length - 1) - .5) * .9), peak = .11 / Math.sqrt(1 + (m - 57) / 24);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + 5.5); g.gain.setValueAtTime(peak, at + d - 7); g.gain.linearRampToValueAtTime(0, at + d);
        const o = osc('triangle', f);
        o.connect(g).connect(p).connect(cg);
        play(o, at, d + .05, g, p);
      });
    }
    // a single FM bell (core.js bell()): carrier f, modulator 2.76 f, its brightness dying away
    function bell(t, f, vol, dur, out, panV) {
      const car = osc('sine', f), mod = osc('sine', f * 2.76), mg = gain(f * 1.6), o = gain(0), p = pan(panV || 0);
      mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(1, t + dur);
      mod.connect(mg).connect(car.frequency);
      o.gain.setValueAtTime(.0001, t); o.gain.exponentialRampToValueAtTime(vol, t + .012); o.gain.exponentialRampToValueAtTime(.0001, t + dur);
      car.connect(o).connect(p).connect(out);
      play(car, t, dur + .1, o, p); play(mod, t, dur + .1, mg);
    }
    // the church bell, far away (core.js toll(): 110 Hz and its partials), louder in the partials a phone can play
    function toll(t, vol) {
      const p = pan(rnd() * .8 - .4); p.connect(far);
      [[110, .55], [220.5, .6], [264, .45], [330.7, .4], [440.2, .3], [587, .2]].forEach(([f, a]) => {
        const o = osc('sine', f), og = gain(0);
        og.gain.setValueAtTime(.0001, t); og.gain.exponentialRampToValueAtTime(vol * a, t + .02); og.gain.exponentialRampToValueAtTime(.0001, t + 6);
        o.connect(og).connect(p); play(o, t, 6.1, og);
      });
    }
    function breath(t, vol, dur, f, panV, out) {   // core.js breath()
      const g = gain(0), p = pan(panV || 0);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * .4); g.gain.linearRampToValueAtTime(.0001, t + dur);
      noise(t, dur).connect(filter('bandpass', f, 2.2)).connect(g).connect(p).connect(out || far);
    }
    function whisper(t, dur, vol, panV) {   // core.js whisper(): syllables nobody can quite make out (not speech)
      const o = gain(vol), p = pan(panV || 0); o.connect(p).connect(far);
      for (let x = t; x < t + dur;) {
        const d = .09 + rnd() * .16, g = gain(0);
        g.gain.setValueAtTime(.0001, x); g.gain.linearRampToValueAtTime(1, x + d * .3); g.gain.linearRampToValueAtTime(.0001, x + d);
        const n = noise(x, d);
        n.connect(filter('bandpass', 400 + rnd() * 600, 6)).connect(g); n.connect(filter('bandpass', 1300 + rnd() * 1500, 8)).connect(g);
        g.connect(o);
        x += d + (rnd() < .25 ? .15 + rnd() * .2 : .02);
      }
    }
    function creak(t, vol, dur) {   // core.js creak(): a door on old hinges
      const o = osc('sawtooth', 120), l = osc('sine', 23), lg = gain(30), g = gain(0);
      o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(190, t + dur);
      l.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .2); g.gain.linearRampToValueAtTime(vol * .6, t + dur * .8); g.gain.linearRampToValueAtTime(.0001, t + dur);
      o.connect(filter('bandpass', 900, 6)).connect(g).connect(pan(rnd() * 1.2 - .6)).connect(far);
      play(o, t, dur + .05, g); play(l, t, dur + .05, lg);
    }
    // one knock: a wooden body of 200 to 600 Hz, one at a time
    function knock(t, vol, out) {
      const o = osc('sine', 260), og = gain(0);
      o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(120, t + .09);
      hit(og.gain, t, vol, .003, .16); o.connect(og).connect(out); play(o, t, .2, og);
      const ng = gain(0); hit(ng.gain, t, vol * .9, .002, .06);
      noise(t, .08).connect(filter('bandpass', 520, 1.4)).connect(ng).connect(out);
    }
    const burst = (t, dur, type, f, q, peak, out) => { const g = gain(0); hit(g.gain, t, peak, .001, dur); noise(t, dur + .02).connect(filter(type, f, q)).connect(g).connect(out || fx); };
    const beep = (t, f, dur, vol) => { const o = osc('sine', f), g = gain(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.setValueAtTime(vol, t + dur - .01); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(g).connect(fx); play(o, t, dur + .02, g); };
    // the ember: a hot wire burning a line (a crackle, and a thin warm whine), while the door draws
    function ember(t, dur) {
      const g = gain(0), bp = filter('bandpass', 3600, 1.1);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.2, t + .3); g.gain.setValueAtTime(.2, t + dur - .3); g.gain.linearRampToValueAtTime(0, t + dur);
      const crackle = gain(0); noise(t, dur).connect(bp).connect(crackle).connect(g).connect(fx);
      for (let x = t; x < t + dur; x += .012 + rnd() * .05) crackle.gain.setValueAtTime(rnd() < .4 ? .9 * rnd() : .06, x);
      const w = osc('sine', 1180), wg = gain(0); w.frequency.setValueAtTime(1180, t); w.frequency.linearRampToValueAtTime(1320, t + dur);
      wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(.012, t + .5); wg.gain.linearRampToValueAtTime(0, t + dur);
      w.connect(wg).connect(fx); play(w, t, dur + .05, wg);
    }
    // the door opens and the clock jumps to 03:03: the room holds its breath (a swell, not a jump scare)
    function swell(t) {
      const g = gain(0), lp = filter('lowpass', 300, .8);
      lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(1700, t + 2.6); lp.frequency.exponentialRampToValueAtTime(400, t + 6);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.15, t + 2.6); g.gain.exponentialRampToValueAtTime(.0001, t + 6.4);
      lp.connect(g).connect(fx); send(g, .4);
      [57, 64, 68, 75].forEach((m, i) => { const o = osc(i ? 'triangle' : 'sawtooth', hz(m)); o.detune.value = i % 2 ? 5 : -5; o.connect(lp); play(o, t, 6.5); });
      toll(t + 2.5, .11);
      droneLp.frequency.setTargetAtTime(700, t, .8); droneLp.frequency.setTargetAtTime(380, t + 3.5, 2);
    }
    function box(t) {   // three notes, then it waits: never a fourth
      BOX.forEach((m, i) => {
        const at = t + i * .55, f = hz(m) * Math.pow(2, (rnd() * 18 - 9) / 1200);
        [[1, 1], [2, .22], [3, .08], [5.4, .05]].forEach(([r, a], k) => { const o = osc('sine', f * r), g = gain(0); hit(g.gain, at, .09 * a, .003, k ? .5 : 1.6); o.connect(g).connect(fx); play(o, at, 1.7, g); });
      });
    }

    // ── the page's moments
    const sfx = {
      rec(t) { beep(t, 1960, .11, .045); burst(t + .16, .02, 'bandpass', 2600, 2, .05); },   // a camcorder starts recording
      shutter(t) { burst(t, .018, 'highpass', 4200, .7, .22); burst(t + .055, .03, 'bandpass', 1500, 1.6, .2); },
      knock(t) { knock(t, .5, fx); },
      answer(t) { knock(t, .34, far); },
      roll(t) { const g = gain(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .12); g.gain.linearRampToValueAtTime(0, t + .6); const tr = osc('sine', 17), tg = gain(.05); tr.connect(tg).connect(g.gain); play(tr, t, .62, tg); noise(t, .6).connect(filter('lowpass', 900, .7)).connect(filter('highpass', 220)).connect(g).connect(fx); },
      glitch(t) { const g = gain(0); for (let i = 0; i < 6; i++) g.gain.setValueAtTime(i % 2 ? .0001 : .09, t + i * .02); g.gain.setValueAtTime(.0001, t + .13); noise(t, .14).connect(filter('highpass', 2400)).connect(g).connect(fx); }
    };

    // ── the scheduler
    let timeline = [[0, 'hero']], started = false;
    let nextChord = 0, nextGlass = 0, nextAgc = 0, nextFar = 0, lastGlass = -9;
    const sceneAt = t => { let s = timeline[0][1]; for (const [x, n] of timeline) if (x <= t) s = n; return SCENES[s]; };
    function scene(name, at) {
      if (!SCENES[name]) return;
      const t = at == null ? now() : at;
      timeline = timeline.filter(p => p[0] < t).concat([[t, name]]);
      for (const k in L) L[k].gain.setTargetAtTime(SCENES[name][k], t, 1.6);
    }
    function event(name, at) {
      const t = at == null ? now() : at;
      switch (name) {
        case 'rec': sfx.rec(t); break;
        case 'ember': ember(t, 2.4); break;
        case 'door': swell(t); break;
        case 'minute': toll(t, .22); break;
        case 'breath': breath(t, .1, 2.2, 2400, -.2); break;
        case 'memo': memoG.gain.cancelScheduledValues(t); memoG.gain.setTargetAtTime(.05, t, .4); memoG.gain.setTargetAtTime(0, t + 12.6, .5); breath(t + 6, .09, 2, 2600, .15, fx); whisper(t + 9.2, 1.4, .05, .1); break;
        case 'memoStop': memoG.gain.cancelScheduledValues(t); memoG.gain.setTargetAtTime(0, t, .25); break;
        case 'knock': sfx.knock(t); break;
        case 'answer': sfx.answer(t); break;
        case 'box': box(t); break;
        case 'cover': muffle.frequency.cancelScheduledValues(t); muffle.frequency.setTargetAtTime(420, t, .06); knock(t, .12, fx); break;
        case 'uncover': muffle.frequency.cancelScheduledValues(t); muffle.frequency.setTargetAtTime(18000, t, .12); break;
        case 'roll': sfx.roll(t); break;
        case 'shutter': sfx.shutter(t); break;
        case 'still': whisper(t + .5, 2.2, .025, -.5); breath(t + 2.2, .05, 2.6, 2200, .3); break;
        case 'closer': breath(t, .1, 2.4, 2000, 0, fx); break;
        case 'gone': sfx.glitch(t); break;
        case 'passed': creak(t + .3, .045, 2.2); break;
        case 'hum': [[164.8, .03], [247.2, .022], [329.6, .012]].forEach(([f, v]) => { const o = osc('sine', f), g = gain(0), o2 = osc('sine', f + .7); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .8); g.gain.linearRampToValueAtTime(0, t + 3.2); o.connect(g); o2.connect(g); g.connect(fx); play(o, t, 3.3, g); play(o2, t, 3.3); }); break;
        case 'joined': bell(t, hz(68), .07, 4.5, fx, 0); break;   // one soft bell, G♯4
        default: break;
      }
    }
    function pump(until) {
      if (!started) return;
      const t0 = now() + .02;   // a page that slept skips what it missed instead of playing it all at once
      if (nextChord < t0 - 4) nextChord = t0 + 1;
      nextGlass = Math.max(nextGlass, t0); nextAgc = Math.max(nextAgc, t0); nextFar = Math.max(nextFar, t0);
      while (nextChord < until) { if (sceneAt(nextChord).pads > 0) chord(CHORDS[ci++ % CHORDS.length], nextChord); nextChord += 11 + rnd() * 5; }
      while (nextGlass < until) {
        const sc = sceneAt(nextGlass);
        if (sc.glass > 0 && nextGlass - lastGlass >= 2.5) { bell(nextGlass, hz(GLASS[Math.floor(rnd() * GLASS.length)]), .085, 5 + rnd() * 2, L.glass, rnd() * 1.4 - .7); lastGlass = nextGlass; }
        nextGlass += 3.4 + rnd() * 4;
      }
      while (nextAgc < until) { agc.gain.setTargetAtTime(.045 + rnd() * .032, nextAgc, 1.4); nextAgc += 2 + rnd() * 2.5; }   // the auto-gain hunting
      while (nextFar < until) { const r = rnd(); if (r < .14) creak(nextFar, .03, 1.8 + rnd()); else if (r < .2) breath(nextFar, .035, 2, 2600, rnd() * 1.4 - .7); nextFar += 14 + rnd() * 12; }
    }
    function start(at) {
      const t = at == null ? now() : at;
      if (!started) {
        started = true;
        keep.forEach(s => { s.start(t); if (track && s.frequency) spans.push([t, Infinity]); });
        nextChord = t + 1.2; nextGlass = t + 3.5; nextAgc = t + 1; nextFar = t + 9;
        scene(timeline[timeline.length - 1][1], t);
      }
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(LEVEL, t + 3);   // a three-second fade-in, no stinger
    }
    function stop(at) { const t = at == null ? now() : at; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(0, t, .25); }
    function voices() {   // the most oscillators sounding at once
      const ev = [];
      spans.forEach(([a, b]) => { ev.push([a, 1]); if (b !== Infinity) ev.push([b, -1]); });
      ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      let n = 0, max = 0; ev.forEach(([, d]) => { n += d; max = Math.max(max, n); });
      return max;
    }
    return { start, stop, scene, event, pump, sfx, voices };
  }

  window.ThresholdScore = { create };
})();

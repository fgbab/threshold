# THRESHOLD: journal

The resume point for the owner and the next session. Newest first.

## 15 Oct 2026: the landing page for threshold.gazum.ai (built, preview, not published)
The owner: "create the landing page for Threshold! last one is missing! with sounds and nice suspense music!"
Every other GAZUM game already has one. This one is built and checked, and waits for the owner's OK to go live.

### What it is (`landing/`, English at `/`, Spanish at `/es/`)
- **One continuous recording made at 3 AM on someone's phone.** A viewfinder stays over every screen: thin ivory
  corner brackets, a hard-blinking REC dot, the visitor's real local time, `ISO 3200 · 1/30 · F1.8`, `DOOR I`. Past the
  hero it dims to a third. Captions of the sound (`[a bell, far away]`) show in it, even with the sound off.
- **Five files recovered from Lena's phone**, with black screens between them, each holding one of her messages from
  that night (03:03 "I knocked." … 03:04 "It's behind the glass.").
  1. **REC (the hero).** A hallway at 3 AM rises out of the sensor noise. Through the glass, an ember traces its far
     door in gold and the doorway opens onto darkness; then the clock glitches to 03:03:00 and runs on from there.
     - On a computer, the glass is a phone-shaped lens that follows the pointer, and drifts around the door when left
       alone. Outside it, the hallway stays dark and the door is not there.
     - On a phone, the whole screen is the glass, and the picture pans as the phone tilts. On iPhone this starts after
       a "Hold up your phone" tap (motion permission); otherwise a finger can drag it, or it drifts slowly.
     - The calls to action: on a phone, "Play tonight" (`/play/`, the web prototype) and "Join the waitlist". On a
       computer, a QR code in a camera focus box ("Open it on your phone"), "or play here", and the waitlist.
  2. **03:03.** The rule, and a live countdown to the next 3:03 AM in the visitor's own time (the game's rule, not a
     launch date). Between 03:03 and 03:04, a door stands in the page's margin. Valparaíso at night behind it.
  3. **HER PHONE.** Lena's story beside her lock screen: 03:03, a voice memo that is only static and something
     breathing, and missed calls from the four players (names and years only, never their marks). The church behind.
  4. **THROUGH THE GLASS.** Five of the game's camera moments, playable without a camera (each a real control with a
     name and state, by pointer or keyboard): tilt (an ember rolls through a maze), cover the lens (words in the dark),
     knock (one knock answers), hum (a music box plays its three notes and waits), the front camera (your reflection
     follows you 1.4 s late). Then one thing to try: "Don't move. It only sees what moves." Hold still for six seconds
     and a smoke figure comes closer in the bathroom mirror; any movement and it vanishes.
  5. **THIRTEEN DOORS.** The wall: thirteen slim arched doors, door I lit, II to XII dashed (NIGHT II · 03:03…), XIII
     dark with a crimson dot. Hover, focus or tap traces a door and shows its mechanic and its line of her note. Only
     the first and last lines can be read; the rest are blacked out. On a phone, a scroll-snap strip.
  - Then the waitlist ("On the web tonight. The App Store next."). Joining turns REC into ■ SAVED.
- **No spoilers.** No lock's answer, no code, nothing about the endings (docs/DOORS.md keeps them).
- **The brand is THRESHOLD's own:** night black and cold blue-grey (`#05070A`, `#9FB0B8`), gold only for light
  (`#E3C07A`, `#FFEBC0`), crimson only for REC (`#E0453A`). Cormorant Garamond for the titles and Lena's lines, DM Mono
  for the camera, self-hosted (Latin and Latin Extended). Every picture is graded like the app's camera shader
  (`src/gfx.js` BG_FS), with film grain over the page.
- **Spanish** is written, not translated: neutral Latin American, tú, vidrio, teléfono, audífonos, "unirse a la lista".
  The Spanish page says the prototype is in English.

### The sound (`landing/src/js/score.js`)
- Synthesized live with Web Audio: no audio files, no voices, so no AI-voice disclosure is needed. Built from the game's
  own instruments (`src/core.js`): the drone (55 / 55.4 / 82.4 / 110.3 Hz, doubled an octave up for phone speakers),
  the church toll, the creak, the breath, the whisper, the FM bell, the static bed. Around them, the found footage: a
  phone microphone's hiss whose auto-gain breathes, a camcorder's REC beep, a shutter.
- **The music is cold glass:** slow bowed-glass chords in C♯ minor over the drone's A, and single far bell tones.
- **API:** `ThresholdScore.create(ctx, destination, seed, { track })` → `start(at)`, `stop(at)`, `scene(name, at)`,
  `event(name, at)`, `pump(until)` (the page calls it every 200 ms), `voices()` (with `track`).
- **Scenes:** `hero` (hiss and drone), `clock`, `phone` (the static bed), `glass`, `doors`, `join` (it thins almost to
  silence).
- **Events:** `rec`, `ember` (the door drawing), `door` (a low swell when the clock jumps to 03:03), `minute` (one toll
  when the minute changes in 03:03), `breath`, `memo`/`memoStop`, `knock`, `answer`, `box`, `cover`/`uncover`, `roll`,
  `shutter`, `still`, `closer`, `gone`, `passed`, `hum` (only the lit door hums), `joined` (one soft bell).
- **Hard rules kept:** the music box plays C♯5, E5, G♯5 and stops, never a fourth note; bells never ring one-two-one;
  knocks come one at a time; none of the game's recorded clips (`src/kit.js`).
- **Opt-in:** the Sound control in the hero (STBY → REC) and the two-bar audio meter in the viewfinder's corner.
  Browsers only allow sound after a press, so a saved "on" shows "Sound paused · tap to resume" until Sound is pressed
  again; a stray tap never wakes it. On iPhone it plays through the silent switch. If the device can't play sound, it
  says so once and stays off.
- **Measured** with `scripts/score-lab.mjs` (a 96 s scripted visit rendered offline, gated with ffmpeg EBU R128):
  - integrated **-21.3 LUFS**; through a 250 Hz high-pass (a phone's speaker) -23.7 LUFS, 2.4 LU down;
  - true peak -6.8 dBTP; momentary max -15.2 LUFS, 6.1 LU over the bed (the door's swell: no jump scare);
  - the first 3 s are a fade-in; below 80 Hz sits 9 dB under 150 Hz–1 kHz;
  - at most 34 oscillators at once; the render takes 15% of one core in real time; no invalid samples.
  - **Listen:** `landing/review/score-96s.m4a` (the scripted 96 s visit: hero, 03:03, her phone, the moments, the
    doors, joining).

### Checked in real browsers (`scripts/lab.mjs`)
- WebKit desktop and iPhone, Chromium desktop, English and Spanish: **all checks pass**, no errors.
  - The door draws itself and the clock jumps to 03:03; Sound starts the score, and its mood follows the page down to
    the waitlist; the countdown runs; her memo plays.
  - The five moments work by keyboard and pointer (one knock answers; the box plays three notes, never four); holding
    still lets the figure pass, moving makes it vanish.
  - The wall: 13 doors; door VI shows WALK / CAMINAR and a blacked-out line; doors I and XIII read.
  - The waitlist: a bad address is marked invalid; a good one turns REC into SAVED / GUARDADO.
  - After scrolling through: nothing left hidden, every image loaded, no sideways scroll (also at 390 and 320 px).
  - A saved "on" shows paused; a stray tap doesn't wake it; Sound does (under a phone's audio rules, simulated).
  - Reduced motion (WebKit and Chromium): nothing loops, the door is already drawn, the clock is a still 03:03:07;
    every reveal happens, and nothing on screen stays faint (measured screen by screen: a first version of this check
    also measured elements far off screen, whose fades WebKit holds until they are seen).
- Fixed along the way:
  - WebKit loaded nothing from the preview: the production CSP's `upgrade-insecure-requests` sent every request to
    https://127.0.0.1. The preview server now leaves that one directive out (the live site is https).
  - The desktop lens measured its own position, and wandered off the door.
  - On phones the words covered the door; captions covered the text (they are subtitles in the viewfinder's bottom
    row now); the lossy grain smeared into swirls (now a lossless 256 px tile, 13 KB).
- Tests: `node --test api/test/*.test.mjs infra/test/*.test.mjs`: 29 pass.

### Files
- `landing/src/`: `page.mjs` (the HTML; the door's position over the hallway is `DOOR`, the mirror is `MIRROR`),
  `i18n/en.mjs` and `es.mjs`, `css/threshold.css` and `css/fonts.css`, `js/threshold.js` (the page) and `js/score.js`
  (the sound), `img/` (graded web images, `manifest.json`, `brand/`: the title, the icon, GAZUM's wordmark), `fonts/`,
  `play/index.html` (threshold.gazum.ai/play: a door to the prototype).
- `landing/scripts/`: `fonts.mjs`, `gen-art.mjs`, `images.mjs`, `build.mjs`, `serve.mjs`, `lab.mjs`, `score-lab.mjs`,
  `review.mjs`.
- `landing/art/`: the generated originals (`generated/`), their cost log (`costs.json`), DM Mono as TTF (for the share
  images' outlines).
- `landing/review/`: the owner's screenshots (`scripts/review.mjs`, WebKit; desktop 1440×900: hero, Lena, the players,
  the camera, the doors, join; iPhone: hero, doors) and the score's 96 s render.
- `landing/api/waitlist.mjs` and `landing/infra/`: the waitlist and the hosting, prepared earlier the same day (see
  `landing/infra/README.md`). The waitlist now says F1.8 (not ƒ, which DM Mono doesn't have), "GAZUM Corp.",
  "te uniste" / "unirte", drops "AM" from its clock, and its pages fill a phone's screen like the landing's viewfinder.

### Art
Six images from the OpenAI image model (`gpt-image-2.5-sunburst`, high quality), **$0.25 in all**
(`landing/art/costs.json`): the hallway (wide, and tall for phones), the church with her phone on the floor, her
bathroom mirror, Valparaíso from the stairs, and the smoke figure. The gold door is never in a picture: the page draws
it live. Share images (`og-en.jpg`, `og-es.jpg`, 1200×630): the hallway through the viewfinder, its far door in gold.

### How to preview and work on it
- `cd ~/Projects/threshold/landing && npm install && node scripts/build.mjs`
- `PORT=8975 node scripts/serve.mjs` → http://127.0.0.1:8975/ and /es/ (both phones side by side: /_phone). The preview
  server sends the production CSP and Permissions-Policy. The sign-up form only pretends in a preview build.
- Checks (take the shared browser lock, `mkdir ~/Projects/alchemika/.browser-lock`, first; Playwright comes from the
  session's scratchpad `pw/` copy, linked into `node_modules`):
  - `node scripts/lab.mjs http://127.0.0.1:8975 <out-dir> webkit,chromium`
  - `node scripts/review.mjs http://127.0.0.1:8975 review` (the owner's screenshots)
  - `node scripts/score-lab.mjs http://127.0.0.1:8975 <out.wav>`
  - `node --test api/test/*.test.mjs infra/test/*.test.mjs` (29 tests)
- New art: `node scripts/gen-art.mjs` (reads `~/.openai-key`, never prints it; budget $3), then
  `node scripts/images.mjs`. Fonts: `node scripts/fonts.mjs`.

### Waiting for the owner's OK (nothing is created in AWS or Cloudflare yet)
From `landing/`, one step at a time (`landing/infra/README.md` has what each one creates and how to undo it):
`infra/deploy.sh check` (read-only) → `cert` → `stack` → `secrets` → `api` → `publish` → `dns` → `smoke`.
About $1 a month.

### After publishing (gazum.ai)
Once `smoke` passes, update THRESHOLD's card in `~/Projects/gazum-ai/site/src/page.mjs` (article `game--threshold`) and
its strings: the CTA becomes "Visit THRESHOLD" / "Visitar THRESHOLD" → https://threshold.gazum.ai/ and
https://threshold.gazum.ai/es/ (today it says "Play the prototype" → fgbab.github.io). While there, its HUD should read
`F1.8`, not `ƒ1.8`. Then `infra/deploy.sh publish` in gazum-ai, and check it live in WebKit and Chromium.

// THRESHOLD's landing page, rendered once per language by scripts/build.mjs. The page is one continuous recording made
// at 3 AM on someone's phone: the viewfinder (REC, the clock, corner brackets, ISO 3200 · 1/30 · F1.8) stays over every
// screen, and the story comes in five files recovered from Lena's phone, with black screens between them.
//   1 REC: the hero. A hallway at night; through the glass (a lens that follows the pointer, or the whole phone screen)
//     an ember traces the far door in gold, and the clock jumps to 03:03.
//   2 03:03: the rule, and a countdown to the next 3:03 AM in the visitor's own time.
//   3 HER PHONE: Lena's story, and her lock screen.
//   4 THROUGH THE GLASS: six of the game's camera moments, each one playable here without a camera.
//   5 THIRTEEN DOORS: the wall. Only the first and the last line of her note can be read.
//   then the waitlist.
// No spoilers: no lock's answer, no code, nothing about the endings (docs/DOORS.md keeps them).
//   page(t, A): t = the strings (src/i18n/<lang>.mjs); A = the build's helpers:
//     A.url(rel) → the hashed URL of src/<rel>; A.css; A.js (a list, in order); A.signup (empty: the form only pretends)
//     A.pic(name, { alt, sizes, cls, eager }) → a <picture> for an image in src/img/manifest.json (lazy unless eager)
//     A.art(wide, tall, { alt, cls, eager }) → the same, with a 9:16 crop for portrait screens
//     A.size(rel) → [width, height] of an SVG in src/; A.qr → { n, d }: the QR code for /play (n modules, one path)

export const SITE = 'https://threshold.gazum.ai';
export const PLAY_URL = 'https://fgbab.github.io/threshold/';
// Where the door of light stands over the hallway's far door, as a share of each picture (its box is 200 × 300 in the
// door's own units; the arch's sides sit on the door frame and its threshold line on the floor):
//   hero-wide (1536 × 1024): the far door's frame spans x 938–1075, its foot at y 450;
//   hero-tall (the 864 × 1536 crop): x 350–495, its foot at y 683.
export const DOOR = { wide: { left: 56.6, top: 8.9, h: 40.1 }, tall: { left: 32.1, top: 19.7, h: 28.3 } };
// The mirror in mirror.jpg (1024 × 1536), where the figure appears: [left, top, right, bottom] as shares of the picture
export const MIRROR = [45.4, 1.2, 90.6, 56.6];
// a portrait screen gets the 9:16 crops (the same query in the CSS and in every <picture>)
export const TALL = '(max-aspect-ratio: 4/5)';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const up = s => String(s).toUpperCase();

// the door of light: gazum.ai's door (its strokes in drawing order: data-step), each stroke three times over (a wide,
// faint glow; the halo; the crisp line), the doorway's darkness behind, and the ember that draws it
export const STROKES = [
  [0, '', 'M50 262V110a50 50 0 0 1 100 0v152'],
  [1, 'thin', 'M59 262V114a41 41 0 0 1 82 0v148'],
  [2, '', 'M100 262H14'], [2, '', 'M100 262h86'],
  [3, 'thin', 'M100 13a17 17 0 1 1 0 34a17 17 0 1 1 0-34'],
  [4, 'thin', 'M94 42V33a6 6 0 0 1 12 0v9'], [4, 'thin', 'M89 42h22'],
  [5, 'thin', 'M100 35.4a1.6 1.6 0 1 1 0 3.2a1.6 1.6 0 1 1 0-3.2']
];
const strokes = cls => STROKES.map(([step, w, d]) => `<path class="door__p${w ? ' door__p--thin' : ''}${cls}" data-step="${step}" pathLength="1" d="${d}"/>`).join('');
const doorSvg = id => `<svg class="door" viewBox="0 0 200 300" aria-hidden="true" focusable="false">
        <defs><radialGradient id="tip-${id}"><stop offset="0" stop-color="#FFFBEF"/><stop offset=".35" stop-color="#FFD58A" stop-opacity=".9"/><stop offset="1" stop-color="#FFB04A" stop-opacity="0"/></radialGradient></defs>
        <path class="door__void" d="M59 262V114a41 41 0 0 1 82 0v148Z"/>
        <g class="door__glow">${strokes('')}</g>
        <g class="door__halo">${strokes('')}</g>
        <g class="door__lines">${strokes('')}</g>
        <circle class="door__tip" r="10" cx="50" cy="262" fill="url(#tip-${id})"/>
      </svg>`;
const doorWrap = id => `<div class="door-wrap">${doorSvg(id)}</div>`;

// the corner brackets of a viewfinder
const CORNERS = '<i class="cn cn--tl" aria-hidden="true"></i><i class="cn cn--tr" aria-hidden="true"></i><i class="cn cn--bl" aria-hidden="true"></i><i class="cn cn--br" aria-hidden="true"></i>';
// the camcorder's two-bar audio meter (the sound switch)
const METER = '<span class="meter" aria-hidden="true"><i></i><i></i></span>';
const DOT = '<b class="dot" aria-hidden="true"></b>';

// the small arched door of the wall (the app icon's arch), in its own 40 × 72 box
const WALL_DOOR = `<svg class="wd__svg" viewBox="0 0 40 72" aria-hidden="true" focusable="false">
            <path class="wd__void" d="M9 66V22a11 11 0 0 1 22 0v44Z"/>
            <path class="wd__glow" d="M6 66V21a14 14 0 0 1 28 0v45M1 66h38"/>
            <path class="wd__line" pathLength="1" d="M6 66V21a14 14 0 0 1 28 0v45M1 66h38"/>
            <path class="wd__trace" pathLength="1" d="M6 66V21a14 14 0 0 1 28 0v45M1 66h38"/>
            <circle class="wd__knob" cx="26" cy="44" r="1.6"/>
          </svg>`;

// the six camera moments' little scenes (decorative; each tile's control carries the name and state)
const SCENES = {
  tilt: `<svg class="sc sc--tilt" viewBox="0 0 160 200" aria-hidden="true" focusable="false"><g class="maze">
      <path d="M22 30h116v140H22zM22 62h70M62 62v40M118 30v46M92 98h46M42 98v42M42 140h56M98 140v30M118 118v22M62 170v-30"/></g>
      <circle class="ember" r="5.5" cx="80" cy="120"/><circle class="ember__halo" r="15" cx="80" cy="120"/></svg>`,
  cover: `<svg class="sc sc--cover" viewBox="0 0 160 200" aria-hidden="true" focusable="false">
      <path class="room" d="M10 150L50 128h60l40 22M50 128V50h60v78M66 128V82h28v46"/><circle class="room__knob" cx="89" cy="106" r="1.4"/>
      <circle class="finger" cx="80" cy="100" r="120"/></svg>`,
  knock: `<svg class="sc sc--knock" viewBox="0 0 160 200" aria-hidden="true" focusable="false">
      <path class="slab" d="M40 18h80v168H40z"/><path class="slab__in" d="M52 32h56v62H52zM52 108h56v64H52z"/><circle class="slab__knob" cx="106" cy="102" r="3"/>
      <g class="rings"><circle cx="80" cy="76" r="10"/><circle cx="80" cy="76" r="10"/></g><g class="rings rings--back"><circle cx="80" cy="76" r="10"/></g></svg>`,
  hum: `<svg class="sc sc--hum" viewBox="0 0 160 200" aria-hidden="true" focusable="false">
      <circle class="frost" cx="80" cy="96" r="58"/><path class="wave" pathLength="1" d="M28 96c8-18 16-18 24 0s16 18 24 0 16-18 24 0 16 18 24 0 12-14 8-6"/>
      <g class="notes"><circle cx="58" cy="150" r="3"/><circle cx="80" cy="144" r="3"/><circle cx="102" cy="138" r="3"/><circle class="notes__missing" cx="124" cy="160" r="3"/></g></svg>`,
  mirror: `<svg class="sc sc--mirror" viewBox="0 0 160 200" aria-hidden="true" focusable="false">
      <ellipse class="oval" cx="80" cy="96" rx="52" ry="70"/>
      <g class="you"><path d="M80 62a17 19 0 1 1 0 38a17 19 0 1 1 0-38M46 160c4-30 18-42 34-42s30 12 34 42"/></g>
      <g class="late"><path d="M80 62a17 19 0 1 1 0 38a17 19 0 1 1 0-38M46 160c4-30 18-42 34-42s30 12 34 42"/></g></svg>`
};

function headTag(t, A, { title, description, path, alternates = true, robots = '', ld = '' }) {
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
${alternates ? `<link rel="alternate" hreflang="en" href="${SITE}${path.replace(/^\/es\//, '/')}">
<link rel="alternate" hreflang="es" href="${SITE}${path.startsWith('/es/') ? path : '/es' + path}">
<link rel="alternate" hreflang="x-default" href="${SITE}${path.replace(/^\/es\//, '/')}">` : ''}
${robots ? `<meta name="robots" content="${robots}">` : ''}
<meta name="theme-color" content="#05070A">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="THRESHOLD">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/og-${t.lang}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t.meta.ogAlt)}">
<meta property="og:locale" content="${t.locale}">
<meta name="twitter:card" content="summary_large_image">
${A.preload.map(f => `<link rel="preload" href="${A.url(f)}" as="font" type="font/woff2" crossorigin>`).join('\n')}
<link rel="stylesheet" href="${A.css}">
<script>document.documentElement.classList.add('js');setTimeout(function(){if(!window.__th)document.documentElement.classList.remove('js')},3000)</script>
${ld}</head>`;
}

// the viewfinder over every screen: brackets, REC and the clock, the exposure, and the captions of the sound
function viewfinder(t) {
  return `<div class="vf" aria-hidden="true">
  ${CORNERS}
  <p class="vf__top"><span class="vf__rec" data-rec>${DOT}<span data-rec-label>${esc(t.hud.rec)}</span></span><span class="vf__tc" data-tc>03:03:07</span></p>
  <p class="vf__bottom"><span class="vf__iso"><span class="vf__long">${esc(t.hud.iso)}</span><span class="vf__short">${esc(t.hud.isoShort)}</span></span><span class="vf__door">${esc(t.hud.door)}</span></p>
</div>
<p class="cap" aria-hidden="true" data-cap></p>`;
}

// the controls in the viewfinder's top right: the sound switch (a camcorder's audio meter) and the language
function bar(t, home) {
  return `<div class="bar">
  ${home ? `<button class="bar__snd" type="button" data-sound="bar" aria-pressed="false" aria-describedby="snd-hint">${METER}<span class="sr">${esc(t.sound.name)}</span></button>` : `<a class="bar__home" href="${t.path}">${esc('THRESHOLD')}</a>`}
  <a class="bar__lang" href="${t.other.path}" hreflang="${t.other.lang}" lang="${t.other.lang}" title="${esc(t.other.name)}">${t.other.label}</a>
</div>`;
}

function footer(t, A) {
  const f = t.footer;
  return `<footer class="foot">
  <div class="wrap foot__in">
    <img class="foot__icon" src="${A.url('img/brand/threshold-icon.svg')}" alt="" width="48" height="48" loading="lazy">
    <p class="foot__by"><span>${esc(f.by)}</span><a href="https://www.gazum.ai/${t.lang === 'es' ? 'es/' : ''}"><img src="${A.url('img/brand/gazum-wordmark.svg')}" alt="GAZUM" width="112" height="18" loading="lazy"></a></p>
    <p class="foot__tag">${esc(f.tagline)}</p>
    <nav class="foot__links" aria-label="THRESHOLD"><a href="${t.path}privacy/">${esc(f.privacy)}</a><a href="${t.other.path}" hreflang="${t.other.lang}" lang="${t.other.lang}">${esc(t.other.name)}</a><a href="/play/"${t.lang === 'es' ? ' hreflang="en"' : ''}>${esc(f.play)}</a><a href="https://www.gazum.ai/${t.lang === 'es' ? 'es/' : ''}">gazum.ai</a></nav>
    <p class="foot__fine">${esc(f.warn)} ${esc(f.trust)}</p>
    <p class="foot__fine">${esc(f.fine)}</p>
    <p class="foot__fine">${esc(f.rights)}</p>
  </div>
</footer>`;
}

// a black screen between two files: one of her messages from that night
const gap = ([time, text]) => `<div class="gap" data-scene-keep>
  <p class="gap__msg rv rv--slow"><time>${esc(time)}</time><span>${esc(text)}</span></p>
</div>`;

const ld = (t, desc) => `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'VideoGame', name: 'THRESHOLD', url: `${SITE}${t.path}`, description: desc,
  genre: ['Horror', 'Mystery'], gamePlatform: 'Web browser', applicationCategory: 'Game', inLanguage: t.lang,
  image: `${SITE}/og-${t.lang}.jpg`, publisher: { '@type': 'Organization', name: 'GAZUM Corp.', url: 'https://www.gazum.ai/' }
}).replace(/</g, '\\u003c')}</script>
`;

export function page(t, A) {
  const h = t.hero, c = t.clock, p = t.phone, g = t.glass, d = t.doors, j = t.join, T = g.tiles;
  const [tw, th] = A.size('img/brand/threshold-title.svg');
  const qr = A.qr;
  const i18n = {
    lang: t.lang, hud: t.hud, sound: t.sound, captions: t.captions,
    clock: { next: c.next, yours: c.yours, open: c.open, margin: c.margin },
    memo: { play: p.lock.play, stop: p.lock.stop, playing: p.lock.playing },
    tiles: T, still: g.still,
    doors: { list: d.list, notes: d.notes, door: d.door, night: d.night, tonight: d.tonight, dark: d.dark, maker: d.maker, redacted: d.redacted },
    join: { ok: j.ok, already: j.already, bad: j.bad, limit: j.limit, fail: j.fail, sending: j.sending },
    score: A.url('js/score.js')
  };
  const doorList = d.list.map(([n, name, mech], i) => {
    const k = i + 1, cls = k === 1 ? ' wd--lit' : k === 13 ? ' wd--last' : '';
    const state = k === 1 ? `${d.tonightShort}\n03:03` : `${d.night} ${n}\n03:03`;
    return `<li class="wd${cls}"><button class="wd__btn" type="button" aria-pressed="${k === 1}" aria-controls="door-panel" data-door="${k}">
          ${WALL_DOOR}${k === 13 ? DOT : ''}
          <span class="wd__n">${n}</span><span class="wd__name">${esc(up(name))}</span><span class="wd__state" aria-hidden="true">${esc(up(state))}</span>
          <span class="sr">, ${esc(mech === '—' ? d.maker : mech)}</span>
        </button></li>`;
  }).join('\n        ');
  const tile = (key, ctl) => `<li class="tile tile--${key} rv">
        <div class="vfm" data-tile="${key}">
          <div class="vfm__scene">${SCENES[key]}</div>
          ${key === 'cover' ? `<p class="vfm__dark" aria-hidden="true">${esc(T.cover.dark)}</p>` : ''}
          ${CORNERS}
          <span class="vfm__k" aria-hidden="true">${DOT}${esc(up(T[key].k))}</span>
          ${ctl}
        </div>
        <p class="tile__line">${esc(T[key].line)}</p>
        <p class="tile__how">${esc(T[key].how)}</p>
      </li>`;
  return `${headTag(t, A, { title: t.meta.title, description: t.meta.description, path: t.path, ld: ld(t, t.meta.description) })}
<body>
<a class="skip" href="#clock">${esc(t.skip)}</a>
${viewfinder(t)}
${bar(t, true)}
<i class="grain" aria-hidden="true"></i>
<main id="main">

<section class="hero" id="top" aria-labelledby="hero-t" data-hero data-scene="hero">
  <div class="cam" data-cam style="--wl:${DOOR.wide.left}%;--wt:${DOOR.wide.top}%;--wh:${DOOR.wide.h}%;--tl:${DOOR.tall.left}%;--tt:${DOOR.tall.top}%;--th:${DOOR.tall.h}%">
    <div class="stage stage--base" data-stage>
      ${A.art('hero-wide', 'hero-tall', { alt: '', cls: 'stage__img', eager: true })}
      ${doorWrap('a')}
    </div>
    <div class="lens" data-lens aria-hidden="true">
      <div class="lens__in" data-lens-in>
        <div class="stage stage--glass">
          ${A.art('hero-wide', 'hero-tall', { alt: '', cls: 'stage__img', eager: true })}
          ${doorWrap('b')}
        </div>
      </div>
      <i class="lens__frame"></i><span class="lens__zoom">1×</span>
    </div>
    <i class="cam__expose" aria-hidden="true"></i>
    <i class="cam__grade" aria-hidden="true"></i>
  </div>
  <p class="sr">${esc(h.alt)}</p>
  <div class="hero__copy">
    <button class="tiltbtn" type="button" data-tilt hidden><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M3 9.5c-1.2 1.6-1.2 3.4 0 5M21 9.5c1.2 1.6 1.2 3.4 0 5"/></svg><span>${esc(h.tilt)}</span></button>
    <p class="file">${esc(h.file)}</p>
    <h1 class="hero__title" id="hero-t"><img src="${A.url('img/brand/threshold-title.svg')}" alt="THRESHOLD" width="${tw}" height="${th}"></h1>
    <p class="hero__line">${h.line.split(/(?<=\.) /).map(x => `<span>${esc(x)}</span>`).join(' ')}</p>
    <p class="hero__italic">${esc(h.italic)}</p>
    <div class="hero__ctas">
      <a class="btn btn--rec hero__play" href="/play/"${t.lang === 'es' ? ' hreflang="en"' : ''}>${DOT}<span>${esc(h.play)}</span></a>
      <div class="qr">
        <div class="qr__box">${CORNERS}<span class="qr__af" aria-hidden="true">AF</span>${DOT}
          <svg class="qr__code" viewBox="-1 -1 ${qr.n + 2} ${qr.n + 2}" role="img" aria-label="${esc(h.qrAlt)}" shape-rendering="crispEdges"><path d="${qr.d}"/></svg>
        </div>
        <div class="qr__text"><p class="qr__t">${esc(h.qrTitle)}</p><a class="qr__link" href="/play/"${t.lang === 'es' ? ' hreflang="en"' : ''}>${esc(h.orPlay)}</a>${h.protoNote ? `<p class="qr__note">${esc(h.protoNote)}</p>` : ''}</div>
      </div>
      <a class="btn hero__join" href="#join"><span>${esc(h.join)}</span></a>
      ${h.protoNote ? `<p class="hero__note">${esc(h.protoNote)}</p>` : ''}
    </div>
    <div class="hero__foot">
      <button class="snd" type="button" data-sound="hero" aria-pressed="false" aria-describedby="snd-hint">${METER}<span class="snd__name">${esc(t.sound.name)}</span><span class="snd__state" aria-hidden="true" data-sound-state>${esc(t.sound.stby)}</span></button>
      <p class="hero__ritual">${esc(h.ritual)}</p>
    </div>
    <p class="snd__hint" id="snd-hint" data-sound-hint>${esc(t.sound.hint)}</p>
    <p class="sr" role="status" data-sound-msg></p>
    <p class="hero__meta">${esc(h.meta)}</p>
  </div>
</section>

${gap(t.gaps[0])}

<section class="mv clock" id="clock" aria-labelledby="clock-t" data-scene="clock">
  <div class="mv__art clock__art">${A.art('valpo', 'valpo-tall', { alt: c.alt, cls: 'mv__img' })}<i class="mv__shade" aria-hidden="true"></i></div>
  <div class="wrap clock__in">
    <p class="file rv">${esc(c.file)}</p>
    <p class="clock__lead rv">${esc(c.lead)}</p>
    <p class="clock__big rv" aria-hidden="true"><span>03</span><b>:</b><span>03</span></p>
    <h2 class="clock__rule rv" id="clock-t">${esc(c.rule)}</h2>
    <p class="clock__body rv">${esc(c.body)}</p>
    <p class="count rv" data-count aria-hidden="true"><span class="count__k" data-count-k>${esc(c.next)}</span> <span class="count__v" data-count-v>--:--:--</span> <span class="count__z">· ${esc(c.yours)}</span></p>
  </div>
  <div class="margin-door" data-margin hidden><div class="margin-door__in">${doorSvg('m')}</div><p>${esc(c.margin)}</p></div>
</section>

${gap(t.gaps[1])}

<section class="mv phone" id="phone" aria-labelledby="phone-t" data-scene="phone">
  <div class="mv__art phone__art">${A.art('church', 'church-tall', { alt: p.alt, cls: 'mv__img' })}<i class="mv__shade" aria-hidden="true"></i></div>
  <div class="wrap phone__in">
    <div class="phone__story">
      <p class="file rv">${esc(p.file)}</p>
      ${p.story.map(([kind, s], i) => i === 0 ? `<h2 class="phone__lead rv" id="phone-t">${esc(s)}</h2>` : `<p class="phone__${kind} rv">${esc(s)}</p>`).join('\n      ')}
      <p class="phone__left rv">${esc(p.left)}</p>
    </div>
    <div class="lock rv" role="group" aria-label="${esc(p.lock.label)}">
      <div class="lock__glass">
        <p class="lock__bar" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="M4.5 7V5.2a3.5 3.5 0 0 1 7 0V7"/><rect x="3" y="7" width="10" height="7.5" rx="1.6"/></svg></p>
        <p class="lock__date">${esc(p.lock.date)}</p>
        <p class="lock__time">03:03</p>
        <ul class="lock__list">
          <li class="ncard ncard--memo">
            <button class="memo__play" type="button" data-memo aria-pressed="false" aria-label="${esc(p.lock.play)}"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="i-play" d="M5 3.5v9l7.5-4.5z"/><path class="i-stop" d="M4.5 4.5h7v7h-7z"/></svg></button>
            <div class="ncard__body"><p class="ncard__k">${esc(up(p.lock.memo))} · ${esc(p.lock.memoLen)}</p><span class="wave" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="--h:${(.16 + .12 * Math.abs(Math.sin(i * 1.7)) + .06 * ((i * 7) % 3)).toFixed(2)}"></i>`).join('')}</span></div>
          </li>
          ${p.lock.calls.map(([who, name, year]) => `<li class="ncard"><p class="ncard__k"><span>${esc(up(p.lock.missed))}</span><time>03:03</time></p><p class="ncard__v">${esc(who)} · ${esc(name)} · ${esc(year)}</p></li>`).join('\n          ')}
        </ul>
        <p class="lock__foot" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 3h6l-1 6h-4z"/><path d="M10 9h4v11a2 2 0 0 1-4 0z"/></svg><svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/></svg></p>
      </div>
      <p class="sr" role="status" data-memo-live></p>
    </div>
  </div>
</section>

${gap(t.gaps[2])}

<section class="mv glass" id="glass" aria-labelledby="glass-t" data-scene="glass">
  <div class="wrap">
    <header class="mv__head">
      <p class="file rv">${esc(g.file)}</p>
      <h2 class="mv__title rv" id="glass-t">${esc(g.title)}</h2>
      <p class="mv__lead rv">${esc(g.lead)}</p>
    </header>
    <ul class="tiles">
      ${tile('tilt', `<div class="vfm__ctl" role="slider" tabindex="0" aria-label="${esc(T.tilt.name)}" aria-valuemin="-12" aria-valuemax="12" aria-valuenow="0" aria-valuetext="${esc(T.tilt.level)}" data-ctl="tilt"></div>`)}
      ${tile('cover', `<button class="vfm__ctl" type="button" aria-pressed="false" data-ctl="cover"><span class="sr">${esc(T.cover.name)}</span></button>`)}
      ${tile('knock', `<button class="vfm__ctl" type="button" data-ctl="knock"><span class="sr">${esc(T.knock.name)}</span></button>`)}
      ${tile('hum', `<button class="vfm__ctl" type="button" aria-pressed="false" data-ctl="hum"><span class="sr">${esc(T.hum.name)}</span></button>`)}
      ${tile('mirror', `<div class="vfm__ctl" role="slider" tabindex="0" aria-label="${esc(T.mirror.name)}" aria-valuemin="0" aria-valuemax="2" aria-valuenow="1" aria-valuetext="${esc(T.mirror.places[1])}" data-ctl="mirror"></div>`)}
    </ul>
    <p class="sr" role="status" data-tiles-live></p>
    <div class="still rv" data-still>
      <div class="still__cam">
        ${A.pic('mirror', { alt: g.still.alt, sizes: '(min-width: 900px) 34vw, 92vw', cls: 'still__img' })}
        <div class="still__mirror" aria-hidden="true" style="left:${MIRROR[0]}%;top:${MIRROR[1]}%;width:${(MIRROR[2] - MIRROR[0]).toFixed(1)}%;height:${(MIRROR[3] - MIRROR[1]).toFixed(1)}%">${A.pic('smoke', { alt: '', sizes: '240px', cls: 'still__fig' })}</div>
        ${CORNERS}
        <p class="still__hud" aria-hidden="true"><span>${DOT}${esc(t.hud.rec)}</span><span data-still-t>00:00</span></p>
      </div>
      <div class="still__copy">
        <p class="vfm__k vfm__k--static" aria-hidden="true">${DOT}${esc(up(g.still.k))}</p>
        <h3 class="still__line">${esc(g.still.line)}</h3>
        <p class="tile__how">${esc(g.still.how)}</p>
        <button class="btn btn--rec" type="button" data-still-go>${DOT}<span data-still-label>${esc(g.still.start)}</span></button>
        <div class="still__bar" aria-hidden="true"><i data-still-bar></i></div>
        <p class="still__msg" role="status" data-still-msg>${esc(g.still.ready)}</p>
      </div>
    </div>
    <p class="glass__trust rv">${esc(g.trust)}</p>
    <p class="glass__warn rv">${esc(g.warning)}</p>
  </div>
</section>

${gap(t.gaps[3])}

<section class="mv doors" id="doors" aria-labelledby="doors-t" data-scene="doors">
  <div class="wrap">
    <header class="mv__head">
      <p class="file rv">${esc(d.file)}</p>
      <h2 class="mv__title rv" id="doors-t">${esc(d.title)}</h2>
      <p class="mv__lead rv">${esc(d.lead)}</p>
    </header>
    <div class="wall-wrap rv">
      <ol class="wall" data-wall>
        ${doorList}
      </ol>
    </div>
    <div class="dpanel rv" id="door-panel" role="region" aria-live="polite" aria-label="${esc(d.noteLabel)}" data-panel>
      <p class="dpanel__head"><span data-p-door>${esc(up(`${d.door} I · ${d.list[0][1]}`))}</span><span class="dpanel__mech" data-p-mech>${esc(up(d.list[0][2]))}</span></p>
      <p class="dpanel__note" data-p-note>“${esc(d.notes[1])}”</p>
      <p class="dpanel__state" data-p-state>${esc(up(d.tonight))}</p>
    </div>
    <p class="wall__hint rv">${esc(d.hint)}</p>
  </div>
</section>

<section class="join" id="join" aria-labelledby="join-t" data-scene="join">
  <div class="wrap join__in">
    <p class="file rv">${esc(up(j.kicker))}</p>
    <h2 class="join__title rv" id="join-t">${esc(j.title)}</h2>
    <p class="join__lead rv">${esc(j.lead)}</p>
    <form class="joinf rv" data-join${A.signup ? ` data-endpoint="${esc(A.signup)}"` : ' data-preview="1"'} novalidate>
      <label class="joinf__label" for="email">${esc(j.label)}</label>
      <div class="joinf__row">
        <input id="email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="${esc(j.placeholder)}" required aria-describedby="join-msg join-fine">
        <button class="btn btn--rec" type="submit">${DOT}<span>${esc(j.button)}</span></button>
      </div>
      <div class="hp" aria-hidden="true"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></div>
      <p class="joinf__msg" id="join-msg" role="status" data-msg></p>
      <p class="joinf__fine" id="join-fine">${esc(j.fine)} <a href="${t.path}privacy/">${esc(j.privacy)}</a></p>
    </form>
    <p class="join__play rv"><a class="link" href="/play/"${t.lang === 'es' ? ' hreflang="en"' : ''}>${esc(j.play)}</a>${h.protoNote ? ` <span>${esc(h.protoNote)}</span>` : ''}</p>
  </div>
</section>

</main>
${footer(t, A)}
<script type="application/json" id="th-i18n">${JSON.stringify(i18n).replace(/</g, '\\u003c')}</script>
${A.js.map(src => `<script src="${src}" defer></script>`).join('\n')}
</body>
</html>
`;
}

// the privacy page and the 404 keep the viewfinder, without the story
function plain(t, A, { title, description, path, robots, body }) {
  return `${headTag(t, A, { title, description, path, alternates: !robots, robots })}
<body class="plain">
${viewfinder(t)}
${bar(t, false)}
<i class="grain" aria-hidden="true"></i>
${body}
${footer(t, A)}
</body>
</html>
`;
}

export function privacyPage(t, A) {
  const p = t.privacy;
  return plain(t, A, {
    title: `${p.title} · THRESHOLD`, description: p.body[0], path: `${t.path}privacy/`,
    body: `<main class="doc" id="main">
  <article class="doc__in">
    <p class="file">THRESHOLD</p>
    <h1>${esc(p.title)}</h1>
    <p class="doc__date">${esc(p.updated)}</p>
    ${p.body.map(x => `<p>${esc(x)}</p>`).join('\n    ')}
    <p><a class="btn" href="${t.path}"><span>${esc(p.back)}</span></a></p>
  </article>
</main>`
  });
}

export function notFoundPage(t, A) {
  const n = t.notFound;
  return plain(t, A, {
    title: `${n.title} · THRESHOLD`, description: n.text, path: '/404.html', robots: 'noindex',
    body: `<main class="nf" id="main">
  <div class="nf__in">
    <div class="nf__door">${doorSvg('nf')}</div>
    <h1>${esc(n.title)}</h1>
    <p>${esc(n.text)}</p>
    <p><a class="btn" href="/"><span>${esc(n.back)}</span></a></p>
  </div>
</main>`
  });
}

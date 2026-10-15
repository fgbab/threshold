// English strings for the landing page. Plain text only: page.mjs escapes everything.
// The game's own voice: short, present tense. No spoilers: no lock's answer, no code, nothing about the endings
// (docs/DOORS.md has them; none of it belongs here).
export default {
  lang: 'en',
  locale: 'en_US',
  path: '/',
  other: { lang: 'es', path: '/es/', label: 'ES', name: 'Español' },
  meta: {
    title: 'THRESHOLD · Thirteen doors. They only appear through glass.',
    description: 'A horror mystery by GAZUM that you play through your phone’s camera, in your own room. Thirteen doors. They only appear through glass. One opens each night at 3:03 AM.',
    ogAlt: 'THRESHOLD: a dark hallway at night, seen through a phone camera’s viewfinder, its far door traced in gold light.'
  },
  skip: 'Skip to the story',
  home: 'THRESHOLD, home',

  // the viewfinder that stays over the whole page
  hud: { rec: 'REC', saved: 'SAVED', iso: 'ISO 3200 · 1/30 · F1.8', isoShort: 'ISO 3200', door: 'DOOR I' },
  sound: {
    name: 'Sound', stby: 'STBY', rec: 'REC', paused: 'PAUSED',
    hint: 'Best with headphones · plays even in silent mode',
    resume: 'Sound paused · tap to resume',
    unavailable: 'Sound isn’t available on this device.'
  },

  hero: {
    file: 'FILE 01 · REC',
    line: 'Thirteen doors. They only appear through glass.',
    italic: 'Behind the last one is whoever made them.',
    play: 'Play tonight',
    protoNote: '',
    join: 'Join the waitlist',
    qrTitle: 'Open it on your phone',
    qrAlt: 'A QR code for threshold.gazum.ai/play',
    orPlay: 'or play here',
    ritual: 'Headphones. Night. Alone.',
    meta: 'Web prototype · iPhone next',
    tilt: 'Hold up your phone',
    alt: 'Through a phone camera at night: a dark hallway, lit only by a phone lying on the floor. At its far end, a door is being traced in thin gold light.'
  },

  clock: {
    file: 'FILE 02 · 03:03',
    lead: 'A horror mystery you play through your phone’s camera, in your own room.',
    rule: 'One door opens each night at 3:03 AM.',
    body: 'Each door is a chapter of the story, and seven things to do through the camera. Six of them give you a piece of what the seventh asks for.',
    next: 'The next door opens in',
    yours: 'your time',
    open: 'A door is open · your time',
    margin: 'It’s 3:03. There is a door in this page.',
    alt: 'Valparaíso at 3 AM, from the top of a stairway: dark houses, a few street lamps, the port, and the black sea.'
  },

  // her messages from that night, one on each black screen between the files
  gaps: [['03:03', 'I knocked.'], ['03:03', 'Something knocked back.'], ['03:04', 'It isn’t behind the door.'], ['03:04', 'It’s behind the glass.']],

  phone: {
    file: 'FILE 03 · HER PHONE',
    story: [
      ['lead', 'Lena Ostrova was the first to reach the last door.'],
      ['text', 'She was nineteen. She played every night at 3 AM, in the bathroom, with the lights off.'],
      ['text', 'They found her phone on the floor of an empty church in Valparaíso, screen still on, camera still open.'],
      ['lead', 'Nobody found Lena.']
    ],
    left: 'This is all she left.',
    lock: {
      label: 'Her phone’s lock screen',
      date: 'Saturday 14 October',
      memo: 'Voice memo',
      memoLen: '0:13',
      play: 'Play her voice memo',
      stop: 'Stop her voice memo',
      playing: 'Her voice memo is playing: only static, and something breathing.',
      missed: 'Missed call',
      calls: [['Player One', 'Tomás', '1987'], ['Player Two', 'Amalia', '1999'], ['Player Three', 'Ari', '2011'], ['Player Four', 'Lena', '2023']]
    },
    alt: 'An empty church at night. On the stone floor of the aisle, a phone lies face up, its screen still on.'
  },

  glass: {
    file: 'FILE 04 · THROUGH THE GLASS',
    title: 'About thirty ways to play through glass.',
    lead: 'Tilt it, cover it, knock with it, hum to it. Each door asks for something different, and it only works in a real room. Here are six.',
    tiles: {
      tilt: { k: 'Tilt', line: 'Tilt the glass.', how: 'Drag, or use the arrow keys.', name: 'Tilt the glass', level: 'Level', left: 'Tilted left', right: 'Tilted right' },
      cover: { k: 'Cover', line: 'Cover the lens.', how: 'Press and hold.', name: 'Cover the lens', dark: 'Some words only show in the dark.', covered: 'The lens is covered. In the dark: “Some words only show in the dark.”', clear: 'The lens is clear.' },
      knock: { k: 'Knock', line: 'Knock on a real door.', how: 'Click or tap to knock.', name: 'Knock', you: 'You knock.', back: 'Something knocks back, once.' },
      hum: { k: 'Hum', line: 'Hum.', how: 'Press and hold.', name: 'Hum', box: 'A music box plays three notes, then waits.' },
      mirror: { k: 'Front camera', line: 'Turn the glass around. Your reflection is late.', how: 'Move, then wait.', name: 'Move your reflection', places: ['left', 'centre', 'right'], you: 'You: {p}. Your reflection follows, late.' }
    },
    still: {
      k: 'Still',
      line: 'Don’t move. It only sees what moves.',
      how: 'Press the button, then keep still for six seconds: no mouse, no keys, no scrolling.',
      start: 'Hold still',
      again: 'Try again',
      ready: 'Ready when you are.',
      keep: 'Keep still.',
      closer: 'It’s coming closer.',
      done: 'It came close, and passed. It never saw you.',
      moved: 'You moved. It saw you, and it’s gone.',
      alt: 'A small bathroom at night with the lights off: a dark mirror above a white sink.'
    },
    trust: 'Camera frames and the microphone never leave your phone. No account. No uploads.',
    warning: 'A horror game: sudden loud sounds, flashing images.'
  },

  doors: {
    file: 'FILE 05 · THIRTEEN DOORS',
    title: 'Thirteen doors. Thirteen nights.',
    lead: 'Each door is a night, seven objectives, and one line of her note. You start with the first line. The rest is still dark.',
    hint: 'Hover, focus or tap a door.',
    door: 'Door',
    night: 'Night',
    tonight: 'Open tonight · 03:03',
    tonightShort: 'Tonight',
    dark: 'Still dark',
    maker: 'Whoever made them',
    noteLabel: 'Her note',
    redacted: 'This line of her note is still dark.',
    list: [
      ['I', 'The Maze', 'Tilt'], ['II', 'The Eye', 'The light'], ['III', 'The Water', 'The compass'], ['IV', 'The Threshold', 'Knock'],
      ['V', 'The Glass', 'Front camera'], ['VI', 'The Stairs', 'Walk'], ['VII', 'The Silence', 'Silence'], ['VIII', 'The Thread', 'Colour'],
      ['IX', 'The Sleep', 'Hide'], ['X', 'The Sky', 'Look up'], ['XI', 'The Names', 'The marks'], ['XII', 'The Bells', 'The bells'], ['XIII', 'The Maker', '—']
    ],
    // only the first and the last line of her note can be read here
    notes: { 1: 'Every room hides a maze. It keeps three embers. Give the door their numbers in the order the eye looks at them.', 13: 'Behind the last door is whoever made them.' }
  },

  join: {
    kicker: 'Leave an address',
    title: 'On the web tonight. The App Store next.',
    lead: 'One email when it arrives, and a few on the way.',
    play: 'Or play the web prototype tonight',
    label: 'Your email',
    placeholder: 'you@example.com',
    button: 'Join the waitlist',
    fine: 'One email first, to confirm it’s you. No spam, and you can leave anytime.',
    privacy: 'Privacy',
    ok: 'Almost there: check your inbox and confirm your place.',
    already: 'You’re already on the list. If you haven’t confirmed yet, check your inbox.',
    bad: 'That email doesn’t look right.',
    limit: 'Too many tries for now. Please try again in a little while.',
    fail: 'Something went wrong. Write to support@gazum.ai and we’ll add you.',
    sending: 'Sending…'
  },

  // what the sound would be: shown in the viewfinder even with the sound off
  captions: {
    room: '[the hiss of an empty room]',
    ember: '[an ember, burning a line]',
    door: '[the room holds its breath]',
    toll: '[a bell, far away]',
    static: '[static]',
    breath: '[something breathes on the other side]',
    knock: '[you knock]',
    answer: '[something knocks back]',
    box: '[a music box: three notes, then it waits]',
    roll: '[an ember rolls]',
    dark: '[the dark]',
    shutter: '[a shutter]',
    closer: '[it comes closer]',
    gone: '[it’s gone]',
    hum: '[the door hums]',
    bell: '[a bell, once]',
    rec: '[recording]'
  },

  footer: {
    by: 'A game by',
    tagline: 'Next era gaming',
    fine: 'THRESHOLD is in development; its features and content may change. The web prototype is in English.',
    warn: 'A horror game: sudden loud sounds, flashing images.',
    trust: 'Camera frames and the microphone never leave your phone.',
    rights: '© 2026 GAZUM Corp.',
    privacy: 'Privacy',
    play: 'Play the prototype'
  },

  privacy: {
    title: 'Privacy',
    updated: 'Last updated: 15 October 2026',
    body: [
      'This page covers the THRESHOLD website and its waitlist. The game itself asks for your camera, your phone’s motion and, for some doors, the microphone. Camera frames and sound are processed on your phone and never leave it.',
      'If you join the waitlist, we keep your email address and your language so we can write to you about THRESHOLD: one email when it reaches the App Store, and a few on the way. Nothing else.',
      'First we send one email to confirm the address is yours. An address that is never confirmed is deleted within 30 days.',
      'We never sell your email or share it with advertisers. GAZUM Corp. keeps the list on Amazon Web Services (in the United States), and emails go out through Resend, our email provider.',
      'Every email after the confirmation has a link to leave the list with one click, and leaving deletes your address. For anything about your data, write to support@gazum.ai.',
      'This site sets no cookies and uses no trackers. It only remembers, in your own browser, whether you turned the sound on.'
    ],
    back: 'Back to THRESHOLD'
  },

  notFound: {
    title: 'This door doesn’t open.',
    text: 'The page you tried isn’t here. Try the way you came in.',
    back: 'Back to THRESHOLD'
  },

  play: {
    title: 'Opening the door…',
    text: 'THRESHOLD’s web prototype. Best on a phone, at night, alone, with the sound on.',
    go: 'Open the prototype'
  }
};

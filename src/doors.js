/* Threshold's thirteen doors. Each door is a chapter of the story, a line of Lena's note, and seven objectives played
   through the camera: six give you a piece of what the seventh, the lock, asks for. Codes that vary are seeded per
   player, so answers can't simply be passed around. */
import { S, seeded, GLYPH_CHAR, esc, cards } from './core.js';

/* her note, one line per door; lines clear as you reach each door */
export const NOTE = [
  'Every room hides a maze. It keeps three embers. Give the door their numbers in the order the eye looks at them.',
  'The light has an eye. It only opens for the rhythm I used.',
  'Face the water. Don’t turn around until it’s whole.',
  'Find a door that closes. Knock the time it comes.',
  'Don’t let it see you move. It opens at the time it took me.',
  'He walked down to it. Thirteen steps, and never look back.',
  'It hunts by sound. It lost a note. Give it back and it lets you pass.',
  'She painted the doors before she found them. Show it her colors in the order she hung them.',
  'He played with his eyes closed. Hide. Wake on the third bell.',
  'Above every room there is a sky. Join my stars in the order of my name.',
  'Draw who came before you, in the order they were taken.',
  'In the church they rang for me. Ring them back, facing the sea.',
  'Behind the last door is whoever made them.'
];
const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const G3 = ['tri', 'ring', 'diamond'];

/* values that differ between players */
export function keysFor(n) {
  if (n === 1) { const r = seeded(101), ds = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r).slice(0, 3), digits = { tri: ds[0], ring: ds[1], diamond: ds[2] }, order = shuffle(G3, r); return { digits, order, code: order.map(gl => digits[gl]).join('') }; }
  if (n === 8) { const r = seeded(808), frames = shuffle(G3, r), numerals = shuffle(['I', 'II', 'III'], r), color = { tri: 'red', ring: 'blue', diamond: 'white' };
    return { frames, numerals, colors: ['I', 'II', 'III'].map(nm => color[frames[numerals.indexOf(nm)]]) }; }
  if (n === 10) { const r = seeded(1010), az = shuffle([-110, -40, 35, 105], r); return { stars: ['L', 'E', 'N', 'A'].map((t, i) => ({ text: t, az: az[i], el: 18 + Math.round(r() * 30) })) }; }
  return {};
}
const ch = gl => GLYPH_CHAR[gl] || gl;
const noteLine = n => '<div class="note line"><p><b>' + n + '</b><span>' + esc(NOTE[n - 1]) + '</span></p></div>';
const photo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 3); return '<figure class="photo line"><img src="' + (cards.get('room') || 'room.jpg') + '" alt="The last photo on her phone"><figcaption class="cap">03:03 · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + '</figcaption></figure>'; };
const msgs = rows => '<div class="msgs line">' + rows.map(([t, m]) => '<p><time>' + t + '</time><span>' + m + '</span></p>').join('') + '</div>';

export const DOORS = [
  /* ================================================================= I */
  { n: 1, name: 'The Maze', mark: 0,
    intro: () => '<p class="eyebrow line">Her phone</p><p class="lead line">This is all she left.</p>' + noteLine(1) + '<p class="fine line">Everything you find stays on her phone. Open it any time with the phone at the top of the screen.</p>',
    obj: [
      { type: 'scan', title: 'Read the room', say: ['Every room hides a maze.', 'Hold the glass still. Let it read yours.'] },
      { type: 'maze', title: 'Gather the embers', collect: k => G3.map(gl => ({ glyph: gl, label: k.digits[gl] })), hunter: true, delay: 26,
        text: 'Tilt the glass. Gather the three embers.', small: 'Something wakes after a while',
        frag: (r, k) => 'Embers: ' + G3.map(gl => ch(gl) + ' ' + k.digits[gl]).join(' · '),
        hints: [['Tilt the phone. The walls are your room.', 'The light shows what’s near'], ['Embers glow even in the dark.', 'Look for the three shapes']] },
      { type: 'light', title: 'Find its eye', show: k => k.order, say: ['Something in the maze has an eye.', 'Find the brightest thing in your room.'],
        frag: (r, k) => 'The eye looked at: ' + k.order.map(ch).join(' then '), hints: [['A lamp. A window. A screen.', 'Hold it in the circle']] },
      { type: 'still', title: 'Don’t move', secs: 9, say: ['Something came out of the maze.', 'It’s in your room now.'], text: 'Don’t move.', small: 'It only sees what moves' },
      { type: 'anchor', title: 'Find the door', items: [{ kind: 'door', az: 180, el: -14, dist: 3.4 }], say: ['The first door is in your room.'], text: 'Turn around slowly.', small: 'Find the door' },
      { type: 'dark', title: 'Close its eye', lines: ['Not the order you found them.', 'The order it looked at them.'], say: ['Before you open it, close the eye.'], frag: () => 'In the dark: “the order it looked at them”' },
      { type: 'dial', title: 'Open the first door', code: k => k.code, say: ['The door wants three numbers.'], text: 'Turn the glass like a dial.', small: 'Hold still on each number',
        hint2: ['The order matters.', 'Open her phone: the embers, the eye'], hints: [['Each ember had a number.', 'The eye chose the order']] }
    ],
    outro: ['The first door is open.', 'It took Player Four eleven minutes.'] },

  /* ================================================================ II */
  { n: 2, name: 'The Eye', mark: 1,
    intro: () => '<p class="eyebrow line">Night two · Player Four</p><p class="lead line">Lena Ostrova was the first to reach the last door.</p><p class="fine line">She was nineteen. She played every night at 3 AM, in the bathroom, with the lights off.</p><p class="fine line">They found her phone on the floor of an empty church in Valparaíso, screen still on, camera still open.</p><p class="lead line">Nobody found Lena.</p>' + noteLine(2),
    obj: [
      { type: 'light', title: 'Wake the eye', say: ['Find the brightest thing in this room.', 'Look at it until it looks back.'] },
      { type: 'listen', title: 'Her voice memo', clip: 'memo', glyph: 'phone', az: 150, el: -10, bed: 'whisper', say: ['Her last voice memo is somewhere in this room.'], text: 'Find her phone.', small: 'Follow the whisper',
        frag: () => 'Her memo: taps on the lens. Listen again on her phone' },
      { type: 'color', title: 'It hates red', color: 'red', effect: 'bleed', reveal: ['— — —', 'The long ones first.'], say: ['Lena wore a red coat the night she vanished.'], text: 'Show it something red.',
        frag: () => 'When it saw red: — — —, the long ones first' },
      { type: 'orbit', title: 'Follow the light', secs: 12, say: ['The light is leaving the eye.'], text: 'Follow it.', small: 'Don’t lose it' },
      { type: 'flicker', title: 'Lights out', show: 'figure', say: ['It wants to see you in the dark.'], text: 'Turn off the lights in your room.', small: 'Then turn them back on' },
      { type: 'dark', title: 'Close it', lines: ['The doors are not a game.', 'They are a map.'], small: 'two quick ones at the end', say: ['Now close the eye yourself.'], frag: () => 'In the dark: “two quick ones at the end”' },
      { type: 'blink', title: 'Make it blink', pattern: 'SSSFF', say: ['It only opens for the rhythm she used.'], text: 'Make it blink.', small: 'Cover the lens. Uncover it',
        hint2: ['Her memo.', 'Long ones, then quick ones'] }
    ],
    outro: ['It blinked back.', 'Most people are afraid of the dark part. You weren’t.'] },

  /* =============================================================== III */
  { n: 3, name: 'The Water', mark: 2,
    intro: () => '<p class="eyebrow line">Night three</p><p class="lead line">“The doors are not a game. They are a map.”</p><p class="fine line">Her last message. She sent it to a number that no longer exists. The reply came anyway: “Then follow it.”</p>' + noteLine(3),
    obj: [
      { type: 'look', title: 'Under your feet', dir: 'down', lines: ['VALPARAÍSO', '03:04'], effect: 'pin', say: ['Something is written on your floor.'], frag: () => 'On the floor: Valparaíso, 03:04', unlock: 'where' },
      { type: 'anchor', title: 'The compass', compass: true, items: [{ kind: 'label', text: 'N', az: 0, el: 8 }, { kind: 'label', text: 'E', az: 90, el: 8 }, { kind: 'label', text: 'S', az: 180, el: 8 }, { kind: 'label', text: 'W', az: 270, el: 8 }],
        say: ['Four letters float in your room.', 'Where they float is true.'], text: 'Find all four.', frag: () => 'The letters floated where the real north, east, south and west are' },
      { type: 'color', title: 'Find the sea', color: 'blue', effect: 'sea', reveal: ['The water is', 'where the sun goes down.'], say: ['The sea is in your room somewhere.'], text: 'Show it something blue.',
        frag: () => 'The sea said: “where the sun goes down”' },
      { type: 'avoid', title: 'Don’t look at it', secs: 15, say: ['It followed you out of the water.'] },
      { type: 'turn', title: 'Turn around', turns: 3, say: ['Turn around three times.'], after: ['Now you don’t know which way you’re facing.', 'It does.'] },
      { type: 'still', title: 'The tide', secs: 8, say: ['Something walks out of the sea.'], text: 'Don’t move.', small: 'Wait for the tide' },
      { type: 'align', title: 'Face the water', bearing: 270, mark: 2, say: ['Face the water.', 'Don’t turn around until it’s whole.'], text: 'Turn slowly.', small: 'It comes together only one way',
        hints: [['Valparaíso faces the Pacific.', 'Where does the sun go down?'], ['West.', 'The letters showed you']] }
    ],
    outro: ['That is the third mark.', 'Don’t turn around yet.'] },

  /* ================================================================ IV */
  { n: 4, name: 'The Threshold', mark: 3,
    intro: () => '<p class="eyebrow line">Night four</p><p class="lead line">The last photo on her phone.</p>' + photo() + '<p class="fine line">Look at it closely.</p>' + noteLine(4), unlock: 'photo',
    obj: [
      { type: 'walk', title: 'Walk to a door', steps: 5, say: ['The fourth door is a real one.'], text: 'Walk to a door that closes.', small: 'Slowly' },
      { type: 'frame', title: 'Frame it', say: ['That one.'], text: 'Frame the door.', small: 'Both sides, top to bottom' },
      { type: 'press', title: 'Press the glass to it', clip: 'behind', say: ['Press the glass against it.'], text: 'Press the glass flat against the door.', small: 'Keep it there',
        frag: () => 'Behind the door: “it comes at three… and three”' },
      { type: 'hide', title: 'Don’t let it open', secs: 10, sound: 'rattle', say: ['It’s trying the handle.'], text: 'Don’t let it open.', small: 'Keep the glass against it' },
      { type: 'facedown', title: 'Don’t look', secs: 13, script: 'door', say: ['Put the glass face down on the floor.', 'Whatever you hear, don’t look.'] },
      { type: 'scratch', title: 'Look at the door', lines: ['IT HAS', 'YOUR FACE'], say: ['It’s gone.'], frag: () => 'Scratched into the door: IT HAS YOUR FACE' },
      { type: 'knock', title: 'Knock', pattern: [3, 3], say: ['Knock the time it comes.'], text: 'Knock.', small: 'On the door, or on the glass', wrong2: 'That isn’t the time it comes.',
        hints: [['The doors open at 3:03.', 'Three. Then three'], ['Knock three times, wait, knock three times.', '']] }
    ],
    outro: ['Someone knocked back.', 'The same way.'] },

  /* ================================================================= V */
  { n: 5, name: 'The Glass', mark: 4,
    intro: () => '<p class="eyebrow line">Night five</p><p class="lead line">Her messages from that night.</p>' + msgs([['03:03', 'I knocked.'], ['03:03', 'Something knocked back.'], ['03:04', 'It isn’t behind the door.'], ['03:04', 'It’s behind the glass.']]) + '<p class="fine line">Then nothing, for a minute.</p>' + noteLine(5),
    obj: [
      { type: 'mirror', cam: 'user', title: 'Turn the glass around', secs: 8, say: ['The fifth door was never in your room.', 'Turn the glass toward yourself.'] },
      { type: 'call', cam: 'user', title: 'Answer', clip: 'three05', who: 'Player Four', frag: r => 'Her call: “three, zero, five”' + (r.call === 'voicemail' ? ' (voicemail)' : ''), unlock: 'calls' },
      { type: 'dark', cam: 'user', title: 'Cover your face', lines: ['03:05.', 'It has my face.'], say: ['Cover the glass.'], text: 'Cover the camera.', frag: () => 'In the dark: “03:05. It has my face.”', unlock: 'msgs' },
      { type: 'mirror', cam: 'user', title: 'It’s behind you', secs: 10, overlay: 'behind', say: ['Don’t turn around.'], text: 'Don’t move.', small: 'It’s behind you' },
      { type: 'draw', cam: 'user', title: 'Mark yourself', mark: 4, show: true, say: ['Draw the fifth mark on your reflection.'], text: 'Draw the mark.', small: 'Over your face' },
      { type: 'freeze', cam: 'user', title: 'Now move', after: ['It stayed.', 'It has your face now.'] },
      { type: 'code', cam: 'user', title: 'Open it', code: '0305', ring: 'oval', say: ['It opens at the time it took her.'], text: 'Open it.', small: 'Four numbers',
        hint2: ['Her call. Her last message.', 'The time it took her'] }
    ],
    outro: ['For a moment, it was you.'] },

  /* ================================================================ VI */
  { n: 6, name: 'The Stairs', mark: 5,
    intro: () => '<p class="eyebrow line">Night six · Player One</p><p class="lead line">Tomás Rey found the doors in 1987.</p><p class="fine line">He fixed radios in a room above the port. One night his radio started reading numbers by itself.</p><p class="fine line">He went down the stairs to find where it came from. The neighbours heard him counting.</p><p class="lead line">He never came back up.</p>' + noteLine(6),
    obj: [
      { type: 'listen', title: 'His radio', clip: 'radio13', glyph: 'radio', az: 120, el: -6, say: ['His radio is still on.', 'Somewhere in your room.'], frag: () => 'His radio: “thirteen… never look back”' },
      { type: 'look', title: 'Look up', dir: 'up', lines: ['HE NEVER LOOKED BACK', 'XIII'], say: ['Something is written above you.'], frag: () => 'On the ceiling: HE NEVER LOOKED BACK · XIII' },
      { type: 'silence', title: 'Not a sound', secs: 10, say: ['Footsteps, upstairs.'], text: 'Don’t make a sound.' },
      { type: 'avoid', title: 'On the stairs', secs: 15, say: ['It’s on the stairs with you.'] },
      { type: 'orbit', title: 'His lamp', secs: 12, say: ['Tomás carried a lamp.'], text: 'Follow his lamp.' },
      { type: 'walk', title: 'Leave the room', steps: 6, say: ['Leave the room you’re in.'], text: 'Walk out of the room.', small: 'Something walks with you' },
      { type: 'walk', title: 'Thirteen steps', exact: 13, noTurn: 60, back: 'door', say: ['Walk thirteen steps.', 'Never look back.'], text: 'Thirteen steps. Then stop.', small: 'Don’t turn around',
        hints: [['Count out loud if you have to.', 'Then stand still'], ['Exactly thirteen.', 'Don’t turn until it tells you']] }
    ],
    outro: ['Tomás is still on the stairs.', 'He was counting your steps.'] },

  /* =============================================================== VII */
  { n: 7, name: 'The Silence', mark: 6,
    intro: () => '<p class="eyebrow line">Night seven</p><p class="lead line">Tomás left a tape.</p><p class="fine line">On it, a music box plays three notes and stops, again and again. Something in the room is breathing, waiting for the fourth.</p><p class="fine line">At the end of the tape you can hear it find him.</p>' + noteLine(7),
    obj: [
      { type: 'silence', title: 'Silence', secs: 12, say: ['It hunts by sound.'], text: 'Don’t make a sound.', keepMic: true },
      { type: 'listen', title: 'The music box', clip: 'box', glyph: 'box', az: -130, el: -8, bed: 'whisper', say: ['The music box is somewhere near you.'], frag: () => 'The box: three notes, then it stops' },
      { type: 'breath', title: 'Clear the glass', lines: ['THE LOW ONE', 'HUM IT'], say: ['The glass is fogging over.'], frag: () => 'Under the frost: THE LOW ONE · HUM IT' },
      { type: 'dark', title: 'In the dark', lines: ['It plays the fourth note', 'only in the dark.'], clip: 'boxfull', say: ['Close your eyes. Cover the glass.'], frag: () => 'In the dark it played four notes; the last was low' },
      { type: 'still', title: 'It’s close', secs: 8, say: ['It’s right next to you.'] },
      { type: 'knock', title: 'Answer it', pattern: [2], before: 2, say: ['It’s asking if you’re there.'], text: 'Answer it.', small: 'The same way' },
      { type: 'hum', title: 'Give it back', note: 'A', say: ['Give it back its note.'], text: 'Hum the fourth note.', small: 'Hold it',
        hints: [['The low one.', 'Her phone remembers the box'], ['Hum low and steady.', 'Higher or lower until it glows']] }
    ],
    outro: ['It has its note back.', 'It will remember your voice.'] },

  /* ============================================================== VIII */
  { n: 8, name: 'The Thread', mark: 7,
    intro: () => '<p class="eyebrow line">Night eight · Player Two</p><p class="lead line">Amalia Cruz painted the doors before she ever saw them.</p><p class="fine line">1999. Three canvases, hung in a row in her studio in Valparaíso. Each one a door. Each one a color.</p><p class="fine line">When the doors came for her, she was standing in front of the last painting.</p>' + noteLine(8),
    obj: [
      { type: 'anchor', fromDoor: true, title: 'Her paintings', items: k => k.frames.map((gl, i) => ({ kind: 'frame', glyph: gl, az: [-55, 0, 55][i], el: 8, dist: 2.9 })), say: ['Her paintings are hanging in your room.'], text: 'Find all three.',
        frag: (r, k) => 'Three paintings: ' + k.frames.map(ch).join(' ') + ' (left to right)' },
      { type: 'dark', title: 'What they were', lines: ['▲ was her blood.', '● was the sea.', '◆ was the paper she wrote on.'], say: ['In the dark, her paintings speak.'], frag: () => '▲ her blood · ● the sea · ◆ her paper' },
      { type: 'draw', title: 'Her mark', mark: 'brush', show: true, say: ['She signed every painting.'], text: 'Draw her mark.', small: 'Follow the brush' },
      { type: 'avoid', title: 'She’s here', secs: 15, say: ['Amalia is in the room.', 'She doesn’t want to be seen.'] },
      { type: 'flicker', fromDoor: true, title: 'Lights out', show: 'numerals', items: k => k.numerals.map((nm, i) => ({ text: nm, az: [-55, 0, 55][i], el: 22 })), say: ['Her paintings only show their order in the dark.'], text: 'Turn off the lights.', small: 'Look at the paintings',
        frag: (r, k) => 'In the dark, numbered: ' + k.frames.map((gl, i) => ch(gl) + ' ' + k.numerals[i]).join(' · ') },
      { type: 'level', title: 'Hold her brush', secs: 10, say: ['A drop of her paint, still wet.'], text: 'Hold the glass flat.', small: 'Don’t spill it' },
      { type: 'colorseq', title: 'Her colors', colors: k => k.colors, say: ['Show it her colors in the order she hung them.'], text: 'Show it her colors.', small: 'In order',
        hints: [['Each painting was a color.', 'Blood. Sea. Paper'], ['I, then II, then III.', 'The numbers only showed in the dark']] }
    ],
    outro: ['Her colors.', 'Her last painting was a door you have opened.'] },

  /* ================================================================ IX */
  { n: 9, name: 'The Sleep', mark: 8,
    intro: () => '<p class="eyebrow line">Night nine · Player Three</p><p class="lead line">Ari was nine.</p><p class="fine line">2011. He played the doors like hide and seek, with his eyes closed, while his mother slept in the next room.</p><p class="fine line">She woke to three bells. His bed was still warm.</p>' + noteLine(9),
    obj: [
      { type: 'listen', title: 'He’s counting', clip: 'child', glyph: 'top', az: 100, el: -20, bed: 'whisper', say: ['Someone small is counting.'] },
      { type: 'turn', title: 'While he counts', turns: 2, say: ['Turn around while he counts.'] },
      { type: 'hide', title: 'Hide', secs: 12, say: ['Ready or not.'], text: 'Hide.', small: 'Cover the glass. Don’t move' },
      { type: 'look', title: 'Under the bed', dir: 'down', effect: 'chalk', lines: ['He drew this under his bed.'], say: ['He left something on the floor.'], frag: () => 'Under the bed: his chalk mark, a spiral' },
      { type: 'draw', title: 'Draw what he drew', mark: 'chalk', show: false, say: ['Draw it from memory.'], text: 'Draw his mark.', small: 'From memory', hint3: ['A spiral.', 'From the middle out'] },
      { type: 'orbit', title: 'His lantern', secs: 10, say: ['His lantern is still lit.'], text: 'Catch it.' },
      { type: 'facedown', title: 'Sleep', bells: true, say: ['Close your eyes.', 'Put the glass face down. Listen for the bells.'], text: 'Sleep.', small: 'Turn it over on the third bell',
        hints: [['Count the bells.', 'One. Two. Three. Now'], ['Not before the third.', 'Right after it']] }
    ],
    outro: ['You woke on the third bell.', 'Ari didn’t.'] },

  /* ================================================================= X */
  { n: 10, name: 'The Sky', mark: 9,
    intro: () => '<p class="eyebrow line">Night ten</p><p class="lead line">Lena named the stars.</p><p class="fine line">On her ceiling she stuck glowing stars, one for each letter of her name. She said the doors open faster under a sky.</p><p class="fine line">Tomás’s radio is still on. It spells things.</p>' + noteLine(10),
    obj: [
      { type: 'look', title: 'Her ceiling', dir: 'up', effect: 'stars', lines: ['Four of them still glow.'], say: ['Look up.'] },
      { type: 'anchor', fromDoor: true, title: 'Her stars', items: k => k.stars.map(s => ({ kind: 'glyph', glyph: 'star', az: s.az, el: s.el, dist: 3, reveal: s.text })), say: ['Her stars are around you.'], text: 'Find all four.',
        frag: () => 'Four stars, each a letter: L, E, N, A' },
      { type: 'listen', title: 'His radio', clip: 'nato', glyph: 'radio', az: -150, el: -5, say: ['The radio again.'], frag: () => 'The radio spelled: lima, echo, november, alpha' },
      { type: 'level', title: 'Hold the moon', secs: 10, say: ['Hold the moon steady.'], text: 'Hold the glass flat.', small: 'Keep the moon in the ring' },
      { type: 'avoid', title: 'Something blocks the stars', secs: 14, say: ['Something is standing between you and the sky.'] },
      { type: 'dark', title: 'Between the stars', lines: ['Joined, they make a door.'], say: ['Cover the glass.'] },
      { type: 'sequence', fromDoor: true, title: 'Join her stars', items: k => k.stars, order: ['L', 'E', 'N', 'A'], say: ['Join her stars in the order of her name.'], text: 'Join her stars.', small: 'Look at each one, in order' }
    ],
    outro: ['L. E. N. A.', 'She’s closer than the stars.'] },

  /* ================================================================ XI */
  { n: 11, name: 'The Names', mark: 10,
    intro: () => '<p class="eyebrow line">Night eleven</p><p class="lead line">Four players. Four marks.</p><p class="fine line">A radio. A brush. Chalk. A door.</p><p class="fine line">Every twelve years the doors open for someone new.</p><p class="lead line">Then, three years after Lena, they opened for you.</p>' + noteLine(11),
    obj: [
      { type: 'anchor', title: 'Their marks', items: [{ kind: 'glyph', glyph: 'radio', az: -90, el: 6, reveal: 'Tomás' }, { kind: 'glyph', glyph: 'brush', az: -25, el: 18, reveal: 'Amalia' }, { kind: 'glyph', glyph: 'chalk', az: 40, el: -10, reveal: 'Ari' }, { kind: 'glyph', glyph: 'door', az: 110, el: 10, reveal: 'Lena' }], say: ['The ones who came before you left their marks.'], text: 'Find all four.' },
      { type: 'call', title: 'The names', clip: 'years', who: 'Unknown', frag: () => 'The call: Tomás 1987, Amalia 1999, Ari 2011, Lena 2023' },
      { type: 'color', title: 'Wake Amalia', color: 'red', effect: 'bleed', reveal: ['Amalia.', 'Ninety-nine.'], say: ['Show it her blood.'] },
      { type: 'knock', title: 'One for each', pattern: [4], say: ['Knock once for each of them.'] },
      { type: 'mirror', cam: 'user', title: 'The fifth', secs: 8, overlay: 'mark', mark: 12, say: ['Turn the glass toward yourself.'], text: 'Hold still.', small: 'Something is marking you' },
      { type: 'dark', cam: 'user', title: 'In the dark', lines: ['Lena wasn’t the last.', 'You are.'], say: ['Cover the glass.'] },
      { type: 'drawseq', title: 'Draw them', marks: ['radio', 'brush', 'chalk', 'door'], say: ['Draw who came before you, in the order they were taken.'], text: 'Draw their marks.', small: 'One after another',
        hints: [['Radio, brush, chalk, door?', 'Or another order?'], ['1987, 1999, 2011, 2023.', '']] }
    ],
    outro: ['You drew them in order.', 'There is space for a fifth mark.'] },

  /* =============================================================== XII */
  { n: 12, name: 'The Bells', mark: 11,
    intro: () => '<p class="eyebrow line">Night twelve · The church</p><p class="lead line">The church in Valparaíso has no bells.</p><p class="fine line">They were taken down in 1987. People still hear them at 3 AM.</p><p class="fine line">Her phone was found on the floor, facing the sea.</p>' + noteLine(12),
    obj: [
      { type: 'align', title: 'Face the sea', bearing: 270, mark: 11, figure: false, say: ['Face the sea again.'] },
      { type: 'look', title: 'The bell tower', dir: 'up', effect: 'bells', lines: ['Taken down in 1987.'], say: ['Look up at the tower.'] },
      { type: 'listen', title: 'The bells', clip: 'bells', glyph: 11, az: 0, el: 25, say: ['Listen.'], frag: () => 'The bells: one, then two, then one' },
      { type: 'walk', title: 'The aisle', steps: 12, noTurn: 60, say: ['Walk the aisle.'], text: 'Twelve steps forward.', small: 'Don’t turn' },
      { type: 'kneel', title: 'Kneel', secs: 8, say: ['Kneel where she knelt.'] },
      { type: 'silence', title: 'They are listening', secs: 12, say: ['The church is full.', 'You can’t see them.'] },
      { type: 'knock', title: 'Ring them back', pattern: [1, 2, 1], facing: 270, say: ['Ring them back.', 'Facing the sea.'], text: 'Ring the bells.', small: 'Knock, facing the sea',
        hints: [['One, two, one.', 'And face west while you knock']] }
    ],
    outro: ['The bells answered.', 'The last door is open.'] },

  /* ============================================================== XIII */
  { n: 13, name: 'The Maker', mark: 12,
    intro: () => '<p class="eyebrow line">The last night</p><p class="lead line">Behind the last door is whoever made them.</p><p class="fine line">You have opened twelve. Lena opened twelve too.</p><p class="lead line">Then she went in.</p>' + noteLine(13),
    obj: [
      { type: 'scan', title: 'Your room', say: ['It’s your room.', 'It always was.'] },
      { type: 'maze', title: 'Their marks', collect: () => ['radio', 'brush', 'chalk', 'door'].map(gl => ({ glyph: gl })), hunter: true, delay: 10, speed: 8, fog: .22, text: 'Gather their marks.', small: 'It’s faster now' },
      { type: 'mirror', cam: 'user', title: 'Look at yourself', secs: 10, say: ['Turn the glass toward yourself.'] },
      { type: 'freeze', cam: 'user', title: 'It stays', after: ['It stayed.'] },
      { type: 'call', cam: 'user', title: 'Lena', clip: 'lena', who: 'Lena' },
      { type: 'draw', cam: 'user', title: 'Your mark', free: true, say: ['Every keeper leaves a mark.'], text: 'Make your mark.', small: 'It will be yours' },
      { type: 'choice', title: 'Decide' }
    ],
    outro: [] }
];

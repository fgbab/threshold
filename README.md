# Threshold

A camera-first horror mystery. Thirteen doors. They only appear through glass. Behind the last one is whoever made them.

**Play:** https://fgbab.github.io/threshold/ on a phone, at night, alone, sound on.

One door opens each night at 3:03 AM. Each door is a chapter of the story and seven objectives played through the
camera: six give you a piece of what the seventh (the lock) asks for: a number, an order, a rhythm, a color, a direction,
a mark. Clues live in Lena's phone (the phone icon at the top): her note, a keyring of what you found, her voice memo,
her last location, her last photo (your room), her messages, and the calls you get.

| Door | Theme | Lock |
|---|---|---|
| I · The Maze | your room's real edges become a maze; three embers; a hunter | dial the embers' numbers in the order the eye shows |
| II · The Eye | the light becomes an eye; her voice memo | blink her rhythm with your hand over the lens |
| III · The Water | a compass that floats where it really is; the sea | face true west until the mark assembles |
| IV · The Threshold | a real door; something on the other side | knock the time it comes |
| V · The Glass | the front camera; a late reflection; her call | the time it took her, on a ring around your frozen face |
| VI · The Stairs | Player One's radio; thirteen steps | walk exactly thirteen steps, never looking back |
| VII · The Silence | a music box missing a note; frost you breathe away | hum the missing note |
| VIII · The Thread | Player Two's paintings; numbered only in the dark | show her colors in order |
| IX · The Sleep | Player Three's hide and seek | turn the phone over on the third bell |
| X · The Sky | stars on your ceiling; the radio spells | join the stars in the order of her name |
| XI · The Names | four players, four marks | draw their marks in the order they were taken |
| XII · The Bells | the church in Valparaíso | ring the bells, facing the sea |
| XIII · The Maker | your room, your face, her voice | your mark, then a choice |

## How it's made
- `src/` ES modules, bundled with esbuild into `www/game.js` (`npm run build`).
- `src/gfx.js`: WebGL with three.js. The camera is graded like film; 3D objects are anchored in the room using the
  phone's orientation (sigils, doors, smoke figures, dust); a procedural eye; bloom, grain, aberration, cracked glass,
  frost, ripples, glitches.
- `src/mech-*.js`: about thirty reusable AR mechanics (camera vision, things anchored around you, body, voice, touch,
  mirror). `src/doors.js`: the thirteen doors as data and story.
- Camera frames and the microphone never leave the device.

**Testing:** `#door=N` plays door N now. `#unlock` opens the next door. `#demo` uses a photo instead of the camera.
Self-tests: `#auto=N` plays door N by itself; `#shot=N.K` stops on objective K of door N.

**iPhone app:** Capacitor wrapper in `ios/`, built on EAS. See `docs/RELEASE.md`.

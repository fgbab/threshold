# Threshold

A camera-first mystery game. There are five doors. They only appear through glass.

**Play:** https://fgbab.github.io/threshold/ on a phone, at night, sound on.

| Night | Door | What you do |
|---|---|---|
| 1 | I · The Maze | The room's real edges become the walls; tilt the phone to guide the ember. |
| 1 | II · The Light | Hold the brightest thing in view, then cover the camera. |
| 1 | III · The Alignment | Turn until the scattered pieces of a mark come together. |
| 2 | IV · The Threshold | Walk to a real door, press the phone against it, knock three times. Something knocks back. |
| 3 | V · The Glass | The camera turns around. Hold still; your reflection stays behind. Then choose. |

Each new night opens at 3:03 AM after you finish the previous one. Invitations (`?d=` links) carry your player number,
optional name and maze time. Camera frames never leave the device.

**Testing:** `#unlock` opens the next night now. `#demo` uses a photo instead of the camera.
Self-tests: `#auto`, `#auto2`, `#auto3` play a whole night; `#shot1`-`#shot8` and `#shotw` stop on one screen.

**iPhone app:** Capacitor wrapper in `ios/`, built on EAS. See `docs/RELEASE.md`.

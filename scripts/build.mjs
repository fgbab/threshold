// Builds www/, the iPhone app's copy of the game: the same files GitHub Pages serves, plus native.js
// (the Capacitor plugins, bundled because the game itself has no build step).
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['game.js', 'room.jpg', 'fonts']) cpSync(f, `${out}/${f}`, { recursive: true });
await build({ entryPoints: ['native/entry.js'], bundle: true, format: 'iife', minify: true, target: 'safari15', outfile: `${out}/native.js`, logLevel: 'warning' });
const tag = '<script src="game.js"></script>', html = readFileSync('index.html', 'utf8');
if (!html.includes(tag)) throw new Error('index.html no longer loads game.js the expected way');
writeFileSync(`${out}/index.html`, html.replace(tag, '<script src="native.js"></script>\n' + tag));
console.log('www/ is ready');

// Builds www/: the game bundled from src/ (with three.js) into game.js, the fonts and sample room, and native.js
// (the Capacitor plugins, for the iPhone app; on the web it does nothing). GitHub Pages and the app both use www/.
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const out = 'www', dev = process.argv.includes('--dev');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['room.jpg', 'fonts']) cpSync(f, `${out}/${f}`, { recursive: true });
const common = { bundle: true, format: 'iife', minify: !dev, sourcemap: dev, target: ['safari15', 'chrome100'], logLevel: 'warning', legalComments: 'none' };
await build({ ...common, entryPoints: ['src/main.js'], outfile: `${out}/game.js` });
await build({ ...common, entryPoints: ['native/entry.js'], outfile: `${out}/native.js` });
const tag = '<script src="game.js"></script>', html = readFileSync('index.html', 'utf8');
if (!html.includes(tag)) throw new Error('index.html no longer loads game.js the expected way');
writeFileSync(`${out}/index.html`, html.replace(tag, '<script src="native.js"></script>\n' + tag));
console.log('www/ is ready');

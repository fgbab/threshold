// THRESHOLD's Content-Security-Policy: the one CloudFront sends with every page (infra/site.yaml, SiteHeaders), and the
// tools deploy.sh uses to keep it true to the build. Run from landing/:
//   node infra/csp.mjs hashes dist [allowed…]   the hash sources of dist/'s inline scripts plus any allowed ones given,
//                                                 on one line (deploy.sh stack keeps the live pages' until PRUNE=1)
//   node infra/csp.mjs check dist "<allowed>"   exit 3 when a page has an inline script the allowed hashes don't cover
//   node infra/csp.mjs audit dist               exit 1 for what the policy would block, or what reaches another site: a
//                                                 file loaded from elsewhere, an inline handler (onclick=…), javascript:
//   node infra/csp.mjs policy dist              the whole policy for dist/ (a preview server can send it too)
// The policy allows this site and nothing else: its scripts (the inline ones by hash), styles, fonts, images, sound and
// video (Web Audio needs nothing more; <audio> may also play blob: and data: sources), workers, and its own /api.
// site.yaml spells the same policy around ${InlineScriptHashes}; infra/test/csp.test.mjs fails when the two differ.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const SITE = 'https://threshold.gazum.ai', MAX_POLICY = 1783;   // CloudFront's limit on a CSP header value
export const policy = (hashes = '') => [
  `default-src 'self'`, `script-src 'self' ${hashes}`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`,
  `font-src 'self'`, `media-src 'self' data: blob:`, `connect-src 'self'`, `worker-src 'self' blob:`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`
].join('; ');

const HASH = /'sha256-[A-Za-z0-9+/]{43}='/g;
const RUNS = /^(?:|module|importmap|(?:text|application)\/(?:x-)?(?:java|ecma)script|text\/(?:javascript1\.[0-5]|jscript|livescript))$/i;
export const hashOf = text => `'sha256-${crypto.createHash('sha256').update(text.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`;
const attr = (attrs, name) => { const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs); return m ? m[1] ?? m[2] ?? m[3] : null; };

/* the inline scripts a browser would run: no src, and a JavaScript type (or none), a module, or an import map; a data
   block (application/json, application/ld+json) never runs, so the CSP never asks for it */
export function inlineScripts(html) {
  const out = [];
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attr(m[1], 'src') !== null || !RUNS.test((attr(m[1], 'type') ?? '').trim()) || !m[2].trim()) continue;
    out.push(m[2]);
  }
  return out;
}

/* what the policy would block, or what would reach another site ("no third parties") */
const elsewhere = u => { try { return /^(?:https?:)?\/\//i.test(u) && new URL(u, SITE).origin !== SITE; } catch { return false; } };
const LOADS = /\b(?:stylesheet|preload|modulepreload|prefetch|preconnect|dns-prefetch|icon|apple-touch-icon|mask-icon|manifest)\b/i;
export function auditCss(css) {
  const out = [];
  for (const m of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)|@import\s+(?:"([^"]*)"|'([^']*)')/gi)) {
    const u = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '').trim();
    if (elsewhere(u)) out.push(`CSS loads ${u} (another site: the CSP blocks it; host the file here)`);
  }
  return out;
}
export function auditHtml(html) {
  const out = [], css = [];
  const bare = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script\s*>)/gi, '$1$2')
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (_, a, sheet, b) => { css.push(sheet); return a + b; });
  for (const t of bare.matchAll(/<([a-z][a-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    const tag = t[1].toLowerCase(), a = {};
    for (const m of t[2].matchAll(/([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) a[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    for (const [k, v] of Object.entries(a)) {
      if (/^on[a-z]+$/.test(k)) out.push(`<${tag} ${k}=…>: an inline event handler (the CSP blocks it: use addEventListener)`);
      if (/^\s*javascript:/i.test(v)) out.push(`<${tag} ${k}="javascript:…">: a javascript: URL (the CSP blocks it)`);
    }
    const urls = ['src', 'poster', 'data'].filter(k => a[k]).map(k => a[k]);
    if (a.srcset) urls.push(...a.srcset.split(',').map(s => s.trim().split(/\s+/)[0]));
    if (tag === 'link' && a.href && LOADS.test(a.rel || '')) urls.push(a.href);
    if (['image', 'use', 'feimage'].includes(tag)) urls.push(a.href || a['xlink:href'] || '');   // inline SVG
    if ((tag === 'form' && a.action) || (tag === 'base' && a.href)) urls.push(a.action || a.href);
    for (const u of urls) if (elsewhere(u.trim())) out.push(`<${tag}> loads ${u.trim()} (another site: the CSP blocks it; host the file here)`);
    if (a.style) css.push(a.style);
  }
  for (const sheet of css) out.push(...auditCss(sheet));
  return out;
}

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const pages = dir => walk(dir).filter(f => f.endsWith('.html'));
export const hashesOf = dir => [...new Set(pages(dir).flatMap(f => inlineScripts(fs.readFileSync(f, 'utf8')).map(hashOf)))];
export const tokens = (...s) => s.join(' ').match(HASH) || [];
export function auditDir(dir) {
  return walk(dir).flatMap(f => {
    const ext = path.extname(f), rel = path.relative(dir, f);
    if (ext === '.html') return auditHtml(fs.readFileSync(f, 'utf8')).map(p => `${rel}: ${p}`);
    if (ext === '.css') return auditCss(fs.readFileSync(f, 'utf8')).map(p => `${rel}: ${p}`);
    return [];
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dir = 'dist', ...rest] = process.argv.slice(2);
  if (!['hashes', 'check', 'audit', 'policy'].includes(cmd) || !fs.existsSync(dir)) {
    console.error(`usage: node infra/csp.mjs hashes|check|audit|policy <dist> [allowed hashes] (${dir} ${fs.existsSync(dir) ? 'exists' : 'is missing: build first'})`);
    process.exit(2);
  }
  const built = hashesOf(dir);
  if (cmd === 'hashes' || cmd === 'policy') {
    const all = [...new Set([...built, ...tokens(...rest)])].sort().join(' '), p = policy(all);
    if (p.length > MAX_POLICY) { console.error(`The CSP would be ${p.length} characters (CloudFront takes ${MAX_POLICY}): fewer inline scripts, or PRUNE=1.`); process.exit(4); }
    console.log(cmd === 'hashes' ? all : p);
  } else if (cmd === 'check') {
    const have = new Set(tokens(...rest)), missing = built.filter(h => !have.has(h));
    if (missing.length) { console.error(`The live CSP doesn't allow ${missing.length} inline script(s) of this build: ${missing.join(' ')}`); process.exit(3); }
  } else {
    const problems = auditDir(dir);
    for (const p of problems) console.error(`  ${p}`);
    if (problems.length) { console.error(`${problems.length} thing(s) in ${dir}/ the CSP would block, or that reach another site.`); process.exit(1); }
  }
}

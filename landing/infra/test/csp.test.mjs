// The hosting's rules: the CSP (infra/csp.mjs) and what site.yaml and deploy.sh must keep.
//   node --test infra/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { policy, hashOf, inlineScripts, auditHtml, auditCss, MAX_POLICY } from '../csp.mjs';

const INFRA = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(INFRA, f), 'utf8');
const cli = (...args) => spawnSync(process.execPath, [path.join(INFRA, 'csp.mjs'), ...args], { encoding: 'utf8' });
const made = [];
test.after(() => made.forEach(d => fs.rmSync(d, { recursive: true, force: true })));
function dist(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'th-dist-'));
  made.push(dir);
  for (const [f, s] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); }
  return dir;
}
const BOOT = "document.documentElement.classList.add('js');setTimeout(function(){if(!window.__th)document.documentElement.classList.remove('js')},3000)";
const PAGE = `<!doctype html><html><head><link rel="stylesheet" href="/assets/threshold.1a2b3c4d5e.css"><link rel="canonical" href="https://threshold.gazum.ai/">
<link rel="alternate" hreflang="es" href="https://threshold.gazum.ai/es/"><meta property="og:image" content="https://threshold.gazum.ai/og-en.jpg">
<script>${BOOT}</script><script type="application/json" id="th-i18n">{"a":"<b>"}</script><script type="application/ld+json">{"@type":"VideoGame"}</script></head>
<body><img src="/assets/door.0a1b2c3d4e.avif" srcset="/assets/door-480.1.avif 480w, /assets/door-800.2.avif 800w" alt="">
<a href="https://fgbab.github.io/threshold/" rel="noopener">Play the prototype</a><span style="--d:1;background:url(data:image/png;base64,AAAA)"></span>
<svg><use href="#door"/></svg><script src="/assets/threshold.9f8e7d6c5b.js" defer></script></body></html>`;

test('a hash is what browsers compute (the CSP spec\'s own example)', () => {
  assert.equal(hashOf("alert('Hello, world.');"), "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='");
  assert.equal(hashOf('a\r\nb'), hashOf('a\nb'), 'line endings as the HTML parser sees them');
});

test('only the inline scripts a browser runs need a hash', () => {
  assert.deepEqual(inlineScripts(PAGE), [BOOT]);
  const html = `<script type="module">import './a.js'</script><SCRIPT TYPE="text/javascript">b()</SCRIPT><script type="importmap">{"imports":{}}</script>
<script data-src="x">c()</script><script src="/d.js">ignored()</script><script type="text/template"><p></p></script><script>  </script><!-- <script>e()</script> -->`;
  assert.deepEqual(inlineScripts(html), ["import './a.js'", 'b()', '{"imports":{}}', 'c()']);
});

test('the audit passes a page that keeps to its own site', () => {
  assert.deepEqual(auditHtml(PAGE), []);
  assert.deepEqual(auditCss("@font-face{src:url(/assets/cormorant.1.woff2) format('woff2')}.g{background:url(\"data:image/svg+xml,%3Csvg%3E\")}"), []);
});

test('the audit names what the CSP would block, or what reaches another site', () => {
  const bad = auditHtml(`<link rel="preconnect" href="https://fonts.gstatic.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">
<img src="//cdn.example.com/x.png"><button onclick="go()">go</button><a href="javascript:void 0">x</a><video poster="https://cdn.example.com/p.jpg"></video>
<form action="https://forms.example.com/join"></form><iframe src="https://www.youtube.com/embed/x"></iframe><svg><image href="https://cdn.example.com/i.png"/></svg>
<style>@import 'https://cdn.example.com/a.css';</style><div style="background:url('https://cdn.example.com/bg.jpg')"></div>`);
  for (const what of ['fonts.gstatic.com', 'fonts.googleapis.com', '//cdn.example.com/x.png', 'onclick', 'javascript:', 'p.jpg', 'forms.example.com', 'youtube.com', 'i.png', 'a.css', 'bg.jpg']) {
    assert.ok(bad.some(p => p.includes(what)), `the audit names ${what}`);
  }
  assert.equal(bad.length, 11);
});

test('site.yaml spells exactly the policy csp.mjs knows, and lets only hashes into script-src', () => {
  const yaml = read('site.yaml');
  const inYaml = /ContentSecurityPolicy: !Sub "([^"]+)"/.exec(yaml)[1];
  assert.equal(inYaml, policy('${InlineScriptHashes}'));
  const allowed = new RegExp(/AllowedPattern: "([^"]+)"/.exec(yaml.slice(yaml.indexOf('InlineScriptHashes:')))[1]);
  const h = hashOf('a()'), h2 = hashOf('b()');
  for (const ok of ['', h, `${h} ${h2}`]) assert.ok(allowed.test(ok), `allows ${JSON.stringify(ok)}`);
  for (const no of [`'unsafe-inline'`, `${h} 'unsafe-inline'`, `${h} https://evil.example`, 'None', `${h}  ${h2}`]) assert.ok(!allowed.test(no), `refuses ${no}`);
  assert.ok(policy('').length < MAX_POLICY && policy(Array.from({ length: 20 }, (_, i) => hashOf(String(i))).join(' ')).length <= MAX_POLICY, 'room for 20 inline scripts');
});

test('the CLI: hashes (with the ones already live), check, audit, policy', () => {
  const dir = dist({ 'index.html': PAGE, 'es/index.html': PAGE.replace('__th', '__th_es'), '404.html': '<p>no scripts</p>', 'assets/a.css': 'b{color:red}' });
  const mine = [hashOf(BOOT), hashOf(BOOT.replace('__th', '__th_es'))].sort().join(' '), old = hashOf('old()');
  let r = cli('hashes', dir);
  assert.deepEqual([r.status, r.stdout.trim()], [0, mine]);
  r = cli('hashes', dir, `${old} None`);
  assert.deepEqual([r.status, r.stdout.trim()], [0, [...mine.split(' '), old].sort().join(' ')], 'keeps what is live; ignores what is not a hash');
  assert.equal(cli('check', dir, mine).status, 0);
  r = cli('check', dir, hashOf(BOOT));
  assert.equal(r.status, 3);
  assert.match(r.stderr, /doesn't allow 1 inline script/);
  assert.equal(cli('audit', dir).status, 0);
  r = cli('policy', dir);
  assert.equal(r.stdout.trim(), policy(mine));
  const bad = dist({ 'index.html': '<img src="https://cdn.example.com/x.png">', 'assets/s.css': "a{background:url(https://cdn.example.com/y.png)}" });
  r = cli('audit', bad);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /index\.html: <img> loads https:\/\/cdn\.example\.com\/x\.png/);
  assert.match(r.stderr, /assets\/s\.css: CSS loads https:\/\/cdn\.example\.com\/y\.png/);
  assert.equal(cli('hashes', path.join(dir, 'nothing')).status, 2, 'no dist/: build first');
  const many = Array.from({ length: 40 }, (_, i) => hashOf(`s${i}()`)).join(' ');
  assert.equal(cli('hashes', dir, many).status, 4, 'never past CloudFront\'s 1,783 characters');
});

test('the stack keeps the lessons of the games before it', () => {
  const yaml = read('site.yaml');
  assert.match(yaml, /Action: lambda:InvokeFunctionUrl\s+Principal: '\*'\s+FunctionUrlAuthType: NONE/);
  assert.match(yaml, /Action: lambda:InvokeFunction\s+Principal: '\*'\s+InvokedViaFunctionUrl: true/, 'both permissions, or the URL answers 403');
  assert.match(yaml, /HeaderName: X-Origin-Verify\s+HeaderValue: !Ref OriginVerify/);
  assert.match(yaml, /WaitlistTable:\s+Type: AWS::DynamoDB::Table\s+DeletionPolicy: Retain\s+UpdateReplacePolicy: Retain/);
  assert.match(yaml, /TimeToLiveSpecification: \{ AttributeName: ttl, Enabled: true \}/);
  assert.match(yaml, /PointInTimeRecoveryEnabled: true/);
  assert.match(yaml, /AttributeDefinitions: \[\{ AttributeName: pk, AttributeType: S \}\]/);
  assert.match(yaml, /SecretStringTemplate: '\{"resend":""\}'\s+GenerateStringKey: signing/);
  assert.match(yaml, /Default: threshold\.gazum\.ai/);
  const sh = read('deploy.sh');
  assert.match(sh, /^STACK=threshold-site HOST=threshold\.gazum\.ai ZONE_NAME=gazum\.ai$/m);
});

test('the hosting and the waitlist are THRESHOLD\'s alone: nothing of the game they were copied from, no other host', () => {
  for (const f of ['site.yaml', 'deploy.sh', 'csp.mjs', 'README.md', '../api/waitlist.mjs']) {
    const s = read(f);
    assert.doesNotMatch(s, /L[O]CKED IN|l[o]ckedin|W[a]rden|\bw[a]x\b|stencil|typewriter|Courier/i, `${f}: the other game's words`);
    assert.doesNotMatch(s, /#(?:0B0A0A|E9E2D0|C1121F|FBF4E6|D4192A|A30E1A|E5383B|A8875A)\b|rgba\((?:233, ?226, ?208|168, ?135, ?90|19, ?17, ?17)/i, `${f}: the other game's colours`);
    assert.doesNotMatch(s, /(?:leylight|timewright|elsewhere|alchemika)(?:-site|\.gazum\.ai)/i, `${f}: another game's stack or host`);
  }
});

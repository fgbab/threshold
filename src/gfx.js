/* Threshold graphics. Everything you see is rendered here with WebGL (three.js):
   - the camera feed, graded like film, with the room's own edges traced in gold for the maze;
   - a world scene anchored in your room (AR): sigils and doors forged from light, smoke that stands where nothing should,
     floating dust that sells the depth; a screen scene for things that live on the glass (the ember, the eye);
   - bloom, film grain, lens aberration, vignette, and the glass itself: cracks, frost, ripples, tearing, the face.
   The 2D layer from core (numbers, rings, fine lines) is composited into the same pipeline so it glows too. */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as C from './core.js';
import { S, AUTO, TAU, DEG, clamp, basis, dirOf, shape, audio, buzz } from './core.js';

THREE.ColorManagement.enabled = false;
const GOLD = new THREE.Color(1, .72, .38);

/* ===================================================================== */
/* SHADER LIBRARY                                                          */
/* ===================================================================== */
const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return v; }`;
const CLIP_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const MESH_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

/* the camera feed, graded; the frozen room; the late reflection; the maze's golden edges; the void when there's no camera */
const BG_FS = `precision highp float;
uniform sampler2D tCam, tStill, tGhost, tWalls;
uniform vec2 camScale, camOff, lantern, stillTexel, ghostOff;
uniform float mirror, useStill, useGhost, ghostAlpha, ghostZoom, exposure, sat, time, dread, voidMode, aspect, water;
uniform vec4 haze;
uniform float maze, lanternR, scan, edgeGain, edgeLo, edgeHi;
varying vec2 vUv;
${NOISE}
float lumAt(vec2 uv) { return dot(texture2D(tStill, uv).rgb, vec3(.299, .587, .114)); }
void main() {
  vec2 uv = vUv;
  if (voidMode > .5) {
    vec2 q = uv * vec2(aspect, 1.);
    float f = fbm(q * 2.2 + vec2(time * .02, -time * .035)), f2 = fbm(q * 5. - vec2(time * .04, time * .02));
    vec3 col = vec3(.012, .01, .008) + vec3(.1, .066, .036) * pow(f * f2 * 1.75, 2.3);
    col += vec3(.06, .036, .016) * smoothstep(.95, 0., length((uv - vec2(.5, .62)) * vec2(aspect, 1.)));
    gl_FragColor = vec4(col, 1.); return;
  }
  if (haze.w > .001) {                       // the thing bends the light around it
    vec2 dv = (uv - haze.xy) * vec2(aspect, 1.);
    float hz = haze.w * smoothstep(haze.z, haze.z * .15, length(dv));
    if (hz > .001) uv += hz * .022 * (vec2(fbm(uv * 9. + time * .7), fbm(uv * 9. - time * .6 + 4.)) - .5);
  }
  vec2 su = vec2(mirror > .5 ? 1. - uv.x : uv.x, uv.y);
  vec3 c = mix(texture2D(tCam, su * camScale + camOff).rgb, texture2D(tStill, su).rgb, useStill);
  if (useGhost > 0.) { vec2 gu = (su - .5) / ghostZoom + .5 + ghostOff; vec3 gc = texture2D(tGhost, gu).rgb; c = 1. - (1. - c) * (1. - gc * ghostAlpha); }
  float l = dot(c, vec3(.299, .587, .114));
  vec3 col = mix(vec3(l), c, sat) * exposure;
  col = col / (col + .5) * 1.5;
  col = pow(max(col, 0.), vec3(1.42));
  col *= mix(vec3(.8, .95, 1.06), vec3(1.14, .96, .74), smoothstep(.1, .72, l));
  if (water > 0.) { float cs = fbm(uv * vec2(aspect, 1.) * 6. + vec2(time * .25, time * .1)); col = mix(col, col * vec3(.7, .95, 1.15) + vec3(.02, .07, .1) * pow(cs, 3.) * 3.2, water); }
  if (dread > .001) {                        // dread: color drains, smoke crawls in from the edges
    float e = length((vUv - .5) * vec2(aspect, 1.) * 1.15);
    float sm = fbm(vUv * vec2(aspect, 1.) * 2.5 + vec2(time * .04, -time * .07));
    col *= 1. - dread * smoothstep(.2, 1.1, e + (sm - .5) * .6) * .92;
    col = mix(col, vec3(dot(col, vec3(.333))), dread * .5);
  }
  if (maze > 0.) {
    vec2 t = stillTexel * 1.6;
    float a00 = lumAt(su + vec2(-t.x, t.y)), a10 = lumAt(su + vec2(0., t.y)), a20 = lumAt(su + vec2(t.x, t.y));
    float a01 = lumAt(su + vec2(-t.x, 0.)), a21 = lumAt(su + vec2(t.x, 0.));
    float a02 = lumAt(su + vec2(-t.x, -t.y)), a12 = lumAt(su + vec2(0., -t.y)), a22 = lumAt(su + vec2(t.x, -t.y));
    float gx = (a20 + 2. * a21 + a22) - (a00 + 2. * a01 + a02), gy = (a00 + 2. * a10 + a20) - (a02 + 2. * a12 + a22);
    float edge = smoothstep(edgeLo, edgeHi, length(vec2(gx, gy)));
    float walls = texture2D(tWalls, vUv).r;
    float revealed = 1. - smoothstep(scan - .03, scan, 1. - vUv.y);
    vec3 gold = vec3(1., .72, .38);
    float near = smoothstep(lanternR, lanternR * .2, length((vUv - lantern) * vec2(aspect, 1.)));
    col *= mix(1., mix(.06, .3, near), maze);
    col += gold * (edge * edgeGain + walls * .3) * mix(.045, 1., near) * revealed * maze;
    col += gold * 2.2 * smoothstep(.01, 0., abs((1. - vUv.y) - scan)) * step(scan, 1.) * maze;
  }
  gl_FragColor = vec4(col, 1.);
}`;

/* the last pass: tone, the glass and everything that happens to it */
const FINAL_FS = `precision highp float;
uniform sampler2D tDiffuse, tFace, tCrack, tClear;
uniform float time, grain, vignette, aberr, glitch, fade, flash, scare, crack, frost, aspect;
uniform vec3 flashCol, ripple;
varying vec2 vUv;
${NOISE}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main() {
  vec2 uv = vUv;
  if (ripple.z > 0.) { vec2 d = (uv - ripple.xy) * vec2(aspect, 1.); float r = length(d); uv += normalize(d + 1e-5) / vec2(aspect, 1.) * sin(r * 55. - time * 5.) * .005 * ripple.z * smoothstep(.9, 0., r); }
  float ck = 0.;
  if (crack > 0.) { vec4 cr = texture2D(tCrack, vUv); ck = cr.a * crack; uv += (cr.rg - .5) * .03 * crack; }
  if (glitch > 0.) { float band = floor(vUv.y * 38. + floor(time * 24.) * 7.); float h = hash(vec2(band, floor(time * 18.))); if (h > .74) uv.x += (h - .74) * 1.6 * glitch * (hash(vec2(band, 3.)) - .5); }
  vec2 dc = uv - .5; float ca = aberr * (.35 + dot(dc, dc) * 3.2) + glitch * .014;
  vec3 col = vec3(texture2D(tDiffuse, uv + dc * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dc * ca).b);
  col = aces(col * 1.08);
  if (frost > 0.) {
    vec2 q = vUv * vec2(aspect, 1.);
    float fr = fbm(q * 9.) * .55 + fbm(q * 34. + 7.) * .45, cl = texture2D(tClear, vUv).r;
    float f = frost * (1. - cl) * smoothstep(.25, .75, fr + .22);
    col = mix(col, vec3(.74, .79, .82) * (.55 + fr * .55), f * .88);
    col += vec3(.9, .95, 1.) * smoothstep(.72, .9, fbm(q * 60.)) * f * .35;
  }
  col = col * (1. - ck * .25) + vec3(.92, .94, 1.) * ck * .32;
  float v = smoothstep(.98, .22, length((vUv - .5) * vec2(aspect * .9, 1.)));
  col *= mix(1. - vignette, 1., v);
  float n = hash(vUv * vec2(1931., 1733.) + fract(time * 13.)) - .5;
  col += n * grain * (1.25 - dot(col, vec3(.33)));
  col = mix(col, flashCol, flash);
  if (scare > 0.) {
    float sb = floor(vUv.y * 64.), off = hash(vec2(sb, floor(time * 40.))) > .7 ? (hash(vec2(sb, 9.)) - .5) * .16 : 0.;
    vec2 fu = (vUv - .5) * vec2(aspect, 1.) * vec2(1.2, 1.05) + .5 + vec2(off, .02);
    vec4 fc = texture2D(tFace, fu); float inside = step(0., fu.x) * step(fu.x, 1.) * step(0., fu.y) * step(fu.y, 1.);
    col = mix(col, vec3(0.), scare * .93);
    vec3 face = vec3(texture2D(tFace, fu + vec2(.006, 0.)).r, fc.g, texture2D(tFace, fu - vec2(.006, 0.)).b);
    col = mix(col, face + n * .35, fc.a * inside * scare);
  }
  col *= 1. - fade;
  gl_FragColor = vec4(col, 1.);
}`;

/* sigils and doors: tubes of light with a slow sheen running along them */
const TUBE_FS = `uniform float time, glow, progress, flicker, alpha, seed; uniform vec3 color; varying vec2 vUv;
float h1(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  if (vUv.x > progress) discard;
  float sheen = smoothstep(.1, 0., abs(fract(vUv.x * 1.3 - time * .2 + seed) - .5) - .36);
  float core = 1. - abs(vUv.y - .5) * 2.;
  float f = 1. - flicker * .4 * h1(floor(time * 16.) + seed * 7.);
  float tip = smoothstep(.03, 0., progress - vUv.x) * step(progress, .999);
  vec3 c = color * glow * (.5 + .5 * core) * (1. + sheen * 1.7 + tip * 3.) * f;
  gl_FragColor = vec4(c * alpha, 1.);
}`;
/* sparks drifting off the lines, embers, dust */
const PTS_VS = `uniform float time, size, spread, alpha, pr, rise, life; attribute float phase; attribute vec3 drift; varying float vA; varying float vHeat;
void main() {
  float t = fract(time / life + phase);
  vec3 p = position + drift * t * spread + vec3(0., 0., rise * t);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  float persp = projectionMatrix[3][3] < .5 ? 2.4 / max(.1, -mv.z) : 1.;
  gl_PointSize = size * pr * (1. - t * .6) * persp;
  vA = alpha * smoothstep(0., .12, t) * (1. - t); vHeat = 1. - t;
  gl_Position = projectionMatrix * mv;
}`;
const PTS_FS = `uniform vec3 color, hot; uniform float boost; varying float vA; varying float vHeat;
void main() { float r = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, r); a *= a; gl_FragColor = vec4(mix(color, hot, vHeat * vHeat) * a * vA * boost, 1.); }`;
/* the thing: smoke shaped like someone standing, wisps rising, a faint ember rim */
const SMOKE_FS = `uniform sampler2D tMask; uniform float time, alpha, dissolve, seed; varying vec2 vUv;
${NOISE}
void main() {
  vec2 uv = vUv;
  float n1 = fbm(vec2(uv.x * 4. + seed, uv.y * 3. - time * .35)), n2 = fbm(vec2(uv.x * 9. + 3. + seed, uv.y * 6. - time * .8));
  float m = texture2D(tMask, uv + vec2((n1 - .5) * .07, 0.)).a;
  float body = smoothstep(.16, .88, m + (n2 - .5) * .75 - dissolve);
  float inner = .68 + .32 * fbm(vec2(uv.x * 7. - seed, uv.y * 5. - time * .45));
  float wisp = smoothstep(.58, .9, fbm(vec2(uv.x * 6. + seed, uv.y * 2.5 - time * .9))) * smoothstep(.45, .95, uv.y) * smoothstep(0., .35, texture2D(tMask, vec2(uv.x, uv.y - .1)).a);
  float side = smoothstep(.62, .9, fbm(vec2(uv.x * 3. + time * .25, uv.y * 7. + seed))) * smoothstep(.02, .3, m) * (1. - smoothstep(.5, .9, m));
  float feet = smoothstep(.25, .0, uv.y) * smoothstep(.55, .9, fbm(vec2(uv.x * 5. + time * .3, uv.y * 3.))) * .8;
  float a = clamp(body * inner + wisp * .7 + side * .5 + feet, 0., 1.) * alpha;
  float rim = smoothstep(.15, .5, m) * (1. - smoothstep(.5, .85, m + (n2 - .5) * .3));
  vec3 col = vec3(.01, .008, .008) + vec3(.42, .06, .03) * rim * .45;
  gl_FragColor = vec4(col * a, a);
}`;
/* a dark mass with tendrils, for the thing that hunts the ember on the glass */
const BLOB_FS = `uniform float time, alpha, seed; varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vUv - .5; float r = length(p), ang = atan(p.y, p.x);
  float n = fbm(vec2(ang * 2.2 + seed, r * 5. - time * 1.4)), t = fbm(vec2(ang * 5. + seed * 2., time * .6));
  float body = smoothstep(.34 + (n - .5) * .22, .1, r), tendril = smoothstep(.62, .85, t) * smoothstep(.5, .15, r) * .7;
  float a = clamp(body + tendril, 0., 1.) * alpha;
  vec3 col = vec3(.008, .006, .006) + vec3(.5, .07, .03) * smoothstep(.12, .3, r) * body * .35;
  vec2 e = vec2(.06, .02); float eyes = smoothstep(.022, .0, length(p - vec2(-e.x, e.y))) + smoothstep(.022, .0, length(p - vec2(e.x, e.y)));
  col += vec3(2.4, 1.2, .8) * eyes * (.6 + .4 * hash(vec2(floor(time * 7.), seed)));
  gl_FragColor = vec4(col * alpha + vec3(0.), max(a, eyes * alpha));
}`;
/* an eye: fibrous gold iris, a pupil that breathes, veins, a wet highlight, lids rimmed with light */
const EYE_FS = `uniform float time, open, dilate, anger, alpha; uniform vec2 look; varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = (vUv - .5) * vec2(2.3, 1.28);
  float lidH = (1. - p.x * p.x) * .6 * open;
  float inside = lidH > 0. ? smoothstep(lidH + .012, lidH - .012, abs(p.y)) : 0.;
  vec2 q = p - look * .22; float rr = length(q), ang = atan(q.y, q.x);
  vec3 sclera = vec3(.8, .76, .7) * (1. - .45 * smoothstep(.35, 1.05, abs(p.x)));
  float veins = smoothstep(.6, .8, fbm(vec2(ang * 5., rr * 7.) + time * .015)) * smoothstep(.3, 1., abs(p.x));
  sclera = mix(sclera, vec3(.5, .07, .05), veins * (.55 + anger * .45));
  float ir = .37, pr = .1 + dilate * .11 + .01 * sin(time * 1.7);
  float fib = fbm(vec2(ang * 10., rr * 16.)) * .7 + fbm(vec2(ang * 28., rr * 4.)) * .3;
  vec3 iris = mix(vec3(.36, .2, .06), vec3(1., .8, .38), fib) * (.65 + .55 * smoothstep(ir, pr, rr));
  iris = mix(iris, vec3(.95, .22, .1), anger * .55);
  iris *= 1. - smoothstep(ir - .06, ir, rr) * .85;
  vec3 col = mix(sclera, iris, smoothstep(ir + .012, ir - .012, rr));
  col = mix(col, vec3(0.), smoothstep(pr + .012, pr - .012, rr));
  col += vec3(1.) * smoothstep(.07, 0., length(q - vec2(-.11, .13))) * 1.6;
  col *= 1. - smoothstep(-lidH * .2, lidH, p.y) * .5;
  float lidEdge = lidH > .004 ? smoothstep(.03, .0, abs(abs(p.y) - lidH)) * step(abs(p.x), 1.) : smoothstep(.03, 0., abs(p.y)) * step(abs(p.x), 1.);
  vec3 o = col * inside + vec3(1., .72, .38) * lidEdge * 2.6;
  float a = max(inside, lidEdge) * alpha;
  gl_FragColor = vec4(o * alpha, a);
}`;
/* light pouring out of an opened door */
const RAYS_FS = `uniform float time, alpha; varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vUv - vec2(.5, .15); float ang = atan(p.x, p.y), r = length(p);
  float rays = .55 + .45 * fbm(vec2(ang * 7., time * .3)) ;
  float body = smoothstep(.0, .25, vUv.y) * smoothstep(1., .55, vUv.y) * smoothstep(.5, .3, abs(vUv.x - .5));
  vec3 c = vec3(1., .8, .52) * (.85 * body * rays + .35 * smoothstep(.6, 0., r));
  gl_FragColor = vec4(c * alpha, 1.);
}`;
/* a round glow (embers, wisps, eyes) */
const GLOW_FS = `uniform vec3 color; uniform float alpha, time, flick; varying vec2 vUv;
float h1(float n) { return fract(sin(n) * 43758.5453); }
void main() { float r = length(vUv - .5) * 2.; float a = exp(-r * r * 5.) + .4 * exp(-r * r * 40.); a *= 1. - flick * .3 * h1(floor(time * 20.)); gl_FragColor = vec4(color * a * alpha, 1.); }`;
/* the 2D layer, brightened where it's gold so it blooms */
const OVERLAY_FS = `uniform sampler2D tOverlay; varying vec2 vUv;
void main() { vec4 c = texture2D(tOverlay, vUv); float m = max(c.r, max(c.g, c.b)); c.rgb *= 1. + 1.5 * smoothstep(.4, .95, m) * step(.3, c.r - c.b); gl_FragColor = c; }`;

/* ===================================================================== */
/* RENDERER, SCENES, PASSES                                               */
/* ===================================================================== */
const canvas = document.getElementById('gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: AUTO });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor(0x050404, 1);
export const world = new THREE.Scene(), screen = new THREE.Scene();
export const camera3 = new THREE.PerspectiveCamera(60, 1, .05, 80);
export const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
export const U = { time: { value: 0 }, pr: { value: 1 } };   // shared by every material

const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
const bgU = {
  tCam: { value: blank }, tStill: { value: blank }, tGhost: { value: blank }, tWalls: { value: blank },
  camScale: { value: new THREE.Vector2(1, 1) }, camOff: { value: new THREE.Vector2() }, mirror: { value: 0 }, useStill: { value: 0 },
  useGhost: { value: 0 }, ghostAlpha: { value: .34 }, ghostZoom: { value: 1 }, ghostOff: { value: new THREE.Vector2() },
  exposure: { value: .8 }, sat: { value: .2 }, time: U.time, dread: { value: 0 }, voidMode: { value: 1 }, aspect: { value: 1 }, water: { value: 0 },
  haze: { value: new THREE.Vector4(.5, .5, .2, 0) }, maze: { value: 0 }, lantern: { value: new THREE.Vector2(.5, .5) }, lanternR: { value: 2 }, scan: { value: 2 },
  edgeGain: { value: 1.25 }, edgeLo: { value: .2 }, edgeHi: { value: .55 }, stillTexel: { value: new THREE.Vector2(1 / 800, 1 / 1600) }
};
const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: bgU, vertexShader: CLIP_VS, fragmentShader: BG_FS, depthTest: false, depthWrite: false }));
bg.frustumCulled = false; bg.renderOrder = -100; world.add(bg);

const overlayTex = new THREE.CanvasTexture(C.fx); overlayTex.premultiplyAlpha = true; overlayTex.minFilter = THREE.LinearFilter; overlayTex.generateMipmaps = false;
const overlay = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: { tOverlay: { value: overlayTex } }, vertexShader: CLIP_VS, fragmentShader: OVERLAY_FS, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
overlay.frustumCulled = false; overlay.renderOrder = 100; screen.add(overlay);

const finalU = {
  tDiffuse: { value: null }, tFace: { value: blank }, tCrack: { value: blank }, tClear: { value: blank },
  time: U.time, grain: { value: .075 }, vignette: { value: .78 }, aberr: { value: .006 }, glitch: { value: 0 }, fade: { value: 0 }, flash: { value: 0 },
  scare: { value: 0 }, crack: { value: 0 }, frost: { value: 0 }, aspect: { value: 1 }, flashCol: { value: new THREE.Color(1, .9, .7) }, ripple: { value: new THREE.Vector3(.5, .5, 0) }
};
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(world, camera3));
const screenPass = new RenderPass(screen, ortho); screenPass.clear = false; screenPass.clearDepth = true; composer.addPass(screenPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .62, .38, .96); composer.addPass(bloom);
const finalPass = new ShaderPass({ uniforms: finalU, vertexShader: MESH_VS, fragmentShader: FINAL_FS }); composer.addPass(finalPass);
finalPass.uniforms = finalPass.material.uniforms = finalU;   // ShaderPass copies uniforms; keep ours live so effects reach the glass

const QUALITY = [2, 1.6, 1.3, 1];             // pixel ratios to fall back to if a phone can't keep up
let quality = 0, frameMs = 16, slowFor = 0;
function resize() {
  const w = innerWidth, h = innerHeight, dpr = AUTO ? 1 : Math.min(devicePixelRatio || 1, QUALITY[quality]);   // the self-test renders in software: keep it light
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); composer.setPixelRatio(dpr); composer.setSize(w, h);
  bloom.resolution.set(w * dpr / 2, h * dpr / 2);
  camera3.aspect = w / h; camera3.fov = 2 * Math.atan(Math.tan(27 * DEG) * h / w) / DEG; camera3.updateProjectionMatrix();
  ortho.left = -w / 2; ortho.right = w / 2; ortho.top = h / 2; ortho.bottom = -h / 2; ortho.updateProjectionMatrix();
  bgU.aspect.value = finalU.aspect.value = w / h; U.pr.value = dpr;
}
addEventListener('resize', resize); resize();

/* ===================================================================== */
/* SMALL TOOLS                                                            */
/* ===================================================================== */
export const px = (x, y) => new THREE.Vector3(x - C.W / 2, C.H / 2 - y, 0);   // a screen point in the screen scene
export function placeAt(obj, az, el, dist = 3) { const d = dirOf(az, el); obj.position.set(d[0] * dist, d[1] * dist, d[2] * dist); return obj; }
export function faceViewer(obj) { obj.up.set(0, 0, 1); obj.lookAt(0, 0, 0); return obj; }
const tweens = [];
export function tween(o, k, to, ms = 600, done) { for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].o === o && tweens[i].k === k) tweens.splice(i, 1); tweens.push({ o, k, from: o[k], to, t0: performance.now(), ms, done }); }
function runTweens(now) { for (let i = tweens.length - 1; i >= 0; i--) { const t = tweens[i], f = clamp((now - t.t0) / t.ms, 0, 1); t.o[t.k] = t.from + (t.to - t.from) * C.ease(f); if (f >= 1) { tweens.splice(i, 1); if (t.done) t.done(); } } }
function radialTex(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.premultiplyAlpha = true; return t;
}
const live = new Set();                       // objects that animate themselves every frame
export function add(obj, layer = world) { const o = obj.group || obj; if (o.isObject3D) layer.add(o); if (obj.update) live.add(obj); return obj; }   // plain objects with update() just animate
export function remove(obj) { if (!obj) return; live.delete(obj); const o = obj.group || obj; if (!o.isObject3D) return; if (o.parent) o.parent.remove(o); o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) { (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose()); } }); }
export function clearAll() { [...live].forEach(o => { if (!(o.group || o).userData?.keep) remove(o); }); for (const layer of [world, screen]) [...layer.children].forEach(ch => { if (ch !== bg && ch !== overlay && !ch.userData.keep) remove(ch); }); }
export const keepAlways = obj => { (obj.group || obj).userData.keep = true; return obj; };   // survives clearAll (dust, the thing at the edge)

/* ===================================================================== */
/* OBJECTS                                                                */
/* ===================================================================== */
function primCurve(p, s) {                    // one stroke of a mark as a curve in the XY plane, centered, size s
  const k = s / 100, pts = [], P = (x, y) => new THREE.Vector3((x - 50) * k, -(y - 50) * k, 0);
  if (p.c) for (let i = 0; i <= 64; i++) { const a = -Math.PI / 2 + i / 64 * TAU; pts.push(P(p.c[0] + Math.cos(a) * p.c[2], p.c[1] + Math.sin(a) * p.c[2])); }
  else if (p.l) for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(P(p.l[0] + (p.l[2] - p.l[0]) * t, p.l[1] + (p.l[3] - p.l[1]) * t)); }
  else { const n = Math.max(8, Math.ceil(Math.abs(p.a[4] - p.a[3]) / TAU * 64)); for (let i = 0; i <= n; i++) { const a = p.a[3] + (p.a[4] - p.a[3]) * i / n; pts.push(P(p.a[0] + Math.cos(a) * p.a[2], p.a[1] + Math.sin(a) * p.a[2])); } }
  return { curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), n: pts.length, pts };
}
function tubeMat(glow, seed) {
  return new THREE.ShaderMaterial({ uniforms: { time: U.time, glow: { value: glow }, progress: { value: 1 }, flicker: { value: .15 }, alpha: { value: 1 }, seed: { value: seed }, color: { value: GOLD.clone() } },
    vertexShader: MESH_VS, fragmentShader: TUBE_FS, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
}
export function particles(o) {                // a cloud of soft points: { count, at: (i) => [x,y,z], drift: (i) => [x,y,z], size, color, hot, life, spread, rise, alpha, boost }
  const n = o.count, pos = new Float32Array(n * 3), dr = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = o.at(i), d = o.drift ? o.drift(i) : [0, 0, 0]; pos.set(a, i * 3); dr.set(d, i * 3); ph[i] = Math.random(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('drift', new THREE.BufferAttribute(dr, 3)); geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { time: U.time, pr: U.pr, size: { value: o.size || 3 }, spread: { value: o.spread || 1 }, rise: { value: o.rise || 0 }, life: { value: o.life || 3 }, alpha: { value: o.alpha == null ? 1 : o.alpha }, boost: { value: o.boost || 2 }, color: { value: new THREE.Color(...(o.color || [1, .7, .35])) }, hot: { value: new THREE.Color(...(o.hot || [1, .95, .8])) } },
    vertexShader: PTS_VS, fragmentShader: PTS_FS, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  return pts;
}
/* a sigil forged from light: { group, set(k): fragments converge, write(f), alpha(a), glow(g), burst() } */
export function sigil(i, size = .6, o = {}) {
  const group = new THREE.Group(), parts = shape(i), meshes = [], all = [];
  parts.forEach((p, j) => {
    const pc = primCurve(p, size), closed = !!p.c;
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(pc.curve, Math.max(12, pc.n * 2), size * (o.thick || .011), 6, closed), tubeMat(o.glow || 1.45, j * .37));
    const frag = new THREE.Group(); frag.add(mesh); group.add(frag);
    frag.userData.off = new THREE.Vector3((Math.random() - .5) * size * 2.4, (Math.random() - .5) * size * 2.8, (Math.random() - .5) * size * 1.5);
    frag.userData.rot = (Math.random() - .5) * 2.6;
    meshes.push(mesh); pc.pts.forEach(q => all.push(q));
  });
  if (o.sparks !== false) {
    const sp = particles({ count: o.sparkCount || 90, at: () => { const q = all[Math.floor(Math.random() * all.length)]; return [q.x, q.y, q.z]; }, drift: () => [(Math.random() - .5) * .3, Math.random() * .4 + .1, (Math.random() - .5) * .3], spread: size * .5, size: o.sparkSize || 2.2, life: 2.6, boost: 1.4, alpha: .8 });
    group.add(sp); group.userData.sparks = sp;
  }
  const api = {
    group, meshes,
    set(k) { group.children.forEach(f => { if (!f.userData.off) return; const t = 1 - k; f.position.copy(f.userData.off).multiplyScalar(t); f.rotation.z = f.userData.rot * t; }); },
    write(f) { const n = meshes.length; meshes.forEach((m, j) => { m.material.uniforms.progress.value = clamp(f * n - j, 0, 1); m.visible = f * n - j > 0; }); },
    alpha(a) { meshes.forEach(m => { m.material.uniforms.alpha.value = a; }); if (group.userData.sparks) group.userData.sparks.material.uniforms.alpha.value = a * .9; },
    glow(gv) { meshes.forEach(m => { m.material.uniforms.glow.value = gv; }); },
    tint(r, gg, b) { meshes.forEach(m => m.material.uniforms.color.value.setRGB(r, gg, b)); },
    burst(n = 120) { const b = particles({ count: n, at: () => { const q = all[Math.floor(Math.random() * all.length)]; return [q.x, q.y, q.z]; }, drift: () => { const v = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); return [v.x, v.y, v.z]; }, spread: size * 1.8, size: 3.2, life: 1.6, boost: 3 }); b.userData.born = performance.now(); group.add(b); setTimeout(() => { group.remove(b); b.geometry.dispose(); b.material.dispose(); }, 1500); }
  };
  if (o.write != null) api.write(o.write);
  return api;
}
/* an ornate doorway of light: arch, inner arch, threshold, the door's mark above; it can open and pour light */
export function doorway(h = 2.1) {
  const group = new THREE.Group(), w = h * .5, mats = [];
  const tube = (pts, r = .012, closed = false) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'centripetal'), pts.length * 3, h * r, 6, closed), tubeMat(1.5, Math.random())); mats.push(m.material); group.add(m); return m; };
  const arch = (ww, hh, y0 = 0) => { const pts = []; pts.push(new THREE.Vector3(-ww / 2, y0, 0)); pts.push(new THREE.Vector3(-ww / 2, y0 + hh - ww / 2, 0)); for (let i = 1; i < 16; i++) { const a = Math.PI - i / 16 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * ww / 2, y0 + hh - ww / 2 + Math.sin(a) * ww / 2, 0)); } pts.push(new THREE.Vector3(ww / 2, y0 + hh - ww / 2, 0)); pts.push(new THREE.Vector3(ww / 2, y0, 0)); return pts; };
  tube(arch(w, h), .011); tube(arch(w * .82, h * .93), .006);
  tube([new THREE.Vector3(-w * .72, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(w * .72, 0, 0)], .008);
  const crest = sigil(0, w * .42, { sparks: false, glow: 1.5 }); crest.group.position.set(0, h + w * .26, 0); group.add(crest.group);
  const rays = new THREE.Mesh(new THREE.PlaneGeometry(w * .8, h * .92), new THREE.ShaderMaterial({ uniforms: { time: U.time, alpha: { value: 0 } }, vertexShader: MESH_VS, fragmentShader: RAYS_FS, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  rays.position.set(0, h * .46, -.01); group.add(rays);
  const dust = particles({ count: 140, at: () => [(Math.random() - .5) * w * .8, Math.random() * h * .9, 0], drift: () => [(Math.random() - .5) * .2, (Math.random() - .5) * .2, .6 + Math.random()], spread: 1.4, size: 2.2, life: 4, alpha: 0, boost: 2.4 });
  group.add(dust);
  group.up.set(0, 0, 1);
  return {
    group,
    alpha(a) { mats.forEach(m => { m.uniforms.alpha.value = a; }); crest.alpha(a); },
    write(f) { mats.forEach(m => { m.uniforms.progress.value = f; }); crest.write(f); },
    open(f) { rays.material.uniforms.alpha.value = f; dust.material.uniforms.alpha.value = f; }
  };
}
let maskTex = null;
function figureMask() {                       // a soft silhouette, used as the shape the smoke fills
  if (maskTex) return maskTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 360; const x = c.getContext('2d');
  x.shadowColor = '#fff'; x.shadowBlur = 10; x.shadowOffsetX = 1000; x.fillStyle = '#fff'; x.translate(-1000, 0);
  x.beginPath(); x.ellipse(66, 52, 19, 25, .16, 0, TAU); x.fill();
  x.beginPath(); x.moveTo(56, 74); x.quadraticCurveTo(22, 88, 20, 124); x.lineTo(26, 240); x.lineTo(36, 352); x.lineTo(92, 352); x.lineTo(102, 240); x.lineTo(108, 124); x.quadraticCurveTo(106, 88, 76, 74); x.closePath(); x.fill();
  maskTex = new THREE.CanvasTexture(c); return maskTex;
}
/* the thing that stands in the room: smoke shaped like someone, two points of light where eyes would be */
export function figure(height = 1.75) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ uniforms: { time: U.time, tMask: { value: figureMask() }, alpha: { value: 0 }, dissolve: { value: 0 }, seed: { value: Math.random() * 10 } }, vertexShader: MESH_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const body = new THREE.Mesh(new THREE.PlaneGeometry(height * .42, height * 1.2), mat); body.position.y = 0; group.add(body);
  const eyeMat = new THREE.ShaderMaterial({ uniforms: { color: { value: new THREE.Color(2.6, 1.1, .7) }, alpha: { value: 0 }, time: U.time, flick: { value: 1 } }, vertexShader: MESH_VS, fragmentShader: GLOW_FS, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.PlaneGeometry(height * .05, height * .05), eyeMat); e.position.set(s * height * .03, height * .43, .01); group.add(e); });
  const api = {
    group, billboard: true, mat, eyeMat, h: height,
    alpha(a) { mat.uniforms.alpha.value = a; eyeMat.uniforms.alpha.value = a * .8; },
    dissolve(d) { mat.uniforms.dissolve.value = d; },
    at(az, el, dist) { placeAt(group, az, el, dist); group.userData.dist = dist; return api; }
  };
  return api;
}
/* the thing that hunts the ember, on the glass (screen scene, pixels) */
export function blob(size = 70) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({ uniforms: { time: U.time, alpha: { value: 0 }, seed: { value: Math.random() * 10 } }, vertexShader: MESH_VS, fragmentShader: BLOB_FS, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
  return { group: mesh, alpha(a) { mesh.material.uniforms.alpha.value = a; }, at(x, y) { mesh.position.copy(px(x, y)); } };
}
/* an eye, on the glass */
export function eye(w = 300) {
  const mat = new THREE.ShaderMaterial({ uniforms: { time: U.time, open: { value: 0 }, dilate: { value: .3 }, anger: { value: 0 }, alpha: { value: 0 }, look: { value: new THREE.Vector2() } }, vertexShader: MESH_VS, fragmentShader: EYE_FS, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * .56), mat);
  return { group: mesh, u: mat.uniforms, at(x, y) { mesh.position.copy(px(x, y)); return this; } };
}
/* a glow: embers, the wisp, the eyes of things; on either layer */
export function glow(size, rgb = [2.4, 1.5, .7], flick = .4) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({ uniforms: { color: { value: new THREE.Color(...rgb) }, alpha: { value: 1 }, time: U.time, flick: { value: flick } }, vertexShader: MESH_VS, fragmentShader: GLOW_FS, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  return { group: mesh, billboard: true, u: mesh.material.uniforms, alpha(a) { mesh.material.uniforms.alpha.value = a; } };
}
/* the ember you guide through the maze: a hot core, a halo, and flames licking upward (screen layer) */
export function ember(r = 10) {
  const group = new THREE.Group();
  const halo = glow(r * 7, [1.6, .9, .4], .3), core = glow(r * 2.4, [3.2, 2.4, 1.6], .1);
  group.add(halo.group, core.group);
  const fl = particles({ count: 60, at: () => [(Math.random() - .5) * r, (Math.random() - .5) * r, 0], drift: () => [(Math.random() - .5) * .6, 1, 0], spread: r * 2.6, size: r * .7, life: .9, boost: 2.6, color: [1, .5, .15], hot: [1, .9, .6] });
  fl.material.uniforms.rise.value = 0; group.add(fl);
  return { group, at(x, y) { group.position.copy(px(x, y)); } };
}
/* words or numbers on a little card of light, for either layer */
export function label(text, o = {}) {
  const size = o.size || 64, font = o.font || 'italic 500 ' + size + 'px "Cormorant Garamond", Georgia, serif';
  const c = document.createElement('canvas'), x = c.getContext('2d'); x.font = font;
  const w = Math.ceil(x.measureText(text).width + size * .8), h = Math.ceil(size * 1.6); c.width = w; c.height = h;
  const halo = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * .55); halo.addColorStop(0, 'rgba(0,0,0,.62)'); halo.addColorStop(1, 'rgba(0,0,0,0)');   // a dark aura so gold reads on bright walls
  x.fillStyle = halo; x.fillRect(0, 0, w, h);
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = o.color || '#F6D394'; x.shadowColor = 'rgba(255,200,120,.9)'; x.shadowBlur = size * .25; x.fillText(text, w / 2, h / 2); x.shadowBlur = 0; x.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.premultiplyAlpha = true;
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, color: new THREE.Color(...(o.rgb || [2, 2, 2])) });
  const scale = o.worldHeight ? o.worldHeight / h : 1;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * scale, h * scale), mat);
  return { group: mesh, billboard: !!o.worldHeight, alpha(a) { mat.opacity = a; mat.color.setScalar((o.rgb ? o.rgb[0] : 2) * a); } };
}
/* dust hanging in your room: thousands of motes in the world, so the AR has depth */
const motes = particles({ count: 700, at: () => { const v = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar(1.2 + Math.random() * 4.5); return [v.x, v.y, v.z]; }, drift: () => [(Math.random() - .5) * .3, (Math.random() - .5) * .3, .1 + Math.random() * .2], spread: 1, size: 1.6, life: 14, alpha: .55, boost: 1.2, color: [1, .82, .6], hot: [1, .9, .75] });
motes.userData.keep = true; world.add(motes);

/* ===================================================================== */
/* THE GLASS: effects anyone can call                                     */
/* ===================================================================== */
let faceTex = null, crackTex = null, clearCanvas = null, clearTex = null;
function makeFaceTex() {                      // pale, too long, eyes and mouth like holes
  const c = document.createElement('canvas'); c.width = 300; c.height = 400; const x = c.getContext('2d');
  const hg = x.createRadialGradient(150, 175, 10, 150, 200, 175); hg.addColorStop(0, 'rgba(214, 204, 188, 1)'); hg.addColorStop(.6, 'rgba(110, 100, 90, .6)'); hg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  x.fillStyle = hg; x.beginPath(); x.ellipse(150, 200, 108, 170, 0, 0, TAU); x.fill();
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000';
  x.beginPath(); x.ellipse(104, 168, 24, 36, .3, 0, TAU); x.fill(); x.beginPath(); x.ellipse(196, 168, 24, 36, -.3, 0, TAU); x.fill(); x.beginPath(); x.ellipse(150, 292, 20, 58, 0, 0, TAU); x.fill();
  x.globalCompositeOperation = 'source-over';
  const d = x.getImageData(0, 0, 300, 400); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - .5) * 70; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
  x.putImageData(d, 0, 0); return new THREE.CanvasTexture(c);
}
function makeCrackTex() {                     // a broken pane: thin radial fractures, rings around the impact; rg = bend, a = the crack
  const s = 512, c = document.createElement('canvas'); c.width = s; c.height = Math.round(s * C.H / C.W); const x = c.getContext('2d');
  x.fillStyle = 'rgb(128,128,0)'; x.fillRect(0, 0, c.width, c.height);
  const cx = c.width * (.38 + Math.random() * .24), cy = c.height * (.4 + Math.random() * .2), seg = (a, x0, y0, x1, y1, wdt) => { x.strokeStyle = 'rgb(' + Math.round(128 + Math.cos(a + 1.57) * 100) + ',' + Math.round(128 + Math.sin(a + 1.57) * 100) + ',0)'; x.lineWidth = wdt; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  const n = 11 + Math.floor(Math.random() * 5), rays = [];
  for (let i = 0; i < n; i++) {
    let a = i / n * TAU + (Math.random() - .5) * .35, px0 = cx, py0 = cy; const len = s * (.25 + Math.random() * .65), pts = [[px0, py0]];
    for (let k = 1; k <= 10; k++) { a += (Math.random() - .5) * .14; const nx = px0 + Math.cos(a) * len / 10, ny = py0 + Math.sin(a) * len / 10; seg(a, px0, py0, nx, ny, k < 3 ? 1.6 : 1.1); pts.push([nx, ny]); px0 = nx; py0 = ny;
      if (Math.random() < .12) { let b = a + (Math.random() < .5 ? -1 : 1) * (.5 + Math.random() * .5), bx = px0, by = py0; for (let m = 0; m < 4; m++) { const qx = bx + Math.cos(b) * len / 22, qy = by + Math.sin(b) * len / 22; seg(b, bx, by, qx, qy, .8); bx = qx; by = qy; b += (Math.random() - .5) * .3; } } }
    rays.push(pts);
  }
  for (let r = 1; r <= 4; r++) for (let i = 0; i < n; i++) {   // ring fragments between neighbouring fractures
    if (Math.random() < .45) continue; const a = rays[i], b = rays[(i + 1) % n], k = Math.min(10, r * 2), p = a[k], q = b[k]; if (!p || !q) continue;
    seg(Math.atan2(q[1] - p[1], q[0] - p[0]) - 1.57, p[0], p[1], q[0], q[1], .9);
  }
  const d = x.getImageData(0, 0, c.width, c.height); for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = (Math.abs(d.data[i] - 128) + Math.abs(d.data[i + 1] - 128) > 24) ? 255 : 0; x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.premultiplyAlpha = false; return t;
}
export const glass = {
  glitch(ms = 240) { finalU.glitch.value = 1; tween(finalU.glitch, 'value', 0, ms); audio.glitch(.05); },
  scare(ms = 420) { if (!faceTex) { faceTex = makeFaceTex(); finalU.tFace.value = faceTex; } finalU.scare.value = 1; tween(finalU.scare, 'value', 0, ms); finalU.glitch.value = .8; tween(finalU.glitch, 'value', 0, ms * 1.4); audio.shriek(); buzz([90, 40, 140]); },
  flash(rgb = [1, .9, .7], ms = 700, peak = .85) { finalU.flashCol.value.setRGB(...rgb); finalU.flash.value = peak; tween(finalU.flash, 'value', 0, ms); },
  fade(to, ms = 800) { tween(finalU.fade, 'value', to, ms); },
  crack(on = true) { if (on) { crackTex = makeCrackTex(); finalU.tCrack.value = crackTex; finalU.crack.value = 1; tween(finalU.crack, 'value', .7, 900); } else tween(finalU.crack, 'value', 0, 600); },
  frost(level, ms = 900) { if (!clearCanvas) { clearCanvas = document.createElement('canvas'); clearCanvas.width = 64; clearCanvas.height = 128; clearTex = new THREE.CanvasTexture(clearCanvas); finalU.tClear.value = clearTex; } if (level > finalU.frost.value) { const x = clearCanvas.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 128); clearTex.needsUpdate = true; } tween(finalU.frost, 'value', level, ms); },
  clearAt(fx0, fy0, r = .25, a = .2) { if (!clearCanvas) return; const x = clearCanvas.getContext('2d'), gr = x.createRadialGradient(fx0 * 64, fy0 * 128, 0, fx0 * 64, fy0 * 128, r * 64); gr.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 128); clearTex.needsUpdate = true; },
  ripple(x, y, s, ms = 600) { finalU.ripple.value.x = x; finalU.ripple.value.y = 1 - y; tween(finalU.ripple.value, 'z', s, ms); },
  dread(level, ms = 1500) { tween(bgU.dread, 'value', level, ms); },
  water(level, ms = 2000) { tween(bgU.water, 'value', level, ms); },
  exposure(v, ms = 1200) { tween(bgU.exposure, 'value', v, ms); }
};
export const bgUniforms = bgU;

/* ===================================================================== */
/* THE MAZE'S WALLS, THE LATE REFLECTION                                  */
/* ===================================================================== */
let wallsTex = null;
export function mazeWalls(block, gw, gh) {   // where the ember collides, as a soft glow texture (rows flipped for GL)
  const data = new Uint8Array(gw * gh * 4);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const v = block[y * gw + x] ? 255 : 0, i = ((gh - 1 - y) * gw + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255; }
  if (wallsTex) wallsTex.dispose();
  wallsTex = new THREE.DataTexture(data, gw, gh); wallsTex.magFilter = wallsTex.minFilter = THREE.LinearFilter; wallsTex.needsUpdate = true; bgU.tWalls.value = wallsTex;
}
export function mazeView(o) {                // { on, lantern: [x, y] (CSS px), r (fraction of width), scan (0..1+) }
  if (o.on != null) tween(bgU.maze, 'value', o.on ? 1 : 0, 700);
  if (o.lantern) bgU.lantern.value.set(o.lantern[0] / C.W, 1 - o.lantern[1] / C.H);
  if (o.r != null) bgU.lanternR.value = o.r;
  if (o.scan != null) bgU.scan.value = o.scan;
  if (o.gain != null) bgU.edgeGain.value = o.gain;
}
let ghostTex = null;
export function ghostLayer(canvasEl, o = {}) {   // the late reflection (door V): another canvas laid over the live view
  if (canvasEl) { if (!ghostTex || ghostTex.image !== canvasEl) { ghostTex = new THREE.CanvasTexture(canvasEl); bgU.tGhost.value = ghostTex; } ghostTex.needsUpdate = true; }
  if (o.on != null) tween(bgU.useGhost, 'value', o.on ? 1 : 0, 900);
  if (o.alpha != null) tween(bgU.ghostAlpha, 'value', o.alpha, o.ms || 1200);
  if (o.zoom != null) tween(bgU.ghostZoom, 'value', o.zoom, o.ms || 600);
  if (o.off) bgU.ghostOff.value.set(o.off[0], o.off[1]);
}

/* ===================================================================== */
/* THE FRAME                                                              */
/* ===================================================================== */
let camTex = null, camTexFor = null, stillTex = null, stillStamp = 0, roomTex = null;
const _m = new THREE.Matrix4(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _b = new THREE.Vector3(), _v = new THREE.Vector3();
export let menu = true;                         // splash and screens: the void, no camera
export function setMenu(on) { menu = on; bgU.voidMode.value = on ? 1 : 0; }
function source() {
  if (menu) return;
  const el = C.camOK ? C.cam : C.room; if (!el) return;
  if (C.camOK) { if (!camTex || camTexFor !== C.cam) { camTex = new THREE.VideoTexture(C.cam); camTex.minFilter = THREE.LinearFilter; camTex.generateMipmaps = false; camTexFor = C.cam; } bgU.tCam.value = camTex; }
  else if (C.room) { if (!roomTex) { roomTex = new THREE.Texture(C.room); roomTex.minFilter = THREE.LinearFilter; roomTex.needsUpdate = true; } bgU.tCam.value = roomTex; }
  const sw = C.camOK ? C.cam.videoWidth : C.room.naturalWidth, sh = C.camOK ? C.cam.videoHeight : C.room.naturalHeight, r = C.coverRect();
  if (r && sw) { bgU.camScale.value.set(r[2] / sw, r[3] / sh); bgU.camOff.value.set(r[0] / sw, (sh - r[1] - r[3]) / sh); }
  bgU.mirror.value = C.mirrored() ? 1 : 0;
  if (C.still.stamp && C.still.stamp !== stillStamp) { stillStamp = C.still.stamp; if (!stillTex || stillTex.image !== C.still) stillTex = new THREE.CanvasTexture(C.still); stillTex.needsUpdate = true; bgU.tStill.value = stillTex; bgU.stillTexel.value.set(1 / C.still.width, 1 / C.still.height); }
  bgU.useStill.value += ((C.frozen ? 1 : 0) - bgU.useStill.value) * .15;
}
const billboards = [];
export function render(now, dt) {
  U.time.value = now / 1000;
  runTweens(now);
  frameMs += (dt * 1000 - frameMs) * .05;      // drop resolution a step if frames stay slow
  if (!AUTO && !menu && frameMs > 27 && quality < QUALITY.length - 1) { slowFor += dt; if (slowFor > 2.5) { quality++; slowFor = 0; frameMs = 16; resize(); } } else slowFor = Math.max(0, slowFor - dt * .5);
  if (menu) { _r.set(1, 0, 0); _u.set(0, 0, 1); _b.set(0, -1, 0); }
  else { const B = basis(); _r.set(...B.right); _u.set(...B.up); _b.set(-B.fwd[0], -B.fwd[1], -B.fwd[2]); }
  _m.makeBasis(_r, _u, _b); camera3.quaternion.setFromRotationMatrix(_m); camera3.position.set(0, 0, 0); camera3.updateMatrixWorld();
  source();
  let hz = null, hd = 1e9;
  world.traverse(o => {
    if (o.userData.billboard) o.quaternion.copy(camera3.quaternion);
    if (o.userData.hazy && o.visible) { _v.copy(o.getWorldPosition(_v)).project(camera3); if (_v.z < 1 && Math.abs(_v.x) < 1.3 && Math.abs(_v.y) < 1.3) { const d = o.userData.dist || 3; if (d < hd) { hd = d; hz = [(_v.x + 1) / 2, (_v.y + 1) / 2, .32 / d]; } } }
  });
  if (hz) { bgU.haze.value.set(hz[0], hz[1], hz[2], Math.min(1, bgU.haze.value.w + dt * 2)); } else bgU.haze.value.w = Math.max(0, bgU.haze.value.w - dt * 2);
  live.forEach(o => o.update(now, dt));
  overlayTex.needsUpdate = true;
  composer.render(dt);
  if (captureCb) {                            // a picture of this exact frame (drawn right after rendering, while it's still there)
    const { cb, w } = captureCb; captureCb = null;
    try { const c = document.createElement('canvas'), h = Math.round(w * C.H / C.W); c.width = w; c.height = h; c.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h); cb(c.toDataURL('image/jpeg', .84)); } catch (e) {}
  }
}
let captureCb = null;
export function capture(cb, w = 540) { captureCb = { cb, w }; }
export function billboard(obj) { (obj.group || obj).userData.billboard = true; return obj; }
export function hazy(obj, on = true) { (obj.group || obj).userData.hazy = on; return obj; }
export const THREEjs = THREE;

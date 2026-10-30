// Shared 3D toolkit for the Dribit 3D TikToks. Everything is a pure function of time, so any frame can be rendered alone.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
export { THREE };

// ---------- easing ----------
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lin = (t, a, b) => clamp((t - a) / (b - a));
export const out = x => 1 - Math.pow(1 - x, 3);
export const inout = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const back = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const mix = (a, b, k) => a + (b - a) * k;
export const wave = (t, f, a = 1, ph = 0) => Math.sin((t * f + ph) * Math.PI * 2) * a;
export const pop = (t, a, d = 0.32) => t < a ? 0 : back(lin(t, a, a + d));
export const blinkAt = (t, times) => { for (const x of times) { const d = Math.abs(t - x); if (d < 0.09) return 0.08 + d * 10; } return 1; };
export const talk = (t, a, b, rest = 'smile') => (t >= a && t <= b) ? ['open', 'smile', 'o', 'open'][Math.floor(t * 9) % 4] : rest;
export function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// jump arc: 0..1 progress -> height
export const arc = (k, h) => 4 * h * k * (1 - k);

// ---------- renderer ----------
export const W = 1080, H = 1920;
export let renderer, envTex;
export function initRenderer(host) {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  host.appendChild(renderer.domElement);
  const pm = new THREE.PMREMGenerator(renderer);
  envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  return renderer;
}
export function camera(fov = 32) { return new THREE.PerspectiveCamera(fov, W / H, 0.1, 200); }
export function aim(cam, pos, look) { cam.position.set(...pos); cam.lookAt(new THREE.Vector3(...look)); }
export function aimMix(cam, p0, p1, l0, l1, k) {
  cam.position.set(mix(p0[0], p1[0], k), mix(p0[1], p1[1], k), mix(p0[2], p1[2], k));
  cam.lookAt(mix(l0[0], l1[0], k), mix(l0[1], l1[1], k), mix(l0[2], l1[2], k));
}

// ---------- fonts / text ----------
export let FONT;
export async function loadFont(url) { FONT = new Font(await new TTFLoader().loadAsync(url)); }
export function text3d(str, { size = 1, depth = 0.25, bevel = 0.03, material, rtl = false } = {}) {
  const s = rtl ? [...str].reverse().join('') : str;
  const g = new TextGeometry(s, { font: FONT, size, depth, curveSegments: 8, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.7, bevelSegments: 3 });
  g.computeBoundingBox(); const b = g.boundingBox;
  g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2);
  const m = new THREE.Mesh(g, material); m.castShadow = true; return m;
}

// ---------- materials / meshes ----------
const cache = new Map();
export function mat(color, rough = 0.62, o) {
  const key = o ? null : color + '|' + rough;
  if (key && cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...(o || {}) });
  if (key) cache.set(key, m);
  return m;
}
export const GOLD = () => mat('#f6bf37', 0.24, { metalness: 1 });
export const glow = (color, i = 1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.5 });
export function mesh(geo, m, p = {}) {
  const o = new THREE.Mesh(geo, m); o.castShadow = p.cast !== false; o.receiveShadow = !!p.recv;
  if (p.pos) o.position.set(...p.pos);
  if (p.rot) o.rotation.set(...p.rot);
  if (p.scale != null) typeof p.scale === 'number' ? o.scale.setScalar(p.scale) : o.scale.set(...p.scale);
  return o;
}
export const G = (...kids) => { const g = new THREE.Group(); kids.forEach(k => g.add(k)); return g; };
export const sphere = (r, ws = 32, hs = 20) => new THREE.SphereGeometry(r, ws, hs);
export const capsule = (r, l, rs = 10, cs = 24) => new THREE.CapsuleGeometry(r, l, rs, cs);
export const rbox = (w, h, d, r = 0.05, s = 4) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export const cyl = (rt, rb, h, s = 40) => new THREE.CylinderGeometry(rt, rb, h, s);
export function bendZ(geo, k) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - k * p.getX(i) ** 2); p.needsUpdate = true; geo.computeVertexNormals(); return geo; }
// rounded rectangle plane with 0..1 UVs
export function rrectGeo(w, h, r, seg = 6) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, seg), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return g;
}
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export const loadTex = async url => { const t = await new THREE.TextureLoader().loadAsync(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
// keep an object at a fixed world orientation no matter how its parent (a hand) is rotated
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function faceWorld(obj, rx = 0, ry = 0, rz = 0) {
  obj.parent.updateWorldMatrix(true, false);
  obj.parent.getWorldQuaternion(_q).invert();
  obj.quaternion.copy(_q.multiply(new THREE.Quaternion().setFromEuler(_e.set(rx, ry, rz))));
}
const _p = new THREE.Vector3();
// put a world-level prop at a hand position (+ world offset), with a fixed world rotation
export function holdAt(obj, hand, off = [0, 0, 0], rot) {
  hand.updateWorldMatrix(true, false); hand.getWorldPosition(_p);
  obj.position.set(_p.x + off[0], _p.y + off[1], _p.z + off[2]); if (rot) obj.rotation.set(...rot);
}
const _v = new THREE.Vector3();
export function toScreen(obj, cam, off = [0, 0, 0]) {
  obj.updateWorldMatrix(true, false);
  _v.set(...off); obj.localToWorld(_v); _v.project(cam);
  return { x: (_v.x + 1) / 2 * W, y: (1 - _v.y) / 2 * H };
}
export function worldToScreen(p, cam) { _v.set(...p).project(cam); return { x: (_v.x + 1) / 2 * W, y: (1 - _v.y) / 2 * H }; }

// ---------- scene dressing ----------
export function skyDome(top, bottom, { r = 90, a = 0.38, b = 0.85 } = {}) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) }, a: { value: a }, b: { value: b } },
    vertexShader: 'varying vec3 vP;\nvoid main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform float a; uniform float b; varying vec3 vP;\nvoid main(){ float h = clamp(vP.y * 0.5 + 0.5, 0.0, 1.0);\ngl_FragColor = vec4(mix(bottom, top, smoothstep(a, b, h)), 1.0);\n#include <colorspace_fragment>\n}'
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24), m); s.renderOrder = -1; s.frustumCulled = false; return s;
}
export function lights(scene, o = {}) {
  const { key = '#fff1dc', keyI = 2.4, keyPos = [3, 8, 6], sky = '#cfe3ff', ground = '#6b5a45', hemiI = 0.8, rim = '#a8dcff', rimI = 1.4, rimPos = [-5, 5, -6], env = 0.55, box = 6, target = [0, 1, 0] } = o;
  scene.environment = envTex; scene.environmentIntensity = env;
  scene.add(new THREE.HemisphereLight(sky, ground, hemiI));
  const k = new THREE.DirectionalLight(key, keyI); k.position.set(...keyPos); k.target.position.set(...target);
  k.castShadow = true; k.shadow.mapSize.set(2048, 2048);
  const c = k.shadow.camera; c.left = c.bottom = -box; c.right = c.top = box; c.near = 0.5; c.far = 40;
  k.shadow.bias = -0.0005; k.shadow.normalBias = 0.03; k.shadow.radius = 5;
  scene.add(k, k.target);
  const r = new THREE.DirectionalLight(rim, rimI); r.position.set(...rimPos); scene.add(r);
  return { key: k, rim: r };
}
export function cloud(seed = 1, s = 1) {
  const R = rng(seed), g = G(), m = mat('#ffffff', 0.9);
  for (let i = 0; i < 6; i++) g.add(mesh(sphere(0.5 + R() * 0.45, 24, 16), m, { pos: [(i - 2.5) * 0.55 + R() * 0.2, R() * 0.35 + (i > 1 && i < 4 ? 0.3 : 0), R() * 0.3], cast: false }));
  g.scale.setScalar(s); return g;
}

// ---------- characters ----------
const shade = (hex, k) => { const c = new THREE.Color(hex); c.r *= k; c.g *= k; c.b *= k; return '#' + c.getHexString(); };
let moneyEyeMat;
export function makeChar(o = {}) {
  const C = Object.assign({ skin: '#dba67a', hair: '#2a1c13', hairStyle: 'short', outfit: 'uniform', top: '#5b6a3a', pants: '#4f5c33', boots: '#2a2622', scale: 1 }, o);
  const skin = mat(C.skin, 0.55), skinN = mat(shade(C.skin, 0.9), 0.6), topM = mat(C.top, 0.88), pantsM = mat(C.pants, 0.88), bootM = mat(C.boots, 0.45), hairM = mat(C.hair, 0.72);
  const whiteM = mat('#ffffff', 0.22), pupilM = mat('#1b120c', 0.15), mouthM = mat('#5a1a20', 0.7), tongueM = mat('#ee7e88', 0.6), toothM = mat('#fffdf7', 0.4);
  const blushM = mat('#ff6f6f', 0.9, { transparent: true, opacity: 0.32, depthWrite: false });
  moneyEyeMat ||= new THREE.MeshBasicMaterial({ map: canvasTex(128, 160, (g, w, h) => { g.fillStyle = '#1f9a52'; g.font = '900 130px Rubik'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₪', w / 2, h / 2 + 6); }), transparent: true, depthWrite: false });

  const root = G(), body = G(); root.add(body);
  const hip = G(); hip.position.y = 0.8; body.add(hip);
  const legs = [-1, 1].map(s => {
    const g = G(); g.position.set(0.19 * s, 0.02, 0); hip.add(g);
    g.add(mesh(capsule(0.16, 0.36), pantsM, { pos: [0, -0.33, 0] }));
    g.add(mesh(rbox(0.32, 0.22, 0.46, 0.09), bootM, { pos: [0, -0.7, 0.06] }));
    return g;
  });
  const torso = G(); hip.add(torso);
  torso.add(mesh(capsule(0.42, 0.34, 12, 32), topM, { pos: [0, 0.42, 0], scale: [1, 1, 0.8] }));
  const frontZ = y => 0.8 * Math.sqrt(Math.max(0, 0.1764 - Math.max(0, y - 0.59) ** 2, 0)) + 0.012;
  if (C.outfit === 'uniform') {
    const pk = mat(shade(C.top, 0.86), 0.9);
    [-1, 1].forEach(s => {
      torso.add(mesh(rbox(0.19, 0.16, 0.05, 0.03), pk, { pos: [0.18 * s, 0.5, frontZ(0.5)] }));
      torso.add(mesh(rbox(0.21, 0.06, 0.06, 0.02), pk, { pos: [0.18 * s, 0.6, frontZ(0.6)], rot: [-0.1, 0, 0] }));
    });
    for (let i = 0; i < 3; i++) torso.add(mesh(sphere(0.024, 10, 8), mat('#363d22', 0.5), { pos: [0, 0.62 - i * 0.2, frontZ(0.62 - i * 0.2)] }));
    torso.add(mesh(cyl(0.43, 0.43, 0.1, 48), mat('#2a2820', 0.6), { pos: [0, 0.06, 0], scale: [1, 1, 0.81] }));
    torso.add(mesh(rbox(0.13, 0.09, 0.04, 0.012), mat('#c9a646', 0.3, { metalness: 0.8 }), { pos: [0, 0.06, 0.35] }));
  } else if (C.outfit === 'hoodie') {
    const pk = mat(shade(C.top, 0.88), 0.9);
    torso.add(mesh(rbox(0.46, 0.22, 0.06, 0.05), pk, { pos: [0, 0.22, frontZ(0.22)] }));
    torso.add(mesh(new THREE.TorusGeometry(0.3, 0.1, 12, 32), topM, { pos: [0, 0.98, -0.08], rot: [1.25, 0, 0] }));
    [-1, 1].forEach(s => torso.add(mesh(capsule(0.016, 0.2), mat('#f3efe6', 0.6), { pos: [0.08 * s, 0.68, frontZ(0.68) + 0.02] })));
  } else if (C.outfit === 'tee' && C.print) {
    torso.add(mesh(new THREE.CircleGeometry(0.13, 32), mat(C.print, 0.7), { pos: [0, 0.48, frontZ(0.48) + 0.004], cast: false }));
  }
  const arm = s => {
    const sh = G(); sh.position.set(0.44 * s, 0.82, 0); torso.add(sh);
    const upM = C.outfit === 'tee' ? skin : topM;
    sh.add(mesh(sphere(0.15), topM));
    sh.add(mesh(capsule(0.125, 0.22), upM, { pos: [0, -0.2, 0] }));
    if (C.outfit === 'tee') sh.add(mesh(cyl(0.15, 0.16, 0.2, 24), topM, { pos: [0, -0.08, 0] }));
    const el = G(); el.position.y = -0.38; sh.add(el);
    const foreM = (C.outfit === 'tee' || C.rolled) ? skin : topM;
    el.add(mesh(capsule(0.11, 0.2), foreM, { pos: [0, -0.14, 0] }));
    if (C.rolled) el.add(mesh(cyl(0.135, 0.13, 0.1, 24), topM, { pos: [0, -0.01, 0] }));
    const hand = G(); hand.position.y = -0.34; el.add(hand);
    hand.add(mesh(sphere(0.14, 24, 16), skin, { scale: [1, 1.05, 0.85] }));
    hand.add(mesh(capsule(0.048, 0.07), skin, { pos: [-0.1 * s, 0.04, 0.07], rot: [0, 0, 0.6 * s] }));
    const slot = G(); slot.position.set(0, -0.05, 0.1); hand.add(slot);
    return { sh, el, hand, slot };
  };
  const A = { L: arm(-1), R: arm(1) };

  const head = G(); head.position.y = 1.32; torso.add(head);
  head.add(mesh(cyl(0.14, 0.16, 0.3, 20), skin, { pos: [0, -0.52, 0] }));
  head.add(mesh(sphere(0.56, 48, 32), skin, { scale: [1, 0.96, 0.94] }));
  [-1, 1].forEach(s => head.add(mesh(sphere(0.13, 20, 14), skin, { pos: [0.55 * s, -0.03, -0.02], scale: [0.55, 1, 0.8] })));
  head.add(mesh(sphere(0.07, 20, 14), skinN, { pos: [0, -0.07, 0.53], scale: [1.15, 0.9, 1] }));
  [-1, 1].forEach(s => head.add(mesh(sphere(0.1, 20, 12), blushM, { pos: [0.33 * s, -0.13, 0.4], rot: [0, 0.65 * s, 0], scale: [1, 0.6, 0.25], cast: false })));
  const eyes = [-1, 1].map(s => {
    const g = G(); g.position.set(0.2 * s, 0.05, 0.455); g.rotation.y = 0.34 * s; head.add(g);
    g.add(mesh(sphere(0.125, 28, 18), whiteM, { scale: [0.82, 1.08, 0.55], cast: false }));
    const pupil = G(); g.add(pupil);
    pupil.add(mesh(sphere(0.072, 20, 14), pupilM, { pos: [0, 0, 0.046], scale: [1, 1.12, 0.5], cast: false }));
    pupil.add(mesh(sphere(0.023, 10, 8), whiteM, { pos: [0.026, 0.036, 0.082], cast: false }));
    const money = mesh(new THREE.PlaneGeometry(0.15, 0.19), moneyEyeMat, { pos: [0, 0, 0.072], cast: false }); money.visible = false; g.add(money);
    return { g, pupil, money };
  });
  const brows = [-1, 1].map(s => { const b = mesh(capsule(0.03, 0.11, 6, 12), mat(C.hair, 0.8), { pos: [0.2 * s, 0.25, 0.445], cast: false }); head.add(b); return b; });
  const mouth = G(); mouth.position.set(0, -0.215, 0.488); head.add(mouth);
  const M = {};
  M.smile = mesh(bendZ(new THREE.TorusGeometry(0.105, 0.024, 8, 28, Math.PI), 1.1), mouthM, { rot: [0, 0, Math.PI], cast: false });
  M.open = G(mesh(bendZ(new THREE.CircleGeometry(0.135, 32, Math.PI, Math.PI), 1.1), mouthM, { cast: false }),
    mesh(bendZ(new THREE.CircleGeometry(0.075, 20, Math.PI, Math.PI), 1.1), tongueM, { pos: [0, -0.055, 0.004], scale: [1, 0.65, 1], cast: false }),
    mesh(bendZ(new THREE.PlaneGeometry(0.21, 0.035, 8, 1), 1.1), toothM, { pos: [0, -0.019, 0.003], cast: false }));
  M.o = G(mesh(new THREE.CircleGeometry(0.06, 24), mouthM, { pos: [0, -0.02, 0], scale: [1, 1.25, 1], cast: false }));
  M.frown = mesh(bendZ(new THREE.TorusGeometry(0.09, 0.022, 8, 24, Math.PI), 1.1), mouthM, { pos: [0, -0.06, 0], cast: false });
  M.flat = mesh(capsule(0.02, 0.12, 4, 10), mouthM, { rot: [0, 0, Math.PI / 2], cast: false });
  Object.values(M).forEach(m => mouth.add(m));
  const sweat = G(mesh(sphere(0.06, 16, 12), mat('#8fd3ff', 0.1, { transparent: true, opacity: 0.85 }), { scale: [1, 1.3, 0.8], cast: false }),
    mesh(new THREE.ConeGeometry(0.052, 0.09, 16), mat('#8fd3ff', 0.1, { transparent: true, opacity: 0.85 }), { pos: [0, 0.09, 0], cast: false }));
  sweat.position.set(0.44, 0.28, 0.3); head.add(sweat);

  const hair = G(); head.add(hair);
  const cap = (th, tilt, r = 0.585) => mesh(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, th), hairM, { rot: [-tilt, 0, 0], scale: [1, 0.97, 0.96] });
  if (C.hairStyle === 'short') {
    hair.add(cap(1.3, 0.42));
    for (let i = -2; i <= 2; i++) hair.add(mesh(sphere(0.13, 16, 12), hairM, { pos: [i * 0.12, 0.4 - Math.abs(i) * 0.035, 0.36 - Math.abs(i) * 0.05], rot: [0.4, 0, -i * 0.25], scale: [1.15, 0.6, 0.9] }));
  } else if (C.hairStyle === 'buzz') {
    hair.add(cap(1.2, 0.45, 0.572));
  } else if (C.hairStyle === 'curly') {
    hair.add(cap(1.28, 0.4, 0.6));
    const R = rng(7);
    for (let i = 0; i < 22; i++) { const a = R() * Math.PI * 2, b = 0.15 + R() * 0.95; const v = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)).applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.4); if (v.z > 0.55 && v.y < 0.75) continue; hair.add(mesh(sphere(0.16, 16, 12), hairM, { pos: [v.x * 0.6, v.y * 0.6, v.z * 0.58] })); }
  } else if (C.hairStyle === 'bun' || C.hairStyle === 'long') {
    hair.add(cap(1.42, 0.3, 0.59));
    if (C.hairStyle === 'bun') hair.add(mesh(sphere(0.22, 24, 16), hairM, { pos: [0, 0.42, -0.42] }));
    else { hair.add(mesh(capsule(0.42, 0.45, 10, 24), hairM, { pos: [0, -0.35, -0.2], scale: [1.15, 1, 0.55] })); }
    [-1, 1].forEach(s => hair.add(mesh(capsule(0.1, 0.32, 8, 12), hairM, { pos: [0.52 * s, -0.12, 0.1], rot: [0.1, 0, 0.12 * s] })));
  }

  const setArm = (a, s, q) => { a.sh.rotation.set(-(q.fwd || 0), (q.twist || 0) * s, s * (0.13 + (q.raise || 0))); a.el.rotation.set(-(q.bend || 0), 0, 0); };
  const api = {
    root, body, hip, torso, head, A, eyes, slots: { L: A.L.slot, R: A.R.slot }, C,
    place(x, y, z, ry = 0, sc = 1) { root.position.set(x, y, z); root.rotation.y = ry; root.scale.setScalar(sc * C.scale); return api; },
    pose(p = {}) {
      const sq = p.squash || 0;
      body.position.y = p.bob || 0; body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      torso.rotation.set(p.lean || 0, p.turn || 0, p.tilt || 0);
      head.rotation.set(p.nod || 0, p.headY || 0, p.headZ || 0);
      setArm(A.L, -1, p.armL || {}); setArm(A.R, 1, p.armR || {});
      const lg = p.legs || [0, 0]; legs[0].rotation.x = lg[0]; legs[1].rotation.x = lg[1];
      const bl = p.blink ?? 1;
      eyes.forEach(e => { e.g.scale.set(1, clamp(bl, 0.06, 1.2) * (p.eyeScale || 1), 1); e.pupil.position.set((p.look || 0) * 0.04, (p.lookY || 0) * 0.035, 0); e.pupil.visible = !p.money; e.money.visible = !!p.money; });
      const bt = p.brows || 0;
      brows.forEach((b, i) => { const s = i ? 1 : -1; b.position.y = 0.25 + (p.browY || 0) * 0.05; b.rotation.set(0, 0.32 * s, Math.PI / 2 - bt * 0.35 * s); });
      const m = p.mouth || 'smile';
      Object.entries(M).forEach(([k, v]) => v.visible = k === m);
      if (m === 'open') M.open.scale.set(1, p.mouthOpen || 1, 1);
      sweat.visible = !!p.sweat;
      if (p.sweat) sweat.position.y = 0.3 - ((p.sweatT || 0) % 1) * 0.12;
      return api;
    }
  };
  api.pose();
  return api;
}

// ---------- props ----------
export function makePhone(tex, { glowScreen = true } = {}) {
  const g = G();
  g.add(mesh(rbox(0.38, 0.77, 0.05, 0.06), mat('#16191d', 0.3, { metalness: 0.4 })));
  const sm = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const scr = mesh(rrectGeo(0.34, 0.735, 0.045), sm, { pos: [0, 0, 0.0262], cast: false }); g.add(scr);
  g.add(mesh(rbox(0.1, 0.022, 0.01, 0.01), mat('#000000', 0.4), { pos: [0, 0.345, 0.03], cast: false }));
  g.screen = scr; return g;
}
const coinCache = {};
export function makeCoin(cur = '₪', r = 0.2) {
  if (!coinCache[cur]) {
    const face = canvasTex(256, 256, (g, w, h) => {
      const gr = g.createRadialGradient(w * 0.4, h * 0.35, 10, w / 2, h / 2, w * 0.55); gr.addColorStop(0, '#fff0a8'); gr.addColorStop(0.55, '#f7c43a'); gr.addColorStop(1, '#d99a17');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#b97d0c'; g.lineWidth = 12; g.beginPath(); g.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2); g.stroke();
      g.font = '900 150px Rubik'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#fff3b8'; g.fillText(cur, w / 2 + 4, h / 2 + 12);
      g.fillStyle = '#b07508'; g.fillText(cur, w / 2, h / 2 + 8);
    });
    face.center.set(0.5, 0.5); face.rotation = Math.PI / 2;
    const fm = new THREE.MeshStandardMaterial({ map: face, metalness: 0.85, roughness: 0.32 });
    coinCache[cur] = [mat('#e6ac2c', 0.3, { metalness: 1 }), fm, fm];
  }
  const m = new THREE.Mesh(cyl(r, r, r * 0.24, 48), coinCache[cur]); m.castShadow = true;
  const g = G(m); m.rotation.x = Math.PI / 2; return g;   // face looks down +z
}
const billCache = {};
export function makeBill(kind = 'ils200', w = 0.7) {
  if (!billCache[kind]) {
    const P = { ils200: ['#9cc7e6', '#d9ecf7', '#245f8c', '200', '₪'], ils100: ['#f3c070', '#fbe6bf', '#a2560e', '100', '₪'], usd: ['#b9d6a6', '#e6f0dc', '#2d5a2a', '100', '$'] }[kind];
    billCache[kind] = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.75, map: canvasTex(512, 256, (g, W_, H_) => {
      const gr = g.createLinearGradient(0, 0, W_, H_); gr.addColorStop(0, P[0]); gr.addColorStop(0.5, P[1]); gr.addColorStop(1, P[0]);
      g.fillStyle = gr; g.fillRect(0, 0, W_, H_);
      g.strokeStyle = P[2]; g.lineWidth = 10; g.strokeRect(12, 12, W_ - 24, H_ - 24);
      g.globalAlpha = 0.18; g.lineWidth = 3; for (let i = 0; i < 9; i++) { g.beginPath(); for (let x = 0; x <= W_; x += 8) g.lineTo(x, 40 + i * 22 + Math.sin(x / 30 + i) * 8); g.stroke(); }
      g.globalAlpha = 1;
      g.beginPath(); g.arc(W_ * 0.7, H_ / 2, 74, 0, Math.PI * 2); g.fillStyle = P[1]; g.fill(); g.lineWidth = 8; g.stroke();
      g.fillStyle = P[2]; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 120px Rubik'; g.fillText(P[4], W_ * 0.7, H_ / 2 + 8);
      g.font = '900 96px Rubik'; g.fillText(P[3], W_ * 0.27, H_ / 2 + 6);
    }) });
  }
  const geo = new THREE.PlaneGeometry(w, w / 2, 16, 2), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.035 * Math.sin(p.getX(i) / w * Math.PI * 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, billCache[kind]); m.castShadow = true; return m;
}
export function makeFlame(s = 1) {
  const prof = k => { const pts = []; for (let i = 0; i <= 28; i++) { const u = i / 28; pts.push(new THREE.Vector2(0.55 * k * Math.sin(Math.PI * Math.pow(u, 0.55)) * (1 - 0.25 * u), u * 1.5 * k)); } return pts; };
  const fm = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const g = G(mesh(new THREE.LatheGeometry(prof(1), 40), fm('#ff5a0a'), { cast: false }),
    mesh(new THREE.LatheGeometry(prof(0.5), 24), fm('#ff5a0a'), { pos: [-0.46, 0.02, -0.05], rot: [0, 0, 0.42], cast: false }),
    mesh(new THREE.LatheGeometry(prof(0.5), 24), fm('#ff5a0a'), { pos: [0.46, 0.02, -0.05], rot: [0, 0, -0.42], cast: false }),
    mesh(new THREE.LatheGeometry(prof(0.74), 32), fm('#ff9a1f'), { pos: [0, 0.02, 0.16], cast: false }),
    mesh(new THREE.LatheGeometry(prof(0.42), 24), fm('#ffd23a'), { pos: [0, 0.02, 0.3], cast: false }));
  g.scale.setScalar(s); return g;
}
export function makePlatform(top = '#3ddc97', side = '#1f8f63', r = 0.95) {
  const g = G(mesh(cyl(r, r * 0.92, 0.32, 48), mat(side, 0.7), { recv: true }),
    mesh(cyl(r * 0.96, r * 0.96, 0.05, 48), mat(top, 0.6), { pos: [0, 0.17, 0], recv: true }),
    mesh(new THREE.ConeGeometry(r * 0.75, 0.9, 7), mat('#8a6a48', 0.9), { pos: [0, -0.6, 0], rot: [Math.PI, 0, 0] }));
  return g;
}
export function makeCheck(m) {
  return G(mesh(capsule(0.07, 0.18), m, { pos: [-0.1, -0.02, 0], rot: [0, 0, 0.8] }), mesh(capsule(0.07, 0.42), m, { pos: [0.12, 0.1, 0], rot: [0, 0, -0.6] }));
}
export function makeChest() {
  const wood = mat('#9a5f2e', 0.7), woodD = mat('#7a4520', 0.75, { side: THREE.DoubleSide }), gold = GOLD(), goldD = mat('#f6bf37', 0.24, { metalness: 1, side: THREE.DoubleSide });
  const g = G(mesh(rbox(1.2, 0.62, 0.78, 0.06), wood, { pos: [0, 0.31, 0] }));
  [-0.42, 0.42].forEach(x => g.add(mesh(rbox(0.12, 0.64, 0.8, 0.03), gold, { pos: [x, 0.31, 0] })));
  const lidPivot = G(); lidPivot.position.set(0, 0.62, -0.39); g.add(lidPivot);
  const lid = G(mesh(new THREE.CylinderGeometry(0.39, 0.39, 1.2, 32, 1, false, 0, Math.PI), woodD, { rot: [0, 0, Math.PI / 2] }));
  lid.position.set(0, 0, 0.39); lidPivot.add(lid);
  // flat board under the dome, so the open lid reads as a solid lid from any angle
  lid.add(mesh(rbox(1.2, 0.03, 0.78, 0.01), woodD, { pos: [0, -0.015, 0] }));
  [-0.42, 0.42].forEach(x => lid.add(mesh(new THREE.CylinderGeometry(0.405, 0.405, 0.12, 32, 1, true, 0, Math.PI), goldD, { pos: [x, 0, 0], rot: [0, 0, Math.PI / 2] })));
  g.add(mesh(rbox(0.2, 0.24, 0.08, 0.03), gold, { pos: [0, 0.55, 0.41] }));
  const light = mesh(cyl(0.5, 0.05, 2.6, 32), new THREE.MeshBasicMaterial({ color: '#fff2a8', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }), { pos: [0, 1.9, 0], cast: false });
  g.add(light);
  g.lid = lidPivot; g.beam = light; return g;
}
export function makePiggy() {
  const pink = mat('#ff9fb6', 0.45), pinkD = mat('#f07f9c', 0.5), dark = mat('#2a1a1a', 0.3);
  const g = G(mesh(sphere(0.5, 40, 28), pink, { scale: [1.2, 1, 1] }));
  g.add(mesh(cyl(0.17, 0.19, 0.14, 28), pinkD, { pos: [0.6, 0.02, 0], rot: [0, 0, Math.PI / 2] }));
  [-1, 1].forEach(s => g.add(mesh(sphere(0.035, 10, 8), dark, { pos: [0.675, 0.03, 0.06 * s], cast: false })));
  [-1, 1].forEach(s => g.add(mesh(sphere(0.055, 14, 10), dark, { pos: [0.42, 0.2, 0.25 * s], cast: false })));
  [-1, 1].forEach(s => g.add(mesh(new THREE.ConeGeometry(0.11, 0.2, 16), pinkD, { pos: [0.25, 0.47, 0.22 * s], rot: [0.3 * s, 0, -0.3] })));
  [[0.35, 0.25], [0.35, -0.25], [-0.35, 0.25], [-0.35, -0.25]].forEach(([x, z]) => g.add(mesh(cyl(0.1, 0.1, 0.28, 18), pinkD, { pos: [x, -0.45, z] })));
  g.add(mesh(rbox(0.3, 0.05, 0.06, 0.02), dark, { pos: [-0.05, 0.5, 0], cast: false }));
  g.add(mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 20, Math.PI * 1.5), pinkD, { pos: [-0.62, 0.1, 0], rot: [0, Math.PI / 2, 0] }));
  return g;
}
export function makeTile(emoji, color = '#ffffff') {
  const g = G(mesh(rbox(0.9, 0.9, 0.2, 0.18), mat(color, 0.4)));
  const tex = canvasTex(256, 256, (c, w, h) => { c.font = '170px "Noto Color Emoji"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(emoji, w / 2, h / 2 + 12); });
  g.add(mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }), { pos: [0, 0, 0.105], cast: false }));
  return g;
}
export function makeAnswer(textHe, w = 2.4, h = 0.5, color = '#ffffff', ink = '#16352c') {
  const tex = canvasTex(1024, Math.round(1024 * h / w), (c, cw, ch) => {
    c.fillStyle = color; c.fillRect(0, 0, cw, ch);
    c.direction = 'rtl'; c.font = `800 ${Math.round(ch * 0.42)}px Rubik`; c.fillStyle = ink; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText(textHe, cw - 50, ch / 2 + 4);
  });
  const g = G(mesh(rbox(w, h, 0.12, 0.1), mat('#d7e6df', 0.5)));
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
  g.add(mesh(rrectGeo(w - 0.06, h - 0.06, 0.08), face, { pos: [0, 0, 0.062], cast: false }));
  g.face = face; return g;
}
export function makeScale() {
  const metal = mat('#c9ced6', 0.25, { metalness: 0.9 }), dark = mat('#3b4048', 0.4, { metalness: 0.6 });
  const g = G(mesh(cyl(0.45, 0.55, 0.12, 40), dark), mesh(cyl(0.06, 0.06, 1.7, 16), metal, { pos: [0, 0.9, 0] }), mesh(sphere(0.1), GOLD(), { pos: [0, 1.78, 0] }));
  const beam = G(mesh(rbox(2.0, 0.08, 0.08, 0.03), metal)); beam.position.y = 1.72; g.add(beam);
  const pans = [-1, 1].map(s => {
    const hang = G(); hang.position.x = 0.95 * s; beam.add(hang);
    // three wires from the hook (hang origin) down to the pan rim
    const R = 0.3, h = 0.68, up = new THREE.Vector3(0, 1, 0);
    [0, 1, 2].forEach(i => {
      const a = i / 3 * Math.PI * 2 + Math.PI / 6, d = new THREE.Vector3(Math.cos(a) * R, -h, Math.sin(a) * R);
      const w = mesh(cyl(0.009, 0.009, d.length(), 6), metal, { pos: [d.x / 2, d.y / 2, d.z / 2], cast: false });
      w.quaternion.setFromUnitVectors(up, d.clone().normalize()); hang.add(w);
    });
    const pan = G(mesh(cyl(0.42, 0.3, 0.08, 40), metal)); pan.position.y = -0.72; hang.add(pan);
    return { hang, pan };
  });
  g.beam = beam; g.pans = pans; return g;
}
export function makeRoom({ wall = '#e9dfc9', floor = '#c8b08a', bunk = true, table = false, locker = true } = {}) {
  const g = G();
  g.add(mesh(new THREE.PlaneGeometry(30, 30), mat(floor, 0.85), { rot: [-Math.PI / 2, 0, 0], recv: true, cast: false }));
  g.add(mesh(new THREE.PlaneGeometry(30, 12), mat(wall, 0.9), { pos: [0, 6, -3.2], recv: true, cast: false }));
  g.add(mesh(new THREE.PlaneGeometry(30, 1.2), mat('#9aa77f', 0.9), { pos: [0, 0.6, -3.18], recv: true, cast: false }));
  // window with daylight
  const win = G(mesh(rbox(2.3, 1.7, 0.12, 0.05), mat('#f6f3ea', 0.6)), mesh(new THREE.PlaneGeometry(2.05, 1.45), new THREE.MeshBasicMaterial({ color: '#bfe8ff', toneMapped: false }), { pos: [0, 0, 0.065], cast: false }),
    mesh(rbox(0.07, 1.45, 0.05, 0.02), mat('#f6f3ea', 0.6), { pos: [0, 0, 0.09] }), mesh(rbox(2.05, 0.07, 0.05, 0.02), mat('#f6f3ea', 0.6), { pos: [0, 0, 0.09] }));
  win.position.set(1.9, 2.75, -3.1); g.add(win);
  if (bunk) {
    const metal = mat('#7f8a86', 0.35, { metalness: 0.6 }), matt = mat('#6e7b48', 0.85), pil = mat('#f2efe6', 0.8);
    const b = G();
    [[-1.05, -0.45], [1.05, -0.45], [-1.05, 0.45], [1.05, 0.45]].forEach(([x, z]) => b.add(mesh(cyl(0.045, 0.045, 3.1, 12), metal, { pos: [x, 1.55, z] })));
    [0.55, 2.0].forEach(y => { b.add(mesh(rbox(2.1, 0.08, 0.92, 0.02), metal, { pos: [0, y, 0] })); b.add(mesh(rbox(2.0, 0.22, 0.86, 0.08), matt, { pos: [0, y + 0.15, 0] })); b.add(mesh(rbox(0.5, 0.16, 0.6, 0.07), pil, { pos: [-0.68, y + 0.33, 0] })); });
    b.position.set(-2.4, 0, -2.5); g.add(b);
  }
  if (locker) {
    const lk = mat('#7c8f86', 0.5, { metalness: 0.3 });
    [0, 1].forEach(i => { const l = G(mesh(rbox(0.85, 2.3, 0.6, 0.03), lk, { pos: [0, 1.15, 0] })); for (let k = 0; k < 4; k++) l.add(mesh(rbox(0.4, 0.03, 0.02, 0.01), mat('#5c6b64', 0.6), { pos: [0, 2.0 - k * 0.08, 0.31], cast: false })); l.add(mesh(rbox(0.05, 0.22, 0.04, 0.02), mat('#d6d9d2', 0.3, { metalness: 0.7 }), { pos: [-0.3, 1.2, 0.32] })); l.position.set(3.0 + i * 0.88, 0, -2.75); g.add(l); });
  }
  if (table) {
    const wood = mat('#a67c52', 0.7);
    const t = G(mesh(rbox(2.6, 0.12, 1.1, 0.04), wood, { pos: [0, 0.95, 0] }));
    [[-1.1, -0.4], [1.1, -0.4], [-1.1, 0.4], [1.1, 0.4]].forEach(([x, z]) => t.add(mesh(cyl(0.05, 0.05, 0.92, 12), mat('#555b55', 0.4, { metalness: 0.5 }), { pos: [x, 0.47, z] })));
    t.position.set(0, 0, -0.6); g.add(t); g.table = t;
  }
  return g;
}
// 3D app icon: green tile + three rank chevrons
export function makeLogo({ tile = true, allGold = false } = {}) {
  const g = G();
  if (tile) g.add(mesh(rbox(2.0, 2.0, 0.34, 0.38, 6), mat('#0b6b55', 0.35)));
  const stadium = (ax, ay, bx, by, w) => {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), s = new THREE.Shape();
    s.absarc(0, 0, w / 2, Math.PI / 2, Math.PI * 1.5, false); s.absarc(L, 0, w / 2, -Math.PI / 2, Math.PI / 2, false); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 4, curveSegments: 16 });
    geo.rotateZ(Math.atan2(dy, dx)); geo.translate(ax, ay, 0); return geo;
  };
  const S = 2.0 / 512, X = x => (x - 256) * S, Y = y => (256 - y) * S;
  const chev = (y0, y1, x0, x1, w, m, z) => { const c = G(mesh(stadium(X(x0), Y(y0), X(256), Y(y1), w * S), m), mesh(stadium(X(256), Y(y1), X(x1), Y(y0), w * S), m)); c.position.z = z; g.add(c); return c; };
  const c3 = chev(392, 330, 166, 346, 40, allGold ? GOLD() : mat('#d7efe6', 0.4), 0.15);
  const c2 = chev(312, 236, 149, 363, 48, allGold ? GOLD() : mat('#f4fbf8', 0.35), 0.16);
  const c1 = chev(220, 130, 131, 381, 58, GOLD(), 0.17);
  g.chevrons = [c1, c2, c3];
  return g;
}

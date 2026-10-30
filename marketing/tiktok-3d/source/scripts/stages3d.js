// Scenes for the Dribit 3D TikToks (s4, s5, s6). Each stage builds a Three.js scene + an HTML overlay layer
// and returns { scene, camera, update(lt) } where lt is the time inside the scene in seconds.
import {
  THREE, clamp, lin, out, inout, back, mix, wave, pop, blinkAt, talk, rng, arc, W, H,
  camera, aim, aimMix, holdAt, text3d, mat, GOLD, glow, mesh, G, sphere, capsule, rbox, cyl, canvasTex, faceWorld, toScreen, worldToScreen,
  skyDome, lights, cloud, makeChar, makePhone, makeCoin, makeBill, makeFlame, makePlatform, makeCheck, makeChest, makePiggy, makeTile,
  makeAnswer, makeScale, makeRoom, makeLogo
} from './lib3d.js';

// ---------- overlay helpers ----------
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const add = (L, cls, html, style) => { const e = el('div', cls, html); if (style) Object.assign(e.style, style); L.append(e); return e; };
const caption = (L, lines, top = 170) => add(L, 'cap2', lines.map(x => `<div>${x}</div>`).join(''), { top: top + 'px' });
const bubble = (L, html, w, tail = 'down', kind = 'white') => add(L, 'bubl ' + kind + ' t-' + tail, html, w ? { width: w + 'px' } : { whiteSpace: 'nowrap' });
function showPop(e, t, a, from = 0.6) { const k = pop(t, a); e.style.opacity = clamp(lin(t, a, a + 0.12)); e.style.transform = `scale(${from + (1 - from) * k})`; }
// pop a caption in, line by line
function showCap(e, t, a = 0.05, step = 0.22) { [...e.children].forEach((c, i) => { const k = pop(t, a + i * step, 0.3); c.style.opacity = clamp(lin(t, a + i * step, a + i * step + 0.1)); c.style.transform = `scale(${0.7 + 0.3 * k})`; }); }
const floater = (L, html, cls = '') => add(L, 'floater ' + cls, html);
function animFloater(e, t, a, x, y, rise = 150, life = 1.0) {
  const k = lin(t, a, a + life);
  e.style.opacity = t < a ? 0 : (k < 0.7 ? clamp(lin(t, a, a + 0.1)) : 1 - lin(k, 0.7, 1));
  e.style.left = x + 'px'; e.style.top = y + 'px';
  e.style.transform = `translate(-50%, -50%) translateY(${-rise * out(k)}px) scale(${0.6 + 0.4 * back(lin(t, a, a + 0.3))})`;
}
// place a bubble so its tail points at screen point p
function placeBubble(e, p, tail = 'down', dy = 40) {
  const w = e.offsetWidth, h = e.offsetHeight;
  const x = tail === 'down-left' ? p.x - 96 : tail === 'down-right' ? p.x - w + 96 : p.x - w / 2;
  e.style.left = clamp(x, 30, W - w - 30) + 'px'; e.style.top = (p.y - h - dy) + 'px';
}

// ---------- shared cast ----------
const HERO = { skin: '#d9a273', hair: '#2a1c13', hairStyle: 'short', outfit: 'uniform', rolled: true };
const FRIEND_A = { skin: '#f0c8a0', hair: '#5a3a22', hairStyle: 'curly', outfit: 'hoodie', top: '#e85d4a', pants: '#2f3d5c', boots: '#f2f2f2' };
const FRIEND_B = { skin: '#c48a5c', hair: '#1a110b', hairStyle: 'bun', outfit: 'uniform', rolled: true };
const FRIEND_C = { skin: '#a8714d', hair: '#120c08', hairStyle: 'buzz', outfit: 'tee', top: '#2f6fd6', pants: '#3a3a40', boots: '#e9e9e9', print: '#ffd34d' };

// generic idle pose helpers
const idle = (t, ph = 0) => ({ bob: wave(t, 0.9, 0.015, ph), blink: blinkAt((t + ph) % 3.1, [0.8, 2.6]) });

export const STAGES = {};

// ---------- shared scene builders ----------
function roomScene(o = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(o.wall || '#e9dfc9');
  lights(scene, { keyPos: [3.5, 8, 7], box: 7, ...(o.lights || {}) });
  const room = makeRoom(o); scene.add(room);
  return { scene, room };
}
function skyScene(o = {}) {
  const scene = new THREE.Scene();
  scene.add(skyDome(o.top || '#3fa9f0', o.bottom || '#d8f2ff', { a: 0.3, b: 0.8 }));
  lights(scene, { key: '#fff3dc', keyI: 2.6, keyPos: [4, 9, 7], sky: '#cfe8ff', ground: '#9bc7a8', hemiI: 1.0, rim: '#ffffff', rimI: 1.0, box: 8, target: o.target || [0, 2, 0] });
  const R = rng(o.seed || 5);
  for (let i = 0; i < (o.clouds || 9); i++) { const c = cloud(i + 3, 0.7 + R() * 0.9); c.position.set((R() - 0.5) * 16, (o.cy || 0) + (R() - 0.5) * 10, -6 - R() * 14); scene.add(c); }
  return scene;
}
function studioScene(top = '#0f7d62', bottom = '#032e24') {
  const scene = new THREE.Scene(); scene.add(skyDome(top, bottom, { a: 0.15, b: 0.75 }));
  lights(scene, { key: '#ffffff', keyI: 2.4, keyPos: [3, 7, 8], sky: '#d9fff0', ground: '#0a3b2e', hemiI: 0.9, rim: '#7dffd0', rimI: 1.8, box: 6 });
  return scene;
}
// a mound of flat coins; coins[0] is at the top of the pile
function coinPile(n, cur = '₪', seed = 3, spread = 1) {
  const R = rng(seed), g = G(), spots = [];
  const rings = [[0, 0, 1], [0.34, 0, 6], [0.62, 0, 9], [0.17, 0.05, 4], [0.45, 0.05, 6], [0.1, 0.1, 3], [0, 0.15, 1]];
  rings.forEach(([r, y, k]) => { for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2 + R(); spots.push([(Math.cos(a) * r + (R() - 0.5) * 0.06) * spread, y + 0.025, Math.sin(a) * r * 0.75 * spread]); } });
  spots.sort((a, b) => b[1] - a[1]);
  const coins = [];
  for (let i = 0; i < n; i++) { const sp = spots[(spots.length - n) + i] || spots[i % spots.length]; const c = makeCoin(cur, 0.17); c.position.set(...sp); c.rotation.set(-Math.PI / 2 + (R() - 0.5) * 0.3, 0, R() * 3); c.home = sp; c.homeRot = c.rotation.clone(); g.add(c); coins.push(c); }
  coins.sort((a, b) => b.home[1] - a.home[1]);
  g.coins = coins; return g;
}
function flyArc(obj, t, a, d, p0, p1, h, spin = 12) {
  const k = lin(t, a, a + d);
  obj.position.set(mix(p0[0], p1[0], k), mix(p0[1], p1[1], k) + arc(k, h), mix(p0[2], p1[2], k));
  obj.rotation.set(0, k * spin, 0);
  return k;
}
const qmark = () => text3d('?', { size: 0.55, depth: 0.16, bevel: 0.03, material: mat('#ffd34d', 0.35) });
function barChart() {
  const g = G(mesh(rbox(1.1, 0.07, 0.5, 0.03), mat('#ffffff', 0.4)));
  g.bars = [0.35, 0.6, 0.95].map((h, i) => { const b = mesh(rbox(0.24, 1, 0.24, 0.05), mat(i === 2 ? '#3ddc97' : '#7be0b7', 0.45)); b.position.set(-0.34 + i * 0.34, 0.035, 0); b.h = h; g.add(b); return b; });
  return g;
}
const setBars = (g, k) => g.bars.forEach((b, i) => { const q = clamp(k * 1.6 - i * 0.3); b.scale.y = Math.max(0.001, b.h * back(q)); b.position.y = 0.035 + b.scale.y / 2; });

// ======================= s4: המשכורת שנעלמה =======================
// olive army footlocker in front of the hero; the coin pile sits on it
function footLocker() {
  const olive = mat('#5f6b3c', 0.75), dark = mat('#3f4728', 0.7), metal = mat('#9aa0a6', 0.35, { metalness: 0.7 });
  const g = G(mesh(rbox(1.5, 0.58, 0.8, 0.06), olive, { pos: [0, 0.29, 0], recv: true }),
    mesh(rbox(1.52, 0.06, 0.82, 0.02), dark, { pos: [0, 0.47, 0] }),
    mesh(rbox(0.16, 0.12, 0.04, 0.02), metal, { pos: [0, 0.38, 0.41] }));
  [-0.55, 0.55].forEach(x => g.add(mesh(rbox(0.08, 0.6, 0.84, 0.02), dark, { pos: [x, 0.29, 0] })));
  g.position.set(0.05, 0, 1.15); return g;
}

// smooth blends between poses, so arms never jump between frames
const armMix = (a, b, k) => { const o = {}; for (const key of ['raise', 'fwd', 'bend', 'twist']) o[key] = mix(a[key] || 0, b[key] || 0, k); return o; };
// 0..1..0 bump right after each hit time
const hitPulse = (t, hits, d = 0.35) => hits.reduce((m, h) => Math.max(m, t >= h ? Math.sin(Math.PI * lin(t, h, h + d)) : 0), 0);
// a floater that pops in and stays
function holdFloater(e, t, a, x, y, rise = 30) {
  e.style.opacity = t < a ? 0 : clamp(lin(t, a, a + 0.12)); e.style.left = x + 'px'; e.style.top = y + 'px';
  e.style.transform = `translate(-50%, -50%) translateY(${-rise * out(lin(t, a, a + 0.5))}px) scale(${0.6 + 0.4 * back(lin(t, a, a + 0.3))})`;
}

STAGES.payday = (s, L, TEX) => {
  const { scene } = roomScene({ bunk: true, locker: true });
  scene.add(footLocker());
  const hero = makeChar(HERO).place(0, 0, 0); scene.add(hero.root);
  const phone = makePhone(TEX.h3); scene.add(phone);
  const pile = coinPile(16, '₪', 4, 0.8); pile.position.set(0.05, 0.58, 1.15); scene.add(pile);
  const R = rng(9);
  const drops = pile.coins.map((c, i) => ({ c, a: 1.0 + (pile.coins.length - 1 - i) * 0.07, dx: (R() - 0.5) * 1.2, spin: 6 + R() * 8 }));
  const cam = camera(30);
  const cap = caption(L, ['המשכורת', '<span class="gold">נכנסה!</span>'], 160);
  const nt = add(L, 'notif', '<div class="ic">🏦</div><div><div class="t1">הבנק · עכשיו</div><div class="t2">המשכורת נכנסה לחשבון</div></div>', { top: '420px', zIndex: 4 });
  const REST_R = { fwd: 0.75, bend: 1.45, raise: 0.05 }, REST_L = { raise: 0.08 }, UP = { raise: 2.35, bend: 0.5 };
  return {
    scene, camera: cam, update(t) {
      // start close on the phone, pull back to the wide framing the next scene starts with
      aimMix(cam, [0, 2.35, 8.8], [0, 2.85, 13.0], [0, 2.0, 0], [0, 2.4, 0], inout(lin(t, 0.5, 1.8)));
      const k = out(lin(t, 0.95, 1.15)), rich = t > 1.0;
      const jump = rich ? Math.abs(wave(t - 1.0, 2.4, 0.12)) : 0;
      hero.pose({
        ...idle(t), bob: jump, money: rich, mouth: rich ? 'open' : 'smile', mouthOpen: 1.15, nod: mix(0.2, -0.06, k), look: mix(0.7, 0, k), lookY: mix(-0.9, 0.2, k),
        armR: armMix(REST_R, UP, k), armL: armMix(REST_L, UP, k), browY: rich ? 1 : 0
      });
      const buzz = t > 0.25 && t < 0.9 ? wave(t, 16, 0.05) : 0;
      const o0 = [0.04, 0.22, 0.16], o1 = [0.02, 0.26, 0.05], r0 = [-0.5, -0.35, buzz * 2], r1 = [0, 0, -0.2];
      holdAt(phone, hero.A.R.hand, o0.map((v, i) => mix(v, o1[i], k)), r0.map((v, i) => mix(v, r1[i], k)));
      drops.forEach(({ c, a, dx, spin }) => {
        const q = lin(t, a, a + 0.42); c.visible = t >= a;
        const h = c.home; c.position.set(h[0] + dx * (1 - q), h[1] + 4.2 * (1 - q * q), h[2]);
        if (q < 1) c.rotation.set(-Math.PI / 2 + (1 - q) * spin, (1 - q) * spin * 0.5, 0); else c.rotation.copy(c.homeRot);
      });
      showCap(cap, t, -0.3, 0.2);
      // the bank alert drops in, then fades where it is (never over the caption)
      const nk = out(lin(t, 0.22, 0.5)), gone = inout(lin(t, 0.85, 1.05));
      nt.style.opacity = lin(t, 0.22, 0.32) * (1 - gone); nt.style.transform = `translateY(${-30 * (1 - nk) + 40 * gone}px) scale(${0.9 + 0.1 * nk})`;
    }
  };
};

STAGES.vanish = (s, L, TEX) => {
  const { scene } = roomScene({ bunk: true, locker: true });
  scene.add(footLocker());
  const hero = makeChar(HERO).place(0, 0, 0); scene.add(hero.root);
  const phone = makePhone(TEX.h3); scene.add(phone);
  const pile = coinPile(16, '₪', 4, 0.8); pile.position.set(0.05, 0.58, 1.15); scene.add(pile);
  const T = [['🍕', -0.95, 3.3, 0.7, 'משלוחים', '-45 ₪'], ['📺', 0, 3.42, 0.7, 'מנויים', '-30 ₪'], ['🛍️', 0.95, 3.3, 0.7, 'קניות', '-120 ₪']]
    .map(([e, x, y, z, lb, minus], i) => { const g = makeTile(e); g.position.set(x, y, z); g.scale.setScalar(0.85); scene.add(g); return { g, x, y, z, lbl: add(L, 'lbl', lb), fl: floater(L, minus, 'minus'), first: null, hits: [] }; });
  const flights = pile.coins.map((c, i) => { const tile = T[[0, 2, 1][i % 3]]; const a = 0.3 + i * 0.13; tile.hits.push(a + 0.42); if (tile.first == null) tile.first = a + 0.42; return { c, a, tile, side: tile.x ? Math.sign(tile.x) : (Math.sign(c.home[0]) || (i % 2 ? 1 : -1)) }; });
  const cam = camera(30);
  const cap = caption(L, ['...ונעלמה', '<span class="red">עד אמצע החודש?</span>'], 160);
  const UP = { raise: 2.35, bend: 0.5 }, DOWN = { raise: 0.1 }, SHOCK = { raise: 0.75, fwd: 0.7, bend: 0.4 };
  return {
    scene, camera: cam, update(t) {
      aimMix(cam, [0, 2.85, 13.0], [0, 2.8, 12.5], [0, 2.4, 0], [0, 2.4, 0], inout(lin(t, 0, s.dur)));
      // continue the payday pose for a beat (same shot, no cut), then the shock
      const settle = out(lin(t, 0, 0.3)), shock = t > 0.55, sad = t > 1.5;
      const fl = flights.find(f => t >= f.a && t < f.a + 0.42);
      const tgt = fl ? fl.tile.x : 0;
      const arms = t < 0.55 ? armMix(UP, DOWN, settle) : armMix(DOWN, SHOCK, out(lin(t, 0.55, 0.72)));
      hero.pose({
        ...idle(t), bob: Math.abs(wave(t + 1.6, 2.4, 0.12)) * (1 - settle), money: t < 0.2,
        mouth: t < 0.2 ? 'open' : sad ? 'frown' : shock ? 'o' : 'smile', mouthOpen: 1.15, eyeScale: shock ? 1.15 : 1, browY: shock || t < 0.2 ? 1 : 0, brows: sad ? 0.9 : 0, sweat: sad, sweatT: t * 1.4,
        headY: wave(t - 0.3, 0.7, 0.28) * out(lin(t, 0.3, 0.6)), look: tgt * 0.9, lookY: mix(0.2, 0.9, settle), nod: mix(-0.06, -0.12, settle),
        armL: arms, armR: arms
      });
      holdAt(phone, hero.A.R.hand, [0.02, 0.26, 0.05], [0, 0, -0.2]); phone.scale.setScalar(Math.max(0.001, 1 - out(lin(t, 0.05, 0.3))));
      flights.forEach(({ c, a, tile, side }) => {
        if (t < a) { c.position.set(...c.home); c.rotation.copy(c.homeRot); c.visible = true; c.scale.setScalar(1); return; }
        const p1 = [tile.x - pile.position.x, tile.y - pile.position.y, tile.z - pile.position.z];
        const k = flyArc(c, t, a, 0.42, c.home, p1, 0.9, 10);
        c.position.x += side * 1.0 * Math.sin(Math.PI * Math.min(1, k * 1.6));   // swing wide around the head while at face height
        c.scale.setScalar(1 - 0.6 * k); c.visible = k < 1;
      });
      T.forEach((tl, i) => {
        const bump = tl.hits.reduce((m, h) => Math.max(m, t > h ? Math.max(0, 1 - (t - h) / 0.18) : 0), 0);
        tl.g.scale.setScalar(Math.max(0.001, 0.8 * pop(t, 0.05 + i * 0.08) * (1 + 0.16 * bump)));
        tl.g.rotation.set(wave(t, 0.5, 0.08, i), wave(t, 0.4, 0.15, i * 0.3), 0);
        const p = toScreen(tl.g, cam, [0, -0.5, 0.2]);
        tl.lbl.style.left = p.x + 'px'; tl.lbl.style.top = p.y + 'px'; tl.lbl.style.opacity = lin(t, 0.1 + i * 0.08, 0.25 + i * 0.08);
        const q = toScreen(tl.g, cam, [0, 0.62, 0.3]);
        holdFloater(tl.fl, t, tl.first, q.x, q.y, 25);
      });
      showCap(cap, t, -0.1, 0.3);
    }
  };
};

STAGES.learn = (s, L, TEX) => {
  const { scene } = roomScene({ bunk: false, locker: false });
  const hero = makeChar(HERO).place(-0.28, 0, -0.2, 0.15); scene.add(hero.root);
  const phone = makePhone(TEX.l01a); phone.scale.setScalar(1.65); scene.add(phone);
  const crate = mesh(rbox(0.85, 0.9, 0.85, 0.06), mat('#b88a55', 0.75), { pos: [0.97, 0.45, 0.75] }); scene.add(crate);
  const pig = makePiggy(); pig.position.set(0.95, 1.33, 0.75); pig.rotation.y = -1.95; pig.scale.setScalar(0.7); scene.add(pig);
  // the money comes back: three quick bursts of shekels fly in from the right edge into the piggy bank
  const coins = Array.from({ length: 12 }, (_, i) => { const c = makeCoin('₪', 0.18); scene.add(c); return { c, a: 0.5 + Math.floor(i / 4) * 0.6 + (i % 4) * 0.07, y0: 2.45 + (i % 4) * 0.22 }; });
  const cam = camera(30);
  const cap = caption(L, ['שיעור 1 בדריבית:', '<span class="gold">לאן הכסף שלך נעלם?</span>'], 160);
  const chip = floater(L, '✓ נכון! <bdi dir="ltr">+10</bdi>', 'chip gold');
  // "כמו משחק" at ~2.9: he picks the answer, checks it, the app says correct, +10
  const PICK = 2.5, CHECK = 2.75, CHIP = 2.9;
  return {
    scene, camera: cam, update(t) {
      aimMix(cam, [0.25, 2.2, 8.6], [0.28, 2.1, 8.1], [0.28, 1.8, 0], [0.28, 1.75, 0], inout(lin(t, 0, s.dur)));
      const tap = hitPulse(t, [PICK, CHECK], 0.2);
      hero.pose({ ...idle(t), bob: arc(lin(t, CHIP, CHIP + 0.35), 0.08), mouth: t > 0.5 ? 'open' : 'smile', mouthOpen: t > CHIP ? 1.1 : 0.8, look: 0.2, lookY: 0.1, nod: wave(t, 1.2, 0.04), browY: t > CHIP ? 1 : 0,
        armR: { fwd: 1.25, bend: 0.75 + 0.3 * tap, raise: 0.25 }, armL: t > CHIP ? armMix({ raise: 0.12 }, { raise: 2.75, bend: 0.25 }, out(lin(t, CHIP, CHIP + 0.15))) : { raise: 0.12 }, headZ: wave(t, 0.8, 0.04) });
      holdAt(phone, hero.A.R.hand, [0.06, 0.55, 0.06], [0, -0.1, 0]);
      phone.screen.material.map = t < PICK ? TEX.l01a : t < CHECK ? TEX.l01b : TEX.l01q;
      const slot = [pig.position.x, pig.position.y + 0.45, pig.position.z];
      let bump = 0;
      coins.forEach(({ c, a, y0 }) => {
        const k = flyArc(c, t, a, 0.45, [2.4, y0, 0.95], slot, 0.5, 9);
        c.visible = t >= a && k < 1; c.scale.setScalar(1 - 0.3 * k);
        if (t > a + 0.45) bump = Math.max(bump, Math.max(0, 1 - (t - a - 0.45) / 0.22));
      });
      pig.scale.set(0.7 * (1 + 0.22 * bump), 0.7 * (1 - 0.15 * bump), 0.7 * (1 + 0.22 * bump)); pig.position.y = 1.33 + 0.08 * bump;
      showCap(cap, t, -0.1, 0.3);
      chip.style.left = '70px'; chip.style.top = '440px'; showPop(chip, t, CHIP, 0.4);
    }
  };
};

// ======================= s5: דולר או שקל =======================
STAGES.crew = (s, L, TEX) => {
  const { scene } = roomScene({ bunk: false, table: true, locker: true });
  const hero = makeChar(HERO).place(0, 0, 0.3); const a = makeChar(FRIEND_A).place(-1.1, 0, -1.1, 0.45); const c = makeChar(FRIEND_C).place(1.1, 0, -1.1, -0.45);
  scene.add(hero.root, a.root, c.root);
  const ils = makeBill('ils200', 0.62), usd = makeBill('usd', 0.62); scene.add(ils, usd);
  const qs = [qmark(), qmark()]; qs.forEach(q => scene.add(q));
  const cam = camera(30);
  const cap = caption(L, ['פתאום כולם בבסיס', '<span class="gold">מבינים בהשקעות</span>'], 150);
  const bA = bubble(L, 'קונים דולרים! 💵', 0, 'down-left'), bC = bubble(L, 'מה פתאום, מניות! 📈', 0, 'down-right');
  const ARM = { raise: 0.6, fwd: 0.25, bend: 0.9 };
  return {
    scene, camera: cam, update(t) {
      aimMix(cam, [0, 2.3, 10.4], [0, 2.25, 10.2], [0, 1.95, 0], [0, 1.95, 0], inout(lin(t, 0, s.dur)));
      // he turns to each friend as they talk, then back to camera, confused
      const look = -out(lin(t, 0.3, 0.5)) + 2 * inout(lin(t, 0.9, 1.15)) - inout(lin(t, 1.75, 1.95));
      const lost = t > 1.9;
      hero.pose({ ...idle(t), headY: look * 0.45, look, mouth: lost ? 'o' : 'flat', brows: lost ? 0.8 : 0.3, browY: lost ? 0.6 : 0, armL: ARM, armR: ARM });
      holdAt(ils, hero.A.L.hand, [0.1, 0.2, 0.08], [0, 0.25, 0.15]); holdAt(usd, hero.A.R.hand, [-0.1, 0.2, 0.08], [0, -0.25, -0.15]);
      const aUp = out(lin(t, 0.3, 0.5)) * (1 - out(lin(t, 1.5, 1.7)));
      a.pose({ ...idle(t, 1), mouth: talk(t, 0.35, 1.5), armR: armMix({ raise: 0.1 }, { raise: 1.0, fwd: 0.5, bend: 1.2 }, aUp), armL: { raise: 0.1 }, look: 0.6, headY: 0.2, bob: aUp * Math.abs(wave(t, 3, 0.04)) });
      const cUp = out(lin(t, 0.85, 1.05)) * (1 - out(lin(t, 1.85, 2.05)));
      c.pose({ ...idle(t, 2), mouth: talk(t, 0.9, 1.9), armL: armMix({ raise: 0.1 }, { raise: 1.6, bend: 0.8 }, cUp), armR: { raise: 0.1 }, look: -0.6, headY: -0.2, brows: -0.5 * cUp });
      qs.forEach((q, i) => { const k = pop(t, 1.95 + i * 0.15); q.scale.setScalar(Math.max(0.001, 0.75 * k)); q.position.set(i ? 0.32 : -0.3, 2.95 + wave(t, 1.2, 0.05, i * 0.5) + i * 0.1, 0.6); q.rotation.set(0, wave(t, 0.7, 0.5, i * 0.3), i ? -0.25 : 0.2); });
      showCap(cap, t, -0.3, 0.2);
      placeBubble(bA, toScreen(a.head, cam, [0, 0.65, 0]), 'down-left'); bA.style.left = '30px'; showPop(bA, t, 0.35); bA.style.opacity = +bA.style.opacity * (1 - lin(t, 1.65, 1.8));
      placeBubble(bC, toScreen(c.head, cam, [0, 0.65, 0]), 'down-right'); bC.style.left = (W - 30 - bC.offsetWidth) + 'px'; showPop(bC, t, 0.9); bC.style.opacity = +bC.style.opacity * (1 - lin(t, 1.85, 2.0));
    }
  };
};

STAGES.scale = (s, L, TEX) => {
  const { scene } = roomScene({ bunk: false, table: false, locker: true });
  const hero = makeChar(HERO).place(0, 0, -0.9); scene.add(hero.root);
  scene.add(mesh(rbox(1.15, 0.5, 0.75, 0.05), mat('#b88a55', 0.75), { pos: [0, 0.25, 0.55] }));
  const sc = makeScale(); sc.scale.setScalar(0.64); sc.position.set(0, 0.5, 0.55); scene.add(sc);
  const stack = (cur, n) => { const g = G(); for (let i = 0; i < n; i++) { const c = makeCoin(cur, 0.2); c.rotation.set(-Math.PI / 2, 0, i * 0.7); c.position.set((i % 2) * 0.03, 0.06 + i * 0.05, 0); g.add(c); } return g; };
  sc.pans[0].pan.add(stack('$', 5)); sc.pans[1].pan.add(stack('₪', 5));
  const chart = barChart(); scene.add(chart);
  const q = qmark(); q.scale.setScalar(1.3); scene.add(q);
  const cam = camera(30);
  const chips = [['דולר?', 0.2], ['שקל?', 0.85], ['מניות?', 1.58]].map(([h, a]) => ({ e: floater(L, h, 'chip gold'), a }));
  return {
    scene, camera: cam, update(t) {
      aimMix(cam, [0, 2.1, 8.6], [0, 2.05, 8.0], [0, 1.75, 0], [0, 1.75, 0], inout(lin(t, 0, s.dur)));
      const tilt = t < 0.2 ? 0 : t < 0.85 ? -0.28 * out(lin(t, 0.2, 0.45)) : t < 1.58 ? mix(-0.28, 0.28, out(lin(t, 0.85, 1.1))) : 0.28 * (1 - out(lin(t, 1.58, 1.88))) + wave(t, 1.5, 0.03);
      sc.beam.rotation.z = tilt; sc.pans.forEach(p => p.hang.rotation.z = -tilt);
      const look = tilt / 0.28;
      hero.pose({ ...idle(t), look: -look, headZ: -tilt * 0.6, mouth: t > 1.58 ? 'o' : 'flat', brows: 0.7 + wave(t, 2, 0.15), browY: 0.4, sweat: t > 1.65, sweatT: t * 1.5,
        armL: { raise: 0.55, fwd: 0.15, bend: 1.3, twist: 0.4 }, armR: { raise: 0.55, fwd: 0.15, bend: 1.3, twist: 0.4 } });
      const ck = pop(t, 1.58); chart.scale.setScalar(Math.max(0.001, 0.55 * ck)); setBars(chart, lin(t, 1.63, 2.2)); chart.position.set(0.78, 3.1, -0.6); chart.rotation.set(0.25, -0.35 + wave(t, 0.5, 0.1), 0);
      const qk = pop(t, 1.95); q.scale.setScalar(Math.max(0.001, 0.95 * qk)); q.position.set(-0.8, 2.8 + wave(t, 1.3, 0.05), -0.6); q.rotation.set(0, wave(t, 0.8, 0.5), 0.2);
      const pans = sc.pans.map(p => toScreen(p.pan, cam, [0, 0.55, 0]));
      const pos = [pans[0], pans[1], { x: W / 2, y: 330 }];
      chips.forEach(({ e, a }, i) => { e.style.left = clamp(pos[i].x - e.offsetWidth / 2, 40, 930 - e.offsetWidth) + 'px'; e.style.top = (pos[i].y - 40) + 'px'; showPop(e, t, a, 0.4); });
    }
  };
};

STAGES.quiz = (s, L, TEX) => {
  const scene = studioScene('#13866a', '#043428');
  scene.add(mesh(cyl(3.2, 3.2, 0.2, 64), mat('#0b5a47', 0.6), { pos: [0, -0.1, 0.3], recv: true }));
  const hero = makeChar(HERO).place(0, 0, 0.2, 0, 0.9); scene.add(hero.root);
  const opts = ['הלוואה לבנק', 'חלק קטן מחברה', 'סוג של מטבע'];
  const tiles = opts.map((o, i) => { const g = makeAnswer(o, 2.3, 0.46); g.position.set(0, 4.12 - i * 0.57, 0.3); scene.add(g); return g; });
  const okTex = canvasTex(1024, Math.round(1024 * 0.46 / 2.3), (c, cw, ch) => { c.fillStyle = '#3ddc97'; c.fillRect(0, 0, cw, ch); c.direction = 'rtl'; c.font = `800 ${Math.round(ch * 0.42)}px Rubik`; c.fillStyle = '#06392d'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(opts[1], cw - 50, ch / 2 + 4); });
  const baseTex = tiles[1].face.map;
  const check = makeCheck(mat('#ffffff', 0.3)); check.scale.setScalar(0.9); scene.add(check);
  // points: plain gold coins (no currency) fly from the right answer into his raised hand
  const coins = Array.from({ length: 6 }, () => { const c = makeCoin('', 0.16); scene.add(c); return c; });
  const cam = camera(30);
  const qc = add(L, 'qchip', '<div>מה זה מניה?</div>', { top: '150px' });
  const fl = floater(L, '+10', 'pts'), streak = floater(L, '🔥 רצף 7', 'chip gold'), done = floater(L, 'עלית שלב! ⭐', 'chip');
  // voice: "שאלה" 1.76, "נקודות" 2.44, "שלב" 3.27
  const OK = 1.8, PTS = 2.45, STK = 2.85, LVL = 3.27;
  const hand = new THREE.Vector3();
  return {
    scene, camera: cam, update(t) {
      aimMix(cam, [0, 2.75, 11.6], [0, 2.75, 11.0], [0, 2.55, 0], [0, 2.55, 0], inout(lin(t, 0, s.dur)));
      tiles.forEach((g, i) => { const k = out(lin(t, 0.12 + i * 0.1, 0.5 + i * 0.1)); g.position.x = 3.5 * (1 - k); g.rotation.y = -0.9 * (1 - k); g.visible = k > 0;
        const right = i === 1 && t > OK; g.face.map = right ? okTex : (i === 1 ? baseTex : g.face.map); g.face.color.set(t > OK && i !== 1 ? '#9aa9a3' : '#ffffff');
        g.scale.setScalar(right ? 1 + 0.08 * Math.max(0, 1 - (t - OK) / 0.25) : 1); });
      const ck = pop(t, OK); check.scale.setScalar(Math.max(0.001, 0.75 * ck)); check.position.set(-0.85, tiles[1].position.y, 0.45);
      // reach up to tap (1.35), then straight into the cheer when it turns green: no drop in between
      const r = out(lin(t, 1.35, 1.55)), u = out(lin(t, OK, OK + 0.25)), cheer = wave(t - OK, 3, 0.15) * u;
      const hop = arc(lin(t, OK, OK + 0.45), 0.3) + arc(lin(t, LVL, LVL + 0.4), 0.08);
      hero.pose({ ...idle(t), bob: hop, lookY: 1, nod: -0.25, mouth: t > OK ? 'open' : 'smile', look: t < 1.35 ? wave(t, 0.7, 0.45) : 0, headZ: t < 1.35 ? wave(t, 0.7, 0.08) : 0, money: false,
        armR: { raise: mix(mix(0.1, 2.5, r), 2.2, u) + cheer, bend: mix(0.25 * r, 0.9, u) }, armL: { raise: mix(0.1, 2.2, u) - cheer, bend: 0.9 * u } });
      hero.A.L.hand.getWorldPosition(hand);
      const ty = tiles[1].position.y;
      coins.forEach((c, i) => { const a = PTS + i * 0.06; const k = flyArc(c, t, a, 0.5, [0.3 - i * 0.12, ty - 0.32, 0.5], [hand.x, hand.y, hand.z + 0.2], 0.4, 10); c.visible = t >= a && k < 1; });
      const p = toScreen(hero.head, cam, [-0.8, 0.3, 0]);
      animFloater(fl, t, PTS, p.x, p.y, 50, 0.8);
      const gap = 24, total = streak.offsetWidth + gap + done.offsetWidth, x0 = W / 2 - total / 2;
      streak.style.left = (x0 + done.offsetWidth + gap) + 'px'; streak.style.top = '885px'; showPop(streak, t, STK, 0.4);
      done.style.left = x0 + 'px'; done.style.top = '885px'; showPop(done, t, LVL, 0.4);
      showPop(qc, t, 0.02, 0.7);
    }
  };
};

STAGES.explain = (s, L, TEX) => {
  const { scene } = roomScene({ bunk: false, table: true, locker: true });
  const hero = makeChar(HERO).place(0, 0, 0.35); const a = makeChar(FRIEND_A).place(-1.18, 0, -0.45, 0.5); const c = makeChar(FRIEND_C).place(1.18, 0, -0.45, -0.5);
  scene.add(hero.root, a.root, c.root);
  const chart = barChart(); scene.add(chart);
  const cam = camera(30);
  const cap = caption(L, ['ועכשיו', '<span class="gold">אתה זה שמסביר</span>'], 150);
  const bC = bubble(L, 'וואלה, הבנתי! 🤯', 460, 'down-right');
  const HOLD = { raise: 0.3, fwd: 0.85, bend: 0.55 };
  const hl = new THREE.Vector3(), hr = new THREE.Vector3();
  return {
    scene, camera: cam, update(t) {
      aimMix(cam, [0, 2.3, 11.0], [0, 2.2, 10.2], [0, 1.6, 0], [0, 1.55, 0], inout(lin(t, 0, s.dur)));
      hero.pose({ ...idle(t), mouth: talk(t, 0.2, 1.6), headY: wave(t, 0.6, 0.25), look: wave(t, 0.6, 0.6), brows: -0.3, armL: HOLD, armR: HOLD });
      // he holds the chart tray between his hands
      hero.A.L.hand.getWorldPosition(hl); hero.A.R.hand.getWorldPosition(hr);
      chart.position.set((hl.x + hr.x) / 2, (hl.y + hr.y) / 2 - 0.06, (hl.z + hr.z) / 2 + 0.14); chart.rotation.set(0.35, wave(t, 0.35, 0.08), 0);
      const ck = Math.max(0.001, pop(t, 0.1)), sx = Math.max(0.001, Math.abs(hr.x - hl.x) / 1.0 * ck); chart.scale.set(sx, 0.5 * ck, 0.7 * ck);
      chart.bars.forEach(b => { b.scale.x = Math.min(1, 0.6 / Math.max(sx, 0.01)); });   // wide tray, normal-width bars
      setBars(chart, lin(t, 0.15, 0.8));
      a.pose({ ...idle(t, 1), nod: 0.12 + wave(t, 1.8, 0.1), look: 0.6, headY: 0.25, mouth: 'smile', armL: { raise: 0.35, fwd: 1.0, bend: 0.7 + Math.abs(wave(t, 3, 0.5)) }, armR: { raise: 0.35, fwd: 1.0, bend: 0.7 + Math.abs(wave(t, 3, 0.5)) } });
      c.pose({ ...idle(t, 2), nod: 0.1 + wave(t, 1.6, 0.1, 0.3), look: -0.6, headY: -0.25, mouth: t > 1.2 ? 'open' : 'o', eyeScale: 1.1, browY: 0.8 });
      showCap(cap, t, -0.1, 0.3);
      placeBubble(bC, toScreen(c.head, cam, [0, 0.65, 0]), 'down-right'); bC.style.top = Math.max(parseFloat(bC.style.top), 410) + 'px'; showPop(bC, t, 1.2);
    }
  };
};

// ======================= s6: עולים דרגה =======================
STAGES.path = (s, L, TEX) => {
  const scene = skyScene({ seed: 4, clouds: 12, cy: 2 });
  const P = [[0, 0, 0], [-1.0, 1.3, -0.6], [0.9, 2.6, -1.2], [-0.55, 3.9, -1.8], [0.5, 5.2, -2.4], [-0.3, 6.5, -3.0]];
  const plats = P.map((p, i) => { const g = makePlatform(i === 0 ? '#f6c23a' : '#3ddc97', i === 0 ? '#c98f12' : '#1f8f63', 0.78); g.position.set(...p); scene.add(g); g.topM = g.children[1].material = g.children[1].material.clone(); g.sideM = g.children[0].material = g.children[0].material.clone(); return g; });
  const checks = P.map(p => { const c = makeCheck(GOLD()); c.position.set(p[0] + 0.7, p[1] + 0.5, p[2] + 0.3); c.scale.setScalar(0.001); scene.add(c); return c; });
  const coins = P.map(p => { const c = makeCoin('', 0.2); c.position.set(p[0], p[1] + 0.75, p[2]); scene.add(c); return c; });
  const hero = makeChar(HERO); scene.add(hero.root);
  hero.place(0, 0, 0); hero.head.updateWorldMatrix(true, false); const headY = hero.head.getWorldPosition(new THREE.Vector3()).y;
  const J = [0.35, 1.05, 1.75], JD = 0.5;
  const camAt = (c, pos) => { const cx = mix(0, pos[0], 0.35), cy = pos[1]; c.position.set(cx, cy + 1.95, pos[2] + 11.8); c.lookAt(cx, cy + 1.5, pos[2]); c.updateMatrixWorld(true); };
  // +10 for each landing: fixed on screen where his head is at the landing, on the side away from the next jump
  const tc = camera(30);
  const spots = J.map((a, i) => {
    const k = i + 1; camAt(tc, P[k]);
    const hp = worldToScreen([P[k][0], P[k][1] + 0.195 + headY, P[k][2]], tc);
    const side = -Math.sign(P[k + 1][0] - P[k][0]) || 1;
    return { x: clamp(hp.x + side * 230, 150, 930), y: hp.y - 120 };
  });
  const fls = J.map(() => floater(L, '+10', 'pts'));
  const cam = camera(30);
  const cap = caption(L, ['מה אם ללמוד על כסף', '<span class="gold">היה משחק?</span>'], 150);
  return {
    scene, camera: cam, update(t) {
      let pos = P[0], ry = 0, sq = 0, air = false;
      for (let i = 0; i < J.length; i++) {
        if (t >= J[i] + JD) pos = P[i + 1];
        else if (t >= J[i]) { const k = lin(t, J[i], J[i] + JD); pos = [mix(P[i][0], P[i + 1][0], k), mix(P[i][1], P[i + 1][1], k) + arc(k, 1.1), mix(P[i][2], P[i + 1][2], k)]; ry = Math.sign(P[i + 1][0] - P[i][0]) * 0.6; air = true; break; }
        else break;
      }
      for (let i = 0; i < J.length; i++) { const l = J[i] + JD; if (t >= l && t < l + 0.2) sq = 0.12 * Math.sin(lin(t, l, l + 0.2) * Math.PI); if (t >= J[i] - 0.12 && t < J[i]) sq = 0.1 * Math.sin(lin(t, J[i] - 0.12, J[i]) * Math.PI); }
      hero.place(pos[0], pos[1] + 0.195, pos[2], ry);
      const jp = J.reduce((m, a) => Math.max(m, Math.min(out(lin(t, a - 0.08, a + 0.06)), 1 - out(lin(t, a + JD - 0.04, a + JD + 0.12)))), 0);
      const arm = armMix({ raise: 0.2 }, { raise: 2.2, bend: 0.4 }, jp);
      hero.pose({ ...idle(t), squash: sq, mouth: jp > 0.5 ? 'open' : 'smile', armL: arm, armR: arm, legs: [-0.5 * jp, 0.4 * jp], lookY: 0.3 });
      camAt(cam, pos);
      J.forEach((a, i) => {
        const land = a + JD, k = i + 1;
        const done = t >= land;
        plats[k].topM.color.set(done ? '#f6c23a' : '#3ddc97'); plats[k].sideM.color.set(done ? '#c98f12' : '#1f8f63');
        checks[k].scale.setScalar(Math.max(0.001, 0.8 * pop(t, land)));
        const ck = lin(t, land - 0.05, land + 0.25); coins[k].visible = ck < 1; coins[k].position.y = P[k][1] + 0.75 + ck * 1.2; coins[k].scale.setScalar(1 - ck * 0.5);
        animFloater(fls[i], t, land, spots[i].x, spots[i].y, 90, 0.55);
      });
      checks[0].scale.setScalar(0.8); coins[0].visible = false;
      coins.forEach((c, i) => { if (i) c.rotation.y = t * 3 + i; });
      showCap(cap, t, -0.3, 0.2);
    }
  };
};

// a thick boring textbook ("lectures") that the hero swats away
function makeBook() {
  const cover = mat('#4a5878', 0.6), pages = mat('#f4efe2', 0.85);
  const tex = canvasTex(512, 380, (c, w, h) => {
    c.fillStyle = '#4a5878'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d8c27a'; c.lineWidth = 10; c.strokeRect(26, 26, w - 52, h - 52);
    c.direction = 'rtl'; c.fillStyle = '#f2e6c0'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 104px Rubik'; c.fillText('הרצאות', w / 2, h / 2 - 34); c.font = '700 54px Rubik'; c.fillText('פרק 1 מתוך 40', w / 2, h / 2 + 70);
  });
  const g = G(mesh(rbox(0.9, 0.035, 0.66, 0.015), cover, { pos: [0, 0.085, 0] }), mesh(rbox(0.9, 0.035, 0.66, 0.015), cover, { pos: [0, -0.085, 0] }),
    mesh(rbox(0.04, 0.2, 0.66, 0.015), cover, { pos: [-0.43, 0, 0] }), mesh(rbox(0.85, 0.14, 0.62, 0.01), pages, { pos: [0.01, 0, 0] }));
  g.add(mesh(new THREE.PlaneGeometry(0.84, 0.62), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), { pos: [0, 0.104, 0], rot: [-Math.PI / 2, 0, 0], cast: false }));
  return g;
}

STAGES.streak = (s, L, TEX) => {
  const scene = skyScene({ seed: 8, clouds: 10, cy: 1 });
  const plat = makePlatform('#f6c23a', '#c98f12', 1.25); scene.add(plat);
  const hero = makeChar(HERO).place(0, 0.195, 0.1); scene.add(hero.root);
  const book = makeBook(); scene.add(book);
  const flame = makeFlame(0.78); flame.position.set(0, 2.85, -1.0); scene.add(flame);
  const num = d => { const m = text3d(d, { size: 0.5, depth: 0.16, bevel: 0.03, material: mat('#ffffff', 0.3) }); m.position.set(0, 3.3, -0.3); scene.add(m); return m; };
  const seven = num('7'), eight = num('8');
  const orbit = Array.from({ length: 5 }, () => { const c = makeCoin('', 0.17); scene.add(c); return c; });
  const cam = camera(30);
  const cap = caption(L, ['בלי הרצאות.', '<span class="gold">שלב ביום. נקודות. רצף.</span>'], 150);
  // voice: "בלי הרצאות" 0.12, "שלב ביום" 1.5, "נקודות" 2.55, "רצף" 3.53
  const SWAT = 0.75, PUMP = 1.5, FIRE = 3.45, FLIP = 3.9, HITS = [1.5, 2.55, 3.53];
  const fls = [1.6, 2.55, 2.8].map(a => ({ e: floater(L, '+10', 'pts'), a }));
  const REST = { raise: 0.15 }, WIND = { raise: 1.0, fwd: 0.7, bend: 1.7 }, HIT = { raise: 2.55, fwd: 0.1, bend: 0.05 }, FIST = { raise: 2.3, fwd: 0.2, bend: 0.35 };
  return {
    scene, camera: cam, update(t) {
      aimMix(cam, [0, 2.75, 10.8], [0, 2.7, 10.0], [0, 2.55, 0], [0, 2.55, 0], inout(lin(t, 0, s.dur)));
      // the book drops above his right shoulder, he swats it up and out of frame
      const dk = out(lin(t, 0.05, 0.4)), fly = lin(t, SWAT, SWAT + 0.8);
      book.visible = t >= 0.05 && fly < 1;
      book.position.set(mix(0.9, 2.1, fly), mix(6.0, 3.0, dk) + wave(t, 1.3, 0.04) * (1 - fly) + mix(0, 3.0, fly) + arc(fly, 0.6), mix(0.45, 0.2, fly));
      book.rotation.set(1.25 + fly * 7, -0.25 + fly * 3, wave(t, 0.9, 0.08) + fly * 4);
      const pulse = hitPulse(t, HITS, 0.4);
      let armR;
      if (t < 0.62) armR = armMix(REST, WIND, out(lin(t, 0.4, 0.62)));
      else if (t < 1.0) armR = armMix(WIND, HIT, out(lin(t, 0.6, 0.74)));
      else if (t < 1.3) armR = armMix(HIT, REST, inout(lin(t, 1.0, 1.3)));
      else { const f = armMix(REST, FIST, out(lin(t, 1.3, 1.5))); armR = { ...f, raise: f.raise + 0.15 * pulse, bend: f.bend + 0.55 * pulse }; }
      const annoyed = t < SWAT + 0.3;
      hero.pose({ ...idle(t), bob: 0.08 * pulse, lookY: annoyed ? 0.7 : 0.2, look: annoyed ? 0.6 : 0, headY: annoyed ? 0.25 : 0,
        mouth: t > PUMP ? 'open' : annoyed ? 'flat' : 'smile', brows: annoyed ? -0.6 : -0.2, armR, armL: { raise: 0.25, fwd: 0.3, bend: 0.6 } });
      // the streak flame: pops on "רצף", 7 flips to 8 with a flare
      const fk = pop(t, FIRE, 0.45), flare = 1 + 0.15 * Math.sin(Math.PI * lin(t, FLIP, FLIP + 0.3));
      flame.scale.set(Math.max(0.001, 0.78 * fk * flare * (1 + wave(t, 5, 0.04))), Math.max(0.001, 0.78 * fk * flare * (1 + wave(t, 7, 0.07, 0.2))), Math.max(0.001, 0.78 * fk));
      flame.rotation.z = wave(t, 3, 0.04);
      const flip = lin(t, FLIP - 0.05, FLIP + 0.05); seven.scale.setScalar(Math.max(0.001, pop(t, FIRE + 0.08) * (1 - flip))); seven.rotation.y = wave(t, 0.6, 0.25) + flip * 1.5;
      eight.scale.setScalar(Math.max(0.001, pop(t, FLIP + 0.05, 0.35))); eight.rotation.y = wave(t, 0.6, 0.25);
      orbit.forEach((c, i) => { const ang = t * 1.6 + i / orbit.length * Math.PI * 2; c.position.set(Math.cos(ang) * 1.1, 1.8 + Math.sin(ang * 2) * 0.1, Math.sin(ang) * 0.9 - 0.2); c.rotation.y = t * 3 + i; c.scale.setScalar(Math.max(0.001, pop(t, PUMP + i * 0.06))); });
      const hp = toScreen(hero.head, cam, [0, 0, 0]);
      fls.forEach(({ e, a }, i) => animFloater(e, t, a, hp.x + [-300, 330, -300][i], hp.y + [0, -220, -120][i], 110, 0.9));
      showCap(cap, t, -0.1, 1.45);
    }
  };
};

STAGES.rankup = (s, L, TEX) => {
  const scene = skyScene({ seed: 11, clouds: 10, cy: 1, top: '#2f93e8', bottom: '#cfeeff' });
  const plat = makePlatform('#f6c23a', '#c98f12', 1.45); scene.add(plat);
  const hero = makeChar(HERO).place(-0.4, 0.195, -0.55, 0.2); scene.add(hero.root);
  const chest = makeChest(); chest.position.set(0.82, 0.195, 0.4); chest.rotation.y = -0.4; chest.scale.setScalar(0.8); scene.add(chest);
  const inner = glow('#ffd34d', 0); const gp = mesh(new THREE.PlaneGeometry(1.08, 0.66), inner, { pos: [0, 0.626, 0], rot: [-Math.PI / 2, 0, 0], cast: false }); chest.add(gp);
  const chev = makeLogo({ tile: false, allGold: true }); chev.scale.setScalar(0.001); scene.add(chev);
  const pl = new THREE.PointLight('#ffd76a', 0, 6); scene.add(pl);
  const glowL = new THREE.PointLight('#ffcf4a', 0, 2); glowL.position.set(0.82, 0.75, 0.4); scene.add(glowL);
  // voice: "דרגה" ~0.9, "בהבנה של כסף" ~1.95
  const RANK = 0.85, L2 = s.line2 || 1.95;
  const R = rng(21);
  // plain point coins burst out of the chest to the right and back (never across his face), a second puff on line 2
  const burst = Array.from({ length: 18 }, (_, i) => { const c = makeCoin('', 0.16); scene.add(c); return { c, a: i < 12 ? 0.7 + i * 0.05 : L2 + (i - 12) * 0.05, to: [1.5 + R() * 1.2, -1.6, -0.3 - R() * 0.9], h: 2.1 + R() * 0.8 }; });
  const cam = camera(30);
  const cap = caption(L, ['ואתה עולה דרגה.', '<span class="gold">בהבנה של כסף.</span>'], 150);
  return {
    scene, camera: cam, update(t) {
      aimMix(cam, [0.15, 2.35, 12.2], [0.15, 2.45, 11.3], [0.15, 1.95, 0], [0.15, 2.05, 0], inout(lin(t, 0, s.dur)));
      const lk = out(lin(t, 0.4, 0.7)); chest.lid.rotation.x = -1.35 * lk;
      chest.beam.visible = false; inner.emissiveIntensity = 1.6 * lk; glowL.intensity = 2 * lk;
      burst.forEach(({ c, a, to, h }) => { const k = flyArc(c, t, a, 0.9, [0.82, 0.72, 0.4], to, h, 12); c.visible = t >= a && k < 1; });
      // the gold rank chevrons pop in above his head (no spin through edge-on), pulse again on line 2
      const rk = out(lin(t, RANK, RANK + 0.5)), p2 = hitPulse(t, [L2], 0.45);
      chev.position.set(-0.4, mix(3.3, 3.43, rk) + (t > RANK + 0.5 ? wave(t - RANK - 0.5, 0.9, 0.03) : 0), -0.2);
      chev.scale.setScalar(Math.max(0.001, 0.52 * pop(t, RANK, 0.4) * (1 + 0.12 * p2)));
      chev.rotation.set(0, 0.6 * (1 - rk) + (t > RANK + 0.5 ? wave(t, 0.5, 0.12) : 0), 0);
      pl.position.copy(chev.position).add(new THREE.Vector3(0, 0, 0.8)); pl.intensity = 5 * lin(t, RANK, RANK + 0.35) + 6 * p2;
      const party = t > RANK + 0.1;
      hero.pose({ ...idle(t), bob: party ? Math.abs(wave(t - RANK, 1.7, 0.16)) : 0, mouth: t > 0.45 ? (party ? 'open' : 'o') : 'smile', eyeScale: t > 0.45 && !party ? 1.15 : 1, browY: t > 0.45 ? 1 : 0,
        lookY: party ? 0.9 : -0.6, look: party ? 0 : 0.6, nod: party ? -0.15 : 0.15, armL: party ? { raise: 2.5, bend: 0.4 } : { raise: 0.3, fwd: 0.4 }, armR: party ? { raise: 2.5, bend: 0.4 } : { raise: 0.3, fwd: 0.4 } });
      showCap(cap, t, -0.1, L2 + 0.05);
    }
  };
};

// ======================= end card =======================
STAGES.end = (s, L, TEX) => {
  const scene = studioScene('#13866a', '#032e24');
  const logo = makeLogo(); scene.add(logo);
  const R = rng(31);
  // plain gold point coins (no currency signs) falling at the sides, clear of the text
  const rain = Array.from({ length: 14 }, (_, i) => { const c = makeCoin('', 0.2); c.userData = { x: (i % 2 ? 1 : -1) * (2.25 + R() * 0.6), z: -4 - R() * 3, sp: 1.2 + R() * 1.2, ph: R() * 6, rs: 2 + R() * 4 }; scene.add(c); return c; });
  L.classList.add('end3d'); L.style.justifyContent = 'center'; L.style.height = '1920px';
  const sp = add(L, 'spacer', '');
  add(L, 'brand', 'דריבית'); add(L, 'tag', s.tag || 'לומדים על כסף, כמה דקות ביום');
  const url = add(L, 'url', 'dribit.app'); const btn = add(L, 'btn', s.btn || 'לתפוס מקום ברשימה');
  add(L, 'sub', s.sub || 'בחינם. <b>נבנה על ידי חייל, בשביל חיילים.</b>');
  // disclaimer sits right under the sub line; the whole block stays above TikTok's bottom UI
  add(L, 'foot', s.foot || 'מידע כללי לחינוך פיננסי, לא ייעוץ השקעות.', { position: 'static', marginTop: '16px', fontSize: '36px', opacity: 0.9 });
  L.style.paddingBottom = '340px'; L.style.boxSizing = 'border-box';
  const cam = camera(30); aim(cam, [0, 0, 12], [0, 0, 0]);
  L.style.display = 'flex'; const r = sp.getBoundingClientRect(); L.style.display = 'none';
  const half = 12 * Math.tan(15 * Math.PI / 180);
  const ly = (1 - 2 * ((r.top + r.height / 2) / H)) * half;
  return {
    scene, camera: cam, update(t) {
      L.style.display = L.style.display === 'none' ? 'none' : 'flex';
      const k = back(lin(t, 0, 0.55));
      logo.position.set(0, ly, 0); logo.scale.setScalar(Math.max(0.001, 0.68 * k));
      // a quarter turn in, so the blank back of the tile never faces the camera
      logo.rotation.set(wave(t, 0.4, 0.06), (1 - out(lin(t, 0, 0.7))) * -Math.PI * 0.5 + wave(t, 0.35, 0.18), 0);
      logo.chevrons.forEach((c, i) => { c.position.z = 0.17 - i * 0.01 + 0.12 * pop(t, 0.35 + i * 0.12); });
      rain.forEach(c => { const u = c.userData; const y = 7 - ((t * u.sp + u.ph) % 14); c.position.set(u.x, y, u.z); c.rotation.set(t * u.rs, t * u.rs * 0.7, 0); });
      url.style.transform = `scale(${0.85 + 0.15 * back(lin(t, 0.2, 0.55))})`;
      btn.style.transform = `scale(${t > 0.8 ? 1 + 0.04 * Math.sin((t - 0.8) * 6) : out(lin(t, 0.3, 0.7))})`;
    }
  };
};

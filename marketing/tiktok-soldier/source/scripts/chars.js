// Cartoon characters, props and backdrops for the Dribit soldier TikToks.
// A character is an SVG (viewBox 500x900, feet at y=880) with named parts that
// pose() moves every frame. No real army insignia: plain olive uniform only.

const C = {
  olive: '#5f6e3c', oliveD: '#4b5730', oliveL: '#76874c', pants: '#53602f', boots: '#2a2622',
  gold: '#f2b52f', green: '#3ddc97', ink: '#1c1a17', mouth: '#5b1e22', tongue: '#e8737b',
};
const SKINS = { a: ['#f2c7a0', '#dca983'], b: ['#d9a272', '#bf875a'], c: ['#a8714d', '#8d5c3c'] };

function hairSvg(style, col) {
  if (style === 'curly') {
    const pts = [[150, 250], [175, 205], [215, 182], [258, 175], [300, 186], [338, 210], [358, 250], [140, 290], [362, 292], [235, 170], [280, 172], [195, 190], [322, 196]];
    return pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="38" fill="${col}"/>`).join('') +
      `<path d="M140 300 Q150 230 250 222 Q350 230 362 300 Q340 252 250 248 Q160 252 140 300Z" fill="${col}"/>`;
  }
  if (style === 'long') {
    return `<path d="M128 330 Q120 160 250 158 Q380 160 372 330 Q350 230 300 215 Q268 250 200 240 Q160 250 128 330Z" fill="${col}"/>`;
  }
  if (style === 'buzz') {
    return `<path d="M134 290 Q132 175 250 170 Q368 175 366 290 Q352 225 250 215 Q148 225 134 290Z" fill="${col}"/>`;
  }
  // short with a quiff
  return `<path d="M132 300 Q124 168 252 160 Q380 166 368 300 Q360 238 326 222 Q296 246 250 236 Q196 248 168 226 Q140 244 132 300Z" fill="${col}"/>
    <path d="M196 176 Q250 128 318 168 Q276 160 246 186Z" fill="${col}"/>`;
}

function torsoSvg(o) {
  if (o.outfit === 'hoodie') {
    return `<path d="M196 418 Q250 470 304 418 L318 440 Q250 500 182 440Z" fill="${o.shirtD}"/>
      <path d="M150 472 Q150 428 205 424 L295 424 Q350 428 350 472 L360 652 Q360 670 342 670 L158 670 Q140 670 140 652Z" fill="${o.shirt}"/>
      <path d="M190 560 h120 l14 70 h-148z" fill="${o.shirtD}" opacity=".55"/>
      <path d="M234 440 v62 M266 440 v62" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".85"/>
      <rect x="146" y="640" width="208" height="30" rx="12" fill="${o.shirtD}"/>`;
  }
  if (o.outfit === 'tee') {
    return `<path d="M150 472 Q150 428 205 424 L295 424 Q350 428 350 472 L360 652 Q360 670 342 670 L158 670 Q140 670 140 652Z" fill="${o.shirt}"/>
      <path d="M212 424 Q250 462 288 424" fill="none" stroke="${o.shirtD}" stroke-width="10"/>
      <text x="250" y="575" text-anchor="middle" font-family="Rubik" font-weight="900" font-size="64" fill="#fff" opacity=".9">${o.tee || '★'}</text>`;
  }
  // plain olive work uniform, no insignia
  return `<path d="M150 472 Q150 428 205 424 L295 424 Q350 428 350 472 L360 652 Q360 670 342 670 L158 670 Q140 670 140 652Z" fill="${C.olive}"/>
    <path d="M150 472 Q150 428 205 424 L232 424 L180 668 L158 668 Q140 668 140 650Z" fill="${C.oliveD}" opacity=".35"/>
    <path d="M208 424 L250 486 L226 424Z M292 424 L250 486 L274 424Z" fill="${C.oliveD}"/>
    <path d="M250 486 V640" stroke="${C.oliveD}" stroke-width="5"/>
    <circle cx="250" cy="520" r="6" fill="${C.oliveD}"/><circle cx="250" cy="572" r="6" fill="${C.oliveD}"/>
    <rect x="172" y="500" width="58" height="62" rx="8" fill="${C.oliveL}" stroke="${C.oliveD}" stroke-width="4"/>
    <path d="M168 500 h66 v18 q-33 10 -66 0z" fill="${C.oliveD}"/>
    <rect x="270" y="500" width="58" height="62" rx="8" fill="${C.oliveL}" stroke="${C.oliveD}" stroke-width="4"/>
    <path d="M266 500 h66 v18 q-33 10 -66 0z" fill="${C.oliveD}"/>
    <rect x="150" y="430" width="44" height="16" rx="6" fill="${C.oliveD}" transform="rotate(8 172 438)"/>
    <rect x="306" y="430" width="44" height="16" rx="6" fill="${C.oliveD}" transform="rotate(-8 328 438)"/>
    <rect x="142" y="628" width="216" height="26" rx="8" fill="#39361f"/>
    <rect x="236" y="626" width="30" height="30" rx="5" fill="#9a8f55"/>`;
}

function armSvg(side, o) {
  // side L: shoulder at (168,455); R: (332,455). Hand 190px below.
  const x = side === 'L' ? 168 : 332;
  const sleeve = o.outfit === 'uniform' ? C.olive : o.shirt;
  const sleeveD = o.outfit === 'uniform' ? C.oliveD : o.shirtD;
  const shortSleeve = o.outfit === 'tee' || o.outfit === 'uniform';
  return `<g class="arm${side}">
    <rect x="${x - 27}" y="438" width="54" height="${shortSleeve ? 104 : 168}" rx="26" fill="${sleeve}"/>
    ${o.outfit === 'uniform' ? `<rect x="${x - 29}" y="528" width="58" height="20" rx="9" fill="${sleeveD}"/>` : ''}
    <rect x="${x - 21}" y="${shortSleeve ? 530 : 590}" width="42" height="${shortSleeve ? 104 : 46}" rx="20" fill="${o.skin}"/>
    <g class="slot${side}" transform="translate(${x} 645)"></g>
    <circle cx="${x}" cy="645" r="27" fill="${o.skin}"/>
    <path d="M${x - 14} 640 q14 -10 28 0" stroke="${o.skinD}" stroke-width="4" fill="none" opacity=".6"/>
  </g>`;
}

function headSvg(o) {
  const longBack = o.hairStyle === 'long'
    ? `<path d="M126 300 Q112 470 150 520 L350 520 Q388 470 374 300Z" fill="${o.hair}"/>` : '';
  return `<g class="head">
    ${longBack}
    <rect x="226" y="396" width="48" height="46" rx="14" fill="${o.skinD}"/>
    <circle cx="134" cy="318" r="25" fill="${o.skin}"/><circle cx="366" cy="318" r="25" fill="${o.skin}"/>
    <circle cx="136" cy="318" r="11" fill="${o.skinD}" opacity=".6"/><circle cx="364" cy="318" r="11" fill="${o.skinD}" opacity=".6"/>
    <ellipse cx="250" cy="300" rx="118" ry="126" fill="${o.skin}"/>
    <ellipse cx="250" cy="392" rx="70" ry="22" fill="${o.skinD}" opacity=".25"/>
    ${hairSvg(o.hairStyle, o.hair)}
    <circle cx="182" cy="350" r="19" fill="#ff8a80" opacity=".33"/><circle cx="318" cy="350" r="19" fill="#ff8a80" opacity=".33"/>
    <g class="eyeL"><ellipse cx="206" cy="306" rx="22" ry="27" fill="#fff"/><g class="pupL"><circle cx="208" cy="310" r="13" fill="${C.ink}"/><circle cx="212" cy="304" r="4.5" fill="#fff"/></g></g>
    <g class="eyeR"><ellipse cx="294" cy="306" rx="22" ry="27" fill="#fff"/><g class="pupR"><circle cx="296" cy="310" r="13" fill="${C.ink}"/><circle cx="300" cy="304" r="4.5" fill="#fff"/></g></g>
    <g class="money" style="display:none">
      <text x="206" y="324" text-anchor="middle" font-family="Rubik" font-weight="900" font-size="46" fill="${C.gold}" stroke="#7a5200" stroke-width="2">₪</text>
      <text x="294" y="324" text-anchor="middle" font-family="Rubik" font-weight="900" font-size="46" fill="${C.gold}" stroke="#7a5200" stroke-width="2">₪</text>
    </g>
    <path class="browL" d="M180 266 Q205 254 230 264" stroke="${o.hair}" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path class="browR" d="M270 264 Q295 254 320 266" stroke="${o.hair}" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M244 334 Q250 346 258 334" stroke="${o.skinD}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path class="m-smile" d="M218 366 Q250 396 282 366" stroke="${C.mouth}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g class="m-open" style="display:none"><path d="M214 360 Q250 424 286 360 Z" fill="${C.mouth}"/><ellipse cx="250" cy="390" rx="18" ry="9" fill="${C.tongue}"/><path d="M218 361 h64 v8 q-32 6 -64 0z" fill="#fff"/></g>
    <g class="m-talk" style="display:none"><ellipse cx="250" cy="374" rx="24" ry="15" fill="${C.mouth}"/><ellipse cx="250" cy="382" rx="12" ry="5" fill="${C.tongue}"/></g>
    <ellipse class="m-o" style="display:none" cx="250" cy="378" rx="17" ry="22" fill="${C.mouth}"/>
    <path class="m-flat" style="display:none" d="M226 374 Q250 368 274 374" stroke="${C.mouth}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path class="m-smirk" style="display:none" d="M224 372 Q258 388 284 360" stroke="${C.mouth}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path class="sweat" style="display:none" d="M372 232 q16 26 0 36 q-16 -10 0 -36z" fill="#8fd3ff" stroke="#4aa3d8" stroke-width="3"/>
  </g>`;
}

function personSvg(o) {
  return `<svg viewBox="0 0 500 900" width="${o.w}" height="${o.w * 1.8}" overflow="visible">
    <ellipse cx="250" cy="882" rx="150" ry="20" fill="rgba(0,0,0,.3)"/>
    <g class="fig">
      <rect x="190" y="640" width="52" height="220" rx="22" fill="${o.outfit === 'uniform' ? C.pants : o.pants}"/>
      <rect x="258" y="640" width="52" height="220" rx="22" fill="${o.outfit === 'uniform' ? C.pants : o.pants}"/>
      <path d="M172 846 h74 v34 h-82 q-8 0 -8 -10 q0 -24 16 -24z" fill="${o.outfit === 'uniform' ? C.boots : o.shoes}"/>
      <path d="M254 846 h74 q16 0 16 24 q0 10 -8 10 h-82z" fill="${o.outfit === 'uniform' ? C.boots : o.shoes}"/>
      ${torsoSvg(o)}
      ${headSvg(o)}
      ${armSvg('L', o)}
      ${armSvg('R', o)}
    </g>
  </svg>`;
}

const PROPS = {
  phone: (glow = true) => `${glow ? '<circle cx="0" cy="-30" r="120" fill="url(#pglow)" opacity=".9"/>' : ''}
    <g transform="rotate(-8)"><rect x="-40" y="-120" width="80" height="150" rx="14" fill="#141414"/>
    <rect x="-33" y="-110" width="66" height="128" rx="8" fill="#0d6b55"/>
    <rect x="-24" y="-98" width="48" height="10" rx="5" fill="${C.gold}"/>
    <rect x="-24" y="-80" width="48" height="16" rx="5" fill="#fff" opacity=".85"/>
    <rect x="-24" y="-58" width="48" height="16" rx="5" fill="#fff" opacity=".85"/>
    <rect x="-24" y="-36" width="48" height="16" rx="5" fill="${C.green}"/></g>`,
  bill: (cur = '₪', rot = -12, dx = 0, dy = -10) => {
    const f = cur === '$' ? ['#9bd18e', '#3f7a3c', '#dff3d8'] : ['#f4a64a', '#b56a12', '#ffe2b8'];
    return `<g transform="translate(${dx} ${dy}) rotate(${rot})">
      <rect x="-88" y="-50" width="176" height="100" rx="10" fill="${f[0]}" stroke="${f[1]}" stroke-width="5"/>
      <rect x="-74" y="-37" width="148" height="74" rx="6" fill="none" stroke="${f[1]}" stroke-width="3" opacity=".6"/>
      <circle cx="0" cy="0" r="30" fill="${f[2]}" stroke="${f[1]}" stroke-width="3"/>
      <text x="0" y="16" text-anchor="middle" font-family="Rubik" font-weight="900" font-size="44" fill="${f[1]}">${cur}</text>
      <text x="-60" y="-14" font-family="Rubik" font-weight="800" font-size="20" fill="${f[1]}">${cur === '$' ? '100' : '200'}</text>
    </g>`;
  },
  fan: (cur) => PROPS.bill(cur, -34, -16, -18) + PROPS.bill(cur, -12, 0, -26) + PROPS.bill(cur, 10, 14, -30),
};
const PHONE_GLOW_DEF = `<svg width="0" height="0" style="position:absolute"><defs><radialGradient id="pglow"><stop offset="0" stop-color="#7dffd0" stop-opacity=".55"/><stop offset="1" stop-color="#7dffd0" stop-opacity="0"/></radialGradient></defs></svg>`;

function makePerson(opts) {
  const sk = SKINS[opts.skinTone || 'a'];
  const o = Object.assign({ w: 440, skin: sk[0], skinD: sk[1], hair: '#2a1c13', hairStyle: 'short', outfit: 'uniform',
    shirt: '#3d7fc1', shirtD: '#2f6299', pants: '#2f3b52', shoes: '#f4f4f4' }, opts);
  const el = document.createElement('div'); el.className = 'actor';
  el.innerHTML = personSvg(o);
  const q = c => el.querySelector('.' + c);
  const P = { fig: q('fig'), head: q('head'), armL: q('armL'), armR: q('armR'), slotL: q('slotL'), slotR: q('slotR'),
    eyeL: q('eyeL'), eyeR: q('eyeR'), pupL: q('pupL'), pupR: q('pupR'), browL: q('browL'), browR: q('browR'),
    money: q('money'), sweat: q('sweat'),
    mouths: { smile: q('m-smile'), open: q('m-open'), talk: q('m-talk'), o: q('m-o'), flat: q('m-flat'), smirk: q('m-smirk') } };
  const st = { propL: null, propR: null, mouth: 'smile' };
  const a = {
    el, o, P,
    place(x, y, scale = 1, flip = false) { // x,y = feet position on the 1080x1920 stage
      el.style.left = (x - o.w / 2) + 'px'; el.style.top = (y - o.w * 1.8 * 880 / 900) + 'px';
      el.style.transformOrigin = '50% 97.8%';
      el.style.transform = `scale(${flip ? -scale : scale}, ${scale})`;
      a.flip = flip; return a;
    },
    pose(p) {
      const bob = p.bob || 0, sq = p.squash || 0;
      P.fig.setAttribute('transform', `translate(0 ${bob}) translate(250 880) scale(${1 + sq} ${1 - sq}) translate(-250 -880)`);
      P.head.setAttribute('transform', `rotate(${p.head || 0} 250 430)` + (p.headY ? ` translate(0 ${p.headY})` : ''));
      const aL = p.armL ?? 8, aR = p.armR ?? -8;
      P.armL.setAttribute('transform', `rotate(${aL} 168 455)`);
      P.armR.setAttribute('transform', `rotate(${aR} 332 455)`);
      for (const side of ['L', 'R']) {
        const key = p['prop' + side] || null, slot = P['slot' + side];
        if (key !== st['prop' + side]) { slot.innerHTML = key ? (typeof key === 'string' ? (PROPS[key.split(':')[0]] || (() => ''))(...key.split(':').slice(1)) : '') : ''; st['prop' + side] = key; }
        const ang = side === 'L' ? aL : aR;
        const x = side === 'L' ? 168 : 332;
        const ps = p['propScale' + side] ?? 1;
        slot.setAttribute('transform', `translate(${x} 645) rotate(${-ang}) scale(${a.flip ? -ps : ps} ${ps})`);
      }
      const m = p.mouth || 'smile';
      if (m !== st.mouth) { Object.entries(P.mouths).forEach(([k, e]) => e.style.display = k === m ? '' : 'none'); st.mouth = m; }
      const bl = clamp(p.blink ?? 1, 0.06, 1.3);
      P.eyeL.setAttribute('transform', `translate(206 306) scale(1 ${bl}) translate(-206 -306)`);
      P.eyeR.setAttribute('transform', `translate(294 306) scale(1 ${bl}) translate(-294 -306)`);
      const lx = p.look || 0, ly = p.lookY || 0;
      P.pupL.setAttribute('transform', `translate(${lx} ${ly})`); P.pupR.setAttribute('transform', `translate(${lx} ${ly})`);
      const showMoney = !!p.money; P.money.style.display = showMoney ? '' : 'none';
      P.pupL.style.display = P.pupR.style.display = showMoney ? 'none' : '';
      const by = p.brows || 0, bt = p.browTilt || 0;
      P.browL.setAttribute('transform', `translate(0 ${by}) rotate(${bt} 205 262)`);
      P.browR.setAttribute('transform', `translate(0 ${by}) rotate(${-bt} 295 262)`);
      P.sweat.style.display = p.sweat ? '' : 'none';
    },
  };
  return a;
}

// --- motion helpers -------------------------------------------------------
const wave = (t, f, a = 1, ph = 0) => Math.sin((t * f + ph) * Math.PI * 2) * a;
const talkMouth = (t, a, b, alt = 'smile') => (t >= a && t <= b) ? (Math.floor(t * 9) % 3 === 0 ? 'talk' : (Math.floor(t * 9) % 3 === 1 ? 'open' : alt)) : alt;
const blinkAt = (t, times) => { for (const x of times) { const d = Math.abs(t - x); if (d < 0.09) return 0.1 + d * 10; } return 1; };
const ease = (t, a, b, fn = out) => fn(lin(t, a, b));
const popScale = (t, a) => t < a ? 0 : back(lin(t, a, a + 0.32));

// --- stage furniture ------------------------------------------------------
function addEl(L, cls, html, style) { const e = el('div', cls, html); if (style) Object.assign(e.style, style); L.append(e); return e; }

function caption(L, lines, top = 150) {
  const e = addEl(L, 'cap2', lines.map(x => `<div>${x}</div>`).join(''), { top: top + 'px' });
  return e;
}
function bubble(L, html, x, y, w, tail = 'down-right', kind = 'white') {
  const e = addEl(L, 'bubl ' + kind + ' t-' + tail, html, { left: x + 'px', top: y + 'px', width: w + 'px' });
  return e;
}
function showPop(e, t, a, from = 0.6) { const k = popScale(t, a); e.style.opacity = clamp(lin(t, a, a + 0.12)); e.style.transform = `scale(${from + (1 - from) * k})`; }

function bgNight(L) {
  L.classList.add('bg-night');
  const stars = [];
  for (let i = 0; i < 46; i++) {
    const s = addEl(L, 'star', '', { left: (37 * i * 7.3 % 1040) + 'px', top: (60 + (i * 53 % 760)) + 'px', width: (i % 5 === 0 ? 9 : 6) + 'px', height: (i % 5 === 0 ? 9 : 6) + 'px' });
    stars.push(s);
  }
  addEl(L, 'moon', '');
  addEl(L, 'hill', '');
  addEl(L, 'post', `<svg viewBox="0 0 360 620" width="360" height="620">
      <rect x="20" y="70" width="320" height="34" rx="6" fill="#2b2f2a"/>
      <path d="M0 80 L180 10 L360 80Z" fill="#363b34"/>
      <rect x="40" y="104" width="280" height="420" fill="#4a4f45"/>
      <rect x="70" y="150" width="220" height="120" rx="8" fill="#1d2b2a"/>
      <rect x="70" y="150" width="220" height="120" rx="8" fill="#7dffd0" opacity=".08"/>
      <rect x="40" y="500" width="280" height="30" fill="#3a3e36"/>
      <g fill="#6b6f5f"><rect x="40" y="320" width="280" height="14"/><rect x="40" y="380" width="280" height="14"/><rect x="40" y="440" width="280" height="14"/></g>
    </svg>`);
  addEl(L, 'fence', '<svg viewBox="0 0 1080 200" width="1080" height="200"><g stroke="#6e7466" stroke-width="5" fill="none" opacity=".7"><path d="M0 40 H1080 M0 100 H1080 M0 160 H1080"/>' + Array.from({ length: 12 }, (_, i) => `<path d="M${i * 96} 20 V200"/><path d="M${i * 96} 40 L${i * 96 + 96} 100 M${i * 96 + 96} 40 L${i * 96} 100"/>`).join('') + '</g></svg>');
  addEl(L, 'ground night', '');
  return { stars };
}
function bgDay(L) {
  L.classList.add('bg-day');
  addEl(L, 'sun', '');
  addEl(L, 'cloud c1', ''); addEl(L, 'cloud c2', '');
  addEl(L, 'bld', `<svg viewBox="0 0 1080 520" width="1080" height="520">
      <rect x="40" y="120" width="420" height="400" rx="10" fill="#d9c9a3"/><rect x="40" y="100" width="420" height="40" rx="8" fill="#b9a77d"/>
      <g fill="#7fa7a0">${[0, 1, 2, 3].map(i => `<rect x="${80 + i * 95}" y="190" width="60" height="80" rx="6"/><rect x="${80 + i * 95}" y="320" width="60" height="80" rx="6"/>`).join('')}</g>
      <rect x="600" y="210" width="420" height="310" rx="10" fill="#cdbb92"/><rect x="600" y="190" width="420" height="36" rx="8" fill="#ad9b70"/>
      <g fill="#7fa7a0">${[0, 1, 2, 3].map(i => `<rect x="${640 + i * 95}" y="270" width="60" height="80" rx="6"/>`).join('')}</g>
      <rect x="760" y="400" width="100" height="120" rx="8" fill="#6f5b3e"/>
    </svg>`);
  addEl(L, 'ground day', '');
}
function bgStudio(L) { L.classList.add('bg-studio'); addEl(L, 'spot', ''); addEl(L, 'ground studio', ''); }

// floating "+10", flames, badges
function floater(L, html, x, y, cls = '') { return addEl(L, 'floater ' + cls, html, { left: x + 'px', top: y + 'px' }); }
function animFloater(e, t, a, rise = 140, life = 1.1) {
  const k = lin(t, a, a + life);
  e.style.opacity = t < a ? 0 : (k < 0.75 ? clamp(lin(t, a, a + 0.12)) : 1 - lin(k, 0.75, 1));
  e.style.transform = `translateY(${-rise * out(k)}px) scale(${0.6 + 0.4 * back(lin(t, a, a + 0.3))})`;
}

// --- the stage scenes -----------------------------------------------------
const STAGES = {};

// s1 scene A: night guard duty, bored
STAGES.guard = {
  setup(L, s) {
    s.bg = bgNight(L);
    s.cap = caption(L, ['<span class="gold">4 שעות</span> שמירה.'], 200);
    s.clock = addEl(L, 'clockchip', '02:00 🌙', { left: '380px', top: '360px' });
    s.p = makePerson({ skinTone: 'a', hairStyle: 'short' }); L.append(s.p.el); s.p.place(560, 1640, 1.25);
    s.z = [0, 1, 2].map(i => floater(L, 'z', 740 + i * 40, 840 - i * 60, 'zz'));
  },
  update(t, s) {
    s.bg.stars.forEach((e, i) => e.style.opacity = 0.35 + 0.65 * Math.abs(wave(t, 0.6 + (i % 4) * 0.2, 1, i * 0.13)));
    showPop(s.cap, t, 0.05, 0.8); showPop(s.clock, t, 0.45);
    const yawn = t > 0.9 && t < 2.2;
    s.p.pose({ bob: wave(t, 0.5, 4), armL: 10, armR: yawn ? -150 : -8 + wave(t, 0.5, 2), head: yawn ? -6 : wave(t, 0.4, 2),
      mouth: yawn ? 'o' : 'flat', blink: yawn ? 0.15 : (t > 2.2 ? 0.55 : blinkAt(t, [0.5])), brows: yawn ? -10 : 4, propR: null, look: -4 });
    s.z.forEach((e, i) => animFloater(e, t, 1.0 + i * 0.35, 120, 1.3));
  },
};

// s1 scene B: phone out, points and level-up
STAGES.guardPhone = {
  setup(L, s) {
    s.bg = bgNight(L);
    s.cap = caption(L, ['<span class="gold">3 דקות</span> מהן,', 'ואתה מבין בכסף.'], 170);
    s.p = makePerson({ skinTone: 'a', hairStyle: 'short' }); L.append(s.p.el); s.p.place(560, 1640, 1.25);
    s.f = [floater(L, '+10', 250, 820, 'pts'), floater(L, '+10', 760, 760, 'pts'), floater(L, '🔥 6', 230, 1050, 'chip'), floater(L, 'שלב 7!', 690, 1010, 'chip gold')];
    s.at = [0.55, 1.05, 1.5, 1.95];
  },
  update(t, s) {
    s.bg.stars.forEach((e, i) => e.style.opacity = 0.35 + 0.65 * Math.abs(wave(t, 0.6 + (i % 4) * 0.2, 1, i * 0.13)));
    showPop(s.cap, t, 0.05, 0.8);
    const raise = ease(t, 0.0, 0.35);
    s.p.pose({ bob: wave(t, 1.1, 5), armL: 10, armR: 8 + 24 * raise, propR: 'phone', head: 4 + wave(t, 0.8, 2), lookY: 6, look: -10,
      mouth: t > 0.6 ? (t > 1.9 ? 'open' : 'smile') : 'flat', blink: blinkAt(t, [1.3]), brows: t > 1.9 ? -10 : 0, squash: t > 1.9 && t < 2.1 ? 0.03 : 0 });
    s.f.forEach((e, i) => animFloater(e, t, s.at[i], 110, 1.6));
  },
};

// s1 scene D: next day, friend asks, he explains
STAGES.explain = {
  setup(L, s) {
    bgDay(L);
    s.cap = caption(L, ['ומחר, <span class="gold">אתה</span> זה', 'שמסביר לחבר\'ה.'], 130);
    s.f = makePerson({ skinTone: 'c', hairStyle: 'curly', hair: '#16100c' }); L.append(s.f.el); s.f.place(270, 1720, 1.08);
    s.p = makePerson({ skinTone: 'a', hairStyle: 'short' }); L.append(s.p.el); s.p.place(800, 1720, 1.14);
    s.b1 = bubble(L, 'אחי, מה זה בכלל<br><b>S&amp;P 500</b>? 🤔', 70, 560, 470, 'down-left');
    s.b2 = bubble(L, 'כ-500 חברות גדולות בארה״ב.<br>קונים את כולן <b>בבת אחת</b>.', 300, 790, 720, 'down-right', 'gold');
    s.wow = floater(L, '🤯', 190, 820, 'emoji');
    s.at = [0.3, 1.2, 2.3];
  },
  update(t, s) {
    showPop(s.cap, t, 0.0, 0.85); showPop(s.b1, t, 0.3); showPop(s.b2, t, 1.2);
    s.f.pose({ bob: wave(t, 0.9, 4), armL: 10, armR: t < 1.1 ? -40 + wave(t, 2, 8) : -8, head: t < 1.1 ? 5 : -4,
      mouth: t > 2.2 ? 'o' : talkMouth(t, 0.3, 1.0), blink: t > 2.2 ? 1.25 : blinkAt(t, [1.6]), brows: t > 2.2 ? -16 : 0, look: 8 });
    animFloater(s.wow, t, 2.3, 60, 3);
    s.p.pose({ bob: wave(t, 0.9, 4, 0.3), armL: t > 1.1 ? 60 + wave(t, 2.4, 10) : 8, armR: -8, head: t > 1.1 ? -4 : 3,
      mouth: talkMouth(t, 1.2, 2.3, 'smile'), blink: blinkAt(t, [0.7, 2.6]), look: -9, brows: t > 1.2 ? -6 : 0 });
  },
};

// s2 scene A: scam message, money eyes
STAGES.scam = {
  setup(L, s) {
    bgStudio(L);
    s.cap = caption(L, ['מבטיחים לך', '<span class="red">5% בשבוע?</span>'], 130);
    s.msg = addEl(L, 'wa', `<div class="wa-h"><div class="wa-av">💰</div><div><b>השקעות VIP 🚀</b><br><span>קבוצת טלגרם · 8,412 חברים</span></div></div>
      <div class="wa-b">תשואה של <b>5% בשבוע</b>.<br>מובטח! 💸 רק היום מצטרפים 👇</div>`, { left: '150px', top: '470px' });
    s.p = makePerson({ skinTone: 'b', hairStyle: 'buzz', hair: '#1d1410' }); L.append(s.p.el); s.p.place(540, 1760, 1.12);
    s.at = [0.5];
  },
  update(t, s) {
    showPop(s.cap, t, 0.0, 0.85); showPop(s.msg, t, 0.5, 0.5);
    const tempted = t > 1.1;
    s.p.pose({ bob: wave(t, 1.2, 5), armL: tempted ? 115 + wave(t, 3, 8) : 10, propL: 'fan:₪', armR: 30, propR: 'phone:',
      mouth: tempted ? 'open' : 'smile', money: tempted, head: tempted ? wave(t, 2, 4) : 0, lookY: tempted ? 0 : -6, brows: tempted ? -12 : 0, blink: blinkAt(t, [0.8]) });
  },
};

// s2 scene B: stamp "עוקץ", he catches it
STAGES.stamp = {
  setup(L, s) {
    bgStudio(L);
    s.cap = caption(L, ['זה <span class="red">עוקץ</span>.', 'ואתה תזהה אותו.'], 130);
    s.msg = addEl(L, 'wa', `<div class="wa-h"><div class="wa-av">💰</div><div><b>השקעות VIP 🚀</b><br><span>קבוצת טלגרם · 8,412 חברים</span></div></div>
      <div class="wa-b">תשואה של <b>5% בשבוע</b>.<br>מובטח! 💸 רק היום מצטרפים 👇</div>`, { left: '150px', top: '470px', opacity: 1 });
    s.stampEl = addEl(L, 'stamp', 'עוקץ', { left: '330px', top: '540px' });
    s.p = makePerson({ skinTone: 'b', hairStyle: 'buzz', hair: '#1d1410' }); L.append(s.p.el); s.p.place(540, 1760, 1.12);
    s.at = [0.45];
  },
  update(t, s) {
    showPop(s.cap, t, 0.0, 0.85);
    const k = lin(t, 0.45, 0.62);
    s.stampEl.style.opacity = t < 0.45 ? 0 : 1;
    s.stampEl.style.transform = `rotate(-14deg) scale(${t < 0.45 ? 2.4 : 2.4 - 1.4 * out(k)})`;
    s.msg.style.filter = t > 0.6 ? 'grayscale(.8) brightness(.8)' : 'none';
    s.msg.style.transform = t > 0.45 && t < 0.75 ? `translateX(${wave(t, 18, 8)}px)` : 'none';
    const smart = t > 0.7;
    const away = ease(t, 0.7, 1.2);
    s.p.pose({ bob: wave(t, 1, 4), armL: smart ? 10 + 105 * (1 - away) : 115, propL: 'fan:₪', propScaleL: 1 - 0.85 * away, armR: smart ? -150 + wave(t, 2, 6) : 30, propR: smart ? null : 'phone:',
      mouth: smart ? 'smirk' : 'o', money: false, brows: smart ? 6 : -14, browTilt: smart ? -8 : 0, head: smart ? -5 : 0, blink: smart ? 0.75 : 1.2 });
  },
};

// s3 scene A: friends talk investing, he is lost
STAGES.trioLost = {
  setup(L, s) {
    bgDay(L);
    s.cap = caption(L, ['החבר\'ה מדברים', 'על השקעות,', 'ואתה <span class="gold">רק מהנהן?</span>'], 110);
    s.a = makePerson({ skinTone: 'c', hairStyle: 'curly', hair: '#16100c', w: 380 }); L.append(s.a.el); s.a.place(190, 1690, 1);
    s.b = makePerson({ skinTone: 'a', hairStyle: 'long', hair: '#5a3418', outfit: 'tee', shirt: '#e45d7a', shirtD: '#b8435e', tee: '$', pants: '#31406b', w: 380 }); L.append(s.b.el); s.b.place(890, 1690, 1);
    s.p = makePerson({ skinTone: 'b', hairStyle: 'short', hair: '#2a1c13', w: 400 }); L.append(s.p.el); s.p.place(540, 1740, 1.08);
    s.b1 = bubble(L, 'קניתי <b>ETF</b> 😎', 30, 640, 430, 'down-left');
    s.b2 = bubble(L, 'בדולר או בשקל?', 580, 700, 470, 'down-right');
    s.b3 = bubble(L, '😅 ???', 400, 870, 280, 'down', 'gold');
    s.at = [0.35, 1.0, 1.7];
  },
  update(t, s) {
    showPop(s.cap, t, 0.0, 0.85); showPop(s.b1, t, 0.35); showPop(s.b2, t, 1.0); showPop(s.b3, t, 1.7);
    s.a.pose({ bob: wave(t, 0.9, 4), armL: 8, armR: -55 + wave(t, 2, 6), mouth: talkMouth(t, 0.35, 1.0), look: 6, blink: blinkAt(t, [1.4]) });
    s.b.pose({ bob: wave(t, 0.9, 4, 0.4), armL: 70 + wave(t, 2, 6), armR: -8, propL: 'bill:$', mouth: talkMouth(t, 1.0, 1.6), look: -9, blink: blinkAt(t, [0.6, 2.2]) });
    const lookSide = t < 1.0 ? -10 : (t < 1.7 ? 10 : wave(t, 1.6, 10));
    s.p.pose({ bob: wave(t, 1.4, 3) + (t > 1.7 ? wave(t, 3, 6) : 0), armL: 45, propL: 'bill:₪', armR: -45, propR: 'bill:$', head: t > 1.7 ? wave(t, 1.6, 8) : (t < 1.0 ? -6 : 6),
      look: lookSide, mouth: t > 1.7 ? 'flat' : 'smile', sweat: t > 1.7, brows: t > 1.7 ? -4 : 0, browTilt: t > 1.7 ? 12 : 0, blink: blinkAt(t, [0.9]) });
  },
};

// s3 scene B: spotlight, phone, points
STAGES.levelUp = {
  setup(L, s) {
    bgStudio(L);
    s.cap = caption(L, ['כמה דקות ביום', 'ב<span class="gold">דריבית</span>,'], 150);
    s.p = makePerson({ skinTone: 'b', hairStyle: 'short', hair: '#2a1c13' }); L.append(s.p.el); s.p.place(540, 1740, 1.18);
    s.bar = addEl(L, 'xpbar', '<div class="fill"></div><span>שלב 6 → 7</span>', { left: '190px', top: '470px' });
    s.f = [floater(L, '+10', 220, 760, 'pts'), floater(L, '+10', 760, 720, 'pts'), floater(L, '+10', 260, 980, 'pts'), floater(L, 'שלב 7!', 640, 940, 'chip gold')];
    s.at = [0.35, 0.75, 1.15, 1.6];
  },
  update(t, s) {
    showPop(s.cap, t, 0.0, 0.85); showPop(s.bar, t, 0.15, 0.8);
    s.bar.querySelector('.fill').style.width = (30 + 70 * ease(t, 0.35, 1.6, inout)) + '%';
    s.f.forEach((e, i) => animFloater(e, t, s.at[i], 120, 1.4));
    s.p.pose({ bob: wave(t, 1.2, 5), armL: 10, armR: 32, propR: 'phone', head: 4, lookY: 6, look: -10, mouth: t > 1.6 ? 'open' : 'smile', brows: t > 1.6 ? -10 : 0, blink: blinkAt(t, [0.9]), squash: t > 1.6 && t < 1.75 ? 0.03 : 0 });
  },
};

// s3 scene C: he explains, friends amazed
STAGES.trioWin = {
  setup(L, s) {
    bgDay(L);
    s.cap = caption(L, ['ואתה <span class="gold">זה שמסביר.</span>'], 140);
    s.a = makePerson({ skinTone: 'c', hairStyle: 'curly', hair: '#16100c', w: 380 }); L.append(s.a.el); s.a.place(190, 1690, 1);
    s.b = makePerson({ skinTone: 'a', hairStyle: 'long', hair: '#5a3418', outfit: 'tee', shirt: '#e45d7a', shirtD: '#b8435e', tee: '$', pants: '#31406b', w: 380 }); L.append(s.b.el); s.b.place(890, 1690, 1);
    s.p = makePerson({ skinTone: 'b', hairStyle: 'short', hair: '#2a1c13', w: 400 }); L.append(s.p.el); s.p.place(540, 1740, 1.08);
    s.b1 = bubble(L, '<b>ETF</b> זה קרן סל:<br>קונים הרבה מניות בבת אחת.<br>והכי חשוב: <b>דמי ניהול נמוכים.</b>', 150, 440, 780, 'down', 'gold');
    s.w1 = floater(L, '🤯', 120, 900, 'emoji'); s.w2 = floater(L, '😮', 840, 900, 'emoji');
    s.sp = [floater(L, '✨', 360, 900, 'emoji sm'), floater(L, '✨', 660, 880, 'emoji sm')];
    s.at = [0.25, 1.3];
  },
  update(t, s) {
    showPop(s.cap, t, 0.0, 0.85); showPop(s.b1, t, 0.25);
    s.p.pose({ bob: wave(t, 1, 4), armL: 70 + wave(t, 2.2, 12), armR: -70 + wave(t, 2.2, 10, 0.5), propL: 'bill:₪', propR: 'bill:$', head: wave(t, 0.8, 3),
      mouth: talkMouth(t, 0.25, 1.3, 'smile'), brows: -6, blink: blinkAt(t, [1.6]) });
    const amazed = t > 1.3;
    s.a.pose({ bob: wave(t, 0.9, 4), armL: amazed ? 150 : 8, armR: amazed ? -150 : -8, mouth: amazed ? 'o' : 'smile', blink: amazed ? 1.25 : 1, brows: amazed ? -16 : 0, look: 8 });
    s.b.pose({ bob: wave(t, 0.9, 4, 0.4), armL: amazed ? 150 : 70, armR: amazed ? -150 : -8, propL: 'bill:$', mouth: amazed ? 'o' : 'smile', blink: amazed ? 1.25 : 1, brows: amazed ? -16 : 0, look: -9 });
    animFloater(s.w1, t, 1.3, 70, 3); animFloater(s.w2, t, 1.4, 70, 3);
    s.sp.forEach((e, i) => animFloater(e, t, 1.5 + i * 0.2, 90, 1.2));
  },
};

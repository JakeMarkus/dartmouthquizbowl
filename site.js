async function loadContent() {
  const res = await fetch('content.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Unable to load content.json (${res.status})`);
  return await res.json();
}

function setActiveNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll('.nav a').forEach(a => {
    if (a.dataset.page === page) a.classList.add('active');
  });
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('data-')) node.setAttribute(k, v);
    else node[k] = v;
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

function setupHeader() {
  const bar = document.getElementById('topbar');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('siteNav');
  const onScroll = () => bar && bar.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  if (!toggle || !nav) return;
  const setOpen = open => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('click', e => { if (!bar.contains(e.target)) setOpen(false); });
}

// home page: the banner starts big and, as you scroll, shrinks (its bottom edge rides the top of the page below)
// into the normal compact banner, where it stays put.
function setupBigBanner() {
  const bar = document.getElementById('topbar');
  const spacer = document.querySelector('.banner-spacer');
  if (!bar || !spacer) return;
  const root = document.documentElement;
  const update = () => {
    const small = parseFloat(getComputedStyle(root).getPropertyValue('--head-h')) || 64;
    const big = spacer.offsetHeight;
    const h = Math.max(small, big - window.scrollY);
    const p = big > small ? (big - h) / (big - small) : 1;
    bar.style.setProperty('--bh', h.toFixed(1) + 'px');
    bar.style.setProperty('--p', p.toFixed(4));
    bar.style.setProperty('--sub', Math.max(0, 1 - p * 3).toFixed(3));
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

// photos drift up from the bottom like big embers, grow to full size, hover (with a little wobble)
// above the bonfire and trivia card, then float away. One at a time, whole picture always visible.
function setupStageBackground(data) {
  const root = document.getElementById('photoPanel');
  const stage = document.getElementById('stage');
  if (!root || !stage) return;
  const photos = [];
  const add = s => { if (s && !photos.includes(s)) photos.push(s); };
  ((data.home && data.home.collage) || []).forEach(c => add(c && c.src));
  (data.tournaments || []).forEach(t => (t.photos || []).forEach(p => add(p && p.src)));
  if (!photos.length) return;
  for (let i = photos.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [photos[i], photos[k]] = [photos[k], photos[i]];
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let pos = 0;
  let retries = 0;
  const landscape = new Map();                                      // src -> true/false once its shape is known
  const pick = async () => photos[pos++ % photos.length];

  const DUR = 9000, DUR_NARROW = 6000;                           // vertical mode: photos stay a shorter time
  const isNarrow = () => window.matchMedia('(max-width: 980px)').matches;
  const spawn = async () => {
    const dur = isNarrow() ? DUR_NARROW : DUR;
    const src = await pick();
    if (!src) return;
    if (isNarrow()) {                                               // vertical mode: the picture fades in and out in its own section
      const strip = document.getElementById('stripImg');
      if (!strip) return;
      strip.classList.remove('on');
      let pick2 = src;                                              // horizontal pictures only here
      for (let t = 0; t < photos.length; t++) {
        const known = landscape.get(pick2);
        if (known !== false) break;
        pick2 = photos[pos++ % photos.length];
      }
      strip.onload = () => {
        if (strip.naturalWidth < strip.naturalHeight && retries++ < photos.length) { landscape.set(pick2, false); spawn(); return; }
        retries = 0; landscape.set(pick2, true);
        strip.classList.add('on'); setTimeout(() => strip.classList.remove('on'), dur - 700);
      };
      strip.src = pick2;
      return;
    }
    const sh = stage.getBoundingClientRect();
    const headEl = stage.querySelector('.quiz-head');
    const headTop = headEl ? headEl.getBoundingClientRect().top - sh.top : sh.height * 0.6;
    const H = Math.max(96, Math.min(headTop - 44, 560));            // room above the trivia heading
    const W = Math.min(sh.width * 0.9, 640);
    const cy = 20 + H / 2;                                          // where it hovers (centre of the open sky)
    const fig = document.createElement('figure');
    fig.className = 'fp';
    const img = document.createElement('img');
    img.alt = '';
    img.style.maxHeight = H + 'px';
    img.style.maxWidth = W + 'px';
    fig.append(img);
    fig.style.top = cy + 'px';
    root.append(fig);
    img.onload = () => {
      if (reduce) { fig.style.opacity = '1'; fig.style.transform = 'translate(-50%,-50%)'; setTimeout(() => fig.remove(), dur); return; }
      const startY = sh.height - cy + 80;                           // from below the bottom edge
      const T = (x, y, s, r) => `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s}) rotate(${r.toFixed(2)}deg)`;
      const kf = [{ transform: T(0, startY, .1, -3), opacity: 0, offset: 0, easing: 'cubic-bezier(.2,.7,.2,1)' },
                  { transform: T(0, 0, 1, 0), opacity: 1, offset: .2 }];
      const n = 9, ph = Math.random() * 6.28;
      for (let k = 1; k <= n; k++) {                                // the hover: a teeny bit of wobble
        const t = k / n;
        kf.push({ transform: T(Math.sin(ph + t * 5) * 5, Math.cos(ph + t * 4) * 5, 1, Math.sin(ph + t * 3) * 1.1), opacity: 1, offset: .2 + t * .58 });
      }
      kf.push({ transform: T(Math.sin(ph) * 14, -150, 1.12, 2), opacity: 0, offset: 1, easing: 'ease-in' });
      const anim = fig.animate(kf, { duration: dur, easing: 'linear', fill: 'forwards' });
      anim.onfinish = () => fig.remove();
    };
    img.onerror = () => fig.remove();
    img.src = src;
  };
  let timer = 0;
  const gap = () => isNarrow() ? DUR_NARROW + 600 : DUR - 1900;   // vertical mode: leave the fire visible between photos
  const loop = () => { spawn(); timer = setTimeout(loop, gap()); };
  loop();

  // when the bonfire sits in the photo spot (narrow screens), an answer sends the photo away
  // and holds the next one back for a few seconds so the fire can play
  // crossing into / out of vertical mode: clear whatever photo is showing right away
  window.matchMedia('(max-width: 980px)').addEventListener('change', () => {
    root.querySelectorAll('.fp').forEach(f => { f.getAnimations().forEach(a => a.cancel()); f.remove(); });
    Bonfire.hidePhoto(1);
    const si = document.getElementById('stripImg'); if (si) si.classList.remove('on');
    clearTimeout(timer);
    timer = setTimeout(loop, 1200);
  });
}

// ── HOME ──────────────────────────────────────────────────────────────────────

// Add these helpers somewhere above renderHome()

function getCollageColumns(width) {
  if (width < 640) return 1;
  if (width < 980) return 2;
  return 3;
}

function layoutCollage(collage) {
  const items = Array.from(collage.querySelectorAll('.masonry-item'));
  if (!items.length) return;

  const gap = 16;
  const width = collage.clientWidth;
  const cols = getCollageColumns(width);
  const colWidth = (width - gap * (cols - 1)) / cols;

  const heights = Array(cols).fill(0);

  items.forEach(item => {
    const img = item.querySelector('img');
    const ratio =
      img && img.naturalWidth && img.naturalHeight
        ? img.naturalHeight / img.naturalWidth
        : 0.75; // fallback while an image is still loading

    const itemHeight = colWidth * ratio;

    let colIndex = 0;
    for (let i = 1; i < cols; i++) {
      if (heights[i] < heights[colIndex]) colIndex = i;
    }

    const left = colIndex * (colWidth + gap);
    const top = heights[colIndex];

    item.style.position = 'absolute';
    item.style.left = `${left}px`;
    item.style.top = `${top}px`;
    item.style.width = `${colWidth}px`;

    heights[colIndex] += itemHeight + gap;
  });

  collage.style.height = `${Math.max(...heights) - gap}px`;
}

function scheduleCollageLayout(collage) {
  let raf = null;
  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => layoutCollage(collage));
  };
}
function renderHome(data) {
  const heroTitle = document.getElementById('heroTitle');
  const heroBlurb = document.getElementById('heroBlurb');
  const introTitle = document.getElementById('introTitle');
  const introText  = document.getElementById('introText');
  const collage    = document.getElementById('collage');

  if (heroTitle) heroTitle.textContent = data.home.heroTitle;
  if (heroBlurb) heroBlurb.textContent = data.home.heroBlurb;
  if (introTitle) introTitle.textContent = data.home.introTitle;
  if (introText)  introText.textContent  = data.home.introText;

  if (collage && Array.isArray(data.home.collage)) {
    collage.innerHTML = '';
    collage.classList.add('masonry-collage');
    collage.style.position = 'relative';
    collage.style.width = '100%';

    const relayout = scheduleCollageLayout(collage);

    data.home.collage.forEach(item => {
      if (!item || !item.src) return;

      const fig = document.createElement('figure');
      fig.className = 'masonry-item';

      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.alt || '';
      img.loading = 'eager';
      img.decoding = 'async';
      img.style.display = 'block';
      img.style.width = '100%';
      img.style.height = 'auto';

      img.addEventListener('load', relayout);
      img.addEventListener('error', () => {
        fig.remove();
        relayout();
      });

      fig.appendChild(img);
      collage.appendChild(fig);
    });

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(relayout);
      ro.observe(collage);
    } else {
      window.addEventListener('resize', relayout);
    }

    relayout();
  }
}

// ── BONFIRE SCENE ─────────────────────────────────────────────────────────────

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}, kids = []) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  kids.forEach(c => n.append(c));
  return n;
}

const CYCLE = 5; // every 5 in a row the bonfire goes up in a blaze and comes down

// The Homecoming bonfire: a tall, slightly tapering tower of stacked timbers (no nails),
// filled with pallets, topped with the first-year class numeral.
const Bonfire = {
  root: null, flames: [], embers: [], glow: null,
  build(root) {
    this.root = root;


    const flamePath = () => {
      const h = 130, w = 22 + Math.random() * 16, lean = (Math.random() - .5) * 30, k = Math.random();
      const f = n => n.toFixed(1);
      return `M0,0 C${f(-w * 1.35)},-6 ${f(-w * 1.45)},${f(-h * .35)} ${f(-w * .75)},${f(-h * .56)} ` +
        `C${f(-w * .5)},${f(-h * (.68 + k * .08))} ${f(lean - w * .2)},${f(-h * .86)} ${f(lean)},${-h} ` +
        `C${f(lean + w * .25)},${f(-h * .8)} ${f(w * .6)},${f(-h * (.66 + k * .06))} ${f(w * .8)},${f(-h * .5)} ` +
        `C${f(w * 1.5)},${f(-h * .3)} ${f(w * 1.35)},-6 0,0 Z`;
    };
    const stop = (o, c) => svgEl('stop', { offset: o, 'stop-color': c });
    const vgrad = (id, a, b2) => svgEl('linearGradient', { id, x1: 0, y1: 1, x2: 0, y2: 0 }, [stop('0', a), stop('1', b2)]);
    const defs = svgEl('defs', {}, [svgEl('filter', { id: 'hb', x: '-50%', y: '-50%', width: '200%', height: '200%' }, [svgEl('feGaussianBlur', { stdDeviation: 42 })]), vgrad('fo', '#b81d0a', '#ff6a17'), vgrad('fm', '#ff7a16', '#ffc02e'), vgrad('fc', '#ffcf3a', '#fff3b0')]);
    const svg = svgEl('svg', { viewBox: '0 0 360 330', role: 'img', 'aria-label': 'Homecoming bonfire', style: 'overflow:visible' }, [defs]);

    const CX = 180, GY = 322, H = 13, P = 15, N = 16;
    const wAt = i => 92 - i * (30 / 15);
    const topY = GY - H - (N - 1) * P;

    svg.append(svgEl('ellipse', { cx: CX, cy: 326, rx: 150, ry: 6, fill: '#03120c' }));

    // flames burst out from behind and around the tower
    const flames = svgEl('g');
    // a living mass of flames across the logs: dense, overlapping, many sizes, random ignition order
    const pts = [];
    for (let y = topY + 40; y <= GY - 2; y += 17) {
      const half = 86 - ((GY - y) / (GY - topY)) * 22;
      for (let x = CX - half + 4; x <= CX + half - 4; x += 21) {
        const px = x + (Math.random() - .5) * 20, py = y + (Math.random() - .5) * 14;
        const s = Math.max(.28, Math.min(.5 + Math.random() * .42, (py - 70) / 130));
        pts.push([px, py, s, 0]);
      }
    }
    const key = pts.map(p => (GY - p[1]) + Math.random() * 45);
    const rankOf = [];
    pts.map((_, i) => i).sort((a, b) => key[a] - key[b]).forEach((idx, r) => { rankOf[idx] = r; });
    const per = [6, 12, 24, 40, 60, 1e9];
    const tongues = pts.map((p, i) => {
      const rank = rankOf[i];
      return [...p, per.findIndex(c => rank < c)];
    }).sort((p, q) => p[1] - q[1]);
    this.flames = tongues.map(([x, y, s, v, step], i) => {
      const d = flamePath();
      const mk = (sc, fill) => svgEl('path', { d, fill, transform: `scale(${sc})` });
      const t = svgEl('g', { class: 'tongue' }, [mk(1, 'url(#fo)'), mk(.72, 'url(#fm)'), mk(.44, 'url(#fc)')]);
      t.style.setProperty('--d', (1.5 + Math.random() * 1.3).toFixed(2) + 's');
      t.style.setProperty('--dl', (-Math.random() * 3).toFixed(2) + 's');
      const f = svgEl('g', { class: 'flame' }, [t]);
      flames.append(svgEl('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((Math.random() - .5) * 6).toFixed(1)}) scale(${(s * (.75 + Math.random() * .3)).toFixed(2)} ${s.toFixed(2)})` }, [f]));
      if (step === 4) f.classList.add('last');   // the final layer, lit at streak four
      return { el: f, step };
    });


    this.halo = svgEl('ellipse', { cx: CX, cy: 215, rx: 200, ry: 175, fill: '#ff6a17', filter: 'url(#hb)', opacity: 0, class: 'halo' });
    svg.append(this.halo);
    const tower = svgEl('g', { class: 'tower' });

    // dark pallet-filled interior, glowing through the gaps once lit
    const poly = `${CX - 88},${GY} ${CX + 88},${GY} ${CX + 58},${topY} ${CX - 58},${topY}`;
    tower.append(svgEl('polygon', { points: poly, fill: '#130a04', class: 'interior' }));
    this.glow = svgEl('polygon', { points: poly, fill: '#ff7a1a', class: 'glow', opacity: 0 });
    tower.append(this.glow);

    // stacked timbers: every other tier turns 90 degrees, so its ends poke out the sides
    const shades = ['#6d4527', '#58381f'];
    const addTier = (y, w, odd, shade, i, extraH) => {
      const parts = [svgEl('rect', { x: CX - w, y, width: 2 * w, height: H, fill: shade, stroke: '#26140a', 'stroke-width': .8 })];
      if (odd) {
        parts.push(svgEl('rect', { x: CX - w - 9, y, width: 9, height: H, fill: '#3f2616', stroke: '#26140a', 'stroke-width': .8 }));
        parts.push(svgEl('rect', { x: CX + w, y, width: 9, height: H, fill: '#3f2616', stroke: '#26140a', 'stroke-width': .8 }));
      }
      const g = svgEl('g', { class: 'tier' }, parts);
      const low = i < 4;
      const dy = low ? (i % 2) * 2 : (GY - H - y) - Math.random() * 26 - (N - Math.min(i, N)) * 0.4;
      g.style.setProperty('--dx', ((Math.random() - .5) * (low ? 24 : 170)).toFixed(0) + 'px');
      g.style.setProperty('--dy', dy.toFixed(0) + 'px');
      g.style.setProperty('--rot', ((Math.random() - .5) * (low ? 6 : 70)).toFixed(0) + 'deg');
      g.style.setProperty('--dl', (Math.max(0, (N - i)) * 0.035).toFixed(2) + 's');
      return g;
    };
    for (let i = 0; i < N; i++) tower.append(addTier(GY - H - i * P, wAt(i), i % 2 === 1, shades[i % 2], i));
    
    // class-year sign on top
    const sign = svgEl('g', { class: 'tier' }, [
      svgEl('rect', { x: 112, y: 32, width: 136, height: 36, fill: '#2a170c', stroke: '#150b05', 'stroke-width': 1 }),
      svgEl('rect', { x: 124, y: 68, width: 8, height: 16, fill: '#3f2616' }),
      svgEl('rect', { x: 228, y: 68, width: 8, height: 16, fill: '#3f2616' })
    ]);
    const txt = svgEl('text', { x: 180, y: 59, 'text-anchor': 'middle', 'font-size': 27, 'font-weight': 600, 'font-style': 'italic', 'letter-spacing': 1, fill: '#ecd5ae', 'font-family': 'Fraunces, Georgia, serif' });
    txt.textContent = 'DSQBT';
    sign.append(txt);
    sign.style.setProperty('--dx', '30px'); sign.style.setProperty('--dy', '236px'); sign.style.setProperty('--rot', '24deg'); sign.style.setProperty('--dl', '0s');
    tower.append(sign);
    svg.append(tower);
    // a picture frame that sits on the logs but behind the flames (used in vertical mode)
    this.photoRect = svgEl('rect', { fill: 'none' });
    this.photoImg = svgEl('image', { preserveAspectRatio: 'none' });
    this.photoG = svgEl('g', { class: 'bf-photo', 'aria-hidden': 'true' }, [this.photoRect, this.photoImg]);
    this.photoG.style.opacity = '0';
    this.photoAnim = null;
    svg.append(this.photoG);
    flames.setAttribute('class', 'flames');
    svg.append(flames); // in front of the logs

    this.buildEmbers(root);

    root.innerHTML = '';
    root.append(svg);
    this.buildSparks(root);


    this.setStep(0);
  },
  showPhoto(src, dur) {
    const g = this.photoG; if (!g) return;
    const im = new Image();
    im.onload = () => {
      const scale = (this.root && this.root.offsetWidth ? this.root.offsetWidth : 360) / 360;
      const BX = 180, BY = 76, BW = Math.min(300, (window.innerWidth - 8) / scale), BH = 160, pad = 0;   // no frame; keep it on screen          // upper half of the bonfire, just under the DSQBT plaque
      const r = im.naturalWidth / im.naturalHeight;
      let w = BW, h = w / r; if (h > BH) { h = BH; w = h * r; }
      const x = BX - w / 2, y = BY + (BH - h) / 2;
      this.photoRect.setAttribute('x', x - pad); this.photoRect.setAttribute('y', y - pad);
      this.photoRect.setAttribute('width', w + pad * 2); this.photoRect.setAttribute('height', h + pad * 2);
      this.photoImg.setAttribute('href', src);
      ['x', 'y', 'width', 'height'].forEach((k, i) => this.photoImg.setAttribute(k, [x, y, w, h][i]));
      if (this.photoAnim) this.photoAnim.cancel();
      // drift slowly from the left edge of the screen to the right edge, in front of the logs
      const half = window.innerWidth / 2 / scale + w / 2 + pad + 6;
      this.photoAnim = g.animate([{ opacity: 1, transform: `translate(${(-half).toFixed(1)}px, 0px)` }, { opacity: 1, transform: `translate(${half.toFixed(1)}px, 0px)` }],
        { duration: dur, easing: 'linear', fill: 'forwards' });
    };
    im.src = src;
  },
  hidePhoto(ms) {
    const g = this.photoG; if (!g || !this.photoAnim) return;
    const cur = +getComputedStyle(g).opacity || 0;
    this.photoAnim.cancel(); this.photoAnim = null;
    this.photoAnim = g.animate([{ opacity: cur }, { opacity: 0 }], { duration: ms, easing: 'ease-in', fill: 'forwards' });
  },
  buildSparks(root) {
    const layer = el('div', { class: 'sparks', 'aria-hidden': 'true' });
    root.append(layer);
    this.sparks = [];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const R = Math.random, TAU = Math.PI * 2, W = root.offsetWidth || 400;
    const cols = ['#ffe08a', '#ffc04a', '#ff9a2e', '#ff7a1a', '#fff1b8'];
    const NS = 210;
    for (let i = 0; i < NS; i++) {
      const size = 1.5 + R() * 2.6, c = cols[Math.floor(R() * cols.length)];
      const e = el('span', { class: 'spark' });
      e.style.left = (22 + R() * 56).toFixed(1) + '%';
      e.style.bottom = (22 + R() * 45).toFixed(1) + '%';
      e.style.width = e.style.height = size.toFixed(1) + 'px';
      e.style.background = c; e.style.color = c;
      layer.append(e);
      this.sparks.push({ el: e, step: i < 42 ? 0 : 1 + Math.floor(((i - 42) / (NS - 42)) * 5) });
      const rise = (0.55 + R() * 0.5) * ((root.closest('.stage') || document.body).clientHeight || 800), a1 = 18 + R() * 34, f1 = .8 + R() * 1.1, p1 = R() * TAU, drift = (R() - .5) * 90, fl = 4 + R() * 5, flp = R() * TAU;
      const n = 30, pts = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n, y = rise * Math.pow(t, .8);
        const x = drift * t + a1 * Math.sin(t * TAU * f1 + p1) * (0.3 + t);
        const op = Math.pow(1 - t, .9) * Math.min(1, t * 12) * (0.65 + 0.35 * Math.sin(t * TAU * fl + flp));
        pts.push({ transform: `translate(${x.toFixed(1)}px, ${(-y).toFixed(1)}px) scale(${(1 - .6 * t).toFixed(2)})`, opacity: +op.toFixed(3), offset: t });
      }
      e.animate(pts, { duration: 7500 + R() * 8500, iterations: Infinity, delay: -R() * 16000, easing: 'linear' });
    }
  },
  buildEmbers(root) {
    const stage = root.closest('.stage') || document.body;
    stage.querySelectorAll('.embers').forEach(n => n.remove());
    const layer = el('div', { class: 'embers', 'aria-hidden': 'true' });
    stage.append(layer);
    this.embers = [];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colors = ['#ff9a2e', '#ffb347', '#ff7a1a', '#ffd36a', '#ff5a1f', '#ff8a3d', '#ffc15e'];
    const NE = 390, R = Math.random, TAU = Math.PI * 2;
    for (let i = 0; i < NE; i++) {
      const size = 1.8 + R() * 3.2;
      const c = colors[Math.floor(R() * colors.length)];
      const e = el('span', { class: 'ember2' });
      e.style.left = (R() * 100).toFixed(2) + '%';
      e.style.width = e.style.height = size.toFixed(1) + 'px';
      e.style.background = c; e.style.color = c;
      layer.append(e);
      const step = i < 114 ? 0 : 1 + Math.floor(((i - 114) / (NE - 114)) * 5);
      this.embers.push({ el: e, step });
      if (reduce) { e.style.opacity = '.4'; e.style.bottom = (R() * 40) + '%'; continue; }
      // one smooth path: gentle sway on two slow waves, a steady drift up that eases, no stop-and-go
      const rise = (0.45 + R() * 0.5) * (stage.clientHeight || 800);
      const a1 = 20 + R() * 40, a2 = 8 + R() * 18, f1 = 0.6 + R() * 0.9, f2 = 1.6 + R() * 1.6;
      const p1 = R() * TAU, p2 = R() * TAU, drift = (R() - .5) * 140;
      const sp = R() * 0.25, sph = R() * TAU, fl = 3 + R() * 4, flp = R() * TAU;
      const n = 40, pts = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const y = rise * (t + sp * Math.sin(t * TAU + sph) / TAU * 1.2);
        const x = drift * t + a1 * Math.sin(t * TAU * f1 + p1) + a2 * Math.sin(t * TAU * f2 + p2);
        const env = Math.pow(Math.sin(Math.PI * t), 0.8);
        const op = env * (0.5 + 0.5 * (0.6 + 0.4 * Math.sin(t * TAU * fl + flp))) ;
        pts.push({ transform: `translate(${x.toFixed(1)}px, ${(-y).toFixed(1)}px) scale(${(1 - 0.5 * t).toFixed(2)})`, opacity: +op.toFixed(3), offset: t });
      }
      e.animate(pts, { duration: 12000 + R() * 16000, iterations: Infinity, delay: -R() * 28000, easing: 'linear' });
    }
  },
  setStep(n) {
    if (!this.root) return;
    this.flames.forEach(f => f.el.classList.toggle('lit', n >= f.step));
    this.embers.forEach(e => e.el.classList.toggle('off', n < e.step));
    if (this.halo) this.halo.setAttribute('opacity', [0.12, 0.2, 0.28, 0.36, 0.44, 0.5][Math.min(n, 5)]);
    if (this.sparks) this.sparks.forEach(s => s.el.classList.toggle('off', n < s.step));
    if (this.glow) this.glow.setAttribute('opacity', [0.2, 0.32, 0.45, 0.58, 0.7, 0.8][Math.min(n, 5)]);
  },
  collapse() { if (this.root) this.root.classList.add('collapsed'); },
  reset() {
    if (!this.root) return;
    const r = this.root;
    const wasDown = r.classList.contains('collapsed');
    r.classList.add('no-anim');
    r.classList.remove('collapsed');
    this.setStep(0);
    void r.offsetWidth;
    r.classList.remove('no-anim');
    if (wasDown) {
      r.classList.remove('rebuild'); void r.offsetWidth; r.classList.add('rebuild');
      setTimeout(() => r.classList.remove('rebuild'), 800);
    }
  }
};

function setupFireflies() {
  const stage = document.getElementById('stage');
  if (!stage || stage.querySelector('.fireflies')) return;
  const box = document.createElement('div');
  box.className = 'fireflies';
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 16; i++) {
    const f = document.createElement('span');
    f.className = 'fly';
    f.style.left = (4 + Math.random() * 92) + '%';
    f.style.top = (12 + Math.random() * 62) + '%';
    f.style.setProperty('--d', (11 + Math.random() * 12).toFixed(1) + 's');
    f.style.setProperty('--b', (3 + Math.random() * 4).toFixed(1) + 's');
    f.style.setProperty('--dl', (-Math.random() * 10).toFixed(1) + 's');
    f.style.setProperty('--dx', (-60 + Math.random() * 120).toFixed(0) + 'px');
    f.style.setProperty('--dy', (-70 + Math.random() * 90).toFixed(0) + 'px');
    box.append(f);
  }
  stage.append(box);
}

// ── QUIZ ──────────────────────────────────────────────────────────────────────

let quizQuestions = [];
let pool          = [];
let currentIdx    = -1;
let streak        = 0;

function nextQuestionIndex() {
  if (!pool.length) {
    pool = quizQuestions.map((_, i) => i).filter(i => i !== currentIdx || quizQuestions.length === 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[k]] = [pool[k], pool[i]];
    }
  }
  return pool.pop();
}

function streakEl(n) {
  const s = el('span', { class: 'streak' + (n === 0 ? ' cold' : '') });
  s.innerHTML = `<span class="fl">🔥</span><span>Streak</span><b>${n}</b>`;
  return s;
}

function setStreakEl(card, n, prev) {
  const s = card.querySelector('.streak');
  if (!s) return;
  s.classList.toggle('cold', n === 0);
  s.querySelector('b').textContent = n;
  const fl = s.querySelector('.fl');
  if (fl) {
    fl.classList.remove('pop');
    if (n > prev) { void fl.offsetWidth; fl.classList.add('pop'); } // the flame pops on every right answer
  }
}

function buildCard(q, onPick) {
  const card = el('div', { class: 'quiz-card' });
  card.append(el('div', { class: 'quiz-meta' }, [streakEl(streak)]));
  card.append(el('p', { class: 'quiz-question' }, q.question));
  const grid = el('div', { class: 'quiz-choices' });
  q.choices.forEach((choice, i) => {
    const btn = el('button', { class: 'quiz-choice', type: 'button' }, choice);
    if (onPick) btn.addEventListener('click', () => onPick(btn, i));
    grid.append(btn);
  });
  card.append(grid);
  return card;
}

function sizeQuizCard(container) {
  // the card just takes the height its question needs; the stage keeps at least a screen's height
  container.style.setProperty('--card-h', '0px');
}

function positionBonfire() {
  const fire = document.getElementById('bonfire'), col = document.querySelector('.stage-left');
  if (!fire || !col) return;
  if (!window.matchMedia('(min-width: 981px)').matches) {
    // vertical mode: the bottom log rests on the green top of the card; plaque near the top of the stage
    fire.style.left = '';
    const stage = document.getElementById('stage'), card = document.getElementById('quizContainer');
    if (stage && card) {
      // size it for the short question (a ~232px card), every time, whatever the card currently holds;
      // taller cards just cover the bottom of the fire
      const sr = stage.getBoundingClientRect();
      const minH = parseFloat(getComputedStyle(stage).minHeight) || sr.height;
      const strip = document.getElementById('photoStrip');
      const top = strip ? strip.offsetHeight + 10 : 12;                // the fire's sign sits a small gap under the pictures
      const refTop = Math.max(240, minH - 232);
      const w = Math.max(200, Math.min(900, window.innerWidth * 1.5, (refTop - top) / 0.8));
      fire.style.setProperty('--fw', Math.round(w) + 'px');
      fire.style.setProperty('--fb', Math.round(sr.height - refTop - w * 0.03) + 'px');
    }
    return;
  }
  fire.style.removeProperty('--fw'); fire.style.removeProperty('--fb');
  fire.style.left = Math.round(col.getBoundingClientRect().width / 2 - fire.offsetWidth / 2) + 'px';
}

function renderQuiz(data) {
  const container = document.getElementById('quizContainer');
  if (!container) return;
  const fire = document.getElementById('bonfire');
  if (fire) Bonfire.build(fire);
  setupFireflies();
  positionBonfire();
  window.addEventListener('resize', positionBonfire);
  if (window.ResizeObserver) new ResizeObserver(positionBonfire).observe(document.getElementById('stage'));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionBonfire);
  quizQuestions = data.quiz || [];
  if (!quizQuestions.length) {
    container.innerHTML = '<p style="color:#fff">No quiz questions found in content.json.</p>';
    return;
  }
  sizeQuizCard(container);
  showNextQuestion(container);
  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => sizeQuizCard(container), 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => sizeQuizCard(container));
}

function showNextQuestion(container) {
  if (Bonfire.root && Bonfire.root.classList.contains('collapsed')) Bonfire.reset();
  currentIdx = nextQuestionIndex();
  const q = quizQuestions[currentIdx];
  container.innerHTML = '';
  let card;
  card = buildCard(q, (btn, i) => handleAnswer(btn, i, q.answer, card, container));
  container.append(card);
}

// the button pops out underneath the card; the card itself never moves
function popButton(container, label, retry, onClick) {
  const b = el('button', { class: 'quiz-next' + (retry ? ' quiz-next--retry' : ''), type: 'button' }, label);
  b.addEventListener('click', onClick);
  container.append(b);
}

function handleAnswer(btn, chosen, correct, card, container) {
  card.querySelectorAll('.quiz-choice').forEach(b => { b.disabled = true; b.classList.add('quiz-choice--locked'); });

  if (chosen === correct) {
    const prev = streak;
    streak++;
    btn.classList.add('quiz-choice--correct');
    setStreakEl(card, streak, prev);
    if (streak % CYCLE === 0) {
      // full blaze, then it comes crashing down; no Next button until the collapse has played out
      Bonfire.setStep(CYCLE - 1);
      setTimeout(() => Bonfire.collapse(), 500);
      setTimeout(() => popButton(container, 'Next question →', false, () => showNextQuestion(container)), 2600);
    } else {
      Bonfire.setStep(streak % CYCLE);
      popButton(container, 'Next question →', false, () => showNextQuestion(container));
    }
  } else {
    streak = 0;
    btn.classList.add('quiz-choice--wrong');
    const correctBtn = card.querySelectorAll('.quiz-choice')[correct];
    if (correctBtn) correctBtn.classList.add('quiz-choice--reveal');
    setStreakEl(card, 0, streak);
    Bonfire.reset();
    popButton(container, 'Next Question →', true, () => showNextQuestion(container));
  }
}


// ── TOURNAMENTS ───────────────────────────────────────────────────────────────

function scrollCarouselToSlide(track, direction) {
  const slides = Array.from(track.querySelectorAll('.slide'));
  if (!slides.length) return;
  const maxScroll = track.scrollWidth - track.clientWidth;

  const trackRect = track.getBoundingClientRect();
  const trackCenter = trackRect.left + trackRect.width / 2;
  let nearestIndex = 0;
  let nearestDistance = Infinity;

  const storedIndex = Number(track.dataset.activeSlide);
  if (Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < slides.length) {
    nearestIndex = storedIndex;
  } else if (track.scrollLeft <= 1) {
    nearestIndex = 0;
  } else if (track.scrollLeft >= maxScroll - 1) {
    nearestIndex = slides.length - 1;
  } else {
    slides.forEach((slide, index) => {
      const slideRect = slide.getBoundingClientRect();
      const slideCenter = slideRect.left + slideRect.width / 2;
      const distance = Math.abs(slideCenter - trackCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
  }

  const nextIndex = Math.max(0, Math.min(slides.length - 1, nearestIndex + direction));
  const targetSlide = slides[nextIndex];
  const targetRect = targetSlide.getBoundingClientRect();
  let left = track.scrollLeft + targetRect.left - trackRect.left - (track.clientWidth - targetSlide.clientWidth) / 2;

  if (nextIndex === 0) left = 0;
  if (nextIndex === slides.length - 1) left = maxScroll;

  track.dataset.activeSlide = String(nextIndex);
  track.scrollTo({ left, behavior: 'smooth' });
}

function renderTournaments(data) {
  const root = document.getElementById('tournaments');
  if (!root) return;
  root.innerHTML = '';
  data.tournaments.forEach((t, idx) => {
    const section = el('section', { class: 'card tournament' });
    section.append(el('h3', {}, t.name), el('p', { class: 'desc' }, t.description));

    const trackId = `track-${idx}`;
    const track = el('div', { class: 'carousel-track', id: trackId });

    t.photos.forEach(photo => {
      const slide = el('article', { class: 'slide' });
      const inner = el('div', { class: 'slide-inner' });
      const frame = el('div', { class: 'slide-frame' });
      const img = el('img', { src: photo.src, alt: photo.caption || t.name, decoding: 'async' });
      img.addEventListener('load', () => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        slide.style.setProperty('--slide-ratio', `${img.naturalWidth} / ${img.naturalHeight}`);
        slide.style.setProperty('--slide-ratio-number', img.naturalWidth / img.naturalHeight);
        slide.classList.add('slide--loaded');
      });
      frame.append(img);
      inner.append(frame, el('div', { class: 'caption' }, photo.caption || ''));
      slide.append(inner);
      track.append(slide);
    });

    const prev = el('button', { type: 'button', ariaLabel: 'Previous slide' }, '‹');
    const next = el('button', { type: 'button', ariaLabel: 'Next slide' }, '›');
    prev.addEventListener('click', () => scrollCarouselToSlide(track, -1));
    next.addEventListener('click', () => scrollCarouselToSlide(track, 1));

    const carousel = el('div', { class: 'carousel' }, [prev, track, next]);
    section.append(carousel);
    root.append(section);
  });
}

// ── PEOPLE ────────────────────────────────────────────────────────────────────

function renderPeople(data) {
  const current = document.getElementById('currentPeople');
  const alumni  = document.getElementById('alumniPeople');
  if (current) current.innerHTML = '';
  if (alumni)  alumni.innerHTML  = '';

  const makeCard = person => {
    const card  = el('article', { class: 'card person' });
    const photo = el('div', { class: 'photo' });
    photo.append(el('img', { src: person.photo, alt: person.name }));
    const body = el('div', { class: 'body' }, [
      el('div', { class: 'name' }, person.name),
      el('div', { class: 'title' }, person.title),
      el('div', { class: 'bio' }, person.bio)
    ]);
    card.append(photo, body);
    return card;
  };

  data.people.current.forEach(p => current && current.append(makeCard(p)));
  data.people.alumni.forEach(p => alumni && alumni.append(makeCard(p)));
  setupAlumniKey(current, makeCard);
}

function setupAlumniKey(current, makeCard) {
  const key = document.getElementById('alumniKey');
  if (!key || !current) return;

  let letters = 'Alumni'.split('').map((letter, index) => ({ letter, id: `alumni-letter-${index}` }));
  let selectedIndex = null;

  const revealLumina = () => {
    if (current.querySelector('[data-secret-person="lumina"]')) return;

    const card = makeCard({
      name: 'Conall McConnachie',
      title: 'Chair for Peace in the Middle East',
      bio: 'After narrowly coming 2nd in the 2026 presidential election, Conall decided to take it easy and achieve something much easier than running this batty club: enduring peace in the Middle East. With expeditions scheduled to Afganistan, the West Bank, and Yemen, we are confident Conall will build more bridges between our leadership and the world\'s.',
      photo: 'https://aura.dartmouthquizbowl.org/Conall.webp'
    });
    card.dataset.secretPerson = 'lumina';
    card.classList.add('person--secret');
    current.append(card);
  };

  const updateSelectedLetter = () => {
    key.querySelectorAll('.alumni-key-letter').forEach((button, index) => {
      button.classList.toggle('selected', index === selectedIndex);
    });
  };

  const renderLetters = (previousRects = null) => {
    key.innerHTML = '';
    letters.forEach((item, index) => {
      const button = el('button', {
        type: 'button',
        class: index === selectedIndex ? 'alumni-key-letter selected' : 'alumni-key-letter',
        ariaLabel: `Move letter ${item.letter}`,
        draggable: false
      }, item.letter);
      button.dataset.letterId = item.id;
      button.style.cursor = 'default';
      button.addEventListener('dragstart', event => event.preventDefault());

      button.addEventListener('click', () => {
        if (selectedIndex == null) {
          selectedIndex = index;
          updateSelectedLetter();
          return;
        } else if (selectedIndex === index) {
          selectedIndex = null;
          updateSelectedLetter();
          return;
        }

        const previousRects = new Map(
          Array.from(key.querySelectorAll('.alumni-key-letter')).map(letterButton => [
            letterButton.dataset.letterId,
            letterButton.getBoundingClientRect()
          ])
        );

        const moving = letters.splice(selectedIndex, 1)[0];
        letters.splice(index, 0, moving);
        selectedIndex = null;

        const isSolved = letters.map(item => item.letter).join('').toLowerCase() === 'lumina';
        if (isSolved) {
          letters.forEach(item => item.letter = item.letter.toLowerCase());
        } else {
          key.classList.remove('alumni-key--shuffling');
          key.offsetWidth;
          key.classList.add('alumni-key--shuffling');
        }

        renderLetters(previousRects);
        if (isSolved) revealLumina();
      });

      key.append(button);
    });

    if (!previousRects) return;

    requestAnimationFrame(() => {
      key.querySelectorAll('.alumni-key-letter').forEach(button => {
        const previousRect = previousRects.get(button.dataset.letterId);
        if (!previousRect) return;

        const nextRect = button.getBoundingClientRect();
        const dx = previousRect.left - nextRect.left;
        const dy = previousRect.top - nextRect.top;
        if (!dx && !dy) return;
        if (!button.animate) return;

        button.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0, 0)' }
          ],
          { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
      });
    });
  };

  key.classList.add('alumni-key');
  renderLetters();
}

// ── CONTACTS ──────────────────────────────────────────────────────────────────

function renderContacts(data) {
  const list = document.getElementById('contactList');
  if (!list) return;
  list.innerHTML = '';
  data.contacts.forEach(c => {
    const wrap = el('div', { class: 'contact-item' });
    const link = c.href && c.href !== '#' ? el('a', { href: c.href }) : el('span');
    link.textContent = c.value;
    wrap.append(el('div', { class: 'label' }, c.label), el('div', { class: 'value' }, [link]));
    list.append(wrap);
  });
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  setActiveNav();
  setupHeader();
  setupBigBanner();
  try {
    const data = await loadContent();
    renderHome(data);
    renderTournaments(data);
    renderPeople(data);
    renderContacts(data);
    renderQuiz(data);
    setupStageBackground(data);
  } catch (err) {
    console.error(err);
    document.body.insertAdjacentHTML('afterbegin', `<div style="padding:16px;border-bottom:1px solid #c00;background:#fff3f3;color:#700">
      Could not load content.json. Make sure the site is served over HTTP, not opened as a raw file.
    </div>`);
  }
}

document.addEventListener('DOMContentLoaded', main);

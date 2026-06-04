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

// ── HOME ──────────────────────────────────────────────────────────────────────

// Add these helpers somewhere above renderHome()

function getCollageColumns(width) {
  if (width < 640) return 2;
  if (width < 980) return 3;
  return 4;
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

// ── QUIZ ──────────────────────────────────────────────────────────────────────

let quizQuestions = [];
let usedIndices   = [];
let currentIdx    = -1;

function pickQuestion() {
  if (!quizQuestions.length) return -1;
  // Reset when all used
  if (usedIndices.length >= quizQuestions.length) usedIndices = [];
  const available = quizQuestions.map((_, i) => i).filter(i => i !== currentIdx && !usedIndices.includes(i));
  if (!available.length) return -1;
  return available[Math.floor(Math.random() * available.length)];
}

function renderQuiz(data) {
  const container = document.getElementById('quizContainer');
  if (!container) return;
  quizQuestions = data.quiz || [];
  if (!quizQuestions.length) {
    container.innerHTML = '<p style="color:var(--muted)">No quiz questions found in content.json.</p>';
    return;
  }
  showNextQuestion(container);
}

function showNextQuestion(container) {
  currentIdx = pickQuestion();
  if (currentIdx < 0) return;
  usedIndices.push(currentIdx);
  const q = quizQuestions[currentIdx];

  container.innerHTML = '';

  const card = el('div', { class: 'quiz-card' });

  const qText = el('p', { class: 'quiz-question' }, q.question);
  card.append(qText);

  const choiceGrid = el('div', { class: 'quiz-choices' });

  q.choices.forEach((choice, i) => {
    const btn = el('button', { class: 'quiz-choice', 'data-index': String(i) }, choice);
    btn.addEventListener('click', () => handleAnswer(btn, i, q.answer, card, container));
    choiceGrid.append(btn);
  });

  card.append(choiceGrid);
  container.append(card);

  // Animate in
  requestAnimationFrame(() => card.classList.add('quiz-card--visible'));
}

function handleAnswer(btn, chosen, correct, card, container) {
  // Disable all buttons
  card.querySelectorAll('.quiz-choice').forEach(b => {
    b.disabled = true;
    b.classList.add('quiz-choice--locked');
  });

  if (chosen === correct) {
    btn.classList.add('quiz-choice--correct');
    card.classList.add('quiz-card--correct');
    launchConfetti(card);

    // Show "Next question" after a beat
    setTimeout(() => {
      const nextBtn = el('button', { class: 'quiz-next' }, 'Next question →');
      nextBtn.addEventListener('click', () => {
        card.classList.add('quiz-card--exit');
        setTimeout(() => showNextQuestion(container), 400);
      });
      card.append(nextBtn);
    }, 900);
  } else {
    btn.classList.add('quiz-choice--wrong');
    // Reveal correct answer
    const correctBtn = card.querySelectorAll('.quiz-choice')[correct];
    if (correctBtn) correctBtn.classList.add('quiz-choice--reveal');

    setTimeout(() => {
      const retryBtn = el('button', { class: 'quiz-next quiz-next--retry' }, 'Try another →');
      retryBtn.addEventListener('click', () => {
        card.classList.add('quiz-card--exit');
        setTimeout(() => showNextQuestion(container), 400);
      });
      card.append(retryBtn);
    }, 700);
  }
}

function launchConfetti(card) {
  const rect = card.getBoundingClientRect();
  const colors = ['#00693e', '#0c4f2f', '#a8d5b5', '#ffffff', '#f4efe6'];
  const N = 48;

  for (let i = 0; i < N; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    const size = 6 + Math.random() * 8;
    const x = rect.left + rect.width * Math.random();
    const y = rect.top + window.scrollY + rect.height * 0.3;
    const angle = -90 + (Math.random() - 0.5) * 160;
    const dist  = 80 + Math.random() * 200;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const spin  = (Math.random() - 0.5) * 720;
    const isRect = Math.random() > 0.5;

    Object.assign(p.style, {
      position: 'fixed',
      left: x + 'px',
      top:  y + 'px',
      width: size + 'px',
      height: isRect ? size * 0.4 + 'px' : size + 'px',
      borderRadius: isRect ? '1px' : '50%',
      background: color,
      pointerEvents: 'none',
      zIndex: '9999',
      opacity: '1',
      transform: 'translate(-50%,-50%)',
      transition: `transform 1.1s cubic-bezier(.2,.8,.3,1), opacity 1.1s ease`,
      transitionDelay: Math.random() * 0.15 + 's'
    });

    document.body.append(p);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rad = angle * Math.PI / 180;
        const tx  = Math.cos(rad) * dist;
        const ty  = Math.sin(rad) * dist;
        p.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${spin}deg)`;
        p.style.opacity = '0';
      });
    });

    setTimeout(() => p.remove(), 1400);
  }
}

// ── TOURNAMENTS ───────────────────────────────────────────────────────────────

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
      frame.append(el('img', { src: photo.src, alt: photo.caption || t.name }));
      inner.append(frame, el('div', { class: 'caption' }, photo.caption || ''));
      slide.append(inner);
      track.append(slide);
    });

    const prev = el('button', { type: 'button', ariaLabel: 'Previous slide' }, '‹');
    const next = el('button', { type: 'button', ariaLabel: 'Next slide' }, '›');
    prev.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * 0.92, behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: track.clientWidth * 0.92, behavior: 'smooth' }));

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
  try {
    const data = await loadContent();
    renderHome(data);
    renderTournaments(data);
    renderPeople(data);
    renderContacts(data);
    renderQuiz(data);
  } catch (err) {
    console.error(err);
    document.body.insertAdjacentHTML('afterbegin', `<div style="padding:16px;border-bottom:1px solid #c00;background:#fff3f3;color:#700">
      Could not load content.json. Make sure the site is served over HTTP, not opened as a raw file.
    </div>`);
  }
}

document.addEventListener('DOMContentLoaded', main);

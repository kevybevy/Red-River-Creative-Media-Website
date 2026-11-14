// Global layers across the maximalist middle:
//  - film grain gets heavier (CSS var --grain on the .grain layer)
//  - "debris" (slate notes, crop marks, rules, redaction bars) multiplies.
//    It lives in a frame around the edges of the screen. On top of that, any
//    piece that would land on a scene's copy is measured and hidden while that
//    scene is on screen (data-hide + .hold-<scene> on <html>).
//  - a HUD shows a scroll-driven timecode and the current section
//
// The field is rebuilt inside animate(), so it follows the current viewport
// whenever gsap.matchMedia re-runs (rotation, resizing across 760px).
import { rng, between, timecode } from './lib/util.js';

const root = document.documentElement;
const debris = document.querySelector('.debris');
// --grain is set on the grain layer itself. On <html> every change would restyle
// the whole page on each scroll frame, because custom properties inherit.
const grain = document.querySelector('.grain');
const field = debris.querySelector('.debris__field');
const tcEl = debris.querySelector('[data-hud-tc]');
const labelEl = debris.querySelector('[data-hud-label]');

const TEXTS = [
  'REC', 'TAKE 03', 'TAKE 11', 'ROLL A014', 'CAM A', 'CAM B', '24 FPS', '1/48', 'ISO 800', 'f/2.8',
  'SCENE 12', 'ROOM TONE', 'SOUND SPEED', 'MARK', 'B ROLL', 'SELECTS', 'V2', 'A1', '[REDACTED]',
  'EXHIBIT 4', 'FILE 2011', 'PAGE 11', 'DRAFT', 'FOR THE RECORD', 'INT. HALLWAY', 'EXT. RIVER',
  'MEDIA FOR GOOD', 'MEDIA FOR ALL', 'PRINT', 'NO MINIMUM', 'OKLAHOMA', 'TEXAS', 'KANSAS', 'ARKANSAS',
];

// Copy to keep clear, per scene.
const PROTECT = {
  studio: ['.redact__page', '.redact__poem'],
  work: ['.collage__intro .kicker', '.collage__intro h2', '.collage__lede', '.plate', '.reel-nav'],
  services: ['.type .kicker', '.type__t', '.type__d'],
  people: ['.person'],
  process: ['.scrawl__steps .kicker', '.hand', '.scrawl__steps p'],
};

/** A spot in the frame around the content: top/bottom bands or the side margins. */
function edgeSpot(r, wide, small) {
  if (small) {
    if (wide || r() < 0.5) return [between(r, 2, 62), between(r, 1.5, 8)]; // top band, left of the Menu chip
    return [r() < 0.5 ? between(r, 1, 3) : between(r, 95, 97), between(r, 16, 70)];
  }
  if (wide || r() < 0.55) {
    const top = r() < 0.5 ? between(r, 7, 13) : between(r, 84, 90);
    return [between(r, 2, 84), top];
  }
  const left = r() < 0.5 ? between(r, 1, 6) : between(r, 93, 97);
  return [left, between(r, 16, 82)];
}

function buildField(small) {
  field.textContent = '';
  const r = rng(2026);
  const n = small ? 22 : 64;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 8;
  const placed = []; // pixel boxes already taken, so pieces never print over each other
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span');
    const k = r();
    let wide = true;
    if (k < 0.42) { el.className = 'frag frag--text'; el.textContent = TEXTS[(r() * TEXTS.length) | 0]; }
    else if (k < 0.5) { el.className = 'frag frag--type'; el.textContent = TEXTS[(r() * TEXTS.length) | 0].toLowerCase().replace(/[aeiou]/g, (c) => (r() < 0.4 ? ' ' : c)); }
    else if (k < 0.57) { el.className = 'frag frag--bar'; el.style.width = `${between(r, 24, 120).toFixed(0)}px`; }
    else if (k < 0.74) { el.className = 'frag frag--rule'; el.style.width = `${between(r, 60, 300).toFixed(0)}px`; }
    else if (k < 0.82) { el.className = 'frag frag--vrule'; el.style.height = `${between(r, 40, 160).toFixed(0)}px`; wide = false; }
    else if (k < 0.9) { el.className = 'frag frag--crop'; el.style.rotate = `${((r() * 4) | 0) * 90}deg`; wide = false; }
    else if (k < 0.96) { el.className = 'frag frag--reg'; wide = false; }
    else { el.className = 'frag frag--dot'; wide = false; }
    field.appendChild(el);
    // Try a few spots in the frame; a piece with no free spot is left out.
    const w = el.offsetWidth || 8;
    const h = el.offsetHeight || 8;
    let spot = null;
    for (let tries = 0; tries < 16 && !spot; tries++) {
      const [x, y] = edgeSpot(r, wide, small);
      const b = { l: (x / 100) * vw - gap, t: (y / 100) * vh - gap, r: (x / 100) * vw + w + gap, b: (y / 100) * vh + h + gap };
      if (small && wide && b.r > vw * 0.7) continue; // keep clear of the Menu chip
      if (!placed.some((p) => b.l < p.r && b.r > p.l && b.t < p.b && b.b > p.t)) spot = [x, y, b];
    }
    if (!spot) { el.remove(); continue; }
    placed.push(spot[2]);
    el.style.left = `${spot[0].toFixed(2)}%`;
    el.style.top = `${spot[1].toFixed(2)}%`;
    el.dataset.t = between(r, 0.04, 0.85).toFixed(3); // when it shows up
    el.dataset.o = between(r, 0.35, 0.9).toFixed(2); // how strong
    // Drift; small screens keep their thin top band, so pieces barely move there.
    el.dataset.v = (between(r, -1, 1) * (small ? 0.15 : 1)).toFixed(3);
  }
  return [...field.children];
}

const DRIFT = 50; // px of vertical drift across the whole middle

/** Mark each fragment with the scenes whose copy it would cover. */
function markOverlaps(frags) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 10;
  const boxes = Object.fromEntries(Object.entries(PROTECT).map(([id, sels]) => {
    const sec = document.getElementById(id);
    const s = sec.getBoundingClientRect();
    const list = [];
    sec.querySelectorAll(sels.join(',')).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (id === 'work') {
        // The reel slides sideways, so its copy passes every x: keep whole
        // horizontal bands clear. For a plate that band is its copy block
        // (measured from the plate, which the copy's entrance offset does not move).
        const top = el.classList.contains('plate') ? r.bottom - el.querySelector('.plate__copy').offsetHeight : r.top;
        list.push({ l: -1e9, r: 1e9, t: top - s.top - pad, b: r.bottom - s.top + pad });
        return;
      }
      list.push({ l: r.left - s.left - pad, r: r.right - s.left + pad, t: r.top - s.top - pad, b: r.bottom - s.top + pad });
    });
    return [id, list];
  }));
  frags.forEach((f) => {
    const w = f.offsetWidth || 8;
    const h = f.offsetHeight || 8;
    const x = (parseFloat(f.style.left) / 100) * vw;
    const y = (parseFloat(f.style.top) / 100) * vh;
    const d = Math.abs(+f.dataset.v) * DRIFT;
    const hide = Object.entries(boxes)
      .filter(([, list]) => list.some((b) => x < b.r && x + w > b.l && y - d < b.b && y + h + d > b.t))
      .map(([id]) => id);
    f.dataset.hide = hide.join(' ');
  });
}

export function animate({ motion, small }) {
  if (!motion) { field.textContent = ''; return; }
  const short = small || window.innerHeight < 560;
  const frags = buildField(short);
  const studio = document.querySelector('#studio');
  const process = document.querySelector('#process');
  const scenes = [...document.querySelectorAll('main section')];

  // Spans from the first scene after the hero to the end of the process pin.
  // Uses the scenes' own pin positions, so pin spacing cannot shift it.
  const tl = gsap.timeline({
    scrollTrigger: {
      start: () => studio._st.start,
      end: () => process._st.end,
      scrub: 0.5,
      invalidateOnRefresh: true,
    },
  });
  tl.fromTo(debris, { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0)
    .fromTo(grain, { '--grain': 0.07 }, { '--grain': 0.2, duration: 0.7, ease: 'none' }, 0)
    .to(grain, { '--grain': 0, duration: 0.04 }, 0.96)
    .to(debris, { opacity: 0, duration: 0.02 }, 0.98);
  frags.forEach((el) => {
    const t = +el.dataset.t;
    tl.fromTo(el, { opacity: 0 }, { opacity: +el.dataset.o, duration: 0.004, ease: 'steps(1)' }, t)
      .fromTo(el, { y: 0 }, { y: +el.dataset.v * DRIFT, duration: 1, ease: 'none' }, 0);
  });

  // Keep copy clear: re-measure after every layout pass, and flag the scene on screen.
  const remark = () => markOverlaps(frags);
  remark();
  ScrollTrigger.addEventListener('refresh', remark);
  const holds = Object.keys(PROTECT).map((id) => {
    const sec = document.getElementById(id);
    return ScrollTrigger.create({
      start: () => sec._st.start,
      end: () => sec._st.end,
      onToggle: (self) => root.classList.toggle(`hold-${id}`, self.isActive),
    });
  });

  // Section label: the last scene whose start is at or above the playhead.
  const startOf = (sec) => {
    if (sec._st) return sec._st.start;
    if (sec.id === 'top') return 0;
    if (sec.id === 'contact') return process._st.end - 2;
    const box = sec.parentElement.classList.contains('pin-spacer') ? sec.parentElement : sec;
    return box.offsetTop;
  };

  // HUD timecode follows the scroll like a playhead (about four minutes total),
  // the label tracks the scene, and grain stops animating on the blank page.
  // Mark the current section in the header and menu (aria-current="location").
  const links = [...document.querySelectorAll('.site-header__nav a, .site-menu__list a')];
  let marked = '';
  const mark = (id) => {
    if (id === marked) return;
    marked = id;
    links.forEach((a) => (a.getAttribute('href') === id ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
  };
  const paint = (y) => {
    const max = ScrollTrigger.maxScroll(window) || 1;
    tcEl.textContent = timecode(Math.min(1, y / max) * 24 * 60 * 4);
    let current = scenes[0];
    for (const sec of scenes) if (startOf(sec) <= y + 1) current = sec;
    if (labelEl.textContent !== current.dataset.label) labelEl.textContent = current.dataset.label;
    mark(y >= process._st.end - 4 ? '#contact' : `#${current.id}`);
    root.classList.toggle('grain-off', y >= process._st.end - 4);
  };
  const hud = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => paint(self.scroll()) });
  // After a re-measure, paint for where the page ended up (not the transient top).
  const repaint = () => paint(window.scrollY);
  ScrollTrigger.addEventListener('refresh', repaint);

  return () => {
    hud.kill();
    ScrollTrigger.removeEventListener('refresh', repaint);
    links.forEach((a) => a.removeAttribute('aria-current'));
    holds.forEach((h) => h.kill());
    ScrollTrigger.removeEventListener('refresh', remark);
    Object.keys(PROTECT).forEach((id) => root.classList.remove(`hold-${id}`));
    root.classList.remove('grain-off');
  };
}

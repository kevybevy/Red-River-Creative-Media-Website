// 01 REDACT (reference 1)
// Starts black (same bars the hero ended on), the bars peel away to a book
// page, marker strokes black out most of the text in reading order, and only
// the kept phrases survive and hold on their own for a while. A photocopier
// scan bar then wipes the page away; the work reel "prints" in after it.
//
// Small or short screens: the page never renders below MIN_SCALE. If it is
// then taller than the screen, the view pans down the page as the strokes
// land, then glides back to the first kept phrase and reads down through the
// kept lines while they hold, so the whole kept message can be read and a
// menu jump lands on its first line.
import { buildWipe, marker } from '../lib/marker.js';
import { WIPE_SEED } from './hero.js';

const section = document.querySelector('.redact');
const page = section.querySelector('.redact__page');
let xs = [];
let bars = [];

const MIN_SCALE = 0.9;

const WORDS_PER_STROKE = 6;

export function build() {
  // Break each redacted phrase into short strokes so they draw one by one.
  section.querySelectorAll('.x').forEach((x, xi) => {
    const words = x.textContent.trim().split(/\s+/);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < words.length; i += WORDS_PER_STROKE) {
      const s = document.createElement('span');
      s.className = 'x';
      s.textContent = words.slice(i, i + WORDS_PER_STROKE).join(' ') + (i + WORDS_PER_STROKE < words.length ? ' ' : '');
      s.style.setProperty('--marker', marker(xi * 31 + i + 5));
      frag.appendChild(s);
    }
    x.replaceWith(frag);
  });
  xs = [...section.querySelectorAll('.x')];
  bars = buildWipe(section.querySelector('.wipe--in'), { count: 7, seed: WIPE_SEED });

}

// Clear of the Menu chip above; a little air below (the HUD steps aside on tall pages).
const TOP = 60;
const BOTTOM = 20;

export function animate({ motion, compact }) {
  if (!motion) return;

  // Fit the page to the screen, but never below MIN_SCALE; measure what is left over.
  let overflow = 0;
  let keptFrom = 0; // page y while the first kept phrase sits under the Menu chip
  let keptTo = 0; // page y while the last kept phrase sits at the bottom
  const fit = () => {
    gsap.set(page, { scale: 1, y: 0 });
    const stage = window.innerHeight * 0.88;
    const s = Math.min(1, (window.innerWidth - 24) / page.offsetWidth, Math.max(stage / page.offsetHeight, window.innerWidth <= 760 ? 1 : MIN_SCALE));
    gsap.set(page, { scale: s });
    overflow = Math.max(0, page.offsetHeight * s - stage);
    section.classList.toggle('is-tall', overflow > 0);
    keptFrom = keptTo = 0;
    if (!overflow) return;
    // Kept phrases in page coordinates (layout values, unaffected by transforms).
    const ks = [...page.querySelectorAll('.k')];
    const top = Math.min(...ks.map((k) => k.offsetTop));
    const bottom = Math.max(...ks.map((k) => k.offsetTop + k.offsetHeight));
    const vh = window.innerHeight;
    const H = page.offsetHeight;
    const onScreen = (py) => vh / 2 + (py - H / 2) * s; // with y = 0 (the page is centered)
    const clampY = (y) => Math.max(-overflow / 2 - vh * 0.06, Math.min(overflow / 2 + vh * 0.06, y));
    if ((bottom - top) * s <= vh - TOP - BOTTOM) {
      keptFrom = keptTo = clampY((TOP + vh - BOTTOM) / 2 - onScreen((top + bottom) / 2));
    } else {
      keptFrom = clampY(TOP - onScreen(top));
      keptTo = clampY(vh - BOTTOM - onScreen(bottom));
    }
  };
  fit();
  ScrollTrigger.addEventListener('refreshInit', fit);

  gsap.set(bars, { clipPath: 'inset(0 0% 0 0%)' });

  // Phones get a longer clean reading beat; tall pages also read down before marking.
  // Proportional pin travel preserves the later animation's original pace.
  const lead = compact ? (overflow > 0 ? 0.9 : 0.55) : 0;
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section, start: 'top top', end: compact ? `+=${Math.round(152.5 * (1 + lead))}%` : '+=230%', pin: true, scrub: 0.7, invalidateOnRefresh: true,
    },
  });
  if (compact) tl.set(page, { y: () => overflow / 2 }, 0);
  // Tall phones first read down the clean page, then return for the marker pass.
  // Increasing pin travel with the lead keeps the later choreography at its original pace.
  if (compact && overflow > 0) {
    tl.fromTo(page, { y: () => overflow / 2 }, { y: () => -overflow / 2, duration: 0.4, ease: 'none', immediateRender: false }, 0.24)
      .to(page, { y: () => overflow / 2, duration: 0.11, ease: 'power2.inOut' }, 0.78);
  }
  // Desktop phases: peel, strokes, kept lines, scan. Compact adds lead before strokes onward.
  tl.to(bars, { clipPath: 'inset(0 0% 0 100%)', duration: 0.08, stagger: 0.008, ease: 'power2.inOut' }, 0)
    .fromTo(page, { rotate: -2.5, yPercent: 6 }, { rotate: 0, yPercent: 0, duration: 0.14, ease: 'power2.out' }, 0)
    .to(xs, { '--p': '100%', duration: 0.04, stagger: 0.38 / xs.length, ease: 'none' }, 0.12 + lead)
    // tall page: pan down it in step with the strokes (no-op when it fits)
    .fromTo(page, { y: () => overflow / 2 }, { y: () => -overflow / 2, duration: 0.44, ease: 'none' }, compact ? 0.12 + lead : 0.1)
    // tall page: back up to the first kept phrase, then read down the kept lines (no-op when it fits)
    .fromTo(page, { y: () => -overflow / 2 }, { y: () => keptFrom, duration: 0.07, ease: 'power2.inOut', immediateRender: false }, 0.56 + lead)
    .fromTo(page, { y: () => keptFrom }, { y: () => keptTo, duration: 0.2, ease: 'none', immediateRender: false }, 0.63 + lead)
    .fromTo('.redact__page .k--red', { color: '#111014' }, { color: '#900000', duration: 0.04 }, 0.56 + lead)
    .to(page, { rotate: 1.2, duration: 0.1 }, 0.58 + lead)
    // photocopier scan
    .fromTo('.redact__scan', { yPercent: -110 }, { y: () => window.innerHeight * 1.5, duration: 0.14, ease: 'none' }, 0.84 + lead)
    .to(page, { opacity: 0.12, filter: 'contrast(4) grayscale(1)', yPercent: -4, duration: 0.14, ease: 'none' }, 0.86 + lead)
    .set({}, {}, 1 + lead);

  section._st = tl.scrollTrigger;
  // Mobile lands in the new unmarked hold; desktop keeps its kept-line landing.
  section._land = () => tl.scrollTrigger.start + (tl.scrollTrigger.end - tl.scrollTrigger.start) * (compact ? 0.22 / (1 + lead) : overflow ? 0.64 : 0.66);

  return () => ScrollTrigger.removeEventListener('refreshInit', fit);
}

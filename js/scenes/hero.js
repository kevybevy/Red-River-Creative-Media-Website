// 00 HERO
// Load: the mono text decodes in, the logo un-blurs, the camera and chair rise.
// Scroll (pinned): the credits scatter like broken type, the sky drains to
// paper, a marker redacts "RedRiver" (leaving "media"), then marker bars
// black out the screen. The redact scene starts from that same black.
//
// Every scroll tween states its start values explicitly (fromTo with
// immediateRender: false). Otherwise a tween could record the load intro's
// half-finished opacity as its start, and scrolling back up would leave the
// camera, mark and cue invisible.
import { splitChars, scramble, rng, between, timecode } from '../lib/util.js';
import { buildWipe, marker } from '../lib/marker.js';

const section = document.querySelector('.hero');
const q = (s) => section.querySelector(s);
let chars = [];
let bars = [];
let logoBar;

export const WIPE_SEED = 11; // shared with redact.js

export function build() {
  section.querySelectorAll('[data-split]').forEach((el) => chars.push(...splitChars(el)));
  bars = buildWipe(q('.wipe--out'), { count: 7, seed: WIPE_SEED });

  logoBar = document.createElement('span');
  logoBar.className = 'logo-redact';
  logoBar.setAttribute('aria-hidden', 'true');
  logoBar.style.backgroundImage = marker(3, { rough: 0.9 });
  q('.hero__word-rr').appendChild(logoBar);
}

export function animate({ motion, compact }) {
  if (!motion) return;

  // Running REC timecode (24 fps), only while the hero is on screen.
  const tcEl = q('[data-timecode]');
  const t0 = performance.now();
  let tick = 0;
  const run = () => { if (!tick) tick = setInterval(() => { tcEl.textContent = timecode(((performance.now() - t0) / 1000) * 24); }, 1000 / 24); };
  const stop = () => { clearInterval(tick); tick = 0; };
  run();

  // Intro on load: about a second, so the REC tag and cue show up quickly.
  document.documentElement.classList.remove('pre-intro'); // same frame as the from() states below
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro
    .from('.hero__sky', { opacity: 0, duration: 1.1, ease: 'none' })
    .from('.hero__mark', { opacity: 0, scale: 0.5, duration: 0.9 }, 0.1)
    .from('.hero__lockup', { opacity: 0, y: 12, filter: 'blur(10px)', duration: 1.1 }, 0.2)
    .from('.hero__line', { opacity: 0, y: 8, duration: 0.8 }, 0.45)
    .from('.set-camera, .set-chair', { opacity: 0, y: 40, duration: 1.1, stagger: 0.15 }, 0.35)
    .from(['.hero__rec', '.hero__cue'], { opacity: 0, duration: 0.6, stagger: 0.1 }, 0.8);
  scramble(chars, { duration: 1000, delay: 350 });

  // Scroll-out
  const r = rng(42);
  const scatter = chars.map(() => ({
    x: between(r, -0.42, 0.42),
    y: between(r, -0.35, 0.45),
    rot: between(r, -70, 70),
    o: between(r, 0.1, 1),
  }));
  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;
  const ir = { immediateRender: false };

  const tl = gsap.timeline({
    scrollTrigger: {
      // Phones: a shorter exit (same choreography, less scroll).
      trigger: section, start: 'top top', end: compact ? '+=85%' : '+=120%', pin: true, scrub: 0.7, invalidateOnRefresh: true,
      onLeave: stop, onEnterBack: run,
    },
  });
  tl.fromTo('.hero__cue', { opacity: 1 }, { opacity: 0, duration: 0.08, ...ir }, 0)
    .fromTo('.set-camera', { x: 0, y: 0, rotate: 0, opacity: 1 }, { x: () => -vw() * 0.25, y: 60, rotate: -8, opacity: 0, duration: 0.45, ease: 'power2.in', ...ir }, 0)
    .fromTo('.set-chair', { x: 0, y: 0, rotate: 0, opacity: 1 }, { x: () => vw() * 0.25, y: 80, rotate: 10, opacity: 0, duration: 0.45, ease: 'power2.in', ...ir }, 0.02)
    .fromTo('.hero__mark', { rotate: 0, scale: 1, opacity: 1 }, { rotate: 220, scale: 3, opacity: 0, duration: 0.45, ...ir }, 0)
    .fromTo('.hero__line', { opacity: 1, y: 0 }, { opacity: 0, y: -14, duration: 0.2, ...ir }, 0.04)
    .fromTo(chars, { x: 0, y: 0, rotate: 0, opacity: 1 }, {
      x: (i) => scatter[i].x * vw(),
      y: (i) => scatter[i].y * vh(),
      rotate: (i) => scatter[i].rot,
      opacity: (i) => scatter[i].o,
      duration: 0.5,
      ease: 'power2.in',
      stagger: { each: 0.003, from: 'random' },
      ...ir,
    }, 0.04)
    .fromTo('.hero__rec', { x: 0, skewX: 0, opacity: 1 }, { x: () => -vw() * 0.3, skewX: 30, opacity: 0, duration: 0.3, ease: 'power3.in', ...ir }, 0.1)
    .fromTo('.hero__sky', { opacity: 1 }, { opacity: 0, duration: 0.35, ...ir }, 0.1)
    .fromTo(logoBar, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.16, ease: 'power1.inOut' }, 0.32)
    .fromTo('.hero__logo', { scale: 1 }, { scale: 1.35, duration: 0.5, ease: 'power1.in', ...ir }, 0.3)
    .fromTo(bars, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.2, stagger: 0.035, ease: 'power2.inOut' }, 0.6);

  section._st = tl.scrollTrigger;
  return stop;
}

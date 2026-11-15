// 03 TYPEWRITER (references 2 and 6)
// Service titles arrive as scattered typewriter characters and lock into
// lines. Broken fragments of the same words litter the sheet and jitter.
// While the list is locked the fragments fade back so every line reads clean.
// On the way out the letters fall off the page.
import { splitChars, rng, between } from '../lib/util.js';

const section = document.querySelector('.type');
const noise = section.querySelector('.type__noise');
let chars = [];
let frags = [];

function breakText(r, text) {
  // Drop, double and space out letters so it reads like a failing typewriter.
  let out = '';
  for (const c of text) {
    const x = r();
    if (x < 0.12) out += ' ';
    else if (x < 0.18) out += c + c;
    else if (x < 0.24) out += c + ' ';
    else out += c;
  }
  return out;
}

let words = [];

export function build() {
  section.querySelectorAll('.type__t').forEach((el) => chars.push(...splitChars(el)));
  words = [...section.querySelectorAll('.type__t .sr-only, .type__d')]
    .map((e) => e.textContent.toLowerCase())
    .join(' ')
    .split(/\s+/);
}

/** Broken typewriter fragments for the current viewport (rebuilt on each matchMedia run). */
function buildNoise(small) {
  noise.textContent = '';
  frags = [];
  const r = rng(99);
  const count = small ? 22 : 70;
  for (let i = 0; i < count; i++) {
    const start = (r() * (words.length - 4)) | 0;
    const text = breakText(r, words.slice(start, start + 1 + ((r() * 3) | 0)).join(' '));
    const span = document.createElement('span');
    span.textContent = text;
    if (r() < 0.3) {
      const blk = document.createElement('i');
      blk.className = 'blk';
      blk.style.width = `${between(r, 0.6, 3.2).toFixed(2)}em`;
      r() < 0.5 ? span.prepend(blk) : span.append(blk);
    }
    if (r() < 0.12) span.style.textDecoration = 'line-through';
    if (r() < 0.1) span.style.textDecoration = 'underline';
    span.style.left = `${between(r, -4, 92).toFixed(1)}%`;
    span.style.top = `${between(r, 2, 96).toFixed(1)}%`;
    span.style.fontSize = `${between(r, 10, 17).toFixed(0)}px`;
    span.style.opacity = between(r, 0.15, small ? 0.45 : 0.7).toFixed(2);
    span.style.letterSpacing = `${between(r, -0.05, 0.3).toFixed(2)}em`;
    noise.appendChild(span);
    frags.push(span);
  }
}

export function animate({ motion, small, compact }) {
  if (!motion) { noise.textContent = ''; frags = []; return; }
  buildNoise(small);

  const r = rng(5);
  const into = chars.map(() => ({ x: between(r, -0.45, 0.45), y: between(r, -0.42, 0.42), rot: between(r, -90, 90), o: between(r, 0.15, 1) }));
  const out = chars.map(() => ({ x: between(r, -0.08, 0.08), y: between(r, 0.5, 0.95), rot: between(r, -140, 140) }));
  const jit = frags.map(() => between(r, -60, 60));
  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight;
  const lis = section.querySelectorAll('.type__list li');
  const descs = section.querySelectorAll('.type__d');
  const nums = section.querySelectorAll('.type__n');

  // Short screens: shrink the sheet just enough to keep the whole list on screen.
  const sheet = section.querySelector('.type__sheet');
  const fit = () => {
    gsap.set(sheet, { scale: 1 });
    // Header chip above, breathing room below (less on landscape phones, where every px counts).
    const room = window.innerHeight - (window.innerHeight <= 520 ? 56 : 72);
    gsap.set(sheet, { scale: Math.min(1, room / sheet.offsetHeight), transformOrigin: '50% 50%' });
  };
  fit();
  ScrollTrigger.addEventListener('refreshInit', fit);

  const fragO = frags.map((f) => +f.style.opacity);
  const tl = gsap.timeline({
    // Phones: a shorter pin with the same choreography and the same share of clean hold.
    scrollTrigger: { trigger: section, start: 'top top', end: compact ? '+=125%' : '+=200%', pin: true, scrub: 0.6, invalidateOnRefresh: true },
  });
  // Timing (fraction of the pin):
  //   0 to 0.34   letters fly in and lock; rules, numbers and kicker appear
  //   0.24 to 0.39 descriptions type out (all complete by 0.39)
  //   0.40 to 0.66 CLEAN HOLD: every line complete and still, noise faded back
  //   0.66 to 0.76 noise returns; the rows stay still (no sideways jump)
  //   0.76 to 1.0 everything falls off the page
  tl.fromTo(chars, {
      x: (i) => into[i].x * vw(), y: (i) => into[i].y * vh(), rotate: (i) => into[i].rot, opacity: (i) => into[i].o,
    }, {
      x: 0, y: 0, rotate: 0, opacity: 1,
      duration: 0.26, ease: 'power3.out', stagger: { each: 0.08 / chars.length, from: 'random' },
    }, 0)
    .fromTo('.type .kicker', { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.03)
    .fromTo(lis, { '--rule': 0 }, { '--rule': 1, duration: 0.12, stagger: 0.025, ease: 'steps(8)' }, 0.04)
    .fromTo(nums, { opacity: 0 }, { opacity: 1, duration: 0.04, stagger: 0.02, ease: 'steps(1)' }, 0.2)
    .fromTo(descs, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.07, stagger: 0.015, ease: 'steps(14)' }, 0.24)
    .to(frags, { x: (i) => jit[i], duration: 0.7, ease: 'steps(6)' }, 0)
    .to(frags, { opacity: 0.06, duration: 0.06, ease: 'steps(3)' }, 0.24)
    .to(frags, { opacity: (i) => fragO[i], duration: 0.03, ease: 'steps(2)' }, 0.66)
    // fall apart
    .to(chars, {
      x: (i) => out[i].x * vw(), y: (i) => out[i].y * vh(), rotate: (i) => out[i].rot, opacity: 0,
      duration: 0.2, ease: 'power2.in', stagger: { each: 0.04 / chars.length, from: 'random' },
    }, 0.76)
    .to([descs, nums, '.type .kicker'], { opacity: 0, duration: 0.08, ease: 'steps(3)' }, 0.77)
    .to(lis, { '--rule': 0, duration: 0.1 }, 0.8)
    .to(frags, { y: () => between(r, 40, 220), opacity: 0, duration: 0.18, stagger: { each: 0.001, from: 'random' }, ease: 'power2.in' }, 0.8)
    .set({}, {}, 1);
  // Phones have no free margin around the list: the slate debris dims while the
  // lines type out, and during the clean hold the leftover fragments and debris
  // clear completely, so nothing ghosts behind the copy. Both return for the exit.
  if (compact || window.innerHeight < 560) {
    tl.to('.debris__field', { opacity: 0.15, duration: 0.05 }, 0.24)
      .to([document.querySelector('.debris__field'), ...frags], { opacity: 0, duration: 0.02 }, 0.37)
      .to('.debris__field', { opacity: 1, duration: 0.04 }, 0.66);
  }

  section._st = tl.scrollTrigger;
  section._land = () => tl.scrollTrigger.start + (tl.scrollTrigger.end - tl.scrollTrigger.start) * 0.53;

  return () => ScrollTrigger.removeEventListener('refreshInit', fit);
}

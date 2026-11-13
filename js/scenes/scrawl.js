// 05 SCRAWL (reference 7) and the erase to white
// Pencil and ink handwriting builds up across the page while the three steps
// are written in. Ink drops land. At the peak a white circle opens from the
// center and wipes everything away. The contact page fades in on the same
// white as the circle completes, so there is no blank screen in between.
import { rng, between } from '../lib/util.js';

const section = document.querySelector('.scrawl');
const svg = section.querySelector('.scrawl__svg');

/** One line of fake cursive built from looping cycloid "letters". */
function cursive(r, x0, y0, width, size) {
  let d = '';
  let x = x0;
  let y = y0;
  const slant = between(r, 0.15, 0.4);
  while (x < x0 + width) {
    const letters = 2 + ((r() * 7) | 0);
    d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
    for (let l = 0; l < letters; l++) {
      const a = size * between(r, 0.45, 0.95);
      const h = size * between(r, 0.5, 1.3) * (r() < 0.14 ? 2.3 : 1) * (r() < 0.08 ? -1.6 : 1);
      const k = r() < 0.6 ? between(r, 1.2, 2.1) : between(r, 0.2, 0.8);
      const steps = 7;
      for (let s = 1; s <= steps; s++) {
        const u = (s / steps) * Math.PI * 2;
        const py = y - (h * (1 - Math.cos(u))) / 2;
        const px = x + (a * (u - k * Math.sin(u))) / (Math.PI * 2) + (y - py) * slant;
        d += `L${px.toFixed(1)} ${py.toFixed(1)}`;
      }
      x += a;
      y += between(r, -0.6, 0.6);
    }
    x += size * between(r, 0.8, 2.2);
  }
  return d;
}

export function build() {
  const r = rng(314);
  let s = '';
  // rows of writing
  for (let y = 40; y < 990; y += between(r, 22, 40)) {
    const big = r() < 0.18;
    const size = big ? between(r, 16, 26) : between(r, 7, 12);
    const x0 = between(r, -40, 260);
    const w = between(r, 260, 900);
    s += `<path class="${r() < 0.35 ? 'ink' : 'pencil'}" d="${cursive(r, x0, y, w, size)}"/>`;
  }
  // scratch-outs: dense back and forth strokes
  for (let i = 0; i < 7; i++) {
    const x = between(r, 40, 800);
    const y = between(r, 60, 940);
    const w = between(r, 60, 160);
    let d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
    for (let j = 0; j < 9; j++) d += `L${(x + (j % 2 ? w : 0) + between(r, -6, 6)).toFixed(0)} ${(y + j * 2.2).toFixed(1)}`;
    s += `<path class="ink" d="${d}"/>`;
  }
  // stamped serif letters, like the m m m and A in the reference
  const glyphs = 'mmmmAAZNVmAZ';
  for (let i = 0; i < 16; i++) {
    s += `<text class="stamp" x="${between(r, 20, 940).toFixed(0)}" y="${between(r, 60, 960).toFixed(0)}" font-size="${between(r, 18, 64).toFixed(0)}" opacity="${between(r, 0.35, 0.8).toFixed(2)}" transform="rotate(${between(r, -8, 8).toFixed(1)})">${glyphs[(r() * glyphs.length) | 0]}</text>`;
  }
  // ink drops
  for (let i = 0; i < 12; i++) {
    const cx = between(r, 60, 940);
    const cy = between(r, 80, 920);
    const rad = between(r, 3, 9);
    s += `<g class="drop-g"><circle class="drop" cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(1)}"/><circle class="drop" cx="${(cx + between(r, -14, 14)).toFixed(0)}" cy="${(cy + between(r, 6, 20)).toFixed(0)}" r="${(rad * 0.3).toFixed(1)}"/></g>`;
  }
  svg.innerHTML = s;
}

// Clear of the Menu chip above; room for the HUD row below unless the steps pan
// (short screens have no HUD row at all, base.css).
const TOP = 58;
const HUD = 40;
const BOTTOM = 16;

export function animate({ motion, compact }) {
  if (!motion) return;

  // If the steps do not fit between the Menu chip and the HUD, they pan up at
  // reading pace once they are written (the HUD steps aside, base.css), so no
  // copy is clipped and nothing sits on it.
  const steps = section.querySelector('.scrawl__steps');
  let from = 0;
  let to = 0;
  const fit = () => {
    gsap.set(steps, { y: 0 });
    const vh = window.innerHeight;
    const h = steps.offsetHeight;
    const clearance = Math.max(TOP, Math.ceil(document.querySelector('.site-header').getBoundingClientRect().height) + 3);
    const top = (vh - h) / 2; // centered by the section's flex layout
    const below = vh <= 520 ? 10 : HUD;
    // Shift that keeps a block of height h between the chip and a bottom margin.
    const nudge = (bottom) => Math.max(0, clearance - top) + Math.min(0, vh - bottom - (top + h));
    let tall = false;
    if (h <= vh - clearance - below) {
      from = to = nudge(below); // fits as it is (desktop: no shift at all)
    } else {
      tall = true; // the HUD steps aside (base.css)
      if (h <= vh - clearance - BOTTOM) from = to = nudge(BOTTOM);
      else { from = clearance - top; to = vh - BOTTOM - (top + h); } // pans while it holds
    }
    section.classList.toggle('is-tall', tall);
  };
  fit();
  ScrollTrigger.addEventListener('refreshInit', fit);

  const lines = [...svg.querySelectorAll('.pencil, .ink')];
  lines.forEach((p) => p.setAttribute('pathLength', '1'));
  const hands = section.querySelectorAll('.hand');
  const notes = section.querySelectorAll('.scrawl__steps p');

  const root = document.documentElement;
  const contact = document.querySelector('#contact');
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section, start: 'top top', end: compact ? '+=155%' : '+=240%', pin: true, scrub: 0.6, invalidateOnRefresh: true,
      // From the erase on, the header steps aside for the blank page.
      onUpdate: (self) => {
        const end = self.progress > 0.9 ? 'contact' : '';
        if (root.dataset.end !== end) root.dataset.end = end;
        contact.classList.toggle('is-live', self.progress >= 0.97);
      },
      onLeave: () => { root.dataset.end = 'contact'; contact.classList.add('is-live'); },
    },
  });
  // Writing starts on the first frame: kicker and the first hand are already going.
  tl.fromTo(lines, { strokeDasharray: 1, strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 0.18, stagger: { each: 0.5 / lines.length, from: 'random' }, ease: 'none' }, 0)
    .fromTo('.scrawl__steps .kicker', { opacity: 0 }, { opacity: 1, duration: 0.02 }, 0)
    .fromTo(hands, { clipPath: 'inset(-20% 100% -20% 0)' }, { clipPath: 'inset(-20% 0% -20% 0)', duration: 0.1, stagger: 0.12, ease: 'none' }, 0.01)
    .fromTo(notes, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.06, stagger: 0.12 }, 0.07)
    .fromTo(svg.querySelectorAll('.stamp'), { opacity: 0 }, { opacity: (i, el) => +el.getAttribute('opacity'), duration: 0.01, stagger: 0.025, ease: 'steps(1)' }, 0.2)
    .fromTo(svg.querySelectorAll('.drop-g'), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.05, stagger: 0.04, ease: 'back.out(3)' }, 0.3)
    // tall steps: start at the top, then read down to the last line (no-op when they fit)
    .fromTo(steps, { y: () => from }, { y: () => from, duration: 0.3, ease: 'none' }, 0.06)
    .fromTo(steps, { y: () => from }, { y: () => to, duration: 0.26, ease: 'none', immediateRender: false }, 0.38)
    // build to a peak
    .to(svg, { scale: 1.12, rotate: -2, duration: 0.25, ease: 'power1.in' }, 0.6)
    .to('.scrawl__steps', { opacity: 0, scale: 0.96, duration: 0.05 }, 0.66)
    // ink flood: the drops spread until the page is black
    .to(svg.querySelectorAll('.drop-g'), { scale: 150, duration: 0.14, stagger: 0.008, ease: 'power2.in' }, 0.7)
    // erase: a white page opens from the center, taking the debris layer with it
    .fromTo('.scrawl__erase', { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(80% at 50% 50%)', duration: 0.11, ease: 'power2.inOut' }, 0.85)
    .to(['.debris__field', '.hud'], { opacity: 0, duration: 0.08 }, 0.84)
    .set(section, { backgroundColor: '#ffffff' }, 0.96)
    // the contact page arrives on the white
    .fromTo(contact, { opacity: 0 }, { opacity: 1, duration: 0.03, ease: 'none' }, 0.97);

  section._st = tl.scrollTrigger;
  // All three steps written; on tall steps, the start of the read-down.
  section._land = () => tl.scrollTrigger.start + (tl.scrollTrigger.end - tl.scrollTrigger.start) * (from !== to ? 0.39 : 0.5);

  return () => {
    ScrollTrigger.removeEventListener('refreshInit', fit);
    gsap.set(steps, { clearProps: 'y' });
    section.classList.remove('is-tall');
    gsap.set(contact, { clearProps: 'opacity' });
    contact.classList.remove('is-live');
    delete root.dataset.end;
  };
}

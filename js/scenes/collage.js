// 02 COLLAGE (reference 3)
// Pinned horizontal reel. It opens by "printing" the opener image and the
// title under a scan line (picking up the studio page's scan), holds, then
// the reel moves. Posters start as harsh photocopies and develop into color
// as they reach the middle. Thin rules, arcs and a curve draw across the reel.
//
// Phones (both orientations) get a stop-motion reel instead of a constant
// slide: one film per screen, and the reel comes to rest on each film, poster
// and credits fully in view, for a stretch of scroll before advancing. Previous
// and Next buttons step the reel film by film.
import { rng, between } from '../lib/util.js';

const section = document.querySelector('.collage');
const track = section.querySelector('.collage__track');
const svg = section.querySelector('.collage__lines');
const opener = section.querySelector('.collage__index');

/** Wide, short screens: keep the opener photo above the kicker and title. */
function fitOpener() {
  opener.style.height = '';
  const kicker = section.querySelector('.collage__intro .kicker').getBoundingClientRect().top;
  const r = opener.getBoundingClientRect();
  const room = Math.round(kicker - r.top - 24);
  if (r.height > room) opener.style.height = `${Math.max(60, room)}px`;
}

export function build() {
  section.querySelectorAll('.plate__fig img').forEach((img, i) => {
    const fig = img.closest('.plate__fig');
    fig.style.setProperty('--ar', img.getAttribute('width') / img.getAttribute('height'));
    fig.style.rotate = `${[-1.2, 0.8, -0.6, 0.4][i % 4]}deg`; // slightly misaligned on the glass
  });
}

/** Lines are drawn in real pixels so strokes stay crisp at any size. */
function drawLines(w, h) {
  const r = rng(7);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  let s = '';
  for (let i = 0; i < 11; i++) {
    const y = between(r, 0.06, 0.94) * h;
    const x = between(r, 0, 0.9) * w;
    const len = between(r, 0.04, 0.22) * w;
    s += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x + len).toFixed(0)}" y2="${(y + between(r, -3, 3)).toFixed(0)}" class="${r() < 0.2 ? 'heavy' : ''}"/>`;
  }
  for (let i = 0; i < 5; i++) {
    const cx = between(r, 0.08, 0.92) * w;
    const cy = between(r, 0.65, 1.2) * h;
    const rad = between(r, 0.3, 0.7) * h;
    const a1 = Math.PI * between(r, 1.05, 1.3);
    const a2 = Math.PI * between(r, 1.7, 1.95);
    const p = (a) => `${(cx + Math.cos(a) * rad).toFixed(0)} ${(cy + Math.sin(a) * rad).toFixed(0)}`;
    s += `<path d="M${p(a1)} A${rad.toFixed(0)} ${rad.toFixed(0)} 0 0 1 ${p(a2)}"/>`;
  }
  // the S-curve from reference 3
  for (let i = 0; i < 2; i++) {
    const x = between(r, 0.2, 0.8) * w;
    const y = between(r, 0.55, 0.85) * h;
    const lw = between(r, 0.12, 0.2) * w;
    s += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} C${(x + lw * 0.6).toFixed(0)} ${y.toFixed(0)} ${(x + lw * 0.5).toFixed(0)} ${(y - h * 0.18).toFixed(0)} ${(x + lw).toFixed(0)} ${(y - h * 0.2).toFixed(0)}"/>`;
  }
  svg.innerHTML = s;
  svg.querySelectorAll('line, path').forEach((p) => p.setAttribute('pathLength', '1'));
}

/** Phones stack poster over copy. Where that column is taller than the screen,
 *  shorten the poster so the whole plate, credits included, stays in view.
 *  Compact layouts keep clear of the Menu chip above and Previous/Next below. */
function fitPlates(compact) {
  const room = window.innerHeight - (compact ? 112 : 96); // header chip above, HUD or reel nav below
  section.querySelectorAll('.plate').forEach((plate) => {
    const fig = plate.querySelector('.plate__fig');
    fig.style.height = '';
    const cs = getComputedStyle(plate);
    if (cs.flexDirection !== 'column') {
      if (compact && fig.offsetHeight > room) fig.style.height = `${room}px`;
      // In a narrow landscape row, a smaller poster gives long credits room
      // to wrap above the reel controls without reducing their type size.
      const copy = plate.querySelector('.plate__copy');
      const copyRoom = window.innerHeight - 80;
      if (compact && copy.offsetHeight > copyRoom) {
        let low = 64, high = fig.offsetHeight;
        fig.style.height = `${low}px`;
        if (copy.offsetHeight <= copyRoom) {
          for (let i = 0; i < 8; i++) {
            const mid = (low + high) / 2;
            fig.style.height = `${mid}px`;
            if (copy.offsetHeight <= copyRoom) low = mid;
            else high = mid;
          }
        }
        fig.style.height = `${low}px`;
      }
      return;
    }
    const copy = plate.querySelector('.plate__copy').offsetHeight;
    const over = fig.offsetHeight + (parseFloat(cs.rowGap) || 0) + copy - room;
    if (over > 0) fig.style.height = `${Math.max(compact && window.innerHeight <= 520 ? 64 : window.innerHeight * 0.2, fig.offsetHeight - over)}px`;
  });
}

export function animate({ motion, compact }) {
  if (!motion) return;
  if (compact) return animateStops();

  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
  // Scroll spent on the reel: the track moves 1.25px sideways per px scrolled.
  const travel = () => Math.round(distance() * 0.8);
  const hold = () => Math.round(window.innerHeight * 0.55); // print-in before the reel moves
  const layout = () => { fitPlates(false); fitOpener(); drawLines(track.scrollWidth, track.clientHeight); };
  layout();
  ScrollTrigger.addEventListener('refreshInit', layout);

  // One pin covers the print-in hold and the whole reel.
  const pin = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + (hold() + travel()),
    pin: true,
    invalidateOnRefresh: true,
  });

  // Print-in: opener image under a scan line, then kicker, title, lede, rule.
  gsap.timeline({ scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + hold(), scrub: 0.5, invalidateOnRefresh: true } })
    .fromTo('.collage__index', { '--print': '22%', '--scan': 1 }, { '--print': '100%', '--scan': 0, duration: 0.5, ease: 'none' }, 0)
    .fromTo('.collage__intro h2', { opacity: 0.25, y: 18 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0)
    .fromTo('.collage__lede', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.3)
    .fromTo('.collage__rule', { scaleY: 0, transformOrigin: 'top' }, { scaleY: 1, duration: 0.2 }, 0.35)
    .set({}, {}, 1);

  // The reel itself (linear, so plates can use it as their containerAnimation).
  // Positions are numbers taken from the pin. A position written relative to
  // the pinned section ("top top-=N") would be pushed past the pin's own
  // spacing, and the reel would start after the pin had already ended.
  const reel = () => ({ start: () => pin.start + hold(), end: () => pin.start + hold() + travel(), scrub: 0.6, invalidateOnRefresh: true });
  const move = gsap.to(track, { x: () => -distance(), ease: 'none', scrollTrigger: reel() });

  // Lines and parallax ride the reel.
  gsap.timeline({ scrollTrigger: reel() })
    .fromTo(svg.querySelectorAll('line, path'), { strokeDasharray: 1, strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 0.25, stagger: 0.04, ease: 'none' }, 0)
    .to('.collage__index', { x: () => window.innerWidth * 0.12, duration: 0.3, ease: 'none' }, 0)
    .set({}, {}, 1);

  // Each poster develops from photocopy to color as it reaches the center.
  section.querySelectorAll('.plate').forEach((plate) => {
    gsap.timeline({
      scrollTrigger: { trigger: plate, containerAnimation: move, start: 'left 85%', end: 'center 55%', scrub: true },
    })
      .to(plate.querySelector('img'), { filter: 'grayscale(0) contrast(1) brightness(1)', ease: 'none' }, 0)
      .to(plate.querySelector('.photocopy'), { opacity: 0.18, ease: 'none' }, 0)
      .fromTo(plate.querySelector('.plate__copy'), { y: 50, opacity: 0 }, { y: 0, opacity: 1, ease: 'power2.out' }, 0.2);
  });

  const plates = [...section.querySelectorAll('.plate')];
  const plateY = (i) => {
    const plate = plates[i];
    const x = plate.offsetLeft + plate.offsetWidth / 2 - window.innerWidth / 2;
    return pin.start + hold() + Math.min(1, Math.max(0, x / Math.max(1, distance()))) * travel();
  };

  // Fade to bare paper after the final film's readable rest, before Services.
  gsap.fromTo(track, { opacity: 1 }, {
    opacity: 0, ease: 'none', immediateRender: false,
    scrollTrigger: { start: () => Math.max(pin.end - Math.round(window.innerHeight * 0.33), plateY(plates.length - 1) + 1), end: () => pin.end, scrub: true, invalidateOnRefresh: true },
  });

  // Load every poster as soon as Work is near, not when each one slides on screen.
  ScrollTrigger.create({
    trigger: section, start: 'top bottom', once: true,
    onEnter: () => section.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; }),
  });

  section._st = pin;
  section._land = () => pin.start + hold();
  // For the motion toggle: which plate is centered now, and where each one is.
  section._item = plateY;
  section._itemNow = () => {
    const x = -gsap.getProperty(track, 'x') + window.innerWidth / 2;
    // The intro remains current while only the edge of the first plate enters.
    // Once its center is on screen, it is a reading position before full centering.
    if (plates[0].offsetLeft + plates[0].offsetWidth / 2 - x > window.innerWidth / 2) return undefined;
    let best = 0;
    plates.forEach((p, i) => { if (Math.abs(p.offsetLeft + p.offsetWidth / 2 - x) < Math.abs(plates[best].offsetLeft + plates[best].offsetWidth / 2 - x)) best = i; });
    return best;
  };

  // Tabbing to a link inside the reel scrolls the reel to that plate.
  // overflow: clip keeps the browser from scrolling the section sideways on
  // focus; resetting scrollLeft covers browsers without overflow: clip.
  const unscroll = () => { if (section.scrollLeft) section.scrollLeft = 0; };
  section.addEventListener('scroll', unscroll);
  const onFocus = (e) => {
    unscroll();
    const plate = e.target.closest('.plate');
    if (!plate) return;
    const x = plate.offsetLeft + plate.offsetWidth / 2 - window.innerWidth / 2;
    const p = Math.min(1, Math.max(0, x / Math.max(1, distance())));
    window.scrollTo({ top: pin.start + hold() + p * travel(), behavior: 'auto' });
  };
  section.addEventListener('focusin', onFocus);

  return () => {
    ScrollTrigger.removeEventListener('refreshInit', layout);
    section.querySelectorAll('.plate__fig').forEach((fig) => { fig.style.height = ''; });
    opener.style.height = '';
    section.removeEventListener('focusin', onFocus);
    section.removeEventListener('scroll', unscroll);
  };
}

/**
 * Phones: the stop-motion reel. Scroll is spent in stretches: a short move to
 * each film, then a rest with that film centered and still (STOPS), so a
 * visitor who stops scrolling anywhere in a rest sees the whole plate. The
 * move between films eases in and out. Previous and Next jump to the middle
 * of a rest. Lengths are shares of the screen height; the landscape values
 * are larger because a landscape screen is short.
 */
function animateStops() {
  const plates = [...section.querySelectorAll('.plate')];
  const nav = section.querySelector('.reel-nav');
  const [prevBtn, nextBtn] = nav.querySelectorAll('.reel-nav__btn');
  const count = nav.querySelector('.reel-nav__count');
  const short = () => window.innerHeight <= 520;
  const STOPS = () => (short()
    ? { hold: 0.3, first: 0.32, rest: 0.5, move: 0.26, exit: 0.24 }
    : { hold: 0.3, first: 0.22, rest: 0.27, move: 0.16, exit: 0.18 });
  const px = (k) => Math.round(STOPS()[k] * window.innerHeight);
  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
  // Track x at which plate i is centered (each plate is one screen wide).
  const stopX = (i) => -Math.min(distance(), plates[i].offsetLeft);
  const reelLen = () => px('first') + plates.length * px('rest') + (plates.length - 1) * px('move') + px('exit');
  const hold = () => px('hold');

  const layout = () => { fitPlates(true); fitOpener(); drawLines(track.scrollWidth, track.clientHeight); };
  layout();
  ScrollTrigger.addEventListener('refreshInit', layout);

  const pin = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + (hold() + reelLen()),
    pin: true,
    invalidateOnRefresh: true,
  });

  // Print-in: same as the wide reel, over a shorter hold.
  gsap.timeline({ scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + hold(), scrub: 0.5, invalidateOnRefresh: true } })
    .fromTo('.collage__index', { '--print': '22%', '--scan': 1 }, { '--print': '100%', '--scan': 0, duration: 0.5, ease: 'none' }, 0)
    .fromTo('.collage__intro h2', { opacity: 0.25, y: 18 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0)
    .fromTo('.collage__lede', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.3)
    .fromTo('.collage__rule', { scaleY: 0, transformOrigin: 'top' }, { scaleY: 1, duration: 0.2 }, 0.35)
    .set({}, {}, 1);

  // Scroll offset u (px into the reel) -> track x, and which film is nearest.
  const ease = (t) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t)))) / 2;
  const xAt = (u) => {
    let pos = 0;
    let prev = 0;
    for (let i = 0; i < plates.length; i++) {
      const move = i ? px('move') : px('first');
      const target = stopX(i);
      if (u < pos + move) return prev + (target - prev) * ease((u - pos) / move);
      pos += move + px('rest');
      if (u < pos) return target;
      prev = target;
    }
    return prev;
  };
  const restMid = (i) => pin.start + hold() + px('first') + i * (px('rest') + px('move')) + px('rest') / 2;

  // Lines draw and posters develop exactly as in the wide reel, from the track position.
  const lines = gsap.timeline({ paused: true })
    .fromTo(svg.querySelectorAll('line, path'), { strokeDasharray: 1, strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 0.25, stagger: 0.04, ease: 'none' }, 0)
    .set({}, {}, 1);
  const develop = plates.map((plate) => gsap.timeline({ paused: true })
    .to(plate.querySelector('img'), { filter: 'grayscale(0) contrast(1) brightness(1)', ease: 'none', duration: 1 }, 0)
    .to(plate.querySelector('.photocopy'), { opacity: 0.18, ease: 'none', duration: 1 }, 0)
    .fromTo(plate.querySelector('.plate__copy'), { y: 50, opacity: 0 }, { y: 0, opacity: 1, ease: 'power2.out', duration: 0.8 }, 0.2));

  let now = null; // First render must initialize the intro counter and both button states.
  const state = { u: 0 };
  const render = () => {
    const vw = window.innerWidth;
    const x = xAt(state.u);
    gsap.set(track, { x });
    const p = state.u / Math.max(1, reelLen());
    lines.progress(p);
    gsap.set(opener, { x: vw * 0.12 * Math.min(1, p / 0.3) });
    // A plate develops from when its left edge enters at 85% of the screen to
    // when it is nearly centered (the wide reel's 'left 85%' to 'center 55%').
    plates.forEach((plate, i) => {
      const left = plate.offsetLeft + x;
      develop[i].progress(Math.min(1, Math.max(0, (vw * 0.85 - left) / (vw * 0.85 - (vw * 0.55 - plate.offsetWidth / 2)))));
    });
    let n = -1;
    plates.forEach((plate, i) => { if (Math.abs(x - stopX(i)) < vw / 2) n = i; });
    if (n !== now) {
      now = n;
      count.textContent = n < 0 ? `${plates.length} films` : `${String(n + 1).padStart(2, '0')} / ${String(plates.length).padStart(2, '0')}`;
      prevBtn.setAttribute('aria-disabled', String(n <= 0));
      nextBtn.setAttribute('aria-disabled', String(n >= plates.length - 1));
    }
  };
  render();
  const reel = gsap.to(state, {
    u: () => reelLen(),
    ease: 'none',
    onUpdate: render,
    scrollTrigger: { start: () => pin.start + hold(), end: () => pin.start + hold() + reelLen(), scrub: 0.6, invalidateOnRefresh: true },
  });
  ScrollTrigger.addEventListener('refresh', render);

  // Exit: the reel fades back to bare paper while it rests after the last film,
  // and Previous/Next go with it (hidden, so they cannot sit over Services).
  gsap.fromTo(track, { opacity: 1 }, {
    opacity: 0, ease: 'none', immediateRender: false,
    scrollTrigger: { start: () => pin.end - px('exit'), end: () => pin.end, scrub: true, invalidateOnRefresh: true },
  });
  gsap.fromTo(nav, { autoAlpha: 1 }, {
    autoAlpha: 0, ease: 'none', immediateRender: false,
    scrollTrigger: { start: () => pin.end - px('exit'), end: () => pin.end - px('exit') / 2, scrub: true, invalidateOnRefresh: true },
  });

  const eager = ScrollTrigger.create({
    trigger: section, start: 'top bottom', once: true,
    onEnter: () => section.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; }),
  });

  section._st = pin;
  section._land = () => pin.start + hold();
  section._item = (i) => restMid(Math.max(0, Math.min(plates.length - 1, i)));
  section._itemNow = () => (now < 0 ? undefined : now);

  // Previous / Next: to the middle of the neighbouring film's rest.
  const behavior = () => (document.documentElement.classList.contains('is-motion') ? 'smooth' : 'auto');
  const step = (e) => {
    const btn = e.currentTarget;
    if (btn.getAttribute('aria-disabled') === 'true') return;
    const to = Math.max(0, Math.min(plates.length - 1, now + Number(btn.dataset.step)));
    window.scrollTo({ top: Math.round(restMid(to)), behavior: behavior() });
  };
  prevBtn.addEventListener('click', step);
  nextBtn.addEventListener('click', step);

  // Keyboard: a link inside a plate brings that plate to rest; the buttons bring
  // the reel on screen if it is not already.
  const unscroll = () => { if (section.scrollLeft) section.scrollLeft = 0; };
  section.addEventListener('scroll', unscroll);
  const onFocus = (e) => {
    unscroll();
    const plate = e.target.closest('.plate');
    const y = window.scrollY;
    if (plate) window.scrollTo({ top: Math.round(restMid(plates.indexOf(plate))), behavior: 'auto' });
    else if (nav.contains(e.target) && (y < pin.start || y > pin.end)) window.scrollTo({ top: Math.round(section._land()), behavior: 'auto' });
  };
  section.addEventListener('focusin', onFocus);

  return () => {
    ScrollTrigger.removeEventListener('refreshInit', layout);
    ScrollTrigger.removeEventListener('refresh', render);
    prevBtn.removeEventListener('click', step);
    nextBtn.removeEventListener('click', step);
    section.removeEventListener('focusin', onFocus);
    section.removeEventListener('scroll', unscroll);
    reel.kill();
    eager.kill();
    gsap.set([track, opener, nav], { clearProps: 'x,opacity,visibility' });
    lines.progress(0).kill();
    develop.forEach((t) => t.progress(0).kill());
    gsap.set(section.querySelectorAll('.plate img, .plate .photocopy, .plate__copy'), { clearProps: 'all' });
    section.querySelectorAll('.plate__fig').forEach((fig) => { fig.style.height = ''; });
    opener.style.height = '';
  };
}

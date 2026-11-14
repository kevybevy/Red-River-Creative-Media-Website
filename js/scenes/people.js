// 04 PEOPLE (references 4 and 5)
// Janelle and Dru as stippled particle portraits on a canvas. Each one
// gathers out of loose grain, holds, then blows apart sideways like the
// dissolving silhouette reference. Tunables are in CONFIG.
//
// The canvas only redraws when scroll progress changes (no idle loop).
import { rng, clamp } from '../lib/util.js';

const CONFIG = {
  sources: ['assets/people/janelle.webp', 'assets/people/dru.webp'],
  // Per photo tone mapping. Luminance is stretched from lo..hi to 0..1, then
  // ink = (1 - L)^gamma, plus `edge` x how much darker a pixel is than its
  // surroundings (keeps eyes, brows and mouth on bright faces).
  tone: [
    { lo: 0.0, hi: 0.7, gamma: 2.4, edge: 8 },
    { lo: 0.0, hi: 0.7, gamma: 2.4, edge: 8 },
  ],
  particles: { desktop: 26400, mobile: 17600 },
  ink: '#111014',
  // timeline windows (0..1 of the pinned scroll). Janelle's window starts
  // before 0 so a face is already forming on the first frame of the pin.
  phases: [
    { assemble: [-0.1, 0.18], dissolve: [0.42, 0.56], dir: -1 },
    { assemble: [0.5, 0.7], dissolve: [0.86, 1.0], dir: 1 },
  ],
};

const section = document.querySelector('.people');
const canvas = section.querySelector('.people__canvas');
const ctx = canvas.getContext('2d');
const people = [...section.querySelectorAll('.person')];
// Per person: { pts, trig } once the photo is sampled, null until then or if it failed.
let portraits = [null, null];
let W = 0, H = 0, dpr = 1, layout = [];
let progress = 0;
let portraitTimeline = null;
// Per person: a promise for the decoded photo. Cleared on failure so a rebuild retries.
const images = [];

/** Load and decode off the main thread, so drawing it later does not decode inline. */
function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

/** Separable box blur on a Float32Array luminance map. */
function blur(src, S, rad) {
  const tmp = new Float32Array(S * S);
  const out = new Float32Array(S * S);
  const w = rad * 2 + 1;
  for (let y = 0; y < S; y++) {
    let acc = 0;
    for (let x = -rad; x <= rad; x++) acc += src[y * S + clamp(x, 0, S - 1)];
    for (let x = 0; x < S; x++) {
      tmp[y * S + x] = acc / w;
      acc += src[y * S + Math.min(S - 1, x + rad + 1)] - src[y * S + Math.max(0, x - rad)];
    }
  }
  for (let x = 0; x < S; x++) {
    let acc = 0;
    for (let y = -rad; y <= rad; y++) acc += tmp[clamp(y, 0, S - 1) * S + x];
    for (let y = 0; y < S; y++) {
      out[y * S + x] = acc / w;
      acc += tmp[Math.min(S - 1, y + rad + 1) * S + x] - tmp[Math.max(0, y - rad) * S + x];
    }
  }
  return out;
}

/** Wait for an idle moment (or the next tick where idle callbacks are missing). */
const idle = () => new Promise((res) => (window.requestIdleCallback
  ? window.requestIdleCallback(() => res(), { timeout: 200 })
  : setTimeout(res, 16)));

/** Rejection-sample the photo's ink into particle home positions. Runs in
 *  slices of about 8ms with idle gaps between, so scrolling never stalls on it. */
async function sample(img, count, seed, tone) {
  const S = 220;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, S, S);
  const data = g.getImageData(0, 0, S, S).data;
  const lum = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) lum[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
  const soft = blur(lum, S, 4);
  await idle();

  const r = rng(seed);
  const out = new Float32Array(count * 4); // x, y (-0.5..0.5), size, random
  let n = 0;
  let guard = 0;
  let until = performance.now() + 8;
  while (n < count && guard < count * 80) {
    guard++;
    if ((guard & 1023) === 0 && performance.now() > until) {
      await idle();
      until = performance.now() + 8;
    }
    const x = r() * S;
    const y = r() * S;
    const i = (y | 0) * S + (x | 0);
    const L = lum[i];
    // Soft oval vignette keeps the person and loses the room.
    const dx = (x / S - 0.5) / 0.4;
    const dy = (y / S - 0.5) / 0.56;
    const v = clamp((1.15 - Math.hypot(dx, dy)) * 2.2);
    const Ln = clamp((L - tone.lo) / (tone.hi - tone.lo));
    const ink = clamp(Math.pow(1 - Ln, tone.gamma) + Math.max(0, soft[i] - L) * tone.edge) * v;
    if (r() < ink) {
      out[n * 4] = x / S - 0.5;
      out[n * 4 + 1] = y / S - 0.5;
      out[n * 4 + 2] = r() < 0.03 ? 2 + r() * 1.6 : 0.8 + r() * 0.9;
      out[n * 4 + 3] = r();
      n++;
    }
  }
  return out.subarray(0, n * 4);
}

/** The scatter and blow-away angles depend only on a particle's random value,
 *  so they are worked out once here, not for every particle on every frame.
 *  Kept at full precision: the drawn positions are exactly what they were. */
function angles(pts) {
  const n = pts.length / 4;
  const out = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const q = pts[i * 4 + 3];
    const ang = q * 44.8;
    out[i * 3] = Math.cos(ang);
    out[i * 3 + 1] = Math.sin(ang * 1.7);
    out[i * 3 + 2] = Math.sin(q * 91.7);
  }
  return out;
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = section.clientWidth;
  H = section.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  if (W >= 480 && W < 761 && H <= 520 && W > H) {
    // Short landscape has room beside the bio, but not above it.
    const size = Math.min(W * 0.34, H - 100);
    layout = [0, 1].map(() => ({ cx: W * 0.79, cy: H * 0.55, size }));
  } else if (W < 761) {
    // Each portrait ends at least 12px above its own bio (kicker included).
    layout = [...section.querySelectorAll('.person')].map((p) => {
      const avail = (p.offsetHeight ? p.offsetTop : H) - 12;
      const size = Math.max(80, Math.min(W * 1.0, H * 0.54, avail - 8));
      return { cx: W * 0.5, cy: Math.min(H * 0.37, avail - size / 2), size };
    });
  } else {
    const size = Math.min(W * 0.42, H * 0.9);
    layout = [{ cx: W * 0.32, cy: H * 0.5, size }, { cx: W * 0.69, cy: H * 0.5, size }];
  }
}

function draw() {
  if (portraitTimeline) progress = portraitTimeline.progress();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = CONFIG.ink;
  portraits.forEach((portrait, k) => {
    if (!portrait) return;
    const { pts, trig } = portrait;
    const ph = CONFIG.phases[k];
    const L = layout[k];
    const a = clamp((progress - ph.assemble[0]) / (ph.assemble[1] - ph.assemble[0]));
    const d = clamp((progress - ph.dissolve[0]) / (ph.dissolve[1] - ph.dissolve[0]));
    if (a <= 0 || d >= 1) return;
    const n = pts.length / 4;
    for (let i = 0; i < n; i++) {
      const hx = pts[i * 4];
      const hy = pts[i * 4 + 1];
      const s = pts[i * 4 + 2];
      const q = pts[i * 4 + 3];

      let ta = clamp((a - q * 0.55) / 0.45);
      ta = 1 - (1 - ta) * (1 - ta) * (1 - ta);

      // Dissolve starts on the side it blows toward and travels across.
      const lead = ph.dir < 0 ? 0.5 - hx : hx + 0.5;
      let td = clamp((d - ((1 - lead) * 0.6 + q * 0.15)) / 0.25);
      td *= td;

      const alpha = ta * (1 - td);
      if (alpha < 0.03) continue;
      const sx = trig[i * 3] * (0.5 + q) * L.size * 0.9;
      const sy = trig[i * 3 + 1] * (0.4 + q) * L.size * 0.7;
      const bx = ph.dir * (0.3 + q * 1.4) * L.size * 1.2;
      const by = (trig[i * 3 + 2] * 0.5 - 0.2) * L.size * 0.6;
      // A little scroll-linked shimmer instead of a time-based wobble.
      const wob = Math.sin(progress * 60 + q * 60) * 0.6;

      const x = L.cx + hx * L.size + (1 - ta) * sx + td * bx + wob;
      const y = L.cy + hy * L.size + (1 - ta) * sy + td * by + wob * 0.6;
      const size = s * (1 + td * 1.6);
      ctx.globalAlpha = alpha;
      ctx.fillRect(x, y, size, size);
    }
  });
  ctx.globalAlpha = 1;
}

export function animate({ motion, compact }) {
  if (!motion) return;
  let alive = true;
  resize();

  // Load and sample the photos only in the animated version, and only once
  // the visitor reaches Services (about two scenes ahead), not at boot.
  // Phones in either orientation get the lighter count: a landscape phone is
  // wider than 760px but draws a portrait no bigger than a portrait phone's.
  const count = compact ? CONFIG.particles.mobile : CONFIG.particles.desktop;
  // Each portrait stands on its own. If one photo fails to load or cannot be
  // sampled, the other still renders, and the failed one shows its ordinary
  // photo beside the bio (.is-photo) so the person is never left blank.
  const prepare = async () => {
    CONFIG.sources.forEach((src, i) => {
      if (images[i]) return;
      images[i] = loadImage(src);
      images[i].catch(() => {}); // handled below, when its turn comes
    });
    for (let i = 0; i < CONFIG.sources.length; i++) {
      let pts = null;
      try {
        const img = await images[i];
        if (!alive) return;
        pts = await sample(img, count, 17 + i, CONFIG.tone[i]);
      } catch {
        images[i] = null;
      }
      if (!alive) return;
      portraits[i] = pts?.length ? { pts, trig: angles(pts) } : null;
      people[i].classList.toggle('is-photo', !portraits[i]);
      draw();
    }
  };
  const loader = ScrollTrigger.create({ trigger: '#services', start: 'top bottom', once: true, onEnter: prepare });

  const onRefresh = () => { resize(); draw(); };
  ScrollTrigger.addEventListener('refresh', onRefresh);

  const a = section.querySelector('.person--a');
  const b = section.querySelector('.person--b');
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: compact ? '+=175%' : '+=260%', // phones: same phases, less scroll
      pin: true,
      scrub: 0.5,
    },
    onUpdate: () => { progress = tl.progress(); draw(); },
  });
  // Bios hold while their portrait is assembled: Janelle 0.06 to 0.44, Dru 0.56 to 0.96.
  tl.fromTo(a, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.07 }, 0.03)
    .fromTo(a.querySelector('h3'), { letterSpacing: '0.3em' }, { letterSpacing: '-0.035em', duration: 0.1 }, 0.03)
    .to(a, { opacity: 0, y: -30, duration: 0.05 }, 0.44)
    .fromTo(b, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.07 }, 0.52)
    .fromTo(b.querySelector('h3'), { letterSpacing: '0.3em' }, { letterSpacing: '-0.035em', duration: 0.1 }, 0.52)
    .to(b, { opacity: 0, y: -20, duration: 0.04 }, 0.96)
    .set({}, {}, 1);
  // Phones: the portrait fills the screen, so the slate debris steps back.
  if (compact || window.innerHeight < 560) {
    tl.to('.debris__field', { opacity: 0.2, duration: 0.03 }, 0)
      .to('.debris__field', { opacity: 1, duration: 0.02 }, 0.98);
  }

  portraitTimeline = tl;
  section._st = tl.scrollTrigger;
  const at = (f) => tl.scrollTrigger.start + (tl.scrollTrigger.end - tl.scrollTrigger.start) * f;
  section._land = () => at(0.22);
  // Janelle holds 0.10 to 0.44, Dru 0.59 to 0.96 (for the motion toggle: same person).
  section._item = (i) => at(i ? 0.74 : 0.22);
  section._itemNow = () => (tl.scrollTrigger.progress < 0.5 ? 0 : 1);

  return () => {
    loader.kill();
    if (portraitTimeline === tl) portraitTimeline = null;
    alive = false;
    people.forEach((p) => p.classList.remove('is-photo'));
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}

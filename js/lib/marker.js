// Rough black marker strokes (reference 1). Generated as stretchable SVGs so
// they work as CSS backgrounds for redactions and as full-screen wipe bars.
import { rng } from './util.js';

export function markerSVG(seed, { color = '#0c0c0e', rough = 1 } = {}) {
  const r = rng(seed * 9301 + 49297);
  const n = 34;
  const x0 = 4 + r() * 18;
  const x1 = 996 - r() * 14;
  const top = [];
  const bot = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * (i / n);
    top.push([x, (7 + r() * 13 + (r() < 0.12 ? r() * 10 : 0)) * rough]);
    bot.push([x, 100 - (7 + r() * 13 + (r() < 0.12 ? r() * 10 : 0)) * rough]);
  }
  const pts = [[x0 - 3 - r() * 6, 50 + (r() - 0.5) * 24], ...top, [999 - r() * 3, 46 + (r() - 0.5) * 20], ...bot.reverse()];
  const d = 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';

  // Faint lighter streaks read as overlapping marker passes.
  let streaks = '';
  for (let s = 0; s < 3; s++) {
    const y = 24 + r() * 52;
    const a = (x0 + 30 + r() * 60).toFixed(0);
    const b = (x1 - 20 - r() * 140).toFixed(0);
    streaks += `<path d='M${a} ${y.toFixed(1)}L${b} ${(y + (r() - 0.5) * 6).toFixed(1)}' stroke='rgba(255,255,255,0.08)' stroke-width='${(2 + r() * 5).toFixed(1)}'/>`;
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 100' preserveAspectRatio='none'><path d='${d}' fill='${color}'/>${streaks}</svg>`;
}

export const svgURI = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
export const marker = (seed, opts) => svgURI(markerSVG(seed, opts));

/**
 * Fill a .wipe container with overlapping horizontal marker bars that,
 * together, cover the whole viewport. Same seed = identical bars, which is
 * how the hero's exit and the redact page's entrance line up seamlessly.
 */
export function buildWipe(container, { count = 7, seed = 1 } = {}) {
  container.innerHTML = '';
  const h = 100 / count;
  const bars = [];
  for (let i = 0; i < count; i++) {
    const b = document.createElement('div');
    b.className = 'wipe__bar';
    b.style.top = `${i * h - h * 0.8}%`;
    b.style.height = `${h * 2.6}%`;
    b.style.backgroundImage = marker(seed + i * 7, { rough: 0.8 });
    container.appendChild(b);
    bars.push(b);
  }
  return bars;
}

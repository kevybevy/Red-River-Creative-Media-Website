// Small shared helpers. No dependencies.

/** Seeded random (mulberry32). Same seed = same layout on every load. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const between = (r, a, b) => a + r() * (b - a);

/**
 * Split an element's text into per-character spans for animation.
 * Screen readers get one clean copy of the text; the split copy is hidden.
 */
export function splitChars(el) {
  if (el._chars) return el._chars;
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  const chars = [];
  const words = text.split(' ');
  words.forEach((word, i) => {
    const w = document.createElement('span');
    w.className = 'w';
    for (const c of word) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      w.appendChild(s);
      chars.push(s);
    }
    vis.appendChild(w);
    if (i < words.length - 1) vis.appendChild(document.createTextNode(' '));
  });
  el.append(sr, vis);
  el._chars = chars;
  return chars;
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#+*';

/** "Decode" effect: characters cycle through random glyphs, then settle. */
export function scramble(chars, { duration = 1000, delay = 0 } = {}) {
  const finals = chars.map((c) => c.textContent);
  chars.forEach((c) => (c.style.visibility = 'hidden'));
  const start = performance.now() + delay;
  return new Promise((resolve) => {
    const frame = (now) => {
      const t = (now - start) / duration;
      chars.forEach((c, i) => {
        const at = (i / chars.length) * 0.75;
        if (t < at) return;
        c.style.visibility = '';
        c.textContent = t >= at + 0.25 ? finals[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      });
      if (t < 1) requestAnimationFrame(frame);
      else {
        chars.forEach((c, i) => { c.textContent = finals[i]; c.style.visibility = ''; });
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

/** Seconds to SMPTE-style timecode at 24 fps, starting at hour 01. */
export function timecode(frames) {
  const f = Math.floor(frames) % 24;
  const s = Math.floor(frames / 24);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(1 + Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
}



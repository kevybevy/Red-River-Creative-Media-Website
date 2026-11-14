// Directional keys use the same measured scene/item landings as the existing
// menu and reel. They never autoplay, rotate, or replace ordinary scrolling.
const nav = document.querySelector('.section-keys');
if (nav) {
  const root = document.documentElement;
  const scenes = [...document.querySelectorAll('main section[data-label]')];
  const up = nav.querySelector('[data-direction="-1"]');
  const down = nav.querySelector('[data-direction="1"]');
  const status = document.getElementById('section-key-status');
  let frame = 0, moving = false, ticket = 0, staticItem = null;
  const maxY = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const clamp = y => Math.min(maxY(), Math.max(0, y));
  const motion = () => root.classList.contains('is-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  function start(s) {
    if (s._st) return s._st.start;
    return s.getBoundingClientRect().top + scrollY;
  }
  function landing(s) {
    if (s.id === 'top') return 0;
    if (s.id === 'contact') return maxY();
    return clamp(typeof s._land === 'function' ? s._land() : start(s));
  }
  function current() {
    if (scrollY >= maxY() - 2) return scenes.length - 1;
    let i = 0;
    scenes.forEach((s, n) => { if (start(s) <= scrollY + 3) i = n; });
    return i;
  }
  function items(s) {
    return [...s.querySelectorAll(s.id === 'work' ? '.plate' : '.person')];
  }
  function itemNow(s) {
    if (!motion() && staticItem?.id === s.id && Math.abs(scrollY - staticItem.y) < 4) return staticItem.item;
    if (typeof s._itemNow === 'function') return s._itemNow();
    const list = items(s);
    // Static items can share a screen. Use the item nearest its reading centre.
    let best, distance = Infinity;
    list.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - innerHeight / 2);
      if (r.bottom > 0 && r.top < innerHeight && d < distance) { best = i; distance = d; }
    });
    return best;
  }
  function itemLanding(s, i) {
    if (typeof s._item === 'function') return clamp(s._item(i));
    return clamp(items(s)[i].getBoundingClientRect().top + scrollY - 72);
  }
  function destination(direction) {
    const i = current(), s = scenes[i];
    if (s.id === 'work' || s.id === 'people') {
      const list = items(s), now = itemNow(s);
      if (now === undefined && direction > 0) return { y: itemLanding(s, 0), section: s, item: 0 };
      if (now !== undefined) {
        const next = now + direction;
        if (next >= 0 && next < list.length) return { y: itemLanding(s, next), section: s, item: next };
      }
    }
    const next = scenes[i + direction];
    if (!next) return null;
    // Enter a multi-item scene from below at its final readable item.
    if (direction < 0 && (next.id === 'work' || next.id === 'people')) {
      const item = items(next).length - 1;
      return { y: itemLanding(next, item), section: next, item };
    }
    return { y: landing(next), section: next };
  }
  function label(direction, to) {
    if (!to) return direction < 0 ? 'Beginning of page' : 'End of page';
    if (to.item !== undefined) {
      const type = to.section.id === 'work' ? 'film' : 'person';
      const heading = items(to.section)[to.item].querySelector('h3')?.textContent.trim();
      return `${direction < 0 ? 'Previous' : 'Next'} ${type}${heading ? ': ' + heading : ''}`;
    }
    return `${direction < 0 ? 'Previous' : 'Next'} section: ${to.section.dataset.label.replace(/^\d+\s*/, '')}`;
  }
  function update() {
    frame = 0;
    // Runs on every scroll frame: measure each direction once, and touch the
    // buttons only when what they say has changed.
    [up, down].forEach((button, n) => {
      const d = n ? 1 : -1;
      const to = destination(d);
      const off = String(!to);
      const text = label(d, to);
      if (button.getAttribute('aria-disabled') !== off) button.setAttribute('aria-disabled', off);
      if (button.getAttribute('aria-label') !== text) button.setAttribute('aria-label', text);
      if (button.title !== text) button.title = text;
    });
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  function cancel() { ticket++; moving = false; staticItem = null; nav.removeAttribute('aria-busy'); schedule(); }
  async function step(direction) {
    if (moving) return;
    const to = destination(direction);
    if (!to) return;
    const own = ++ticket;
    moving = true; nav.setAttribute('aria-busy', 'true');
    const y = clamp(to.y);
    const from = scrollY;
    const sameScene = to.section === scenes[current()];
    // Native smooth-scroll timing is browser-controlled and can skim over the
    // scene choreography. Give section moves 2.8–4.8s and item moves 1.6s.
    // Keep a soft start/stop and let the existing scroll-driven scenes render.
    const screens = Math.abs(y - from) / Math.max(1, innerHeight);
    const duration = sameScene ? 1600 : Math.min(4800, 2800 + Math.max(0, screens - 2) * 220);
    if (!motion()) window.scrollTo({ top: y, behavior: 'instant' });
    else await new Promise(resolve => {
      const began = performance.now();
      function travel(now) {
        if (ticket !== own) { resolve(); return; }
        // A preference change rebuilds the scene layout. Stop instead of
        // applying a destination measured in the previous layout.
        if (!motion()) { cancel(); resolve(); return; }
        const t = Math.min(1, (now - began) / duration);
        const eased = t * t * (3 - 2 * t);
        window.scrollTo({ top: from + (y - from) * eased, behavior: 'instant' });
        if (t < 1) requestAnimationFrame(travel); else resolve();
      }
      requestAnimationFrame(travel);
    });
    if (ticket !== own) return;
    // scrollend is not universal. Settle at the destination, with a finite
    // timeout; manual input or another navigation cancels this watcher.
    const began = performance.now(); let stable = 0, last = scrollY;
    await new Promise(resolve => {
      function poll() {
        if (ticket !== own) { resolve(); return; }
        stable = Math.abs(scrollY - last) < 0.5 ? stable + 1 : 0; last = scrollY;
        const itemReady = to.item === undefined || !motion() || typeof to.section._itemNow !== 'function' || to.section._itemNow() === to.item;
        if ((Math.abs(scrollY - y) < 2 && stable >= 6 && itemReady) || performance.now() - began > 4000) { resolve(); return; }
        requestAnimationFrame(poll);
      }
      requestAnimationFrame(poll);
    });
    if (ticket !== own) return;
    moving = false; nav.removeAttribute('aria-busy');
    // The static opener may share its viewport with the first poster. Keep
    // its explicit identity until the reader scrolls or presses again.
    staticItem = !motion() && ['work', 'people'].includes(to.section.id)
      ? { id: to.section.id, item: to.item ?? (to.section.id === 'people' ? 0 : undefined), y: scrollY } : null;
    update();
    const heading = to.item !== undefined ? items(to.section)[to.item]?.querySelector('h3')?.textContent : to.section.dataset.label;
    if (status) status.textContent = heading ? `Now showing ${heading.trim()}.` : '';
  }
  up.addEventListener('click', () => step(-1));
  down.addEventListener('click', () => step(1));
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', cancel);
  window.addEventListener('wheel', cancel, { passive: true });
  window.addEventListener('touchstart', e => { if (!nav.contains(e.target)) cancel(); }, { passive: true });
  document.addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key) || (e.key === ' ' && !nav.contains(e.target))) cancel(); });
  document.addEventListener('click', e => { if (e.target.closest('a,.site-header__menu,.site-menu__motion')) cancel(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('load', schedule);
  root.classList.add('has-section-keys'); nav.hidden = false; update();
}

// Header and menu.
// The bar shows at the top and on scroll-up. On scroll-down it shrinks to a
// "Menu" chip so every section stays one click away. On the blank contact page
// it steps out of the way; only the Menu chip stays in the tab order, and it
// shows when it has keyboard focus.
// Nav links jump to the point inside each pinned scene where it is settled and
// readable (section._land), then move focus to that section.
const root = document.documentElement;
const header = document.querySelector('.site-header');
const menuBtn = header.querySelector('.site-header__menu');
const menu = document.getElementById('site-menu');
const closeBtn = menu.querySelector('.site-menu__close');

let state = header.dataset.state;
const set = (next) => {
  if (state === next) return;
  state = next;
  header.dataset.state = next;
  if (next === 'gone') closeMenu(false);
};

function openMenu() {
  menu.hidden = false;
  menu.scrollTop = 0;
  menuBtn.setAttribute('aria-expanded', 'true');
  menu.querySelector('a')?.focus();
}
export function closeMenu(returnFocus = true) {
  if (menu.hidden) return;
  menu.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
  if (returnFocus) menuBtn.focus({ preventScroll: true });
}

function targetY(el, id) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (id === '#contact') return max;
  if (id === '#top') return 0;
  if (typeof el._land === 'function') return Math.min(max, el._land());
  const box = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
  return Math.min(max, box.getBoundingClientRect().top + window.scrollY);
}

function jump(id, { push = false, ring = false } = {}) {
  const el = document.querySelector(id);
  if (!el) return;
  // Keyboard activation: show where focus landed (pointer clicks stay clean).
  if (ring) {
    el.classList.add('is-focus-ring');
    el.addEventListener('blur', () => el.classList.remove('is-focus-ring'), { once: true });
  }
  // Section links update the address so it can be copied or bookmarked. pushState
  // fires no hashchange; Back and Forward do, and onHash lands those like a click.
  if (push) {
    const hash = id === '#top' ? '' : id;
    if (hash !== location.hash) history.pushState(null, '', hash || location.pathname + location.search);
  }
  window.scrollTo({ top: targetY(el, id), behavior: still() ? 'auto' : 'smooth' });
  // Focus the destination for keyboard and screen-reader users without a second scroll.
  el.focus({ preventScroll: true });
}

/** Deep links (/#people, /#contact) and in-page hash changes land like nav clicks. */
export function followHash(behavior = 'auto', { emptyToTop = false } = {}) {
  const id = window.location.hash;
  if (!id || id.length < 2) {
    // Back to the address without a section: return to the top.
    if (emptyToTop) window.scrollTo({ top: 0, behavior });
    return;
  }
  let el = null;
  try { el = document.querySelector(id); } catch { return; }
  if (!el || !el.closest('main')) return;
  const section = el.closest('main > section, main section') || el;
  const target = '#' + section.id;
  window.scrollTo({ top: targetY(section, target), behavior });
  ScrollTrigger.update();
  // A later refresh re-wraps pinned sections in their pin-spacers, which drops
  // focus. Focus now, again after the next refresh, and once more shortly after.
  const refocus = () => {
    if (document.activeElement === document.body || document.activeElement === null) section.focus({ preventScroll: true });
  };
  section.focus({ preventScroll: true });
  const once = () => { refocus(); ScrollTrigger.removeEventListener('refresh', once); };
  ScrollTrigger.addEventListener('refresh', once);
  setTimeout(refocus, 800);
}

function wireLinks() {
  document.querySelectorAll('.site-header a[href^="#"], .site-menu a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!document.querySelector(id)) return;
      e.preventDefault();
      closeMenu(false);
      jump(id, { push: true, ring: e.detail === 0 });
    });
  });
  // Skip link: straight to the contact form, ready to type.
  document.querySelector('.skip-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    jump('#contact');
    document.querySelector('#c-email')?.focus({ preventScroll: true });
  });
  wireMenu();
}

/** Open, close and dismiss the menu. Shared by the animated and static pages. */
function wireMenu() {
  menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  closeBtn.addEventListener('click', () => closeMenu());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) closeMenu(); });
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(false);
  });
  // Tabbing out of the open menu closes it, so it never covers the page behind.
  menu.addEventListener('focusout', (e) => {
    const to = e.relatedTarget;
    if (!menu.hidden && to && !menu.contains(to) && to !== menuBtn) closeMenu(false);
  });
}

export function build() {
  wireLinks();
}

/** GSAP failed to load: plain anchor jumps, header always shown. */
export function buildStatic() {
  wireMenu();
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => closeMenu(false)));
  set('shown');
}

let settleNow = () => {};
/** Write the header state for the current position (after a programmatic jump). */
export function settle() { settleNow(); }

export function animate() {
  window.addEventListener('hashchange', onHash);
  let last = window.scrollY;
  const process = document.querySelector('#process');
  const work = document.querySelector('#work');
  const people = document.querySelector('#people');
  // The short-screen reel uses the top band for poster artwork and credits.
  // Keep the Menu chip clear of artwork in short Work and small People layouts.
  // Restore the regular header policy outside those pins.
  const compactWork = (y) => {
    return [work, people].some((section) => {
      const short = window.innerHeight <= 520 || (section === people && window.innerWidth <= 400 && window.innerHeight <= 620);
      if (!short) return false;
      const pin = section._st;
      return pin && y >= pin.start && y < pin.end;
    });
  };
  // The blank page starts once the erase has begun (90% through the process pin).
  // Worked out from the pin itself, so it never depends on update order.
  const atContact = (y) => {
    const p = process._st;
    return p ? y >= p.start + (p.end - p.start) * 0.9 : root.dataset.end === 'contact';
  };

  const st = ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      if (atContact(y)) set('gone');
      else if (y < 40) set('top');
      else if (compactWork(y)) set('compact');
      else if (y < last - 2) set('shown');
      else if (y > last + 2) set('compact');
      last = y;
    },
  });
  // After a re-measure (resize, rotation) write the state for where the page ended up;
  // onUpdate alone can be left holding the transient top-of-page reading.
  let headerSize = { width: window.innerWidth, height: window.innerHeight };
  let beforeHeightRefit = null;
  const rememberHeader = () => {
    beforeHeightRefit = window.innerWidth === headerSize.width && window.innerHeight !== headerSize.height ? state : null;
  };
  const settle = () => {
    const y = window.scrollY;
    last = y;
    set(atContact(y) ? 'gone' : y < 40 ? 'top' : compactWork(y) ? 'compact' : beforeHeightRefit === 'shown' ? 'shown' : 'compact');
    headerSize = { width: window.innerWidth, height: window.innerHeight };
    beforeHeightRefit = null;
  };
  ScrollTrigger.addEventListener('refreshInit', rememberHeader);
  ScrollTrigger.addEventListener('refresh', settle);
  settleNow = settle;

  return () => { st.kill(); settleNow = () => {}; ScrollTrigger.removeEventListener('refresh', settle); ScrollTrigger.removeEventListener('refreshInit', rememberHeader); window.removeEventListener('hashchange', onHash); };
}
function onHash() { followHash(still() ? 'auto' : 'smooth', { emptyToTop: true }); }
/** One motion policy for the page: OS setting, ?motion=off and the menu's choice (main.js sets .is-motion). */
function still() { return !root.classList.contains('is-motion'); }

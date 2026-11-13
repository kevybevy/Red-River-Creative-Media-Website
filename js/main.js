// Boot. Each scene module exports:
//   build()             one-time DOM work (split text, generate shapes)
//   animate(conditions) set up scroll animation; return a cleanup if needed
// gsap.matchMedia() re-runs animate() when reduced-motion or the mobile
// breakpoint changes, and reverts everything it created.
//
// Scenes that pin also store two things on their <section> for other modules:
//   section._st    the pin's ScrollTrigger (start/end in px)
//   section._land  a function returning the scroll Y where the scene is settled
//                  and readable; header nav links jump there.
import './section-nav.js';
import * as hero from './scenes/hero.js';
import * as redact from './scenes/redact.js';
import * as collage from './scenes/collage.js';
import * as typewriter from './scenes/typewriter.js';
import * as people from './scenes/people.js';
import * as scrawl from './scenes/scrawl.js';
import * as contact from './scenes/contact.js';
import * as header from './header.js';
import * as overlay from './overlay.js';

const root = document.documentElement;

// Page order matters: pins must be created top to bottom. Header and overlay last.
const modules = [hero, redact, collage, typewriter, people, scrawl, contact, header, overlay];

// Scenes pulled up one screen so their pin starts as the previous pin ends.
const OVERLAP = ['#studio', '#work', '#services', '#people', '#process', '#contact'];
// Of those, the ones that stay hidden until their own pin starts.
const HANDOFF = ['#studio', '#work', '#services', '#people', '#process'];

// One motion policy, the same as the blog and portfolio pages: ?motion=off,
// then the visitor's choice from the menu, then the OS setting.
let motionPref = null; // this visit's choice; also the fallback when storage is blocked
const queryOff = () => /[?&]motion=off\b/.test(location.search);
const osReduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function motionOff() {
  if (motionPref) return motionPref === 'off';
  try { return localStorage.getItem('rr-motion') === 'off'; } catch { return false; }
}

function setHandoffs(on) {
  OVERLAP.forEach((id) => document.querySelector(id).classList.toggle('is-overlap', on));
  HANDOFF.forEach((id) => {
    const el = document.querySelector(id);
    el.classList.toggle('is-handoff', on);
    if (!on) el.classList.remove('is-live');
  });
}

/**
 * A viewport change re-measures every pin (and crossing 760px rebuilds them), so the
 * same scrollY can land in a different scene. Remember which scene the visitor is in
 * and how far through it, and put them back there after the re-measure.
 */
// Pinned scenes sit inside pin-spacers, so not 'main > section'.
const sections = () => [...document.querySelectorAll('main section[data-label]')];
const span = (s) => {
  if (s._st) return [s._st.start, s._st.end];
  const box = s.parentElement.classList.contains('pin-spacer') ? s.parentElement : s;
  const top = box.getBoundingClientRect().top + window.scrollY;
  return [top, top + box.offsetHeight];
};

/** Where the reader is: the scene, how far through it, and (Work, People) which film or person. */
function placeNow() {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  let at = { id: 'top', p: 0 };
  for (const s of sections()) {
    const [a, b] = span(s);
    if (a <= y + 1) at = { id: s.id, p: Math.min(1, Math.max(0, (y - a) / Math.max(1, b - a))) };
  }
  if (!root.classList.contains('is-motion')) {
    // A static card can fill the reading area while its section starts just
    // below the viewport top. Select that card's scene before the top fallback.
    // Co-visible cards keep document order; unchanged toggles retain their
    // explicit item through the keeper rather than inferring a new selection.
    const middle = window.innerHeight / 2;
    const item = [...document.querySelectorAll('main .plate, main .person')].find((el) => {
      const r = el.getBoundingClientRect();
      return r.top <= middle && r.bottom >= middle && r.right > 0 && r.left < window.innerWidth;
    });
    const scene = item?.closest('section[data-label]');
    if (scene) {
      const [a, b] = span(scene);
      at = { id: scene.id, p: Math.min(1, Math.max(0, (y - a) / Math.max(1, b - a))) };
    }
  }
  if (y >= max - 2) at = { id: 'contact', p: 1 };
  const sec = document.getElementById(at.id);
  if (typeof sec._itemNow === 'function') at.item = sec._itemNow();
  else {
    // Static layout: the film or person nearest the middle of the screen.
    const items = [...sec.querySelectorAll('.plate, .person')];
    let best = Infinity;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2 ? 0 : Math.min(Math.abs(r.top - innerHeight / 2), Math.abs(r.bottom - innerHeight / 2));
      if (d < best && d < innerHeight / 2) { best = d; at.item = i; }
    });
  }
  return at;
}

/** Put the reader back at a place taken by placeNow(), in whichever layout is now active. */
function restorePlace(at) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const sec = document.getElementById(at.id);
  let y = 0;
  if (at.id === 'contact') y = max;
  else if (at.id !== 'top' && sec) {
    if (at.item != null && typeof sec._item === 'function') y = sec._item(at.item);
    else if (typeof sec._land === 'function') y = sec._land();
    else if (at.item != null) y = sec.querySelectorAll('.plate, .person')[at.item].getBoundingClientRect().top + window.scrollY - 72;
    else {
      // Static scene: its top, or the same share of a scene taller than the screen.
      const [a, b] = span(sec);
      y = b - a > window.innerHeight * 1.2 ? a + at.p * (b - a - window.innerHeight) : a;
    }
  }
  window.scrollTo({ top: Math.max(0, Math.min(max, Math.round(y))), behavior: 'instant' });
  ScrollTrigger.update();
}

function keepPlaceOnResize() {
  let anchor = null;
  let anchorY = window.scrollY;
  let size = `${window.innerWidth}x${window.innerHeight}`;
  // A rotation can rebuild the scenes (both breakpoints may change) and then
  // re-measure again on the debounced resize; each pass resets the scroll while it
  // measures. For a short while after a change, every re-measure puts the reader
  // back at the place taken before the change, instead of recording the reset.
  let rebuilt = false;
  let hold = null; // { anchor, until }
  const holding = () => hold && performance.now() < hold.until;
  // Reuse the toggle's film/person identity in animated and static layouts.
  const measure = () => placeNow();
  let capturedSize = size;
  // Register before the application's matchMedia query listeners. Capture the live pin
  // identity before its automatic revert can reset scrollY and remove metadata.
  // Both queries can change on one rotation; only the first may take the anchor.
  const beforeBreakpointChange = () => {
    const now = `${window.innerWidth}x${window.innerHeight}`;
    if (now === capturedSize) return;
    capturedSize = now;
    if (!root.classList.contains('is-motion') || gsap.core.reverting()) return;
    const work = document.getElementById('work');
    const pin = work._st;
    const y = window.scrollY;
    // The reload race is in Work. Read its old pin directly: a whole-page
    // measurement with the new viewport can misclassify a later People scene.
    if (pin && y >= pin.start && y < pin.end) {
      // Desktop _itemNow reads responsive geometry, already changed here.
      // Prefer the last stable reading position, including the intro, until new scrolling.
      if (anchor?.id === 'work' && Math.abs(y - anchorY) < 2) return;
      anchor = { id: 'work', p: (y - pin.start) / Math.max(1, pin.end - pin.start) };
      const item = work._itemNow?.();
      if (item != null) anchor.item = item;
      anchorY = y;
      hold = null;
    }
  };
  ['(max-width: 760px)', '(max-height: 520px)'].forEach((query) => {
    window.matchMedia(query).addEventListener('change', beforeBreakpointChange);
  });
  // Run before ScrollTrigger's orientation-triggered global revert. Both the
  // resize and query callbacks share the size key, so only one saves the anchor.
  window.addEventListener('resize', beforeBreakpointChange, { capture: true });
  // ScrollTrigger intentionally ignores small mobile height changes. Still refit
  // the scene once browser chrome settles, and keep recording new reading meanwhile.
  let heightRefresh;
  let heightPending = false;
  const refitHeight = () => {
    if (!heightPending) return;
    const [width, height] = size.split('x').map(Number);
    if (size === `${window.innerWidth}x${window.innerHeight}` || width !== window.innerWidth || Math.abs(window.innerHeight - height) > height * 0.25) {
      heightPending = false;
      return;
    }
    // Let native momentum finish before a refresh rewrites pin geometry.
    if (ScrollTrigger.isScrolling() || gsap.core.reverting() || ScrollTrigger.isRefreshing) return;
    heightPending = false;
    ScrollTrigger.refresh();
  };
  ScrollTrigger.addEventListener('scrollEnd', refitHeight);
  window.addEventListener('resize', () => {
    clearTimeout(heightRefresh);
    heightPending = false;
    const [width, height] = size.split('x').map(Number);
    if (width !== window.innerWidth || Math.abs(window.innerHeight - height) > height * 0.25) return;
    heightRefresh = setTimeout(() => { heightPending = true; refitHeight(); }, 300);
  }, { passive: true });
  const take = () => {
    if (ScrollTrigger.isRefreshing || gsap.core.reverting()) return;
    const [width, height] = size.split('x').map(Number);
    // Mobile orientation changes can briefly report an enormous layout height
    // before width catches up. Only accept the small height changes ignored by ST.
    if (size !== `${window.innerWidth}x${window.innerHeight}` && (width !== window.innerWidth || Math.abs(window.innerHeight - height) > height * 0.25)) return;
    // Scrub can finish on another film after scrollY has stopped changing.
    // Recheck that cheap identity before skipping the full position measure.
    const sec = anchor && document.getElementById(anchor.id);
    const identityChanged = root.classList.contains('is-motion') && typeof sec?._itemNow === 'function' && sec._itemNow() !== anchor.item;
    if (anchor && window.scrollY === anchorY && !identityChanged) return;
    if (holding()) {
      // Ignore our own restoration scroll, but let a new reading position
      // replace the old anchor, even during the post-refresh hold window.
      if (Math.abs(window.scrollY - hold.y) < 2) return;
      hold = null;
    }
    anchor = measure() || anchor;
    anchorY = window.scrollY;
  };
  const restore = (at) => {
    const sec = document.getElementById(at.id);
    if (!sec) return;
    // Work's intro has its own readable landing; a whole-pin fraction can
    // become a partially clipped first film when orientation changes.
    if ((at.item != null && at.item >= 0) || (at.id === 'work' && typeof sec._land === 'function')) restorePlace(at);
    else {
      const [a, b] = span(sec);
      window.scrollTo(0, Math.round(a + at.p * (b - a)));
      ScrollTrigger.update();
    }
    if (hold) hold.y = window.scrollY;
    anchorY = window.scrollY;
  };
  window.addEventListener('scroll', take, { passive: true });
  // A scrubbed reel can paint its new film before the native scroll event.
  // Sample after GSAP renders; unchanged positions and identities return early.
  gsap.ticker.add(take);
  ScrollTrigger.addEventListener('refresh', () => {
    const now = `${window.innerWidth}x${window.innerHeight}`;
    if (anchor && (now !== size || rebuilt)) hold = { anchor, until: performance.now() + 1600 };
    size = now;
    rebuilt = false;
    if (holding()) restore(hold.anchor);
    take();
  });
  take();
  return {
    // Mark a rebuild so the next refresh restores the saved place.
    teardown: () => { rebuilt = true; },
    // The page moved the reader on purpose (motion toggle): hold this place instead.
    keep: (at) => { anchor = at || measure() || anchor; anchorY = window.scrollY; if (holding()) { hold.anchor = anchor; hold.y = anchorY; } },
    // Static People can show both people at once. Preserve the explicit item
    // until a new reading scroll changes the saved position.
    current: () => anchor?.item != null && Math.abs(window.scrollY - anchorY) < 4 ? anchor : null,
  };
}

if (!window.gsap || !window.ScrollTrigger) {
  // Animation library failed to load: the page stays static and readable.
  root.classList.remove('pre-intro');
  root.classList.add('no-gsap');
  contact.build();
  header.buildStatic();
  console.warn('GSAP did not load. Showing the static page.');
} else {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const place = keepPlaceOnResize(); // registered before the scenes, so it runs first on each refresh

  modules.forEach((m) => m.build?.());

  const mm = gsap.matchMedia();
  mm.add(
    { motion: '(prefers-reduced-motion: no-preference)', small: '(max-width: 760px)', short: '(max-height: 520px)' },
    (ctx) => {
      // ?motion=off previews the reduced-motion version without changing OS settings;
      // the menu's "Reduce motion" button stores the same choice for this visitor.
      const forceStill = queryOff() || motionOff();
      if (!(ctx.conditions.motion && !forceStill)) root.classList.remove('pre-intro');
      // compact: phones in either orientation (narrow, or short like phone landscape).
      // Pins are shorter there and the Work reel stops on each film.
      const c = { ...ctx.conditions, motion: ctx.conditions.motion && !forceStill, compact: ctx.conditions.small || ctx.conditions.short };
      root.classList.toggle('is-motion', c.motion);
      setHandoffs(c.motion);
      const cleanups = modules.map((m) => m.animate?.(c)).filter((f) => typeof f === 'function');

      // A handoff scene is visible ("live") from 2px before its pin starts, so the
      // frame the previous pin ends on already shows it. Read straight from the
      // scroll position on every scroll and refresh, so it can never go stale.
      const handoffs = HANDOFF.map((id) => document.querySelector(id));
      const syncLive = () => {
        if (!c.motion) return;
        const y = window.scrollY;
        handoffs.forEach((s) => s._st && s.classList.toggle('is-live', y >= s._st.start - 2));
      };
      window.addEventListener('scroll', syncLive, { passive: true });
      ScrollTrigger.addEventListener('refresh', syncLive);
      syncLive();

      return () => {
        place.teardown();
        window.removeEventListener('scroll', syncLive);
        ScrollTrigger.removeEventListener('refresh', syncLive);
        cleanups.forEach((f) => f());
        // The pins are gone: drop their landing data so nav falls back to plain
        // document positions (e.g. after switching to reduced motion mid-visit).
        document.querySelectorAll('main section').forEach((s) => { delete s._st; delete s._land; delete s._item; delete s._itemNow; });
        setHandoffs(false);
        root.classList.remove('is-motion');
      };
    },
  );

  // "Reduce motion" in the menu: an on-page way to stop the animation (WCAG 2.2.2).
  // When the OS setting or ?motion=off already stops it, the button says so and
  // stays pressed (the page does not override either).
  const motionBtn = document.querySelector('.site-menu__motion');
  const note = motionBtn.querySelector('.site-menu__note');
  const status = document.getElementById('motion-status');
  const showMotion = () => {
    const by = queryOff() ? 'link' : osReduce() ? 'device' : '';
    motionBtn.setAttribute('aria-pressed', String(Boolean(by) || motionOff()));
    if (by) motionBtn.setAttribute('aria-disabled', 'true'); else motionBtn.removeAttribute('aria-disabled');
    if (note) note.textContent = by ? ` (set by ${by === 'link' ? 'this link' : 'your device'})` : '';
  };
  // Toggling twice without scrolling returns to exactly the same film or person,
  // even where the still layout shows two of them side by side.
  let lastToggle = null;
  motionBtn.addEventListener('click', () => {
    if (motionBtn.getAttribute('aria-disabled') === 'true') return;
    let at = place.current() || placeNow();
    if (lastToggle && Math.abs(window.scrollY - lastToggle.y) < 4 && lastToggle.at.id === at.id) at = lastToggle.at;
    const next = motionOff() ? 'on' : 'off';
    motionPref = next;
    try { localStorage.setItem('rr-motion', next); } catch { /* kept for this visit only */ }
    header.closeMenu(false);
    showMotion();
    // Tear down or rebuild the pins, re-measure, then put the reader back in the
    // same scene (and the same film or person), in the new layout.
    gsap.matchMediaRefresh();
    ScrollTrigger.refresh();
    restorePlace(at);
    place.keep(at);
    lastToggle = { at, y: window.scrollY };
    // The header state follows the new position (not the jump's direction), so
    // the Menu chip is showing when focus returns to it.
    header.settle();
    document.querySelector('.site-header__menu').focus({ preventScroll: true });
    if (status) status.textContent = next === 'off' ? 'Motion reduced.' : 'Motion on.';
  });
  showMotion();
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', showMotion);

  // Fonts and images change layout; re-measure once they are in.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => {
    ScrollTrigger.refresh();
    header.followHash('auto'); // deep links land where a nav click would
  });
}

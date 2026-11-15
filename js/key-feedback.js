// Momentary feedback only. This never changes the action or selected state.
(() => {
  const selector = '.section-keys button,.site-header__menu,.site-header__tabs a,.site-menu__list a,.site-menu__pages a,.site-menu__close,.bar nav a.link,.film__watch,.portfolio-blog a';
  let pressed = null;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('no-motion') || (document.querySelector('.section-keys') && !document.documentElement.classList.contains('is-motion'));
  function release() {
    if (!pressed) return;
    const el = pressed; pressed = null;
    el.classList.remove('key-down');
    if (!still()) { el.classList.remove('key-return'); void el.offsetWidth; el.classList.add('key-return'); }
  }
  function start(target) {
    const el = target instanceof Element && target.closest(selector);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    release(); pressed = el; el.classList.remove('key-return'); el.classList.add('key-down');
  }
  document.addEventListener('pointerdown', e => { if (e.button === 0) start(e.target); });
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  document.addEventListener('keydown', e => { if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) start(e.target); });
  document.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') release(); });
  document.addEventListener('focusout', release);
  document.addEventListener('animationend', e => { if (e.animationName === 'key-spring') e.target.classList.remove('key-return'); });
  window.addEventListener('blur', release);
})();

// Quiet motion for the blog and portfolio pages. Copied into blog/ and
// portfolio/ by tools/subpages/build.py; edit tools/subpages/motion.js.
//  - sections fade up once as they come into view
//  - the header slides away while reading down and returns on the way up
//  - post and film pages show a reading hairline at the top
// Nothing runs for visitors who ask for reduced motion, and the "motion" class
// that hides content before it reveals is only set by the inline head script.
(function () {
  window.RRmotion = true;
  var root = document.documentElement;
  var motion = root.classList.contains('motion');

  // Reveal on scroll. Items in the same group stagger by their --i.
  if (motion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });
  }

  // Header: hide on the way down, show on the way up or near the top.
  var bar = document.querySelector('.bar');
  var progress = document.querySelector('.progress');
  var lastY = window.scrollY;
  var ticking = false;
  function onScroll() {
    var y = window.scrollY;
    if (bar) {
      bar.classList.toggle('is-scrolled', y > 8);
      var within = bar.contains(document.activeElement);
      if (motion && !within && y > lastY + 4 && y > 160) bar.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 160 || within) bar.classList.remove('is-hidden');
    }
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty('--read', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  if (bar) bar.addEventListener('focusin', function () { bar.classList.remove('is-hidden'); });
  onScroll();
})();

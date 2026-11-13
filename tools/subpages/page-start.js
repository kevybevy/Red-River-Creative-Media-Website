// Run in the head before layout. Fresh visits and reloads open at the top;
// explicit fragment links and browser Back/Forward keep their native behavior.
(function () {
  var navigation = performance.getEntriesByType('navigation')[0];
  var returning = navigation && navigation.type === 'back_forward';
  if ('scrollRestoration' in history) history.scrollRestoration = returning ? 'auto' : 'manual';
  function start(event) {
    if (location.hash || returning || (event && event.persisted)) return;
    window.scrollTo(0, 0);
  }
  start();
  window.addEventListener('pageshow', start);
  // Store an automatic restoration policy with the departing history entry,
  // including when this document is retained in the back/forward cache.
  window.addEventListener('pagehide', function () {
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
  });
})();

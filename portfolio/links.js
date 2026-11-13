// Where the main site, blog and portfolio live.
// Every cross-site link carries data-link="home|blog|portfolio" and a relative
// href that works when the pages are folders (/blog/, /portfolio/), which is
// how the local preview serves them.
// When the blog and portfolio go live on subdomains, set
// <html data-hosting="subdomains"> on all three pages. Links are then rewritten
// to https://<domain>/, https://blog.<domain>/ and https://portfolio.<domain>/,
// keeping any #section. The same file is in js/, blog/ and portfolio/.
(function () {
  if (document.documentElement.dataset.hosting !== 'subdomains') return;
  var labels = location.hostname.split('.');
  if (/^(www|blog|portfolio)$/.test(labels[0])) labels = labels.slice(1);
  var domain = labels.join('.');
  var base = {
    home: 'https://' + domain + '/',
    blog: 'https://blog.' + domain + '/',
    portfolio: 'https://portfolio.' + domain + '/',
  };
  function rewrite() {
    document.querySelectorAll('a[data-link]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var i = href.indexOf('#');
      var url = base[a.dataset.link];
      if (url) a.href = url + (i > -1 ? href.slice(i) : '');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rewrite);
  else rewrite();
})();

// ?motion=off (the reduced-motion preview) is carried on links to the other
// pages of the site, so the whole visit stays still. Runs after the hosting
// rewrite above, so it applies to subdomain links too.
(function () {
  if (!/[?&]motion=off\b/.test(location.search)) return;
  function carry() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto|tel):/.test(href)) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin && !a.hasAttribute('data-link')) return; // other sites
      url.searchParams.set('motion', 'off');
      a.href = url.href;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', carry);
  else carry();
})();

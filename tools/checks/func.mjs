// Behaviour checks for the changed site. usage: node func.mjs <changedURL> <originalURL> <shotDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');

const [,, NEW, OLD, OUT] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`); };

async function open(url, { w = 1440, h = 900, block, storage, reduced = 'no-preference', wait = 6000 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  if (storage) await page.addInitScript((s) => { try { localStorage.setItem('rr-motion', s); } catch {} }, storage);
  if (block) await page.route((u) => block.some((b) => u.href.includes(b)), (r) => r.abort());
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await sleep(wait);
  return { ctx, page, errs };
}
const at = (page, id, f) => page.evaluate(([id, f]) => { const s = document.getElementById(id)._st; const y = Math.round(s.start + (s.end - s.start) * f); scrollTo(0, y); return y; }, [id, f]);
// Share of canvas pixels with ink in the left and right halves of the People canvas.
const ink = (page) => page.evaluate(() => {
  const c = document.querySelector('.people__canvas'); const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
  return n;
});

// ---- 1. Portraits load independently -----------------------------------------------
for (const [who, file, other, otherAt, ownAt] of [['Janelle', 'people/janelle.webp', 'Dru', 0.74, 0.22], ['Dru', 'people/dru.webp', 'Janelle', 0.22, 0.74]]) {
  const { ctx, page, errs } = await open(NEW + '/', { block: [file] });
  await at(page, 'people', otherAt); await sleep(5000);
  const otherInk = await ink(page);
  check(`${who}'s photo blocked: ${other}'s particle portrait still renders`, otherInk > 5000, `${otherInk} inked px`);
  await at(page, 'people', ownAt); await sleep(2500);
  const cls = await page.evaluate(() => [...document.querySelectorAll('.person')].map((p) => p.classList.contains('is-photo')));
  check(`${who}'s photo blocked: only ${who} falls back to the ordinary photo`, who === 'Janelle' ? cls[0] && !cls[1] : !cls[0] && cls[1], JSON.stringify(cls));
  await page.screenshot({ path: `${OUT}/blocked-${who.toLowerCase()}-own.png` });
  check(`${who}'s photo blocked: no script errors`, errs.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e)).length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
{ // the original, for contrast
  const { ctx, page } = await open(OLD + '/', { block: ['people/janelle.webp'] });
  await at(page, 'people', 0.74); await sleep(5000);
  const n = await ink(page);
  console.log(`INFO  original site with Janelle's photo blocked: Dru's portrait has ${n} inked px (0 = the reported bug)`);
  await ctx.close();
}
{ // fallback photo is a real image when sampling fails but the file is fine
  const { ctx, page } = await open(NEW + '/', { wait: 1000 });
  await page.evaluate(() => { const o = CanvasRenderingContext2D.prototype.getImageData; let n = 0; CanvasRenderingContext2D.prototype.getImageData = function (...a) { if (this.canvas.width === 220 && n++ === 0) throw new Error('blocked'); return o.apply(this, a); }; });
  await sleep(5000);
  await at(page, 'people', 0.22); await sleep(5000);
  const st = await page.evaluate(() => { const p = document.querySelector('.person--a'); const i = p.querySelector('img'); return { cls: p.classList.contains('is-photo'), shown: getComputedStyle(i).display, w: i.naturalWidth, box: i.getBoundingClientRect().height }; });
  check('Sampling fails for one photo: its ordinary photo is shown with the bio', st.cls && st.shown === 'block' && st.w > 0 && st.box > 100, JSON.stringify(st));
  await page.screenshot({ path: `${OUT}/sample-failed-janelle.png` });
  await at(page, 'people', 0.74); await sleep(2500);
  check('Sampling fails for one photo: the other still renders as particles', await ink(page) > 5000);
  await ctx.close();
}
for (const [name, w, h] of [['phone', 390, 844], ['landscape', 844, 390], ['small', 320, 568]]) {
  const { ctx, page } = await open(NEW + '/', { w, h, block: ['people/janelle.webp'], wait: 5000 });
  await at(page, 'people', 0.22); await sleep(5000);
  // serve the photo again so the fallback <img> itself can be seen in the layout
  await page.unrouteAll(); await page.evaluate(() => { const i = document.querySelector('.person--a img'); i.src = i.src + '?retry'; });
  await sleep(1500);
  const r = await page.evaluate(() => { const p = document.querySelector('.person--a').getBoundingClientRect(); return { top: Math.round(p.top), bottom: Math.round(p.bottom), vh: innerHeight }; });
  check(`Fallback photo fits on screen (${name})`, r.top >= 0 && r.bottom <= r.vh, JSON.stringify(r));
  await page.screenshot({ path: `${OUT}/fallback-${name}.png` });
  await ctx.close();
}
{ // normal load: no fallback, both render
  const { ctx, page, errs } = await open(NEW + '/');
  await at(page, 'people', 0.22); await sleep(5000);
  const a = await ink(page); await at(page, 'people', 0.74); await sleep(2500); const b = await ink(page);
  const cls = await page.evaluate(() => document.querySelectorAll('.person.is-photo').length);
  check('Normal load: both particle portraits render, no fallback', a > 5000 && b > 5000 && cls === 0, `${a} / ${b} inked px`);
  check('Normal load: no console errors', errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}

// ---- 2. Grain ----------------------------------------------------------------------
{
  const read = async (url) => {
    const { ctx, page } = await open(url + '/');
    const out = [];
    for (const [id, f] of [['top', 0.5], ['studio', 0.5], ['work', 0.5], ['services', 0.5], ['people', 0.5], ['process', 0.5], ['process', 0.99]]) {
      await at(page, id, f); await sleep(1800);
      out.push(await page.evaluate(() => getComputedStyle(document.querySelector('.grain')).opacity));
    }
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await sleep(1800);
    out.push(await page.evaluate(() => getComputedStyle(document.querySelector('.grain')).opacity));
    const onRoot = await page.evaluate(() => document.documentElement.style.getPropertyValue('--grain'));
    await ctx.close();
    return { out, onRoot };
  };
  const [n, o] = [await read(NEW), await read(OLD)];
  check('Grain opacity is the same as the original at every scene', JSON.stringify(n.out) === JSON.stringify(o.out), n.out.join(' '));
  check('Grain variable is no longer written on <html>', n.onRoot === '' && o.onRoot !== '', `new "${n.onRoot}" old "${o.onRoot}"`);
}

// ---- 3. Reduced motion on the contact form --------------------------------------------
{
  const dur = (page) => page.evaluate(() => ({ still: document.documentElement.classList.contains('is-still'), send: getComputedStyle(document.querySelector('.contact__send')).transitionDuration, field: getComputedStyle(document.querySelector('.contact__field--message')).transitionDuration }));
  const zero = (s) => s.split(',').every((v) => parseFloat(v) === 0);
  let r;
  { const { ctx, page } = await open(NEW + '/?motion=off', { wait: 1500 }); r = await dur(page); check('?motion=off: Send and message transitions are off', r.still && zero(r.send) && zero(r.field), JSON.stringify(r)); await ctx.close(); }
  { const { ctx, page } = await open(NEW + '/', { storage: 'off', wait: 1500 }); r = await dur(page); check('Stored "Reduce motion" choice: transitions are off', r.still && zero(r.send) && zero(r.field), JSON.stringify(r)); await ctx.close(); }
  { const { ctx, page } = await open(OLD + '/?motion=off', { wait: 1500 }); r = await dur(page); console.log(`INFO  original site with ?motion=off: send transition ${r.send} (non-zero = the reported inconsistency)`); await ctx.close(); }
  // Phone size: the Menu chip is always shown there. On desktop it is hidden at the top of the page.
  { const { ctx, page } = await open(NEW + '/', { w: 390, h: 844, wait: 6000 });
    r = await dur(page); check('Motion on: transitions unchanged', !r.still && !zero(r.send) && !zero(r.field), JSON.stringify(r));
    await page.click('.site-header__menu'); await sleep(600); await page.click('.site-menu__motion'); await sleep(1200);
    r = await dur(page); check('Menu "Reduce motion" pressed: transitions turn off', r.still && zero(r.send), JSON.stringify(r));
    await page.click('.site-header__menu'); await sleep(600); await page.click('.site-menu__motion'); await sleep(1500);
    r = await dur(page); check('Menu "Reduce motion" released: transitions return', !r.still && !zero(r.send), JSON.stringify(r));
    await ctx.close(); }
}

// ---- 4. Section keys say the same thing as before -------------------------------------
{
  const read = async (url, opt) => {
    const { ctx, page } = await open(url + '/', opt);
    const out = [];
    for (const [id, f] of [['top', 0], ['top', 0.6], ['studio', 0.5], ['work', 0.2], ['work', 0.7], ['services', 0.5], ['people', 0.2], ['people', 0.8], ['process', 0.5]]) {
      await at(page, id, f); await sleep(1500);
      out.push(await page.evaluate(() => [...document.querySelectorAll('.section-keys button')].map((b) => [b.getAttribute('aria-label'), b.title, b.getAttribute('aria-disabled')].join('~')).join(' || ')));
    }
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await sleep(1500);
    out.push(await page.evaluate(() => [...document.querySelectorAll('.section-keys button')].map((b) => [b.getAttribute('aria-label'), b.title, b.getAttribute('aria-disabled')].join('~')).join(' || ')));
    await ctx.close();
    return out;
  };
  for (const [name, opt] of [['desktop', {}], ['phone', { w: 390, h: 844 }]]) {
    const [n, o] = [await read(NEW, opt), await read(OLD, opt)];
    check(`Section keys: labels, titles and disabled state match the original (${name}, 10 positions)`, JSON.stringify(n) === JSON.stringify(o), n[3]);
  }
  const { ctx, page } = await open(NEW + '/');
  const before = await page.evaluate(() => scrollY);
  await page.click('.section-keys [data-direction="1"]'); await sleep(7000);
  const after = await page.evaluate(() => [scrollY, document.getElementById('studio')._land()]);
  check('Section key "next" still travels to the next scene', Math.abs(after[0] - after[1]) < 3 && after[0] > before, after.join(' vs '));
  await ctx.close();
}

// ---- 5. Contact form posts to Netlify Forms -------------------------------------------
{
  const run = async (status, fillTrap) => {
    const { ctx, page } = await open(NEW + '/?motion=off', { wait: 1500 });
    const posts = [];
    await page.route((u) => u.pathname === '/', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.continue();
      posts.push({ body: req.postData(), type: req.headers()['content-type'] });
      await route.fulfill({ status, body: status === 200 ? '<html></html>' : 'Not found' });
    });
    await page.evaluate(() => document.querySelector('#contact').scrollIntoView());
    await page.fill('#c-email', 'visitor@example.com');
    await page.fill('#c-message', 'Hello & welcome = test');
    if (fillTrap) await page.evaluate(() => { document.querySelector('#c-company').value = 'bot'; });
    await page.click('.contact__send');
    await sleep(1200);
    const res = { posts, status: await page.evaluate(() => document.querySelector('.contact__status').textContent), stage: await page.evaluate(() => document.querySelector('.contact__form').dataset.stage), kept: await page.inputValue('#c-message') };
    await ctx.close();
    return res;
  };
  let r = await run(200, false);
  check('Form: one urlencoded POST to / with form-name, email and message', r.posts.length === 1 && r.posts[0].body === 'form-name=contact&email=visitor%40example.com&message=Hello+%26+welcome+%3D+test' && /x-www-form-urlencoded/.test(r.posts[0].type), r.posts[0]?.body);
  check('Form: success shows the thank-you message with no preview note', r.stage === 'sent' && /thank you/.test(r.status) && !/Preview/.test(r.status), r.status);
  r = await run(404, false);
  check('Form: a failed post shows the retry message and keeps the text', r.stage === 'typing' && /did not go through/.test(r.status) && r.kept.includes('Hello'), r.status);
  r = await run(200, true);
  check('Form: honeypot filled sends nothing and shows thanks', r.posts.length === 0 && r.stage === 'sent', `${r.posts.length} posts`);
  const html = await (await fetch(NEW + '/')).text();
  check('Form markup declares the Netlify form and honeypot', /<form[^>]*name="contact"[^>]*data-netlify="true"[^>]*netlify-honeypot="company"/.test(html));
}

// ---- 6. Deep links, missing GSAP, landscape count, subpages ---------------------------
for (const id of ['work', 'people', 'contact']) {
  const { ctx, page } = await open(NEW + '/#' + id, { wait: 7000 });
  const r = await page.evaluate((id) => { const s = document.getElementById(id); const max = document.documentElement.scrollHeight - innerHeight; return [Math.round(scrollY), Math.round(id === 'contact' ? max : s._land())]; }, id);
  check(`Deep link /#${id} lands on the settled scene`, Math.abs(r[0] - r[1]) < 4, r.join(' vs '));
  await ctx.close();
}
{
  const { ctx, page, errs } = await open(NEW + '/', { block: ['vendor/gsap.min.js'], wait: 5000 });
  const r = await page.evaluate(() => ({ noGsap: document.documentElement.classList.contains('no-gsap'), motion: document.documentElement.classList.contains('is-motion'), pre: document.documentElement.classList.contains('pre-intro'), text: document.querySelector('#people h3').getBoundingClientRect().height > 0 }));
  check('GSAP file missing: static readable page', r.noGsap && !r.motion && !r.pre && r.text, JSON.stringify(r));
  await ctx.close();
}
{
  const count = async (url) => { const { ctx, page } = await open(url + '/', { w: 844, h: 390 }); await at(page, 'people', 0.3); await sleep(6000); const n = await ink(page); await page.screenshot({ path: `${OUT}/landscape-people-${url === NEW ? 'new' : 'old'}.png` }); await ctx.close(); return n; };
  const [n, o] = [await count(NEW), await count(OLD)];
  check('Landscape phone: portrait is lighter than the original (fewer particles)', n < o * 0.85 && n > 5000, `${n} vs ${o} inked px`);
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pages = ['/blog/', '/blog/what-a-shoot-day-looks-like/', '/blog/how-an-edit-comes-together/', '/blog/releases-and-permissions/', '/blog/what-a-family-legacy-film-is/', '/blog/what-goes-into-a-film-budget/', '/blog/what-happens-on-the-first-call/', '/blog/what-you-get-at-delivery/', '/portfolio/', '/portfolio/saving-clayton/', '/portfolio/trans-oklahoma/', '/portfolio/oasis-in-atlanta/', '/portfolio/sacrificing-lincoln/', '/portfolio/relationship-rescue/'];
  let bad = [];
  for (const p of pages) {
    const page = await ctx.newPage(); const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('response', (r) => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
    await page.goto(NEW + p, { waitUntil: 'load' }); await sleep(500);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await sleep(700);
    const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src));
    if (errs.length || broken.length) bad.push(p + ': ' + [...errs, ...broken].join(', '));
    await page.close();
  }
  check('All 14 blog and portfolio pages load with no errors, 404s or broken images', bad.length === 0, bad.join(' | ').slice(0, 300));
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);

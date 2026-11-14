// Screenshot each homepage scene at fixed scroll positions.
// usage: node shots.mjs <baseURL> <outDir> [profiles] [--block=substring]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');

const [,, base, out, filter = '', ...rest] = process.argv;
const block = (rest.find((a) => a.startsWith('--block=')) || '').slice(8);
const FR = [0.05, 0.25, 0.5, 0.75, 0.95];
const PROFILES = [
  { name: 'desktop', w: 1440, h: 900, dsf: 1 },
  { name: 'phone', w: 390, h: 844, dsf: 2 },
  { name: 'landscape', w: 844, h: 390, dsf: 1 },
  { name: 'small', w: 320, h: 568, dsf: 1 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

for (const p of PROFILES) {
  if (filter && !filter.split(',').includes(p.name)) continue;
  for (const mode of ['motion', 'still']) {
    const dir = `${out}/${p.name}-${mode}`;
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: p.dsf, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    // Test only: GSAP's "from: 'random'" stagger order and the hero's glyph scramble use
    // Math.random, so they differ on every load. Pin them so frames can be compared exactly.
    await page.addInitScript(() => { Math.random = () => 0.5; });
    // CSS animations (grain jitter, mark spin, cursor blink) are time based: hold them at time 0.
    const freeze = () => page.evaluate(() => document.getAnimations().forEach((a) => {
      if (a instanceof CSSTransition) a.finish(); else { a.pause(); a.currentTime = 0; }
    }));
    const errs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    const failed = [];
    page.on('requestfailed', (r) => failed.push(r.url()));
    if (block) await page.route((u) => u.href.includes(block), (r) => r.abort());
    await page.goto(base + (mode === 'still' ? '/?motion=off' : '/'), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await sleep(mode === 'still' ? 1200 : 6000);
    // Freeze time-based CSS animation so frames depend on scroll position only.
    await page.addStyleTag({ content: '* { caret-color: transparent !important; }' });
    if (mode === 'still') {
      await freeze();
      await page.screenshot({ path: `${dir}/full.png`, fullPage: true });
    } else {
      const scenes = await page.evaluate(() => [...document.querySelectorAll('main section[data-label]')].map((s) => ({ id: s.id, st: s._st ? [s._st.start, s._st.end] : null })));
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const stops = [['top-0', 0]];
      for (const s of scenes) if (s.st) FR.forEach((f) => stops.push([`${s.id}-${String(f).slice(2)}`, Math.round(s.st[0] + (s.st[1] - s.st[0]) * f)]));
      stops.push(['end', max]);
      // Warm up: let the portraits load and sample before any frame is taken.
      const people = scenes.find((s) => s.id === 'people');
      if (people?.st) {
        await page.evaluate((y) => scrollTo(0, y), people.st[0] + 50);
        await sleep(4500);
        await page.evaluate(() => scrollTo(0, 0));
        await sleep(1500);
      }
      for (const [name, y] of stops) {
        await page.evaluate((y) => scrollTo(0, y), y);
        await sleep(2000);
        await freeze();
        await page.screenshot({ path: `${dir}/${name}.png` });
      }
    }
    const fonts = await page.evaluate(() => `${[...document.fonts].filter((f) => f.status === 'loaded').length}/${document.fonts.size}`);
    console.log(`${p.name}-${mode}: errors=${JSON.stringify(errs)} failed=${JSON.stringify(failed.map((u) => u.slice(0, 80)))} fonts=${fonts}`);
    await ctx.close();
  }
}
await browser.close();

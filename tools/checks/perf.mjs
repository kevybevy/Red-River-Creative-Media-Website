// Scroll through each pinned scene and report frame intervals and main-thread cost.
// usage: node perf.mjs <baseURL> [throttle=4] [profile=phone] [runs=3]
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');

const [,, base, throttle = '4', profile = 'phone', runs = '3'] = process.argv;
const VP = { phone: [390, 844], landscape: [844, 390], desktop: [1440, 900] }[profile];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

const browser = await chromium.launch();
const rows = {};
for (let run = 0; run < +runs; run++) {
  const ctx = await browser.newContext({ viewport: { width: VP[0], height: VP[1] }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await sleep(6000);
  const scenes = await page.evaluate(() => [...document.querySelectorAll('main section[data-label]')].filter((s) => s._st).map((s) => ({ id: s.id, a: s._st.start, b: s._st.end })));
  // Warm up the portraits so sampling is not part of the measurement.
  const people = scenes.find((s) => s.id === 'people');
  await page.evaluate((y) => scrollTo(0, y), people.a + 50);
  await sleep(5000);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle });
  for (const s of scenes) {
    await page.evaluate((y) => scrollTo(0, y), s.a);
    await sleep(1500);
    const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const frames = await page.evaluate(({ a, b }) => new Promise((resolve) => {
      const out = []; const dur = 2500; let last = performance.now(); const t0 = last;
      function tick(now) {
        out.push(now - last); last = now;
        const t = Math.min(1, (now - t0) / dur);
        scrollTo(0, a + (b - a) * t);
        if (t < 1) requestAnimationFrame(tick); else resolve(out.slice(1));
      }
      requestAnimationFrame(tick);
    }), s);
    const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const n = frames.length;
    (rows[s.id] ||= []).push({
      med: med(frames), p95: pct(frames, 0.95), n,
      script: (m1.ScriptDuration - m0.ScriptDuration) * 1000 / n,
      style: (m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000 / n,
      layout: (m1.LayoutDuration - m0.LayoutDuration) * 1000 / n,
    });
  }
  await ctx.close();
}
await browser.close();
console.log(`profile ${profile} ${VP.join('x')}, CPU throttle ${throttle}x, ${runs} runs (median of runs)`);
console.log('scene      med-frame  p95-frame  frames  script/f  style/f  layout/f');
for (const [id, r] of Object.entries(rows)) {
  const g = (k) => med(r.map((x) => x[k]));
  console.log(`${id.padEnd(10)} ${g('med').toFixed(1).padStart(8)}  ${g('p95').toFixed(1).padStart(9)}  ${String(g('n')).padStart(6)}  ${g('script').toFixed(2).padStart(8)}  ${g('style').toFixed(2).padStart(7)}  ${g('layout').toFixed(2).padStart(8)}`);
}

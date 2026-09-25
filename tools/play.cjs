// Scripted play-through for testing.
// Usage: node tools/play.cjs <script.js> [outDir] [w] [h]
// The script module exports async function(page, api) where api has helpers:
//   shot(name), click(selector), tap(x, y), wait(ms), eval(fn|string), log(...)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const [scriptPath, outDir = '/tmp', w = '1280', h = '720'] = process.argv.slice(2);
  const script = require(path.resolve(scriptPath));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => {
    const t = m.text();
    if (t.includes('[vite]') || t.includes('KHR_parallel')) return;
    logs.push(`[${m.type()}] ${t}`);
  });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`));
  let n = 0;
  const api = {
    async shot(name) {
      const f = path.join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`);
      await page.screenshot({ path: f });
      console.log('shot', f);
      return f;
    },
    async click(sel, { timeout = 8000 } = {}) {
      await page.waitForSelector(sel, { state: 'visible', timeout });
      await page.click(sel);
    },
    async tap(x, y) {
      await page.mouse.click(x, y);
    },
    wait: (ms) => page.waitForTimeout(ms),
    eval: (fn, arg) => page.evaluate(fn, arg),
    log: (...a) => console.log(...a),
    logs,
  };
  try {
    await script(page, api);
  } catch (e) {
    console.log('SCRIPT ERROR', e.message);
    try { await api.shot('error'); } catch (e2) { /* ignore */ }
  }
  console.log('---- page logs ----');
  console.log(logs.slice(-60).join('\n'));
  await browser.close();
})();

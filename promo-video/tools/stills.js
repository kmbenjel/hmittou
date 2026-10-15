// Stills at chosen times, for checking a cut without rendering it.
//   node tools/stills.js ar 0.5 3 9.2 ...   →  build/stills/ar-<t>.png
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { serve } = require('./serve');

(async () => {
  const [lang, ...times] = process.argv.slice(2);
  const out = path.resolve(__dirname, '..', 'build', 'stills');
  fs.mkdirSync(out, { recursive: true });
  const { server, url } = await serve(path.resolve(__dirname, '..', '..'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto(`${url}/promo-video/scene/index.html?lang=${lang}`);
  await page.evaluate(() => window.ready);
  const dur = await page.evaluate(() => window.DURATION);
  for (const t of times.map(Number)) {
    await page.evaluate(t => window.renderFrame(t), t);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const f = path.join(out, `${lang}-${t.toFixed(2)}.png`);
    await page.screenshot({ path: f });
    console.log(f);
  }
  console.log('duration', dur);
  await browser.close();
  server.close();
})();

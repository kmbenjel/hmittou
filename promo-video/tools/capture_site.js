// Real screenshots of the web edition, for the video.
//   node tools/capture_site.js   →  scene/img/site-*.png
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { serve } = require('./serve');
const OUT = path.resolve(__dirname, '..', 'scene', 'img');

(async () => {
  const { server, url } = await serve(path.resolve(__dirname, '..', '..'));
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--force-color-profile=srgb'] });
  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', colorScheme: 'light' };
  const open = async (opts) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.goto(url + '/index.html', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    return page;
  };
  const shot = (page, name, extra = {}) => page.screenshot({ path: path.join(OUT, `site-${name}.png`), ...extra });
  const click = async (page, action) => {
    await page.evaluate(a => document.querySelector(`.dock-btn[data-action="${a}"]`).click(), action);
    await page.waitForTimeout(1200);
  };

  let p = await open(phone);
  await shot(p, 'light-top');
  await shot(p, 'light-strip', { fullPage: true, clip: { x: 0, y: 0, width: 390, height: 844 * 4 } });
  await click(p, 'zoom-in'); await click(p, 'zoom-in');
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500);
  await shot(p, 'light-zoom');
  await p.context().close();

  p = await open({ ...phone, colorScheme: 'dark' });
  await shot(p, 'dark-top-auto');
  await p.context().close();

  p = await open(phone);
  await click(p, 'toggle-theme');
  await shot(p, 'dark-top');
  await click(p, 'scroll-part2');
  await p.waitForTimeout(1500);
  await shot(p, 'dark-part2');
  await p.context().close();

  p = await open(phone);
  await click(p, 'scroll-part2'); await p.waitForTimeout(1500);
  await shot(p, 'light-part2');
  await click(p, 'scroll-bottom'); await p.waitForTimeout(1500);
  await shot(p, 'light-bottom');
  await p.context().close();

  p = await open({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'light' });
  await shot(p, 'desk-top');
  await p.evaluate(() => window.scrollTo(0, 420)); await p.waitForTimeout(600);
  await shot(p, 'desk-verses');
  await p.context().close();

  await browser.close();
  server.close();
})();

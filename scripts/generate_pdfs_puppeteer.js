#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8765;

const BROWSER_CANDIDATES = [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'chrome',
];

const EXPORTS = [
  {
    query: 'mobile',
    output: path.join(ROOT, 'hmittou.pdf'),
    width: '120mm',
    height: '210mm',
    margin: { top: '12mm', right: '8mm', bottom: '13mm', left: '8mm' },
    pageNumberSize: '8pt',
    viewport: { width: 430, height: 820 },
  },
  {
    query: 'desktop',
    output: path.join(ROOT, 'hmittou_desktop.pdf'),
    format: 'A4',
    margin: { top: '16mm', right: '15mm', bottom: '18mm', left: '15mm' },
    pageNumberSize: '8pt',
    footerMask: true,
    viewport: { width: 1024, height: 1400 },
  },
];

function findBrowser() {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const candidate of BROWSER_CANDIDATES) {
    for (const dir of dirs) {
      const fullPath = path.join(dir, candidate);
      if (fs.existsSync(fullPath)) return fullPath;
    }
  }
  throw new Error('No Chromium-compatible browser found on PATH.');
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.pdf')) return 'application/pdf';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generate(browser, item) {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  if (item.viewport) {
    await page.setViewport({ deviceScaleFactor: 1, ...item.viewport });
  }

  const url = `http://127.0.0.1:${PORT}/index.html?print=${encodeURIComponent(item.query)}`;

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.emulateMediaType('print');
  await delay(2500);
  await page.evaluate(() => window.stop());
  await delay(250);

  const footerTemplate = item.footerMask
    ? `
      <div style="position:relative;width:100%;height:18mm;text-align:center;font-size:${item.pageNumberSize};color:#777;font-family:Arial,sans-serif;line-height:1;">
        <div style="position:absolute;left:0;right:0;top:0;height:15mm;background:#fff;"></div>
        <div style="position:absolute;left:0;right:0;bottom:2mm;"><span class="pageNumber"></span></div>
      </div>`
    : `
      <div style="width:100%; text-align:center; font-size:${item.pageNumberSize}; color:#777; font-family:Arial, sans-serif; line-height:1;">
        <span class="pageNumber"></span>
      </div>`;

  fs.rmSync(item.output, { force: true });
  await page.pdf({
    path: item.output,
    format: item.format,
    width: item.width,
    height: item.height,
    margin: item.margin,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate,
    preferCSSPageSize: false,
  });
  await page.close();

  const size = fs.statSync(item.output).size;
  if (size < 50_000) throw new Error(`PDF generation produced a suspiciously small file: ${item.output}`);
  console.log(`generated ${path.relative(ROOT, item.output)} (${size} bytes)`);
}

async function main() {
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: 'new',
    args: ['--disable-gpu', '--no-sandbox'],
  });
  try {
    const only = process.argv[2];
    const exportsToRun = only ? EXPORTS.filter((item) => item.query === only) : EXPORTS;
    if (!exportsToRun.length) throw new Error('Unknown PDF export: ' + only);
    for (const item of exportsToRun) await generate(browser, item);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});

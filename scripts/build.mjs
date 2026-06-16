#!/usr/bin/env node
// Build step — run from the repo root before deploying after editing any
// assets/js/*.js source:  npm run build
//
// For each source it minifies with esbuild, content-hashes the output, writes
// <name>.min.js, and rewrites the references in index.html and sw.js to
// ./assets/js/<name>.min.js?v=<hash>. The ?v= hash busts browser/CDN caches on
// change, so these files can be cached for a year. sw.js's CACHE_NAME is bumped
// only when a hash actually changes. The readable sources (app.js, gtm-loader.js)
// stay in the repo as the source of truth.

import esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ENTRIES = ['app', 'gtm-loader']; // assets/js/<name>.js

const hashes = {};
for (const name of ENTRIES) {
  const src = readFileSync(`assets/js/${name}.js`, 'utf8');
  const { code } = await esbuild.transform(src, {
    minify: true,
    target: 'es2019',
    legalComments: 'none',
  });
  writeFileSync(`assets/js/${name}.min.js`, code);
  hashes[name] = createHash('sha256').update(code).digest('hex').slice(0, 10);
  console.log(`  ${name}.js -> ${name}.min.js?v=${hashes[name]}  (${src.length} -> ${code.length} bytes)`);
}

const rewrite = (text) => {
  for (const name of ENTRIES) {
    const re = new RegExp(`\\./assets/js/${name}(?:\\.min)?\\.js(?:\\?v=[a-f0-9]+)?`, 'g');
    text = text.replace(re, `./assets/js/${name}.min.js?v=${hashes[name]}`);
  }
  return text;
};

const idx = readFileSync('index.html', 'utf8');
const idxNew = rewrite(idx);
if (idxNew !== idx) { writeFileSync('index.html', idxNew); console.log('  index.html: script refs updated'); }

const sw = readFileSync('sw.js', 'utf8');
const swNew = rewrite(sw);
if (swNew !== sw) {
  const bumped = swNew.replace(/hmittou-cache-v(\d+)/, (_, n) => `hmittou-cache-v${+n + 1}`);
  writeFileSync('sw.js', bumped);
  console.log(`  sw.js: refs updated, ${bumped.match(/hmittou-cache-v\d+/)[0]}`);
} else {
  console.log('  sw.js: unchanged (hashes identical)');
}
console.log('Build complete.');

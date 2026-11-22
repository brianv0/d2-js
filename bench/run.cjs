// Browser benchmark runner (Chromium via Playwright).
//
//   node bench/run.cjs [--wasm <path to @d2lang/d2 dist/browser/index.js>] [--bundle <dir of an esbuild --splitting build>] [--reps 5] [--runs 9]
//
// Needs `playwright` (npm i -D playwright; npx playwright install chromium). Cold start: a fresh browser context per repetition (empty HTTP
// cache), the page is loaded from a local gzip-ing static server, and the time from navigation start to the first rendered diagram is measured.
// Warm: one page per library renders each case and layout repeatedly after one warm-up render; median and minimum are reported.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), os = require('node:os');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const ROOT = path.resolve(__dirname, '..');
const wasmPath = opt('wasm', null), bundleDir = opt('bundle', null);
const reps = Number(opt('reps', 5)), runs = Number(opt('runs', 9));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.d2': 'text/plain', '.ttf': 'font/ttf', '.txt': 'text/plain' };
const gz = new Map();
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file;
  if (wasmPath && p === '/bench/wasm/index.js') file = wasmPath;
  else if (bundleDir && p.startsWith('/bench/bundle/')) file = path.join(bundleDir, p.slice('/bench/bundle/'.length));
  else file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) && file !== wasmPath && !(bundleDir && file.startsWith(path.resolve(bundleDir)))) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    const ext = path.extname(file);
    const h = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store' };
    if (['.html', '.js', '.json', '.css', '.d2', '.txt', '.ttf'].includes(ext)) {
      if (!gz.has(file)) gz.set(file, zlib.gzipSync(buf, { level: 6 }));
      h['content-encoding'] = 'gzip'; buf = gz.get(file);
    }
    res.writeHead(200, h).end(buf);
  });
});

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const targets = [{ label: 'd2-js (as shipped: unbundled ES modules)', page: '/bench/js.html' }];
  if (bundleDir) targets.push({ label: 'd2-js (minified, code-split bundle)', page: '/bench/bundle.html' });
  if (wasmPath) targets.push({ label: '@d2lang/d2 0.1.34 (WASM)', page: '/bench/wasm.html' });
  const results = { env: { chromium: browser.version(), cpu: os.cpus()[0].model, cpus: os.cpus().length, node: process.version, platform: os.platform() }, targets: [] };

  for (const t of targets) {
    const colds = [];
    for (let i = 0; i < reps; i++) {
      const ctx = await browser.newContext(); const page = await ctx.newPage();
      page.on('pageerror', (e) => console.error('pageerror', e.message));
      await page.goto(base + t.page); await page.waitForFunction(() => window.benchReady === true, null, { timeout: 120000 });
      colds.push(await page.evaluate(() => window.cold())); await ctx.close();
    }
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.goto(base + t.page); await page.waitForFunction(() => window.benchReady === true, null, { timeout: 120000 });
    const warm = await page.evaluate((o) => window.warm(o), { runs, budgetMs: 4000 });
    await ctx.close();
    const m = (k) => median(colds.map((c) => c[k]));
    results.targets.push({ label: t.label, cold: { loadMs: m('loadMs'), firstRenderMs: m('firstRenderMs'), sinceNavigationMs: m('sinceNavigationMs'), requests: colds[0].requests, encodedBytes: colds[0].encodedBytes, decodedBytes: colds[0].decodedBytes, reps }, warm });
    console.error('done', t.label);
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 1));
  console.log(JSON.stringify(results));
})().catch((e) => { console.error(e); process.exit(1); });

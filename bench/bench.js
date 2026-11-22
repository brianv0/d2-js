// Shared benchmark driver. A page defines `window.adapter = { name, load(), run(text, layout) -> Promise<svgLength> }`
// and loads this module; the runner (bench/run.cjs) calls window.cold() in fresh contexts and window.warm() once.
import { loadCases, LAYOUTS } from './cases.js';

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

window.cold = async () => {
  const t0 = performance.now();                       // ~ navigation start for the page timeline
  const a = window.adapter;
  const tl = performance.now(); await a.load(); const loadMs = performance.now() - tl;
  const cases = await loadCases(); const hello = cases[0];
  const tf = performance.now(); await a.run(hello.text, 'dagre'); const firstMs = performance.now() - tf;
  const total = performance.now();
  const res = performance.getEntriesByType('resource');
  const nav = performance.getEntriesByType('navigation')[0];
  return {
    name: a.name, loadMs, firstRenderMs: firstMs, sinceNavigationMs: total,
    requests: res.length, encodedBytes: res.reduce((s, r) => s + (r.encodedBodySize || 0), 0) + (nav?.encodedBodySize || 0),
    decodedBytes: res.reduce((s, r) => s + (r.decodedBodySize || 0), 0) + (nav?.decodedBodySize || 0),
  };
};

window.warm = async (opts = {}) => {
  const a = window.adapter; await a.load();
  const cases = await loadCases(); const out = [];
  for (const c of cases) for (const layout of (opts.layouts || LAYOUTS)) {
    const row = { case: c.name, kind: c.kind, layout };
    try {
      const t0 = performance.now(); await a.run(c.text, layout); row.firstMs = performance.now() - t0;   // includes lazy engine load
      const n = Math.max(3, Math.min(opts.runs || 9, Math.ceil((opts.budgetMs || 4000) / Math.max(row.firstMs, 1))));
      const times = [];
      for (let i = 0; i < n; i++) { const t = performance.now(); row.svgBytes = await a.run(c.text, layout); times.push(performance.now() - t); }
      row.medianMs = median(times); row.minMs = Math.min(...times); row.runs = n;
    } catch (e) { row.error = String(e && e.message || e).slice(0, 120); }
    out.push(row);
  }
  return out;
};
window.benchReady = true;

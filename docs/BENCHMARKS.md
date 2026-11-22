# Browser benchmarks

Measured in headless Chromium 157 (Playwright) on a 4-vCPU Intel Xeon @ 2.1 GHz virtual machine, pages served from a local gzip
server (no network latency). Raw numbers are in `bench/results.json`.

Rerun:

```bash
npm i -D playwright && npx playwright install chromium
npm pack @d2lang/d2@0.1.34 && tar xzf d2lang-d2-0.1.34.tgz            # for the WASM comparison
esbuild entry.js --bundle --splitting --minify --format=esm --target=es2022 --external:node:* --outdir=dist   # entry re-exports src/d2lib.js and src/d2svg.js
cp -r src/fonts src/lexers src/patterns dist/ && cp dist/<entry>.js dist/entry.js
node bench/run.cjs --wasm package/dist/browser/index.js --bundle dist --reps 5 --runs 9
```

## Cold start (empty cache, first diagram)

Median of 5 fresh browser contexts. "From navigation" is page load to the first rendered SVG.

| | load library | first diagram | from navigation | requests | transferred (gzip) |
|---|---|---|---|---|---|
| d2-js as shipped (unbundled ES modules) | 57 ms | 103 ms | **223 ms** | 51 | 529 KB |
| d2-js minified, code-split bundle | 38 ms | 105 ms | **197 ms** | 18 | 396 KB |
| `@d2lang/d2` 0.1.34 (WebAssembly) | 1288 ms | 745 ms | **2229 ms** | 6 | 8,364 KB |

The transferred size includes the fonts the first diagram uses (embed mode) and the metrics file.

## Warm render (compile + layout + SVG), median ms

After one warm-up render per case and layout. The first render with ELK or TALA also loads that engine; that cost is excluded here.

| diagram | dagre js / wasm | ELK js / wasm | TALA js / wasm |
|---|---|---|---|
| hello (3 nodes) | 13.9 / 32.1 | 21.1 / 23.2 | 119 / 242 |
| microservices (11 nodes) | 16.9 / 28.2 | 21.2 / 30.9 | 429 / 1,186 |
| containers (nested) | 18.4 / 44.1 | 27.9 / 44.9 | 264 / 675 |
| dense cyclic graph (12 nodes) | 8.1 / 22.0 | 17.2 / 23.6 | 974 / 1,987 |
| queue_workers (real world, 476 lines) | 46.5 / 95.0 | 55.4 / 113 | 1,793 / 4,886 |
| jupyter_aws_eks (real world, 289 lines) | 32.5 / 61.7 | 38.5 / 79.6 | 84 / 225 |
| ross_overview (real world, 322 lines) | 37.2 / 74.5 | 50.8 / 95.4 | 981 / 2,091 |

Across the seven diagrams the WebAssembly build takes between 1.7 and 2.7 times as long as the JavaScript port with dagre (median 2.0),
1.1 to 2.1 times with ELK (median 1.6) and 2.0 to 2.8 times with TALA (median 2.6). The minified bundle performs like the unbundled
modules within noise.

## Reading the numbers

- Both libraries ran the same inputs, with embedded fonts, in the same browser. Output is not byte-compared here; that is what `tools/d2ref` does.
- TALA is the slow engine in both: it tries three seeds and scores them. The port runs seeds one after another; the Go WASM build is
  single-threaded in the browser as well. Native Go runs this in about 5 ms (median over D2's test corpus), which is not what a browser gets.
- One machine, one browser, a loaded-by-nothing VM: treat the ratios as indicative and the absolute values as specific to this CPU.
- Not measured: memory, mobile devices, real network conditions, Firefox and Safari.

## What the benchmark found

The first bundled run showed TALA failing with "placement.prescale is not ported": the TALA stage loader imported its modules by a
computed name, which a bundler cannot follow. `src/tala/stagepkgs.js` now uses static imports.

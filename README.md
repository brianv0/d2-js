# d2-js

[D2](https://d2lang.com) in plain JavaScript. It parses, compiles, lays out and renders D2 diagrams to SVG in the browser or Node, with no
WebAssembly. It is a port of D2 v0.9.0 and is checked against the Go implementation on D2's own test corpus.

Live editor: <https://brianv0.github.io/d2-js/> (the page is `index.html`; enable Pages from branch `main`, root folder).

## Features

- Layout engines: dagre, ELK, TALA.
- SVG output with themes, sketch mode, markdown labels, syntax-highlighted code, LaTeX, and fonts embedded or referenced.
- Plain ES modules. No `eval`, workers or WASM, so it runs under a strict Content-Security-Policy and on any static host.
- Small: about 210 KB gzipped for the default path, against 8.6 MB for D2's WASM build. ELK, TALA, LaTeX, sketch and code
  highlighting are separate files loaded only when a diagram needs them.

Measured in Chromium, the first diagram appears in about 0.2 s from page load (the WASM build: 2.2 s), and warm renders are 1.6 to 2.6 times
faster than the WASM build; see [docs/BENCHMARKS.md](docs/BENCHMARKS.md).

Not ported: animated multi-board SVG, the ASCII renderer, PNG/GIF/PDF export, `d2lsp`, `d2oracle`.

## Use

```js
import markdownit from 'markdown-it';
import { init, compile } from 'd2-js';
import { renderAsync } from 'd2-js/svg';

await init({ markdownit });
const { diagram, err } = await compile('a -> b: hello', { layout: 'dagre' }); // or 'elk', 'tala'
if (err) throw new Error(err.message);
const svg = await renderAsync(diagram, { fonts: 'embed' });
```

`compile(text, compileOpts, renderOpts)` returns `{ diagram, graph, err }`. Options follow D2's Go `d2lib` and `d2svg` names in camelCase
(`layout`, `fs` for imports, `themeID`, `sketch`, `pad`, `elkOpts`, `talaOpts`). Engines, fonts and lexers are fetched relative to the
module files, so serve `src/` as static files.

## How it is checked

`tools/d2ref` is a Go program that runs the real D2 at each pipeline stage. `diff.mjs` runs this port on the same input and reports the
first JSON path that differs.

| Stage | Compared on | Result |
|---|---|---|
| parse, compile, graph | 1,077 snippets from D2's tests, in UTF-8 and UTF-16 positions | identical |
| layout (dagre, ELK, TALA) | the same snippets and D2's recorded layouts (321, 309, 309) | identical |
| SVG, plain and sketch | 886 snippets and 959 recorded boards | identical bytes |

Known differences are in [docs/d2-port.md](docs/d2-port.md). The main ones: LaTeX uses MathJax 3.2.2, which differs from Go's v0.9.0
rewrite on formulas outside D2's tests; Haxe and Raku highlighting; a few markdown edge cases; places where Go's own output varies
between runs.

## Development

```bash
npm install
npm test
```

[docs/MIGRATION.md](docs/MIGRATION.md) describes how the port was done. [docs/d2-tala-port.md](docs/d2-tala-port.md) has the TALA notes.
`.claude/skills/port-d2-incrementally` is a short checklist for porting the next D2 release.

## License

MPL-2.0, the same as D2 (see `LICENSE`). Vendored libraries keep their own licenses, listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

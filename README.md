# d2-js

[D2](https://d2lang.com) (the diagram language) in plain JavaScript: parse, compile, lay out and render to SVG in the browser or
Node. No WebAssembly, no `eval`, no Go toolchain at runtime.

It is a line-for-line port of D2 **v0.9.0**, checked against the real Go implementation on D2's own test corpus.

**Live editor:** <https://brianv0.github.io/d2-js/> (enable Pages: Settings → Pages → Deploy from branch → `main` / root).
The editor is `index.html` + `editor/`, a static page that imports `src/` directly.

## Why use it

- **Small and fast to start.** The default path is about 210 KB gzipped (plus cached fonts) against 8.6 MB for the WebAssembly build,
  and a diagram renders in tens of milliseconds on a cold start instead of waiting for a 40 MB WASM module to compile.
  Heavy features (ELK, TALA, LaTeX, sketch, code highlighting) are separate files fetched only when a diagram uses them.
- **Same output as D2.** Parse, compile, layout and SVG are compared with the real Go D2 on its own test corpus and agree, so diagrams
  look the same as the `d2` CLI draws them, including all three layout engines.
- **Easy to host.** Plain ES modules and static files: no WebAssembly, no `eval`, no workers, no `blob:` URLs, so it runs under a strict
  Content-Security-Policy (`script-src 'self'`) and on any static host such as GitHub Pages.
- **Runs anywhere JavaScript does.** Browser, Node, Deno, a service worker; there is no native binary or Go toolchain to install.
- **Hackable.** The code mirrors D2's Go packages file by file with the same names, and the JSON of every stage matches Go's, so you can
  inspect or reuse the compiled graph and the laid-out diagram (for example to map a clicked shape back to its source line).
- **Verifiable.** The Go reference harness in `tools/d2ref` makes it cheap to prove a change still matches D2, and to port the next D2 release.

## What works

| | |
|---|---|
| Language | everything D2 v0.9.0 compiles: containers, globs, vars, imports, classes, layers/scenarios/steps, sequence diagrams, grids, SQL tables, UML classes, near, icons, links, tooltips |
| Layout engines | **dagre** (default), **ELK**, **TALA** (all three, lazy-loaded) |
| Rendering | SVG with themes, sketch mode, markdown labels (including non-Latin text), syntax-highlighted code in 296 languages, LaTeX, animated connections |
| Fonts | `fonts: 'embed'` (self-contained SVG, identical to Go) or `'external'` (small SVG, `@font-face` pointing at `src/fonts/*.ttf`) |

How "checked" is defined: for each stage, the JS output is compared with the Go output for the same input, as JSON or SVG bytes.

| Stage | Compared on | Result |
|---|---|---|
| parse, compile (IR), graph | 1,077 snippets from D2's tests (UTF-8 and UTF-16 positions) + hand-written + fuzzed | identical |
| layout: dagre, ELK, TALA | the same corpus, plus D2's 321 / 309 / 309 recorded end-to-end layouts | identical |
| SVG render (plain and sketch) | 886 corpus cases + 959 recorded boards | identical bytes |

Not ported: multi-board animated SVG (`animate-interval`), the ASCII renderer, PNG/GIF/PDF/PPTX export, the language server and `d2oracle` (editing API).
Known differences from Go are listed in [`docs/d2-port.md`](docs/d2-port.md) ("Known residue"). The notable ones: LaTeX uses real MathJax
3.2.2 (Go v0.9.0 ships a rewrite that differs on formulas outside D2's tests), Haxe and Raku code highlighting, a few pathological
Markdown inputs where markdown-it and goldmark disagree, and places where Go's own output is nondeterministic.

## Use

```js
import markdownit from 'markdown-it';          // injected: D2 needs a CommonMark parser, you choose how to load it
import { init, compile } from 'd2-js';
import { renderAsync } from 'd2-js/svg';

await init({ markdownit });
const { diagram, err } = await compile('a -> b: hello', { layout: 'dagre' /* 'elk' | 'tala' */ });
if (err) throw new Error(err.message);
const svg = await renderAsync(diagram, { fonts: 'embed' });   // string
```

`compile(text, compileOpts, renderOpts)` returns `{ diagram, graph, err }` like D2's WASM build. Options mirror Go's `d2lib` and
`d2svg.RenderOpts` in camelCase (`layout`, `fs` for imports, `themeID`, `sketch`, `pad`, `elkOpts`, `talaOpts`, ...). Engines, LaTeX, code
lexers and fonts load on first use through dynamic `import()` / `fetch()` relative to the module files, so serve `src/` as static files.

## Size on the wire (gzip, minified and code-split bundle)

| | |
|---|---|
| Default path (parse, compile, dagre, SVG) | 181 KB code + 30 KB text-measuring tables |
| First plain diagram with the three standard fonts (cached files) | about 410 KB |
| TALA / ELK / sketch / LaTeX (lazy) | 108 KB / 436 KB / 17 KB / 581 KB |
| For comparison: `@d2lang/d2` 0.1.34 (WASM, everything inline) | 8.6 MB |

The repository itself has no build step: `src/` is plain ES modules. Bundle with any tool that supports code splitting, for example
`esbuild entry.js --bundle --splitting --minify --format=esm --target=es2022 --outdir=dist`.

## Tests and the Go reference

```bash
npm install && npm test        # unit tests, no Go needed
```

The differential harness lives in [`tools/d2ref`](tools/d2ref): a Go program that runs the real D2 at every pipeline stage plus
`diff.mjs`, which runs this port on the same input and prints the first JSON path that differs. See
[`docs/d2-port.md`](docs/d2-port.md) (how to run it) and [`docs/MIGRATION.md`](docs/MIGRATION.md) (how the port was done, what worked,
what did not). TALA's plan and per-package notes are in [`docs/d2-tala-port.md`](docs/d2-tala-port.md).

## Keeping up with D2

[`.claude/skills/port-d2-incrementally`](.claude/skills/port-d2-incrementally/SKILL.md) is a small skill for porting the next D2
release or a missing feature stage by stage against the Go reference.

## License

Mozilla Public License 2.0, the same as D2 (`LICENSE`). Vendored libraries keep their own licenses: see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

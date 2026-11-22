# Third-party notices

d2-js is a JavaScript port of [D2](https://github.com/d2lang/d2) v0.9.0 (Copyright 2022 Terrastruct Inc., Mozilla Public
License 2.0). Every ported source file keeps an MPL-2.0 header naming the Go package it comes from, and this repository is
MPL-2.0 as a whole (see `LICENSE`). D2's own list of third-party notices (for the Go libraries whose behavior is reproduced
here) is `THIRD_PARTY_NOTICES.txt` in the D2 repository.

Code and data distributed in this repository that is not original to it:

| What | Where | License |
|---|---|---|
| dagre 3.1.1 (`@dagrejs/dagre`) with graphlib, three small compatibility corrections applied | `src/vendor/dagre.js`, `dagre.LICENSE.txt` | MIT |
| ELK.js 0.12.0 (`elkjs`, Eclipse Layout Kernel), three small compatibility patches | `src/vendor/elk.js`, `elk.LICENSE.txt` | EPL-2.0 |
| roughjs 4.6.6 (with hachure-fill, path-data-parser, points-on-curve, points-on-path), unmodified | `src/vendor/rough.js`, `rough.LICENSE.txt` | MIT |
| MathJax 3.2.2 (`mathjax-full`) and mhchemparser 4.1.1, bundled | `src/vendor/mathjax.js`, `mathjax.LICENSE.txt`, `mhchemparser.LICENSE.txt` | Apache-2.0 |
| markdown-it 14 (editor page and tests) | `vendor/markdown-it.min.js`, `vendor/markdown-it.LICENSE.txt` | MIT |
| Source Sans Pro, Source Code Pro, Fuzzy Bubbles fonts (stripped TrueType files) | `src/fonts/*.ttf`, `src/fonts/NOTICE.txt` | SIL Open Font License 1.1 |
| Lexer definitions generated from the chroma syntax highlighter (Alec Thomas) | `src/lexers/*.json` | MIT |
| Ports of parts of the Go standard library and of golang.org/x packages (sorting, strconv, net/url, html entities, sfnt, `math/rand`, compress/flate, trigonometry) | `src/gosort.js`, `strconv.js`, `url.js`, `htmlentity.js`, `gorand.js`, `flate.js`, `gotrig.js`, ... | BSD-3-Clause (The Go Authors) |
| Unicode line-breaking and property tables derived from rivo/uniseg and Go's `unicode` tables | `src/uniseg.js`, `uniprops.js`, `linebreakdata.js` | MIT / BSD-3-Clause |

See `src/vendor/README.txt` for how each vendored build was produced.

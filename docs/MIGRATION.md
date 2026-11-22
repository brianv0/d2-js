# Migrating D2 from Go to JavaScript: what we did and what we would do again

This is a reflection on how d2-js was built, written for whoever ports the next D2 release or the next missing feature.

## What was built

D2 v0.9.0's compile-and-render path (about 100k lines of Go across the front end, three layout engines and the SVG renderer), as plain
JavaScript. The default path (parse, compile, dagre, SVG) is about 210 KB gzipped plus fonts, against 8.6 MB for D2's WebAssembly build.
Every stage matches Go on D2's own tests; the exceptions are in `docs/d2-port.md`.

## The decision that made it work: a differential harness first

Before porting anything we built `tools/d2ref`, a small Go program that runs the real D2 and prints the output of each pipeline stage as JSON
(`parse`, `ir`, `graph`, `layout`, `render`), and `diff.mjs`, which runs the JS port on the same input and reports the first JSON path that
differs. Everything else followed from that:

- **Corpus from D2's own tests.** The Go test files hold about 1,000 D2 snippets (string literals in `*_test.go`, `testdata/*.d2`, import
  fixtures). `go run . corpus` extracts them, so the port is tested against exactly the inputs the D2 authors thought mattered, plus the 300+
  recorded end-to-end layouts for each engine.
- **A stage is done when every corpus case matches, in both position modes (UTF-8 bytes and UTF-16 units).** No "looks right".
- **Porting became a loop an agent could run alone:** port the next file, run the stage, read the first differing JSON path, fix, repeat.
- **Fuzzing found what the corpus missed**, every time. The corpus passed while mutation fuzzers still found three parser bugs, a
  sort-algorithm dependency, number formatting differences and map-ordering assumptions. Write the fuzzer when the corpus first passes, not later.
- **Go's own nondeterminism is real.** Go ranges over maps in random order in a handful of places; on a mismatch the harness reruns Go up to 100
  times and accepts the case if Go ever prints the JS answer. Without that rule, ~1 in 3,000 generated layouts looked like bugs.

## Port line for line, and keep Go's JSON shape

No refactoring while porting. Same function names (camelCase), same control flow, same error messages, and JS objects carry the Go JSON tag
names, so a diff of the JSON is a diff of the behavior and an upstream change can be re-applied by reading the Go diff. The cost is code that looks
like Go; the benefit is that "does this match?" is always answerable mechanically.

## Prefer a JavaScript library over a port, then prove it equal

D2 used to embed JavaScript libraries (dagre, ELK, rough.js, MathJax) in a JS runtime inside the Go binary, then v0.8 replaced them with native
Go reimplementations. We did not port the reimplementations: we vendored the original npm packages and ported only D2's glue code, then compared
the engines head to head on every graph D2 builds:

| Engine | Library used | Needed |
|---|---|---|
| dagre | `@dagrejs/dagre` 3.1.1 | three small corrections that D2's Go port applies |
| ELK | `elkjs` 0.12.0 | three patches (edges between a container and its descendants, several edges through one container, opposing self loops) |
| sketch | `roughjs` 4.6.6 | none; a lenient path parser wrapper |
| LaTeX | `mathjax-full` 3.2.2 | none, but Go's v0.9.0 rewrite differs on input outside D2's tests |

Saved roughly 80k lines of porting. The rule: **take the library, then measure** (an engine-level diff on the real inputs, not the final
output), patch the few differences, and stop and report if they are structural. TALA is the exception: it has no JS original, so it was ported
(about 46k Go lines of the 64k, in 21 internal packages).

## What worked for the big port (TALA)

- **The package boundaries were already there** (Go `internal` packages with one-way dependencies), so a plan table with a dependency order,
  dump format and verification stage per package let several agents work in parallel without colliding.
- **Stage-isolated verification.** The Go harness dumps the whole graph before and after each of the 37 pipeline stages. A JS stage is checked by
  feeding it Go's graph for stage k-1 and comparing with Go's stage k, without running earlier stages in JS. That localizes a bug to one function.
- **But isolated stages lie about hidden state.** Margins, paddings, loop offsets, caches and edge-list order are not in the graph dump. Later
  stages need a "deep state" dump, and some stages (alignment) only match when run in the full pipeline. Check the full pipeline last.
- **Replaying Go's recorded outputs** let the engine and result-patching code be verified before the stages it calls were ported.

## Go semantics that bit, in order of how often

1. **Strings are bytes in Go, UTF-16 in JS.** Positions are counted in UTF-16 units when D2 is used from a browser (`utf16` option), but string lengths
   that reach output (`len(s)` limits) are UTF-8 bytes.
2. **Float formatting and `math`.** Go's `%v`, `'f', -1` and `%g` differ from JS `String(n)` (exponent thresholds, `-0`). V8's `sin/cos/exp/log/pow`
   differ from Go's in the last bit in a minority of cases; a tolerance is acceptable only where an integer rounding follows, and each use is documented.
3. **Integer semantics.** `int(NaN)` is `MinInt64` on amd64; constant folding in Go is exact (`40*14/18.925`); integer division truncates.
4. **Map iteration order** (random in Go): where the result depends on it, Go itself is nondeterministic. Where it does not, insertion order is fine.
5. **Slices.** Spare capacity, `append` aliasing and ranging over a slice header fixed at loop start all change behavior; Go's sorts are specific
   algorithms and a comparator that is not a strict weak order gives results that depend on the algorithm (`goslices.js` ports them).
6. **Goroutines.** Parallel workers with results re-sorted into a declared order become a sequential loop in that order.
7. **nil vs empty.** A Go nil slice marshals to `null`, an empty one to `[]`: the JSON diff catches it, so keep the distinction.

## What went wrong

- **We started on the wrong version.** The Go module proxy told us the latest release was v0.7.2, because the project had moved to a new module
  path (`github.com/d2lang/d2`) and the old path froze. Weeks of work were verified against v0.7.2 before we noticed v0.9.0 existed. The harness made
  the upgrade cheap (point the reference at the new version, rerun every stage: 25 and 17 mismatches in the compiler, the layout engines moved most),
  but the lesson is real: **check the project's actual latest release from its repository and changelog, not from a package proxy.**
- **A harness stage that did not cover what we thought.** The `svgfull` stage fed Go's `svgfromdiagram` mode, which had no TALA handling and
  silently used dagre, so a TALA comparison there looked like a bug. Every mode of the reference runner should fail loudly on an option it
  ignores.
- **Shared mutable harness state.** Agents sharing one Go module copy overwrote each other's debug programs; each now uses its own `TALA_REF`.
- **Rate limits and merges.** Running many agents in parallel hit usage limits mid-work three times; because every unit of work was committed in a
  worktree, each resumed cleanly. Shared files (the diff driver, docs) caused merge conflicts every time; keep per-package files and make shared
  files additive.
- **Claims need verification by someone who did not write them.** Agent reports were mostly right and a few were optimistic (a check that did not
  run, a stale file). Re-running a stage on a fresh fuzz seed after every merge was cheap and caught real regressions (a missing method after
  replacing stand-ins with real modules, a flaky test under load).
- **A Write/Edit tool turned ` ` escapes into literal characters** that broke a regex. Check for literal U+2028/2029 after editing.

## What is left

- `d2animate` (animated multi-board SVG), the ASCII renderer and raster/PDF exporters, `d2lsp`, `d2oracle`.
- Haxe and Raku highlighting; markdown-it vs goldmark on pathological Markdown; LaTeX parity with Go's rewrite (see `docs/d2-port.md`).
- Speed: TALA in JS averages ~0.2 s per layout on the corpus against Go's 5 ms median; nobody has profiled it yet.
- A minified, split distribution build (the repository ships plain ES modules).

## Upgrading to the next D2 release

1. Point `tools/d2ref/go.mod` at the new version and run `go run . corpus <source>`; regenerate the leaf inputs and e2e inputs.
2. Run the stages in pipeline order (`parse`, `ir`, `graph`, `measure`, `layout` per engine, `svg`) and fix the first failing stage; read the upstream
   changelog for what moved. Expect layout engines to move most (new engine versions change coordinates on purpose).
3. Re-check each vendored engine against the new Go engine with the engine-level diffs (`dagrocmp.mjs`, `elkcmp.mjs`, `roughcmp.mjs`, `latexcheck.mjs`).
4. Update the pinned numbers in `README.md` only after the corpus passes in both position modes and a fresh fuzz seed.

The skill in `.claude/skills/port-d2-incrementally` is this list in a form an agent can follow.

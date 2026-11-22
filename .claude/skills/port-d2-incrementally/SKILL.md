---
name: port-d2-incrementally
description: Port the next D2 release or a missing D2 feature to d2-js stage by stage, checking every step against the real Go implementation. Use when asked to upgrade d2-js to a new D2 version, port a missing package (d2animate, ASCII renderer, ...) or fix a mismatch with Go.
---

# Port D2 to d2-js incrementally (naive version)

Rule zero: **the Go implementation is the specification; a stage is done only when the JS output equals Go's on every case.**
Read `docs/MIGRATION.md` once (what worked, what bit us) and `docs/d2-port.md` (how to run the harness).

## 0. Set up the reference

1. Find the real latest D2 release from the repository's changelog (`ci/release/changelogs/`), not from a package proxy.
   Module path is `github.com/d2lang/d2`; download `proxy.golang.org/github.com/d2lang/d2/@v/<version>.zip`, unzip.
2. Point `tools/d2ref/go.mod` at it (Go version per its `go.mod`; `GOTOOLCHAIN=auto` downloads it).
3. `cd tools/d2ref && go run . corpus <unzipped source> > corpus.jsonl` (generated files are git-ignored).

## 1. Find what moved

Run the stages in pipeline order and stop at the first that fails; fix it before moving on (later stages fail because of earlier ones):

```
node diff.mjs parse corpus.jsonl            # also --utf16
node diff.mjs ir corpus.jsonl               # then graph
node diff.mjs measure ...                   # text sizes (see the generators named in the script headers)
node diff.mjs layout corpus.jsonl [--layout elk|tala]
node diff.mjs svg corpus.jsonl [--sketch]
```

`--show N` prints the first N mismatches with the JSON path of the first difference; `--only N` runs one case. Read the upstream
changelog for the version range to predict where it will fail.

## 2. Port one package or file at a time

- Read the Go file, then port it **line for line**: same names in camelCase, same control flow, same error text, Go's JSON tag names as
  object properties. No refactoring, no cleanups. Add the MPL-2.0 header naming the Go package.
- Prefer a maintained JS library over a port if one is the original of the Go code (dagre, elkjs, roughjs, mathjax-full did that). Then compare engine
  vs engine on the real inputs, patch what differs, and stop and report if the differences are structural.
- Add a diff stage for what you ported (a Go mode in `tools/d2ref/main.go` or a new `*_xdump.go`, a JS twin, a line in `STAGES` in `diff.mjs`).
- Run it on the corpus **in both position modes**, then on fuzzed input (`fuzz.mjs`, `fuzzlayout.mjs`, ...) with several seeds. A passing corpus is not enough.

## 3. Go semantics to check when a mismatch is odd

Strings are bytes in Go (UTF-16 units in JS); float formatting and `math.*` last bits; `int(NaN)`; map iteration order (Go is random: rerun Go
before blaming JS); slice spare capacity and aliasing; Go's sort algorithms (`goslices.js`); nil vs empty slices (`null` vs `[]` in JSON);
goroutines (port as a sequential loop in the declared result order). Never loosen the comparison globally; document a residue with its cause.

## 4. Finish

- Every earlier stage still matches (`node --test test/*.test.js` and the corpus diffs), and a fresh fuzz seed passes.
- Update the status table and "Known residue" in `docs/d2-port.md`, and the numbers in `README.md` only from runs you did.
- Commit per package with the Go package named in the message. Do not hand-edit generated vendor files; rebuild them with the recipe in `src/vendor/README.txt`.
- Re-run on a clean checkout before claiming done; do not trust a report (yours included) over a run.

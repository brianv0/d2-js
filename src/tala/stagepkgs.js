// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Not a port of a Go file: the name-based resolution of the stage functions of the TALA pipeline (D2 v0.9.0,
// d2layouts/d2talalayout/internal/engine/pipeline.go calls placement.*, routing.* ... directly).
//
// engine.js asks `stageFn(pkg, name)` for the function of a Go package by its camelCase Go name (`placement.Prescale` is
// `stageFn('placement', 'prescale')`). The packages that are ported before the engine (grouping, proximity, trees, hierarchy, packing,
// labeling, quality) are registered by engine.js itself; `placement` and `routing` are looked up here in the modules below the first time the
// engine is imported (static imports; a module that does not exist yet used to be skipped, anything else that goes wrong in a module that exists
// is an error). A function that no module defines is a NotPorted error that names the package, the function and (once the pipeline driver
// knows it) the stage, so the full pipeline lights up by itself when the modules land.
//
// To plug a module in by hand (tests, tools): registerPackage('placement', namespaceObject). The newest registration wins.

/** The error of a stage function that is not ported (yet). Not a GoError: it is never a Go `error` value, it must reach the caller. */
export class NotPorted extends Error {
  constructor(pkg, fn, stage = null) {
    super(NotPorted.text(pkg, fn, stage));
    this.name = 'NotPorted';
    this.pkg = pkg;
    this.fn = fn;
    this.stage = stage; // {index, name} of the pipeline stage that needed it, once known
  }

  static text(pkg, fn, stage) {
    return `TALA ${pkg}.${fn} is not ported${stage ? ` (pipeline stage ${stage.index} ${stage.name})` : ''}`;
  }

  /** the driver names the stage that hit the error (once) */
  atStage(index, name) {
    if (this.stage === null) {
      this.stage = { index, name };
      this.message = NotPorted.text(this.pkg, this.fn, this.stage);
    }
    return this;
  }
}

const packages = new Map(); // package name -> [namespace objects], newest first

/** Registers a module namespace (or any object with the functions) for a package; returns the function that removes this registration. */
export function registerPackage(pkg, namespace) {
  if (!packages.has(pkg)) packages.set(pkg, []);
  packages.get(pkg).unshift(namespace);
  return () => {
    const list = packages.get(pkg) ?? [];
    const i = list.indexOf(namespace);
    if (i >= 0) list.splice(i, 1);
  };
}

/** Forget a package's registrations (tests). */
export function unregisterPackage(pkg) {
  packages.delete(pkg);
}

/** stageFn returns the exported function `name` of Go package `pkg`, or throws NotPorted. */
export function stageFn(pkg, name) {
  for (const ns of packages.get(pkg) ?? []) {
    if (typeof ns[name] === 'function') return ns[name];
  }
  throw new NotPorted(pkg, name);
}

/** hasStageFn: whether stageFn(pkg, name) would resolve. */
export function hasStageFn(pkg, name) {
  return (packages.get(pkg) ?? []).some((ns) => typeof ns[name] === 'function');
}

// `placement` and `routing` are plain static imports: bundlers can follow them (a computed `import(name)` cannot be bundled, which left
// TALA without its stages in a minified build). Registered here, once, when the engine first imports this module.
import * as placement from './placement/index.js';
import * as routing from './routing/index.js';

export const STAGE_MODULES = { placement: ['./placement/index.js'], routing: ['./routing/index.js'] };
registerPackage('placement', placement);
registerPackage('routing', routing);

/** the modules registered for each package (diagnostics) */
export const loadedModules = { placement: ['./placement/index.js'], routing: ['./routing/index.js'] };

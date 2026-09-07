// Type-only module: shapes shared across the runtime layer. Never imported
// at runtime - referenced from JSDoc elsewhere via
// `@typedef {import("./types.js").CompiledModule} CompiledModule`.

/**
 * Parsed+transpiled output for one URL, before it has run.
 * @typedef {{code: string, imports: string[]}} CompiledModule
 */

/**
 * A module that has run (or attempted to). `error` is only ever set, never read - it exists so a failed module's state is inspectable from a debugger.
 * @typedef {{exports: Object, error?: Error}} ModuleRecord
 */

/**
 * @typedef {{concurrency: number, cache: boolean, debug: boolean}} LoaderConfig
 */

export {};

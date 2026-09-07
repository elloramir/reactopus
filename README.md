## What is Reactopus?

Designed for small web applications, Reactopus is the fastest way to build React applications with JSX syntax at runtime. On top of Preact, Reactopus parses JSX, transpiles it to JavaScript, and executes it in the browser with a custom module loader.

```html
<script src="reactopus.min.js"></script>
<script type="text/jsx" src="my-react-app.jsx"></script>
```

The project includes:
- A JSX parser (`scripts/parser/`) that converts JSX syntax into an abstract syntax tree (AST)
- A transpiler (`scripts/transpiler/`) that converts AST nodes into Preact-compatible JavaScript
- A module loader (`scripts/runtime/`) that handles imports, requires, caching, and lazy execution

## How It Works

1. **Discovery**: The bootloader scans the HTML for `<script type="text/jsx">` tags.
2. **Parsing**: JSX is parsed into an AST using the custom parser.
3. **Dependency Resolution**: The loader recursively fetches and caches all imported modules, using a fixed-size worker pool to fetch several files concurrently.
4. **Transpilation**: AST nodes are converted to JavaScript that calls Preact functions.
5. **Execution**: Transpiled code runs with a custom CommonJS environment that maps `require()` calls to bundled modules (Preact, Preact Hooks, local files).

Parsing and transpilation are pure functions of the source text, so step 2-4's result is cached persistently, keyed by a hash of the file's content (see `scripts/runtime/compile-cache.js`). A repeat page load with unchanged source skips parsing and transpiling entirely for that file. The cache is stored in IndexedDB when it's available, falling back to `localStorage` otherwise (private browsing, storage disabled by policy, or a browser that never responds to `indexedDB.open()` at all - see `scripts/runtime/storage.js`).

## Startup configuration

Set `data-*` attributes on the `<script src="reactopus.js">` tag itself:

```html
<script src="reactopus.js" data-cache="false" data-concurrency="8" data-debug="true"></script>
```

- `data-cache` (default `true`) - disable the persistent compile cache for the whole page. Useful while actively editing a file, since otherwise a stale compiled version could be served until the content changes again.
- `data-concurrency` (default `4`) - how many `.jsx` files the loader fetches in parallel.
- `data-debug` (default `false`) - logs cache hits/misses to the console.

A single `<script type="text/jsx">` entry can also override just its own caching:

```html
<script type="text/jsx" src="./work-in-progress.jsx" data-cache="false"></script>
```

This only affects that entry file, not the files it imports.

## Testing

`npm test` runs the automated suite under Node's built-in test runner against a virtualized DOM (`jsdom`) - no browser, no fixture files on disk. It's split in two:
- `test/pipeline.test.mjs` - pure parser+transpiler unit tests (no DOM at all): every import/export form, JSX attribute/whitespace/comment/regex edge case, and the parser's error paths, asserting directly on the generated code or the evaluated module's exports.
- `test/runtime.test.mjs` - component/DOM/event/bootloader tests. Each defines its own JSX source as a string, parses and transpiles it with the real parser/transpiler, executes it through the real sandbox, and asserts on the resulting DOM (clicks, typing, list reordering, an error boundary). One test wires up a two-file dependency graph and a stubbed `fetch` (`installVirtualFetch` in `test/dom-env.mjs`) to exercise the real loader/cache/sandbox pipeline end-to-end.

`npm run typecheck` runs TypeScript (pinned to the 6.x line - see below) in `--checkJs` mode over `scripts/` using the JSDoc type annotations in the code, with no build step and no `.ts` files. `npm run build` runs both the test suite and the typecheck automatically first (`prebuild`) and refuses to produce `reactopus.min.js` if either fails.

`npm start` still runs `webpack-dev-server`, but there's no bundled demo page to serve anymore - it's only useful if you drop your own `.html` + `.jsx` next to it while iterating manually. `npm test`/`npm run typecheck` are what verify correctness.

### Why TypeScript is pinned to 6.x

The parser (`scripts/parser/index.js`) and the task queue (`scripts/runtime/task-queue.js`) use the constructor-function-plus-`.prototype` style deliberately, not `class`. TypeScript's newer compiler (7.x, the Go-based rewrite) stops recognizing a construct signature written that way - `new Parser(x)` silently becomes `any`, masking real type errors instead of catching them. TypeScript 6.x handles this pattern correctly. If a future TypeScript major reintroduces support for it, this pin can be revisited.

## Important Notes

- The bundled Preact library is ~15KB (minified).
- JSX parsing and transpilation happen at runtime (unless served from the compile cache), so there is a small startup cost on first load.
- For production, consider pre-transpiling your JSX files.
- It mimics the React API but uses Preact under the hood, so some API features may not be available - notably, `onChange` on an `<input>` fires on the native `change` event (on blur/commit), not on every keystroke like React's does. Use `onInput` for that.
- `import`/`export` statements must appear at the top level of a file (not inside a function or block) - same as real ES modules.


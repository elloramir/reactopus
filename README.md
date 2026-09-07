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

Parsing and transpilation are pure functions of the source text, so step 2-4's result is cached in `localStorage`, keyed by a hash of the file's content (see `scripts/runtime/compile-cache.js`). A repeat page load with unchanged source skips parsing and transpiling entirely for that file.

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

`npm test` runs the automated suite (`test/runtime.test.mjs`) under Node's built-in test runner against a virtualized DOM (`jsdom`) - no browser, no fixture files on disk. Each test defines its own JSX source as a string, parses and transpiles it with the real parser/transpiler, executes it through the real sandbox, and asserts on the resulting DOM (including simulated clicks/typing). One test wires up a two-file dependency graph and a stubbed `fetch` (`installVirtualFetch` in `test/dom-env.mjs`) to exercise the real loader/cache/sandbox pipeline end-to-end. `npm run build` runs the suite automatically first (`prebuild`) and refuses to produce `reactopus.min.js` if anything fails.

`npm start` still runs `webpack-dev-server`, but there's no bundled demo page to serve anymore - it's only useful if you drop your own `.html` + `.jsx` next to it while iterating manually. `npm test` is the thing that verifies correctness.

## Important Notes

- The bundled Preact library is ~15KB (minified).
- JSX parsing and transpilation happen at runtime (unless served from the compile cache), so there is a small startup cost on first load.
- For production, consider pre-transpiling your JSX files.
- It mimics the React API but uses Preact under the hood, so some API features may not be available - notably, `onChange` on an `<input>` fires on the native `change` event (on blur/commit), not on every keystroke like React's does. Use `onInput` for that.
- `import`/`export` statements must appear at the top level of a file (not inside a function or block) - same as real ES modules.


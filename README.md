## What is Reactopus?

Designed for small web applications, Reactopus is the fastest way to build React applications with JSX syntax at runtime. On top of Preact, Reactopus parses JSX, transpiles it to JavaScript, and executes it in the browser with a custom module loader.

```html
<script src="reactopus.min.js"></script>
<script type="text/jsx" src="my-react-app.jsx"></script>
```

The project includes:
- A JSX parser that converts JSX syntax into an abstract syntax tree (AST)
- A transpiler that converts AST nodes into Preact-compatible JavaScript
- A module loader that handles imports, requires, and lazy execution
- A dev server with hot reload for fast development


## How It Works

1. **Discovery**: The bootloader scans the HTML for `<script type="text/jsx">` tags.
2. **Parsing**: JSX is parsed into an AST using the custom parser.
3. **Dependency Resolution**: The loader recursively fetches and caches all imported modules.
4. **Transpilation**: AST nodes are converted to JavaScript that calls Preact functions.
5. **Execution**: Transpiled code runs with a custom CommonJS environment that maps `require()` calls to bundled modules (Preact, Preact Hooks, local files).

## Important Notes

- The bundled Preact library is ~24KB (minified).
- JSX parsing and transpilation happen at runtime, so there is a small startup cost.
- For production, consider pre-transpiling your JSX files.
- It mimics the React API but uses Preact under the hood, so some API features may not be available.


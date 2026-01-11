import Parser from "./parser.js";
import transpile from "./transpiler.js";
import * as Preact from "preact";
import * as Hooks from "preact/hooks";

const React = { ...Preact, ...Hooks };
const ReactDOM = { render: Preact.render };

// Global State
const modules = {
     "react": { exports: React },
     "preact": { exports: Preact },
     "preact/hooks": { exports: Hooks },
     "react-dom": { exports: ReactDOM }
};

const fileCache = {};
const queue = [];
const visited = new Set();
const CONCURRENCY_LIMIT = 4;

document.addEventListener("DOMContentLoaded", bootloader);

/**
 * 1. Bootloader
 * Scans document for <script type="text/jsx"> and starts the build process.
 */
async function bootloader() {
    const codeBlocks = document.querySelectorAll("script[type='text/jsx']");
    const entryPoints = [];

    // Phase 1: Discovery
    for (const block of codeBlocks) {
        if (block.src) {
             const fullUrl = new URL(block.src, window.location.href).href;
             if (!visited.has(fullUrl)) {
                 visited.add(fullUrl);
                 queue.push(fullUrl);
                 entryPoints.push({ type: 'url', url: fullUrl });
             }
        } else {
             // Handle Inline Scripts
             const source = block.textContent;
             const ast = new Parser(source).parse();
             scanImports(ast, window.location.href);
             entryPoints.push({ type: 'inline', ast }); // Defer execution
        }
    }

    // Phase 2: Dependency Resolution (Parallel Fetching)
    await processQueue();

    // Phase 3: Execution
    for (const entry of entryPoints) {
        if (entry.type === 'url') {
            executeModule(entry.url);
        } else {
             executeAST(entry.ast, window.location.href);
        }
    }
}

/**
 * 2. Module Loader
 * Processes the fetch queue using batches to control concurrency.
 */
async function processQueue() {
    while (queue.length > 0) {
        // Simple batch processing
        const batch = queue.splice(0, CONCURRENCY_LIMIT); 
        await Promise.all(batch.map(fetchAndParse));
    }
}

async function fetchAndParse(url) {
    try {
        if (modules[url]) return; // Built-ins or pre-loaded

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        
        const source = await res.text();
        const ast = new Parser(source).parse();
        
        fileCache[url] = { source, ast };
        
        // Recursively find new dependencies
        scanImports(ast, url);

    } catch (e) {
        console.error(`[Loader] Failed to load ${url}:`, e);
    }
}

/**
 * 3. Static Analysis
 * Scans AST for import statements to populate the queue.
 */
function scanImports(ast, baseUrl) {
    for (const node of ast) {
        if (node.type === "import" && node.source.startsWith(".")) {
             const depUrl = new URL(node.source, baseUrl).href;
             
             if (!modules[depUrl] && !visited.has(depUrl)) {
                 visited.add(depUrl);
                 queue.push(depUrl);
             }
        }
    }
}

/**
 * 4. Runtime / Execution
 * Compiles AST to JS and runs it with a shimmed CommonJS env.
 */
function executeModule(url) {
    if (modules[url]) return modules[url].exports;
    
    if (!fileCache[url]) {
        throw new Error(`[Runtime] Source not found in cache: ${url}`);
    }

    const { ast } = fileCache[url];
    // Memoize module by executing it
    const exports = executeAST(ast, url);
    return exports;
}

function executeAST(ast, fullUrl) {
    const code = transpile(ast);
    
    // Custom 'require' implementation for the sandboxed module
    const customRequire = (path) => {
        // Built-ins (mapped to Preact in index.html)
        if (path === "react") return modules["react"].exports;
        if (path === "react-dom") return modules["react-dom"].exports;
        
        // Relative imports
        let targetUrl = path;
        if (path.startsWith(".")) {
             targetUrl = new URL(path, fullUrl).href;
        }

        // Return if already executed
        if (modules[targetUrl]) {
             return modules[targetUrl].exports;
        }
        
        // Lazy execution if loaded but not run
        if (fileCache[targetUrl]) {
            return executeModule(targetUrl);
        }

        throw new Error(`[Runtime] Module not loaded: ${path}`);
    };

    const module = { exports: {} };
    
    try {
        // Create isolated scope
        const factory = new Function("require", "module", "exports", code);
        factory(customRequire, module, module.exports);
    } catch (e) {
        console.error(`[Runtime] Execution Error in ${fullUrl}:`, e);
        console.debug("Transpiled Code:", code); // Debug only on error
    }

    // Cache the result
    if (fullUrl !== window.location.href) {
        modules[fullUrl] = module;
    }
    
    return module.exports;
}

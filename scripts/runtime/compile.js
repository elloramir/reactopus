import Parser from "../parser/index.js";
import transpile from "../transpiler/index.js";
import { readCompiled, writeCompiled } from "./compile-cache.js";

// Parsing+transpiling a URL's source, with the per-URL data-cache="false"
// override and the persistent content-hash cache (compile-cache.js) that
// skips both steps entirely on a hit.
const cacheOverrides = new Map();

let useCache = true;
let debug = false;

export function configureCompiler(config) {
    useCache = config.useCache;
    debug = config.debug;
}

export function setCacheOverride(url, value) {
    if (value !== undefined) cacheOverrides.set(url, value);
}

// Only meant for reset between page boots/test runs (see bootloader.js's
// resetRuntimeState) - a per-URL override made for one boot must not leak
// into the next boot's config for the same URL.
export function resetCompilerOverrides() {
    cacheOverrides.clear();
}

function resolveUseCache(url) {
    const override = cacheOverrides.get(url);
    return override === undefined ? useCache : override;
}

export function compileSource(source, url, options) {
    const shouldUseCache = options && options.useCache !== undefined ? options.useCache : resolveUseCache(url);

    if (shouldUseCache) {
        const cached = readCompiled(source);
        if (cached) {
            if (debug) console.debug(`[Reactopus] cache hit: ${url}`);
            return cached;
        }
    }

    const ast = new Parser(source).parse();
    const code = transpile(ast);
    const imports = ast.filter((node) => node.type === "import").map((node) => node.source);
    const compiled = { code, imports };

    if (shouldUseCache) writeCompiled(source, compiled);
    return compiled;
}

import Parser from "../parser/index.js";
import transpile from "../transpiler/index.js";
import { extractImportSources } from "../transpiler/imports.js";
import { readCompiled, writeCompiled } from "./compile-cache.js";

// Parsing+transpiling a URL's source, with the per-URL data-cache="false"
// override and the persistent content-hash cache (compile-cache.js) that
// skips both steps entirely on a hit.
/** @type {Map<string, boolean>} */
const cacheOverrides = new Map();

let useCache = true;
let debug = false;

/** @param {{useCache: boolean, debug: boolean}} config */
export function configureCompiler(config) {
    useCache = config.useCache;
    debug = config.debug;
}

/**
 * @param {string} url
 * @param {boolean|undefined} value
 */
export function setCacheOverride(url, value) {
    if (value !== undefined) cacheOverrides.set(url, value);
}

// Only meant for reset between page boots/test runs (see bootloader.js's
// resetRuntimeState) - a per-URL override made for one boot must not leak
// into the next boot's config for the same URL.
export function resetCompilerOverrides() {
    cacheOverrides.clear();
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function resolveUseCache(url) {
    const override = cacheOverrides.get(url);
    return override === undefined ? useCache : override;
}

/**
 * @param {string} source
 * @param {string} url
 * @param {{useCache?: boolean}} [options]
 * @returns {import("./types.js").CompiledModule}
 */
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
    const compiled = { code, imports: extractImportSources(ast) };

    if (shouldUseCache) writeCompiled(source, compiled);
    return compiled;
}

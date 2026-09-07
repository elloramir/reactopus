import {
    getBuiltin,
    isRegistered,
    getRegisteredExports,
    registerModule,
    hasCompiledFile,
    getCompiledFile,
} from "./module-registry.js";

/** @type {string|null} */
let ownDocumentUrl = null;

/** @param {{ownDocumentUrl: string}} config */
export function configureSandbox(config) {
    ownDocumentUrl = config.ownDocumentUrl;
}

/**
 * @param {string} path
 * @param {string} baseUrl
 * @returns {Object}
 */
function customRequire(path, baseUrl) {
    const builtin = getBuiltin(path);
    if (builtin !== undefined) return builtin;

    let targetUrl = path;
    if (path.startsWith(".")) targetUrl = new URL(path, baseUrl).href;

    if (isRegistered(targetUrl)) return getRegisteredExports(targetUrl);
    if (hasCompiledFile(targetUrl)) return executeModule(targetUrl);

    throw new Error(`[Reactopus] Module not loaded: ${path}`);
}

/**
 * @param {import("./types.js").CompiledModule} compiled
 * @param {string} url
 * @returns {Object}
 */
export function executeCompiled(compiled, url) {
    /** @type {import("./types.js").ModuleRecord} */
    const module = { exports: {} };

    // Register before running the factory: a circular require() then sees
    // this module's (still filling-in) exports object instead of re-entering
    // executeCompiled for the same URL and recursing forever. Standard
    // CommonJS circular-import semantics apply from here on: a value used
    // lazily (inside a function called after the whole graph finished
    // loading) sees the real export; a value used eagerly at module top
    // level, before the cycle finishes, sees whatever was exported so far
    // (often undefined) - this doesn't give ES modules' live-binding
    // behavior, it just stops the stack overflow.
    if (url !== ownDocumentUrl) registerModule(url, module);

    try {
        const factory = new Function("require", "module", "exports", compiled.code);
        factory((path) => customRequire(path, url), module, module.exports);
    } catch (e) {
        module.error = /** @type {Error} */ (e);
        console.error(`[Reactopus] Execution error in ${url}:`, e);
        console.debug("[Reactopus] Transpiled code:", compiled.code);
    }

    return module.exports;
}

/**
 * @param {string} url
 * @returns {Object}
 */
export function executeModule(url) {
    if (isRegistered(url)) return getRegisteredExports(url);

    const compiled = getCompiledFile(url);
    if (!compiled) throw new Error(`[Reactopus] Source not found in cache: ${url}`);

    return executeCompiled(compiled, url);
}

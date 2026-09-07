import { getBuiltin, isRegistered, getRegisteredExports, registerModule } from "./module-registry.js";
import { hasCompiledFile, getCompiledFile } from "./loader.js";

let ownDocumentUrl = null;

export function configureSandbox(config) {
    ownDocumentUrl = config.ownDocumentUrl;
}

function customRequire(path, fromUrl) {
    const builtin = getBuiltin(path);
    if (builtin !== undefined) return builtin;

    let targetUrl = path;
    if (path.startsWith(".")) targetUrl = new URL(path, fromUrl).href;

    if (isRegistered(targetUrl)) return getRegisteredExports(targetUrl);
    if (hasCompiledFile(targetUrl)) return executeModule(targetUrl);

    throw new Error(`[Runtime] Module not loaded: ${path}`);
}

export function executeCompiled(compiled, fullUrl) {
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
    if (fullUrl !== ownDocumentUrl) registerModule(fullUrl, module);

    try {
        const factory = new Function("require", "module", "exports", compiled.code);
        factory((path) => customRequire(path, fullUrl), module, module.exports);
    } catch (e) {
        module.error = e;
        console.error(`[Runtime] Execution error in ${fullUrl}:`, e);
        console.debug("Transpiled code:", compiled.code);
    }

    return module.exports;
}

export function executeModule(url) {
    if (isRegistered(url)) return getRegisteredExports(url);

    const compiled = getCompiledFile(url);
    if (!compiled) throw new Error(`[Runtime] Source not found in cache: ${url}`);

    return executeCompiled(compiled, url);
}

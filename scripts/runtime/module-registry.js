import * as Preact from "preact";
import * as Hooks from "preact/hooks";

const React = { ...Preact, ...Hooks };
const ReactDOM = { render: Preact.render, hydrate: Preact.hydrate };

const BUILTIN_MODULES = {
    react: { exports: React },
    preact: { exports: Preact },
    "preact/hooks": { exports: Hooks },
    "react-dom": { exports: ReactDOM },
};

// What's known about a URL as it moves through its lifecycle: compiled (has
// {code, imports}, hasn't run yet) -> registered (has run, has .exports).
// Builtins start pre-registered. Both maps live here, not split across
// loader.js/sandbox.js, so there's one place that answers "what do we know
// about this URL" instead of three call sites re-deriving it from two maps.
/** @type {Object<string, import("./types.js").ModuleRecord>} */
let modules = { ...BUILTIN_MODULES };
/** @type {Map<string, import("./types.js").CompiledModule>} */
const compiledFiles = new Map();

// Only meant for reset between page boots/test runs (see bootloader.js's
// resetRuntimeState) - in normal operation these only ever grow, since a
// real page only boots once.
export function resetModuleRegistry() {
    modules = { ...BUILTIN_MODULES };
    compiledFiles.clear();
}

/**
 * @param {string} path
 * @returns {Object|undefined}
 */
export function getBuiltin(path) {
    return modules[path] ? modules[path].exports : undefined;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isRegistered(url) {
    return Boolean(modules[url]);
}

/**
 * @param {string} url
 * @returns {Object|undefined}
 */
export function getRegisteredExports(url) {
    return modules[url] ? modules[url].exports : undefined;
}

/**
 * @param {string} url
 * @param {import("./types.js").ModuleRecord} module
 */
export function registerModule(url, module) {
    modules[url] = module;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function hasCompiledFile(url) {
    return compiledFiles.has(url);
}

/**
 * @param {string} url
 * @returns {import("./types.js").CompiledModule|undefined}
 */
export function getCompiledFile(url) {
    return compiledFiles.get(url);
}

/**
 * @param {string} url
 * @param {import("./types.js").CompiledModule} compiled
 */
export function registerCompiledFile(url, compiled) {
    compiledFiles.set(url, compiled);
}

import TaskQueue from "./task-queue.js";
import { configureCompiler, setCacheOverride, compileSource, resetCompilerOverrides } from "./compile.js";
import { isRegistered, hasCompiledFile, registerCompiledFile } from "./module-registry.js";

// One page load = one boot = one dependency graph, so this is plain module
// state (like module-registry.js) rather than an instantiable loader object.
/** @type {Set<string>} */
const visited = new Set();
const queue = new TaskQueue(4);

/** @param {import("./types.js").LoaderConfig} config */
export function configureLoader(config) {
    queue.setConcurrency(config.concurrency);
    configureCompiler({ useCache: config.cache, debug: config.debug });
}

// Only meant for reset between page boots/test runs (see bootloader.js's
// resetRuntimeState) - visited/queue never shrink on their own, since a real
// page only calls boot() once.
export function resetLoader() {
    visited.clear();
    queue.clear();
    resetCompilerOverrides();
}

/** @param {string[]} imports @param {string} baseUrl */
export function scanImportSources(imports, baseUrl) {
    for (const source of imports) {
        if (!source.startsWith(".")) continue;
        const depUrl = new URL(source, baseUrl).href;
        if (!isRegistered(depUrl) && !visited.has(depUrl) && !hasCompiledFile(depUrl)) {
            visited.add(depUrl);
            queue.push(depUrl);
        }
    }
}

/** @param {string} url @param {{useCache?: boolean}} [options] */
export function enqueue(url, options) {
    if (options && options.useCache !== undefined) setCacheOverride(url, options.useCache);
    if (!visited.has(url) && !hasCompiledFile(url) && !isRegistered(url)) {
        visited.add(url);
        queue.push(url);
    }
}

/** @param {string} url */
async function fetchAndParse(url) {
    try {
        if (isRegistered(url) || hasCompiledFile(url)) return;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

        const source = await res.text();
        const compiled = compileSource(source, url);

        registerCompiledFile(url, compiled);
        scanImportSources(compiled.imports, url);
    } catch (e) {
        console.error(`[Reactopus] Failed to load ${url}:`, e);
    }
}

// Fixed-size worker pool: each worker pulls the next queued URL as soon as
// it's free, instead of waiting for a whole batch to settle before starting
// newly-discovered dependencies.
/** @returns {Promise<void>} */
export function drainQueue() {
    return queue.drain(fetchAndParse);
}

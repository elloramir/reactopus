import TaskQueue from "./task-queue.js";
import { configureCompiler, setCacheOverride, compileSource, resetCompilerOverrides } from "./compile.js";
import { isRegistered } from "./module-registry.js";

// One page load = one boot = one dependency graph, so this is plain module
// state (like module-registry.js) rather than an instantiable loader object.
// fileCache itself stays private - callers go through the accessors below,
// same encapsulation module-registry.js uses for its own `modules` map.
const fileCache = new Map(); // url -> { code, imports }
const visited = new Set();
const queue = new TaskQueue(4);

export function hasCompiledFile(url) {
    return fileCache.has(url);
}

export function getCompiledFile(url) {
    return fileCache.get(url);
}

export function configureLoader(config) {
    queue.setConcurrency(config.concurrency);
    configureCompiler({ useCache: config.cache, debug: config.debug });
}

// Only meant for reset between page boots/test runs (see bootloader.js's
// resetRuntimeState) - fileCache/visited/queue never shrink on their own,
// since a real page only calls boot() once.
export function resetLoader() {
    fileCache.clear();
    visited.clear();
    queue.clear();
    resetCompilerOverrides();
}

export function scanImportSources(imports, baseUrl) {
    for (const source of imports) {
        if (!source.startsWith(".")) continue;
        const depUrl = new URL(source, baseUrl).href;
        if (!isRegistered(depUrl) && !visited.has(depUrl) && !fileCache.has(depUrl)) {
            visited.add(depUrl);
            queue.push(depUrl);
        }
    }
}

export function compile(source, url, options) {
    return compileSource(source, url, options);
}

export function enqueue(url, options) {
    if (options && options.useCache !== undefined) setCacheOverride(url, options.useCache);
    if (!visited.has(url) && !fileCache.has(url) && !isRegistered(url)) {
        visited.add(url);
        queue.push(url);
    }
}

async function fetchAndParse(url) {
    try {
        if (isRegistered(url) || fileCache.has(url)) return;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

        const source = await res.text();
        const compiled = compileSource(source, url);

        fileCache.set(url, compiled);
        scanImportSources(compiled.imports, url);
    } catch (e) {
        console.error(`[Reactopus Loader] Failed to load ${url}:`, e);
    }
}

export function drainQueue() {
    return queue.drain(fetchAndParse);
}

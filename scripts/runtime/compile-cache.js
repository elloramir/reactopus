import { fnv1aHash } from "../utils/hash.js";

// Content-addressed: the key is a hash of the exact source, so a cache hit
// is always correct (same input, same output) and needs no TTL/staleness
// logic. CACHE_VERSION only exists so upgrading the parser/transpiler
// themselves doesn't serve stale compiled output from an older version.
const CACHE_VERSION = "1";
const KEY_PREFIX = `reactopus:compile:v${CACHE_VERSION}:`;

function getStorage() {
    try {
        return window.localStorage;
    } catch (e) {
        return null;
    }
}

function keyFor(source) {
    return `${KEY_PREFIX}${fnv1aHash(source)}`;
}

export function readCompiled(source) {
    const storage = getStorage();
    if (!storage) return null;
    try {
        const raw = storage.getItem(keyFor(source));
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

export function writeCompiled(source, compiled) {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.setItem(keyFor(source), JSON.stringify(compiled));
    } catch (e) {
        // Quota exceeded or storage disabled: caching is an optimization, not a requirement.
    }
}

export function clearCompileCache() {
    const storage = getStorage();
    if (!storage) return;
    try {
        Object.keys(storage)
            .filter((key) => key.startsWith("reactopus:compile:"))
            .forEach((key) => storage.removeItem(key));
    } catch (e) {
        // ignore
    }
}

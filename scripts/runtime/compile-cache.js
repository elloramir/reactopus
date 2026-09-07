import { fnv1aHash } from "../utils/hash.js";
import { getStorage } from "./storage.js";

// Content-addressed: the key is a hash of the exact source, so a cache hit
// is always correct (same input, same output) and needs no TTL/staleness
// logic. CONTENT_VERSION only exists so upgrading the parser/transpiler
// themselves doesn't serve stale compiled output from an older version.
// The actual storage backend (IndexedDB, falling back to localStorage) is
// storage.js's concern, not this file's.
const CONTENT_VERSION = "1";

/**
 * @param {string} source
 * @returns {string}
 */
function keyFor(source) {
    return `v${CONTENT_VERSION}:${fnv1aHash(source)}`;
}

/**
 * @param {string} source
 * @returns {Promise<import("./types.js").CompiledModule|null>}
 */
export async function readCompiled(source) {
    const storage = await getStorage();
    return storage.get(keyFor(source));
}

/**
 * @param {string} source
 * @param {import("./types.js").CompiledModule} compiled
 * @returns {Promise<void>}
 */
export async function writeCompiled(source, compiled) {
    const storage = await getStorage();
    return storage.set(keyFor(source), compiled);
}

/**
 * @returns {Promise<void>}
 */
export async function clearCompileCache() {
    const storage = await getStorage();
    return storage.clear();
}

// Storage backend for the compile cache: IndexedDB when it's actually
// usable (large quota, naturally async), falling back to localStorage
// (small quota, ~5-10MB, but almost universally available and simple)
// otherwise. Kept as a real interface + two interchangeable
// implementations - unlike Parser/TaskQueue, this isn't a single
// hand-rolled data structure, it's exactly the "swap the implementation
// behind a fixed shape" case a class hierarchy is for.

const DB_NAME = "reactopus";
const DB_VERSION = 1;
const STORE_NAME = "compile-cache";
const LOCAL_STORAGE_PREFIX = "reactopus:compile-cache:";

// indexedDB.open() has no built-in timeout: some browsers/profiles (private
// browsing, storage disabled by policy, certain sandboxed/embedded
// environments) never fire any of onsuccess/onerror/onblocked at all.
// Without a bound here, a stuck open() would hang getStorage() - and
// therefore the whole boot() pipeline - forever instead of just falling
// back to localStorage.
const OPEN_TIMEOUT_MS = 1000;

/**
 * @typedef {import("./types.js").CompiledModule} CompiledModule
 */

export class CompileCacheStorage {
    /** @param {string} key @returns {Promise<CompiledModule|null>} */
    async get(key) {
        throw new Error("not implemented");
    }

    /** @param {string} key @param {CompiledModule} value @returns {Promise<void>} */
    async set(key, value) {
        throw new Error("not implemented");
    }

    /** @returns {Promise<void>} */
    async clear() {
        throw new Error("not implemented");
    }
}

export class IndexedDbStorage extends CompileCacheStorage {
    /** @param {IDBDatabase} db */
    constructor(db) {
        super();
        this.db = db;
    }

    /** @param {string} key @returns {Promise<CompiledModule|null>} */
    async get(key) {
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(STORE_NAME, "readonly");
                const request = tx.objectStore(STORE_NAME).get(key);
                request.onsuccess = () => resolve(request.result ?? null);
                request.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    }

    /** @param {string} key @param {CompiledModule} value @returns {Promise<void>} */
    async set(key, value) {
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(STORE_NAME, "readwrite");
                tx.objectStore(STORE_NAME).put(value, key);
                // Quota exceeded or storage disabled: caching is an optimization, not a requirement.
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
                tx.onabort = () => resolve();
            } catch (e) {
                resolve();
            }
        });
    }

    /** @returns {Promise<void>} */
    async clear() {
        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction(STORE_NAME, "readwrite");
                tx.objectStore(STORE_NAME).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
                tx.onabort = () => resolve();
            } catch (e) {
                resolve();
            }
        });
    }

    /** Opens the DB with a hard timeout. @returns {Promise<IndexedDbStorage|null>} */
    static async open() {
        if (typeof indexedDB === "undefined") return null;

        const attempt = new Promise((resolve) => {
            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }
                };

                request.onsuccess = () => resolve(new IndexedDbStorage(request.result));
                request.onerror = () => resolve(null);
                request.onblocked = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });

        const timeout = new Promise((resolve) => {
            setTimeout(() => resolve(null), OPEN_TIMEOUT_MS);
        });

        return Promise.race([attempt, timeout]);
    }
}

export class LocalStorageStorage extends CompileCacheStorage {
    /** @returns {Storage|null} */
    static available() {
        try {
            return window.localStorage;
        } catch (e) {
            return null;
        }
    }

    /** @param {string} key @returns {Promise<CompiledModule|null>} */
    async get(key) {
        const storage = LocalStorageStorage.available();
        if (!storage) return null;
        try {
            const raw = storage.getItem(LOCAL_STORAGE_PREFIX + key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    /** @param {string} key @param {CompiledModule} value @returns {Promise<void>} */
    async set(key, value) {
        const storage = LocalStorageStorage.available();
        if (!storage) return;
        try {
            storage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(value));
        } catch (e) {
            // Quota exceeded or storage disabled: caching is an optimization, not a requirement.
        }
    }

    /** @returns {Promise<void>} */
    async clear() {
        const storage = LocalStorageStorage.available();
        if (!storage) return;
        try {
            Object.keys(storage)
                .filter((key) => key.startsWith(LOCAL_STORAGE_PREFIX))
                .forEach((key) => storage.removeItem(key));
        } catch (e) {
            // ignore
        }
    }
}

/**
 * @type {Promise<CompileCacheStorage>|null}
 */
let storagePromise = null;

/** @returns {Promise<CompileCacheStorage>} */
export function getStorage() {
    if (!storagePromise) {
        storagePromise = IndexedDbStorage.open().then((idb) => idb || new LocalStorageStorage());
    }
    return storagePromise;
}

// Only meant for reset between test runs - a real page never needs to
// forget which backend it picked.
export function resetStorageSelection() {
    storagePromise = null;
}

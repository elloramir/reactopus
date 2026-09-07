// Startup config read from the main <script src="reactopus.js"> tag's own
// data-* attributes. See README.md "Startup configuration" for the list.

/**
 * @param {string|undefined} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue) {
    if (value === undefined) return defaultValue;
    return value !== "false" && value !== "0";
}

/**
 * @param {string|undefined} value
 * @param {number} defaultValue
 * @returns {number}
 */
function parseConcurrency(value, defaultValue) {
    if (value === undefined) return defaultValue;
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

/**
 * @param {HTMLOrSVGScriptElement|null} scriptEl
 * @returns {import("./runtime/types.js").LoaderConfig}
 */
export function readBootConfig(scriptEl) {
    const dataset = (scriptEl && scriptEl.dataset) || {};
    return {
        cache: parseBoolean(dataset.cache, true),
        concurrency: parseConcurrency(dataset.concurrency, 4),
        debug: parseBoolean(dataset.debug, false),
    };
}

// Per-entry override read from a <script type="text/jsx" data-cache="false">
// tag. Returns undefined (meaning "inherit the global config") when the
// attribute isn't present at all.
/**
 * @param {HTMLScriptElement} scriptEl
 * @returns {boolean|undefined}
 */
export function readEntryCacheOverride(scriptEl) {
    if (scriptEl.dataset.cache === undefined) return undefined;
    return parseBoolean(scriptEl.dataset.cache, true);
}

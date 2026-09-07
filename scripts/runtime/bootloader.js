import { configureLoader, enqueue, compile, scanImportSources, drainQueue, resetLoader } from "./loader.js";
import { configureSandbox, executeModule, executeCompiled } from "./sandbox.js";
import { resetModuleRegistry } from "./module-registry.js";
import { readEntryCacheOverride } from "../config.js";

// A real page only ever calls boot() once, so loader/module-registry state
// is never reset in production. Exposed for test suites that call boot()
// more than once in the same process and need each run to start clean -
// otherwise a URL reused across runs (or across tests) silently short-
// circuits as "already loaded" instead of re-fetching/re-executing.
export function resetRuntimeState() {
    resetModuleRegistry();
    resetLoader();
}

// Discovers <script type="text/jsx"> blocks, resolves their dependency
// graph (fetch + parse + transpile, with the persistent cache short-circuiting
// unchanged content), then executes every entry point in document order.
export async function boot(config) {
    configureLoader(config);

    const ownDocumentUrl = window.location.href;
    configureSandbox({ ownDocumentUrl });

    const codeBlocks = document.querySelectorAll("script[type='text/jsx']");
    const entryPoints = [];

    for (const block of codeBlocks) {
        const useCacheOverride = readEntryCacheOverride(block);

        if (block.src) {
            const fullUrl = new URL(block.src, ownDocumentUrl).href;
            enqueue(fullUrl, { useCache: useCacheOverride });
            entryPoints.push({ type: "url", url: fullUrl });
        } else {
            // A parse error here must not stop the discovery loop - one bad
            // inline block shouldn't take every later <script> on the page
            // down with it, same isolation fetchAndParse gives remote files.
            try {
                const source = block.textContent;
                const compiled = compile(source, ownDocumentUrl, { useCache: useCacheOverride });
                scanImportSources(compiled.imports, ownDocumentUrl);
                entryPoints.push({ type: "inline", compiled });
            } catch (e) {
                console.error("[Reactopus] Failed to parse inline <script type=\"text/jsx\">:", e);
            }
        }
    }

    await drainQueue();

    for (const entry of entryPoints) {
        if (entry.type === "url") {
            executeModule(entry.url);
        } else {
            executeCompiled(entry.compiled, ownDocumentUrl);
        }
    }
}

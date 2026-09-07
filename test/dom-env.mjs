import { JSDOM } from "jsdom";

// Installs a fresh document/window (with its own localStorage) as globals,
// so runtime code written for a browser (document.querySelectorAll,
// window.localStorage, ...) runs unmodified under Node.
export function installDom(url = "http://localhost/index.html") {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    return dom;
}

// Stubs fetch() to resolve from an in-memory map of path -> source, keeping
// multi-file dependency-resolution tests fully virtualized - no real
// filesystem or network access.
export function installVirtualFetch(files) {
    globalThis.fetch = async (urlStr) => {
        const path = new URL(urlStr).pathname;
        const source = files[path];
        if (source === undefined) return { ok: false, status: 404, text: async () => "" };
        return { ok: true, status: 200, text: async () => source };
    };
}

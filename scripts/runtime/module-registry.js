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

// Built-ins plus every module that has finished executing, keyed by URL.
let modules = { ...BUILTIN_MODULES };

// Only meant for reset between page boots/test runs (see bootloader.js's
// resetRuntimeState) - in normal operation this map only ever grows, since a
// real page only boots once.
export function resetModuleRegistry() {
    modules = { ...BUILTIN_MODULES };
}

export function getBuiltin(path) {
    return modules[path] ? modules[path].exports : undefined;
}

export function isRegistered(url) {
    return Boolean(modules[url]);
}

export function getRegisteredExports(url) {
    return modules[url] ? modules[url].exports : undefined;
}

export function registerModule(url, module) {
    modules[url] = module;
}

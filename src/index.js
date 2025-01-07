// Copyright 2025 Elloramir. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

const transpiler = require("./transpiler");
const modulesLoaded = new Map();
const AnonFunction = (async () => {}).constructor;

window.React = require("react");
window.ReactDOM = require("react-dom/client");
window.ReactRouter = require("react-router");

window.addEventListener("load", async () => {
    const scripts = document.querySelectorAll("script");
    const jsxMime = Array.from(scripts).filter(e => e.getAttribute("type") === "text/jsx");

    // Transpile script tags that imports jsx
    for (const script of jsxMime) {
        const src = script.getAttribute("src");
        if (!src) {
            const code = script.textContent.trim();

            if (code.length > 0) {
                createJSXPackage(code, ".");
            }
        }
        else importModule(src); // Let's load and transpile the code
    }
});


function createJSXPackage(code, basePath) {
    const transpiled = transpiler.parse(code);
    const importProxy = (filename) => importModule(basePath + "/" + filename);
    const finalModule = new AnonFunction("___require", "__export", transpiled);
    const exportObject = { };

    // Execute module
    finalModule(importProxy, exportObject);

    return exportObject;
}


async function importModule(filename) {
    // Add js extension if it does not have one
    if (!/\.[a-zA-Z0-9]+$/.test(filename)) {
        filename += '.js';
    }

    const url = new URL(window.location);
    const absolute = new URL(filename, url).href;
    const base = absolute.split("/").slice(0, -1).join("/");
    const [ mime ] = filename.match(/\.[0-9a-z]+$/i)
    let loaded = modulesLoaded.get(absolute)

    if (!loaded) {
        const code = await fetch(absolute)
            .then(res => res.status == 404 ? null : res.text());

        if (code != null) {
            try {
                if (mime === ".json") {
                    loaded = {default: JSON.parse(code)};
                    modulesLoaded.set(absolute, loaded);
                }
                else {
                    loaded = createJSXPackage(code, base);
                    modulesLoaded.set(absolute, loaded);
                }
            }
            catch(err) {
                throw `Can't parse package: ${absolute}\n${err}`;
            }
        }
        else
            throw `Can't find package file: ${absolute}`;
    }

    return loaded;
}
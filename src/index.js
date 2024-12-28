const transpiler = require("./transpiler");
const modulesLoaded = new Map();
const AnonFunction = (async () => {}).constructor;

// Define react toolkit as global
window.React = require("react");
window.ReactDOM = require("react-dom/client");


window.addEventListener("load", async () => {
	const scripts = document.querySelectorAll("script");
	const jsxMime = Array.from(scripts).filter(e => e.getAttribute("type") === "text/jsx");

	// Transpile script tags that imports jsx
	for (const script of jsxMime) {
		const src = script.getAttribute("src");
		if (!src) continue;

		// Let's load and transpile the code
		importModule(src);
	}
});


function createJSXPackage(code) {
	const transpiled = transpiler.parse(code);
	const finalModule = new AnonFunction("___require", transpiled);

	return finalModule(importModule);
}


async function importModule(filename) {
	// Add js extension if it does not have one
	if (!/\.[a-zA-Z0-9]+$/.test(filename)) {
		filename += '.js';
    }

	const url = new URL(window.location);
	const absolute = new URL(filename, url).href;
	let loaded = modulesLoaded.get(absolute)

	if (!loaded) {
		const code = await fetch(absolute)
			.then(res => res.status == 404 ? null : res.text());

		if (code) {
			loaded = createJSXPackage(code);
			modulesLoaded.set(absolute, loaded);
		}
		else
			return null;
	}

	return loaded;
}
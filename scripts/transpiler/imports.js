/**
 * import ... from "..."  ->  require("...")
 * Runs in a CommonJS sandbox (see runtime/sandbox.js), so every import
 * becomes a plain `require` + destructure/assign.
 */
export function generateRequire(node) {
    if (!node.specifiers) {
        return `require("${node.source}");\n`; // side-effect import: import "pkg";
    }

    const { specifiers, source } = node;
    const cleanSource = source.replace(/[^a-zA-Z0-9]/g, "_");

    // Named (+ optional default): import React, { useState, x as y } from "react"
    if (specifiers.includes("{")) {
        const [defPart, namedPart] = specifiers.split("{");
        const defaultName = defPart.replace(",", "").trim();
        const names = namedPart
            .replace("}", "")
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => part.replace(/\s+as\s+/, ": ")) // `x as y` -> `x: y` for destructuring
            .join(", ");

        let code = `const _pkg_${cleanSource} = require("${source}");\n`;
        if (defaultName) code += `const ${defaultName} = _pkg_${cleanSource}.default || _pkg_${cleanSource};\n`;
        if (names) code += `const { ${names} } = _pkg_${cleanSource};\n`;
        return code;
    }

    // Default + namespace combined: import Default, * as NS from "pkg"
    if (specifiers.includes(",") && specifiers.includes("* as")) {
        const [defPart, nsPart] = specifiers.split(",").map((s) => s.trim());
        const alias = nsPart.replace("* as", "").trim();
        return (
            `const _pkg_${cleanSource} = require("${source}");\n` +
            `const ${alias} = _pkg_${cleanSource};\n` +
            `const ${defPart} = _pkg_${cleanSource}.default || _pkg_${cleanSource};\n`
        );
    }

    // Namespace only: import * as NS from "pkg"
    if (specifiers.startsWith("* as")) {
        const alias = specifiers.substring(4).trim();
        return `const ${alias} = require("${source}");\n`;
    }

    // Default only: import Default from "pkg"
    return `const ${specifiers} = require("${source}").default || require("${source}");\n`;
}

import { convertNode } from "./index.js";

// Turns the parser's export-* structural nodes into CommonJS code.

export function generateExportDefault() {
    return "exports.default = ";
}

export function generateExportFunction(node) {
    const star = node.generator ? "*" : "";
    return `exports.${node.name} = function ${star}${node.name}`;
}

export function generateExportClass(node) {
    return `exports.${node.name} = class ${node.name}`;
}

export function generateExportDeclarators(node) {
    const parts = node.declarators.map((decl) => {
        const target = decl.isPattern ? decl.patternSrc : decl.name;
        if (!decl.init) return target;

        const value = decl.init.map(convertNode).join("");
        const assign = decl.isPattern ? "" : `exports.${decl.name} = `;
        return `${target} = ${assign}${value}`;
    });

    let code = `${node.keyword} ${parts.join(", ")};`;

    for (const decl of node.declarators) {
        const names = decl.isPattern ? decl.boundNames : (!decl.init ? [decl.name] : []);
        for (const name of names) code += ` exports.${name} = ${name};`;
    }

    return code;
}

export function generateExportNamed(node) {
    if (node.source) {
        const cleanSource = node.source.replace(/[^a-zA-Z0-9]/g, "_");
        let code = `const _reexport_${cleanSource} = require("${node.source}");\n`;
        for (const { local, exported } of node.specifiers) {
            code += `exports.${exported} = _reexport_${cleanSource}.${local};\n`;
        }
        return code;
    }
    return node.specifiers.map(({ local, exported }) => `exports.${exported} = ${local};`).join(" ");
}

export function generateExportAll(node) {
    return `Object.assign(exports, require("${node.source}"));\n`;
}

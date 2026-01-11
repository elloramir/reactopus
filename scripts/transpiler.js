export default function transpile(ast) {
    return ast.map(node => convertNode(node)).join("");
}

/**
 * Main conversion switch
 */
function convertNode(node) {
    switch (node.type) {
        case "import":     return generateRequire(node);
        case "element":    return generateReactCreateElement(node);
        case "expression": return node.children.map(convertNode).join("");
        case "text":       return transformExports(node.value);
        default:           return "";
    }
}

/**
 * Handle CommonJS conversions in text nodes
 * "export default" -> "exports.default ="
 */
function transformExports(code) {
    let val = code;
    val = val.replace(/export\s+default\s+/g, "exports.default = ");
    val = val.replace(/export\s+function\s+([a-zA-Z0-9_$]+)/g, "exports.$1 = function $1");
    // Handle exported constants/vars: export const x = 1 -> const x = exports.x = 1
    // Simplification for this demo:
    val = val.replace(/export\s+(const|let|var)\s+([a-zA-Z0-9_$]+)/g, "$1 $2 = exports.$2");
    return val;
}

/**
 * TRANSFORM: import ... from ...  -->  require(...)
 */
function generateRequire(node) {
    if (!node.specifiers) {
        // Side-effect: import "pkg"
        return `require("${node.source}");\n`;
    }

    const { specifiers, source } = node;
    const cleanSource = source.replace(/[^a-zA-Z0-9]/g, "_");

    // 1. Named Imports: import { A, B } from "pkg"
    if (specifiers.includes("{")) {
        const [defPart, namedPart] = specifiers.split("{");
        const defaultName = defPart.replace(",", "").trim();
        const names = namedPart.replace("}", "").trim();

        let code = `const _pkg_${cleanSource} = require("${source}");\n`;
        
        if (defaultName) {
            code += `const ${defaultName} = _pkg_${cleanSource}.default || _pkg_${cleanSource};\n`;
        }
        if (names) {
            code += `const { ${names} } = _pkg_${cleanSource};\n`;
        }
        return code;
    } 
    
    // 2. Namespace: import * as A from "pkg"
    if (specifiers.startsWith("* as")) {
         const alias = specifiers.substring(4).trim();
         return `const ${alias} = require("${source}");\n`;
    }

    // 3. Default: import A from "pkg"
    return `const ${specifiers} = require("${source}").default || require("${source}");\n`;
}

/**
 * TRANSFORM: <div prop={1}>...</div>  -->  React.createElement("div", { prop: 1 }, ...)
 */
function generateReactCreateElement(node) {
    // Tag Name Handling (Component vs HTML Tag)
    let tagName = "React.Fragment";
    if (node.tagName) {
        // Capitalized = Component, Lowercase = String
        tagName = /^[A-Z]/.test(node.tagName) ? node.tagName : `"${node.tagName}"`;
    }

    // Props Processing
    let props = "null";
    const keys = Object.keys(node.attributes || {});
    if (keys.length > 0) {
        const propsList = keys.map(key => {
            const attr = node.attributes[key];
            const val = attr.type === "expression" ? attr.value : JSON.stringify(attr.value);
            return `"${key}": ${val}`;
        });
        props = `{ ${propsList.join(", ")} }`;
    }

    // Children Recursion
    const childrenArgs = (node.children || []).map(child => {
        if (child.type === "text") return JSON.stringify(child.value);
        if (child.type === "expression") return child.children.map(convertNode).join("");
        if (child.type === "element") return generateReactCreateElement(child);
        return "null";
    });

    // Output
    return `React.createElement(${[tagName, props, ...childrenArgs].join(", ")})`;
}

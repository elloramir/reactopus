import { generateRequire } from "./imports.js";
import { generateReactCreateElement } from "./elements.js";
import {
    generateExportDefault,
    generateExportFunction,
    generateExportClass,
    generateExportDeclarators,
    generateExportNamed,
    generateExportAll,
} from "./exports.js";

// `export ...` is already rewritten to structural export-* nodes at parse
// time (see parser/index.js parseExportStatement), so a "text" node just
// passes through verbatim - no regex rewriting here means no risk of
// corrupting a string literal that happens to contain "export default".
/** @param {import("../parser/ast-types.js").AstNode} node @returns {string} */
export function convertNode(node) {
    switch (node.type) {
        case "import":             return generateRequire(node);
        case "element":            return generateReactCreateElement(node);
        case "expression":         return node.children.map(convertNode).join("");
        case "text":               return node.value;
        case "export-default":     return generateExportDefault();
        case "export-function":    return generateExportFunction(node);
        case "export-class":       return generateExportClass(node);
        case "export-declarators": return generateExportDeclarators(node);
        case "export-named":       return generateExportNamed(node);
        case "export-all":         return generateExportAll(node);
        default:                   return "";
    }
}

/** @param {import("../parser/ast-types.js").AstNode[]} ast @returns {string} */
export default function transpile(ast) {
    return ast.map(convertNode).join("");
}

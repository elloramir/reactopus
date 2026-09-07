import { convertNode } from "./index.js";

// <div a="1" {...rest} b={2}>child</div>  ->  React.createElement("div", {...}, "child")
/** @param {import("../parser/ast-types.js").ElementAttribute[]} attributes @returns {string} */
function buildProps(attributes) {
    if (!attributes || attributes.length === 0) return "null";

    // Order matters here: JSX spread semantics depend on source order
    // (`{...rest} b="x"` differs from `b="x" {...rest}`), so attributes are
    // kept as a single ordered list rather than split into "named" vs "spread".
    const parts = attributes.map((entry) => {
        if (entry.kind === "spread") return `...(${entry.value})`;

        const { name, value } = entry;
        if (value.type === "expression") return `"${name}": ${value.value}`;
        if (value.type === "boolean") return `"${name}": true`;
        return `"${name}": ${JSON.stringify(value.value)}`;
    });

    return `{ ${parts.join(", ")} }`;
}

/** @param {import("../parser/ast-types.js").ElementNode} node @returns {string} */
export function generateReactCreateElement(node) {
    let tagName = "React.Fragment";
    if (node.tagName) {
        tagName = /^[A-Z]/.test(node.tagName) ? node.tagName : `"${node.tagName}"`;
    }

    const props = buildProps(node.attributes);

    const childrenArgs = (node.children || []).map((child) => {
        if (child.type === "text") return JSON.stringify(child.value);
        if (child.type === "expression") return child.children.map(convertNode).join("");
        if (child.type === "element") return generateReactCreateElement(child);
        return "null";
    });

    return `React.createElement(${[tagName, props, ...childrenArgs].join(", ")})`;
}

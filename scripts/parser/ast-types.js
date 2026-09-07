// Type-only module: the shapes the parser produces and the transpiler
// consumes. Never imported at runtime - referenced from JSDoc elsewhere via
// `@typedef {import("./ast-types.js").AstNode} AstNode`.

/**
 * @typedef {TextNode|ContentExpressionNode|ElementNode|ImportNode|ExportDefaultNode|ExportFunctionNode|ExportClassNode|ExportDeclaratorsNode|ExportNamedNode|ExportAllNode} AstNode
 */

/** @typedef {{type: "text", value: string}} TextNode */

/**
 * A JSX `{...}` expression body - its own children can include nested elements.
 * @typedef {{type: "expression", children: AstNode[]}} ContentExpressionNode
 */

/** @typedef {{type: "element", tagName: string|null, attributes: ElementAttribute[], children: AstNode[]}} ElementNode */

/** @typedef {AttrEntry|SpreadEntry} ElementAttribute */
/** @typedef {{kind: "attr", name: string, value: AttributeValue}} AttrEntry */
/** @typedef {{kind: "spread", value: string}} SpreadEntry */

/** @typedef {StringAttributeValue|ExprAttributeValue|BooleanAttributeValue} AttributeValue */
/** @typedef {{type: "string", value: string}} StringAttributeValue */
/**
 * A JSX `name={...}` attribute - `value` is the raw expression source, not a nested AST.
 * @typedef {{type: "expression", value: string}} ExprAttributeValue
 */
/** @typedef {{type: "boolean", value: true}} BooleanAttributeValue */

/**
 * `specifierText` is the raw "React, { useState }" source between `import` and `from`, unparsed - the transpiler pattern-matches it directly.
 * @typedef {{type: "import", specifierText: string|null, source: string}} ImportNode
 */

/** @typedef {{type: "export-default"}} ExportDefaultNode */
/** @typedef {{type: "export-function", name: string, generator: boolean}} ExportFunctionNode */
/** @typedef {{type: "export-class", name: string}} ExportClassNode */
/** @typedef {{type: "export-declarators", keyword: "const"|"let"|"var", declarators: Declarator[]}} ExportDeclaratorsNode */
/** @typedef {PatternDeclarator|NameDeclarator} Declarator */
/** @typedef {{isPattern: true, patternSrc: string, boundNames: string[], init: AstNode[]|null}} PatternDeclarator */
/** @typedef {{isPattern: false, name: string, init: AstNode[]|null}} NameDeclarator */
/** @typedef {{type: "export-named", specifiers: ExportSpecifier[], source: string|null}} ExportNamedNode */
/** @typedef {{local: string, exported: string}} ExportSpecifier */
/** @typedef {{type: "export-all", source: string}} ExportAllNode */

export {};

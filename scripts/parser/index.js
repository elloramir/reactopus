import { isIdentifierChar, isNameChar, isQuoteChar, isWhitespace } from "./char-classes.js";
import { looksLikeTagStart, precedingContextAllowsExpression } from "./context-heuristics.js";
import { normalizeJSXText } from "./jsx-whitespace.js";
import { extractPatternBindings } from "./pattern-bindings.js";

// Recursive-descent parser for JSX-flavored JS. It does not build a full JS
// AST: everything that isn't JSX (or import/export, which the transpiler
// needs to rewrite to CommonJS) is kept as opaque "text" and passed through
// almost verbatim. The parser only decides STRUCTURE (is this a tag, an
// export, a string); turning that structure into JS source is the
// transpiler's job.
/**
 * @param {string} input
 */
export default function Parser(input) {
    this.input = input;
    this.pos = 0;
}

// Navigation & basic consumption

Parser.prototype.eof = function () {
    return this.pos >= this.input.length;
};

Parser.prototype.nextChar = function () {
    return this.input[this.pos];
};

/**
 * @param {string} str
 * @returns {boolean}
 */
Parser.prototype.startsWith = function (str) {
    return this.input.startsWith(str, this.pos);
};

// Keyword check with word-boundary guards on both sides, so "export" doesn't
// match inside "foo.export" or "myexport".
/**
 * @param {string} word
 * @returns {boolean}
 */
Parser.prototype.matchesKeyword = function (word) {
    if (!this.startsWith(word)) return false;
    const before = this.input[this.pos - 1];
    const after = this.input[this.pos + word.length];
    if (before !== undefined && (isIdentifierChar(before) || before === ".")) return false;
    if (isIdentifierChar(after)) return false;
    return true;
};

/**
 * @param {string} message
 * @returns {never}
 */
Parser.prototype.error = function (message) {
    let line = 1;
    let col = 1;
    for (let i = 0; i < this.pos && i < this.input.length; i++) {
        if (this.input[i] === "\n") {
            line++;
            col = 1;
        } else {
            col++;
        }
    }
    throw new Error(`Parser Error: ${message} (line ${line}, col ${col}, pos ${this.pos})`);
};

/**
 * @param {string} str
 */
Parser.prototype.expect = function (str) {
    if (this.startsWith(str)) {
        this.pos += str.length;
    } else {
        this.error(`Expected "${str}"`);
    }
};

Parser.prototype.consumeChar = function () {
    return this.input[this.pos++];
};

/**
 * @param {(ch: string) => boolean} predicate
 * @returns {string}
 */
Parser.prototype.consumeWhile = function (predicate) {
    let res = "";
    while (!this.eof() && predicate(this.nextChar())) {
        res += this.consumeChar();
    }
    return res;
};

Parser.prototype.consumeWhiteSpace = function () {
    this.consumeWhile(isWhitespace);
};

// Tokenizers: names, strings, comments, regex literals, balanced blocks

Parser.prototype.parseName = function () {
    return this.consumeWhile(isNameChar);
};

/**
 * @param {string} quoteChar
 * @returns {string}
 */
Parser.prototype.consumeStringLiteral = function (quoteChar) {
    if (this.nextChar() !== quoteChar) {
        this.error(`Expected string start "${quoteChar}"`);
    }

    let value = this.consumeChar(); // open quote
    let closed = false;

    while (!this.eof()) {
        const ch = this.consumeChar();
        value += ch;

        if (ch === "\\" && !this.eof()) {
            value += this.consumeChar();
            continue;
        }

        // Template literal interpolation
        if (quoteChar === "`" && ch === "$" && this.nextChar() === "{") {
            value += this.consumeBalancedBlock("{", "}");
            continue;
        }

        if (ch === quoteChar) {
            closed = true;
            break;
        }
    }

    if (!closed) this.error(`Unterminated string literal (expected closing "${quoteChar}")`);
    return value;
};

/**
 * @returns {string}
 */
Parser.prototype.consumeLineComment = function () {
    let value = this.consumeChar() + this.consumeChar(); // "//"
    value += this.consumeWhile((ch) => ch !== "\n");
    return value;
};

/**
 * @returns {string}
 */
Parser.prototype.consumeBlockComment = function () {
    let value = this.consumeChar() + this.consumeChar(); // "/*"
    while (!this.eof() && !this.startsWith("*/")) {
        value += this.consumeChar();
    }
    if (this.startsWith("*/")) {
        value += this.consumeChar() + this.consumeChar();
    }
    return value;
};

// Returns the consumed regex literal, or null if this "/" isn't one (pos is left untouched on null).
/**
 * @returns {string|null}
 */
Parser.prototype.tryConsumeRegexLiteral = function () {
    if (this.nextChar() !== "/") return null;
    if (this.input[this.pos + 1] === "/" || this.input[this.pos + 1] === "*") return null;
    if (!precedingContextAllowsExpression(this.input, this.pos)) return null;

    const start = this.pos;
    let value = this.consumeChar(); // opening /
    let inClass = false;

    while (!this.eof()) {
        const ch = this.nextChar();

        if (ch === "\n") {
            this.pos = start; // not a regex after all; treat "/" as divide
            return null;
        }

        if (ch === "\\" && this.pos + 1 < this.input.length) {
            value += this.consumeChar() + this.consumeChar();
            continue;
        }

        if (ch === "[") inClass = true;
        else if (ch === "]") inClass = false;
        else if (ch === "/" && !inClass) {
            value += this.consumeChar();
            value += this.consumeWhile((c) => /[a-zA-Z]/.test(c)); // flags
            return value;
        }

        value += this.consumeChar();
    }

    this.pos = start;
    return null;
};

// Skips string/comment/regex content atomically so their braces never disturb depth counting.
/**
 * @param {string} openChar
 * @param {string} closeChar
 * @returns {string}
 */
Parser.prototype.consumeBalancedBlock = function (openChar, closeChar) {
    if (this.nextChar() !== openChar) this.error(`Expected "${openChar}"`);

    let depth = 0;
    let value = "";

    while (!this.eof()) {
        const next = this.nextChar();

        if (next === "/" && this.input[this.pos + 1] === "/") {
            value += this.consumeLineComment();
            continue;
        }
        if (next === "/" && this.input[this.pos + 1] === "*") {
            value += this.consumeBlockComment();
            continue;
        }
        if (isQuoteChar(next)) {
            value += this.consumeStringLiteral(next);
            continue;
        }
        const regex = this.tryConsumeRegexLiteral();
        if (regex !== null) {
            value += regex;
            continue;
        }

        const ch = this.consumeChar();
        value += ch;
        if (ch === openChar) depth++;
        else if (ch === closeChar) {
            depth--;
            if (depth === 0) break;
        }
    }

    if (depth !== 0) this.error(`Unbalanced block ${openChar}${closeChar}`);
    return value;
};

// Consumes up to the matching "}" (the opening "{" must already be consumed).
/**
 * @returns {string}
 */
Parser.prototype.consumeBraceBody = function () {
    let depth = 1;
    let value = "";

    while (!this.eof()) {
        const ch = this.nextChar();

        if (ch === "/" && this.input[this.pos + 1] === "/") {
            value += this.consumeLineComment();
            continue;
        }
        if (ch === "/" && this.input[this.pos + 1] === "*") {
            value += this.consumeBlockComment();
            continue;
        }
        if (isQuoteChar(ch)) {
            value += this.consumeStringLiteral(ch);
            continue;
        }
        const regex = this.tryConsumeRegexLiteral();
        if (regex !== null) {
            value += regex;
            continue;
        }
        if (ch === "{") {
            depth++;
            value += this.consumeChar();
            continue;
        }
        if (ch === "}") {
            depth--;
            if (depth === 0) {
                this.consumeChar();
                break;
            }
            value += this.consumeChar();
            continue;
        }
        value += this.consumeChar();
    }

    if (depth !== 0) this.error("Unbalanced { }");
    return value;
};

// Core scanner. Top-level module code, JSX children and JSX {expression}
// bodies are all "JS-ish content interrupted by JSX elements, comments,
// strings, regexes and (sometimes) exports" - they only differ in whether
// bare "<" is JSX-heuristic-gated, whether whitespace collapses per JSX
// text rules, and where scanning stops.

// isJSXMode: true for JSX children/text, false for JS code.
// stopChars: if set, stop at the first of these chars seen at bracket-depth 0
// (used to find the end of one `export const NAME = <initializer>` declarator
// without being fooled by commas/semicolons nested inside it).
/**
 * @param {boolean} isJSXMode
 * @param {string[]|null} stopChars
 * @returns {import("./ast-types.js").AstNode[]}
 */
Parser.prototype.scanMixedContent = function (isJSXMode, stopChars) {
    /**
     * @type {import("./ast-types.js").AstNode[]}
     */
    const nodes = [];
    let buffer = "";
    let depth = 0;

    const flush = () => {
        if (!buffer) return;
        const value = isJSXMode ? normalizeJSXText(buffer) : buffer;
        if (value) nodes.push({ type: "text", value });
        buffer = "";
    };

    while (!this.eof()) {
        if (isJSXMode && this.startsWith("</")) break;
        if (stopChars && depth === 0 && stopChars.includes(this.nextChar())) break;

        const ch = this.nextChar();

        if (ch === "<" && looksLikeTagStart(this.input, this.pos, { requireExpressionContext: !isJSXMode })) {
            flush();
            nodes.push(this.parseElement());
            continue;
        }

        if (isJSXMode && ch === "{") {
            flush();
            nodes.push(this.parseExpression());
            continue;
        }

        if (!isJSXMode) {
            if (ch === "/" && this.input[this.pos + 1] === "/") {
                buffer += this.consumeLineComment();
                continue;
            }
            if (ch === "/" && this.input[this.pos + 1] === "*") {
                buffer += this.consumeBlockComment();
                continue;
            }
            if (this.matchesKeyword("export")) {
                flush();
                nodes.push(this.parseExportStatement());
                continue;
            }
            const regex = this.tryConsumeRegexLiteral();
            if (regex !== null) {
                buffer += regex;
                continue;
            }
        }

        if (isQuoteChar(ch)) {
            buffer += this.consumeStringLiteral(ch);
            continue;
        }

        if (stopChars) {
            if ("([{".includes(ch)) {
                depth++;
                buffer += this.consumeChar();
                continue;
            }
            if (")]}".includes(ch)) {
                depth--;
                buffer += this.consumeChar();
                continue;
            }
        }

        buffer += this.consumeChar();
    }

    flush();
    return nodes;
};

/**
 * @returns {import("./ast-types.js").AstNode[]}
 */
Parser.prototype.parse = function () {
    const imports = this.parseAllImports();
    const nodes = this.scanMixedContent(false, null);
    return [...imports, ...nodes];
};

/**
 * @returns {import("./ast-types.js").ContentExpressionNode}
 */
Parser.prototype.parseExpression = function () {
    this.expect("{");
    const children = this.scanMixedContent(false, ["}"]);
    this.expect("}");
    return { type: "expression", children };
};

// import ... from "...";

/**
 * @returns {import("./ast-types.js").ImportNode[]}
 */
Parser.prototype.parseAllImports = function () {
    /**
     * @type {import("./ast-types.js").ImportNode[]}
     */
    const imports = [];
    this.consumeWhiteSpace();
    while (this.matchesKeyword("import")) {
        imports.push(this.parseImport());
        this.consumeWhiteSpace();
    }
    return imports;
};

/**
 * @returns {import("./ast-types.js").ImportNode}
 */
Parser.prototype.parseImport = function () {
    this.expect("import");
    this.consumeWhiteSpace();

    // Side-effect import: import "pkg";
    const next = this.nextChar();
    if (isQuoteChar(next)) {
        const ch = this.consumeChar();
        const source = this.consumeWhile((c) => c !== ch);
        this.expect(ch);
        if (this.startsWith(";")) this.consumeChar();
        return { type: "import", specifierText: null, source };
    }

    // Everything between "import" and "from", verbatim: "React", "{ a, b }",
    // "React, { a }", "* as NS". The transpiler pattern-matches this text
    // directly rather than the parser breaking it into a structured shape.
    let specifierText = "";
    while (!this.eof() && !this.matchesKeyword("from")) {
        specifierText += this.consumeChar();
    }
    specifierText = specifierText.trim();

    this.expect("from");
    this.consumeWhiteSpace();

    const quote = this.consumeChar();
    const source = this.consumeWhile((c) => c !== quote);
    this.expect(quote);

    if (this.startsWith(";")) this.consumeChar();

    return { type: "import", specifierText, source };
};

// export statement parsing. Only extracts structure (kind, names, pattern
// source, nested initializer nodes) - the transpiler decides what JS code
// each piece becomes. Doing it here at parse time (instead of the old
// approach of a transpile-time regex over merged text) means an
// initializer's JSX still gets parsed into real elements, and a string
// literal that happens to contain the words "export default" is untouched.

/**
 * @returns {import("./ast-types.js").AstNode}
 */
Parser.prototype.parseExportStatement = function () {
    this.expect("export");
    this.consumeWhiteSpace();

    if (this.matchesKeyword("default")) {
        this.expect("default");
        this.consumeWhiteSpace();
        return { type: "export-default" };
    }

    if (this.matchesKeyword("function")) {
        this.expect("function");
        this.consumeWhiteSpace();
        let generator = false;
        if (this.startsWith("*")) {
            this.consumeChar();
            this.consumeWhiteSpace();
            generator = true;
        }
        const name = this.parseName();
        return { type: "export-function", name, generator };
    }

    if (this.matchesKeyword("class")) {
        this.expect("class");
        this.consumeWhiteSpace();
        const name = this.parseName();
        return { type: "export-class", name };
    }

    if (this.matchesKeyword("const") || this.matchesKeyword("let") || this.matchesKeyword("var")) {
        const keyword = this.matchesKeyword("const") ? "const" : this.matchesKeyword("let") ? "let" : "var";
        this.expect(keyword);
        this.consumeWhiteSpace();
        return this.parseExportDeclarators(keyword);
    }

    if (this.startsWith("{")) {
        return this.parseNamedExportList();
    }

    if (this.startsWith("*")) {
        return this.parseExportAllFrom();
    }

    return this.error("Unsupported export syntax");
};

// `export const a = <expr>, {b, c} = <expr2>;`. Each initializer is scanned
// with scanMixedContent (not grabbed as a plain string) so JSX inside it -
// e.g. `export const Foo = () => <div>...</div>` - still parses into real
// element nodes instead of being swallowed as opaque text.
/**
 * @param {"const"|"let"|"var"} keyword
 * @returns {import("./ast-types.js").ExportDeclaratorsNode}
 */
Parser.prototype.parseExportDeclarators = function (keyword) {
    /**
     * @type {import("./ast-types.js").Declarator[]}
     */
    const declarators = [];

    while (true) {
        this.consumeWhiteSpace();

        if (this.nextChar() === "{" || this.nextChar() === "[") {
            const openChar = this.nextChar();
            const closeChar = openChar === "{" ? "}" : "]";
            const patternSrc = this.consumeBalancedBlock(openChar, closeChar);
            const boundNames = extractPatternBindings(patternSrc);

            this.consumeWhiteSpace();
            let init = null;
            if (this.startsWith("=")) {
                this.consumeChar();
                this.consumeWhiteSpace();
                init = this.scanMixedContent(false, [",", ";"]);
            }

            declarators.push({ isPattern: true, patternSrc, boundNames, init });
        } else {
            const name = this.parseName();

            this.consumeWhiteSpace();
            let init = null;
            if (this.startsWith("=")) {
                this.consumeChar();
                this.consumeWhiteSpace();
                init = this.scanMixedContent(false, [",", ";"]);
            }

            declarators.push({ isPattern: false, name, init });
        }

        this.consumeWhiteSpace();
        if (this.startsWith(",")) {
            this.consumeChar();
            continue;
        }
        break;
    }

    if (this.startsWith(";")) this.consumeChar();

    return { type: "export-declarators", keyword, declarators };
};

/**
 * @returns {import("./ast-types.js").ExportNamedNode}
 */
Parser.prototype.parseNamedExportList = function () {
    this.expect("{");
    /**
     * @type {import("./ast-types.js").ExportSpecifier[]}
     */
    const specifiers = [];

    while (true) {
        this.consumeWhiteSpace();
        if (this.startsWith("}")) break;

        const local = this.parseName();
        this.consumeWhiteSpace();
        let exported = local;

        if (this.matchesKeyword("as")) {
            this.expect("as");
            this.consumeWhiteSpace();
            exported = this.parseName();
            this.consumeWhiteSpace();
        }

        specifiers.push({ local, exported });
        if (this.startsWith(",")) {
            this.consumeChar();
            continue;
        }
        break;
    }

    this.consumeWhiteSpace();
    this.expect("}");
    this.consumeWhiteSpace();

    let source = null;
    if (this.matchesKeyword("from")) {
        this.expect("from");
        this.consumeWhiteSpace();
        const quote = this.consumeChar();
        source = this.consumeWhile((c) => c !== quote);
        this.expect(quote);
    }

    if (this.startsWith(";")) this.consumeChar();

    return { type: "export-named", specifiers, source };
};

/**
 * @returns {import("./ast-types.js").ExportAllNode}
 */
Parser.prototype.parseExportAllFrom = function () {
    this.expect("*");
    this.consumeWhiteSpace();
    this.expect("from");
    this.consumeWhiteSpace();
    const quote = this.consumeChar();
    const source = this.consumeWhile((c) => c !== quote);
    this.expect(quote);
    if (this.startsWith(";")) this.consumeChar();
    return { type: "export-all", source };
};

// JSX elements & attributes

/**
 * @returns {import("./ast-types.js").ElementNode}
 */
Parser.prototype.parseElement = function () {
    this.expect("<");
    let rawTagName = this.parseName();
    // Member-expression tag names: <Menu.Item>, <Tabs.TabPane> - "." isn't
    // part of parseName's charset, so without this a dotted tag name would
    // leave the "." unconsumed and spin the attribute loop forever below.
    while (this.nextChar() === "." && rawTagName !== "") {
        this.consumeChar();
        rawTagName += "." + this.parseName();
    }
    const isFragment = rawTagName === "";

    /**
     * @type {import("./ast-types.js").ElementAttribute[]}
     */
    const attributes = [];
    while (true) {
        this.consumeWhiteSpace();
        if (this.eof()) this.error("Unexpected end of input while parsing element attributes");
        if (this.startsWith("/>") || this.startsWith(">")) break;

        if (this.startsWith("{")) {
            attributes.push({ kind: "spread", value: this.parseSpreadAttribute() });
            continue;
        }

        const posBefore = this.pos;
        const [name, value] = this.parseAttribute();
        if (this.pos === posBefore) {
            this.error(`Unexpected character "${this.nextChar()}" while parsing attributes of <${rawTagName}>`);
        }
        attributes.push({ kind: "attr", name, value });
    }

    /**
     * @type {import("./ast-types.js").AstNode[]}
     */
    let children = [];
    if (this.startsWith("/>")) {
        if (isFragment) this.error("Fragments cannot be self-closing");
        this.expect("/>");
    } else {
        this.expect(">");
        children = this.scanMixedContent(true, null);

        if (isFragment) {
            this.expect("</>");
        } else {
            this.expect("</");
            const closingName = this.consumeWhile((c) => c !== ">").trim();
            this.expect(">");
            if (closingName !== rawTagName) {
                this.error(`Mismatched closing tag: expected "</${rawTagName}>" but found "</${closingName}>"`);
            }
        }
    }

    return { type: "element", tagName: isFragment ? null : rawTagName, attributes, children };
};

/**
 * @returns {string}
 */
Parser.prototype.parseSpreadAttribute = function () {
    this.expect("{");
    this.expect("...");
    return this.consumeBraceBody();
};

/**
 * @returns {[string, import("./ast-types.js").AttributeValue]}
 */
Parser.prototype.parseAttribute = function () {
    const name = this.parseName();
    this.consumeWhiteSpace();

    if (!this.startsWith("=")) {
        return [name, { type: "boolean", value: true }]; // JSX boolean shorthand: <input disabled />
    }

    this.expect("=");
    this.consumeWhiteSpace();
    return [name, this.parseAttributeValue()];
};

/**
 * @returns {import("./ast-types.js").AttributeValue}
 */
Parser.prototype.parseAttributeValue = function () {
    const firstChar = this.nextChar();

    if (firstChar === "'" || firstChar === '"') {
        const quote = this.consumeChar();
        const value = this.consumeWhile((c) => c !== quote);
        this.expect(quote);
        return { type: "string", value };
    }

    if (firstChar === "{") {
        this.consumeChar();
        const value = this.consumeBraceBody();
        return { type: "expression", value };
    }

    return this.error("Expected a quoted string or {expression} for attribute value");
};

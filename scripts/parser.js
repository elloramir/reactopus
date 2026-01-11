export default function Parser(str) {
    this.input = str;
    this.pos = 0;
}

/**
 * 1. Navigation & Basic Consumption
 */

Parser.prototype.eof = function() {
    return this.pos >= this.input.length;
};

Parser.prototype.nextChar = function() {
    return this.input[this.pos];
};

Parser.prototype.startsWith = function(str) {
    return this.input.slice(this.pos).startsWith(str);
};

Parser.prototype.expect = function(str) {
    if (this.startsWith(str)) {
        this.pos += str.length;
    } else {
        throw new Error(`Parser Error: Expected "${str}" at pos ${this.pos}`);
    }
};

Parser.prototype.consumeChar = function() {
    return this.input[this.pos++];
};

Parser.prototype.consumeWhile = function(predicate) {
    let res = "";
    while (!this.eof() && predicate(this.nextChar())) {
        res += this.consumeChar();
    }
    return res;
};

Parser.prototype.consumeWhiteSpace = function() {
    this.consumeWhile(ch => /\s/.test(ch));
};

/**
 * 2. Tokenizers (Strings, Blocks, Names)
 */

Parser.prototype.parseName = function() {
    return this.consumeWhile(ch => /[a-zA-Z0-9:_-]/.test(ch));
};

Parser.prototype.consumeStringLiteral = function(quoteChar) {
    if (this.nextChar() !== quoteChar) {
        throw new Error(`Expected string start "${quoteChar}" at ${this.pos}`);
    }
    
    let value = this.consumeChar(); // open quote
    
    while (!this.eof()) {
        const ch = this.consumeChar();
        value += ch;

        // Escape handling
        if (ch === "\\" && !this.eof()) {
            value += this.consumeChar();
            continue;
        }

        // Template literal interpolation handling
        if (quoteChar === "`" && ch === "$" && this.nextChar() === "{") {
            value += this.consumeBalancedBlock("{", "}");
            continue;
        }

        if (ch === quoteChar) break;
    }
    return value;
};

Parser.prototype.consumeBalancedBlock = function(openChar, closeChar) {
    // Used for skipping over JS code blocks { ... } or inner template primitives
    if (this.nextChar() !== openChar) throw new Error(`Expected "${openChar}"`);

    let depth = 0;
    let value = "";
    
    while (!this.eof()) {
        const next = this.nextChar();
        
        // Skip strings inside block to avoid false positives on braces
        if (["'", '"', "`"].includes(next)) {
            value += this.consumeStringLiteral(next);
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

    if (depth !== 0) throw new Error(`Unbalanced block ${openChar}${closeChar}`);
    return value;
};

/**
 * 3. JSX Heuristics
 */

Parser.prototype.looksLikeTagStart = function() {
    if (!this.startsWith("<")) return false;
    if (this.startsWith("</")) return false; // Closing tag
    if (this.startsWith("<>")) return true;  // Fragment
    return /[a-zA-Z]/.test(this.input[this.pos + 1]); // <Div...
};

Parser.prototype.looksLikeClosingTagStart = function() {
    if (!this.startsWith("</")) return false;
    if (this.startsWith("</>")) return true; // Fragment close
    return /[a-zA-Z]/.test(this.input[this.pos + 2]); // </Div...
};

/**
 * 4. Parsing Logic (Recursive Descent)
 */

Parser.prototype.parse = function() {
    const imports = this.parseAllImports();
    const nodes = this.parseAllNodes(false); // Start in JS mode
    return [...imports, ...nodes];
};

Parser.prototype.parseAllImports = function() {
    const imports = [];
    this.consumeWhiteSpace();
    while (this.startsWith("import")) {
        imports.push(this.parseImport());
        this.consumeWhiteSpace();
    }
    return imports;
};

Parser.prototype.parseImport = function() {
    this.expect("import");
    this.consumeWhiteSpace();

    // Side-effect import: import "pkg";
    const next = this.nextChar();
    if (["'", '"', "`"].includes(next)) {
         const ch = this.consumeChar();
         const source = this.consumeWhile(c => c !== ch);
         this.expect(ch);
         if (this.startsWith(";")) this.consumeChar();
         return { type: "import", specifiers: null, source };
    }

    // Default/Named: import React, { useState } from "react";
    let specifiers = "";
    while (!this.eof() && !this.startsWith("from")) {
        specifiers += this.consumeChar();
    }
    specifiers = specifiers.trim();

    this.expect("from");
    this.consumeWhiteSpace();
    
    const quote = this.consumeChar();
    const source = this.consumeWhile(c => c !== quote);
    this.expect(quote);
    
    if (this.startsWith(";")) this.consumeChar();

    return { type: "import", specifiers, source };
};


Parser.prototype.parseAllNodes = function(isJSXMode) {
    const nodes = [];
    while (true) {
        this.consumeWhiteSpace();
        if (this.eof() || (isJSXMode && this.startsWith("</"))) break;
        
        const node = this.parseNode(isJSXMode);
        if (node) nodes.push(node);
    }
    return nodes;
};

Parser.prototype.parseNode = function(isJSXMode) {
    // JSX Expression: { code }
    if (isJSXMode && this.startsWith("{")) {
        return this.parseExpression();
    }
    // JSX Element: <div />
    if (this.looksLikeTagStart()) {
        return this.parseElement();
    }
    // Text / JS Code
    return this.parseText(isJSXMode);
};

Parser.prototype.parseExpression = function() {
    this.expect("{");
    const children = [];
    let buffer = "";
    let depth = 1;

    // Capture everything inside { } as text, but respect nested JSX
    while (depth > 0 && !this.eof()) {
        const char = this.nextChar();
        
        // Block end
        if (char === "}") {
            depth--;
            if (depth === 0) {
                this.consumeChar(); 
                break; 
            }
            buffer += this.consumeChar();
            continue;
        }

        // Nested block
        if (char === "{") {
            depth++;
            buffer += this.consumeChar();
            continue;
        }

        // Nested Element
        if (this.looksLikeTagStart()) {
             if (buffer) {
                 children.push({ type: "text", value: buffer });
                 buffer = "";
             }
             children.push(this.parseElement());
             continue;
        }

        // String literals
        if (["'", '"', "`"].includes(char)) {
            buffer += this.consumeStringLiteral(char);
            continue;
        }
        
        buffer += this.consumeChar();
    }

    if (buffer) children.push({ type: "text", value: buffer });

    return { type: "expression", children };
};

Parser.prototype.parseText = function(isJSXMode) {
    let value = "";

    while (!this.eof()) {
        const ch = this.nextChar();

        // Stop at JSX tags or expressions
        if (ch === "<" && (this.looksLikeTagStart() || this.looksLikeClosingTagStart())) break;
        if (isJSXMode && ch === "{") break;

        // Skip comments in JS mode to prevent parsing issues
        if (!isJSXMode && ch === "/" && this.input[this.pos + 1] === "/") {
             value += this.consumeChar(); // /
             value += this.consumeChar(); // /
             value += this.consumeWhile(c => c !== "\n");
             continue;
        }

        // Consume strings safely
        if (["'", '"', "`"].includes(ch)) {
            value += this.consumeStringLiteral(ch);
            continue;
        }

        value += this.consumeChar();
    }

    return value ? { type: "text", value } : null;
};

Parser.prototype.parseElement = function() {
    this.expect("<");
    const rawTagName = this.parseName();
    const isFragment = rawTagName === "";
    
    // Attributes
    const attributes = {};
    while (true) {
        this.consumeWhiteSpace();
        if (this.startsWith("/>") || this.startsWith(">")) break;
        
        const [name, val] = this.parseAttribute();
        attributes[name] = val;
    }

    // Children
    let children = [];
    if (this.startsWith("/>")) {
        if (isFragment) throw new Error("Fragments cannot be self-closing");
        this.expect("/>");
    } else {
        this.expect(">");
        children = this.parseAllNodes(true); // Switch to JSX Mode for children
        
        if (isFragment) {
            this.expect("</>");
        } else {
            this.expect("</");
            
            // Allow loose closing tags </div >
            const closingName = this.consumeWhile(c => c !== ">").trim();
            if (closingName !== rawTagName) {
                 // Warning: Mismatched tag (optional)
            }
            this.expect(">");
        }
    }

    return { type: "element", tagName: isFragment ? null : rawTagName, attributes, children };
};

Parser.prototype.parseAttribute = function() {
    const name = this.parseName();
    
    this.consumeWhiteSpace();
    this.expect("=");
    this.consumeWhiteSpace();
    
    const value = this.parseAttributeValue();
    return [name, value];
};

Parser.prototype.parseAttributeValue = function() {
    const firstChar = this.nextChar();

    // String prop: name="value"
    if (["'", '"'].includes(firstChar)) {
        const quote = this.consumeChar();
        const value = this.consumeWhile(c => c !== quote);
        this.expect(quote);
        return { type: "string", value };
    }

    // Expression prop: name={value}
    if (firstChar === "{") {
        this.consumeChar();
        let depth = 1;
        let value = "";
        
        while (!this.eof() && depth > 0) {
            const ch = this.consumeChar();
            if (ch === "{") depth++;
            else if (ch === "}") depth--;
            
            if (depth > 0) value += ch;
        }
        return { type: "expression", value };
    }

    // Bare word (boolean or number-ish, rarely used in JSX but valid in HTML)
    const value = this.consumeWhile(c => c && !/[\s/>]/.test(c));
    return { type: "string", value };
};
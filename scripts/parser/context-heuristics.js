import { isIdentifierChar, isWhitespace } from "./char-classes.js";

// Resolves "<" (JSX tag vs less-than) and "/" (regex vs divide) ambiguity by
// checking the last meaningful character before it: an operator/keyword/open
// bracket means a new expression can start here, an identifier or ")"/"]"
// means the previous token was a value, so this must be a binary operator.

const EXPR_START_CHARS = new Set([
    "(", "{", "[", ",", ";", ":", "?", "=",
    "&", "|", "!", "+", "-", "*", "/", "%", "~", "^", ">",
]);

const EXPR_START_KEYWORDS = new Set([
    "return", "typeof", "instanceof", "in", "of", "new", "void", "delete",
    "yield", "await", "case", "do", "else", "default", "throw",
]);

/** @param {string} input @param {number} pos @returns {boolean} */
export function precedingContextAllowsExpression(input, pos) {
    let i = pos - 1;
    while (i >= 0 && isWhitespace(input[i])) i--;
    if (i < 0) return true; // start of input

    const ch = input[i];
    if (EXPR_START_CHARS.has(ch)) return true;
    if (!isIdentifierChar(ch)) return false;

    let start = i;
    while (start >= 0 && isIdentifierChar(input[start])) start--;
    const word = input.slice(start + 1, i + 1);
    return EXPR_START_KEYWORDS.has(word);
}

/** @param {string} input @param {number} pos @param {{requireExpressionContext?: boolean}} [options] @returns {boolean} */
export function looksLikeTagStart(input, pos, { requireExpressionContext = false } = {}) {
    if (input[pos] !== "<") return false;
    if (input[pos + 1] === "/") return false; // closing tag
    if (requireExpressionContext && !precedingContextAllowsExpression(input, pos)) return false;
    if (input[pos + 1] === ">") return true; // fragment <>
    return /[a-zA-Z]/.test(input[pos + 1] || "");
}

/** @param {string} input @param {number} pos @returns {boolean} */
export function looksLikeClosingTagStart(input, pos) {
    if (input[pos] !== "<" || input[pos + 1] !== "/") return false;
    if (input[pos + 2] === ">") return true; // fragment </>
    return /[a-zA-Z]/.test(input[pos + 2] || "");
}

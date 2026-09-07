// Character-class predicates shared by the tokenizer.

export const isWhitespace = (ch) => ch !== undefined && /\s/.test(ch);

export const isNameChar = (ch) => ch !== undefined && /[a-zA-Z0-9:_-]/.test(ch);

export const isIdentifierChar = (ch) => ch !== undefined && /[a-zA-Z0-9_$]/.test(ch);

export const isIdentifierStart = (ch) => ch !== undefined && /[a-zA-Z_$]/.test(ch);

export const isQuoteChar = (ch) => ch === "'" || ch === '"' || ch === "`";

export const isDigit = (ch) => ch !== undefined && /[0-9]/.test(ch);

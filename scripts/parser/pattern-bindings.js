// Best-effort extraction of the local names a destructuring pattern binds,
// e.g. "{a, b: c, d = 1, ...rest}" -> ["a", "c", "d", "rest"]. Used to
// generate `exports.x = x` lines for `export const {a, b} = obj`. A default
// value that itself contains a top-level "=" (an arrow function) can confuse
// this - accepted tradeoff for a destructuring export, which is rare anyway.

/**
 * @param {string} str
 * @param {string} sep
 * @returns {string[]}
 */
function splitTopLevel(str, sep) {
    const parts = [];
    let depth = 0;
    let current = "";
    let i = 0;

    while (i < str.length) {
        const ch = str[i];

        if (ch === "'" || ch === '"' || ch === "`") {
            const quote = ch;
            current += ch;
            i++;
            while (i < str.length && str[i] !== quote) {
                if (str[i] === "\\" && i + 1 < str.length) {
                    current += str[i] + str[i + 1];
                    i += 2;
                    continue;
                }
                current += str[i];
                i++;
            }
            current += str[i] || "";
            i++;
            continue;
        }

        if ("([{".includes(ch)) depth++;
        if (")]}".includes(ch)) depth--;

        if (ch === sep && depth === 0) {
            parts.push(current);
            current = "";
            i++;
            continue;
        }

        current += ch;
        i++;
    }

    if (current.trim() !== "") parts.push(current);
    return parts;
}

/**
 * @param {string} str
 * @returns {string|null}
 */
function firstIdentifier(str) {
    const match = str.trim().match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
    return match ? match[0] : null;
}

// Explicit @returns is required here, not just style: this function calls
// itself, and TS can't infer a self-recursive function's return type on its
// own (it would otherwise silently fall back to `any`, defeating the point).
/**
 * @param {string} patternSrc
 * @returns {string[]}
 */
export function extractPatternBindings(patternSrc) {
    const trimmed = patternSrc.trim();
    const inner = trimmed.slice(1, -1);
    const segments = splitTopLevel(inner, ",");
    /**
     * @type {string[]}
     */
    const names = [];

    for (let seg of segments) {
        seg = seg.trim();
        if (!seg) continue; // array hole, e.g. `[, a]`

        if (seg.startsWith("...")) {
            const id = firstIdentifier(seg.slice(3));
            if (id) names.push(id);
            continue;
        }

        const colonParts = splitTopLevel(seg, ":");
        const afterColon = colonParts.length > 1 ? colonParts.slice(1).join(":").trim() : seg;
        const bound = splitTopLevel(afterColon, "=")[0].trim();

        if (bound.startsWith("{") || bound.startsWith("[")) {
            names.push(...extractPatternBindings(bound));
        } else {
            const id = firstIdentifier(bound);
            if (id) names.push(id);
        }
    }

    return names;
}

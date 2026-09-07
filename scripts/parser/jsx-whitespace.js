// Collapses JSX text-child whitespace the way JSX itself does: whitespace-only
// lines vanish, a line break between two content lines becomes one space, and
// spacing on the same line as real content is left untouched. Only for JSX
// text children - never for raw JS code, which is whitespace/line sensitive.
export function normalizeJSXText(text) {
    const lines = text.split(/\r\n|\n|\r/);

    let lastNonEmptyLine = 0;
    lines.forEach((line, i) => {
        if (line.trim() !== "") lastNonEmptyLine = i;
    });

    let result = "";
    for (let i = 0; i <= lastNonEmptyLine; i++) {
        const isFirstLine = i === 0;
        const isLastNonEmptyLine = i === lastNonEmptyLine;

        let line = lines[i];
        if (!isFirstLine) line = line.replace(/^[ \t]+/, "");
        if (!isLastNonEmptyLine) line = line.replace(/[ \t]+$/, "");

        if (line) result += result ? ` ${line}` : line;
    }

    return result;
}

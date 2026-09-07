import { describe, it } from "node:test";
import assert from "node:assert/strict";

import Parser from "../scripts/parser/index.js";
import transpile from "../scripts/transpiler/index.js";

// Pure parser+transpiler unit tests - no DOM, no Preact, no jsdom. This is
// the "pipeline": JSX source text in, JS source text out. Component/event/
// bootloader behavior lives in runtime.test.mjs instead.
function compile(source) {
    const ast = new Parser(source).parse();
    return transpile(ast);
}

function evaluate(source) {
    const code = compile(source);
    const module = { exports: {} };
    new Function("require", "module", "exports", code)(() => ({}), module, module.exports);
    return module.exports;
}

describe("imports", () => {
    it("side-effect import", () => {
        assert.equal(compile(`import "./styles.css";`), `require("./styles.css");\n`);
    });

    it("default import", () => {
        assert.match(compile(`import React from "react";`), /const React = require\("react"\)\.default \|\| require\("react"\);/);
    });

    it("named imports", () => {
        const code = compile(`import { useState, useEffect } from "react";`);
        assert.match(code, /const \{ useState, useEffect \} = _pkg_react;/);
    });

    it("default + named imports combined", () => {
        const code = compile(`import React, { useState } from "react";`);
        assert.match(code, /const React = _pkg_react\.default \|\| _pkg_react;/);
        assert.match(code, /const \{ useState \} = _pkg_react;/);
    });

    it("named import with rename", () => {
        const code = compile(`import { useState as useLocalState } from "react";`);
        assert.match(code, /const \{ useState: useLocalState \} = _pkg_react;/);
        new Function("require", "module", "exports", code)(() => ({ useState: () => {} }), { exports: {} }, {});
    });

    it("namespace import", () => {
        assert.match(compile(`import * as React from "react";`), /const React = require\("react"\);/);
    });

    it("default + namespace combined", () => {
        const code = compile(`import React, * as ReactNS from "react";`);
        assert.match(code, /const ReactNS = _pkg_react;/);
        assert.match(code, /const React = _pkg_react\.default \|\| _pkg_react;/);
    });
});

describe("exports", () => {
    it("export default expression", () => {
        const exports = evaluate(`export default 42;`);
        assert.equal(exports.default, 42);
    });

    it("export default named function", () => {
        const exports = evaluate(`export default function App() { return 1; }`);
        assert.equal(exports.default.name, "App");
        assert.equal(exports.default(), 1);
    });

    it("export default anonymous function", () => {
        const exports = evaluate(`export default function() { return "anon"; }`);
        assert.equal(exports.default(), "anon");
    });

    it("export named function", () => {
        const exports = evaluate(`export function add(a, b) { return a + b; }`);
        assert.equal(exports.add(2, 3), 5);
    });

    it("export generator function", () => {
        const exports = evaluate(`export function* gen() { yield 1; yield 2; }`);
        assert.deepEqual([...exports.gen()], [1, 2]);
    });

    it("export named class", () => {
        const exports = evaluate(`export class Box { constructor(v) { this.v = v; } }`);
        assert.equal(new exports.Box(5).v, 5);
    });

    it("export const single declarator", () => {
        const exports = evaluate(`export const x = 1;`);
        assert.equal(exports.x, 1);
    });

    it("export let / var", () => {
        assert.equal(evaluate(`export let x = 1;`).x, 1);
        assert.equal(evaluate(`export var x = 1;`).x, 1);
    });

    it("export declarator without initializer", () => {
        const exports = evaluate(`export let x;`);
        assert.equal(exports.x, undefined);
        assert.ok("x" in exports);
    });

    it("export const multiple declarators", () => {
        const exports = evaluate(`export const a = 1, b = 2, c = 3;`);
        assert.deepEqual({ a: exports.a, b: exports.b, c: exports.c }, { a: 1, b: 2, c: 3 });
    });

    it("export const object destructuring", () => {
        const exports = evaluate(`const obj = { a: 1, b: 2 }; export const { a, b } = obj;`);
        assert.deepEqual({ a: exports.a, b: exports.b }, { a: 1, b: 2 });
    });

    it("export const object destructuring with rename", () => {
        const exports = evaluate(`const obj = { a: 1 }; export const { a: renamed } = obj;`);
        assert.equal(exports.renamed, 1);
    });

    it("export const nested object destructuring", () => {
        const exports = evaluate(`const obj = { a: 1, nested: { b: 2 } }; export const { a, nested: { b } } = obj;`);
        assert.deepEqual({ a: exports.a, b: exports.b }, { a: 1, b: 2 });
    });

    it("export const array destructuring", () => {
        const exports = evaluate(`const arr = [1, 2]; export const [a, b] = arr;`);
        assert.deepEqual({ a: exports.a, b: exports.b }, { a: 1, b: 2 });
    });

    it("export const mixed pattern and plain declarators", () => {
        const exports = evaluate(`const obj = { a: 1 }; export const { a } = obj, plain = 2;`);
        assert.deepEqual({ a: exports.a, plain: exports.plain }, { a: 1, plain: 2 });
    });

    it("export named list", () => {
        const exports = evaluate(`const x = 1, y = 2; export { x, y };`);
        assert.deepEqual({ x: exports.x, y: exports.y }, { x: 1, y: 2 });
    });

    it("export named list with rename", () => {
        const exports = evaluate(`const x = 1; export { x as renamed };`);
        assert.equal(exports.renamed, 1);
    });

    it("export named re-export from source", () => {
        const code = compile(`export { a, b as c } from "./other.js";`);
        assert.match(code, /const (_reexport_\w+) = require\("\.\/other\.js"\);/);
        const varName = code.match(/const (_reexport_\w+) = require/)[1];
        assert.match(code, new RegExp(`exports\\.a = ${varName}\\.a;`));
        assert.match(code, new RegExp(`exports\\.c = ${varName}\\.b;`));
    });

    it("export * from source", () => {
        const code = compile(`export * from "./other.js";`);
        assert.match(code, /Object\.assign\(exports, require\("\.\/other\.js"\)\);/);
    });

    it("does not corrupt a string literal containing the words 'export default'", () => {
        const exports = evaluate(`export const s = "please export default this literally";`);
        assert.equal(exports.s, "please export default this literally");
    });
});

describe("JSX elements and attributes", () => {
    it("self-closing element with no attributes", () => {
        assert.match(compile(`const x = <hr />;`), /React\.createElement\("hr", null\)/);
    });

    it("element with text child", () => {
        assert.match(compile(`const x = <p>hello</p>;`), /React\.createElement\("p", null, "hello"\)/);
    });

    it("nested elements", () => {
        const code = compile(`const x = <div><span>a</span><span>b</span></div>;`);
        assert.match(code, /React\.createElement\("div", null, React\.createElement\("span", null, "a"\), React\.createElement\("span", null, "b"\)\)/);
    });

    it("fragment shorthand", () => {
        assert.match(compile(`const x = <><p>a</p></>;`), /React\.createElement\(React\.Fragment, null, React\.createElement\("p", null, "a"\)\)/);
    });

    it("string attribute", () => {
        assert.match(compile(`const x = <div id="main" />;`), /React\.createElement\("div", \{ "id": "main" \}\)/);
    });

    it("expression attribute", () => {
        assert.match(compile(`const x = <div tabIndex={count + 1} />;`), /"tabIndex": count \+ 1/);
    });

    it("boolean attribute shorthand", () => {
        assert.match(compile(`const x = <input disabled />;`), /"disabled": true/);
    });

    it("spread attribute", () => {
        assert.match(compile(`const x = <div {...props} />;`), /React\.createElement\("div", \{ \.\.\.\(props\) \}\)/);
    });

    it("preserves attribute order (spread before named)", () => {
        const code = compile(`const x = <div {...props} id="x" />;`);
        assert.match(code, /\{ \.\.\.\(props\), "id": "x" \}/);
    });

    it("preserves attribute order (named before spread)", () => {
        const code = compile(`const x = <div id="x" {...props} />;`);
        assert.match(code, /\{ "id": "x", \.\.\.\(props\) \}/);
    });

    it("component tag names are not quoted", () => {
        assert.match(compile(`const x = <MyComponent />;`), /React\.createElement\(MyComponent, null\)/);
    });

    it("html tag names are quoted", () => {
        assert.match(compile(`const x = <div />;`), /React\.createElement\("div", null\)/);
    });

    it("member-expression tag names", () => {
        assert.match(compile(`const x = <Menu.Item />;`), /React\.createElement\(Menu\.Item, null\)/);
    });
});

describe("JSX expressions and whitespace", () => {
    it("simple expression child", () => {
        assert.match(compile(`const x = <p>{value}</p>;`), /React\.createElement\("p", null, value\)/);
    });

    it("conditional rendering with &&", () => {
        assert.match(compile(`const x = <div>{show && <span>yes</span>}</div>;`), /show && React\.createElement\("span", null, "yes"\)/);
    });

    it("ternary rendering with nested elements", () => {
        const code = compile(`const x = <div>{cond ? <a/> : <b/>}</div>;`);
        assert.match(code, /cond \? React\.createElement\("a", null\) : React\.createElement\("b", null\)/);
    });

    it("single-line text keeps internal spacing exactly", () => {
        assert.match(compile(`const x = <p>Timer: {n}s</p>;`), /"Timer: "/);
        assert.match(compile(`const x = <p>Timer: {n}s</p>;`), /"s"\)/);
    });

    it("collapses a multi-line whitespace-only gap between siblings", () => {
        const code = compile(`const x = (\n  <div>\n    <a/>\n    <b/>\n  </div>\n);`);
        assert.doesNotMatch(code, /"\s+"/); // no stray whitespace-only text node
    });

    it("keeps a single trailing space before an adjacent element on the next line", () => {
        const code = compile(`const x = (\n  <label>\n    Name: \n    <input/>\n  </label>\n);`);
        assert.match(code, /"Name: "/);
    });
});

describe("comments and regex literals", () => {
    it("line comment does not break parsing", () => {
        const code = compile(`// a comment\nconst x = <div/>;`);
        assert.match(code, /React\.createElement\("div", null\)/);
    });

    it("block comment does not break parsing, even with JSX-looking text inside", () => {
        const code = compile(`/* pretend <Foo> and { weird } stuff */\nconst x = <div/>;`);
        assert.match(code, /React\.createElement\("div", null\)/);
    });

    it("block comment inside a JSX expression", () => {
        const code = compile(`const x = <div>{/* comment */ value}</div>;`);
        assert.match(code, /React\.createElement\("div", null, .*value\)/);
    });

    it("regex literal is not confused with a string or JSX", () => {
        const exports = evaluate(`export const re = /['"{}<>]/g;`);
        assert.ok(exports.re instanceof RegExp);
        assert.ok(exports.re.test(`'"{}<>`));
    });

    it("regex literal right after an export keyword", () => {
        const code = compile(`export const check = () => /^a/.test("a");`);
        assert.match(code, /\/\^a\//);
    });
});

describe("less-than vs JSX ambiguity", () => {
    it("treats < as less-than when preceded by a value", () => {
        const code = compile(`function cmp(a, b) { return a < b; }`);
        assert.match(code, /return a < b;/);
    });

    it("still parses real JSX right after a comparison", () => {
        const code = compile(`function cmp(a, b) { return a < b; }\nconst x = <div>{cmp(1, 2) ? "y" : "n"}</div>;`);
        assert.match(code, /React\.createElement\("div", null, cmp\(1, 2\) \? "y" : "n"\)/);
    });

    it("treats < as JSX right after return", () => {
        const code = compile(`function f() { return <div/>; }`);
        assert.match(code, /return React\.createElement\("div", null\);/);
    });
});

describe("parser error handling", () => {
    it("throws on a mismatched closing tag", () => {
        assert.throws(() => compile(`const x = <div><span></div></span>;`), /Mismatched closing tag/);
    });

    it("throws (does not hang) on a truncated tag at EOF", () => {
        assert.throws(() => compile(`const x = <div`), /Parser Error/);
    });

    it("throws (does not hang) on an unexpected character in attribute position", () => {
        assert.throws(() => compile(`const x = <div @foo="1"></div>;`), /Parser Error/);
    });

    it("throws on an unterminated string literal instead of swallowing the rest of the file", () => {
        assert.throws(() => compile(`const x = "unterminated;\nconst y = 5;`), /Unterminated string literal/);
    });
});

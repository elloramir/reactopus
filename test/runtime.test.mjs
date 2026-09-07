import test from "node:test";
import assert from "node:assert/strict";
import { h, render } from "preact";

import Parser from "../scripts/parser/index.js";
import transpile from "../scripts/transpiler/index.js";
import { configureSandbox, executeCompiled } from "../scripts/runtime/sandbox.js";
import { boot, resetRuntimeState } from "../scripts/runtime/bootloader.js";
import { installDom, installVirtualFetch } from "./dom-env.mjs";

let loadCounter = 0;

// Parses+transpiles+executes one inline JSX source in isolation (no shared
// module registry entry, same as an inline <script type="text/jsx"> - see
// the ownDocumentUrl guard in scripts/runtime/sandbox.js). The URL includes
// a counter, not just exportName, so two tests never collide even if they
// happen to load a same-named export.
function loadComponent(source, exportName) {
    const ast = new Parser(source).parse();
    const code = transpile(ast);
    const url = `test://inline/${loadCounter++}/${exportName}`;

    configureSandbox({ ownDocumentUrl: url });
    const moduleExports = executeCompiled({ code, imports: [] }, url);
    return moduleExports[exportName];
}

// Registers an unmount via t.after() so effect cleanups (EffectTest's
// setInterval, in particular) run and don't keep the process alive.
function mount(t, Component) {
    installDom();
    const container = document.createElement("div");
    render(h(Component), container);
    t.after(() => render(null, container));
    return container;
}

async function flush(ms = 50) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

test("member-expression tag names parse (<Menu.Item>)", (t) => {
    const MenuTest = loadComponent(
        `
        import React from "react";
        const Menu = ({ children }) => <div>{children}</div>;
        Menu.Item = ({ children }) => <span data-testid="menu-item">{children}</span>;
        export const MenuTest = () => (
            <Menu>
                <Menu.Item>Click</Menu.Item>
            </Menu>
        );
        `,
        "MenuTest"
    );
    const container = mount(t, MenuTest);

    assert.match(container.textContent, /Click/);
    assert.ok(container.querySelector('[data-testid="menu-item"]'));
});

test("malformed JSX raises a parser error instead of hanging", () => {
    // A truncated tag or an unexpected attribute character used to spin the
    // attribute-parsing loop forever instead of failing.
    assert.throws(() => new Parser("const x = <div").parse(), /Parser Error/);
    assert.throws(() => new Parser('const x = <div @foo="1"></div>;').parse(), /Parser Error/);
});

test("unterminated string literal raises a parser error instead of swallowing the file", () => {
    assert.throws(() => new Parser('const x = "unterminated;\nconst y = 5;').parse(), /Unterminated string literal/);
});

test("basic elements and nested text render", (t) => {
    const BasicSyntax = loadComponent(
        `
        import React from "react";
        export const BasicSyntax = () => (
            <div data-testid="basic">
                <h4>Basic Syntax Test</h4>
                <p>If you see this, basic elements and text nested works.</p>
                <hr />
            </div>
        );
        `,
        "BasicSyntax"
    );
    const container = mount(t, BasicSyntax);

    assert.ok(container.querySelector('[data-testid="basic"]'));
    assert.match(container.textContent, /Basic Syntax Test/);
    assert.ok(container.querySelector("hr"));
});

test("useState updates the DOM on click", async (t) => {
    const HooksTest = loadComponent(
        `
        import React, { useState } from "react";
        export const HooksTest = () => {
            const [val, setVal] = useState(0);
            return (
                <div data-testid="hooks">
                    <p>Value: {val}</p>
                    <button onClick={() => setVal(val + 1)}>Increment</button>
                    {val > 0 && <span> Worked!</span>}
                </div>
            );
        };
        `,
        "HooksTest"
    );
    const container = mount(t, HooksTest);

    assert.match(container.textContent, /Value: 0/);

    container.querySelector("button").dispatchEvent(new window.Event("click", { bubbles: true }));
    await flush();

    assert.match(container.textContent, /Value: 1/);
    assert.match(container.textContent, /Worked!/);
});

test("props and children are passed through to a local component", (t) => {
    const PropsChildrenTest = loadComponent(
        `
        import React from "react";
        const Child = ({ name, children }) => (
            <div>
                <strong>Child: {name}</strong>
                <div>{children}</div>
            </div>
        );
        export const PropsChildrenTest = () => (
            <div data-testid="props">
                <Child name="Wrapper">
                    <span>I am a nested child via props.children</span>
                </Child>
                <Child name="Attributes" />
            </div>
        );
        `,
        "PropsChildrenTest"
    );
    const container = mount(t, PropsChildrenTest);

    assert.match(container.textContent, /Child: Wrapper/);
    assert.match(container.textContent, /nested child via props\.children/);
    assert.match(container.textContent, /Child: Attributes/);
});

test("controlled input and checkbox reflect their events", async (t) => {
    const FormTest = loadComponent(
        `
        import React, { useState } from "react";
        export const FormTest = () => {
            const [text, setText] = useState("");
            const [checked, setChecked] = useState(false);
            return (
                <div data-testid="form">
                    <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
                    <p>You typed: {text}</p>
                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    <span>Checkbox is {checked ? "Checked" : "Unchecked"}</span>
                </div>
            );
        };
        `,
        "FormTest"
    );
    const container = mount(t, FormTest);

    // Preact (unlike React) does not alias onChange to the native "input"
    // event - onChange only fires on the native "change" event, so that's
    // what a real interaction dispatches here.
    const input = container.querySelector('input[type="text"]');
    input.value = "hello";
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await flush();
    assert.match(container.textContent, /You typed: hello/);

    assert.match(container.textContent, /Checkbox is Unchecked/);
    const checkbox = container.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event("change", { bubbles: true }));
    await flush();
    assert.match(container.textContent, /Checkbox is Checked/);
    assert.doesNotMatch(container.textContent, /Unchecked/);
});

test("list add updates length and keys", async (t) => {
    const ListTest = loadComponent(
        `
        import React, { useState } from "react";
        export const ListTest = () => {
            const [items, setItems] = useState(["Apple", "Banana", "Cherry"]);
            const addItem = () => setItems([...items, "Fruit " + (items.length + 1)]);
            return (
                <div data-testid="lists">
                    <button onClick={addItem}>Add Fruit</button>
                    <ul>
                        {items.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                </div>
            );
        };
        `,
        "ListTest"
    );
    const container = mount(t, ListTest);

    assert.equal(container.querySelectorAll("li").length, 3);

    container.querySelector("button").dispatchEvent(new window.Event("click", { bubbles: true }));
    await flush();

    assert.equal(container.querySelectorAll("li").length, 4);
    assert.match(container.textContent, /Fruit 4/);
});

test("effect-driven component mounts in its pre-effect state", (t) => {
    const EffectTest = loadComponent(
        `
        import React, { useState, useEffect } from "react";
        export const EffectTest = () => {
            const [seconds, setSeconds] = useState(0);
            useEffect(() => {
                const id = setInterval(() => setSeconds((s) => s + 1), 1000);
                return () => clearInterval(id);
            }, []);
            return (
                <div data-testid="effects">
                    <p>Timer should increment: {seconds}s</p>
                    {seconds > 0 ? <span>Effect is running...</span> : <span>Waiting for effect...</span>}
                </div>
            );
        };
        `,
        "EffectTest"
    );
    const container = mount(t, EffectTest);

    assert.match(container.textContent, /Timer should increment: 0s/);
    assert.match(container.textContent, /Waiting for effect/);
});

test("a component that throws during render propagates the error", (t) => {
    const ErrorTest = loadComponent(
        `
        import React from "react";
        export const ErrorTest = () => {
            const dangerous = null;
            return <div data-testid="error">{dangerous.shouldCrash}</div>;
        };
        `,
        "ErrorTest"
    );
    installDom();
    const container = document.createElement("div");
    t.after(() => render(null, container));
    assert.throws(() => render(h(ErrorTest), container));
});

// End-to-end: the real bootloader resolving a two-file dependency graph
// through a virtualized fetch (see installVirtualFetch), the same pipeline a
// browser runs - exercises the loader/cache/sandbox together instead of one
// inline component at a time.
test("bootloader resolves a multi-file dependency graph and renders it", async (t) => {
    // loader.js/module-registry.js are page-level singletons (boot() only
    // ever runs once on a real page) - reset explicitly so this test doesn't
    // silently no-op if a future test reuses these same URLs.
    resetRuntimeState();
    installDom("http://localhost/index.html");
    installVirtualFetch({
        "/entry.jsx": `
            import React from "react";
            import ReactDOM from "react-dom";
            import { Greeting } from "./Greeting.jsx";
            ReactDOM.render(<Greeting name="Reactopus" />, document.getElementById("root"));
        `,
        "/Greeting.jsx": `
            import React from "react";
            export const Greeting = ({ name }) => <p data-testid="greeting">Hello, {name}!</p>;
        `,
    });

    const script = document.createElement("script");
    script.type = "text/jsx";
    script.src = "./entry.jsx";
    document.body.appendChild(script);

    const root = document.createElement("span");
    root.id = "root";
    document.body.appendChild(root);
    t.after(() => render(null, root));

    await boot({ cache: false, concurrency: 4, debug: false });
    await flush();

    const greeting = root.querySelector('[data-testid="greeting"]');
    assert.ok(greeting, "Greeting component did not render");
    assert.match(greeting.textContent, /Hello, Reactopus!/);
});

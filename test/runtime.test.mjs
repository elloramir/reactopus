import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { h, render } from "preact";

import Parser from "../scripts/parser/index.js";
import transpile from "../scripts/transpiler/index.js";
import { configureSandbox, executeCompiled } from "../scripts/runtime/sandbox.js";
import { boot, resetRuntimeState } from "../scripts/runtime/bootloader.js";
import { installDom, installVirtualFetch } from "./dom-env.mjs";

// DOM/component/event/bootloader behavior. Pure parser+transpiler output is
// covered in pipeline.test.mjs instead - nothing here should need to inspect
// generated code strings, only what actually renders and reacts to events.

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

// Registers an unmount via t.after() so effect cleanups (a live setInterval,
// in particular) run and don't keep the process alive.
function mount(t, Component, props) {
    installDom();
    const container = document.createElement("div");
    render(h(Component, props || null), container);
    t.after(() => render(null, container));
    return container;
}

function fire(el, type) {
    el.dispatchEvent(new window.Event(type, { bubbles: true }));
}

async function flush(ms = 50) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("element and text rendering", () => {
    it("renders nested static elements", (t) => {
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

    it("renders a fragment's children as siblings, with no wrapper element", (t) => {
        const FragmentTest = loadComponent(
            `
            import React from "react";
            export const FragmentTest = () => (
                <>
                    <p>first</p>
                    <p>second</p>
                </>
            );
            `,
            "FragmentTest"
        );
        const container = mount(t, FragmentTest);

        assert.equal(container.children.length, 2);
        assert.equal(container.children[0].tagName, "P");
        assert.equal(container.children[1].tagName, "P");
    });

    it("parses member-expression tag names (<Menu.Item>)", (t) => {
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

    it("passes props and children through to a local component", (t) => {
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
});

describe("hooks and state", () => {
    it("useState updates the DOM on click", async (t) => {
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
        fire(container.querySelector("button"), "click");
        await flush();

        assert.match(container.textContent, /Value: 1/);
        assert.match(container.textContent, /Worked!/);
    });

    it("useRef persists a mutable value across renders without triggering one itself", async (t) => {
        const RefTest = loadComponent(
            `
            import React, { useState, useRef } from "react";
            export const RefTest = () => {
                const [, forceRender] = useState(0);
                const renderCount = useRef(0);
                renderCount.current += 1;
                return (
                    <div data-testid="ref">
                        <p>Renders: {renderCount.current}</p>
                        <button onClick={() => forceRender((n) => n + 1)}>Re-render</button>
                    </div>
                );
            };
            `,
            "RefTest"
        );
        const container = mount(t, RefTest);

        assert.match(container.textContent, /Renders: 1/);
        fire(container.querySelector("button"), "click");
        await flush();
        assert.match(container.textContent, /Renders: 2/);
    });

    it("a class component's setState re-renders it", async (t) => {
        const ClassCounter = loadComponent(
            `
            import React from "react";
            export class ClassCounter extends React.Component {
                constructor(props) {
                    super(props);
                    this.state = { count: 0 };
                }
                render() {
                    return (
                        <div data-testid="class-counter">
                            <p>Count: {this.state.count}</p>
                            <button onClick={() => this.setState({ count: this.state.count + 1 })}>Bump</button>
                        </div>
                    );
                }
            }
            `,
            "ClassCounter"
        );
        const container = mount(t, ClassCounter);

        assert.match(container.textContent, /Count: 0/);
        fire(container.querySelector("button"), "click");
        await flush();
        assert.match(container.textContent, /Count: 1/);
    });

    it("mounts an effect-driven component in its pre-effect state", (t) => {
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
});

describe("forms and events", () => {
    it("reflects typed text and checkbox state", async (t) => {
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
        fire(input, "change");
        await flush();
        assert.match(container.textContent, /You typed: hello/);

        assert.match(container.textContent, /Checkbox is Unchecked/);
        const checkbox = container.querySelector('input[type="checkbox"]');
        checkbox.checked = true;
        fire(checkbox, "change");
        await flush();
        assert.match(container.textContent, /Checkbox is Checked/);
        assert.doesNotMatch(container.textContent, /Unchecked/);
    });

    it("boolean attribute shorthand actually disables the input", (t) => {
        const DisabledTest = loadComponent(
            `
            import React from "react";
            export const DisabledTest = () => <input data-testid="disabled-input" disabled />;
            `,
            "DisabledTest"
        );
        const container = mount(t, DisabledTest);

        assert.equal(container.querySelector('[data-testid="disabled-input"]').disabled, true);
    });

    it("spread props reach the rendered element's attributes", (t) => {
        const SpreadTest = loadComponent(
            `
            import React from "react";
            export const SpreadTest = () => {
                const extra = { "data-extra": "yes", title: "a title" };
                return <div data-testid="spread" {...extra} />;
            };
            `,
            "SpreadTest"
        );
        const container = mount(t, SpreadTest);
        const el = container.querySelector('[data-testid="spread"]');

        assert.equal(el.getAttribute("data-extra"), "yes");
        assert.equal(el.getAttribute("title"), "a title");
    });
});

describe("lists and reconciliation", () => {
    it("adding an item updates length and content", async (t) => {
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
        fire(container.querySelector("button"), "click");
        await flush();

        assert.equal(container.querySelectorAll("li").length, 4);
        assert.match(container.textContent, /Fruit 4/);
    });

    it("reversing a keyed list reuses the existing DOM nodes instead of recreating them", async (t) => {
        const ReorderTest = loadComponent(
            `
            import React, { useState } from "react";
            export const ReorderTest = () => {
                const [items, setItems] = useState(["a", "b", "c"]);
                return (
                    <div data-testid="reorder">
                        <button onClick={() => setItems([...items].reverse())}>Reverse</button>
                        <ul>
                            {items.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                    </div>
                );
            };
            `,
            "ReorderTest"
        );
        const container = mount(t, ReorderTest);

        const nodesBefore = [...container.querySelectorAll("li")];
        assert.deepEqual(nodesBefore.map((n) => n.textContent), ["a", "b", "c"]);

        fire(container.querySelector("button"), "click");
        await flush();

        const nodesAfter = [...container.querySelectorAll("li")];
        assert.deepEqual(nodesAfter.map((n) => n.textContent), ["c", "b", "a"]);
        // Preact's keyed diffing should move the same 3 DOM nodes rather than
        // destroy+recreate them - same identities, just reordered.
        assert.deepEqual(new Set(nodesAfter), new Set(nodesBefore));
    });
});

describe("error handling", () => {
    it("a component that throws during render propagates the error", (t) => {
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

    it("an error boundary catches a throwing child and renders its fallback instead", async (t) => {
        const Boundary = loadComponent(
            `
            import React from "react";
            export class Boundary extends React.Component {
                constructor(props) {
                    super(props);
                    this.state = { hasError: false };
                }
                static getDerivedStateFromError() {
                    return { hasError: true };
                }
                render() {
                    if (this.state.hasError) {
                        return <p data-testid="fallback">Something broke</p>;
                    }
                    return this.props.children;
                }
            }
            `,
            "Boundary"
        );
        const Bomb = loadComponent(
            `
            import React from "react";
            export const Bomb = () => {
                throw new Error("boom");
            };
            `,
            "Bomb"
        );
        installDom();
        const container = document.createElement("div");
        t.after(() => render(null, container));

        render(h(Boundary, null, h(Bomb)), container);
        await flush(); // getDerivedStateFromError's re-render is scheduled, not synchronous

        assert.ok(container.querySelector('[data-testid="fallback"]'));
        assert.match(container.textContent, /Something broke/);
    });
});

describe("bootloader integration", () => {
    // End-to-end: the real bootloader resolving a two-file dependency graph
    // through a virtualized fetch (see installVirtualFetch), the same
    // pipeline a browser runs - exercises the loader/cache/sandbox together
    // instead of one inline component at a time.
    it("resolves a multi-file dependency graph and renders it", async (t) => {
        // loader.js/module-registry.js are page-level singletons (boot() only
        // ever runs once on a real page) - reset explicitly so this test
        // doesn't silently no-op if a future test reuses these same URLs.
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

    it("isolates a parse error in one inline script from the rest of the page", async (t) => {
        resetRuntimeState();
        installDom("http://localhost/index.html");
        installVirtualFetch({});

        const broken = document.createElement("script");
        broken.type = "text/jsx";
        broken.textContent = `export const Broken = () => <div><span></div></span>;`; // mismatched closing tag

        const healthy = document.createElement("script");
        healthy.type = "text/jsx";
        healthy.textContent = `
            import React from "react";
            import ReactDOM from "react-dom";
            ReactDOM.render(<p data-testid="healthy">still works</p>, document.getElementById("root"));
        `;

        document.body.appendChild(broken);
        document.body.appendChild(healthy);

        const root = document.createElement("span");
        root.id = "root";
        document.body.appendChild(root);
        t.after(() => render(null, root));

        await boot({ cache: false, concurrency: 4, debug: false });
        await flush();

        assert.ok(root.querySelector('[data-testid="healthy"]'), "the script after the broken one should still run");
    });
});

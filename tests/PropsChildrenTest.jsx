import React from "react";

const Child = ({ name, children }) => (
    <div style={{ paddingLeft: "20px", borderLeft: "2px solid #ddd" }}>
        <strong>Child: {name}</strong>
        <div>{children}</div>
    </div>
);

export const PropsChildrenTest = () => {
    return (
        <div data-testid="props">
            <h4>Props & Children Test</h4>
            <Child name="Wrapper">
                <span>I am a nested child via props.children</span>
            </Child>
            <Child name="Attributes" />
        </div>
    );
};

import React, { useState } from "react";

export const FormTest = () => {
    const [text, setText] = useState("");
    const [checked, setChecked] = useState(false);

    return (
        <div data-testid="form">
            <h4>Form & Events Test</h4>
            <div style={{ marginBottom: "10px" }}>
                <label>
                    Controlled Input: 
                    <input 
                        type="text" 
                        value={text} 
                        onChange={(e) => setText(e.target.value)}
                        style={{ marginLeft: "5px" }}
                    />
                </label>
                <p>You typed: <strong>{text}</strong></p>
            </div>
            <div>
                <label style={{ userSelect: "none" }}>
                    <input 
                        type="checkbox" 
                        checked={checked} 
                        onChange={(e) => setChecked(e.target.checked)}
                    />
                    Checkbox is {checked ? "Checked" : "Unchecked"}
                </label>
            </div>
        </div>
    );
};

import React, { useState } from "react";

export const HooksTest = () => {
    const [val, setVal] = useState(0);

    return (
        <div data-testid="hooks">
            <h4>Hooks Test (useState)</h4>
            <p>Value: {val}</p>
            <button onClick={() => setVal(val + 1)}>Increment</button>
            {val > 0 && <span> Worked!</span>}
        </div>
    );
};

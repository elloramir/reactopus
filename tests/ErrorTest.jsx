import React from "react";

export const ErrorTest = () => {
    // Intentional runtime error to test error handling
    const dangerous = null;
    return (
        <div data-testid="error">
            <h4>Expected Error Test</h4>
            <p>Trying to read property of null...</p>
            {dangerous.shouldCrash}
        </div>
    );
};

import React, { useState, useEffect } from "react";

export const EffectTest = () => {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const intervalId = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div data-testid="effects">
            <h4>Effects (useEffect) Timer</h4>
            <p>Timer should increment: {seconds}s</p>
            {seconds > 0 ? (
                <span style={{ color: "green", fontSize: "0.8em" }}>Effect is running...</span>
            ) : (
                <span style={{ color: "orange", fontSize: "0.8em" }}>Waiting for effect...</span>
            )}
        </div>
    );
};

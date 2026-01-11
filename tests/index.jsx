import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { BasicSyntax } from "./BasicSyntax.jsx";
import { HooksTest } from "./HooksTest.jsx";
import { PropsChildrenTest } from "./PropsChildrenTest.jsx";
import { FormTest } from "./FormTest.jsx";
import { ListTest } from "./ListTest.jsx";
import { EffectTest } from "./EffectTest.jsx";
import { ErrorTest } from "./ErrorTest.jsx";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        if (this.props.onError) {
            this.props.onError(error);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ color: "red", padding: "10px", border: "1px solid red", backgroundColor: "#ffe6e6", borderRadius: "4px" }}>
                    <strong>Test Failed:</strong>
                    <pre style={{ margin: "5px 0", whiteSpace: "pre-wrap", fontSize: "0.85em" }}>
                        {this.state.error && this.state.error.message}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

const TestCard = ({ name, Component, onStatusChange }) => {
    const [status, setStatus] = useState("Passing");
    const hasFailed = React.useRef(false);

    const handleFail = () => {
        if (hasFailed.current) return;
        hasFailed.current = true;
        setStatus("Failed");
        if (onStatusChange) onStatusChange(name, "Failed");
    };

    useEffect(() => {
        // Report initial success if we haven't failed yet
        // We defer slightly to allow render to throw first if it's going to
        const timer = setTimeout(() => {
             if (!hasFailed.current) {
                 onStatusChange && onStatusChange(name, "Passing");
             }
        }, 10);
        return () => clearTimeout(timer);
    }, []);

    const isPassing = status === "Passing";

    return (
        <div style={{ 
            marginBottom: "15px", 
            padding: "15px", 
            border: "1px solid #ccc", 
            borderRadius: "8px", 
            backgroundColor: "#fff",
            borderLeft: `5px solid ${isPassing ? "green" : "red"}`
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <strong>{name}</strong>
                <span style={{ color: isPassing ? "green" : "red", fontSize: "0.9em", fontWeight: "bold" }}>
                    {isPassing ? "● Passing" : "● Failed"}
                </span>
            </div>
            <div style={{ padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
                 <ErrorBoundary onError={handleFail}>
                    <Component />
                 </ErrorBoundary>
            </div>
        </div>
    );
};

const AppTestRunner = () => {
    const tests = [
        { name: "01. Basic Element Structure", Component: BasicSyntax },
        { name: "02. Hooks & Interactive State", Component: HooksTest },
        { name: "03. Props & Composition", Component: PropsChildrenTest },
        { name: "04. Form Inputs & Events", Component: FormTest },
        { name: "05. Lists & Keys", Component: ListTest },
        { name: "06. useEffect & Side Effects", Component: EffectTest },
        // { name: "07. Runtime Error Handling", Component: ErrorTest },
    ];

    const [results, setResults] = useState({});

    const handleStatusUpdate = (name, status) => {
        setResults(prev => {
            if (prev[name] === status) return prev;
            return { ...prev, [name]: status };
        });
    };

    const total = tests.length;
    const passed = Object.values(results).filter(s => s === "Passing").length;
    const failed = Object.values(results).filter(s => s === "Failed").length;
    // We can also have "Pending" if we want, but visually we just care about totals

    return (
        <div style={{ fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
            <h1 style={{ borderBottom: "2px solid #333", paddingBottom: "10px" }}>
                Reactopus Test Suite
            </h1>
            
            <div style={{ 
                display: "flex", 
                gap: "20px", 
                margin: "20px 0", 
                padding: "15px", 
                backgroundColor: "#eee", 
                borderRadius: "8px",
                alignItems: "center"
            }}>
                <div style={{ fontSize: "1.2em", fontWeight: "bold" }}>Tests: {total}</div>
                <div style={{ color: "green", fontWeight: "bold" }}>Passing: {passed}</div>
                <div style={{ color: "red", fontWeight: "bold" }}>Failed: {failed}</div>
            </div>

            <p>
                Running on user provided root <code>&lt;span id='root'&gt;</code>.
                Below are the active integration tests for the parser.
            </p>
            
            <div className="test-list">
                {tests.map(test => (
                    <TestCard 
                        key={test.name} 
                        name={test.name} 
                        Component={test.Component} 
                        onStatusChange={handleStatusUpdate}
                    />
                ))}
            </div>
        </div>
    );
};

ReactDOM.render(<AppTestRunner />, document.getElementById("root"));

import React, { useState } from "react";

export const ListTest = () => {
    const [items, setItems] = useState(["Apple", "Banana", "Cherry"]);

    const addItem = () => {
        const newItem = "Fruit " + (items.length + 1);
        setItems([...items, newItem]);
    };

    return (
        <div data-testid="lists">
            <h4>Lists & Keys Test</h4>
            <button onClick={addItem} style={{ marginBottom: "10px" }}>Add Fruit</button>
            <ul style={{ paddingLeft: "20px", marginTop: "0" }}>
                {items.map((item, index) => (
                    <li key={index} style={{ color: index % 2 === 0 ? "blue" : "green" }}>
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
};

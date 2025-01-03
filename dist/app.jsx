export function helperTest() {
    return "hello sailor";
}

export default
function App() {
    // State para o contador
    const [count, setCount] = React.useState(0);
    // Referência para o texto da div
    const textRef = React.useRef("Clique para começar");
    // Função de clique
    const handleClick = () => {
        setCount(count + 1);  // Corrigido: usando setCount em vez de React.setCount
        // Quando o contador chega a 5, altera o texto da referência
        if (count + 1 === 5) {
            textRef.current = "Você clicou 5 vezes!";
        }
    };

    return (
        <div>
            <h1>{textRef.current}</h1>
            <button onClick={handleClick}>Clique aqui</button>
            <p>Contagem: {count}</p>
        </div>
    );
};

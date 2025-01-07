import data from "./data.json"
import Frag from "./frag/fragment.jsx"

const App = () => <h1>hello world</h1>
const Comment = () => (
	<div>
		<span>Comment session:</span>
		{/*<span>This is a commentary</span>*/}
	</div>
)

console.log(<App />);
console.log(<Frag />);
console.log(data);
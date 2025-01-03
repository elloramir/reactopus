### What is this and why?

Due to my frustration, and that of many others, I’ve created a simple environment to use React with just a single library.

React can feel overly complicated for newcomers—not because it’s inherently difficult, but because setting up a working project is a chaotic and cumbersome process. This is no surprise given that React started as an internal project at Facebook, not originally intended for public use. Over time, it proved its worth and became a standard, but it still carries the baggage of its origins.

My solution is to streamline React’s usage, offering a setup that feels simple and approachable—almost like vanilla JavaScript (even if not entirely vanilla).

### How can we achieve this?

- Eliminate Babel: We need to transpile code ourselves, as Babel is bloated and unnecessarily large for this purpose.
- Add module syntax support: This is essential for organizing and modularizing JSX applications effectively.
- Extract JSX from script tags: We need a mechanism to handle inline JSX or external sources specified with src attributes.

```html
<script type="text/javascript" src="reactopus.js"></script>
<script type="text/jsx">
	const App = () => (
		<h1>Hello World</h1>
	);

	// Corrigido: usando a sintaxe JSX para renderizar o componente
	ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>

<!-- You can also use src -->
<script type="text/jsx" src="app.jsx"></script>
```
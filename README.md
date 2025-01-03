### What is this and why?

I’ve created a simple environment to use React with just one library, addressing the frustration many face. React feels complicated for newcomers, not due to difficulty but because setting it up is chaotic. Originally an internal Facebook project, React wasn’t designed for public use and still carries that baggage. My solution simplifies React’s setup, making it approachable and almost like "vanilla" JavaScript.

### How can we achieve this?

1. Eliminate Babel: We need to transpile code ourselves, as Babel is bloated and unnecessarily large for this purpose.
2. Add module syntax support: This is essential for organizing and modularizing JSX applications effectively.
3. Extract JSX from script tags: We need a mechanism to handle inline JSX or external sources specified with src attributes.

```html
<script type="text/javascript" src="reactopus.js"></script>
<script type="text/jsx">
	const App = () => (
		<h1>Hello World</h1>
	);

	// Create root component
	ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>

<!-- You can also use src -->
<script type="text/jsx" src="app.jsx"></script>
```
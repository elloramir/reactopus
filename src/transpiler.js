const acorn = require("acorn");
const jsx = require("acorn-jsx");
const astring = require("astring");
const parser = acorn.Parser.extend(jsx());

// Extend the default generator to handle JSX and additional export/import scenarios
const jsxGenerator = Object.assign({}, astring.GENERATOR, {
    ExportDefaultDeclaration(node, state) {
        // Handles default exports, like `export default function() {}` or `export default class {}`
        if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') {
            const name = node.declaration.id.name; // Retrieve the name of the function or class
            this[node.declaration.type](node.declaration, state); // Generate the declaration code
            state.write(`;__export.default = ${name};\n`); // Assign it to `__export.default`
        } else {
            // For other types of default export declarations
            state.write(';__export.default = ');
            this[node.declaration.type](node.declaration, state);
            state.write(';\n');
        }
    },

    ExportNamedDeclaration(node, state) {
        // Handles named exports, like `export const x = 1;`
        if (node.declaration) {
            this[node.declaration.type](node.declaration, state); // Generate the declaration code

            // Add export assignments for variables, functions, or classes
            if (node.declaration.type === 'VariableDeclaration') {
                node.declaration.declarations.forEach(decl => {
                    state.write(`\n__export.${decl.id.name} = ${decl.id.name};`);
                });
            } else if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') {
                state.write(`\n__export.${node.declaration.id.name} = ${node.declaration.id.name};`);
            }
        }
        // Handles re-exports and specifier exports, like `export { x, y as z }`
        else if (node.specifiers) {
            node.specifiers.forEach(specifier => {
                const exportedName = specifier.exported.name; // Name being exported
                const localName = specifier.local.name; // Local binding being exported
                if (node.source) {
                    // Handles re-exports from another module
                    state.write(`__export.${exportedName} = (await ___require("${node.source.value}")).${localName};\n`);
                } else {
                    // Handles exports of local bindings
                    state.write(`__export.${exportedName} = ${localName};\n`);
                }
            });
        }
    },

    ImportDeclaration(node, state) {
        const source = node.source.value; // Import source (module path)
        let defaultImport = null;
        let namespaceImport = null;
        let namedImports = [];

        // Classify the different types of imports
        node.specifiers.forEach(specifier => {
            if (specifier.type === 'ImportDefaultSpecifier') {
                defaultImport = specifier.local.name; // Default import, e.g., `import x from 'module'`
            } else if (specifier.type === 'ImportNamespaceSpecifier') {
                namespaceImport = specifier.local.name; // Namespace import, e.g., `import * as x from 'module'`
            } else if (specifier.type === 'ImportSpecifier') {
                namedImports.push({
                    local: specifier.local.name, // Local name
                    imported: specifier.imported.name // Imported name
                });
            }
        });

        // Generate code for default and named imports
        if (defaultImport || namedImports.length > 0) {
            state.write('const ');
            let hasWrittenSomething = false;

            // Handle default imports
            if (defaultImport) {
                state.write(`${defaultImport} = (await ___require("${source}")).default`);
                hasWrittenSomething = true;
            }

            // Handle named imports
            if (namedImports.length > 0) {
                namedImports.forEach((imp, index) => {
                    if (hasWrittenSomething || index > 0) state.write(', ');
                    state.write(`${imp.local} = (await ___require("${source}")).${imp.imported}`);
                });
            }

            state.write(';\n');
        }

        // Generate code for namespace imports
        if (namespaceImport) {
            state.write(`const ${namespaceImport} = await ___require("${source}");\n`);
        }
    },

    JSXElement(node, state) {
        // Transforms JSX elements into React.createElement calls
        state.write('React.createElement(');

        // Handle the opening tag (element name)
        if (node.openingElement.name.type === 'JSXIdentifier') {
            const name = node.openingElement.name.name;
            if (name[0] === name[0].toUpperCase()) {
                state.write(name); // Capitalized names are assumed to be React components
            } else {
                state.write(`"${name}"`); // Lowercase names are assumed to be HTML tags
            }
        } else {
            this[node.openingElement.name.type](node.openingElement.name, state);
        }

        // Handle attributes
        if (node.openingElement.attributes.length > 0) {
            state.write(', {');
            node.openingElement.attributes.forEach((attr, index) => {
                if (index > 0) state.write(', ');
                this[attr.type](attr, state);
            });
            state.write('}');
        } else {
            state.write(', null');
        }

        // Handle children
        const validChildren = node.children.filter(child => {
            if (child.type === 'JSXText') {
                return child.value.trim().length > 0; // Ignore whitespace-only text nodes
            }
            return true;
        });

        if (validChildren.length > 0) {
            state.write(', ');
            validChildren.forEach((child, index) => {
                if (index > 0) state.write(', ');
                this[child.type](child, state);
            });
        }

        state.write(')');
    },

    JSXText(node, state) {
        // Handles text nodes within JSX
        const text = node.value.trim();
        if (text) {
            state.write(JSON.stringify(text)); // Convert to JSON string to escape special characters
        }
    },

    JSXExpressionContainer(node, state) {
        // Handles expressions within JSX, e.g., `{expression}`
        this[node.expression.type](node.expression, state);
    },

    JSXAttribute(node, state) {
        // Handles JSX attributes, e.g., `key={value}`
        if (node.name.type === 'JSXIdentifier') {
            state.write(node.name.name);
            state.write(': ');
            if (node.value === null) {
                state.write('true'); // For attributes without a value, e.g., `<input checked />`
            } else {
                this[node.value.type](node.value, state);
            }
        }
    },

    JSXSpreadAttribute(node, state) {
        // Handles spread attributes, e.g., `{...props}`
        state.write('...');
        this[node.argument.type](node.argument, state);
    }
});

// Function to parse and transform code
module.exports.parse = function (code) {
    const ast = parser.parse(code, {
        ecmaVersion: 2020, // Specify ECMAScript version
        sourceType: "module", // Indicate that the code is in module format
    });
    const parsed = astring.generate(ast, {
        generator: jsxGenerator, // Use the custom JSX generator
    });
    return parsed; // Return the transformed code
};

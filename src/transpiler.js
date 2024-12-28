const acorn = require("acorn");
const jsx = require("acorn-jsx");
const astring = require("astring");
const parser = acorn.Parser.extend(jsx());

const jsxGenerator = Object.assign({}, astring.GENERATOR, {
    ExportDefaultDeclaration(node, state) {
    },

    ExportNamedDeclaration(node, state) {
        
    },

    ImportDeclaration(node, state) {
        const source = node.source.value;
        node.specifiers.forEach((specifier, index) => {
            if (index === 0) {
                state.write('const ');
            }
            
            if (specifier.type === 'ImportDefaultSpecifier') {
                state.write(`${specifier.local.name} = await ___require("${source}")`);
            } else if (specifier.type === 'ImportSpecifier') {
                state.write(`${specifier.local.name} = (await ___require("${source}")).${specifier.imported.name}`);
            }
            
            if (index < node.specifiers.length - 1) {
                state.write(', ');
            }
            
            if (index === node.specifiers.length - 1) {
                state.write(';\n');
            }
        });
    },

    JSXElement(node, state) {
        state.write('React.createElement(');
        
        if (node.openingElement.name.type === 'JSXIdentifier') {
            const name = node.openingElement.name.name;
            if (name[0] === name[0].toUpperCase()) {
                state.write(name);
            } else {
                state.write(`"${name}"`);
            }
        } else {
            this[node.openingElement.name.type](node.openingElement.name, state);
        }
        
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
        
        const validChildren = node.children.filter(child => {
            if (child.type === 'JSXText') {
                return child.value.trim().length > 0;
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
        const text = node.value.trim();
        if (text) {
            state.write(JSON.stringify(text));
        }
    },
    
    JSXExpressionContainer(node, state) {
        this[node.expression.type](node.expression, state);
    },
    
    JSXAttribute(node, state) {
        if (node.name.type === 'JSXIdentifier') {
            state.write(node.name.name);
            state.write(': ');
            if (node.value === null) {
                state.write('true');
            } else {
                this[node.value.type](node.value, state);
            }
        }
    },
    
    JSXSpreadAttribute(node, state) {
        state.write('...');
        this[node.argument.type](node.argument, state);
    }
});

module.exports.parse = function (code) {
    const ast = parser.parse(code, {
        ecmaVersion: 2020,
        sourceType: "module",
    });
    const parsed = astring.generate(ast, {
        generator: jsxGenerator,
    });
    return parsed;
};
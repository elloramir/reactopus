const fs = require('fs');
const path = require('path');

// @note(ellora): I created a custom plugin to clear all license files
// since webpack is very annoying and creates a lot of useless files.
class Cleanup {
    apply(compiler) {
        compiler.hooks.done.tap('Cleanup', () => {
            fs.readdirSync(compiler.options.output.path).forEach(file => {
                if (file.endsWith('.txt')) {
                    fs.unlinkSync(path.join(compiler.options.output.path, file));
                }
            });
        });
    }
}

module.exports = {
    mode: 'development',
    entry: './scripts/index.js',
    devServer: {
        static: './',
        hot: true,
        port: 8080
    },
    output: {
        filename: 'reactopus.js',
        path: path.resolve(__dirname, '.'),
    },
    plugins: [
        new Cleanup()
    ]
};
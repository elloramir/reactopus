// Copyright 2024 Elloramir. All rights reserved.
// Use of this source code is governed by a MIT
// license that can be found in the LICENSE file.

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
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 3000
    },
    plugins: [new Cleanup()]
};
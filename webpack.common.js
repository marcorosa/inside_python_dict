const webpack = require('webpack');
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const {RawSource} = require('webpack-sources');
const {exec} = require('child_process');
const fs = require('fs');
const glob = require('glob-all');
const PurgecssPlugin = require('purgecss-webpack-plugin');
const whitelister = require('purgecss-whitelister');

class HackySSR {
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        // TODO: this duplicates mustache jsons. There should probably be a single source of truth
        const files = {
            'all.html': '["chapter1", "chapter2", "chapter3", "chapter4"]',
            'chapter1.html': '["chapter1"]',
            'chapter2.html': '["chapter2"]',
            'chapter3.html': '["chapter3"]',
            'chapter4.html': '["chapter4"]',
        };

        if (compiler.options.mode === 'development') {
            for (let name in files) {
                console.log('emit', name);
                compiler.plugin('emit', (compilation, cb) => {
                    fs.readFile(`build/${name}`, 'utf8', function(err, file) {
                        compilation.assets[name] = new RawSource(file);
                        cb();
                    });
                });
            }
        } else {
            for (let [name, chapters] of Object.entries(files)) {
                compiler.plugin('emit', (compilation, cb) => {
                    exec(`npm run --silent babel-node scripts/ssr.js build/${name} '${chapters}'`, function(
                        error,
                        stdout,
                        stderr
                    ) {
                        compilation.assets[name] = new RawSource(stdout);
                        cb();
                    });
                });
            }
        }
    }
}

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'app-bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: {
                    loader: 'babel-loader',
                    /* presets come from .babelrc */
                    options: {
                        plugins: ['lodash'],
                    },
                },
                exclude: /node_modules\/(?!subscribe-ui-event)/,
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
        ],
    },
    plugins: [
        new CleanWebpackPlugin(['dist']),
        new MiniCssExtractPlugin({filename: 'bundle.css'}),
        new HackySSR(),
        new PurgecssPlugin({
            paths: glob.sync([path.join(__dirname, 'src/*.js'), path.join(__dirname, 'dist/*.html')]),
            whitelist: whitelister([
                './node_modules/highlight.js/styles/default.css',
                './node_modules/rc-slider/assets/index.css',
                './node_modules/@fortawesome/fontawesome-svg-core/styles.css',
            ]),
        }),
    ],
};

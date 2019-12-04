const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: './js/main.js',
    mode: 'development',
    output: {
        path: path.resolve(__dirname, 'js/dist'),
        filename: 'main.bundle.js'
    },
    module: {
        rules: [
            {
                exclude: /node_modules/,
                use: ["babel-loader"]
            }
        ]
    },
    plugins: [
        new webpack.ProvidePlugin({
        "React": "react",
      }),
    ],
    resolve: {
        extensions: ["*", '.js', '.jsx']
    }
};
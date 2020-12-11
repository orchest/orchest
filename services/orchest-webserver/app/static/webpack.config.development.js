const path = require("path");

module.exports = {
  entry: "./js/main.js",
  mode: "development",
  watch: false,
  devtool: "eval-cheap-source-map",
  output: {
    path: path.resolve(__dirname, "js/dist"),
    filename: "main.bundle.js",
  },
  optimization: {
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
  },
  cache: {
    type: "memory",
  },
  module: {
    rules: [
      {
        use: [
          {
            loader: "babel-loader",
          },
        ],
        include: path.resolve(__dirname, "js"),
      },
    ],
  },
  resolve: {
    extensions: [".js"],
    symlinks: false,
  },
};

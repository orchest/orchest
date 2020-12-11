const path = require("path");

module.exports = {
  entry: "./js/src/main.js",
  mode: "production",
  devtool: "source-map",
  output: {
    path: path.resolve(__dirname, "js/dist"),
    filename: "main.bundle.js",
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

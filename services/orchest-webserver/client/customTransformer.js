/* eslint-disable @typescript-eslint/no-var-requires */

const { transformSync } = require("esbuild");
const path = require("path");
const babelJest = require("babel-jest");

/**
 * Disclaimer
 *
 * This jest transformer code is modified from https://github.com/aelbore/esbuild-jest
 * The reason for extending the oritinal code is that the original repo does not support esbuild options.
 */

const loaders = ["js", "jsx", "ts", "tsx", "json"];

const getExt = (str) => {
  const basename = path.basename(str);
  const firstDot = basename.indexOf(".");
  const lastDot = basename.lastIndexOf(".");
  const extname = path.extname(basename).replace(/(\.[a-z0-9]+).*/i, "$1");

  if (firstDot === lastDot) return extname;

  return basename.slice(firstDot, lastDot) + extname;
};

const options = {
  sourcemap: true,
  loaders: { ".test.ts": "tsx" },
};

const esbuildOptions = {
  // For mocking API calls with `msw`, it requires complete URL's.
  // https://mswjs.io/docs/getting-started/integrate/node#direct-usage
  // Therefore we need to replace the string literal `__BASE_URL__`
  // with testURL (NOTE: this `testURL` be the same as `testURL` in `jest.config.js`
  define: { __BASE_URL__: `"http://localhost:8080"` },
};

const { process: babelProcess } = babelJest.createTransformer({
  babelrc: false,
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
  ],
  plugins: ["@babel/plugin-transform-modules-commonjs"],
  parserOpts: {
    plugins: ["jsx", "typescript"],
  },
});

function babelTransform(opts) {
  const { sourceText, sourcePath, config, options } = opts;
  const babelResult = babelProcess(sourceText, sourcePath, config, options);
  return babelResult.code;
}

module.exports = {
  process(content, filename, config, opts) {
    const sources = { code: content };
    const ext = getExt(filename),
      extName = path.extname(filename).slice(1);

    const enableSourcemaps = options.sourcemap || false;
    const loader =
      options.loaders && options.loaders[ext]
        ? options.loaders[ext]
        : loaders.includes(extName)
        ? extName
        : "text";
    const sourcemaps = enableSourcemaps
      ? { sourcemap: true, sourcesContent: false, sourcefile: filename }
      : {};

    /// this logic or code from
    /// https://github.com/threepointone/esjest-transform/blob/main/src/index.js
    /// this will support the jest.mock
    /// https://github.com/aelbore/esbuild-jest/issues/12
    /// TODO: transform the jest.mock to a function using babel traverse/parse then hoist it
    if (sources.code.indexOf("ock(") >= 0 || (opts && opts.instrument)) {
      const source = babelTransform({
        sourceText: content,
        sourcePath: filename,
        config,
        options: opts,
      });
      sources.code = source;
    }

    const result = transformSync(sources.code, {
      loader,
      format: options.format || "cjs",
      target: options.target || "es2018",
      ...(options.jsxFactory ? { jsxFactory: options.jsxFactory } : {}),
      ...(options.jsxFragment ? { jsxFragment: options.jsxFragment } : {}),
      ...sourcemaps,
      ...esbuildOptions,
    });

    let { map, code } = result;
    if (enableSourcemaps) {
      map = {
        ...JSON.parse(result.map),
        sourcesContent: null,
      };

      // Append the inline sourcemap manually to ensure the "sourcesContent"
      // is null. Otherwise, breakpoints won't pause within the actual source.
      code =
        code +
        "\n//# sourceMappingURL=data:application/json;base64," +
        Buffer.from(JSON.stringify(map)).toString("base64");
    } else {
      map = null;
    }

    return { code, map };
  },
};

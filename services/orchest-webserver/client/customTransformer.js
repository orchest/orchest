/* eslint-disable @typescript-eslint/no-var-requires */

const { createTransformer } = require("esbuild-jest");

// For mocking API calls with `msw`, it requires complete URL's.
// https://mswjs.io/docs/getting-started/integrate/node#direct-usage
// Therefore we need to replace the string literal `__BASE_URL__`
// with testURL (NOTE: this `testURL` be the same as `testURL` in `jest.config.js`
const testURL = "http://localhost:8080";

const token = "__BASE_URL__";
const regex = new RegExp(token, "g");

const transformer = createTransformer({
  sourcemap: true,
  loaders: {
    ".test.ts": "tsx",
  },
});

module.exports = {
  process(fileContent, filePath, jestConfig) {
    return transformer.process(
      fileContent.replace(regex, `"${testURL}"`),
      fileContent,
      filePath,
      jestConfig
    );
  },
};

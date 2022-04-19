/* eslint-disable @typescript-eslint/no-var-requires */

const { createTransformer } = require("esbuild-jest");

// For mocking API calls with `msw`, it requires complete URL's.
// https://mswjs.io/docs/getting-started/integrate/node#direct-usage
// Therefore we need to replace the string literal `__BASE_URL__`
// with testURL (NOTE: this `testURL` be the same as `testURL` in `jest.config.js`

const transformer = createTransformer({
  sourcemap: true,
  define: {
    __BASE_URL__: `"http://localhost:8080"`,
  },
  loaders: {
    ".test.ts": "tsx",
  },
});

module.exports = transformer;

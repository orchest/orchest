/* eslint-disable @typescript-eslint/no-var-requires */

const { transformSync } = require("esbuild");

// For mocking API calls with `msw`, it requires complete URL's.
// https://mswjs.io/docs/getting-started/integrate/node#direct-usage
// Therefore we need to replace the string literal `__BASE_URL__`
// with `testURL` in `jest.config.js`.

module.exports = {
  process(src) {
    const result = transformSync(src, {
      define: { __BASE_URL__: '"http://localhost:8080"' },
    });
    return result;
  },
};

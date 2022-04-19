require("@testing-library/jest-dom/extend-expect");
require("jest-fetch-mock");
const { server } = require("./src/__mocks__/server.mock"); // eslint-disable-line @typescript-eslint/no-var-requires

// Establish API mocking before all tests.
beforeAll(() => server.listen());
// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => server.resetHandlers());
// Clean up after the tests are finished.
afterAll(() => server.close());

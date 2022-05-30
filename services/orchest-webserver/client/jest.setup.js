import "@testing-library/jest-dom/extend-expect";
import "jest-fetch-mock";
import "jest-localstorage-mock";
import { server } from "./src/__mocks__/server.mock";

// Establish API mocking before all tests.
beforeAll(() => server.listen());
// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => server.resetHandlers());
// Clean up after the tests are finished.
afterAll(() => server.close());

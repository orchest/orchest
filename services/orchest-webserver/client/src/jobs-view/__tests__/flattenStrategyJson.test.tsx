import { flattenStrategyJson } from "../common";
import {
  mockParameters,
  mockStrategyJson,
} from "../__mocks__/editJobView.mock";

const expected = mockParameters;

describe("flattenStrategyJson", () => {
  it("should flatten strategy JSON", () => {
    const result = flattenStrategyJson(mockStrategyJson);
    expect(result).toEqual(expected);
  });
});

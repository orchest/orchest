import { generatePipelineRunParamCombinations } from "../common";
import {
  mockParameters,
  mockPipelineRuns,
} from "../__mocks__/editJobView.mock";

describe("recursivelyGenerate", () => {
  it("should generate", () => {
    const result = generatePipelineRunParamCombinations(mockParameters, [], []);
    const expected = mockPipelineRuns;
    expect(result).toEqual(expected);
  });
});

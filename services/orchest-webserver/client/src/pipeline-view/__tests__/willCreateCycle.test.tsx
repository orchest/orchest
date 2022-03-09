import { PipelineStepState, StepsDict } from "@/types";
import { willCreateCycle } from "../common";

export const getMockStep = (
  payload: Partial<PipelineStepState>
): PipelineStepState => ({
  environment: "environment",
  file_path: "file_path",
  incoming_connections: [],
  kernel: {},
  title: "title",
  parameters: {},
  uuid: "0",
  meta_data: {
    hidden: false,
    position: [0, 0],
  },
});

/**
 * From left to right
 *
 *        1
 *      /   \
 *    0      3
 *      \
 *        2
 */

const mockSteps: StepsDict = {
  0: getMockStep({ uuid: "0" }),
  1: getMockStep({ uuid: "1", incoming_connections: ["0"] }),
  2: getMockStep({ uuid: "2", incoming_connections: ["0"] }),
  3: getMockStep({ uuid: "3", incoming_connections: ["1"] }),
};

describe("willCreateCycle", () => {
  it("should not mutate the original steps", () => {
    const original = mockSteps;
    willCreateCycle(mockSteps, ["0", "2"]);
    expect(original === mockSteps).toBe(true);
  });
  it("should return false if newConnection makes a cycle", () => {
    expect(willCreateCycle(mockSteps, ["3", "0"])).toBe(false);
    expect(willCreateCycle(mockSteps, ["3", "2"])).toBe(false);
  });
  it("should return true if newConnection does not make a cycle", () => {
    expect(willCreateCycle(mockSteps, ["0", "3"])).toBe(false);
    expect(willCreateCycle(mockSteps, ["2", "3"])).toBe(false);
  });
});

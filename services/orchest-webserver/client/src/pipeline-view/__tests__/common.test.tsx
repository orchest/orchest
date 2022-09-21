import { StepsDict, StepState } from "@/types";
import { createsLoop } from "../common";

export const getMockStep = (payload: Partial<StepState>): StepState => ({
  environment: "environment",
  file_path: "file_path",
  incoming_connections: [],
  outgoing_connections: [],
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

describe("createsLoop", () => {
  it("should not mutate the original steps", () => {
    const original = mockSteps;
    createsLoop(mockSteps, ["0", "2"]);
    expect(original === mockSteps).toBe(true);
  });
  it("should return false if newConnection makes a cycle", () => {
    expect(createsLoop(mockSteps, ["3", "0"])).toBe(false);
    expect(createsLoop(mockSteps, ["3", "2"])).toBe(false);
  });
  it("should return true if newConnection does not make a cycle", () => {
    expect(createsLoop(mockSteps, ["0", "3"])).toBe(false);
    expect(createsLoop(mockSteps, ["2", "3"])).toBe(false);
  });
});

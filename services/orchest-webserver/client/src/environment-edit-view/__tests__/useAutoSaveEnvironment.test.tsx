import type { Environment } from "@/types";
import { act, renderHook } from "@testing-library/react-hooks";
import { useAutoSaveEnvironment } from "../useAutoSaveEnvironment";

const mockEnvironment: Environment = {
  base_image: "python",
  gpu_support: true,
  language: "python",
  name: "my-environment",
  project_uuid: "79daf0bd-0e0a-4987-a891-eea5a676b41d",
  setup_script: 'echo "hello world"',
  uuid: "208ce46f-b583-4f25-a342-f0b3b4006a00",
};

describe("useAutoSaveEnvironment", () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  it("should fire save when given environment is changed", () => {
    jest.useFakeTimers();

    const save = jest.fn(() => null);

    const { rerender } = renderHook(
      ({ environment }) => useAutoSaveEnvironment(environment, save),
      { initialProps: { environment: mockEnvironment } }
    );

    rerender({
      environment: {
        ...mockEnvironment,
        base_image: "orchest/base-kernel-r",
        language: "r",
      },
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(save).toBeCalledTimes(1);
  });
});

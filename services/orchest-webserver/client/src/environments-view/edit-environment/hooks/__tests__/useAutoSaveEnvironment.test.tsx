import type { EnvironmentData } from "@/types";
import { act, renderHook } from "@testing-library/react-hooks";
import { useAutoSaveEnvironment } from "../useAutoSaveEnvironment";

const mockEnvironment: EnvironmentData = {
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
  it("should not save when given environment is unchanged", () => {
    jest.useFakeTimers();

    const save = jest.fn(() => Promise.resolve(null));

    const { rerender } = renderHook(
      ({ environment }) => useAutoSaveEnvironment(environment, save),
      { initialProps: { environment: mockEnvironment } }
    );

    rerender({ environment: { ...mockEnvironment } });
    act(() => {
      jest.runAllTimers();
    });
    rerender({ environment: { ...mockEnvironment } });
    act(() => {
      jest.runAllTimers();
    });

    expect(save).toBeCalledTimes(0);
  });
  it("should fire save when given environment is changed", () => {
    jest.useFakeTimers();

    const save = jest.fn(() => Promise.resolve(null));

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

    // doesn't save in 400ms
    act(() => {
      jest.advanceTimersByTime(230);
    });
    expect(save).toHaveBeenCalledTimes(0);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    // fired after timeout 250ms
    expect(save).toHaveBeenCalledTimes(1);
  });
});
